/*
 * knowledge-public-use/contracts.ts — whether ONE EXACT Knowledge version may be used as factual
 * grounding for public-facing content (KT-3). The vocabulary, the state machine and the words.
 *
 * ── A SECOND AXIS, NOT A SECOND TRUTH ────────────────────────────────────────
 *
 * Ratification answers "is this the organization's settled statement?". This answers a different
 * question: "may Hebun put it in front of the public as a fact?". A true statement can be internal
 * (sourcing, margins); an unratified one can be cleared for public use by Governance without becoming
 * true. Neither answer implies the other, and the ledger keeps them apart by SUBJECT, DOMAIN and
 * OUTCOME words, so a row read years later can never be mistaken for the other kind.
 *
 *     RATIFIED  != PUBLICLY USABLE        ALLOWED != TRUE        UNKNOWN != DENIED
 *
 * ── THE SUBJECT IS THE VERSION ROW ───────────────────────────────────────────
 *
 * Like ratification, a use decision names the exact `knowledge_nodes` row. A superseding version is a
 * different row with no decision, so it starts UNKNOWN: permission never travels to text nobody
 * judged.
 *
 * ── NOTHING CONSUMES THIS YET ────────────────────────────────────────────────
 *
 * This phase records and shows the decision. Retrieval, Heby, content preparation, readiness and
 * publication do not read it, and a test holds that absence until the enforcing phase.
 *
 * Pure. No I/O. A client component may import it.
 */

/** The Governance subject a use decision names. Its id is the `knowledge_nodes` row id. */
export const PUBLIC_USE_SUBJECT_TYPE = "knowledge_public_use" as const;

/** Its own `governance_domain` (additive enum value) — not `knowledge-ratification`. */
export const PUBLIC_USE_DOMAIN = "knowledge-public-use" as const;

/** The three derived states. UNKNOWN is the absence of any decision, never a decision. */
export type PublicUseState = "unknown" | "allowed" | "denied";

/** What a human may ask for. */
export type PublicUseAction = "allow" | "deny" | "revoke";
export const PUBLIC_USE_ACTIONS: readonly PublicUseAction[] = Object.freeze(["allow", "deny", "revoke"]);

/** The released Governance decision types each action records. No new decision words. */
export const PUBLIC_USE_DECISION_TYPE = Object.freeze({
  allow: "approve",
  deny: "reject",
  revoke: "revoke",
} as const);

/** The ledger's outcome words. Each names PUBLIC USE; none says anything about truth. */
export const PUBLIC_USE_OUTCOME = Object.freeze({
  allow: "public-use-allowed",
  deny: "public-use-denied",
  revoke: "public-use-revoked",
} as const);

/**
 * THE STATE MACHINE. Four transitions; everything else is refused rather than silently absorbed.
 *
 *     unknown --allow-->  allowed        unknown --deny--> denied
 *     allowed --revoke--> denied         denied  --allow-> allowed
 *
 * `deny` from `allowed` is refused on purpose: withdrawing a permission is a REVOKE, a different
 * record from never having granted it, and the ledger should say which happened.
 */
const TRANSITIONS: Readonly<Record<PublicUseState, Partial<Record<PublicUseAction, PublicUseState>>>> =
  Object.freeze({
    unknown: { allow: "allowed", deny: "denied" },
    allowed: { revoke: "denied" },
    denied: { allow: "allowed" },
  });

/** The state an action leads to from `current`, or null when the transition is not allowed. */
export function nextPublicUseState(current: PublicUseState, action: PublicUseAction): PublicUseState | null {
  return TRANSITIONS[current]?.[action] ?? null;
}

/** The state a recorded decision type leaves behind. Null for any word that is not a use decision. */
export function publicUseStateFromDecisionType(decisionType: string): Exclude<PublicUseState, "unknown"> | null {
  if (decisionType === PUBLIC_USE_DECISION_TYPE.allow) return "allowed";
  if (decisionType === PUBLIC_USE_DECISION_TYPE.deny || decisionType === PUBLIC_USE_DECISION_TYPE.revoke) {
    return "denied";
  }
  return null;
}

export type PublicUseRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  /** No such current version of that fact in this organization (a foreign one is indistinguishable). */
  | "version-unresolvable"
  /** History is not decidable: only the fact's current version. */
  | "not-the-current-version"
  /** The operator decided about a version that is no longer current. */
  | "stale-review"
  /** Governance rejected this version as not the organization's statement; it cannot be cleared for public use. */
  | "truth-rejected"
  /** The requested change is not one of the four transitions from the current state. */
  | "invalid-transition"
  | "justification-required"
  | "persistence-unavailable";

export type PublicUseDecisionResult =
  | {
      readonly status: "decided";
      readonly knowledgeNodeId: string;
      readonly knowledgeVersion: number;
      readonly state: Exclude<PublicUseState, "unknown">;
      readonly decisionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: PublicUseRefusal };

/** The state, in words a reader cannot mistake for truth. */
export const PUBLIC_USE_STATE_LABELS: Readonly<Record<PublicUseState, string>> = Object.freeze({
  unknown: "No public-use decision recorded",
  allowed: "Allowed as public factual grounding",
  denied: "Not allowed as public factual grounding",
});

/** What the decision does NOT mean. Rendered verbatim beside the control. */
export const PUBLIC_USE_NON_CLAIMS: readonly string[] = Object.freeze([
  "Allowed for public use does not make a statement true; truth is ratification, a separate decision.",
  "Ratified does not mean publicly usable; a settled internal fact can still be denied for public content.",
  "This decision binds this exact version. A new version starts with no public-use decision.",
  "Recording it does not yet change what Hebun retrieves or generates; enforcement is a later, separately approved step.",
]);
