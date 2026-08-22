/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-Platform High-G Crash & Fall Detection Engine
 *
 * A trigger here ends in an automatic call to SCDF 995, so the cost of a false
 * positive is a wasted ambulance dispatch. Every rule below therefore needs a
 * second signal beyond raw impact force: a dropped phone hits far harder than a
 * falling person, and impact magnitude alone cannot tell them apart.
 *
 * 1. Vehicle crash: high-G impact while GPS says the senior was actually moving
 * 2. Rollover: extreme impact combined with high angular velocity
 * 3. Fall: weightlessness (the drop) followed by a ground strike within ~1.2s
 * 4. Web Audio emergency siren synthesizer
 */

/** Standard gravity, m/s². Device motion is reported in m/s². */
const GRAVITY = 9.80665;

// ── Detection thresholds, all in G so they can be read against the comments ──

/** Impact that counts as a crash when the vehicle was moving. */
const CRASH_IMPACT_G = 6.0;
/** Below this speed a high-G reading is treated as a dropped phone, not a crash. */
const CRASH_MIN_SPEED_KMH = 25;
/** Angular velocity indicating a spin or rollover, deg/s. */
const CRASH_ROLLOVER_DPS = 300;
/** Impact severe enough to be a crash on rotation alone, with no GPS speed. */
const CRASH_SEVERE_G = 8.0;

/** Ground strike that counts as a fall, but only after a freefall phase. */
const FALL_IMPACT_G = 2.8;
/** Near-weightlessness marking the drop itself. */
const FREEFALL_G = 0.4;
/** A ground strike this long after freefall is no longer part of the same fall. */
const FREEFALL_WINDOW_MS = 1250;

/** GPS speed older than this is treated as unknown rather than current. */
const SPEED_STALE_MS = 15_000;
/** Minimum gap between two alerts, so one impact cannot fire repeatedly. */
const TRIGGER_COOLDOWN_MS = 10_000;

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
 * iOS 13+ gates motion sensors behind a permission prompt that only opens from
 * a user gesture. Callers must know this, because requesting at page load
 * silently rejects and leaves detection permanently inactive.
 */
export function motionPermissionNeedsGesture(): boolean {
  if (typeof window === 'undefined') return false;
  const DME = (window as any).DeviceMotionEvent;
  return Boolean(DME && typeof DME.requestPermission === 'function');
}

/**
 * Request iOS 13+ motion permission. Must be called from a user gesture
 * (tap/click) whenever {@link motionPermissionNeedsGesture} is true.
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

// ── GPS speed buffer ────────────────────────────────────────────────────────

let latestSpeedMs = 0;
let latestSpeedAt = 0;

/**
 * Feed in GPS speed. A null reading means the device could not measure speed,
 * which is not the same as standing still, so it is recorded as unknown and
 * allowed to go stale rather than holding the last value forever.
 */
export function updateMotionGpsSpeed(speedInMetersPerSec: number | null) {
  if (typeof speedInMetersPerSec === 'number' && !isNaN(speedInMetersPerSec)) {
    latestSpeedMs = Math.max(0, speedInMetersPerSec);
    latestSpeedAt = Date.now();
  }
}

/**
 * Current speed in km/h, or 0 once the last fix is too old to trust. Without
 * this decay a single highway reading would keep the crash speed gate open
 * indefinitely, long after the journey ended.
 */
export function getCurrentSpeedKmh(now = Date.now()): number {
  if (!latestSpeedAt || now - latestSpeedAt > SPEED_STALE_MS) return 0;
  return Math.round(latestSpeedMs * 3.6);
}

/** Clear the speed buffer. Exported for tests and for stopping detection. */
export function resetMotionSpeed() {
  latestSpeedMs = 0;
  latestSpeedAt = 0;
}

// ── Impact classification ───────────────────────────────────────────────────

export interface ImpactSample {
  /** Total acceleration magnitude including gravity, in G. 1.0 at rest, 0 in freefall. */
  gForce: number;
  /** Angular velocity magnitude in deg/s, 0 when no gyroscope is present. */
  rotationRateDps: number;
  /** Current GPS speed in km/h, already staleness-checked. */
  speedKmh: number;
  /** Whether near-weightlessness was observed within the freefall window. */
  hadRecentFreefall: boolean;
}

/**
 * Decide whether a motion sample is a crash, a fall, or neither.
 *
 * Pure and exported so the thresholds can be tested directly — the numbers
 * decide whether an ambulance is called, so they need to be verifiable without
 * shaking a phone.
 */
export function classifyImpact(sample: ImpactSample): 'crash' | 'fall' | null {
  const { gForce, rotationRateDps, speedKmh, hadRecentFreefall } = sample;

  // A crash needs corroboration that the senior was actually travelling.
  if (speedKmh >= CRASH_MIN_SPEED_KMH && gForce >= CRASH_IMPACT_G) {
    return 'crash';
  }

  // Or a violent impact with the spin of a rollover, which a dropped phone
  // landing flat does not produce.
  if (gForce >= CRASH_SEVERE_G && rotationRateDps >= CRASH_ROLLOVER_DPS) {
    return 'crash';
  }

  // A fall is the drop then the landing. Requiring the freefall phase is what
  // separates a person going down from a phone being set down hard.
  if (hadRecentFreefall && gForce >= FALL_IMPACT_G) {
    return 'fall';
  }

  return null;
}

export interface MotionDetectionHandle {
  stop: () => void;
}

/**
 * Start listening for severe vehicle collisions and elderly falls.
 *
 * On iOS this must be called only after {@link ensureMotionPermission} has
 * resolved true from within a user gesture.
 */
export function startCrashAndFallDetection(
  onImpactDetected: (data: CrashEventData) => void
): MotionDetectionHandle | null {
  if (!isMotionDetectionSupported()) {
    console.warn('DeviceMotionEvent unsupported — crash & fall sensors inactive.');
    return null;
  }

  let lastTriggerAt = 0;
  let lastFreefallAt = 0;

  const handler = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const gForce = totalAcc / GRAVITY;
    const now = Date.now();

    // Note the drop as it happens; the landing arrives a beat later.
    if (gForce < FREEFALL_G) {
      lastFreefallAt = now;
      return; // Weightlessness is never itself the impact.
    }

    const rot = event.rotationRate;
    const rotationRateDps =
      rot && rot.alpha !== null && rot.beta !== null && rot.gamma !== null
        ? Math.sqrt(rot.alpha * rot.alpha + rot.beta * rot.beta + rot.gamma * rot.gamma)
        : 0;

    const speedKmh = getCurrentSpeedKmh(now);

    const verdict = classifyImpact({
      gForce,
      rotationRateDps,
      speedKmh,
      hadRecentFreefall: now - lastFreefallAt <= FREEFALL_WINDOW_MS,
    });

    if (!verdict) return;
    if (now - lastTriggerAt < TRIGGER_COOLDOWN_MS) return;

    lastTriggerAt = now;
    lastFreefallAt = 0;

    onImpactDetected({
      type: verdict,
      impactGForce: Math.round(gForce * 10) / 10,
      speedKmh,
      rotationRateDps: Math.round(rotationRateDps),
      timestamp: now,
    });
  };

  window.addEventListener('devicemotion', handler, { passive: true });

  return {
    stop: () => {
      window.removeEventListener('devicemotion', handler);
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
