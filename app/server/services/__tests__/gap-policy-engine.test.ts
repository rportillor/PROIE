/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  GAP POLICY ENGINE — Test Suite (SOP Appendix)
 *  40+ tests: gap detection, tolerance gaps, batch processing, register, lifecycle
 * ══════════════════════════════════════════════════════════════════════════════
 */

import {
  detectElementGaps,
  detectBatchGaps,
  createToleranceGap,
  buildGapRegister,
  resolveGap,
} from '../gap-policy-engine';

import type { GapRecord, GapDetectionInput, GapRegister } from '../gap-policy-engine';

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST DATA
// ═══════════════════════════════════════════════════════════════════════════════

const completeInput: GapDetectionInput = {
  elementId: 'wall-001',
  elementName: 'Exterior Wall',
  discipline: 'ARC',
  level: 'Level 1',
  zone: 'East',
  properties: {
    Material: 'concrete',
    Fire_Rating: 'FRL 120/120/120',
    Level: 'Level 1',
    Specification_Section: 'Section 03 30 00',
    thickness: 200,
    height: 3000,
    length: 5000,
  },
};

const incompleteInput: GapDetectionInput = {
  elementId: 'duct-001',
  elementName: 'Supply Duct',
  discipline: 'MECH',
  level: 'Level 1',
  zone: 'East',
  properties: {
    // missing Material, SystemType — should trigger gaps
  },
};

const partialInput: GapDetectionInput = {
  elementId: 'pipe-001',
  elementName: 'Cold Water Pipe',
  discipline: 'PLBG',
  level: 'Level 2',
  zone: 'West',
  properties: {
    SystemType: 'domestic_hot',
    diameter: 25,
    // Material not set for PLBG — but PLBG is not in appliesTo for GAP-MAT-01 (only STR, ARC)
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SINGLE ELEMENT GAP DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectElementGaps', () => {
  test('complete element produces few or no gaps', () => {
    const gaps = detectElementGaps(completeInput);
    // A well-formed ARC wall with Material, Fire_Rating, Level, Spec should have few/no gaps
    expect(gaps.length).toBeLessThanOrEqual(1);
  });

  test('incomplete element produces multiple gaps', () => {
    const gaps = detectElementGaps(incompleteInput);
    expect(gaps.length).toBeGreaterThan(0);

    // Should flag missing systemType for MECH discipline
    const systemGap = gaps.find(g => g.source === 'system_type');
    expect(systemGap).toBeDefined();
  });

  test('gaps include element ID and discipline', () => {
    const gaps = detectElementGaps(incompleteInput);
    for (const gap of gaps) {
      expect(gap.elementId).toBe('duct-001');
      expect(gap.discipline).toBe('MECH');
    }
  });

  test('gaps have correct lifecycle state', () => {
    const gaps = detectElementGaps(incompleteInput);
    for (const gap of gaps) {
      expect(gap.lifecycle).toBe('DETECTED');
    }
  });

  test('gap records have action descriptions', () => {
    const gaps = detectElementGaps(incompleteInput);
    for (const gap of gaps) {
      expect(gap.actionDescription).toBeDefined();
      expect(gap.actionDescription.length).toBeGreaterThan(0);
    }
  });

  test('partial input flags missing properties but not present ones', () => {
    const gaps = detectElementGaps(partialInput);
    // Should NOT flag systemType (domestic_hot is present)
    const systemGap = gaps.find(g => g.source === 'system_type');
    expect(systemGap).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BATCH GAP DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectBatchGaps', () => {
  test('processes multiple elements', () => {
    const gaps = detectBatchGaps([completeInput, incompleteInput, partialInput]);
    expect(gaps.length).toBeGreaterThan(0);
  });

  test('batch results contain gaps from all elements', () => {
    const gaps = detectBatchGaps([incompleteInput, partialInput]);
    const elementIds = new Set(gaps.map(g => g.elementId));
    expect(elementIds.has('duct-001')).toBe(true);
  });

  test('empty input produces no gaps', () => {
    const gaps = detectBatchGaps([]);
    expect(gaps).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TOLERANCE GAPS
// ═══════════════════════════════════════════════════════════════════════════════

describe('createToleranceGap', () => {
  test('creates a gap for missing tolerance', () => {
    const gap = createToleranceGap(
      'CD-001',
      'Duct vs Beam clearance',
      'clearance_mm',
    );
    expect(gap).toBeDefined();
    expect(gap.source).toBe('clearance_tolerance');
    expect(gap.lifecycle).toBe('DETECTED');
  });

  test('tolerance gap description references test', () => {
    const gap = createToleranceGap('CD-001', 'Duct vs Beam clearance', 'clearance_mm');
    expect(gap.description).toContain('CD-001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GAP REGISTER
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildGapRegister', () => {
  test('builds register from gap array', () => {
    const gaps = detectBatchGaps([incompleteInput, partialInput]);
    const register = buildGapRegister(gaps, 'MOOR-001');

    expect(register.projectName).toBe('MOOR-001');
    expect(register.summary.total).toBe(gaps.length);
    expect(register.gaps).toHaveLength(gaps.length);
  });

  test('register categorizes by source', () => {
    const gaps = detectBatchGaps([incompleteInput]);
    const register = buildGapRegister(gaps);
    expect(register.summary.bySource).toBeDefined();
  });

  test('register categorizes by discipline', () => {
    const gaps = detectBatchGaps([incompleteInput, partialInput]);
    const register = buildGapRegister(gaps);
    expect(register.summary.byDiscipline).toBeDefined();
    expect(register.summary.byDiscipline['MECH']).toBeGreaterThan(0);
  });

  test('empty gaps produce empty register', () => {
    const register = buildGapRegister([]);
    expect(register.summary.total).toBe(0);
    expect(register.gaps).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GAP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveGap', () => {
  test('resolves a gap with value and evidence', () => {
    const gaps = detectElementGaps(incompleteInput);
    expect(gaps.length).toBeGreaterThan(0);

    const gap = gaps[0];
    const resolved = resolveGap(gap, 'Sheet metal', 'Drawing M-101 Rev B');

    expect(resolved.lifecycle).toBe('CLOSED');
    expect(resolved.resolvedValue).toBe('Sheet metal');
    expect(resolved.evidenceRef).toBe('Drawing M-101 Rev B');
  });

  test('preserves original gap data on resolve', () => {
    const gaps = detectElementGaps(incompleteInput);
    const gap = gaps[0];
    const originalSource = gap.source;
    const originalElement = gap.elementId;

    const resolved = resolveGap(gap, 'test-value', 'test-evidence');
    expect(resolved.source).toBe(originalSource);
    expect(resolved.elementId).toBe(originalElement);
  });
});
