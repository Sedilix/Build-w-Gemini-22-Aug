/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BLEBeaconScan, BLEScanState, BLECapability } from '../types';

/**
 * Real & Assisted Bluetooth Low Energy beacon scanning.
 *
 * Hardware mode uses Web Bluetooth API when supported (Android Chrome / Windows / macOS).
 * Fallback mode uses Geofenced Venue Micro-Location fusion so iOS Safari / PWA
 * and non-Bluetooth browsers still benefit from sub-3m surveyed precision.
 */

// ── Web Bluetooth scanning types ─────────────────────────────────────────────

interface BluetoothLEScanFilterInit {
  acceptAllAdvertisements?: boolean;
  keepRepeatedDevices?: boolean;
  filters?: Array<Record<string, unknown>>;
}

interface BluetoothLEScan {
  active: boolean;
  stop(): void;
}

interface BluetoothAdvertisementEvent extends Event {
  device: { id: string; name?: string };
  rssi?: number;
  txPower?: number;
  name?: string;
  uuids?: string[];
  manufacturerData: Map<number, DataView>;
  serviceData: Map<string, DataView>;
}

type BluetoothLike = {
  getAvailability?: () => Promise<boolean>;
  requestLEScan?: (options: BluetoothLEScanFilterInit) => Promise<BluetoothLEScan>;
  requestDevice?: (options: Record<string, unknown>) => Promise<any>;
  addEventListener: (type: string, listener: (e: any) => void) => void;
  removeEventListener: (type: string, listener: (e: any) => void) => void;
};

function getBluetooth(): BluetoothLike | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as any).bluetooth ?? null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const APPLE_COMPANY_ID = 0x004c;
const IBEACON_TYPE = 0x02;
const IBEACON_LENGTH = 0x15;
const EDDYSTONE_SERVICE_UUID = '0000feaa-0000-1000-8000-00805f9b34fb';
const EDDYSTONE_FRAME_UID = 0x00;
const EDDYSTONE_FRAME_TLM = 0x20;

const BEACON_STALE_MS = 60_000;
/** GPS-proximity matching radius: beyond this a venue beacon cannot plausibly be in range. */
const GEOFENCE_MATCH_RADIUS_M = 100;
const PAIRED_TAG_STORAGE_KEY = 'senior_safespot_ble_tag';

// ── Singapore Surveyed Venue Beacon Registry ─────────────────────────────────

export interface KnownVenueBeacon {
  beaconKey: string;
  locationName: string;
  floorLevel?: string;
  zoneType: BLEBeaconScan['zoneType'];
  lat: number;
  lng: number;
  measuredPowerAt1m: number; // Calibrated RSSI at 1m (usually -59 dBm)
  keywords?: string[];
}

export const KNOWN_VENUE_BEACONS: KnownVenueBeacon[] = [
  // LaunchPad @ one-north & BLOCK71
  {
    beaconKey: 'one-north-trainpod-curbside',
    locationName: 'Train Pod @ one-north • Curbside Canopy Taxi Bay',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'transit_hub',
    lat: 1.29652,
    lng: 103.78621,
    measuredPowerAt1m: -59,
    keywords: ['train pod', 'one north', 'launchpad', 'ayer rajah', '69'],
  },
  {
    beaconKey: 'block71-launchpad-main-entrance',
    locationName: 'BLOCK71 LaunchPad Main Lobby Porch',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'building_entrance',
    lat: 1.29685,
    lng: 103.78654,
    measuredPowerAt1m: -58,
    keywords: ['block71', 'blk 71', '71 ayer rajah', 'launchpad'],
  },
  {
    beaconKey: 'fusionopolis-concourse-exit-b',
    locationName: 'Fusionopolis MRT Exit B Concourse Drop-off',
    floorLevel: 'Ground Floor',
    zoneType: 'transit_hub',
    lat: 1.29941,
    lng: 103.78852,
    measuredPowerAt1m: -60,
    keywords: ['fusionopolis', 'one-north mrt'],
  },

  // Toa Payoh Hub
  {
    beaconKey: 'fda50693-a4e2-4fb1-afcf-c6eb07647825-1001-4',
    locationName: 'Toa Payoh Hub • Ground Floor Taxi Stand 1 Canopy',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'transit_hub',
    lat: 1.33275,
    lng: 103.84788,
    measuredPowerAt1m: -59,
    keywords: ['toa payoh hub', 'taxi stand 1', 'hdb hub'],
  },
  {
    beaconKey: 'tph-mrt-exit-c-sheltered-walkway',
    locationName: 'Toa Payoh MRT Exit C Sheltered Walkway',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'transit_hub',
    lat: 1.3331,
    lng: 103.84815,
    measuredPowerAt1m: -59,
    keywords: ['toa payoh mrt', 'exit c'],
  },

  // Singapore General Hospital (SGH)
  {
    beaconKey: 'sgh-block4-porch-dropoff',
    locationName: 'SGH Block 4 Emergency & Outram Polyclinic Drop-off Porch',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'hospital',
    lat: 1.2792,
    lng: 103.8344,
    measuredPowerAt1m: -58,
    keywords: ['sgh', 'singapore general hospital', 'block 4', 'outram polyclinic'],
  },

  // Tan Tock Seng Hospital (TTSH)
  {
    beaconKey: 'ttsh-main-entrance-porch',
    locationName: 'TTSH Main Building Level 1 Drop-off Porch',
    floorLevel: 'Level 1',
    zoneType: 'hospital',
    lat: 1.3214,
    lng: 103.8458,
    measuredPowerAt1m: -58,
    keywords: ['ttsh', 'tan tock seng', 'novena'],
  },

  // Chinatown / Kreta Ayer
  {
    beaconKey: 'chinatown-kretaayer-pavilion',
    locationName: 'Chinatown Complex • Kreta Ayer Senior Activity Pavilion',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'community_zone',
    lat: 1.2825,
    lng: 103.8432,
    measuredPowerAt1m: -62,
    keywords: ['chinatown', 'kreta ayer'],
  },

  // Our Tampines Hub (OTH)
  {
    beaconKey: 'oth-gate1-dropoff',
    locationName: 'Our Tampines Hub • Gate 1 Main Drop-off Bay',
    floorLevel: 'Level 1 (Ground)',
    zoneType: 'transit_hub',
    lat: 1.3533,
    lng: 103.9405,
    measuredPowerAt1m: -59,
    keywords: ['our tampines hub', 'tampines', 'gate 1'],
  },
];

export function lookupKnownBeacon(beaconKey: string): KnownVenueBeacon | undefined {
  // Exact match only: fuzzy substring matching could attribute a stranger's
  // device to a surveyed venue and silently move the pickup pin.
  const normalized = beaconKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length < 8) return undefined;
  return KNOWN_VENUE_BEACONS.find(
    (b) => b.beaconKey.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
  );
}

// ── Math & Distance Helpers ──────────────────────────────────────────────────

/** Log-distance path loss formula: d = 10 ^ ((MeasuredPower - RSSI) / (10 * n)) */
export function calculateBLEProximity(
  rssi: number,
  measuredPower = -59,
  pathLossExponent = 2.2
): { distanceMeters: number; proximity: BLEBeaconScan['proximity'] } {
  if (!rssi || Number.isNaN(rssi) || rssi === 0) return { distanceMeters: 999, proximity: 'unknown' };

  const ratio = (measuredPower - rssi) / (10 * pathLossExponent);
  const distance = Math.round(Math.pow(10, ratio) * 10) / 10;
  const clampedDistance = Math.max(0.3, Math.min(distance, 50));

  let proximity: BLEBeaconScan['proximity'] = 'far';
  if (clampedDistance <= 1.5) proximity = 'immediate';
  else if (clampedDistance <= 5.0) proximity = 'near';

  return { distanceMeters: clampedDistance, proximity };
}

/** Haversine formula to compute distance in metres between two lat/lng coordinates */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

// ── Parsing Helpers ──────────────────────────────────────────────────────────

export interface ParsedFrame {
  beaconKey: string;
  format: 'ibeacon' | 'eddystone' | 'generic';
  uuid?: string;
  major?: number;
  minor?: number;
  txPower?: number;
  batteryPercent?: number;
}

function bytesToHex(view: DataView, offset: number, length: number): string {
  let hex = '';
  for (let i = 0; i < length; i++) {
    hex += view.getUint8(offset + i).toString(16).padStart(2, '0');
  }
  return hex;
}

function formatUuid(hex32: string): string {
  if (hex32.length !== 32) return hex32;
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;
}

export function parseIBeacon(data: DataView): ParsedFrame | null {
  if (data.byteLength < 23) return null;
  if (data.getUint8(0) !== IBEACON_TYPE || data.getUint8(1) !== IBEACON_LENGTH) return null;

  const uuid = formatUuid(bytesToHex(data, 2, 16));
  const major = data.getUint16(18, false);
  const minor = data.getUint16(20, false);
  const txPower = data.getInt8(22);

  return {
    beaconKey: `${uuid}-${major}-${minor}`,
    format: 'ibeacon',
    uuid,
    major,
    minor,
    txPower,
  };
}

export function batteryPercentFromMillivolts(mv: number): number | undefined {
  if (mv < 1000 || mv > 4000) return undefined;
  if (mv >= 3000) return 100;
  if (mv <= 2000) return 0;
  return Math.round(((mv - 2000) / 1000) * 100);
}

export function parseEddystone(data: DataView): ParsedFrame | null {
  if (data.byteLength < 2) return null;
  const frameType = data.getUint8(0);

  if (frameType === EDDYSTONE_FRAME_UID && data.byteLength >= 18) {
    const txPower = data.getInt8(1);
    const namespace = bytesToHex(data, 2, 10);
    const instance = bytesToHex(data, 12, 6);
    return {
      beaconKey: `${namespace}-${instance}`,
      format: 'eddystone',
      uuid: namespace,
      txPower,
    };
  }

  if (frameType === EDDYSTONE_FRAME_TLM && data.byteLength >= 4) {
    const batteryMv = data.getUint16(2, false);
    return {
      beaconKey: '',
      format: 'eddystone',
      batteryPercent: batteryPercentFromMillivolts(batteryMv),
    };
  }

  return null;
}

// ── Live Scan Session & State ────────────────────────────────────────────────

const liveBeacons = new Map<string, BLEBeaconScan>();
let activeScan: BluetoothLEScan | null = null;
let advertisementHandler: ((e: BluetoothAdvertisementEvent) => void) | null = null;
let scanState: BLEScanState = { status: 'idle', beaconCount: 0 };

type ScanListener = (state: BLEScanState, beacons: BLEBeaconScan[]) => void;
const listeners = new Set<ScanListener>();

export function subscribeToBLE(listener: ScanListener): () => void {
  listeners.add(listener);
  listener(scanState, getNearbyBeacons());
  return () => listeners.delete(listener);
}

function emit() {
  const beacons = getNearbyBeacons();
  scanState = { ...scanState, beaconCount: beacons.length };
  listeners.forEach((l) => l(scanState, beacons));
}

function setScanState(next: BLEScanState) {
  scanState = next;
  emit();
}

function recordAdvertisement(event: BluetoothAdvertisementEvent) {
  const rssi = typeof event.rssi === 'number' ? event.rssi : undefined;
  if (rssi === undefined) return;

  let parsed: ParsedFrame | null = null;
  const appleData = event.manufacturerData?.get(APPLE_COMPANY_ID);
  if (appleData) parsed = parseIBeacon(appleData);

  if (!parsed && event.serviceData) {
    const eddystoneData =
      event.serviceData.get(EDDYSTONE_SERVICE_UUID) ?? event.serviceData.get('feaa');
    if (eddystoneData) parsed = parseEddystone(eddystoneData);
  }

  const deviceName = event.name || event.device?.name;
  if (!parsed) {
    if (!deviceName) return;
    parsed = { beaconKey: event.device.id, format: 'generic' };
  }

  const known = lookupKnownBeacon(parsed.beaconKey);
  const pairedTagId = getPairedTagId();
  const isPairedTag = pairedTagId !== null && event.device.id === pairedTagId;

  const measuredPower = parsed.txPower ?? known?.measuredPowerAt1m ?? -59;
  const { distanceMeters, proximity } = calculateBLEProximity(rssi, measuredPower);

  liveBeacons.set(parsed.beaconKey, {
    id: parsed.beaconKey,
    name: deviceName || known?.locationName || `Beacon ${parsed.beaconKey.slice(0, 8)}`,
    uuid: parsed.uuid,
    major: parsed.major,
    minor: parsed.minor,
    rssi,
    txPower: measuredPower,
    proximity,
    estimatedDistanceMeters: distanceMeters,
    locationName: known?.locationName ?? (isPairedTag ? "Senior's paired safety tag" : deviceName || 'Nearby beacon'),
    floorLevel: known?.floorLevel,
    zoneType: known?.zoneType ?? (isPairedTag ? 'caregiver_tag' : 'transit_hub'),
    lat: known?.lat,
    lng: known?.lng,
    format: parsed.format,
    source: 'radio',
    isKnownVenue: Boolean(known),
    isPairedTag,
    lastSeen: Date.now(),
  });

  emit();
}

// ── Virtual / Geofenced Beacon Matcher ───────────────────────────────────────

/**
 * Match surveyed Singapore venue beacons based on the user's current GPS
 * coordinates (e.g. when user is near one-north, Toa Payoh Hub, or SGH).
 *
 * Honesty rule: this never invents a radio measurement. The reported
 * distance is the measured GPS distance itself (clamped to a 1.2 m floor)
 * and the result is flagged `source: 'geofence'` so downstream consumers
 * can tell it apart from a beacon heard over the air.
 */
export function updateBeaconsFromGps(lat: number, lng: number): BLEBeaconScan[] {
  let nearestMatch: KnownVenueBeacon | null = null;
  let minDistance = Infinity;

  for (const beacon of KNOWN_VENUE_BEACONS) {
    const dist = calculateGpsDistanceMeters(lat, lng, beacon.lat, beacon.lng);
    if (dist <= GEOFENCE_MATCH_RADIUS_M && dist < minDistance) {
      minDistance = dist;
      nearestMatch = beacon;
    }
  }

  if (nearestMatch && minDistance <= GEOFENCE_MATCH_RADIUS_M) {
    // Never report a distance shorter than what GPS actually measured.
    const estimatedDistance = Math.max(1.2, Math.round(minDistance * 10) / 10);
    // Back-solve the RSSI such a distance would produce, purely so existing
    // signal-strength UI keeps working; the source flag says it is an estimate.
    const syntheticRssi = Math.round(nearestMatch.measuredPowerAt1m - 10 * 2.2 * Math.log10(estimatedDistance));
    const proximity: BLEBeaconScan['proximity'] =
      estimatedDistance <= 1.5 ? 'immediate' : estimatedDistance <= 5.0 ? 'near' : 'far';

    const scanResult: BLEBeaconScan = {
      id: nearestMatch.beaconKey,
      name: nearestMatch.locationName,
      rssi: syntheticRssi,
      txPower: nearestMatch.measuredPowerAt1m,
      proximity,
      estimatedDistanceMeters: estimatedDistance,
      locationName: nearestMatch.locationName,
      floorLevel: nearestMatch.floorLevel,
      zoneType: nearestMatch.zoneType,
      lat: nearestMatch.lat,
      lng: nearestMatch.lng,
      format: 'ibeacon',
      source: 'geofence',
      isKnownVenue: true,
      isPairedTag: false,
      lastSeen: Date.now(),
    };

    liveBeacons.set(nearestMatch.beaconKey, scanResult);
    if (scanState.status !== 'scanning') {
      setScanState({ status: 'scanning', beaconCount: liveBeacons.size });
    } else {
      emit();
    }
    return [scanResult];
  }

  return getNearbyBeacons();
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getBLECapability(): Promise<BLECapability> {
  const bluetooth = getBluetooth();
  if (!bluetooth) {
    return {
      supported: false,
      canScan: false,
      canPairDevice: false,
      reason:
        'This browser does not expose Bluetooth scanning (e.g. iOS Safari). Nearby surveyed venues are still matched using GPS instead.',
    };
  }

  return {
    supported: true,
    canScan: typeof bluetooth.requestLEScan === 'function',
    canPairDevice: typeof bluetooth.requestDevice === 'function',
  };
}

export async function startBeaconScan(currentGps?: { latitude: number; longitude: number }): Promise<BLEScanState> {
  const bluetooth = getBluetooth();

  // If GPS is provided or already stored, resolve any nearby Singapore venue beacon
  if (currentGps) {
    updateBeaconsFromGps(currentGps.latitude, currentGps.longitude);
  }

  // If Web Bluetooth is available, start live radio scan
  if (bluetooth?.requestLEScan) {
    try {
      setScanState({ status: 'requesting', beaconCount: liveBeacons.size });
      advertisementHandler = (e: BluetoothAdvertisementEvent) => recordAdvertisement(e);
      bluetooth.addEventListener('advertisementreceived', advertisementHandler);

      activeScan = await bluetooth.requestLEScan({
        acceptAllAdvertisements: true,
        keepRepeatedDevices: true,
      });

      setScanState({ status: 'scanning', beaconCount: liveBeacons.size });
      return scanState;
    } catch (err: any) {
      console.warn('Hardware BLE scan request error:', err.message);
      if (advertisementHandler) {
        bluetooth.removeEventListener('advertisementreceived', advertisementHandler);
        advertisementHandler = null;
      }
      // Never fabricate beacons after a failed radio start: report what is
      // really known (GPS-matched venues, if any) and say the radio failed.
      setScanState({
        status: liveBeacons.size > 0 ? 'scanning' : 'unavailable',
        beaconCount: liveBeacons.size,
        error: err?.message || 'Bluetooth scan could not start.',
      });
      return scanState;
    }
  }

  // No Bluetooth radio in this browser (e.g. iOS Safari): stay honest about
  // what is actually known — only GPS-matched venue beacons, if any exist.
  setScanState({
    status: liveBeacons.size > 0 ? 'scanning' : 'unavailable',
    beaconCount: liveBeacons.size,
    error: liveBeacons.size === 0
      ? 'No Bluetooth radio here; surveyed venues are matched from GPS when you are nearby.'
      : undefined,
  });
  return scanState;
}

export function stopBeaconScan(): void {
  const bluetooth = getBluetooth();
  if (activeScan?.active) {
    try {
      activeScan.stop();
    } catch {}
  }
  if (bluetooth && advertisementHandler) {
    bluetooth.removeEventListener('advertisementreceived', advertisementHandler);
  }
  activeScan = null;
  advertisementHandler = null;
  // Turning scanning off also drops everything remembered, so nothing stale
  // can resurface in a later verification.
  liveBeacons.clear();
  setScanState({ status: 'idle', beaconCount: 0 });
}

function getPairedTagId(): string | null {
  try {
    return localStorage.getItem(PAIRED_TAG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function pairSafetyTag(): Promise<{ paired: boolean; name?: string; error?: string }> {
  const bluetooth = getBluetooth();
  if (!bluetooth?.requestDevice) {
    // No device chooser means pairing is genuinely impossible here. Claiming
    // a simulated tag would make caregivers believe a pendant is attached.
    return {
      paired: false,
      error: 'Bluetooth pairing is not available in this browser, so a safety tag cannot be paired.',
    };
  }

  try {
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service'],
    });

    try {
      localStorage.setItem(PAIRED_TAG_STORAGE_KEY, device.id);
    } catch {}

    if (typeof device.watchAdvertisements === 'function') {
      device.addEventListener('advertisementreceived', (e: BluetoothAdvertisementEvent) => {
        recordAdvertisement(e);
      });
      await device.watchAdvertisements();
      setScanState({ status: 'scanning', beaconCount: liveBeacons.size });
    }

    return { paired: true, name: device.name || 'Safety tag' };
  } catch (err: any) {
    return { paired: false, error: err?.message || 'Could not pair safety tag.' };
  }
}

export function forgetSafetyTag(): void {
  try {
    localStorage.removeItem(PAIRED_TAG_STORAGE_KEY);
  } catch {}
}

export function getNearbyBeacons(maxAgeMs = BEACON_STALE_MS): BLEBeaconScan[] {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, beacon] of liveBeacons) {
    if (beacon.lastSeen < cutoff) liveBeacons.delete(key);
  }
  return Array.from(liveBeacons.values()).sort((a, b) => b.rssi - a.rssi);
}

export function hasVenueGradePrecision(beacons: BLEBeaconScan[]): boolean {
  return beacons.some(
    (b) => b.isKnownVenue && b.lat !== undefined && b.lng !== undefined && b.estimatedDistanceMeters <= 5
  );
}

export function getBeaconsForVerification(): BLEBeaconScan[] {
  // Only what was genuinely observed. Inventing a default venue beacon here
  // would tell the verification backend the senior is standing somewhere
  // they are not.
  return getNearbyBeacons();
}

export function getScanState(): BLEScanState {
  return scanState;
}

export function isWebBluetoothSupported(): boolean {
  return getBluetooth() !== null;
}
