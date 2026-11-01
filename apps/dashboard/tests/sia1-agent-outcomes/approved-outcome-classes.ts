/*
 * APPROVED OUTCOME — every approved proposal lands in exactly one class, across the whole state space.
 *
 *     A SPENT PERMIT IS NOT A SUCCESS        NO ATTEMPT ROW IS NOT "NEVER EXECUTED"
 *
 * The product of every permit state, every attempt state and both answers about the work outcome,
 * checked against a table written by hand. A combination nobody listed fails here.
 */
import assert from "node:assert/strict";
import {
  APPROVED_OUTCOME_CLASSES,
  classifyApprovedOutcome,
  tallyApprovedOutcomes,
  type ApprovedOutcomeClass,
} from "../../src/features/agent-outcome-observation/contracts";

const PERMITS = [null, "active", "consumed", "revoked"] as const;

const expected = (
  permit: (typeof PERMITS)[number],
  attempt: string | null,
  proven: boolean,
): ApprovedOutcomeClass => {
  /* An attempt row speaks for itself, whatever else is true. */
  if (attempt === "accepted") return "providerAccepted";
  if (attempt === "refused" || attempt === "failed") return "failedOrRefused";
  if (attempt !== null) return "unknown";
  /* No attempt: only a spend can have done anything, and a spend proves nothing alone. */
  if (permit !== "consumed") return "notStarted";
  return proven ? "internalRecorded" : "unknown";
};

let cases = 0;
for (const permitStatus of PERMITS) {
  for (const attemptStatus of [null, "pending", "accepted", "refused", "failed", "unknown", "a-future-status"]) {
    for (const proven of [false, true]) {
      assert.equal(
        classifyApprovedOutcome({ permitStatus, attemptStatus }, proven),
        expected(permitStatus, attemptStatus, proven),
        `permit=${permitStatus} attempt=${attemptStatus} proven=${proven}`,
      );
      cases += 1;
    }
  }
}

/* The sentence this phase exists for, stated on its own. */
assert.equal(classifyApprovedOutcome({ permitStatus: "consumed", attemptStatus: null }, false), "unknown");
assert.equal(classifyApprovedOutcome({ permitStatus: "active", attemptStatus: null }, true), "notStarted", "a proof cannot start what no spend began");

/* The classes partition: the tally sums to the number of facts, for every agent, and misses none. */
const facts = [
  { agentId: "a", actionKind: "record-work", permitStatus: "consumed", handoffId: "h-proven", attemptStatus: null },
  { agentId: "a", actionKind: "record-work", permitStatus: "consumed", handoffId: "h-unproven", attemptStatus: null },
  { agentId: "a", actionKind: "record-work", permitStatus: "active", handoffId: null, attemptStatus: null },
  { agentId: "a", actionKind: "send", permitStatus: "consumed", handoffId: "h-sent", attemptStatus: "accepted" },
  { agentId: "b", actionKind: "send", permitStatus: "consumed", handoffId: "h-lost", attemptStatus: "unknown" },
  { agentId: "b", actionKind: "send", permitStatus: "consumed", handoffId: "h-failed", attemptStatus: "failed" },
];
const tally = tallyApprovedOutcomes(facts, new Set(["h-proven", "h-sent", "h-lost", "h-failed"]));
assert.deepEqual(tally.get("a"), { notStarted: 1, internalRecorded: 1, providerAccepted: 1, failedOrRefused: 0, unknown: 1 });
assert.deepEqual(tally.get("b"), { notStarted: 0, internalRecorded: 0, providerAccepted: 0, failedOrRefused: 1, unknown: 1 });
for (const [agentId, counts] of tally) {
  assert.equal(
    APPROVED_OUTCOME_CLASSES.reduce((sum, name) => sum + counts[name], 0),
    facts.filter((fact) => fact.agentId === agentId).length,
    "exactly one class per approved proposal",
  );
}

console.log(`PASS approved outcome classes: ${cases} combinations, one class each`);
