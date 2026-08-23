/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure spherical-geometry helpers shared by the client and the Phase 2
 * Street View candidate retrieval in server.ts. No DOM or network access,
 * so the same math is unit-testable and reusable on both sides.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

export function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

/** GPS accuracy radius expanded into a bounding box around the fix. */
export function buildBoundingBox(center: GeoPoint, radiusMeters: number): BoundingBox {
  const dLat = radiusMeters / METERS_PER_DEGREE_LAT;
  const dLng = radiusMeters / Math.max(metersPerDegreeLng(center.lat), 1);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/**
 * Center plus an even ring at the radius — a cheap sampling of the accuracy
 * bounding box used to probe for Street View panorama candidates.
 */
export function ringSamplePoints(center: GeoPoint, radiusMeters: number, ringCount = 8): GeoPoint[] {
  const dLat = radiusMeters / METERS_PER_DEGREE_LAT;
  const dLng = radiusMeters / Math.max(metersPerDegreeLng(center.lat), 1);
  const points: GeoPoint[] = [{ lat: center.lat, lng: center.lng }];
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * 2 * Math.PI;
    points.push({
      lat: center.lat + dLat * Math.sin(angle),
      lng: center.lng + dLng * Math.cos(angle),
    });
  }
  return points;
}

/** Great-circle initial bearing from `from` to `to`, degrees clockwise from true north. */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dLambda = toRad(to.lng - from.lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest unsigned difference between two compass angles (0..180). */
export function angleDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * True when the bearing towards a candidate panorama lies inside the camera
 * field of view centred on the device compass heading. Candidates behind the
 * senior can never appear in the photo and are discarded.
 */
export function withinFieldOfView(candidateBearing: number, deviceHeading: number, fovDegrees = 90): boolean {
  return angleDifference(candidateBearing, deviceHeading) <= fovDegrees / 2;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);
  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
