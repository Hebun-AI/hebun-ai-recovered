/*
 * agent-improvement-hypothesis/contracts.ts — the vocabulary, the boundary, and the Governance
 * subject SIA-3 owns.
 *
 * ── THE FIVE STATEMENTS THIS PHASE EXISTS TO KEEP APART ──────────────────────
 *
 *   PROPOSED IMPROVEMENT ≠ IMPROVEMENT
 *   HYPOTHESIS           ≠ AUTHORIZATION
 *   AUTHORIZATION        ≠ APPLICATION
 *   APPLICATION          ≠ SUCCESS
 *   STRUCTURAL VALIDITY  ≠ BUSINESS SUCCESS
 *
 * Every one of them is a place a reasonable person collapses two facts into one. The wording, the
 * closed vocabularies and the boundary value below exist so the collapse is caught by a test rather
 * than noticed by a customer.
 *
 * No database import. Client-safe on purpose, exactly as SIA-1's and SIA-2's contracts are.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. WHAT MAY BE HYPOTHESISED ABOUT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The improvement target vocabulary. ONE entry, and the CHECK on
 * `agent_improvement_hypotheses.improvement_target` enforces the same set in the database.
 *
 * `selection-behaviour` means: what the model, acting on this agent's behalf, chose to do — the
 * part of the work the agent itself controls, and the only part SIA-1/SIA-2.6 hold evidence about.
 *
 * DELIBERATELY ABSENT, and absent as a value rather than as a rule somebody remembers: prompt,
 * model, tools, permissions, policy. Each is a mutation with its own owner and its own gate, and
 * none of them is one edit away from being admissible here.
 */
export type ImprovementTarget = "selection-behaviour";
export const IMPROVEMENT_TARGETS: readonly ImprovementTarget[] = Object.freeze([
  "selection-behaviour",
]);

/**
 * The closed evidence vocabulary — the observed weaknesses a hypothesis may rest on.
 *
 * Every key names a measurement a RELEASED authority already publishes, so a hypothesis can always
 * be traced back to a number a human can go and look at:
 *
 *   the six model-side states  → `heby_origination_invocations.state`      (AGENT-PROPOSAL-4B)
 *   the two filing outcomes    → `heby_origination_invocations.filing_outcome`
 *   provenance coverage        → SIA-1's derived coverage over the same table
 *
 * All of them became attributable PER AGENT only in SIA-2.6, which is what made this phase
 * reachable: before it, a call that produced no proposal belonged to nobody.
 */
export type EvidenceFindingKey =
  | "selection-invalid"
  | "no-action"
  | "dispatch-failed"
  | "not-dispatched"
  | "outcome-unrecorded"
  | "filing-refused"
  | "filing-failed"
  | "provenance-coverage";

export const EVIDENCE_FINDING_KEYS: readonly EvidenceFindingKey[] = Object.freeze([
  "selection-invalid",
  "no-action",
  "dispatch-failed",
  "not-dispatched",
  "outcome-unrecorded",
  "filing-refused",
  "filing-failed",
  "provenance-coverage",
]);

/**
 * What each evidence key MEANS, and — more importantly — what it does not mean.
 *
 * These sentences are the reason the phase is safe to build. A hypothesis drawn from
 * `selection-invalid` is drawn from a contract mismatch, NOT from evidence that an agent is
 * unintelligent; one drawn from `no-action` rests on a choice that may well have been correct.
 * SIA-1 and SIA-2 already say so on their own surfaces, and SIA-3 repeats it rather than assuming
 * the reader arrived from there.
 */
export const EVIDENCE_MEANING: Readonly<Record<EvidenceFindingKey, string>> = Object.freeze({
  "selection-invalid":
    "The model's output did not match Hebun's closed contract, so nothing was filed. It is " +
    "evidence the output did not parse — never evidence the agent is unintelligent.",
  "no-action":
    "The model declined to select an action. Choosing nothing is NOT a failure; declining to act " +
    "can be the correct answer, and a hypothesis here must argue why this case was not.",
  "dispatch-failed":
    "The call to the provider did not complete. A transport failure is NOT a business failure and " +
    "is not the agent's doing.",
  "not-dispatched":
    "Hebun refused before any network call. This is a guard working, not an agent defect — and " +
    "the only state that PROVES nothing was spent.",
  "outcome-unrecorded":
    "The call was registered and never finalized, so its outcome is UNKNOWN. Unknown is not " +
    "failure, and it is not proof that no call went out.",
  "filing-refused":
    "A selection was made and the proposal inlet declined to file it. A duplicate or a retired " +
    "referent refuses the same way, so this is not a model failure.",
  "filing-failed":
    "The proposal authority was reached and the filing did not complete. It says nothing about " +
    "the quality of what was selected.",
  "provenance-coverage":
    "How much of this agent's authorship Hebun can trace. It measures HEBUN'S RECORDS, not the " +
    "agent — a gap here is Hebun's own blind spot.",
});

/** The authoritative column each evidence key is read from. A reference, never a copy. */
export const EVIDENCE_SOURCE: Readonly<Record<EvidenceFindingKey, string>> = Object.freeze({
  "selection-invalid": "heby_origination_invocations.state",
  "no-action": "heby_origination_invocations.state",
  "dispatch-failed": "heby_origination_invocations.state",
  "not-dispatched": "heby_origination_invocations.state",
  "outcome-unrecorded": "heby_origination_invocations.state",
  "filing-refused": "heby_origination_invocations.filing_outcome",
  "filing-failed": "heby_origination_invocations.filing_outcome",
  "provenance-coverage": "heby_action_requests.origination_invocation_id",
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE GOVERNANCE SUBJECT SIA-3 OWNS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The Governance subject type for a hypothesis.
 *
 * OWNED HERE, MAPPED THERE — the pattern `ACTION_REQUEST_SUBJECT_TYPE` established: the subsystem
 * owns the constant naming its own subject, and the released decision writer maps it to a domain
 * and an outcome. SIA-3 does not define what a decision IS, does not resolve who may decide, and
 * writes no decision of its own accord.
 */
export const IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE = "agent_improvement_hypothesis" as const;

/**
 * The `governance_domain` a hypothesis decision belongs to.
 *
 * `learning` is an EXISTING value of the released `governance_domain` enum with zero prior usage —
 * so this phase adds no enum value and changes no released type. It is the honest fit: deciding
 * whether a candidate change is worth pursuing is a learning-domain question, and it is emphatically
 * NOT `authority-delegation` (no authority moves), NOT `agent-registration` (no agent is created or
 * retired) and NOT `action-authorization` (nothing becomes executable).
 */
export const IMPROVEMENT_HYPOTHESIS_DOMAIN = "learning" as const;

/**
 * The decision types. Both already exist in the released `governance_decision_type` enum.
 *
 * `approve` means "this hypothesis is worth pursuing". It does NOT mean the change was made, may be
 * made automatically, or worked — and the outcome wording below is written so the ledger itself
 * says so.
 */
export const IMPROVEMENT_HYPOTHESIS_APPROVE_TYPE = "approve" as const;
export const IMPROVEMENT_HYPOTHESIS_REJECT_TYPE = "reject" as const;

/**
 * The ledger outcomes.
 *
 * Named `-accepted` / `-declined` rather than `improvement-approved`, and the difference is the
 * whole point: what a human accepted is a HYPOTHESIS, and the one word the ledger must never
 * contain is one that reads as though an improvement happened.
 */
export const IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME = "improvement-hypothesis-accepted" as const;
export const IMPROVEMENT_HYPOTHESIS_DECLINED_OUTCOME = "improvement-hypothesis-declined" as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE BOUNDARY, AS A VALUE
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * What SIA-3 does and does not do, declared as data so a test asserts it instead of trusting a
 * paragraph. The precedent is R7.1's `GOVERNANCE_ACTIVITY_BOUNDARY`, SIA-1's
 * `AGENT_OUTCOME_BOUNDARY` and SIA-2's evaluation boundary.
 *
 * Every `false` is a capability a later phase would have to build DELIBERATELY, through its own
 * gate. None of them is one edit away from existing here.
 */
export const IMPROVEMENT_HYPOTHESIS_BOUNDARY = Object.freeze({
  /* ── It proposes. It never changes an agent. ── */
  mutatesAgentConfiguration: false,
  mutatesPrompt: false,
  mutatesPreferredModel: false,
  mutatesToolPermission: false,
  mutatesPermission: false,
  mutatesPolicy: false,
  mutatesTenantIdentity: false,
  createsOrRetiresAgent: false,

  /* ── It is decided BY Governance. It is not Governance. ── */
  isGovernanceAuthority: false,
  approvesItself: false,
  bypassesGovernance: false,
  writesDecisionOutsideGovernanceWriter: false,

  /* ── It proposes. It never acts. ── */
  applies: false,
  executes: false,
  mintsPermit: false,
  callsModelProvider: false,
  callsExternalProvider: false,
  readsCredential: false,

  /* ── It reads released records. It authors no new truth. ── */
  isSecondObservationAuthority: false,
  mutatesObservation: false,
  persistsEvaluationAsAuthoritativeTruth: false,
  writesMemory: false,
  writesLearning: false,
  writesTelemetry: false,
  writesKnowledge: false,

  /* ── It states what it does not know. It claims nothing it cannot prove. ── */
  claimsImprovement: false,
  claimsBusinessOutcome: false,
  producesScore: false,
  producesProbability: false,
  producesConfidence: false,
  learnsAutonomously: false,
});

/**
 * Vocabulary a field on a hypothesis may never be named after.
 *
 * SIA-1 banned these on an observation and SIA-2 banned them on an evaluation. Here the ban is
 * strictest, because this is the module where a `successProbability` or a `confidence` would look
 * most natural: a proposal that carries a number reads as a forecast, and Hebun holds no record a
 * forecast could be drawn from.
 *
 * `improvement` itself is NOT banned here — unlike in SIA-1 and SIA-2, where it correctly was. This
 * module's whole subject is an improvement HYPOTHESIS, so banning the word would force a euphemism
 * and make the surface less honest rather than more. What is banned is every word that would turn
 * the hypothesis into a claim.
 */
export const FORBIDDEN_HYPOTHESIS_VOCABULARY: readonly string[] = Object.freeze([
  "score",
  "rating",
  "grade",
  "rank",
  "probability",
  "likelihood",
  "confidence",
  "successrate",
  "quality",
  "performance",
  "efficiency",
  "benchmark",
  "revenue",
  "roi",
  "impactvalue",
  "applied",
  "rolledback",
  "succeeded",
  "improved",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE SURFACE'S OWN WORDING
 * ═════════════════════════════════════════════════════════════════════════ */

export const IMPROVEMENT_HYPOTHESIS_WORDING = Object.freeze({
  regionTitle: "Improvement Hypotheses",
  regionSummary:
    "Evidence-backed QUESTIONS about an agent's selection behaviour, put to Governance. Each one " +
    "says what was observed, what change might follow from it, and what it does not know.",

  /** Said once, at the top, because it is the entire shape of the phase. */
  hypothesisIsNotImprovement:
    "A hypothesis is not an improvement. Nothing here has changed any agent, and Hebun cannot " +
    "tell you whether the candidate change would work.",
  approvalIsNotApplication:
    "Governance approval means a human judged this worth pursuing. It does NOT mean the change " +
    "was applied — Hebun has no way to apply it, and no record that anything was.",
  noApplyControl:
    "This surface offers no control. There is no apply, no retry, no tune and no enable, and it " +
    "changes no agent's prompt, model, tools, permissions or policy.",

  /* The four sections, kept visually separate because they are four different kinds of claim. */
  evidenceTitle: "Observed evidence",
  evidenceCaption:
    "Copied from an authoritative record at a stated instant. A snapshot of a count that keeps " +
    "moving — never a claim about now.",
  evaluationTitle: "Derived evaluation",
  evaluationCaption:
    "What SIA-2 derived from that observation. Coverage of Hebun's own records, never a grade.",
  hypothesisTitle: "Improvement hypothesis",
  hypothesisCaption: "A candidate change and its expected structural effect. Neither is a finding.",
  decisionTitle: "Governance decision",
  decisionCaption:
    "Held in the Governance ledger, not here. This surface reads it; it never writes it.",

  /* States. An absence is never rendered as a result. */
  undecided: "No Governance decision has been recorded about this hypothesis.",
  undecidedIsNotRejected:
    "Undecided is not rejected. Nobody has been asked, or nobody has answered yet.",
  unavailable: "Improvement hypotheses could not be read.",
  unavailableIsNotEmpty:
    "An unreadable list is not an empty one. This says nothing about what has been proposed.",
  none: "No improvement hypothesis has been filed for this organization.",
  noneIsNotNothingToImprove:
    "That means none has been WRITTEN — never that this organization's agents have nothing worth " +
    "examining.",

  /* Evidence honesty. */
  evidenceUnavailable: "The evidence this hypothesis cites could not be read.",
  evidenceUnavailableIsNotAbsent:
    "An unreadable record is not a missing one. The hypothesis still names exactly what it rested " +
    "on, and that reference is unchanged.",
  supersededBy: "A later hypothesis names this one as its predecessor.",
  supersessionIsNotWithdrawal:
    "Being superseded does not withdraw or decide this hypothesis. The record stands as written.",
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. WHAT SIA-3 STILL CANNOT DO
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Declared rather than omitted, in SIA-2's `UNAVAILABLE_DIMENSIONS` shape.
 *
 * A surface that simply leaves these out reads as though a hypothesis were a plan. Naming them is
 * what stops "Governance approved" from being read as "Hebun will now do it".
 */
export interface HypothesisLimitation {
  readonly key: string;
  readonly label: string;
  readonly explanation: string;
}

export const HYPOTHESIS_LIMITATIONS: readonly HypothesisLimitation[] = Object.freeze([
  Object.freeze({
    key: "no-application",
    label: "Applying the change",
    explanation:
      "No runtime in Hebun can change an agent's selection behaviour. An approved hypothesis is a " +
      "decision to pursue something, and the pursuing would be a human's work.",
  }),
  Object.freeze({
    key: "no-outcome-measurement",
    label: "Whether it would help",
    explanation:
      "Nothing measures the effect of a change that was never applied. Hebun holds a baseline and " +
      "nothing to compare it against.",
  }),
  Object.freeze({
    key: "no-business-outcome",
    label: "Business impact",
    explanation:
      "Nothing in Hebun records what happened in the world after an act, so no hypothesis here " +
      "may claim a commercial effect. Selection validity is not business success.",
  }),
  Object.freeze({
    key: "no-ranking",
    label: "Which hypothesis matters most",
    explanation:
      "Hypotheses are not ranked, scored or prioritised. Nothing defines which observed weakness " +
      "is the more serious one, so ordering them would be an invented judgement.",
  }),
  Object.freeze({
    key: "no-cause",
    label: "Why the weakness exists",
    explanation:
      "The evidence says WHAT was observed, never WHY. A root cause would require an investigation " +
      "capability that does not exist here.",
  }),
]);
