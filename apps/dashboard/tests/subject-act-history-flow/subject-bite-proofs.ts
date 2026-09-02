/*
 * SUBJECT-ACT-HISTORY-1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite defending
 * it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * M1 IS THE ONE THE DIRECTOR NAMED: generic `metadata` / `previous_state` / `next_state` must not
 * become available through the product-facing read. It is proved twice — structurally, and against
 * real Postgres rows carrying poisoned values.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/subject-act-history-flow/subject-truth.ts";
const FIREWALL_SUITE = "tests/subject-act-history-flow/subject-firewall.ts";
const POSTGRES_SUITE = "tests/subject-act-history-flow/subject-postgres.ts";

const SUBJECT_READ = "src/features/governance-activity/subject-act-history-read.server.ts";
const OBSERVE = "src/features/governance-activity/observe.server.ts";
const READ_COMMANDS = "src/features/heby-commands/read-commands.server.ts";

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
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.error !== undefined && "code" in result.error && result.error.code === "ETIMEDOUT",
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
    /*
     * THE DIRECTOR'S EXPLICIT BITE. The withheld payload columns must not become available through
     * this read. Adding `metadata` to the select list is the smallest possible way to make them so.
     */
    label: "M1 the withheld payload columns enter the select list",
    file: SUBJECT_READ,
    suite: FIREWALL_SUITE,
    find: `      occurredAt: auditLog.occurredAt,\n      action: auditLog.action,\n      entityType: auditLog.entityType,\n      actorType: auditLog.actorType,`,
    replace: `      occurredAt: auditLog.occurredAt,\n      action: auditLog.action,\n      entityType: auditLog.entityType,\n      metadata: auditLog.metadata,\n      actorType: auditLog.actorType,`,
    expect: "no select list may name auditLog.metadata",
  },
  {
    /*
     * AND A WITHHELD IDENTIFIER MUST NOT REACH A CALLER AT RUNTIME EITHER — proved against REAL
     * ROWS, not by reading the source.
     *
     * This mutation is the one a well-meaning author would actually write: the subject id is
     * already in hand, so echoing it onto each act looks free. It is not. The moment a caller can
     * be handed a subject it did not already resolve, a filter has become a disclosure.
     *
     * It is deliberately NOT the select-list mutation M1 makes. That one cannot leak at runtime,
     * because the returned object is built field by field rather than spread — a second,
     * independent defence this pair measures rather than assumes.
     */
    label: "M2 a withheld identifier reaches a caller at runtime",
    file: SUBJECT_READ,
    suite: POSTGRES_SUITE,
    find: `      {\n        occurredAt: at.toISOString(),`,
    replace: `      {\n        entityId: subject.entityId,\n        occurredAt: at.toISOString(),`,
    expect: "the entity id is not echoed off the row",
  },
  {
    /* The entity id is a FILTER. Echoing it off the row turns a predicate into a disclosure. */
    label: "M3 the entity id is echoed off the row",
    file: SUBJECT_READ,
    suite: FIREWALL_SUITE,
    find: `      entityType: auditLog.entityType,\n      actorType: auditLog.actorType,`,
    replace: `      entityType: auditLog.entityType,\n      entityId: auditLog.entityId,\n      actorType: auditLog.actorType,`,
    expect: "no select list may name auditLog.entityId",
  },
  {
    /*
     * The subject predicate is the whole capability. Dropping the id turns "what did we do to this
     * work item" into "what did we do to any work item", while every line still reads correctly.
     */
    label: "M4 the subject predicate loses the entity id",
    file: SUBJECT_READ,
    suite: POSTGRES_SUITE,
    find: `    eq(auditLog.entityType, subject.entityType),\n    eq(auditLog.entityId, subject.entityId),`,
    replace: `    eq(auditLog.entityType, subject.entityType),`,
    expect: "the total counts this subject only",
  },
  {
    /* One expression, shared. A second tenant predicate would mask the removal of the first. */
    label: "M5 the tenant predicate is dropped from the subject scope",
    file: SUBJECT_READ,
    suite: POSTGRES_SUITE,
    find: `    eq(auditLog.tenantId, tenantId),\n    eq(auditLog.entityType, subject.entityType),`,
    replace: `    eq(auditLog.entityType, subject.entityType),`,
    expect: "the total counts this subject only",
  },
  {
    /*
     * `unrecognized-subject` collapsing into `empty` is the defect that would let a typo
     * manufacture an organizational claim.
     */
    label: "M6 an unaddressable subject renders as an empty history",
    file: OBSERVE,
    suite: POSTGRES_SUITE,
    find: `  if (!isAddressableActSubject(subject)) {\n    return { status: "unavailable", reason: "unrecognized-subject" };\n  }`,
    replace: `  if (!isAddressableActSubject(subject)) {\n    return {\n      status: "empty",\n      tenantId: tenant.tenantId,\n      subject,\n      generatedAt: (deps.now?.() ?? new Date()).toISOString(),\n    };\n  }`,
    expect: "the observer refuses it as unrecognized, never as empty",
  },
  {
    /* An empty record must never render as an empty world. */
    label: "M7 an empty subject history claims nothing happened",
    file: READ_COMMANDS,
    suite: TRUTH_SUITE,
    find: `  "Hebun has no recorded acts for this subject in this record.",`,
    replace: `  "Nothing happened to this subject.",`,
    expect: "the empty answer is about the record",
  },
  {
    /*
     * A subject that cannot be resolved must REFUSE. Falling through to the tenant-wide history
     * answers a question about one thing with a page about everything.
     */
    label: "M8 an unresolvable subject falls through to the whole ledger",
    file: READ_COMMANDS,
    suite: TRUTH_SUITE,
    find: `      if (subjectRef.length > 0) {\n        return await auditSubject(slash, subjectRef, tenant, deps);\n      }`,
    replace: `      if (subjectRef.length > 0 && subjectRef.includes("work-item/")) {\n        return await auditSubject(slash, subjectRef, tenant, deps);\n      }`,
    expect: "the subject branch must never reach the tenant-wide history",
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
      if (run.timedOut) {
        /* A HANGING CHILD IS NOT A VERDICT. Report it, never count it as a bite. */
        assert.fail(`${mutation.label}: ${mutation.suite} timed out — VOID, not bitten`);
      }
      assert.equal(run.ok, false, `${mutation.label}: ${mutation.suite} still passed`);
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: failed for the wrong reason — expected "${mutation.expect}"\n${run.output}`,
      );
      bitten += 1;
      console.log(`BITE ${mutation.label}`);
    });
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must bite");
  console.log(`subject-act-history-flow/subject-bite-proofs: ${bitten} mutations bit`);
}

main();
