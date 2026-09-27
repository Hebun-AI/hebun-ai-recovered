/*
 * content-composition/media-choice.ts — HEBY-MEDIA-2: a deterministic media-choice evaluator.
 *
 * PURE. It takes the facts HEBY-MEDIA-1 already read through the released authorities and returns a
 * closed recommendation with closed reason codes. No I/O, no clock, no randomness, no model, no
 * score. The same facts always produce the same recommendation, word for word.
 *
 * ── IT RECOMMENDS; IT DOES NOTHING ───────────────────────────────────────────
 *
 * A recommendation is not a selection (CONTENT-COMPOSE-1), not a review (MEDIA-3), not a generation
 * request (MV-4 / MEDIA-2B), not an authorization (Governance) and not a publish. Nothing here can
 * reach any of them; a firewall test pins that this file imports nothing at runtime.
 *
 * ── WHAT IT KNOWS, AND WHAT IT REFUSES TO PRETEND ────────────────────────────
 *
 *  - An existing asset is ELIGIBLE only when it is admitted, generated, and its MEDIA-3 review record
 *    says accepted. A supplied asset is outside review and cannot be selected (the selection writer
 *    joins through the generation invocation), so it is never eligible and never reads as reviewed.
 *  - Hebun encodes no destination media rules (aspect ratio, duration, kind). The only destination
 *    fact in the repository is the publish path: Instagram publishes an IMAGE through Governance
 *    (PUBLISH-0); no path publishes a video, and none reaches TikTok or YouTube.
 *  - A provider switch that is off is a blocker. A switch that is on proves only the switch: the
 *    transport and credential are not visible here, so readiness stays unverified.
 *  - No price exists anywhere in the repository, so every generation path carries `price-unknown`.
 *  - No data-use classification exists, so sending any image to Higgsfield is `data-use-unresolved`.
 *    No asset id, origin, file name or past acceptance can clear it.
 *  - Nothing ranks image against video. When more than one path is open, a human chooses.
 */
import type { ContentDestination } from "@/features/work-artifacts/contracts";

/* ── Input: the facts HEBY-MEDIA-1 read. Nothing here is fetched. ─────────── */

export type MediaFactReview = "accepted" | "declined" | "none" | "unreadable" | "not-applicable";

export interface MediaFact {
  readonly assetId: string;
  readonly kind: "image" | "video";
  readonly origin: "generated" | "supplied";
  readonly lifecycle: "admitted" | "retired";
  /** MEDIA-3's record; `not-applicable` for a supplied asset, which is outside review. */
  readonly review: MediaFactReview;
  readonly selectedInCurrentRevision: boolean;
}

export interface GenerationAttemptFact {
  readonly invocationId: string;
  readonly state: string;
  readonly admissionOutcome: string;
  readonly sourceMediaAssetId: string | null;
}

export interface DraftMediaFacts {
  readonly artifactId: string;
  readonly currentRevision: number;
  readonly destination: ContentDestination | null;
  readonly packageReadable: boolean;
  readonly media: readonly MediaFact[];
  /** `null` when the attempt listing could not be read. */
  readonly attempts: readonly GenerationAttemptFact[] | null;
}

export interface ProviderSwitchFacts {
  /** `higgsfield-video-generation`, read fail-closed. */
  readonly textToVideo: boolean;
  /** `higgsfield-image-to-video`, read fail-closed. */
  readonly imageToVideo: boolean;
  /** Image generation's switch is not read by HEBY-MEDIA-1: its state is not known here. */
  readonly image: "not-read";
}

/* ── Output: a closed recommendation ──────────────────────────────────────── */

export const MEDIA_CHOICE_KINDS = [
  "use-existing",
  "generate-image",
  "generate-text-to-video",
  "generate-image-to-video",
  "none-ask-human",
] as const;
export type MediaChoiceKind = (typeof MEDIA_CHOICE_KINDS)[number];
export type GenerationPath = Exclude<MediaChoiceKind, "use-existing" | "none-ask-human">;

/** Closed, and ordered: every list of codes is emitted in this order. */
export const MEDIA_CHOICE_CODES = [
  "existing-selection-reviewed",
  "existing-reviewed-media",
  "multiple-valid-media-paths",
  "no-eligible-existing-media",
  "selected-media-not-eligible",
  "unreviewed-generated-media",
  "declined-generated-media",
  "supplied-media-outside-review",
  "generation-pending",
  "package-unreadable",
  "attempts-unreadable",
  "provider-disabled",
  "provider-state-unknown",
  "provider-readiness-unverified",
  "no-source-image",
  "data-use-unresolved",
  "price-unknown",
  "destination-rule-unknown",
  "publish-capability-unavailable",
  "human-choice-required",
] as const;
export type MediaChoiceCode = (typeof MEDIA_CHOICE_CODES)[number];

/** One sentence per code. The explanation is these sentences in code order; nothing else. */
export const MEDIA_CHOICE_EXPLANATIONS: Readonly<Record<MediaChoiceCode, string>> = {
  "existing-selection-reviewed": "The media already selected for the current revision was generated, admitted and has an accepted MEDIA-3 review record.",
  "existing-reviewed-media": "Admitted generated media with an accepted MEDIA-3 review record exists for this draft.",
  "multiple-valid-media-paths": "More than one path is open and Hebun holds no rule that ranks one medium above another.",
  "no-eligible-existing-media": "No admitted generated media with an accepted MEDIA-3 review record exists for this draft.",
  "selected-media-not-eligible": "Some selected media is not admitted generated media with an accepted review record.",
  "unreviewed-generated-media": "Some admitted generated media has no MEDIA-3 review record yet.",
  "declined-generated-media": "Some generated media has a declined MEDIA-3 review record.",
  "supplied-media-outside-review": "Supplied media exists; it is outside media review and cannot be selected, so it is not treated as reviewed.",
  "generation-pending": "A video generation attempt for this draft has not finished or has not been admitted yet.",
  "package-unreadable": "The Content Package could not be read, so the current selection is not known.",
  "attempts-unreadable": "Video generation attempts could not be read.",
  "provider-disabled": "The provider switch this path needs is off.",
  "provider-state-unknown": "The provider switch this path needs is not read here, so its state is not known.",
  "provider-readiness-unverified": "The switch is on, but the provider transport and credential are not visible here.",
  "no-source-image": "No admitted image exists for this draft to generate a video from.",
  "data-use-unresolved": "No data-use classification exists, so sending an image to Higgsfield is not cleared (Terms 4.4 question open).",
  "price-unknown": "Hebun holds no price for this generation.",
  "destination-rule-unknown": "Hebun holds no media rule for this destination.",
  "publish-capability-unavailable": "Hebun has no path that publishes this medium to this destination; package membership is not publishability.",
  "human-choice-required": "A human has to choose.",
};

export interface GenerationPathEvaluation {
  readonly path: GenerationPath;
  readonly blockers: readonly MediaChoiceCode[];
  readonly unknowns: readonly MediaChoiceCode[];
}

export interface MediaChoice {
  readonly kind: MediaChoiceKind;
  readonly reasons: readonly MediaChoiceCode[];
  readonly blockers: readonly MediaChoiceCode[];
  readonly unknowns: readonly MediaChoiceCode[];
  /** Existing assets the recommendation names, read from the facts. Sorted. */
  readonly assetIds: readonly string[];
  /** Admitted images of this draft a video could be generated FROM, if data use ever allows. Sorted. */
  readonly sourceAssetIds: readonly string[];
  readonly paths: readonly GenerationPathEvaluation[];
  readonly explanation: readonly string[];
}

/* ── Rules ─────────────────────────────────────────────────────────────────── */

const ORDER = new Map<MediaChoiceCode, number>(MEDIA_CHOICE_CODES.map((c, i) => [c, i]));

function codes(list: readonly MediaChoiceCode[]): MediaChoiceCode[] {
  return [...new Set(list)].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

const PENDING_STATES = new Set(["registered", "dispatching", "dispatch-unknown", "provider-pending"]);

function isPending(a: GenerationAttemptFact): boolean {
  return PENDING_STATES.has(a.state) || (a.state === "provider-succeeded" && a.admissionOutcome === "not-attempted");
}

function isEligible(m: MediaFact): boolean {
  return m.lifecycle === "admitted" && m.origin === "generated" && m.review === "accepted";
}

/** What the repository knows about publishing this medium to this destination. */
function destinationCodes(destination: ContentDestination | null, kind: "image" | "video"): MediaChoiceCode[] {
  if (destination === null) return ["destination-rule-unknown"];
  if (destination === "instagram") {
    /* PUBLISH-0 publishes an image (derived JPEG) through Governance; no video path exists. */
    return kind === "video" ? ["destination-rule-unknown", "publish-capability-unavailable"] : ["destination-rule-unknown"];
  }
  return ["destination-rule-unknown", "publish-capability-unavailable"];
}

function sorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

function evaluatePaths(facts: DraftMediaFacts, switches: ProviderSwitchFacts): GenerationPathEvaluation[] {
  const pending = facts.attempts === null ? false : facts.attempts.some(isPending);
  const common: MediaChoiceCode[] = [
    ...(pending ? (["generation-pending"] as const) : []),
    ...(facts.attempts === null ? (["attempts-unreadable"] as const) : []),
  ];
  const images = facts.media.filter((m) => m.kind === "image" && m.lifecycle === "admitted");
  const switchCodes = (on: boolean): MediaChoiceCode[] => (on ? [] : ["provider-disabled"]);
  const readiness = (on: boolean): MediaChoiceCode[] => (on ? ["provider-readiness-unverified"] : []);

  return [
    {
      path: "generate-image",
      blockers: codes([...common, "provider-state-unknown"]),
      unknowns: codes(["price-unknown", ...destinationCodes(facts.destination, "image")]),
    },
    {
      path: "generate-text-to-video",
      blockers: codes([...common, ...switchCodes(switches.textToVideo)]),
      unknowns: codes([...readiness(switches.textToVideo), "price-unknown", ...destinationCodes(facts.destination, "video")]),
    },
    {
      path: "generate-image-to-video",
      blockers: codes([
        ...common,
        ...switchCodes(switches.imageToVideo),
        ...(images.length === 0 ? (["no-source-image"] as const) : []),
        "data-use-unresolved",
      ]),
      unknowns: codes([...readiness(switches.imageToVideo), "price-unknown", ...destinationCodes(facts.destination, "video")]),
    },
  ];
}

function finish(
  kind: MediaChoiceKind,
  reasons: MediaChoiceCode[],
  blockers: MediaChoiceCode[],
  unknowns: MediaChoiceCode[],
  assetIds: string[],
  sourceAssetIds: string[],
  paths: GenerationPathEvaluation[],
): MediaChoice {
  const r = codes(reasons);
  const b = codes(blockers);
  const u = codes(unknowns);
  return {
    kind,
    reasons: r,
    blockers: b,
    unknowns: u,
    assetIds,
    sourceAssetIds,
    paths,
    explanation: codes([...r, ...b, ...u]).map((c) => MEDIA_CHOICE_EXPLANATIONS[c]),
  };
}

/**
 * Evaluate one draft. Precedence, fixed:
 *   1. a selection that is entirely eligible            → use-existing (the selection)
 *   2. eligible media of exactly one kind, none chosen  → use-existing (that media)
 *   3. eligible media of both kinds, none chosen        → none-ask-human (multiple-valid-media-paths)
 *   4. no eligible media: exactly one unblocked path    → that generation path
 *   5. otherwise                                        → none-ask-human, with every path's blockers
 */
export function evaluateMediaChoice(facts: DraftMediaFacts, switches: ProviderSwitchFacts): MediaChoice {
  const context: MediaChoiceCode[] = [];
  if (facts.media.some((m) => m.origin === "supplied")) context.push("supplied-media-outside-review");
  if (facts.media.some((m) => m.origin === "generated" && m.lifecycle === "admitted" && m.review === "none")) {
    context.push("unreviewed-generated-media");
  }
  if (facts.media.some((m) => m.origin === "generated" && m.review === "declined")) context.push("declined-generated-media");

  const paths = evaluatePaths(facts, switches);
  const sources = sorted(facts.media.filter((m) => m.kind === "image" && m.lifecycle === "admitted").map((m) => m.assetId));

  if (!facts.packageReadable) {
    return finish("none-ask-human", [...context, "human-choice-required"], ["package-unreadable"], [], [], sources, paths);
  }

  const eligible = facts.media.filter(isEligible);
  const selected = facts.media.filter((m) => m.selectedInCurrentRevision);

  /* 1 — the human already chose, and everything chosen is eligible. */
  if (selected.length > 0 && selected.every(isEligible)) {
    const kinds = new Set(selected.map((m) => m.kind));
    const destination = [...kinds].flatMap((k) => destinationCodes(facts.destination, k));
    return finish(
      "use-existing",
      [...context, "existing-selection-reviewed", ...destination.filter((c) => c === "publish-capability-unavailable")],
      [],
      destination.filter((c) => c !== "publish-capability-unavailable"),
      sorted(selected.map((m) => m.assetId)),
      sources,
      paths,
    );
  }
  if (selected.length > 0) context.push("selected-media-not-eligible");

  /* 2 / 3 — eligible media exists but is not (all) chosen. */
  if (eligible.length > 0) {
    const kinds = new Set(eligible.map((m) => m.kind));
    if (kinds.size > 1) {
      return finish(
        "none-ask-human",
        [...context, "existing-reviewed-media", "multiple-valid-media-paths", "human-choice-required"],
        [],
        [...kinds].flatMap((k) => destinationCodes(facts.destination, k)).filter((c) => c === "destination-rule-unknown"),
        sorted(eligible.map((m) => m.assetId)),
        sources,
        paths,
      );
    }
    const kind = [...kinds][0]!;
    const destination = destinationCodes(facts.destination, kind);
    return finish(
      "use-existing",
      [...context, "existing-reviewed-media", ...destination.filter((c) => c === "publish-capability-unavailable")],
      [],
      destination.filter((c) => c !== "publish-capability-unavailable"),
      sorted(eligible.map((m) => m.assetId)),
      sources,
      paths,
    );
  }

  /* 4 / 5 — nothing eligible exists. */
  context.push("no-eligible-existing-media");
  const open = paths.filter((p) => p.blockers.length === 0);
  if (open.length === 1) {
    const only = open[0]!;
    return finish(only.path, context, [], [...only.unknowns], [], only.path === "generate-image-to-video" ? sources : [], paths);
  }
  return finish(
    "none-ask-human",
    [...context, ...(open.length > 1 ? (["multiple-valid-media-paths"] as const) : []), "human-choice-required"],
    open.length === 0 ? paths.flatMap((p) => p.blockers) : [],
    paths.flatMap((p) => p.unknowns),
    [],
    sources,
    paths,
  );
}

/** One line per code list, for grounding. Deterministic. */
export function formatMediaChoice(choice: MediaChoice): string[] {
  const list = (xs: readonly string[]) => (xs.length > 0 ? xs.join(", ") : "none");
  return [
    `media recommendation: ${choice.kind} (deterministic; recommends only — it selects, generates, reviews and publishes nothing)`,
    `reasons: ${list(choice.reasons)}`,
    `blockers: ${list(choice.blockers)}`,
    `unknowns: ${list(choice.unknowns)}`,
    `assets named: ${list(choice.assetIds)}`,
    ...choice.paths.map((p) => `path ${p.path}: blockers ${list(p.blockers)} · unknowns ${list(p.unknowns)}`),
    ...choice.explanation.map((s) => `why: ${s}`),
  ];
}
