/*
 * AP-2 — BITE-PROOFS.
 *
 * Each guarantee is mutated in the SHIPPED SOURCE and the defending suite must fail for the
 * INTENDED reason. Every edit's find-string must be present, the mutation must reach disk, and
 * restoration is verified byte-identically in `finally`.
 *
 * Some guarantees are held TWICE on purpose — the compare-and-swap and the retired-agent refusal are
 * checked in JavaScript under the row lock AND re-stated in the UPDATE predicate. Removing one layer
 * alone is caught by the other and the suite stays green, which is the defence-in-depth working,
 * not a test gap. Those mutations therefore remove BOTH layers in one step.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const POSTGRES = "tests/ap2-agent-placement/placement-postgres.ts";
const FIREWALL = "tests/ap2-agent-placement/firewall.ts";
const WRITER = "src/features/organization-authority/write-agent-placement.server.ts";
const CONTRACTS = "src/features/organization-authority/agent-placement-contracts.ts";
const PROPOSER = "src/features/action-authorization/agent-proposer.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const abs = (f: string) => path.join(ROOT, f);
const readFile = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly { readonly find: string; readonly replace: string }[];
  readonly suite: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 the target department is not locked (FK KEY SHARE alone)",
    file: WRITER,
    edits: [{ find: `          .for("share")\n`, replace: `` }],
    suite: POSTGRES,
    expect: "no backend ever waited on a lock",
  },
  {
    label: "B2 compare-and-swap removed (both layers)",
    file: WRITER,
    edits: [
      { find: `      if (current !== expected) {`, replace: `      if (false) {` },
      { find: "sql`${agents.departmentId} is not distinct from ${expected}::uuid`,", replace: "" },
    ],
    suite: POSTGRES,
    expect: "placement-changed",
  },
  {
    label: "B3 no-op writes",
    file: WRITER,
    edits: [{ find: `      if (current === target) {`, replace: `      if (false) {` }],
    suite: POSTGRES,
    expect: "already-placed",
  },
  {
    label: "B4 retired agent admitted (both layers)",
    file: WRITER,
    edits: [
      { find: `      if (agent.retiredAt !== null || agent.lifecycle === RETIRED_AGENT) {`, replace: `      if (false) {` },
      { find: `            isNull(agents.retiredAt),\n`, replace: `` },
      { find: "sql`${agents.agentLifecycleStatus} is distinct from ${RETIRED_AGENT}`,", replace: "" },
    ],
    suite: POSTGRES,
    expect: "agent-retired",
  },
  {
    label: "B5 Governance gate removed",
    file: WRITER,
    edits: [{ find: `  if (!authority.authorized) return refuse("not-authorized");\n`, replace: `` }],
    suite: POSTGRES,
    expect: "a member without Governance authority cannot place an agent",
  },
  {
    label: "B6 agent lookup not tenant-scoped (distinguishability leak)",
    file: WRITER,
    edits: [
      {
        find: `.where(and(eq(agents.tenantId, tenant.tenantId), eq(agents.id, agentId)))`,
        replace: `.where(eq(agents.id, agentId))`,
      },
    ],
    suite: POSTGRES,
    expect: "is unresolved, indistinguishably",
  },
  {
    label: "B7 writer widened to a manager column",
    file: WRITER,
    edits: [{ find: `          departmentId: target,\n`, replace: `          departmentId: target,\n          managerActorId: tenant.userId,\n` }],
    suite: FIREWALL,
    expect: "the writer's `.set` names exactly the writable columns",
  },
  {
    label: "B8 a retired agent's department read as current",
    file: CONTRACTS,
    edits: [{ find: `  if (!agentInService) return "historical";\n`, replace: `` }],
    suite: POSTGRES,
    expect: "'historical'",
  },
  {
    label: "B9 proposer resolution reaches placement",
    file: PROPOSER,
    edits: [{ find: `import `, replace: `import { readAgentPlacements as _ap2 } from "@/features/organization-authority/read-agent-placement.server";\nvoid _ap2;\nimport ` }],
    suite: FIREWALL,
    expect: "only the /agents surface reaches agent placement",
  },
];

function runSuite(suite: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    timedOut: result.error?.message.includes("ETIMEDOUT") ?? false,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    const original = readFile(mutation.file);
    const before = sha(original);
    let mutated = original;
    for (const edit of mutation.edits) {
      assert.ok(mutated.includes(edit.find), `${mutation.label}: find-string absent in ${mutation.file}`);
      mutated = mutated.replace(edit.find, edit.replace);
    }
    assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
    try {
      writeFileSync(abs(mutation.file), mutated, "utf8");
      assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: did not reach disk`);
      const run = runSuite(mutation.suite);
      assert.equal(run.timedOut, false, `${mutation.label}: the defending suite TIMED OUT — void, not a bite`);
      assert.equal(run.ok, false, `${mutation.label}: SURVIVED — ${mutation.suite} still passed`);
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: failed, but not for the intended reason ("${mutation.expect}").\n${run.output.slice(-2500)}`,
      );
    } finally {
      writeFileSync(abs(mutation.file), original, "utf8");
    }
    assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} not restored byte-identically`);
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length);
  console.log(`ap2-agent-placement/bite-proofs: ${bitten} mutations bit`);
}

main();
