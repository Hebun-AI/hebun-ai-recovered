/*
 * R3W — the ambient-database safety gate.
 *
 * THE INCIDENT THIS EXISTS FOR. During R3W implementation a preparation-seam test omitted its
 * write-dependency injection. The writer fell back to `resolveGovernanceDbOrNull()`, which reads
 * `process.env.DATABASE_URL`. Canonical survived only because that variable happened to be unset
 * in a bare test process — the write refused with `persistence-unavailable`.
 *
 * "The variable happened to be unset" is not a safety property. Export `DATABASE_URL` in your
 * shell — which `apps/dashboard/.env.local` invites, and which any `npm run dev` session has —
 * and the same omission writes to the CANONICAL database instead.
 *
 * THE INVARIANT THIS FILE PROVES:
 *
 *   A MUTATING TEST CANNOT FALL BACK TO THE CANONICAL DATABASE WHEN ITS TEST DATABASE
 *   DEPENDENCY IS OMITTED.
 *
 * The enforcement is in the EXISTING harness, not in a second ownership system: after
 * `create database` succeeds, the handle claims `process.env.DATABASE_URL` for its own disposable
 * database and restores it on drop. An omitted injection therefore lands in the disposable
 * database and dies with it.
 *
 * This test deliberately RUNS WITH A HOSTILE AMBIENT VALUE — it points `DATABASE_URL` at canonical
 * before creating the harness — because proving the guard against an unset variable would prove
 * nothing at all.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import {
  createDisposablePostgresHarness,
  isProtectedDatabaseName,
} from "../helpers/disposable-postgres";
import { createControlPlaneDb, disposeControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { resolveGovernanceDbOrNull } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/** The name a fallback must never be able to select. Read, never connected to. */
const CANONICAL_URL = "postgresql://postgres@127.0.0.1:55432/hebun_r1";

function databaseNameOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).pathname.replace(/^\//, "") || undefined;
  } catch {
    return undefined;
  }
}

/*
 * ── WHY THIS IS RELATIVE AND NOT ABSOLUTE ────────────────────────────────────
 *
 * This file originally asserted that canonical had ZERO `work_artifact%` tables and was at
 * EXACTLY 26 applied migrations. Both were true the day it was written, and both were wrong to
 * write down: they are a snapshot of the developer's environment, not a property of the code.
 *
 * The R3W release proved it. Applying the released R3W migration to canonical — the authorized,
 * intended destination of that very release — turned this regression red, because the release had
 * pinned canonical to the state that existed only while the migration was UNAPPLIED. The suite was
 * green *because* the thing it shipped had not been used yet.
 *
 * The invariant that actually matters is narrower and permanent:
 *
 *   THIS TEST MUST NOT CHANGE CANONICAL.
 *
 * So capture whatever legitimate state canonical holds when the test starts, and demand exactly
 * that state back at the end. Canonical's schema advances by authorized ceremony; this file has no
 * standing to freeze it at the version it was authored against.
 */
interface CanonicalState {
  /**
   * Ordered migration IDENTITY, not a count. A count of 27 is satisfied by 27 of the wrong
   * migrations; the concatenated hash sequence is not.
   */
  readonly migrations: string;
  readonly workArtifactTables: readonly string[];
  /** `null` when the table does not exist — a legitimate state on EITHER side of the R3W migration. */
  readonly artifactRows: number | null;
  readonly revisionRows: number | null;
}

/**
 * Row count for a table that may or may not exist, because both are legitimate here: canonical is
 * allowed to be pre-R3W (no such table) or post-R3W (the table, empty). Asking unconditionally
 * would make this file fail on the pre-migration state it is also supposed to protect.
 */
async function countIfPresent(client: Client, table: string): Promise<number | null> {
  const present = await client.query<{ ok: boolean }>(
    `select to_regclass($1::text) is not null as ok`,
    [`public.${table}`],
  );
  if (!present.rows[0]!.ok) return null;
  const counted = await client.query<{ n: number }>(`select count(*)::int as n from "${table}"`);
  return counted.rows[0]!.n;
}

/** Everything about canonical this regression is entitled to have an opinion on. */
async function captureCanonicalState(client: Client): Promise<CanonicalState> {
  const migrations = await client.query<{ digest: string }>(
    `select coalesce(string_agg(hash, ',' order by id), '') as digest
       from drizzle.__drizzle_migrations`,
  );
  const tables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name like 'work_artifact%'
      order by table_name`,
  );
  return {
    migrations: migrations.rows[0]!.digest,
    workArtifactTables: tables.rows.map((row) => row.table_name),
    artifactRows: await countIfPresent(client, "work_artifacts"),
    revisionRows: await countIfPresent(client, "work_artifact_revisions"),
  };
}

async function main(): Promise<void> {
  /*
   * THE HOSTILE PRECONDITION. This is what a developer's shell looks like after sourcing
   * `.env.local`, and it is the exact condition under which the incident would have destroyed
   * something. Restored in `finally` so this file cannot affect any other test.
   */
  const originalAmbient = process.env.DATABASE_URL;
  process.env.DATABASE_URL = CANONICAL_URL;

  assert.equal(
    databaseNameOf(process.env.DATABASE_URL),
    "hebun_r1",
    "precondition: the ambient URL points at canonical",
  );
  assert.equal(
    isProtectedDatabaseName("hebun_r1"),
    true,
    "and the repository already knows that name is protected",
  );

  const harness = createDisposablePostgresHarness("hebun_r3w_ambient_safety");
  let dropped = false;

  try {
    await harness.createDatabase();
    harness.migrateDatabase();

    /* ── 1. THE HARNESS TOOK THE AMBIENT URL AWAY FROM CANONICAL ──────────── */
    assert.equal(
      process.env.DATABASE_URL,
      harness.dbUrl,
      "an in-flight harness owns the ambient control-plane URL",
    );
    assert.equal(
      databaseNameOf(process.env.DATABASE_URL),
      harness.dbName,
      "…and it names the disposable database, not canonical",
    );
    assert.equal(
      isProtectedDatabaseName(String(databaseNameOf(process.env.DATABASE_URL))),
      false,
      "the installed target is provably not a protected database",
    );

    /* ── 2. THE FALLBACK ITSELF NOW RESOLVES THE DISPOSABLE DATABASE ───────── */
    const fallback = resolveGovernanceDbOrNull();
    assert.ok(fallback, "the ambient fallback still resolves — this is not a disablement");

    const setup = new Client({ connectionString: harness.dbUrl });
    await setup.connect();
    const handle = createControlPlaneDb(harness.dbUrl);

    /* Canonical state BEFORE the deliberately un-injected write. */
    const canonical = new Client({ connectionString: CANONICAL_URL });
    await canonical.connect();
    const canonicalBefore = await captureCanonicalState(canonical);

    /*
     * NON-VACUITY. A relative comparison passes trivially if both sides are empty, so prove the
     * baseline actually observed a real database first. Without this, an unreachable or blank
     * canonical would let the comparison below "succeed" while proving nothing at all.
     */
    assert.ok(
      canonicalBefore.migrations.length > 0,
      "precondition: canonical is reachable and has a real migration history to compare against",
    );

    try {
      const acme = await seedLocalIdentity(setup, {
        companyName: "Acme",
        companySlug: "acme-r3w-ambient",
        email: "director@acme.test",
      });
      const tenant: TenantContext = {
        tenantId: acme.tenantId,
        userId: acme.userId,
        authIdentityId: acme.authIdentityId,
        membershipId: acme.membershipId,
        membershipVersion: 1,
        roleId: acme.roleId,
        sessionContextId: "00000000-0000-4000-8000-000000000000",
        provider: "local",
        assuranceLevel: "aal1",
        mfaVerified: false,
        requestId: "r3w-ambient",
        authenticatedAt: new Date("2026-08-16T09:00:00.000Z").toISOString(),
      };

      /* ── 3. THE OMISSION ITSELF. No `deps` argument at all. ───────────────── */
      const written = await createWorkArtifact(
        tenant,
        {
          artifactType: "message-draft",
          title: "Written with NO injected database",
          content: "This row proves where an un-injected write actually lands.",
        },
        "operations",
        /* deliberately omitted: the whole point of this test */
      );
      assert.equal(
        written.status,
        "created",
        "the un-injected write succeeded — so it went SOMEWHERE, and the next assertion says where",
      );

      /* ── 4. IT LANDED IN THE DISPOSABLE DATABASE ──────────────────────────── */
      const here = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifacts`,
      );
      assert.equal(here.rows[0]!.n, 1, "the row is in the disposable database");

      const revision = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifact_revisions`,
      );
      assert.equal(revision.rows[0]!.n, 1, "with its revision, in the same place");

      /* ── 5. CANONICAL IS UNTOUCHED, AND WAS NEVER EVEN A CANDIDATE ────────── */
      const canonicalAfter = await captureCanonicalState(canonical);

      /*
       * The whole assertion, and deliberately the only one: migration identity, work-artifact table
       * existence, and artifact/revision row counts all come back exactly as they were found.
       *
       * Note what this catches that the old absolute form did not. If the un-injected write had
       * reached canonical, `artifactRows` would have gone 0 → 1 and this fails — including in the
       * post-migration world, where canonical HAS the tables and the old `== 0` table-count check
       * would have been satisfied by a canonical database that had just been written to.
       */
      assert.deepEqual(
        canonicalAfter,
        canonicalBefore,
        "canonical is exactly as this test found it — no row, no table, no migration moved",
      );
    } finally {
      await canonical.end().catch(() => {});
      await setup.end().catch(() => {});
      await handle.dispose().catch(() => {});
    }

    /*
     * The un-injected write created the PROCESS SINGLETON pool (`getControlPlaneDb`) against the
     * disposable database. Disposing it before the drop is honest teardown, not a workaround:
     * `dropDatabase` terminates backends, and a live pool would surface that as an unhandled
     * connection error. It is also a real consequence worth knowing — an omitted injection leaves
     * a process-level connection behind, pointed wherever the ambient URL pointed.
     */
    await disposeControlPlaneDb();

    /* ── 6. THE CLAIM IS RELEASED ON DROP ─────────────────────────────────── */
    await harness.dropDatabase();
    dropped = true;
    assert.equal(
      process.env.DATABASE_URL,
      CANONICAL_URL,
      "the harness put the prior ambient value back exactly — it does not leak its own",
    );
  } finally {
    await disposeControlPlaneDb().catch(() => {});
    if (!dropped) await harness.dropDatabase().catch(() => {});
    if (originalAmbient === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalAmbient;
  }

  /* ── 7. AND NOTHING IS LEFT INSTALLED FOR THE NEXT TEST ─────────────────── */
  assert.equal(
    process.env.DATABASE_URL,
    originalAmbient,
    "this file restores the process exactly as it found it",
  );

  console.log("PASS r3w ambient database safety");
}

void main();
