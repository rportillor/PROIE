/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  DRAWING ANALYZER — Test Suite
 * ══════════════════════════════════════════════════════════════════════════════
 */

// Mock the storage module to avoid DATABASE_URL requirement
jest.mock('../../storage', () => ({
  storage: {
    getDocument: jest.fn().mockResolvedValue(null),
  },
}));

// Mock pdf-extract-new to avoid needing actual PDF processing
jest.mock('../pdf-extract-new', () => ({
  extractPdfTextAndPages: jest.fn().mockResolvedValue({ pageTexts: [], fullText: '' }),
}));

import { analyzeDrawingsForFacts } from '../drawing-analyzer';

describe('drawing-analyzer.ts', () => {
  test('analyzeDrawingsForFacts function exists', () => {
    expect(typeof analyzeDrawingsForFacts).toBe('function');
  });

  test('returns a promise', () => {
    const result = analyzeDrawingsForFacts('test-project', []);
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test('handles empty documents array', async () => {
    const result = await analyzeDrawingsForFacts('test-project', []);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('facts');
  });
});
