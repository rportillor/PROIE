// server/routes/bim-element-crud.ts
// ──────────────────────────────────────────────────────────────────────────────
// Full CRUD for BIM elements: Create, Read (single), Update properties, Delete
// Supports manual QS edits with audit trail (source: "manual" vs "extracted")
// ──────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { storage } from '../storage';
import { detectRelationships } from '../services/relationship-engine';
import { RelationshipGraph } from '../services/relationship-graph';
import { validateDimensions } from '../helpers/dimension-validator';

export const bimElementCrudRouter = Router();

// ── POST /api/bim/models/:modelId/elements — Create a new element ───────────
bimElementCrudRouter.post(
  '/api/bim/models/:modelId/elements',
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const {
        elementType,
        name,
        geometry,
        properties,
        material,
        storeyName,
        category,
      } = req.body;

      if (!elementType) {
        return res.status(400).json({ error: 'elementType is required' });
      }
      if (!geometry?.dimensions) {
        return res.status(400).json({ error: 'geometry.dimensions is required (length, width, height)' });
      }

      // Verify model exists
      const model = await storage.getBimModel(modelId);
      if (!model) {
        return res.status(404).json({ error: `Model ${modelId} not found` });
      }

      // Validate dimensions against realistic construction ranges
      const dimValidation = validateDimensions(elementType, geometry.dimensions);
      if (dimValidation.warnings.length > 0) {
        console.log(`⚠️ Dimension warnings for new ${elementType}:`, dimValidation.warnings);
      }
      // Use clamped dimensions
      geometry.dimensions = {
        ...geometry.dimensions,
        width: dimValidation.clamped.width,
        height: dimValidation.clamped.height,
        ...(dimValidation.clamped.depth ? { depth: dimValidation.clamped.depth } : {}),
      };

      // Generate unique element ID
      const elementId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Build the element with manual source tracking
      const newElement = await storage.createBimElement({
        modelId,
        elementId,
        elementType: elementType.toUpperCase(),
        name: name || `${elementType} (manual)`,
        geometry: {
          dimensions: geometry.dimensions,
          location: geometry.location || { realLocation: { x: 0, y: 0, z: 0 } },
          ...(geometry.polygon ? { polygon: geometry.polygon } : {}),
        },
        properties: {
          ...properties,
          source: 'manual',
          createdBy: 'QS',
          createdAt: new Date().toISOString(),
        },
        material: material || null,
        storeyName: storeyName || null,
        category: category || (elementType.match(/wall|door|window|partition|ceiling|stair/i) ? 'Architectural' :
                               elementType.match(/column|beam|foundation|slab/i) ? 'Structural' : 'MEP'),
        location: JSON.stringify(geometry.location || { realLocation: { x: 0, y: 0, z: 0 } }),
        rfiFlag: false,
        needsAttention: false,
      });

      // After creating, detect relationships with existing elements
      const allElements = await storage.getBimElements(modelId);
      const relationships = detectRelationships(allElements.map((e: any) => ({
        ...e,
        geometry: typeof e.geometry === 'string' ? JSON.parse(e.geometry) : e.geometry,
        properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties,
      })));

      // Find relationships involving the new element
      const newRelationships = relationships.filter(
        (r: any) => r.sourceId === newElement.elementId || r.targetId === newElement.elementId
      );

      console.log(`✅ CREATE: ${elementType} "${name}" added to model ${modelId} (${newRelationships.length} relationships detected)`);

      res.status(201).json({
        success: true,
        element: newElement,
        relationships: newRelationships,
      });
    } catch (error: any) {
      console.error('Error creating BIM element:', error);
      res.status(500).json({ error: `Failed to create element: ${error?.message}` });
    }
  },
);

// ── GET /api/bim/models/:modelId/elements/:elementId — Get single element ───
bimElementCrudRouter.get(
  '/api/bim/models/:modelId/elements/:elementId',
  async (req: Request, res: Response) => {
    try {
      const { elementId } = req.params;
      const element = await storage.getBimElement(elementId);
      if (!element) {
        return res.status(404).json({ error: `Element ${elementId} not found` });
      }
      res.json({ success: true, element });
    } catch (error: any) {
      console.error('Error fetching BIM element:', error);
      res.status(500).json({ error: `Failed to fetch element: ${error?.message}` });
    }
  },
);

// ── PATCH /api/bim/models/:modelId/elements/:elementId — Update properties ──
bimElementCrudRouter.patch(
  '/api/bim/models/:modelId/elements/:elementId',
  async (req: Request, res: Response) => {
    try {
      const { modelId, elementId } = req.params;
      const updates = req.body;

      // Look up element by DB id
      const existing = await storage.getBimElement(elementId);
      if (!existing) {
        return res.status(404).json({ error: `Element ${elementId} not found` });
      }

      // Build partial update — only include fields that were sent
      const updateData: Record<string, any> = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.material !== undefined) updateData.material = updates.material;
      if (updates.elementType !== undefined) updateData.elementType = updates.elementType.toUpperCase();
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.storeyName !== undefined) updateData.storeyName = updates.storeyName;
      if (updates.elevation !== undefined) updateData.elevation = updates.elevation;

      // Merge geometry updates (dimensions, location)
      if (updates.geometry) {
        const existingGeom = typeof existing.geometry === 'string'
          ? JSON.parse(existing.geometry) : (existing.geometry || {});

        if (updates.geometry.dimensions) {
          existingGeom.dimensions = { ...existingGeom.dimensions, ...updates.geometry.dimensions };
        }
        if (updates.geometry.location) {
          existingGeom.location = { ...existingGeom.location, ...updates.geometry.location };
        }
        updateData.geometry = existingGeom;
      }

      // Merge property updates and add edit audit trail
      if (updates.properties) {
        const existingProps = typeof existing.properties === 'string'
          ? JSON.parse(existing.properties) : (existing.properties || {});

        updateData.properties = {
          ...existingProps,
          ...updates.properties,
          lastEditedBy: 'QS',
          lastEditedAt: new Date().toISOString(),
          editHistory: [
            ...(existingProps.editHistory || []),
            {
              timestamp: new Date().toISOString(),
              fields: Object.keys(updates.properties),
              by: 'QS',
            },
          ],
        };
      }

      // Quantity updates
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.quantityMetric !== undefined) updateData.quantityMetric = updates.quantityMetric;
      if (updates.quantityImperial !== undefined) updateData.quantityImperial = updates.quantityImperial;
      if (updates.unit !== undefined) updateData.unit = updates.unit;

      const updated = await storage.updateBimElement(elementId, updateData);

      console.log(`✏️ UPDATE: element ${elementId} — fields: ${Object.keys(updateData).join(', ')}`);

      res.json({
        success: true,
        element: updated,
        updatedFields: Object.keys(updateData),
      });
    } catch (error: any) {
      console.error('Error updating BIM element:', error);
      res.status(500).json({ error: `Failed to update element: ${error?.message}` });
    }
  },
);

// ── DELETE /api/bim/models/:modelId/elements/:elementId — Delete element ────
bimElementCrudRouter.delete(
  '/api/bim/models/:modelId/elements/:elementId',
  async (req: Request, res: Response) => {
    try {
      const { modelId, elementId } = req.params;

      const existing = await storage.getBimElement(elementId);
      if (!existing) {
        return res.status(404).json({ error: `Element ${elementId} not found` });
      }

      // Before deleting, check for hosted elements (e.g., doors in a wall)
      const allElements = await storage.getBimElements(modelId);
      const parsed = allElements.map((e: any) => ({
        ...e,
        geometry: typeof e.geometry === 'string' ? JSON.parse(e.geometry) : e.geometry,
        properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties,
      }));
      const relationships = detectRelationships(parsed);
      const graph = new RelationshipGraph(relationships);

      // Find elements hosted by this one
      const hostedIds = graph.getNeighbors(existing.elementId || elementId)
        .filter((n: any) => n.type === 'hosted_by' && n.targetId === (existing.elementId || elementId))
        .map((n: any) => n.sourceId);

      const deleted = await storage.deleteBimElement(elementId);

      console.log(`🗑️ DELETE: element ${elementId} (${existing.elementType}) removed from model ${modelId}`);

      res.json({
        success: true,
        deletedId: elementId,
        elementType: existing.elementType,
        hostedElementsOrphaned: hostedIds,
        warning: hostedIds.length > 0
          ? `${hostedIds.length} hosted elements are now orphaned (e.g., doors/windows in deleted wall)`
          : undefined,
      });
    } catch (error: any) {
      console.error('Error deleting BIM element:', error);
      res.status(500).json({ error: `Failed to delete element: ${error?.message}` });
    }
  },
);

// ── POST /api/bim/models/:modelId/elements/:elementId/split — Split wall ────
bimElementCrudRouter.post(
  '/api/bim/models/:modelId/elements/:elementId/split',
  async (req: Request, res: Response) => {
    try {
      const { modelId, elementId } = req.params;
      const { splitPoint } = req.body; // { x, y } — point along the wall to split at

      if (!splitPoint?.x == null || splitPoint?.y == null) {
        return res.status(400).json({ error: 'splitPoint {x, y} is required' });
      }

      const existing = await storage.getBimElement(elementId);
      if (!existing) {
        return res.status(404).json({ error: `Element ${elementId} not found` });
      }

      const geom = typeof existing.geometry === 'string' ? JSON.parse(existing.geometry) : existing.geometry;
      const props = typeof existing.properties === 'string' ? JSON.parse(existing.properties) : existing.properties;

      if (!props?.start || !props?.end) {
        return res.status(400).json({ error: 'Element must be a wall with start/end points to split' });
      }

      const start = props.start;
      const end = props.end;
      const sp = { x: Number(splitPoint.x), y: Number(splitPoint.y) };

      // Calculate wall length and split ratio
      const wallLength = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      const splitDist = Math.sqrt((sp.x - start.x) ** 2 + (sp.y - start.y) ** 2);
      const ratio = splitDist / wallLength;

      if (ratio < 0.05 || ratio > 0.95) {
        return res.status(400).json({ error: 'Split point too close to wall endpoints (min 5% from each end)' });
      }

      // Create two new wall segments
      const wall1Id = `split_${Date.now()}_a`;
      const wall2Id = `split_${Date.now()}_b`;

      const wall1Length = wallLength * ratio;
      const wall2Length = wallLength * (1 - ratio);

      const commonFields = {
        modelId,
        elementType: existing.elementType,
        category: existing.category,
        material: existing.material,
        storeyName: existing.storeyName,
        elevation: existing.elevation,
        rfiFlag: false,
        needsAttention: false,
      };

      const wall1 = await storage.createBimElement({
        ...commonFields,
        elementId: wall1Id,
        name: `${existing.name || 'Wall'} (A)`,
        geometry: {
          dimensions: { ...geom.dimensions, length: wall1Length, width: wall1Length },
          location: { realLocation: { x: (start.x + sp.x) / 2, y: (start.y + sp.y) / 2, z: geom.location?.realLocation?.z || 0 } },
        },
        properties: {
          ...props,
          start: start,
          end: sp,
          source: 'manual_split',
          splitFrom: existing.elementId,
        },
        location: JSON.stringify({ realLocation: { x: (start.x + sp.x) / 2, y: (start.y + sp.y) / 2, z: geom.location?.realLocation?.z || 0 } }),
      });

      const wall2 = await storage.createBimElement({
        ...commonFields,
        elementId: wall2Id,
        name: `${existing.name || 'Wall'} (B)`,
        geometry: {
          dimensions: { ...geom.dimensions, length: wall2Length, width: wall2Length },
          location: { realLocation: { x: (sp.x + end.x) / 2, y: (sp.y + end.y) / 2, z: geom.location?.realLocation?.z || 0 } },
        },
        properties: {
          ...props,
          start: sp,
          end: end,
          source: 'manual_split',
          splitFrom: existing.elementId,
        },
        location: JSON.stringify({ realLocation: { x: (sp.x + end.x) / 2, y: (sp.y + end.y) / 2, z: geom.location?.realLocation?.z || 0 } }),
      });

      // Delete the original wall
      await storage.deleteBimElement(elementId);

      console.log(`✂️ SPLIT: wall ${elementId} split at ratio ${ratio.toFixed(2)} → ${wall1Id}, ${wall2Id}`);

      res.json({
        success: true,
        deletedWallId: elementId,
        newWalls: [wall1, wall2],
        splitRatio: ratio,
      });
    } catch (error: any) {
      console.error('Error splitting wall:', error);
      res.status(500).json({ error: `Failed to split wall: ${error?.message}` });
    }
  },
);

// ── POST /api/bim/models/:modelId/elements/:elementId/host — Host in wall ───
bimElementCrudRouter.post(
  '/api/bim/models/:modelId/elements/:elementId/host',
  async (req: Request, res: Response) => {
    try {
      const { modelId, elementId } = req.params;
      const { hostWallId, parameterT } = req.body; // parameterT: 0-1 position along wall

      if (!hostWallId) {
        return res.status(400).json({ error: 'hostWallId is required' });
      }

      const element = await storage.getBimElement(elementId);
      const wall = await storage.getBimElement(hostWallId);

      if (!element) return res.status(404).json({ error: `Element ${elementId} not found` });
      if (!wall) return res.status(404).json({ error: `Host wall ${hostWallId} not found` });

      const wallProps = typeof wall.properties === 'string' ? JSON.parse(wall.properties) : wall.properties;
      if (!wallProps?.start || !wallProps?.end) {
        return res.status(400).json({ error: 'Host wall must have start/end points' });
      }

      // Calculate position along the wall
      const t = Math.max(0.05, Math.min(0.95, Number(parameterT) || 0.5));
      const hostX = wallProps.start.x + t * (wallProps.end.x - wallProps.start.x);
      const hostY = wallProps.start.y + t * (wallProps.end.y - wallProps.start.y);
      const wallGeom = typeof wall.geometry === 'string' ? JSON.parse(wall.geometry) : wall.geometry;
      const hostZ = wallGeom?.location?.realLocation?.z || 0;

      // Update element position and hosting info
      const elemGeom = typeof element.geometry === 'string' ? JSON.parse(element.geometry) : element.geometry;
      const elemProps = typeof element.properties === 'string' ? JSON.parse(element.properties) : element.properties;

      elemGeom.location = { realLocation: { x: hostX, y: hostY, z: hostZ } };
      elemProps.hostedIn = hostWallId;
      elemProps.parameterT = t;
      elemProps.lastEditedBy = 'QS';
      elemProps.lastEditedAt = new Date().toISOString();

      const updated = await storage.updateBimElement(elementId, {
        geometry: elemGeom,
        properties: elemProps,
        location: JSON.stringify({ realLocation: { x: hostX, y: hostY, z: hostZ } }),
      });

      console.log(`🚪 HOST: ${element.elementType} ${elementId} hosted in wall ${hostWallId} at T=${t.toFixed(2)}`);

      res.json({
        success: true,
        element: updated,
        hostedIn: hostWallId,
        parameterT: t,
        position: { x: hostX, y: hostY, z: hostZ },
      });
    } catch (error: any) {
      console.error('Error hosting element:', error);
      res.status(500).json({ error: `Failed to host element: ${error?.message}` });
    }
  },
);
