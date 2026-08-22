/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedPlace, SavedPlaceKind } from '../types';

/** The three places the app asks every senior to set, in the order shown. */
export const SAVED_PLACE_KINDS: SavedPlaceKind[] = ['home', 'work', 'healthcare'];

export const SAVED_PLACE_META: Record<SavedPlaceKind, { emoji: string; title: string; hint: string }> = {
  home: {
    emoji: '🏠',
    title: 'Home',
    hint: 'Blk 123 Toa Payoh Lorong 1, S310123',
  },
  work: {
    emoji: '💼',
    title: 'Work',
    hint: 'Office, shop, or where you volunteer',
  },
  healthcare: {
    emoji: '🏥',
    title: 'Healthcare',
    hint: 'Your usual polyclinic or hospital',
  },
};

/** Short label for a place, preferring the friendly name the senior gave it. */
export function savedPlaceLabel(place: SavedPlace): string {
  return place.label?.trim() || SAVED_PLACE_META[place.kind].title;
}

/** Only places with an address are worth offering as a one-tap destination. */
export function usableSavedPlaces(places?: SavedPlace[] | null): SavedPlace[] {
  if (!places) return [];
  return places.filter((p) => p.address && p.address.trim().length > 0);
}

/**
 * Read the saved places back in a stable order, so Home is always first no
 * matter what order they were stored in.
 */
export function orderSavedPlaces(places?: SavedPlace[] | null): SavedPlace[] {
  const usable = usableSavedPlaces(places);
  return SAVED_PLACE_KINDS.map((kind) => usable.find((p) => p.kind === kind)).filter(
    (p): p is SavedPlace => Boolean(p)
  );
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  postalCode?: string;
}

/**
 * Resolve a Singapore address to coordinates through the server's OneMap
 * proxy. OneMap is the Singapore Land Authority's own gazetteer, so it
 * understands HDB block numbers and postal codes that generic geocoders miss.
 *
 * Returns null when the address cannot be resolved — the caller must not
 * invent a position for an address that does not exist.
 */
export async function geocodeSingaporeAddress(address: string): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    const res = await fetch(`/api/onemap/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;

    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) return null;

    const lat = Number(first.LATITUDE);
    const lng = Number(first.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      formattedAddress: first.ADDRESS || query,
      postalCode: first.POSTAL && first.POSTAL !== 'NIL' ? first.POSTAL : undefined,
    };
  } catch (err) {
    console.warn('OneMap geocoding failed for saved place:', err);
    return null;
  }
}

/**
 * Ensure a place has coordinates, geocoding it on demand. The resolved place is
 * returned rather than mutated so the caller can persist it.
 */
export async function resolveSavedPlace(place: SavedPlace): Promise<SavedPlace | null> {
  if (typeof place.lat === 'number' && typeof place.lng === 'number') return place;

  const geocoded = await geocodeSingaporeAddress(place.address);
  if (!geocoded) return null;

  return { ...place, lat: geocoded.lat, lng: geocoded.lng };
}
