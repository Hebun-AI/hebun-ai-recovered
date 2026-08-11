/*
 * heby-voice/capture-phase.ts — WHERE a capture attempt actually is, as an observation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHY IT IS NOT A SECOND STATE MACHINE
 * ─────────────────────────────────────────────────────────────────────────────
 * The operator-facing state machine (`voice-state.ts`) has ONE `requesting` state, and that is
 * correct for the operator: from their side, "Heby is trying to open the microphone" is one thing.
 * But underneath it, four genuinely different operations happen in sequence, and when the Director's
 * real Chrome hung there, nothing in the product could say WHICH one it hung in.
 *
 * So this is a DIAGNOSTIC VOCABULARY, not an authority:
 *
 *   - It never gates capture. `hebyVoiceReducer` remains the only thing that decides whether a
 *     microphone may be opened, and the only thing the surfaces read for their state.
 *   - It has no transition function. The runtime records where it is; nothing branches on it to
 *     decide what to do next, except the one presentation refinement documented below.
 *   - It cannot invent progress. Every phase is written at the moment the corresponding browser
 *     operation genuinely starts or settles.
 *
 * THE ONE PRESENTATION USE. A request that stays in `media-pending` past a threshold is described
 * more honestly to the operator ("Chrome has not completed the microphone request"), and the Cancel
 * affordance is made obvious. That changes WORDS, never STATE: the machine still says `requesting`,
 * the promise may still be pending, and nothing is denied, retried or resolved on Hebun's authority.
 *
 * Pure: no React, no DOM, no I/O, no timers.
 */

/**
 * The phases of one capture attempt. Ordered by the sequence they genuinely occur in, so a stuck
 * attempt names the exact boundary it is stuck at.
 *
 *   idle                   no attempt in flight.
 *   permission-requested   the operator acted; `getUserMedia` is about to be called.
 *   media-pending          `getUserMedia` was called and its promise has NOT settled. The browser
 *                          and the operating system own this window; Hebun cannot see inside it.
 *   media-acquired         a MediaStream exists with at least one live audio track.
 *   audio-context-starting the analyser graph is being built and the context resumed.
 *   recognition-starting   the speech adapter is being started.
 *   listening              everything is live. This is the only phase with a measured amplitude.
 *   cancelled              the operator abandoned the attempt. A late result must be discarded.
 *   failed                 the attempt ended in an honest failure.
 */
export type HebyCapturePhase =
  | "idle"
  | "permission-requested"
  | "media-pending"
  | "media-acquired"
  | "audio-context-starting"
  | "recognition-starting"
  | "listening"
  | "cancelled"
  | "failed";

/** How a `getUserMedia` call ended, as an observation rather than an interpretation. */
export type HebyMediaRequestStatus = "none" | "pending" | "resolved" | "rejected";

/**
 * How long a media request may stay pending before the operator is told, in plain words, that the
 * browser has not answered yet.
 *
 * THIS IS A PRESENTATION THRESHOLD AND NOTHING ELSE. It does not deny, does not cancel, does not
 * retry, and does not settle the promise — the browser's permission UI can legitimately stay open
 * for minutes while an operator reads it, and calling that "denied" would be a lie. Ten seconds is
 * long enough that a granted-permission fast path never trips it, and short enough that a genuinely
 * stuck request stops looking like a working one.
 */
export const HEBY_MEDIA_STALL_MS = 10_000;

/**
 * TRUE while a capture attempt is waiting on the browser and the operating system, with nothing
 * Hebun can do but wait or be cancelled. The one phase where a stall notice is meaningful.
 */
export function hebyCaptureIsPending(phase: HebyCapturePhase): boolean {
  return phase === "permission-requested" || phase === "media-pending";
}

/**
 * TRUE once a capture attempt has genuinely acquired hardware. From here, abandoning the attempt
 * must stop tracks rather than merely forget about them.
 */
export function hebyCaptureHoldsDevice(phase: HebyCapturePhase): boolean {
  return (
    phase === "media-acquired" ||
    phase === "audio-context-starting" ||
    phase === "recognition-starting" ||
    phase === "listening"
  );
}

/**
 * The sentence shown when a request has been pending past the threshold.
 *
 * It says what is true — the browser has not answered — and points at the two places the answer
 * could be, WITHOUT claiming to know which. Hebun cannot see whether Chrome's prompt is on screen,
 * whether the operating system is holding the request, or whether an administrator policy is
 * involved, so it does not pretend to.
 */
/**
 * What to do with a `getUserMedia` result that has just arrived.
 *
 * This is the decision the V1.3 hang was caused by getting wrong, so it is pure and enumerable
 * rather than inline in an async function nobody can execute in a test.
 */
export type HebyMediaAdoption =
  | { readonly action: "adopt" }
  | { readonly action: "discard"; readonly reason: "abandoned" | "no-audio-track" };

/**
 * Decide whether a freshly-settled MediaStream may be used.
 *
 * TWO REASONS TO REFUSE, AND THE ORDER MATTERS:
 *
 *   abandoned        the attempt that asked for this stream is no longer the one in flight — the
 *                    operator cancelled, the surface unmounted, or a newer attempt superseded it.
 *                    Checked FIRST, because an abandoned attempt's stream must be stopped whatever
 *                    else is wrong with it, and reporting a device fault for a stream nobody wants
 *                    would put a failure on screen the operator never caused.
 *   no-audio-track   the promise resolved but there is nothing to listen to. A resolved promise is
 *                    not a usable device, and this must never be reported as listening.
 *
 * `adopt` is the ONLY answer that permits an AudioContext, a recognizer, or a state change. Both
 * refusals oblige the caller to stop every track on the stream.
 */
export function decideMediaAdoption(input: {
  readonly isCurrentAttempt: boolean;
  readonly audioTrackCount: number;
}): HebyMediaAdoption {
  if (!input.isCurrentAttempt) return { action: "discard", reason: "abandoned" };
  if (input.audioTrackCount <= 0) return { action: "discard", reason: "no-audio-track" };
  return { action: "adopt" };
}

export function hebyCaptureStallNotice(): string {
  return "Chrome has not answered the microphone request yet. Its permission prompt may be waiting, or the system may still be deciding. You can keep waiting or cancel.";
}
