import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Globe, MapPin, FileText, Pencil, Save, X, Trash2, Scissors, Plus } from "lucide-react";
import type { SelectedElement } from "./viewer-3d";
import { UNIT_SYSTEMS, formatLength, formatArea, formatVolume } from "./unit-utils";
import type { UnitSystem } from "./unit-utils";

interface ModelPropertiesProps {
  selectedElement: SelectedElement | null;
  unitSystem: UnitSystem;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
  showBothUnits: boolean;
  onShowBothUnitsChange: (showBoth: boolean) => void;
  country?: string;
  location?: string;
  buildingCode?: string;
  modelId?: string;
  onElementUpdated?: () => void;
  onElementDeleted?: () => void;
  onCreateElement?: (type: string) => void;
}

const layers = [
  { name: "Structural Elements", visible: true },
  { name: "Architectural", visible: true },
  { name: "MEP Systems", visible: false }
];

const ELEMENT_TYPES = [
  'WALL', 'COLUMN', 'BEAM', 'FOUNDATION', 'SLAB', 'FLOOR',
  'DOOR', 'WINDOW', 'PARTITION', 'CEILING', 'STAIRCASE',
  'DUCT', 'PIPE', 'LIGHT', 'RECEPTACLE', 'SPRINKLER',
];

const CATEGORIES = ['Structural', 'Architectural', 'MEP'];

const MATERIALS = [
  'Concrete', 'Steel', 'Wood', 'Glass', 'Aluminum', 'Brick', 'Gypsum',
  'Copper', 'PVC', 'CMU', 'Drywall', 'Granite', 'Marble', 'Vinyl',
];

export default function ModelProperties({
  selectedElement,
  unitSystem,
  onUnitSystemChange,
  showBothUnits,
  onShowBothUnitsChange,
  country,
  location,
  buildingCode,
  modelId,
  onElementUpdated,
  onElementDeleted,
  onCreateElement,
}: ModelPropertiesProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable form state
  const [editName, setEditName] = useState('');
  const [editMaterial, setEditMaterial] = useState('');
  const [editType, setEditType] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWidth, setEditWidth] = useState('');
  const [editLength, setEditLength] = useState('');

  const startEditing = useCallback(() => {
    if (!selectedElement) return;
    setEditName(selectedElement.name || '');
    setEditMaterial(selectedElement.material || '');
    setEditType(selectedElement.type || '');
    setEditCategory(selectedElement.category || '');
    setEditHeight(String(selectedElement.dimensions?.height || ''));
    setEditWidth(String(selectedElement.dimensions?.width || ''));
    setEditLength(String(selectedElement.dimensions?.length || ''));
    setEditing(true);
  }, [selectedElement]);

  const cancelEditing = () => setEditing(false);

  const saveChanges = useCallback(async () => {
    if (!selectedElement?.id || !modelId) return;
    setSaving(true);
    try {
      const { updateElement } = await import("@/lib/bim-api");
      const updates: Record<string, any> = {};

      if (editName !== (selectedElement.name || '')) updates.name = editName;
      if (editMaterial !== (selectedElement.material || '')) updates.material = editMaterial;
      if (editType !== (selectedElement.type || '')) updates.elementType = editType;
      if (editCategory !== (selectedElement.category || '')) updates.category = editCategory;

      // Geometry dimension updates
      const dimUpdates: Record<string, number> = {};
      const h = parseFloat(editHeight);
      const w = parseFloat(editWidth);
      const l = parseFloat(editLength);
      if (!isNaN(h) && h !== selectedElement.dimensions?.height) dimUpdates.height = h;
      if (!isNaN(w) && w !== selectedElement.dimensions?.width) dimUpdates.width = w;
      if (!isNaN(l) && l !== selectedElement.dimensions?.length) dimUpdates.length = l;

      if (Object.keys(dimUpdates).length > 0) {
        updates.geometry = { dimensions: dimUpdates };
      }

      if (Object.keys(updates).length === 0) {
        setEditing(false);
        return;
      }

      await updateElement(modelId, selectedElement.id, updates);
      setEditing(false);
      onElementUpdated?.();
    } catch (err) {
      console.error('Failed to save element:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedElement, modelId, editName, editMaterial, editType, editCategory, editHeight, editWidth, editLength, onElementUpdated]);

  const handleDelete = useCallback(async () => {
    if (!selectedElement?.id || !modelId) return;
    if (!confirm(`Delete ${selectedElement.type} "${selectedElement.name || 'element'}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const { deleteElement } = await import("@/lib/bim-api");
      await deleteElement(modelId, selectedElement.id);
      onElementDeleted?.();
    } catch (err) {
      console.error('Failed to delete element:', err);
    } finally {
      setDeleting(false);
    }
  }, [selectedElement, modelId, onElementDeleted]);

  const isManual = selectedElement?.properties?.source === 'manual' || selectedElement?.properties?.source === 'manual_split';

  return (
    <div className="w-full bg-white overflow-y-auto">
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Model Properties</h3>
        </div>

        {selectedElement ? (
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Selected Component</CardTitle>
                <div className="flex items-center gap-1">
                  {!editing ? (
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={startEditing} title="Edit properties">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={saveChanges} disabled={saving} title="Save">
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEditing} title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={handleDelete} disabled={deleting} title="Delete element">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {isManual && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Manual</span>
              )}
              {!isManual && selectedElement.properties?.source !== undefined && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Extracted</span>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {/* Name */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Name:</span>
                {editing ? (
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="w-40 h-7 text-sm" />
                ) : (
                  <span className="font-medium">{selectedElement.name || '—'}</span>
                )}
              </div>

              {/* Type */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Type:</span>
                {editing ? (
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger className="w-40 h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ELEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-medium" data-testid="component-type">{selectedElement.type}</span>
                )}
              </div>

              {/* Category */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Category:</span>
                {editing ? (
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger className="w-40 h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-medium">{selectedElement.category || '—'}</span>
                )}
              </div>

              {/* Material */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Material:</span>
                {editing ? (
                  <Select value={editMaterial} onValueChange={setEditMaterial}>
                    <SelectTrigger className="w-40 h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-medium" data-testid="component-material">{selectedElement.material || '—'}</span>
                )}
              </div>

              {/* Storey */}
              {selectedElement.storeyName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Floor:</span>
                  <span className="font-medium">{selectedElement.storeyName}</span>
                </div>
              )}

              {/* Dimensions */}
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 font-medium mb-1">Dimensions</div>

                {(selectedElement.dimensions?.height || editing) && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Height:</span>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <Input value={editHeight} onChange={e => setEditHeight(e.target.value)} className="w-20 h-7 text-sm text-right" type="number" step="0.01" />
                        <span className="text-xs text-gray-400">m</span>
                      </div>
                    ) : (
                      <span className="font-medium" data-testid="component-height">
                        {formatLength(selectedElement.dimensions!.height!, unitSystem, showBothUnits)}
                      </span>
                    )}
                  </div>
                )}

                {(selectedElement.dimensions?.width || editing) && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Width:</span>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <Input value={editWidth} onChange={e => setEditWidth(e.target.value)} className="w-20 h-7 text-sm text-right" type="number" step="0.01" />
                        <span className="text-xs text-gray-400">m</span>
                      </div>
                    ) : (
                      <span className="font-medium">
                        {formatLength(selectedElement.dimensions!.width!, unitSystem, showBothUnits)}
                      </span>
                    )}
                  </div>
                )}

                {(selectedElement.dimensions?.length || editing) && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Length:</span>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <Input value={editLength} onChange={e => setEditLength(e.target.value)} className="w-20 h-7 text-sm text-right" type="number" step="0.01" />
                        <span className="text-xs text-gray-400">m</span>
                      </div>
                    ) : (
                      <span className="font-medium">
                        {formatLength(selectedElement.dimensions!.length!, unitSystem, showBothUnits)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {selectedElement.volume && !editing && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Volume:</span>
                  <span className="font-medium" data-testid="component-volume">
                    {formatVolume(selectedElement.volume, unitSystem, showBothUnits)}
                  </span>
                </div>
              )}
              {selectedElement.area && !editing && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Area:</span>
                  <span className="font-medium">
                    {formatArea(selectedElement.area, unitSystem, showBothUnits)}
                  </span>
                </div>
              )}

              {/* Edit history indicator */}
              {selectedElement.properties?.editHistory?.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-400">
                    Edited {selectedElement.properties.editHistory.length} time(s) — last by {selectedElement.properties.lastEditedBy} at {new Date(selectedElement.properties.lastEditedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selected Component</CardTitle>
            </CardHeader>
            <CardContent className="py-8 text-center text-gray-500 text-sm">
              <p>No component selected</p>
              <p className="text-xs mt-1">Click on a 3D element to view and edit its properties</p>
            </CardContent>
          </Card>
        )}

        {/* ── Quick Add Element ─────────────────────────────────────────────── */}
        {modelId && onCreateElement && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Add Element
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {['Wall', 'Column', 'Beam', 'Door', 'Window', 'Slab', 'Pipe', 'Duct'].map(type => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 bg-white"
                    onClick={() => onCreateElement(type.toUpperCase())}
                  >
                    {type}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-blue-600">New element will be placed at grid center</p>
            </CardContent>
          </Card>
        )}

        {/* ── Unit System ───────────────────────────────────────────────────── */}
        <Card className="bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unit System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={unitSystem} onValueChange={(value: UnitSystem) => onUnitSystemChange(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNIT_SYSTEMS.METRIC}>Metric (m, m², m³)</SelectItem>
                <SelectItem value={UNIT_SYSTEMS.IMPERIAL}>Imperial (ft, ft², ft³)</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-both-units"
                checked={showBothUnits}
                onCheckedChange={onShowBothUnitsChange}
              />
              <label
                htmlFor="show-both-units"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show both units
              </label>
            </div>

            {/* Project Context Info */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-600 font-medium">Project Context:</div>
              {country && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Globe className="h-3 w-3" />
                  <span>Country: {country.toUpperCase()}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" />
                  <span>Location: {location}</span>
                </div>
              )}
              {buildingCode && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileText className="h-3 w-3" />
                  <span>Code: {buildingCode}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compliance Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-500">No compliance data available</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Layer Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {layers.map((layer, index) => (
              <div key={index} className="flex items-center space-x-2" data-testid={`layer-${index}`}>
                <Checkbox
                  id={`layer-${index}`}
                  defaultChecked={layer.visible}
                />
                <label
                  htmlFor={`layer-${index}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {layer.name}
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
