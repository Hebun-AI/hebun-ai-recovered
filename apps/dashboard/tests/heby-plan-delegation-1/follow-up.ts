/*
 * HEBY-PLAN-DELEGATION-1 — an accepted AI plan recommendation offers "Takip görevi oluştur", which asks
 * the released origination seam to PROPOSE a new follow-up work item.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Only an accepted plan carries follow-ups; each goal is one of four fixed Hebun sentences chosen by
 *    the step's closed move; no goal can carry a work title, alias, identifier, department, person,
 *    plan ref or model text; the runtime never reaches origination itself; the UI offers it only on an
 *    explicit click, through the unchanged affordance and server action, never as an update to the
 *    original work, and without the Knowledge mode."
 *
 * Test doubles, stated: the generator is a stub that answers from the projection it was given; Work
 * and Organization reads are released-type values carrying realistic titles and names. No provider
 * was contacted and no origination ran.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runAiOperationalPlan, type AiOperationalPlanDeps } from "../../src/features/heby-commands/ai-operational-plan.server";
import { PLAN_MOVES } from "../../src/features/heby-commands/operational-plan-candidate";
import { PLAN_FOLLOW_UP_GOALS, PLAN_FOLLOW_UP_LABEL } from "../../src/features/heby-commands/plan-follow-up";
import { validateHebyPrompt } from "../../src/features/heby-runtime/prompt-validation";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
const NOW = new Date("2026-10-13T12:00:00.000Z");
const DAY = 86_400_000;
const PLAN_REF = "P-0123456789ab";
const DEPT_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const SECRET_TITLES = ["Supplier contract 1 with Ayşe Yılmaz", "Supplier contract 2 with Ayşe Yılmaz", "Supplier contract 3 with Ayşe Yılmaz"];

const view = (n: number, p: Partial<WorkItemView>): WorkItemView => ({
  workItemId: `bbbbbbbb-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`, title: SECRET_TITLES[n - 1]!, declaredState: "active", lifecycleStatus: "active", inService: true,
  department: { departmentId: DEPT_ID, name: "Engineering" }, accountableActorId: "cccccccc-0000-4000-8000-000000000001",
  accountableCurrentlyActiveMember: true, recordedAt: new Date(NOW.getTime() - 90 * DAY).toISOString(), updatedAt: new Date(NOW.getTime() - DAY).toISOString(), ...p,
});
const VIEWS = [
  view(1, { declaredState: "blocked", accountableActorId: null, accountableCurrentlyActiveMember: null, updatedAt: new Date(NOW.getTime() - 45 * DAY).toISOString() }),
  view(2, {}),
  view(3, { declaredState: "planned", accountableActorId: null, accountableCurrentlyActiveMember: null }),
];
const REGISTER: WorkRegister = { status: "available", items: VIEWS, truncated: false, detail: "d" };
const STRUCTURE = { status: "available", detail: "d", departments: [{ departmentId: DEPT_ID, name: "Engineering", slug: "engineering", lifecycleStatus: "active", inService: true }] } as never;

interface Item { alias: string; state: string; accountable: boolean; stale: boolean; evidenceDeclared: boolean }

/** A model that answers correctly from the projection it is shown: one step per move that has items. */
function correctPlan(evidence: string): string {
  const { planRef, projection } = JSON.parse(evidence) as { planRef: string; projection: { items: Item[] } };
  const pick = (f: (i: Item) => boolean) => projection.items.filter(f).map((i) => i.alias);
  const candidates: [string, string[], string][] = [
    ["review-blocked", pick((i) => i.state === "blocked"), "state:blocked"],
    ["find-accountable", pick((i) => !i.accountable), "accountable:false"],
    ["review-stale", pick((i) => i.stale), "stale:true"],
    ["declare-evidence", pick((i) => !i.evidenceDeclared), "evidence:false"],
  ];
  const steps = candidates
    .filter(([, items]) => items.length > 0)
    .map(([move, items, code], index) => ({ step: index + 1, move, items, because: [code], priority: "high", afterStep: null }));
  return JSON.stringify({ planRef, steps, uncertainty: "low" });
}

async function plan(answer: ((evidence: string) => string) | "unavailable", over: Partial<AiOperationalPlanDeps> = {}) {
  let generated = 0;
  const result = await runAiOperationalPlan({ message: "AI ile Engineering için aksiyon planı hazırla" }, {
    resolveTenant: async () => TENANT,
    readStructure: async () => STRUCTURE,
    readWork: async () => REGISTER,
    readEvidence: async () => ({ status: "available", references: [] }),
    resolveDirectorEnabled: async () => true,
    selectTransport: () => ({ transport: {} as never, transportProvenance: "live" }),
    env: {},
    mintRef: () => PLAN_REF,
    now: () => NOW,
    generate: async (request) => {
      generated += 1;
      if (answer === "unavailable") return { status: "unavailable", state: "DATA_USE_NOT_AUTHORIZED" } as never;
      return { status: "generated", result: { text: answer(request.evidence[0]!) } } as never;
    },
    ...over,
  });
  assert.equal(result.status, "ok");
  return { result: (result as Extract<typeof result, { status: "ok" }>).result, generated };
}

/* ── 1 · The goals: closed, fixed, validated, and carrying no tenant data. ─────────────────────── */
assert.deepEqual(Object.keys(PLAN_FOLLOW_UP_GOALS).sort(), [...PLAN_MOVES].sort(), "one fixed goal per plan move, no more, no fewer");
const GOALS = Object.values(PLAN_FOLLOW_UP_GOALS);
assert.equal(new Set(GOALS).size, GOALS.length, "every move has its own goal");
for (const goal of GOALS) {
  assert.ok(validateHebyPrompt(goal).ok, "the goal passes the released prompt validator origination applies");
  assert.match(goal, /^Create a follow-up task: /, "every goal asks for a NEW follow-up task");
  assert.doesNotMatch(goal, /\bW\d+\b|[0-9a-f]{8}-[0-9a-f]{4}-|P-[0-9a-f]{6}|Engineering|Ayşe|Supplier/i, "no alias, identifier, plan ref, department or name");
  assert.doesNotMatch(goal, /\b(update|change|reassign|modify|edit|close|retire)\b/i, "a follow-up never asks to alter the original work");
}
assert.equal(PLAN_FOLLOW_UP_LABEL, "Takip görevi oluştur");

async function main(): Promise<void> {
/* ── 2 · An accepted plan carries one follow-up per step, keyed only by the step's move. ──────── */
{
  const { result, generated } = await plan(correctPlan);
  assert.equal(generated, 1);
  assert.equal(result.tone, "info");
  const followUps = result.followUps ?? [];
  assert.ok(followUps.length >= 3, "blocked, accountable, stale and evidence steps were all proposed");
  for (const followUp of followUps) {
    assert.ok(GOALS.includes(followUp.goal), "each goal is exactly one of the fixed sentences");
    assert.ok(result.lines.some((line) => line.startsWith(`Recommendation ${followUp.recommendation} ·`)), "each offer sits under a shown recommendation");
  }
  /* The rendered plan shows titles to the human; the follow-ups carry none of them. */
  assert.ok(result.lines.join("\n").includes(SECRET_TITLES[0]!), "fixture sanity: the human-facing lines do name the work");
  const serialized = JSON.stringify(followUps);
  for (const secret of [...SECRET_TITLES, "Ayşe", "Engineering", PLAN_REF, DEPT_ID, "bbbbbbbb-", "cccccccc-"]) {
    assert.ok(!serialized.includes(secret), `a follow-up never carries ${secret}`);
  }
  assert.doesNotMatch(serialized, /\bW\d+\b/, "a follow-up never carries a plan alias");
}

/* ── 3 · Anything short of an accepted plan offers nothing. ──────────────────────────────────── */
for (const [label, answer, over] of [
  ["contract-refused answer", () => "not json", {}],
  ["model refused by EAI", "unavailable", {}],
  ["Director control off", correctPlan, { resolveDirectorEnabled: async () => false }],
  ["no transport", correctPlan, { selectTransport: () => ({}) }],
] as const) {
  const { result } = await plan(answer as never, over as Partial<AiOperationalPlanDeps>);
  assert.equal(result.tone, "unavailable", label);
  assert.equal(result.followUps, undefined, `${label}: no follow-up is offered`);
}
{
  const { result } = await plan((e) => JSON.stringify({ planRef: JSON.parse(e).planRef, steps: [], uncertainty: "low" }));
  assert.deepEqual(result.followUps, [], "an empty accepted plan offers no follow-up");
}

}

/* ── 4 · Boundaries. ─────────────────────────────────────────────────────────────────────────── */
const FOLLOW_UP_MODULE = codeOf(read("src/features/heby-commands/plan-follow-up.ts"));
assert.deepEqual([...FOLLOW_UP_MODULE.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]), [], "the goal table imports nothing");

const RUNTIME = codeOf(read("src/features/heby-commands/ai-operational-plan.server.ts"));
for (const forbidden of ["agent-origination", "originate", "record-action-request", "action-authorization", "governance"]) {
  assert.ok(!RUNTIME.includes(forbidden), `the AI planning runtime never reaches ${forbidden}`);
}
assert.match(RUNTIME, /PLAN_FOLLOW_UP_GOALS\[s\.move\]/, "the goal is looked up by the closed move and nothing else");

const COMPOSER = codeOf(read("src/components/layout/heby/heby-composer.tsx"));
assert.match(COMPOSER, /tone === "info" && props\.commandOutput\.followUps\?\.length/, "offered only under an accepted result");
/* PLAN-FOLLOW-UP-REFERENCE-V1 (Director-approved 2026-10-20): the same fixed goal, plus the step's server-signed binding and source count. */
assert.match(
  COMPOSER.replace(/\s+/g, " "),
  /<HebyOriginationAffordance goal=\{followUp\.goal\} followUp planBinding=\{followUp\.binding\} sourceCount=\{followUp\.sourceCount\} \/>/,
  "through the released affordance, with the fixed goal",
);

const AFFORDANCE = codeOf(read("src/components/layout/heby/heby-origination-affordance.tsx"));
assert.match(AFFORDANCE, /\{ goal, agentId: chosenAgentId, workScope: scope \} : \{ goal, workScope: scope \}/, "the browser still sends goal, chosen agent and chosen scope only");
assert.match(AFFORDANCE, /\? PLAN_FOLLOW_UP_LABEL/, "the follow-up control is labelled Takip görevi oluştur");
assert.match(AFFORDANCE, /iş kayıtları değiştirilmez/, "it says the original work is not changed");
assert.match(AFFORDANCE, /\{followUp \? null : \(\s*<button[\s\S]*?Ask, grounded in Knowledge/, "the Knowledge mode is not offered for a follow-up");
assert.match(AFFORDANCE, /\{followUp \? null : \(\s*<p className="mt-1">\s*Grounded in Knowledge/, "nor described");
assert.doesNotMatch(
  AFFORDANCE.slice(AFFORDANCE.indexOf("{followUp ? ("), AFFORDANCE.indexOf("can be asked to propose this message")),
  /\b(update|güncelle)/i,
  "the follow-up wording never implies an update",
);

main().then(
  () => console.log("PASS heby-plan-delegation-1 follow-up"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
