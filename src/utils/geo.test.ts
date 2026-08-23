/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  buildBoundingBox,
  ringSamplePoints,
  bearingDegrees,
  angleDifference,
  withinFieldOfView,
  haversineMeters,
  metersPerDegreeLng,
} from './geo';

describe('buildBoundingBox', () => {
  it('is symmetric around the centre at the equator', () => {
    const box = buildBoundingBox({ lat: 0, lng: 100 }, 111_320);
    expect(box.maxLat).toBeCloseTo(1, 5);
    expect(box.minLat).toBeCloseTo(-1, 5);
    // At the equator a degree of longitude equals a degree of latitude.
    expect(box.maxLng - 100).toBeCloseTo(1, 3);
  });

  it('widens longitude at high latitudes where meridians converge', () => {
    const box = buildBoundingBox({ lat: 60, lng: 0 }, 1000);
    const dLat = box.maxLat - 60;
    const dLng = box.maxLng - 0;
    expect(dLng).toBeCloseTo(dLat * 2, 3); // cos(60°) = 0.5
  });
});

describe('ringSamplePoints', () => {
  it('returns centre plus the requested ring count', () => {
    const pts = ringSamplePoints({ lat: 1.35, lng: 103.85 }, 20, 8);
    expect(pts).toHaveLength(9);
    expect(pts[0]).toEqual({ lat: 1.35, lng: 103.85 });
  });

  it('places every ring point ≈radius metres from the centre', () => {
    const centre = { lat: 1.3327, lng: 103.8479 };
    for (const p of ringSamplePoints(centre, 25, 8).slice(1)) {
      expect(haversineMeters(centre, p)).toBeCloseTo(25, 0);
    }
  });
});

describe('bearingDegrees', () => {
  const origin = { lat: 1.35, lng: 103.85 };

  it('reports cardinal directions', () => {
    expect(bearingDegrees(origin, { lat: 2.35, lng: 103.85 })).toBeCloseTo(0, 1); // north
    expect(bearingDegrees(origin, { lat: 1.35, lng: 104.85 })).toBeCloseTo(90, 1); // east
    expect(bearingDegrees(origin, { lat: 0.35, lng: 103.85 })).toBeCloseTo(180, 1); // south
    expect(bearingDegrees(origin, { lat: 1.35, lng: 102.85 })).toBeCloseTo(270, 1); // west
  });
});

describe('angleDifference / withinFieldOfView', () => {
  it('wraps across north', () => {
    expect(angleDifference(350, 10)).toBe(20);
    expect(angleDifference(10, 350)).toBe(20);
    expect(angleDifference(90, 270)).toBe(180);
  });

  it('keeps candidates inside a 90° field of view and drops ones behind', () => {
    const heading = 0; // facing north
    expect(withinFieldOfView(40, heading, 90)).toBe(true);
    expect(withinFieldOfView(45, heading, 90)).toBe(true); // boundary inclusive
    expect(withinFieldOfView(50, heading, 90)).toBe(false);
    expect(withinFieldOfView(180, heading, 90)).toBe(false); // directly behind
    expect(withinFieldOfView(350, heading, 90)).toBe(true); // wraps across north
  });
});

describe('haversineMeters', () => {
  it('measures one degree of latitude on the 6371 km sphere', () => {
    // Spherical arc: R * pi/180 ≈ 111,195 m (the ellipsoidal 111,320 constant
    // is intentionally a touch larger for conservative bounding boxes).
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      (6_371_000 * Math.PI) / 180,
      0
    );
  });
});

describe('metersPerDegreeLng', () => {
  it('halves at 60° latitude', () => {
    expect(metersPerDegreeLng(60)).toBeCloseTo(metersPerDegreeLng(0) * 0.5, 0);
  });
});
