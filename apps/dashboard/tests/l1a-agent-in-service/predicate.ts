/*
 * L-1a — the one "in service" rule, as a value. No database.
 *
 * The rule is an allowlist: retired_at NULL, suspended_at NULL, lifecycle NULL or 'active'. Every
 * other lifecycle value the enum carries — none of which has a writer today — is OUT of service, and
 * a fact that was never read (undefined) is not mistaken for an absent one.
 */
import assert from "node:assert/strict";
import {
  IN_SERVICE_AGENT_LIFECYCLE_STATUS,
  isAgentInService,
} from "../../src/features/agent-identity/in-service";

const at = new Date("2026-10-08T00:00:00Z");

assert.equal(IN_SERVICE_AGENT_LIFECYCLE_STATUS, "active");

/* In service: every registered identity so far (NULL lifecycle), and an explicit 'active'. */
assert.equal(isAgentInService({ retiredAt: null, suspendedAt: null, lifecycle: null }), true, "NULL lifecycle is in service");
assert.equal(isAgentInService({ retiredAt: null, suspendedAt: null, lifecycle: "active" }), true, "'active' is in service");

/* Out of service: the two timestamps, each alone. */
assert.equal(isAgentInService({ retiredAt: at, suspendedAt: null, lifecycle: null }), false, "retired_at set");
assert.equal(isAgentInService({ retiredAt: null, suspendedAt: at, lifecycle: null }), false, "suspended_at set");
assert.equal(isAgentInService({ retiredAt: null, suspendedAt: at, lifecycle: "active" }), false, "suspended_at beats 'active'");
assert.equal(isAgentInService({ retiredAt: at.toISOString(), suspendedAt: null, lifecycle: null }), false, "ISO string stamp");

/* Out of service: every enum value other than 'active', including the ones the old rule let through. */
for (const lifecycle of ["created", "configured", "training", "busy", "idle", "paused", "suspended", "replaced", "retired", "archived"]) {
  assert.equal(
    isAgentInService({ retiredAt: null, suspendedAt: null, lifecycle }),
    false,
    `lifecycle '${lifecycle}' is not in service`,
  );
}
/* A value the enum might gain later is out of service until a phase says otherwise. */
assert.equal(isAgentInService({ retiredAt: null, suspendedAt: null, lifecycle: "resumed" }), false, "unknown lifecycle");

/* A fact that was not read is not an absent fact. */
const unread = { retiredAt: null, suspendedAt: undefined, lifecycle: null } as unknown as Parameters<typeof isAgentInService>[0];
assert.equal(isAgentInService(unread), false, "undefined suspendedAt is not 'not suspended'");

console.log("l1a predicate: ok");
