/*
 * ACTIVATION-1 — password reset by emailed link, on a disposable PostgreSQL database.
 *
 * Proves against the real migration chain (ledger 94):
 *   - an unknown address, and an identity with no password, get no link and no mail
 *   - a link goes only to the identity's own stored address, token only in the fragment
 *   - cooldown; a newer link supersedes the older one
 *   - wrong token, short password, replay and expiry refuse and change nothing
 *   - a reset replaces the credential (old password fails, new one signs in), revokes every live
 *     session of that identity and no other, and consumes the link with no session
 *   - a reset token cannot verify an email address, and a verification token cannot reset
 *
 * No network: every send goes to a recording fake.
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import {
  TEST_AUTH_MAIL_ENV,
  TEST_EMAIL_DIGEST_KEY,
  createRecordingFetch,
  tokenFromSend,
} from "../helpers/email-ownership-proof";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  issueEmailVerification,
  issuePasswordReset,
  type EmailVerificationDeps,
} from "../../src/features/auth-email-ownership/email-verification.server";
import { PASSWORD_RESET_SUBJECT } from "../../src/features/auth-email-ownership/auth-mail.server";
import { PASSWORD_RESET_MIN_LENGTH } from "../../src/features/auth-email-ownership/contracts";
import { MIN_ENROLLMENT_PASSWORD_LENGTH } from "../../src/features/identity-enrollment/contracts";
import { verifyPasswordCredential } from "../../src/features/auth-runtime/credential-repository.server";

const T0 = new Date("2026-11-24T09:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const OLD_PASSWORD = "alice-old-password-7Qx!";
const NEW_PASSWORD = "alice-new-password-9Zp!";

async function sessionFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function count(db: Client, sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: string }>(sql, params);
  return Number(r.rows[0]!.n);
}

async function main(): Promise<void> {
  assert.equal(PASSWORD_RESET_MIN_LENGTH, MIN_ENROLLMENT_PASSWORD_LENGTH, "the client floor restates the enrollment floor");

  const harness = createDisposablePostgresHarness("hebun_activation_reset");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: OLD_PASSWORD,
    });
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
      password: "bob-password-unchanged-1!",
    });
    const nopass = await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech", email: "nopass@initech.test" });
    const aliceS1 = await sessionFor(setup, alice, "a");
    const aliceS2 = await sessionFor(setup, alice, "c");
    const bobS = await sessionFor(setup, bob, "b");

    const deps = (now: Date, extra: Partial<EmailVerificationDeps> = {}): EmailVerificationDeps => ({
      getDb: () => db,
      now: () => now,
      mailEnv: TEST_AUTH_MAIL_ENV,
      digestKeys: [TEST_EMAIL_DIGEST_KEY],
      ...extra,
    });
    const resetRows = () => count(setup, `select count(*)::text as n from auth_email_challenges where purpose = 'password-reset'`);

    /* 1 · unknown address and identity without a password: nothing written, nothing sent. */
    {
      const rec = createRecordingFetch();
      assert.deepEqual(await issuePasswordReset("nobody@nowhere.test", deps(at(0), { fetchImpl: rec.fetchImpl })), { status: "refused", reason: "no-account" });
      assert.deepEqual(await issuePasswordReset(nopass.email, deps(at(0), { fetchImpl: rec.fetchImpl })), { status: "refused", reason: "no-account" });
      assert.equal(rec.sends.length, 0);
      assert.equal(await resetRows(), 0);
    }

    /* 2 · issue: own address, reset subject, token only in the /reset-password fragment, 1h expiry. */
    const first = createRecordingFetch();
    {
      const r = await issuePasswordReset("  ALICE@acme.test ", deps(at(0), { fetchImpl: first.fetchImpl }));
      assert.deepEqual(r, { status: "issued", delivery: "accepted" });
      assert.equal(first.sends.length, 1);
      const send = first.sends[0]!;
      assert.deepEqual(send.body.to, ["alice@acme.test"]);
      assert.equal(send.body.subject, PASSWORD_RESET_SUBJECT);
      const link = send.body.text.split("\n").find((l) => l.startsWith("https://"))!;
      assert.match(link, /^https:\/\/app\.example\.test\/reset-password#token=[A-Za-z0-9_-]{43}$/);
      const row = await setup.query<{ ttl: number }>(
        `select extract(epoch from expires_at - issued_at)::int as ttl from auth_email_challenges where purpose = 'password-reset'`,
      );
      assert.equal(row.rows[0]!.ttl, 3600);
      assert.equal(await count(setup, `select count(*)::text as n from auth_email_challenges where token_hash = $1`, [tokenFromSend(send)]), 0, "no raw token at rest");
    }

    /* 3 · cooldown. */
    assert.deepEqual(await issuePasswordReset(alice.email, deps(at(10), { fetchImpl: createRecordingFetch().fetchImpl })), { status: "refused", reason: "cooldown" });

    /* 4 · a reset token does not verify an email address. */
    assert.deepEqual(
      await confirmEmailVerification(tokenFromSend(first.sends[0]!), { authIdentityId: alice.authIdentityId, sessionContextId: aliceS1 }, deps(at(20))),
      { status: "refused", reason: "invalid-link" },
    );

    /* 5 · supersession: a newer link makes the first one useless. */
    const second = createRecordingFetch();
    assert.deepEqual(await issuePasswordReset(alice.email, deps(at(120), { fetchImpl: second.fetchImpl })), { status: "issued", delivery: "accepted" });
    assert.deepEqual(await confirmPasswordReset(tokenFromSend(first.sends[0]!), NEW_PASSWORD, deps(at(130))), { status: "refused", reason: "invalid-link" });
    const token = tokenFromSend(second.sends[0]!);

    /* 6 · refusals that change nothing. */
    assert.deepEqual(await confirmPasswordReset("A".repeat(43), NEW_PASSWORD, deps(at(140))), { status: "refused", reason: "invalid-link" });
    assert.deepEqual(await confirmPasswordReset("short", NEW_PASSWORD, deps(at(140))), { status: "refused", reason: "invalid-link" });
    assert.deepEqual(await confirmPasswordReset(token, "x".repeat(PASSWORD_RESET_MIN_LENGTH - 1), deps(at(140))), { status: "refused", reason: "password-unacceptable" });
    assert.equal((await verifyPasswordCredential(db, alice.authIdentityId, OLD_PASSWORD, at(141))).outcome, "verified", "old password still works");

    /* 7 · the reset. */
    assert.deepEqual(await confirmPasswordReset(token, NEW_PASSWORD, deps(at(150))), { status: "reset" });
    assert.notEqual((await verifyPasswordCredential(db, alice.authIdentityId, OLD_PASSWORD, at(151))).outcome, "verified", "old password no longer works");
    assert.equal((await verifyPasswordCredential(db, alice.authIdentityId, NEW_PASSWORD, at(152))).outcome, "verified", "new password works");
    assert.equal(
      await count(setup, `select count(*)::text as n from user_session_contexts where id = any($1) and revoked_at is not null and revocation_reason = 'password-reset'`, [[aliceS1, aliceS2]]),
      2,
      "every live session of the identity is revoked",
    );
    assert.equal(await count(setup, `select count(*)::text as n from user_session_contexts where id = $1 and revoked_at is null`, [bobS]), 1, "another identity's session is untouched");
    assert.equal((await verifyPasswordCredential(db, bob.authIdentityId, "bob-password-unchanged-1!", at(153))).outcome, "verified", "another identity's password is untouched");
    const consumed = await setup.query<{ consumed_at: Date | null; consumed_session_context_id: string | null }>(
      `select consumed_at, consumed_session_context_id from auth_email_challenges where purpose = 'password-reset' and consumed_at is not null`,
    );
    assert.equal(consumed.rows.length, 1);
    assert.equal(consumed.rows[0]!.consumed_session_context_id, null, "a reset is consumed with no session");
    assert.equal(
      await count(setup, `select count(*)::text as n from auth_credentials where auth_identity_id = $1 and status = 'revoked' and revocation_reason = 'password-reset-by-email-link'`, [alice.authIdentityId]),
      1,
      "the old credential survives as a revoked row that says why",
    );

    /* 8 · replay. */
    assert.deepEqual(await confirmPasswordReset(token, "another-password-123!", deps(at(160))), { status: "refused", reason: "invalid-link" });

    /* 9 · expiry. */
    const third = createRecordingFetch();
    assert.deepEqual(await issuePasswordReset(alice.email, deps(at(300), { fetchImpl: third.fetchImpl })), { status: "issued", delivery: "accepted" });
    assert.deepEqual(await confirmPasswordReset(tokenFromSend(third.sends[0]!), "expired-link-password-1!", deps(at(300 + 3601))), { status: "refused", reason: "invalid-link" });
    assert.equal((await verifyPasswordCredential(db, alice.authIdentityId, NEW_PASSWORD, at(4000))).outcome, "verified");

    /* 10 · a verification token cannot reset a password. */
    const verify = createRecordingFetch();
    assert.deepEqual(await issueEmailVerification(bob.authIdentityId, deps(at(500), { fetchImpl: verify.fetchImpl })), { status: "issued", delivery: "accepted" });
    assert.deepEqual(await confirmPasswordReset(tokenFromSend(verify.sends[0]!), "bob-takeover-password-1!", deps(at(510))), { status: "refused", reason: "invalid-link" });
    assert.equal((await verifyPasswordCredential(db, bob.authIdentityId, "bob-password-unchanged-1!", at(511))).outcome, "verified");

    /* 11 · the CHECK: only a password-reset may be consumed without a session. */
    await assert.rejects(
      setup.query(
        `update auth_email_challenges set consumed_at = issued_at where auth_identity_id = $1 and purpose = 'email-verification' and consumed_at is null`,
        [bob.authIdentityId],
      ),
      /auth_email_challenges_consumed_session_chk/,
    );

    console.log("activation-1/password-reset-postgres: ok");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose?.().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
