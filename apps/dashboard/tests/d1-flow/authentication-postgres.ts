/*
 * D1 — the whole sign-in ceremony, proved against a REAL PostgreSQL database.
 *
 * THE INVARIANT. Before D1 an email alone minted a session. After D1 a session
 * may exist only downstream of a verified credential. Every test here exists to
 * make that failure mode unrepresentable rather than merely unlikely.
 *
 * WHY A REAL DATABASE. Lockout is durable state shared across processes. A mock
 * would happily report "count incremented" without proving a second process
 * would see it, which is exactly the claim being made. The failure counter, the
 * lock instant, the session digest and the revocation are all read back from
 * Postgres, not from the object the function returned.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { resolveAuthenticationEnvironment } from "../../src/features/auth/server";
import {
  issueLocalSession,
  resolveSessionFromReference,
  revokeSessionByReference,
} from "../../src/features/auth-runtime/session-service.server";
import {
  CREDENTIAL_FAILED_ATTEMPT_THRESHOLD,
  CREDENTIAL_LOCKOUT_SECONDS,
} from "../../src/features/auth-runtime/credential-repository.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";

const ALICE_PASSWORD = "alice-correct-password-7Qx";
const BOB_PASSWORD = "bob-correct-password-4Lm";

const harness = createDisposablePostgresHarness("hebun_d1_auth");

async function main(): Promise<void> {
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: ALICE_PASSWORD,
    });
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
      password: BOB_PASSWORD,
    });
    // An identity that exists but has NO credential: it must be as unusable, and
    // as undiscoverable, as an email nobody ever registered.
    const carol = await seedLocalIdentity(setup, {
      companyName: "Initech",
      companySlug: "initech",
      email: "carol@initech.test",
    });
    assert.equal(carol.credentialId, undefined, "carol really has no credential");

    const env = resolveAuthenticationEnvironment({
      HEBUN_AUTH_ENABLED: "true",
      HEBUN_AUTH_PROVIDER: "local",
      DATABASE_URL: harness.dbUrl,
      HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
      HEBUN_AUTH_SESSION_DIGEST_SECRET: "d1-auth-test-secret",
    });
    if (env.status !== "configured") throw new Error("env must be configured");

    const signIn = (email: string, password: string, now?: Date) =>
      issueLocalSession(
        controlPlane.db,
        env,
        { email, password, requestId: `req-${Math.random()}` },
        now,
      );

    const credentialRow = async (authIdentityId: string) => {
      const r = await setup.query<{
        failed_attempt_count: number;
        locked_until: Date | null;
        last_verified_at: Date | null;
        status: string;
      }>(
        `select failed_attempt_count, locked_until, last_verified_at, status
           from auth_credentials where auth_identity_id = $1`,
        [authIdentityId],
      );
      return r.rows[0]!;
    };

    /* ── A, B, C: no session without the right password, and the three failure
     *            causes are indistinguishable from outside ───────────────────── */
    {
      const unknownEmail = await signIn("nobody@nowhere.test", "anything at all");
      const wrongPassword = await signIn("alice@acme.test", "not alices password");
      const noCredential = await signIn("carol@initech.test", "anything at all");

      for (const [label, outcome] of [
        ["unknown email", unknownEmail],
        ["wrong password", wrongPassword],
        ["identity with no credential", noCredential],
      ] as const) {
        assert.equal(outcome.reference, "", `${label}: no session reference`);
        assert.equal(outcome.maxAgeSeconds, 0, `${label}: no cookie lifetime`);
        assert.deepEqual(
          outcome.result,
          { status: "unauthenticated", reason: "invalid" },
          `${label}: the client-visible result is the generic refusal`,
        );
      }

      // The three are identical to a client and DIFFERENT to the server. If these
      // ever collapse into one value the server has lost its own diagnostics; if
      // they ever reach the client it becomes an enumeration oracle.
      assert.equal(unknownEmail.diagnostic, "no-identity");
      assert.equal(wrongPassword.diagnostic, "bad-password");
      assert.equal(noCredential.diagnostic, "no-credential");

      // No session row was created by any of them.
      const sessions = await setup.query<{ count: string }>(
        "select count(*)::text as count from user_session_contexts",
      );
      assert.equal(sessions.rows[0]!.count, "0", "no session exists yet");
    }

    /* ── F: a wrong password increments DURABLE failure state ─────────────────── */
    {
      const before = await credentialRow(alice.authIdentityId);
      assert.equal(Number(before.failed_attempt_count), 1, "the earlier miss counted");
      assert.equal(before.locked_until, null, "one miss is not a lockout");

      await signIn("alice@acme.test", "still wrong");
      const after = await credentialRow(alice.authIdentityId);
      assert.equal(Number(after.failed_attempt_count), 2, "read back from Postgres");
    }

    /* ── J: success clears the failure state ──────────────────────────────────── */
    {
      const ok = await signIn("alice@acme.test", ALICE_PASSWORD);
      assert.equal(ok.result.status, "authorized", "the correct password works");
      const row = await credentialRow(alice.authIdentityId);
      assert.equal(Number(row.failed_attempt_count), 0, "failures reset on success");
      assert.equal(row.locked_until, null);
      assert.ok(row.last_verified_at, "the verification is stamped");
    }

    /* ── D, E: the correct credential resolves the correct human ──────────────── */
    let aliceReference = "";
    {
      const issued = await signIn("alice@acme.test", ALICE_PASSWORD);
      assert.equal(issued.result.status, "authorized");
      assert.equal(issued.diagnostic, "ok");
      if (issued.result.status !== "authorized") throw new Error("unreachable");

      const ctx = issued.result.tenantContext;
      assert.equal(ctx.userId, alice.userId, "the session is Alice, not anyone else");
      assert.equal(ctx.authIdentityId, alice.authIdentityId);
      assert.equal(ctx.tenantId, alice.tenantId);
      assert.equal(ctx.membershipId, alice.membershipId);
      assert.equal(ctx.roleId, alice.roleId);
      assert.equal(ctx.provider, "local");

      /* ── AAL truth: a password is one factor and says so ─────────────────── */
      assert.equal(ctx.assuranceLevel, "aal1", "a password establishes aal1, never more");
      assert.equal(ctx.mfaVerified, false, "no MFA is claimed");

      aliceReference = issued.reference;
      assert.ok(aliceReference.length > 0);
    }

    /* ── Alice's password cannot sign in as Bob, and vice versa ───────────────── */
    {
      const crossed = await signIn("bob@globex.test", ALICE_PASSWORD);
      assert.deepEqual(crossed.result, { status: "unauthenticated", reason: "invalid" });
      assert.equal(crossed.diagnostic, "bad-password");
      // Bob's own password still works — the refusal was about the password, not Bob.
      const bobIn = await signIn("bob@globex.test", BOB_PASSWORD);
      assert.equal(bobIn.result.status, "authorized");
      if (bobIn.result.status === "authorized") {
        assert.equal(bobIn.result.tenantContext.userId, bob.userId);
        assert.equal(bobIn.result.tenantContext.tenantId, bob.tenantId);
        assert.notEqual(bobIn.result.tenantContext.tenantId, alice.tenantId);
      }
    }

    /* ── P: the session reference is stored ONLY as a digest ──────────────────── */
    {
      const raw = await setup.query<{ count: string }>(
        `select count(*)::text as count from user_session_contexts
          where provider_session_reference_hash = $1`,
        [aliceReference],
      );
      assert.equal(raw.rows[0]!.count, "0", "the raw reference is not in the table");

      const shapes = await setup.query<{ provider_session_reference_hash: string }>(
        "select provider_session_reference_hash from user_session_contexts",
      );
      for (const row of shapes.rows) {
        assert.match(
          row.provider_session_reference_hash,
          /^[0-9a-f]{64}$/,
          "every stored reference is a 64-hex digest",
        );
        assert.notEqual(row.provider_session_reference_hash, aliceReference);
      }
    }

    /* ── Q: every sign-in mints FRESH session material ────────────────────────── */
    {
      const first = await signIn("alice@acme.test", ALICE_PASSWORD);
      const second = await signIn("alice@acme.test", ALICE_PASSWORD);
      assert.notEqual(
        first.reference,
        second.reference,
        "a new sign-in never reuses bearer material",
      );
      if (first.result.status === "authorized" && second.result.status === "authorized") {
        assert.notEqual(
          first.result.tenantContext.sessionContextId,
          second.result.tenantContext.sessionContextId,
          "…and it is a genuinely new session row, not a mutated one",
        );
      }
    }

    /* ── R, S: logout revokes, and a revoked session stays revoked ────────────── */
    {
      const issued = await signIn("alice@acme.test", ALICE_PASSWORD);
      assert.equal(
        (await resolveSessionFromReference(controlPlane.db, env, issued.reference, {
          requestId: "r",
        })).status,
        "authorized",
        "the session resolves before logout",
      );
      assert.equal(
        await revokeSessionByReference(controlPlane.db, env, issued.reference),
        true,
      );
      assert.deepEqual(
        await resolveSessionFromReference(controlPlane.db, env, issued.reference, {
          requestId: "r",
        }),
        { status: "unauthenticated", reason: "invalid" },
        "the revoked reference is refused",
      );
      // Still refused on a second try — revocation is durable, not a cache miss.
      assert.deepEqual(
        await resolveSessionFromReference(controlPlane.db, env, issued.reference, {
          requestId: "r",
        }),
        { status: "unauthenticated", reason: "invalid" },
      );
    }

    /* ── N, O: signing in grants NOTHING. Authentication is not authorization ── */
    {
      const countRows = async (table: string) => {
        const r = await setup.query<{ count: string }>(
          `select count(*)::text as count from ${table}`,
        );
        return r.rows[0]!.count;
      };
      const roleBefore = await setup.query<{ type: string; role_id: string }>(
        `select r.type, m.role_id from memberships m
           join roles r on r.id = m.role_id where m.id = $1`,
        [alice.membershipId],
      );
      const membershipsBefore = await countRows("memberships");
      const rolesBefore = await countRows("roles");

      await signIn("alice@acme.test", ALICE_PASSWORD);

      assert.equal(await countRows("memberships"), membershipsBefore, "no membership created");
      assert.equal(await countRows("roles"), rolesBefore, "no role created");
      const roleAfter = await setup.query<{ type: string; role_id: string }>(
        `select r.type, m.role_id from memberships m
           join roles r on r.id = m.role_id where m.id = $1`,
        [alice.membershipId],
      );
      assert.deepEqual(
        roleAfter.rows[0],
        roleBefore.rows[0],
        "the role is neither changed nor upgraded by signing in",
      );
    }

    /* ── G, H, I: bounded, temporary, deterministic lockout ───────────────────── */
    {
      // Start clean, then miss exactly the threshold number of times.
      await signIn("bob@globex.test", BOB_PASSWORD);
      assert.equal(Number((await credentialRow(bob.authIdentityId)).failed_attempt_count), 0);

      const lockMoment = new Date("2026-08-11T12:00:00.000Z");
      for (let i = 1; i <= CREDENTIAL_FAILED_ATTEMPT_THRESHOLD; i++) {
        const attempt = await signIn("bob@globex.test", `wrong-${i}`, lockMoment);
        assert.equal(attempt.diagnostic, "bad-password");
        const row = await credentialRow(bob.authIdentityId);
        assert.equal(Number(row.failed_attempt_count), i, `attempt ${i} counted durably`);
        if (i < CREDENTIAL_FAILED_ATTEMPT_THRESHOLD) {
          assert.equal(row.locked_until, null, `not locked before the threshold (${i})`);
        }
      }

      const locked = await credentialRow(bob.authIdentityId);
      assert.ok(locked.locked_until, "the threshold produced a lockout");
      // Deterministic duration: an explicit instant, not a growing backoff curve.
      assert.equal(
        locked.locked_until!.getTime(),
        lockMoment.getTime() + CREDENTIAL_LOCKOUT_SECONDS * 1000,
        "the lock expires at a stated, deterministic instant",
      );

      // H: the CORRECT password is refused while locked — the whole point.
      const duringLock = new Date(lockMoment.getTime() + 60 * 1000);
      const refused = await signIn("bob@globex.test", BOB_PASSWORD, duringLock);
      assert.deepEqual(
        refused.result,
        { status: "unauthenticated", reason: "invalid" },
        "a locked credential refuses even the correct password",
      );
      assert.equal(refused.diagnostic, "locked");
      assert.equal(refused.reference, "", "and mints nothing");

      // A locked credential is not destroyed: still active, still recoverable.
      assert.equal(
        (await credentialRow(bob.authIdentityId)).status,
        "active",
        "lockout never destroys the account",
      );

      // I: after the stated expiry the correct password works again.
      const afterLock = new Date(
        lockMoment.getTime() + (CREDENTIAL_LOCKOUT_SECONDS + 1) * 1000,
      );
      const recovered = await signIn("bob@globex.test", BOB_PASSWORD, afterLock);
      assert.equal(
        recovered.result.status,
        "authorized",
        "the lock is temporary, and expiry alone is enough to recover",
      );
      const cleared = await credentialRow(bob.authIdentityId);
      assert.equal(Number(cleared.failed_attempt_count), 0, "and the state is normalized");
      assert.equal(cleared.locked_until, null);
    }

    /* ── K: a revoked credential can never authenticate again ─────────────────── */
    {
      await setup.query(
        `update auth_credentials
            set status = 'revoked', revoked_at = now(), revocation_reason = 'test revocation'
          where auth_identity_id = $1`,
        [alice.authIdentityId],
      );
      const refused = await signIn("alice@acme.test", ALICE_PASSWORD);
      assert.deepEqual(
        refused.result,
        { status: "unauthenticated", reason: "invalid" },
        "the correct password no longer works",
      );
      assert.equal(
        refused.diagnostic,
        "no-credential",
        "…and is externally indistinguishable from having none",
      );
      assert.equal(refused.reference, "");
    }

    /* ── The database itself refuses two active credentials for one identity ─── */
    {
      await assert.rejects(
        () =>
          setup.query(
            `insert into auth_credentials
               (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
             values ($1, 'password', 'scrypt', '{}'::jsonb, $2, $3, 'active')`,
            [bob.authIdentityId, "a".repeat(64), "b".repeat(128)],
          ),
        /auth_credentials_active_identity_type_uq|duplicate key/i,
        "a second ACTIVE password credential is impossible, not merely avoided",
      );
    }

    /* ── The schema refuses to store anything that is not a hash ──────────────── */
    {
      await assert.rejects(
        () =>
          setup.query(
            `insert into auth_credentials
               (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
             values ($1, 'password', 'scrypt', '{}'::jsonb, $2, $3, 'active')`,
            [carol.authIdentityId, "not-hex-salt", "c".repeat(128)],
          ),
        /auth_credentials_salt_chk/i,
        "a non-hex salt is rejected by the database",
      );
      await assert.rejects(
        () =>
          setup.query(
            `insert into auth_credentials
               (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
             values ($1, 'password', 'scrypt', '{}'::jsonb, $2, $3, 'active')`,
            [carol.authIdentityId, "d".repeat(64), "plaintext-password-here"],
          ),
        /auth_credentials_secret_hash_chk/i,
        "a plaintext-shaped secret cannot be stored at all",
      );
    }

    /* ── No plaintext password exists anywhere in the credential table ────────── */
    {
      const all = await setup.query(
        "select algorithm, params, salt, secret_hash, status from auth_credentials",
      );
      const dump = JSON.stringify(all.rows);
      for (const secret of [ALICE_PASSWORD, BOB_PASSWORD]) {
        assert.ok(!dump.includes(secret), "no password is stored in any form");
      }
    }

    console.log("D1 authentication (PostgreSQL): passed");
  } finally {
    await controlPlane.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
