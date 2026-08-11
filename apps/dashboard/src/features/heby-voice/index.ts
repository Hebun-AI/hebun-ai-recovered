/*
 * heby-voice — Heby Voice V1: the pure, browser-free core of voice input and spoken output.
 *
 * WHAT THIS MODULE IS: a state machine, an amplitude normalizer, a capability decision, and two text
 * decisions. All pure. It can be executed under plain Node with no DOM, which is exactly why the
 * privacy claims about it are testable rather than reviewable.
 *
 * WHAT THIS MODULE IS NOT, AND STRUCTURALLY CANNOT BECOME: a conversation, a dispatch site, a
 * provider, a tenant resolver, a command parser, an execution path, or a store. It imports nothing
 * from `heby-runtime`, `heby-model`, `heby-conversation`, `heby-commands`, `heby-answer`, the
 * database, or any server action, and it holds no audio.
 */

export type {
  HebyVoiceCapability,
  HebyVoiceEvent,
  HebyVoiceFailure,
  HebyVoiceModel,
  HebyVoiceState,
} from "./contracts";

export {
  HEBY_VOICE_INITIAL,
  hebyVoiceFailureText,
  hebyVoiceHasAudioLevel,
  hebyVoiceIsCapturing,
  hebyVoiceReducer,
  hebyVoiceStateLabel,
} from "./voice-state";

export { normalizeAudioLevel, presentableAudioLevel, smoothAudioLevel } from "./audio-level";

export {
  hebyVoiceDisclosureLines,
  hebyVoiceInputAvailable,
  resolveHebyVoiceCapability,
  type HebyVoiceEnvironment,
} from "./capability";

export { mergeTranscriptIntoComposer, selectSpokenAnswer, type SpeakableTurn } from "./transcript";

export {
  HEBY_VOICE_LANGUAGES,
  HEBY_VOICE_LANGUAGE_FALLBACK,
  hebyVoiceLanguageLabel,
  hebyVoiceRecognitionTag,
  hebyVoiceSynthesisTag,
  resolveInitialVoiceLanguage,
  type HebyVoiceLanguage,
} from "./language";

export {
  decideMediaAdoption,
  HEBY_MEDIA_STALL_MS,
  hebyCaptureHoldsDevice,
  hebyCaptureIsPending,
  hebyCaptureStallNotice,
  type HebyCapturePhase,
  type HebyMediaAdoption,
  type HebyMediaRequestStatus,
} from "./capture-phase";

export {
  canInstallOnDeviceRecognition,
  installStatusLine,
  recognitionLeavesDevice,
  recognitionLocalityLabel,
  recognitionLocalityLine,
  resolveRecognitionLocality,
  type HebyInstallStatus,
  type HebyOnDeviceAvailability,
  type HebyRecognitionLocality,
} from "./recognition-locality";

export {
  describeSpeechAdapters,
  type HebySpeechProviderDescription,
  type HebySpeechToTextAdapter,
  type HebySpeechToTextOutcome,
  type HebySpeechToTextRequest,
  type HebySpeechToTextSession,
  type HebyTextToSpeechAdapter,
  type HebyTextToSpeechRequest,
} from "./speech-adapters";
