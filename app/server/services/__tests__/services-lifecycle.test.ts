/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  SERVICES — Assembly, Document, Lifecycle Services — Test Suite
 *  Tests: class exports, method existence, basic instantiation
 * ══════════════════════════════════════════════════════════════════════════════
 */

jest.mock('../../db', () => ({ db: {} }));
jest.mock('../../storage', () => ({ storage: {} }));

// ─── ASSEMBLY LOGIC ─────────────────────────────────────────────────────────

import { AssemblyLogicService } from '../assembly-logic';
import type { Assembly, AssemblyComponent } from '../assembly-logic';

describe('assembly-logic.ts', () => {
  let service: AssemblyLogicService;
  beforeEach(() => { service = new AssemblyLogicService(); });

  test('processAssemblies returns assemblies from raw materials', () => {
    const assemblies = service.processAssemblies([
      { name: 'Gypsum Board', description: 'Gypsum board 13mm' },
      { name: 'Insulation', description: 'Mineral wool insulation' },
    ]);
    expect(Array.isArray(assemblies)).toBe(true);
  });

  test('processAssemblies returns empty array for empty input', () => {
    const assemblies = service.processAssemblies([]);
    expect(assemblies).toHaveLength(0);
  });

  test('each assembly has required fields', () => {
    const assemblies = service.processAssemblies([
      { name: 'Concrete Mix', description: 'Precast concrete panel' },
    ]);
    if (assemblies.length > 0) {
      const assembly = assemblies[0];
      expect(assembly).toHaveProperty('id');
      expect(assembly).toHaveProperty('name');
      expect(assembly).toHaveProperty('description');
      expect(assembly).toHaveProperty('baseUnit');
      expect(assembly).toHaveProperty('components');
      expect(assembly).toHaveProperty('totalCost');
    }
  });

  test('assembly components have correct shape', () => {
    const assemblies = service.processAssemblies([
      { name: 'Drywall Sheet', description: 'Gypsum drywall 5/8"' },
    ]);
    if (assemblies.length > 0 && assemblies[0].components.length > 0) {
      const comp = assemblies[0].components[0];
      expect(comp).toHaveProperty('material');
      expect(comp).toHaveProperty('quantity');
      expect(comp).toHaveProperty('unit');
      expect(comp).toHaveProperty('rate');
      expect(comp).toHaveProperty('subtotal');
    }
  });
});

// ─── DOCUMENT CHUNKER ───────────────────────────────────────────────────────

import { DocumentChunker } from '../document-chunker';

describe('document-chunker.ts', () => {
  let chunker: DocumentChunker;
  beforeEach(() => { chunker = new DocumentChunker(); });

  test('chunkSpecificationDocument is a function', () => {
    expect(typeof chunker.chunkSpecificationDocument).toBe('function');
  });

  test('chunkSpecificationDocument returns chunks for valid content', async () => {
    const content = 'DIVISION 03 CONCRETE\nConcrete mix design per CSA A23.1\n'.repeat(50);
    const chunks = await chunker.chunkSpecificationDocument(content, 'test-spec.pdf');
    expect(Array.isArray(chunks)).toBe(true);
  });

  test('chunkSpecificationDocument returns empty or minimal for empty content', async () => {
    const chunks = await chunker.chunkSpecificationDocument('', 'empty.pdf');
    expect(Array.isArray(chunks)).toBe(true);
  });

  test('chunks have sequential indices', async () => {
    const content = 'DIVISION 03 CONCRETE\nfoundation concrete\n' +
      'DIVISION 07 THERMAL\ninsulation roofing\n' +
      'DIVISION 09 FINISHES\ndrywall flooring\n';
    const chunks = await chunker.chunkSpecificationDocument(content, 'test.pdf');
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i + 1);
    }
  });

  test('createChunkedAnalysisPrompt returns string', () => {
    const chunk = {
      id: 'chunk_1',
      title: 'Test Chunk',
      content: 'Some content',
      csiDivisions: ['03', '04'],
      tokenEstimate: 100,
      chunkIndex: 1,
      totalChunks: 3,
    };
    const prompt = chunker.createChunkedAnalysisPrompt(chunk, 'Test Project');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

// ─── RFI SERVICE ────────────────────────────────────────────────────────────

import { RfiService } from '../rfi-service';

describe('rfi-service.ts', () => {
  test('RfiService class exists', () => {
    expect(RfiService).toBeDefined();
  });

  test('RfiService has static createRfi method', () => {
    expect(typeof RfiService.createRfi).toBe('function');
  });

  test('RfiService has static getProjectRfis method', () => {
    expect(typeof RfiService.getProjectRfis).toBe('function');
  });

  test('RfiService has static getRfiWithDetails method', () => {
    expect(typeof RfiService.getRfiWithDetails).toBe('function');
  });

  test('RfiService has static addResponse method', () => {
    expect(typeof RfiService.addResponse).toBe('function');
  });

  test('RfiService has static updateRfiStatus method', () => {
    expect(typeof RfiService.updateRfiStatus).toBe('function');
  });

  test('RfiService has static getRfiStats method', () => {
    expect(typeof RfiService.getRfiStats).toBe('function');
  });
});

// ─── CHANGE REQUEST SERVICE ─────────────────────────────────────────────────

import { ChangeRequestService } from '../change-request-service';

describe('change-request-service.ts', () => {
  test('ChangeRequestService class exists', () => {
    expect(ChangeRequestService).toBeDefined();
  });

  test('ChangeRequestService has static createChangeRequest method', () => {
    expect(typeof ChangeRequestService.createChangeRequest).toBe('function');
  });

  test('ChangeRequestService has static updateStatus method', () => {
    expect(typeof ChangeRequestService.updateStatus).toBe('function');
  });

  test('ChangeRequestService has static getProjectChangeRequests method', () => {
    expect(typeof ChangeRequestService.getProjectChangeRequests).toBe('function');
  });

  test('ChangeRequestService has static getChangeRequestStats method', () => {
    expect(typeof ChangeRequestService.getChangeRequestStats).toBe('function');
  });
});

// ─── ATOMIC REVISION SERVICE ────────────────────────────────────────────────

import { AtomicRevisionService } from '../atomic-revision-service';

describe('atomic-revision-service.ts', () => {
  test('AtomicRevisionService class exists', () => {
    expect(AtomicRevisionService).toBeDefined();
  });

  test('AtomicRevisionService has static createRevision method', () => {
    expect(typeof AtomicRevisionService.createRevision).toBe('function');
  });

  test('AtomicRevisionService has static getDocumentRevisions method', () => {
    expect(typeof AtomicRevisionService.getDocumentRevisions).toBe('function');
  });

  test('AtomicRevisionService has static approveRevision method', () => {
    expect(typeof AtomicRevisionService.approveRevision).toBe('function');
  });

  test('AtomicRevisionService has static getRevisionCounter method', () => {
    expect(typeof AtomicRevisionService.getRevisionCounter).toBe('function');
  });

  test('AtomicRevisionService has static compareRevisions method', () => {
    expect(typeof AtomicRevisionService.compareRevisions).toBe('function');
  });
});
