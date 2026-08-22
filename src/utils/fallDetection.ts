/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Web accelerometer fall / sudden-deceleration sensor.
 * Uses DeviceMotionEvent to detect a hard impact (e.g. phone dropped with the
 * senior) and hands control back to the UI, which runs a 10-second reassuring
 * cancelable countdown before dialing 995.
 *
 * iOS Safari requires an explicit user-gesture permission grant, so call
 * `ensureMotionPermission()` from a tap handler before `startFallDetection()`.
 */

// Peak acceleration (m/s^2) considered a hard fall impact. ~2.5g spike.
const FALL_IMPACT_THRESHOLD = 25;

export function isFallDetectionSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

/**
 * Request iOS motion permission if needed. Resolves true when access is granted.
 */
export async function ensureMotionPermission(): Promise<boolean> {
  try {
    const DME = (window as any).DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function') {
      const result = await DME.requestPermission();
      return result === 'granted';
    }
    return isFallDetectionSupported();
  } catch (e) {
    console.warn('DeviceMotion permission request failed:', e);
    return false;
  }
}

export interface FallDetectionHandle {
  stop: () => void;
}

/**
 * Start monitoring for sudden impacts. `onFallDetected` fires once per
 * detection event; the UI is responsible for the countdown + cancellation UX.
 * Debounces repeated spikes for 5 seconds after a trigger.
 */
export function startFallDetection(onFallDetected: () => void): FallDetectionHandle | null {
  if (!isFallDetectionSupported()) {
    console.warn('DeviceMotionEvent unavailable — fall detection disabled.');
    return null;
  }

  let lastTriggerAt = 0;

  const handler = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    // Resting gravity reads ~9.8 m/s^2; a fall impact produces a large spike.
    const deviation = Math.abs(magnitude - 9.8);

    if (deviation >= FALL_IMPACT_THRESHOLD) {
      const now = Date.now();
      if (now - lastTriggerAt > 5000) {
        lastTriggerAt = now;
        onFallDetected();
      }
    }
  };

  window.addEventListener('devicemotion', handler);

  return {
    stop: () => {
      window.removeEventListener('devicemotion', handler);
    },
  };
}
