/*
 * work-artifacts/contracts.ts — the R3W vocabulary (pure).
 *
 * A WORK ARTIFACT is the durable form of `prepare-information`: material prepared for a human
 * process, with a stable identity and immutable revisions. Hebun already declares preparation
 * capabilities (`PREPARE_RECOMMENDATION`, `PREPARE_REVIEW`, both `prepares: true`) and already
 * registers a `PREPARATION_ONLY` tool whose own source calls the prepared package its deliverable
 * — but that package was a value in memory and evaporated. R3A found the same defect one layer up
 * ("the prepared action was a value, not a row") and fixed it the same way.
 *
 * WHAT AN ARTIFACT IS NOT, stated as types rather than as prose where possible:
 *
 *   not Knowledge      — no authority class, no ratification, no lifecycle that means "true"
 *   not a decision     — no approval field exists to set
 *   not a message      — identity survives revision; a message does not
 *   not an action      — it is referenced BY one, never is one
 *   not a permit       — it authorizes nothing
 *   not execution      — it causes no effect
 *
 * Pure. No React, no I/O, no database, no clock, no authority.
 */

/**
 * The CLOSED artifact-type vocabulary. One value per action tool that already names a `record-ref`
 * argument for it today — nothing speculative. `operational-plan` is what
 * `heby.operations.prepare-plan` prepares; `message-draft` is what
 * `heby.operations.send-communication` calls `draftRef`. A new type arrives with the consumer that
 * needs it, through its own migration.
 */
export type WorkArtifactType = "operational-plan" | "message-draft" | "content-draft";

export const WORK_ARTIFACT_TYPES: readonly WorkArtifactType[] = [
  "operational-plan",
  "message-draft",
  "content-draft",
] as const;

export function isWorkArtifactType(value: unknown): value is WorkArtifactType {
  return typeof value === "string" && (WORK_ARTIFACT_TYPES as readonly string[]).includes(value);
}

/**
 * CGO-1 — the CLOSED destination vocabulary. Where a content draft was prepared to GO.
 *
 * A value here is a DECLARATION MADE AT PREPARATION TIME and nothing else. It is not a provider,
 * not a connection, not an account, not an authorization, not a schedule and not a publication.
 * `CONTENT_DESTINATION_NON_CLAIMS` below states that in words a surface can quote verbatim, so no
 * surface has to invent its own sentence and a test can assert the claim matches the repository.
 */
export type ContentDestination = "instagram" | "tiktok" | "youtube";

export const CONTENT_DESTINATIONS: readonly ContentDestination[] = [
  "instagram",
  "tiktok",
  "youtube",
] as const;

export function isContentDestination(value: unknown): value is ContentDestination {
  return typeof value === "string" && (CONTENT_DESTINATIONS as readonly string[]).includes(value);
}

/** Human-facing names. Presentation only — the stored value is always the enum member. */
export const CONTENT_DESTINATION_LABELS: Readonly<Record<ContentDestination, string>> =
  Object.freeze({
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
  });

/**
 * The type whose consumer is a preparation surface rather than an action tool, and the only type
 * that carries a destination. Named once here so writers, readers, validators and surfaces all
 * agree by construction instead of by three separate string literals.
 */
export const CONTENT_DRAFT_TYPE: WorkArtifactType = "content-draft";

/**
 * WHAT DECLARING A DESTINATION DOES NOT ESTABLISH. Stated in code because the whole risk of this
 * capability is that a reader upgrades "prepared for Instagram" into "connected to Instagram".
 *
 * Every line is a fact about this repository at the commit that ships it, not an aspiration.
 */
export const CONTENT_DESTINATION_NON_CLAIMS: readonly string[] = [
  "A declared destination is not a provider connection. No social provider is connectable in Hebun.",
  "No account is named, linked or authorized by declaring a destination.",
  "Nothing is scheduled. Hebun has no scheduler, so no content can be queued to publish.",
  "Nothing is published. The only external adapter Hebun registers sends email.",
] as const;

/**
 * The four collapses this capability exists to keep apart, in order. A surface renders these so a
 * reader cannot slide from one to the next, and a test asserts the surface still carries them.
 */
export const CONTENT_PREPARATION_DISTINCTIONS: readonly string[] = [
  "PREPARED is not SCHEDULED",
  "SCHEDULED is not PUBLISHED",
  "PUBLISHED is not DELIVERED",
  "DELIVERED is not SEEN",
] as const;

/**
 * REV-1 — WHO WROTE THESE BYTES, as a sentence a reviewing surface may show.
 *
 * ── WHY THIS EXISTS NOW AND DID NOT BEFORE ──────────────────────────────────
 *
 * OPS-P1 shipped the review surface on 2026-08-27 and deliberately withheld `authoredByActorType`,
 * grouping it with `contentDigest`, `sourceMessageId` and `authoredByActorId` as an audit internal.
 * That was correct THEN: AGENT-RUNTIME-0 had not yet landed, every revision in existence was
 * written by a person, and a field with one possible value distinguishes nothing.
 *
 * Three releases falsified it. AGENT-RUNTIME-0 made the durable agent the author of model-produced
 * bytes, CGO-3 made an agent able to prepare a content draft, and CGO-4 and CGO-7 made the model
 * the direct author of the stored text. In production today four revisions are human-authored and
 * three are agent-authored, and the review surface renders all seven identically.
 *
 * ── WHAT THIS IS AND IS NOT ─────────────────────────────────────────────────
 *
 * A CLASSIFICATION, never an identifier. `authoredByActorId` stays withheld — a reviewer needs to
 * know a model wrote the text, not which row records the writer. The distinction is the whole
 * reason this can be shown at all without reopening what OPS-P1 closed.
 *
 * Authorship says who produced the bytes and NOTHING about their standing. It is not a review, not
 * an approval, not an authorization, and not a claim the content is correct.
 */
export const WORK_ARTIFACT_AUTHOR_LABELS: Readonly<Record<string, string>> = Object.freeze({
  human: "Written by a person",
  agent: "Written by this organization's durable agent",
  system: "Written by the platform itself",
  service: "Written by an automated service",
});

/**
 * What a surface says when the recorded actor type is not one this vocabulary names.
 *
 * FAIL CLOSED, NEVER DEFAULT. The column is the four-value `actor_type` enum and a future value
 * would arrive here as an unrecognised string. Rendering "Written by a person" for anything
 * unrecognised would be the one failure this whole field exists to prevent, so an unknown value
 * says it is unknown.
 */
export const WORK_ARTIFACT_AUTHOR_UNKNOWN =
  "Authorship was recorded in a form this surface cannot name. It is unknown, not human." as const;

/** Resolve the sentence for a recorded actor type. Pure; guesses nothing. */
export function workArtifactAuthorLabel(actorType: string): string {
  return WORK_ARTIFACT_AUTHOR_LABELS[actorType] ?? WORK_ARTIFACT_AUTHOR_UNKNOWN;
}

/**
 * WHAT KNOWING THE AUTHOR DOES NOT ESTABLISH. Rendered beside the authorship line for the same
 * reason `CONTENT_DESTINATION_NON_CLAIMS` is rendered beside the destination: the risk of this
 * capability is that a reader upgrades "I can see who wrote it" into "so it has been reviewed".
 */
export const WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS: readonly string[] = [
  "Seeing who wrote a revision is not a review of it, and reading it here records nothing.",
  "Hebun holds no review, no approval and no rejection for prepared work — those states do not exist in this authority.",
  "An agent-written revision is not endorsed by this organization, and a person-written one is not either.",
] as const;

/**
 * Two states. `superseded` was dropped from Gate A's proposal under stress-test: supersession is a
 * relationship BETWEEN REVISIONS of one artifact, derivable from `current_revision`, not a stored
 * state of the artifact. Artifact-level supersession would need a forked identity and a pointer,
 * and no consumer needs either.
 *
 * There is deliberately no `approved`, `published`, `executed`, `verified` or `authoritative`.
 * Those either belong to Governance (approval), to a runtime that does not exist (execution,
 * publishing), or nowhere at all (verified/authoritative — an artifact is never organizational
 * truth).
 */
export type WorkArtifactLifecycleStatus = "draft" | "retired";

export const WORK_ARTIFACT_LIFECYCLE_STATUSES: readonly WorkArtifactLifecycleStatus[] = [
  "draft",
  "retired",
] as const;

/**
 * Bounds, counted in Unicode CODE POINTS so Turkish characters and emoji cost what they look like
 * rather than what UTF-16 charges for them. Same convention as `KNOWLEDGE_LIMITS`.
 */
export const WORK_ARTIFACT_LIMITS = Object.freeze({
  title: 200,
  content: 100_000,
});

/** Everything a caller supplies to create an artifact. Authority fields are absent BY TYPE. */
export interface CreateWorkArtifactInput {
  readonly artifactType: WorkArtifactType;
  readonly title: string;
  readonly content: string;
  /**
   * CGO-1. REQUIRED when `artifactType` is `content-draft` and REFUSED otherwise — the same rule
   * the two database CHECKs enforce, applied at the edge so a caller gets a validation problem
   * rather than a constraint violation. Absent on every other type by design.
   */
  readonly intendedDestination?: ContentDestination;
  /**
   * The assistant message this content came from, when it came from one. Optional because direct
   * human authorship is legitimate. It is re-checked against the tenant server-side; a foreign or
   * unknown id is refused, never silently dropped.
   */
  readonly sourceMessageId?: string;
}

/** Everything a caller supplies to append a revision. */
export interface ReviseWorkArtifactInput {
  readonly artifactId: string;
  readonly content: string;
  readonly sourceMessageId?: string;
}

export type WorkArtifactField = "artifactType" | "title" | "content" | "intendedDestination";

export interface WorkArtifactValidationProblem {
  readonly field: WorkArtifactField;
  readonly code:
    | "required"
    | "too-long"
    | "control-characters"
    | "unknown-type"
    /** CGO-1. A destination was supplied for an artifact type that may not carry one. */
    | "destination-not-permitted";
  /** Operator-facing text. States what is wrong; never rewrites the input. */
  readonly message: string;
}

/**
 * Why a write was refused. Every value is a fact about the request or the substrate — never a
 * judgement about the content, which this domain does not make.
 */
export type WorkArtifactRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "persistence-unavailable"
  | "artifact-not-found"
  | "artifact-retired"
  | "source-message-not-found"
  | "revision-conflict"
  /**
   * AGENT-RUNTIME-0. An agent author was offered without proof that the authoritative durable-agent
   * read seam produced it. Unreachable through the public entry points — it is the writer's guard
   * against a forged `AgentAuthorship`, and a refusal rather than a thrown error so a future caller
   * gets an answer in the same vocabulary as every other failure here.
   */
  | "unverified-agent-authorship";

export interface WorkArtifactRevisionView {
  readonly id: string;
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly content: string;
  readonly contentDigest: string;
  readonly authoredByActorType: string;
  readonly authoredByActorId: string;
  readonly sourceMessageId: string | null;
  readonly createdAt: string;
  /** True when this revision is the artifact's current one. Derived, never stored. */
  readonly current: boolean;
}

export interface WorkArtifactView {
  readonly id: string;
  readonly tenantId: string;
  readonly artifactType: WorkArtifactType;
  readonly title: string;
  readonly lifecycleStatus: WorkArtifactLifecycleStatus;
  readonly ownerWorkspace: string;
  readonly currentRevision: number;
  readonly createdAt: string;
  /** The stable reference for the CURRENT revision. See `artifact-ref.ts`. */
  readonly currentRef: string;
  /**
   * CGO-1. The declared preparation target, or NULL for every artifact that is not a content
   * draft. NULL means "not a content draft" — never "destination unknown".
   */
  readonly intendedDestination: ContentDestination | null;
}

export type CreateWorkArtifactResult =
  | {
      readonly status: "created";
      readonly artifactId: string;
      readonly revisionNo: number;
      readonly contentDigest: string;
      readonly ref: string;
    }
  | { readonly status: "refused"; readonly reason: WorkArtifactRefusal }
  | { readonly status: "invalid"; readonly problems: readonly WorkArtifactValidationProblem[] };

export type ReviseWorkArtifactResult =
  | {
      readonly status: "revised";
      readonly artifactId: string;
      readonly revisionNo: number;
      readonly contentDigest: string;
      readonly ref: string;
    }
  | { readonly status: "refused"; readonly reason: WorkArtifactRefusal }
  | { readonly status: "invalid"; readonly problems: readonly WorkArtifactValidationProblem[] };

export type RetireWorkArtifactResult =
  | { readonly status: "retired"; readonly artifactId: string }
  | { readonly status: "refused"; readonly reason: WorkArtifactRefusal };

/**
 * How a referenced revision stands RIGHT NOW.
 *
 * Two eligibilities are deliberately distinguished, because collapsing them is how a stale
 * approval becomes a live one:
 *
 *   readable  — the exact historical bytes may be shown to an authorized reader. Always true for
 *               a revision that exists in this tenant, whatever happened since.
 *   proposable — a NEW action may be proposed against it. Only the current revision of a
 *               non-retired artifact qualifies.
 *
 * A superseded revision stays readable forever and is never silently upgraded to the current one.
 */
export type WorkArtifactReferenceStanding =
  | "current"
  | "superseded"
  | "retired"
  | "unknown-artifact"
  | "unknown-revision"
  | "malformed-ref";

export interface WorkArtifactReferenceResolution {
  readonly ref: string;
  readonly standing: WorkArtifactReferenceStanding;
  readonly readable: boolean;
  readonly proposable: boolean;
  readonly revision?: WorkArtifactRevisionView;
  readonly artifact?: WorkArtifactView;
}

/**
 * R3W ships NO execution, NO recipient, NO provider and NO secret. Stated in code so a surface can
 * quote it verbatim instead of inventing its own sentence, and so a test can assert the claim
 * matches the repository.
 */
export const WORK_ARTIFACT_NON_EFFECTS: readonly string[] = [
  "Creating or revising an artifact performs no external act of any kind.",
  "An artifact is never organizational Knowledge, and nothing here writes to Knowledge.",
  "An artifact carries no approval; approval is a Governance decision about an action.",
  "No permit is created or consumed, and nothing is executed.",
  /* CGO-1 — the non-effect this capability had to add, in the same place surfaces already read. */
  "A content draft is prepared, never published: declaring a destination reaches no provider.",
] as const;

/**
 * The dependency R3W did not close, stated where a surface can read it.
 *
 * CLOSED BY R3R. `external_recipients` is now a real tenant-scoped authority with an immutable
 * address and its own `external-recipient/<uuid>` reference, so `recipientRef` has a referent for
 * the first time. This constant is kept rather than deleted because surfaces quote it and because
 * a phase that closes an earlier limitation has to repair the earlier phase's own words — a stale
 * "no recipient authority exists" would be a false claim shipped in code.
 *
 * What is still open is smaller and precise: `send-external-communication` declares only
 * `recipientRef` and `draftRef`, so neither digest is a declared argument yet. Until the registry
 * carries `draftRevisionDigest` and `recipientEndpointDigest`, an approval binds two moving
 * targets. That is R3A.1's to close, and R3A itself needs no change — both are ordinary scalars.
 */
export const RECIPIENT_SUBSTRATE_GAP = Object.freeze({
  statement:
    "Recipient authority exists (R3R): a send can name a durable recipient and an exact address. The action schema still declares no digest arguments, so an approval does not yet bind the exact draft revision or the exact address.",
  owner: "R3A.1",
});
