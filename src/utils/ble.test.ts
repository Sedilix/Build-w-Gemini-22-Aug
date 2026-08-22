/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBLEProximity,
  parseIBeacon,
  parseEddystone,
  batteryPercentFromMillivolts,
  hasVenueGradePrecision,
} from './ble';
import { BLEBeaconScan } from '../types';

/** Build a DataView from a byte array, the way an advertisement arrives. */
function view(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

describe('calculateBLEProximity', () => {
  it('returns about 1m when the signal matches the calibrated 1m power', () => {
    const { distanceMeters } = calculateBLEProximity(-59, -59);
    expect(distanceMeters).toBeCloseTo(1, 1);
  });

  it('reports immediate for a strong close-range signal', () => {
    const { distanceMeters, proximity } = calculateBLEProximity(-45, -59);
    expect(distanceMeters).toBeLessThan(1);
    expect(proximity).toBe('immediate');
  });

  it('reports far for a weak signal', () => {
    const { distanceMeters, proximity } = calculateBLEProximity(-95, -59);
    expect(distanceMeters).toBeGreaterThan(3);
    expect(proximity).toBe('far');
  });

  it('weakens distance monotonically as rssi drops', () => {
    const near = calculateBLEProximity(-50, -59).distanceMeters;
    const mid = calculateBLEProximity(-70, -59).distanceMeters;
    const far = calculateBLEProximity(-90, -59).distanceMeters;
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
  });

  it('reports unknown rather than inventing a distance when rssi is absent', () => {
    expect(calculateBLEProximity(0).proximity).toBe('unknown');
    expect(calculateBLEProximity(NaN).proximity).toBe('unknown');
  });
});

describe('parseIBeacon', () => {
  // Type 0x02, length 0x15, 16-byte UUID, major 1001, minor 4, txPower -59.
  const uuidBytes = [
    0xfd, 0xa5, 0x06, 0x93, 0xa4, 0xe2, 0x4f, 0xb1,
    0xaf, 0xcf, 0xc6, 0xeb, 0x07, 0x64, 0x78, 0x25,
  ];
  const frame = [0x02, 0x15, ...uuidBytes, 0x03, 0xe9, 0x00, 0x04, 0xc5];

  it('decodes uuid, major, minor and txPower from a real frame layout', () => {
    const parsed = parseIBeacon(view(frame));
    expect(parsed).not.toBeNull();
    expect(parsed!.uuid).toBe('fda50693-a4e2-4fb1-afcf-c6eb07647825');
    expect(parsed!.major).toBe(1001);
    expect(parsed!.minor).toBe(4);
    expect(parsed!.txPower).toBe(-59); // 0xc5 as a signed byte
    expect(parsed!.beaconKey).toBe('fda50693-a4e2-4fb1-afcf-c6eb07647825-1001-4');
    expect(parsed!.format).toBe('ibeacon');
  });

  it('rejects a frame that is not an iBeacon', () => {
    expect(parseIBeacon(view([0x09, 0x15, 0x00, 0x00]))).toBeNull();
  });

  it('rejects a truncated frame instead of reading past the end', () => {
    expect(parseIBeacon(view([0x02, 0x15, 0x00, 0x01]))).toBeNull();
  });
});

describe('parseEddystone', () => {
  it('decodes a UID frame into a namespace-instance key', () => {
    const uid = [
      0x00, 0xc5,
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, // 10-byte namespace
      11, 12, 13, 14, 15, 16, // 6-byte instance
    ];
    const parsed = parseEddystone(view(uid));
    expect(parsed).not.toBeNull();
    expect(parsed!.beaconKey).toBe('0102030405060708090a-0b0c0d0e0f10');
    expect(parsed!.txPower).toBe(-59);
    expect(parsed!.format).toBe('eddystone');
  });

  it('decodes battery voltage from a TLM frame', () => {
    // Frame type 0x20, version 0x00, 2900 mV big-endian.
    const parsed = parseEddystone(view([0x20, 0x00, 0x0b, 0x54]));
    expect(parsed).not.toBeNull();
    expect(parsed!.batteryPercent).toBe(90);
  });

  it('returns null for an unrecognised frame type', () => {
    expect(parseEddystone(view([0x99, 0x00]))).toBeNull();
  });
});

describe('batteryPercentFromMillivolts', () => {
  it('clamps to the 0-100 range', () => {
    expect(batteryPercentFromMillivolts(3000)).toBe(100);
    expect(batteryPercentFromMillivolts(2000)).toBe(0);
    expect(batteryPercentFromMillivolts(1500)).toBe(0);
  });

  it('ignores implausible readings', () => {
    expect(batteryPercentFromMillivolts(0)).toBeUndefined();
    expect(batteryPercentFromMillivolts(9000)).toBeUndefined();
  });
});

describe('hasVenueGradePrecision', () => {
  const base: BLEBeaconScan = {
    id: 'b1',
    name: 'Beacon',
    rssi: -55,
    proximity: 'immediate',
    estimatedDistanceMeters: 1.2,
    locationName: 'Taxi stand',
    zoneType: 'transit_hub',
    format: 'ibeacon',
    isKnownVenue: true,
    isPairedTag: false,
    lastSeen: Date.now(),
    lat: 1.33,
    lng: 103.84,
  };

  it('is true for a close registered beacon with a surveyed position', () => {
    expect(hasVenueGradePrecision([base])).toBe(true);
  });

  it('is false for an unregistered device however strong its signal', () => {
    expect(hasVenueGradePrecision([{ ...base, isKnownVenue: false }])).toBe(false);
  });

  it('is false for a registered beacon with no surveyed position', () => {
    expect(hasVenueGradePrecision([{ ...base, lat: undefined, lng: undefined }])).toBe(false);
  });

  it('is false when the nearest registered beacon is too far to refine the pin', () => {
    expect(hasVenueGradePrecision([{ ...base, estimatedDistanceMeters: 12 }])).toBe(false);
  });

  it('is false with nothing in range', () => {
    expect(hasVenueGradePrecision([])).toBe(false);
  });
});
