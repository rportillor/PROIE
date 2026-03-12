/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  ISSUE LOG — Test Suite (SOP Part 8)
 *  Tests: status transitions, naming, priority scoring, RFI generation,
 *  IssueLogManager CRUD
 * ══════════════════════════════════════════════════════════════════════════════
 */

import {
  isValidTransition,
  calculatePriority,
  priorityFromSeverity,
  generateIssueName,
  IssueLogManager,
  STATUS_TRANSITIONS,
} from '../issue-log';

import type { IssueStatus, IssuePriority, PriorityScores } from '../issue-log';

// ═══════════════════════════════════════════════════════════════════════════════
//  STATUS TRANSITIONS (9-state workflow)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Status Transitions', () => {
  test('OPEN can transition to IN_REVIEW', () => {
    expect(isValidTransition('OPEN', 'IN_REVIEW')).toBe(true);
  });

  test('OPEN cannot transition directly to RESOLVED', () => {
    expect(isValidTransition('OPEN', 'RESOLVED')).toBe(false);
  });

  test('IN_REVIEW can transition to IN_PROGRESS', () => {
    expect(isValidTransition('IN_REVIEW', 'IN_PROGRESS')).toBe(true);
  });

  test('RESOLVED cannot transition (terminal state)', () => {
    expect(isValidTransition('RESOLVED', 'OPEN')).toBe(false);
  });

  test('all statuses have defined transitions', () => {
    const statuses: IssueStatus[] = [
      'OPEN', 'IN_REVIEW', 'DECISION_REQUIRED', 'IN_PROGRESS',
      'READY_FOR_VERIFY', 'RESOLVED', 'DEFERRED', 'WONT_FIX', 'DUPLICATE',
    ];
    for (const s of statuses) {
      expect(STATUS_TRANSITIONS[s]).toBeDefined();
      expect(Array.isArray(STATUS_TRANSITIONS[s])).toBe(true);
    }
  });

  test('READY_FOR_VERIFY can transition to RESOLVED', () => {
    expect(isValidTransition('READY_FOR_VERIFY', 'RESOLVED')).toBe(true);
  });

  test('DEFERRED can transition back to OPEN', () => {
    expect(isValidTransition('DEFERRED', 'OPEN')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PRIORITY SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculatePriority', () => {
  test('high scores produce P1 priority', () => {
    const scores: PriorityScores = {
      lifeSafety: 5,
      scheduleImpact: 5,
      reworkCost: 5,
      downstreamImpact: 5,
    };
    expect(calculatePriority(scores)).toBe('P1');
  });

  test('low scores produce P4 or P5', () => {
    const scores: PriorityScores = {
      lifeSafety: 1,
      scheduleImpact: 1,
      reworkCost: 1,
      downstreamImpact: 1,
    };
    const result = calculatePriority(scores);
    expect(['P4', 'P5']).toContain(result);
  });

  test('lifeSafety-heavy scores elevate priority', () => {
    const scores: PriorityScores = {
      lifeSafety: 5,
      scheduleImpact: 1,
      reworkCost: 1,
      downstreamImpact: 1,
    };
    const result = calculatePriority(scores);
    expect(['P1', 'P2']).toContain(result);
  });
});

describe('priorityFromSeverity', () => {
  test('critical severity maps to P1', () => {
    expect(priorityFromSeverity('critical')).toBe('P1');
  });

  test('high severity maps to P2', () => {
    expect(priorityFromSeverity('high')).toBe('P2');
  });

  test('medium severity maps to P3', () => {
    expect(priorityFromSeverity('medium')).toBe('P3');
  });

  test('low severity maps to P4', () => {
    expect(priorityFromSeverity('low')).toBe('P4');
  });

  test('info severity maps to P5', () => {
    expect(priorityFromSeverity('info')).toBe('P5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NAMING CONVENTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateIssueName', () => {
  test('generates name with level, zone, systems, grid', () => {
    const name = generateIssueName('Level 2', 'East', 'MECH', 'STR', 'C4', 'DuctBeamClash');
    expect(name).toContain('MECH');
    expect(name).toContain('STR');
  });

  test('different disciplines produce different names', () => {
    const nameA = generateIssueName('Level 1', 'East', 'ARCH', 'STR', 'B2', 'WallConflict');
    const nameM = generateIssueName('Level 1', 'East', 'MECH', 'STR', 'B2', 'DuctConflict');
    expect(nameA).not.toBe(nameM);
  });

  test('name includes grid reference', () => {
    const name = generateIssueName('Level 1', '', 'MECH', 'STR', 'D5', 'Clash');
    expect(name).toContain('D5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ISSUE LOG MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

describe('IssueLogManager', () => {
  let manager: IssueLogManager;

  beforeEach(() => {
    manager = new IssueLogManager();
  });

  test('creates a manual issue', () => {
    const issue = manager.createManual({
      type: 'hard_clash',
      zone: 'Level 2_East',
      gridRef: 'C4',
      priority: 'P1',
      owner: 'Structural Lead',
      originDiscipline: 'structural',
      description: 'Beam penetrates duct',
      recommendation: 'Reroute duct below beam',
      elementIds: ['beam-001', 'duct-001'],
    });
    expect(issue).toBeDefined();
    expect(issue.status).toBe('OPEN');
    expect(issue.priority).toBe('P1');
  });

  test('assigns sequential issue numbers', () => {
    const i1 = manager.createManual({
      type: 'hard_clash', zone: 'L1', gridRef: 'A1', priority: 'P2',
      owner: 'Structural Lead', originDiscipline: 'structural',
      description: 'Issue 1', recommendation: 'Fix it',
    });
    const i2 = manager.createManual({
      type: 'soft_clash', zone: 'L1', gridRef: 'A2', priority: 'P3',
      owner: 'Mechanical Lead', originDiscipline: 'mechanical',
      description: 'Issue 2', recommendation: 'Fix it',
    });
    expect(i1.issueNumber).not.toBe(i2.issueNumber);
  });

  test('transitions issue status', () => {
    const issue = manager.createManual({
      type: 'hard_clash', zone: 'L1', gridRef: 'B3', priority: 'P2',
      owner: 'Electrical Lead', originDiscipline: 'electrical',
      description: 'Panel clearance violation', recommendation: 'Move panel',
    });

    const result = manager.updateStatus(issue.id, 'IN_REVIEW', 'system', 'Acknowledged');
    expect(result.success).toBe(true);

    const updated = manager.getById(issue.id);
    expect(updated?.status).toBe('IN_REVIEW');
  });

  test('rejects invalid status transition', () => {
    const issue = manager.createManual({
      type: 'soft_clash', zone: 'L1', gridRef: 'C2', priority: 'P3',
      owner: 'Plumbing Lead', originDiscipline: 'plumbing',
      description: 'Pipe clearance', recommendation: 'Reroute',
    });

    // OPEN -> RESOLVED is not valid (must go through IN_REVIEW -> IN_PROGRESS -> READY_FOR_VERIFY first)
    const result = manager.updateStatus(issue.id, 'RESOLVED', 'system', 'Skip ahead');
    expect(result.success).toBe(false);
  });

  test('generates RFI from issue', () => {
    const issue = manager.createManual({
      type: 'hard_clash', zone: 'L1', gridRef: 'A1', priority: 'P1',
      owner: 'Architectural Lead', originDiscipline: 'architectural',
      description: 'Wall conflicts with structural beam', recommendation: 'Move wall',
    });

    const rfi = manager.generateRFI(issue.id, 'Design team', 'BIM Coordinator');
    expect(rfi).not.toBeNull();
    if (rfi) {
      expect(rfi.rfiNumber).toContain('RFI');
      expect(rfi.toParty).toBe('Design team');
    }
  });

  test('retrieves all issues', () => {
    manager.createManual({ type: 'hard_clash', zone: 'L1', gridRef: 'A1', priority: 'P2', owner: 'A', originDiscipline: 'structural', description: 'A', recommendation: 'X' });
    manager.createManual({ type: 'soft_clash', zone: 'L1', gridRef: 'B2', priority: 'P4', owner: 'B', originDiscipline: 'mechanical', description: 'B', recommendation: 'Y' });
    manager.createManual({ type: 'hard_clash', zone: 'L2', gridRef: 'C3', priority: 'P3', owner: 'C', originDiscipline: 'electrical', description: 'C', recommendation: 'Z' });

    expect(manager.getAll()).toHaveLength(3);
  });

  test('filters by status', () => {
    const i1 = manager.createManual({ type: 'hard_clash', zone: 'L1', gridRef: 'A1', priority: 'P2', owner: 'A', originDiscipline: 'structural', description: 'A', recommendation: 'X' });
    manager.createManual({ type: 'soft_clash', zone: 'L1', gridRef: 'B2', priority: 'P4', owner: 'B', originDiscipline: 'mechanical', description: 'B', recommendation: 'Y' });

    manager.updateStatus(i1.id, 'IN_REVIEW', 'system', 'ack');

    const inReviewIssues = manager.filter({ status: 'IN_REVIEW' });
    expect(inReviewIssues).toHaveLength(1);
    expect(inReviewIssues[0].id).toBe(i1.id);
  });

  test('filters by discipline', () => {
    manager.createManual({ type: 'hard_clash', zone: 'L1', gridRef: 'A1', priority: 'P2', owner: 'A', originDiscipline: 'structural', description: 'A', recommendation: 'X' });
    manager.createManual({ type: 'soft_clash', zone: 'L1', gridRef: 'B2', priority: 'P3', owner: 'B', originDiscipline: 'structural', description: 'B', recommendation: 'Y' });
    manager.createManual({ type: 'hard_clash', zone: 'L2', gridRef: 'C3', priority: 'P4', owner: 'C', originDiscipline: 'mechanical', description: 'C', recommendation: 'Z' });

    const structIssues = manager.filter({ discipline: 'structural' });
    expect(structIssues).toHaveLength(2);
  });

  test('getSummary returns correct counts', () => {
    manager.createManual({ type: 'hard_clash', zone: 'L1', gridRef: 'A1', priority: 'P1', owner: 'A', originDiscipline: 'structural', description: 'A', recommendation: 'X' });
    manager.createManual({ type: 'soft_clash', zone: 'L1', gridRef: 'B2', priority: 'P4', owner: 'B', originDiscipline: 'mechanical', description: 'B', recommendation: 'Y' });

    const summary = manager.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.byStatus.OPEN).toBe(2);
  });
});
