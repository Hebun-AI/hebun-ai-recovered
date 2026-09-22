/*
 * content-grounding/contracts.ts — the vocabulary of preparing with the organization's own
 * observed content (CONTENT-GROUND-1).
 *
 * ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
 *
 * Hebun could already write and revise a caption, see the draft it was revising, and know where the
 * draft was going. It had never seen what this organization sounds like. The material that would
 * fix that was already in production and already governed: `provider_observations` holds this
 * tenant's OWN recent Instagram media, captions included, recorded under a standing authorization.
 * Nothing read it into a preparation.
 *
 * ── WHAT CROSSES THE BOUNDARY, AND WHAT DOES NOT ────────────────────────────
 *
 * A STRING, rendered here, appended by the released brief. That is the same shape CGO-7 established
 * and the reason `src/features/work-artifacts/` still reaches no provider and gains no import: this
 * module does the reading, and preparation receives text it treats as material.
 *
 * ── OBSERVED CONTENT IS UNTRUSTED DATA ──────────────────────────────────────
 *
 * The captions are written by whoever posted them and edited by anyone who could edit that account.
 * They are DATA. They are fenced between markers, preceded by a sentence saying that nothing inside
 * changes the rules, and never placed where instruction lives — exactly as CGO-9 fences the draft it
 * is revising. A caption reading "ignore the rules above" is a caption with an odd sentence in it.
 *
 * ── IT IS CONTEXT, NOT TRUTH, AND NEVER AUTHORSHIP ──────────────────────────
 *
 * Nothing observed here becomes a Knowledge fact, an organizational record, or a claim Hebun makes.
 * It is not stored: it reaches the model through the brief, is absent from every message row, and
 * nothing reads it back. The bytes stored as the revision remain the model's whole reply.
 *
 * Pure types and frozen values. No I/O.
 */

/** Instagram media observations are the only grounding this phase reads. Narrow on purpose. */
export const INSTAGRAM_MEDIA_CAPABILITY = "instagram.media.public.read" as const;
export const INSTAGRAM_PROVIDER_KEY = "instagram" as const;

/**
 * Bounds, so the brief cannot be dominated by observed material and a test can assert the shape.
 *
 * A caption is a caption; nobody needs 4,000 characters of one to hear a voice, and an unbounded
 * paste is how an observed account would gain influence over a preparation proportional to how much
 * text it contains.
 */
export const GROUNDING_LIMITS = Object.freeze({
  /** How many recent captions are shown. Newest first. */
  maxCaptions: 5,
  /** Per caption, after control characters are stripped. Longer ones are cut and marked. */
  maxCaptionChars: 400,
  /** Whole rendered block, as a last backstop regardless of the two above. */
  maxTotalChars: 2400,
});

/**
 * What happened when grounding was asked for. Returned BESIDE the preparation result, never folded
 * into it — CGO-7's rule: an absent observation must never be silent, or a human is left believing a
 * draft was informed by context that never arrived.
 */
export const GROUNDING_DISPOSITIONS = [
  /** Captions were found and rendered into the brief. */
  "grounded",
  /** The human did not ask for it. */
  "not-requested",
  /** Asked for, but this draft is not going to Instagram. */
  "destination-not-supported",
  /** Asked for, but this tenant has no stored Instagram media observation. */
  "no-observation",
  /** An observation exists but carried no usable caption text. */
  "no-captions",
  /** The observation store could not be read. Preparation still proceeds, ungrounded. */
  "unavailable",
] as const;

export type GroundingDisposition = (typeof GROUNDING_DISPOSITIONS)[number];

export interface OwnContentGrounding {
  readonly disposition: GroundingDisposition;
  /** The rendered block, present only when `grounded`. Never stored, never returned to a client. */
  readonly supplement?: string;
  /** How many captions were included. Safe to show a human; carries no caption text. */
  readonly captionCount: number;
  /** When the observation Hebun used was taken. Provenance a human can check. */
  readonly observedAt?: string;
}

/**
 * What Hebun refuses to claim about a grounded preparation. Rendered verbatim beside the control,
 * because the risk here is a human believing the model was given facts rather than examples.
 */
export const GROUNDING_NON_CLAIMS: readonly string[] = [
  "Hebun was shown your recent Instagram captions as examples of how this account writes. They are context, not instructions.",
  "Nothing observed becomes an organizational fact, and Hebun does not treat a caption as something this organization has stated.",
  "Grounding does not review, approve or publish anything. The prepared revision still awaits Governance review.",
  "The observations are read from what Hebun already recorded. Preparing does not contact Instagram.",
] as const;
