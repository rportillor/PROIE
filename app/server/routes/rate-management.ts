/**
 * Rate Management Router — CRUD for DB-backed estimation rate tables
 *
 * Endpoints for managing unit rates, MEP rates, and regional factors.
 * Replaces the undocumented COST_RATES_JSON env var with a proper API.
 */

import { Router } from 'express';
import { storage } from '../storage';

export const rateManagementRouter = Router();

// ══════════════════════════════════════════════════════════════════════════════
// UNIT RATES (CSI MasterFormat)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/rates/unit — List all unit rates (filterable by division, region, source) */
rateManagementRouter.get('/unit', async (req, res) => {
  try {
    const { division, region, source } = req.query;
    const rates = await storage.getUnitRates({
      division: division as string,
      region: region as string,
      source: source as string,
    });
    res.json({ ok: true, count: rates.length, rates });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** GET /api/rates/unit/:csiCode — Get a single unit rate */
rateManagementRouter.get('/unit/:csiCode', async (req, res) => {
  try {
    const { csiCode } = req.params;
    const region = req.query.region as string | undefined;
    const rate = await storage.getUnitRate(csiCode, region);
    if (!rate) {
      return res.status(404).json({ ok: false, error: `No rate found for ${csiCode}` });
    }
    res.json({ ok: true, rate });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** PUT /api/rates/unit/:csiCode — Update or create a unit rate */
rateManagementRouter.put('/unit/:csiCode', async (req, res) => {
  try {
    const { csiCode } = req.params;
    const { description, unit, materialRate, laborRate, equipmentRate, crewSize, productivityRate, region } = req.body;

    if (!description || !unit) {
      return res.status(400).json({ ok: false, error: 'description and unit are required' });
    }

    const rate = await storage.upsertUnitRate({
      csiCode,
      description,
      unit,
      materialRate: String(materialRate ?? 0),
      laborRate: String(laborRate ?? 0),
      equipmentRate: String(equipmentRate ?? 0),
      crewSize: String(crewSize ?? 1),
      productivityRate: String(productivityRate ?? 1),
      source: 'user_override',
      region: region ?? null,
    });

    res.json({ ok: true, rate });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** POST /api/rates/unit/bulk — Bulk import unit rates */
rateManagementRouter.post('/unit/bulk', async (req, res) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({ ok: false, error: 'rates array is required' });
    }

    let imported = 0;
    for (const r of rates) {
      if (!r.csiCode || !r.description || !r.unit) continue;
      await storage.upsertUnitRate({
        csiCode: r.csiCode,
        description: r.description,
        unit: r.unit,
        materialRate: String(r.materialRate ?? 0),
        laborRate: String(r.laborRate ?? 0),
        equipmentRate: String(r.equipmentRate ?? 0),
        crewSize: String(r.crewSize ?? 1),
        productivityRate: String(r.productivityRate ?? 1),
        source: r.source ?? 'user_override',
        region: r.region ?? null,
      });
      imported++;
    }

    res.json({ ok: true, imported, total: rates.length });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MEP RATES
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/rates/mep — List MEP rates (filterable by division) */
rateManagementRouter.get('/mep', async (req, res) => {
  try {
    const { division } = req.query;
    const rates = await storage.getMepRates(division as string);
    res.json({ ok: true, count: rates.length, rates });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** PUT /api/rates/mep/:csiCode — Update or create a MEP rate */
rateManagementRouter.put('/mep/:csiCode', async (req, res) => {
  try {
    const { csiCode } = req.params;
    const { division, description, unit, materialRate, labourRate, unitRate, labourHoursPerUnit, tradeLocal, region } = req.body;

    if (!description || !unit || !division) {
      return res.status(400).json({ ok: false, error: 'division, description, and unit are required' });
    }

    const rate = await storage.upsertMepRate({
      csiCode,
      division,
      description,
      unit,
      materialRate: String(materialRate ?? 0),
      labourRate: String(labourRate ?? 0),
      unitRate: String(unitRate ?? 0),
      labourHoursPerUnit: String(labourHoursPerUnit ?? 1),
      tradeLocal: tradeLocal ?? null,
      source: 'user_override',
      region: region ?? null,
    });

    res.json({ ok: true, rate });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// REGIONAL FACTORS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/rates/regional — List all regional factors */
rateManagementRouter.get('/regional', async (req, res) => {
  try {
    const factors = await storage.getRegionalFactors();
    res.json({ ok: true, count: factors.length, factors });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** GET /api/rates/regional/:regionKey — Get a single regional factor */
rateManagementRouter.get('/regional/:regionKey', async (req, res) => {
  try {
    const regionKey = decodeURIComponent(req.params.regionKey);
    const factor = await storage.getRegionalFactor(regionKey);
    if (!factor) {
      return res.status(404).json({ ok: false, error: `No regional factor found for ${regionKey}` });
    }
    res.json({ ok: true, factor });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** PUT /api/rates/regional/:regionKey — Update or create a regional factor */
rateManagementRouter.put('/regional/:regionKey', async (req, res) => {
  try {
    const regionKey = decodeURIComponent(req.params.regionKey);
    const { regionLabel, province, compositeIndex, materialIndex, laborIndex, equipmentIndex, transportFactor, remoteFactor, hstGstRate, pstRate, taxDescription } = req.body;

    if (!regionLabel || !province) {
      return res.status(400).json({ ok: false, error: 'regionLabel and province are required' });
    }

    const factor = await storage.upsertRegionalFactor({
      regionKey,
      regionLabel,
      province,
      compositeIndex: String(compositeIndex ?? 1.0),
      materialIndex: String(materialIndex ?? 1.0),
      laborIndex: String(laborIndex ?? 1.0),
      equipmentIndex: String(equipmentIndex ?? 1.0),
      transportFactor: String(transportFactor ?? 1.0),
      remoteFactor: String(remoteFactor ?? 1.0),
      hstGstRate: String(hstGstRate ?? 0.13),
      pstRate: String(pstRate ?? 0),
      taxDescription: taxDescription ?? null,
    });

    res.json({ ok: true, factor });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT OH&P CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/rates/ohp/:projectId — Get OH&P configuration for a project */
rateManagementRouter.get('/ohp/:projectId', async (req, res) => {
  try {
    const config = await storage.getProjectOhpConfig(req.params.projectId);
    if (!config) {
      return res.json({ ok: true, configured: false, message: 'No OH&P configured — system fallback will be used' });
    }
    res.json({ ok: true, configured: true, config });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** PUT /api/rates/ohp/:projectId — Set OH&P configuration for a project */
rateManagementRouter.put('/ohp/:projectId', async (req, res) => {
  try {
    const { overheadPct, profitPct, contingencyPct, applyToSubcontractorCosts, applyToEquipmentCosts, projectNotes } = req.body;

    const config = await storage.upsertProjectOhpConfig({
      projectId: req.params.projectId,
      overheadPct: String(overheadPct ?? 0.15),
      overheadSource: 'PROJECT_CONFIGURED',
      overheadConfidence: 'HIGH',
      profitPct: String(profitPct ?? 0.10),
      profitSource: 'PROJECT_CONFIGURED',
      profitConfidence: 'HIGH',
      contingencyPct: String(contingencyPct ?? 0.05),
      contingencySource: 'PROJECT_CONFIGURED',
      contingencyConfidence: 'HIGH',
      applyToSubcontractorCosts: applyToSubcontractorCosts ?? true,
      applyToEquipmentCosts: applyToEquipmentCosts ?? true,
      projectNotes: projectNotes ?? null,
    });

    res.json({ ok: true, config });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
