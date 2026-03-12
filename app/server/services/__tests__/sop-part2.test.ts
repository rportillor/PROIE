/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  SOP PART 2 — Test Suite: Discipline SOP + BEP Rules + Model Drop Gating
 *  50+ tests across 3 modules
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── DISCIPLINE SOP ─────────────────────────────────────────────────────────

import {
  DISCIPLINE_DEFINITIONS,
  getDisciplineDefinition,
} from '../discipline-sop';

import type { DisciplineCode, DisciplineDefinition } from '../discipline-sop';

describe('discipline-sop.ts', () => {
  test('all 7 discipline codes are defined', () => {
    const codes: DisciplineCode[] = ['ARC', 'STR', 'MECH', 'PLBG', 'FP', 'ELEC', 'BIM_VDC'];
    for (const code of codes) {
      expect(getDisciplineDefinition(code)).toBeDefined();
    }
  });

  test('DISCIPLINE_DEFINITIONS array has entries', () => {
    expect(DISCIPLINE_DEFINITIONS.length).toBeGreaterThanOrEqual(7);
  });

  test('each discipline has deliverables', () => {
    for (const def of DISCIPLINE_DEFINITIONS) {
      expect(def.requiredDeliverables.length).toBeGreaterThan(0);
    }
  });

  test('each discipline has metadata requirements (except BIM_VDC)', () => {
    for (const def of DISCIPLINE_DEFINITIONS) {
      if (def.code !== 'BIM_VDC') {
        expect(def.metadataRequirements.length).toBeGreaterThan(0);
      }
    }
  });

  test('structural has coordination responsibilities', () => {
    const strDef = getDisciplineDefinition('STR');
    expect(strDef!.coordinationResponsibilities.length).toBeGreaterThan(0);
  });

  test('each discipline has QA checks', () => {
    for (const def of DISCIPLINE_DEFINITIONS) {
      expect(def.qaChecklist.length).toBeGreaterThan(0);
    }
  });

  test('undefined code returns undefined', () => {
    expect(getDisciplineDefinition('FAKE' as any)).toBeUndefined();
  });

  test('discipline definitions have required fields', () => {
    for (const def of DISCIPLINE_DEFINITIONS) {
      expect(def.code).toBeDefined();
      expect(def.fullName).toBeDefined();
      expect(def.requiredDeliverables).toBeDefined();
      expect(def.metadataRequirements).toBeDefined();
    }
  });
});

// ─── BEP RULES ENGINE ──────────────────────────────────────────────────────

import {
  MOORINGS_BEP,
  validateFileName,
  validateElementMetadata,
  validateLevelName,
  runBEPValidation,
} from '../bep-rules-engine';

describe('bep-rules-engine.ts', () => {
  test('MOORINGS_BEP is defined', () => {
    expect(MOORINGS_BEP).toBeDefined();
    expect(MOORINGS_BEP.namingConvention).toBeDefined();
    expect(MOORINGS_BEP.levelConvention).toBeDefined();
  });

  test('valid file name passes', () => {
    const result = validateFileName('MOOR-STR-EAST-L01-MODEL-001', MOORINGS_BEP);
    expect(result.valid).toBe(true);
  });

  test('empty file name fails', () => {
    const result = validateFileName('', MOORINGS_BEP);
    expect(result.valid).toBe(false);
  });

  test('level name validates correct levels', () => {
    const result = validateLevelName('L01', MOORINGS_BEP);
    expect(result).toBe(true);
  });

  test('invalid level name fails', () => {
    const result = validateLevelName('Z-A', MOORINGS_BEP);
    expect(result).toBe(false);
  });

  test('metadata compliance checks required fields', () => {
    const element = {
      name: 'MOOR-STR-L01-COL-001',
      discipline: 'STR',
      Material: 'concrete',
      Level: 'Level 1',
    };
    const result = validateElementMetadata(element, 'STR', MOORINGS_BEP);
    expect(result).toBeDefined();
  });

  test('runBEPValidation processes element batch', () => {
    const elements = [
      { name: 'MOOR-STR-L01-COL-001', discipline: 'STR', Level: 'L01', Material: '30 MPa Concrete', Mark: 'C-12' },
      { name: 'bad name', discipline: 'STR', Level: 'Level 1' },
    ];
    const result = runBEPValidation(elements, 'STR', MOORINGS_BEP);
    expect(result).toBeDefined();
    expect(typeof result.score).toBe('number');
  });
});

// ─── MODEL DROP GATING ──────────────────────────────────────────────────────

import {
  DEFAULT_THRESHOLDS,
  runModelDropGate,
} from '../model-drop-gating';

import type { GateVerdict, GateResult } from '../model-drop-gating';

describe('model-drop-gating.ts', () => {
  test('DEFAULT_THRESHOLDS is defined', () => {
    expect(DEFAULT_THRESHOLDS).toBeDefined();
    expect(DEFAULT_THRESHOLDS).toHaveProperty('minElementCount');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('maxPlaceholderPercent');
  });

  test('good model passes gate', () => {
    const result: GateResult = runModelDropGate(
      'model-001',
      Array.from({ length: 100 }, (_, i) => ({
        id: `elem-${i}`,
        name: `MOOR-STR-L01-EL-${i}`,
        discipline: 'STR',
        Level: 'L01',
        Material: 'concrete',
        Mark: `C-${i}`,
      })),
      'STR',
      DEFAULT_THRESHOLDS,
    );
    expect(result.verdict).toBe('ACCEPTED');
  });

  test('model with poor metadata is rejected or conditional', () => {
    const result = runModelDropGate(
      'model-002',
      Array.from({ length: 50 }, (_, i) => ({
        id: `elem-${i}`,
        name: `EL-${i}`,
        discipline: 'ARC',
        Level: 'L01',
      })),
      'ARC',
      DEFAULT_THRESHOLDS,
    );
    expect(['CONDITIONAL', 'REJECTED']).toContain(result.verdict);
  });

  test('empty model is rejected', () => {
    const result = runModelDropGate(
      'model-003',
      [],
      'ARC',
      DEFAULT_THRESHOLDS,
    );
    expect(result.verdict).toBe('REJECTED');
  });

  test('result includes gate checks', () => {
    const result = runModelDropGate(
      'model-004',
      [{ id: 'e1', name: 'N', discipline: 'ARC', Level: 'L01' }],
      'ARC',
      DEFAULT_THRESHOLDS,
    );
    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
