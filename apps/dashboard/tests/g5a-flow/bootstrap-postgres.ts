/*
 * G5A — THE FIRST-HUMAN BOOTSTRAP, PROVED AGAINST A REAL PostgreSQL DATABASE.
 *
 * THE CLAIM UNDER TEST. An empty deployment gets exactly one human, once; a second run refuses
 * whatever address it is given; two concurrent runs cannot both succeed; the rows name no actor; a
 * credential failure leaves no human behind; and nothing organizational is created as a side effect.
 *
 * WHY THESE PROOFS NEED A REAL SERVER. The one-shot guarantee is a lock-conflict question and the
 * atomicity guarantee is a transaction question — neither is decidable from source. The concurrency
 * proof in particular runs two ceremonies on two independent connections and requires the database
 * to serialize them.
 *
 * NOTHING IN THIS FILE TOUCHES THE REAL PRODUCTION DATABASE. The harness is localhost-only by
 * construction and refuses any other admin URL.
 *
 * FIXTURES ARE STATE-RELATIVE: counts are measured before an act and compared after it.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST on purpose: the schema barrel is the only safe entry point for
// `src/db/schema/*` (a pre-existing _base → company → organization cycle).
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import {
  FIRST_HUMAN_LOCK_MODE,
  MIN_BOOTSTRAP_PASSWORD_LENGTH,
  bootstrapFirstHuman,
  countExistingHumans,
} from "../../scripts/lib/bootstrap-first-human";
import { verifyPassword } from "../../src/features/auth-runtime/password-hash.server";

const PASSWORD = "correct-horse-battery-staple";
const SECOND_PASSWORD = "another-entirely-different-secret";

const count = async (client: Client, table: string): Promise<number> => {
  const r = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
  return Number(r.rows[0]!.n);
};

/** Sequential: one `Client` runs one query at a time. */
const countAll = async (client: Client, tables: readonly string[]): Promise<number[]> => {
  const out: number[] = [];
  for (const t of tables) out.push(await count(client, t));
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
  "user_session_contexts",
] as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g5a_bootstrap");
  await harness.createDatabase();
  const probe = new Client({ connectionString: harness.dbUrl });
  let handle: { db: ControlPlaneDatabase; dispose: () => Promise<void> } | undefined;

  try {
    harness.migrateDatabase();
    await probe.connect();
    handle = createControlPlaneDb(harness.dbUrl);

    /* ══════════════════════════════════════════════════════════════════════
     * 1. AN EMPTY DEPLOYMENT GETS EXACTLY ONE HUMAN.
     * ════════════════════════════════════════════════════════════════════ */
    assert.equal(await count(probe, "users"), 0, "the disposable starts empty");
    assert.equal(await countExistingHumans(handle.db), 0, "…and the reader agrees");
    const organizationalBefore = await countAll(probe, ORGANIZATIONAL);

    const outcome = await bootstrapFirstHuman(handle.db, {
      email: "  Ada@Example.COM  ",
      password: PASSWORD,
    });
    assert.equal(outcome.status, "bootstrapped");
    const human = outcome.status === "bootstrapped" ? outcome.human : undefined;
    assert.ok(human);

    assert.equal(await count(probe, "users"), 1, "exactly one user");
    assert.equal(await count(probe, "auth_identities"), 1, "exactly one identity");
    assert.equal(await count(probe, "auth_credentials"), 1, "exactly one credential");

    /* The email was normalized by the ceremony, not trusted as given. */
    const userRow = await probe.query<{
      email: string;
      created_by: string | null;
      created_by_type: string | null;
    }>(`select email, created_by, created_by_type from users`);
    assert.equal(userRow.rows[0]!.email, "ada@example.com");
    assert.equal(human!.email, "ada@example.com");

    /* ══════════════════════════════════════════════════════════════════════
     * 2. NO ACTOR IS NAMED — both columns NULL, on both rows.
     * ════════════════════════════════════════════════════════════════════ */
    assert.equal(userRow.rows[0]!.created_by, null, "the user names no creator");
    assert.equal(userRow.rows[0]!.created_by_type, null, "…and no creator type");
    const identityRow = await probe.query<{
      created_by: string | null;
      created_by_type: string | null;
      user_id: string;
      provider: string;
      issuer: string;
      subject: string;
      status: string;
      is_primary: boolean;
      verified_at: Date | null;
    }>(
      `select created_by, created_by_type, user_id, provider, issuer, subject, status, is_primary, verified_at
         from auth_identities`,
    );
    assert.equal(identityRow.rows[0]!.created_by, null, "the identity names no creator");
    assert.equal(identityRow.rows[0]!.created_by_type, null, "…and no creator type");
    assert.notEqual(
      identityRow.rows[0]!.created_by,
      identityRow.rows[0]!.user_id,
      "the human is NOT recorded as their own creator — they did not perform this act",
    );
    /* The identity is nonetheless a real, active, verified local identity. */
    assert.equal(identityRow.rows[0]!.provider, "local");
    assert.equal(identityRow.rows[0]!.issuer, "hebun-local");
    assert.equal(identityRow.rows[0]!.subject, "local:ada@example.com");
    assert.equal(identityRow.rows[0]!.status, "active");
    assert.equal(identityRow.rows[0]!.is_primary, true);
    assert.ok(identityRow.rows[0]!.verified_at instanceof Date);

    /* ══════════════════════════════════════════════════════════════════════
     * 3. THE CREDENTIAL IS THE PRODUCTION ONE, AND IT VERIFIES.
     * ════════════════════════════════════════════════════════════════════ */
    const credential = await probe.query<{
      algorithm: string;
      params: unknown;
      salt: string;
      secret_hash: string;
      status: string;
      auth_identity_id: string;
    }>(`select algorithm, params, salt, secret_hash, status, auth_identity_id from auth_credentials`);
    const stored = credential.rows[0]!;
    assert.equal(stored.status, "active");
    assert.equal(stored.auth_identity_id, human!.authIdentityId);
    assert.equal(
      await verifyPassword(PASSWORD, {
        algorithm: stored.algorithm as "scrypt",
        params: stored.params as { N: number; r: number; p: number; keylen: number },
        salt: stored.salt,
        secretHash: stored.secret_hash,
      }),
      true,
      "the stored credential verifies with the SAME hasher the login path uses",
    );
    assert.equal(
      await verifyPassword("not the password", {
        algorithm: stored.algorithm as "scrypt",
        params: stored.params as { N: number; r: number; p: number; keylen: number },
        salt: stored.salt,
        secretHash: stored.secret_hash,
      }),
      false,
    );
    /* The plaintext is nowhere in the row. */
    assert.ok(!stored.secret_hash.includes(PASSWORD));
    assert.ok(!stored.salt.includes(PASSWORD));

    /* ══════════════════════════════════════════════════════════════════════
     * 4. NOTHING ORGANIZATIONAL WAS CREATED.
     * ════════════════════════════════════════════════════════════════════ */
    assert.deepEqual(
      await countAll(probe, ORGANIZATIONAL),
      organizationalBefore,
      "no tenant, role, membership, invitation, Governance row, genesis, audit, provider or session",
    );
    assert.equal(await count(probe, "audit_log"), 0, "no audit row with a fabricated actor");

    /* ══════════════════════════════════════════════════════════════════════
     * 5. ONE-SHOT: a second run refuses — same address AND a different one.
     * ════════════════════════════════════════════════════════════════════ */
    for (const [label, email, password] of [
      ["the same address", "ada@example.com", PASSWORD],
      ["a DIFFERENT address", "grace@example.com", SECOND_PASSWORD],
      ["a different address in different case", "GRACE@EXAMPLE.COM", SECOND_PASSWORD],
    ] as const) {
      const second = await bootstrapFirstHuman(handle.db, { email, password });
      assert.equal(second.status, "refused", `${label} must refuse`);
      assert.equal(
        second.status === "refused" && second.reason,
        "humans-already-exist",
        `${label} must refuse because a human EXISTS, not because the email collides`,
      );
      assert.equal(second.status === "refused" && second.existingHumans, 1);
    }
    assert.equal(await count(probe, "users"), 1, "still exactly one human");
    assert.equal(await count(probe, "auth_credentials"), 1, "and exactly one credential");

    /* ══════════════════════════════════════════════════════════════════════
     * 6. INPUT REFUSALS COST NOTHING.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const before = await countAll(probe, ["users", "auth_identities", "auth_credentials"]);
      for (const [email, password] of [
        ["not-an-email", PASSWORD],
        ["", PASSWORD],
        ["ok@example.com", "short"],
        ["ok@example.com", "x".repeat(MIN_BOOTSTRAP_PASSWORD_LENGTH - 1)],
      ] as const) {
        const r = await bootstrapFirstHuman(handle.db, { email, password });
        assert.equal(r.status, "refused");
      }
      assert.deepEqual(
        await countAll(probe, ["users", "auth_identities", "auth_credentials"]),
        before,
        "a refused input wrote nothing",
      );
    }

    await handle.dispose();
    handle = undefined;
    await probe.query(`delete from auth_credentials`);
    await probe.query(`delete from auth_identities`);
    await probe.query(`delete from users`);
    assert.equal(await count(probe, "users"), 0, "reset to empty for the remaining proofs");

    /* ══════════════════════════════════════════════════════════════════════
     * 7. CONCURRENCY: two ceremonies, two connections, ONE winner.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const a = createControlPlaneDb(harness.dbUrl);
      const b = createControlPlaneDb(harness.dbUrl);
      try {
        const [ra, rb] = await Promise.all([
          bootstrapFirstHuman(a.db, { email: "first@example.com", password: PASSWORD }),
          bootstrapFirstHuman(b.db, { email: "second@example.com", password: SECOND_PASSWORD }),
        ]);
        const succeeded = [ra, rb].filter((r) => r.status === "bootstrapped");
        const refused = [ra, rb].filter((r) => r.status === "refused");
        assert.equal(succeeded.length, 1, "exactly one ceremony may win");
        assert.equal(refused.length, 1, "…and exactly one must be refused");
        assert.equal(
          refused[0]!.status === "refused" && refused[0]!.reason,
          "humans-already-exist",
          "the loser is refused by the one-shot guard, not by a unique violation on a shared email",
        );
      } finally {
        await a.dispose();
        await b.dispose();
      }
      assert.equal(await count(probe, "users"), 1, "exactly one human survived the race");
      assert.equal(await count(probe, "auth_credentials"), 1);
    }

    /* The lock level is the one the concurrency proof depends on. */
    assert.equal(FIRST_HUMAN_LOCK_MODE, "share row exclusive");

    await probe.query(`delete from auth_credentials`);
    await probe.query(`delete from auth_identities`);
    await probe.query(`delete from users`);

    /* ══════════════════════════════════════════════════════════════════════
     * 8. ATOMICITY: a credential failure leaves NO human behind.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const c = createControlPlaneDb(harness.dbUrl);
      try {
        /*
         * Provoked at the third write, which is the only point where an identity can exist without
         * its credential. A trigger fails deterministically at exactly that statement; it is created
         * and dropped inside this disposable database and touches nothing else.
         */
        await probe.query(`
          create function g5a_reject_credential() returns trigger language plpgsql as $$
          begin raise exception 'g5a proof: credential insert rejected'; end $$`);
        await probe.query(`
          create trigger g5a_reject_credential_trg before insert on auth_credentials
          for each row execute function g5a_reject_credential()`);

        let threw = false;
        try {
          await bootstrapFirstHuman(c.db, { email: "doomed@example.com", password: PASSWORD });
        } catch {
          threw = true;
        }
        assert.ok(threw, "a credential failure surfaces rather than being swallowed");
        assert.equal(await count(probe, "users"), 0, "NO user survives a failed credential");
        assert.equal(await count(probe, "auth_identities"), 0, "and no identity survives either");
        assert.equal(await count(probe, "auth_credentials"), 0);
      } finally {
        await probe.query(`drop trigger if exists g5a_reject_credential_trg on auth_credentials`);
        await probe.query(`drop function if exists g5a_reject_credential()`);
        await c.dispose();
      }
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 9. ENROLLMENT'S ATTRIBUTION IS UNCHANGED BY THE WRITER FIX.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const d = createControlPlaneDb(harness.dbUrl);
      try {
        const { insertLocalIdentity } = await import(
          "../../src/features/auth-runtime/identity-repository.server"
        );
        /* Exactly what complete-enrollment passes. */
        const enrolled = await insertLocalIdentity(d.db, {
          normalizedEmail: "enrolled@example.com",
          provider: "local",
          issuer: "hebun-local",
          subject: "local:enrolled@example.com",
          verifiedAt: new Date(),
          createdByType: "human",
        });
        const row = await probe.query<{ created_by: string | null; created_by_type: string | null }>(
          `select created_by, created_by_type from auth_identities where id = $1`,
          [enrolled.authIdentityId],
        );
        assert.equal(
          row.rows[0]!.created_by,
          enrolled.userId,
          "an enrolled human is STILL recorded as their own creator",
        );
        assert.equal(row.rows[0]!.created_by_type, "human");
      } finally {
        await d.dispose();
      }
    }

    console.log("G5A first-human bootstrap (PostgreSQL): all assertions passed.");
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
