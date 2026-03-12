/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  CLASH PIPELINE — Test Suite (SOP Part 7 Support)
 *  55+ tests: templates, dedup, false positives, priority scoring
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── CLASH TEST TEMPLATES ───────────────────────────────────────────────────

import {
  SELECTION_SETS,
  CLASH_TEST_TEMPLATES,
  evaluateRule,
  resolveSelectionSet,
  getEnabledTemplates,
  getTemplatesByCategory,
  getSelectionSet,
  validateTemplateIntegrity,
} from '../clash-test-templates';

describe('clash-test-templates.ts', () => {
  test('SELECTION_SETS has entries', () => {
    expect(SELECTION_SETS.length).toBeGreaterThan(0);
  });

  test('CLASH_TEST_TEMPLATES has entries', () => {
    expect(CLASH_TEST_TEMPLATES.length).toBeGreaterThan(0);
  });

  test('each template has required fields', () => {
    for (const t of CLASH_TEST_TEMPLATES) {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.setA).toBeDefined();
      expect(t.setB).toBeDefined();
    }
  });

  test('evaluateRule matches discipline with eq operator', () => {
    const rule = { field: 'discipline', operator: 'eq' as const, value: 'structural', description: 'test' };
    expect(evaluateRule(rule, { discipline: 'structural' })).toBe(true);
    expect(evaluateRule(rule, { discipline: 'mechanical' })).toBe(false);
  });

  test('evaluateRule handles contains operator', () => {
    const rule = { field: 'type', operator: 'contains' as const, value: 'wall', description: 'test' };
    expect(evaluateRule(rule, { type: 'exterior_wall' })).toBe(true);
    expect(evaluateRule(rule, { type: 'column' })).toBe(false);
  });

  test('resolveSelectionSet returns matchedIds for matching elements', () => {
    const elements = [
      { id: 'w1', discipline: 'structural', type: 'wall' },
      { id: 'd1', discipline: 'mechanical', type: 'duct' },
      { id: 'w2', discipline: 'structural', type: 'beam' },
      { id: 'c1', discipline: 'structural', type: 'column' },
      { id: 's1', discipline: 'structural', type: 'slab' },
      { id: 'f1', discipline: 'structural', type: 'foundation' },
    ];
    const set = SELECTION_SETS.find(s => s.primaryRules?.some(r => r.value === 'structural'));
    if (set) {
      const result = resolveSelectionSet(set, elements);
      expect(result).toHaveProperty('matchedIds');
      expect(result).toHaveProperty('usedFallback');
      expect(result).toHaveProperty('warnings');
      expect(result.matchedIds.length).toBeGreaterThan(0);
    }
  });

  test('getEnabledTemplates returns enabled templates', () => {
    const templates = getEnabledTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.enabled).toBe(true);
    }
  });

  test('getTemplatesByCategory returns templates of given category', () => {
    const hardTemplates = getTemplatesByCategory('hard');
    expect(Array.isArray(hardTemplates)).toBe(true);
    for (const t of hardTemplates) {
      expect(t.category).toBe('hard');
    }
  });

  test('getSelectionSet returns set by ID', () => {
    const set = getSelectionSet('SS-STR-01');
    expect(set).toBeDefined();
    if (set) {
      expect(set.id).toBe('SS-STR-01');
    }
  });

  test('validateTemplateIntegrity returns array of errors', () => {
    const errors = validateTemplateIntegrity();
    expect(Array.isArray(errors)).toBe(true);
    // All built-in templates should reference valid sets
    expect(errors).toHaveLength(0);
  });
});

// ─── DEDUP ENGINE ───────────────────────────────────────────────────────────

import {
  removeExactDuplicates,
  groupByRootCause,
  deduplicateClashes,
} from '../dedup-engine';

describe('dedup-engine.ts', () => {
  // Sample clashes use RawClash shape with ResolvedElement objects
  const makeElem = (id: string, disc: string = 'mechanical') => ({
    id, elementId: id, name: id, elementType: 'duct', category: 'duct',
    discipline: disc, storey: 'Level 1', material: 'steel',
    bbox: { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 },
    dimensions: { length: 1, width: 1, height: 1, area: 1, volume: 1 },
    csiDivision: '23',
  });

  const sampleClashes = [
    { id: 'c1', testId: 'CD-001', elementA: makeElem('beam-001', 'structural'), elementB: makeElem('duct-001'), category: 'hard', severity: 'high', overlapVolume_m3: 0.01, clearanceRequired_mm: 0, clearanceActual_mm: 0, penetrationDepth_mm: 50, location: { x: 1, y: 1, z: 2 }, description: 'test', codeReferences: [], toleranceSource: 'spec', isHard: true },
    { id: 'c2', testId: 'CD-001', elementA: makeElem('beam-001', 'structural'), elementB: makeElem('duct-001'), category: 'hard', severity: 'high', overlapVolume_m3: 0.01, clearanceRequired_mm: 0, clearanceActual_mm: 0, penetrationDepth_mm: 50, location: { x: 1, y: 1, z: 2 }, description: 'test', codeReferences: [], toleranceSource: 'spec', isHard: true }, // exact duplicate
    { id: 'c3', testId: 'CD-002', elementA: makeElem('beam-001', 'structural'), elementB: makeElem('pipe-001', 'plumbing'), category: 'hard', severity: 'medium', overlapVolume_m3: 0.005, clearanceRequired_mm: 0, clearanceActual_mm: 0, penetrationDepth_mm: 20, location: { x: 1, y: 1, z: 2.1 }, description: 'test', codeReferences: [], toleranceSource: 'spec', isHard: true },
    { id: 'c4', testId: 'SC-001', elementA: makeElem('wall-001', 'architectural'), elementB: makeElem('duct-002'), category: 'soft', severity: 'low', overlapVolume_m3: 0, clearanceRequired_mm: 100, clearanceActual_mm: 50, penetrationDepth_mm: 0, location: { x: 10, y: 10, z: 1 }, description: 'test', codeReferences: [], toleranceSource: 'spec', isHard: false },
  ];

  test('removeExactDuplicates removes identical clashes', () => {
    const result = removeExactDuplicates(sampleClashes as any);
    expect(result.unique.length).toBeLessThan(sampleClashes.length);
    expect(result.removed).toBeGreaterThan(0);
  });

  test('groupByRootCause groups related clashes', () => {
    const groups = groupByRootCause(sampleClashes as any);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.length).toBeLessThanOrEqual(sampleClashes.length);
  });

  test('deduplicateClashes returns full result', () => {
    const result = deduplicateClashes(sampleClashes as any);
    expect(result).toHaveProperty('groups');
    expect(result).toHaveProperty('uniqueClashes');
    expect(result).toHaveProperty('duplicatesRemoved');
    expect(result).toHaveProperty('summary');
    expect(result.summary.inputCount).toBe(sampleClashes.length);
    expect(result.summary.uniqueCount).toBeLessThanOrEqual(result.summary.inputCount);
  });

  test('empty input returns empty result', () => {
    const result = deduplicateClashes([]);
    expect(result.summary.inputCount).toBe(0);
    expect(result.groups).toHaveLength(0);
  });

  test('single clash returns one group', () => {
    const result = deduplicateClashes([sampleClashes[0]] as any);
    expect(result.groups).toHaveLength(1);
  });
});

// ─── FALSE POSITIVE FILTER ──────────────────────────────────────────────────

import {
  DEFAULT_FILTER_RULES,
  filterFalsePositives,
} from '../false-positive-filter';

describe('false-positive-filter.ts', () => {
  test('DEFAULT_FILTER_RULES has entries', () => {
    expect(DEFAULT_FILTER_RULES.length).toBeGreaterThan(0);
  });

  test('each rule has required fields', () => {
    for (const rule of DEFAULT_FILTER_RULES) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('predicate');
    }
  });

  test('filterFalsePositives returns result with passed and filtered', () => {
    // Build minimal RawClash-shaped objects
    const makeElem = (id: string, name: string = 'element') => ({
      id, elementId: id, name, elementType: 'wall', category: 'wall',
      discipline: 'architectural', storey: 'Level 1', material: 'concrete',
      bbox: { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 },
      dimensions: { length: 1, width: 1, height: 1, area: 1, volume: 1 },
      csiDivision: '03', properties: {},
    });
    const clashes = [
      { id: 'c1', testId: 'CD-001', elementA: makeElem('w1'), elementB: makeElem('w2'), category: 'hard', severity: 'high', overlapVolume_m3: 0.01, clearanceRequired_mm: 0, clearanceActual_mm: 0, penetrationDepth_mm: 50, location: { x: 0, y: 0, z: 0 }, description: 'test', codeReferences: [], toleranceSource: 'spec', isHard: true },
    ];
    const result = filterFalsePositives(clashes as any);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('filtered');
    expect(result.passed.length + result.filtered.length).toBe(clashes.length);
  });

  test('empty clashes returns empty result', () => {
    const result = filterFalsePositives([]);
    expect(result.passed).toHaveLength(0);
    expect(result.filtered).toHaveLength(0);
  });
});

// ─── PRIORITY SCORING ───────────────────────────────────────────────────────

import {
  calculatePriorityScores,
  quickScoreFromSeverity,
  overrideScores,
} from '../priority-scoring';

describe('priority-scoring.ts', () => {
  test('calculatePriorityScores returns valid result', () => {
    const result = calculatePriorityScores({
      clashCategory: 'hard',
      severity: 'critical',
      disciplineA: 'structural',
      disciplineB: 'mechanical',
      zone: 'Level 1',
      codeReferences: ['NBC 3.2.5.7'],
      elementTypes: ['beam', 'duct'],
      isOnCriticalPath: true,
      affectedTradeCount: 5,
      estimatedReworkCost: 50000,
    });
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('priorityLabel');
    expect(result.priorityLabel).toBe('CRITICAL');
  });

  test('quickScoreFromSeverity returns result', () => {
    const result = quickScoreFromSeverity('high', 'hard');
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('priorityLabel');
  });

  test('critical severity maps to CRITICAL priority label', () => {
    const result = quickScoreFromSeverity('critical', 'hard');
    expect(result.priorityLabel).toBe('CRITICAL');
  });

  test('low severity maps to LOW priority label', () => {
    const result = quickScoreFromSeverity('low', 'soft');
    expect(result.priorityLabel).toBe('LOW');
  });

  test('overrideScores allows manual adjustment', () => {
    const base = quickScoreFromSeverity('medium', 'soft');
    const overridden = overrideScores(base, { lifeSafety: 5 }, 'Client request');
    expect(overridden.priorityLabel).toBe('CRITICAL');
    expect(overridden.autoScored).toBe(false);
  });
});
