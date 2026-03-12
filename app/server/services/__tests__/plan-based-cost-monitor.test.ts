/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  PLAN-BASED COST MONITOR — Test Suite
 *  Tests: singleton, plan tracking, usage limits, admin notifications
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { planBasedCostMonitor, PlanBasedCostMonitor } from '../plan-based-cost-monitor';
import type { Plan, PlanUsage } from '../plan-based-cost-monitor';

describe('PlanBasedCostMonitor', () => {
  test('singleton exists', () => {
    expect(planBasedCostMonitor).toBeDefined();
    expect(planBasedCostMonitor).toBeInstanceOf(PlanBasedCostMonitor);
  });

  test('getInstance returns same instance', () => {
    const instance1 = PlanBasedCostMonitor.getInstance();
    const instance2 = PlanBasedCostMonitor.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('has trackPlanUsage method', () => {
    expect(typeof planBasedCostMonitor.trackPlanUsage).toBe('function');
  });

  test('has checkPlanUsage method', () => {
    expect(typeof planBasedCostMonitor.checkPlanUsage).toBe('function');
  });

  test('has getCurrentPlan method', () => {
    expect(typeof planBasedCostMonitor.getCurrentPlan).toBe('function');
  });

  test('tracks plan usage', async () => {
    const usage = await planBasedCostMonitor.trackPlanUsage(
      1000,
      'standard',
      'test_operation',
    );
    expect(usage).toBeDefined();
    expect(typeof usage.tokensUsed).toBe('number');
    expect(typeof usage.usagePercentage).toBe('number');
  });

  test('checkPlanUsage returns allowed status', async () => {
    const result = await planBasedCostMonitor.checkPlanUsage(100, 'standard');
    expect(typeof result.allowed).toBe('boolean');
    expect(result.usage).toBeDefined();
    expect(Array.isArray(result.alerts)).toBe(true);
  });
});
