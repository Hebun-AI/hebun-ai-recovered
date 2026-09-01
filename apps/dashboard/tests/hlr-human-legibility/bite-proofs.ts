/*
 * HUMAN LEGIBILITY REACH — BITE-PROOFS.
 *
 * Every guarantee this milestone introduces is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * Each child is bounded. A hanging bite-proof is not a verdict, so a child that exceeds its timeout
 * is reported VOID rather than counted as bitten.
 *
 * THE GATE AND THE PREDICATE MUTATIONS ARE DEFENDED BY THE POSTGRES SUITE ON PURPOSE. A structural
 * assertion can see that a tenant predicate is written; only a real database can tell a scoped query
 * from an unscoped one, and only a real database can show that removing the authority gate hands a
 * stranger the organization's people.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const FIREWALL_SUITE = "tests/hlr-human-legibility/legibility-firewall.ts";
const POSTGRES_SUITE = "tests/hlr-human-legibility/legibility-postgres.ts";

const MODULE = "src/features/auth-runtime/human-label-read.server.ts";
const PANEL = "src/components/organization-domain/department-structure.tsx";

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
     * THE GATE. Without it this read is a directory anybody with a session can open — which is
     * exactly the thing the milestone was authorized on condition of never becoming.
     */
    label: "H1 the authority gate is removed from the member read",
    file: MODULE,
    suite: POSTGRES_SUITE,
    find: `  if (!authority.authorized) return { ok: false, reason: "not-authorized" };`,
    replace: `  void authority;`,
    expect: "a caller without Governance authority receives no members, and is told why",
  },
  {
    /*
     * TENANT ISOLATION IN THE PICKER. A missing tenant predicate offers one organization's people
     * to another, and only a real database can show it.
     */
    label: "H2 the tenant predicate is dropped from the member read",
    file: MODULE,
    suite: POSTGRES_SUITE,
    find: `          eq(memberships.tenantId, opened.tenantId),
          eq(memberships.lifecycleStatus, "active"),`,
    replace: `          eq(memberships.lifecycleStatus, "active"),`,
    /*
     * The suite catches this on the ACME side first — an unscoped read offers Globex's human to
     * Acme before the Globex-side assertion is ever reached. Same defect, earlier sentence, and the
     * expectation names the assertion that actually fires rather than the one that reads best.
     */
    expect: "another organization's human is never offered as accountable",
  },
  {
    /*
     * TENANT ISOLATION IN THE LABEL READ. The same defect on the other seam, and the one a caller
     * could exploit with an identifier they already hold.
     */
    label: "H3 the tenant predicate is dropped from the label read",
    file: MODULE,
    suite: POSTGRES_SUITE,
    find: `          eq(memberships.tenantId, opened.tenantId),
          inArray(users.id, wanted),`,
    replace: `          inArray(users.id, wanted),`,
    expect: "another organization's identifier resolves to nothing",
  },
  {
    /*
     * REVOKED IS NOT ACTIVE. The picker must never offer somebody whose membership ended — and the
     * writer would ACCEPT them, so nothing downstream catches this.
     */
    label: "H4 a membership revoked by timestamp becomes selectable",
    file: MODULE,
    suite: POSTGRES_SUITE,
    find: `          isNull(memberships.revokedAt),`,
    replace: ``,
    /*
     * THIS PROOF SURVIVED ONCE, and that is why it is worth reading. Every revoked fixture also
     * carried `status = 'revoked'`, so the sibling predicate caught the mutation and the suite went
     * on passing — a guard that looked proved and was not. The fixture whose two revocation facts
     * DISAGREE is what makes this predicate independently load-bearing.
     */
    expect: "a membership revoked by timestamp is never offered as accountable",
  },
  {
    /*
     * THE DIFFERENCE FROM DELEGATION, PROVED BY INTRODUCING IT. Inheriting the self-exclusion is the
     * single most plausible mistake this milestone could have made — it would have returned an empty
     * picker for the one organization in production.
     */
    label: "H5 the caller is excluded, as delegation excludes them",
    file: MODULE,
    suite: POSTGRES_SUITE,
    find: `          eq(users.lifecycleStatus, "active"),
          isNull(users.deletedAt),`,
    replace: `          eq(users.lifecycleStatus, "active"),
          isNull(users.deletedAt),
          sql\`\${users.id} not in (select actor_id from decision_records where tenant_id = \${opened.tenantId}::uuid and bootstrap = true)\`,`,
    expect: "the current authority holder may own a department",
  },
  {
    /*
     * A FORMER MEMBER MUST STAY LEGIBLE. Filtering the label read by active membership puts a bare
     * uuid on exactly the row whose history matters most.
     */
    label: "H6 the label read starts filtering on active membership",
    file: MODULE,
    suite: POSTGRES_SUITE,
    find: `          eq(memberships.tenantId, opened.tenantId),
          inArray(users.id, wanted),
          isNull(users.deletedAt),`,
    replace: `          eq(memberships.tenantId, opened.tenantId),
          inArray(users.id, wanted),
          isNull(users.deletedAt),
          eq(memberships.status, "active"),`,
    expect: "a human the records still name is still readable after their membership ends",
  },
  {
    /*
     * A LABEL IS NOT AN IDENTITY KEY. The option submitting its own text instead of the identifier
     * is the defect that would make a renamed human unassignable and a record unreadable.
     */
    label: "H7 the owner control submits the label instead of the identifier",
    file: PANEL,
    suite: FIREWALL_SUITE,
    find: `<option key={member.userId} value={member.userId}>`,
    replace: `<option key={member.userId} value={member.label}>`,
    expect: "the label is never the key",
  },
  {
    /*
     * UNRESOLVED != NOBODY. Substituting a placeholder for a missing label is inventing human data,
     * which is the one thing a legibility feature must never do.
     */
    label: "H8 a missing label is filled with an invented name",
    file: PANEL,
    suite: FIREWALL_SUITE,
    find: `              <span className="italic">{LABEL_UNAVAILABLE}</span>`,
    replace: `              <span className="italic">{"Unknown"}</span>`,
    expect: "an unresolved human is RENDERED as unresolved, from the declared constant",
  },
  {
    /*
     * THE IDENTIFIER IS NEVER ERASED. A surface showing only a label has quietly made the label the
     * record, and a reader can no longer check what Hebun actually holds.
     */
    label: "H9 the recorded identifier is dropped from the surface",
    file: PANEL,
    suite: FIREWALL_SUITE,
    find: `            <span className="font-mono text-fg-muted">{department.owner.actorId}</span>`,
    replace: ``,
    expect: "the recorded identifier is still rendered",
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
  console.log(`hlr-human-legibility/bite-proofs: ${bitten} mutations bit`);
}

main();
