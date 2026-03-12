/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  SIMILARITY SUMMARY — Test Suite
 * ══════════════════════════════════════════════════════════════════════════════
 */

jest.mock('../../db', () => ({ db: {} }));
jest.mock('../../storage', () => ({ storage: {} }));

import { buildProjectSimilaritySummary } from '../similarity-summary';
import type { ProjectSimilaritySummary } from '../similarity-summary';

describe('similarity-summary.ts', () => {
  test('buildProjectSimilaritySummary function exists', () => {
    expect(typeof buildProjectSimilaritySummary).toBe('function');
  });

  test('returns a promise', () => {
    const result = buildProjectSimilaritySummary('test-project');
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test('ProjectSimilaritySummary type compliance', () => {
    const summary: ProjectSimilaritySummary = {
      projectId: 'MOOR',
      documents: [],
      pairs: [],
      overallScore: 0.75,
      counts: { totalPairs: 10, critical: 0, high: 3, medium: 4, low: 3 },
      analyzedAt: new Date().toISOString(),
    };
    expect(summary.overallScore).toBeCloseTo(0.75);
  });
});
