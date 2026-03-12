/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  STORAGE FILE RESOLVER — Test Suite
 * ══════════════════════════════════════════════════════════════════════════════
 */

// Mock the db module to avoid DATABASE_URL requirement
jest.mock('../../db', () => ({
  db: {
    transaction: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock @shared/schema to avoid import issues
jest.mock('@shared/schema', () => ({
  bimElements: {},
  bimModels: {},
}));

import { loadFileBuffer, deleteModelCascade } from '../storage-file-resolver';

describe('storage-file-resolver.ts', () => {
  test('loadFileBuffer function exists', () => {
    expect(typeof loadFileBuffer).toBe('function');
  });

  test('deleteModelCascade function exists', () => {
    expect(typeof deleteModelCascade).toBe('function');
  });

  test('loadFileBuffer returns a promise', () => {
    const result = loadFileBuffer('fake-storage-key');
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test('loadFileBuffer returns null for non-existent file', async () => {
    const result = await loadFileBuffer('non-existent-key');
    expect(result).toBeNull();
  });

  test('deleteModelCascade returns a promise', () => {
    const { db } = require('../../db');
    db.transaction.mockImplementation(async (fn: any) => {
      await fn({
        delete: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });
    });
    const result = deleteModelCascade('fake-model-id');
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });
});
