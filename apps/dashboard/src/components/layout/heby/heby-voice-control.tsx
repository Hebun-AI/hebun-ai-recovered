"use client";

/*
 * heby-voice-control.tsx — the operator's voice controls (Voice V1).
 *
 * Pure presentation, split into the two places the composer has room for it:
 *
 *   HebyVoiceNotices  above the input — the disclosure gate, the state line, the failure sentence.
 *   HebyVoiceButtons  inside the input row — the microphone control and the spoken-answers toggle.
 *
 * Two components, ONE voice runtime behind them. Every value arrives as a prop and every action is a
 * callback, so nothing here opens a microphone, measures anything, or speaks; both are provable with
 * renderToStaticMarkup.
 *
 * THE HONESTY RULES THIS FILE EXISTS TO KEEP:
 *
 *  - "Listening" renders for EXACTLY ONE state, the one in which a microphone stream is genuinely
 *    open, and disappears the instant capture ends. There is no idle "Listening", no "Voice ready",
 *    no "Online", no fake waveform and no level meter — the only amplitude the operator sees is the
 *    presence field, driven by a measured number.
 *  - The microphone is a single explicit affordance. No auto-start, no wake word, no hold-to-talk
 *    that a stray keypress could trigger, and no path to capture except pressing it.
 *  - Where voice cannot work, the control says why in words rather than vanishing.
 *  - Every state is carried by TEXT as well as by icon and colour, so orb movement is never the only
 *    signal, and the state line is announced politely to assistive technology.
 *
 * IT NEVER SENDS. There is no submit affordance here. A transcript lands in the composer and the
 * operator sends it — same button, same gate, same S1 parser as typed text.
 */

import { Mic, MicOff, Square, Volume2, VolumeX, ShieldAlert, Download } from "lucide-react";
import {
  hebyCaptureStallNotice,
  HEBY_VOICE_LANGUAGES,
  hebyVoiceInputAvailable,
  hebyVoiceLanguageLabel,
  hebyVoiceStateLabel,
  installStatusLine,
  recognitionLocalityLabel,
  type HebyInstallStatus,
  type HebyVoiceCapability,
  type HebyVoiceLanguage,
  type HebyVoiceState,
  type HebyRecognitionLocality,
} from "@/features/heby-voice";

/** Everything both halves of the control need. One view model, so they cannot disagree. */
export interface HebyVoiceView {
  readonly state: HebyVoiceState;
  readonly capability: HebyVoiceCapability;
  /** Voice output (spoken answers) is on. */
  readonly outputEnabled: boolean;
  /** An honest failure sentence, or null. */
  readonly failure: string | null;
  /** What the operator reads before the first capture of the session. */
  readonly disclosureLines: readonly string[];
  /** The conversation seam is busy. Voice input waits its turn rather than racing it. */
  readonly busy: boolean;
  /** The chosen language. Rendered as a real control, because it is a real choice. */
  readonly language: HebyVoiceLanguage;
  /** V1.3. The browser has not answered the microphone request yet. Words only — nothing is denied. */
  readonly mediaStalled: boolean;
  /** V1.3. What the on-device install request did, so pressing it is never invisible. */
  readonly installStatus: HebyInstallStatus;
  /**
   * WHERE the audio is processed, measured rather than assumed. The one fact that decides whether
   * this session's speech leaves the machine, so it is shown while voice is in use — not buried.
   */
  readonly recognitionLocality: HebyRecognitionLocality;
  readonly onSelectLanguage: (language: HebyVoiceLanguage) => void;
  /** Present only where the browser said an on-device language pack could be installed. */
  readonly onInstallOnDevice: (() => void) | null;
  readonly onActivate: () => void;
  readonly onAcknowledge: () => void;
  readonly onStop: () => void;
  readonly onCancel: () => void;
  readonly onToggleOutput: () => void;
  readonly onStopSpeaking: () => void;
}

/** Same density language as the composer: one component, two amounts of room. */
export type HebyVoiceDensity = "workspace" | "panel";

/** The accessible name of the microphone button in each state. Never overstates what is happening. */
const MIC_LABEL: Record<HebyVoiceState, string> = {
  unsupported: "Voice input is unavailable in this browser",
  idle: "Start voice input",
  disclosure: "Cancel voice input",
  requesting: "Cancel the microphone permission request",
  listening: "Stop listening",
  transcribing: "Cancel transcription",
  review: "Start voice input again",
  speaking: "Start voice input",
  denied: "Microphone permission is blocked",
  error: "Try voice input again",
};

/**
 * The states that show a state line. The resting states show nothing: a permanent voice status
 * readout on an idle composer would be chrome pretending to be information.
 */
const NARRATED: ReadonlySet<HebyVoiceState> = new Set<HebyVoiceState>([
  "requesting",
  "listening",
  "transcribing",
  "review",
  "speaking",
  "denied",
]);

const NOTICE_ID = "heby-voice-notice";

/* ── Notices: the disclosure gate, the state line, the failure sentence ───── */

export function HebyVoiceNotices({ voice }: { readonly voice: HebyVoiceView }) {
  const { state } = voice;
  const capturing = state === "listening";
  const notice = state === "unsupported" || state === "denied" ? capabilityNotice(voice.capability, state) : null;

  return (
    <>
      {/*
       * THE DISCLOSURE. Shown BEFORE any capture, once per session, and it is a real gate: the only
       * way past it is the operator's own confirmation. Nothing is open while it is on screen.
       */}
      {state === "disclosure" ? (
        <div
          data-heby-voice-disclosure="open"
          role="dialog"
          aria-label="Before you use voice input"
          className="mb-3 rounded-2xl border border-highlight/40 bg-surface-sunken px-4 py-3"
        >
          <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-highlight">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Before you speak
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[0.8rem] leading-5 text-fg-secondary">
            {voice.disclosureLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={voice.onAcknowledge}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-on-primary transition-colors duration-(--dur-fast) hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
            >
              <Mic className="size-3.5" aria-hidden="true" />
              Turn on the microphone
            </button>
            {/*
             * THE ONE PLACE HEBUN OFFERS TO IMPROVE ITS OWN PRIVACY POSTURE. Rendered only when the
             * browser reported a downloadable on-device language pack, so it never promises a
             * capability that does not exist — and it is the operator's press, because the download
             * is theirs to accept.
             */}
            {voice.onInstallOnDevice ? (
              <button
                type="button"
                onClick={voice.onInstallOnDevice}
                data-heby-voice-install="offered"
                className="inline-flex items-center gap-1.5 rounded-full border border-highlight/50 px-3.5 py-1.5 text-xs font-medium text-highlight transition-colors duration-(--dur-fast) hover:bg-highlight/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Keep speech on this device
              </button>
            ) : null}
            <button
              type="button"
              onClick={voice.onCancel}
              className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/50 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {/*
       * THE STATE LINE. Present only while something is genuinely happening. The dot is decoration;
       * the words carry the state, and they are announced politely rather than assertively so a
       * screen reader is informed without being interrupted mid-sentence.
       */}
      {NARRATED.has(state) ? (
        <p
          role="status"
          aria-live="polite"
          data-heby-voice-state={state}
          className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[0.72rem] leading-5 text-fg-secondary"
        >
          <span
            aria-hidden="true"
            className={`inline-block size-1.5 rounded-full ${
              capturing || state === "speaking" ? "bg-(--heby-presence)" : "bg-fg-muted"
            }`}
          />
          <span>{hebyVoiceStateLabel(state)}</span>
          {/*
           * WHO IS PROCESSING THIS, shown WHILE it is happening rather than only in a disclosure the
           * operator read once. It is the measured locality, so "On-device speech" appears only when
           * the browser proved it and the recognizer was told to require it.
           */}
          {capturing || state === "transcribing" ? (
            <span
              data-heby-voice-locality={voice.recognitionLocality}
              className="rounded-full border border-border px-2 py-0.5 text-[0.66rem] font-medium text-fg-muted"
            >
              {recognitionLocalityLabel(voice.recognitionLocality)}
            </span>
          ) : null}
          {state === "speaking" ? (
            <button
              type="button"
              onClick={voice.onStopSpeaking}
              className="rounded-full border border-border px-2 py-0.5 text-[0.68rem] font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/50 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
            >
              Stop speaking
            </button>
          ) : null}
        </p>
      ) : null}

      {/*
       * Why voice cannot run. Visible for a blocked microphone, because the operator just tried and
       * is owed the reason; kept as an associated description when the browser simply lacks the
       * capability, so an unusable browser does not carry a permanent banner.
       */}
      {notice ? (
        state === "denied" ? (
          <p role="status" aria-live="polite" className="mb-2 px-1 text-[0.72rem] leading-5 text-warning">
            {notice}
          </p>
        ) : (
          <span id={NOTICE_ID} className="sr-only">
            {notice}
          </span>
        )
      ) : null}

      {/*
       * V1.3 — THE STALL NOTICE. A microphone request the browser has not answered used to read as
       * "Waiting for microphone permission" forever, with no explanation and no obvious way out.
       * This says what is actually true — Chrome has not answered — names both places the answer
       * could be WITHOUT claiming which, and puts Cancel where the operator is already looking.
       * Nothing here denies, retries or resolves anything: the request may still be pending.
       */}
      {state === "requesting" && voice.mediaStalled ? (
        <div
          data-heby-voice-stalled="true"
          role="status"
          aria-live="polite"
          className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-sunken px-3 py-2 text-[0.72rem] leading-5 text-fg-secondary"
        >
          <span>{hebyCaptureStallNotice()}</span>
          <button
            type="button"
            onClick={voice.onCancel}
            className="rounded-full border border-border px-2.5 py-0.5 text-[0.68rem] font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/50 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            Cancel the request
          </button>
        </div>
      ) : null}

      {/* V1.3 — an install request always says what it did, including when it changed nothing. */}
      {installStatusLine(voice.installStatus) ? (
        <p
          role="status"
          aria-live="polite"
          data-heby-voice-install-status={voice.installStatus}
          className="mb-2 px-1 text-[0.72rem] leading-5 text-fg-secondary"
        >
          {installStatusLine(voice.installStatus)}
        </p>
      ) : null}

      {voice.failure ? (
        <p role="status" aria-live="polite" className="mb-2 px-1 text-[0.72rem] leading-5 text-warning">
          {voice.failure}
        </p>
      ) : null}
    </>
  );
}

/* ── Buttons: the microphone, and the spoken-answers toggle ───────────────── */

export function HebyVoiceButtons({
  voice,
  density,
}: {
  readonly voice: HebyVoiceView;
  readonly density: HebyVoiceDensity;
}) {
  const { state, capability } = voice;
  const panel = density === "panel";
  const available = hebyVoiceInputAvailable(capability);
  const capturing = state === "listening";
  const blocked = state === "unsupported" || state === "denied";

  /*
   * One button, three jobs, decided by real state: start when nothing is running, stop when the
   * microphone is genuinely open, cancel while a permission request or transcription is in flight.
   * The operator can always get out of voice.
   */
  const micAction = capturing
    ? voice.onStop
    : state === "requesting" || state === "transcribing" || state === "disclosure"
      ? voice.onCancel
      : voice.onActivate;

  const iconSize = panel ? "size-4" : "size-[1.05rem]";
  const buttonSize = panel ? "size-9" : "size-10";

  return (
    <div
      data-heby-voice-controls={available ? "available" : "unavailable"}
      className="flex shrink-0 items-center gap-1"
    >
      {/*
       * THE LANGUAGE IS A CHOICE, SO IT IS A CONTROL. Two options, next to the microphone, where the
       * decision is actually made — not buried in a settings screen that does not exist. It is
       * disabled while a microphone is open, because a capture keeps the language it began with.
       *
       * This is a LOCAL PREFERENCE for this session. It is not persisted, and it says nothing about
       * the organization's language — Hebun has no such record, and this control does not invent one.
       */}
      {available ? (
        <select
          value={voice.language}
          onChange={(event) => voice.onSelectLanguage(event.target.value as HebyVoiceLanguage)}
          disabled={capturing || state === "transcribing" || state === "requesting"}
          aria-label="Voice input language"
          title="Voice input language"
          data-heby-voice-language={voice.language}
          className={`h-7 shrink-0 rounded-full border border-border bg-transparent px-1.5 text-[0.68rem] font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {HEBY_VOICE_LANGUAGES.map((option) => (
            <option key={option} value={option}>
              {hebyVoiceLanguageLabel(option)}
            </option>
          ))}
        </select>
      ) : null}

      {capability.canSynthesize ? (
        <button
          type="button"
          onClick={voice.onToggleOutput}
          aria-pressed={voice.outputEnabled}
          aria-label={voice.outputEnabled ? "Turn off spoken answers" : "Turn on spoken answers"}
          title={voice.outputEnabled ? "Spoken answers on" : "Spoken answers off"}
          data-heby-voice-output={voice.outputEnabled ? "on" : "off"}
          className={`inline-flex ${buttonSize} shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight ${
            voice.outputEnabled ? "bg-highlight/12 text-highlight" : "text-fg-muted hover:bg-surface-raised hover:text-fg"
          }`}
        >
          {voice.outputEnabled ? (
            <Volume2 className={iconSize} aria-hidden="true" />
          ) : (
            <VolumeX className={iconSize} aria-hidden="true" />
          )}
        </button>
      ) : null}

      <button
        type="button"
        onClick={micAction}
        /* Blocked is inert. Busy defers a NEW capture but never traps an open microphone. */
        disabled={blocked || (voice.busy && !capturing)}
        aria-pressed={capturing}
        aria-label={MIC_LABEL[state]}
        aria-describedby={state === "unsupported" ? NOTICE_ID : undefined}
        title={blocked ? capabilityNotice(capability, state) : MIC_LABEL[state]}
        data-heby-voice-mic={state}
        className={`inline-flex ${buttonSize} shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:cursor-not-allowed disabled:opacity-40 ${
          capturing
            ? "bg-(--heby-presence)/18 text-(--heby-presence)"
            : "text-fg-muted hover:bg-surface-raised hover:text-fg"
        }`}
      >
        {capturing ? (
          <Square className={`${iconSize} fill-current`} aria-hidden="true" />
        ) : blocked ? (
          <MicOff className={iconSize} aria-hidden="true" />
        ) : (
          <Mic className={iconSize} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Why voice input cannot run here, in one sentence. It names the missing capability rather than
 * saying "unavailable" and leaving the operator to guess.
 */
function capabilityNotice(capability: HebyVoiceCapability, state: HebyVoiceState): string {
  if (state === "denied") {
    return "Microphone access is blocked for this site. Change it in your browser's site settings, then try again.";
  }
  switch (capability.blockedReason) {
    case "insecure-context":
      return "Voice input needs a secure (HTTPS) connection.";
    case "no-microphone-support":
      return "This browser has no microphone support.";
    case "audio-context-failed":
      return "This browser cannot analyse audio.";
    case "no-recognition-support":
      return "This browser cannot turn speech into text.";
    default:
      return "Voice input is unavailable in this browser.";
  }
}
