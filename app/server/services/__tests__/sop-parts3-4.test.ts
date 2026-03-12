/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  SOP PARTS 3 & 4 — Prompt Library + Extraction Checklists
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── PROMPT LIBRARY (SOP Part 3) ────────────────────────────────────────────

import {
  getDrawingParsingPrompt,
  getModelQTOPrompt,
  getConstructabilityPrompt,
  getSequencing4DPrompt,
  getCrossDocQAPrompt,
  getEngineeringValidationPrompt,
} from '../prompt-library';

describe('prompt-library.ts', () => {
  test('getDrawingParsingPrompt returns non-empty string', () => {
    const prompt = getDrawingParsingPrompt({
      sheetIds: ['A-101'],
      discipline: 'ARC',
      projectName: 'The Moorings',
    });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  test('prompt includes project name when provided', () => {
    const prompt = getDrawingParsingPrompt({
      sheetIds: ['A-101'],
      discipline: 'ARC',
      projectName: 'The Moorings',
    });
    expect(prompt).toContain('Moorings');
  });

  test('prompt includes discipline context', () => {
    const prompt = getDrawingParsingPrompt({
      sheetIds: ['S-201'],
      discipline: 'STR',
      projectName: 'Test',
    });
    expect(prompt.toLowerCase()).toContain('str');
  });

  test('getModelQTOPrompt returns non-empty string', () => {
    const prompt = getModelQTOPrompt({
      modelId: 'model-001',
      projectName: 'Test',
    });
    expect(prompt.length).toBeGreaterThan(50);
  });

  test('getConstructabilityPrompt returns valid prompt', () => {
    const prompt = getConstructabilityPrompt({
      projectName: 'Test',
    });
    expect(prompt.length).toBeGreaterThan(50);
  });

  test('getSequencing4DPrompt returns valid prompt', () => {
    const prompt = getSequencing4DPrompt({
      projectName: 'Test',
    });
    expect(prompt.length).toBeGreaterThan(50);
  });

  test('getCrossDocQAPrompt returns valid prompt', () => {
    const prompt = getCrossDocQAPrompt({
      projectName: 'Test',
      documentPairs: [['A-101', 'S-201']],
    });
    expect(prompt.length).toBeGreaterThan(50);
  });

  test('getEngineeringValidationPrompt returns valid prompt', () => {
    const prompt = getEngineeringValidationPrompt({
      disciplines: ['STR'],
      projectName: 'Test',
    });
    expect(prompt.length).toBeGreaterThan(50);
  });

  test('different sheet sets produce different prompts', () => {
    const prompt1 = getDrawingParsingPrompt({ sheetIds: ['A-101'], discipline: 'ARC', projectName: 'T' });
    const prompt2 = getDrawingParsingPrompt({ sheetIds: ['S-201'], discipline: 'ARC', projectName: 'T' });
    expect(prompt1).not.toBe(prompt2);
  });

  test('different disciplines produce different prompts', () => {
    const archPrompt = getDrawingParsingPrompt({ sheetIds: ['A-101'], discipline: 'ARC', projectName: 'T' });
    const mechPrompt = getDrawingParsingPrompt({ sheetIds: ['A-101'], discipline: 'MECH', projectName: 'T' });
    expect(archPrompt).not.toBe(mechPrompt);
  });
});

// ─── EXTRACTION CHECKLISTS (SOP Part 4) ─────────────────────────────────────

import {
  DISCIPLINE_CHECKLISTS,
  storeExtraction,
  getExtraction,
  validateExtraction,
  detectConflicts,
  createEmptyExtraction,
} from '../extraction-checklists';

describe('extraction-checklists.ts', () => {
  test('DISCIPLINE_CHECKLISTS has entries for main disciplines', () => {
    expect(DISCIPLINE_CHECKLISTS).toBeDefined();
    const keys = Object.keys(DISCIPLINE_CHECKLISTS);
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });

  test('each checklist has required fields', () => {
    for (const [disc, checklist] of Object.entries(DISCIPLINE_CHECKLISTS)) {
      expect(checklist.discipline).toBeDefined();
      expect(Array.isArray(checklist.requiredTables)).toBe(true);
      expect(checklist.requiredTables.length).toBeGreaterThan(0);
    }
  });

  test('storeExtraction stores and returns result', () => {
    const extraction = createEmptyExtraction('MOOR-TEST', 'ARC', ['A-101']);
    const result = storeExtraction(extraction);
    expect(result).toBeDefined();
    expect(result.projectId).toBe('MOOR-TEST');
  });

  test('getExtraction retrieves stored extraction', () => {
    const extraction = createEmptyExtraction('MOOR-GET', 'ARC', ['A-102']);
    storeExtraction(extraction);
    const retrieved = getExtraction('MOOR-GET', 'ARC');
    expect(retrieved).toBeDefined();
  });

  test('validateExtraction checks completeness', () => {
    const extraction = createEmptyExtraction('MOOR-VAL', 'ARC', ['A-103']);
    const result = validateExtraction(extraction);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('isComplete');
    expect(result).toHaveProperty('gaps');
  });

  test('detectConflicts finds discrepancies in extraction', () => {
    const extraction = createEmptyExtraction('MOOR-CONF', 'ARC', ['A-101', 'S-101']);
    const conflicts = detectConflicts(extraction);
    expect(Array.isArray(conflicts)).toBe(true);
  });

  test('empty extraction generates validation gaps', () => {
    const extraction = createEmptyExtraction('MOOR-LOW', 'ARC', ['A-104']);
    const result = validateExtraction(extraction);
    expect(result.gaps.length).toBeGreaterThan(0);
  });
});
