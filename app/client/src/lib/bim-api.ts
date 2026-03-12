// client/src/lib/bim-api.ts
// ✅ FIX: Use standardized BIM element interface from shared schema
import type { BimElement } from "@shared/schema";

// Re-export with consistent naming (BIMElement for frontend compatibility)
export type BIMElement = BimElement;

// Legacy interface mapping for backward compatibility  
export interface LegacyBIMElement {
  id: string;
  type: string;
  name?: string;
  category?: string;
  geometry?: any;
  properties?: any;
  storey?: any;
}

export interface BIMElementsResponse {
  data: BIMElement[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

/**
 * Fetch all BIM elements for a model, automatically handling pagination
 */
export async function fetchAllModelElements(
  modelId: string,
  batchSize: number = 1000
): Promise<BIMElement[]> {
  
  // Try to get all at once first
  try {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`/api/bim/models/${modelId}/elements?all=true`, { headers, credentials: "include" }).catch(err => {
      console.error('Failed to fetch all elements:', err);
      throw err;
    });
    if (response.ok) {
      const result: BIMElementsResponse = await response.json();
      return result.data;
    }
  } catch (error) {
    console.warn('Failed to fetch all elements, falling back to pagination:', error);
  }
  
  // Fallback to pagination
  const allElements: BIMElement[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const token = localStorage.getItem("auth_token");
      const paginationHeaders: Record<string, string> = {};
      if (token) paginationHeaders["Authorization"] = `Bearer ${token}`;
      const response = await fetch(
        `/api/bim/models/${modelId}/elements?offset=${offset}&limit=${batchSize}`,
        { headers: paginationHeaders, credentials: "include" }
      ).catch(err => {
        console.error('Failed to fetch elements batch:', err);
        throw err;
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: BIMElementsResponse = await response.json();
      allElements.push(...result.data);
      
      hasMore = result.data.length === batchSize && allElements.length < result.pagination.total;
      offset += batchSize;
      
    } catch (error) {
      console.error(`Failed to fetch elements batch at offset ${offset}:`, error);
      break;
    }
  }
  
  return allElements;
}

// ── Auth helper ─────────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ── CREATE element ──────────────────────────────────────────────────────────
export interface CreateElementPayload {
  elementType: string;
  name?: string;
  geometry: {
    dimensions: { length?: number; width?: number; height?: number; depth?: number };
    location?: { realLocation: { x: number; y: number; z: number } };
  };
  properties?: Record<string, any>;
  material?: string;
  storeyName?: string;
  category?: string;
}

export async function createElement(
  modelId: string,
  payload: CreateElementPayload,
): Promise<{ success: boolean; element: BIMElement; relationships: any[] }> {
  const resp = await fetch(`/api/bim/models/${modelId}/elements`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Create failed: ${resp.status}`);
  return resp.json();
}

// ── UPDATE element properties ───────────────────────────────────────────────
export async function updateElement(
  modelId: string,
  elementId: string,
  updates: Record<string, any>,
): Promise<{ success: boolean; element: BIMElement; updatedFields: string[] }> {
  const resp = await fetch(`/api/bim/models/${modelId}/elements/${elementId}`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!resp.ok) throw new Error(`Update failed: ${resp.status}`);
  return resp.json();
}

// ── DELETE element ──────────────────────────────────────────────────────────
export async function deleteElement(
  modelId: string,
  elementId: string,
): Promise<{ success: boolean; deletedId: string; hostedElementsOrphaned: string[] }> {
  const resp = await fetch(`/api/bim/models/${modelId}/elements/${elementId}`, {
    method: "DELETE",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
  return resp.json();
}

// ── SPLIT wall ──────────────────────────────────────────────────────────────
export async function splitWall(
  modelId: string,
  elementId: string,
  splitPoint: { x: number; y: number },
): Promise<{ success: boolean; newWalls: BIMElement[]; splitRatio: number }> {
  const resp = await fetch(`/api/bim/models/${modelId}/elements/${elementId}/split`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ splitPoint }),
  });
  if (!resp.ok) throw new Error(`Split failed: ${resp.status}`);
  return resp.json();
}

// ── HOST element in wall ────────────────────────────────────────────────────
export async function hostInWall(
  modelId: string,
  elementId: string,
  hostWallId: string,
  parameterT: number = 0.5,
): Promise<{ success: boolean; element: BIMElement; position: { x: number; y: number; z: number } }> {
  const resp = await fetch(`/api/bim/models/${modelId}/elements/${elementId}/host`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ hostWallId, parameterT }),
  });
  if (!resp.ok) throw new Error(`Host failed: ${resp.status}`);
  return resp.json();
}