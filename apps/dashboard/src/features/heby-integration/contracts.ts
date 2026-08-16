/*
 * heby-integration/contracts.ts — the typed vocabulary that turns Heby from an
 * ambient UI affordance into Hebun's shared intelligence INTERFACE (UI Phase 15).
 *
 * This is an ARCHITECTURE + INTEGRATION FOUNDATION. It declares the shapes through
 * which a Hebun workspace hands Heby a typed context and a typed request, and through
 * which Heby would return a provenance-first, uncertainty-aware, authority-bounded
 * response. It BUILDS ON the real, immutable Heby Core contracts (capabilities,
 * provenance, source lifecycle) and NEVER modifies them.
 *
 * It calls no model, no provider, no tool, and no device. It fabricates no answer, no
 * evidence, no provenance, and no context. It performs no approval, execution, or policy
 * mutation. Every declaration here is immutable structure — the boundary a future,
 * separately-authorized Heby runtime would connect to. Visibility is not authorization:
 * nothing here grants authority, and the Director remains the authority boundary.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md; and the Heby Core
 * Phase 1–9 contracts under src/features/heby-core.
 */

import type { HebyCapability } from "@/features/heby-core";

/* ===========================================================================
 * 1. WORKSPACE IDENTITY (context, not navigation)
 *
 * Hebun's Information Architecture is exactly SEVEN Level-1 workspaces plus the
 * ambient Heby layer (see config/workspace-nav). Heby's CONTEXT vocabulary adds one
 * more identity — "decisions" — for the human-authority surface that lives on the
 * `/approvals` route UNDER Command. This adds NO eighth navigation workspace; it only
 * lets Heby name which surface it is reasoning about.
 * ========================================================================= */

export type HebyWorkspaceId =
  | "command"
  | "intelligence"
  | "knowledge"
  | "operations"
  | "workforce"
  | "governance"
  | "platform"
  | "decisions";

export const HEBY_WORKSPACE_IDS: readonly HebyWorkspaceId[] = [
  "command",
  "intelligence",
  "knowledge",
  "operations",
  "workforce",
  "governance",
  "platform",
  "decisions",
] as const;

/** The seven navigable workspaces — "decisions" is intentionally excluded here. */
export const HEBY_NAV_WORKSPACE_IDS: readonly HebyWorkspaceId[] = [
  "command",
  "intelligence",
  "knowledge",
  "operations",
  "workforce",
  "governance",
  "platform",
] as const;

export function isHebyWorkspaceId(value: string): value is HebyWorkspaceId {
  return (HEBY_WORKSPACE_IDS as readonly string[]).includes(value);
}

/* ===========================================================================
 * 2. PRODUCT INTENT
 *
 * A small, stable intent vocabulary — PRODUCT semantics, not provider prompts. Each
 * product intent maps to exactly one REAL declared Heby Core capability, bound with
 * `satisfies` so that drift from the Heby Core capability set breaks the build. Intent
 * is never bound to a specific model or prompt.
 * ========================================================================= */

export type HebyProductIntent =
  | "EXPLAIN"
  | "INVESTIGATE"
  | "SUMMARIZE"
  | "COMPARE"
  | "TRACE_EVIDENCE"
  | "ASSESS_UNCERTAINTY"
  | "PREPARE_RECOMMENDATION"
  | "PREPARE_REVIEW";

export const HEBY_PRODUCT_INTENTS: readonly HebyProductIntent[] = [
  "EXPLAIN",
  "INVESTIGATE",
  "SUMMARIZE",
  "COMPARE",
  "TRACE_EVIDENCE",
  "ASSESS_UNCERTAINTY",
  "PREPARE_RECOMMENDATION",
  "PREPARE_REVIEW",
] as const;

/**
 * Product intent → the declared Heby Core capability it exercises. `satisfies` binds the
 * right-hand values to the real `HebyCapability` union: if Heby Core renames or drops a
 * capability, this fails to compile. No intent maps to a non-capability.
 */
export const HEBY_INTENT_CAPABILITY: Record<HebyProductIntent, HebyCapability> = {
  EXPLAIN: "explain",
  INVESTIGATE: "answer-director-question",
  SUMMARIZE: "summarize",
  COMPARE: "answer-director-question",
  TRACE_EVIDENCE: "expose-runtime",
  ASSESS_UNCERTAINTY: "answer-director-question",
  PREPARE_RECOMMENDATION: "prepare-information",
  PREPARE_REVIEW: "prepare-information",
} satisfies Record<HebyProductIntent, HebyCapability>;

export interface HebyIntentDescriptor {
  readonly intent: HebyProductIntent;
  readonly capability: HebyCapability;
  readonly statement: string;
  /** True when the intent PREPARES material for a human process (never resolves it). */
  readonly prepares: boolean;
}

export const HEBY_INTENT_DESCRIPTORS: Readonly<Record<HebyProductIntent, HebyIntentDescriptor>> =
  Object.freeze({
    EXPLAIN: Object.freeze({ intent: "EXPLAIN", capability: "explain", statement: "explain what this is and why it matters", prepares: false }),
    INVESTIGATE: Object.freeze({ intent: "INVESTIGATE", capability: "answer-director-question", statement: "investigate a question against grounded sources", prepares: false }),
    SUMMARIZE: Object.freeze({ intent: "SUMMARIZE", capability: "summarize", statement: "summarize the grounded material", prepares: false }),
    COMPARE: Object.freeze({ intent: "COMPARE", capability: "answer-director-question", statement: "compare grounded options or records", prepares: false }),
    TRACE_EVIDENCE: Object.freeze({ intent: "TRACE_EVIDENCE", capability: "expose-runtime", statement: "trace where the evidence came from", prepares: false }),
    ASSESS_UNCERTAINTY: Object.freeze({ intent: "ASSESS_UNCERTAINTY", capability: "answer-director-question", statement: "surface what remains uncertain or unavailable", prepares: false }),
    PREPARE_RECOMMENDATION: Object.freeze({ intent: "PREPARE_RECOMMENDATION", capability: "prepare-information", statement: "prepare an advisory recommendation for a human", prepares: true }),
    PREPARE_REVIEW: Object.freeze({ intent: "PREPARE_REVIEW", capability: "prepare-information", statement: "prepare a human-review item, awaiting the Director", prepares: true }),
  });

export function isHebyProductIntent(value: string): value is HebyProductIntent {
  return (HEBY_PRODUCT_INTENTS as readonly string[]).includes(value);
}

/* ===========================================================================
 * 3. CAPABILITY FAMILY + STATE
 *
 * Heby must never assume a capability is available. A family resolves to one of four
 * honest states — collapsing them into a boolean would hide the truth that a structural
 * contract exists but is not connected.
 * ========================================================================= */

export type HebyCapabilityFamily =
  | "knowledge-retrieval"
  | "intelligence-analysis"
  | "operational-inspection"
  | "workforce-inspection"
  | "governance-inspection"
  | "platform-inspection"
  | "decision-preparation"
  | "evidence-tracing"
  | "future-tool-use"
  | "future-device-use";

export const HEBY_CAPABILITY_FAMILIES: readonly HebyCapabilityFamily[] = [
  "knowledge-retrieval",
  "intelligence-analysis",
  "operational-inspection",
  "workforce-inspection",
  "governance-inspection",
  "platform-inspection",
  "decision-preparation",
  "evidence-tracing",
  "future-tool-use",
  "future-device-use",
] as const;

/**
 * available   — connected and usable now.
 * contract-only — the shape exists; no live runtime is connected.
 * restricted  — exists but withheld behind an authority requirement.
 * unavailable — not present / not implemented.
 */
export type HebyCapabilityState = "available" | "contract-only" | "restricted" | "unavailable";

export const HEBY_CAPABILITY_STATES: readonly HebyCapabilityState[] = [
  "available",
  "contract-only",
  "restricted",
  "unavailable",
] as const;

export interface HebyCapabilityStateDescriptor {
  readonly state: HebyCapabilityState;
  /** Whether Heby may act on the capability now. Only "available" is usable. */
  readonly usable: boolean;
  readonly label: string;
}

export const HEBY_CAPABILITY_STATE_DESCRIPTORS: Readonly<
  Record<HebyCapabilityState, HebyCapabilityStateDescriptor>
> = Object.freeze({
  available: Object.freeze({ state: "available", usable: true, label: "Available" }),
  "contract-only": Object.freeze({ state: "contract-only", usable: false, label: "Contract only" }),
  restricted: Object.freeze({ state: "restricted", usable: false, label: "Restricted" }),
  unavailable: Object.freeze({ state: "unavailable", usable: false, label: "Unavailable" }),
});

export interface HebyCapabilityView {
  readonly family: HebyCapabilityFamily;
  readonly state: HebyCapabilityState;
}

/* ===========================================================================
 * 4. SOURCE CLASS + STATUS
 *
 * Heby must know where organizational truth comes from. Source status is multi-
 * dimensional on purpose: a source can exist without being connected, be connected
 * without being populated, and be populated without being authoritative.
 * ========================================================================= */

export type HebySourceClass =
  | "knowledge"
  | "memory"
  | "intelligence"
  | "operations"
  | "workforce"
  | "governance"
  | "platform"
  | "decision-records"
  /*
   * R3W. Prepared work the tenant durably holds — never organizational truth, never a decision.
   * It is a source class rather than a flavour of `operations` because its records have their own
   * authority owner, their own immutable revisions, and their own reference syntax
   * (`work-artifact/<uuid>@<n>`); folding it into an existing class would make an artifact
   * indistinguishable from a derived read-model section in the evidence set.
   */
  | "work-artifacts";

export const HEBY_SOURCE_CLASSES: readonly HebySourceClass[] = [
  "knowledge",
  "memory",
  "intelligence",
  "operations",
  "workforce",
  "governance",
  "platform",
  "decision-records",
  "work-artifacts",
] as const;

export interface HebySourceStatus {
  readonly sourceClass: HebySourceClass;
  /** The source class is defined in the architecture. */
  readonly exists: boolean;
  /** A live Heby data path to it is connected. */
  readonly connected: boolean;
  /** It currently holds real, Director-safe records. */
  readonly populated: boolean;
  /** Its records may be treated as authoritative organizational truth. */
  readonly authoritative: boolean;
  /** It cannot serve Heby right now (derived: exists but not connected/populated). */
  readonly unavailable: boolean;
}

/* ===========================================================================
 * 5. PROVENANCE REQUIREMENT
 *
 * Every future substantive answer must be able to carry its provenance. Missing
 * provenance must never be converted into confident prose. A response declares which
 * facets it is required to satisfy.
 * ========================================================================= */

export type HebyProvenanceFacet =
  | "what-was-found"
  | "where-it-came-from"
  | "when-known"
  | "how-authoritative"
  | "what-remains-uncertain";

export const HEBY_PROVENANCE_FACETS: readonly HebyProvenanceFacet[] = [
  "what-was-found",
  "where-it-came-from",
  "when-known",
  "how-authoritative",
  "what-remains-uncertain",
] as const;

/** The provenance facets a substantive answer MUST support. `when-known` may be absent. */
export const HEBY_REQUIRED_PROVENANCE_FACETS: readonly HebyProvenanceFacet[] = [
  "what-was-found",
  "where-it-came-from",
  "how-authoritative",
  "what-remains-uncertain",
] as const;

/* ===========================================================================
 * 6. EVIDENCE REFERENCE (contract-only)
 *
 * A response may reference evidence by stable typed reference. Phase 15 fabricates NO
 * evidence instance — this is the reference shape only.
 * ========================================================================= */

export interface HebyEvidenceReference {
  readonly sourceClass: HebySourceClass;
  /** A stable identifier from the owning source. Never fabricated in Phase 15. */
  readonly recordRef: string;
  /** The Heby Core lifecycle state carried through, when known. */
  readonly lifecycle: "settled" | "superseded" | "retired" | "unknown";
}

/* ===========================================================================
 * 7. UNCERTAINTY (ordinal / semantic — never a fabricated percentage)
 * ========================================================================= */

export type HebyUncertaintyState =
  | "known"
  | "supported"
  | "incomplete"
  | "uncertain"
  | "unavailable";

export const HEBY_UNCERTAINTY_STATES: readonly HebyUncertaintyState[] = [
  "known",
  "supported",
  "incomplete",
  "uncertain",
  "unavailable",
] as const;

export interface HebyUncertaintyDescriptor {
  readonly state: HebyUncertaintyState;
  /** Ordinal for listing, strongest → weakest. Not a score. */
  readonly order: number;
  readonly label: string;
}

export const HEBY_UNCERTAINTY_DESCRIPTORS: Readonly<
  Record<HebyUncertaintyState, HebyUncertaintyDescriptor>
> = Object.freeze({
  known: Object.freeze({ state: "known", order: 0, label: "Known" }),
  supported: Object.freeze({ state: "supported", order: 1, label: "Supported by evidence" }),
  incomplete: Object.freeze({ state: "incomplete", order: 2, label: "Incomplete" }),
  uncertain: Object.freeze({ state: "uncertain", order: 3, label: "Uncertain" }),
  unavailable: Object.freeze({ state: "unavailable", order: 4, label: "Unavailable" }),
});

/* ===========================================================================
 * 8. AUTHORITY MODE
 *
 * Every request/response is compatible with an authority context. Heby must never
 * silently escalate its own authority; the strongest thing it may do is PREPARE.
 * ========================================================================= */

export type HebyAuthorityMode =
  | "advisory-only"
  | "human-review-required"
  | "restricted"
  | "unavailable"
  | "future-authorized-preparation";

export const HEBY_AUTHORITY_MODES: readonly HebyAuthorityMode[] = [
  "advisory-only",
  "human-review-required",
  "restricted",
  "unavailable",
  "future-authorized-preparation",
] as const;

export interface HebyAuthorityDescriptor {
  readonly mode: HebyAuthorityMode;
  /** Whether Heby may itself act. ALWAYS false — Heby never decides or executes. */
  readonly hebyMayAct: false;
  readonly label: string;
}

export const HEBY_AUTHORITY_DESCRIPTORS: Readonly<Record<HebyAuthorityMode, HebyAuthorityDescriptor>> =
  Object.freeze({
    "advisory-only": Object.freeze({ mode: "advisory-only", hebyMayAct: false, label: "Advisory only" }),
    "human-review-required": Object.freeze({ mode: "human-review-required", hebyMayAct: false, label: "Human review required" }),
    restricted: Object.freeze({ mode: "restricted", hebyMayAct: false, label: "Restricted" }),
    unavailable: Object.freeze({ mode: "unavailable", hebyMayAct: false, label: "Unavailable" }),
    "future-authorized-preparation": Object.freeze({ mode: "future-authorized-preparation", hebyMayAct: false, label: "Future authorized preparation" }),
  });

/* ===========================================================================
 * 9. CONNECTION STATE
 *
 * Whether a real Heby response runtime is connected. Phase 15 is always "not-connected":
 * the architecture is wired; no model/provider/tool is called and no answer is generated.
 * ========================================================================= */

export type HebyConnectionState = "not-connected" | "connected";
