/*
 * Disposable PostgreSQL harness for integration tests.
 *
 * ── THE SAFETY INVARIANT (D1.1) ──────────────────────────────────────────────
 *
 *   A helper may only destroy a database it can PROVE it created.
 *
 * A prefix is not proof. A naming convention is not proof. A regex is not proof.
 * "Looks disposable" is not proof. The ONLY thing that authorizes a drop here is
 * that this handle successfully ran `create database` for that exact name during
 * this process. Everything else refuses.
 *
 * WHY THIS EXISTS. During D1 a database that was not disposable was destroyed by
 * an ad-hoc `list databases → match prefix → drop each match` command. That
 * pattern is now structurally impossible to express through this module: there is
 * no API that takes a name, a pattern, or a list. `dropDatabase()` takes no
 * arguments and can only ever reach the one name this handle minted. If you find
 * yourself wanting a "clean up all the stale test databases" function, that is
 * the same mistake wearing a different hat — it belongs in a separate operator
 * tool with its own confirmation boundary, not here.
 *
 * ── INSTANCE SAFETY ──────────────────────────────────────────────────────────
 *
 * Disposable databases are created on the HEBUN-DEDICATED local instance
 * (127.0.0.1:55432), not on the general-purpose local Postgres on :5432, which on
 * a developer machine also holds unrelated projects. R1's own notes always said
 * the throwaway instance was the Homebrew server on :55432; this module now
 * matches that intent instead of quietly defaulting to the shared one.
 *
 * Override with HEBUN_TEST_ADMIN_DATABASE_URL when the instance differs. The
 * target must be local — a remote admin URL is refused outright.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { disposeControlPlaneDb } from "../../src/db/client.server";

/**
 * The Hebun-dedicated local Postgres. Deliberately NOT :5432 — see the header.
 * `HEBUN_CANONICAL_READ_TEST_ADMIN_DATABASE_URL` is honoured for backwards
 * compatibility with the original variable name.
 */
const DEFAULT_ADMIN_URL =
  process.env.HEBUN_TEST_ADMIN_DATABASE_URL ??
  process.env.HEBUN_CANONICAL_READ_TEST_ADMIN_DATABASE_URL ??
  "postgresql://postgres@127.0.0.1:55432/postgres";

/**
 * Databases that must never be dropped even if something else goes wrong.
 *
 * This is a BACKSTOP, not the protection. The protection is that a database this
 * process did not create cannot be reached at all. A denylist alone would be the
 * weak version of this module — it can only ever enumerate the names somebody
 * already thought of.
 */
const PROTECTED_DATABASE_NAMES: ReadonlySet<string> = new Set([
  "postgres",
  "template0",
  "template1",
  "hebun_r1", // the real Hebun development database
  "hebun_ai", // destroyed once by an unsafe sweep; never again through this module
]);

/*
 * The developer's app config as it stood when this process STARTED — captured before any harness
 * could claim `process.env.DATABASE_URL` for its own disposable database (see `createDatabase`).
 * Without it, an in-flight claim would silently un-protect whatever the environment really pointed
 * at, which is the opposite of what that clause is for.
 */
const INITIAL_DATABASE_URL = process.env.DATABASE_URL;

/**
 * The disposable database a live harness currently owns, if any.
 *
 * It exists so a harness cannot protect its OWN throwaway database from itself. Once
 * `createDatabase` claims the ambient URL, the live `process.env.DATABASE_URL` names that database
 * — and without this exclusion the predicate below would call it protected and the drop backstop
 * would refuse to clean it up. The exclusion is safe because the only way a name gets here is a
 * successful `create database` by this process: it is the same ownership proof the drop gate uses.
 */
let claimedDisposableDatabaseName: string | undefined;

/** True when a name must never be dropped by test infrastructure. */
export function isProtectedDatabaseName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  // A disposable database this process created and currently owns is never protected from it.
  if (claimedDisposableDatabaseName?.toLowerCase() === normalized) return false;
  if (PROTECTED_DATABASE_NAMES.has(normalized)) return true;
  /*
   * Whatever the developer's own app config points at is protected too — checked against BOTH the
   * value this process started with and the value live right now, so neither a mis-set environment
   * nor an in-flight harness claim can aim the harness at something live.
   */
  for (const url of [INITIAL_DATABASE_URL, process.env.DATABASE_URL]) {
    const configured = databaseNameFromUrl(url);
    if (configured !== undefined && configured.toLowerCase() === normalized) return true;
  }
  return false;
}

function databaseNameFromUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    const name = new URL(url).pathname.replace(/^\//, "").trim();
    return name.length > 0 ? name : undefined;
  } catch {
    return undefined;
  }
}

export interface DisposablePostgresHarness {
  readonly adminUrl: string;
  readonly dbName: string;
  readonly dbUrl: string;
  createDatabase(): Promise<void>;
  /** Drops ONLY the database this handle created. Takes no arguments by design. */
  dropDatabase(): Promise<void>;
  migrateDatabase(): void;
}

function assertLocalUrl(url: string, label: string): void {
  const parsed = new URL(url);
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    `${label} requires localhost, got ${parsed.hostname}`,
  );
}

/** A database name that cannot collide and is unmistakably test-only. */
function mintDatabaseName(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  return `hebun_test_${safePrefix}_${randomBytes(8).toString("hex")}`;
}

/** Build the per-database URL from the ADMIN url so both target one instance. */
function databaseUrlFor(adminUrl: string, dbName: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

export function createDisposablePostgresHarness(
  prefix: string,
  adminUrl: string = DEFAULT_ADMIN_URL,
): DisposablePostgresHarness {
  /*
   * `dbName` is captured in this closure and is the ONLY name any method here can
   * act on. It is not read back off the returned object, so mutating the handle's
   * public `dbName` cannot redirect the drop at a different database.
   */
  const dbName = mintDatabaseName(prefix);
  const dbUrl = databaseUrlFor(adminUrl, dbName);

  /** Ownership proof: set only after `create database` actually succeeded. */
  let created = false;
  /** Prevents a second drop from issuing another destructive statement. */
  let dropped = false;
  /** Whether this handle currently owns `process.env.DATABASE_URL` (see createDatabase). */
  let databaseUrlClaimed = false;
  /** The ambient value to put back on drop. `undefined` means "there was none". */
  let previousDatabaseUrl: string | undefined;

  assert.ok(
    !isProtectedDatabaseName(dbName),
    `refusing to mint a disposable name that collides with a protected database (${dbName})`,
  );

  return {
    adminUrl,
    dbName,
    dbUrl,
    async createDatabase(): Promise<void> {
      assertLocalUrl(adminUrl, `${prefix} integration`);
      const admin = new Client({ connectionString: adminUrl });
      await admin.connect();
      try {
        await admin.query(`create database "${dbName}"`);
        created = true;
      } finally {
        await admin.end();
      }

      /*
       * ── THE AMBIENT-FALLBACK GATE (R3W) ────────────────────────────────────
       *
       * Every server writer in this repository resolves its database the same way:
       * `deps.getDb ?? resolveGovernanceDbOrNull()`, and that fallback reads
       * `process.env.DATABASE_URL`. A test that forgets to inject its handle therefore does not
       * fail — it writes SOMEWHERE ELSE. In a bare `npm test` that variable happens to be unset,
       * so the write refuses; but in any shell where a developer has exported it, the fallback is
       * the CANONICAL database and the omission is silent and destructive.
       *
       * R3W hit exactly this: a preparation-seam test omitted its write deps, the writer resolved
       * the ambient URL, and the only reason canonical survived was that the variable was unset.
       * "It happened to be unset" is luck, not a guard.
       *
       * So the harness now OWNS the ambient control-plane URL for the lifetime of the handle: an
       * omitted injection lands in THIS disposable database and is dropped with it. This is not a
       * second ownership system — it is the same ownership proof (`created === true`) extended to
       * the one variable that decides where an un-injected write goes. It is installed only after
       * `create database` succeeded, and restored exactly in `dropDatabase()`.
       */
      previousDatabaseUrl = process.env.DATABASE_URL;
      databaseUrlClaimed = true;
      claimedDisposableDatabaseName = dbName;
      process.env.DATABASE_URL = dbUrl;
    },

    async dropDatabase(): Promise<void> {
      /*
       * Release the ambient URL FIRST, and unconditionally. It must be restored even when the
       * ownership gate below refuses the drop, or a failed teardown would leave every later write
       * in this process pointed at a database that is about to be gone — or, worse, leave a stale
       * disposable URL installed while the test moves on.
       */
      if (databaseUrlClaimed) {
        if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousDatabaseUrl;
        databaseUrlClaimed = false;
        if (claimedDisposableDatabaseName === dbName) claimedDisposableDatabaseName = undefined;

        /*
         * Dispose the PROCESS SINGLETON pool as well, because this handle is what made it
         * possible: while the claim was installed, any un-injected call to `getControlPlaneDb()`
         * opened a lazily-created pool against THIS database. The drop below terminates backends,
         * and a surviving pool surfaces that as an unhandled `terminating connection due to
         * administrator command` — a teardown crash that has nothing to do with the test.
         *
         * Scoped to a handle that actually claimed the URL, so a harness never disposes a
         * singleton it did not cause. Idempotent when no singleton exists.
         */
        await disposeControlPlaneDb().catch(() => {});
      }

      // Already dropped by this handle: nothing to do, and nothing destructive is
      // issued. Tests call this from `finally`, so it must be safe to repeat.
      if (dropped) return;

      // THE OWNERSHIP GATE. Without a successful create there is no proof this
      // process owns the name, so there is no authority to destroy it. Refuse
      // loudly rather than "best effort" a destructive action.
      if (!created) {
        throw new Error(
          `refusing to drop "${dbName}": this harness never created it, so it cannot prove ownership`,
        );
      }

      // Backstop. Unreachable while the ownership gate holds, which is the point:
      // if it ever does fire, something upstream is badly wrong.
      if (isProtectedDatabaseName(dbName)) {
        throw new Error(`refusing to drop protected database "${dbName}"`);
      }

      assertLocalUrl(adminUrl, `${prefix} integration cleanup`);
      const admin = new Client({ connectionString: adminUrl });
      await admin.connect();
      try {
        await admin.query(
          `select pg_terminate_backend(pid)
             from pg_stat_activity
            where datname = $1
              and pid <> pg_backend_pid()`,
          [dbName],
        );
        await admin.query(`drop database if exists "${dbName}"`);
        dropped = true;
      } finally {
        await admin.end();
      }
    },

    migrateDatabase(): void {
      execFileSync("npx", ["drizzle-kit", "migrate"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
    },
  };
}
