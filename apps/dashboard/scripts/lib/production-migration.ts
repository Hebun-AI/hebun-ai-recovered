/*
 * production-migration.ts — THE MECHANICS OF APPLYING A CANONICAL MIGRATION TO A VERIFIED TARGET.
 *
 * Authorization lives in `production-possession.ts`. Schema history lives in
 * `canonical-migrations.ts`. Applying authored SQL belongs to the drizzle engine. THIS module owns
 * only the things between them: the backup, the lock, the fingerprints, and the narrow call into
 * the engine.
 *
 * ── WHY THE ENGINE IS CALLED AS A LIBRARY AND NOT AS A SHELL ─────────────────
 *
 * `npx drizzle-kit migrate` reads `DATABASE_URL` from the environment and opens its OWN connection.
 * Shelling out would mean the ceremony verifies one connection and mutates a different one — the
 * target proof and the target mutation would be about two different sessions, and everything
 * between them (identity, prefix, advisory lock) would be decoration.
 *
 * So the engine is invoked as the library it is, over THE SAME `pg.Client` this ceremony already
 * verified and already holds the migration lock on. `drizzle-kit migrate` reaches exactly this code
 * — `db.dialect.migrate(readMigrationFiles(config), session, config)` — so nothing is reimplemented
 * and no second migration path exists. It also keeps the connection string out of a child process's
 * environment, where it would be readable for the life of that process.
 *
 * ── WHAT THE ENGINE GUARANTEES, MEASURED RATHER THAN HOPED ───────────────────
 *
 * The whole pending set runs inside ONE `session.transaction(...)`, with each migration's ledger
 * row inserted alongside its own statements. So the set is all-or-nothing, and a failure rolls back
 * both the schema change and the ledger row. This ceremony therefore does NOT claim per-migration
 * checkpointing, and does not fabricate a rollback it does not perform: it reports the ledger state
 * it OBSERVES afterwards, whatever that is.
 *
 * That guarantee has one real limit, and it is worth naming: a statement PostgreSQL refuses to run
 * inside a transaction — `CREATE INDEX CONCURRENTLY` is the usual one — would break it. No
 * canonical migration uses one, and a test pins that.
 *
 * ── SECRETS ──────────────────────────────────────────────────────────────────
 *
 * The connection string is never printed, never logged, never returned, and never passed in argv.
 * The argv rule is the one that is easy to get wrong: `pg_dump -d "$DATABASE_URL"` puts a password
 * into the process table, where any user on the machine can read it with `ps`. So the URL is
 * decomposed into the libpq `PG*` environment variables for the child instead, and the child's
 * argv names only the output path.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { MIGRATIONS_DIR } from "./canonical-migrations";

/* ═══════════════════════════════════════════════════════════════════════════
 * SECRET-SAFE CHILD PROCESS ENVIRONMENT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Decompose a connection string into libpq environment variables.
 *
 * Every value returned here goes into a CHILD'S ENVIRONMENT and never into its argv. libpq reads
 * `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGSSLMODE`, so `pg_dump` needs no `-d` and
 * the password never reaches the process table.
 *
 * `sslmode` is carried across from the URL when it says so. When the URL is silent it is DERIVED
 * FROM THE HOST, and the two directions are not symmetric:
 *
 *   remote   → `require`. A dump is the entire database in flight; sending it in clear is not an
 *              option, and a production target is remote by definition.
 *   loopback → `prefer`. A local development server commonly has no TLS at all, and demanding it
 *              produces "server does not support SSL, but SSL was required" — a refusal caused by
 *              the ceremony rather than by anything wrong with the target.
 *
 * Defaulting to `require` everywhere looked like the safe choice and was simply broken locally,
 * which is worse than either: the rehearsal path would never run, so the production path would be
 * exercised for the first time in production.
 */
export function libpqEnvFor(connectionString: string): Record<string, string> {
  const url = new URL(connectionString);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(host);
  const env: Record<string, string> = {
    PGHOST: host,
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGSSLMODE: url.searchParams.get("sslmode") ?? (loopback ? "prefer" : "require"),
  };
  if (url.port) env.PGPORT = url.port;
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  return env;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * BACKUP — the P3 precedent, formalized
 * ═════════════════════════════════════════════════════════════════════════ */

/** Where production backups go. Outside the repository, outside any synchronized directory. */
export const BACKUP_ROOT = path.join(
  process.env.HOME ?? "/tmp",
  "Developer",
  "hebun-backups",
);

/**
 * A synchronized directory is not a backup location: iCloud may evict, rewrite or partially
 * materialize a file, and a backup you cannot prove is whole is not a backup. The repository has
 * refused `~/Documents` since P3 for exactly this reason.
 */
export function assertBackupPathSafe(target: string, repositoryRoot: string): void {
  const resolved = path.resolve(target);
  if (resolved.startsWith(path.resolve(repositoryRoot) + path.sep)) {
    throw new Error(
      `refusing to write a backup inside the repository (${resolved}). A database dump is not source.`,
    );
  }
  if (/\/(Documents|Library\/Mobile Documents|Dropbox|Google Drive|OneDrive)(\/|$)/.test(resolved)) {
    throw new Error(
      `refusing to write a backup into a synchronized directory (${resolved}). ` +
        "A file a sync client may evict or rewrite cannot be proven whole.",
    );
  }
}

export type BackupRefusal =
  | "pg_dump-missing"
  | "pg_dump-unreadable-version"
  | "pg_dump-too-old"
  | "path-unsafe"
  | "path-occupied"
  | "dump-failed"
  | "dump-empty"
  | "dump-unreadable";

export type BackupResult =
  | { readonly status: "created"; readonly file: string; readonly bytes: number; readonly entries: number }
  | { readonly status: "refused"; readonly reason: BackupRefusal; readonly detail: string };

/* ════════════════════════════════════════════════════════════════════════════
 * POSTGRESQL VERSION — THE ONE PLACE A MAJOR VERSION IS DECIDED
 *
 * A production run of this ceremony printed `PostgreSQL undefined`, because the server version was
 * read as `rows[0].v` from a query whose column is `server_version`. The TypeScript generic on
 * `client.query<{ v: string }>` renamed nothing: it is an ASSERTION ABOUT A RUNTIME SHAPE, checked
 * by no one, and `pg` returns whatever the server named the column. So `serverVersion` was
 * `undefined`, and the old `majorOf` — `Number(/(\d+)/.exec(version)?.[1] ?? "0")` — coerced that
 * to the string "undefined", found no digits, and returned 0.
 *
 * Zero is the worst possible answer, because the gate it feeds is `dumpMajor < serverMajor`. With a
 * server major of 0, NO pg_dump is ever too old, and the early refusal was inert. It failed OPEN,
 * silently, while reporting nothing wrong.
 *
 * The repair is not a better regular expression. It is that an unparseable version is not a version:
 * every path that cannot produce a real major number REFUSES, and a major number can only be
 * obtained by calling the parser below — there is no arithmetic on a raw string anywhere else.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A PostgreSQL version that has been PROVED to carry a major number.
 *
 * The type is the guarantee: a value of this shape cannot be constructed from an unparseable
 * string, because `parsePostgresVersion` is the only thing that returns one.
 */
export interface PostgresVersion {
  /** Exactly what the server or the tool said, for the operator to read. Never empty. */
  readonly raw: string;
  /** The major version. Always an integer >= 1 — never 0, never NaN. */
  readonly major: number;
}

export type PostgresVersionResult =
  | { readonly status: "parsed"; readonly version: PostgresVersion }
  | { readonly status: "refused"; readonly detail: string };

/**
 * Parse a PostgreSQL version string into a major number, or refuse.
 *
 * Takes `unknown` ON PURPOSE. Its callers hold values that came off a wire or out of a child
 * process, where a compile-time type is a claim rather than a fact — which is precisely how the
 * production defect got in. Anything that is not a string, is blank, or does not BEGIN with a
 * plausible major number is refused rather than coerced.
 *
 * Anchored at the start deliberately: an unanchored digit search would happily pull `3484359` out
 * of `18.6 (3484359)` if the leading token were ever malformed, and inventing a major version from
 * a build identifier is the same class of failure as inventing 0.
 */
export function parsePostgresVersion(raw: unknown): PostgresVersionResult {
  if (typeof raw !== "string") {
    return {
      status: "refused",
      detail:
        `a PostgreSQL version must be a string and this is ${raw === null ? "null" : typeof raw}. ` +
        "No major version can be established, so this refuses rather than assuming one.",
    };
  }
  const text = raw.trim();
  if (text.length === 0) {
    return {
      status: "refused",
      detail: "the PostgreSQL version is empty. No major version can be established.",
    };
  }
  const match = /^(\d{1,3})(?:[.\s]|$)/.exec(text);
  if (!match) {
    return {
      status: "refused",
      detail:
        `the PostgreSQL version ${JSON.stringify(text)} does not begin with a major version. ` +
        "No major version can be established, so this refuses rather than guessing one.",
    };
  }
  const major = Number(match[1]);
  if (!Number.isInteger(major) || major < 1) {
    return {
      status: "refused",
      detail: `the PostgreSQL version ${JSON.stringify(text)} yields major ${match[1]}, which is not a real major version.`,
    };
  }
  return { status: "parsed", version: { raw: text, major } };
}

/**
 * Ask the live target what version it runs, and refuse if it will not say so usably.
 *
 * `show server_version` returns ONE row whose column is named `server_version` — measured against
 * the real production cluster, which answered `{ server_version: "18.6 (3484359)" }`. That name is
 * read here literally, and the value is then validated by the parser rather than trusted because a
 * generic said so.
 *
 * READ ONLY. It runs one `show`, mutates nothing, and holds nothing open.
 */
export async function readServerVersion(client: Client): Promise<PostgresVersionResult> {
  let rows: readonly Record<string, unknown>[];
  try {
    const result = await client.query<Record<string, unknown>>("show server_version");
    rows = result.rows;
  } catch (error) {
    return {
      status: "refused",
      detail:
        "the target would not report its server version: " +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (rows.length !== 1) {
    return {
      status: "refused",
      detail: `\`show server_version\` returned ${rows.length} rows. Exactly one was expected.`,
    };
  }
  const parsed = parsePostgresVersion(rows[0]?.server_version);
  if (parsed.status === "refused") {
    return {
      status: "refused",
      detail:
        `${parsed.detail} The row carried the keys [${Object.keys(rows[0] ?? {}).join(", ")}].`,
    };
  }
  return parsed;
}

/**
 * Create and validate a custom-format dump of the verified target.
 *
 * VERSION IS CHECKED FIRST, and refuses rather than trying. `pg_dump` will not dump a server newer
 * than itself — it aborts with "server version: X; pg_dump version: Y" — and discovering that by
 * running it is fine, but discovering it AFTER an operator has confirmed a production migration is
 * not.
 *
 * THE SERVER VERSION ARRIVES ALREADY PARSED, as a `PostgresVersion` and not as a string. That is
 * the repair for the production defect: this function can no longer be handed a raw value it would
 * have to interpret, so it can no longer interpret one into major 0 and wave every pg_dump through.
 * Establishing the version is the caller's job, and refusing when it cannot be established is the
 * caller's refusal — before a backup is attempted and before anything is migrated.
 */
export function createValidatedBackup(options: {
  readonly connectionString: string;
  readonly serverVersion: PostgresVersion;
  readonly directory: string;
  readonly filename: string;
  readonly repositoryRoot: string;
}): BackupResult {
  const target = path.join(options.directory, options.filename);

  try {
    assertBackupPathSafe(target, options.repositoryRoot);
  } catch (error) {
    return { status: "refused", reason: "path-unsafe", detail: (error as Error).message };
  }

  let dumpVersion: string;
  try {
    dumpVersion = execFileSync("pg_dump", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return {
      status: "refused",
      reason: "pg_dump-missing",
      detail:
        "pg_dump is not on PATH. A production migration may not proceed without a validated " +
        "backup, so this is a refusal and not a warning.",
    };
  }

  /*
   * THE TOOL'S OWN VERSION IS PARSED THE SAME WAY, and an unreadable one refuses too. Under the
   * old arithmetic an unrecognizable `pg_dump --version` also became 0 — which, on that side of the
   * comparison, fails closed but reports "the available pg_dump is 0" to an operator. A refusal
   * that names the real problem is worth more than a number nobody can act on.
   */
  const dumpParsed = parsePostgresVersion(dumpVersion.replace(/^pg_dump \(PostgreSQL\) /, ""));
  if (dumpParsed.status === "refused") {
    return {
      status: "refused",
      reason: "pg_dump-unreadable-version",
      detail:
        `pg_dump did not report a usable version (${JSON.stringify(dumpVersion)}): ${dumpParsed.detail} ` +
        "Its compatibility with the target cannot be established, so no backup is attempted.",
    };
  }
  const dumpMajor = dumpParsed.version.major;
  const serverMajor = options.serverVersion.major;
  if (dumpMajor < serverMajor) {
    return {
      status: "refused",
      reason: "pg_dump-too-old",
      detail:
        `the target runs PostgreSQL ${serverMajor} (${options.serverVersion.raw}) and the available ` +
        `pg_dump is ${dumpMajor} (${dumpVersion}). pg_dump refuses to dump a server newer than ` +
        "itself, so no valid backup can be produced here. Install a pg_dump of at least the " +
        "server's major version, then re-run. Nothing was migrated.",
    };
  }

  /* A backup must never overwrite a backup. */
  if (existsSync(target)) {
    return {
      status: "refused",
      reason: "path-occupied",
      detail: `${target} already exists. A backup never overwrites a backup.`,
    };
  }
  mkdirSync(options.directory, { recursive: true });

  try {
    execFileSync("pg_dump", ["--format=custom", "--no-password", "--file", target], {
      env: { ...process.env, ...libpqEnvFor(options.connectionString) },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    /*
     * The message is passed through because pg_dump's own diagnostics are what an operator needs.
     * It cannot carry the password: it never received one in argv, and libpq does not echo
     * PGPASSWORD.
     */
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    return {
      status: "refused",
      reason: "dump-failed",
      detail: `pg_dump failed: ${String(stderr ?? (error as Error).message).trim()}`,
    };
  }

  const bytes = existsSync(target) ? statSync(target).size : 0;
  if (bytes === 0) {
    return { status: "refused", reason: "dump-empty", detail: `${target} is empty.` };
  }

  /*
   * VALIDATE IT. A file of the right size is not a restorable archive; `pg_restore -l` parses the
   * table of contents and is the cheapest proof that it is one. An unvalidated backup is a belief.
   */
  let entries: number;
  try {
    const toc = execFileSync("pg_restore", ["-l", target], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    entries = toc.split("\n").filter((line) => line.trim() && !line.startsWith(";")).length;
  } catch (error) {
    return {
      status: "refused",
      reason: "dump-unreadable",
      detail: `pg_restore could not read the archive: ${(error as Error).message}`,
    };
  }

  return { status: "created", file: target, bytes, entries };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SERIALIZATION
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The advisory lock key. An arbitrary constant, chosen once and never derived from anything a
 * caller supplies, so two ceremonies cannot pick different keys and both believe they hold it.
 */
export const MIGRATION_LOCK_KEY = 4_128_726_001;

/**
 * Serialize the ceremony against itself.
 *
 * `pg_try_advisory_lock` and NOT `pg_advisory_lock`: a second operator must be told that a
 * migration is already running, not silently parked until the first one finishes and then allowed
 * to proceed against a database that changed underneath its own preflight. Fail closed, loudly.
 *
 * Session-scoped, so it is held across the engine's transaction and released when the connection
 * ends — including when the process dies, which is the property that keeps a crash from wedging
 * production forever. No table is invented for this; PostgreSQL already has the primitive.
 */
export async function acquireMigrationLock(client: Client): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    "select pg_try_advisory_lock($1) as locked",
    [MIGRATION_LOCK_KEY],
  );
  return result.rows[0]?.locked === true;
}

export async function releaseMigrationLock(client: Client): Promise<void> {
  await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ORGANIZATIONAL NON-MUTATION
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The tables a schema ceremony must leave alone. Counted before and after, and compared.
 *
 * A count is a weak fingerprint and is honest about being one: it would not notice a row being
 * edited in place. It is exactly strong enough for the claim being made — that this ceremony
 * neither created nor destroyed organizational state — and this ceremony's only writer is a
 * migration engine applying DDL, which cannot edit a row without a DML statement that a separate
 * test forbids in canonical migrations.
 */
export const ORGANIZATIONAL_TABLES = [
  "knowledge_facts",
  "knowledge_nodes",
  "decision_records",
  "integrations",
  "integration_credentials",
  "action_permits",
  "action_execution_attempts",
  /* The GLOBAL provider control — `provider_controls` does not exist; this is the real table. */
  "provider_connectivity_controls",
  /* External send: the rows that name real people real messages would reach. */
  "external_recipients",
  "companies",
  "memberships",
  "users",
  "audit_log",
] as const;

export type OrganizationalFingerprint = Readonly<Record<string, number | null>>;

/**
 * Count each organizational table. READ ONLY.
 *
 * A table that does not exist yet counts as `null` rather than `0`, and the two are NOT
 * interchangeable: a migration that CREATES a table moves it from absent to empty, which is a
 * legitimate schema change, while a table going from a count to zero is data loss. Collapsing both
 * to `0` would hide the second inside the first.
 */
export async function organizationalFingerprint(client: Client): Promise<OrganizationalFingerprint> {
  const out: Record<string, number | null> = {};
  for (const table of ORGANIZATIONAL_TABLES) {
    const present = await client.query<{ n: string }>(
      `select count(*)::text as n from information_schema.tables
        where table_schema = 'public' and table_name = $1`,
      [table],
    );
    if (present.rows[0]?.n === "0") {
      out[table] = null;
      continue;
    }
    /* The identifier is from a frozen module constant, never from input. */
    const counted = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
    out[table] = Number(counted.rows[0]!.n);
  }
  return Object.freeze(out);
}

/** Every table whose count moved, with both values. Empty means nothing organizational changed. */
export function fingerprintDrift(
  before: OrganizationalFingerprint,
  after: OrganizationalFingerprint,
): readonly { readonly table: string; readonly before: number | null; readonly after: number | null }[] {
  return ORGANIZATIONAL_TABLES.filter((t) => before[t] !== after[t]).map((t) => ({
    table: t,
    before: before[t] ?? null,
    after: after[t] ?? null,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE ENGINE CALL
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Apply every pending authored migration, over the connection this ceremony already verified.
 *
 * This is the ONLY place in the repository that applies a migration to a non-disposable database,
 * and it can apply nothing but committed authored migrations: the engine reads `_journal.json` and
 * the `.sql` files beside it, and takes no statement from this ceremony. There is deliberately no
 * parameter for SQL, for a file, or for a migration name — the narrowest interface that can do the
 * job is one that cannot be pointed at anything else.
 */
export async function applyPendingMigrations(client: Client, migrationsFolder: string = MIGRATIONS_DIR): Promise<void> {
  await migrate(drizzle({ client }), { migrationsFolder });
}
