/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-Platform High-G Crash & Fall Detection Engine (iOS Safari & Android Chrome)
 *
 * Implements Apple CoreMotion / Google Safety style sensor fusion:
 * 1. High-G Accelerometer Impact Vector (Spikes > 3.2G / 32 m/s²)
 * 2. Pre-impact Vehicle Velocity Analysis (GPS Speed > 20 km/h)
 * 3. Rotational Velocity / Rollover detection (Gyroscope > 300°/s)
 * 4. Free-fall weightlessness detection (< 3 m/s² before ground strike)
 * 5. Web Audio Emergency Siren Synthesizer
 */

export interface CrashEventData {
  type: 'crash' | 'fall';
  impactGForce: number; // in Gs (e.g. 3.6G)
  speedKmh: number; // in km/h
  rotationRateDps: number; // in deg/s
  timestamp: number;
}

export function isMotionDetectionSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

/**
 * Request iOS 13+ motion permission. Must be triggered from a user gesture (tap/click).
 */
export async function ensureMotionPermission(): Promise<boolean> {
  try {
    const DME = (window as any).DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function') {
      const result = await DME.requestPermission();
      return result === 'granted';
    }
    return isMotionDetectionSupported();
  } catch (e) {
    console.warn('DeviceMotion permission request:', e);
    return false;
  }
}

// Global vehicle speed buffer (m/s) updated from Geolocation watch
let latestSpeedMs = 0;
export function updateMotionGpsSpeed(speedInMetersPerSec: number | null) {
  if (typeof speedInMetersPerSec === 'number' && !isNaN(speedInMetersPerSec)) {
    latestSpeedMs = Math.max(0, speedInMetersPerSec);
  }
}

export interface MotionDetectionHandle {
  stop: () => void;
}

/**
 * Start listening for severe vehicle collisions and elderly falls.
 */
export function startCrashAndFallDetection(
  onImpactDetected: (data: CrashEventData) => void
): MotionDetectionHandle | null {
  if (!isMotionDetectionSupported()) {
    console.warn('DeviceMotionEvent unsupported — crash & fall sensors inactive.');
    return null;
  }

  let lastTriggerAt = 0;
  let weightlessPhase = false;
  let weightlessTimer: any = null;

  const handler = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    // Calculate instantaneous 3D G-Force vector
    const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const deviationFrom1G = Math.abs(totalAcc - 9.8);
    const gForce = Math.round((totalAcc / 9.8) * 10) / 10;

    // Detect free-fall weightlessness (< 0.35G / 3.5 m/s²) preceding an elder slip
    if (totalAcc < 3.5 && !weightlessPhase) {
      weightlessPhase = true;
      clearTimeout(weightlessTimer);
      weightlessTimer = setTimeout(() => {
        weightlessPhase = false;
      }, 750);
    }

    // Angular velocity from Gyroscope (if available)
    const rot = event.rotationRate;
    const rotationRateDps = rot && rot.alpha !== null && rot.beta !== null && rot.gamma !== null
      ? Math.sqrt(rot.alpha * rot.alpha + rot.beta * rot.beta + rot.gamma * rot.gamma)
      : 0;

    const speedKmh = Math.round(latestSpeedMs * 3.6);
    const now = Date.now();

    // 1. HIGH-G VEHICLE CRASH DETECTION (Google Safety / Apple CoreMotion Pattern)
    // Speed >= 20 km/h + Impact >= 3.2G OR High Rotational Swerve (> 300°/s) + Impact >= 3.0G
    if (
      (speedKmh >= 20 && deviationFrom1G >= 28) ||
      (deviationFrom1G >= 35 && rotationRateDps > 300) ||
      deviationFrom1G >= 45 // Extreme shock > 4.5G
    ) {
      if (now - lastTriggerAt > 10000) {
        lastTriggerAt = now;
        onImpactDetected({
          type: 'crash',
          impactGForce: gForce,
          speedKmh,
          rotationRateDps: Math.round(rotationRateDps),
          timestamp: now,
        });
        return;
      }
    }

    // 2. ELDERLY SLIP & FALL DETECTION
    // Freefall drop followed by ground impact (> 22 m/s² deviation / ~2.3G)
    if (deviationFrom1G >= 22 || (weightlessPhase && deviationFrom1G >= 18)) {
      if (now - lastTriggerAt > 8000) {
        lastTriggerAt = now;
        weightlessPhase = false;
        onImpactDetected({
          type: 'fall',
          impactGForce: gForce,
          speedKmh,
          rotationRateDps: Math.round(rotationRateDps),
          timestamp: now,
        });
      }
    }
  };

  window.addEventListener('devicemotion', handler, { passive: true });

  return {
    stop: () => {
      window.removeEventListener('devicemotion', handler);
      clearTimeout(weightlessTimer);
    },
  };
}

/**
 * Web Audio API Oscillating Emergency Alarm Siren
 * Generates an attention-grabbing two-tone European/Singapore emergency siren
 */
let audioCtx: AudioContext | null = null;
let sirenInterval: any = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

export function playEmergencyAlarmSiren() {
  stopEmergencyAlarmSiren();
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime); // Comfortable volume

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();

    // Toggle between 880Hz and 660Hz every 400ms
    let isHigh = true;
    sirenInterval = setInterval(() => {
      if (!audioCtx || !oscillator) return;
      const targetFreq = isHigh ? 660 : 880;
      oscillator.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.05);
      isHigh = !isHigh;
    }, 400);
  } catch (e) {
    console.warn('Emergency siren playback failed:', e);
  }
}

export function stopEmergencyAlarmSiren() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (oscillator) {
    try {
      oscillator.stop();
      oscillator.disconnect();
    } catch {}
    oscillator = null;
  }
  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch {}
    gainNode = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch {}
    audioCtx = null;
  }
}
