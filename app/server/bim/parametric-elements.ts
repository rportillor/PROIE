/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  PARAMETRIC BUILDING ELEMENTS — Real 3D BIM Object Library
 *  Creates geometry-complete building elements with:
 *  - Multi-layer wall assemblies (structure + insulation + finish)
 *  - Door/window openings that subtract from host walls
 *  - Structural profiles (W-sections, HSS, concrete columns)
 *  - Slab/floor plates with arbitrary polygon boundaries
 *  - Roof elements with slopes
 *  - MEP elements (ducts, pipes, cable trays) with fittings
 *  All dimensions in metres. Z-up coordinate system.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import {
  type Vec2, type Vec3, type Mesh, type Profile2D, type SerializedMesh, type AABB,
  vec2, vec3, v3add, v3sub, v3scale, v3normalize, v3cross, v3len,
  rectProfile, circleProfile, iProfile, addRectHole, profileArea,
  extrudeProfile, sweepAlongPath, createBox, createCylinder,
  mergeMeshes, transformMesh, meshBoundingBox, meshVolume, meshSurfaceArea, meshLateralArea,
  serializeMesh, mat4Translation, mat4RotationZ, mat4RotationY, mat4Mul,
} from './geometry-kernel';

// ═══════════════════════════════════════════════════════════════════════════════
//  MATERIAL LAYERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MaterialLayer {
  name: string;           // e.g. "Gypsum Board", "Steel Stud", "Batt Insulation"
  thickness: number;      // metres
  material: string;       // material identifier
  isStructural: boolean;
  density?: number;       // kg/m³ for weight calculation
}

export interface WallAssembly {
  id: string;
  name: string;             // e.g. "Exterior Wall Type 1"
  layers: MaterialLayer[];
  totalThickness: number;   // computed sum of layers
  fireRating?: string;      // e.g. "1 HR"
  acousticRating?: number;  // STC rating
}

/** Common wall assemblies */
export const WALL_ASSEMBLIES: Record<string, WallAssembly> = {
  'EXT_WALL_BRICK': {
    id: 'EXT_WALL_BRICK', name: 'Exterior Wall - Brick Veneer',
    layers: [
      { name: 'Face Brick', thickness: 0.090, material: 'Brick', isStructural: false, density: 1920 },
      { name: 'Air Cavity', thickness: 0.025, material: 'Air', isStructural: false },
      { name: 'Rigid Insulation', thickness: 0.050, material: 'XPS Insulation', isStructural: false, density: 35 },
      { name: 'Sheathing', thickness: 0.012, material: 'OSB', isStructural: false, density: 650 },
      { name: 'Steel Stud', thickness: 0.092, material: 'Steel', isStructural: true, density: 7850 },
      { name: 'Batt Insulation', thickness: 0.089, material: 'Fibreglass Batt', isStructural: false, density: 12 },
      { name: 'Vapour Barrier', thickness: 0.001, material: 'Polyethylene', isStructural: false },
      { name: 'Gypsum Board', thickness: 0.016, material: 'Gypsum', isStructural: false, density: 800 },
    ],
    totalThickness: 0.375, fireRating: '1 HR', acousticRating: 55,
  },
  'EXT_WALL_METAL': {
    id: 'EXT_WALL_METAL', name: 'Exterior Wall - Metal Panel',
    layers: [
      { name: 'Metal Panel', thickness: 0.025, material: 'Aluminum', isStructural: false, density: 2700 },
      { name: 'Air Cavity', thickness: 0.025, material: 'Air', isStructural: false },
      { name: 'Rigid Insulation', thickness: 0.075, material: 'Mineral Wool', isStructural: false, density: 130 },
      { name: 'Steel Stud', thickness: 0.152, material: 'Steel', isStructural: true, density: 7850 },
      { name: 'Batt Insulation', thickness: 0.150, material: 'Fibreglass Batt', isStructural: false, density: 12 },
      { name: 'Gypsum Board', thickness: 0.016, material: 'Gypsum', isStructural: false, density: 800 },
    ],
    totalThickness: 0.443, fireRating: '2 HR',
  },
  'INT_WALL_STANDARD': {
    id: 'INT_WALL_STANDARD', name: 'Interior Partition - Standard',
    layers: [
      { name: 'Gypsum Board', thickness: 0.016, material: 'Gypsum', isStructural: false, density: 800 },
      { name: 'Steel Stud', thickness: 0.092, material: 'Steel', isStructural: true, density: 7850 },
      { name: 'Batt Insulation', thickness: 0.089, material: 'Fibreglass Batt', isStructural: false, density: 12 },
      { name: 'Gypsum Board', thickness: 0.016, material: 'Gypsum', isStructural: false, density: 800 },
    ],
    totalThickness: 0.213, fireRating: '1 HR', acousticRating: 45,
  },
  'INT_WALL_FIRE': {
    id: 'INT_WALL_FIRE', name: 'Interior Partition - Fire Rated',
    layers: [
      { name: 'Type X Gypsum', thickness: 0.016, material: 'Type X Gypsum', isStructural: false, density: 800 },
      { name: 'Type X Gypsum', thickness: 0.016, material: 'Type X Gypsum', isStructural: false, density: 800 },
      { name: 'Steel Stud', thickness: 0.092, material: 'Steel', isStructural: true, density: 7850 },
      { name: 'Mineral Wool', thickness: 0.089, material: 'Mineral Wool', isStructural: false, density: 130 },
      { name: 'Type X Gypsum', thickness: 0.016, material: 'Type X Gypsum', isStructural: false, density: 800 },
      { name: 'Type X Gypsum', thickness: 0.016, material: 'Type X Gypsum', isStructural: false, density: 800 },
    ],
    totalThickness: 0.245, fireRating: '2 HR', acousticRating: 55,
  },
  'CMU_WALL': {
    id: 'CMU_WALL', name: 'CMU Block Wall',
    layers: [
      { name: 'CMU Block', thickness: 0.200, material: 'Concrete Masonry', isStructural: true, density: 2100 },
    ],
    totalThickness: 0.200,
  },
  'CONCRETE_WALL': {
    id: 'CONCRETE_WALL', name: 'Cast-in-Place Concrete Wall',
    layers: [
      { name: 'Concrete', thickness: 0.300, material: 'Concrete', isStructural: true, density: 2400 },
    ],
    totalThickness: 0.300, fireRating: '3 HR',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BIM SOLID ELEMENT — Base type for all 3D building elements
// ═══════════════════════════════════════════════════════════════════════════════

export interface BIMSolid {
  id: string;
  type: string;               // 'Wall', 'Column', 'Beam', 'Slab', 'Door', 'Window', etc.
  name: string;
  category: 'Architectural' | 'Structural' | 'MEP';
  storey: string;
  elevation: number;          // metres above datum

  // Geometry
  mesh: Mesh;                 // full 3D triangle mesh
  serialized?: SerializedMesh; // computed on demand for storage/viewer
  boundingBox: AABB;
  profile?: Profile2D;        // cross-section profile (for walls, beams, etc.)

  // Quantities derived from geometry
  quantities: {
    volume: number;            // m³
    surfaceArea: number;       // m²
    lateralArea: number;       // m² (wall face area, excluding top/bottom)
    length?: number;           // m (for linear elements)
    width?: number;            // m
    height?: number;           // m
    thickness?: number;        // m
    perimeter?: number;        // m (for slabs)
    weight?: number;           // kg (if density known)
    profileArea?: number;      // m² (cross-section area)
  };

  // Material
  material: string;
  assembly?: WallAssembly;     // multi-layer assembly (for walls)
  layers?: MaterialLayer[];

  // Spatial relationships
  hostId?: string;             // parent element (wall hosts door/window)
  hostedIds: string[];         // children (doors/windows in this wall)
  connectedIds: string[];      // connected elements (wall-to-wall, beam-to-column)

  // Positioning
  origin: Vec3;                // placement origin in world coords
  rotation: number;            // yaw rotation in radians (around Z-axis)

  // IFC mapping
  ifcClass: string;            // IFCWALL, IFCSLAB, etc.
  ifcGuid: string;

  // Provenance
  source: 'ai_modeled' | 'ifc_imported' | 'dwg_imported' | 'user_placed' | 'seeded';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WALL ELEMENT — Parametric wall with layers and openings
// ═══════════════════════════════════════════════════════════════════════════════

export interface WallOpeningDef {
  type: 'door' | 'window';
  id: string;
  name: string;
  position: number;        // distance along wall from start (metres)
  width: number;           // metres
  height: number;          // metres
  sillHeight: number;      // metres above floor (0 for doors)
  material?: string;
}

export interface WallParams {
  id: string;
  name: string;
  start: Vec2;              // start point in plan (metres)
  end: Vec2;                // end point in plan (metres)
  height: number;           // storey height (metres)
  assembly: WallAssembly | string;  // wall assembly or key into WALL_ASSEMBLIES
  storey: string;
  elevation: number;        // base elevation (metres)
  openings?: WallOpeningDef[];
  isExterior?: boolean;
  source?: BIMSolid['source'];
}

export function createWall(params: WallParams): { wall: BIMSolid; openings: BIMSolid[] } {
  const assembly = typeof params.assembly === 'string'
    ? WALL_ASSEMBLIES[params.assembly] || WALL_ASSEMBLIES['INT_WALL_STANDARD']
    : params.assembly;

  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const wallLength = Math.sqrt(dx * dx + dy * dy);
  const rotation = Math.atan2(dy, dx);
  const thickness = assembly.totalThickness;
  const origin = vec3(params.start.x, params.start.y, params.elevation);

  // Build wall profile (length × height) with openings cut out
  let wallProfile: Profile2D = {
    outer: [vec2(0, 0), vec2(wallLength, 0), vec2(wallLength, params.height), vec2(0, params.height)],
    holes: [],
  };

  // Cut openings
  const openingElements: BIMSolid[] = [];
  for (const op of params.openings || []) {
    const cx = op.position + op.width / 2;
    const cy = op.sillHeight + op.height / 2;
    wallProfile = addRectHole(wallProfile, cx, cy, op.width, op.height);

    // Create the door/window element
    const openingMesh = createBox(op.width, op.height, thickness * 0.8);
    const openingOrigin = vec3(
      params.start.x + Math.cos(rotation) * (op.position + op.width / 2),
      params.start.y + Math.sin(rotation) * (op.position + op.width / 2),
      params.elevation + op.sillHeight + op.height / 2,
    );

    const placedOpening = transformMesh(openingMesh,
      mat4Mul(mat4Translation(openingOrigin), mat4RotationZ(rotation))
    );

    openingElements.push({
      id: op.id,
      type: op.type === 'door' ? 'Door' : 'Window',
      name: op.name,
      category: 'Architectural',
      storey: params.storey,
      elevation: params.elevation,
      mesh: placedOpening,
      boundingBox: meshBoundingBox(placedOpening),
      quantities: {
        volume: op.width * op.height * thickness * 0.8,
        surfaceArea: 2 * (op.width * op.height + op.width * thickness + op.height * thickness),
        lateralArea: op.width * op.height,
        width: op.width,
        height: op.height,
        thickness: thickness * 0.8,
      },
      material: op.material || (op.type === 'door' ? 'Wood' : 'Glass'),
      hostId: params.id,
      hostedIds: [],
      connectedIds: [],
      origin: openingOrigin,
      rotation,
      ifcClass: op.type === 'door' ? 'IFCDOOR' : 'IFCWINDOW',
      ifcGuid: generateBIMGuid(),
      source: params.source || 'ai_modeled',
    });
  }

  // Extrude wall profile to get the wall mesh (extrude along thickness direction)
  const wallMesh2D = extrudeProfile(wallProfile, thickness, vec3(0, 0, 1));

  // Transform: rotate profile so it's vertical (length along X, height along Z, thickness along Y)
  // Then rotate to match wall direction and translate to start point
  const transform = mat4Mul(
    mat4Translation(origin),
    mat4RotationZ(rotation),
  );
  const wallMesh = transformMesh(wallMesh2D, transform);

  const vol = meshVolume(wallMesh);
  const surfArea = meshSurfaceArea(wallMesh);
  const latArea = meshLateralArea(wallMesh);

  // Calculate weight from layer densities
  let totalWeight = 0;
  for (const layer of assembly.layers) {
    if (layer.density) {
      const layerVolume = wallLength * params.height * layer.thickness;
      totalWeight += layerVolume * layer.density;
    }
  }

  const wall: BIMSolid = {
    id: params.id,
    type: params.isExterior ? 'Exterior Wall' : 'Interior Wall',
    name: params.name,
    category: 'Architectural',
    storey: params.storey,
    elevation: params.elevation,
    mesh: wallMesh,
    boundingBox: meshBoundingBox(wallMesh),
    profile: wallProfile,
    quantities: {
      volume: vol,
      surfaceArea: surfArea,
      lateralArea: latArea,
      length: wallLength,
      height: params.height,
      thickness,
      weight: totalWeight > 0 ? totalWeight : undefined,
      profileArea: profileArea(wallProfile),
    },
    material: assembly.layers.find(l => l.isStructural)?.material || assembly.layers[0]?.material || 'Unknown',
    assembly,
    layers: assembly.layers,
    hostId: undefined,
    hostedIds: openingElements.map(o => o.id),
    connectedIds: [],
    origin,
    rotation,
    ifcClass: 'IFCWALL',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };

  return { wall, openings: openingElements };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COLUMN ELEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ColumnParams {
  id: string;
  name: string;
  center: Vec2;             // plan position
  width: number;            // X dimension (metres)
  depth: number;            // Y dimension (metres)
  height: number;           // floor-to-floor (metres)
  storey: string;
  elevation: number;
  shape: 'rectangular' | 'circular' | 'w-section';
  material: string;         // 'Concrete', 'Steel', etc.
  rotation?: number;
  // For steel W-sections:
  flangeWidth?: number;
  webThickness?: number;
  flangeThickness?: number;
  source?: BIMSolid['source'];
}

export function createColumn(params: ColumnParams): BIMSolid {
  let mesh: Mesh;
  let profileDef: Profile2D | undefined;

  if (params.shape === 'circular') {
    const radius = Math.max(params.width, params.depth) / 2;
    mesh = createCylinder(radius, params.height, 24);
    profileDef = circleProfile(radius, 24);
  } else if (params.shape === 'w-section' && params.flangeWidth && params.webThickness && params.flangeThickness) {
    profileDef = iProfile(params.flangeWidth, params.depth, params.webThickness, params.flangeThickness);
    mesh = extrudeProfile(profileDef, params.height);
  } else {
    profileDef = rectProfile(params.width, params.depth);
    mesh = createBox(params.width, params.height, params.depth);
  }

  const origin = vec3(params.center.x, params.center.y, params.elevation);
  const rot = params.rotation || 0;
  const transform = mat4Mul(mat4Translation(origin), mat4RotationZ(rot));
  mesh = transformMesh(mesh, transform);

  const vol = meshVolume(mesh);

  return {
    id: params.id,
    type: 'Column',
    name: params.name,
    category: 'Structural',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    profile: profileDef,
    quantities: {
      volume: vol,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      width: params.width,
      height: params.height,
      thickness: params.depth,
      profileArea: profileDef ? profileArea(profileDef) : params.width * params.depth,
      weight: params.material === 'Concrete' ? vol * 2400 : params.material === 'Steel' ? vol * 7850 : undefined,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin,
    rotation: rot,
    ifcClass: 'IFCCOLUMN',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BEAM ELEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface BeamParams {
  id: string;
  name: string;
  start: Vec3;              // start point in 3D
  end: Vec3;                // end point in 3D
  width: number;            // cross-section width
  depth: number;            // cross-section depth
  storey: string;
  elevation: number;
  shape: 'rectangular' | 'w-section' | 'circular';
  material: string;
  flangeWidth?: number;
  webThickness?: number;
  flangeThickness?: number;
  source?: BIMSolid['source'];
}

export function createBeam(params: BeamParams): BIMSolid {
  const dir = v3sub(params.end, params.start);
  const beamLength = v3len(dir);
  const rotation = Math.atan2(dir.y, dir.x);

  let profileDef: Profile2D;
  if (params.shape === 'w-section' && params.flangeWidth && params.webThickness && params.flangeThickness) {
    profileDef = iProfile(params.flangeWidth, params.depth, params.webThickness, params.flangeThickness);
  } else if (params.shape === 'circular') {
    profileDef = circleProfile(Math.max(params.width, params.depth) / 2, 24);
  } else {
    profileDef = rectProfile(params.width, params.depth);
  }

  let mesh = extrudeProfile(profileDef, beamLength, v3normalize(dir));
  const transform = mat4Translation(params.start);
  mesh = transformMesh(mesh, transform);

  const vol = meshVolume(mesh);

  return {
    id: params.id,
    type: 'Beam',
    name: params.name,
    category: 'Structural',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    profile: profileDef,
    quantities: {
      volume: vol,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      length: beamLength,
      width: params.width,
      height: params.depth,
      profileArea: profileArea(profileDef),
      weight: params.material === 'Concrete' ? vol * 2400 : params.material === 'Steel' ? vol * 7850 : undefined,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: params.start,
    rotation,
    ifcClass: 'IFCBEAM',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SLAB / FLOOR PLATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface SlabParams {
  id: string;
  name: string;
  boundary: Vec2[];         // polygon boundary in plan (metres)
  thickness: number;        // metres
  storey: string;
  elevation: number;        // top of slab elevation
  material: string;
  openings?: { boundary: Vec2[] }[];  // penetrations
  isRoof?: boolean;
  slope?: number;           // degrees for roof slabs
  source?: BIMSolid['source'];
}

export function createSlab(params: SlabParams): BIMSolid {
  const profile: Profile2D = {
    outer: params.boundary,
    holes: (params.openings || []).map(o => o.boundary),
  };

  // Extrude downward from top of slab
  const slabBottom = params.elevation - params.thickness;
  let mesh = extrudeProfile(profile, params.thickness, vec3(0, 0, 1));
  mesh = transformMesh(mesh, mat4Translation(vec3(0, 0, slabBottom)));

  // If roof with slope, apply tilt
  if (params.isRoof && params.slope && params.slope > 0) {
    const slopeRad = (params.slope * Math.PI) / 180;
    const bb = meshBoundingBox(mesh);
    const center = vec3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.min.z);
    mesh = transformMesh(mesh,
      mat4Mul(
        mat4Translation(center),
        mat4Mul(mat4RotationY(slopeRad), mat4Translation(v3scale(center, -1)))
      )
    );
  }

  const vol = meshVolume(mesh);
  const area = Math.abs(profileArea(profile));

  // Compute perimeter
  let perimeter = 0;
  for (let i = 0; i < params.boundary.length; i++) {
    const j = (i + 1) % params.boundary.length;
    const dx = params.boundary[j].x - params.boundary[i].x;
    const dy = params.boundary[j].y - params.boundary[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return {
    id: params.id,
    type: params.isRoof ? 'Roof Slab' : 'Floor Slab',
    name: params.name,
    category: 'Structural',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    profile,
    quantities: {
      volume: vol,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: perimeter * params.thickness,
      thickness: params.thickness,
      perimeter,
      profileArea: area,
      weight: params.material === 'Concrete' ? vol * 2400 : undefined,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: vec3(0, 0, params.elevation),
    rotation: 0,
    ifcClass: params.isRoof ? 'IFCROOF' : 'IFCSLAB',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FOOTING / FOUNDATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface FootingParams {
  id: string;
  name: string;
  center: Vec2;
  width: number;
  depth: number;
  height: number;           // thickness of footing
  storey: string;
  elevation: number;        // top of footing
  type: 'strip' | 'spread' | 'pile_cap';
  material: string;
  source?: BIMSolid['source'];
}

export function createFooting(params: FootingParams): BIMSolid {
  let mesh = createBox(params.width, params.height, params.depth);
  const origin = vec3(params.center.x, params.center.y, params.elevation - params.height / 2);
  mesh = transformMesh(mesh, mat4Translation(origin));

  const vol = meshVolume(mesh);

  return {
    id: params.id,
    type: 'Footing',
    name: params.name,
    category: 'Structural',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    quantities: {
      volume: vol,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      width: params.width,
      height: params.height,
      thickness: params.depth,
      weight: vol * 2400,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin,
    rotation: 0,
    ifcClass: 'IFCFOOTING',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STAIR ELEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface StairParams {
  id: string;
  name: string;
  origin: Vec3;
  width: number;            // stair width
  riserHeight: number;      // height per step
  treadDepth: number;       // depth per step
  numRisers: number;        // total risers
  rotation: number;         // radians
  storey: string;
  elevation: number;
  material: string;
  source?: BIMSolid['source'];
}

export function createStair(params: StairParams): BIMSolid {
  const meshes: Mesh[] = [];

  for (let i = 0; i < params.numRisers; i++) {
    const stepHeight = params.riserHeight;
    const stepDepth = params.treadDepth;

    // Each step is a box
    const step = createBox(params.width, stepHeight, stepDepth);
    const stepOrigin = vec3(0, i * stepDepth + stepDepth / 2, i * stepHeight + stepHeight / 2);
    meshes.push(transformMesh(step, mat4Translation(stepOrigin)));
  }

  let mesh = mergeMeshes(...meshes);
  const transform = mat4Mul(mat4Translation(params.origin), mat4RotationZ(params.rotation));
  mesh = transformMesh(mesh, transform);

  const totalHeight = params.numRisers * params.riserHeight;
  const totalRun = params.numRisers * params.treadDepth;
  const vol = meshVolume(mesh);

  return {
    id: params.id,
    type: 'Stair',
    name: params.name,
    category: 'Architectural',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    quantities: {
      volume: vol,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      width: params.width,
      height: totalHeight,
      length: totalRun,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: params.origin,
    rotation: params.rotation,
    ifcClass: 'IFCSTAIRFLIGHT',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RAILING
// ═══════════════════════════════════════════════════════════════════════════════

export interface RailingParams {
  id: string;
  name: string;
  path: Vec3[];             // 3D polyline path
  height: number;           // railing height (metres)
  postSpacing: number;      // distance between posts
  postSize: number;         // post width/depth
  railDiameter: number;     // horizontal rail diameter
  storey: string;
  elevation: number;
  material: string;
  source?: BIMSolid['source'];
}

export function createRailing(params: RailingParams): BIMSolid {
  const meshes: Mesh[] = [];

  // Create posts along path
  let accumulated = 0;
  for (let i = 0; i < params.path.length - 1; i++) {
    const a = params.path[i], b = params.path[i + 1];
    const segLen = v3len(v3sub(b, a));
    const dir = v3normalize(v3sub(b, a));

    let dist = (params.postSpacing - accumulated) % params.postSpacing;
    while (dist <= segLen) {
      const pos = v3add(a, v3scale(dir, dist));
      const post = createBox(params.postSize, params.height, params.postSize);
      meshes.push(transformMesh(post, mat4Translation(v3add(pos, vec3(0, 0, params.height / 2)))));
      dist += params.postSpacing;
    }
    accumulated = (accumulated + segLen) % params.postSpacing;
  }

  // Top rail as swept cylinder
  const railProfile = circleProfile(params.railDiameter / 2, 12);
  const topRailPath = params.path.map(p => v3add(p, vec3(0, 0, params.height)));
  meshes.push(sweepAlongPath(railProfile, topRailPath));

  // Mid rail
  const midRailPath = params.path.map(p => v3add(p, vec3(0, 0, params.height / 2)));
  meshes.push(sweepAlongPath(railProfile, midRailPath));

  const mesh = mergeMeshes(...meshes);

  return {
    id: params.id,
    type: 'Railing',
    name: params.name,
    category: 'Architectural',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    quantities: {
      volume: meshVolume(mesh),
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      height: params.height,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: params.path[0],
    rotation: 0,
    ifcClass: 'IFCRAILING',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MEP ELEMENTS — Ducts, Pipes, Cable Trays
// ═══════════════════════════════════════════════════════════════════════════════

export interface DuctParams {
  id: string;
  name: string;
  path: Vec3[];              // centerline path
  width: number;             // cross-section width (or diameter for round)
  height: number;            // cross-section height (same as width for round)
  shape: 'rectangular' | 'circular';
  insulated: boolean;
  insulationThickness?: number;
  storey: string;
  elevation: number;
  material: string;
  source?: BIMSolid['source'];
}

export function createDuct(params: DuctParams): BIMSolid {
  let profile: Profile2D;
  if (params.shape === 'circular') {
    profile = circleProfile(params.width / 2, 24);
  } else {
    profile = rectProfile(params.width, params.height);
  }

  let mesh = sweepAlongPath(profile, params.path);

  // Add insulation layer
  if (params.insulated && params.insulationThickness) {
    let insProfile: Profile2D;
    if (params.shape === 'circular') {
      insProfile = circleProfile(params.width / 2 + params.insulationThickness, 24);
    } else {
      insProfile = rectProfile(params.width + 2 * params.insulationThickness, params.height + 2 * params.insulationThickness);
    }
    const insMesh = sweepAlongPath(insProfile, params.path);
    mesh = mergeMeshes(mesh, insMesh);
  }

  // Calculate path length
  let pathLength = 0;
  for (let i = 0; i < params.path.length - 1; i++) {
    pathLength += v3len(v3sub(params.path[i + 1], params.path[i]));
  }

  const crossArea = params.shape === 'circular'
    ? Math.PI * (params.width / 2) ** 2
    : params.width * params.height;

  return {
    id: params.id,
    type: 'Duct',
    name: params.name,
    category: 'MEP',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    profile,
    quantities: {
      volume: crossArea * pathLength,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      length: pathLength,
      width: params.width,
      height: params.height,
      profileArea: crossArea,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: params.path[0],
    rotation: 0,
    ifcClass: 'IFCDUCTSEGMENT',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

export interface PipeParams {
  id: string;
  name: string;
  path: Vec3[];
  diameter: number;          // outer diameter
  wallThickness: number;     // pipe wall thickness
  storey: string;
  elevation: number;
  material: string;          // 'Copper', 'PVC', 'Cast Iron', 'Steel'
  system: 'domestic_hot' | 'domestic_cold' | 'sanitary' | 'storm' | 'fire_protection' | 'hydronic';
  source?: BIMSolid['source'];
}

export function createPipe(params: PipeParams): BIMSolid {
  const profile = circleProfile(params.diameter / 2, 16);
  const mesh = sweepAlongPath(profile, params.path);

  let pathLength = 0;
  for (let i = 0; i < params.path.length - 1; i++) {
    pathLength += v3len(v3sub(params.path[i + 1], params.path[i]));
  }

  const crossArea = Math.PI * (params.diameter / 2) ** 2;

  return {
    id: params.id,
    type: 'Pipe',
    name: params.name,
    category: 'MEP',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    profile,
    quantities: {
      volume: crossArea * pathLength,
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      length: pathLength,
      width: params.diameter,
      profileArea: crossArea,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: params.path[0],
    rotation: 0,
    ifcClass: 'IFCPIPESEGMENT',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

export interface CableTrayParams {
  id: string;
  name: string;
  path: Vec3[];
  width: number;
  height: number;           // side rail height
  storey: string;
  elevation: number;
  material: string;
  source?: BIMSolid['source'];
}

export function createCableTray(params: CableTrayParams): BIMSolid {
  // Cable tray is a U-shaped profile (open top)
  const t = 0.002; // 2mm sheet metal thickness
  const profile: Profile2D = {
    outer: [
      vec2(-params.width / 2, 0),
      vec2(params.width / 2, 0),
      vec2(params.width / 2, params.height),
      vec2(params.width / 2 - t, params.height),
      vec2(params.width / 2 - t, t),
      vec2(-params.width / 2 + t, t),
      vec2(-params.width / 2 + t, params.height),
      vec2(-params.width / 2, params.height),
    ],
    holes: [],
  };

  const mesh = sweepAlongPath(profile, params.path);

  let pathLength = 0;
  for (let i = 0; i < params.path.length - 1; i++) {
    pathLength += v3len(v3sub(params.path[i + 1], params.path[i]));
  }

  return {
    id: params.id,
    type: 'Cable Tray',
    name: params.name,
    category: 'MEP',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    profile,
    quantities: {
      volume: meshVolume(mesh),
      surfaceArea: meshSurfaceArea(mesh),
      lateralArea: meshLateralArea(mesh),
      length: pathLength,
      width: params.width,
      height: params.height,
    },
    material: params.material,
    hostedIds: [],
    connectedIds: [],
    origin: params.path[0],
    rotation: 0,
    ifcClass: 'IFCCABLETRUNKING',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ELECTRICAL FIXTURES (point elements)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FixtureParams {
  id: string;
  name: string;
  type: 'light' | 'receptacle' | 'switch' | 'panel' | 'sprinkler' | 'smoke_detector' | 'generic';
  position: Vec3;
  storey: string;
  elevation: number;
  source?: BIMSolid['source'];
}

export function createFixture(params: FixtureParams): BIMSolid {
  // Small representative geometry for visualization
  let mesh: Mesh;
  let size = { w: 0.1, h: 0.1, d: 0.05 };

  switch (params.type) {
    case 'light':
      mesh = createCylinder(0.15, 0.05, 12);
      size = { w: 0.3, h: 0.05, d: 0.3 };
      break;
    case 'panel':
      mesh = createBox(0.6, 0.8, 0.2);
      size = { w: 0.6, h: 0.8, d: 0.2 };
      break;
    case 'sprinkler':
      mesh = createCylinder(0.025, 0.1, 8);
      size = { w: 0.05, h: 0.1, d: 0.05 };
      break;
    default:
      mesh = createBox(0.1, 0.1, 0.05);
  }

  mesh = transformMesh(mesh, mat4Translation(params.position));

  const ifcClassMap: Record<string, string> = {
    light: 'IFCLIGHTFIXTURE', receptacle: 'IFCELECTRICAPPLIANCE',
    switch: 'IFCELECTRICAPPLIANCE', panel: 'IFCELECTRICDISTRIBUTIONBOARD',
    sprinkler: 'IFCFLOWTERMINAL', smoke_detector: 'IFCSENSOR', generic: 'IFCBUILDINGELEMENTPROXY',
  };

  return {
    id: params.id,
    type: params.type.charAt(0).toUpperCase() + params.type.slice(1),
    name: params.name,
    category: 'MEP',
    storey: params.storey,
    elevation: params.elevation,
    mesh,
    boundingBox: meshBoundingBox(mesh),
    quantities: {
      volume: size.w * size.h * size.d,
      surfaceArea: 2 * (size.w * size.h + size.w * size.d + size.h * size.d),
      lateralArea: 2 * (size.w + size.d) * size.h,
      width: size.w,
      height: size.h,
      thickness: size.d,
    },
    material: 'Steel',
    hostedIds: [],
    connectedIds: [],
    origin: params.position,
    rotation: 0,
    ifcClass: ifcClassMap[params.type] || 'IFCBUILDINGELEMENTPROXY',
    ifcGuid: generateBIMGuid(),
    source: params.source || 'ai_modeled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function generateBIMGuid(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let result = '';
  for (let i = 0; i < 22; i++) result += chars[Math.floor(Math.random() * 64)];
  return result;
}

/** Convert a BIMSolid to the serialized format for DB storage and viewer transport */
export function serializeBIMSolid(solid: BIMSolid): SerializedMesh {
  if (solid.serialized) return solid.serialized;
  const s = serializeMesh(solid.mesh);
  solid.serialized = s;
  return s;
}

/** Convert a flat element from the old system into BIMSolid params */
export function inferWallAssembly(material?: string, isExterior?: boolean): WallAssembly {
  if (!material) return isExterior ? WALL_ASSEMBLIES['EXT_WALL_BRICK'] : WALL_ASSEMBLIES['INT_WALL_STANDARD'];
  const m = material.toUpperCase();
  if (/CONCRETE|CAST/.test(m)) return WALL_ASSEMBLIES['CONCRETE_WALL'];
  if (/CMU|BLOCK|MASONRY/.test(m)) return WALL_ASSEMBLIES['CMU_WALL'];
  if (/METAL|ALUMINUM|STEEL/.test(m) && isExterior) return WALL_ASSEMBLIES['EXT_WALL_METAL'];
  if (/BRICK/.test(m)) return WALL_ASSEMBLIES['EXT_WALL_BRICK'];
  if (/FIRE/.test(m)) return WALL_ASSEMBLIES['INT_WALL_FIRE'];
  return isExterior ? WALL_ASSEMBLIES['EXT_WALL_BRICK'] : WALL_ASSEMBLIES['INT_WALL_STANDARD'];
}
