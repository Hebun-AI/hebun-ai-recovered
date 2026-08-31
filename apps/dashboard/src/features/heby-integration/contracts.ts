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
  /*
   * G6D. NOT the Governance decision record, despite sharing the words.
   *
   * `decision_records` is Governance's own table and the `governance` class above is its connected
   * reader (G6C). This class is decision PREPARATION material — both workspaces that declare it,
   * `command` and `decisions`, also declare the `decision-preparation` capability — and it has no
   * connected reader of its own. It is kept as a distinct class rather than folded into
   * `governance` for the reason `work-artifacts` and `external-recipients` are distinct: a
   * different authority owner, not a flavour of an existing one. Consolidating them would make
   * material prepared for a human decision indistinguishable from the constitutional record that
   * decision is taken under.
   */
  | "decision-records"
  /*
   * R3W. Prepared work the tenant durably holds — never organizational truth, never a decision.
   * It is a source class rather than a flavour of `operations` because its records have their own
   * authority owner, their own immutable revisions, and their own reference syntax
   * (`work-artifact/<uuid>@<n>`); folding it into an existing class would make an artifact
   * indistinguishable from a derived read-model section in the evidence set.
   */
  | "work-artifacts"
  /*
   * R3R. Addressable parties outside the organization that the tenant durably recorded — never a
   * user, never a member, and never organizational truth. It is its own class rather than a
   * flavour of `operations` for the same reason `work-artifacts` is: its records have their own
   * authority owner, their own immutable address bytes and their own reference syntax
   * (`external-recipient/<uuid>`). Folding it into `operations` would make a real person's address
   * indistinguishable from a derived read-model section in the evidence set.
   */
  | "external-recipients"
  /*
   * INT-5A. The tenant's INTEGRATION CAPABILITY STATE — which organizational systems are connected
   * and what may currently be READ from them. It is its own class rather than a flavour of
   * `platform` for the reason `work-artifacts` and `external-recipients` are: a different authority
   * owner. `platform` reads the Executive Overview's derived platform sections; this reads the
   * integration authority's normalized capability seam, which is tenant-scoped and owns the
   * connected/degraded/revoked distinction that no overview section carries.
   *
   * IT IS A CAPABILITY STATE, NEVER A PROVIDER RECORD. No Drive file, no repository, no pull
   * request, no provider payload — those live behind a live provider read this class does not
   * perform and cannot reach. "Drive metadata can be read" is what this source says; "here is a
   * Drive file" is INT-5B and does not exist.
   */
  | "integrations"
  /*
   * E2-1. THE ORGANIZATION THIS TENANT IS — its identity, and nothing about its arrangement.
   *
   * It is its own class rather than a flavour of `workforce` or `operations` for the reason
   * `work-artifacts`, `external-recipients` and `integrations` are: a different authority owner.
   * `workforce` is unconnected identity/role vocabulary and `operations` reads derived Executive
   * Overview sections; this reads L3's Organization Authority, which is the released owner of the
   * `companies` record and the only subsystem that answers "what organization exists?".
   *
   * IT IS AN IDENTITY, NEVER AN ARRANGEMENT. Name, slug, lifecycle, tenant status, origin ceremony
   * and a COUNT of live human members — plus the authority's own statement that internal structure
   * has no owner. No department, team, reporting line, roster, role, band, permission or agent
   * travels under this class, because L3 carries none of them to travel.
   *
   *     ORGANIZATION IDENTITY != ORGANIZATION STRUCTURE
   *     STRUCTURE UNAVAILABLE != STRUCTURE EMPTY
   */
  | "organization"
  /*
   * E2-5. THE DURABLE AGENTS THIS ORGANIZATION ESTABLISHED, and what became of what each proposed.
   *
   * It is its own class rather than a flavour of `workforce` — the class it most looks like — for
   * the reason `work-artifacts`, `external-recipients`, `integrations` and `organization` are:
   * a different authority owner. `workforce`'s released profile states the boundary in the words a
   * Director's answer is composed from: *"Organizational workforce identity — not a runtime
   * agent."* That class is chartered for the humans an organization is made of, and Hebun holds no
   * authority for them; routing a runtime agent through it would make the two indistinguishable.
   *
   * This reads E2-3's Agent Outcome Observation, the released owner-side projection over durable
   * agent identity, proposals, permits, execution attempts and model invocations.
   *
   * IT IS AN OUTCOME, NEVER A MANDATE. What the agent proposed and what became of it — never what
   * it is for, what it may do, what it was instructed to do, or who is accountable for it. No agent
   * id, no capability, no permission and no owner travels under this class, because the observation
   * carries none of them to travel.
   *
   *     RUNTIME AGENT   != WORKFORCE IDENTITY
   *     OUTCOME         != MANDATE
   *     APPROVED        != EXECUTED
   */
  | "agents"
  /*
   * AMA-3. WHAT A DURABLE AGENT IS **FOR**, and the maximum surface inside which it may PROPOSE.
   *
   * The class `agents` says it does not carry, in its own words: *"what it is for, what it may do
   * … OUTCOME != MANDATE"*. That sentence was a boundary, and this is the class that answers the
   * other side of it — from a different authority, with a different standing.
   *
   * IT IS NOT PART OF `agents`, AND THE REASON IS THE ONE THAT FILE STATES ABOUT ITSELF. `agents`
   * is DERIVED (`authoritative: false`) because it carries recomputed counts, and
   * `SourceResolution.authoritative` is ONE boolean for a whole class — so "a class cannot assert
   * one standing and cite under another". A mandate is a durable, versioned row a human wrote
   * under a bound Governance decision. Filing it under a derived class would give the one thing on
   * that surface a human actually DECIDED the standing of a recomputed number.
   *
   * IT IS A CEILING, AND IT GRANTS NOTHING. Every item under this class carries the denial with it
   * rather than trusting a prompt to remember it:
   *
   *     IN MANDATE    != AUTHORIZED
   *     IN MANDATE    != A PERMIT
   *     IN MANDATE    != EXECUTION
   *     NO MANDATE    != UNLIMITED MANDATE
   *     UNAVAILABLE   != NO MANDATE
   *
   * No credential, no provider configuration, no permission row, no role, no department and no
   * `authority_ceiling` travels under it, because the released read seam carries none of them.
   */
  | "agent-mandate"
  /*
   * E2-6. WHAT THIS ORGANIZATION ACTUALLY DID, as Hebun's own writers recorded it.
   *
   * It is its own class rather than part of `governance` — the class it most looks like — because
   * the two carry opposite kinds of fact. `governance` is the CONSTITUTION: the authority record,
   * the genesis session, delegation and the member role baseline, every item COMPLETE. This is
   * HISTORY, and it is BOUNDED: a newest-first page that always states the total it was drawn from.
   * Folding a truncated page in beside complete items would make "is this all of it?" unanswerable
   * under one provenance line, which is R6B's defect exactly.
   *
   * IT IS A RECORD, NEVER A COMPLETE HISTORY. Hebun records some acts and not others, so this class
   * evidences no intrusion, no incident, no threat, no provider history and no execution history,
   * and it claims no forensic completeness. It carries no payload, no entity identifier and no
   * actor identity, because the released reader withholds those columns.
   *
   *     CONSTITUTION  != HISTORY
   *     RECORDED ACT  != ALL ORGANIZATIONAL ACTIVITY
   *     RECENT        != IMPORTANT
   *     CHANGE        != CAUSATION
   */
  | "recorded-acts"
  /*
   * E2-7. HOW MUCH Hebun recorded inside EXPLICIT half-open intervals, and nothing about what it
   * means.
   *
   * Its owner is the same as `recorded-acts`, which is normally the reason NOT to add a class. It
   * is separate for the reason E2-6 gave against the opposite arrangement: that class is a BOUNDED
   * page that must state its coverage, and these are UNBOUNDED counts that are exact within their
   * interval. Under one provenance line "is this all of it?" would have two answers.
   *
   * TWO WINDOWS ARE TWO COUNTS. No delta, no direction, no rate, no projection — a representation
   * that cannot express a judgement cannot leak one, which is why `ElapsedObservation` carries no
   * severity either. And a window is a STATED BOUNDARY: Hebun owns no definition of "recent", so an
   * answer names its period instead of calling it current.
   *
   *     TIME WINDOW != TREND        CHANGE != CAUSATION
   *     MORE        != BETTER       LESS   != WORSE
   */
  | "recorded-act-windows"
  /*
   * E2-8. WHICH DECLARED KNOWLEDGE AREAS this organization holds facts in force in, and which it
   * holds nothing in.
   *
   * Its owner is the same authority as `knowledge`, which is normally the reason NOT to add a
   * class. It is separate for the reason E2-7 gave against the opposite arrangement, in the same
   * direction: `knowledge` is a BOUNDED, ranked, question-shaped retrieval result, and this is an
   * UNBOUNDED aggregate that is complete by construction. Under one provenance line "is this all of
   * it?" would have two answers.
   *
   * A RETRIEVAL RESULT != AN INVENTORY. Retrieval returns what matched a question; it can never
   * return the absence of an area nobody asked about, and that absence is the most useful thing
   * this class reports.
   *
   *     COVERAGE != CORRECTNESS     COVERAGE != RATIFICATION
   *     COVERAGE != UNDERSTANDING   MISSING  != THE ORGANIZATION LACKS IT
   */
  | "knowledge-coverage";

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
  "external-recipients",
  "integrations",
  "organization",
  "agents",
  "agent-mandate",
  "recorded-acts",
  "recorded-act-windows",
  "knowledge-coverage",
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
