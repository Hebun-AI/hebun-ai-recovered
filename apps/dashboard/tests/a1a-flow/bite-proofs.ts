/*
 * A1a — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite defending it
 * must fail — for the INTENDED reason, not merely for some reason.
 *
 * Restoration runs in `finally` and is verified byte-identically. Each child is bounded: a hanging
 * bite-proof is not a verdict, so a timeout is reported VOID rather than counted as a bite.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const FIREWALL = "tests/a1a-flow/attribution-firewall.ts";

const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const SCHEMA = "src/db/schema/action-authorization.ts";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;
const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string; timedOut: boolean } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT, encoding: "utf8", env: process.env,
    maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: r.status === 0,
    output: `${r.stdout ?? ""}${r.stderr ?? ""}`,
    timedOut: r.signal === "SIGTERM" && r.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* THE ORIGINAL DEFECT, PUT BACK. */
    label: "M1 the released `agent` attribution returns",
    file: WRITER,
    find: `    { actorType: "human", actorId: tenant.userId },`,
    replace: `    { actorType: "agent", actorId: tenant.userId },`,
    expect: "the proposer type is human",
  },
  {
    /*
     * The pair, not the field, is the lie: a human id named as a non-human actor.
     *
     * A SECOND write site rather than an edit of the real one. Replacing the live value only ever
     * bites §1 ("the proposer type is human"), which M1 already proves — so that mutation would have
     * tested the same assertion twice while appearing to test two. This adds the realistic failure
     * instead: somebody introduces another place that files a proposal and gets the pair wrong.
     */
    label: "M2 a second write site pairs a human user id with a non-human actor type",
    file: WRITER,
    find: `  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");`,
    replace:
      `  const _second = { proposedByActorType: "service", proposedByActorId: tenant.userId };\n` +
      `  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");`,
    expect: "no non-human proposer type is written on this path",
  },
  {
    /*
     * Attribution derived from a surface rather than from who acted. Added ALONGSIDE the correct
     * literal, so §1 still passes and the count assertion is what bites — otherwise this would be
     * M1 again wearing a different label.
     */
    label: "M3 the actor type becomes inferred rather than stated",
    file: WRITER,
    find: `  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");`,
    replace:
      `  const _inferred = { proposedByActorType: prepared.toolId ? "agent" : "human" };\n` +
      `  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");`,
    expect: "the proposer type is written in exactly one place",
  },
  {
    /* An id invented to satisfy NOT NULL is exactly what A1 forbids. */
    label: "M4 an agent id is fabricated to satisfy the column",
    file: WRITER,
    find: `    { actorType: "human", actorId: tenant.userId },`,
    replace: `    { actorType: "agent", actorId: crypto.randomUUID() },`,
    expect: "no proposer identifier is fabricated to satisfy a NOT NULL column",
  },
  {
    /* The tenant is not an actor. */
    label: "M5 the tenant id masquerades as the actor id",
    file: WRITER,
    find: `    { actorType: "human", actorId: tenant.userId },`,
    replace: `    { actorType: "human", actorId: tenant.tenantId },`,
    expect: "the proposer id is that authenticated human's user id",
  },
  {
    /* Human supremacy at the approval boundary, in the schema. */
    label: "M6 the approver CHECK is removed",
    file: SCHEMA,
    find: `      "heby_action_requests_human_approver_chk",`,
    replace: `      "heby_action_requests_removed_chk",`,
    expect: "the approver CHECK is still declared",
  },
  {
    /* Human supremacy at the authorization boundary, in the schema. */
    label: "M7 the permit authorizer CHECK is removed",
    file: SCHEMA,
    find: `check("action_permits_human_authorizer_chk"`,
    replace: `check("action_permits_removed_chk"`,
    expect: "the permit CHECK is still declared",
  },
  {
    /* The writer must not become an identity authority. */
    label: "M8 the writer becomes an agents-table writer",
    file: WRITER,
    find: `import type { TenantContext } from "@/features/auth/tenant/tenant-context";`,
    replace:
      `import { agents } from "@/db/schema/agent";\n` +
      `import type { TenantContext } from "@/features/auth/tenant/tenant-context";`,
    expect: `must not reach "@/db/schema/agent"`,
  },
  {
    /* A generic principal authority would be a second identity owner. */
    label: "M9 a generic principal authority is introduced",
    file: WRITER,
    find: `        proposedByActorType: proposer.actorType,`,
    replace: `        principals: true,\n        proposedByActorType: proposer.actorType,`,
    expect: `must not reach "principals"`,
  },
  {
    /* Governance breadth is not A1a's to widen. */
    label: "M10 Governance subject types are widened from this path",
    file: WRITER,
    find: `  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");`,
    replace:
      `  const _widen = "GOVERNANCE_SUBJECT_TYPES";\n` +
      `  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");`,
    expect: `must not reach "GOVERNANCE_SUBJECT_TYPES"`,
  },
  {
    /* Execution is a different authority and stays unreachable from the proposal writer. */
    label: "M11 execution becomes reachable from the proposal writer",
    file: WRITER,
    find: `import type { TenantContext } from "@/features/auth/tenant/tenant-context";`,
    replace:
      `import "@/features/action-execution/execution-control.server";\n` +
      `import type { TenantContext } from "@/features/auth/tenant/tenant-context";`,
    expect: `must not reach "@/features/action-execution"`,
  },
  {
    /*
     * A1a adds no migration.
     *
     * The mutation must add a real 37th ENTRY. An earlier version injected extra keys into entry 35
     * instead — valid JSON, visibly "changed", and completely inert against an assertion that counts
     * `entries.length`. It survived, which is the correct verdict on a mutation that never expressed
     * the thing being defended.
     */
    label: "M12 a migration is added",
    file: JOURNAL,
    find: `      "tag": "20260831110423_ama1_agent_mandate_authority",\n      "breakpoints": true\n    }\n  ]`,
    replace:
      `      "tag": "20260828190630_sia3_agent_improvement_hypothesis",\n      "breakpoints": true\n    },\n` +
      `    {\n      "idx": 36,\n      "version": "7",\n      "when": 1787726663801,\n` +
      `      "tag": "20260827000000_a1a_should_not_exist",\n      "breakpoints": true\n    }\n  ]`,
    expect: "A1a adds no migration",
  },
];

function withMutation(m: Mutation, body: () => void): void {
  const original = readFile(m.file);
  const before = sha(original);
  assert.ok(
    original.includes(m.find),
    `${m.label}: the find-string is not present in ${m.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(m.find, m.replace);
  assert.notEqual(mutated, original, `${m.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(m.file), mutated, "utf8");
    assert.equal(sha(readFile(m.file)), sha(mutated), `${m.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(m.file), original, "utf8");
  }
  assert.equal(sha(readFile(m.file)), before, `${m.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const m of MUTATIONS) {
    withMutation(m, () => {
      const run = runSuite(FIREWALL);
      assert.equal(run.timedOut, false, `${m.label}: the defending suite TIMED OUT. VOID, not a bite.`);
      assert.equal(
        run.ok, false,
        `${m.label}: the mutation SURVIVED — ${FIREWALL} still passed.\n--- actual ---\n${run.output.slice(-1500)}`,
      );
      assert.ok(
        run.output.includes(m.expect),
        `${m.label}: the suite failed, but not for the intended reason. Expected "${m.expect}".\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${m.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`a1a-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
