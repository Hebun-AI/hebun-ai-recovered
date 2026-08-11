/*
 * heby-voice/contracts.ts — the type vocabulary of Heby Voice V1.
 *
 * VOICE IS AN I/O LAYER, NOT AN AUTHORITY. Nothing in this module can dispatch a model request,
 * resolve a tenant, select a provider, run a command, or execute anything. Voice's entire output is
 * TEXT that is handed to the existing composer, where it is indistinguishable from typed input and
 * therefore passes through the existing S1 parser and the existing conversation seam.
 *
 * The three capabilities are deliberately SEPARATE authorities, and this file keeps them separate:
 *
 *   CAPTURE     opening a microphone MediaStream.            Browser permission. On-device.
 *   ANALYSIS    measuring amplitude from that stream.        Web Audio. On-device. Never leaves.
 *   RECOGNITION turning speech into text.                    Replaceable adapter. Today the browser
 *                                                            speech service; MAY LEAVE THE DEVICE
 *                                                            unless proven otherwise, which is now a
 *                                                            measurement (recognition-locality.ts).
 *   SYNTHESIS   speaking an answer aloud.                    Replaceable adapter. Today the browser.
 *
 * Pure types. No React, no DOM, no I/O, no authority.
 */

import type { HebyVoiceLanguage } from "./language";
import type {
  HebyInstallStatus,
  HebyOnDeviceAvailability,
  HebyRecognitionLocality,
} from "./recognition-locality";

/**
 * The ONE Voice state. Every surface reads this and nothing else — there is no second boolean
 * anywhere that means "we are listening".
 *
 *   unsupported  this browser cannot do Voice V1 at all. The control is inert and says why.
 *   idle         supported, nothing running, no microphone open. The resting state.
 *   disclosure   the operator asked for voice and is being told, BEFORE any capture, where their
 *                audio goes. Nothing is open yet.
 *   requesting   the browser's own permission prompt is up. Still nothing captured.
 *   listening    a microphone stream is genuinely open and being analysed. THE ONLY STATE IN WHICH
 *                A MEASURED AUDIO LEVEL EXISTS.
 *   transcribing capture has stopped; the recognizer is finishing its final result.
 *   review       a transcript was delivered to the composer and is waiting for the operator to
 *                read, edit, and explicitly send it. Voice NEVER sends.
 *   speaking     an answer is genuinely being played back through speech synthesis.
 *   denied       microphone permission was refused or dismissed. Recoverable, never re-prompted
 *                automatically.
 *   error        something failed. Recoverable; text Heby is untouched.
 *
 * Deliberately ABSENT: a `sending` state. Sending belongs to the conversation seam, which already
 * owns it (`asking`). A voice-owned `sending` would be a second dispatch authority.
 */
export type HebyVoiceState =
  | "unsupported"
  | "idle"
  | "disclosure"
  | "requesting"
  | "listening"
  | "transcribing"
  | "review"
  | "speaking"
  | "denied"
  | "error";

/** Why Voice failed. Each maps to one honest sentence; none of them breaks typed Heby. */
export type HebyVoiceFailure =
  | "no-microphone-support"
  | "no-recognition-support"
  | "insecure-context"
  | "device-unavailable"
  /** V1.3. NotFoundError — the browser reports no microphone at all on this machine. */
  | "device-missing"
  /** V1.3. NotReadableError — a microphone exists but something else is holding it. */
  | "device-busy"
  /** V1.3. AbortError — the request ended without a decision. Not a denial. */
  | "request-interrupted"
  | "stream-ended"
  | "audio-context-failed"
  | "recognition-failed"
  | "recognition-unavailable"
  | "empty-transcript"
  | "synthesis-failed";

/**
 * Every transition Voice can make. The reducer is total over this union, so an unhandled transition
 * is a type error rather than a runtime surprise.
 */
export type HebyVoiceEvent =
  /**
   * The operator pressed the microphone control. `acknowledged` is whether they have already been
   * shown where their audio goes IN THIS SESSION — it is an input, never something Voice assumes.
   */
  | { readonly type: "activate"; readonly acknowledged: boolean }
  /** The operator accepted the disclosure. Only now may a permission request happen. */
  | { readonly type: "acknowledge" }
  /** A microphone stream is genuinely open. */
  | { readonly type: "capture-started" }
  /** The browser refused, or the operator dismissed the prompt. */
  | { readonly type: "permission-denied" }
  /** The operator pressed stop, or the recognizer ended capture itself. */
  | { readonly type: "capture-stopped" }
  /** A final transcript exists and has been handed to the composer. */
  | { readonly type: "transcript-delivered" }
  /** Playback of an answer began. */
  | { readonly type: "speech-started" }
  /** Playback finished, was stopped, or was interrupted. */
  | { readonly type: "speech-ended" }
  /** The operator abandoned voice, or the surface unmounted. Always safe. */
  | { readonly type: "cancel" }
  /** The operator sent or cleared the composer, so the transcript is no longer under review. */
  | { readonly type: "review-resolved" }
  /** Something failed. */
  | { readonly type: "fail"; readonly reason: HebyVoiceFailure }
  /** Return a recoverable failure state to rest. */
  | { readonly type: "reset" };

/**
 * What the browser can actually do, decided from real feature detection — never assumed and never
 * inferred from a user agent string.
 */
export interface HebyVoiceCapability {
  /** getUserMedia exists AND the page is a secure context. */
  readonly canCapture: boolean;
  /** Web Audio exists, so a REAL amplitude can be measured. */
  readonly canAnalyse: boolean;
  /** A speech recognizer exists, so speech can become text. */
  readonly canRecognize: boolean;
  /** Speech synthesis exists, so an answer can be spoken. */
  readonly canSynthesize: boolean;
  /**
   * The recognizer exposes the on-device members (`processLocally`, `available()`, `install()`), so
   * Hebun can ASK where a language is processed instead of assuming.
   *
   * This is a capability, NOT a claim: a browser that can be asked may still answer "not locally".
   * Where recognition actually happens is the runtime-resolved `recognitionLocality` on the model,
   * which stays at the conservative value until the browser has answered otherwise.
   */
  readonly supportsOnDeviceRecognition: boolean;
  /** Why voice input is impossible here, when it is. Presentation copy — it grants nothing. */
  readonly blockedReason: HebyVoiceFailure | null;
}

/**
 * The full view model a presentation surface needs. Values and callbacks only: a surface can operate
 * Voice, but it cannot reach the MediaStream, the AudioContext, the recognizer, or the raw audio.
 */
export interface HebyVoiceModel {
  readonly state: HebyVoiceState;
  readonly capability: HebyVoiceCapability;
  /**
   * REAL normalized microphone amplitude, 0–1. It is a number ONLY while `state === "listening"`;
   * in every other state it is 0, because in every other state there is nothing being measured.
   *
   * MICROPHONE ONLY. There is no output amplitude here, because browser speech synthesis exposes no
   * measurable playback — see `HebyTextToSpeechAdapter.measurablePlayback`.
   */
  readonly audioLevel: number;
  /**
   * WHERE the audio actually goes, resolved from the browser's own answer rather than assumed. Starts
   * — and stays — at the conservative `"cloud"` unless the browser proves it can keep this language
   * on the device. Every privacy sentence the operator reads is generated from this value.
   */
  readonly recognitionLocality: HebyRecognitionLocality;
  /** What the browser answered about keeping the CHOSEN language local. Drives the install offer. */
  readonly onDeviceAvailability: HebyOnDeviceAvailability;
  /** The language the operator chose to speak. Never re-guessed per utterance. */
  readonly language: HebyVoiceLanguage;
  /**
   * V1.3. The browser has not answered the microphone request within a reasonable window. This is a
   * WORDING change, not a state: the request may still be pending, nothing has been denied, and the
   * operator can keep waiting or cancel.
   */
  readonly mediaStalled: boolean;
  /** V1.3. What an on-device install request actually did, so an outcome is never invisible. */
  readonly installStatus: HebyInstallStatus;
  /** Whether answers are spoken aloud. Off until the operator turns it on. */
  readonly outputEnabled: boolean;
  /** An honest failure sentence, or null. Never a state claim. */
  readonly failure: string | null;
  /** Begin voice input. The ONLY way a microphone is ever opened. */
  readonly onActivate: () => void;
  /** Accept the disclosure and continue to the browser's own permission prompt. */
  readonly onAcknowledge: () => void;
  /** Stop capture and finish transcription. */
  readonly onStop: () => void;
  /** Abandon voice entirely: tear down capture, analysis and playback. */
  readonly onCancel: () => void;
  /** Turn spoken answers on or off. */
  readonly onToggleOutput: () => void;
  /** Stop playback immediately. */
  readonly onStopSpeaking: () => void;
  /** Choose the language. Refused while a microphone is open — a capture keeps the language it began with. */
  readonly onSelectLanguage: (language: HebyVoiceLanguage) => void;
  /**
   * Ask the browser to install the on-device language pack, so recognition can stop leaving the
   * device. Explicit operator action only; null where there is nothing to install.
   */
  readonly onInstallOnDevice: (() => void) | null;
}
