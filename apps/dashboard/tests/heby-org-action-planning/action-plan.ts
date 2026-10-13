/*
 * HEBY ORGANIZATIONAL ACTION PLANNING — the `/plan` composition and its command gate.
 *
 *     FACT != DERIVED != RECOMMENDATION != UNAVAILABLE      PLAN != PROPOSAL != APPROVAL != WORK DONE
 */
import assert from "node:assert/strict";
import {
  composeActionPlan,
  PLAN_DELAY_UNAVAILABLE,
  PLAN_NO_MODEL,
  PLAN_NOT_A_DECISION,
  STALE_AFTER_DAYS,
} from "../../src/features/heby-commands/action-plan";
import { findHebyCommandById } from "../../src/features/heby-commands/registry";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";
import type { AgentOriginationAvailability } from "../../src/features/origination-availability/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let n = 0;
const work = (over: Partial<WorkItemView> = {}): WorkItemView => ({
  workItemId: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  title: `Work ${n}`,
  declaredState: "active",
  lifecycleStatus: "active",
  inService: true,
  department: { departmentId: "d-eng", name: "Engineering" },
  accountableActorId: "u1",
  accountableCurrentlyActiveMember: true,
  recordedAt: daysAgo(40),
  updatedAt: daysAgo(1),
  ...over,
});
const register = (items: WorkItemView[], truncated = false): WorkRegister => ({ status: "available", items, truncated, detail: "d" });
const AVAILABLE: AgentOriginationAvailability = {
  status: "available",
  agent: { agentId: "a1", name: "Heby" },
  mandate: { revision: 4, purpose: "p", proposalScope: ["record-work"] },
  originable: "record-work",
  workScopes: [],
};
const plan = (scope: string, reg: WorkRegister, availability: AgentOriginationAvailability = AVAILABLE) =>
  composeActionPlan({ scope, register: reg, availability, now: NOW });
const text = (p: { lines: readonly string[] }) => p.lines.join("\n");

/* 1 · VERIFIED FACTS — counts and states come from the records, scoped to the department named. */
const blocked = work({ title: "Fix CI", declaredState: "blocked" });
const unowned = work({ title: "Write runbook", accountableActorId: null, accountableCurrentlyActiveMember: null });
const goneOwner = work({ title: "Migrate logs", accountableCurrentlyActiveMember: false });
const stale = work({ title: "Refactor auth", updatedAt: daysAgo(STALE_AFTER_DAYS + 5) });
const done = work({ title: "Ship v1", declaredState: "complete" });
const retired = work({ title: "Old plan", inService: false, lifecycleStatus: "archived" });
const finance = work({ title: "Close books", department: { departmentId: "d-fin", name: "Finance" }, declaredState: "blocked" });
const eng = plan("engineering", register([blocked, unowned, goneOwner, stale, done, retired, finance]));
const t = text(eng);
assert.equal(eng.title, "Action plan · engineering");
assert.match(t, /Fact: 5 work items in service name the engineering department; 1 retired\./);
assert.match(t, /Fact: declared states — planned 0, active 3, blocked 1, complete 1\. A person declared each state; Hebun observed none of them\./);
assert.match(t, /Fact: 1 open item names no accountable human; 1 open item names one who is not an active member\./);
assert.match(t, new RegExp(`Derived: 1 open item not updated in ${STALE_AFTER_DAYS} days or more`));
assert.doesNotMatch(t, /Close books/, "another department's work is not in this plan");
assert.doesNotMatch(t, /Ship v1|Old plan/, "complete and retired work is not offered as an issue");

/* 2 · MISSING DATA — delay is unavailable, never inferred; an unreadable register shows no plan. */
assert.ok(eng.lines.includes(PLAN_DELAY_UNAVAILABLE));
assert.doesNotMatch(t.replace(PLAN_DELAY_UNAVAILABLE, ""), /overdue|late|delayed/i, "no delay claim anywhere else");
const down = plan("engineering", { status: "unavailable", detail: "Work register unavailable." });
assert.equal(down.tone, "unavailable");
assert.match(text(down), /^Unavailable: this organization's work could not be read right now/);
assert.doesNotMatch(text(down), /Priority|Fact:/);
const truncated = text(plan("", register([blocked], true)));
assert.match(truncated, /The register shows only the most recent 1 work items; older work is not in this plan\./);

/* 3 · RECOMMENDATION vs EXECUTION — ordered priorities, each with evidence, dependency and authority. */
const p1 = t.indexOf("Priority 1 — Review the 1 item declared blocked");
const p2 = t.indexOf("Priority 2 — Name an active accountable human for 2 open items");
const p3 = t.indexOf(`Priority 3 — Confirm the declared state of 1 item not updated in ${STALE_AFTER_DAYS}+ days`);
assert.ok(p1 > 0 && p2 > p1 && p3 > p2, "blocked first, then ownership, then staleness");
assert.match(t, /Evidence: "Fix CI"\./);
assert.match(t, /Evidence: "Write runbook", "Migrate logs"\./);
assert.match(t, /Dependency: after the blocked review/);
assert.equal((t.match(/Execution: Recommendation only — Heby cannot change a work item/g) ?? []).length, 3);
assert.ok(eng.lines.includes(PLAN_NOT_A_DECISION) && eng.lines.includes(PLAN_NO_MODEL));

/* 4 · UNSUPPORTED / UNAVAILABLE CAPABILITY — the proposal path states the origination answer as-is. */
assert.match(t, /Execution availability: Offered now: Heby can be asked to propose record-work \(mandate revision 4\)\..*nothing is proposed from this plan automatically\./);
const refused = text(plan("engineering", register([blocked]), { status: "unavailable", reason: "external-ai-not-authorized" }));
assert.match(refused, /Execution availability: Not offered right now: this organization has not authorized the external model use agent proposals need\./);
assert.doesNotMatch(refused, /Offered now/);
const unknown = text(plan("engineering", register([blocked]), { status: "unavailable", reason: "temporarily-unavailable" }));
assert.match(unknown, /unknown, not refused/);
assert.match(text(plan("", register([work({ title: "Fine" })]))), /Hebun has nothing to prioritize from these records\./);

/* 8 · NO FABRICATED CLAIMS — no department, no work: nothing is invented. */
const none = text(plan("Legal", register([blocked])));
assert.match(none, /Fact: no work item in this organization's register names a department called "Legal"\./);
assert.match(none, /None\. There is no recorded work here to plan from, and Hebun does not invent work to fill the gap\./);
assert.doesNotMatch(none, /Priority \d/);
assert.match(text(plan("", register([]))), /Fact: this organization has recorded no work\./);
for (const p of [t, none, refused]) assert.doesNotMatch(p, /[0-9a-f]{8}-[0-9a-f]{4}-/, "no record identifier is shown");

/* 5 · 6 · 9 — THE COMMAND GATE: a read, no model, no execution; tenant from the session only. */
const descriptor = findHebyCommandById("plan");
assert.ok(descriptor);
assert.equal(descriptor!.kind, "read");
assert.equal(descriptor!.requiresModel, false);
assert.equal(descriptor!.requiresExecution, false);
assert.ok(!descriptor!.reachesProvider);

void (async () => {
  const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
  const seen: TenantContext[] = [];
  const deps = {
    resolveTenant: async () => TENANT,
    readWork: async (tenant: TenantContext) => (seen.push(tenant), register([blocked, finance])),
    readOriginationAvailability: async (tenant: TenantContext) => (seen.push(tenant), AVAILABLE),
  };
  const run = await runHebyReadCommand({ commandId: "plan", args: ["Engineering"], route: "/heby" }, deps as never);
  assert.equal(run.status, "ok", JSON.stringify(run));
  assert.ok(run.status === "ok" && run.result.title === "Action plan · Engineering");
  assert.ok(run.status === "ok" && run.result.lines.some((l) => l.includes('"Fix CI"')));
  assert.ok(seen.length === 2 && seen.every((s) => s === TENANT), "both reads receive the session tenant and nothing else");

  const anonymous = await runHebyReadCommand({ commandId: "plan", args: [], route: "/heby" }, { ...deps, resolveTenant: async () => null } as never);
  assert.deepEqual(anonymous, { status: "unauthorized" }, "no session, no read");

  const failing = await runHebyReadCommand({ commandId: "plan", args: [], route: "/heby" }, {
    ...deps,
    readWork: async () => ({ status: "unavailable", detail: "down" }) as WorkRegister,
  } as never);
  assert.ok(failing.status === "ok" && failing.result.tone === "unavailable");

  console.log("PASS heby-org-action-planning action-plan");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
