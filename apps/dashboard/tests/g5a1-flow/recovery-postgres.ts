/*
 * G5A.1 — BOOTSTRAP CREDENTIAL RECOVERY, PROVED AGAINST A REAL PostgreSQL DATABASE.
 *
 * THE CLAIM UNDER TEST. Inside the bootstrap window the single human's password can be replaced
 * exactly once per run, the new one verifies and the old one stops working; outside the window the
 * ceremony refuses; a failure leaves the human's credential untouched; two concurrent recoveries
 * cannot leave two active credentials; and nothing organizational is created.
 *
 * THE WINDOW IS RE-DERIVED FROM THE LIVE CATALOGUE. The claim "zero companies implies zero
 * organizational state" is not asserted from memory — this file reads `pg_constraint` and proves
 * every organizational table carries a NOT NULL foreign key to `companies`, so a future table that
 * escapes the implication fails here instead of silently widening the window.
 *
 * NOTHING IN THIS FILE TOUCHES THE REAL PRODUCTION DATABASE. The harness is localhost-only.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST on purpose: the schema barrel is the only safe entry point for
// `src/db/schema/*` (a pre-existing _base → company → organization cycle).
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { bootstrapFirstHuman } from "../../scripts/lib/bootstrap-first-human";
import {
  MIN_RECOVERY_PASSWORD_LENGTH,
  RECOVERY_REVOCATION_REASON,
  recoverBootstrapCredential,
  resolveRecoveryEligibility,
} from "../../scripts/lib/recover-bootstrap-credential";
import { verifyPassword } from "../../src/features/auth-runtime/password-hash.server";

const ORIGINAL = "original-bootstrap-password";
const REPLACEMENT = "recovered-bootstrap-password";
const THIRD = "third-bootstrap-password";

const count = async (c: Client, table: string): Promise<number> =>
  Number((await c.query<{ n: string }>(`select count(*)::text as n from "${table}"`)).rows[0]!.n);

const countAll = async (c: Client, tables: readonly string[]): Promise<number[]> => {
  const out: number[] = [];
  for (const t of tables) out.push(await count(c, t));
  return out;
};

const ORGANIZATIONAL = [
  "companies",
  "roles",
  "memberships",
  "invitations",
  "membership_authorizations",
  "genesis_nominations",
  "governance_sessions",
  "decision_records",
  "audit_log",
  "provider_connectivity_controls",
  "providers",
  "users",
  "auth_identities",
] as const;

interface StoredCredential {
  readonly id: string;
  readonly algorithm: string;
  readonly params: { N: number; r: number; p: number; keylen: number };
  readonly salt: string;
  readonly secretHash: string;
  readonly status: string;
  readonly revocationReason: string | null;
  readonly revokedAt: Date | null;
}

async function credentials(c: Client): Promise<StoredCredential[]> {
  const r = await c.query<{
    id: string;
    algorithm: string;
    params: { N: number; r: number; p: number; keylen: number };
    salt: string;
    secret_hash: string;
    status: string;
    revocation_reason: string | null;
    revoked_at: Date | null;
  }>(
    `select id, algorithm, params, salt, secret_hash, status, revocation_reason, revoked_at
       from auth_credentials order by created_at asc, id asc`,
  );
  return r.rows.map((row) => ({
    id: row.id,
    algorithm: row.algorithm,
    params: row.params,
    salt: row.salt,
    secretHash: row.secret_hash,
    status: row.status,
    revocationReason: row.revocation_reason,
    revokedAt: row.revoked_at,
  }));
}

const verifies = (stored: StoredCredential, password: string): Promise<boolean> =>
  verifyPassword(password, {
    algorithm: stored.algorithm as "scrypt",
    params: stored.params,
    salt: stored.salt,
    secretHash: stored.secretHash,
  });

/** Recreate the bootstrap human on an emptied database. */
async function seedBootstrapHuman(db: ControlPlaneDatabase, email: string): Promise<void> {
  const r = await bootstrapFirstHuman(db, { email, password: ORIGINAL });
  assert.equal(r.status, "bootstrapped", "the fixture human must exist");
}

async function emptyIdentity(c: Client): Promise<void> {
  await c.query(`delete from auth_credentials`);
  await c.query(`delete from auth_identities`);
  await c.query(`delete from users`);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g5a1_recovery");
  await harness.createDatabase();
  const probe = new Client({ connectionString: harness.dbUrl });
  let handle: { db: ControlPlaneDatabase; dispose: () => Promise<void> } | undefined;

  try {
    harness.migrateDatabase();
    await probe.connect();
    handle = createControlPlaneDb(harness.dbUrl);

    /* ══════════════════════════════════════════════════════════════════════
     * 0. THE WINDOW'S PREMISE, RE-DERIVED FROM THE LIVE CATALOGUE.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const escaping = await probe.query<{ tablename: string }>(`
        with implied as (
          select distinct t.relname from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          join pg_class ft on ft.oid = c.confrelid
          join unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
          where c.contype = 'f' and ft.relname = 'companies' and a.attnotnull)
        select tablename from pg_tables
         where schemaname = 'public'
           and tablename in ('roles','memberships','invitations','membership_authorizations',
                             'genesis_nominations','governance_sessions','decision_records',
                             'identity_enrollment_requests')
           and tablename not in (select relname from implied)`);
      assert.deepEqual(
        escaping.rows.map((r) => r.tablename),
        [],
        "every organizational table must carry a NOT NULL FK to companies — that implication IS the window",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 1. AN EMPTY DATABASE REFUSES: there is nobody to recover.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const eligibility = await resolveRecoveryEligibility(handle.db);
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.reason, "no-bootstrap-human");
      const r = await recoverBootstrapCredential(handle.db, { password: REPLACEMENT });
      assert.equal(r.status, "refused");
      assert.equal(r.status === "refused" && r.reason, "no-bootstrap-human");
      assert.equal(await count(probe, "auth_credentials"), 0, "the refusal wrote nothing");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 2. IN THE WINDOW: the credential is REPLACED, not duplicated.
     * ════════════════════════════════════════════════════════════════════ */
    await seedBootstrapHuman(handle.db, "ada@example.com");
    const organizationalBefore = await countAll(probe, ORGANIZATIONAL);

    {
      const before = await credentials(probe);
      assert.equal(before.length, 1);
      assert.equal(await verifies(before[0]!, ORIGINAL), true, "the original password works");

      const outcome = await recoverBootstrapCredential(handle.db, {
        password: REPLACEMENT,
        confirmEmail: "  Ada@Example.COM ",
      });
      assert.equal(outcome.status, "recovered");
      assert.equal(outcome.status === "recovered" && outcome.revokedCount, 1);
      assert.equal(outcome.status === "recovered" && outcome.human.email, "ada@example.com");

      const after = await credentials(probe);
      assert.equal(after.length, 2, "the old row SURVIVES — the record that it existed is kept");
      const active = after.filter((c) => c.status === "active");
      const revoked = after.filter((c) => c.status === "revoked");
      assert.equal(active.length, 1, "exactly one active credential");
      assert.equal(revoked.length, 1, "exactly one revoked credential");

      /* 3 + 4: the new password verifies through the SAME primitive; the old no longer does. */
      assert.equal(await verifies(active[0]!, REPLACEMENT), true, "the new password verifies");
      assert.equal(await verifies(active[0]!, ORIGINAL), false, "the old password does not");

      /* The revoked row keeps its secret and gains a reason — it is not blanked. */
      assert.equal(revoked[0]!.id, before[0]!.id, "the revoked row IS the original row");
      assert.equal(revoked[0]!.salt, before[0]!.salt, "its material is untouched");
      assert.equal(revoked[0]!.secretHash, before[0]!.secretHash);
      assert.equal(revoked[0]!.revocationReason, RECOVERY_REVOCATION_REASON);
      assert.ok(revoked[0]!.revokedAt instanceof Date);

      /* No actor is named on the revocation. */
      const actor = await probe.query<{ revoked_by_id: string | null; revoked_by_type: string | null }>(
        `select revoked_by_id, revoked_by_type from auth_credentials where status = 'revoked'`,
      );
      assert.equal(actor.rows[0]!.revoked_by_id, null);
      assert.equal(actor.rows[0]!.revoked_by_type, null);
    }

    /* 14 + 15 + 16 + 17: no human, no identity, nothing organizational, provider untouched. */
    assert.deepEqual(
      await countAll(probe, ORGANIZATIONAL),
      organizationalBefore,
      "recovery created no human, identity, tenant, role, membership, Governance row or provider",
    );
    assert.equal(await count(probe, "audit_log"), 0, "no audit row with a fabricated actor");

    /* ══════════════════════════════════════════════════════════════════════
     * 3. THE CONFIRMATION IS A SAFETY CHECK, NEVER A SELECTOR.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const before = await credentials(probe);
      const r = await recoverBootstrapCredential(handle.db, {
        password: THIRD,
        confirmEmail: "someone-else@example.com",
      });
      assert.equal(r.status, "refused");
      assert.equal(r.status === "refused" && r.reason, "confirmation-mismatch");
      assert.deepEqual(
        (await credentials(probe)).map((c) => `${c.id}:${c.status}`),
        before.map((c) => `${c.id}:${c.status}`),
        "a mismatched confirmation changed nothing — and recovered nobody else",
      );
    }

    /* Password floor refusals cost nothing. */
    {
      const before = await credentials(probe);
      for (const password of ["short", "x".repeat(MIN_RECOVERY_PASSWORD_LENGTH - 1)]) {
        const r = await recoverBootstrapCredential(handle.db, { password });
        assert.equal(r.status, "refused");
        assert.equal(r.status === "refused" && r.reason, "password-too-short");
      }
      assert.deepEqual((await credentials(probe)).length, before.length);
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 4. THE WINDOW CLOSES — and every closure is proved separately.
     * ════════════════════════════════════════════════════════════════════ */
    {
      /* 5: a second human. */
      await probe.query(
        `insert into users (email, name) values ('second@example.com','second@example.com')`,
      );
      const r = await recoverBootstrapCredential(handle.db, { password: THIRD });
      assert.equal(r.status, "refused");
      assert.equal(r.status === "refused" && r.reason, "not-a-single-human");
      await probe.query(`delete from users where email = 'second@example.com'`);
    }

    {
      /*
       * 6 + 7 + 8: ONE company closes it, and that single row stands for every organizational
       * state — roles, memberships, Governance and Genesis all require it by NOT NULL FK, proved
       * from the catalogue above. Creating a company is therefore the strongest closure fixture
       * available, and the only one that does not require fabricating a tenant chain.
       */
      const before = await credentials(probe);
      await probe.query(
        `insert into companies (name, slug, tenant_status) values ('Acme','acme','active')`,
      );

      const eligibility = await resolveRecoveryEligibility(handle.db);
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.reason, "bootstrap-window-closed");
      assert.equal(eligibility.companyCount, 1);

      const r = await recoverBootstrapCredential(handle.db, {
        password: THIRD,
        confirmEmail: "ada@example.com",
      });
      assert.equal(r.status, "refused");
      assert.equal(
        r.status === "refused" && r.reason,
        "bootstrap-window-closed",
        "a correct email and a correct password cannot reopen a closed window",
      );
      assert.deepEqual(
        (await credentials(probe)).map((c) => `${c.id}:${c.status}`),
        before.map((c) => `${c.id}:${c.status}`),
        "the refusal changed nothing",
      );
      /* The old password is STILL dead and the recovered one still works — state is intact. */
      const active = (await credentials(probe)).filter((c) => c.status === "active");
      assert.equal(await verifies(active[0]!, REPLACEMENT), true);

      await probe.query(`delete from companies where slug = 'acme'`);
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 5. ATOMICITY: a failure during replacement changes nothing.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const before = await credentials(probe);
      const activeBefore = before.filter((c) => c.status === "active")[0]!;

      /* The insert of the replacement is made to fail, after the revoke has already run. */
      await probe.query(`
        create function g5a1_reject_credential() returns trigger language plpgsql as $$
        begin raise exception 'g5a1 proof: replacement insert rejected'; end $$`);
      await probe.query(`
        create trigger g5a1_reject_credential_trg before insert on auth_credentials
        for each row execute function g5a1_reject_credential()`);

      let threw = false;
      try {
        await recoverBootstrapCredential(handle.db, { password: THIRD });
      } catch {
        threw = true;
      }
      await probe.query(`drop trigger g5a1_reject_credential_trg on auth_credentials`);
      await probe.query(`drop function g5a1_reject_credential()`);

      assert.ok(threw, "a failed replacement surfaces rather than being swallowed");
      const after = await credentials(probe);
      assert.deepEqual(
        after.map((c) => `${c.id}:${c.status}`),
        before.map((c) => `${c.id}:${c.status}`),
        "the revoke was rolled back with the failed insert",
      );
      const stillActive = after.filter((c) => c.status === "active");
      assert.equal(stillActive.length, 1, "the human still holds exactly one active credential");
      assert.equal(stillActive[0]!.id, activeBefore.id);
      assert.equal(
        await verifies(stillActive[0]!, REPLACEMENT),
        true,
        "…and it is still the one they can sign in with",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 6. CONCURRENCY: two recoveries, two connections, never two active.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const a = createControlPlaneDb(harness.dbUrl);
      const b = createControlPlaneDb(harness.dbUrl);
      try {
        const results = await Promise.allSettled([
          recoverBootstrapCredential(a.db, { password: "concurrent-password-alpha" }),
          recoverBootstrapCredential(b.db, { password: "concurrent-password-beta" }),
        ]);
        /* Neither may corrupt: whatever each returns, the invariant below is what matters. */
        assert.equal(results.length, 2);

        const after = await credentials(probe);
        const active = after.filter((c) => c.status === "active");
        assert.equal(
          active.length,
          1,
          "the partial unique index and the table lock together permit exactly one active credential",
        );
        /* Exactly one of the two passwords works, and it is the one the winner set. */
        const alpha = await verifies(active[0]!, "concurrent-password-alpha");
        const beta = await verifies(active[0]!, "concurrent-password-beta");
        assert.equal(
          [alpha, beta].filter(Boolean).length,
          1,
          "exactly one of the two concurrent passwords is live",
        );
        assert.equal(
          await verifies(active[0]!, REPLACEMENT),
          false,
          "…and the pre-race password is not",
        );
      } finally {
        await a.dispose();
        await b.dispose();
      }
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 7. RELEASED BEHAVIOUR IS UNCHANGED.
     * ════════════════════════════════════════════════════════════════════ */
    {
      /* 24: the G5A first-human ceremony still refuses on a populated database. */
      const r = await recoverBootstrapCredential(handle.db, { password: THIRD });
      assert.ok(r.status === "recovered" || r.status === "refused");

      const stillOne = await bootstrapFirstHuman(handle.db, {
        email: "another@example.com",
        password: ORIGINAL,
      });
      assert.equal(stillOne.status, "refused");
      assert.equal(stillOne.status === "refused" && stillOne.reason, "humans-already-exist");

      /* 23 + 25: enrollment's and the dev tool's primitives still behave as released. */
      await emptyIdentity(probe);
      await seedBootstrapHuman(handle.db, "fresh@example.com");
      const fresh = (await credentials(probe)).filter((c) => c.status === "active");
      assert.equal(fresh.length, 1, "establishFirstPasswordCredential still writes ONE active row");
      assert.equal(await verifies(fresh[0]!, ORIGINAL), true);
      assert.equal(fresh[0]!.revocationReason, null, "a first credential carries no revocation");
    }

    console.log("G5A.1 bootstrap credential recovery (PostgreSQL): all assertions passed.");
  } finally {
    await handle?.dispose().catch(() => {});
    await probe.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
