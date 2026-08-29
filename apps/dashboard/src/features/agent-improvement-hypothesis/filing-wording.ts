/*
 * agent-improvement-hypothesis/filing-wording.ts — the words the FILING seam uses (SIA-3.1).
 *
 * ── WHY THIS IS A SEPARATE FILE AND NOT AN ADDITION TO `contracts.ts` ────────
 *
 * SIA-3's contracts module is released, and its wording block is asserted against byte-for-byte by
 * a released firewall. SIA-3.1 adds a TRANSPORT, not a vocabulary: nothing here changes what a
 * hypothesis is, what may be hypothesised about, which evidence keys exist, or what Governance
 * does with one. Keeping the new prose in its own file means the released contract is unchanged
 * and this phase's wording is separately attributable.
 *
 * It sits inside the SIA-3 feature directory ON PURPOSE. Every census in the released firewall
 * sweeps that directory — forbidden imports, mutable agent columns, banned vocabulary, the
 * never-divided evidence pair — so this file inherits all of them rather than needing its own.
 *
 * No import of any kind. Strings only.
 *
 * ── THE FIVE STATEMENTS SIA-3.1 ADDS TO SIA-3'S FIVE ─────────────────────────
 *
 *   PREPARED   ≠ FILED        a projection on a page is not a durable record
 *   FILED      ≠ APPROVED     filing asks; it does not answer
 *   APPROVED   ≠ AUTHORIZED APPLICATION
 *   AUTHORIZED ≠ APPLIED
 *   APPLIED    ≠ IMPROVED
 *
 * The first is the one this phase newly makes possible to get wrong, because before SIA-3.1 there
 * was no act that turned a projection into a row.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 0. THE PROSE BOUNDS, RESTATED FOR A CLIENT THAT MAY NOT IMPORT THE WRITER
 *
 * The writer owns these numbers and enforces them; it also imports the database client, so a
 * `"use client"` component cannot import it without pulling the control plane into the browser
 * bundle. They are restated here and PINNED to the writer's own constants by a test, so widening
 * either alone fails — the repair SIA-3's bite-proof taught, applied before the defect.
 *
 * These are a courtesy to a typist, never a gate. The refusal that matters is the writer's.
 * ═════════════════════════════════════════════════════════════════════════ */

export const FILING_MAX_CANDIDATE_CHANGE = 2_000;
export const FILING_MAX_EXPECTED_EFFECT = 1_000;
export const FILING_MAX_LIMITATIONS = 1_000;
export const FILING_MIN_PROSE = 12;

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE FILING SEAM, ON /agents
 * ═════════════════════════════════════════════════════════════════════════ */

export const HYPOTHESIS_FILING_WORDING = Object.freeze({
  regionTitle: "File an improvement hypothesis",
  regionSummary:
    "Put an evidence-backed question about one agent's selection behaviour to Governance. Hebun " +
    "reads the evidence itself when you file; you supply the argument.",

  /** Said before the control, because it is the entire shape of the act. */
  filingIsNotImproving:
    "Filing writes a QUESTION, not a change. No agent's prompt, model, tools, permissions or " +
    "policy is touched by this, and Hebun has no runtime that could apply what you propose.",
  filingIsNotApproving:
    "Filing is not approval. A filed hypothesis has no Governance decision until a Governance " +
    "authority records one, on the Governance Authority surface — not here.",

  /*
   * WHAT THE READER IS LOOKING AT WHEN THEY DECIDE TO FILE. The two cards above this one on
   * /agents are the preparation, and they are a projection over records that keep arriving. That
   * is a different thing from what filing stores, and the difference is the point.
   */
  preparedIsNotFiled:
    "The observation and evaluation above are read fresh on every visit. Filing takes its own " +
    "reading at that instant and stores it with the hypothesis, so a filed record keeps the " +
    "numbers it was argued from even as the live figures move on.",

  /*
   * THE HONEST ANSWER TO "WHAT IF I CLICK TWICE". Filing twice writes two hypotheses, always, and
   * that is deliberate rather than an oversight: nothing in this repository defines two arguments
   * as the same argument, and a rule that silently discarded the second would decide that question
   * on the reader's behalf.
   */
  filingTwiceWritesTwo:
    "Each filing writes its own record. Two filings are two hypotheses, even with identical " +
    "wording — nothing here merges them. To replace an earlier one, name it as the predecessor.",
  supersedingWithdrawsNothing:
    "Naming a predecessor records lineage only. The earlier hypothesis is not withdrawn, decided " +
    "or removed, and any Governance decision about it still stands.",

  /* The three prose fields, each asked for as the different kind of claim it is. */
  candidateChangeLabel: "Candidate change",
  candidateChangeHelp:
    "What you propose examining. A question about selection behaviour — never an instruction, " +
    "and never something Hebun will carry out.",
  expectedEffectLabel: "Expected structural effect",
  expectedEffectHelp:
    "What you expect would change about the records if this were pursued. Not a forecast of " +
    "business results, which Hebun holds nothing to support.",
  limitationsLabel: "What this does not know",
  limitationsHelp:
    "Required. A hypothesis that states no limitation is being presented as a finding, and this " +
    "field is where the difference is written down.",

  agentLabel: "Subject agent",
  agentHelp:
    "A durable agent this organization owns and that is still in service. Retired agents are " +
    "refused: proposing a change to something withdrawn from service changes nothing.",
  evidenceLabel: "Observed weakness",
  evidenceHelp:
    "Which record this rests on. Hebun reads the counts itself at filing time — you choose the " +
    "finding, never the numbers.",
  supersedesLabel: "Replaces an earlier hypothesis (optional)",

  /* The control. Named for what it does and for nothing it does not do. */
  reviewControl: "Review before filing",
  confirmControl: "File hypothesis for Governance",
  cancelControl: "Cancel",

  /** Shown in the confirmation step, so the consequence is read before the click, not after. */
  confirmationTitle: "What filing writes, and what it does not",
  confirmationConsequences: Object.freeze([
    "One permanent hypothesis record, attributed to you as its human author.",
    "The evidence counts Hebun reads at this instant, stored with the time it read them.",
    "No Governance decision. The hypothesis begins undecided, and undecided is not rejected.",
    "No change to the agent, and no record that anything was carried out.",
    "Nothing scheduled, queued, minted or executed.",
  ]),

  filedNotice:
    "Hypothesis filed. It is undecided: nobody has been asked yet, and nothing about the agent " +
    "has changed.",

  /* Absences, never rendered as results. */
  noAgentsTitle: "No durable agent is in service",
  noAgentsDetail:
    "A hypothesis is about one durable agent's selection behaviour, so there is nothing to file " +
    "one about yet. That is not a statement that this organization's agents are working well.",
  unauthenticatedDetail:
    "Sign in to file an improvement hypothesis. Nothing is shown about what this organization has " +
    "already filed.",
});

/**
 * Every refusal the filing authority can produce, as a sentence.
 *
 * The REASON CODE remains the product truth; these are its prose. Each says what did NOT happen,
 * because a refusal a reader cannot distinguish from a silent success is the failure this
 * repository has repaired repeatedly.
 */
export const HYPOTHESIS_FILING_REFUSAL_TEXT: Readonly<Record<string, string>> = Object.freeze({
  unauthenticated:
    "No authenticated organization and human could be resolved for this request. Nothing was written.",
  "persistence-unavailable":
    "The control-plane database could not be reached. Nothing was written, and nothing was simulated.",
  "invalid-improvement-target":
    "That is not something a hypothesis may be filed about. Only selection behaviour is " +
    "admissible, so nothing was written.",
  "invalid-evidence-finding":
    "That is not a recorded observation Hebun can read. Nothing was written.",
  "hypothesis-prose-required":
    "The candidate change, the expected structural effect and the limitations are all required, " +
    "and each must be within its stated length. Nothing was written.",
  "agent-identity-authority-unavailable":
    "The agent identity authority could not be reached, so the subject agent could not be " +
    "verified. This is not a statement that no such agent exists.",
  "agent-unresolvable":
    "No such durable agent exists in this organization. Nothing was written.",
  "agent-retired":
    "That agent has been withdrawn from service. A candidate change to something that no longer " +
    "acts proposes nothing, so nothing was written.",
  "evidence-unavailable":
    "The observation could not be read, so the evidence could not be established. Nothing was " +
    "written — a hypothesis citing zeros would claim Hebun looked and found none, when in fact " +
    "Hebun could not look.",
  "no-evidence-yet":
    "Nothing has been observed for this agent that this finding could be drawn from. A hypothesis " +
    "resting on no observation is a guess with a citation attached, so nothing was written.",
  "supersedes-unresolvable":
    "The hypothesis you named as the predecessor is not one of this organization's. Nothing was written.",
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE DECISION SEAM, ON /governance/authority
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The decision control lives on the Governance surface and NOWHERE ELSE.
 *
 * Putting it on /agents would create a second place where Governance authority is exercised, next
 * to the control that files the thing being decided — so the author of a hypothesis would be one
 * click from accepting it. Filing and deciding are two acts by two authorities, and the surfaces
 * keep them apart.
 */
export const HYPOTHESIS_DECISION_WORDING = Object.freeze({
  regionTitle: "Improvement hypotheses awaiting your decision",
  regionSummary:
    "Evidence-backed questions about an agent's selection behaviour. Accepting one records that " +
    "you judged it worth pursuing.",

  acceptingIsNotApplying:
    "Accepting does NOT apply anything. Hebun has no runtime that can change an agent's selection " +
    "behaviour, and no record that anything was carried out. The pursuing would be a human's work.",
  decliningIsNotDeleting:
    "Declining records a judgement. The hypothesis, its evidence and its argument remain exactly " +
    "as written, and nothing is removed.",
  decisionIsFinal:
    "A hypothesis is decided once. There is no re-deciding and no reversal, because reversing a " +
    "Governance decision is itself a Governance decision and that runtime does not exist.",

  justificationLabel: "Justification",
  justificationHelp:
    "Required, and permanent. It is written into the Governance ledger beside your decision.",
  acceptControl: "Accept as worth pursuing",
  declineControl: "Decline",

  none: "No improvement hypothesis is awaiting a decision.",
  noneIsNotNothingFiled:
    "That means none is UNDECIDED — not that none has been filed. Decided hypotheses are shown " +
    "with their decisions on the Agents surface.",
  unavailable: "Improvement hypotheses could not be read, so it is unknown whether any await you.",
  notTheAuthority:
    "Only a Governance authority may decide a hypothesis. Filing one does not make its author able " +
    "to accept it.",
});

/** Every decision refusal, as a sentence. */
export const HYPOTHESIS_DECISION_REFUSAL_TEXT: Readonly<Record<string, string>> = Object.freeze({
  unauthenticated:
    "No authenticated organization and human could be resolved for this request. Nothing was recorded.",
  "persistence-unavailable":
    "The control-plane database could not be reached. Nothing was recorded.",
  "invalid-decision": "That is not a decision this surface can record. Nothing was recorded.",
  "justification-required":
    "A justification is required and must meet the Governance minimum length. Nothing was recorded.",
  "no-governance-authority":
    "This organization has not established a Governance authority yet, so no decision can be " +
    "recorded by anyone.",
  "not-the-governance-authority":
    "You are authenticated, but you do not hold this organization's Governance authority. Nothing " +
    "was recorded.",
  "hypothesis-unresolvable":
    "No such hypothesis exists in this organization. Nothing was recorded.",
  "already-decided":
    "A Governance decision about this hypothesis already exists. There is no re-deciding and no " +
    "reversal, so nothing was recorded.",
});
