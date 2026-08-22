/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BatteryStatus } from '../types';

/**
 * Battery Status API wrapper with safe fallbacks.
 * Used to attach live phone battery telemetry to SOS dispatches and live
 * caregiver incidents, so responders know if the senior's phone is about
 * to power off. Not supported on iOS Safari / some desktop browsers.
 */
export async function getBatteryStatus(): Promise<BatteryStatus> {
  try {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      const battery = await nav.getBattery();
      return {
        level: Math.round((battery.level ?? 0) * 100),
        charging: Boolean(battery.charging),
        supported: true,
      };
    }
  } catch (e) {
    console.warn('Battery Status API unavailable:', e);
  }
  return { level: null, charging: null, supported: false };
}

/**
 * Subscribe to battery changes. Returns an unsubscribe function.
 */
export function watchBattery(onChange: (status: BatteryStatus) => void): () => void {
  let batteryRef: any = null;

  const handlers = {
    levelchange: () => update(),
    chargingchange: () => update(),
  };

  const update = () => {
    if (!batteryRef) return;
    onChange({
      level: Math.round((batteryRef.level ?? 0) * 100),
      charging: Boolean(batteryRef.charging),
      supported: true,
    });
  };

  try {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      nav.getBattery().then((battery: any) => {
        batteryRef = battery;
        battery.addEventListener('levelchange', handlers.levelchange);
        battery.addEventListener('chargingchange', handlers.chargingchange);
        update();
      }).catch(() => {});
    }
  } catch (e) {
    // Battery API unsupported — no-op
  }

  return () => {
    if (batteryRef) {
      batteryRef.removeEventListener('levelchange', handlers.levelchange);
      batteryRef.removeEventListener('chargingchange', handlers.chargingchange);
    }
  };
}
