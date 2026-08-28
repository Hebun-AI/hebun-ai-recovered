/*
 * Production migration authority — BOUNDARIES AND FIREWALL.
 *
 * Source-level properties: what this ceremony may reach, what it may never print, what it may never
 * be pointed at, and — the part that matters most — that building it did not weaken the four
 * ceremonies that already existed.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  PRODUCTION_CEREMONY_ENV,
  PRODUCTION_TARGET_DATABASE_ENV,
  PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
} from "../../scripts/lib/production-possession";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

/**
 * Source with comments and string literals removed.
 *
 * BOTH, not just comments. This repository has repeatedly had assertions fail on a file's own
 * honest prose — a refusal message naming the thing it refuses reads exactly like the thing itself
 * to a substring match. Strings go too, for the same reason.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");

const codeOf = (source: string): string =>
  withoutComments(source)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const MIGRATE_CLI = "scripts/platform-migrate.ts";
const MIGRATE_LIB = "scripts/lib/production-migration.ts";
const CANONICAL_LIB = "scripts/lib/canonical-migrations.ts";
const POSSESSION = "scripts/lib/production-possession.ts";

/** The four ceremonies that existed before this phase. None of them may have moved. */
const PRE_EXISTING_CEREMONIES = [
  "scripts/tenant-provision.ts",
  "scripts/genesis-nominate.ts",
  "scripts/tenant-lifecycle.ts",
  "scripts/provider-connectivity.ts",
] as const;

function collect(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs).flatMap((entry) => {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) return collect(rel);
    return /\.tsx?$/.test(entry) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE CEREMONY IS ARMED THE WAY EVERY OTHER CEREMONY IS ARMED
 * ═════════════════════════════════════════════════════════════════════════ */
function itUsesTheOneProductionAuthority(): void {
  const cli = codeOf(read(MIGRATE_CLI));

  assert.match(cli, /resolveCeremonyPosture\(process\.env\)/, "posture comes from the released resolver");
  assert.match(cli, /preflightEnvironment\(posture, databaseUrl\)/, "and routes through the shared preflight");
  assert.match(cli, /NODE_ENV === ""/, "NODE_ENV=production is refused, as in every ceremony");
  assert.match(cli, /isTTY/, "confirmation is TTY-only");

  /*
   * NO SECOND POSSESSION MODEL. The ceremony must not read the arming variables itself or invent
   * its own literal — it asks the released resolver, which owns the exact-literal rule.
   */
  for (const name of [
    PRODUCTION_CEREMONY_ENV,
    PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
    PRODUCTION_TARGET_DATABASE_ENV,
  ]) {
    assert.ok(!codeOf(read(MIGRATE_CLI)).includes(name), `the CLI must not name ${name} itself`);
    assert.ok(!codeOf(read(MIGRATE_LIB)).includes(name), `the mechanics must not name ${name}`);
  }

  /*
   * IT TAKES POSSESSION FROM THE IDENTITY HALF, DELIBERATELY — and must not fall back to the fused
   * check, which would deadlock it against the very gap it exists to close.
   */
  assert.match(cli, /verifyProductionIdentity\(client, environment\.posture\.expected\)/);
  assert.ok(!cli.includes("verifyProductionTarget"), "the migration ceremony does not use the fused check");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. IT CAN ONLY EVER APPLY COMMITTED CANONICAL MIGRATIONS
 * ═════════════════════════════════════════════════════════════════════════ */
function itIsNotAGenericSqlExecutor(): void {
  const whole = codeOf(read(MIGRATE_CLI));
  const cli = whole;
  const lib = codeOf(read(MIGRATE_LIB));

  /* No argument may name anything. The CLI refuses argv outright. */
  assert.match(cli, /process\.argv\.length > 2/, "the ceremony takes no arguments at all");

  /*
   * The engine call takes a FOLDER and nothing else, and the folder defaults to the canonical one.
   * There is no parameter for SQL, for a statement, or for a migration name anywhere in the seam.
   */
  assert.match(
    lib,
    /export async function applyPendingMigrations\(client: Client, migrationsFolder: string = MIGRATIONS_DIR\)/,
    "the executor takes a client and a migrations FOLDER — no SQL, no statement, no file",
  );
  assert.match(
    lib,
    /await migrate\(drizzle\(\{ client \}\), \{ migrationsFolder \}\)/,
    "and hands that folder straight to the canonical engine over this verified connection",
  );

  /*
   * THE CEREMONY CALLS IT WITH THE DEFAULT FOLDER AND NOTHING ELSE. A second argument would let an
   * environment variable point the engine at migrations that are not in this commit.
   */
  const body = whole.slice(whole.indexOf("async function main("));
  assert.match(
    body,
    /await applyPendingMigrations\(client\);/,
    "the ceremony applies the COMMITTED canonical folder and cannot be pointed elsewhere",
  );

  /* Nothing in the seam executes raw SQL that a caller could have influenced. */
  for (const [label, source] of [
    ["CLI", cli],
    ["mechanics", lib],
    ["canonical", codeOf(read(CANONICAL_LIB))],
  ] as const) {
    assert.ok(!/\bsql\.raw\b/.test(source), `${label} must not reach sql.raw`);
    assert.ok(!/readFileSync\([^)]*argv/.test(source), `${label} must not read a file named by argv`);
    assert.ok(!/\bexecSync\b/.test(source), `${label} must not use execSync — argv must be a list`);
  }

  /*
   * `execFileSync` ONLY, and never `exec`/`execSync`. A shell string is how a connection string
   * ends up in shell history and in `ps`; an argv array cannot be word-split.
   */
  assert.ok(lib.includes("execFileSync"), "the backup shells out through execFileSync");

  /*
   * THE ARCHIVE IS VALIDATED, NOT MERELY WRITTEN. A file of the right size is not a restorable
   * dump; `pg_restore -l` parsing its table of contents is the cheapest proof that it is one.
   */
  const rawLib = read(MIGRATE_LIB);
  assert.ok(rawLib.includes('"pg_restore"'), "the backup is validated with pg_restore");
  assert.match(rawLib, /execFileSync\("pg_restore", \["-l", target\]/, "by listing its table of contents");

  /*
   * THE MIGRATION EXECUTOR IS NOT REACHABLE FROM ANOTHER CEREMONY. Only the migration CLI may
   * import it — otherwise a ceremony with no confirmation and no backup could apply migrations.
   */
  /*
   * COMMENTS STRIPPED, STRINGS KEPT. An import specifier IS a string literal, so running this
   * through `codeOf` would erase the very thing being looked for and leave an assertion that could
   * never fail. Comments still go, so a module naming itself in its own header is not an importer.
   */
  const importers = collect("scripts")
    .filter((f) => f !== MIGRATE_LIB)
    .filter((f) => withoutComments(read(f)).includes("production-migration"));
  assert.deepEqual(
    importers.sort(),
    [MIGRATE_CLI],
    "only the migration ceremony may import the migration mechanics",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. SECRETS
 * ═════════════════════════════════════════════════════════════════════════ */
function theConnectionStringIsNeverExposed(): void {
  const cli = read(MIGRATE_CLI);
  const lib = read(MIGRATE_LIB);

  /*
   * NOTHING PRINTS THE URL. Asserted on the RAW source, comments included: a comment that prints it
   * is not a risk, but a `console.log` hidden behind one is, and the raw read is the strict version.
   */
  for (const [label, source] of [
    ["CLI", cli],
    ["mechanics", lib],
  ] as const) {
    for (const sink of ["console.log", "console.error", "console.warn"]) {
      const printed = source
        .split("\n")
        .filter((line) => line.includes(sink) && /databaseUrl|connectionString|DATABASE_URL/.test(line));
      assert.deepEqual(printed, [], `${label} must never print the connection string via ${sink}`);
    }
  }

  /*
   * AND IT NEVER REACHES A CHILD'S ARGV. `pg_dump -d "$DATABASE_URL"` is the natural way to write
   * this and it publishes the password to the process table, where any user on the machine reads it
   * with `ps`. The URL goes into the child's ENVIRONMENT instead — so the argv array must not
   * mention it, and `-d`/`--dbname` must not appear at all.
   */
  const argvLines = lib
    .split("\n")
    .filter((line) => /execFileSync\(/.test(line) || /^\s*\[?"-/.test(line));
  for (const line of argvLines) {
    assert.ok(
      !/connectionString|databaseUrl|DATABASE_URL/.test(line),
      `the connection string must not appear in a child's argv: ${line.trim()}`,
    );
  }
  assert.ok(
    !/"--?d(bname)?"/.test(codeOf(lib).replace(/""/g, (m) => m)) && !lib.includes('"-d"') && !lib.includes('"--dbname"'),
    "pg_dump must take its connection from PG* env vars, never from -d",
  );
  assert.ok(lib.includes("libpqEnvFor"), "and the decomposition helper is what supplies them");

  /* The mechanics never write a file that could hold the secret. */
  assert.ok(!codeOf(lib).includes("writeFileSync"), "the mechanics write no file of their own");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. BACKUP AND CONFIRMATION COME BEFORE THE MUTATION
 * ═════════════════════════════════════════════════════════════════════════ */
function nothingIsAppliedBeforeABackupAndAHuman(): void {
  /*
   * SCOPED TO THE FUNCTION BODY, NOT THE MODULE.
   *
   * A module-wide `indexOf` finds the IMPORT BLOCK first, where these names appear in alphabetical
   * order and not in execution order — so every ordering assertion below would have been measuring
   * how the imports are sorted. This repository has been bitten by exactly that before.
   */
  const whole = codeOf(read(MIGRATE_CLI));
  const cli = whole.slice(whole.indexOf("async function main("));
  assert.ok(cli.length > 0 && cli.length < whole.length, "the ceremony body was located");

  const identity = cli.indexOf("verifyProductionIdentity");
  const lock = cli.indexOf("acquireMigrationLock");
  const prefix = cli.indexOf("verifyCanonicalMigrationPrefix");
  const backup = cli.indexOf("createValidatedBackup");
  const confirm = cli.indexOf("promptVisible");
  const apply = cli.indexOf("applyPendingMigrations");

  for (const [label, index] of [
    ["identity", identity],
    ["lock", lock],
    ["prefix", prefix],
    ["backup", backup],
    ["confirmation", confirm],
    ["apply", apply],
  ] as const) {
    assert.ok(index > -1, `${label} must appear in the ceremony`);
  }

  assert.ok(identity < lock, "possession is proved before the lock is taken");
  assert.ok(lock < prefix, "the lock is taken before the ledger is read, so a peer cannot race it");
  assert.ok(prefix < backup, "a divergent target is refused before a backup is even attempted");
  assert.ok(backup < confirm, "the backup is validated BEFORE a human is asked to confirm");
  assert.ok(confirm < apply, "and nothing is applied before they answer");

  /* A refused backup ends the ceremony. */
  assert.match(cli, /if \(backup\.status === ""\) fail\(""/, "a refused backup fails the ceremony");
  /* A mismatched confirmation ends it too. */
  assert.match(cli, /if \(answer !== String\(prefix\.pending\.length\)\)/, "the answer must match exactly");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. FAILURE SEMANTICS ARE DISTINCT
 * ═════════════════════════════════════════════════════════════════════════ */
function everyOutcomeHasItsOwnName(): void {
  const source = read(MIGRATE_CLI);
  for (const outcome of [
    "NOT_ARMED",
    "TARGET_UNVERIFIED",
    "TARGET_MISMATCH",
    "LEDGER_AHEAD",
    "LEDGER_DIVERGED",
    "ALREADY_CONVERGED",
    "BACKUP_FAILED",
    "CONFIRMATION_REFUSED",
    "MIGRATION_FAILED",
    "POST_VERIFY_FAILED",
    "SUCCESS",
  ]) {
    assert.ok(source.includes(`"${outcome}"`), `${outcome} must be a named outcome`);
  }

  /*
   * A POST-VERIFY FAILURE IS NOT A MIGRATION FAILURE, and neither is a success. The distinction is
   * the whole point of the list: "the engine ran" and "the target is now the release" are different
   * claims, and collapsing them is how a green ceremony reports a schema it never confirmed.
   */
  const cli = codeOf(read(MIGRATE_CLI));
  assert.match(
    cli,
    /if \(after\.status !== ""\) \{/,
    "a target that is not converged after migrating is a FAILURE, never a success",
  );
  assert.match(cli, /if \(after\.digest !== expectedDigest\)/, "the final digest is checked");
  assert.ok(
    cli.indexOf("expectedDigest") < cli.lastIndexOf(""),
    "and it is checked before success is announced",
  );

  /* No fabricated rollback: the ceremony reports the ledger it OBSERVES after a failure. */
  const failureBlock = read(MIGRATE_CLI).slice(read(MIGRATE_CLI).indexOf("engineError !== null"));
  assert.match(failureBlock, /Observed ledger AFTER the failure/, "a failure reports observed state");
  assert.ok(
    !/rolled back\b(?![^.]*REPORTED)/.test(failureBlock.split("\n").slice(0, 20).join("\n")),
    "and never claims a rollback as a guarantee",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE FOUR EXISTING CEREMONIES DID NOT MOVE
 * ═════════════════════════════════════════════════════════════════════════ */
function noExistingCeremonyWasWeakened(): void {
  /*
   * THE FUSED CHECK IS STILL FUSED. `verifyProductionTarget` still refuses on a stale ledger — that
   * is what every row-writing ceremony depends on, and the split must not have relaxed it.
   */
  const possession = codeOf(read(POSSESSION));
  assert.match(
    possession,
    /if \(observed\.appliedMigrations !== expectedMigrations\) \{/,
    "verifyProductionTarget still refuses a target whose ledger is not the authored one",
  );
  assert.match(possession, /reason: ""/, "and still by a named refusal");
  assert.ok(
    possession.includes("export async function verifyProductionTarget"),
    "and it is still exported under its released name",
  );

  /* Identity is still judged before convergence — a wrong database must never read as a stale one. */
  const target = possession.slice(possession.indexOf("export async function verifyProductionTarget"));
  assert.ok(
    target.indexOf("verifyProductionIdentity") < target.indexOf("appliedMigrations !== expectedMigrations"),
    "identity is still resolved before the ledger is judged",
  );

  /* The shared preflight still calls the FUSED check, so the four ceremonies keep their behaviour. */
  const preflight = codeOf(read("scripts/lib/ceremony-preflight.ts"));
  assert.match(preflight, /verifyProductionTarget\(/, "the shared preflight still uses the fused check");
  assert.ok(
    !preflight.includes("verifyProductionIdentity"),
    "and must not quietly switch to identity-only, which would loosen all four ceremonies at once",
  );

  /* And none of the four learned anything about migrations. */
  for (const ceremony of PRE_EXISTING_CEREMONIES) {
    const source = codeOf(read(ceremony));
    assert.ok(!source.includes("applyPendingMigrations"), `${ceremony} must not apply migrations`);
    assert.ok(!source.includes("production-migration"), `${ceremony} must not reach the migration mechanics`);
    assert.ok(!source.includes("verifyProductionIdentity"), `${ceremony} must keep the fused check`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. NOTHING UNDER src/ CAN REACH ANY OF THIS
 * ═════════════════════════════════════════════════════════════════════════ */
function theProductIsWalledOff(): void {
  const srcFiles = collect("src");
  for (const name of [
    "applyPendingMigrations",
    "verifyProductionIdentity",
    "verifyCanonicalMigrationPrefix",
    "acquireMigrationLock",
    "platform-migrate",
    "production-migration",
    "canonical-migrations",
  ]) {
    const namers = srcFiles.filter((f) => codeOf(read(f)).includes(name));
    assert.deepEqual(namers, [], `no file under src may name ${name}`);
  }

  /* No route, server action or Heby command reaches scripts/ at all. */
  const routes = srcFiles.filter((f) => /(^|\/)route\.tsx?$/.test(f));
  for (const route of routes) {
    assert.ok(!codeOf(read(route)).includes("scripts/"), `${route} must not reach scripts/`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THIS PHASE AUTHORED NO MIGRATION
 * ═════════════════════════════════════════════════════════════════════════ */
function itIsInfrastructureNotSchema(): void {
  const files = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(files.length, 38, "the production migration AUTHORITY authors no migration of its own");
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as { entries: unknown[] };
  assert.equal(journal.entries.length, 38, "and the journal agrees");
}

function main(): void {
  itUsesTheOneProductionAuthority();
  itIsNotAGenericSqlExecutor();
  theConnectionStringIsNeverExposed();
  nothingIsAppliedBeforeABackupAndAHuman();
  everyOutcomeHasItsOwnName();
  noExistingCeremonyWasWeakened();
  theProductIsWalledOff();
  itIsInfrastructureNotSchema();
  console.log("prodmig-flow/boundaries-and-firewall: OK");
}

main();
