/*
 * heby-voice/speech-adapters.ts — the provider-neutral seam for the two capabilities that MIGHT one
 * day be bought, kept apart from the two that never will be.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FOUR CAPABILITIES, TWO OWNERS, AND WHY THE LINE IS DRAWN HERE
 * ─────────────────────────────────────────────────────────────────────────────
 *   CAPTURE            opening a microphone.              THE BROWSER. Permanently.
 *   ANALYSIS           measuring amplitude from it.       THE BROWSER. Permanently. On-device.
 *   SPEECH-TO-TEXT     turning speech into text.          AN ADAPTER. Replaceable.
 *   TEXT-TO-SPEECH     reading an answer aloud.           AN ADAPTER. Replaceable, SEPARATELY.
 *
 * Capture and analysis are NOT behind these interfaces, and that is the most important thing about
 * this file. A speech provider must never be in a position to open a microphone or to receive raw
 * audio it was not handed for one transcription — so the microphone stays owned by the runtime, and
 * an adapter receives only what it needs to do its one job.
 *
 * STT AND TTS ARE SEPARATE INTERFACES ON PURPOSE. The provider with the best Turkish recognition is
 * not necessarily the provider with the best Turkish voice — today they demonstrably are not the same
 * vendor. Binding both to one adapter for tidiness would make that a permanent architectural fact
 * rather than a decision the Director gets to make twice.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT AN ADAPTER MAY NOT DO — enforced by what these types do not offer
 * ─────────────────────────────────────────────────────────────────────────────
 *   - It cannot open a microphone. There is no method for it, and the capture it receives is one it
 *     did not create and does not own.
 *   - It cannot send. Its only outputs are text, three lifecycle callbacks, and a failure in HEBUN'S
 *     OWN vocabulary — never a provider error object, never a raw response.
 *   - It cannot reach the conversation. No conversation, tenant, provider-selection, command or
 *     persistence type appears anywhere in this file.
 *   - It cannot hold a secret. Nothing here carries or accepts one; a server-side adapter obtains
 *     authorization on the server, and the browser side of it would receive at most a short-lived
 *     grant, never a long-lived one.
 *   - It cannot see amplitude. The measured level is produced and consumed entirely inside Hebun.
 *
 * TODAY THERE IS EXACTLY ONE IMPLEMENTATION OF EACH, and it is the browser: no speech provider is
 * authorized in this repository, no speech credential exists, and no speech dependency is installed.
 * These interfaces exist so that an authorized provider can later be added by writing ONE adapter,
 * without the state machine, the surfaces, the composer, the conversation seam, S1 or R2E changing
 * at all — and so that the claim "it would be one file" is checkable rather than asserted.
 *
 * Pure: types plus one description function. No React, no DOM access, no I/O.
 */

import type { HebyVoiceFailure } from "./contracts";
import type { HebyVoiceLanguage } from "./language";
import type { HebyRecognitionLocality } from "./recognition-locality";

/**
 * How a recognition attempt can end badly, in Hebun's vocabulary rather than a provider's.
 *
 * `denied` and `empty` are separated from the failure union because neither is an error: a refused
 * microphone is the operator's decision, and silence is just silence.
 */
export type HebySpeechToTextOutcome = HebyVoiceFailure | "denied" | "empty";

/**
 * Everything an STT adapter is given for ONE transcription, and nothing more.
 *
 * `capture` is the already-open stream, passed because a server-side adapter must read audio from
 * somewhere. The browser recognizer ignores it entirely — it opens its own capture internally, which
 * is a real property of the Web Speech API and is accounted for in the runtime's teardown.
 */
export interface HebySpeechToTextRequest {
  /** The language the operator chose. Never inferred by the adapter. */
  readonly language: HebyVoiceLanguage;
  /** The live capture the runtime owns. The adapter reads; it never opens, and never closes. */
  readonly capture: MediaStream;
  /** A FINAL fragment of recognized text. Interim guesses are not text the operator agreed to. */
  readonly onFinalText: (text: string) => void;
  /** Recognition is over, for any reason. Always called exactly once. */
  readonly onEnded: () => void;
  /** Recognition failed, in Hebun's vocabulary. */
  readonly onOutcome: (outcome: HebySpeechToTextOutcome) => void;
}

/** The handle to one in-flight transcription. Two verbs, because there are two honest endings. */
export interface HebySpeechToTextSession {
  /** End capture and FLUSH whatever was recognized. The operator pressed stop. */
  readonly stop: () => void;
  /** End capture and DISCARD. The operator abandoned voice. */
  readonly abort: () => void;
}

/** The replaceable half of voice input. */
export interface HebySpeechToTextAdapter {
  /** Which implementation this is, for the operator-facing disclosure. Never a secret, never a URL. */
  readonly id: string;
  /** Where the audio is processed. The disclosure is generated from this, not from a promise. */
  readonly locality: HebyRecognitionLocality;
  readonly start: (request: HebySpeechToTextRequest) => HebySpeechToTextSession;
}

/** Everything a TTS adapter is given, and nothing more. */
export interface HebyTextToSpeechRequest {
  /**
   * THE USER-VISIBLE ANSWER ONLY. Not the prompt, not evidence internals, not provenance, not a
   * record reference, not a conversation or request id, not a limitation note, not a provider name.
   * A single string, selected upstream by `selectSpokenAnswer`, is the entire input.
   */
  readonly text: string;
  readonly language: HebyVoiceLanguage;
  readonly onStarted: () => void;
  /** Playback finished, was stopped, or was interrupted. Always called exactly once. */
  readonly onEnded: () => void;
  readonly onFailed: () => void;
}

/** The replaceable half of voice output. */
export interface HebyTextToSpeechAdapter {
  readonly id: string;
  /**
   * Whether this implementation's playback audio can be MEASURED locally, so the presence field can
   * react to a real waveform while Heby speaks.
   *
   * FALSE for the browser synthesizer, and that is a documented platform limitation rather than an
   * omission: `speechSynthesis` routes its output straight to the audio device and exposes no
   * AudioNode, MediaStream or buffer, so there is nothing to attach an analyser to. A server-side
   * adapter that returns audio bytes WOULD be measurable, which is one of the real gains a provider
   * decision would buy. Until then the orb uses a truthful state animation and no amplitude.
   */
  readonly measurablePlayback: boolean;
  readonly speak: (request: HebyTextToSpeechRequest) => void;
  readonly stop: () => void;
}

/**
 * What the operator is told about who is processing their voice — ids and localities, never a
 * credential, never an endpoint, never a request id.
 */
export interface HebySpeechProviderDescription {
  readonly recognitionId: string;
  readonly locality: HebyRecognitionLocality;
  readonly synthesisId: string | null;
  readonly playbackMeasurable: boolean;
}

export function describeSpeechAdapters(
  speechToText: Pick<HebySpeechToTextAdapter, "id" | "locality">,
  textToSpeech: Pick<HebyTextToSpeechAdapter, "id" | "measurablePlayback"> | null,
): HebySpeechProviderDescription {
  return {
    recognitionId: speechToText.id,
    locality: speechToText.locality,
    synthesisId: textToSpeech?.id ?? null,
    playbackMeasurable: textToSpeech?.measurablePlayback ?? false,
  };
}
