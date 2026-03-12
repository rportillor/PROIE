/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  PARAMETER ENGINE — Live Parameter Editing with Constraints & Transactions
 *  Provides:
 *  - Transaction-based undo/redo system
 *  - Parameter propagation (move wall → doors/windows move with it)
 *  - Constraint solver (wall-to-wall joins, beam-column connections)
 *  - Property change tracking and validation
 *  - Element hosting relationships (doors in walls, fixtures on floors)
 *  All dimensions in metres. Z-up coordinate system.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import type { BIMSolid, LODLevel } from './parametric-elements';
import type { Vec3 } from './geometry-kernel';
import { vec3, v3add, v3sub, v3len, v3scale } from './geometry-kernel';

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSACTION SYSTEM — Atomic undo/redo with change tracking
// ═══════════════════════════════════════════════════════════════════════════════

export interface PropertyChange {
  elementId: string;
  property: string;         // dot-path: e.g. "quantities.height", "origin.x", "material"
  oldValue: any;
  newValue: any;
}

export interface Transaction {
  id: string;
  timestamp: string;        // ISO 8601
  userId: string;
  description: string;
  changes: PropertyChange[];
  propagatedChanges: PropertyChange[];   // changes auto-applied by constraints
}

export interface TransactionStack {
  undoStack: Transaction[];
  redoStack: Transaction[];
  maxSize: number;
}

export function createTransactionStack(maxSize: number = 100): TransactionStack {
  return { undoStack: [], redoStack: [], maxSize };
}

export function beginTransaction(
  stack: TransactionStack,
  id: string,
  userId: string,
  description: string,
): Transaction {
  const tx: Transaction = {
    id,
    timestamp: new Date().toISOString(),
    userId,
    description,
    changes: [],
    propagatedChanges: [],
  };
  return tx;
}

export function recordChange(tx: Transaction, change: PropertyChange): void {
  tx.changes.push(change);
}

export function commitTransaction(stack: TransactionStack, tx: Transaction): void {
  stack.undoStack.push(tx);
  stack.redoStack = []; // clear redo on new commit
  if (stack.undoStack.length > stack.maxSize) {
    stack.undoStack.shift();
  }
}

export function canUndo(stack: TransactionStack): boolean {
  return stack.undoStack.length > 0;
}

export function canRedo(stack: TransactionStack): boolean {
  return stack.redoStack.length > 0;
}

export function undoTransaction(
  stack: TransactionStack,
  elements: Map<string, BIMSolid>,
): Transaction | null {
  const tx = stack.undoStack.pop();
  if (!tx) return null;

  // Apply changes in reverse
  const allChanges = [...tx.propagatedChanges, ...tx.changes].reverse();
  for (const change of allChanges) {
    const el = elements.get(change.elementId);
    if (el) setNestedProperty(el, change.property, change.oldValue);
  }

  stack.redoStack.push(tx);
  return tx;
}

export function redoTransaction(
  stack: TransactionStack,
  elements: Map<string, BIMSolid>,
): Transaction | null {
  const tx = stack.redoStack.pop();
  if (!tx) return null;

  // Apply changes forward
  const allChanges = [...tx.changes, ...tx.propagatedChanges];
  for (const change of allChanges) {
    const el = elements.get(change.elementId);
    if (el) setNestedProperty(el, change.property, change.newValue);
  }

  stack.undoStack.push(tx);
  return tx;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PROPERTY ACCESS — Deep get/set with dot-path notation
// ═══════════════════════════════════════════════════════════════════════════════

function getNestedProperty(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedProperty(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PARAMETER PROPAGATION — Cascading changes through relationships
// ═══════════════════════════════════════════════════════════════════════════════

export interface PropagationRule {
  triggerProperty: string;         // property that triggers propagation
  targetRelation: 'hosted' | 'connected' | 'adjacent';
  targetProperty: string;          // property to update on targets
  transform: 'copy' | 'offset' | 'match' | 'custom';
  customFn?: (oldVal: any, newVal: any, sourceEl: BIMSolid, targetEl: BIMSolid) => any;
}

const DEFAULT_PROPAGATION_RULES: PropagationRule[] = [
  // Moving a wall moves its hosted doors/windows
  {
    triggerProperty: 'origin.x',
    targetRelation: 'hosted',
    targetProperty: 'origin.x',
    transform: 'offset',
  },
  {
    triggerProperty: 'origin.y',
    targetRelation: 'hosted',
    targetProperty: 'origin.y',
    transform: 'offset',
  },
  {
    triggerProperty: 'origin.z',
    targetRelation: 'hosted',
    targetProperty: 'origin.z',
    transform: 'offset',
  },
  // Rotating a wall rotates its hosted elements
  {
    triggerProperty: 'rotation',
    targetRelation: 'hosted',
    targetProperty: 'rotation',
    transform: 'offset',
  },
  // Changing wall height affects hosted elements' heights
  {
    triggerProperty: 'quantities.height',
    targetRelation: 'hosted',
    targetProperty: 'quantities.height',
    transform: 'custom',
    customFn: (_oldVal, newVal, _source, target) => {
      // Door/window heights are independent of wall height
      // but sill height might need adjustment
      return target.quantities.height;
    },
  },
  // Changing storey assignment propagates to hosted elements
  {
    triggerProperty: 'storey',
    targetRelation: 'hosted',
    targetProperty: 'storey',
    transform: 'copy',
  },
  {
    triggerProperty: 'elevation',
    targetRelation: 'hosted',
    targetProperty: 'elevation',
    transform: 'copy',
  },
  // Material change on wall section propagates (connected walls match material)
  {
    triggerProperty: 'material',
    targetRelation: 'connected',
    targetProperty: 'material',
    transform: 'copy',
  },
];

export function propagateChange(
  sourceElement: BIMSolid,
  property: string,
  oldValue: any,
  newValue: any,
  elements: Map<string, BIMSolid>,
  rules: PropagationRule[] = DEFAULT_PROPAGATION_RULES,
): PropertyChange[] {
  const propagated: PropertyChange[] = [];

  for (const rule of rules) {
    if (rule.triggerProperty !== property) continue;

    // Find target elements based on relation type
    let targetIds: string[] = [];
    switch (rule.targetRelation) {
      case 'hosted':
        targetIds = sourceElement.hostedIds;
        break;
      case 'connected':
        targetIds = sourceElement.connectedIds;
        break;
      case 'adjacent':
        // Find elements within spatial proximity
        targetIds = findAdjacentElements(sourceElement, elements);
        break;
    }

    for (const targetId of targetIds) {
      const target = elements.get(targetId);
      if (!target) continue;

      const currentValue = getNestedProperty(target, rule.targetProperty);
      let newTargetValue: any;

      switch (rule.transform) {
        case 'copy':
          newTargetValue = newValue;
          break;
        case 'offset': {
          const delta = typeof newValue === 'number' && typeof oldValue === 'number'
            ? newValue - oldValue : 0;
          newTargetValue = typeof currentValue === 'number' ? currentValue + delta : currentValue;
          break;
        }
        case 'match':
          newTargetValue = newValue;
          break;
        case 'custom':
          newTargetValue = rule.customFn
            ? rule.customFn(oldValue, newValue, sourceElement, target)
            : currentValue;
          break;
      }

      if (newTargetValue !== currentValue) {
        propagated.push({
          elementId: targetId,
          property: rule.targetProperty,
          oldValue: currentValue,
          newValue: newTargetValue,
        });
        setNestedProperty(target, rule.targetProperty, newTargetValue);
      }
    }
  }

  return propagated;
}

function findAdjacentElements(
  source: BIMSolid,
  elements: Map<string, BIMSolid>,
  tolerance: number = 0.05,
): string[] {
  const result: string[] = [];
  for (const [id, el] of elements) {
    if (id === source.id) continue;
    if (el.storey !== source.storey) continue;

    const dist = v3len(v3sub(el.origin, source.origin));
    const maxExtent = Math.max(
      (source.quantities.length || 0) + (el.quantities.length || 0),
      (source.quantities.width || 0) + (el.quantities.width || 0),
    );

    if (dist < maxExtent + tolerance) {
      result.push(id);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTRAINT SOLVER — Geometric relationship maintenance
// ═══════════════════════════════════════════════════════════════════════════════

export type ConstraintType =
  | 'fixed'              // element cannot move
  | 'coincident'         // two points share same location
  | 'parallel'           // two elements maintain parallel orientation
  | 'perpendicular'      // two elements at 90°
  | 'distance'           // fixed distance between two elements
  | 'aligned'            // elements share a common axis/line
  | 'hosted'             // element lives on a host (door in wall)
  | 'tangent';           // element tangent to another (curved wall meets straight)

export interface Constraint {
  id: string;
  type: ConstraintType;
  elementIds: string[];           // elements involved
  parameters: Record<string, number>;  // type-specific params (distance value, angle, etc.)
  priority: number;               // higher = enforced first (0-10)
  isActive: boolean;
}

export interface ConstraintSolverResult {
  iterations: number;
  converged: boolean;
  maxResidual: number;
  adjustments: PropertyChange[];
}

/**
 * Solve all active constraints iteratively.
 * Uses Gauss-Seidel relaxation — each constraint adjusts elements in sequence.
 */
export function solveConstraints(
  constraints: Constraint[],
  elements: Map<string, BIMSolid>,
  maxIterations: number = 10,
  tolerance: number = 0.001,
): ConstraintSolverResult {
  const adjustments: PropertyChange[] = [];
  let converged = false;
  let maxResidual = 0;
  let iteration = 0;

  const active = constraints
    .filter(c => c.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (iteration = 0; iteration < maxIterations; iteration++) {
    maxResidual = 0;

    for (const constraint of active) {
      const residual = applyConstraint(constraint, elements, adjustments);
      maxResidual = Math.max(maxResidual, residual);
    }

    if (maxResidual < tolerance) {
      converged = true;
      break;
    }
  }

  return { iterations: iteration + 1, converged, maxResidual, adjustments };
}

function applyConstraint(
  constraint: Constraint,
  elements: Map<string, BIMSolid>,
  adjustments: PropertyChange[],
): number {
  const els = constraint.elementIds.map(id => elements.get(id)).filter(Boolean) as BIMSolid[];
  if (els.length < 2 && constraint.type !== 'fixed') return 0;

  switch (constraint.type) {
    case 'fixed':
      return 0; // no adjustment needed

    case 'coincident': {
      if (els.length < 2) return 0;
      const target = els[0].origin;
      const dist = v3len(v3sub(els[1].origin, target));
      if (dist > 0.001) {
        const old = { ...els[1].origin };
        els[1].origin = { ...target };
        adjustments.push({
          elementId: els[1].id,
          property: 'origin',
          oldValue: old,
          newValue: { ...target },
        });
      }
      return dist;
    }

    case 'distance': {
      if (els.length < 2) return 0;
      const targetDist = constraint.parameters['distance'] || 0;
      const currentDist = v3len(v3sub(els[1].origin, els[0].origin));
      const residual = Math.abs(currentDist - targetDist);

      if (residual > 0.001 && currentDist > 0.001) {
        const dir = v3scale(v3sub(els[1].origin, els[0].origin), 1 / currentDist);
        const adjustment = v3scale(dir, (targetDist - currentDist) / 2);
        const old1 = { ...els[1].origin };
        els[1].origin = v3add(els[1].origin, adjustment);
        adjustments.push({
          elementId: els[1].id,
          property: 'origin',
          oldValue: old1,
          newValue: { ...els[1].origin },
        });
      }
      return residual;
    }

    case 'parallel': {
      if (els.length < 2) return 0;
      const angleDiff = Math.abs(els[0].rotation - els[1].rotation);
      const residual = Math.min(angleDiff, Math.abs(angleDiff - Math.PI));
      if (residual > 0.001) {
        const oldRot = els[1].rotation;
        // Snap to nearest parallel angle
        const diff = els[1].rotation - els[0].rotation;
        const normalizedDiff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
        if (Math.abs(normalizedDiff) < Math.PI / 2) {
          els[1].rotation = els[0].rotation;
        } else {
          els[1].rotation = els[0].rotation + Math.PI;
        }
        adjustments.push({
          elementId: els[1].id,
          property: 'rotation',
          oldValue: oldRot,
          newValue: els[1].rotation,
        });
      }
      return residual;
    }

    case 'perpendicular': {
      if (els.length < 2) return 0;
      const targetAngle = els[0].rotation + Math.PI / 2;
      const diff = els[1].rotation - targetAngle;
      const residual = Math.abs(((diff + Math.PI) % (2 * Math.PI)) - Math.PI);
      if (residual > 0.001) {
        const oldRot = els[1].rotation;
        els[1].rotation = targetAngle;
        adjustments.push({
          elementId: els[1].id,
          property: 'rotation',
          oldValue: oldRot,
          newValue: els[1].rotation,
        });
      }
      return residual;
    }

    case 'aligned': {
      if (els.length < 2) return 0;
      // Project element B onto element A's axis
      const axis = vec3(Math.cos(els[0].rotation), Math.sin(els[0].rotation), 0);
      const diff = v3sub(els[1].origin, els[0].origin);
      const perpComponent = v3sub(diff, v3scale(axis, diff.x * axis.x + diff.y * axis.y + diff.z * axis.z));
      const residual = v3len(perpComponent);

      if (residual > 0.001) {
        const old = { ...els[1].origin };
        els[1].origin = v3sub(els[1].origin, perpComponent);
        adjustments.push({
          elementId: els[1].id,
          property: 'origin',
          oldValue: old,
          newValue: { ...els[1].origin },
        });
      }
      return residual;
    }

    case 'hosted': {
      if (els.length < 2) return 0;
      // Ensure hosted element stays on host
      const host = els[0];
      const guest = els[1];

      // Guest Z should match host elevation
      const targetZ = host.origin.z;
      const residual = Math.abs(guest.origin.z - targetZ);

      if (residual > 0.001) {
        const old = guest.origin.z;
        guest.origin = { ...guest.origin, z: targetZ };
        adjustments.push({
          elementId: guest.id,
          property: 'origin.z',
          oldValue: old,
          newValue: targetZ,
        });
      }
      return residual;
    }

    default:
      return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PARAMETER VALIDATION — Ensure values are within valid ranges
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationRule {
  property: string;
  min?: number;
  max?: number;
  allowedValues?: any[];
  elementTypes?: string[];   // which element types this rule applies to
  message: string;
}

const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  { property: 'quantities.height', min: 0.1, max: 100, message: 'Height must be between 0.1m and 100m' },
  { property: 'quantities.width', min: 0.01, max: 50, message: 'Width must be between 0.01m and 50m' },
  { property: 'quantities.length', min: 0.01, max: 500, message: 'Length must be between 0.01m and 500m' },
  { property: 'quantities.thickness', min: 0.001, max: 5, message: 'Thickness must be between 1mm and 5m' },
  { property: 'elevation', min: -50, max: 500, message: 'Elevation must be between -50m and 500m' },
  { property: 'rotation', min: -2 * Math.PI, max: 2 * Math.PI, message: 'Rotation must be within ±2π radians' },
  {
    property: 'lod',
    allowedValues: [100, 200, 300, 350, 400, 500],
    message: 'LOD must be 100, 200, 300, 350, 400, or 500',
  },
];

export interface ValidationError {
  elementId: string;
  property: string;
  value: any;
  message: string;
}

export function validatePropertyChange(
  element: BIMSolid,
  property: string,
  value: any,
  rules: ValidationRule[] = DEFAULT_VALIDATION_RULES,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    if (rule.property !== property) continue;
    if (rule.elementTypes && !rule.elementTypes.includes(element.type)) continue;

    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
      errors.push({ elementId: element.id, property, value, message: rule.message });
    }
    if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
      errors.push({ elementId: element.id, property, value, message: rule.message });
    }
    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      errors.push({ elementId: element.id, property, value, message: rule.message });
    }
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PARAMETER EDIT API — High-level editing interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface EditResult {
  success: boolean;
  transaction?: Transaction;
  validationErrors: ValidationError[];
  constraintResult?: ConstraintSolverResult;
  affectedElementIds: string[];
}

/**
 * Apply a property edit to an element with full undo/redo, validation,
 * propagation, and constraint solving.
 */
export function applyEdit(
  elementId: string,
  property: string,
  newValue: any,
  elements: Map<string, BIMSolid>,
  stack: TransactionStack,
  constraints: Constraint[],
  userId: string = 'system',
): EditResult {
  const element = elements.get(elementId);
  if (!element) {
    return {
      success: false,
      validationErrors: [{ elementId, property, value: newValue, message: 'Element not found' }],
      affectedElementIds: [],
    };
  }

  // Validate
  const errors = validatePropertyChange(element, property, newValue);
  if (errors.length > 0) {
    return { success: false, validationErrors: errors, affectedElementIds: [] };
  }

  // Begin transaction
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tx = beginTransaction(stack, txId, userId, `Edit ${element.name}: ${property} = ${newValue}`);

  // Record primary change
  const oldValue = getNestedProperty(element, property);
  recordChange(tx, { elementId, property, oldValue, newValue });
  setNestedProperty(element, property, newValue);

  // Propagate changes
  const propagated = propagateChange(element, property, oldValue, newValue, elements);
  tx.propagatedChanges = propagated;

  // Solve constraints
  const constraintResult = solveConstraints(constraints, elements);
  for (const adj of constraintResult.adjustments) {
    tx.propagatedChanges.push(adj);
  }

  // Commit transaction
  commitTransaction(stack, tx);

  // Collect all affected element IDs
  const affected = new Set<string>([elementId]);
  for (const change of [...propagated, ...constraintResult.adjustments]) {
    affected.add(change.elementId);
  }

  return {
    success: true,
    transaction: tx,
    validationErrors: [],
    constraintResult,
    affectedElementIds: [...affected],
  };
}

/**
 * Batch edit multiple properties in a single transaction.
 */
export function applyBatchEdit(
  edits: Array<{ elementId: string; property: string; value: any }>,
  elements: Map<string, BIMSolid>,
  stack: TransactionStack,
  constraints: Constraint[],
  userId: string = 'system',
  description: string = 'Batch edit',
): EditResult {
  // Validate all edits first
  const allErrors: ValidationError[] = [];
  for (const edit of edits) {
    const el = elements.get(edit.elementId);
    if (!el) {
      allErrors.push({ elementId: edit.elementId, property: edit.property, value: edit.value, message: 'Element not found' });
      continue;
    }
    allErrors.push(...validatePropertyChange(el, edit.property, edit.value));
  }

  if (allErrors.length > 0) {
    return { success: false, validationErrors: allErrors, affectedElementIds: [] };
  }

  // Begin single transaction for all edits
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tx = beginTransaction(stack, txId, userId, description);

  const affected = new Set<string>();

  for (const edit of edits) {
    const el = elements.get(edit.elementId)!;
    const oldValue = getNestedProperty(el, edit.property);
    recordChange(tx, { elementId: edit.elementId, property: edit.property, oldValue, newValue: edit.value });
    setNestedProperty(el, edit.property, edit.value);
    affected.add(edit.elementId);

    // Propagate each change
    const propagated = propagateChange(el, edit.property, oldValue, edit.value, elements);
    for (const p of propagated) {
      tx.propagatedChanges.push(p);
      affected.add(p.elementId);
    }
  }

  // Solve constraints once after all changes
  const constraintResult = solveConstraints(constraints, elements);
  for (const adj of constraintResult.adjustments) {
    tx.propagatedChanges.push(adj);
    affected.add(adj.elementId);
  }

  commitTransaction(stack, tx);

  return {
    success: true,
    transaction: tx,
    validationErrors: [],
    constraintResult,
    affectedElementIds: [...affected],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ELEMENT SELECTION & FILTERING
// ═══════════════════════════════════════════════════════════════════════════════

export interface SelectionFilter {
  types?: string[];
  categories?: string[];
  storeys?: string[];
  materials?: string[];
  lodLevels?: LODLevel[];
  phases?: string[];
  worksets?: string[];
  boundingBox?: { min: Vec3; max: Vec3 };
}

export function filterElements(
  elements: Map<string, BIMSolid>,
  filter: SelectionFilter,
): BIMSolid[] {
  const result: BIMSolid[] = [];

  for (const [, el] of elements) {
    if (filter.types && !filter.types.includes(el.type)) continue;
    if (filter.categories && !filter.categories.includes(el.category)) continue;
    if (filter.storeys && !filter.storeys.includes(el.storey)) continue;
    if (filter.materials && !filter.materials.includes(el.material)) continue;
    if (filter.lodLevels && el.lod && !filter.lodLevels.includes(el.lod)) continue;
    if (filter.phases && el.phase && !filter.phases.includes(el.phase.phaseId)) continue;
    if (filter.worksets && el.workset && !filter.worksets.includes(el.workset.worksetId)) continue;
    if (filter.boundingBox) {
      const bb = filter.boundingBox;
      if (el.origin.x < bb.min.x || el.origin.x > bb.max.x) continue;
      if (el.origin.y < bb.min.y || el.origin.y > bb.max.y) continue;
      if (el.origin.z < bb.min.z || el.origin.z > bb.max.z) continue;
    }
    result.push(el);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSACTION HISTORY — Query and export
// ═══════════════════════════════════════════════════════════════════════════════

export interface TransactionSummary {
  id: string;
  timestamp: string;
  userId: string;
  description: string;
  changeCount: number;
  propagatedCount: number;
  affectedElements: string[];
}

export function getTransactionHistory(stack: TransactionStack): TransactionSummary[] {
  return stack.undoStack.map(tx => ({
    id: tx.id,
    timestamp: tx.timestamp,
    userId: tx.userId,
    description: tx.description,
    changeCount: tx.changes.length,
    propagatedCount: tx.propagatedChanges.length,
    affectedElements: [...new Set([
      ...tx.changes.map(c => c.elementId),
      ...tx.propagatedChanges.map(c => c.elementId),
    ])],
  }));
}

export function exportTransactionLog(stack: TransactionStack): string {
  const log = stack.undoStack.map(tx => ({
    id: tx.id,
    timestamp: tx.timestamp,
    userId: tx.userId,
    description: tx.description,
    changes: tx.changes,
    propagatedChanges: tx.propagatedChanges,
  }));
  return JSON.stringify(log, null, 2);
}
