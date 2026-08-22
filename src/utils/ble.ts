/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BLEBeaconScan, BLEScanState, BLECapability } from '../types';

/**
 * Real Bluetooth Low Energy beacon scanning via the Web Bluetooth API.
 *
 * Beacons advertise continuously; a browser can only listen after an explicit
 * user gesture. So this module keeps a long-lived scan session and a rolling
 * cache of what it has actually heard on the radio, which the app snapshots
 * whenever it runs a location verification. Nothing in here invents a reading:
 * if the radio hears nothing, the snapshot is empty.
 */

// ── Web Bluetooth scanning types (not yet in lib.dom.d.ts) ──────────────────

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

// ── Advertisement format constants ──────────────────────────────────────────

/** Apple's Bluetooth company identifier; iBeacon frames ride in its manufacturer data. */
const APPLE_COMPANY_ID = 0x004c;
const IBEACON_TYPE = 0x02;
const IBEACON_LENGTH = 0x15;

/** Eddystone's 16-bit service UUID (0xFEAA), expanded to the full base UUID. */
const EDDYSTONE_SERVICE_UUID = '0000feaa-0000-1000-8000-00805f9b34fb';
const EDDYSTONE_FRAME_UID = 0x00;
const EDDYSTONE_FRAME_TLM = 0x20;

/** Advertisements older than this are treated as out of range and dropped. */
const BEACON_STALE_MS = 30_000;

/** Persisted id of the senior's own paired safety pendant, if they have one. */
const PAIRED_TAG_STORAGE_KEY = 'senior_safespot_ble_tag';

// ── Known venue registry ────────────────────────────────────────────────────

/**
 * Lookup table that puts a human-readable place name to a beacon we genuinely
 * detected, keyed by its broadcast identity. It NEVER asserts that a beacon is
 * present — it only labels one the radio already heard, the way an OUI table
 * labels a MAC address.
 *
 * Populate this with the real identifiers of beacons actually deployed at a
 * venue. Entries whose ids never appear on air simply never match.
 */
export interface KnownVenueBeacon {
  /** iBeacon `uuid-major-minor`, or Eddystone `namespace-instance`, lowercased. */
  beaconKey: string;
  locationName: string;
  floorLevel?: string;
  zoneType: BLEBeaconScan['zoneType'];
  /** Surveyed position of the beacon itself, used to refine the pickup pin. */
  lat?: number;
  lng?: number;
  /** Calibrated RSSI at 1 metre, measured during install. Improves distance accuracy. */
  measuredPowerAt1m?: number;
}

export const KNOWN_VENUE_BEACONS: KnownVenueBeacon[] = [
  // Populate from a venue's beacon deployment records, e.g.:
  // {
  //   beaconKey: 'fda50693-a4e2-4fb1-afcf-c6eb07647825-1001-4',
  //   locationName: 'Toa Payoh Hub • Ground Floor Taxi Stand 1 Canopy',
  //   floorLevel: 'Level 1 (Ground)',
  //   zoneType: 'transit_hub',
  //   lat: 1.33275,
  //   lng: 103.84788,
  //   measuredPowerAt1m: -59,
  // },
];

function lookupKnownBeacon(beaconKey: string): KnownVenueBeacon | undefined {
  return KNOWN_VENUE_BEACONS.find((b) => b.beaconKey.toLowerCase() === beaconKey.toLowerCase());
}

// ── Capability detection ────────────────────────────────────────────────────

/**
 * Report exactly what this browser can do, so the UI can explain the real
 * reason scanning is unavailable instead of silently showing nothing.
 */
export async function getBLECapability(): Promise<BLECapability> {
  if (typeof navigator === 'undefined') {
    return { supported: false, canScan: false, canPairDevice: false, reason: 'Not running in a browser.' };
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      supported: false,
      canScan: false,
      canPairDevice: false,
      reason: 'Bluetooth needs a secure (HTTPS) connection.',
    };
  }

  const bluetooth = getBluetooth();
  if (!bluetooth) {
    return {
      supported: false,
      canScan: false,
      canPairDevice: false,
      reason:
        'This browser has no Web Bluetooth support. Beacon scanning works in Chrome or Edge on Android, Windows, macOS and Linux; Safari and all iOS browsers do not support it.',
    };
  }

  // A radio that exists but is switched off reports unavailable.
  let radioAvailable = true;
  try {
    if (bluetooth.getAvailability) {
      radioAvailable = await bluetooth.getAvailability();
    }
  } catch {
    radioAvailable = true; // Inconclusive; let the scan attempt produce the real error.
  }

  if (!radioAvailable) {
    return {
      supported: true,
      canScan: false,
      canPairDevice: false,
      reason: 'Bluetooth is turned off on this device. Switch it on to detect nearby beacons.',
    };
  }

  const canScan = typeof bluetooth.requestLEScan === 'function';
  const canPairDevice = typeof bluetooth.requestDevice === 'function';

  return {
    supported: true,
    canScan,
    canPairDevice,
    reason: canScan
      ? undefined
      : 'Passive beacon scanning is an experimental browser feature. Enable it at chrome://flags/#enable-experimental-web-platform-features, or pair the senior\'s safety tag directly instead.',
  };
}

// ── Distance estimation ─────────────────────────────────────────────────────

/**
 * Log-distance path loss model:
 *   d = 10 ^ ((measuredPower - rssi) / (10 * n))
 *
 * `measuredPower` is the beacon's calibrated RSSI at 1 metre — taken from the
 * advertisement's own txPower field when it broadcasts one, since a real
 * calibration beats any assumed constant. `n` of 2.4 suits cluttered indoor
 * spaces like malls and MRT concourses.
 */
export function calculateBLEProximity(
  rssi: number,
  measuredPowerAt1m = -59,
  pathLossExponent = 2.4
): { distanceMeters: number; proximity: BLEBeaconScan['proximity'] } {
  if (typeof rssi !== 'number' || Number.isNaN(rssi) || rssi === 0) {
    return { distanceMeters: 0, proximity: 'unknown' };
  }

  const ratio = (measuredPowerAt1m - rssi) / (10 * pathLossExponent);
  const raw = Math.pow(10, ratio);
  const distance = Math.max(0.1, Math.round(raw * 10) / 10);

  // Thresholds follow the iBeacon proximity bands.
  let proximity: BLEBeaconScan['proximity'];
  if (distance < 1) {
    proximity = 'immediate';
  } else if (distance <= 3) {
    proximity = 'near';
  } else {
    proximity = 'far';
  }

  return { distanceMeters: distance, proximity };
}

/** Eddystone TLM broadcasts battery voltage in millivolts; map it to a rough %. */
export function batteryPercentFromMillivolts(mv: number): number | undefined {
  if (!mv || mv < 1000 || mv > 4000) return undefined;
  // A CR2477 style cell runs about 3.0V full to 2.0V flat.
  const pct = Math.round(((mv - 2000) / (3000 - 2000)) * 100);
  return Math.max(0, Math.min(100, pct));
}

// ── Advertisement parsers ───────────────────────────────────────────────────

function bytesToHex(view: DataView, start: number, length: number): string {
  let hex = '';
  for (let i = start; i < start + length; i++) {
    hex += view.getUint8(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function formatUuid(hex32: string): string {
  return [
    hex32.slice(0, 8),
    hex32.slice(8, 12),
    hex32.slice(12, 16),
    hex32.slice(16, 20),
    hex32.slice(20, 32),
  ].join('-');
}

interface ParsedFrame {
  beaconKey: string;
  format: BLEBeaconScan['format'];
  uuid?: string;
  major?: number;
  minor?: number;
  /** Calibrated 1m RSSI the beacon broadcasts about itself. */
  txPower?: number;
  batteryPercent?: number;
}

/**
 * iBeacon payload, with Apple's company id already stripped by the browser:
 *   [0x02][0x15][uuid ×16][major ×2 BE][minor ×2 BE][txPower ×1 signed]
 */
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

/**
 * Eddystone frames share service UUID 0xFEAA and are told apart by their first
 * byte. UID carries identity; TLM carries battery telemetry for the same beacon.
 */
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

// ── Live scan session ───────────────────────────────────────────────────────

/** Everything the radio has heard recently, keyed by beacon identity. */
const liveBeacons = new Map<string, BLEBeaconScan>();

let activeScan: BluetoothLEScan | null = null;
let advertisementHandler: ((e: BluetoothAdvertisementEvent) => void) | null = null;
let scanState: BLEScanState = { status: 'idle', beaconCount: 0 };

type ScanListener = (state: BLEScanState, beacons: BLEBeaconScan[]) => void;
const listeners = new Set<ScanListener>();

/** Subscribe to scan state and beacon updates. Returns an unsubscribe function. */
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
  if (rssi === undefined) return; // Without signal strength there is no proximity to report.

  let parsed: ParsedFrame | null = null;

  // iBeacon frames arrive under Apple's company id.
  const appleData = event.manufacturerData?.get(APPLE_COMPANY_ID);
  if (appleData) {
    parsed = parseIBeacon(appleData);
  }

  // Otherwise look for an Eddystone service data frame.
  if (!parsed && event.serviceData) {
    const eddystoneData =
      event.serviceData.get(EDDYSTONE_SERVICE_UUID) ?? event.serviceData.get('feaa');
    if (eddystoneData) {
      parsed = parseEddystone(eddystoneData);
    }
  }

  // A plain BLE device (the senior's pendant, a fitness tag) still gives useful
  // proximity even though it broadcasts no beacon frame.
  const deviceName = event.name || event.device?.name;
  if (!parsed) {
    if (!deviceName) return; // Anonymous radio noise is not worth reporting.
    parsed = { beaconKey: event.device.id, format: 'generic' };
  }

  // A TLM frame has no identity of its own; attach its battery to the device.
  if (!parsed.beaconKey) {
    const existing = liveBeacons.get(event.device.id);
    if (existing && parsed.batteryPercent !== undefined) {
      existing.batteryPercent = parsed.batteryPercent;
      existing.lastSeen = Date.now();
      emit();
    }
    return;
  }

  const known = lookupKnownBeacon(parsed.beaconKey);
  const pairedTagId = getPairedTagId();
  const isPairedTag = pairedTagId !== null && event.device.id === pairedTagId;

  // Prefer the beacon's own broadcast calibration, then a surveyed one.
  const measuredPower = parsed.txPower ?? known?.measuredPowerAt1m ?? event.txPower ?? -59;
  const { distanceMeters, proximity } = calculateBLEProximity(rssi, measuredPower);

  const previous = liveBeacons.get(parsed.beaconKey);

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
    locationName: known?.locationName ?? (isPairedTag ? "Senior's paired safety tag" : deviceName || 'Unidentified nearby device'),
    floorLevel: known?.floorLevel,
    zoneType: known?.zoneType ?? (isPairedTag ? 'caregiver_tag' : 'unknown'),
    lat: known?.lat,
    lng: known?.lng,
    batteryPercent: parsed.batteryPercent ?? previous?.batteryPercent,
    format: parsed.format,
    isKnownVenue: Boolean(known),
    isPairedTag,
    lastSeen: Date.now(),
  });

  emit();
}

/**
 * Begin listening for beacon advertisements. Must be called from a user
 * gesture (a tap or click) — the browser rejects it otherwise.
 */
export async function startBeaconScan(): Promise<BLEScanState> {
  if (activeScan?.active) return scanState;

  const capability = await getBLECapability();
  if (!capability.canScan) {
    setScanState({ status: 'unavailable', beaconCount: 0, error: capability.reason });
    return scanState;
  }

  const bluetooth = getBluetooth();
  if (!bluetooth?.requestLEScan) {
    setScanState({ status: 'unavailable', beaconCount: 0, error: 'Beacon scanning is not available in this browser.' });
    return scanState;
  }

  try {
    setScanState({ status: 'requesting', beaconCount: 0 });

    advertisementHandler = (e: BluetoothAdvertisementEvent) => recordAdvertisement(e);
    bluetooth.addEventListener('advertisementreceived', advertisementHandler);

    activeScan = await bluetooth.requestLEScan({
      acceptAllAdvertisements: true,
      keepRepeatedDevices: true, // Repeat packets are how distance stays current.
    });

    setScanState({ status: 'scanning', beaconCount: liveBeacons.size });
  } catch (err: any) {
    if (advertisementHandler) {
      bluetooth.removeEventListener('advertisementreceived', advertisementHandler);
      advertisementHandler = null;
    }
    activeScan = null;

    const denied = err?.name === 'NotAllowedError';
    setScanState({
      status: denied ? 'denied' : 'unavailable',
      beaconCount: 0,
      error: denied
        ? 'Bluetooth scanning permission was declined.'
        : err?.message || 'Could not start Bluetooth scanning.',
    });
  }

  return scanState;
}

/** Stop listening and release the radio. */
export function stopBeaconScan(): void {
  const bluetooth = getBluetooth();
  if (activeScan?.active) {
    try {
      activeScan.stop();
    } catch {
      /* Scan already ended. */
    }
  }
  if (bluetooth && advertisementHandler) {
    bluetooth.removeEventListener('advertisementreceived', advertisementHandler);
  }
  activeScan = null;
  advertisementHandler = null;
  setScanState({ status: 'idle', beaconCount: 0 });
}

// ── Paired safety tag ───────────────────────────────────────────────────────

function getPairedTagId(): string | null {
  try {
    return localStorage.getItem(PAIRED_TAG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Let the senior or caregiver pick their own BLE safety pendant from the
 * browser's device chooser, then follow its advertisements. This works in
 * browsers that support Web Bluetooth but not the experimental scanning API,
 * and it is the only path that tracks a specific wearable rather than a venue.
 *
 * Must be called from a user gesture.
 */
export async function pairSafetyTag(): Promise<{ paired: boolean; name?: string; error?: string }> {
  const bluetooth = getBluetooth();
  if (!bluetooth?.requestDevice) {
    return { paired: false, error: 'This browser cannot pair Bluetooth devices.' };
  }

  try {
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service'],
    });

    try {
      localStorage.setItem(PAIRED_TAG_STORAGE_KEY, device.id);
    } catch {
      /* Storage unavailable; the tag still tracks for this session. */
    }

    // watchAdvertisements is supported more widely than requestLEScan, and
    // reports RSSI for this one device.
    if (typeof device.watchAdvertisements === 'function') {
      device.addEventListener('advertisementreceived', (e: BluetoothAdvertisementEvent) => {
        recordAdvertisement(e);
      });
      await device.watchAdvertisements();
      if (scanState.status === 'idle' || scanState.status === 'unavailable') {
        setScanState({ status: 'scanning', beaconCount: liveBeacons.size });
      }
    }

    return { paired: true, name: device.name || 'Safety tag' };
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      return { paired: false, error: 'No device was selected.' };
    }
    return { paired: false, error: err?.message || 'Could not pair the safety tag.' };
  }
}

export function forgetSafetyTag(): void {
  try {
    localStorage.removeItem(PAIRED_TAG_STORAGE_KEY);
  } catch {
    /* Nothing persisted. */
  }
}

// ── Snapshot API ────────────────────────────────────────────────────────────

/**
 * The beacons currently in range, strongest first. Anything not heard from in
 * the last {@link BEACON_STALE_MS} has gone out of range and is dropped.
 */
export function getNearbyBeacons(maxAgeMs = BEACON_STALE_MS): BLEBeaconScan[] {
  const cutoff = Date.now() - maxAgeMs;

  for (const [key, beacon] of liveBeacons) {
    if (beacon.lastSeen < cutoff) liveBeacons.delete(key);
  }

  return Array.from(liveBeacons.values()).sort((a, b) => b.rssi - a.rssi);
}

/** True when a beacon at a surveyed venue position is close enough to refine the pin. */
export function hasVenueGradePrecision(beacons: BLEBeaconScan[]): boolean {
  return beacons.some(
    (b) => b.isKnownVenue && b.lat !== undefined && b.lng !== undefined && b.estimatedDistanceMeters <= 3
  );
}

/**
 * Snapshot the beacons worth sending to location verification.
 *
 * Only registered venue beacons and the senior's own paired tag are included:
 * a stranger's earbuds are real radio traffic but say nothing about where the
 * senior is standing, and feeding them to the model would invite false claims.
 */
export function getBeaconsForVerification(): BLEBeaconScan[] {
  return getNearbyBeacons().filter((b) => b.isKnownVenue || b.isPairedTag);
}

export function getScanState(): BLEScanState {
  return scanState;
}

export function isWebBluetoothSupported(): boolean {
  return getBluetooth() !== null;
}
