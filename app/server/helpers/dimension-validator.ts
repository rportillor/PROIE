// server/helpers/dimension-validator.ts
// ──────────────────────────────────────────────────────────────────────────────
// Validates element dimensions against realistic construction ranges.
// Returns clamped dimensions and flags out-of-range values for RFI.
// All values in METRES.
// ──────────────────────────────────────────────────────────────────────────────

export interface DimensionRange {
  min: number;
  max: number;
  typical: number;
}

export interface ElementDimensionRanges {
  width: DimensionRange;
  height: DimensionRange;
  thickness?: DimensionRange;
}

// Realistic dimension ranges by element type (metres)
const DIMENSION_RANGES: Record<string, ElementDimensionRanges> = {
  WALL: {
    width:     { min: 0.5,   max: 50,   typical: 6 },     // wall length
    height:    { min: 2.0,   max: 8,    typical: 3 },      // floor-to-ceiling
    thickness: { min: 0.075, max: 0.6,  typical: 0.2 },    // wall thickness
  },
  COLUMN: {
    width:  { min: 0.15, max: 1.2, typical: 0.4 },
    height: { min: 2.0,  max: 8,   typical: 3 },
  },
  BEAM: {
    width:  { min: 0.15, max: 0.6,  typical: 0.3 },       // beam width
    height: { min: 0.2,  max: 1.2,  typical: 0.5 },       // beam depth
  },
  DOOR: {
    width:  { min: 0.6,  max: 3.0,  typical: 0.9 },
    height: { min: 1.8,  max: 3.5,  typical: 2.1 },
  },
  WINDOW: {
    width:  { min: 0.3,  max: 6.0,  typical: 1.2 },
    height: { min: 0.3,  max: 4.0,  typical: 1.5 },
  },
  SLAB: {
    width:  { min: 1,    max: 100,  typical: 10 },
    height: { min: 0.1,  max: 0.5,  typical: 0.2 },       // slab thickness
  },
  FOUNDATION: {
    width:  { min: 0.5,  max: 20,   typical: 2 },
    height: { min: 0.2,  max: 2.0,  typical: 0.6 },       // foundation depth
  },
  STAIRCASE: {
    width:  { min: 0.8,  max: 3.0,  typical: 1.2 },
    height: { min: 2.0,  max: 6.0,  typical: 3 },
  },
  DUCT: {
    width:  { min: 0.1,  max: 2.0,  typical: 0.6 },
    height: { min: 0.1,  max: 1.5,  typical: 0.4 },
  },
  PIPE: {
    width:  { min: 0.01, max: 0.6,  typical: 0.1 },
    height: { min: 0.01, max: 0.6,  typical: 0.1 },
  },
};

export interface ValidationResult {
  valid: boolean;
  clamped: { width: number; height: number; depth?: number };
  warnings: string[];
}

/**
 * Validate element dimensions against realistic construction ranges.
 * Returns clamped values and warnings for anything out-of-range.
 */
export function validateDimensions(
  elementType: string,
  dims: { width?: number; height?: number; depth?: number; length?: number; thickness?: number },
): ValidationResult {
  const type = elementType.toUpperCase();
  const ranges = DIMENSION_RANGES[type];
  const warnings: string[] = [];

  if (!ranges) {
    // No validation rules for this type — pass through
    return {
      valid: true,
      clamped: {
        width: dims.width || dims.length || 1,
        height: dims.height || 1,
        depth: dims.depth || dims.thickness || 0.2,
      },
      warnings: [],
    };
  }

  const clamp = (value: number | undefined, range: DimensionRange, label: string): number => {
    if (value == null || !isFinite(value) || value <= 0) {
      warnings.push(`${type} ${label}: missing or invalid (${value}) — using typical ${range.typical}m`);
      return range.typical;
    }
    if (value < range.min) {
      warnings.push(`${type} ${label}: ${value.toFixed(3)}m below minimum ${range.min}m — clamped`);
      return range.min;
    }
    if (value > range.max) {
      warnings.push(`${type} ${label}: ${value.toFixed(3)}m exceeds maximum ${range.max}m — clamped`);
      return range.max;
    }
    return value;
  };

  const width = clamp(dims.width || dims.length, ranges.width, 'width/length');
  const height = clamp(dims.height, ranges.height, 'height');
  const depth = ranges.thickness
    ? clamp(dims.depth || dims.thickness, ranges.thickness, 'thickness/depth')
    : (dims.depth || dims.thickness || 0.2);

  return {
    valid: warnings.length === 0,
    clamped: { width, height, depth },
    warnings,
  };
}

/**
 * Get the construction sequence priority for an element type.
 * Lower number = earlier in construction.
 */
export function getConstructionSequencePriority(elementType: string): number {
  const priorities: Record<string, number> = {
    FOUNDATION: 1,
    COLUMN: 2,
    BEAM: 3,
    WALL: 4,
    PARTITION: 4,
    SLAB: 5,
    FLOOR: 5,
    FLOOR_PLACEHOLDER: 5,
    STAIRCASE: 6,
    DOOR: 7,
    WINDOW: 7,
    CEILING: 8,
    DUCT: 9,
    PIPE: 9,
    LIGHT: 9,
    RECEPTACLE: 9,
    SPRINKLER: 9,
    VAV: 9,
    AHU: 9,
  };
  return priorities[elementType.toUpperCase()] || 10;
}

/**
 * Sort elements by construction sequence.
 */
export function sortByConstructionSequence<T extends { type?: string; elementType?: string }>(
  elements: T[],
): T[] {
  return [...elements].sort((a, b) => {
    const pa = getConstructionSequencePriority(a.elementType || a.type || '');
    const pb = getConstructionSequencePriority(b.elementType || b.type || '');
    return pa - pb;
  });
}
