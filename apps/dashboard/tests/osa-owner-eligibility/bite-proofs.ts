/*
 * OSA OWNER ELIGIBILITY HARDENING — BITE-PROOFS.
 *
 * The hardening is six conditions and one call site. Each is removed or weakened in the SHIPPED
 * SOURCE, and the suite defending it must fail — for the INTENDED reason, not merely for some
 * reason. A guard nobody has watched fail is a guard nobody has tested.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * Each child is bounded. A hanging bite-proof is not a verdict, so a child that exceeds its timeout
 * is reported VOID rather than counted as bitten.
 *
 * EVERY PROOF IS DEFENDED BY THE POSTGRES SUITE, deliberately. These are `where`-clause conditions:
 * a structural assertion can see that the text is present, but only a real database can show that
 * removing it lets an ineligible human become accountable.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const SUITE = "tests/osa-owner-eligibility/eligibility-postgres.ts";
const ELIGIBILITY = "src/features/auth-runtime/member-eligibility.ts";
const WRITER = "src/features/organization-authority/write-structure.server.ts";
const READER = "src/features/organization-authority/read-structure.server.ts";

/** Generous, but finite. The suite mints and migrates a database, so it is the slow one. */
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
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* CROSS-TENANT. The worst of the six: another organization's human becomes assignable. */
    label: "E1 the tenant predicate is dropped from the eligibility rule",
    file: ELIGIBILITY,
    find: `    eq(memberships.tenantId, tenantId),
    eq(memberships.status, ACTIVE_MEMBERSHIP_STATUS),
    eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),
  ] as SQL[];
}

/** The join the conditions above require.`,
    replace: `    eq(memberships.status, ACTIVE_MEMBERSHIP_STATUS),
    eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),
  ] as SQL[];
}

/** The join the conditions above require.`,
    expect: "the writer refuses another organization's human",
  },
  {
    /* THE ORIGINAL DEFECT, half of it: a revoked membership becomes assignable again. */
    label: "E2 the membership status condition is removed",
    file: ELIGIBILITY,
    find: `    eq(memberships.status, ACTIVE_MEMBERSHIP_STATUS),
    eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),`,
    replace: `    eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),`,
    expect: "the writer refuses a membership revoked by status while its revoked-at is still null",
  },
  {
    /*
     * THE SIBLING CONDITION, and the one that survived its first bite-proof in the previous
     * milestone. It bites here only because a fixture exists whose two revocation facts disagree.
     */
    label: "E3 the revoked-at condition is removed",
    file: ELIGIBILITY,
    find: `    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),`,
    replace: `    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),`,
    expect:
      "the writer refuses a membership revoked by timestamp while its status still says active",
  },
  {
    /* THE IDENTITY HALF. Without it a soft-deleted human can be recorded as accountable. */
    label: "E4 the soft-delete condition is removed",
    file: ELIGIBILITY,
    find: `    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),
  ] as SQL[];
}

/** The join the conditions above require.`,
    replace: `    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
  ] as SQL[];
}

/** The join the conditions above require.`,
    expect: "the writer refuses a soft-deleted identity",
  },
  {
    /* The other identity condition, isolated by its own fixture. */
    label: "E5 the identity lifecycle condition is removed",
    file: ELIGIBILITY,
    find: `    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),
  ] as SQL[];
}

/** The join the conditions above require.`,
    replace: `    isNull(memberships.revokedAt),
    isNull(users.deletedAt),
  ] as SQL[];
}

/** The join the conditions above require.`,
    expect: "the writer refuses an archived identity",
  },
  {
    /*
     * THE WIRING, NOT THE RULE. A developer pointing the writer at the membership-only subset is the
     * most plausible way this hardening gets quietly undone — the code still reads as if it checks
     * eligibility, and the identity half silently stops being enforced.
     */
    label: "E6 the writer is re-wired to the membership-only subset",
    file: WRITER,
    find: `    .where(eligibleTenantMemberWhere(tenantId, userId))`,
    /*
     * INLINED ON PURPOSE. A first version called `activeMembershipOnlyConditions`, which the writer
     * does not import — so it was a ReferenceError, the suite died at its first assertion, and the
     * proof "bit" for a reason that had nothing to do with eligibility. A mutation must COMPILE, or
     * it is testing the module loader.
     */
    replace: "    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, \"active\"), eq(memberships.lifecycleStatus, \"active\"), sql`${memberships.revokedAt} is null`, eq(users.id, userId)))",
    expect: "the writer refuses a soft-deleted identity",
  },
  {
    /*
     * THE DERIVED FLAG. Reverting the reader re-creates the contradiction this milestone removed:
     * the writer refusing a human the surface still calls a current active member.
     */
    label: "E7 the reader flag reverts to the permissive predicate",
    file: READER,
    find: `            ...activeMembershipOnlyConditions(tenant.tenantId),`,
    replace: `            eq(memberships.tenantId, tenant.tenantId),
            eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),`,
    expect: "the DERIVED flag says they are no longer an active member",
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
      const run = runSuite(SUITE);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${SUITE} still passed.\n` +
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
  console.log(`osa-owner-eligibility/bite-proofs: ${bitten} mutations bit`);
}

main();
