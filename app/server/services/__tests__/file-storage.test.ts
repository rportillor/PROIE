/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  FILE STORAGE — Test Suite
 *  Tests: class existence, static methods, interface compliance
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { FileStorageService } from '../file-storage';
import type { FileStorageResult } from '../file-storage';

describe('FileStorageService', () => {
  test('class exists', () => {
    expect(FileStorageService).toBeDefined();
  });

  test('has static saveFile method', () => {
    expect(typeof FileStorageService.saveFile).toBe('function');
  });

  test('has static getFilePath method', () => {
    expect(typeof FileStorageService.getFilePath).toBe('function');
  });

  test('has static fileExists method', () => {
    expect(typeof FileStorageService.fileExists).toBe('function');
  });

  test('has static deleteFile method', () => {
    expect(typeof FileStorageService.deleteFile).toBe('function');
  });

  test('has static getFileStats method', () => {
    expect(typeof FileStorageService.getFileStats).toBe('function');
  });

  test('FileStorageResult interface compliance', () => {
    const result: FileStorageResult = {
      storagePath: '/uploads/projects/project-001/documents/doc-001/revisions/A-101.pdf',
      fileHash: 'abc123def456',
      relativePath: 'projects/project-001/documents/doc-001/revisions/A-101.pdf',
    };
    expect(result.storagePath).toContain('A-101');
    expect(result.fileHash.length).toBeGreaterThan(0);
    expect(result.relativePath).toContain('project-001');
  });
});
