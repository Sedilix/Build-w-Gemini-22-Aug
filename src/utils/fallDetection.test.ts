/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classifyImpact,
  updateMotionGpsSpeed,
  getCurrentSpeedKmh,
  resetMotionSpeed,
  ImpactSample,
} from './fallDetection';

/** A resting phone: 1G, no spin, stationary, no preceding drop. */
const atRest: ImpactSample = {
  gForce: 1,
  rotationRateDps: 0,
  speedKmh: 0,
  hadRecentFreefall: false,
};

describe('classifyImpact — crash', () => {
  it('flags a hard impact while the vehicle was moving', () => {
    expect(classifyImpact({ ...atRest, gForce: 6.5, speedKmh: 60 })).toBe('crash');
  });

  it('flags a violent impact with rollover spin even without GPS speed', () => {
    expect(classifyImpact({ ...atRest, gForce: 9, rotationRateDps: 400 })).toBe('crash');
  });

  it('does not flag a hard impact at walking pace as a crash', () => {
    expect(classifyImpact({ ...atRest, gForce: 7, speedKmh: 4 })).toBeNull();
  });

  it('does not flag a violent impact that has no rotation and no speed', () => {
    // A phone dropped face-down on tile easily exceeds 8G; without corroboration
    // it must not dispatch an ambulance.
    expect(classifyImpact({ ...atRest, gForce: 12, rotationRateDps: 20 })).toBeNull();
  });

  it('does not flag ordinary driving vibration', () => {
    expect(classifyImpact({ ...atRest, gForce: 1.4, speedKmh: 70 })).toBeNull();
  });
});

describe('classifyImpact — fall', () => {
  it('flags a ground strike that followed a freefall phase', () => {
    expect(classifyImpact({ ...atRest, gForce: 3.2, hadRecentFreefall: true })).toBe('fall');
  });

  it('ignores an equally hard knock with no preceding freefall', () => {
    // Setting a phone down firmly, or a bag knock: no drop, so no fall.
    expect(classifyImpact({ ...atRest, gForce: 3.2, hadRecentFreefall: false })).toBeNull();
  });

  it('ignores a freefall that lands gently', () => {
    expect(classifyImpact({ ...atRest, gForce: 1.6, hadRecentFreefall: true })).toBeNull();
  });

  it('leaves a resting phone alone', () => {
    expect(classifyImpact(atRest)).toBeNull();
  });

  it('does not treat normal walking bounce as a fall', () => {
    expect(classifyImpact({ ...atRest, gForce: 2.0, hadRecentFreefall: false })).toBeNull();
  });
});

describe('GPS speed staleness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMotionSpeed();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMotionSpeed();
  });

  it('reports a fresh reading in km/h', () => {
    updateMotionGpsSpeed(16.7); // ~60 km/h
    expect(getCurrentSpeedKmh()).toBe(60);
  });

  it('decays to zero once the fix is too old to trust', () => {
    updateMotionGpsSpeed(16.7);
    vi.advanceTimersByTime(20_000);
    // Without decay this would still read 60 and hold the crash gate open long
    // after the journey ended.
    expect(getCurrentSpeedKmh()).toBe(0);
  });

  it('keeps a reading that is still within the freshness window', () => {
    updateMotionGpsSpeed(16.7);
    vi.advanceTimersByTime(5_000);
    expect(getCurrentSpeedKmh()).toBe(60);
  });

  it('ignores null readings rather than treating them as a stop', () => {
    updateMotionGpsSpeed(16.7);
    updateMotionGpsSpeed(null);
    expect(getCurrentSpeedKmh()).toBe(60);
  });

  it('starts at zero before any fix arrives', () => {
    expect(getCurrentSpeedKmh()).toBe(0);
  });

  it('cannot arm the crash speed gate from a stale reading', () => {
    updateMotionGpsSpeed(16.7);
    vi.advanceTimersByTime(20_000);
    const verdict = classifyImpact({
      ...atRest,
      gForce: 7,
      speedKmh: getCurrentSpeedKmh(),
    });
    expect(verdict).toBeNull();
  });
});
