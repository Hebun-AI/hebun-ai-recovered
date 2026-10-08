/*
 * AP-4B — BITE PROOFS. Each guard is removed, the suite that pins it must fail for THAT reason, and
 * the source is restored byte-identically. A guard no suite notices is not a guard.
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

const PURE = "tests/ap4b-strict-work-eligibility/scope-and-ceiling.ts";
const PG = "tests/ap4b-strict-work-eligibility/eligibility-postgres.ts";
const FIREWALL = "tests/ap4b-strict-work-eligibility/firewall.ts";
const RUNG2 = "tests/rung2-standing-mutation/issuance-postgres.ts";

interface Mutation { label: string; file: string; find: string; replace: string; suite: string; because: string }

const MUTATIONS: Mutation[] = [
  {
    label: "B1 the one writer files unscoped record-work",
    file: "src/features/action-authorization/record-action-request.server.ts",
    find: "if (prepared.actionKind === RESPONSIBILITY_SCOPED_REGISTRY_KIND && !workScopeFromPayload(payload)) {",
    replace: "if (false as boolean) {",
    suite: PG,
    because: "L1: the one writer refuses a scope it cannot read",
  },
  {
    label: "B2 the agent inlet skips responsibility",
    file: "src/features/action-authorization/record-action-request.server.ts",
    find: "refuseOutsideAgentResponsibility(read, actionKind, workScopeFromPayload(proposedArguments))",
    replace: "null",
    suite: PG,
    because: "L4:",
  },
  {
    label: "B3 the spend skips responsibility",
    file: "src/features/action-authorization/consume-action-permit.server.ts",
    find: "refuseOutsideAgentResponsibility(mandate, request.actionKind, workScopeFromPayload(payload))",
    replace: "false",
    suite: PG,
    because: "L6: withdrawn responsibility stops the spend",
  },
  {
    label: "B4 the standing issuer skips responsibility",
    file: "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts",
    find: "        refuseOutsideAgentResponsibility(\n          mandateNow,",
    replace: "        ((..._ignored: unknown[]) => null)(\n          mandateNow,",
    suite: RUNG2,
    because: "AP-4B: the standing issuer re-checks",
  },
  {
    label: "B5 an organization grant admits domain work",
    file: "src/features/action-authorization/agent-mandate-ceiling.ts",
    find: ': grant.kind === "domain" && grant.inService && grant.workDomainId === scope.workDomainId,',
    replace: ': grant.kind === "organization" || (grant.kind === "domain" && grant.inService && grant.workDomainId === scope.workDomainId),',
    suite: PURE,
    because: "org grant does not admit a domain",
  },
  {
    label: "B6 a retired domain still admits",
    file: "src/features/action-authorization/agent-mandate-ceiling.ts",
    find: 'grant.kind === "domain" && grant.inService && grant.workDomainId',
    replace: 'grant.kind === "domain" && grant.workDomainId',
    suite: PURE,
    because: "retired domain admits nothing",
  },
  {
    label: "B7 the executor defaults a missing scope",
    file: "src/features/governed-internal-action/execute-record-work.server.ts",
    find: "const workScope = workScopeFromPayload(payload);",
    replace: 'const workScope = workScopeFromPayload(payload) ?? ({ kind: "organization" } as const);',
    suite: PURE,
    because: "P1: a pre-B unscoped payload is not recordable",
  },
  {
    label: "B8 the Work Authority files work under a retired domain",
    file: "src/features/organizational-work/write-work.server.ts",
    find: "if (!(await isActiveWorkDomain(tx, ctx.tenantId, workScope.workDomainId))) {",
    replace: "if (false as boolean) {",
    suite: PG,
    because: "L7:",
  },
  {
    label: "B9 the inlet trusts a domain id it did not resolve",
    file: "src/features/heby-action-inlet/record-work-proposal.server.ts",
    find: "  const read = await readWorkDomains(tenant, deps.getDb ? { getDb: deps.getDb } : {});",
    replace: "  if (Date.now() > 0) return { ok: true, args: workScopeArguments(scope) };\n  const read = await readWorkDomains(tenant, deps.getDb ? { getDb: deps.getDb } : {});",
    suite: PG,
    because: "L2: another tenant's domain",
  },
  {
    label: "B10 origination defaults the human's scope",
    file: "src/features/agent-origination/originate-action.server.ts",
    find: "const workScope = parseWorkScope(input.workScope);",
    replace: 'const workScope = parseWorkScope(input.workScope) ?? ({ kind: "organization" } as const);',
    suite: FIREWALL,
    because: "F3: the scope comes from the human's input",
  },
  {
    label: "B11 the eligibility projection lists agents outside responsibility",
    file: "src/features/origination-availability/list-eligible-agents.server.ts",
    find: "    if (refuseOutsideAgentResponsibility(mandate, RESPONSIBILITY_SCOPED_REGISTRY_KIND, workScope)) continue;\n",
    replace: "",
    suite: PG,
    because: "L8: engineering → Heby",
  },
  {
    label: "B12 an enforcer imports the eligibility projection",
    file: "src/features/action-authorization/consume-action-permit.server.ts",
    find: 'import { workScopeFromPayload } from "@/features/work-domain/work-scope";',
    replace: 'import { workScopeFromPayload } from "@/features/work-domain/work-scope";\nimport { listEligibleAgents } from "@/features/origination-availability/list-eligible-agents.server";\nvoid listEligibleAgents;',
    suite: FIREWALL,
    because: "F2: only the availability projection reads the eligibility projection",
  },
  {
    label: "B13 the direct human path lets a scope ride along",
    file: "src/features/organizational-work/write-work.server.ts",
    find: "const unscoped = { title, declaredState, departmentId, accountableUserId };",
    replace: "const unscoped = { ...input, title, declaredState, departmentId, accountableUserId };",
    suite: FIREWALL,
    because: "F6: the direct human path names its fields",
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
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
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

for (const suite of [PURE, PG, FIREWALL, RUNG2]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  assert.equal(r.status, 0, `baseline: ${suite} must pass unmutated before any bite counts`);
}
const verdicts = MUTATIONS.map(proveOne);
for (const v of verdicts) console.log(`${v.bit ? "BIT " : "MISS"}  ${v.label} — ${v.detail}`);
const missed = verdicts.filter((v) => !v.bit);
assert.equal(missed.length, 0, `every guard must bite; missed: ${missed.map((v) => v.label).join(", ")}`);
console.log(`ap4b-strict-work-eligibility/bite-proofs: ${verdicts.length} mutations bit`);
