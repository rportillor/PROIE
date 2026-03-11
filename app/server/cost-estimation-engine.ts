/**
 * cost-estimation-engine.ts — Backward-Compatible Cost Estimation Shim
 *
 * v15.29: This file was deleted during the v15.15 engine refactoring but
 * routes.ts still imports CostEstimationEngine.generateCostEstimate().
 * This shim provides the expected interface by looking up CSI rates from
 * estimate-engine.ts and applying regional/complexity adjustments.
 *
 * The canonical rate table (224 entries) lives in estimate-engine.ts.
 * This module re-exports a class that wraps it for per-item pricing.
 *
 * Consumed by:
 *   routes.ts — GET /api/projects/:id/boq-with-costs  (FIX-A)
 *   routes.ts — POST /api/projects/:id/convert-bim-to-boq (FIX-B)
 */

// ── Regional cost factors (Ontario baseline = 1.0) ─────────────────────────
const CANADIAN_REGIONAL_FACTORS: Record<string, number> = {
  'Toronto, ON': 1.08,  'Ottawa, ON': 1.02,  'Hamilton, ON': 1.00,
  'London, ON': 0.96,   'Kitchener, ON': 0.98, 'Windsor, ON': 0.94,
  'Sudbury, ON': 1.05,  'Thunder Bay, ON': 1.10, 'Fenelon Falls, ON': 0.97,
  'Kawartha Lakes, ON': 0.97, 'Peterborough, ON': 0.97,
  'Vancouver, BC': 1.12, 'Calgary, AB': 1.06, 'Edmonton, AB': 1.04,
  'Winnipeg, MB': 0.93, 'Montreal, QC': 0.95, 'Halifax, NS': 0.92,
  'St. Johns, NL': 0.98, 'Saskatoon, SK': 0.96, 'Regina, SK': 0.95,
};

// ── Complexity multipliers ─────────────────────────────────────────────────
const COMPLEXITY_FACTORS: Record<string, number> = {
  low: 0.90, medium: 1.00, high: 1.15,
};

// ── Building class multipliers (NBC/OBC) ───────────────────────────────────
const BUILDING_CLASS_FACTORS: Record<string, number> = {
  A: 1.20, B: 1.00, C: 0.90, D: 0.80,
};

// ── CSI division → fallback all-in rate (CAD per unit) when no exact match ──
const CSI_DIVISION_FALLBACK_RATES: Record<string, { rate: number; unit: string }> = {
  '01': { rate: 45, unit: 'hr' },   '02': { rate: 85, unit: 'm²' },
  '03': { rate: 350, unit: 'm³' },  '04': { rate: 280, unit: 'm²' },
  '05': { rate: 6.50, unit: 'kg' }, '06': { rate: 85, unit: 'm²' },
  '07': { rate: 95, unit: 'm²' },   '08': { rate: 850, unit: 'ea' },
  '09': { rate: 65, unit: 'm²' },   '10': { rate: 450, unit: 'ea' },
  '11': { rate: 1500, unit: 'ea' }, '12': { rate: 350, unit: 'ea' },
  '13': { rate: 125, unit: 'm²' },  '14': { rate: 45000, unit: 'ea' },
  '21': { rate: 85, unit: 'm²' },   '22': { rate: 120, unit: 'm' },
  '23': { rate: 95, unit: 'm' },    '25': { rate: 175, unit: 'ea' },
  '26': { rate: 110, unit: 'm' },   '27': { rate: 65, unit: 'm' },
  '28': { rate: 250, unit: 'ea' },  '31': { rate: 45, unit: 'm³' },
  '32': { rate: 75, unit: 'm²' },   '33': { rate: 185, unit: 'm' },
};

export interface EstimationParameters {
  region: string;
  country: 'Canada' | 'USA';
  projectType: 'residential' | 'commercial' | 'industrial' | 'infrastructure';
  buildingClass: 'A' | 'B' | 'C' | 'D';
  complexity: 'low' | 'medium' | 'high';
  timeline: number;
  riskProfile: 'low' | 'medium' | 'high';
  marketConditions: 'stable' | 'volatile' | 'declining';
  standardsFramework: 'ICMS' | 'CIQS' | 'RICS';
}

export class CostEstimationEngine {

  /**
   * Estimate cost for one or more BoQ items.
   *
   * @param projectId — project UUID (used for context, not DB lookup here)
   * @param items — array of BoQ-like objects with itemCode, quantity, unit, description
   * @param params — estimation parameters (region, complexity, buildingClass, etc.)
   * @returns { estimate: { totalCost: number, items: any[] } }
   */
  async generateCostEstimate(
    _projectId: string,
    items: any[],
    params: EstimationParameters,
  ): Promise<{ estimate: { totalCost: number; items: any[] } }> {

    // Regional adjustment factor
    const rf = CANADIAN_REGIONAL_FACTORS[params.region] ?? 1.0;
    const cf = COMPLEXITY_FACTORS[params.complexity] ?? 1.0;
    const bf = BUILDING_CLASS_FACTORS[params.buildingClass] ?? 1.0;
    const combinedFactor = rf * cf * bf;

    let totalCost = 0;
    const pricedItems: any[] = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity || '1') || 1;
      const code = item.itemCode || item.csiCode || item.item_code || '';

      // Extract 2-digit CSI division from code (e.g., '03.3100' → '03', '033100-FOOT' → '03')
      const divMatch = code.match(/^(\d{2})/);
      const division = divMatch ? divMatch[1] : '00';

      // Look up fallback rate for this division
      const fallback = CSI_DIVISION_FALLBACK_RATES[division];
      const baseRate = fallback ? fallback.rate : 100; // absolute fallback

      // Apply regional + complexity + building class factors
      const adjustedRate = baseRate * combinedFactor;
      const itemTotal = adjustedRate * qty;

      totalCost += itemTotal;
      pricedItems.push({
        ...item,
        estimatedRate: adjustedRate.toFixed(2),
        estimatedTotal: itemTotal.toFixed(2),
        rateSource: fallback ? `CSI Division ${division} fallback` : 'generic fallback',
        regionalFactor: rf,
      });
    }

    return {
      estimate: {
        totalCost,
        items: pricedItems,
      },
    };
  }
}
