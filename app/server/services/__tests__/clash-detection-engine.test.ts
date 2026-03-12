/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  CLASH DETECTION ENGINE — Test Suite (SOP Part 6.4)
 *  Tests: type exports, emptyClearanceRequirements, function existence
 * ══════════════════════════════════════════════════════════════════════════════
 */

import type {
  AABB,
  ResolvedElement,
  Clash,
  ClashCategory,
  ClashSeverity,
  ClearanceRequirements,
  ClashDetectionResult,
} from '../clash-detection-engine';

// We test via the exported functions + helpers
let mod: any;
beforeAll(async () => {
  mod = await import('../clash-detection-engine');
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function makeBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB {
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function makeElement(id: string, bbox: AABB, overrides: Partial<ResolvedElement> = {}): ResolvedElement {
  return {
    id,
    elementId: id,
    name: id,
    elementType: 'wall',
    category: 'wall',
    discipline: 'architectural',
    storey: 'Level 1',
    material: 'concrete',
    bbox,
    dimensions: { length: 1, width: 1, height: 1, area: 1, volume: 1 },
    csiDivision: '03',
    ...overrides,
  } as ResolvedElement;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Type Exports', () => {
  test('ClashCategory includes expected values', () => {
    const categories: ClashCategory[] = ['hard', 'soft', 'workflow', 'code_compliance', 'tolerance'];
    expect(categories).toHaveLength(5);
  });

  test('ClashSeverity includes expected values', () => {
    const severities: ClashSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    expect(severities).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Clash Detection Functions', () => {
  test('module exports expected functions', () => {
    expect(typeof mod.runClashDetection).toBe('function');
    expect(typeof mod.runClashDetectionForProject).toBe('function');
    expect(typeof mod.getModelDisciplineBreakdown).toBe('function');
    expect(typeof mod.emptyClearanceRequirements).toBe('function');
  });

  test('emptyClearanceRequirements returns object with null clearance fields', () => {
    const clearances: ClearanceRequirements = mod.emptyClearanceRequirements();
    expect(clearances).toBeDefined();
    expect(clearances).toHaveProperty('ductToStructural_mm');
    expect(clearances).toHaveProperty('pipeToStructural_mm');
    expect(clearances).toHaveProperty('panelFrontClearance_mm');
  });

  test('emptyClearanceRequirements fields are null by default', () => {
    const clearances: ClearanceRequirements = mod.emptyClearanceRequirements();
    expect(clearances.ductToStructural_mm).toBeNull();
    expect(clearances.pipeToStructural_mm).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CLEARANCE REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ClearanceRequirements', () => {
  test('can be merged with partial overrides', () => {
    const base: ClearanceRequirements = mod.emptyClearanceRequirements();
    const merged: ClearanceRequirements = {
      ...base,
      ductToStructural_mm: 100,
      pipeToStructural_mm: 75,
    };
    expect(merged.ductToStructural_mm).toBe(100);
    expect(merged.pipeToStructural_mm).toBe(75);
    expect(merged.panelFrontClearance_mm).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  RESOLVED ELEMENT SHAPE
// ═══════════════════════════════════════════════════════════════════════════════

describe('ResolvedElement shape', () => {
  test('makeElement produces valid shape', () => {
    const elem = makeElement('beam-001', makeBox(0, 0, 0, 4, 0.3, 0.6), {
      elementType: 'beam', discipline: 'structural',
    });
    expect(elem.id).toBe('beam-001');
    expect(elem.elementType).toBe('beam');
    expect(elem.discipline).toBe('structural');
    expect(elem.bbox).toBeDefined();
    expect(elem.bbox.minX).toBe(0);
    expect(elem.bbox.maxX).toBe(4);
  });

  test('element has required fields', () => {
    const elem = makeElement('duct-001', makeBox(1, 0, 0.1, 3, 0.5, 0.5), {
      elementType: 'duct', discipline: 'mechanical',
    });
    expect(elem).toHaveProperty('id');
    expect(elem).toHaveProperty('elementId');
    expect(elem).toHaveProperty('name');
    expect(elem).toHaveProperty('elementType');
    expect(elem).toHaveProperty('category');
    expect(elem).toHaveProperty('discipline');
    expect(elem).toHaveProperty('storey');
    expect(elem).toHaveProperty('material');
    expect(elem).toHaveProperty('bbox');
  });
});
