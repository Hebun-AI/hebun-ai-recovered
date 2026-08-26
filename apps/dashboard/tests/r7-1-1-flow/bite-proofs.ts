/*
 * R7.1.1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite defending it
 * must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * Each child is bounded. A hanging bite-proof is not a verdict, it is the absence of one, so a child
 * that exceeds its timeout is reported VOID rather than counted as bitten.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/r7-1-1-flow/act-history-truth.ts";
const FIREWALL_SUITE = "tests/r7-1-1-flow/act-history-firewall.ts";
const POSTGRES_SUITE = "tests/r7-1-1-flow/history-postgres.ts";
const AVAILABILITY_SUITE = "tests/s1-flow/dispatch-and-availability.ts";

const PAGE_READ = "src/features/governance-activity/act-history-read.server.ts";
const OBSERVE = "src/features/governance-activity/observe.server.ts";
const READ_COMMANDS = "src/features/heby-commands/read-commands.server.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";

/** Generous, but finite. The postgres child creates and drops its own database. */
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* THE ISOLATION BOUNDARY. Proved behaviourally against real rows, not by shape alone. */
    label: "M1 the tenant predicate is removed from the page statement",
    file: PAGE_READ,
    suite: POSTGRES_SUITE,
    find: `    .where(tenantScope)\n    .orderBy(`,
    replace: `    .orderBy(`,
    expect: "no row of B's appears in A's page",
  },
  {
    /* "Nothing was recorded" and "Hebun could not look" are different sentences. */
    label: "M2 a failed read is rendered as an empty history",
    file: OBSERVE,
    suite: TRUTH_SUITE,
    /*
     * The find-string carries this function's OWN detail sentence on purpose. `read.server.ts` and
     * `observe.server.ts` both contain a `status: "unavailable", reason: "read-failed"` pair, and
     * `String.replace` takes the FIRST match — so the short form silently mutated R7.1's aggregate
     * instead of this phase's reader, and the mutation survived because no suite here exercises
     * that function. A bite-proof that edits the wrong function proves nothing while looking
     * exactly like one that proved something.
     */
    find: `      status: "unavailable",\n      reason: "read-failed",\n      detail: error instanceof Error ? error.message : "recorded act history read failed",`,
    replace: `      status: "empty",\n      reason: "read-failed",\n      detail: error instanceof Error ? error.message : "recorded act history read failed",`,
    expect: "a throwing read is unavailable",
  },
  {
    /* A bounded list that cannot name its own total is a silent completeness claim. */
    label: "M3 a bounded page silently claims completeness",
    file: READ_COMMANDS,
    suite: TRUTH_SUITE,
    find: `      const heading = truncated`,
    replace: `      const heading = false`,
    expect: "a truncated page says exactly how many of how many it shows",
  },
  {
    /* `occurred_at` alone is not deterministic: acts in one transaction share it. */
    label: "M4 ordering loses its stable tie-breaker",
    file: PAGE_READ,
    suite: FIREWALL_SUITE,
    find: `.orderBy(desc(auditLog.occurredAt), desc(auditLog.id))`,
    replace: `.orderBy(desc(auditLog.occurredAt))`,
    expect: "ordering carries a stable tie-breaker",
  },
  {
    /* audit_log is the single sink for recorded acts. A second one is two answers to one question. */
    label: "M5 event_log becomes a second act sink",
    file: PAGE_READ,
    suite: FIREWALL_SUITE,
    find: `import { auditLog } from "@/db/schema/audit-log";`,
    replace: `import { auditLog } from "@/db/schema/audit-log";\nimport { eventLog } from "@/db/schema/event-log";`,
    expect: `must not name "eventLog"`,
  },
  {
    /* The writers MIX reads and writes; a Heby file holding one holds a reference to an appender. */
    label: "M6 an audit writer becomes reachable from the Heby command surface",
    file: READ_COMMANDS,
    suite: FIREWALL_SUITE,
    find: `import type { HebyCommandResult } from "./contracts";`,
    replace:
      `import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";\n` +
      `import type { HebyCommandResult } from "./contracts";`,
    expect: `read-commands must not reach "governance-audit"`,
  },
  {
    /* Nine writers, nine metadata shapes, no contract over their union. */
    label: "M7 the writers' metadata jsonb is selected",
    file: PAGE_READ,
    suite: FIREWALL_SUITE,
    find: `      simulation: auditLog.simulation,\n    })`,
    replace: `      simulation: auditLog.simulation,\n      metadata: auditLog.metadata,\n    })`,
    expect: "must never select auditLog.metadata",
  },
  {
    /* A whole-row form ships every column, including the three payloads. */
    label: "M8 the whole ledger row is spread into the select",
    file: PAGE_READ,
    suite: FIREWALL_SUITE,
    find: `      occurredAt: auditLog.occurredAt,\n      action: auditLog.action,`,
    replace: `      ...auditLog,\n      occurredAt: auditLog.occurredAt,\n      action: auditLog.action,`,
    expect: "no spread of the table",
  },
  {
    /* A model in this path could summarize a recorded act into something the ledger never said. */
    label: "M9 model interpretation enters the history path",
    file: OBSERVE,
    suite: FIREWALL_SUITE,
    find: `import type { TenantContext } from "@/features/auth/tenant/tenant-context";`,
    replace:
      `import { selectModelTransport } from "@/features/heby-model/model-transport-selection.server";\n` +
      `import type { TenantContext } from "@/features/auth/tenant/tenant-context";`,
    /*
     * It bites on the ROOT ban (§2), which fires before the model-name check (§8) — the import pulls
     * `src/features/heby-model/` into the graph, and that whole root is forbidden. The intended
     * reason is therefore the root assertion's, and pinning the §8 message instead would have been
     * a bite-proof asserting a message the run never produces.
     */
    expect: "must not reach src/features/heby-model",
  },
  {
    /* The ledger records AUTHORIZED acts, so no label on it may promise intrusion coverage. */
    label: "M10 /audit advertises security and intrusion coverage again",
    file: REGISTRY,
    suite: AVAILABILITY_SUITE,
    find: `    description: "Show the acts Hebun has durably recorded for your organization.",`,
    replace: `    description: "Show persisted security audit and intrusion history.",`,
    expect: "must not describe itself as security, intrusion, incident or breach coverage",
  },
  {
    /* A caller may ask for its own history or for nothing. There is no third form. */
    label: "M11 a client-supplied tenant id is accepted",
    file: OBSERVE,
    suite: FIREWALL_SUITE,
    find: `  tenant: Pick<TenantContext, "tenantId"> | null,\n  deps: ObserveGovernanceActivityDeps = {},\n): Promise<RecordedActHistoryResult> {`,
    replace: `  tenant: Pick<TenantContext, "tenantId"> | null,\n  tenantId?: string,\n  deps: ObserveGovernanceActivityDeps = {},\n): Promise<RecordedActHistoryResult> {`,
    expect: `no cross-tenant form: "tenantId?:"`,
  },
  {
    /* R7.1.1 is a reader. A write here would make the observer a second author of history. */
    label: "M12 the reader acquires a durable write",
    file: PAGE_READ,
    suite: FIREWALL_SUITE,
    find: `  return { acts, totalRecordedActs, truncated: acts.length < totalRecordedActs };`,
    replace:
      `  await db.insert(auditLog).values({});\n` +
      `  return { acts, totalRecordedActs, truncated: acts.length < totalRecordedActs };`,
    expect: "R7.1.1 is a reader",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(
      sha(readFile(mutation.file)),
      sha(mutated),
      `${mutation.label}: the mutation did not reach disk`,
    );
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(
    sha(readFile(mutation.file)),
    before,
    `${mutation.file} was not restored byte-identically`,
  );
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`r7-1-1-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
