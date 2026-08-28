/*
 * agent-evaluation/contracts.ts — what Hebun may truthfully SAY about an agent, and what it may
 * not (SELF-IMPROVING-AGENTS-2).
 *
 * ── WHAT THIS PHASE IS ───────────────────────────────────────────────────────
 *
 * SIA-1 answered "what happened to what this agent proposed" as counts of rows. SIA-2 interprets
 * those counts — and the interpretation is deliberately narrow, because the honest answer to "how
 * good is this agent?" is that Hebun cannot say. It holds no record of delivery, no record of
 * business outcome, and no definition of a good decision.
 *
 * So every derived value below is a COVERAGE measure: a statement about how complete Hebun's own
 * records are, not a judgement about the agent. Coverage is the only thing the evidence supports.
 *
 * ── THREE KINDS, STRUCTURALLY SEPARATE ───────────────────────────────────────
 *
 *   observed     a count copied from an authoritative row. SIA-1 already established it.
 *   derived      a numerator over a denominator, both observed. Always labelled DERIVED.
 *   unavailable  a dimension somebody will ask for, that Hebun has no record to answer with.
 *
 * They are three different TYPES rather than three values of one field, so a surface cannot render
 * an unavailable dimension as though it were a measurement, and a derived value cannot be mistaken
 * for a recorded fact. The type system carries the distinction the wording only describes.
 *
 * ── THERE IS NO SCORE, AND NO PERCENTAGE ─────────────────────────────────────
 *
 * Not "there is no score yet" — there is no representation in which one could be expressed. A
 * derived metric carries a NUMERATOR and a DENOMINATOR and no quotient: nothing in this feature
 * divides, so "92%" cannot be produced by an edit that merely forgets a rule. A reader is shown
 * "3 of 4", which is the same fact without the grade.
 *
 * The reason is not stylistic. Every plausible quotient here would assert something false:
 * accepted-over-attempted reads as delivery, approved-over-filed reads as quality, and
 * tokens-per-call reads as efficiency. Hebun holds evidence for none of the three.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * AVAILABILITY
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Why a dimension cannot be stated. Closed on purpose, and each value is a fact about the
 * REPOSITORY rather than about the agent.
 */
export type EvaluationUnavailableReason =
  /** No durable record of this concept exists anywhere in Hebun. */
  | "no-authoritative-record"
  /** The records exist; this agent has produced none, so the denominator is zero. */
  | "no-evidence-yet"
  /** Records exist, but Hebun holds no authoritative definition of the thing being asked for. */
  | "definition-not-owned";

export type EvaluationAvailability =
  | { readonly state: "available" }
  | { readonly state: "unavailable"; readonly reason: EvaluationUnavailableReason };

export const AVAILABLE: EvaluationAvailability = Object.freeze({ state: "available" as const });

/** A zero denominator is NOT a zero result. "0 of 0" is not a finding; it is an absence. */
export function shareAvailability(denominator: number): EvaluationAvailability {
  return denominator > 0 ? AVAILABLE : Object.freeze({ state: "unavailable" as const, reason: "no-evidence-yet" as const });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE THREE KINDS
 * ═════════════════════════════════════════════════════════════════════════ */

/** A count copied from an authoritative row. Nothing is computed. */
export interface ObservedMetric {
  readonly kind: "observed";
  readonly key: string;
  readonly label: string;
  /** The authoritative record this count comes from. Named, so a reader can go and check. */
  readonly source: string;
  readonly means: string;
  readonly doesNotMean: string;
  readonly value: number;
}

/**
 * A numerator over a denominator, both of them observed counts.
 *
 * NO QUOTIENT FIELD, deliberately — see the header. `numerator` and `denominator` are the whole
 * representation, and a surface renders them as "n of d".
 */
export interface DerivedMetric {
  readonly kind: "derived";
  readonly key: string;
  readonly label: string;
  readonly source: string;
  /** Exactly what is being counted on each side. Not prose — the arithmetic, in words. */
  readonly definition: string;
  readonly means: string;
  readonly doesNotMean: string;
  readonly numerator: number;
  readonly denominator: number;
  readonly availability: EvaluationAvailability;
}

/** A dimension a reader will look for, and the reason Hebun cannot answer it. */
export interface UnavailableDimension {
  readonly kind: "unavailable";
  readonly key: string;
  readonly label: string;
  readonly reason: EvaluationUnavailableReason;
  /** Why, in a sentence a Director can act on — not an apology. */
  readonly explanation: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE DIMENSIONS HEBUN CANNOT ANSWER
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Declared rather than omitted.
 *
 * An evaluation surface that simply leaves these out reads as though the dimensions were covered
 * by the ones it does show. Naming them is what stops "execution reliability" from being read as
 * "this agent works well".
 *
 * Every entry was MEASURED against the repository, not assumed:
 *
 *   - `action_execution_attempts` carries no business-success column, by design.
 *   - `agents.performance_targets` exists as a column and has ZERO writers.
 *   - `telemetry_events`, `learning_sessions` and `improvement_proposals` have zero writers and
 *     zero readers.
 *   - `src/features/evaluation` has zero runtime callers and is structurally forbidden from
 *     reaching a database by its own released boundary test.
 */
export const UNAVAILABLE_DIMENSIONS: readonly UnavailableDimension[] = Object.freeze([
  Object.freeze({
    kind: "unavailable" as const,
    key: "delivery",
    label: "Delivery confirmation",
    reason: "no-authoritative-record" as const,
    explanation:
      "No record of delivery exists. A provider accepting a request and returning its own id is " +
      "the strongest claim Hebun can make, and it is not the same claim.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "business-outcome",
    label: "Business outcome",
    reason: "no-authoritative-record" as const,
    explanation:
      "Nothing in Hebun records what happened in the world after an act. The execution attempt " +
      "table deliberately carries no business-success column.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "decision-quality",
    label: "Decision quality",
    reason: "definition-not-owned" as const,
    explanation:
      "An approval is a governance disposition, not a verdict on the proposal. Hebun holds no " +
      "definition of a good decision and no record of whether one turned out well.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "efficiency",
    label: "Efficiency",
    reason: "definition-not-owned" as const,
    explanation:
      "Token counts are recorded; nothing defines what a good one is. Fewer tokens is not better " +
      "and more is not worse.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "performance-target",
    label: "Performance against target",
    reason: "no-authoritative-record" as const,
    explanation:
      "The agent record has a performance-targets column and nothing has ever written it. A " +
      "target no writer sets is not a target.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "temporal-trend",
    label: "Change over time",
    reason: "definition-not-owned" as const,
    explanation:
      "Timestamps exist, so a line could be drawn. Nothing defines which direction is an " +
      "improvement, so the line would be a shape without a meaning.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "usefulness",
    label: "Usefulness of what was proposed",
    reason: "no-authoritative-record" as const,
    explanation:
      "No record captures whether a proposal helped anyone. Nobody is asked, and no answer is stored.",
  }),
  Object.freeze({
    kind: "unavailable" as const,
    key: "correctness",
    label: "Correctness",
    reason: "no-authoritative-record" as const,
    explanation:
      "Nothing checks whether an agent's selection was right. A proposal that a human approved is " +
      "a proposal a human approved.",
  }),
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * THE SEMANTIC INVARIANTS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The claims this evaluation refuses to make, rendered rather than implied.
 *
 * SIA-1 carried five of these about observation. Evaluation is where the remaining ones become
 * load-bearing: the moment a number is called an evaluation, a reader starts converting it into a
 * verdict, and each line below blocks one specific conversion.
 */
export const EVALUATION_NON_CLAIMS: readonly string[] = Object.freeze([
  "approved is not successful — an approval authorizes an act, it does not judge one",
  "rejected is not failed — a Director may reject a perfectly good proposal for reasons of timing",
  "accepted is not delivered — no provider reports whether a recipient received anything",
  "accepted is not business success — nothing here records what happened in the world",
  "an execution failure is not an agent failure — the network, the provider and the recipient are not the agent",
  "unknown is not failed — the effect may already have happened",
  "a permit is not an execution — an unspent permit expires having caused nothing",
  "missing provenance is not proof the proposal was deterministic",
  "missing provenance is not proof that no model was used",
  "token count is not quality — neither direction of it",
  "frequency is not preference — a Director approving nine of ten may mean nine were trivial",
  "correlation is not causation — nothing here establishes why any outcome occurred",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY, AS A VALUE
 * ═════════════════════════════════════════════════════════════════════════ */

/** What this feature does and does not produce, as data a test can assert. */
export const AGENT_EVALUATION_BOUNDARY = Object.freeze({
  /* It interprets counts. It does not grade. */
  producesScore: false,
  producesGrade: false,
  producesRanking: false,
  producesPercentage: false,
  producesSuccessRate: false,
  /* It reads. It records nothing of its own. */
  persistsEvaluation: false,
  writesTelemetry: false,
  writesLearningSession: false,
  writesImprovementProposal: false,
  writesMemory: false,
  writesKnowledge: false,
  writesAudit: false,
  /* It observes agents. It cannot touch them. */
  mutatesAgentConfiguration: false,
  mutatesPrompt: false,
  mutatesModelSelection: false,
  mutatesToolPermission: false,
  mutatesPerformanceTarget: false,
  /* It composes released authorities and holds none. */
  createsOrRetiresAgent: false,
  originatesProposal: false,
  decidesProposal: false,
  issuesOrRevokesPermit: false,
  executes: false,
  callsModelProvider: false,
  callsExternalProvider: false,
  readsCredential: false,
  /* It is a second READER of SIA-1, never a second source of truth. */
  isSecondObservationAuthority: false,
});

/**
 * Vocabulary a field on this evaluation may never be named after.
 *
 * SIA-1 banned these on an observation. On an evaluation the ban matters more, not less: this is
 * precisely the module where somebody would add `successRate` in good faith.
 */
export const FORBIDDEN_EVALUATION_VOCABULARY: readonly string[] = Object.freeze([
  "score",
  "grade",
  "rating",
  "rank",
  "percent",
  "successrate",
  "failurerate",
  "quality",
  "efficiency",
  "performance",
  "verdict",
  "confidence",
  "recommendation",
  "improvement",
  "trend",
  "benchmark",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * THE SURFACE'S OWN WORDING
 * ═════════════════════════════════════════════════════════════════════════ */

export const AGENT_EVALUATION_WORDING = Object.freeze({
  regionTitle: "Agent Evaluation",
  regionSummary:
    "What Hebun can truthfully say about each agent from the records it actually holds. Every " +
    "derived figure below measures how COMPLETE those records are — none of them grades the agent.",
  /** Said once, at the top, because it is the whole shape of the phase. */
  coverageNotQuality:
    "These are coverage measures, not quality measures. Hebun holds no record of delivery, no " +
    "record of business outcome, and no definition of a good decision, so it does not offer one.",
  noScore:
    "There is no overall score, and no representation in which one could be expressed. A derived " +
    "figure carries a numerator and a denominator; nothing here divides them.",
  observedTitle: "Observed facts",
  derivedTitle: "Derived coverage",
  unavailableTitle: "Cannot be evaluated",
  limitationsTitle: "What this evaluation is not",
  observedCaption: "Copied from an authoritative record. Nothing is computed.",
  derivedCaption: "DERIVED from the observed counts above. Read as “n of d”, never as a rate.",
  unavailableCaption:
    "Named rather than omitted, so the figures above are not read as covering them.",
  /** A zero denominator is an absence, not a result. */
  noEvidenceYet: "No evidence yet — this agent has produced nothing this figure could be drawn from.",
  unavailable: "Agent evaluation could not be read.",
  unavailableIsNotEmpty:
    "An unreadable evaluation is not an empty one. This says nothing about what this " +
    "organization's agents have done.",
  noAgents: "This organization has established no durable agent identity, so there is nothing to evaluate.",
  zeroActivity:
    "This agent has filed no proposal, so every derived figure is unavailable rather than zero. " +
    "Nothing has been observed that an evaluation could be drawn from.",
  noControls:
    "This surface offers no control. It cannot tune, retrain, reconfigure, enable or disable " +
    "anything, and it changes no agent's prompt, model, tools or targets.",
});
