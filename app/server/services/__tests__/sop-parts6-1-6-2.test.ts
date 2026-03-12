/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  SOP PART 6.1 — Constructability Engine Tests
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── CONSTRUCTABILITY ENGINE (SOP Part 6.1) ─────────────────────────────────

import {
  storeAnalysis,
  getAnalysis,
  deleteAnalysis,
  validateAnalysis,
  createEmptyAnalysis,
  addWorkArea,
  addSafetyIssue,
  addTempWorks,
  addTradeDependency,
} from '../constructability-engine';

import type { ConstructabilityAnalysis } from '../constructability-engine';

describe('constructability-engine.ts', () => {
  const sampleAnalysis: ConstructabilityAnalysis = {
    projectId: 'MOOR-TEST',
    timestamp: new Date().toISOString(),
    workAreas: [],
    tempWorks: [],
    tradeDependencies: [],
    safetyIssues: [],
    gaps: [],
  };

  test('storeAnalysis stores and returns', () => {
    const stored = storeAnalysis({ ...sampleAnalysis });
    expect(stored.projectId).toBe('MOOR-TEST');
  });

  test('getAnalysis retrieves stored analysis', () => {
    storeAnalysis({ ...sampleAnalysis });
    const retrieved = getAnalysis('MOOR-TEST');
    expect(retrieved).toBeDefined();
    expect(retrieved!.projectId).toBe('MOOR-TEST');
  });

  test('getAnalysis returns undefined for non-existent', () => {
    expect(getAnalysis('FAKE-PROJECT')).toBeUndefined();
  });

  test('deleteAnalysis removes stored analysis', () => {
    storeAnalysis({ ...sampleAnalysis, projectId: 'DEL-TEST' });
    expect(deleteAnalysis('DEL-TEST')).toBe(true);
    expect(getAnalysis('DEL-TEST')).toBeUndefined();
  });

  test('deleteAnalysis returns false for non-existent', () => {
    expect(deleteAnalysis('NEVER-EXISTED')).toBe(false);
  });

  test('validateAnalysis returns validation result', () => {
    const result = validateAnalysis(sampleAnalysis);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('isComplete');
    expect(result).toHaveProperty('missingItems');
  });

  test('createEmptyAnalysis returns empty structure', () => {
    const analysis = createEmptyAnalysis('NEW-PROJECT');
    expect(analysis.projectId).toBe('NEW-PROJECT');
    expect(analysis.workAreas).toHaveLength(0);
    expect(analysis.tradeDependencies).toHaveLength(0);
  });

  test('addSafetyIssue adds to analysis', () => {
    const analysis = createEmptyAnalysis('SAFETY-TEST');
    const issue = addSafetyIssue(analysis, {
      id: 'SAF-001',
      category: 'fall_protection',
      description: 'Fall protection required above 3m',
      location: 'Level 2 edge',
      severity: 'critical',
      affectedTrades: ['General'],
    });
    expect(analysis.safetyIssues).toHaveLength(1);
    expect(issue.id).toBe('SAF-001');
  });

  test('addTradeDependency adds to analysis', () => {
    const analysis = createEmptyAnalysis('DEP-TEST');
    const result = addTradeDependency(analysis, {
      predecessorTrade: 'Concrete',
      successorTrade: 'Framing',
      dependencyType: 'finish_to_start',
      lagDays: 7,
      constraint: 'FS',
      holdPoint: true,
      inspectionRequired: true,
      description: 'Concrete must cure before framing',
    });
    expect(result.added).toBe(true);
    expect(analysis.tradeDependencies).toHaveLength(1);
  });
});
