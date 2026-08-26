/*
 * Production migration authority — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source on disk.
 *
 * ── EVERY RUN IS BOUNDED ─────────────────────────────────────────────────────
 *
 * A mutation that makes a ceremony BLOCK rather than refuse would hang this file forever, and a
 * hanging bite-proof is not a verdict — it is an absence of one. So each child gets a timeout, and
 * a child that exceeds it is reported as VOID rather than silently counted as bitten. This
 * repository has been bitten by exactly that before.
 *
 * No production database is touched, no provider is contacted, and no secret is read. The database
 * mutations run against disposable databases the defending suite creates and drops for itself.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const PG_SUITE = "tests/prodmig-flow/canonical-prefix-postgres.ts";
const FIREWALL_SUITE = "tests/prodmig-flow/boundaries-and-firewall.ts";
const VERSION_SUITE = "tests/prodmig-flow/server-version-gate.ts";

const CLI = "scripts/platform-migrate.ts";
const MECHANICS = "scripts/lib/production-migration.ts";
const CANONICAL = "scripts/lib/canonical-migrations.ts";
const POSSESSION = "scripts/lib/production-possession.ts";
const OTHER_CEREMONY = "scripts/tenant-provision.ts";

/** Generous, but finite. The slowest defending suite here migrates several databases. */
const CHILD_TIMEOUT_MS = 15 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  /** True when the child was killed for exceeding the timeout — a VOID result, not a verdict. */
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
    label: "M1 production arming is removed — the ceremony stops asking the released resolver",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: "  const posture = resolveCeremonyPosture(process.env);",
    replace: '  const posture = { mode: "local" as const, source: "local-operator-ceremony" as const };',
    expect: "posture comes from the released resolver",
  },
  {
    label: "M2 the system_identifier check is defeated — any cluster binds",
    file: POSSESSION,
    suite: PG_SUITE,
    find: "  if (observed.systemIdentifier !== expected.systemIdentifier) {",
    replace: "  if (false as boolean) {",
    expect: "the cluster pin is enforced",
  },
  {
    label: "M3 the current_database check is defeated — a neighbouring database binds",
    file: POSSESSION,
    suite: PG_SUITE,
    find: "  if (observed.database !== expected.database) {",
    replace: "  if (false as boolean) {",
    expect: "the database pin is enforced",
  },
  {
    label: "M4 a non-prefix ledger is accepted — a divergent lineage is migrated",
    file: CANONICAL,
    suite: PG_SUITE,
    find: "    if (!here || there.hash !== here.hash || there.createdAt !== here.when) {",
    replace: "    if (false as boolean) {",
    expect: "ledger-diverged",
  },
  {
    label: "M5 a target AHEAD of this repository is accepted",
    file: CANONICAL,
    suite: PG_SUITE,
    find: "  if (applied.length > canonical.length) {",
    replace: "  if (false as boolean) {",
    expect: "ledger-ahead",
  },
  {
    label: "M6 the backup is skipped entirely",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: "    const backup = createValidatedBackup({",
    replace: "    const backup = ((_: unknown) => ({ status: <string>\"created\", file: \"\", bytes: 0, entries: 0 }))({",
    expect: "backup must appear in the ceremony",
  },
  {
    label: "M7 the backup is written but never validated",
    file: MECHANICS,
    suite: FIREWALL_SUITE,
    find: 'execFileSync("pg_restore", ["-l", target], {',
    replace: 'execFileSync("true", [], {',
    expect: "the backup is validated with pg_restore",
  },
  {
    label: "M8 a piped stdin may authorize a production migration",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: "    if (!input.isTTY) {",
    replace: "    if (false as boolean) {",
    expect: "confirmation is TTY-only",
  },
  {
    label: "M9 the connection string is printed to the operator's terminal",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: '    console.log(`  posture    : ${environment.posture.mode.toUpperCase()}`);',
    replace:
      '    console.log(`  url        : ${databaseUrl}`);\n' +
      '    console.log(`  posture    : ${environment.posture.mode.toUpperCase()}`);',
    expect: "must never print the connection string via console.log",
  },
  {
    label: "M10 the executor is widened to accept arbitrary SQL",
    file: MECHANICS,
    suite: FIREWALL_SUITE,
    find:
      "export async function applyPendingMigrations(client: Client, migrationsFolder: string = MIGRATIONS_DIR): Promise<void> {",
    replace:
      "export async function applyPendingMigrations(client: Client, migrationsFolder: string = MIGRATIONS_DIR, extraSql?: string): Promise<void> {\n" +
      "  if (extraSql) await client.query(extraSql);",
    expect: "the executor takes a client and a migrations FOLDER",
  },
  {
    label: "M11 the ceremony applies a migrations folder named by the environment",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: "      await applyPendingMigrations(client);",
    replace: "      await applyPendingMigrations(client, process.env.HEBUN_MIGRATIONS ?? undefined);",
    expect: "cannot be pointed elsewhere",
  },
  {
    label: "M12 the final ledger digest is never checked",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: "    if (after.digest !== expectedDigest) {",
    replace: "    if (false as boolean) {",
    expect: "the final digest is checked",
  },
  {
    label: "M13 two ceremonies may run concurrently — the lock always reports success",
    file: MECHANICS,
    suite: PG_SUITE,
    find: "  return result.rows[0]?.locked === true;",
    replace: "  void result;\n  return true;",
    expect: "the second is refused, not queued",
  },
  {
    label: "M14 a target left unconverged after migrating is reported as success",
    file: CLI,
    suite: FIREWALL_SUITE,
    find: '    if (after.status !== "converged") {',
    replace: "    if (false as boolean) {",
    expect: "never a success",
  },
  /*
   * M16–M18 defend the SERVER-VERSION GATE, which shipped inert.
   *
   * The released ceremony read `rows[0].v` from a query whose column is `server_version`, so the
   * version was `undefined`, the major came out 0, and `dumpMajor < serverMajor` was false for
   * every pg_dump alive. These three mutations restore each half of that failure in turn: a parser
   * that answers 0 instead of refusing, a ceremony that reads the column that does not exist, and
   * the comparison itself.
   */
  {
    label: "M16 an unparseable version degrades to major 0 instead of refusing",
    file: MECHANICS,
    suite: VERSION_SUITE,
    find: "  if (!Number.isInteger(major) || major < 1) {",
    replace: "  if (false as boolean) {",
    expect: "zero major must refuse, not resolve",
  },
  {
    label: "M17 the ceremony goes back to reading a column named v",
    file: CLI,
    suite: VERSION_SUITE,
    find: "    const server = await readServerVersion(client);",
    replace:
      '    const server = parsePostgresVersion((await client.query<{ v: string }>("show server_version")).rows[0]!.v);',
    expect: "no query anywhere claims a column named v",
  },
  {
    label: "M18 the pg_dump compatibility comparison is defeated — every pg_dump is old enough",
    file: MECHANICS,
    suite: VERSION_SUITE,
    find: "  if (dumpMajor < serverMajor) {",
    replace: "  if (false as boolean) {",
    expect: "pg_dump 14 may not back up a PostgreSQL 18 server",
  },
  {
    label: "M15 another production ceremony gains the migration executor",
    file: OTHER_CEREMONY,
    suite: FIREWALL_SUITE,
    find: 'import { resolveCeremonyPosture } from "./lib/production-possession";',
    replace:
      'import { resolveCeremonyPosture } from "./lib/production-possession";\n' +
      'import { applyPendingMigrations } from "./lib/production-migration";',
    expect: "only the migration ceremony may import the migration mechanics",
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
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. ` +
          "That is a VOID result, not a bite — the mutation may have made the ceremony block " +
          "rather than refuse.",
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
  console.log(`prodmig-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
