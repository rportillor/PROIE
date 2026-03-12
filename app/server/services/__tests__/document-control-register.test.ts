/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  DOCUMENT CONTROL REGISTER — Test Suite (SOP Part 1)
 *  Tests: register CRUD, revision history, evidence validation,
 *  transmittals, unit/datum, validation
 * ══════════════════════════════════════════════════════════════════════════════
 */

import {
  initializeRegister,
  getRegister,
  addDocument,
  addDocuments,
  getDocument,
  getDocumentsByDiscipline,
  getDocumentsByStatus,
  reviseDocument,
  updateDocumentStatus,
  getRevisionHistory,
  getRecentRevisions,
  validateRegister,
  validateEvidenceReference,
  findDocuments,
  getCurrentVersion,
  listDisciplines,
  generateTransmittalNumber,
  recordTransmittal,
  getTransmittals,
  setUnitDatumConvention,
  getUnitDatumConvention,
  formatRegisterSummary,
  deleteRegister,
} from '../document-control-register';

import type {
  DocumentRegister,
  RevisionEvent,
  RegisterValidation,
} from '../document-control-register';

import type {
  DocumentControlEntry,
  DocumentStatus,
  EvidenceReference,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST DATA
// ═══════════════════════════════════════════════════════════════════════════════

const PROJECT_ID = 'test-proj-001';
const PROJECT_NAME = 'The Moorings';

function makeDoc(overrides: Partial<DocumentControlEntry> & { id: string; sheetOrSpecId: string; title: string }): DocumentControlEntry {
  return {
    revision: 'A',
    revisionDate: '2025-01-15',
    discipline: 'architectural',
    status: 'FOR_REVIEW' as DocumentStatus,
    scopeNotes: '',
    evidenceRef: { type: 'drawing' } as any,
    ...overrides,
  } as DocumentControlEntry;
}

const DOC_A101 = makeDoc({ id: 'doc-a101', sheetOrSpecId: 'A-101', title: 'Ground Floor Plan', discipline: 'architectural', status: 'ISSUED' as DocumentStatus, revision: 'B', revisionDate: '2025-03-01' });
const DOC_S201 = makeDoc({ id: 'doc-s201', sheetOrSpecId: 'S-201', title: 'Structural Sections', discipline: 'structural', status: 'FOR_REVIEW' as DocumentStatus });
const DOC_M101 = makeDoc({ id: 'doc-m101', sheetOrSpecId: 'M-101', title: 'Mechanical Ground Floor', discipline: 'mechanical', status: 'FOR_REVIEW' as DocumentStatus });

function setupRegister() {
  deleteRegister(PROJECT_ID);
  initializeRegister(PROJECT_ID, PROJECT_NAME);
  addDocument(PROJECT_ID, DOC_A101);
  addDocument(PROJECT_ID, DOC_S201);
  addDocument(PROJECT_ID, DOC_M101);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REGISTER INITIALIZATION & QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Document Register Initialization', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('initializes register with project name', () => {
    const reg = getRegister(PROJECT_ID);
    expect(reg).toBeDefined();
    expect(reg!.projectName).toBe(PROJECT_NAME);
  });

  test('adds documents to register', () => {
    const reg = getRegister(PROJECT_ID);
    expect(reg!.documents.length).toBe(3);
  });

  test('retrieves document by project and doc ID', () => {
    const doc = getDocument(PROJECT_ID, 'doc-a101');
    expect(doc).toBeDefined();
    expect(doc!.title).toBe('Ground Floor Plan');
  });

  test('returns undefined for non-existent document', () => {
    expect(getDocument(PROJECT_ID, 'doc-x999')).toBeUndefined();
  });

  test('getDocumentsByDiscipline filters correctly', () => {
    const archDocs = getDocumentsByDiscipline(PROJECT_ID, 'architectural');
    expect(archDocs.length).toBe(1);
    expect(archDocs[0].sheetOrSpecId).toBe('A-101');
  });

  test('getDocumentsByStatus filters correctly', () => {
    const issuedDocs = getDocumentsByStatus(PROJECT_ID, 'ISSUED' as DocumentStatus);
    expect(issuedDocs.length).toBe(1);
    expect(issuedDocs[0].sheetOrSpecId).toBe('A-101');
  });

  test('returns undefined for non-existent project', () => {
    expect(getRegister('non-existent')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT ADDITION & BATCH
// ═══════════════════════════════════════════════════════════════════════════════

describe('addDocument and addDocuments', () => {
  beforeEach(() => {
    deleteRegister(PROJECT_ID);
    initializeRegister(PROJECT_ID, PROJECT_NAME);
  });
  afterEach(() => deleteRegister(PROJECT_ID));

  test('addDocument returns the document on success', () => {
    const result = addDocument(PROJECT_ID, DOC_A101);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Ground Floor Plan');
  });

  test('addDocument returns null for duplicate ID', () => {
    addDocument(PROJECT_ID, DOC_A101);
    const result = addDocument(PROJECT_ID, DOC_A101);
    expect(result).toBeNull();
  });

  test('addDocuments batch adds multiple documents', () => {
    const result = addDocuments(PROJECT_ID, [DOC_A101, DOC_S201, DOC_M101]);
    expect(result.added).toBe(3);
    expect(result.skipped).toBe(0);
  });

  test('addDocuments reports skipped duplicates', () => {
    addDocument(PROJECT_ID, DOC_A101);
    const result = addDocuments(PROJECT_ID, [DOC_A101, DOC_S201]);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  REVISION TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

describe('reviseDocument', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('revises a document with new revision', () => {
    const result = reviseDocument(PROJECT_ID, 'doc-a101', {
      newRevision: 'C',
      revisionType: 'ADDENDUM',
      description: 'Addendum 01',
    });
    expect(result).not.toBeNull();
    expect(result!.revision).toBe('C');
  });

  test('returns null for non-existent document', () => {
    const result = reviseDocument(PROJECT_ID, 'doc-x999', {
      newRevision: 'B',
      revisionType: 'RE_ISSUE',
      description: 'Test',
    });
    expect(result).toBeNull();
  });

  test('status can be updated via updateDocumentStatus', () => {
    const result = updateDocumentStatus(PROJECT_ID, 'doc-s201', 'ISSUED' as DocumentStatus);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ISSUED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  REVISION HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Revision History', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('getRevisionHistory returns initial revision event', () => {
    const history = getRevisionHistory(PROJECT_ID, 'doc-a101');
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].documentId).toBe('doc-a101');
  });

  test('returns empty for non-existent document', () => {
    expect(getRevisionHistory(PROJECT_ID, 'doc-x999')).toHaveLength(0);
  });

  test('getRecentRevisions finds revisions after date', () => {
    const revised = getRecentRevisions(PROJECT_ID, '2020-01-01');
    expect(revised.length).toBeGreaterThan(0);
  });

  test('getRecentRevisions with future date returns empty', () => {
    const revised = getRecentRevisions(PROJECT_ID, '2099-01-01');
    expect(revised).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EVIDENCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateEvidenceReference', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('valid sheet reference passes', () => {
    const result = validateEvidenceReference(PROJECT_ID, { sheet: 'A-101' } as EvidenceReference);
    expect(result.valid).toBe(true);
  });

  test('non-existent sheet fails', () => {
    const result = validateEvidenceReference(PROJECT_ID, { sheet: 'X-999' } as EvidenceReference);
    expect(result.valid).toBe(false);
  });

  test('non-existent project fails', () => {
    const result = validateEvidenceReference('non-existent', { sheet: 'A-101' } as EvidenceReference);
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  REGISTER VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateRegister', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('validates register and returns result', () => {
    const validation = validateRegister(PROJECT_ID);
    expect(validation).toBeDefined();
    expect(validation.documentCount).toBe(3);
  });

  test('non-existent project returns invalid', () => {
    const validation = validateRegister('non-existent');
    expect(validation.isValid).toBe(false);
    expect(validation.documentCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSMITTALS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transmittals', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('generates sequential transmittal numbers', () => {
    const num1 = generateTransmittalNumber(PROJECT_ID);
    const num2 = generateTransmittalNumber(PROJECT_ID);
    expect(num1).toContain('TX-');
    expect(num1).not.toBe(num2);
  });

  test('records transmittal for valid documents', () => {
    const tx = recordTransmittal(PROJECT_ID, {
      from: 'Architect',
      to: 'Contractor',
      purpose: 'IFC',
      documentIds: ['doc-a101'],
    });
    expect(tx).not.toBeNull();
    expect(tx!.transmittalNumber).toContain('TX-');
  });

  test('rejects transmittal with unknown document IDs', () => {
    const tx = recordTransmittal(PROJECT_ID, {
      from: 'Architect',
      to: 'Contractor',
      purpose: 'IFC',
      documentIds: ['doc-x999'],
    });
    expect(tx).toBeNull();
  });

  test('getTransmittals returns recorded transmittals', () => {
    recordTransmittal(PROJECT_ID, {
      from: 'Architect',
      to: 'Contractor',
      purpose: 'IFC',
      documentIds: ['doc-a101'],
    });
    const txs = getTransmittals(PROJECT_ID);
    expect(txs.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  UNIT/DATUM CONVENTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Unit/Datum Convention', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('sets metric unit convention', () => {
    const result = setUnitDatumConvention(PROJECT_ID, {
      unitSystem: 'metric',
      primaryLengthUnit: 'mm',
      datumReference: 'Project 0.000 = 265.50m geodetic',
      benchmarks: [],
    });
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false); // no benchmarks
  });

  test('flags NOT_STATED unit system as gap', () => {
    const result = setUnitDatumConvention(PROJECT_ID, {
      unitSystem: 'NOT_STATED',
      primaryLengthUnit: 'NOT_STATED',
      datumReference: 'NOT_STATED',
      benchmarks: [],
    });
    expect(result).not.toBeNull();
    expect(result!.gaps.length).toBeGreaterThan(0);
    expect(result!.verified).toBe(false);
  });

  test('getUnitDatumConvention returns current convention', () => {
    const convention = getUnitDatumConvention(PROJECT_ID);
    expect(convention).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

describe('Document Lookup', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('findDocuments searches by sheet/spec ID', () => {
    const found = findDocuments(PROJECT_ID, 'A-101');
    expect(found.length).toBe(1);
    expect(found[0].title).toBe('Ground Floor Plan');
  });

  test('findDocuments searches by title', () => {
    const found = findDocuments(PROJECT_ID, 'Ground Floor');
    expect(found.length).toBe(1);
  });

  test('findDocuments returns empty for no match', () => {
    const found = findDocuments(PROJECT_ID, 'nonexistent');
    expect(found).toHaveLength(0);
  });

  test('getCurrentVersion returns active document', () => {
    const doc = getCurrentVersion(PROJECT_ID, 'A-101');
    expect(doc).toBeDefined();
  });

  test('listDisciplines returns unique disciplines', () => {
    const disciplines = listDisciplines(PROJECT_ID);
    expect(disciplines.length).toBeGreaterThan(0);
    expect(disciplines).toContain('architectural');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatRegisterSummary', () => {
  beforeEach(() => setupRegister());
  afterEach(() => deleteRegister(PROJECT_ID));

  test('generates text summary', () => {
    const summary = formatRegisterSummary(PROJECT_ID);
    expect(summary).toContain(PROJECT_NAME);
    expect(summary).toContain('Documents:');
  });

  test('returns message for non-existent project', () => {
    const summary = formatRegisterSummary('non-existent');
    expect(summary).toContain('No register found');
  });
});
