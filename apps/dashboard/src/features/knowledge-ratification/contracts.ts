/*
 * knowledge-ratification/contracts.ts — the typed vocabulary of Governance-backed ratification (K4).
 *
 * THE CHAIN K4 COMPLETES:
 *
 *   human-authored Knowledge version   knowledge_nodes, draft / provisional     (K2, K3)
 *          ↓
 *   Governance review                  a human holding G2 authority reads it
 *          ↓
 *   G2 ratify / reject decision        decision_records, subject = knowledge_node
 *          ↓
 *   K4 exact-version binding           knowledge_nodes.ratification_decision_id  (HERE)
 *          ↓
 *   organizational ratification state
 *
 * WHAT "RATIFIED" MEANS, EXACTLY: the organization's legitimate Governance authority approved THIS
 * EXACT VERSION. It does NOT mean the statement is true, verified, accurate, or safe to rely on. It
 * is an organizational status, not an epistemic one, and nothing in Hebun may translate it into a
 * claim about reality.
 *
 * WHO OWNS WHAT, STATED ONCE:
 *   Governance owns the DECISION            decision_records / governance_sessions
 *   Knowledge owns the VERSION and its
 *   canonical ratification linkage          knowledge_nodes
 *
 * A decision is not automatically a Knowledge mutation — K4 is the only thing that turns one into
 * the other, and it does so for one named version at a time. A Knowledge record can never ratify
 * itself: the authority comes from a bootstrap decision in a different table.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/** The G2 subject type a ratification decision must carry. A version, never a fact. */
export const RATIFICATION_SUBJECT_TYPE = "knowledge_node" as const;

/**
 * What ratification changes, and what it cannot. Values, not prose, so the surface renders exactly
 * what a test asserts.
 */
export const RATIFICATION_EFFECT =
  "records that this organization's Governance authority approved this exact version";

export const RATIFICATION_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not make the statement true, verified, or accurate",
  "does not apply to any future version of this record",
  "does not change the statement, its version number, or its authorship",
  "does not grant anyone new authority",
  "does not enable providers, execution, or Computer Use",
]);

/**
 * The sentence the surface must show before a ratification, and a test asserts is present. The
 * version-scoping is the whole point: a human must not believe they are blessing a record forever.
 */
export const RATIFICATION_VERSION_SCOPE_NOTICE =
  "This ratification applies only to the displayed version. A future superseding version will be " +
  "unratified and will require a new Governance decision.";

/**
 * Rejection, stated so nobody expects a deletion.
 *
 * A `reject` decision records that Governance did not approve this version. It does NOT delete the
 * record, rewrite the statement, mark it false, or remove history — the version stays exactly as
 * authored, and simply remains unratified. K4 deliberately writes NOTHING to Knowledge for a
 * rejection: there is no "rejected" column on `knowledge_nodes`, and inventing a status mutation
 * because `knowledgeLifecycleStatus` happens to have values would be fabricating semantics the
 * repository never defined.
 */
export const REJECTION_EFFECT =
  "records that Governance did not approve this version. The version is unchanged and remains unratified";

export const REJECTION_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not delete the record or any version of it",
  "does not change the statement",
  "does not mark the statement false",
  "does not remove it from history",
]);

/**
 * SELF-RATIFICATION IS PERMITTED, AND THAT IS A STATED LIMITATION RATHER THAN AN OVERSIGHT.
 *
 * Nothing in the repository requires separation of duties: `governance.ts` forbids an AGENT from
 * self-elevating (Spec 49 §4 human supremacy) but says nothing about a human ratifying their own
 * authorship, and no policy runtime exists to express such a rule. Inventing one here would be
 * fabricating a governance policy, which is precisely what every phase of this chain has refused to
 * do. It is recorded as a limitation so a later policy phase can decide deliberately.
 */
export const RATIFICATION_SEPARATION_OF_DUTIES = Object.freeze({
  authorMayRatifyOwnVersion: true as const,
  enforcedByRepository: false as const,
  limitation:
    "The Governance authority may ratify a version they authored. No separation-of-duties rule " +
    "exists anywhere in the repository, and K4 did not invent one. Enforcing it later requires an " +
    "explicit policy/authority phase.",
});

/** Why a ratification attempt ended the way it did. A closed set — no free-text excuses. */
export type RatificationRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no bootstrap decision, so no Governance authority exists yet. */
  | "no-governance-authority"
  /** Authenticated — possibly a Knowledge author at owner band — but not the Governance authority. */
  | "not-the-governance-authority"
  /** The fact, or the named version, does not exist in this tenant. */
  | "version-unresolvable"
  /** The named version is not the fact's current version; history is not ratifiable. */
  | "not-the-current-version"
  /** The operator reviewed a version that is no longer current. */
  | "stale-review"
  /** This version already carries a ratification decision. */
  | "already-ratified"
  | "justification-required"
  | "persistence-unavailable";

export type RatificationResult =
  | {
      readonly status: "ratified";
      readonly knowledgeNodeId: string;
      readonly knowledgeVersion: number;
      readonly decisionId: string;
      readonly governanceSessionId: string;
      readonly ratifiedAt: string;
    }
  | { readonly status: "refused"; readonly reason: RatificationRefusal };

export type RejectionResult =
  | {
      readonly status: "rejected";
      readonly knowledgeNodeId: string;
      readonly knowledgeVersion: number;
      readonly decisionId: string;
      readonly governanceSessionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: RatificationRefusal };

/**
 * The ratification provenance of one version, for reads.
 *
 * Deliberately ABSENT: confidence, truth score, certainty, quality score, approval percentage.
 * None of those exists, and a ratified version is not a verified one.
 */
export interface RatificationProvenance {
  readonly ratified: boolean;
  readonly ratifiedAt: string | null;
  readonly ratifiedByActorId: string | null;
  readonly ratificationDecisionId: string | null;
  readonly governanceSessionId: string | null;
}
