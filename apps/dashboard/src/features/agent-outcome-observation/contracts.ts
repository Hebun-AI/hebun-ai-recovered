/*
 * agent-outcome-observation/contracts.ts — the vocabulary for "what happened to what this agent
 * proposed" (SELF-IMPROVING-AGENTS-1).
 *
 * ── THIS PHASE OBSERVES. IT DOES NOT EVALUATE ────────────────────────────────
 *
 * There is no score here, no rating, no success rate, no quality signal, no threshold and no
 * recommendation — not because they were left for later, but because every one of them would be a
 * DERIVED CLAIM that no authoritative record supports. A "success rate" over a table whose
 * strongest positive value is `accepted` would silently equate acceptance with delivery, which is
 * exactly the equation this repository has spent three phases refusing to make.
 *
 * Every number this feature reports is a COUNT OF ROWS that exist, grouped by a column that a
 * released authority wrote. Nothing is inferred, nothing is backfilled, and nothing is estimated.
 *
 * ── THE SEVEN STAGES ARE SEVEN, AND STAY SEVEN ───────────────────────────────
 *
 * PROPOSED, AUTHORIZED, PERMITTED, EXECUTED, ACCEPTED, FAILED, UNKNOWN each come from a different
 * durable fact written by a different authority. Collapsing any pair would create a sentence the
 * database cannot support: "authorized" would come to mean "done", "permitted" would come to mean
 * "spent", and "accepted" would come to mean "arrived". The ladder below keeps them apart by
 * naming, for each one, both what it says AND what it refuses to say.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * THE STAGE LADDER
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The stages of one agent-originated act, in the order the authorities produce them.
 *
 * `REFUSED` and `PENDING` are execution outcomes too, and they are NOT in this ladder: the ladder
 * describes the path an act takes, and those two describe where an attempt stopped. They are
 * carried in the execution counts and rendered beside these, never folded into `FAILED`.
 */
export const AGENT_OUTCOME_STAGES = Object.freeze([
  "PROPOSED",
  "AUTHORIZED",
  "PERMITTED",
  "EXECUTED",
  "ACCEPTED",
  "FAILED",
  "UNKNOWN",
] as const);

export type AgentOutcomeStage = (typeof AGENT_OUTCOME_STAGES)[number];

/**
 * What each stage is, where the fact comes from, and what a reader must NOT conclude from it.
 *
 * Frozen so a test pins what a Director is told and a later edit that softens a boundary fails
 * here rather than in front of a human.
 */
export const AGENT_OUTCOME_STAGE_MEANING: Readonly<
  Record<AgentOutcomeStage, { readonly source: string; readonly means: string; readonly doesNotMean: string }>
> = Object.freeze({
  PROPOSED: Object.freeze({
    source: "heby_action_requests — a row exists naming this agent as proposer",
    means: "This agent filed a proposal. A human still had to read it.",
    doesNotMean: "It does not mean anyone approved it, and it does not mean anything happened.",
  }),
  AUTHORIZED: Object.freeze({
    source: "heby_action_requests.status = 'approved'",
    means: "A Governance authority approved the proposal.",
    doesNotMean: "Approved is not executed. No external act follows from an approval alone.",
  }),
  PERMITTED: Object.freeze({
    source: "action_permits — a permit was issued against the proposal",
    means: "A durable authorization to act exists, or existed.",
    doesNotMean: "A permit is not an execution. An unspent permit expires having done nothing.",
  }),
  EXECUTED: Object.freeze({
    source: "action_execution_attempts — an attempt row exists",
    means: "An authorization was spent and an attempt was recorded.",
    doesNotMean: "It does not mean the attempt succeeded, and it does not mean anything was sent.",
  }),
  ACCEPTED: Object.freeze({
    source: "action_execution_attempts.status = 'accepted'",
    means: "The provider took the request and returned its own id. That is the strongest claim available.",
    doesNotMean: "Accepted is not delivered, not received, not read, and not acted upon.",
  }),
  FAILED: Object.freeze({
    source: "action_execution_attempts.status = 'failed'",
    means: "A provider answered and declined, or the connection provably never came up.",
    doesNotMean: "It does not mean a retry is safe, and it is not the same as an unknown outcome.",
  }),
  UNKNOWN: Object.freeze({
    source: "action_execution_attempts.status = 'unknown'",
    means: "The request was sent and the answer was lost. The external effect may already have happened.",
    doesNotMean: "It is not a failure. Reading it as one is what invites a double send.",
  }),
});

/**
 * The claims this surface refuses to make, rendered rather than implied.
 *
 * Each line is a sentence a reader might otherwise supply for themselves, which is precisely why
 * it is written down.
 */
export const AGENT_OUTCOME_NON_CLAIMS: readonly string[] = Object.freeze([
  "accepted is not delivered — no provider reports whether a recipient received or read anything",
  "approved is not executed — an approval authorizes an act, it does not perform one",
  "a permit is not an execution — an unspent permit expires having caused nothing",
  "a missing model invocation is not proof that no model was used",
  "a missing model invocation is not proof that the proposal was deterministic",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * PROPOSAL LIFECYCLE — WHAT IS AUTHORITATIVE, AND WHAT DOES NOT EXIST
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Every value `heby_action_request_status` admits. Total on purpose: a new value added to the enum
 * without a counter here would be silently uncounted, and a total that omits rows is a lie with a
 * number attached.
 *
 * THERE IS NO `expired`. The enum has four values and none of them is expiry — a proposal that
 * nobody decided stays `pending` for ever, because this repository has no scheduler and refuses to
 * declare a state nothing transitions rows into. An "expired proposals" count would therefore be
 * derived from a clock rather than from a record, so this feature does not report one.
 */
export const AGENT_PROPOSAL_STATUSES = Object.freeze([
  "pending",
  "approved",
  "rejected",
  "withdrawn",
] as const);

export type AgentProposalStatus = (typeof AGENT_PROPOSAL_STATUSES)[number];

/**
 * Every permit state a human is shown, including the one the database does not store.
 *
 * `expired` is DERIVED — `action_permit_status` deliberately has no such value, and expiry is
 * `expires_at <= now()`. See {@link isExpiredPermit}.
 */
export const AGENT_PERMIT_STATES = Object.freeze([
  "active",
  "expired",
  "consumed",
  "revoked",
] as const);

export type AgentPermitState = (typeof AGENT_PERMIT_STATES)[number];

/**
 * THE EXPIRY RULE, AS ONE PURE FUNCTION — the aggregate's mirror of the released display rule.
 *
 * `derivePermitState` (R3A, `read-action-authorizations.server.ts`) is the released definition a
 * Director already reads on `/approvals`. This aggregate cannot call it: the counting happens
 * inside PostgreSQL, where a TypeScript function is not reachable. So the SQL carries the rule a
 * second time, and R6B's rule applies — SQL duplicating pure logic needs an EQUIVALENCE TEST, not
 * a comment promising the two agree.
 *
 * This function is that mirror, in the same shape the SQL filter uses, and a test asserts
 * `isExpiredPermit(s, e, n) === (derivePermitState(s, e, n) === "expired")` across the whole
 * status vocabulary and both sides of the clock.
 *
 * `consumed` and `revoked` are terminal and outrank the clock, exactly as they do in the released
 * rule: a permit spent before its expiry was spent, and calling it expired afterwards would
 * misreport what happened.
 */
export function isExpiredPermit(status: string, expiresAt: Date, now: Date): boolean {
  return status === "active" && expiresAt.getTime() <= now.getTime();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PROVENANCE COVERAGE
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * How a proposal with no `origination_invocation_id` must be read.
 *
 * AGENT-PROPOSAL-4B shipped the invocation table. Every agent proposal filed BEFORE it carries a
 * null link, and no amount of inspection can recover which model call caused it. That absence is a
 * fact about Hebun's records, and it is reported as one — never repaired, never inferred, and
 * never backfilled from a timestamp that happens to be nearby.
 *
 * The two forbidden readings are spelled out because both are tempting and both are wrong: a null
 * link does not mean the proposal was produced without a model, and it does not mean the proposal
 * was produced deterministically.
 */
export const PROVENANCE_COVERAGE_WORDING = Object.freeze({
  proven: "the model invocation that caused this proposal is durably recorded",
  unproven: "transport not durably proven — no invocation record exists for this proposal",
  unprovenIsNotAbsence:
    "A proposal with no invocation record is not evidence that no model was used, and not " +
    "evidence that the proposal was deterministic. It is evidence that Hebun was not yet " +
    "recording which model call caused a proposal.",
  neverBackfilled:
    "Missing invocation records are never reconstructed. Hebun does not infer a model call from a " +
    "nearby timestamp, and this surface shows the gap rather than closing it.",
});

/* ═══════════════════════════════════════════════════════════════════════════
 * THE SURFACE'S OWN WORDING
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * What the Director reads, frozen for the same reason the stage ladder is: so an edit that
 * softens a boundary fails in a test rather than in front of a human.
 */
export const AGENT_OUTCOME_WORDING = Object.freeze({
  regionTitle: "Agent Outcome Observation",
  regionSummary:
    "What happened to what each durable agent proposed, composed from records Hebun already holds. " +
    "This surface observes. It scores nothing, learns nothing, and changes nothing.",
  activityTitle: "Activity",
  governanceTitle: "Governance outcomes",
  executionTitle: "Execution outcomes",
  modelUsageTitle: "Model usage",
  provenanceTitle: "Provenance coverage",
  /** Distinct from an empty observation: an unread store is not an organization with no agents. */
  unavailable: "Agent outcomes could not be read.",
  unavailableIsNotEmpty:
    "An unreadable observation is not an empty one. This says nothing about what this " +
    "organization's agents have proposed.",
  noAgents:
    "This organization has established no durable agent identity, so there is nothing to observe.",
  /** A real identity that has done nothing is a first-class answer, never a blank row. */
  zeroActivity:
    "This agent has filed no proposal. Nothing has been authorized, permitted or executed on its " +
    "behalf, and no model invocation is linked to it.",
  retired:
    "This agent has been withdrawn from service. The record of what it proposed is unaffected.",
  /** Tokens are a LOWER BOUND whenever a provider reported no usage. Said, not implied. */
  tokensAreLowerBound:
    "Token totals cover only invocations for which the provider reported usage. Invocations that " +
    "reported none are counted, never summed as zero, so these totals are a lower bound.",
  /**
   * The invocation table carries no agent column, so the ONLY attribution available is the
   * proposal that names an invocation. This sentence is the whole reason model usage here is
   * narrower than "every model call this agent made".
   */
  invocationsAreLinkedOnly:
    "Only model invocations that a proposal names can be attributed to an agent. An invocation " +
    "that produced no proposal is recorded, but no agent owns it.",
  unattributedInvocations:
    "Model invocations recorded for this organization that no proposal names. They belong to no " +
    "agent here, and they are not missing — they are attributed to nobody because nothing links them.",
  /** R6B: a bounded list says it is bounded, or it reads as the whole record. */
  distributionTruncated:
    "More provider and model combinations exist than are shown. This list is bounded, and a " +
    "bounded list is not the whole record.",
  /**
   * A join that drops rows under-reports, and an under-report on this surface reads as an agent
   * having done less than it did. So the drop is counted and stated.
   */
  unresolvedActivity:
    "Proposals attributed to an agent identity this read could not resolve. They are counted here " +
    "so the totals above are never quietly short.",
  noControls:
    "This surface offers no control. It cannot create, retire, propose, approve, reject, permit, " +
    "revoke, execute or retry anything, and it changes no agent's configuration.",
});

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY, AS A VALUE
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * What this feature does and does not produce, declared as data so a test can assert it rather
 * than trusting a paragraph. The precedent is R7.1's `GOVERNANCE_ACTIVITY_BOUNDARY`.
 *
 * Every `false` below is a capability a later self-improvement phase would have to build
 * DELIBERATELY, through its own gate. None of them is one edit away from existing here.
 */
export const AGENT_OUTCOME_BOUNDARY = Object.freeze({
  /** It counts rows. It does not judge them. */
  producesScore: false,
  producesRating: false,
  producesJudgement: false,
  producesRecommendation: false,
  /** It observes the past. It proposes no change to anything. */
  producesImprovementProposal: false,
  mutatesAgentConfiguration: false,
  mutatesPrompt: false,
  mutatesModelSelection: false,
  mutatesToolPermission: false,
  /** It reads records that exist. It learns nothing and remembers nothing of its own. */
  writesMemory: false,
  writesTelemetry: false,
  writesKnowledge: false,
  writesAudit: false,
  /** It composes released authorities. It holds none. */
  createsOrRetiresAgent: false,
  originatesProposal: false,
  decidesProposal: false,
  issuesOrRevokesPermit: false,
  executes: false,
  callsModelProvider: false,
  callsExternalProvider: false,
  readsCredential: false,
});

/**
 * Vocabulary a field on this observation may never be named after.
 *
 * A count that acquires a name like `successRate` has stopped being an observation and become a
 * verdict — and the verdict would be false, because its numerator could only ever be `accepted`,
 * which is not delivery. Banning the NAMES is how the boundary survives an edit made in good faith.
 */
export const FORBIDDEN_OUTCOME_VOCABULARY: readonly string[] = Object.freeze([
  "score",
  "rating",
  "grade",
  "rank",
  "quality",
  "successrate",
  "performance",
  "efficiency",
  "recommendation",
  "improvement",
  "trend",
  "verdict",
  "confidence",
]);
