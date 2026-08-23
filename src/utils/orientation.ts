/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Phase 1 — shutter-time sensor metadata.
 *
 * Browsers never expose barometer pressure or lens focal length (those live
 * behind CMAltimeter / Sensor.TYPE_PRESSURE and the native camera HAL), so
 * the web-feasible payload is compass heading + pitch + roll, frozen at the
 * exact millisecond the senior taps "Pick Me Up Here!".
 */

export interface OrientationSnapshot {
  /** Compass heading, degrees clockwise from north (0..360); null without compass data. */
  heading: number | null;
  /** Fore-aft tilt in degrees; ≈90 when the phone is held upright to shoot. */
  pitch: number | null;
  /** Side-to-side tilt in degrees; 0 when the frame is level. */
  roll: number | null;
  capturedAt: number;
}

interface RawOrientation {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  webkitCompassHeading?: number;
}

let latest: RawOrientation | null = null;
let tracking = false;

function handleOrientation(e: DeviceOrientationEvent) {
  latest = {
    alpha: e.alpha,
    beta: e.beta,
    gamma: e.gamma,
    webkitCompassHeading: (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading,
  };
}

export function startOrientationTracking(): void {
  if (tracking || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
  window.addEventListener('deviceorientation', handleOrientation);
  tracking = true;
}

export function stopOrientationTracking(): void {
  if (!tracking || typeof window === 'undefined') return;
  window.removeEventListener('deviceorientation', handleOrientation);
  tracking = false;
}

/** iOS 13+ gates compass events behind a permission that only a user gesture can request. */
export function orientationPermissionNeeded(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
  );
}

/**
 * Call from inside the shutter tap (a user gesture) so iOS shows its prompt.
 * Also arms the listener everywhere else, where no prompt is required.
 */
export async function ensureOrientationPermission(): Promise<boolean> {
  startOrientationTracking();
  if (!orientationPermissionNeeded()) return true;
  try {
    const state = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
    return state === 'granted';
  } catch (err) {
    console.warn('Device orientation permission request failed:', err);
    return false;
  }
}

/** Freeze the latest sensor values at the exact shutter millisecond. */
export function getOrientationSnapshot(): OrientationSnapshot {
  if (!latest) {
    return { heading: null, pitch: null, roll: null, capturedAt: Date.now() };
  }
  const iosHeading =
    typeof latest.webkitCompassHeading === 'number' && !Number.isNaN(latest.webkitCompassHeading)
      ? latest.webkitCompassHeading
      : null;
  // iOS reports magnetic north directly; everyone else we derive from alpha.
  const heading = iosHeading ?? (latest.alpha != null ? (360 - latest.alpha) % 360 : null);
  return {
    heading: heading != null ? Math.round(heading * 10) / 10 : null,
    pitch: latest.beta != null ? Math.round(latest.beta * 10) / 10 : null,
    roll: latest.gamma != null ? Math.round(latest.gamma * 10) / 10 : null,
    capturedAt: Date.now(),
  };
}

/** Side-to-side tilt beyond this produces a visibly canted frame. */
export const LEVEL_ROLL_TOLERANCE_DEG = 20;

export function isSteadyCapture(s: OrientationSnapshot): boolean {
  return s.roll == null || Math.abs(s.roll) <= LEVEL_ROLL_TOLERANCE_DEG;
}
