/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  3D MODEL BUILDER — Orchestrates the full geometry pipeline
 *  Converts AI-extracted element data into real 3D BIMSolid objects.
 *  This is the bridge between:
 *    - Claude's drawing analysis (raw element descriptions)
 *    - IFC/DWG/DXF imports (native CAD data)
 *    - PDF text extraction (tabular data)
 *  ...and the 3D geometry engine (parametric-elements, geometry-kernel).
 *
 *  Pipeline:
 *    1. Accept raw elements from any source
 *    2. Classify and normalize element types
 *    3. Build parametric geometry (walls, columns, beams, slabs, MEP)
 *    4. Resolve spatial relationships (host/void, connections)
 *    5. Derive quantities from actual geometry
 *    6. Run clash detection
 *    7. Export to IFC4 / viewer format
 * ══════════════════════════════════════════════════════════════════════════════
 */

import {
  type Vec2, type Vec3, vec2, vec3, v3add, v3sub, v3len,
  type SerializedMesh, serializeMesh, meshVolume, meshSurfaceArea, meshLateralArea,
} from './geometry-kernel';

import {
  type BIMSolid, type WallParams, type WallOpeningDef,
  createWall, createColumn, createBeam, createSlab, createFooting, createStair,
  createDuct, createPipe, createCableTray, createFixture,
  inferWallAssembly, WALL_ASSEMBLIES, serializeBIMSolid,
} from './parametric-elements';

import { importIFC, type IFCImportResult } from './ifc-import-engine';
import { parseDXF, convertDXFToBIM, isDXFContent, type DXFImportResult } from './dwg-dxf-import';
import { runClashDetection, summarizeClashes, type ClashResult, type ClashSummary } from './clash-detection';
import { routeMEPRun, layoutSprinklers, layoutLights, type MEPRunDef } from './mep-routing';
import { exportBIMToIFC4, type IFCExportV2Options } from './ifc-export-v2';

// ═══════════════════════════════════════════════════════════════════════════════
//  RAW ELEMENT INPUT (from Claude / legacy system)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RawBIMInput {
  id: string;
  type: string;              // 'Wall', 'Column', 'Door', 'Window', etc.
  name?: string;
  category?: string;         // 'Architectural', 'Structural', 'MEP'
  storey?: string;
  elevation?: number;

  // Dimensions from AI extraction
  length?: number;           // metres
  width?: number;            // metres
  height?: number;           // metres
  thickness?: number;        // metres
  depth?: number;            // metres
  diameter?: number;         // metres (pipes, ducts, columns)
  area?: number;             // m²
  volume?: number;           // m³

  // Position from AI extraction
  x?: number;                // metres
  y?: number;                // metres
  z?: number;                // metres
  startX?: number; startY?: number;   // wall start
  endX?: number; endY?: number;       // wall end

  // Material
  material?: string;

  // For openings
  hostId?: string;           // wall ID that hosts this door/window
  sillHeight?: number;       // window sill height
  positionAlongWall?: number; // distance from wall start

  // MEP
  system?: string;           // HVAC system type
  shape?: 'circular' | 'rectangular';
  path?: { x: number; y: number; z: number }[];

  // Polygon boundary (for slabs)
  boundary?: { x: number; y: number }[];

  // Source tracking
  source?: string;
  properties?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILD RESULT
// ═══════════════════════════════════════════════════════════════════════════════

export interface BuildResult {
  elements: BIMSolid[];
  clashes: ClashResult[];
  clashSummary: ClashSummary;
  stats: {
    totalElements: number;
    byType: Record<string, number>;
    byStorey: Record<string, number>;
    byCategory: Record<string, number>;
    totalVolume: number;
    totalArea: number;
    withGeometry: number;
  };
  ifcContent?: string;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILDING CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export interface BuildingContext {
  name: string;
  storeys: { name: string; elevation: number; floorToFloorHeight: number }[];
  footprint?: Vec2[];         // building perimeter polygon
  gridX?: number[];           // structural grid X positions
  gridY?: number[];           // structural grid Y positions
  defaultWallHeight?: number;
  defaultSlabThickness?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN BUILD FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function buildModel(
  rawElements: RawBIMInput[],
  context: BuildingContext,
  options?: { runClashCheck?: boolean; generateIFC?: boolean; ifcOptions?: IFCExportV2Options },
): BuildResult {
  const warnings: string[] = [];
  const elements: BIMSolid[] = [];

  // Group raw elements by type for proper ordering (walls before doors)
  const walls: RawBIMInput[] = [];
  const openings: RawBIMInput[] = [];
  const columns: RawBIMInput[] = [];
  const beams: RawBIMInput[] = [];
  const slabs: RawBIMInput[] = [];
  const foundations: RawBIMInput[] = [];
  const stairs: RawBIMInput[] = [];
  const mep: RawBIMInput[] = [];
  const fixtures: RawBIMInput[] = [];
  const other: RawBIMInput[] = [];

  for (const raw of rawElements) {
    const t = (raw.type || '').toUpperCase();
    if (/WALL|PARTITION|CURTAIN/.test(t)) walls.push(raw);
    else if (/DOOR/.test(t)) openings.push(raw);
    else if (/WINDOW|GLAZING/.test(t)) openings.push(raw);
    else if (/COLUMN|PILLAR/.test(t)) columns.push(raw);
    else if (/BEAM|GIRDER|JOIST/.test(t)) beams.push(raw);
    else if (/SLAB|FLOOR|DECK|ROOF/.test(t)) slabs.push(raw);
    else if (/FOOTING|FOUNDATION|PILE/.test(t)) foundations.push(raw);
    else if (/STAIR/.test(t)) stairs.push(raw);
    else if (/DUCT|PIPE|CABLE|CONDUIT/.test(t)) mep.push(raw);
    else if (/LIGHT|SPRINKLER|PANEL|RECEPTACLE|SWITCH|SMOKE/.test(t)) fixtures.push(raw);
    else other.push(raw);
  }

  // ── BUILD WALLS ───────────────────────────────────────────────────────
  const wallMap = new Map<string, BIMSolid>();

  for (const raw of walls) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;
    const height = raw.height || storeyInfo?.floorToFloorHeight || context.defaultWallHeight || 3.0;
    const isExterior = /EXT|EXTERIOR|FACADE|CURTAIN/i.test(raw.type || '') || /EXT/i.test(raw.material || '');

    let start: Vec2, end: Vec2;
    if (raw.startX != null && raw.startY != null && raw.endX != null && raw.endY != null) {
      start = vec2(raw.startX, raw.startY);
      end = vec2(raw.endX, raw.endY);
    } else if (raw.x != null && raw.y != null && raw.length) {
      // Infer start/end from position + length (horizontal by default)
      start = vec2(raw.x, raw.y);
      end = vec2(raw.x + raw.length, raw.y);
    } else {
      warnings.push(`Wall "${raw.name || raw.id}" missing position data — placed at origin`);
      start = vec2(0, 0);
      end = vec2(raw.length || 5, 0);
    }

    const assembly = inferWallAssembly(raw.material, isExterior);

    const result = createWall({
      id: raw.id,
      name: raw.name || `Wall ${raw.id}`,
      start, end,
      height,
      assembly,
      storey,
      elevation,
      isExterior,
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    });

    wallMap.set(raw.id, result.wall);
    elements.push(result.wall);
  }

  // ── BUILD OPENINGS (doors/windows) ────────────────────────────────────
  for (const raw of openings) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;
    const isDoor = /DOOR/i.test(raw.type || '');

    const pos = vec3(raw.x || 0, raw.y || 0, elevation + (raw.sillHeight || (isDoor ? 0 : 0.9)));
    const width = raw.width || (isDoor ? 0.9 : 1.0);
    const height = raw.height || (isDoor ? 2.1 : 1.2);

    const fixture = createFixture({
      id: raw.id,
      name: raw.name || `${isDoor ? 'Door' : 'Window'} ${raw.id}`,
      type: 'generic',
      position: pos,
      storey,
      elevation,
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    });

    // Override type
    fixture.type = isDoor ? 'Door' : 'Window';
    fixture.ifcClass = isDoor ? 'IFCDOOR' : 'IFCWINDOW';
    fixture.material = raw.material || (isDoor ? 'Wood' : 'Glass');
    fixture.quantities.width = width;
    fixture.quantities.height = height;

    // Link to host wall if specified
    if (raw.hostId && wallMap.has(raw.hostId)) {
      fixture.hostId = raw.hostId;
      wallMap.get(raw.hostId)!.hostedIds.push(fixture.id);
    }

    elements.push(fixture);
  }

  // ── BUILD COLUMNS ─────────────────────────────────────────────────────
  for (const raw of columns) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;
    const height = raw.height || storeyInfo?.floorToFloorHeight || 3.0;

    const shape = raw.diameter ? 'circular' as const
      : raw.properties?.shape === 'w-section' ? 'w-section' as const
      : 'rectangular' as const;

    const width = raw.diameter || raw.width || 0.4;
    const depth = raw.diameter || raw.depth || raw.width || 0.4;

    elements.push(createColumn({
      id: raw.id,
      name: raw.name || `Column ${raw.id}`,
      center: vec2(raw.x || 0, raw.y || 0),
      width, depth, height,
      storey, elevation,
      shape,
      material: raw.material || 'Concrete',
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── BUILD BEAMS ───────────────────────────────────────────────────────
  for (const raw of beams) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;
    const beamHeight = storeyInfo?.floorToFloorHeight || 3.0;

    const start = vec3(raw.startX || raw.x || 0, raw.startY || raw.y || 0, elevation + beamHeight);
    const end = vec3(raw.endX || (raw.x || 0) + (raw.length || 5), raw.endY || raw.y || 0, elevation + beamHeight);

    elements.push(createBeam({
      id: raw.id,
      name: raw.name || `Beam ${raw.id}`,
      start, end,
      width: raw.width || 0.3,
      depth: raw.depth || raw.height || 0.5,
      storey, elevation,
      shape: 'rectangular',
      material: raw.material || 'Concrete',
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── BUILD SLABS ───────────────────────────────────────────────────────
  for (const raw of slabs) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;
    const isRoof = /ROOF/i.test(raw.type || '');

    let boundary: Vec2[];
    if (raw.boundary && raw.boundary.length >= 3) {
      boundary = raw.boundary.map(p => vec2(p.x, p.y));
    } else if (context.footprint && context.footprint.length >= 3) {
      boundary = context.footprint;
    } else {
      // Default rectangular slab from dimensions
      const w = raw.width || raw.length || 20;
      const d = raw.depth || raw.width || 15;
      boundary = [vec2(0, 0), vec2(w, 0), vec2(w, d), vec2(0, d)];
    }

    elements.push(createSlab({
      id: raw.id,
      name: raw.name || `${isRoof ? 'Roof' : 'Floor'} Slab ${raw.id}`,
      boundary,
      thickness: raw.thickness || raw.height || context.defaultSlabThickness || 0.200,
      storey, elevation,
      material: raw.material || 'Concrete',
      isRoof,
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── BUILD FOUNDATIONS ─────────────────────────────────────────────────
  for (const raw of foundations) {
    elements.push(createFooting({
      id: raw.id,
      name: raw.name || `Footing ${raw.id}`,
      center: vec2(raw.x || 0, raw.y || 0),
      width: raw.width || 1.5,
      depth: raw.depth || 1.5,
      height: raw.height || raw.thickness || 0.6,
      storey: raw.storey || 'Foundation',
      elevation: raw.elevation || -0.6,
      type: /STRIP/i.test(raw.type || '') ? 'strip' : 'spread',
      material: raw.material || 'Concrete',
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── BUILD STAIRS ──────────────────────────────────────────────────────
  for (const raw of stairs) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;
    const totalHeight = raw.height || storeyInfo?.floorToFloorHeight || 3.0;
    const numRisers = Math.round(totalHeight / 0.178); // 178mm risers

    elements.push(createStair({
      id: raw.id,
      name: raw.name || `Stair ${raw.id}`,
      origin: vec3(raw.x || 0, raw.y || 0, elevation),
      width: raw.width || 1.2,
      riserHeight: totalHeight / numRisers,
      treadDepth: 0.279,
      numRisers,
      rotation: 0,
      storey, elevation,
      material: raw.material || 'Concrete',
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── BUILD MEP ─────────────────────────────────────────────────────────
  for (const raw of mep) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;

    const path = raw.path?.map(p => vec3(p.x, p.y, p.z))
      || [vec3(raw.x || 0, raw.y || 0, elevation + 3), vec3((raw.x || 0) + (raw.length || 5), raw.y || 0, elevation + 3)];

    if (/DUCT|HVAC/i.test(raw.type || '')) {
      elements.push(createDuct({
        id: raw.id,
        name: raw.name || `Duct ${raw.id}`,
        path,
        width: raw.width || raw.diameter || 0.3,
        height: raw.height || raw.width || 0.3,
        shape: raw.shape || (raw.diameter ? 'circular' : 'rectangular'),
        insulated: true,
        storey, elevation,
        material: raw.material || 'Galvanized Steel',
        source: (raw.source as BIMSolid['source']) || 'ai_modeled',
      }));
    } else if (/PIPE/i.test(raw.type || '')) {
      elements.push(createPipe({
        id: raw.id,
        name: raw.name || `Pipe ${raw.id}`,
        path,
        diameter: raw.diameter || raw.width || 0.05,
        wallThickness: (raw.diameter || 0.05) * 0.05,
        storey, elevation,
        material: raw.material || 'Copper',
        system: 'domestic_cold',
        source: (raw.source as BIMSolid['source']) || 'ai_modeled',
      }));
    } else if (/CABLE|CONDUIT|TRAY/i.test(raw.type || '')) {
      elements.push(createCableTray({
        id: raw.id,
        name: raw.name || `Cable Tray ${raw.id}`,
        path,
        width: raw.width || 0.3,
        height: raw.height || 0.1,
        storey, elevation,
        material: raw.material || 'Steel',
        source: (raw.source as BIMSolid['source']) || 'ai_modeled',
      }));
    }
  }

  // ── BUILD FIXTURES ────────────────────────────────────────────────────
  for (const raw of fixtures) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;

    let fType: 'light' | 'receptacle' | 'switch' | 'panel' | 'sprinkler' | 'smoke_detector' | 'generic' = 'generic';
    const t = (raw.type || '').toUpperCase();
    if (/LIGHT|LUMINAIRE/.test(t)) fType = 'light';
    else if (/SPRINKLER/.test(t)) fType = 'sprinkler';
    else if (/PANEL/.test(t)) fType = 'panel';
    else if (/RECEPTACLE|OUTLET/.test(t)) fType = 'receptacle';
    else if (/SWITCH/.test(t)) fType = 'switch';
    else if (/SMOKE|DETECTOR/.test(t)) fType = 'smoke_detector';

    elements.push(createFixture({
      id: raw.id,
      name: raw.name || `${fType} ${raw.id}`,
      type: fType,
      position: vec3(raw.x || 0, raw.y || 0, elevation + (raw.z || (fType === 'light' ? 2.8 : 1.2))),
      storey, elevation,
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── BUILD OTHER ───────────────────────────────────────────────────────
  for (const raw of other) {
    const storey = raw.storey || context.storeys[0]?.name || 'Level 1';
    const storeyInfo = context.storeys.find(s => s.name === storey) || context.storeys[0];
    const elevation = raw.elevation ?? storeyInfo?.elevation ?? 0;

    elements.push(createFixture({
      id: raw.id,
      name: raw.name || `Element ${raw.id}`,
      type: 'generic',
      position: vec3(raw.x || 0, raw.y || 0, elevation),
      storey, elevation,
      source: (raw.source as BIMSolid['source']) || 'ai_modeled',
    }));
  }

  // ── CLASH DETECTION ───────────────────────────────────────────────────
  let clashes: ClashResult[] = [];
  let clashSummary: ClashSummary = { total: 0, bySeverity: { critical: 0, major: 0, minor: 0, info: 0 }, byType: { hard: 0, soft: 0, clearance: 0 }, byDiscipline: {}, topClashes: [] };

  if (options?.runClashCheck !== false && elements.length > 1) {
    clashes = runClashDetection(elements, {
      ignoreSameHost: true,
      excludePairs: [['Floor Slab', 'Wall'], ['Floor Slab', 'Column']],
    });
    clashSummary = summarizeClashes(clashes);
  }

  // ── IFC EXPORT ────────────────────────────────────────────────────────
  let ifcContent: string | undefined;
  if (options?.generateIFC) {
    ifcContent = exportBIMToIFC4(elements, {
      projectName: context.name,
      ...options.ifcOptions,
    });
  }

  // ── STATS ─────────────────────────────────────────────────────────────
  const byType: Record<string, number> = {};
  const byStorey: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalVolume = 0, totalArea = 0;

  for (const el of elements) {
    byType[el.type] = (byType[el.type] || 0) + 1;
    byStorey[el.storey] = (byStorey[el.storey] || 0) + 1;
    byCategory[el.category] = (byCategory[el.category] || 0) + 1;
    totalVolume += el.quantities.volume;
    totalArea += el.quantities.surfaceArea;
  }

  return {
    elements,
    clashes,
    clashSummary,
    stats: {
      totalElements: elements.length,
      byType, byStorey, byCategory,
      totalVolume, totalArea,
      withGeometry: elements.filter(e => e.mesh.triangles.length > 0).length,
    },
    ifcContent,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FILE IMPORT DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

export interface FileImportResult {
  elements: BIMSolid[];
  format: 'ifc' | 'dxf' | 'dwg' | 'pdf' | 'unknown';
  projectName?: string;
  storeys: { name: string; elevation: number }[];
  stats: Record<string, any>;
  warnings: string[];
}

/**
 * Import a file and convert to BIMSolid array.
 * Auto-detects format from content/extension.
 */
export async function importFile(
  content: string | Buffer,
  filename: string,
  options?: { storey?: string; elevation?: number; defaultFloorHeight?: number },
): Promise<FileImportResult> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const textContent = typeof content === 'string' ? content : content.toString('utf-8');

  // IFC detection
  if (ext === 'ifc' || textContent.includes('ISO-10303-21') || textContent.includes('FILE_SCHEMA')) {
    const result = importIFC(textContent);
    return {
      elements: result.elements,
      format: 'ifc',
      projectName: result.projectName,
      storeys: result.storeys.map(s => ({ name: s.name, elevation: s.elevation })),
      stats: result.stats,
      warnings: [],
    };
  }

  // DXF detection
  if (ext === 'dxf' || isDXFContent(textContent)) {
    const parsed = await parseDXF(textContent);
    const result = convertDXFToBIM(parsed, {
      defaultFloorHeight: options?.defaultFloorHeight || 3.0,
      defaultWallThickness: 0.2,
      storey: options?.storey || 'Level 1',
      elevation: options?.elevation || 0,
    });
    return {
      elements: result.elements,
      format: 'dxf',
      storeys: [{ name: options?.storey || 'Level 1', elevation: options?.elevation || 0 }],
      stats: result.stats,
      warnings: result.warnings,
    };
  }

  // DWG detection (binary)
  if (ext === 'dwg' && Buffer.isBuffer(content)) {
    return {
      elements: [],
      format: 'dwg',
      storeys: [],
      stats: { message: 'DWG binary import requires ODA File Converter. Please export as DXF or IFC from your CAD software.' },
      warnings: ['DWG binary format detected. For best results, export as IFC or DXF from your CAD software.'],
    };
  }

  return {
    elements: [],
    format: 'unknown',
    storeys: [],
    stats: {},
    warnings: [`Unrecognized file format: ${ext}`],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ELEMENT → VIEWER DATA (for 3D viewer transport)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ViewerElement {
  id: string;
  type: string;
  name: string;
  category: string;
  storey: string;
  material: string;
  origin: Vec3;
  rotation: number;
  mesh: SerializedMesh;
  boundingBox: { min: Vec3; max: Vec3 };
  quantities: BIMSolid['quantities'];
  color?: string;              // hex color for viewer
  opacity?: number;
  hostId?: string;
  ifcClass: string;
  source: string;
}

/** Convert BIMSolid array to viewer-ready format */
export function toViewerElements(elements: BIMSolid[]): ViewerElement[] {
  return elements.map(el => ({
    id: el.id,
    type: el.type,
    name: el.name,
    category: el.category,
    storey: el.storey,
    material: el.material,
    origin: el.origin,
    rotation: el.rotation,
    mesh: serializeBIMSolid(el),
    boundingBox: { min: el.boundingBox.min, max: el.boundingBox.max },
    quantities: el.quantities,
    color: getElementColor(el),
    opacity: getElementOpacity(el),
    hostId: el.hostId,
    ifcClass: el.ifcClass,
    source: el.source,
  }));
}

function getElementColor(el: BIMSolid): string {
  const t = el.type.toLowerCase();
  if (/exterior wall/.test(t)) return '#C4A882';
  if (/interior wall|partition/.test(t)) return '#E8DCC8';
  if (/curtain/.test(t)) return '#88CCEE';
  if (/column/.test(t)) return '#808080';
  if (/beam/.test(t)) return '#A0A0A0';
  if (/slab|floor/.test(t)) return '#D0D0D0';
  if (/roof/.test(t)) return '#8B4513';
  if (/door/.test(t)) return '#8B6914';
  if (/window/.test(t)) return '#4FC3F7';
  if (/stair/.test(t)) return '#B0B0B0';
  if (/footing|foundation/.test(t)) return '#696969';
  if (/duct/.test(t)) return '#4CAF50';
  if (/pipe/.test(t)) return '#2196F3';
  if (/cable|tray/.test(t)) return '#FF9800';
  if (/light/.test(t)) return '#FFEB3B';
  if (/sprinkler/.test(t)) return '#F44336';
  if (/panel/.test(t)) return '#9C27B0';
  return '#CCCCCC';
}

function getElementOpacity(el: BIMSolid): number {
  if (/window|glazing|curtain/i.test(el.type)) return 0.4;
  if (/door/i.test(el.type)) return 0.8;
  return 1.0;
}
