/*
 * Production migration authority — THE SERVER-VERSION GATE.
 *
 * This file exists because of a defect that reached production. The migration banner printed
 *
 *     server     : PostgreSQL undefined
 *
 * and a read-only preflight against the same cluster afterwards proved exactly why:
 *
 *     show server_version -> rows[0] keys: ["server_version"]
 *     show server_version -> value: "18.6 (3484359)"
 *
 * The ceremony read `rows[0].v`, because the query was typed `client.query<{ v: string }>`. A
 * TypeScript generic on a database call renames no column and validates nothing — it asserts a
 * runtime shape that no one checks. So the value was `undefined`, and the old major-version helper
 * (`Number(/(\d+)/.exec(version)?.[1] ?? "0")`) turned `undefined` into the string "undefined",
 * found no digits, and answered 0.
 *
 * Zero is the one answer that disarms the gate it feeds: `dumpMajor < serverMajor` is false for
 * EVERY pg_dump when the server major is 0. The early `pg_dump-too-old` refusal was inert — failing
 * open, in silence, in a ceremony whose entire job is to fail closed.
 *
 * The real production migration was NOT invalidated by this: the backup itself is fail-closed, and
 * the ceremony ran pg_dump 18.3 against PostgreSQL 18.6 and produced a validated archive. What was
 * lost was the EARLY refusal, not the safety.
 *
 * ── HOW THE COMPATIBILITY CASES ARE PROVED ───────────────────────────────────
 *
 * With a real `pg_dump` on a temporary PATH — a small executable that reports whichever version the
 * case needs. The released `createValidatedBackup` is called unmodified and resolves `pg_dump` off
 * PATH exactly as it does in the ceremony, so the version comparison under test is the shipped one
 * rather than a re-implementation of it. No database is required for a refusal, because the version
 * gate is reached before any connection is spent.
 */
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import {
  createValidatedBackup,
  parsePostgresVersion,
  readServerVersion,
} from "../../scripts/lib/production-migration";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

/*
 * Source with comments AND string literals removed — the repository's standing convention.
 *
 * Both, not just comments: this file's own subject matter is a defective helper, and the module it
 * inspects now explains that defect in prose. A substring match cannot tell an explanation of
 * `majorOf` apart from a call to it, so the prose goes before the assertion runs.
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

/** The exact string the production cluster reported, kept verbatim so this test cannot drift. */
const PRODUCTION_SERVER_VERSION = "18.6 (3484359)";

/** A `PostgresVersion` built the only way one can be built — through the released parser. */
function version(raw: string): { readonly raw: string; readonly major: number } {
  const parsed = parsePostgresVersion(raw);
  assert.equal(parsed.status, "parsed", `the fixture version ${JSON.stringify(raw)} must parse`);
  if (parsed.status !== "parsed") throw new Error("unreachable");
  return parsed.version;
}

/**
 * Run `body` with a temporary directory FIRST on PATH holding a `pg_dump` that reports `reported`.
 *
 * The stub prints a version for `--version` and fails for anything else, which is the honest shape:
 * this file proves the VERSION GATE, and a stub that pretended to produce an archive would be
 * proving a dump that never happened.
 */
function withStubPgDump<T>(reported: string, body: () => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-pgdump-stub-"));
  const stub = path.join(dir, "pg_dump");
  writeFileSync(
    stub,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo '${reported}'; exit 0; fi\n` +
      `echo 'stub pg_dump does not dump' >&2\nexit 1\n`,
    "utf8",
  );
  chmodSync(stub, 0o755);
  const previous = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${previous ?? ""}`;
  try {
    return body();
  } finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A scratch directory that is neither inside the repository nor inside a synchronized folder. */
function withScratch<T>(body: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-versiongate-"));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The version verdict of the released backup for one (pg_dump, server) pair.
 *
 * `refused-too-old` means the gate fired. `passed-version-gate` means it did not — proved by the
 * refusal being about the DUMP rather than about the versions, since the stub cannot dump.
 */
function versionVerdict(dumpVersion: string, serverVersion: string): string {
  return withScratch((dir) =>
    withStubPgDump(dumpVersion, () => {
      const result = createValidatedBackup({
        /* Never connected to: every case here refuses before pg_dump is asked to dump anything. */
        connectionString: "postgresql://nobody@127.0.0.1:1/nothing",
        serverVersion: version(serverVersion),
        directory: dir,
        filename: "version-gate.dump",
        repositoryRoot: ROOT,
      });
      if (result.status === "created") return "created";
      return result.reason === "pg_dump-too-old" ? "refused-too-old" : `passed-version-gate:${result.reason}`;
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE PRODUCTION ROW SHAPE
 * ═════════════════════════════════════════════════════════════════════════ */
function theProductionRowResolvesToEighteen(): void {
  /* PROOF 1 — the exact row the production cluster returned. */
  const parsed = parsePostgresVersion(PRODUCTION_SERVER_VERSION);
  assert.equal(parsed.status, "parsed", "the production server version must parse");
  if (parsed.status !== "parsed") return;
  assert.equal(parsed.version.major, 18, "PostgreSQL 18.6 (3484359) is major 18");
  assert.equal(parsed.version.raw, PRODUCTION_SERVER_VERSION, "and the raw string is preserved verbatim");

  /*
   * THE BUILD IDENTIFIER IS NOT A VERSION. An unanchored digit search could pull `3484359` out of
   * this string if the leading token were ever malformed; inventing a major version out of a build
   * number is the same class of failure as inventing 0.
   */
  assert.notEqual(parsed.version.major, 3_484_359, "the build identifier is never mistaken for a major");

  /* Ordinary shapes, from real servers this repository actually runs against. */
  assert.equal(version("14.20 (Homebrew)").major, 14);
  assert.equal(version("15.4").major, 15);
  assert.equal(version("18.6").major, 18);
  assert.equal(version("10").major, 10, "a bare major is a version");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. EVERY UNUSABLE VERSION REFUSES — NOTHING BECOMES 0
 * ═════════════════════════════════════════════════════════════════════════ */
function anUnusableVersionCanNeverBecomeZero(): void {
  const unusable: readonly (readonly [string, unknown])[] = [
    /* PROOF 6 — the exact production failure: the field that did not exist. */
    ["undefined", undefined],
    ["null", null],
    /* PROOF 7 — empty and blank. */
    ["empty", ""],
    ["blank", "   "],
    /* PROOF 8 — malformed. */
    ["prose", "PostgreSQL"],
    ["leading junk", "v18.6"],
    ["build id only", "(3484359)"],
    ["NaN", Number.NaN],
    ["zero number", 0],
    ["a number, not a string", 18],
    ["an object", { major: 18 }],
    ["negative", "-18.6"],
    ["zero major", "0.9"],
  ];

  for (const [label, raw] of unusable) {
    const parsed = parsePostgresVersion(raw);
    assert.equal(parsed.status, "refused", `${label} must refuse, not resolve`);
    if (parsed.status !== "refused") continue;
    assert.ok(parsed.detail.length > 0, `${label} must refuse with a reason an operator can read`);
  }

  /*
   * PROOF 9 — A ROW-SHAPE MISMATCH CANNOT SILENTLY BECOME VERSION 0.
   *
   * This reconstructs the shipped defect precisely: a row whose column is `server_version`, read
   * under a generic that claims the column is `v`. The generic is a lie the compiler believes, so
   * the value is `undefined` at runtime — and the parser refuses it instead of answering 0.
   */
  const productionRow: Record<string, unknown> = { server_version: PRODUCTION_SERVER_VERSION };
  const asTheOldCodeReadIt = (productionRow as { v?: string }).v;
  assert.equal(asTheOldCodeReadIt, undefined, "the old field name yields undefined against the real row");
  const wrong = parsePostgresVersion(asTheOldCodeReadIt);
  assert.equal(wrong.status, "refused", "a row-shape mismatch REFUSES");

  /*
   * And the fail-open arithmetic is gone from the source, not merely unused. `?? "0"` on a version
   * is the shape of the original defect; a helper that can answer 0 is a helper that can disarm the
   * gate again.
   */
  const lib = codeOf(read(MIGRATE_LIB));
  assert.ok(!/majorOf/.test(lib), "the old majorOf helper is gone");
  assert.ok(
    !/\?\?\s*""\s*\)/.test(lib.slice(lib.indexOf("parsePostgresVersion"))),
    "no version parse may fall back to a literal default major",
  );
  assert.ok(
    !/client\.query<\{\s*v:\s*string\s*\}>/.test(codeOf(read(MIGRATE_CLI))),
    "and no query anywhere claims a column named v",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. PG_DUMP COMPATIBILITY, THROUGH THE RELEASED FUNCTION
 * ═════════════════════════════════════════════════════════════════════════ */
function anOlderPgDumpIsRefusedAndANewerOneIsNot(): void {
  /* PROOF 2 — pg_dump 14 against PostgreSQL 18 refuses. */
  assert.equal(
    versionVerdict("pg_dump (PostgreSQL) 14.20 (Homebrew)", PRODUCTION_SERVER_VERSION),
    "refused-too-old",
    "pg_dump 14 may not back up a PostgreSQL 18 server",
  );

  /* PROOF 3 — pg_dump 15 against PostgreSQL 18 refuses. */
  assert.equal(
    versionVerdict("pg_dump (PostgreSQL) 15.7", PRODUCTION_SERVER_VERSION),
    "refused-too-old",
    "pg_dump 15 may not back up a PostgreSQL 18 server",
  );

  /* PROOF 4 — pg_dump 18 against PostgreSQL 18 passes the VERSION gate (the real ceremony's pair). */
  assert.equal(
    versionVerdict("pg_dump (PostgreSQL) 18.3", PRODUCTION_SERVER_VERSION),
    "passed-version-gate:dump-failed",
    "an equal major clears the version gate and proceeds to the dump itself",
  );

  /* PROOF 5 — a NEWER pg_dump against an older server is not rejected merely for being newer. */
  assert.equal(
    versionVerdict("pg_dump (PostgreSQL) 18.3", "14.20 (Homebrew)"),
    "passed-version-gate:dump-failed",
    "pg_dump may be newer than the server — that direction is supported, not refused",
  );

  /*
   * AND AN UNREADABLE PG_DUMP VERSION REFUSES BY ITS OWN NAME. Under the old arithmetic this became
   * 0, which fails closed on that side but tells an operator "the available pg_dump is 0".
   */
  assert.equal(
    versionVerdict("pg_dump: command not found by any name", PRODUCTION_SERVER_VERSION),
    "passed-version-gate:pg_dump-unreadable-version",
    "an unparseable pg_dump version is its own refusal, never a zero",
  );

  /*
   * THE GATE THE PRODUCTION DEFECT DISARMED, RESTATED AS THE COUNTERFACTUAL. Had the server version
   * been undefined, no `PostgresVersion` could have been built at all — so this pair is now
   * unrepresentable rather than merely unlikely.
   */
  assert.equal(parsePostgresVersion(undefined).status, "refused");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. A REAL SERVER, READ THROUGH THE RELEASED SEAM
 * ═════════════════════════════════════════════════════════════════════════ */
async function aLiveServerReportsAUsableVersion(): Promise<void> {
  const harness = createDisposablePostgresHarness("prodmig_serverversion");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  try {
    const resolved = await readServerVersion(client);
    assert.equal(resolved.status, "parsed", `a live server must report a usable version: ${JSON.stringify(resolved)}`);
    if (resolved.status !== "parsed") return;
    assert.ok(resolved.version.major >= 9, `a live PostgreSQL has a real major, got ${resolved.version.major}`);
    assert.notEqual(resolved.version.major, 0, "never zero");
    assert.ok(resolved.version.raw.length > 0, "and a raw string an operator can read");

    /*
     * THE ROW REALLY IS NAMED `server_version`. This is the measurement the production preflight
     * made, repeated against a live server here so the seam's field name is proved rather than
     * remembered.
     */
    const row = (await client.query<Record<string, unknown>>("show server_version")).rows[0]!;
    assert.deepEqual(Object.keys(row), ["server_version"], "the column is server_version, not v");
    assert.equal((row as { v?: unknown }).v, undefined, "there is no column named v");
  } finally {
    await client.end();
    await harness.dropDatabase();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE BANNER CANNOT PRINT AN UNKNOWN VERSION
 * ═════════════════════════════════════════════════════════════════════════ */
function theBannerHasNoUnknownVersionState(): void {
  const cli = read(MIGRATE_CLI);

  /*
   * PROOF 10 — the defect's own line is gone, everywhere.
   *
   * Asserted against CODE, because the ceremony now explains the defect in a comment and the
   * explanation necessarily quotes the shape it replaced.
   */
  const cliCode = codeOf(cli);
  assert.ok(!/client\.query<\{\s*v:\s*string\s*\}>/.test(cliCode), "the mistyped query is gone");
  assert.ok(
    !/rows\[0\]!?\.v\b/.test(cliCode),
    "nothing reads a column named v — that field never existed on this row",
  );

  /* The version comes from the released seam, and the ceremony refuses when it cannot be had. */
  assert.match(cli, /const server = await readServerVersion\(client\);/, "the version is read through the seam");
  assert.match(
    cli,
    /if \(server\.status === "refused"\) \{\s*fail\(\s*"TARGET_UNVERIFIED"/,
    "and an unresolvable server version REFUSES before anything else happens",
  );

  /*
   * ORDERING, SCOPED TO THE CEREMONY BODY. A module-wide search would find the import block, where
   * these names appear in alphabetical order rather than execution order.
   */
  const body = cli.slice(cli.indexOf("async function main("));
  const readVersion = body.indexOf("readServerVersion(client)");
  const refuse = body.indexOf('fail(\n        "TARGET_UNVERIFIED"');
  const backup = body.indexOf("createValidatedBackup({");
  const banner = body.indexOf("PRODUCTION MIGRATION CEREMONY");
  const confirm = body.indexOf("promptVisible");
  const apply = body.indexOf("applyPendingMigrations(client)");
  for (const [label, index] of [
    ["version read", readVersion],
    ["version refusal", refuse],
    ["backup", backup],
    ["banner", banner],
    ["confirmation", confirm],
    ["apply", apply],
  ] as const) {
    assert.ok(index > -1, `${label} must appear in the ceremony body`);
  }
  assert.ok(readVersion < refuse, "the version is read, then judged");
  assert.ok(refuse < backup, "an unestablished version refuses BEFORE a backup is attempted");
  assert.ok(backup < banner, "and the backup still precedes the banner");
  assert.ok(banner < confirm && confirm < apply, "and confirmation still precedes the migration");

  /*
   * THE BANNER PRINTS THE PARSED VALUE. `serverVersion` is a `PostgresVersion` by then, so the only
   * strings it can hold came through the parser — there is no `undefined` for it to render.
   */
  assert.match(
    cli,
    /PostgreSQL \$\{serverVersion\.raw\} \(major \$\{serverVersion\.major\}\)/,
    "the banner prints the parsed raw version and its major",
  );
}

async function main(): Promise<void> {
  theProductionRowResolvesToEighteen();
  anUnusableVersionCanNeverBecomeZero();
  anOlderPgDumpIsRefusedAndANewerOneIsNot();
  await aLiveServerReportsAUsableVersion();
  theBannerHasNoUnknownVersionState();
  console.log("prodmig-flow/server-version-gate: OK");
}

void main();
