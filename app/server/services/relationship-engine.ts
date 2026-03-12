// server/services/relationship-engine.ts
// ──────────────────────────────────────────────────────────────────────────────
// Detects and writes Revit-style host/join/support relationships between BIM
// elements.  Called as PASS 2 in the postprocess pipeline.
//
// Relationship types:
//   hosted_by     — door/window → wall (host wall)
//   wall_join_L   — wall → wall at shared endpoint (L-join)
//   wall_join_T   — wall → wall at one's endpoint meeting other's mid-span
//   column_beam   — column → beam (beam endpoint ≈ column centroid)
//   slab_bounded  — slab → wall (wall lies along slab edge)
// ──────────────────────────────────────────────────────────────────────────────

export interface Relationship {
  sourceId: string;
  targetId: string;
  type: 'hosted_by' | 'wall_join_L' | 'wall_join_T' | 'column_beam' | 'slab_bounded';
  /** Normalised offset (0-1) along the target's length where source attaches */
  parameterT?: number;
  metadata?: Record<string, any>;
}

interface Vec2 { x: number; y: number }

// ── helpers ──────────────────────────────────────────────────────────────────

function dist2(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function loc(e: any): Vec2 {
  const g = typeof e.geometry === 'string' ? JSON.parse(e.geometry) : (e.geometry || {});
  const p = g.location?.realLocation || { x: 0, y: 0 };
  return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
}

function wallEndpoints(e: any): { start: Vec2; end: Vec2 } | null {
  const s = e.properties?.start;
  const en = e.properties?.end;
  if (!s || !en) return null;
  return { start: { x: Number(s.x) || 0, y: Number(s.y) || 0 }, end: { x: Number(en.x) || 0, y: Number(en.y) || 0 } };
}

/** Project point onto line segment; return parameter t ∈ [0,1] and distance. */
function projectOntoSegment(p: Vec2, a: Vec2, b: Vec2): { t: number; dist: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { t: 0, dist: dist2(p, a) };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, dist: dist2(p, proj) };
}

function elementType(e: any): string {
  return (e.elementType || e.type || e.category || '').toUpperCase();
}

function storey(e: any): string {
  return e.storey?.name || e.properties?.level || e.storeyName || '';
}

// ── Main detection ──────────────────────────────────────────────────────────

const ENDPOINT_SNAP = 0.5;   // metres — endpoint coincidence tolerance
const HOST_SNAP    = 1.0;   // metres — door/window within this of wall centreline → hosted
const BEAM_COL_SNAP = 0.8;  // metres — beam endpoint near column centre
const SLAB_EDGE_SNAP = 1.5; // metres — wall along slab edge

export function detectRelationships(elements: any[]): Relationship[] {
  const rels: Relationship[] = [];

  // Index by type
  const walls: any[] = [];
  const doors: any[] = [];
  const windows: any[] = [];
  const columns: any[] = [];
  const beams: any[] = [];
  const slabs: any[] = [];

  for (const e of elements) {
    const t = elementType(e);
    if (/(WALL|PARTITION|CURTAIN)/.test(t)) walls.push(e);
    else if (/(DOOR|ENTRANCE)/.test(t)) doors.push(e);
    else if (/(WINDOW|GLAZING)/.test(t)) windows.push(e);
    else if (/(COLUMN|PILLAR|POST)/.test(t)) columns.push(e);
    else if (/(BEAM|GIRDER|JOIST)/.test(t)) beams.push(e);
    else if (/(SLAB|FLOOR|DECK)/.test(t)) slabs.push(e);
  }

  // 1. Door/Window → Wall (hosted_by)
  for (const opening of [...doors, ...windows]) {
    const oLoc = loc(opening);
    let bestWall: any = null;
    let bestDist = Infinity;
    let bestT = 0;

    for (const wall of walls) {
      const ep = wallEndpoints(wall);
      if (!ep) continue;
      // Same storey check (relaxed — empty storey matches anything)
      if (storey(opening) && storey(wall) && storey(opening) !== storey(wall)) continue;
      const proj = projectOntoSegment(oLoc, ep.start, ep.end);
      if (proj.dist < bestDist) {
        bestDist = proj.dist;
        bestWall = wall;
        bestT = proj.t;
      }
    }

    if (bestWall && bestDist < HOST_SNAP) {
      rels.push({
        sourceId: opening.id || opening.elementId,
        targetId: bestWall.id || bestWall.elementId,
        type: 'hosted_by',
        parameterT: bestT,
        metadata: { distance: bestDist }
      });
      // Write back to element properties for downstream use
      opening.properties = opening.properties || {};
      opening.properties.hostWallId = bestWall.id || bestWall.elementId;
    }
  }

  // 2. Wall → Wall joins
  for (let i = 0; i < walls.length; i++) {
    const epA = wallEndpoints(walls[i]);
    if (!epA) continue;

    for (let j = i + 1; j < walls.length; j++) {
      const epB = wallEndpoints(walls[j]);
      if (!epB) continue;
      if (storey(walls[i]) && storey(walls[j]) && storey(walls[i]) !== storey(walls[j])) continue;

      // Check endpoint-to-endpoint (L-join)
      const pairs: [Vec2, Vec2][] = [
        [epA.start, epB.start], [epA.start, epB.end],
        [epA.end, epB.start], [epA.end, epB.end]
      ];
      let isLJoin = false;
      for (const [pa, pb] of pairs) {
        if (dist2(pa, pb) < ENDPOINT_SNAP) {
          rels.push({
            sourceId: walls[i].id || walls[i].elementId,
            targetId: walls[j].id || walls[j].elementId,
            type: 'wall_join_L',
            metadata: { at: { x: pa.x, y: pa.y } }
          });
          isLJoin = true;
          break;
        }
      }

      // Check endpoint-to-midspan (T-join) — only if no L-join found
      if (!isLJoin) {
        // A's endpoint onto B
        for (const pt of [epA.start, epA.end]) {
          const proj = projectOntoSegment(pt, epB.start, epB.end);
          if (proj.dist < ENDPOINT_SNAP && proj.t > 0.05 && proj.t < 0.95) {
            rels.push({
              sourceId: walls[i].id || walls[i].elementId,
              targetId: walls[j].id || walls[j].elementId,
              type: 'wall_join_T',
              parameterT: proj.t,
              metadata: { at: { x: pt.x, y: pt.y } }
            });
            break;
          }
        }
        // B's endpoint onto A
        for (const pt of [epB.start, epB.end]) {
          const proj = projectOntoSegment(pt, epA.start, epA.end);
          if (proj.dist < ENDPOINT_SNAP && proj.t > 0.05 && proj.t < 0.95) {
            rels.push({
              sourceId: walls[j].id || walls[j].elementId,
              targetId: walls[i].id || walls[i].elementId,
              type: 'wall_join_T',
              parameterT: proj.t,
              metadata: { at: { x: pt.x, y: pt.y } }
            });
            break;
          }
        }
      }

      // Write connected wall IDs to properties
      const idI = walls[i].id || walls[i].elementId;
      const idJ = walls[j].id || walls[j].elementId;
      if (rels.some(r => (r.sourceId === idI && r.targetId === idJ) || (r.sourceId === idJ && r.targetId === idI))) {
        walls[i].properties = walls[i].properties || {};
        walls[j].properties = walls[j].properties || {};
        const cwI = walls[i].properties.connectedWallIds || [];
        const cwJ = walls[j].properties.connectedWallIds || [];
        if (!cwI.includes(idJ)) cwI.push(idJ);
        if (!cwJ.includes(idI)) cwJ.push(idI);
        walls[i].properties.connectedWallIds = cwI;
        walls[j].properties.connectedWallIds = cwJ;
      }
    }
  }

  // 3. Column → Beam (beam endpoint ≈ column centroid)
  for (const beam of beams) {
    const bLoc = loc(beam);
    const bDims = beam.geometry?.dimensions || {};
    const bLen = Number(bDims.length || bDims.depth || bDims.width || 3);
    // Approximate beam endpoints (along x-axis by default)
    const bStart = { x: bLoc.x - bLen / 2, y: bLoc.y };
    const bEnd = { x: bLoc.x + bLen / 2, y: bLoc.y };

    for (const col of columns) {
      const cLoc = loc(col);
      if (storey(beam) && storey(col) && storey(beam) !== storey(col)) continue;

      for (const endpt of [bStart, bEnd]) {
        if (dist2(endpt, cLoc) < BEAM_COL_SNAP) {
          rels.push({
            sourceId: col.id || col.elementId,
            targetId: beam.id || beam.elementId,
            type: 'column_beam',
            metadata: { at: { x: endpt.x, y: endpt.y } }
          });
          // Write back
          col.properties = col.properties || {};
          const sbi = col.properties.supportedBeamIds || [];
          const bId = beam.id || beam.elementId;
          if (!sbi.includes(bId)) sbi.push(bId);
          col.properties.supportedBeamIds = sbi;
          break;
        }
      }
    }
  }

  // 4. Slab → Wall (wall lies along slab edge)
  for (const slab of slabs) {
    const sLoc = loc(slab);
    const sDims = slab.geometry?.dimensions || {};
    const sw = Number(sDims.width || 5);
    const sd = Number(sDims.depth || sDims.length || 5);

    // Approximate slab bounding edges
    const edges: [Vec2, Vec2][] = [
      [{ x: sLoc.x - sw / 2, y: sLoc.y - sd / 2 }, { x: sLoc.x + sw / 2, y: sLoc.y - sd / 2 }],
      [{ x: sLoc.x + sw / 2, y: sLoc.y - sd / 2 }, { x: sLoc.x + sw / 2, y: sLoc.y + sd / 2 }],
      [{ x: sLoc.x + sw / 2, y: sLoc.y + sd / 2 }, { x: sLoc.x - sw / 2, y: sLoc.y + sd / 2 }],
      [{ x: sLoc.x - sw / 2, y: sLoc.y + sd / 2 }, { x: sLoc.x - sw / 2, y: sLoc.y - sd / 2 }],
    ];

    for (const wall of walls) {
      const ep = wallEndpoints(wall);
      if (!ep) continue;
      if (storey(slab) && storey(wall) && storey(slab) !== storey(wall)) continue;

      const wMid = { x: (ep.start.x + ep.end.x) / 2, y: (ep.start.y + ep.end.y) / 2 };
      for (const [ea, eb] of edges) {
        const proj = projectOntoSegment(wMid, ea, eb);
        if (proj.dist < SLAB_EDGE_SNAP) {
          rels.push({
            sourceId: slab.id || slab.elementId,
            targetId: wall.id || wall.elementId,
            type: 'slab_bounded',
            parameterT: proj.t,
            metadata: { edgeDist: proj.dist }
          });
          // Write back
          slab.properties = slab.properties || {};
          const bwi = slab.properties.boundingWallIds || [];
          const wId = wall.id || wall.elementId;
          if (!bwi.includes(wId)) bwi.push(wId);
          slab.properties.boundingWallIds = bwi;
          break;
        }
      }
    }
  }

  console.log(`🔗 RELATIONSHIPS: detected ${rels.length} relationships ` +
    `(hosted=${rels.filter(r => r.type === 'hosted_by').length}, ` +
    `wall_L=${rels.filter(r => r.type === 'wall_join_L').length}, ` +
    `wall_T=${rels.filter(r => r.type === 'wall_join_T').length}, ` +
    `col_beam=${rels.filter(r => r.type === 'column_beam').length}, ` +
    `slab_bound=${rels.filter(r => r.type === 'slab_bounded').length})`);

  return rels;
}
