"use client";

/*
 * heby-voice-runtime.tsx — THE Heby voice runtime (Voice V1). One instance, whole app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A PROVIDER AND NOT A HOOK EACH SURFACE CALLS
 * ─────────────────────────────────────────────────────────────────────────────
 * A microphone is a physical device with one honest state: open or closed. If the Quick Panel and
 * the Full Workspace each instantiated a voice runtime, a surface switch could momentarily leave two
 * owners of that device, and "who closes the stream" would become a question of unmount ordering.
 * So voice is owned ONCE, mounted in the app shell above both surfaces, and the surfaces consume it.
 * Switching surfaces cannot create a second capture because there is no second runtime to create it
 * with — and a second mount is refused outright by the guard below.
 *
 * WHAT THIS FILE OWNS, AND NOTHING ELSE OWNS:
 *   - the MediaStream (opened only by an explicit operator action; torn down deterministically)
 *   - the AudioContext + AnalyserNode used to MEASURE amplitude (on-device, never persisted)
 *   - the browser speech recognizer
 *   - the browser speech synthesizer
 *
 * WHAT THIS FILE STRUCTURALLY CANNOT DO. It imports no server action, no model client, no provider
 * selection, no tenant, no database, no command dispatcher, and no execution path. Its ONLY outward
 * effect on the conversation is calling a sink with a STRING, which the surface puts in the composer
 * exactly as if it had been typed. That is what keeps a spoken "/terminal" a refused slash command:
 * it re-enters the one S1 parser through the one submission gate, and voice has no way around it.
 *
 * IT NEVER SENDS. There is no submit, no dispatch, and no auto-send anywhere in this file. A
 * transcript becomes editable text and stops there.
 *
 * TWO CAPTURES EXIST WHILE LISTENING, AND BOTH ARE ACCOUNTED FOR. The Web Speech API does not accept
 * a MediaStream — it opens its own capture internally. So while listening there is the page's own
 * analysis stream (owned here) and the browser's internal recognition capture (owned by the
 * browser). They are started together and stopped together, and `teardown()` below is the single
 * place that ends both. This is a real property of the browser-native architecture, not an oversight.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  canInstallOnDeviceRecognition,
  decideMediaAdoption,
  describeSpeechAdapters,
  HEBY_MEDIA_STALL_MS,
  HEBY_VOICE_INITIAL,
  hebyVoiceDisclosureLines,
  hebyVoiceFailureText,
  hebyVoiceHasAudioLevel,
  hebyVoiceInputAvailable,
  hebyVoiceIsCapturing,
  hebyVoiceReducer,
  hebyVoiceRecognitionTag,
  hebyVoiceSynthesisTag,
  normalizeAudioLevel,
  presentableAudioLevel,
  resolveHebyVoiceCapability,
  resolveInitialVoiceLanguage,
  resolveRecognitionLocality,
  smoothAudioLevel,
  type HebyCapturePhase,
  type HebyInstallStatus,
  type HebyMediaRequestStatus,
  type HebyOnDeviceAvailability,
  type HebyRecognitionLocality,
  type HebySpeechProviderDescription,
  type HebySpeechToTextAdapter,
  type HebySpeechToTextOutcome,
  type HebySpeechToTextSession,
  type HebyTextToSpeechAdapter,
  type HebyVoiceCapability,
  type HebyVoiceFailure,
  type HebyVoiceLanguage,
  type HebyVoiceModel,
  type HebyVoiceState,
} from "@/features/heby-voice";

/* ── The narrow slice of the Web Speech API this runtime uses ─────────────────
 * Declared structurally rather than pulled from a types package: Voice V1 adds no dependency, and
 * naming exactly the four members that are touched makes the surface area auditable.
 */
interface SpeechAlternative {
  readonly transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}
interface SpeechResultEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
interface SpeechErrorEvent {
  readonly error: string;
}
interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  /**
   * V1.1. When true the browser MUST recognize on the device — it is a requirement, not a hint, so a
   * missing language pack fails loudly instead of silently reaching the network. Absent on browsers
   * that predate on-device support, which is exactly why it is optional here.
   */
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

/** The four spec values for "can this language be recognized on this machine". */
type SpeechAvailability = "unavailable" | "downloadable" | "downloading" | "available";

/**
 * The constructor, plus the two STATIC members that make locality answerable. Both are optional
 * because most browsers do not have them; every read of them is guarded.
 */
interface SpeechRecognizerConstructor {
  new (): SpeechRecognizer;
  readonly available?: (options: {
    langs: readonly string[];
    processLocally?: boolean;
  }) => Promise<SpeechAvailability>;
  readonly install?: (options: { langs: readonly string[] }) => Promise<unknown>;
}

interface VoiceGlobals {
  readonly SpeechRecognition?: SpeechRecognizerConstructor;
  readonly webkitSpeechRecognition?: SpeechRecognizerConstructor;
  readonly AudioContext?: typeof AudioContext;
  readonly webkitAudioContext?: typeof AudioContext;
}

function voiceGlobals(): VoiceGlobals {
  return window as unknown as VoiceGlobals;
}

function recognizerConstructor(): SpeechRecognizerConstructor | undefined {
  const globals = voiceGlobals();
  return globals.SpeechRecognition ?? globals.webkitSpeechRecognition;
}

/** Map the browser's recognizer error strings onto Hebun's own honest failure vocabulary. */
function recognitionFailure(code: string): HebySpeechToTextOutcome {
  if (code === "not-allowed" || code === "service-not-allowed") return "denied";
  if (code === "no-speech") return "empty";
  if (code === "audio-capture") return "device-unavailable";
  if (code === "network") return "recognition-unavailable";
  // `language-not-supported` is what an enforced-local recognition raises with no language pack.
  if (code === "language-not-supported") return "recognition-unavailable";
  return "recognition-failed";
}

/* ── THE TWO REPLACEABLE ADAPTERS ─────────────────────────────────────────────
 *
 * Recognition and synthesis are the only two voice capabilities that a provider could ever own, so
 * they — and ONLY they — are expressed as the provider-neutral interfaces from
 * `features/heby-voice/speech-adapters`. Capture and analysis are not: the runtime keeps the
 * microphone and the analyser, permanently, so no adapter can ever be in a position to open a device
 * or to receive audio it was not handed for one transcription.
 *
 * These two factories are the browser implementation, and today they are the only implementation.
 * They live in this file rather than beside the contracts because they touch browser resources, and
 * this file is the ONE place browser resources are owned and torn down. A Director-authorized
 * provider would add a sibling factory satisfying the same interface; nothing below this block, and
 * nothing in the surfaces, the composer, the conversation seam, S1 or R2E, would change.
 */

/**
 * Browser recognition. Note what it does NOT do with the capture it is handed: the Web Speech API
 * accepts no MediaStream and opens its own internal capture, so this adapter reads nothing from the
 * stream. That second capture is a real property of the browser architecture and is ended by the
 * same teardown that ends the first.
 */
function recognitionAdapterId(locality: HebyRecognitionLocality): string {
  return locality === "on-device" ? "browser-web-speech-on-device" : "browser-web-speech";
}

/*
 * ── V1.2 DEVELOPMENT-ONLY DIAGNOSTIC SEAM ────────────────────────────────────
 *
 * The first real-microphone run produced a genuinely open microphone, working recognition, and a
 * permanently zero amplitude — and nothing in the product could say why. This exists so that never
 * costs a whole acceptance round again: one call reports what the audio graph and the recognizer
 * ACTUALLY did, in the operator's own browser.
 *
 * IT IS NOT TELEMETRY, AND CANNOT BECOME IT. It is attached to `window` only outside production, it
 * is read on demand and never pushed, it holds counters and enum strings rather than audio, and
 * nothing in the product reads it. No sample, no buffer, no waveform and no transcript is retained
 * here — `peakLevel` is a single number that already reached the screen.
 */
interface RecognitionConfigRecord {
  readonly lang: string;
  readonly processLocallyRequested: boolean;
  readonly adapterId: string;
}

/** What the recognizer was LAST actually configured with — the answer to "did tr-TR really arrive?". */
let lastRecognitionConfig: RecognitionConfigRecord | null = null;

function createBrowserSpeechToText(
  Ctor: SpeechRecognizerConstructor,
  locality: HebyRecognitionLocality,
): HebySpeechToTextAdapter {
  return {
    id: recognitionAdapterId(locality),
    locality,
    start(request) {
      const recognizer = new Ctor();
      recognizer.continuous = true;
      // FINAL results only. An interim guess is not text the operator agreed to.
      recognizer.interimResults = false;
      recognizer.lang = hebyVoiceRecognitionTag(request.language);
      /*
       * REQUIRE local processing where locality was proven. Belt and braces on purpose: `available()`
       * said the pack is present, and this makes the browser honour that or refuse the recognition.
       */
      if (locality === "on-device") recognizer.processLocally = true;
      // Record what was ACTUALLY configured, so "the language reached the recognizer" is checkable
      // in the operator's own browser rather than inferred from the dropdown.
      lastRecognitionConfig = {
        lang: recognizer.lang,
        processLocallyRequested: locality === "on-device",
        adapterId: recognitionAdapterId(locality),
      };

      recognizer.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result?.isFinal) continue;
          const alternative = result[0];
          if (alternative) request.onFinalText(alternative.transcript);
        }
      };
      recognizer.onerror = (event) => request.onOutcome(recognitionFailure(event.error));
      recognizer.onend = () => request.onEnded();

      try {
        recognizer.start();
      } catch {
        request.onOutcome("recognition-failed");
      }

      return {
        stop: () => {
          // Flushes the final result through `onend`, which is where the transcript is claimed.
          try {
            recognizer.stop();
          } catch {
            /* Already stopped. */
          }
        },
        abort: () => {
          // Discards any pending result. Used when the operator abandons voice entirely.
          recognizer.onresult = null;
          recognizer.onerror = null;
          recognizer.onend = null;
          try {
            recognizer.abort();
          } catch {
            /* Already stopped. Nothing is left running either way. */
          }
        },
      };
    },
  };
}

/**
 * Browser synthesis.
 *
 * `measurablePlayback: false` is the honest answer to "can the orb react to Heby's own voice?".
 * `speechSynthesis` routes its output straight to the audio device and exposes no AudioNode,
 * MediaStream or buffer, so there is nothing an analyser can attach to. Rather than invent an
 * amplitude, the presence field uses a state animation while speaking and reads no level at all.
 */
function createBrowserTextToSpeech(): HebyTextToSpeechAdapter {
  return {
    id: "browser-speech-synthesis",
    measurablePlayback: false,
    speak(request) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(request.text);
        utterance.lang = hebyVoiceSynthesisTag(request.language);
        utterance.onstart = () => request.onStarted();
        utterance.onend = () => request.onEnded();
        utterance.onerror = () => request.onFailed();
        window.speechSynthesis.speak(utterance);
      } catch {
        request.onFailed();
      }
    },
    stop() {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
  };
}

/* ── The runtime contract handed to the surfaces ──────────────────────────── */

export interface HebyVoiceRuntime extends HebyVoiceModel {
  /**
   * Register the composer that receives transcripts. The mounted surface registers on mount and
   * releases on unmount, so exactly one composer is ever the target.
   */
  readonly registerTranscriptSink: (sink: (transcript: string) => void) => () => void;
  /**
   * Tell voice what the newest Heby answer is. Speaking it is conditional on voice OUTPUT being on;
   * the first call only records the answer, so opening a surface never reads an old conversation
   * aloud.
   */
  readonly announceAnswer: (text: string | null) => void;
  /** The composer was sent or cleared, so the transcript is no longer under review. */
  readonly resolveReview: () => void;
  /**
   * WHO processes this operator's voice, in ids and localities. It exists so the surface can say
   * which CLASS of provider is involved without ever holding an endpoint, a credential or a request
   * id — none of which appear anywhere in the voice layer.
   */
  readonly providers: HebySpeechProviderDescription;
  /** The disclosure the operator reads before the first capture of the session. */
  readonly disclosureLines: readonly string[];
}

const VoiceContext = createContext<HebyVoiceRuntime | null>(null);

/**
 * How many runtimes are mounted. A second one is a structural bug — it would mean two owners of one
 * microphone — so it is refused loudly rather than left to produce a duplicate capture.
 */
let mountedRuntimes = 0;

/** Test seam: assert that mounting/unmounting surfaces never leaves more than one owner. */
export function hebyVoiceRuntimeCount(): number {
  return mountedRuntimes;
}

/**
 * The capability on the SERVER, and before the browser has been asked: voice is OFF until proven
 * otherwise. A stable module constant, because it is a `useSyncExternalStore` server snapshot.
 */
const UNKNOWN_CAPABILITY: HebyVoiceCapability = {
  canCapture: false,
  canAnalyse: false,
  canRecognize: false,
  canSynthesize: false,
  supportsOnDeviceRecognition: false,
  blockedReason: null,
};

/*
 * CAPABILITY IS READ, NOT SUBSCRIBED TO. It is a property of the browser that cannot change during a
 * session, so it is resolved once and memoized — and read through `useSyncExternalStore`, which is
 * the primitive built for exactly this: a value that legitimately differs between the server render
 * and the client, without a hydration mismatch and without a setState-in-effect cascade.
 *
 * DETECTION TOUCHES NOTHING. It reads whether four APIs exist. It calls no getUserMedia, constructs
 * no AudioContext and starts no recognizer, so it cannot raise a permission prompt.
 */
let detectedCapability: HebyVoiceCapability | null = null;

function readCapability(): HebyVoiceCapability {
  if (detectedCapability) return detectedCapability;
  const globals = voiceGlobals();
  const Recognizer = globals.SpeechRecognition ?? globals.webkitSpeechRecognition;
  detectedCapability = resolveHebyVoiceCapability({
    hasMediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    hasAudioContext: !!(globals.AudioContext ?? globals.webkitAudioContext),
    hasSpeechRecognition: !!Recognizer,
    hasSpeechSynthesis: typeof window !== "undefined" && "speechSynthesis" in window,
    // Reads whether the two static members EXIST. Neither is invoked here, and neither prompts.
    hasOnDeviceRecognition: typeof Recognizer?.available === "function" && typeof Recognizer.install === "function",
    isSecureContext: typeof window !== "undefined" && window.isSecureContext === true,
  });
  return detectedCapability;
}

/** Nothing to subscribe to: the browser's capabilities do not change while the page is open. */
const subscribeToNothing = () => () => {};
const readServerCapability = () => UNKNOWN_CAPABILITY;

/** How often a measured level is committed to React state. The CSS smooths between samples. */
const LEVEL_COMMIT_MS = 60;

export function HebyVoiceProvider({ children }: { children: React.ReactNode }) {
  const [rawState, dispatch] = useReducer(hebyVoiceReducer, HEBY_VOICE_INITIAL);
  const capability = useSyncExternalStore(subscribeToNothing, readCapability, readServerCapability);
  const [level, setLevel] = useState(0);
  const [outputEnabled, setOutputEnabled] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  /*
   * THE LANGUAGE IS CHOSEN, NOT GUESSED. Seeded once from the browser's own preference — a lazy
   * initializer, so it is read exactly once and never re-read per utterance — and thereafter changed
   * only by the operator, through a visible control. It is session-local: nothing is persisted, and
   * it asserts nothing about the organization.
   */
  const [language, setLanguage] = useState<HebyVoiceLanguage>(() =>
    resolveInitialVoiceLanguage(typeof navigator !== "undefined" ? navigator.language : null),
  );
  /**
   * The browser's LAST ANSWER, tagged with the language it was about. Null until one arrives.
   *
   * Tagged rather than bare, because the answer is per-language: an operator who switches to Turkish
   * must not inherit the answer that was true for English. A stale answer is not merely ignored — it
   * is unusable by construction, because the language it belongs to is part of the value.
   */
  const [answered, setAnswered] = useState<{
    readonly language: HebyVoiceLanguage;
    readonly value: HebyOnDeviceAvailability;
  } | null>(null);

  /* ── Owned browser resources. Refs, because teardown must not depend on a render. ── */
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  /**
   * V1.2. TRUE exactly while a live, RUNNING analyser exists. Set synchronously when the audio graph
   * is proven alive, cleared synchronously by teardown — it is the measurement loop's only gate, and
   * it deliberately does not consult React state (see `startMeasuring`).
   */
  const measuringRef = useRef(false);
  /**
   * V1.2 diagnostic counters. Transient, in-memory, never rendered, never persisted, never sent.
   * They exist so a real-microphone run can answer "did the loop run, and did it see sound?" — the
   * two questions the first acceptance run could not answer.
   */
  const samplesRef = useRef(0);
  const nonZeroSamplesRef = useRef(0);
  const peakLevelRef = useRef(0);

  /*
   * ─────────────────────────────────────────────────────────────────────────
   * V1.3 — THE CAPTURE ATTEMPT TOKEN, AND THE DEFECT IT EXISTS TO KILL
   * ─────────────────────────────────────────────────────────────────────────
   * `beginCapture` used to decide whether its own result was still wanted by reading
   * `stateRef.current !== "requesting"`. `stateRef` is advanced by a PASSIVE EFFECT, so that check
   * was a bet on React having committed and painted before `getUserMedia` settled.
   *
   * That bet is lost precisely when the microphone permission is ALREADY GRANTED — the promise then
   * resolves in a few milliseconds, before paint, while `stateRef` still holds `disclosure`. The
   * guard fired, stopped the tracks the operator had just been granted, and returned without
   * dispatching anything. The reducer had already moved to `requesting`, so the surface sat on
   * "Waiting for microphone permission" forever, with no failure and no way forward.
   *
   * It is the same mistake V1.2 fixed in the measurement loop, one level up: CONTROL FLOW MUST NOT
   * DEPEND ON REACT COMMIT ORDERING. So an attempt now carries a synchronous token. Every operator
   * activation mints one; every abandonment invalidates it. Each await boundary in `beginCapture`
   * asks one question that no render can affect: "is this still the attempt in flight?"
   */
  const captureAttemptRef = useRef(0);

  /** Where the current attempt genuinely is. Observation only — it gates nothing. */
  const capturePhaseRef = useRef<HebyCapturePhase>("idle");
  const [capturePhase, setCapturePhase] = useState<HebyCapturePhase>("idle");
  const markPhase = useCallback((phase: HebyCapturePhase) => {
    capturePhaseRef.current = phase;
    setCapturePhase(phase);
  }, []);

  /** What `getUserMedia` did, recorded as it happens so a stuck attempt can be read afterwards. */
  const mediaRequestRef = useRef<{
    calls: number;
    status: HebyMediaRequestStatus;
    startedAt: number | null;
    settledAt: number | null;
    errorName: string | null;
    audioTracks: number;
  }>({ calls: 0, status: "none", startedAt: null, settledAt: null, errorName: null, audioTracks: 0 });

  /** What the audio graph did. Separates "never got a stream" from "got one, context would not run". */
  const audioContextRef = useRef<{ created: boolean; resumeAttempted: boolean; resumeSucceeded: boolean }>({
    created: false,
    resumeAttempted: false,
    resumeSucceeded: false,
  });

  /** What teardown did, so an orphaned track would be visible rather than inferred. */
  const teardownRef = useRef({ requested: 0, completed: 0, tracksStopped: 0 });

  /** The attempt has been pending long enough to say so. Presentation only — it denies nothing. */
  const [mediaStalled, setMediaStalled] = useState(false);

  /*
   * V1.3 — THE PERMISSIONS API IS CONTEXT, NEVER AUTHORITY.
   *
   * `navigator.permissions.query({name:"microphone"})` answers a DIFFERENT question from
   * `getUserMedia`. "granted" does not prove a MediaStream was acquired — the device can still be
   * missing or held by another app. "prompt" does not prove a prompt is currently on screen. So this
   * is recorded for diagnosis and is read by nothing that decides anything: capture authority stays
   * with `getUserMedia` and its result, exactly as before.
   *
   * `"unknown"` is the honest default. A browser without the API simply never updates it, and the
   * diagnostic reports `apiSupported: false` beside it rather than inventing a value.
   */
  const [permissionState, setPermissionState] = useState<string>("unknown");

  /** What an on-device install request actually did. Observation, so "nothing happened" cannot recur. */
  const installStateRef = useRef<{
    status: "idle" | "requested" | "resolved" | "failed";
    requestedAt: number | null;
    settledAt: number | null;
    errorName: string | null;
    availabilityAfter: HebyOnDeviceAvailability | null;
  }>({ status: "idle", requestedAt: null, settledAt: null, errorName: null, availabilityAfter: null });
  /** The operator-facing half of the same fact. */
  const [installStatus, setInstallStatus] = useState<HebyInstallStatus>("idle");
  /** The in-flight recognition, held as the neutral session handle rather than a provider object. */
  const recognitionRef = useRef<HebySpeechToTextSession | null>(null);
  /** The accumulated FINAL transcript of the current capture. Text only — never audio. */
  const transcriptRef = useRef("");
  const sinkRef = useRef<((transcript: string) => void) | null>(null);
  /** The last answer seen, so enabling voice output never replays the conversation so far. */
  const lastAnswerRef = useRef<string | null | undefined>(undefined);
  /**
   * Live state for callbacks that run outside React's render cycle — the measurement loop and the
   * recognizer's events. Kept in sync in a commit effect (declared FIRST, so it lands before the
   * capture effect below) rather than during render, and every reader of it runs after a commit.
   */
  const stateRef = useRef<HebyVoiceState>(HEBY_VOICE_INITIAL);
  useEffect(() => {
    stateRef.current = rawState;
  }, [rawState]);

  /*
   * WHERE THE AUDIO GOES — DERIVED, never stored, and conservative by construction.
   *
   * Three things must ALL hold before Hebun will say a word about local processing: the browser must
   * expose the members, an answer must exist, and that answer must be about the language currently
   * selected. Any one of them missing lands on `"unsupported"`, which resolves to `"cloud"`. There is
   * no code path anywhere that assigns the favourable value — it can only be relayed from the
   * browser, which is what makes the privacy sentence a measurement rather than a claim.
   */
  const availability: HebyOnDeviceAvailability =
    capability.supportsOnDeviceRecognition && answered?.language === language ? answered.value : "unsupported";
  const locality: HebyRecognitionLocality = resolveRecognitionLocality(availability);

  /**
   * The synthesis adapter. One instance for the life of the runtime, because stopping playback must
   * reach the same thing that started it.
   */
  const synthesis = useMemo<HebyTextToSpeechAdapter | null>(
    () => (capability.canSynthesize ? createBrowserTextToSpeech() : null),
    [capability.canSynthesize],
  );

  /* ── One-instance guard ─────────────────────────────────────────────────── */
  useEffect(() => {
    mountedRuntimes += 1;
    if (mountedRuntimes > 1) {
      mountedRuntimes -= 1;
      throw new Error("HebyVoiceProvider must be mounted exactly once — a second microphone owner is not allowed.");
    }
    return () => {
      mountedRuntimes -= 1;
    };
  }, []);

  /*
   * THE SINGLE TEARDOWN. Every path out of capture goes through here: stop, cancel, failure,
   * surface change, unmount. It stops the analysis loop, stops every microphone track, closes the
   * AudioContext, and aborts the recognizer (which ends the browser's own internal capture). It is
   * idempotent, so calling it twice is safe and calling it defensively is free.
   */
  const teardown = useCallback((abortRecognition: boolean) => {
    /*
     * V1.3 — FIRST, AND SYNCHRONOUSLY: invalidate any capture attempt still in flight. This is what
     * makes a late `getUserMedia` result safe. A promise the browser is still holding will resolve
     * after this line, find its token stale, stop its own tracks and return — so tearing down while
     * a permission prompt is open cannot leave an orphaned microphone behind.
     */
    captureAttemptRef.current += 1;
    teardownRef.current.requested += 1;
    // Measurement is over. The loop's only gate, so a frame already scheduled cannot sample a device
    // this function is about to close.
    measuringRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      if (abortRecognition) {
        // Abort discards any pending result. Used when the operator abandons voice entirely.
        recognitionRef.current = null;
        recognition.abort();
      } else {
        // Stop flushes the final result through the adapter's end callback, where it is claimed.
        recognition.stop();
      }
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      teardownRef.current.tracksStopped += stream.getTracks().length;
      streamRef.current = null;
    }
    analyserRef.current = null;
    const context = contextRef.current;
    if (context) {
      contextRef.current = null;
      void context.close().catch(() => {
        /* A context that refuses to close is already unusable; nothing keeps capturing. */
      });
    }
    setLevel(0);
    setMediaStalled(false);
    teardownRef.current.completed += 1;
  }, []);

  /** Stop any playback immediately. Safe to call when nothing is playing. */
  const stopSpeaking = useCallback(() => {
    synthesis?.stop();
    dispatch({ type: "speech-ended" });
  }, [synthesis]);

  /* ── Unmount: the microphone must never outlive the tree that opened it ─── */
  useEffect(() => {
    return () => {
      teardown(true);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [teardown]);

  /*
   * V1.3 — THE STALL NOTICE. A media request the browser has not answered is described honestly
   * after a threshold, and NOTHING ELSE HAPPENS.
   *
   * This timer cannot deny, cannot cancel, cannot retry and cannot settle the promise. Chrome's
   * permission prompt may legitimately sit on screen for minutes while an operator reads it, and
   * calling that "denied" would be a lie told for the sake of a tidier UI. All it does is change the
   * words under the composer from "Waiting for microphone permission" to a sentence that says the
   * browser has not answered and offers the Cancel that was always there.
   */
  useEffect(() => {
    if (capturePhase !== "media-pending") return;
    const timer = setTimeout(() => setMediaStalled(true), HEBY_MEDIA_STALL_MS);
    return () => clearTimeout(timer);
  }, [capturePhase]);

  /*
   * V1.3 — OBSERVE THE PERMISSION, DECIDE NOTHING WITH IT. Read once and then followed for changes,
   * purely so a stuck attempt can be diagnosed. Nothing in this runtime branches on the result: it
   * does not gate the control, does not skip `getUserMedia`, and does not pre-empt a prompt.
   */
  useEffect(() => {
    const permissions = typeof navigator !== "undefined" ? navigator.permissions : undefined;
    if (!permissions?.query) return;
    let live = true;
    let status: PermissionStatus | null = null;
    const follow = () => {
      if (live && status) setPermissionState(status.state);
    };
    void permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (!live) return;
        status = result;
        setPermissionState(result.state);
        result.addEventListener("change", follow);
      })
      .catch(() => {
        // A browser that refuses the question has told us nothing, and "unknown" stays honest.
      });
    return () => {
      live = false;
      status?.removeEventListener("change", follow);
    };
  }, []);

  /*
   * V1.2 — THE DEVELOPMENT-ONLY DIAGNOSTIC. Attached outside production only, removed on unmount.
   * Read on demand from the console; nothing in the product calls it and nothing sends it anywhere.
   * Every field is a counter, an enum string, or a device flag the browser already exposes.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
    const media = mediaRequestRef.current;
    const audio = audioContextRef.current;
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const snapshot = () => ({
      voiceState: stateRef.current,
      /*
       * V1.3 — THE PHASE IS THE ANSWER TO "WHERE DID IT STOP?". The user-facing `requesting` state
       * covers four different operations; this names which one an attempt is sitting in.
       */
      capturePhase: capturePhaseRef.current,
      stalled: mediaStalled,
      permission: {
        // Context, never authority: a browser reporting "granted" has not proven a stream exists,
        // and one reporting "prompt" has not proven a prompt is on screen.
        apiSupported: typeof navigator !== "undefined" && !!navigator.permissions?.query,
        observedState: permissionState,
      },
      getUserMedia: {
        calls: media.calls,
        status: media.status,
        startedAt: media.startedAt,
        settledAt: media.settledAt,
        pendingMs: media.startedAt !== null && media.settledAt === null ? Date.now() - media.startedAt : null,
        errorName: media.errorName,
      },
      stream: {
        acquired: media.status === "resolved" && media.audioTracks > 0,
        audioTrackCount: media.audioTracks,
        // Device FLAGS only. No label, no deviceId, nothing that identifies the operator's hardware.
        readyStates: tracks.map((track) => track.readyState),
        muted: tracks.map((track) => track.muted),
        held: streamRef.current !== null,
      },
      audioContext: {
        created: audio.created,
        state: contextRef.current?.state ?? "absent",
        resumeAttempted: audio.resumeAttempted,
        resumeSucceeded: audio.resumeSucceeded,
      },
      analyser: {
        created: analyserRef.current !== null,
        measuring: measuringRef.current,
        loopScheduled: frameRef.current !== null,
        samples: samplesRef.current,
        nonZeroSamples: nonZeroSamplesRef.current,
        peakLevel: Math.round(peakLevelRef.current * 1000) / 1000,
        committedLevel: level,
      },
      recognition: {
        created: lastRecognitionConfig !== null,
        started: recognitionRef.current !== null,
        language,
        locality,
        configured: lastRecognitionConfig,
      },
      onDevice: {
        supported: capability.supportsOnDeviceRecognition,
        availability,
        install: installStateRef.current,
      },
      teardown: { ...teardownRef.current },
    });
    const holder = window as unknown as { __hebyVoiceDiagnostics?: () => unknown };
    holder.__hebyVoiceDiagnostics = snapshot;
    return () => {
      delete holder.__hebyVoiceDiagnostics;
    };
    // Every value the snapshot closes over is listed, so a stale closure can never report a stale
    // diagnosis — the one thing a diagnostic must never do.
  }, [availability, capability.supportsOnDeviceRecognition, language, level, locality, mediaStalled, permissionState]);

  /*
   * ASK WHERE THIS LANGUAGE IS PROCESSED. Runs on mount and whenever the operator changes language,
   * because the answer is per-language: a machine can hold the English pack and not the Turkish one.
   *
   * IT OPENS NOTHING. `available()` is a question about installed language packs — it constructs no
   * recognizer, touches no microphone, and raises no permission prompt. The result only ever narrows
   * what Hebun claims; a browser that cannot be asked keeps the conservative answer.
   */
  useEffect(() => {
    if (!capability.supportsOnDeviceRecognition) return;
    const ask = recognizerConstructor()?.available;
    if (!ask) return;
    let live = true;
    void ask({ langs: [hebyVoiceRecognitionTag(language)], processLocally: true })
      .then((answer) => {
        if (live) setAnswered({ language, value: answer });
      })
      .catch(() => {
        // An unanswerable question is not a favourable answer. Stay conservative.
        if (live) setAnswered({ language, value: "unsupported" });
      });
    return () => {
      live = false;
    };
  }, [capability.supportsOnDeviceRecognition, language]);

  /*
   * THE MEASUREMENT LOOP. Reads real time-domain samples, normalizes them to 0–1 in the pure module,
   * smooths them, and commits at ~16Hz. The samples are read into ONE reused buffer and never
   * copied, stored, uploaded, or exposed — this loop's only output is a number.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * V1.2 — WHY THIS LOOP IS GATED ON A REF AND NOT ON THE STATE MACHINE
   * ─────────────────────────────────────────────────────────────────────────
   * It used to check `hebyVoiceHasAudioLevel(stateRef.current)`, and that was a real defect that a
   * real microphone found: the loop is started while the reducer is still `requesting`, and
   * `stateRef` is only advanced to `listening` by a PASSIVE EFFECT. Passive effects run after paint;
   * requestAnimationFrame callbacks run before it. So the very first tick always observed
   * `requesting`, took the exit branch, set `frameRef.current = null` — and nothing ever restarted
   * it. Speech recognition still worked, so the failure was silent: a genuinely open microphone with
   * a permanently zero amplitude and an orb that looked like a quiet room.
   *
   * The fix separates two things that were wrongly fused:
   *
   *   MEASUREMENT follows the DEVICE.  `measuringRef` is set synchronously the moment a live
   *                                    analyser exists and cleared synchronously by teardown. No
   *                                    render, no commit, no effect ordering is involved.
   *   PRESENTATION follows the STATE.  `presentableAudioLevel(level, hebyVoiceHasAudioLevel(state))`
   *                                    is unchanged and still the last gate, so a level can only be
   *                                    SHOWN while the machine genuinely says `listening`.
   *
   * The honesty invariant is therefore exactly where it always was — at the presentation boundary —
   * and the measurement no longer depends on winning a race with React's commit phase.
   */
  const startMeasuring = useCallback((analyser: AnalyserNode) => {
    const frame = new Uint8Array(analyser.fftSize);
    let smoothed = 0;
    let committed = -1;
    let lastCommit = 0;

    const tick = () => {
      const active = analyserRef.current;
      if (!active || !measuringRef.current) {
        frameRef.current = null;
        return;
      }
      active.getByteTimeDomainData(frame);
      const measured = normalizeAudioLevel(frame);
      smoothed = smoothAudioLevel(smoothed, measured);

      samplesRef.current += 1;
      if (measured > 0) nonZeroSamplesRef.current += 1;
      if (smoothed > peakLevelRef.current) peakLevelRef.current = smoothed;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const quantized = Math.round(smoothed * 100) / 100;
      if (quantized !== committed && now - lastCommit >= LEVEL_COMMIT_MS) {
        committed = quantized;
        lastCommit = now;
        setLevel(quantized);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  /** Hand a final transcript to the composer. The ONLY outward effect voice has on the conversation. */
  const deliverTranscript = useCallback(() => {
    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (text.length === 0) {
      // Nothing was heard. That is not a failure of Heby, and it is not an error state.
      dispatch({ type: "cancel" });
      setFailure(hebyVoiceFailureText("empty-transcript"));
      return;
    }
    setFailure(null);
    sinkRef.current?.(text);
    dispatch({ type: "transcript-delivered" });
  }, []);

  const failWith = useCallback(
    (reason: HebyVoiceFailure) => {
      teardown(true);
      setFailure(hebyVoiceFailureText(reason));
      dispatch({ type: "fail", reason });
    },
    [teardown],
  );

  /*
   * BEGIN CAPTURE. Reached ONLY from the operator's explicit activation, after the disclosure, and
   * only once the reducer has moved to `requesting`. `getUserMedia` appears exactly once in this
   * file, inside this function, and this function is called from exactly one place.
   */
  const beginCapture = useCallback(async (attempt: number) => {
    /** Is this still the attempt in flight? Synchronous, so no render can change the answer. */
    const current = () => captureAttemptRef.current === attempt;
    /** Abandon a stream that arrived after the operator stopped wanting it. Never leave tracks live. */
    const discard = (stream: MediaStream) => {
      for (const track of stream.getTracks()) track.stop();
      teardownRef.current.tracksStopped += stream.getTracks().length;
    };

    setMediaStalled(false);
    markPhase("permission-requested");

    /*
     * The permission request is the FIRST thing that happens — deliberately. Nothing is decided,
     * constructed or written before it, so the handler that calls this does no synchronous work and
     * the browser's own prompt is the very next thing the operator sees.
     */
    mediaRequestRef.current = {
      calls: mediaRequestRef.current.calls + 1,
      status: "pending",
      startedAt: Date.now(),
      settledAt: null,
      errorName: null,
      audioTracks: 0,
    };
    markPhase("media-pending");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      mediaRequestRef.current = {
        ...mediaRequestRef.current,
        status: "rejected",
        settledAt: Date.now(),
        errorName: name || "UnknownError",
      };
      // A rejection that arrives after the operator walked away changes nothing.
      if (!current()) return;
      /*
       * V1.3 — CLASSIFY WHAT THE BROWSER ACTUALLY SAID. V1 collapsed everything that was not a
       * refusal into "no microphone was available", which sent an operator whose microphone was
       * merely busy to look for a hardware fault.
       */
      if (name === "NotAllowedError" || name === "SecurityError") {
        // Covers an explicit refusal AND a dismissed prompt. Neither is ever retried automatically.
        markPhase("failed");
        setFailure(null);
        dispatch({ type: "permission-denied" });
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        markPhase("failed");
        failWith("device-missing");
      } else if (name === "NotReadableError") {
        markPhase("failed");
        failWith("device-busy");
      } else if (name === "AbortError") {
        markPhase("failed");
        failWith("request-interrupted");
      } else {
        markPhase("failed");
        failWith("device-unavailable");
      }
      return;
    }

    const audioTracks = stream.getAudioTracks();
    mediaRequestRef.current = {
      ...mediaRequestRef.current,
      status: "resolved",
      settledAt: Date.now(),
      audioTracks: audioTracks.length,
    };

    /*
     * THE LATE-RESULT GATE, AND THE WHOLE POINT OF THE TOKEN. The operator may have cancelled, the
     * surface may have unmounted, or a newer attempt may have started while the browser was holding
     * this promise. The decision is a pure function so it can be enumerated in a test rather than
     * only read: `adopt` is the ONLY answer that permits an AudioContext, a recognizer or a state
     * change, and every refusal stops the tracks.
     */
    const adoption = decideMediaAdoption({
      isCurrentAttempt: current(),
      audioTrackCount: audioTracks.length,
    });
    if (adoption.action === "discard") {
      discard(stream);
      if (adoption.reason === "no-audio-track") {
        markPhase("failed");
        failWith("device-missing");
      }
      // `abandoned` is silent on purpose: nobody is waiting for this result, and a failure the
      // operator did not cause must not appear on their screen.
      return;
    }

    markPhase("media-acquired");

    const globals = voiceGlobals();
    const RecognizerCtor = globals.SpeechRecognition ?? globals.webkitSpeechRecognition;
    const AudioCtor = globals.AudioContext ?? globals.webkitAudioContext;
    if (!RecognizerCtor || !AudioCtor) {
      // Unreachable through the UI (the control is inert without a recognizer), but a stream that
      // cannot be used must still be closed rather than left open.
      for (const track of stream.getTracks()) track.stop();
      failWith("no-recognition-support");
      return;
    }

    streamRef.current = stream;
    // If the device disappears mid-capture the state must follow it, not linger on "Listening".
    for (const track of stream.getTracks()) {
      track.onended = () => {
        if (hebyVoiceHasAudioLevel(stateRef.current)) failWith("stream-ended");
      };
    }

    /*
     * THE AUDIO GRAPH:  MediaStream → MediaStreamAudioSourceNode → AnalyserNode → (nothing).
     *
     * The analyser is a SINK. It is never connected to `context.destination`, so nothing the operator
     * says is played back through their speakers — a microphone routed to the output is feedback, and
     * an analyser does not need to be audible to measure.
     *
     * V1.2 — THE CONTEXT MUST BE PROVEN RUNNING, NOT ASSUMED. This code runs in an async continuation
     * after `await getUserMedia`, by which point the operator has read a disclosure and answered
     * Chrome's own permission prompt — seconds during which transient user activation expires. An
     * AudioContext constructed without activation starts SUSPENDED, and a suspended context feeds the
     * analyser nothing but silence bytes. That produces a genuinely open microphone with a
     * permanently zero amplitude, which is exactly the failure a real microphone found.
     */
    markPhase("audio-context-starting");
    let analyser: AnalyserNode;
    try {
      const context = new AudioCtor();
      audioContextRef.current = { created: true, resumeAttempted: false, resumeSucceeded: false };
      contextRef.current = context;
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      context.createMediaStreamSource(stream).connect(analyser);

      if (context.state === "suspended") {
        audioContextRef.current = { ...audioContextRef.current, resumeAttempted: true };
        await context.resume();
      }
      audioContextRef.current = {
        ...audioContextRef.current,
        resumeSucceeded: context.state === "running",
      };

      // V1.3 — the same late-result gate as above. Teardown, a cancel, or a newer attempt may have
      // happened while `resume()` was in flight, and this stream is then unwanted.
      if (!current() || contextRef.current !== context) {
        discard(stream);
        return;
      }
      if (context.state !== "running") {
        // Fail LOUDLY. A silent dead orb beside the word "Listening" is the one outcome this
        // architecture must never produce.
        failWith("audio-context-failed");
        return;
      }

      analyserRef.current = analyser;
      // Diagnostic counters describe THIS capture, not the session.
      samplesRef.current = 0;
      nonZeroSamplesRef.current = 0;
      peakLevelRef.current = 0;
      // Measurement is live from here. Set BEFORE the loop starts, synchronously, so the first frame
      // cannot observe a stale gate.
      measuringRef.current = true;
      startMeasuring(analyser);
    } catch {
      failWith("audio-context-failed");
      return;
    }

    /*
     * RECOGNITION GOES THROUGH THE ADAPTER, and the adapter is chosen from the MEASURED locality —
     * so a machine that proved it can keep this language local gets an adapter that requires it.
     * Everything below this line is provider-neutral: the runtime handles text, an ending, and an
     * outcome in Hebun's own vocabulary, and would handle an authorized server-side provider through
     * exactly these three callbacks.
     */
    markPhase("recognition-starting");
    transcriptRef.current = "";
    const speechToText: HebySpeechToTextAdapter = createBrowserSpeechToText(RecognizerCtor, locality);
    recognitionRef.current = speechToText.start({
      language,
      capture: stream,
      onFinalText: (text) => {
        transcriptRef.current = `${transcriptRef.current} ${text}`.trim();
      },
      onOutcome: (outcome: HebySpeechToTextOutcome) => {
        if (outcome === "denied") {
          teardown(true);
          dispatch({ type: "permission-denied" });
          return;
        }
        // Silence is reported honestly by the end callback as "nothing recognized".
        if (outcome === "empty") return;
        failWith(outcome);
      },
      onEnded: () => {
        recognitionRef.current = null;
        // Recognition may end on its own (a long pause). Either way capture is over: close the
        // analysis stream too, so a finished recognition never leaves the microphone open.
        teardown(true);
        if (stateRef.current === "listening" || stateRef.current === "transcribing") deliverTranscript();
      },
    });

    markPhase("listening");
    setFailure(null);
    dispatch({ type: "capture-started" });
  }, [deliverTranscript, failWith, language, locality, markPhase, startMeasuring, teardown]);

  /* ── Operator controls ──────────────────────────────────────────────────────
   *
   * THE STATE MACHINE DECIDES; THE HANDLER ONLY ACTS ON WHAT IT DECIDED. Both handlers below run the
   * SAME pure reducer the component uses, and open a microphone only if that reducer returns
   * `requesting`. So capture still cannot happen without a legal transition — and because it now
   * happens inside the operator's own click rather than in a later effect, the browser sees a
   * genuine user gesture, which is what `getUserMedia` is meant to be called from.
   */

  const onActivate = useCallback(() => {
    setFailure(null);
    /*
     * V1.1 INTERRUPTION, AND IT IS THE ONLY KIND VOICE V1.1 HAS. Reaching for the microphone while
     * Heby is talking means "stop and listen to me", so playback is ended FIRST — synchronously,
     * before any transition — and the two are never live at the same time. This is the deliberate
     * safe half of barge-in: it is driven by an explicit press, never by an open microphone
     * listening for the operator to start talking over the answer. True conversational barge-in
     * needs a standing capture, which Voice does not have and will not grow in this phase.
     */
    if (stateRef.current === "speaking") synthesis?.stop();
    const event = { type: "activate", acknowledged } as const;
    const next = hebyVoiceReducer(stateRef.current, event);
    dispatch(event);
    // ONE operator action mints exactly ONE attempt, and only when the reducer legalised it.
    if (next === "requesting") void beginCapture((captureAttemptRef.current += 1));
  }, [acknowledged, beginCapture, synthesis]);

  const onAcknowledge = useCallback(() => {
    // Session-scoped only: nothing is written to storage, so a new page load discloses again.
    setAcknowledged(true);
    const next = hebyVoiceReducer(stateRef.current, { type: "acknowledge" });
    dispatch({ type: "acknowledge" });
    if (next === "requesting") void beginCapture((captureAttemptRef.current += 1));
  }, [beginCapture]);

  const onStop = useCallback(() => {
    dispatch({ type: "capture-stopped" });
    // Stop the analysis stream immediately — the operator asked for the microphone to close — and
    // let the recognizer flush its final result through `onend`.
    measuringRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setLevel(0);
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    teardown(false);
  }, [teardown]);

  const onCancel = useCallback(() => {
    // Teardown has already invalidated the attempt token, so a permission prompt still on screen can
    // resolve afterwards and its stream will be stopped rather than adopted.
    teardown(true);
    markPhase("cancelled");
    transcriptRef.current = "";
    setFailure(null);
    dispatch({ type: "cancel" });
  }, [markPhase, teardown]);

  const onToggleOutput = useCallback(() => {
    setOutputEnabled((enabled) => {
      if (enabled) stopSpeaking();
      return !enabled;
    });
  }, [stopSpeaking]);

  /*
   * SPEAK AN ANSWER. Three guards, in order: it must be a NEW answer, voice output must be ON, and
   * the microphone must not be open (Heby does not talk into its own capture). The text it receives
   * is the human-facing answer the operator can already read — see `selectSpokenAnswer`.
   */
  const announceAnswer = useCallback(
    (text: string | null) => {
      if (lastAnswerRef.current === undefined) {
        // Seed: whatever already existed when this runtime appeared is history, not news.
        lastAnswerRef.current = text;
        return;
      }
      if (text === null || text === lastAnswerRef.current) return;
      lastAnswerRef.current = text;
      if (!outputEnabled || !synthesis) return;
      if (hebyVoiceHasAudioLevel(stateRef.current)) return;

      /*
       * THROUGH THE ADAPTER, and the adapter receives ONE STRING. Not the prompt, not the evidence,
       * not the provenance, not a record reference, not a conversation or request id, not a tenant,
       * not a limitation note — `selectSpokenAnswer` already reduced the turn to the text the
       * operator can read on screen, and that is the entire payload.
       */
      synthesis.speak({
        text,
        language,
        onStarted: () => dispatch({ type: "speech-started" }),
        onEnded: () => dispatch({ type: "speech-ended" }),
        onFailed: () => {
          setFailure(hebyVoiceFailureText("synthesis-failed"));
          dispatch({ type: "speech-ended" });
        },
      });
    },
    [language, outputEnabled, synthesis],
  );

  const registerTranscriptSink = useCallback((sink: (transcript: string) => void) => {
    sinkRef.current = sink;
    return () => {
      if (sinkRef.current === sink) sinkRef.current = null;
    };
  }, []);

  const resolveReview = useCallback(() => dispatch({ type: "review-resolved" }), []);

  /*
   * CHOOSE THE LANGUAGE. Refused while a microphone is open: a capture keeps the language it began
   * with, because changing it mid-recognition would mean the operator's earlier words and later words
   * were interpreted under different assumptions, with nothing on screen saying so.
   */
  const onSelectLanguage = useCallback((next: HebyVoiceLanguage) => {
    if (hebyVoiceIsCapturing(stateRef.current) || stateRef.current === "requesting") return;
    setLanguage(next);
  }, []);

  /*
   * INSTALL THE ON-DEVICE LANGUAGE PACK. Offered only where the browser said one is downloadable, and
   * only ever run from the operator's own press — the download is theirs to accept, and the browser
   * shows its own UI for it. The result is not trusted: availability is RE-ASKED afterwards, so the
   * locality claim still comes from the browser's answer rather than from the fact that a download
   * was attempted.
   */
  const installOnDevice = useCallback(() => {
    const Ctor = recognizerConstructor();
    const install = Ctor?.install;
    const ask = Ctor?.available;
    if (!install || !ask) {
      installStateRef.current = {
        status: "failed",
        requestedAt: Date.now(),
        settledAt: Date.now(),
        errorName: "NotSupported",
        availabilityAfter: null,
      };
      setInstallStatus("failed");
      return;
    }
    const tag = hebyVoiceRecognitionTag(language);
    installStateRef.current = {
      status: "requested",
      requestedAt: Date.now(),
      settledAt: null,
      errorName: null,
      availabilityAfter: null,
    };
    setInstallStatus("requested");
    setAnswered({ language, value: "downloading" });
    void install({ langs: [tag] })
      .then(() => ask({ langs: [tag], processLocally: true }))
      .then((answer) => {
        /*
         * V1.3 — SUCCESS IS WHAT THE RE-CHECK SAYS, NOT WHAT THE PROMISE SAYS. A settled install
         * promise proves the browser finished working; it does not prove the language became
         * available. Only `available` earns "installed"; anything else is reported as the
         * unglamorous truth rather than quietly removing the offer and looking like nothing
         * happened, which is exactly how this failed the first time.
         */
        installStateRef.current = {
          ...installStateRef.current,
          status: "resolved",
          settledAt: Date.now(),
          availabilityAfter: answer,
        };
        setAnswered({ language, value: answer });
        setInstallStatus(answer === "available" ? "installed" : "no-change");
      })
      .catch((error: unknown) => {
        installStateRef.current = {
          ...installStateRef.current,
          status: "failed",
          settledAt: Date.now(),
          errorName: error instanceof Error ? error.name : "UnknownError",
        };
        setAnswered({ language, value: "unsupported" });
        setInstallStatus("failed");
      });
  }, [language]);

  /*
   * THE EXPOSED STATE. A browser that cannot do voice input reports `unsupported` no matter what the
   * reducer holds, so the control is inert before detection has run and stays inert where the
   * capability is genuinely missing.
   */
  const state: HebyVoiceState = hebyVoiceInputAvailable(capability) ? rawState : "unsupported";

  const value = useMemo<HebyVoiceRuntime>(
    () => ({
      state,
      capability,
      // The last gate: a level is only presentable in the one state that measures one.
      audioLevel: presentableAudioLevel(level, hebyVoiceHasAudioLevel(state)),
      recognitionLocality: locality,
      onDeviceAvailability: availability,
      language,
      /*
       * V1.3 presentation facts. Both are WORDS, not states: the reducer still says `requesting`
       * while a request stalls, and still decides everything else.
       */
      mediaStalled: mediaStalled && capturePhase === "media-pending",
      installStatus,
      outputEnabled,
      failure,
      onActivate,
      onAcknowledge,
      onStop,
      onCancel,
      onToggleOutput,
      onStopSpeaking: stopSpeaking,
      onSelectLanguage,
      // Offered ONLY where the browser said a pack is downloadable. Null everywhere else, so the
      // surface cannot render an affordance for something that would do nothing.
      onInstallOnDevice: canInstallOnDeviceRecognition(availability) ? installOnDevice : null,
      registerTranscriptSink,
      announceAnswer,
      resolveReview,
      providers: describeSpeechAdapters({ id: recognitionAdapterId(locality), locality }, synthesis),
      disclosureLines: hebyVoiceDisclosureLines({ locality, availability, language }),
    }),
    [
      state,
      capability,
      level,
      locality,
      availability,
      language,
      mediaStalled,
      capturePhase,
      installStatus,
      outputEnabled,
      failure,
      onActivate,
      onAcknowledge,
      onStop,
      onCancel,
      onToggleOutput,
      stopSpeaking,
      onSelectLanguage,
      installOnDevice,
      registerTranscriptSink,
      announceAnswer,
      resolveReview,
      synthesis,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

/**
 * The one voice runtime. Returns null outside the provider so a surface rendered without one simply
 * has no voice affordance rather than crashing — voice failing must never break typed Heby.
 */
export function useHebyVoiceRuntime(): HebyVoiceRuntime | null {
  return useContext(VoiceContext);
}
