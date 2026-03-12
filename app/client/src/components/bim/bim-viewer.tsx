import { useState, useCallback } from "react";
import Viewer3D, { type SelectedElement } from "./viewer-3d";
import ModelProperties from "./model-properties";
import { getUnitSystemFromProject } from "./unit-utils";
import type { UnitSystem } from "./unit-utils";

interface BimViewerProps {
  projectId?: string;
  modelId?: string;
  country?: string;
  location?: string;
  buildingCode?: string;
}

export default function BimViewer({
  projectId,
  modelId,
  country,
  location,
  buildingCode
}: BimViewerProps) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [showBothUnits, setShowBothUnits] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    return getUnitSystemFromProject(country, location, buildingCode);
  });

  // Force viewer to re-fetch elements after CRUD operations
  const refreshViewer = useCallback(() => {
    setRefreshKey(k => k + 1);
    setSelectedElement(null);
  }, []);

  // Handle element creation from the property panel "Add Element" buttons
  const handleCreateElement = useCallback(async (elementType: string) => {
    if (!modelId) return;
    try {
      const { createElement } = await import("@/lib/bim-api");

      // Default dimensions by type (metres)
      const defaults: Record<string, { width: number; height: number; depth: number }> = {
        WALL:       { width: 6,    height: 3,   depth: 0.2 },
        COLUMN:     { width: 0.4,  height: 3,   depth: 0.4 },
        BEAM:       { width: 0.3,  height: 0.5, depth: 6 },
        DOOR:       { width: 0.9,  height: 2.1, depth: 0.05 },
        WINDOW:     { width: 1.2,  height: 1.5, depth: 0.02 },
        SLAB:       { width: 10,   height: 0.2, depth: 10 },
        FOUNDATION: { width: 2,    height: 0.6, depth: 2 },
        PIPE:       { width: 0.1,  height: 3,   depth: 0.1 },
        DUCT:       { width: 0.6,  height: 0.4, depth: 3 },
        PARTITION:  { width: 4,    height: 2.7, depth: 0.1 },
        CEILING:    { width: 6,    height: 0.02, depth: 6 },
        STAIRCASE:  { width: 1.2,  height: 3,   depth: 3 },
        LIGHT:      { width: 0.3,  height: 0.3, depth: 0.3 },
        RECEPTACLE: { width: 0.1,  height: 0.1, depth: 0.05 },
        SPRINKLER:  { width: 0.15, height: 0.15, depth: 0.15 },
      };

      const dims = defaults[elementType] || { width: 1, height: 1, depth: 1 };

      await createElement(modelId, {
        elementType,
        name: `New ${elementType.charAt(0) + elementType.slice(1).toLowerCase()}`,
        geometry: {
          dimensions: { width: dims.width, height: dims.height, length: dims.depth },
          location: { realLocation: { x: 0, y: 0, z: 0 } },
        },
        category: elementType.match(/wall|door|window|partition|ceiling|stair/i)
          ? 'Architectural'
          : elementType.match(/column|beam|foundation|slab/i)
            ? 'Structural'
            : 'MEP',
      });

      refreshViewer();
    } catch (err) {
      console.error('Failed to create element:', err);
    }
  }, [modelId, refreshViewer]);

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Main 3D Viewer - Responsive for all devices */}
      <div className="flex-1 min-w-0 h-full">
        <Viewer3D
          key={refreshKey}
          modelId={modelId}
          onElementSelect={setSelectedElement}
          unitSystem={unitSystem}
        />
      </div>

      {/* Properties Panel - Responsive: Bottom on mobile/tablet portrait, Right on tablet landscape/desktop */}
      <div className="w-full md:w-80 lg:w-96 md:flex-shrink-0 h-64 md:h-full bg-white border-t md:border-t-0 md:border-l border-gray-200">
        <ModelProperties
          selectedElement={selectedElement}
          unitSystem={unitSystem}
          onUnitSystemChange={setUnitSystem}
          showBothUnits={showBothUnits}
          onShowBothUnitsChange={setShowBothUnits}
          country={country}
          location={location}
          buildingCode={buildingCode}
          modelId={modelId}
          onElementUpdated={refreshViewer}
          onElementDeleted={refreshViewer}
          onCreateElement={handleCreateElement}
        />
      </div>
    </div>
  );
}
