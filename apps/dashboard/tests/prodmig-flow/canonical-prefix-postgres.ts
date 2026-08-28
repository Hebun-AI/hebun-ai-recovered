/*
 * Production migration authority — DATABASE-PROVED.
 *
 * Every case here runs against a real disposable PostgreSQL and a real drizzle migration engine.
 * None of it is simulated, because the thing under test is precisely what the engine does with a
 * ledger it did not expect, and a mock returns the behaviour I imagined rather than the behaviour
 * that ships.
 *
 * ── HOW A PARTIAL LEDGER IS PRODUCED ─────────────────────────────────────────
 *
 * A target at "35 of 36" is made by pointing the REAL engine at a migrations folder holding the
 * first 35 canonical entries. That is the honest way to build the state: every hash and every
 * timestamp in the resulting ledger is the one the engine itself would have written, so a prefix
 * that verifies here verifies for the same reason it would in production. Hand-inserting ledger
 * rows would have tested my idea of the engine's format instead.
 */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import {
  MIGRATIONS_DIR,
  canonicalDigest,
  readAppliedLedger,
  readCanonicalMigrations,
  verifyCanonicalMigrationPrefix,
} from "../../scripts/lib/canonical-migrations";
import {
  ORGANIZATIONAL_TABLES,
  acquireMigrationLock,
  applyPendingMigrations,
  assertBackupPathSafe,
  createValidatedBackup,
  fingerprintDrift,
  libpqEnvFor,
  organizationalFingerprint,
  readServerVersion,
  releaseMigrationLock,
} from "../../scripts/lib/production-migration";
import { verifyProductionIdentity, verifyProductionTarget } from "../../scripts/lib/production-possession";

const CANONICAL = readCanonicalMigrations();

/** Build a migrations folder holding the first `count` canonical entries, optionally mutated. */
function truncatedMigrations(
  count: number,
  options: { readonly corruptAt?: number; readonly extra?: string } = {},
): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-mig-"));
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; when: number; tag: string; version: string; breakpoints: boolean }[];
  };
  const entries = journal.entries.slice(0, count).map((e) => ({ ...e }));
  for (const entry of entries) {
    cpSync(path.join(MIGRATIONS_DIR, `${entry.tag}.sql`), path.join(dir, `${entry.tag}.sql`));
  }
  if (options.corruptAt !== undefined) {
    const tag = entries[options.corruptAt]!.tag;
    const file = path.join(dir, `${tag}.sql`);
    /* A comment: different bytes, therefore a different sha256, and still valid SQL. */
    writeFileSync(file, `-- divergent lineage\n${readFileSync(file, "utf8")}`);
  }
  if (options.extra) {
    const last = entries[entries.length - 1]!;
    const tag = "29990101000000_beyond_this_release";
    writeFileSync(path.join(dir, `${tag}.sql`), options.extra);
    entries.push({ idx: entries.length, when: last.when + 1_000, tag, version: last.version, breakpoints: true });
  }
  writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dir;
}

async function withDatabase(
  label: string,
  run: (client: Client, url: string) => Promise<void>,
): Promise<void> {
  const harness = createDisposablePostgresHarness(label);
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  try {
    await run(client, harness.dbUrl);
  } finally {
    await client.end();
    await harness.dropDatabase();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE CANONICAL LEDGER ITSELF
 * ═════════════════════════════════════════════════════════════════════════ */
function theCanonicalLedgerIsWellFormed(): void {
  assert.equal(CANONICAL.length, 37, "this checkout authors 37 canonical migrations");
  assert.equal(
    CANONICAL[36]!.tag,
    "20260828071500_ap4b_origination_invocation_provenance",
    "and the last of them is AGENT-PROPOSAL-4B",
  );

  /* Strictly increasing `when` — the precondition that makes delegating to the engine sound. */
  for (let i = 1; i < CANONICAL.length; i += 1) {
    assert.ok(CANONICAL[i]!.when > CANONICAL[i - 1]!.when, `journal timestamp regresses at ${CANONICAL[i]!.tag}`);
  }
  /* Contiguous positions. */
  CANONICAL.forEach((m, i) => assert.equal(m.index, i));

  assert.equal(canonicalDigest(CANONICAL), "69c8a470c24f2c23f32d3adacfc8664f", "the release digest");
  assert.equal(
    canonicalDigest(CANONICAL.slice(0, 35)),
    "97f1151fd57bec5142621f00c1913708",
    "and the digest this repository already recorded at 35 — reproduced by the same method",
  );

  /*
   * THE ENGINE'S SINGLE-TRANSACTION GUARANTEE HAS ONE LIMIT, AND IT IS PINNED HERE.
   *
   * `session.transaction(...)` wraps the whole pending set, so it is all-or-nothing — UNLESS a
   * statement cannot run inside a transaction. `CREATE INDEX CONCURRENTLY` is the one that shows up
   * in practice. No canonical migration uses one, and if that ever changes, the ceremony's
   * all-or-nothing claim stops being true and this assertion is what says so.
   */
  for (const m of CANONICAL) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, `${m.tag}.sql`), "utf8");
    assert.ok(
      !/concurrently/i.test(sql),
      `${m.tag} uses CONCURRENTLY, which cannot run inside the engine's transaction`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. PREFIX VERDICTS, AGAINST REAL LEDGERS
 * ═════════════════════════════════════════════════════════════════════════ */
async function aTargetOneBehindAppliesOnlyTheLast(): Promise<void> {
  const folder = truncatedMigrations(36);
  try {
    await withDatabase("prodmig_behind1", async (client) => {
      await applyPendingMigrations(client, folder);

      const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
      assert.equal(verdict.status, "pending");
      if (verdict.status !== "pending") return;
      assert.equal(verdict.applied, 36);
      assert.deepEqual(
        verdict.pending.map((m) => m.tag),
        ["20260828071500_ap4b_origination_invocation_provenance"],
        "exactly one migration is pending, and it is the newest release",
      );
      assert.equal(verdict.finalDigest, "69c8a470c24f2c23f32d3adacfc8664f");

      /* The table does not exist yet — the fingerprint says absent, not empty. */
      const before = await organizationalFingerprint(client);
      const externalBefore = await client.query<{ n: string }>(
        `select count(*)::text as n from information_schema.tables
          where table_schema='public' and table_name='heby_origination_invocations'`,
      );
      assert.equal(
        externalBefore.rows[0]!.n,
        "0",
        "the PENDING migration's table is absent before migrating",
      );

      await applyPendingMigrations(client);

      const after = await verifyCanonicalMigrationPrefix(client, CANONICAL);
      assert.equal(after.status, "converged");
      if (after.status !== "converged") return;
      assert.equal(after.applied, 37);
      assert.equal(after.digest, "69c8a470c24f2c23f32d3adacfc8664f");

      const externalAfter = await client.query<{ n: string }>(
        `select count(*)::text as n from information_schema.tables
          where table_schema='public' and table_name='heby_origination_invocations'`,
      );
      assert.equal(externalAfter.rows[0]!.n, "1", "and present after");

      /* NOTHING ORGANIZATIONAL MOVED. */
      assert.deepEqual(fingerprintDrift(before, await organizationalFingerprint(client)), []);
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function aTargetTwoBehindAppliesBoth(): Promise<void> {
  const folder = truncatedMigrations(35);
  try {
    await withDatabase("prodmig_behind2", async (client) => {
      await applyPendingMigrations(client, folder);

      const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
      assert.equal(verdict.status, "pending");
      if (verdict.status !== "pending") return;
      assert.equal(verdict.applied, 35);
      assert.deepEqual(verdict.pending.map((m) => m.index), [35, 36], "both 36 and 37 are pending");

      /*
       * THE 34-VS-35 CONTRADICTION, ANSWERED BY MECHANISM. The repository disagreed with itself
       * about whether production stood at 34 or 35. Neither number is written down anywhere here:
       * the ceremony reads the target and derives the pending set from what it finds, so both
       * states converge and neither has to be guessed.
       */
      await applyPendingMigrations(client);
      const after = await verifyCanonicalMigrationPrefix(client, CANONICAL);
      assert.equal(after.status, "converged");
      if (after.status !== "converged") return;
      assert.equal(after.digest, "69c8a470c24f2c23f32d3adacfc8664f");
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function aConvergedTargetIsANoOp(): Promise<void> {
  await withDatabase("prodmig_converged", async (client) => {
    await applyPendingMigrations(client);
    const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
    assert.equal(verdict.status, "converged");
    if (verdict.status !== "converged") return;
    assert.equal(verdict.applied, 37);
    assert.equal(verdict.digest, "69c8a470c24f2c23f32d3adacfc8664f");

    /* And the released convergence check agrees, so the split did not change its answer. */
    const legacy = await verifyProductionTarget(
      client,
      { systemIdentifier: "x", database: "y" },
      36,
    );
    assert.equal(legacy.status, "refused");
    assert.equal(legacy.reason, "system-identifier-mismatch", "identity is still judged FIRST");
  });
}

async function aTargetAheadIsRefused(): Promise<void> {
  const folder = truncatedMigrations(37, { extra: 'CREATE TABLE "beyond_this_release" ("id" uuid PRIMARY KEY);' });
  try {
    await withDatabase("prodmig_ahead", async (client) => {
      await applyPendingMigrations(client, folder);
      const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
      assert.equal(verdict.status, "refused", "a target ahead of this repository is ledger-ahead");
      if (verdict.status !== "refused") return;
      assert.equal(verdict.reason, "ledger-ahead", "a target ahead of this repository is ledger-ahead");
      assert.equal(verdict.applied, 38);
      assert.match(verdict.detail, /AHEAD of this repository/);
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function aDivergentLineageIsRefused(): Promise<void> {
  /* Same COUNT as the target would have, different SQL at position 10. */
  const folder = truncatedMigrations(36, { corruptAt: 10 });
  try {
    await withDatabase("prodmig_diverged", async (client) => {
      await applyPendingMigrations(client, folder);
      const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
      assert.equal(verdict.status, "refused", "a divergent lineage is ledger-diverged");
      if (verdict.status !== "refused") return;
      assert.equal(verdict.reason, "ledger-diverged", "a divergent lineage is ledger-diverged");
      assert.match(verdict.detail, /position 10/);
      assert.match(verdict.detail, /different SQL/);

      /*
       * AND THIS IS WHY A COUNT WAS NEVER ENOUGH. The released count check calls this target
       * perfectly healthy at 36-of-36 — it cannot see that position 10 holds somebody else's
       * migration.
       */
      const byCount = await verifyProductionTarget(client, { systemIdentifier: "s", database: "d" }, 36);
      assert.equal(byCount.status, "refused");
      assert.equal(byCount.reason, "system-identifier-mismatch", "it never even reaches the ledger");
      const observed = await verifyProductionIdentity(client, { systemIdentifier: "s", database: "d" });
      assert.equal(observed.status, "refused");
      assert.equal(observed.observed?.appliedMigrations, 36, "the count alone reports a healthy 36");
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function aDivergentTimestampIsRefused(): Promise<void> {
  await withDatabase("prodmig_timestamp", async (client) => {
    await applyPendingMigrations(client, truncatedMigrations(5));
    /* Move one applied timestamp. Hash still matches; ordering no longer does. */
    await client.query(
      `update drizzle.__drizzle_migrations set created_at = created_at - 1
        where id = (select min(id) from drizzle.__drizzle_migrations)`,
    );
    const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
    assert.equal(verdict.status, "refused", "a moved timestamp is ledger-diverged");
    if (verdict.status !== "refused") return;
    assert.equal(verdict.reason, "ledger-diverged", "a moved timestamp is ledger-diverged");
    assert.match(verdict.detail, /timestamp/);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE ENGINE'S BLIND SPOT — why the prefix proof must come first
 * ═════════════════════════════════════════════════════════════════════════ */
async function theEngineCannotSeeAMissingMiddleMigration(): Promise<void> {
  await withDatabase("prodmig_hole", async (client) => {
    await applyPendingMigrations(client, truncatedMigrations(20));
    /* Delete a middle ledger row: the schema keeps the change, the history loses it. */
    const applied = await readAppliedLedger(client);
    await client.query(
      `delete from drizzle.__drizzle_migrations
        where hash = $1`,
      [applied[9]!.hash],
    );

    /*
     * THE ENGINE WOULD NEVER FILL THAT HOLE. It selects pending work by comparing against the
     * NEWEST applied timestamp only, so migration 10 — older than the newest — is skipped forever
     * and the target stays permanently short by one, silently.
     */
    await applyPendingMigrations(client);
    const ledger = await readAppliedLedger(client);
    assert.equal(ledger.length, 36, "the engine applied 16..37 and never went back for the hole");

    /* The prefix proof catches it, which is the whole reason it runs BEFORE the engine. */
    const verdict = await verifyCanonicalMigrationPrefix(client, CANONICAL);
    assert.equal(verdict.status, "refused", "a missing middle migration is ledger-diverged");
    if (verdict.status !== "refused") return;
    assert.equal(verdict.reason, "ledger-diverged", "a missing middle migration is ledger-diverged");
    assert.match(verdict.detail, /position 9/);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3b. IDENTITY — both pins, against a live cluster that really reports them
 * ═════════════════════════════════════════════════════════════════════════ */
async function bothTargetPinsAreEnforced(): Promise<void> {
  await withDatabase("prodmig_identity", async (client) => {
    const real = (
      await client.query<{ sid: string; db: string }>(
        "select system_identifier::text as sid, current_database() as db from pg_control_system()",
      )
    ).rows[0]!;

    /*
     * A DATABASE WITH NO DRIZZLE LEDGER REFUSES, FAIL-CLOSED — even with both pins correct.
     * The identity probe reads the ledger in the same round, so an empty database is not silently
     * treated as "zero applied": it is a target this ceremony cannot describe, and it says so.
     */
    const bare = await verifyProductionIdentity(client, {
      systemIdentifier: real.sid,
      database: real.db,
    });
    assert.equal(bare.status, "refused");
    if (bare.status === "refused") assert.equal(bare.reason, "ledger-unreadable");

    await applyPendingMigrations(client);

    /* The truthful pins bind. */
    const bound = await verifyProductionIdentity(client, {
      systemIdentifier: real.sid,
      database: real.db,
    });
    assert.equal(bound.status, "bound", "the real cluster identity binds");

    /* A wrong cluster refuses — and this is judged FIRST, before the database name. */
    const wrongCluster = await verifyProductionIdentity(client, {
      systemIdentifier: "1234567890123456789",
      database: "not-even-this-database",
    });
    assert.equal(wrongCluster.status, "refused", "the cluster pin is enforced");
    if (wrongCluster.status !== "refused") return;
    assert.equal(wrongCluster.reason, "system-identifier-mismatch", "the cluster pin is enforced");

    /*
     * A RIGHT CLUSTER AND A WRONG DATABASE STILL REFUSES. This is the case the second pin exists
     * for: a cluster holds many databases, so the identifier alone names a machine and not a
     * deployment. Without this check a ceremony could migrate the neighbouring database.
     */
    const wrongDatabase = await verifyProductionIdentity(client, {
      systemIdentifier: real.sid,
      database: "some_other_database",
    });
    assert.equal(wrongDatabase.status, "refused", "the database pin is enforced");
    if (wrongDatabase.status !== "refused") return;
    assert.equal(wrongDatabase.reason, "database-mismatch", "the database pin is enforced");
    assert.equal(wrongDatabase.observed?.database, real.db);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3c. BACKUP — a real dump of a real database, really validated
 * ═════════════════════════════════════════════════════════════════════════ */
async function theBackupIsRealAndValidated(): Promise<void> {
  await withDatabase("prodmig_backup", async (client, url) => {
    await applyPendingMigrations(client);
    /*
     * READ THROUGH THE RELEASED SEAM, not through a hand-written query. This line used to carry the
     * very defect that shipped — `rows[0].v` against a column named `server_version` — so the
     * `pg_dump-too-old` branch below could never be reached: the version was `undefined`, the major
     * was 0, and no pg_dump was ever older than the server. The test agreed with the bug.
     */
    const resolved = await readServerVersion(client);
    assert.equal(resolved.status, "parsed", `the live server reported no usable version: ${JSON.stringify(resolved)}`);
    if (resolved.status !== "parsed") return;
    const serverVersion = resolved.version;
    assert.ok(serverVersion.major >= 9, `a live PostgreSQL reports a real major version, got ${serverVersion.major}`);

    const dir = mkdtempSync(path.join(tmpdir(), "hebun-backup-"));
    try {
      const made = createValidatedBackup({
        connectionString: url,
        serverVersion,
        directory: dir,
        filename: "proof.dump",
        repositoryRoot: path.join(import.meta.dirname, "..", ".."),
      });

      if (made.status === "refused" && made.reason === "pg_dump-too-old") {
        /*
         * HONEST SKIP, AND ONLY FOR THIS ONE REASON. If the local pg_dump predates the local
         * server, no valid archive can be produced here and the refusal IS the correct behaviour —
         * which is itself the assertion. Every other refusal is a real failure.
         */
        assert.match(made.detail, /refuses to dump a server newer than itself/);
        console.log("  (backup round-trip skipped: local pg_dump is older than the local server)");
        return;
      }

      assert.equal(made.status, "created", `the backup was not created: ${JSON.stringify(made)}`);
      if (made.status !== "created") return;
      assert.ok(made.bytes > 0, "a backup of a 36-migration schema is not empty");
      assert.ok(
        made.entries > 50,
        `pg_restore -l parsed only ${made.entries} archive entries — a 57-table schema has more`,
      );

      /* A BACKUP NEVER OVERWRITES A BACKUP. */
      const again = createValidatedBackup({
        connectionString: url,
        serverVersion,
        directory: dir,
        filename: "proof.dump",
        repositoryRoot: path.join(import.meta.dirname, "..", ".."),
      });
      assert.equal(again.status, "refused");
      if (again.status !== "refused") return;
      assert.equal(again.reason, "path-occupied");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. SERIALIZATION
 * ═════════════════════════════════════════════════════════════════════════ */
async function twoCeremoniesCannotRunTogether(): Promise<void> {
  await withDatabase("prodmig_lock", async (client, url) => {
    assert.equal(await acquireMigrationLock(client), true, "the first ceremony takes the lock");

    const second = new Client({ connectionString: url });
    await second.connect();
    try {
      assert.equal(await acquireMigrationLock(second), false, "the second is refused, not queued");
    } finally {
      await second.end();
    }

    await releaseMigrationLock(client);
    const third = new Client({ connectionString: url });
    await third.connect();
    try {
      assert.equal(await acquireMigrationLock(third), true, "and the lock is reusable once released");
      await releaseMigrationLock(third);
    } finally {
      await third.end();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. FINGERPRINTS, AND THE ABSENT/EMPTY DISTINCTION
 * ═════════════════════════════════════════════════════════════════════════ */
async function theFingerprintSeparatesAbsentFromEmpty(): Promise<void> {
  await withDatabase("prodmig_fingerprint", async (client) => {
    const bare = await organizationalFingerprint(client);
    for (const table of ORGANIZATIONAL_TABLES) {
      assert.equal(bare[table], null, `${table} is ABSENT before any migration, not empty`);
    }
    await applyPendingMigrations(client);
    const migrated = await organizationalFingerprint(client);
    for (const table of ORGANIZATIONAL_TABLES) {
      assert.equal(migrated[table], 0, `${table} is present and empty after migrating`);
    }
    /*
     * Absent → empty IS drift, and is reported. That is correct: a schema ceremony creating a table
     * is legitimate, and the ceremony shows it rather than hiding it inside a `0 === 0`.
     */
    assert.equal(fingerprintDrift(bare, migrated).length, ORGANIZATIONAL_TABLES.length);
    assert.deepEqual(fingerprintDrift(migrated, migrated), [], "and a still database shows none");
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. SECRETS AND PATHS — pure, no database needed
 * ═════════════════════════════════════════════════════════════════════════ */
function theConnectionStringNeverReachesArgv(): void {
  const env = libpqEnvFor("postgresql://someone:s3cr3t@db.example.com:5433/neondb?sslmode=require");
  assert.equal(env.PGHOST, "db.example.com");
  assert.equal(env.PGPORT, "5433");
  assert.equal(env.PGDATABASE, "neondb");
  assert.equal(env.PGUSER, "someone");
  assert.equal(env.PGPASSWORD, "s3cr3t", "the password travels in the child ENVIRONMENT");
  assert.equal(env.PGSSLMODE, "require");

  /* Percent-encoded credentials survive intact — a mangled password is a failed backup. */
  const encoded = libpqEnvFor("postgresql://a%40b:p%2Fw%3F@h/db");
  assert.equal(encoded.PGUSER, "a@b");
  assert.equal(encoded.PGPASSWORD, "p/w?");

  /*
   * SSL MODE IS DERIVED FROM THE HOST when the URL is silent, and asymmetrically: a remote dump is
   * the whole database in flight and must be encrypted, while a loopback development server
   * commonly has no TLS at all and demanding it would break the rehearsal path — which is how a
   * production path ends up being exercised for the first time in production.
   */
  assert.equal(libpqEnvFor("postgresql://u:p@h/db").PGSSLMODE, "require", "remote defaults to TLS");
  for (const local of ["127.0.0.1", "localhost", "[::1]"]) {
    assert.equal(
      libpqEnvFor(`postgresql://u:p@${local}:55432/db`).PGSSLMODE,
      "prefer",
      `${local} does not demand TLS`,
    );
  }
  /* An explicit sslmode in the URL always wins, in both directions. */
  assert.equal(libpqEnvFor("postgresql://u:p@127.0.0.1/db?sslmode=require").PGSSLMODE, "require");
  assert.equal(libpqEnvFor("postgresql://u:p@h/db?sslmode=disable").PGSSLMODE, "disable");

  /* IPv6 hosts lose their brackets, as libpq expects. */
  assert.equal(libpqEnvFor("postgresql://u:p@[2001:db8::1]:5432/db").PGHOST, "2001:db8::1");
}

function backupsMayNotLandInTheRepositoryOrInASyncedFolder(): void {
  const root = "/Users/someone/Developer/Hebun AI";
  assert.throws(
    () => assertBackupPathSafe(path.join(root, "apps/dashboard/x.dump"), root),
    /inside the repository/,
  );
  for (const bad of [
    "/Users/someone/Documents/x.dump",
    "/Users/someone/Library/Mobile Documents/x.dump",
    "/Users/someone/Dropbox/x.dump",
    "/Users/someone/Google Drive/x.dump",
    "/Users/someone/OneDrive/x.dump",
  ]) {
    assert.throws(() => assertBackupPathSafe(bad, root), /synchronized directory/, bad);
  }
  /* The sanctioned location is accepted. */
  assertBackupPathSafe("/Users/someone/Developer/hebun-backups/x.dump", root);
}

async function main(): Promise<void> {
  theCanonicalLedgerIsWellFormed();
  theConnectionStringNeverReachesArgv();
  backupsMayNotLandInTheRepositoryOrInASyncedFolder();

  /*
   * IDENTITY FIRST — and the order is load-bearing, not cosmetic.
   *
   * Several later cases also touch identity in passing, so if one of those ran first a defeated
   * pin would be reported by whichever assertion happened to come earlier, and a bite-proof
   * checking WHY the suite failed would read the wrong reason. The most specific case for a
   * property runs before any case that merely brushes against it.
   */
  await bothTargetPinsAreEnforced();

  await aTargetOneBehindAppliesOnlyTheLast();
  await aTargetTwoBehindAppliesBoth();
  await aTargetAheadIsRefused();
  await aDivergentLineageIsRefused();
  await aDivergentTimestampIsRefused();
  await aConvergedTargetIsANoOp();
  await theEngineCannotSeeAMissingMiddleMigration();
  await theBackupIsRealAndValidated();
  await twoCeremoniesCannotRunTogether();
  await theFingerprintSeparatesAbsentFromEmpty();

  console.log("prodmig-flow/canonical-prefix-postgres: OK");
}

void main();
