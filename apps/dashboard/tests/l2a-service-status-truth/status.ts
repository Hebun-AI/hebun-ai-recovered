/*
 * L-2a — service status as a value. No database.
 *
 *  1 the named cases: active, legacy NULL, suspended, retired, retired-after-suspension
 *  2 conflicting fields are `indeterminate`, never rounded to a valid status
 *  3 EXHAUSTIVE invariant: status === "in-service" exactly when isAgentInService is true
 *  4 no status other than `retired` is ever worded as retired (label and sentence)
 */
import assert from "node:assert/strict";
import { isAgentInService } from "../../src/features/agent-identity/in-service";
import {
  AGENT_SERVICE_STATUS_LABEL,
  AGENT_SERVICE_STATUSES,
  agentServiceSentence,
  agentServiceStatus,
} from "../../src/features/agent-identity/service-status";

const T = new Date("2026-10-08T12:00:00Z");
const S = (retiredAt: Date | null, suspendedAt: Date | null, lifecycle: string | null) =>
  agentServiceStatus({ retiredAt, suspendedAt, lifecycle });

/* ── 1 ── */
assert.equal(S(null, null, null), "in-service", "legacy NULL lifecycle (every registered identity) is in service");
assert.equal(S(null, null, "active"), "in-service", "explicit 'active' is in service");
assert.equal(S(null, T, "suspended"), "suspended", "suspended_at + 'suspended' is suspended");
assert.equal(S(T, null, "retired"), "retired", "retired_at + 'retired' is retired");
assert.equal(S(T, T, "retired"), "retired", "retired after a suspension is retired; suspended_at is history");

/* ── 2 ── */
const conflicts: [Date | null, Date | null, string | null, string][] = [
  [T, null, null, "retired_at without the 'retired' lifecycle"],
  [T, null, "active", "retired_at with 'active'"],
  [T, null, "suspended", "retired_at with 'suspended'"],
  [null, null, "retired", "'retired' without retired_at"],
  [null, T, null, "suspended_at without the 'suspended' lifecycle"],
  [null, T, "active", "suspended_at with 'active'"],
  [null, null, "suspended", "'suspended' without suspended_at"],
  [null, null, "paused", "a lifecycle value no writer produces"],
  [null, null, "resumed", "a lifecycle value the enum does not have"],
];
for (const [r, s, l, why] of conflicts) {
  assert.equal(S(r, s, l), "indeterminate", `${why} is indeterminate`);
}
for (const unread of [
  { retiredAt: undefined, suspendedAt: null, lifecycle: null },
  { retiredAt: null, suspendedAt: undefined, lifecycle: null },
  { retiredAt: null, suspendedAt: null, lifecycle: undefined },
]) {
  assert.equal(agentServiceStatus(unread as never), "indeterminate", "a fact that was not read is not an absent fact");
}

/* ── 3 ── */
const LIFECYCLES = [null, "created", "configured", "training", "active", "busy", "idle", "paused", "suspended", "replaced", "retired", "archived", "resumed"];
let combinations = 0;
for (const r of [null, T, T.toISOString()]) {
  for (const s of [null, T, T.toISOString()]) {
    for (const l of LIFECYCLES) {
      const facts = { retiredAt: r, suspendedAt: s, lifecycle: l };
      assert.equal(
        agentServiceStatus(facts) === "in-service",
        isAgentInService(facts),
        `invariant: ${JSON.stringify(facts)}`,
      );
      combinations += 1;
    }
  }
}
assert.equal(combinations, 117);

/* ── 4 ── */
for (const status of AGENT_SERVICE_STATUSES) {
  const label = AGENT_SERVICE_STATUS_LABEL[status];
  const sentence = agentServiceSentence(status, { retiredAt: "2026-10-01T00:00:00.000Z", suspendedAt: "2026-10-02T00:00:00.000Z" });
  if (status === "retired") {
    assert.match(label, /retired/);
    assert.match(sentence, /retired from service at 2026-10-01/);
  } else {
    assert.doesNotMatch(label, /retired/i, `${status}: the label never says retired`);
    assert.doesNotMatch(sentence, /retired/i, `${status}: the sentence never says retired`);
  }
}
assert.match(agentServiceSentence("suspended", { retiredAt: null, suspendedAt: "2026-10-02T00:00:00.000Z" }), /suspended from service since 2026-10-02.*reversible/);
assert.match(AGENT_SERVICE_STATUS_LABEL.indeterminate, /unknown/);

console.log("l2a status: ok");
