/*
 * DEPARTMENTAL PLACEMENT — BITE-PROOFS.
 *
 * Every guarantee this capability introduces is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * ── WHICH SUITE DEFENDS WHICH MUTATION ───────────────────────────────────────
 *
 * THE GATE AND THE PREDICATES ARE DEFENDED BY THE POSTGRES SUITE, on purpose. A structural
 * assertion can see that a tenant predicate is written; only a real database can tell a scoped
 * query from an unscoped one, and only a real database can show that removing the eligibility check
 * lets an authority record a revoked human as working somewhere.
 *
 * THE TRUTH SEMANTICS AND THE DISCLOSURE BOUNDARY ARE DEFENDED BY THE PURE SUITES, because what
 * must be proved there is a property of the composed grounding item, not of any row.
 *
 * Every mutation is chosen to COMPILE. A mutation that cannot resolve a name is testing the module
 * loader, and its `ReferenceError` would kill the suite for a reason unrelated to the guard.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/osa3-departmental-placement/placement-truth.ts";
const FIREWALL_SUITE = "tests/osa3-departmental-placement/firewall.ts";
const POSTGRES_SUITE = "tests/osa3-departmental-placement/placement-postgres.ts";

const FEATURE = "src/features/organization-authority";
const WRITER = `${FEATURE}/write-placement.server.ts`;
const READER = `${FEATURE}/read-placement.server.ts`;
const GROUNDING = `${FEATURE}/heby-placement-source.server.ts`;

/** Generous, but finite. The Postgres suite mints and migrates a database, so it is the slow one. */
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
    /*
     * THE GATE. Without it, recording where anybody works is available to anyone with a session —
     * exactly the thing this capability was authorized on condition of never becoming.
     */
    label: "P1 the Governance gate is removed from the placement writer",
    file: WRITER,
    suite: POSTGRES_SUITE,
    find: `  if (!authority.authorized) return { ok: false, result: refuse("not-authorized") };`,
    replace: `  void authority;`,
    expect: "a caller without Governance authority records nothing, and is told only that",
  },
  {
    /*
     * THE ELIGIBILITY RULE. Without it the authority records a revoked membership, a soft-deleted
     * identity and ANOTHER ORGANIZATION'S HUMAN as working in one of its departments. Only a real
     * database shows it, because the check is a query.
     */
    label: "P2 the eligible-member check is dropped from the placement writer",
    file: WRITER,
    suite: POSTGRES_SUITE,
    find: `      if (!(await isEligibleMember(tx, authenticated.tenantId, userId))) {
        outcome = refuse("human-not-active-member");
        return;
      }`,
    replace: `      void isEligibleMember;`,
    expect: "is refused, and with the SAME reason as every other cause",
  },
  {
    /*
     * TENANT ISOLATION IN THE READ. An unscoped register hands one organization another's people,
     * and only a real database can tell a scoped query from an unscoped one.
     */
    label: "P3 the tenant predicate is dropped from the placement read",
    file: READER,
    suite: POSTGRES_SUITE,
    find: `          eq(departmentPlacements.tenantId, tenant.tenantId),
          eq(departmentPlacements.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),`,
    replace: `          eq(departmentPlacements.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),`,
    expect: "Acme's placement is invisible to Globex",
  },
  {
    /*
     * WITHDRAWAL IS A LIFECYCLE, NEVER A DELETE. Archiving is what keeps the record that somebody
     * once worked there; a delete destroys it and looks identical from the register.
     */
    label: "P4 withdrawal soft-deletes the row instead of archiving it",
    file: WRITER,
    suite: POSTGRES_SUITE,
    find: `          lifecycleStatus: RETIRED_LIFECYCLE_STATUS,`,
    replace: `          deletedAt: now,`,
    /*
     * THE DEFECT IS INVISIBLE FROM THE REGISTER, which is what makes this mutation worth having:
     * the read filters on `deleted_at` too, so the surface still stops listing the placement and
     * the row is still there. Only the LIFECYCLE column shows it, so that is the assertion that
     * fires — the expectation names it rather than the sentence that reads best.
     */
    expect: "it was archived",
  },
  {
    /*
     * THE DISCLOSURE BOUNDARY, DESIGNED IN. Reaching for the address-floored product label is the
     * defect a whole milestone was spent closing one loop earlier. Aliased at the import so the
     * mutation COMPILES and the module still loads.
     */
    label: "P5 the placement projection reaches for the address-floored product label",
    file: GROUNDING,
    suite: FIREWALL_SUITE,
    find: `import { resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";`,
    replace: `import { resolveHumanLabels as resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";`,
    expect: "and never the product label that floors at an email address",
  },
  {
    /*
     * UNKNOWN MUST REMAIN UNKNOWN. Substituting any invented word for the declared constant is
     * exactly the guess this class forbids — and the most tempting one, because it reads better.
     */
    label: "P6 an unnamed human is given an invented name",
    file: GROUNDING,
    suite: TRUTH_SUITE,
    find: `  const named = name ?? PLACEMENT_LABEL_UNAVAILABLE;`,
    replace: `  const named = name ?? "A team member";`,
    expect: "an unnamed human reads as `name unavailable` with their identifier, and nothing else",
  },
  {
    /*
     * UNAVAILABLE != NONE RECORDED. Collapsing an outage into the measured absence would let Heby
     * tell a Director, on a database failure, that nobody in their organization works anywhere.
     */
    label: "P7 an unreachable register is reported as an empty one",
    file: GROUNDING,
    suite: TRUTH_SUITE,
    find: `  if (register.status !== "available") {
    return base(
      "unavailable",
      [],`,
    replace: `  if (register.status !== "available") {
    return base(
      "resolved",
      [],`,
    expect: "an unreachable authority is UNAVAILABLE",
  },
  {
    /*
     * THE IDENTIFIER IS NEVER ERASED. A "tidier" clause that drops it makes the readable name the
     * record, and a reader can no longer check what Hebun actually holds.
     */
    label: "P8 the placed human's identifier is dropped from grounding",
    file: GROUNDING,
    suite: TRUTH_SUITE,
    find: "`${named} (${placement.userId}) is recorded as working in ${placement.departmentName} `",
    replace: "`${named} is recorded as working in ${placement.departmentName} `",
    expect: "THE NAME IS NOT THE KEY — the identifier travels beside it",
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
  console.log(`osa3-departmental-placement/bite-proofs: ${bitten} mutations bit`);
}

main();
