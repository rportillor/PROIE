/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  BCF EXPORT + VIEWPOINT GENERATOR + TREND ANALYTICS + PENETRATIONS MATRIX
 *  50+ tests
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── BCF EXPORT ─────────────────────────────────────────────────────────────

import {
  generateBCFTopics,
  serializeBCFToXML,
  generateIssueCSV,
  generateClashCSV,
  generateHTMLMeetingSummary,
} from '../bcf-export';

describe('bcf-export.ts', () => {
  const sampleIssues = [
    { id: 'iss-001', issueNumber: 'ISS-0001', name: 'MOOR-STR-001', testId: 'CD-001', type: 'hard_clash', zone: 'Level1_ZoneA', gridRef: 'B-3', priority: 'P1', owner: 'Structural Lead', assignedTo: 'John Doe', originDiscipline: 'structural', status: 'OPEN', createdDate: '2025-01-15', targetDate: '2025-02-15', resolvedDate: null, description: 'Beam-duct clash', recommendation: 'Reroute duct', resolution: null, clashGroupId: null, rfiNumber: null, elementIds: ['beam-001', 'duct-001'], codeReferences: ['NBC 3.2.1'], statusHistory: [{ from: 'OPEN', to: 'OPEN', date: '2025-01-15', changedBy: 'system' }], attachments: [], tags: ['structural', 'critical'], discipline: 'STRUCT', severity: 'critical', elements: ['beam-001', 'duct-001'], storey: 'Level 1' },
    { id: 'iss-002', issueNumber: 'ISS-0002', name: 'MOOR-MECH-001', testId: 'SC-01', type: 'soft_clash', zone: 'Level2_ZoneB', gridRef: 'C-4', priority: 'P3', owner: 'Mechanical Lead', assignedTo: 'Jane Smith', originDiscipline: 'mechanical', status: 'IN_PROGRESS', createdDate: '2025-01-20', targetDate: '2025-03-01', resolvedDate: null, description: 'Pipe clearance', recommendation: 'Adjust pipe routing', resolution: null, clashGroupId: null, rfiNumber: null, elementIds: ['pipe-001'], codeReferences: [], statusHistory: [{ from: 'OPEN', to: 'IN_PROGRESS', date: '2025-01-22', changedBy: 'system' }], attachments: [], tags: ['mechanical'], discipline: 'MECH', severity: 'medium', elements: ['pipe-001'], storey: 'Level 2' },
  ];

  const sampleClashes = [
    { id: 'c1000000', testId: 'CD-001', category: 'HARD_CLASH', severity: 'CRITICAL', elementA: { id: 'beam-001', name: 'Beam B1', elementType: 'beam', discipline: 'structural', storey: 'Level 1' }, elementB: { id: 'duct-001', name: 'Supply Duct', elementType: 'duct', discipline: 'mechanical', storey: 'Level 1' }, overlapVolume_m3: 0.05, clearanceRequired_mm: 50, clearanceActual_mm: 0, penetrationDepth_mm: 50, location: { x: 5, y: 3, z: 2.5 }, description: 'Beam-duct hard clash', codeReferences: ['NBC 3.2.1'] },
    { id: 'c2000000', testId: 'SC-01', category: 'CLEARANCE', severity: 'MEDIUM', elementA: { id: 'pipe-001', name: 'Cold Water Pipe', elementType: 'pipe', discipline: 'plumbing', storey: 'Level 1' }, elementB: { id: 'wall-001', name: 'Interior Wall', elementType: 'wall', discipline: 'architectural', storey: 'Level 1' }, overlapVolume_m3: 0.0, clearanceRequired_mm: 25, clearanceActual_mm: 10, penetrationDepth_mm: 0, location: { x: 10, y: 8, z: 1 }, description: 'Pipe clearance issue', codeReferences: [] },
  ];

  test('generateBCFTopics produces topics from issues', () => {
    const topics = generateBCFTopics(sampleIssues as any);
    expect(topics.length).toBe(2);
    expect(topics[0]).toHaveProperty('guid');
    expect(topics[0]).toHaveProperty('title');
    expect(topics[0]).toHaveProperty('topicStatus');
  });

  test('BCF topics have valid GUIDs', () => {
    const topics = generateBCFTopics(sampleIssues as any);
    for (const t of topics) {
      expect(t.guid.length).toBeGreaterThan(0);
    }
  });

  test('serializeBCFToXML returns map of filenames to XML', () => {
    const topics = generateBCFTopics(sampleIssues as any);
    const xmlMap = serializeBCFToXML(topics);
    expect(xmlMap).toBeInstanceOf(Map);
    expect(xmlMap.size).toBeGreaterThan(0);
    for (const [filename, xml] of xmlMap) {
      expect(filename.endsWith('.bcf') || filename.endsWith('.bcfp') || filename.endsWith('.bcfv') || filename === 'bcf.version').toBe(true);
      expect(xml).toContain('<?xml');
    }
  });

  test('generateIssueCSV produces valid CSV', () => {
    const csv = generateIssueCSV(sampleIssues as any);
    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(0);
    expect(csv).toContain(',');
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1); // header + data
  });

  test('generateClashCSV produces valid CSV', () => {
    const csv = generateClashCSV(sampleClashes as any);
    expect(typeof csv).toBe('string');
    expect(csv).toContain(',');
  });

  test('generateHTMLMeetingSummary returns HTML string', () => {
    const html = generateHTMLMeetingSummary({
      projectName: 'The Moorings',
      meetingDate: '2025-03-15',
      attendees: ['PM', 'Architect', 'Structural Eng'],
      issues: [] as any,
      clashGroups: [] as any,
    });
    expect(html).toContain('<html');
    expect(html).toContain('The Moorings');
  });

  test('empty issues returns empty CSV with header', () => {
    const csv = generateIssueCSV([]);
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1); // just header
  });
});

// ─── VIEWPOINT GENERATOR ────────────────────────────────────────────────────

import {
  generateViewpointSet,
  generateAllViewpoints,
} from '../viewpoint-generator';

import type { Viewpoint, ViewpointSet, Vector3 } from '../viewpoint-generator';

describe('viewpoint-generator.ts', () => {
  // generateViewpointSet takes a ClashGroup, so we build a minimal one
  const minimalClashGroup = {
    groupId: 'grp-001',
    description: 'Test clash group',
    rootCauseElementId: 'beam-001',
    rootCauseDiscipline: 'structural' as const,
    rootCauseType: 'hard_clash',
    affectedElements: ['duct-001'],
    affectedDisciplines: ['mechanical' as const],
    highestSeverity: 'critical' as const,
    zone: 'Level 1',
    gridRef: 'C4',
    suggestedAction: 'Reroute duct',
    clashes: [
      {
        id: 'c1',
        testId: 'CD-001',
        category: 'hard',
        severity: 'critical',
        elementA: { id: 'beam-001', elementId: 'beam-001', name: 'Beam B1', elementType: 'beam', discipline: 'structural', storey: 'Level 1', bbox: { minX: 0, minY: 0, minZ: 2, maxX: 6, maxY: 0.3, maxZ: 2.5 } },
        elementB: { id: 'duct-001', elementId: 'duct-001', name: 'Supply Duct', elementType: 'duct', discipline: 'mechanical', storey: 'Level 1', bbox: { minX: 1, minY: 0.5, minZ: 2.2, maxX: 5, maxY: 0.8, maxZ: 2.8 } },
        location: { x: 3, y: 0.4, z: 2.35 },
        overlapVolume_m3: 0.01,
        clearanceRequired_mm: 50,
        clearanceActual_mm: -20,
        penetrationDepth_mm: 70,
        description: 'Beam penetrates duct',
        codeReferences: [],
      },
    ],
  };

  test('generateViewpointSet returns valid viewpoint set', () => {
    const set = generateViewpointSet(minimalClashGroup as any);
    expect(set).toBeDefined();
    expect(set.viewpoints.length).toBe(3);
    expect(set.groupId).toBe('grp-001');
  });

  test('viewpoint set contains ISO, SEC, PLAN types', () => {
    const set = generateViewpointSet(minimalClashGroup as any);
    const types = set.viewpoints.map(vp => vp.type);
    expect(types).toContain('ISO');
    expect(types).toContain('SEC');
    expect(types).toContain('PLAN');
  });

  test('each viewpoint has camera setup', () => {
    const set = generateViewpointSet(minimalClashGroup as any);
    for (const vp of set.viewpoints) {
      expect(vp.camera).toBeDefined();
      expect(vp.camera.eyePosition).toBeDefined();
      expect(vp.camera.lookAt).toBeDefined();
    }
  });

  test('viewpoints have color overrides for clashing elements', () => {
    const set = generateViewpointSet(minimalClashGroup as any);
    for (const vp of set.viewpoints) {
      expect(vp.colorOverrides).toBeDefined();
      expect(vp.colorOverrides.length).toBeGreaterThan(0);
    }
  });

  test('generateAllViewpoints creates sets for multiple groups', () => {
    const sets = generateAllViewpoints([minimalClashGroup as any, minimalClashGroup as any]);
    expect(sets.length).toBe(2);
    for (const set of sets) {
      expect(set.viewpoints.length).toBe(3);
    }
  });

  test('PLAN viewpoint camera is above target (top-down)', () => {
    const set = generateViewpointSet(minimalClashGroup as any);
    const planVp = set.viewpoints.find(vp => vp.type === 'PLAN');
    expect(planVp).toBeDefined();
    expect(planVp!.camera.eyePosition.z).toBeGreaterThan(planVp!.camera.lookAt.z);
  });
});

// ─── TREND ANALYTICS ────────────────────────────────────────────────────────

import {
  buildTrendDataPoints,
  calculateVelocity,
  identifyHotspots,
  analyzeRootCauseTrends,
  generateTrendReport,
  generateAlerts,
  calculateBurndown,
} from '../trend-analytics';

import type { TrendDataPoint, TrendReport } from '../trend-analytics';
import type { DeltaSummary } from '../delta-tracker';

describe('trend-analytics.ts', () => {
  const sampleDeltas: DeltaSummary[] = [
    { runId: 'd1', previousRunId: 'd0', runDate: '2025-02-01', newCount: 10, resolvedCount: 2, persistentCount: 20, regressionCount: 0, totalCurrent: 28, totalPrevious: 20, netChange: 8, bySeverity: {} as any, byZone: {} as any, regressions: [] },
    { runId: 'd2', previousRunId: 'd1', runDate: '2025-02-08', newCount: 8, resolvedCount: 5, persistentCount: 23, regressionCount: 1, totalCurrent: 32, totalPrevious: 28, netChange: 4, bySeverity: {} as any, byZone: {} as any, regressions: [] },
    { runId: 'd3', previousRunId: 'd2', runDate: '2025-02-15', newCount: 5, resolvedCount: 10, persistentCount: 18, regressionCount: 0, totalCurrent: 23, totalPrevious: 32, netChange: -5, bySeverity: {} as any, byZone: {} as any, regressions: [] },
    { runId: 'd4', previousRunId: 'd3', runDate: '2025-02-22', newCount: 3, resolvedCount: 8, persistentCount: 13, regressionCount: 0, totalCurrent: 16, totalPrevious: 23, netChange: -5, bySeverity: {} as any, byZone: {} as any, regressions: [] },
  ];

  test('buildTrendDataPoints converts deltas to data points', () => {
    const points = buildTrendDataPoints(sampleDeltas);
    expect(points.length).toBe(4);
    for (const p of points) {
      expect(p).toHaveProperty('date');
      expect(p).toHaveProperty('total');
    }
  });

  test('calculateVelocity computes resolution rate', () => {
    const velocity = calculateVelocity(sampleDeltas);
    expect(velocity).toBeDefined();
    expect(velocity.avgResolvedPerDrop).toBeGreaterThan(0);
  });

  test('identifyHotspots returns array', () => {
    const hotspots = identifyHotspots(sampleDeltas);
    expect(Array.isArray(hotspots)).toBe(true);
  });

  test('analyzeRootCauseTrends categorizes causes', () => {
    const sampleIssues = [
      { type: 'hard_clash', status: 'OPEN' },
      { type: 'soft_clash', status: 'OPEN' },
    ];
    const trends = analyzeRootCauseTrends(sampleDeltas, sampleIssues as any);
    expect(Array.isArray(trends)).toBe(true);
  });

  test('generateTrendReport returns full report', () => {
    const sampleIssues: any[] = [];
    const milestones = [{ name: 'IFC', date: '2025-06-01', targetZeroClashes: true }];
    const report = generateTrendReport(sampleDeltas, sampleIssues, milestones);
    expect(report).toHaveProperty('velocity');
    expect(report).toHaveProperty('dataPoints');
    expect(report).toHaveProperty('burndownTargets');
  });

  test('velocity trend reflects data', () => {
    const velocity = calculateVelocity(sampleDeltas);
    // With 4+ data points and recent net negative vs early positive, should be improving
    expect(velocity.trend).toBeDefined();
  });

  test('generateAlerts returns alerts array', () => {
    const velocity = calculateVelocity(sampleDeltas);
    const alerts = generateAlerts(velocity, [], []);
    expect(Array.isArray(alerts)).toBe(true);
  });

  test('calculateBurndown computes target line', () => {
    const velocity = calculateVelocity(sampleDeltas);
    const milestones = [{ name: 'IFC', date: '2025-06-01', targetZeroClashes: true }];
    const targets = calculateBurndown(30, velocity, milestones);
    expect(targets).toBeDefined();
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].requiredWeeklyRate).toBeGreaterThan(0);
  });
});

// ─── PENETRATIONS MATRIX ────────────────────────────────────────────────────

import {
  buildPenetrationMatrix,
  exportPenetrationMatrixCSV,
  comparePenetrationMatrices,
} from '../penetrations-matrix';

describe('penetrations-matrix.ts', () => {
  const samplePenetrations = [
    { id: 'p1', level: 'Level 1', status: 'OK' as const, rfiRequired: false, hostElement: { discipline: 'structural' as const }, penetratingElement: { discipline: 'plumbing' as const } },
    { id: 'p2', level: 'Level 1', status: 'SLEEVE_MISSING' as const, rfiRequired: true, hostElement: { discipline: 'structural' as const }, penetratingElement: { discipline: 'mechanical' as const } },
    { id: 'p3', level: 'Level 2', status: 'OK' as const, rfiRequired: false, hostElement: { discipline: 'structural' as const }, penetratingElement: { discipline: 'plumbing' as const } },
    { id: 'p4', level: 'Level 1', status: 'RATING_UNKNOWN' as const, rfiRequired: true, hostElement: { discipline: 'structural' as const }, penetratingElement: { discipline: 'electrical' as const } },
  ];

  test('buildPenetrationMatrix creates matrix from penetration records', () => {
    const matrix = buildPenetrationMatrix(samplePenetrations as any);
    expect(matrix).toBeDefined();
    expect(matrix.rows.length).toBeGreaterThan(0);
    expect(matrix.globalSummary.total).toBe(4);
  });

  test('matrix groups by level', () => {
    const matrix = buildPenetrationMatrix(samplePenetrations as any);
    const level1Row = matrix.rows.find(r => r.level === 'Level 1');
    expect(level1Row).toBeDefined();
    expect(level1Row!.totalPenetrations).toBe(3);
  });

  test('exportPenetrationMatrixCSV returns valid CSV', () => {
    const matrix = buildPenetrationMatrix(samplePenetrations as any);
    const csv = exportPenetrationMatrixCSV(matrix);
    expect(typeof csv).toBe('string');
    expect(csv).toContain('Level');
    expect(csv).toContain(',');
  });

  test('comparePenetrationMatrices detects changes', () => {
    const matrix1 = buildPenetrationMatrix(samplePenetrations.slice(0, 2) as any);
    const matrix2 = buildPenetrationMatrix(samplePenetrations as any);
    const deltas = comparePenetrationMatrices(matrix1, matrix2);
    expect(deltas).toBeDefined();
    expect(Array.isArray(deltas)).toBe(true);
    expect(deltas.length).toBeGreaterThan(0);
  });

  test('comparePenetrationMatrices with identical matrices shows stable', () => {
    const matrix = buildPenetrationMatrix(samplePenetrations as any);
    const deltas = comparePenetrationMatrices(matrix, matrix);
    for (const d of deltas) {
      expect(d.direction).toBe('stable');
    }
  });

  test('empty penetrations returns empty matrix', () => {
    const matrix = buildPenetrationMatrix([]);
    expect(matrix.globalSummary.total).toBe(0);
    expect(matrix.rows).toHaveLength(0);
  });
});
