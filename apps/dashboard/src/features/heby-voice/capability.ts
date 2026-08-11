/*
 * heby-voice/capability.ts — what this browser can ACTUALLY do, and what the operator must be told
 * before it does it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE VOICE V1 ARCHITECTURE DECISION, RECORDED WHERE IT IS ENFORCED
 * ─────────────────────────────────────────────────────────────────────────────
 * Hebun has exactly ONE authorized provider integration, and it is a TEXT model (Anthropic Claude,
 * behind the R2E Director kill-switch). A configured text-model provider is not a speech provider.
 * There is no authorized speech-to-text or text-to-speech provider in this repository, and Voice V1
 * adds no credential, no paid provider, and no new dependency.
 *
 * So Voice V1 is built on BROWSER-NATIVE capabilities only, and each one is treated as its own
 * authority with its own honest limits:
 *
 *   CAPTURE     getUserMedia. Explicit browser permission, on-device, torn down deterministically.
 *   ANALYSIS    Web Audio AnalyserNode. Entirely on-device. The audio never leaves the page — it is
 *               read as numbers for the presence field and discarded frame by frame.
 *   RECOGNITION the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
 *   SYNTHESIS   `speechSynthesis`.
 *
 * RECOGNITION IS THE ONE WITH A REAL COST, AND IT IS NOT HIDDEN.
 *
 *   - Support is partial, and V1.1 states it from current compatibility data rather than folklore:
 *     Chrome 139+ exposes it unprefixed on desktop; Safari 14.1+ exposes it as
 *     `webkitSpeechRecognition` only; Firefox has it behind a flag, so in practice it is absent
 *     there. Where it is absent, Voice input is `unsupported` and says so — it does not degrade to
 *     an open microphone that produces nothing.
 *   - Processing MAY LEAVE THE DEVICE, and V1.1 no longer has to guess which case applies. Chrome
 *     139+ on desktop exposes `processLocally`, `available()` and `install()`, so Hebun can ask
 *     whether a language runs locally and then REQUIRE that it does. Where those members are absent
 *     — Safari, Chrome on Android, Firefox — nothing has changed and nothing is assumed in Hebun's
 *     favour: the conservative case stands and the operator is told the audio may reach the browser
 *     vendor. See `recognition-locality.ts`, which owns that decision.
 *   - Reliability is the browser's, not Hebun's. Accuracy, language handling and timeouts vary by
 *     browser and by network. This is why the transcript is REVIEWABLE text in the composer and is
 *     never auto-sent: Voice favours correctness over speed.
 *
 * WHY THIS IS ACCEPTABLE FOR NOW, AND WHAT WOULD REPLACE IT. It adds no credential, no spend and no
 * third-party integration to Hebun itself; it is opt-in per session behind an explicit disclosure;
 * on the one platform where it can be proven local it is a STRONGER privacy position than any cloud
 * provider could offer; and it is confined behind this capability boundary plus the adapter seam in
 * `speech-adapters.ts`, so an authorized server-side provider can replace it later without touching
 * the state machine, the surfaces, or the conversation seam. Where the audio does leave the device,
 * that is a real property of the current Voice architecture and is stated in the product, not only
 * in this comment.
 *
 * Pure: feature detection is performed by the CALLER and passed in as facts, so this file has no
 * DOM access and is fully testable.
 */

import type { HebyVoiceCapability } from "./contracts";
import type { HebyVoiceLanguage } from "./language";
import { hebyVoiceLanguageLabel } from "./language";
import {
  recognitionLocalityLine,
  type HebyOnDeviceAvailability,
  type HebyRecognitionLocality,
} from "./recognition-locality";

/** The raw feature facts a runtime observes. Booleans only — never a user-agent string. */
export interface HebyVoiceEnvironment {
  /** `navigator.mediaDevices.getUserMedia` exists. */
  readonly hasMediaDevices: boolean;
  /** `AudioContext` (or the webkit alias) exists. */
  readonly hasAudioContext: boolean;
  /** `SpeechRecognition` (or the webkit alias) exists. */
  readonly hasSpeechRecognition: boolean;
  /** `speechSynthesis` exists. */
  readonly hasSpeechSynthesis: boolean;
  /**
   * The recognizer constructor exposes the on-device members — `available()` and `install()` as
   * static methods. Their presence is what makes locality a question Hebun can ask.
   */
  readonly hasOnDeviceRecognition: boolean;
  /** The page is a secure context. getUserMedia is unavailable outside one. */
  readonly isSecureContext: boolean;
}

/**
 * Decide the capability. Voice INPUT requires capture AND analysis AND recognition together: a
 * microphone that produces no text would be an open microphone with nothing to show for it, which
 * is a worse privacy trade than no voice at all. Synthesis is independent — an answer can be spoken
 * aloud on a browser that cannot listen.
 */
export function resolveHebyVoiceCapability(environment: HebyVoiceEnvironment): HebyVoiceCapability {
  const canCapture = environment.hasMediaDevices && environment.isSecureContext;
  const canAnalyse = environment.hasAudioContext;
  const canRecognize = environment.hasSpeechRecognition;

  const blockedReason = !environment.isSecureContext
    ? ("insecure-context" as const)
    : !environment.hasMediaDevices
      ? ("no-microphone-support" as const)
      : !environment.hasAudioContext
        ? ("audio-context-failed" as const)
        : !environment.hasSpeechRecognition
          ? ("no-recognition-support" as const)
          : null;

  return {
    canCapture,
    canAnalyse,
    canRecognize,
    canSynthesize: environment.hasSpeechSynthesis,
    /*
     * Whether the LOCALITY QUESTION CAN BE ASKED here — not whether the answer is favourable. A
     * browser without these members is not assumed to be remote out of pessimism; it is assumed to
     * be remote because nothing about it can be verified, and an unverifiable privacy claim is not
     * one Hebun makes.
     */
    supportsOnDeviceRecognition: canRecognize && environment.hasOnDeviceRecognition,
    blockedReason,
  };
}

/** Voice input can be offered at all. Every microphone control is gated on this. */
export function hebyVoiceInputAvailable(capability: HebyVoiceCapability): boolean {
  return capability.canCapture && capability.canAnalyse && capability.canRecognize;
}

/**
 * The disclosure the operator reads BEFORE the first capture of a session.
 *
 * It states the egress plainly, separates what stays on the device from what may not, names the
 * language that is about to be recognized, and names the two things Hebun itself does with the
 * audio: nothing, and nothing.
 *
 * THE EGRESS LINE IS GENERATED FROM THE MEASURED LOCALITY, never from a default that flatters the
 * product. Where locality could not be established the line is the conservative one, word for word
 * the same sentence Voice V1 always showed.
 */
export function hebyVoiceDisclosureLines(input: {
  readonly locality: HebyRecognitionLocality;
  readonly availability: HebyOnDeviceAvailability;
  readonly language: HebyVoiceLanguage;
}): readonly string[] {
  return [
    "Your microphone opens only while you are speaking, and closes when you stop.",
    recognitionLocalityLine(input.locality, input.availability),
    `Heby will listen in ${hebyVoiceLanguageLabel(input.language)}. You can change that below.`,
    "Hebun never stores your audio. Only the text you review and send is kept.",
    "The text arrives in the message box first — nothing is sent to Heby until you send it.",
  ];
}
