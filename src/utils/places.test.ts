/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  orderSavedPlaces,
  usableSavedPlaces,
  savedPlaceLabel,
  SAVED_PLACE_KINDS,
  SAVED_PLACE_META,
  geocodeSingaporeAddress,
  resolveSavedPlace,
} from './places';
import { SavedPlace } from '../types';

describe('places utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('orders saved places with home first, then work, then healthcare', () => {
    const unordered: SavedPlace[] = [
      { kind: 'healthcare', address: 'TTSH' },
      { kind: 'home', address: '356 Yishun Ring Rd' },
      { kind: 'work', address: 'BLOCK71' },
    ];

    const ordered = orderSavedPlaces(unordered);
    expect(ordered.map((p) => p.kind)).toEqual(['home', 'work', 'healthcare']);
  });

  it('filters out empty or blank saved places', () => {
    const list: SavedPlace[] = [
      { kind: 'home', address: '356 Yishun Ring Rd' },
      { kind: 'work', address: '   ' },
      { kind: 'healthcare', address: '' },
    ];

    const usable = usableSavedPlaces(list);
    expect(usable).toHaveLength(1);
    expect(usable[0].kind).toBe('home');
  });

  it('provides friendly labels and default fallbacks', () => {
    expect(
      savedPlaceLabel({ kind: 'home', address: 'Yishun', label: 'My Flat' })
    ).toBe('My Flat');

    expect(
      savedPlaceLabel({ kind: 'healthcare', address: 'SGH' })
    ).toBe('Healthcare');
  });

  it('geocodes valid Singapore address via API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            LATITUDE: '1.4312',
            LONGITUDE: '103.8322',
            ADDRESS: '356 YISHUN RING ROAD SINGAPORE 760356',
            POSTAL: '760356',
          },
        ],
      }),
    } as any);

    const result = await geocodeSingaporeAddress('356 Yishun Ring Rd');
    expect(result).not.toBeNull();
    expect(result?.lat).toBe(1.4312);
    expect(result?.lng).toBe(103.8322);
    expect(result?.postalCode).toBe('760356');
  });

  it('returns null for empty address or failed response', async () => {
    const empty = await geocodeSingaporeAddress('');
    expect(empty).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    } as any);

    const failed = await geocodeSingaporeAddress('nonexistent');
    expect(failed).toBeNull();
  });

  it('resolves and caches coordinates on saved place', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            LATITUDE: '1.3214',
            LONGITUDE: '103.8458',
            ADDRESS: '11 JALAN TAN TOCK SENG SINGAPORE 308433',
            POSTAL: '308433',
          },
        ],
      }),
    } as any);

    const unresolved: SavedPlace = { kind: 'healthcare', address: 'TTSH' };
    const resolved = await resolveSavedPlace(unresolved);

    expect(resolved?.lat).toBe(1.3214);
    expect(resolved?.lng).toBe(103.8458);

    // If already has lat/lng, does not re-fetch
    const alreadyResolved: SavedPlace = { kind: 'home', address: 'Home', lat: 1.3, lng: 103.8 };
    const skipped = await resolveSavedPlace(alreadyResolved);
    expect(skipped).toBe(alreadyResolved);
  });
});
