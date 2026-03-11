// client/src/components/rate-manager.tsx
// =============================================================================
// RATE MANAGER TAB — Unit Rates, MEP Rates, Regional Factors
// =============================================================================
//
// Sub-tab component for the QS Level 5 Dashboard.
// Fetches rate data from /api/rates/unit, /api/rates/mep, /api/rates/regional
// and provides inline editing with PUT-back capability.
//
// Pattern: @tanstack/react-query + shadcn/ui + lucide-react
// =============================================================================

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  Database, Search, Save, X, Pencil,
} from "lucide-react";

// ─── TYPES ──────────────────────────────────────────────────────────────────

type RateSubTab = "unit" | "mep" | "regional";

interface UnitRate {
  csiCode: string;
  description: string;
  unit: string;
  materialRate: number;
  laborRate: number;
  equipmentRate: number;
  crewSize: number;
  source: string;
}

interface MEPRate {
  csiCode: string;
  division: string;
  description: string;
  unit: string;
  materialRate: number;
  labourRate: number;
  unitRate: number;
  tradeLocal: string;
  source: string;
}

interface RegionalFactor {
  region: string;
  province: string;
  compositeIndex: number;
  materialIndex: number;
  laborIndex: number;
  equipmentIndex: number;
  taxRate: number;
  source: string;
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export function RateManagerTab({ projectId, modelId }: { projectId: string; modelId: string }) {
  const [subTab, setSubTab] = useState<RateSubTab>("unit");
  const [unitFilter, setUnitFilter] = useState("");
  const [mepFilter, setMepFilter] = useState("");
  const [regionalFilter, setRegionalFilter] = useState("");

  const { data: unitRates }     = useQuery<UnitRate[]>({     queryKey: ["/api/rates/unit"],     enabled: subTab === "unit" });
  const { data: mepRates }      = useQuery<MEPRate[]>({      queryKey: ["/api/rates/mep"],      enabled: subTab === "mep" });
  const { data: regionalData }  = useQuery<RegionalFactor[]>({ queryKey: ["/api/rates/regional"], enabled: subTab === "regional" });

  const unitCount     = unitRates?.length     ?? 0;
  const mepCount      = mepRates?.length      ?? 0;
  const regionalCount = regionalData?.length  ?? 0;

  const subTabs: { key: RateSubTab; label: string }[] = [
    { key: "unit",     label: "Unit Rates" },
    { key: "mep",      label: "MEP Rates" },
    { key: "regional", label: "Regional Factors" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center space-x-3">
        <Database className="w-5 h-5 text-gray-500" />
        <Badge variant="outline">{unitCount} unit rates</Badge>
        <Badge variant="outline">{mepCount} MEP rates</Badge>
        <Badge variant="outline">{regionalCount} regions</Badge>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex space-x-2">
        {subTabs.map(st => (
          <Button key={st.key} size="sm" variant={subTab === st.key ? "default" : "outline"} onClick={() => setSubTab(st.key)}>
            {st.label}
          </Button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "unit" && (
        <UnitRatesSection
          data={unitRates ?? []}
          filter={unitFilter}
          onFilterChange={setUnitFilter}
        />
      )}
      {subTab === "mep" && (
        <MEPRatesSection
          data={mepRates ?? []}
          filter={mepFilter}
          onFilterChange={setMepFilter}
        />
      )}
      {subTab === "regional" && (
        <RegionalFactorsSection
          data={regionalData ?? []}
          filter={regionalFilter}
          onFilterChange={setRegionalFilter}
        />
      )}
    </div>
  );
}

// ─── FILTER SEARCH BOX ─────────────────────────────────────────────────────

function FilterBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── SOURCE BADGE ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  if (source === "system_default") return null;
  return <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-800">User Override</Badge>;
}

// ─── UNIT RATES SECTION ─────────────────────────────────────────────────────

function UnitRatesSection({ data, filter, onFilterChange }: { data: UnitRate[]; filter: string; onFilterChange: (v: string) => void }) {
  const queryClient = useQueryClient();
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<UnitRate>>({});

  const filtered = useMemo(() => {
    if (!filter) return data;
    const q = filter.toLowerCase();
    return data.filter(r =>
      r.csiCode.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q)
    );
  }, [data, filter]);

  const saveMutation = useMutation({
    mutationFn: async (row: Partial<UnitRate> & { csiCode: string }) => {
      await apiRequest("PUT", `/api/rates/unit/${encodeURIComponent(row.csiCode)}`, row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rates/unit"] });
      setEditingCode(null);
      setEditRow({});
    },
  });

  const startEdit = (r: UnitRate) => {
    setEditingCode(r.csiCode);
    setEditRow({ ...r });
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setEditRow({});
  };

  const saveEdit = () => {
    if (!editingCode) return;
    saveMutation.mutate({ ...editRow, csiCode: editingCode } as UnitRate);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Unit Rates — CSI MasterFormat</CardTitle>
          <FilterBox value={filter} onChange={onFilterChange} placeholder="Search CSI code or description…" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-3">CSI Code</th>
                <th className="pb-2 pr-3">Description</th>
                <th className="pb-2 pr-3">Unit</th>
                <th className="pb-2 pr-3 text-right">Material Rate</th>
                <th className="pb-2 pr-3 text-right">Labor Rate</th>
                <th className="pb-2 pr-3 text-right">Equipment Rate</th>
                <th className="pb-2 pr-3 text-right">Crew Size</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isEditing = editingCode === r.csiCode;
                return (
                  <tr key={r.csiCode} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-mono font-bold">{r.csiCode}</td>
                    {isEditing ? (
                      <>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm" value={editRow.description ?? ""} onChange={e => setEditRow({ ...editRow, description: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-16" value={editRow.unit ?? ""} onChange={e => setEditRow({ ...editRow, unit: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24 text-right" type="number" value={editRow.materialRate ?? 0} onChange={e => setEditRow({ ...editRow, materialRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24 text-right" type="number" value={editRow.laborRate ?? 0} onChange={e => setEditRow({ ...editRow, laborRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24 text-right" type="number" value={editRow.equipmentRate ?? 0} onChange={e => setEditRow({ ...editRow, equipmentRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-16 text-right" type="number" value={editRow.crewSize ?? 0} onChange={e => setEditRow({ ...editRow, crewSize: parseInt(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{r.source}</td>
                        <td className="py-2 flex space-x-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit} disabled={saveMutation.isPending}>
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-3">{r.description}</td>
                        <td className="py-2 pr-3">{r.unit}</td>
                        <td className="py-2 pr-3 text-right font-mono">${r.materialRate.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">${r.laborRate.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">${r.equipmentRate.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.crewSize}</td>
                        <td className="py-2 pr-3 text-xs text-gray-500">
                          {r.source}
                          <SourceBadge source={r.source} />
                        </td>
                        <td className="py-2">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">No unit rates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MEP RATES SECTION ──────────────────────────────────────────────────────

function MEPRatesSection({ data, filter, onFilterChange }: { data: MEPRate[]; filter: string; onFilterChange: (v: string) => void }) {
  const queryClient = useQueryClient();
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<MEPRate>>({});

  const filtered = useMemo(() => {
    if (!filter) return data;
    const q = filter.toLowerCase();
    return data.filter(r =>
      r.csiCode.toLowerCase().includes(q) ||
      r.division.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  }, [data, filter]);

  const saveMutation = useMutation({
    mutationFn: async (row: Partial<MEPRate> & { csiCode: string }) => {
      await apiRequest("PUT", `/api/rates/mep/${encodeURIComponent(row.csiCode)}`, row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rates/mep"] });
      setEditingCode(null);
      setEditRow({});
    },
  });

  const startEdit = (r: MEPRate) => {
    setEditingCode(r.csiCode);
    setEditRow({ ...r });
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setEditRow({});
  };

  const saveEdit = () => {
    if (!editingCode) return;
    saveMutation.mutate({ ...editRow, csiCode: editingCode } as MEPRate);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">MEP Rates — Divisions 21–28</CardTitle>
          <FilterBox value={filter} onChange={onFilterChange} placeholder="Search CSI code, division, or description…" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-3">CSI Code</th>
                <th className="pb-2 pr-3">Division</th>
                <th className="pb-2 pr-3">Description</th>
                <th className="pb-2 pr-3">Unit</th>
                <th className="pb-2 pr-3 text-right">Material Rate</th>
                <th className="pb-2 pr-3 text-right">Labour Rate</th>
                <th className="pb-2 pr-3 text-right">Unit Rate</th>
                <th className="pb-2 pr-3">Trade Local</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isEditing = editingCode === r.csiCode;
                return (
                  <tr key={r.csiCode} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-mono font-bold">
                      {r.csiCode}
                      <SourceBadge source={r.source} />
                    </td>
                    {isEditing ? (
                      <>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-20" value={editRow.division ?? ""} onChange={e => setEditRow({ ...editRow, division: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm" value={editRow.description ?? ""} onChange={e => setEditRow({ ...editRow, description: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-16" value={editRow.unit ?? ""} onChange={e => setEditRow({ ...editRow, unit: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24 text-right" type="number" value={editRow.materialRate ?? 0} onChange={e => setEditRow({ ...editRow, materialRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24 text-right" type="number" value={editRow.labourRate ?? 0} onChange={e => setEditRow({ ...editRow, labourRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24 text-right" type="number" value={editRow.unitRate ?? 0} onChange={e => setEditRow({ ...editRow, unitRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24" value={editRow.tradeLocal ?? ""} onChange={e => setEditRow({ ...editRow, tradeLocal: e.target.value })} />
                        </td>
                        <td className="py-2 flex space-x-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit} disabled={saveMutation.isPending}>
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-3">{r.division}</td>
                        <td className="py-2 pr-3">{r.description}</td>
                        <td className="py-2 pr-3">{r.unit}</td>
                        <td className="py-2 pr-3 text-right font-mono">${r.materialRate.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">${r.labourRate.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">${r.unitRate.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.tradeLocal}</td>
                        <td className="py-2">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">No MEP rates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── REGIONAL FACTORS SECTION ───────────────────────────────────────────────

function RegionalFactorsSection({ data, filter, onFilterChange }: { data: RegionalFactor[]; filter: string; onFilterChange: (v: string) => void }) {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<RegionalFactor>>({});

  const regionKey = (r: RegionalFactor) => `${r.region}__${r.province}`;

  const filtered = useMemo(() => {
    if (!filter) return data;
    const q = filter.toLowerCase();
    return data.filter(r =>
      r.region.toLowerCase().includes(q) ||
      r.province.toLowerCase().includes(q)
    );
  }, [data, filter]);

  const saveMutation = useMutation({
    mutationFn: async (row: Partial<RegionalFactor> & { region: string; province: string }) => {
      const key = `${row.region}__${row.province}`;
      await apiRequest("PUT", `/api/rates/regional/${encodeURIComponent(key)}`, row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rates/regional"] });
      setEditingKey(null);
      setEditRow({});
    },
  });

  const startEdit = (r: RegionalFactor) => {
    setEditingKey(regionKey(r));
    setEditRow({ ...r });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditRow({});
  };

  const saveEdit = () => {
    if (!editingKey) return;
    saveMutation.mutate(editRow as RegionalFactor);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Regional Cost Factors — Canada</CardTitle>
          <FilterBox value={filter} onChange={onFilterChange} placeholder="Search region or province…" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-3">Region</th>
                <th className="pb-2 pr-3">Province</th>
                <th className="pb-2 pr-3 text-right">Composite Index</th>
                <th className="pb-2 pr-3 text-right">Material Index</th>
                <th className="pb-2 pr-3 text-right">Labor Index</th>
                <th className="pb-2 pr-3 text-right">Equipment Index</th>
                <th className="pb-2 pr-3 text-right">Tax Rate</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const rk = regionKey(r);
                const isEditing = editingKey === rk;
                return (
                  <tr key={rk} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium">
                      {r.region}
                      <SourceBadge source={r.source} />
                    </td>
                    {isEditing ? (
                      <>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-24" value={editRow.province ?? ""} onChange={e => setEditRow({ ...editRow, province: e.target.value })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-20 text-right" type="number" step="0.01" value={editRow.compositeIndex ?? 0} onChange={e => setEditRow({ ...editRow, compositeIndex: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-20 text-right" type="number" step="0.01" value={editRow.materialIndex ?? 0} onChange={e => setEditRow({ ...editRow, materialIndex: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-20 text-right" type="number" step="0.01" value={editRow.laborIndex ?? 0} onChange={e => setEditRow({ ...editRow, laborIndex: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-20 text-right" type="number" step="0.01" value={editRow.equipmentIndex ?? 0} onChange={e => setEditRow({ ...editRow, equipmentIndex: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 pr-3">
                          <Input className="h-7 text-sm w-20 text-right" type="number" step="0.01" value={editRow.taxRate ?? 0} onChange={e => setEditRow({ ...editRow, taxRate: parseFloat(e.target.value) })} />
                        </td>
                        <td className="py-2 flex space-x-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit} disabled={saveMutation.isPending}>
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-3">{r.province}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.compositeIndex.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.materialIndex.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.laborIndex.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.equipmentIndex.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{(r.taxRate * 100).toFixed(1)}%</td>
                        <td className="py-2">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400">No regional factors found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
