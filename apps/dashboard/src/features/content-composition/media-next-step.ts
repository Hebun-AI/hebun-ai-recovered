/*
 * content-composition/media-next-step.ts — HEBY-MEDIA-4: observe the current authoritative state of a
 * draft's media and name the next step. It performs none of them.
 *
 * PURE. Input: the facts HEBY-MEDIA-1 read, the HEBY-MEDIA-2 choice, the HEBY-MEDIA-3 prefill, and the
 * Content Package state CONTENT-COMPOSE-1's reader already derived. Output: a closed observation. No
 * I/O, clock, timer or poll; nothing is stored, so every render recomputes it from current truth.
 *
 *     PROVIDER SUCCEEDED != ADMITTED != REVIEW ACCEPTED != SELECTED
 *     MEDIA COMPLETE != CONTENT PACKAGE READY != PUBLISHABLE
 *
 * Media orchestration STOPS when the media-owned part is done: the recommended, review-accepted media
 * is selected. Copy review, Governance and publishing are named as OUTSIDE this loop, never pursued.
 * Package readiness is taken from the package reader's blockers, never recomputed here.
 */
import type { DraftMediaFacts, MediaChoice, MediaChoiceCode } from "./media-choice";
import type { MediaPrefill } from "./media-prefill";

export type PackageStateFact =
  | { readonly status: "read"; readonly ready: boolean; readonly blockers: readonly string[] }
  | { readonly status: "unavailable" };

export const MEDIA_NEXT_STEP_STATES = [
  "unavailable",
  "media-complete",
  "generation-awaiting-admission",
  "generation-pending",
  "media-awaiting-selection",
  "media-awaiting-review",
  "media-blocked",
  "ask-human",
] as const;
export type MediaNextStepState = (typeof MEDIA_NEXT_STEP_STATES)[number];

/** The EXISTING human action the next step points at, if any. Heby performs none of them. */
export type MediaHumanAction =
  | "none"
  | "observe-generation"
  | "admit-generation"
  | "review-media"
  | "select-media"
  | "choose-media";

export const MEDIA_NEXT_STEP_CODES = [
  "media-selection-satisfied",
  "generation-registered-not-sent",
  "generation-dispatching",
  "generation-dispatch-unknown",
  "generation-provider-pending",
  "generation-awaiting-admission",
  "generation-failed",
  "admission-not-completed",
  "media-review-required",
  "media-review-declined",
  "media-selection-required",
  "supplied-media-outside-review",
  "generation-blocked",
  "human-choice-required",
  "package-unreadable",
  "content-package-ready",
  "content-package-blocked",
  "remaining-concern-outside-media",
  "readiness-is-not-publish-authorization",
] as const;
export type MediaNextStepCode = (typeof MEDIA_NEXT_STEP_CODES)[number];

export const MEDIA_NEXT_STEP_EXPLANATIONS: Readonly<Record<MediaNextStepCode, string>> = {
  "media-selection-satisfied": "The recommended media is review-accepted and already selected in the current revision; media preparation is complete.",
  "generation-registered-not-sent": "A generation attempt is registered but was not sent to the provider; there is no dispatch control for it.",
  "generation-dispatching": "A generation attempt is being sent to the provider.",
  "generation-dispatch-unknown": "Whether a generation attempt reached the provider is unknown; it is never retried automatically.",
  "generation-provider-pending": "A generation attempt is with the provider. A human can check it with the existing observe action; Heby does not poll.",
  "generation-awaiting-admission": "The provider reported success, but the video is not admitted into Media yet. A human can admit it with the existing action.",
  "generation-failed": "A generation attempt for this draft failed.",
  "admission-not-completed": "An admission attempt for this draft was refused or failed.",
  "media-review-required": "Generated media is admitted but has no MEDIA-3 review record. A human reviews it, with their own reason.",
  "media-review-declined": "Generated media carries a declined MEDIA-3 review record and is not eligible.",
  "media-selection-required": "Review-accepted media is not selected yet. A human selects it with the existing action.",
  "supplied-media-outside-review": "Supplied media is outside media review and selection, so it is not waiting for review.",
  "generation-blocked": "The recommended generation is blocked; no generation step is available.",
  "human-choice-required": "A human has to choose; Hebun holds no rule that decides it.",
  "package-unreadable": "The Content Package could not be read, so the state is not known.",
  "content-package-ready": "The Content Package reader reports the package ready.",
  "content-package-blocked": "The Content Package reader reports blockers.",
  "remaining-concern-outside-media": "What remains is outside media orchestration.",
  "readiness-is-not-publish-authorization": "A package state is not publish capability, publish authorization or a publish.",
};

/** Package blockers the MEDIA part owns. Everything else (copy) is outside this loop. */
const MEDIA_PACKAGE_BLOCKERS = new Set(["no-media-selected", "selected-media-retired", "selected-media-declined", "selected-media-unreviewed"]);

export interface MediaNextStep {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly state: MediaNextStepState;
  readonly humanAction: MediaHumanAction;
  readonly mediaComplete: boolean;
  readonly reasons: readonly MediaNextStepCode[];
  /** Carried from HEBY-MEDIA-2, unchanged. */
  readonly blockers: readonly MediaChoiceCode[];
  readonly unknowns: readonly MediaChoiceCode[];
  readonly assetIds: readonly string[];
  readonly invocationIds: readonly string[];
  readonly packageReady: boolean | null;
  readonly packageBlockers: readonly string[];
  /** Package blockers that are not media's: named, never pursued by this loop. */
  readonly outsideMediaBlockers: readonly string[];
  readonly explanation: readonly string[];
}

const ORDER = new Map<MediaNextStepCode, number>(MEDIA_NEXT_STEP_CODES.map((c, i) => [c, i]));
const ordered = (xs: readonly MediaNextStepCode[]) => [...new Set(xs)].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
const ids = (xs: Iterable<string>) => [...new Set(xs)].sort();

export function evaluateMediaNextStep(
  facts: DraftMediaFacts,
  choice: MediaChoice,
  prefill: MediaPrefill,
  pkg: PackageStateFact,
): MediaNextStep {
  const attempts = facts.attempts ?? [];
  const byState = (states: readonly string[]) => attempts.filter((a) => states.includes(a.state));
  const awaitingAdmission = attempts.filter((a) => a.state === "provider-succeeded" && a.admissionOutcome === "not-attempted");
  const inFlight = byState(["registered", "dispatching", "dispatch-unknown", "provider-pending"]);
  const unreviewed = facts.media.filter((m) => m.origin === "generated" && m.lifecycle === "admitted" && m.review === "none");

  const notes: MediaNextStepCode[] = [];
  if (byState(["dispatch-failed", "provider-failed"]).length > 0) notes.push("generation-failed");
  if (attempts.some((a) => a.admissionOutcome === "refused" || a.admissionOutcome === "failed")) notes.push("admission-not-completed");
  if (facts.media.some((m) => m.origin === "supplied")) notes.push("supplied-media-outside-review");
  if (facts.media.some((m) => m.origin === "generated" && m.review === "declined")) notes.push("media-review-declined");

  const packageBlockers = pkg.status === "read" ? [...pkg.blockers] : [];
  const outside = packageBlockers.filter((b) => !MEDIA_PACKAGE_BLOCKERS.has(b));
  const packageCodes: MediaNextStepCode[] =
    pkg.status !== "read"
      ? []
      : [
          pkg.ready ? "content-package-ready" : "content-package-blocked",
          ...(outside.length > 0 ? (["remaining-concern-outside-media"] as const) : []),
          "readiness-is-not-publish-authorization",
        ];

  const done = (
    state: MediaNextStepState,
    humanAction: MediaHumanAction,
    reasons: MediaNextStepCode[],
    assetIds: Iterable<string> = [],
    invocationIds: Iterable<string> = [],
    mediaComplete = false,
  ): MediaNextStep => {
    const r = ordered(reasons);
    return {
      artifactId: facts.artifactId,
      revisionNo: facts.currentRevision,
      state,
      humanAction,
      mediaComplete,
      reasons: r,
      blockers: choice.blockers,
      unknowns: choice.unknowns,
      assetIds: ids(assetIds),
      invocationIds: ids(invocationIds),
      packageReady: pkg.status === "read" ? pkg.ready : null,
      packageBlockers,
      outsideMediaBlockers: outside,
      explanation: [
        ...r.map((c) => MEDIA_NEXT_STEP_EXPLANATIONS[c]),
        ...(packageBlockers.length > 0 ? [`Content Package blockers: ${packageBlockers.join(", ")}.`] : []),
      ],
    };
  };

  /* 0 — nothing can be said without the package. */
  if (pkg.status !== "read" || !facts.packageReadable) return done("unavailable", "none", ["package-unreadable"]);

  /* 1 — the media part is done: stop, and name what remains outside it. */
  if (prefill.kind === "satisfied") {
    return done("media-complete", "none", ["media-selection-satisfied", ...notes, ...packageCodes], prefill.assetIds, [], true);
  }

  /* 2 — a provider success not yet admitted: admission is a human act through MV-7. */
  if (awaitingAdmission.length > 0) {
    return done("generation-awaiting-admission", "admit-generation", ["generation-awaiting-admission", ...notes], [], awaitingAdmission.map((a) => a.invocationId));
  }

  /* 3 — in flight with the lifecycle authority. Only provider-pending has a human observe action. */
  if (inFlight.length > 0) {
    const codes: MediaNextStepCode[] = [];
    if (inFlight.some((a) => a.state === "registered")) codes.push("generation-registered-not-sent");
    if (inFlight.some((a) => a.state === "dispatching")) codes.push("generation-dispatching");
    if (inFlight.some((a) => a.state === "dispatch-unknown")) codes.push("generation-dispatch-unknown");
    if (inFlight.some((a) => a.state === "provider-pending")) codes.push("generation-provider-pending");
    const action: MediaHumanAction = inFlight.some((a) => a.state === "provider-pending") ? "observe-generation" : "none";
    return done("generation-pending", action, [...codes, ...notes], [], inFlight.map((a) => a.invocationId));
  }

  /* 4 — eligible media exists and is not selected: the existing human selection gate. */
  if (prefill.kind === "select-existing") {
    return done("media-awaiting-selection", "select-media", ["media-selection-required", ...notes, ...(unreviewed.length > 0 ? (["media-review-required"] as const) : [])], prefill.assetIds);
  }

  /* 5 — generated media waits for a human MEDIA-3 decision. Supplied media never does. */
  if (unreviewed.length > 0) {
    return done("media-awaiting-review", "review-media", ["media-review-required", ...notes], unreviewed.map((m) => m.assetId));
  }

  /* 6 — a generation was recommended but is blocked: show it, invent nothing. */
  if (prefill.kind === "generation-not-actionable") return done("media-blocked", "none", ["generation-blocked", ...notes]);

  /* 7 — no defensible deterministic step. */
  return done("ask-human", "choose-media", ["human-choice-required", ...notes]);
}

/** Grounding lines. Deterministic. */
export function formatMediaNextStep(step: MediaNextStep): string[] {
  const list = (xs: readonly string[]) => (xs.length > 0 ? xs.join(", ") : "none");
  return [
    `media next step: ${step.state} · human action: ${step.humanAction} · media complete: ${step.mediaComplete ? "yes" : "no"} (observed now; Heby performs no step)`,
    `next-step reasons: ${list(step.reasons)}`,
    `content package: ${step.packageReady === null ? "unknown" : step.packageReady ? "ready" : "not ready"} · blockers: ${list(step.packageBlockers)} · outside media: ${list(step.outsideMediaBlockers)}`,
    ...step.explanation.map((s) => `now: ${s}`),
  ];
}
