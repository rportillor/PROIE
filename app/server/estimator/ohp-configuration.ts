/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  OH&P CONFIGURATION — Overhead & Profit Rate Management
 *  Stream A — Estimation Completion (Item A2.7)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Replaces hardcoded overhead (15%) and profit (10%) fallbacks with a
 *  configurable, project-level settings module.
 *
 *  QS Principle: No silent default values. If OH&P rates are not explicitly
 *  configured for a project, the system flags it and uses the regional
 *  defaults with a LOW_CONFIDENCE warning. The user should confirm rates
 *  before finalizing any estimate.
 *
 *  Hardcoded fallbacks replaced:
 *    cost-estimation-engine.ts L682: overheadFactor - 1.0 || 0.15
 *    cost-estimation-engine.ts L683: profitMargin || 0.10
 *    estimates.ts L30: overheadProfit ?? 0.15
 *
 *  Consumed by:
 *    - cost-estimation-engine.ts (CostEstimationEngine.calculateCost)
 *    - estimates.ts (POST /estimates/:modelId/run)
 *    - estimate-engine.ts (buildEstimateForElements)
 *
 *  @module ohp-configuration
 *  @version 1.0.0
 */


// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** OH&P rate source — tracks where the rate came from for audit trail */
export type OHPRateSource =
  | 'PROJECT_CONFIGURED'     // Explicitly set by user for this project
  | 'REGIONAL_DEFAULT'       // From canadian-cost-data.ts or cost-estimation-engine.ts regions
  | 'SYSTEM_FALLBACK';       // Last resort — flagged as LOW_CONFIDENCE

/** Individual rate with source tracking */
export interface OHPRate {
  value: number;             // Decimal (e.g., 0.15 = 15%)
  source: OHPRateSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  note?: string;             // Human-readable note (e.g., "User confirmed 2026-03-01")
}

/** Complete OH&P configuration for a project */
export interface OHPConfiguration {
  /** General contractor overhead (decimal, e.g., 0.15 = 15%) */
  overhead: OHPRate;
  /** General contractor profit (decimal, e.g., 0.10 = 10%) */
  profit: OHPRate;
  /** Contingency rate (decimal, e.g., 0.05 = 5%) — also configurable */
  contingency?: OHPRate;
  /** Whether OH&P applies to subcontractor costs (common in CM/GC) */
  applyToSubcontractorCosts: boolean;
  /** Whether OH&P applies to equipment costs */
  applyToEquipmentCosts: boolean;
  /** Project-specific notes */
  projectNotes?: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Who set these rates */
  updatedBy?: string;
}

/** Resolved OH&P values ready for calculation — the consumer-facing output */
export interface ResolvedOHP {
  overheadRate: number;       // Decimal (e.g., 0.15)
  profitRate: number;         // Decimal (e.g., 0.10)
  contingencyRate: number;    // Decimal (e.g., 0.05)
  combinedMarkup: number;     // overhead + profit (e.g., 0.25)
  overheadFactor: number;     // 1 + overhead (e.g., 1.15) — for cost-estimation-engine compatibility
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
  applyToSubs: boolean;
  applyToEquip: boolean;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECT CONFIGURATION STORE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory store for project OH&P configurations.
 * In production, this would be backed by the database (Drizzle ORM).
 * Key = projectId or modelId.
 */
const projectConfigs = new Map<string, OHPConfiguration>();

/** Set OH&P configuration for a project */
export function setProjectOHP(
  projectId: string,
  config: Partial<OHPConfiguration>,
): OHPConfiguration {
  const existing = projectConfigs.get(projectId);

  const merged: OHPConfiguration = {
    overhead: config.overhead ?? existing?.overhead ?? {
      value: 0,
      source: 'SYSTEM_FALLBACK',
      confidence: 'LOW',
      note: 'Not configured — requires user input',
    },
    profit: config.profit ?? existing?.profit ?? {
      value: 0,
      source: 'SYSTEM_FALLBACK',
      confidence: 'LOW',
      note: 'Not configured — requires user input',
    },
    contingency: config.contingency ?? existing?.contingency,
    applyToSubcontractorCosts: config.applyToSubcontractorCosts ?? existing?.applyToSubcontractorCosts ?? true,
    applyToEquipmentCosts: config.applyToEquipmentCosts ?? existing?.applyToEquipmentCosts ?? true,
    projectNotes: config.projectNotes ?? existing?.projectNotes,
    updatedAt: new Date().toISOString(),
    updatedBy: config.updatedBy,
  };

  projectConfigs.set(projectId, merged);
  return merged;
}

/** Get OH&P configuration for a project (if set) */
export function getProjectOHP(projectId: string): OHPConfiguration | undefined {
  return projectConfigs.get(projectId);
}

/** Delete OH&P configuration for a project */
export function clearProjectOHP(projectId: string): boolean {
  return projectConfigs.delete(projectId);
}

/** List all configured projects */
export function listConfiguredProjects(): string[] {
  return [...projectConfigs.keys()];
}


// ═══════════════════════════════════════════════════════════════════════════════
//  RATE RESOLUTION — THE MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve OH&P rates for a project.
 *
 * Priority order (per QS principle — explicit over implicit):
 *   1. Project-level configuration (if set by user)
 *   2. Regional defaults (from cost factor data)
 *   3. System fallback (with LOW_CONFIDENCE warning)
 *
 * @param projectId   Project or model ID
 * @param regionalOverheadFactor  Regional overhead factor (e.g., 1.15 from CANADIAN_REGIONS)
 * @param regionalProfitMargin    Regional profit margin (e.g., 0.10)
 * @param regionalContingency     Regional contingency rate (e.g., 0.05)
 * @returns Resolved OH&P rates with confidence and warnings
 */
export function resolveOHP(
  projectId: string,
  regionalOverheadFactor?: number,
  regionalProfitMargin?: number,
  regionalContingency?: number,
): ResolvedOHP {
  const config = projectConfigs.get(projectId);
  const warnings: string[] = [];

  // ─── Resolve overhead ─────────────────────────────────────────────────

  let overheadRate: number;
  let overheadSource: OHPRateSource;

  if (config?.overhead && config.overhead.source === 'PROJECT_CONFIGURED') {
    overheadRate = config.overhead.value;
    overheadSource = 'PROJECT_CONFIGURED';
  } else if (regionalOverheadFactor !== undefined && regionalOverheadFactor > 0) {
    // Convert factor to rate (1.15 → 0.15)
    overheadRate = regionalOverheadFactor > 1
      ? regionalOverheadFactor - 1.0
      : regionalOverheadFactor;
    overheadSource = 'REGIONAL_DEFAULT';
    warnings.push(`Overhead rate ${(overheadRate * 100).toFixed(1)}% from regional default — not project-confirmed.`);
  } else {
    overheadRate = SYSTEM_FALLBACK_OVERHEAD;
    overheadSource = 'SYSTEM_FALLBACK';
    warnings.push(`OH&P WARNING: Overhead rate using system fallback of ${(SYSTEM_FALLBACK_OVERHEAD * 100).toFixed(0)}%. Configure project OH&P to remove this warning.`);
  }

  // ─── Resolve profit ───────────────────────────────────────────────────

  let profitRate: number;
  let profitSource: OHPRateSource;

  if (config?.profit && config.profit.source === 'PROJECT_CONFIGURED') {
    profitRate = config.profit.value;
    profitSource = 'PROJECT_CONFIGURED';
  } else if (regionalProfitMargin !== undefined && regionalProfitMargin > 0) {
    profitRate = regionalProfitMargin;
    profitSource = 'REGIONAL_DEFAULT';
    warnings.push(`Profit rate ${(regionalProfitMargin * 100).toFixed(1)}% from regional default — not project-confirmed.`);
  } else {
    profitRate = SYSTEM_FALLBACK_PROFIT;
    profitSource = 'SYSTEM_FALLBACK';
    warnings.push(`OH&P WARNING: Profit rate using system fallback of ${(SYSTEM_FALLBACK_PROFIT * 100).toFixed(0)}%. Configure project OH&P to remove this warning.`);
  }

  // ─── Resolve contingency ──────────────────────────────────────────────

  let contingencyRate: number;
  if (config?.contingency && config.contingency.source === 'PROJECT_CONFIGURED') {
    contingencyRate = config.contingency.value;
  } else if (regionalContingency !== undefined && regionalContingency > 0) {
    contingencyRate = regionalContingency;
  } else {
    contingencyRate = SYSTEM_FALLBACK_CONTINGENCY;
  }

  // ─── Determine confidence ─────────────────────────────────────────────

  const sources = [overheadSource, profitSource];
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (sources.every(s => s === 'PROJECT_CONFIGURED')) {
    confidence = 'HIGH';
  } else if (sources.some(s => s === 'SYSTEM_FALLBACK')) {
    confidence = 'LOW';
  } else {
    confidence = 'MEDIUM';
  }

  return {
    overheadRate,
    profitRate,
    contingencyRate,
    combinedMarkup: overheadRate + profitRate,
    overheadFactor: 1 + overheadRate,   // Backward compatible with cost-estimation-engine
    confidence,
    warnings,
    applyToSubs: config?.applyToSubcontractorCosts ?? true,
    applyToEquip: config?.applyToEquipmentCosts ?? true,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
//  SYSTEM FALLBACK VALUES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * These replace the previously hardcoded values.
 * They are LAST RESORT only — always flagged as LOW_CONFIDENCE.
 * The values match the old hardcoded defaults to avoid breaking existing estimates.
 */
const SYSTEM_FALLBACK_OVERHEAD = 0.15;     // Was: cost-estimation-engine.ts L682
const SYSTEM_FALLBACK_PROFIT = 0.10;       // Was: cost-estimation-engine.ts L683
const SYSTEM_FALLBACK_CONTINGENCY = 0.05;  // Was: cost-estimation-engine.ts L684


// ═══════════════════════════════════════════════════════════════════════════════
//  CONVENIENCE FUNCTIONS FOR CONSUMER MODULES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Drop-in replacement for `estimates.ts` line 30.
 *
 * BEFORE: overheadProfit: Number(overheadProfit ?? 0.15)
 * AFTER:  overheadProfit: getOverheadProfitCombined(modelId, overheadProfit, regionalFactor)
 */
export function getOverheadProfitCombined(
  projectId: string,
  userProvided?: number,
  regionalOverheadFactor?: number,
  regionalProfitMargin?: number,
): number {
  // If user explicitly provided a value in the API call, use it
  if (userProvided !== undefined && userProvided !== null) {
    return Number(userProvided);
  }

  const resolved = resolveOHP(projectId, regionalOverheadFactor, regionalProfitMargin);
  return resolved.combinedMarkup;
}

/**
 * Drop-in replacement for cost-estimation-engine.ts lines 682-683.
 *
 * BEFORE:
 *   const overheadCost = subtotal * (costFactor.overheadFactor - 1.0 || 0.15);
 *   const profitAmount = subtotal * (costFactor.profitMargin || 0.10);
 *
 * AFTER:
 *   const ohp = getOverheadAndProfit(projectId, costFactor.overheadFactor, costFactor.profitMargin);
 *   const overheadCost = subtotal * ohp.overheadRate;
 *   const profitAmount = subtotal * ohp.profitRate;
 */
export function getOverheadAndProfit(
  projectId: string,
  regionalOverheadFactor?: number,
  regionalProfitMargin?: number,
): { overheadRate: number; profitRate: number; warnings: string[] } {
  const resolved = resolveOHP(projectId, regionalOverheadFactor, regionalProfitMargin);
  return {
    overheadRate: resolved.overheadRate,
    profitRate: resolved.profitRate,
    warnings: resolved.warnings,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/** Validate OH&P rates are within reasonable bounds */
export function validateOHPRates(
  overhead: number,
  profit: number,
  contingency?: number,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (overhead < 0 || overhead > 0.50) {
    warnings.push(`Overhead rate ${(overhead * 100).toFixed(1)}% is outside typical range (0-50%).`);
  }
  if (profit < 0 || profit > 0.30) {
    warnings.push(`Profit rate ${(profit * 100).toFixed(1)}% is outside typical range (0-30%).`);
  }
  if (overhead + profit > 0.50) {
    warnings.push(`Combined OH&P of ${((overhead + profit) * 100).toFixed(1)}% is unusually high.`);
  }
  if (contingency !== undefined && (contingency < 0 || contingency > 0.25)) {
    warnings.push(`Contingency rate ${(contingency * 100).toFixed(1)}% is outside typical range (0-25%).`);
  }

  return { valid: warnings.length === 0, warnings };
}
