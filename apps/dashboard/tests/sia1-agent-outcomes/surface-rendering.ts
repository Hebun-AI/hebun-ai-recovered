/*
 * SELF-IMPROVING-AGENTS-1 — WHAT A DIRECTOR ACTUALLY READS.
 *
 * The firewall proves the observation cannot ACT. This proves what it SAYS, by rendering it and
 * reading the sentences back — because a wording constant pinned in a test is only half the
 * guarantee. The other half is that the surface renders it, in the right state, next to the right
 * number.
 *
 * ── WHY ASSERTIONS ARE OVER STRIPPED TEXT ────────────────────────────────────
 *
 * Tags are removed before asserting, so every claim below is about a sentence a person reads, not
 * about markup that happens to contain a word. A guard that matched class names would pass on a
 * page that said the opposite.
 *
 * Pure. Renders one component. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentOutcomeObservationSurface } from "../../src/components/agents/agent-outcome-observation";
import type {
  AgentOutcomeObservation,
  AgentOutcomeObservationRead,
} from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import {
  AGENT_OUTCOME_STAGES,
  AGENT_OUTCOME_WORDING,
  PROVENANCE_COVERAGE_WORDING,
} from "../../src/features/agent-outcome-observation/contracts";

/**
 * What a person actually reads.
 *
 * Tags stripped so assertions are about sentences, not markup — and entities DECODED, because React
 * escapes an apostrophe to `&#x27;` on the way out. A reader sees the apostrophe; a test that
 * matched the escape would be asserting about the encoder rather than about the sentence.
 */
const visible = (markup: string): string =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const agent = (over: Partial<AgentOutcomeObservation> = {}): AgentOutcomeObservation => ({
  agentName: "Heby",
  inService: true,
  retiredAt: null,
  establishedAt: new Date(1_700_000_000_000).toISOString(),
  activity: { proposalsFiled: 6, pending: 2, withdrawn: 0 },
  governance: {
    approved: 4,
    rejected: 0,
    permitsIssued: 4,
    permitsActive: 1,
    permitsExpired: 0,
    permitsConsumed: 3,
    permitsRevoked: 0,
    approvedWithoutExecution: 1,
  },
  execution: { attempts: 3, pending: 0, accepted: 1, refused: 0, failed: 1, unknown: 1 },
  modelUsage: {
    linkedInvocations: 5,
    inputTokens: 191,
    outputTokens: 26,
    invocationsWithoutReportedUsage: 0,
    distribution: [{ provider: "claude", model: "claude-test", invocations: 5 }],
  },
  selection: {
    attributed: 0,
    registered: 0,
    notDispatched: 0,
    dispatchFailed: 0,
    selectionInvalid: 0,
    noAction: 0,
    selectionValid: 0,
    filingNotAttempted: 0,
    filingProposed: 0,
    filingRefused: 0,
    filingFailed: 0,
  },
  provenance: { proposalsWithInvocation: 5, proposalsWithoutInvocation: 1 },
  ...over,
});

const readState = (
  agents: readonly AgentOutcomeObservation[],
  over: Partial<Extract<AgentOutcomeObservationRead, { status: "read" }>> = {},
): AgentOutcomeObservationRead => ({
  status: "read",
  agents,
  unattributedInvocations: 1,
  unresolvedAgentProposals: 0,
  historicallyUnattributedInvocations: 0,
  attributionConflicts: 0,
  distributionTruncated: false,
  distributionLimit: 50,
  ...over,
});

const render = (observation: AgentOutcomeObservationRead): string =>
  visible(renderToStaticMarkup(createElement(AgentOutcomeObservationSurface, { observation })));

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. UNREADABLE IS NOT EMPTY, AND EMPTY IS NOT UNREADABLE
 * ────────────────────────────────────────────────────────────────────────── */
function threeStatesStayThree(): void {
  const unavailable = render({ status: "unavailable", reason: "read-failed" });
  assert.ok(
    unavailable.includes(AGENT_OUTCOME_WORDING.unavailable),
    "an unreadable observation says so",
  );
  assert.ok(
    unavailable.includes(AGENT_OUTCOME_WORDING.unavailableIsNotEmpty),
    "and refuses to be read as an organization with no agents",
  );
  assert.ok(unavailable.includes("read-failed"), "and names the reason it could not read");
  assert.ok(
    !unavailable.includes(AGENT_OUTCOME_WORDING.noAgents),
    "an unreadable observation must never say the organization has no agent",
  );

  const noAgents = render(readState([], { unattributedInvocations: 0 }));
  assert.ok(noAgents.includes(AGENT_OUTCOME_WORDING.noAgents), "no durable agent says so plainly");
  assert.ok(
    !noAgents.includes(AGENT_OUTCOME_WORDING.unavailable),
    "and is not dressed as a failure",
  );

  const zero = render(
    readState([
      agent({
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
        selection: {
          attributed: 0,
          registered: 0,
          notDispatched: 0,
          dispatchFailed: 0,
          selectionInvalid: 0,
          noAction: 0,
          selectionValid: 0,
          filingNotAttempted: 0,
          filingProposed: 0,
          filingRefused: 0,
          filingFailed: 0,
        },
        provenance: { proposalsWithInvocation: 0, proposalsWithoutInvocation: 0 },
      }),
    ]),
  );
  assert.ok(zero.includes("Heby"), "a silent agent is still shown");
  assert.ok(
    zero.includes(AGENT_OUTCOME_WORDING.zeroActivity),
    "and is described in words rather than rendered as a blank",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. THE SEVEN STAGES ARE RENDERED AS SEVEN, EACH WITH ITS REFUSAL
 * ────────────────────────────────────────────────────────────────────────── */
function sevenStagesAreVisible(): void {
  const markup = render(readState([agent()]));

  for (const stage of AGENT_OUTCOME_STAGES) {
    assert.ok(markup.includes(stage), `the ladder names ${stage}`);
  }

  /* The four semantic pins are on the page, not merely in a constant file. */
  assert.ok(
    /accepted is not delivered/i.test(markup),
    "the page states that accepted is not delivered",
  );
  assert.ok(
    /approved is not executed/i.test(markup),
    "the page states that approved is not executed",
  );
  assert.ok(
    /a permit is not an execution/i.test(markup),
    "the page states that a permit is not an execution",
  );
  assert.ok(
    /not proof that no model was used/i.test(markup),
    "the page states that missing provenance is not proof a model was unused",
  );
  assert.ok(
    /not proof that the proposal was deterministic/i.test(markup),
    "the page states that missing provenance is not proof of determinism",
  );

  /* And the counts appear under headings that keep the stages apart. */
  for (const heading of [
    AGENT_OUTCOME_WORDING.activityTitle,
    AGENT_OUTCOME_WORDING.governanceTitle,
    AGENT_OUTCOME_WORDING.executionTitle,
    AGENT_OUTCOME_WORDING.modelUsageTitle,
    AGENT_OUTCOME_WORDING.provenanceTitle,
  ]) {
    assert.ok(markup.includes(heading), `the hierarchy renders "${heading}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. UNKNOWN IS RENDERED AS UNKNOWN — NEVER SUMMED INTO FAILURE
 * ────────────────────────────────────────────────────────────────────────── */
function unknownIsNotFailure(): void {
  const markup = render(readState([agent()]));
  assert.ok(markup.includes("Unknown"), "the unknown outcome has its own figure");
  assert.ok(markup.includes("Failed"), "and failure has its own");
  assert.ok(
    /the answer was lost/i.test(markup),
    "and unknown is explained as a lost answer, not as a failure",
  );
  assert.ok(
    /Do not retry blindly|invites a double send|may already have happened/i.test(markup),
    "and the page says why reading it as a failure is dangerous",
  );

  /* The dangerous collapse would be a single 'errors' figure. It is not on the page. */
  for (const collapsed of ["Errors", "Failures", "Success rate", "Completed"]) {
    assert.ok(!markup.includes(collapsed), `the page must not render a collapsed "${collapsed}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. THE APPROVAL GAP IS STATED, NOT LEFT TO ARITHMETIC BY EYE
 * ────────────────────────────────────────────────────────────────────────── */
function approvalGapIsRendered(): void {
  const markup = render(readState([agent()]));
  assert.ok(
    markup.includes("Authorized, never executed"),
    "the page names the approved-but-unexecuted gap as its own figure",
  );
  assert.ok(markup.includes("Permitted"), "and permits are their own stage, not folded into execution");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. PROVENANCE: THE GAP IS SHOWN, AND EXPLAINED ONLY WHEN THERE IS ONE
 * ────────────────────────────────────────────────────────────────────────── */
function provenanceIsHonest(): void {
  const withGap = render(readState([agent()]));
  assert.ok(
    withGap.includes("Transport not durably proven"),
    "an unproven proposal is labelled with the phase's own words",
  );
  assert.ok(
    withGap.includes(PROVENANCE_COVERAGE_WORDING.unprovenIsNotAbsence),
    "and the two forbidden readings are spelled out",
  );
  assert.ok(
    withGap.includes(PROVENANCE_COVERAGE_WORDING.neverBackfilled),
    "and the page says the gap is never reconstructed",
  );

  const noGap = render(
    readState([agent({ provenance: { proposalsWithInvocation: 5, proposalsWithoutInvocation: 0 } })]),
  );
  assert.ok(
    !noGap.includes(PROVENANCE_COVERAGE_WORDING.unprovenIsNotAbsence),
    "an agent with full coverage is not warned about a gap it does not have",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. TOKENS ARE A LOWER BOUND, AND INVOCATIONS ARE LINKED-ONLY. BOTH SAID.
 * ────────────────────────────────────────────────────────────────────────── */
function modelUsageStatesItsLimits(): void {
  const markup = render(readState([agent()]));
  assert.ok(
    markup.includes(AGENT_OUTCOME_WORDING.tokensAreLowerBound),
    "token totals are declared a lower bound",
  );
  assert.ok(
    markup.includes(AGENT_OUTCOME_WORDING.invocationsAreLinkedOnly),
    "and the attribution boundary is stated rather than implied",
  );
  assert.ok(
    markup.includes(AGENT_OUTCOME_WORDING.unattributedInvocations),
    "and the invocations no agent owns are reported at the organization level",
  );
  assert.ok(markup.includes("claude-test"), "the recorded model is shown as recorded");

  /* A provider that reported nothing is shown as unreported, never repaired into a name. */
  const unreported = render(
    readState([
      agent({
        modelUsage: {
          linkedInvocations: 2,
          inputTokens: 0,
          outputTokens: 0,
          invocationsWithoutReportedUsage: 2,
          distribution: [{ provider: null, model: null, invocations: 2 }],
        },
      }),
    ]),
  );
  assert.ok(
    unreported.includes("provider not reported"),
    "a null provider is labelled unreported, never guessed",
  );
  assert.ok(unreported.includes("model not reported"), "and so is a null model");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. A BOUNDED BREAKDOWN SAYS IT IS BOUNDED
 * ────────────────────────────────────────────────────────────────────────── */
function truncationIsDisclosed(): void {
  const full = render(readState([agent()]));
  assert.ok(
    !full.includes(AGENT_OUTCOME_WORDING.distributionTruncated),
    "an untruncated breakdown does not claim to be truncated",
  );

  const truncated = render(readState([agent()], { distributionTruncated: true }));
  assert.ok(
    truncated.includes(AGENT_OUTCOME_WORDING.distributionTruncated),
    "a breakdown that filled its bound says so",
  );

  const unresolved = render(readState([agent()], { unresolvedAgentProposals: 3 }));
  assert.ok(
    unresolved.includes(AGENT_OUTCOME_WORDING.unresolvedActivity),
    "and proposals whose agent did not resolve are disclosed rather than dropped",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8. RETIREMENT DOES NOT ERASE THE RECORD
 * ────────────────────────────────────────────────────────────────────────── */
function retirementIsShownWithoutErasure(): void {
  const markup = render(
    readState([
      agent({ inService: false, retiredAt: new Date(1_700_000_500_000).toISOString() }),
    ]),
  );
  assert.ok(markup.includes("retired"), "a withdrawn agent is labelled retired");
  assert.ok(
    markup.includes(AGENT_OUTCOME_WORDING.retired),
    "and the page says the record of what it proposed is unaffected",
  );
  assert.ok(markup.includes("Heby"), "its name still appears — retirement does not erase authorship");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9. THE PAGE SAYS IT OFFERS NO CONTROL, AND OFFERS NONE
 * ────────────────────────────────────────────────────────────────────────── */
function noControlIsRendered(): void {
  const raw = renderToStaticMarkup(
    createElement(AgentOutcomeObservationSurface, { observation: readState([agent()]) }),
  );
  for (const control of ["<button", "<form", "<input", "<select", "<textarea", "onclick"]) {
    assert.ok(
      !raw.toLowerCase().includes(control),
      `the rendered observation must contain no "${control}"`,
    );
  }
  assert.ok(
    visible(raw).includes(AGENT_OUTCOME_WORDING.noControls),
    "and the page states that it offers none",
  );

  /* NO RAW AGENT UUID CROSSES TO THE BROWSER. APP-2's minimization, unchanged. */
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(raw),
    "no identifier is shipped to the browser — the name is the label",
  );
}

function main(): void {
  threeStatesStayThree();
  sevenStagesAreVisible();
  unknownIsNotFailure();
  approvalGapIsRendered();
  provenanceIsHonest();
  modelUsageStatesItsLimits();
  truncationIsDisclosed();
  retirementIsShownWithoutErasure();
  noControlIsRendered();

  console.log("sia1-agent-outcomes/surface-rendering: OK");
}

main();
