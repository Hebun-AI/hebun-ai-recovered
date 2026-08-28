/*
 * SELF-IMPROVING-AGENTS-2 — WHAT A DIRECTOR ACTUALLY READS.
 *
 * The firewall proves the evaluation cannot ACT and cannot GRADE. This proves what it SAYS, by
 * rendering it and reading the sentences back — because a constant pinned in a test is only half
 * the guarantee. The other half is that the surface renders it, in the right state, beside the
 * right number.
 *
 * The load-bearing assertion in this file is the negative one: no percentage, no score, and no
 * word that would let a coverage figure be read as a grade.
 *
 * Pure. Renders one component. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentEvaluationSurface } from "../../src/components/agents/agent-evaluation";
import { deriveAgentEvaluation } from "../../src/features/agent-evaluation/agent-evaluation-projection.server";
import type {
  AgentEvaluation,
  AgentEvaluationRead,
} from "../../src/features/agent-evaluation/agent-evaluation-projection.server";
import type { AgentOutcomeObservation } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import {
  AGENT_EVALUATION_WORDING,
  EVALUATION_NON_CLAIMS,
} from "../../src/features/agent-evaluation/contracts";

/** Tags stripped and entities decoded, so assertions are about sentences a person reads. */
const visible = (markup: string): string =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();

function observation(over: Partial<AgentOutcomeObservation> = {}): AgentOutcomeObservation {
  return {
    agentName: "Heby",
    inService: true,
    retiredAt: null,
    establishedAt: new Date(0).toISOString(),
    activity: { proposalsFiled: 9, pending: 3, withdrawn: 0 },
    governance: {
      approved: 5,
      rejected: 1,
      permitsIssued: 5,
      permitsActive: 1,
      permitsExpired: 0,
      permitsConsumed: 4,
      permitsRevoked: 0,
      approvedWithoutExecution: 1,
    },
    execution: { attempts: 4, pending: 0, accepted: 1, refused: 1, failed: 1, unknown: 1 },
    modelUsage: {
      linkedInvocations: 8,
      inputTokens: 211,
      outputTokens: 32,
      invocationsWithoutReportedUsage: 1,
      distribution: [
        { provider: "claude", model: "claude-test", invocations: 7 },
        { provider: "claude", model: "claude-other", invocations: 1 },
      ],
    },
    provenance: { proposalsWithInvocation: 8, proposalsWithoutInvocation: 1 },
    ...over,
  };
}

const evaluationOf = (over: Partial<AgentOutcomeObservation> = {}): AgentEvaluation =>
  deriveAgentEvaluation(observation(over));

const readState = (agents: readonly AgentEvaluation[]): AgentEvaluationRead => ({
  status: "read",
  agents,
  distributionTruncated: false,
});

const rawOf = (evaluation: AgentEvaluationRead): string =>
  renderToStaticMarkup(createElement(AgentEvaluationSurface, { evaluation }));
const render = (evaluation: AgentEvaluationRead): string => visible(rawOf(evaluation));

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. NO PERCENTAGE, NO SCORE, NO GRADE — ON THE RENDERED PAGE
 *
 * The strongest guarantee in the phase, asserted against the markup a browser receives rather than
 * against the projection that feeds it.
 * ────────────────────────────────────────────────────────────────────────── */
function nothingIsGraded(): void {
  const raw = rawOf(readState([evaluationOf()]));
  const text = visible(raw);

  assert.ok(!raw.includes("%"), "the rendered evaluation contains no percent sign");

  /*
   * A GRADING CLAIM, NOT THE WORD.
   *
   * The first version of this banned the substring "score" and failed — on the page's own sentence
   * "There is no overall score, and no representation in which one could be expressed". A guard
   * that fires on the product's honest denial is measuring the wrong thing, and this repository has
   * paid for that mistake before. What makes a grade is a grading word ATTACHED TO A NUMBER, so
   * that is what is forbidden here; the denial is left free to say what it means.
   */
  const GRADE_BEFORE_NUMBER = /\b(score|grade|rating|rank|rate)\b[^.]{0,24}?\d/i;
  const NUMBER_BEFORE_GRADE = /\d[^.]{0,24}?\b(score|grade|rating|out of|\/\s*100)\b/i;
  assert.ok(!GRADE_BEFORE_NUMBER.test(text), "no grading word is attached to a number");
  assert.ok(!NUMBER_BEFORE_GRADE.test(text), "and no number is attached to a grading word");

  /*
   * "success rate" fell to the same trap on the next run: the page says "NOT a success rate" about
   * the one figure most likely to be mistaken for one. It is covered by the numeric-adjacency rule
   * above — a real `Success rate: 92` matches `\brate\b...\d` — so only the unambiguous grading
   * FORMS are banned flatly here.
   */
  for (const banned of ["out of 100", "/100", "Grade:", "Score:", "Rating:"]) {
    assert.ok(!text.includes(banned), `the rendered evaluation must not contain "${banned}"`);
  }

  /* THE DENIALS THEMSELVES MUST SURVIVE — they are the point, not a leak. */
  assert.ok(
    text.includes(AGENT_EVALUATION_WORDING.noScore),
    "the page states plainly that no score exists",
  );
  assert.ok(
    /NOT a success rate/i.test(text),
    "and that the resolution figure is not a success rate",
  );

  /* A derived figure is rendered as "n of d" — the fact without the grade. */
  assert.ok(/\b6 of 9\b/.test(text), "decision coverage renders as a numerator of a denominator");
  assert.ok(/\b3 of 4\b/.test(text), "execution resolution renders the same way");
  assert.ok(/\b8 of 9\b/.test(text), "provenance coverage renders the same way");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. THE THREE KINDS ARE VISIBLY THREE
 * ────────────────────────────────────────────────────────────────────────── */
function threeKindsStayThree(): void {
  const text = render(readState([evaluationOf()]));

  for (const heading of [
    AGENT_EVALUATION_WORDING.observedTitle,
    AGENT_EVALUATION_WORDING.derivedTitle,
    AGENT_EVALUATION_WORDING.unavailableTitle,
  ]) {
    assert.ok(text.includes(heading), `the surface renders the "${heading}" group`);
  }
  for (const caption of [
    AGENT_EVALUATION_WORDING.observedCaption,
    AGENT_EVALUATION_WORDING.unavailableCaption,
  ]) {
    assert.ok(text.includes(caption), "and each group says what kind of thing it holds");
  }

  /* Every derived figure is LABELLED derived, beside the number, not only in a caption. */
  const derivedBadges = (rawOf(readState([evaluationOf()])).match(/>derived</g) ?? []).length;
  assert.equal(derivedBadges, evaluationOf().derived.length, "every derived metric is badged");

  /* The framing sentence is on the page, not just in the constants file. */
  assert.ok(text.includes(AGENT_EVALUATION_WORDING.coverageNotQuality));
  assert.ok(text.includes(AGENT_EVALUATION_WORDING.noScore));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. EXECUTION RESOLUTION IS NEVER PRESENTED AS SUCCESS
 * ────────────────────────────────────────────────────────────────────────── */
function resolutionIsNotSuccess(): void {
  const text = render(readState([evaluationOf()]));

  assert.ok(
    /Failed and refused attempts are in the numerator/i.test(text),
    "the page states that failures count toward the resolution figure",
  );
  assert.ok(
    /NOT a success rate/i.test(text),
    "and says explicitly that it is not a success rate",
  );
  assert.ok(
    /Unknown is not failed/i.test(text),
    "and that unknown is not a failure",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. THE UNANSWERABLE DIMENSIONS ARE ON THE PAGE
 * ────────────────────────────────────────────────────────────────────────── */
function unavailableIsVisible(): void {
  const text = render(readState([evaluationOf()]));

  for (const label of [
    "Delivery confirmation",
    "Business outcome",
    "Decision quality",
    "Efficiency",
    "Performance against target",
    "Change over time",
    "Correctness",
  ]) {
    assert.ok(text.includes(label), `the page names "${label}" as unanswerable`);
  }
  assert.ok(
    /no-authoritative-record/.test(text),
    "and carries the closed reason beside it",
  );
  assert.ok(
    /nothing has ever written it/i.test(text),
    "the performance-target explanation states the measured fact",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. A ZERO-EVIDENCE AGENT SAYS SO — IT DOES NOT RENDER "0 of 0"
 * ────────────────────────────────────────────────────────────────────────── */
function zeroEvidenceReadsAsAbsence(): void {
  const empty = evaluationOf({
    activity: { proposalsFiled: 0, pending: 0, withdrawn: 0 },
    governance: {
      approved: 0,
      rejected: 0,
      permitsIssued: 0,
      permitsActive: 0,
      permitsExpired: 0,
      permitsConsumed: 0,
      permitsRevoked: 0,
      approvedWithoutExecution: 0,
    },
    execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
    modelUsage: {
      linkedInvocations: 0,
      inputTokens: 0,
      outputTokens: 0,
      invocationsWithoutReportedUsage: 0,
      distribution: [],
    },
    provenance: { proposalsWithInvocation: 0, proposalsWithoutInvocation: 0 },
  });
  const text = render(readState([empty]));

  assert.ok(text.includes(AGENT_EVALUATION_WORDING.zeroActivity), "it says there is no evidence");
  assert.ok(
    text.includes(AGENT_EVALUATION_WORDING.noEvidenceYet),
    "and each derived figure says so where its number would be",
  );
  assert.ok(!/\b0 of 0\b/.test(text), "and never renders 0 of 0 — an absence is not a finding");
  assert.ok(text.includes("Heby"), "the agent is still shown");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. UNREADABLE IS NOT EMPTY
 * ────────────────────────────────────────────────────────────────────────── */
function unreadableIsNotEmpty(): void {
  const text = render({ status: "unavailable", reason: "read-failed" });
  assert.ok(text.includes(AGENT_EVALUATION_WORDING.unavailable), "an unreadable evaluation says so");
  assert.ok(
    text.includes(AGENT_EVALUATION_WORDING.unavailableIsNotEmpty),
    "and refuses to be read as an organization with no agents",
  );
  assert.ok(text.includes("read-failed"), "and names the reason");
  assert.ok(
    !text.includes(AGENT_EVALUATION_WORDING.noAgents),
    "and never says the organization has no agent",
  );

  const none = render(readState([]));
  assert.ok(none.includes(AGENT_EVALUATION_WORDING.noAgents), "no agents says so plainly");
  assert.ok(!none.includes(AGENT_EVALUATION_WORDING.unavailable), "and is not dressed as a failure");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. THE LIMITATIONS ARE RENDERED, AND SO IS THE ABSENCE OF CONTROLS
 * ────────────────────────────────────────────────────────────────────────── */
function limitationsAreRendered(): void {
  const raw = rawOf(readState([evaluationOf()]));
  const text = visible(raw);

  for (const claim of EVALUATION_NON_CLAIMS) {
    assert.ok(text.includes(claim), `the page carries the invariant "${claim}"`);
  }
  assert.ok(text.includes(AGENT_EVALUATION_WORDING.noControls), "and says it offers no control");

  for (const control of ["<button", "<form", "<input", "<select", "<textarea", "onclick"]) {
    assert.ok(!raw.toLowerCase().includes(control), `the markup contains no "${control}"`);
  }

  /* NO RAW IDENTIFIER CROSSES TO THE BROWSER — SIA-1's minimization, unchanged. */
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(raw),
    "no identifier is shipped to the browser",
  );
}

function main(): void {
  nothingIsGraded();
  threeKindsStayThree();
  resolutionIsNotSuccess();
  unavailableIsVisible();
  zeroEvidenceReadsAsAbsence();
  unreadableIsNotEmpty();
  limitationsAreRendered();

  console.log("sia2-agent-evaluation/surface-rendering: OK");
}

main();
