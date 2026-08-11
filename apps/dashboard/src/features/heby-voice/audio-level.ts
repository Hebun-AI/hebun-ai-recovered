/*
 * heby-voice/audio-level.ts — turning a real microphone waveform into ONE bounded number.
 *
 * WHY THIS IS A SEPARATE, PURE FILE. The presence field must be provably driven by measurement and
 * nothing else. Keeping the arithmetic here — with no timers, no randomness, no defaults that drift
 * upward, and no access to the AudioContext — means the honesty claim can be TESTED rather than
 * reviewed: feed it silence and it returns ~0; feed it nothing and it returns 0.
 *
 * WHAT THE INPUT IS. Web Audio's `getByteTimeDomainData` fills a byte array where 128 is silence and
 * each sample's distance from 128 is its instantaneous displacement. RMS of those displacements is
 * a loudness measure — not a decibel value, and deliberately not fed to presentation raw.
 *
 * Pure: no DOM, no Web Audio, no I/O, no state.
 */

/** Byte-domain silence. Web Audio centres an 8-bit waveform on 128. */
const SILENCE = 128;

/**
 * Full-scale RMS displacement in byte units. A sine at digital full scale gives ~90, but ordinary
 * speech at a sane input gain sits far below that, so mapping 90 → 1.0 would leave the orb nearly
 * inert. This divisor is the SPEAKING reference, chosen so normal conversational level reaches the
 * upper part of the range while the result is still clamped rather than allowed past 1.
 */
const SPEECH_REFERENCE = 34;

/**
 * The floor below which a reading is treated as silence. Microphone preamps are never perfectly
 * quiet; without this, a muted room would hold the orb at a permanent faint shimmer, which would be
 * a lie about there being sound. Below the floor the answer is exactly 0.
 */
const NOISE_FLOOR = 0.012;

/**
 * Normalize one frame of real time-domain microphone data to 0–1.
 *
 * Returns exactly 0 for an empty frame — "no data" is never allowed to become "a little bit of
 * sound". The result is clamped, so a loud transient saturates instead of overshooting the contract.
 */
export function normalizeAudioLevel(frame: ArrayLike<number>): number {
  const count = frame.length;
  if (count === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < count; i++) {
    const displacement = (frame[i] ?? SILENCE) - SILENCE;
    sumSquares += displacement * displacement;
  }

  const rms = Math.sqrt(sumSquares / count);
  const level = rms / SPEECH_REFERENCE;
  if (level < NOISE_FLOOR) return 0;
  return level > 1 ? 1 : level;
}

/**
 * How fast the displayed level may rise and fall. Attack is quick so speech onset is felt; release
 * is slower so the orb settles instead of strobing on every syllable gap. Both are pure ratios
 * applied per frame — there is no timer here, and no motion is produced when the input stops
 * changing.
 */
const ATTACK = 0.45;
const RELEASE = 0.12;

/**
 * One step of restrained smoothing toward a new measurement.
 *
 * Asymmetric on purpose: the orb should feel organic, not like a level meter. It is still driven
 * ENTIRELY by measurement — with a constant input this converges to that input and then stops
 * changing, so a silent room decays to 0 and STAYS at 0 rather than idling at a flattering value.
 */
export function smoothAudioLevel(previous: number, measured: number): number {
  const clampedPrevious = clamp01(previous);
  const clampedMeasured = clamp01(measured);
  const rate = clampedMeasured > clampedPrevious ? ATTACK : RELEASE;
  const next = clampedPrevious + (clampedMeasured - clampedPrevious) * rate;
  // Collapse the long numerical tail so a decaying level actually reaches silence.
  return next < 0.004 ? 0 : clamp01(next);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? 1 : value;
}

/**
 * The level a surface is allowed to render. This is the last gate before presentation: outside the
 * one state that has a live measurement, the answer is 0 no matter what was passed in, so a stale
 * reading can never animate the presence field after capture has stopped.
 */
export function presentableAudioLevel(level: number, hasLiveMeasurement: boolean): number {
  return hasLiveMeasurement ? clamp01(level) : 0;
}
