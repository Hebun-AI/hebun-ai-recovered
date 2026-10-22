/*
 * Production migration authority — THE BACKUP'S TLS CONTRACT (SH1-PG-CEREMONY-TLS-1).
 *
 * The ceremony opens two connections to one target: its own `pg.Client`, which node-postgres 8
 * verifies fully, and `pg_dump`, which speaks libpq. libpq's `require` verifies nothing unless a
 * root file happens to exist, so the backup — the whole database in flight — could travel to whoever
 * answered. This file proves the contract that replaced that:
 *
 *   remote   → PGSSLMODE=verify-full and PGSSLROOTCERT=system, always; a URL naming any other mode
 *              is refused before any tool runs; nothing inherited can loosen or redirect it.
 *   loopback → unchanged: the URL's mode, else `prefer`, inherited environment kept.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. It proves the configuration the code hands to `pg_dump` —
 * read back from a stub `pg_dump` that records the environment it actually received. It does not
 * prove a real TLS handshake with a real provider: no network is used, no database is touched.
 */
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  REMOTE_BACKUP_SSLMODE,
  UnverifiedBackupTlsError,
  createValidatedBackup,
  libpqChildEnv,
  libpqEnvFor,
  parsePostgresVersion,
} from "../../scripts/lib/production-migration";

const ROOT = path.join(import.meta.dirname, "..", "..");
const LIB = path.join(ROOT, "scripts", "lib", "production-migration.ts");

const REMOTE = "postgresql://owner:s3cr3t@ep-example-123.eu-central-1.aws.neon.tech/neondb";
const WEAKER = ["disable", "allow", "prefer", "require", "verify-ca", "no-verify", "VERIFY-FULL", ""];

function version(raw: string) {
  const parsed = parsePostgresVersion(raw);
  if (parsed.status !== "parsed") throw new Error(`fixture version ${raw} did not parse`);
  return parsed.version;
}

/** A scratch directory outside the repository and outside any synchronized folder. */
function withScratch<T>(body: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-backup-tls-"));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * A `pg_dump` on a temporary PATH that reports 18.6, records the environment it was started with
 * into `record`, and then fails — so no archive is ever produced and no network is ever used.
 */
function withRecordingPgDump<T>(record: string, body: () => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-pgdump-recorder-"));
  const stub = path.join(dir, "pg_dump");
  writeFileSync(
    stub,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'pg_dump (PostgreSQL) 18.6'; exit 0; fi\n` +
      `env > '${record}'\necho 'recording pg_dump does not dump' >&2\nexit 1\n`,
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

/** Run `body` with extra inherited variables set, restoring every one of them afterwards. */
function withInherited<T>(vars: Record<string, string>, body: () => T): T {
  const saved = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  try {
    return body();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const parseEnv = (text: string): Record<string, string> =>
  Object.fromEntries(
    text.split("\n").filter((line) => line.includes("=")).map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
  );

/* ── 1 · REMOTE: verify-full with system roots, whatever the URL does not say ─────────────── */
function aRemoteTargetVerifiesChainAndHostName(): void {
  assert.equal(REMOTE_BACKUP_SSLMODE, "verify-full");
  for (const url of [REMOTE, `${REMOTE}?sslmode=verify-full`, `${REMOTE}?application_name=x`]) {
    const env = libpqEnvFor(url);
    assert.equal(env.PGSSLMODE, "verify-full", `a remote backup verifies chain and host name: ${url}`);
    assert.equal(env.PGSSLROOTCERT, "system", `and trusts the TLS library's system roots: ${url}`);
  }
}

/* ── 2 · REMOTE: a weaker mode in the URL is refused, never upgraded in silence ───────────── */
function aWeakerRemoteModeIsRefused(): void {
  for (const mode of WEAKER) {
    assert.throws(
      () => libpqEnvFor(`${REMOTE}?sslmode=${encodeURIComponent(mode)}`),
      (error: unknown) => error instanceof UnverifiedBackupTlsError,
      `sslmode=${JSON.stringify(mode)} on a remote target is refused, not reinterpreted`,
    );
  }
  /* The refusal names the mode and the remedy, and never the credential. */
  assert.throws(() => libpqEnvFor(`${REMOTE}?sslmode=require`), (error: unknown) => {
    const message = (error as Error).message;
    assert.match(message, /sslmode=require/);
    assert.match(message, /sslmode=verify-full/);
    assert.ok(!message.includes("s3cr3t"), "the refusal carries no password");
    assert.ok(!message.includes("ep-example-123"), "nor the host");
    return true;
  });
}

/* ── 3 · LOOPBACK: the rehearsal path is exactly what it was ──────────────────────────────── */
function theLoopbackRehearsalIsUnchanged(): void {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    const silent = libpqEnvFor(`postgresql://u:p@${host}:55432/db`);
    assert.equal(silent.PGSSLMODE, "prefer", `${host} does not demand TLS`);
    assert.equal(silent.PGSSLROOTCERT, undefined, `${host} is not pointed at system roots`);
    for (const mode of ["disable", "require", "verify-full"]) {
      assert.equal(libpqEnvFor(`postgresql://u:p@${host}/db?sslmode=${mode}`).PGSSLMODE, mode, `${host} keeps ${mode}`);
    }
  }
  const inherited = libpqChildEnv("postgresql://u:p@127.0.0.1:55432/db", { PGSERVICE: "local", PATH: "/bin" });
  assert.equal(inherited.PGSERVICE, "local", "a loopback rehearsal keeps its inherited environment");
}

/* ── 4 · NOTHING INHERITED SPEAKS FOR A REMOTE BACKUP'S TLS ───────────────────────────────── */
function inheritedVariablesCannotLoosenARemoteBackup(): void {
  const env = libpqChildEnv(REMOTE, {
    PATH: "/usr/bin",
    HOME: "/home/operator",
    PGSSLMODE: "disable",
    PGSSLROOTCERT: "/tmp/attacker-ca.pem",
    PGSERVICE: "loose",
    PGSERVICEFILE: "/tmp/pg_service.conf",
    PGCHANNELBINDING: "disable",
    PGHOSTADDR: "203.0.113.9",
    PGREQUIRESSL: "0",
    SSL_CERT_FILE: "/tmp/attacker-bundle.pem",
    SSL_CERT_DIR: "/tmp/attacker-certs",
  });
  assert.equal(env.PGSSLMODE, "verify-full");
  assert.equal(env.PGSSLROOTCERT, "system");
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGCHANNELBINDING", "PGHOSTADDR", "PGREQUIRESSL", "SSL_CERT_FILE", "SSL_CERT_DIR"]) {
    assert.equal(env[key], undefined, `inherited ${key} does not reach a remote pg_dump`);
  }
  assert.equal(env.PATH, "/usr/bin", "unrelated variables are kept — pg_dump still has to be found");
  assert.equal(env.HOME, "/home/operator");
  assert.equal(env.PGHOST, "ep-example-123.eu-central-1.aws.neon.tech");
}

/* ── 5 · THE REAL BACKUP CALL: refusal comes first, and the child gets exactly this env ───── */
function theBackupRefusesBeforeAnyToolRuns(): void {
  withScratch((dir) => {
    const record = path.join(dir, "pg_dump.env");
    withRecordingPgDump(record, () => {
      const result = createValidatedBackup({
        connectionString: `${REMOTE}?sslmode=require`,
        serverVersion: version("18.6"),
        directory: dir,
        filename: "refused.dump",
        repositoryRoot: ROOT,
      });
      assert.equal(result.status, "refused");
      assert.equal(result.status === "refused" ? result.reason : "", "tls-unverified");
      assert.ok(result.status === "refused" && !result.detail.includes("s3cr3t"), "no password in the refusal");
      assert.ok(!existsSync(record), "pg_dump was never started — not even to dump");
      assert.ok(!existsSync(path.join(dir, "refused.dump")), "and no archive exists");
    });
  });
}

function theBackupChildReceivesTheVerifiedEnvironment(): void {
  withScratch((dir) => {
    const record = path.join(dir, "pg_dump.env");
    withInherited(
      { PGSSLMODE: "disable", PGSERVICE: "loose", SSL_CERT_FILE: "/tmp/attacker-bundle.pem", PGCHANNELBINDING: "disable" },
      () =>
        withRecordingPgDump(record, () => {
          const result = createValidatedBackup({
            connectionString: REMOTE,
            serverVersion: version("18.6"),
            directory: dir,
            filename: "recorded.dump",
            repositoryRoot: ROOT,
          });
          /* The recording stub refuses to dump, so the ceremony's own failure path is what reports. */
          assert.equal(result.status, "refused");
          assert.equal(result.status === "refused" ? result.reason : "", "dump-failed", "a failing pg_dump stays a refusal");
        }),
    );
    const seen = parseEnv(readFileSync(record, "utf8"));
    assert.equal(seen.PGSSLMODE, "verify-full", "the pg_dump child actually ran with verify-full");
    assert.equal(seen.PGSSLROOTCERT, "system", "and with system roots");
    assert.equal(seen.PGSERVICE, undefined, "the inherited service never reached it");
    assert.equal(seen.SSL_CERT_FILE, undefined, "nor the inherited CA bundle");
    assert.equal(seen.PGCHANNELBINDING, undefined, "nor the inherited channel-binding override");
  });
}

/* ── 6 · NO RESTORE, AND ONE WAY INTO pg_dump ──────────────────────────────────────────────── */
function theMechanicsRestoreNothingAndDumpOneWay(): void {
  const lib = readFileSync(LIB, "utf8");
  const restores = lib.match(/execFileSync\("pg_restore",[^\n]*/g) ?? [];
  assert.equal(restores.length, 1, "pg_restore is invoked exactly once");
  assert.match(restores[0]!, /\["-l", target\]/, "and only to LIST the archive it just wrote — no restore");
  assert.ok(!/execFileSync\("psql"/.test(lib), "no psql is ever started");

  const dumps = lib.match(/execFileSync\("pg_dump", \["--format[^\n]*\n[^\n]*/g) ?? [];
  assert.equal(dumps.length, 1, "pg_dump dumps from exactly one call site");
  assert.match(dumps[0]!, /env: childEnv,/, "and its environment is the verified child environment");
  assert.ok(lib.includes("childEnv = libpqChildEnv(options.connectionString)"), "built by libpqChildEnv");
  assert.ok(!/\.\.\.process\.env, \.\.\.libpqEnvFor/.test(lib), "the inherited environment is never spread under it");
}

aRemoteTargetVerifiesChainAndHostName();
aWeakerRemoteModeIsRefused();
theLoopbackRehearsalIsUnchanged();
inheritedVariablesCannotLoosenARemoteBackup();
theBackupRefusesBeforeAnyToolRuns();
theBackupChildReceivesTheVerifiedEnvironment();
theMechanicsRestoreNothingAndDumpOneWay();
console.log("prodmig-flow/backup-tls: OK");
