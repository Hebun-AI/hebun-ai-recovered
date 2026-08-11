/*
 * heby-voice/voice-state.ts — THE Heby Voice state machine (Voice V1).
 *
 * ONE reducer, ONE state, both surfaces. There is deliberately no `isListening` boolean, no
 * `micOpen` flag and no `isSpeaking` ref scattered through components: if a surface wants to know
 * what Voice is doing it reads the state this function produced, and nothing else can disagree
 * with it.
 *
 * THE INVARIANT THIS FILE EXISTS TO ENFORCE: a microphone can only ever be opened by walking the
 * explicit path
 *
 *     idle --activate--> disclosure --acknowledge--> requesting --capture-started--> listening
 *
 * (or `idle --activate--> requesting` once the operator has already been shown the disclosure in
 * this session). Every other event either does nothing or moves AWAY from capture. There is no
 * transition into `listening` that is not preceded by `requesting`, and no transition into
 * `requesting` that is not preceded by an operator `activate`. No page load, route change, surface
 * open, answer arrival, or timer appears anywhere in this file, so none of them can start capture.
 *
 * NO WAKE WORD. There is no event that means "a phrase was heard", because there is no always-on
 * listener to hear one. Voice V1 has no background capture of any kind.
 *
 * Pure: no React, no DOM, no I/O, no timers, no randomness.
 */

import type { HebyVoiceEvent, HebyVoiceFailure, HebyVoiceState } from "./contracts";

/** The resting state before any capability check has run. */
export const HEBY_VOICE_INITIAL: HebyVoiceState = "idle";

/** States in which a microphone stream is, or may already be, open. */
const CAPTURING: ReadonlySet<HebyVoiceState> = new Set<HebyVoiceState>(["listening", "transcribing"]);

/** States the operator can recover from with a single further action. */
const RECOVERABLE: ReadonlySet<HebyVoiceState> = new Set<HebyVoiceState>(["denied", "error"]);

/**
 * Every state from which pressing the microphone is meaningful. This is the WHOLE entry surface into
 * capture — if a state is not in here, no `activate` can start a microphone from it.
 *
 *   idle              the resting case.
 *   review            dictate more into a transcript that is still being edited. The composer appends,
 *                     so a second capture extends the message rather than replacing it. (Voice V1
 *                     labelled this button "Start voice input again" but the machine refused it; the
 *                     label was right and the machine was wrong.)
 *   speaking          V1.1 INTERRUPTION. Reaching for the microphone while Heby is talking means
 *                     "stop and listen to me", so it is allowed — and the runtime stops playback
 *                     BEFORE this transition, so the two are never live at once.
 *   denied / error    recover from a failure with one press.
 *
 * DELIBERATELY ABSENT: `listening`, `transcribing`, `requesting`, `disclosure`. In each of those a
 * capture is already open or already being negotiated, and a second `activate` could only mean a
 * second microphone.
 */
const ACTIVATABLE: ReadonlySet<HebyVoiceState> = new Set<HebyVoiceState>([
  "idle",
  "review",
  "speaking",
  "denied",
  "error",
]);

/**
 * TRUE when the runtime must be holding a live microphone stream. The runtime asserts its own
 * teardown against this, so "the state says idle but the microphone light is on" is a test failure
 * rather than something a reviewer has to notice.
 */
export function hebyVoiceIsCapturing(state: HebyVoiceState): boolean {
  return CAPTURING.has(state);
}

/**
 * TRUE only while a REAL measured microphone amplitude exists. Everything downstream — the audio
 * level the visualizer receives, the "Listening" label — is gated on this one predicate, so the orb
 * cannot animate to a stale or invented level.
 */
export function hebyVoiceHasAudioLevel(state: HebyVoiceState): boolean {
  return state === "listening";
}

/**
 * The transition function. Total over the event union and over the state union: an event that has
 * no meaning in the current state returns that state UNCHANGED rather than forcing a branch to
 * invent one.
 */
export function hebyVoiceReducer(state: HebyVoiceState, event: HebyVoiceEvent): HebyVoiceState {
  // `unsupported` is terminal. A browser that cannot do voice cannot be argued into it.
  if (state === "unsupported") return "unsupported";

  switch (event.type) {
    case "activate":
      // The ONLY entry into the capture path, and only from a state where a microphone is not
      // already open or being negotiated.
      if (!ACTIVATABLE.has(state)) return state;
      return event.acknowledged ? "requesting" : "disclosure";

    case "acknowledge":
      return state === "disclosure" ? "requesting" : state;

    case "capture-started":
      // Reachable ONLY from an in-flight permission request. Nothing else may open a microphone.
      return state === "requesting" ? "listening" : state;

    case "permission-denied":
      return state === "requesting" ? "denied" : state;

    case "capture-stopped":
      return state === "listening" ? "transcribing" : state;

    case "transcript-delivered":
      // The transcript is now the operator's text in the composer. Voice's job is over; sending is
      // theirs. This is why there is no path from here to a dispatch.
      return state === "transcribing" || state === "listening" ? "review" : state;

    case "speech-started":
      // Playback may begin from rest or while a transcript is under review; never during capture,
      // which would put Heby's own voice into the microphone.
      return state === "idle" || state === "review" ? "speaking" : state;

    case "speech-ended":
      return state === "speaking" ? "idle" : state;

    case "review-resolved":
      return state === "review" ? "idle" : state;

    case "cancel":
      // Always safe, always available: this is the escape hatch that guarantees the operator can
      // stop Voice from any state without touching the conversation.
      return "idle";

    case "fail":
      return event.reason === "no-microphone-support" ||
        event.reason === "no-recognition-support" ||
        event.reason === "insecure-context"
        ? "unsupported"
        : "error";

    case "reset":
      return RECOVERABLE.has(state) ? "idle" : state;
  }
}

/**
 * The honest sentence for a failure. Each one names what happened and makes clear that typed Heby
 * is unaffected — Voice failing is never allowed to read as Heby failing.
 */
const FAILURE_TEXT: Record<HebyVoiceFailure, string> = {
  "no-microphone-support": "This browser has no microphone support, so voice input is unavailable. You can still type.",
  "no-recognition-support":
    "This browser has no speech recognition, so speech cannot become text here. You can still type.",
  "insecure-context": "Voice input needs a secure (HTTPS) connection. You can still type.",
  "device-unavailable": "No microphone was available. Nothing was captured. You can still type.",
  /*
   * V1.3 — WHAT THE BROWSER ACTUALLY SAID, AND NOTHING MORE.
   *
   * Each of these names one documented `getUserMedia` rejection. None of them claims to know WHERE
   * the refusal came from: Hebun cannot distinguish Chrome's own site permission from a macOS
   * privacy setting from an administrator policy, so it names both places the operator can look and
   * lets them find it, rather than confidently sending them to the wrong one.
   */
  "device-missing": "No microphone was found on this computer. Connect one and try again. You can still type.",
  "device-busy":
    "The microphone is in use by another app, so it could not be opened. Close the other app and try again. You can still type.",
  "request-interrupted":
    "The microphone request ended before it was answered. Nothing was captured, and nothing was denied. You can try again.",
  "stream-ended": "The microphone stopped unexpectedly. Nothing further was captured.",
  "audio-context-failed": "Audio analysis could not start, so voice input was stopped. You can still type.",
  "recognition-failed": "Speech recognition failed, so nothing was transcribed. You can still type.",
  "recognition-unavailable": "The speech service could not be reached, so nothing was transcribed. You can still type.",
  "empty-transcript": "Nothing was recognized, so nothing was added to the message.",
  "synthesis-failed": "The answer could not be spoken aloud. It is unchanged above.",
};

export function hebyVoiceFailureText(reason: HebyVoiceFailure): string {
  return FAILURE_TEXT[reason];
}

/**
 * The operator-facing label for a state. Text, so Voice's state is never conveyed by colour or by
 * orb motion alone.
 *
 * "Listening" appears for EXACTLY ONE state — the one in which a microphone stream is genuinely
 * open. There is no state in this table whose label overstates what is happening.
 */
const STATE_LABEL: Record<HebyVoiceState, string> = {
  unsupported: "Voice unavailable",
  idle: "Voice input",
  disclosure: "Before you speak",
  requesting: "Waiting for microphone permission",
  listening: "Listening",
  transcribing: "Finishing transcription",
  review: "Check the text before sending",
  speaking: "Speaking the answer",
  denied: "Microphone blocked",
  error: "Voice input failed",
};

export function hebyVoiceStateLabel(state: HebyVoiceState): string {
  return STATE_LABEL[state];
}
