/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OneMap SG (Singapore Land Authority) client helper.
 * Talks to the server-side proxy in server.ts so no OneMap credentials
 * ever reach the browser. Used for official HDB address lookups and
 * sheltered-walkway-aware walking routes between SG coordinates.
 */

export interface OneMapSearchResult {
  SEARCHVAL: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
  BUILDING: string;
}

export interface OneMapSearchResponse {
  success: boolean;
  results: OneMapSearchResult[];
  totalFound: number;
}

/**
 * Search OneMap for a Singapore address / HDB block / postal code.
 * Returns official building coordinates and postal metadata.
 */
export async function searchOneMapAddress(query: string): Promise<OneMapSearchResponse> {
  try {
    const res = await fetch(`/api/onemap/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return {
      success: Boolean(data.success),
      results: data.results || [],
      totalFound: data.totalFound || 0,
    };
  } catch (err) {
    console.warn('OneMap search failed:', err);
    return { success: false, results: [], totalFound: 0 };
  }
}

export interface OneMapRouteResponse {
  success: boolean;
  route?: {
    total_distance: number; // meters
    total_time: number; // seconds
    route_geometry?: string;
    [key: string]: any;
  };
  error?: string;
}

/**
 * Request a walking route (sheltered walkway aware where available) between
 * two Singapore coordinates. Requires ONE_MAP_EMAIL / ONE_MAP_PASSWORD to be
 * configured on the server; otherwise resolves with success=false.
 */
export async function fetchOneMapRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  routeType: 'walk' | 'drive' | 'cycle' | 'pt' = 'walk'
): Promise<OneMapRouteResponse> {
  try {
    const res = await fetch('/api/onemap/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startLat, startLng, endLat, endLng, routeType }),
    });
    return await res.json();
  } catch (err) {
    console.warn('OneMap routing failed:', err);
    return { success: false, error: String(err) };
  }
}
