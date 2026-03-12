/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  CLAUDE COST MONITOR — Test Suite
 *  Tests: singleton, cost tracking, budget alerts
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { claudeCostMonitor, ClaudeCostMonitor } from '../claude-cost-monitor';

describe('ClaudeCostMonitor', () => {
  test('singleton exists', () => {
    expect(claudeCostMonitor).toBeDefined();
    expect(claudeCostMonitor).toBeInstanceOf(ClaudeCostMonitor);
  });

  test('getInstance returns same instance', () => {
    const a = ClaudeCostMonitor.getInstance();
    const b = ClaudeCostMonitor.getInstance();
    expect(a).toBe(b);
  });

  test('has trackApiCall method', () => {
    expect(typeof claudeCostMonitor.trackApiCall).toBe('function');
  });

  test('has getTodaysUsage method', () => {
    expect(typeof claudeCostMonitor.getTodaysUsage).toBe('function');
  });

  test('has checkBudgetBeforeCall method', () => {
    expect(typeof claudeCostMonitor.checkBudgetBeforeCall).toBe('function');
  });

  test('tracks API call cost', async () => {
    const result = await claudeCostMonitor.trackApiCall(
      'claude-sonnet-4-20250514',
      2000,
      1000,
      undefined,
      'test_operation',
    );
    expect(result.cost).toBeGreaterThanOrEqual(0);
    expect(result.dailyTotal).toBeGreaterThanOrEqual(0);
  });

  test('checkBudgetBeforeCall returns allowed initially', async () => {
    const monitor = new ClaudeCostMonitor();
    const result = await monitor.checkBudgetBeforeCall(100);
    expect(result.allowed).toBe(true);
    expect(result.remainingBudget).toBeGreaterThan(0);
  });

  test('getTodaysUsage returns usage data', async () => {
    const usage = await claudeCostMonitor.getTodaysUsage();
    expect(usage).toBeDefined();
    expect(typeof usage.totalCost).toBe('number');
    expect(typeof usage.apiCalls).toBe('number');
  });
});
