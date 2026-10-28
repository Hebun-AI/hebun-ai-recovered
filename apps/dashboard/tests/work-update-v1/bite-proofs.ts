/*
 * WORK-UPDATE V1 — BITE-PROOFS. Each mutation removes one guard the work-state suites claim to
 * prove; the named suite must then FAIL, and fail on the stated assertion. Every source file is
 * restored byte-identically (sha256). A guard that does not bite is reported and fails this file.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const PG = "tests/work-update-v1/work-state-postgres.ts";
const FIREWALL = "tests/work-update-v1/work-state-firewall.ts";
const WRITER = "src/features/organizational-work/write-work.server.ts";
const REACH = "tests/work-update-v1/work-register-reach-firewall.ts";

interface Mutation { label: string; file: string; find: string; replace: string; suite: string; because: string }

const MUTATIONS: Mutation[] = [
  {
    label: "B1 the spend is detached from the Work Authority's transaction",
    file: "src/features/governed-internal-action/execute-set-work-state.server.ts",
    find: "getDb: () => tx as unknown as ControlPlaneDatabase,",
    replace: "getDb: deps.getDb,",
    suite: PG,
    because: "T1: the spend rolled back with the refusal",
  },
  {
    label: "B2 fromState is not checked under the lock",
    file: WRITER,
    find: 'if (current.declaredState !== change.fromState) throw new GovernedWorkStateAbort("work-state-changed");',
    replace: "",
    suite: PG,
    because: "T1: a stale fromState is refused under the lock",
  },
  {
    label: "B3 the execution-time domain check is removed",
    file: WRITER,
    /* WORK-UPDATE-ORGANIZATION-SCOPE-1: the check now covers both scopes; the mutation still removes it. */
    find: 'if (!scopeHeld) throw new GovernedWorkStateAbort("work-scope-changed");',
    replace: 'if (false as boolean) throw new GovernedWorkStateAbort("work-scope-changed");',
    suite: PG,
    because: "T1b: an item moved to another domain is refused under the lock",
  },
  {
    label: "B4 the kind becomes machine-executable",
    file: "src/features/governed-machine-execution/contracts.ts",
    find: "new Set<string>([RECORD_WORK_ACTION_KIND]),",
    replace: 'new Set<string>([RECORD_WORK_ACTION_KIND, "set-work-declared-state"]),',
    suite: FIREWALL,
    because: "F5: not machine-executable",
  },
  {
    label: "B5 the model is shown the item's title",
    file: "src/features/agent-origination/originate-work-state.server.ts",
    find: "userPrompt: WORK_STATE_ORIGINATION_GOALS[target.toState],",
    replace: "userPrompt: `${WORK_STATE_ORIGINATION_GOALS[target.toState]} (${target.title})`,",
    suite: PG,
    because: "T8: the goal is the fixed Hebun sentence",
  },
  {
    label: "B6 the governed row read drops the tenant predicate",
    file: WRITER,
    find: ".where(and(eq(workItems.tenantId, tenant.tenantId), eq(workItems.id, change.workItemId)))",
    replace: ".where(eq(workItems.id, change.workItemId))",
    suite: FIREWALL,
    because: "F3: the row is read with the tenant in the predicate",
  },
  {
    label: "B7 a second declared_state UPDATE path appears",
    file: WRITER,
    find: '      if (current.declaredState !== change.fromState) throw new GovernedWorkStateAbort("work-state-changed");\n',
    replace:
      '      if (current.declaredState !== change.fromState) throw new GovernedWorkStateAbort("work-state-changed");\n' +
      "      await tx.update(workItems).set({ declaredState: change.toState }).where(eq(workItems.id, current.id));\n",
    suite: FIREWALL,
    because: "F2: exactly one declared_state UPDATE in the Work Authority",
  },
  {
    label: "B8 responsibility is not scoped for the kind",
    file: "src/features/action-authorization/agent-mandate-ceiling.ts",
    find: "if (!RESPONSIBILITY_SCOPED_REGISTRY_KINDS.includes(actionKind)) return null;",
    replace: "if (actionKind !== RESPONSIBILITY_SCOPED_REGISTRY_KIND) return null;",
    suite: PG,
    because: "T7b: responsibility refuses at origination",
  },
  {
    label: "B9 the mandate form pre-selects the kind",
    file: "src/features/agent-mandate/contracts.ts",
    /* RA-AUTH-1 re-anchored: the list now also holds `prepare-research`; the injected defect (the kind is pre-selected) is unchanged. */
    find: "export const MANDATE_SCOPE_NEVER_PRESELECTED: readonly MandateScopeKind[] = Object.freeze([\n  SET_WORK_DECLARED_STATE_ORIGINATION_ALIAS,\n  PREPARE_RESEARCH_PREPARATION_KIND,\n]);",
    replace: "export const MANDATE_SCOPE_NEVER_PRESELECTED: readonly MandateScopeKind[] = Object.freeze([\n  PREPARE_RESEARCH_PREPARATION_KIND,\n]);\nvoid SET_WORK_DECLARED_STATE_ORIGINATION_ALIAS;",
    suite: FIREWALL,
    because: "F8: the mandate form never pre-selects the kind",
  },
  {
    label: "B10 WORK-1's panel reaches agent origination directly",
    file: "src/components/organizational-work/work-register.tsx",
    find: 'import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";',
    replace:
      'import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";\nimport type { OriginateWorkStateResult as _Unused } from "@/features/agent-origination/originate-work-state.server";',
    suite: FIREWALL,
    because: "F9: src/components/organizational-work/work-register.tsx reaches no agent origination",
  },
  {
    label: "B11 the pre-model preflight is skipped",
    file: "src/features/agent-origination/originate-work-state.server.ts",
    find: 'if (preflight.status !== "admitted") return refused("proposal-refused", preflight.reason);',
    replace: "void preflight;",
    suite: PG,
    because: "T10: a kind outside the mandate is refused before any model call",
  },
  {
    label: "B12 the preflight ignores responsibility",
    file: "src/features/origination-availability/read-origination-availability.server.ts",
    find: "if (!eligible.agents.some((agent) => agent.agentId === agentId)) {",
    replace: "if (false as boolean) {",
    suite: PG,
    because: "T10: responsibility is checked before any model call",
  },
  {
    label: "B13 the Work register reaches origination TRANSITIVELY (one Heby component away)",
    file: "src/components/organizational-work/work-register.tsx",
    find: 'import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";',
    replace: 'import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";\nimport { HebyWorkStateAffordance } from "@/components/layout/heby/heby-work-state-affordance";\nvoid HebyWorkStateAffordance;',
    suite: REACH,
    because: "R1: src/components/organizational-work/work-register.tsx must not reach ",
  },
];

function proveOne(m: Mutation): { label: string; bit: boolean; detail: string } {
  const before = read(m.file);
  const digest = sha(before);
  const n = before.split(m.find).length - 1;
  if (n !== 1) return { label: m.label, bit: false, detail: `anchor found ${n} times in ${m.file}` };
  let output = "";
  let ok = false;
  try {
    writeFileSync(abs(m.file), before.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
    output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    ok = r.status === 0;
  } finally {
    writeFileSync(abs(m.file), before, "utf8");
  }
  assert.equal(sha(read(m.file)), digest, `${m.label}: source restored byte-identically`);
  if (ok) return { label: m.label, bit: false, detail: "the suite PASSED against mutated source" };
  if (!output.includes(m.because)) return { label: m.label, bit: false, detail: `failed, but not for: ${m.because}` };
  return { label: m.label, bit: true, detail: `bit on: ${m.because}` };
}

for (const suite of [PG, FIREWALL, REACH]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
  assert.equal(r.status, 0, `baseline: ${suite} must pass unmutated before any bite counts`);
}
const verdicts = MUTATIONS.map(proveOne);
for (const v of verdicts) console.log(`${v.bit ? "BIT " : "MISS"}  ${v.label} — ${v.detail}`);
const missed = verdicts.filter((v) => !v.bit);
assert.equal(missed.length, 0, `every guard must bite; missed: ${missed.map((v) => v.label).join(", ")}`);
console.log(`work-update-v1/bite-proofs: ${verdicts.length} mutations bit`);
