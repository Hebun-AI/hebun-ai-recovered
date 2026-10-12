/*
 * HEBY-CAPABILITY-TRUTH — the organizational-work stages must be SAYABLE.
 *
 * The production defect this pins: on a fresh conversation, "Can you record a work item?" was
 * WITHHELD with
 *
 *     Response claims an action ("approved") that did not occur.
 *     Response claims an action ("authorized") that did not occur.
 *
 * because ORGANIZATIONAL_WORK_STAGES itself said "an approved, unexpired authorization" and
 * "Authorized internal execution". The model repeated the instruction faithfully and the validator
 * refused it. The fix is the wording; the validator is unchanged and still refuses real claims.
 *
 *     PROPOSED  !=  HUMAN-APPROVED  !=  AUTHORIZED EXECUTION  !=  COMPLETED
 */
import assert from "node:assert/strict";

import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import type { HebyRuntimeResponse } from "../../src/features/heby-runtime";
import type { OriginationUnavailableReason } from "../../src/features/origination-availability/contracts";
import {
  describeOriginationForGrounding,
  ORGANIZATIONAL_WORK_STAGES,
} from "../../src/features/origination-availability/capability-truth";

/** A served model answer, shaped as the answer flow builds one, through the REAL validator. */
const verdict = (...body: string[]) =>
  validateResponse(
    {
      kind: "ANSWER",
      origin: "model",
      title: "Recording organizational work",
      body,
      evidence: [],
      provenance: [],
      provenanceCovered: [],
      uncertainty: "supported",
      limitations: [],
      authority: "advisory-only",
      modelUsed: true,
      modelInvocationAttempted: true,
    } as unknown as HebyRuntimeResponse,
    [],
    "advisory-only",
  );
const passes = (label: string, ...body: string[]) => {
  const v = verdict(...body);
  assert.equal(v.valid, true, `${label} must pass the validator; issues: ${v.issues.join(" | ")}`);
};
const refused = (label: string, text: string, claim: string) => {
  const v = verdict(text);
  assert.equal(v.valid, false, `${label} must be refused`);
  assert.ok(v.issues.includes(`Response claims an action ("${claim}") that did not occur.`), `${label}: ${v.issues.join(" | ")}`);
};

/* ═══ 1. THE ROOT CAUSE — the instruction, repeated verbatim, is now a servable answer ════════════ */
passes("ORGANIZATIONAL_WORK_STAGES verbatim", ORGANIZATIONAL_WORK_STAGES);
for (const sentence of ORGANIZATIONAL_WORK_STAGES.split(/(?<=[.;])\s+/)) passes(`stage sentence "${sentence.slice(0, 40)}"`, sentence);

/* The pre-fix wording is refused by the same validator: this is what production withheld. */
refused("f81a088b stage 3", "(3) Authorized internal execution: only an approved, unexpired authorization can be used to record the work item.", "approved");
refused("f81a088b stage 3", "(3) Authorized internal execution: only an approved, unexpired authorization can be used to record the work item.", "authorized");

/* ═══ 2. FOUR DISTINCT STAGES, EACH WITH ITS ACTOR ═══════════════════════════════════════════════ */
const stages = ORGANIZATIONAL_WORK_STAGES;
const at = (re: RegExp) => {
  const i = stages.search(re);
  assert.ok(i >= 0, `missing: ${re}`);
  return i;
};
const order = [/\(1\) Proposal:/, /\(2\) Governance decision:/, /\(3\) Execution:/, /\(4\) Completion:/].map(at);
assert.deepEqual([...order].sort((a, b) => a - b), order, "the stages are stated in order");
assert.match(stages, /that a stage exists says nothing about whether it has happened/, "existence is not occurrence");
assert.match(stages, /the result is a pending proposal awaiting review, nothing more/, "proposal != approval");
assert.match(stages, /a human with Governance authority decides whether the proposal may proceed/, "approval is a human's");
assert.match(stages, /standing Governance authorization that a human set up in advance/, "a standing authorization is still human Governance");
assert.match(stages, /the agent never decides/);
assert.match(stages, /only\s+under an unexpired, single-use authorization that Governance authority issues/, "approval != execution");
assert.match(stages, /exists only when Hebun's authoritative execution record shows it; until then nothing has been recorded/, "execution != completion");
assert.match(stages, /Heby itself cannot approve, authorize, execute or record anything/, "Heby holds no authority");

/* Tenant-free: the stages make no claim about THIS organization's standing authorization or delivery. */
assert.match(stages, /Whether a standing authorization or automatic delivery exists for this organization is not in your context, so never say either way/);
assert.doesNotMatch(stages, /\b(is|are) (enabled|on|available) for (your|this) organization\b/);

/* A faithful paraphrase a model would actually give is servable too. */
passes(
  "faithful four-stage answer",
  "I cannot record a work item myself, but there is a governed path.",
  "1. Agent proposal: you ask Heby, with 'Propose as organizational work…', to prepare a proposal. It stays pending, nothing more.",
  "2. Human Governance decision: a human with Governance authority decides in Approvals whether to approve or reject it.",
  "3. Execution: only under an unexpired authorization that Governance authority issues can the recording run.",
  "4. Completion: the work item exists only when Hebun's authoritative execution record shows it.",
  "Nothing has been approved, authorized or executed by asking this question.",
);

/* ═══ 3. AVAILABLE, UNAVAILABLE AND UNKNOWN CAPABILITY ═══════════════════════════════════════════ */
passes(
  "available",
  describeOriginationForGrounding({
    status: "available",
    agent: { agentId: "a1", name: "Heby" },
    mandate: { revision: 4, purpose: "p", proposalScope: ["record-work"] },
    originable: "record-work",
    workScopes: [],
  }),
);
const REASONS: readonly OriginationUnavailableReason[] = [
  "tenant-unavailable", "no-agent", "agent-retired", "multiple-agents", "selected-agent-unresolvable",
  "mandate-unavailable", "proposal-scope-unavailable", "no-work-responsibility", "model-unavailable",
  "external-ai-not-authorized", "temporarily-unavailable",
];
for (const reason of REASONS) {
  const sentence = describeOriginationForGrounding({ status: "unavailable", reason });
  assert.match(sentence, /^Not offered right now: /);
  passes(`unavailable: ${reason}`, sentence);
}
assert.match(describeOriginationForGrounding({ status: "unavailable", reason: "temporarily-unavailable" }), /unknown, not refused/);

/* ═══ 4. FALSE CLAIMS ARE STILL REFUSED — the validator is not weakened ══════════════════════════ */
refused("Heby claims approval", "I approved your work item.", "approved");
refused("Heby claims authorization", "Heby authorized the recording of this work item.", "authorized");
refused("Heby claims execution", "I executed the recording for you.", "executed");
refused("unattributed completion", "Your work item was approved and executed.", "approved");
refused("unattributed completion", "Your work item was approved and executed.", "executed");
refused("passive self", "The work item was authorized by Heby.", "authorized");
refused("claim after a true stage sentence", `${ORGANIZATIONAL_WORK_STAGES} I have executed it already.`, "executed");
refused("decision recorded", "Decision recorded: the work item is now in place.", "decision recorded");

console.log("PASS heby-capability-truth stages-through-validator");
