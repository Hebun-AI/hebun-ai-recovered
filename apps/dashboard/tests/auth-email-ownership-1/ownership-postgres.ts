/*
 * AUTH-EMAIL-OWNERSHIP-1 — the whole journey on a disposable PostgreSQL database.
 *
 * Proves, against the real migration chain and the released authorities:
 *   - existing identities are untouched and keep signing in (NULL proof, `verified_at` unchanged)
 *   - a link is issued only when mail is configured, to the identity's own address, with the token
 *     only in the link fragment and only a keyed digest at rest
 *   - cooldown, daily and global limits; supersession; one open link per identity
 *   - confirmation requires the identity's OWN session; replay, expiry, supersession, address change,
 *     wrong account, malformed and unknown tokens all refuse and change nothing
 *   - concurrent confirmations and concurrent issues serialize
 *   - every provider failure is recorded truthfully, once
 *   - genesis acceptance requires a proven address, atomically, and names the proof in its audit row;
 *     an already-accepted genesis is untouched
 *   - the operator's pending listing reports which addresses are proven
 *
 * No network: every send goes to a recording fake. No real email, no model call.
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import {
  TEST_AUTH_MAIL_ENV,
  TEST_EMAIL_DIGEST_KEY,
  createRecordingFetch,
  proveEmailOwnership,
  tokenFromSend,
} from "../helpers/email-ownership-proof";
import {
  confirmEmailVerification,
  issueEmailVerification,
  readEmailOwnershipProof,
  readEmailOwnershipState,
  type EmailVerificationDeps,
} from "../../src/features/auth-email-ownership/email-verification.server";
import { EMAIL_VERIFICATION_SUBJECT } from "../../src/features/auth-email-ownership/auth-mail.server";
import { findActiveLocalIdentityByEmail } from "../../src/features/auth-runtime/identity-repository.server";
import { createSelfServiceAccount } from "../../src/features/self-service-signup/create-account.server";
import { acceptGenesisNomination } from "../../src/features/governance-genesis/genesis-acceptance.server";
import {
  listPendingSelfServiceTenants,
  nominateGenesisHuman,
  resolveNominationTarget,
} from "../../scripts/lib/nominate-genesis-human";
import { TENANT_PROVISIONING_SOURCE_SELF_SERVICE } from "../../src/features/tenant-provisioning/contracts";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const T0 = new Date("2026-10-24T09:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const PREVIOUS_KEY = TEST_EMAIL_DIGEST_KEY;
const ROTATED_KEY = Object.freeze({ version: 2, secret: "test-only-rotated-digest-secret-abcdefghijklmnop" });

async function count(db: Client, table: string, where = "true", params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params);
  return Number(r.rows[0]!.n);
}

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

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "auth-email-ownership-request",
    authenticatedAt: T0.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_email_ownership");
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
      email: "Alice@Acme.test",
      password: "alice-correct-password-7Qx",
    });
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
    });
    const aliceSession = await sessionFor(setup, alice, "a");
    const bobSession = await sessionFor(setup, bob, "b");

    const deps = (now: Date, extra: Partial<EmailVerificationDeps> = {}): EmailVerificationDeps => ({
      getDb: () => db,
      now: () => now,
      mailEnv: TEST_AUTH_MAIL_ENV,
      digestKeys: [TEST_EMAIL_DIGEST_KEY],
      ...extra,
    });

    /* ═══ 1. EXISTING IDENTITIES ARE UNTOUCHED BY THE MIGRATION ═══════════════ */
    {
      const rows = await setup.query<{ verified_at: Date | null; ev: Date | null; ec: string | null }>(
        `select verified_at, email_ownership_verified_at as ev, email_ownership_challenge_id as ec
           from auth_identities`,
      );
      for (const row of rows.rows) {
        assert.ok(row.verified_at, "the admission timestamp is kept as it was");
        assert.equal(row.ev, null, "no historical identity is treated as proven");
        assert.equal(row.ec, null, "and none names a proving challenge");
      }
      assert.ok(
        await findActiveLocalIdentityByEmail(db, "Alice@Acme.test"),
        "an unproven identity still resolves for sign-in exactly as before",
      );
      assert.deepEqual(
        await readEmailOwnershipState(alice.authIdentityId, deps(T0, { mailEnv: {} })),
        { status: "unverified", latest: null, deliveryAvailable: false },
        "without mail configuration the state says so, and the notice will render nothing",
      );
      /* The pair CHECK refuses a half-written proof. */
      await assert.rejects(
        setup.query(`update auth_identities set email_ownership_verified_at = now() where id = $1`, [
          alice.authIdentityId,
        ]),
        /auth_identities_email_ownership_pair_chk/,
      );
    }

    /* ═══ 2. NO MAIL CONFIGURATION → NOTHING IS WRITTEN, NOTHING IS SENT ══════ */
    {
      const { fetchImpl, sends } = createRecordingFetch();
      for (const env of [
        {},
        { ...TEST_AUTH_MAIL_ENV, HEBUN_AUTH_MAIL_LINK_ORIGIN: "http://app.example.test" },
        { ...TEST_AUTH_MAIL_ENV, HEBUN_AUTH_MAIL_LINK_ORIGIN: "https://app.example.test/path" },
        { ...TEST_AUTH_MAIL_ENV, HEBUN_AUTH_MAIL_LINK_ORIGIN: "https://app.example.test?x=1" },
        { ...TEST_AUTH_MAIL_ENV, HEBUN_AUTH_MAIL_API_KEY: "  " },
      ]) {
        assert.deepEqual(
          await issueEmailVerification(alice.authIdentityId, deps(T0, { mailEnv: env, fetchImpl })),
          { status: "refused", reason: "delivery-unavailable" },
        );
      }
      assert.equal(await count(setup, "auth_email_challenges"), 0, "a missing configuration consumes nobody's allowance");
      assert.equal(sends.length, 0, "and reaches no transport");
    }

    /* ═══ 3. ISSUE — own address, fragment-only token, digest at rest ═════════ */
    let firstToken: string;
    {
      const { fetchImpl, sends } = createRecordingFetch();
      const issued = await issueEmailVerification(alice.authIdentityId, deps(T0, { fetchImpl }));
      assert.deepEqual(issued, { status: "issued", delivery: "accepted" });
      assert.equal(sends.length, 1, "exactly one message");
      const send = sends[0]!;
      assert.equal(send.url, "https://api.resend.com/emails", "the one released transport host");
      assert.deepEqual(send.body.to, ["Alice@Acme.test"], "to the identity's own stored address");
      assert.equal(send.body.from, TEST_AUTH_MAIL_ENV.HEBUN_AUTH_MAIL_FROM, "from the auth sender only");
      assert.equal(send.body.subject, EMAIL_VERIFICATION_SUBJECT, "a fixed subject");
      assert.equal(send.headers.Authorization, `Bearer ${TEST_AUTH_MAIL_ENV.HEBUN_AUTH_MAIL_API_KEY}`);

      const link = send.body.text.split("\n").find((l) => l.startsWith("https://"))!;
      const url = new URL(link);
      assert.equal(url.origin, "https://app.example.test", "the configured origin, never a request host");
      assert.equal(url.pathname, "/verify-email");
      assert.equal(url.search, "", "the token is never in a query string a server would log");
      assert.ok(url.hash.startsWith("#token="), "it rides in the fragment only");
      firstToken = tokenFromSend(send);
      assert.match(firstToken, /^[A-Za-z0-9_-]{43}$/, "a 256-bit base64url token");

      const row = await setup.query<Record<string, unknown>>(`select * from auth_email_challenges`);
      assert.equal(row.rowCount, 1);
      const c = row.rows[0]!;
      assert.equal(send.headers["Idempotency-Key"], c.id, "the provider deduplicates by challenge id");
      assert.equal(c.email_at_issue, "alice@acme.test", "the proven address is recorded normalized");
      assert.equal(c.token_digest_version, 1);
      assert.equal(c.delivery_outcome, "accepted");
      assert.ok(c.delivery_attempted_at);
      assert.equal(c.consumed_at, null);
      assert.ok(
        !JSON.stringify(row.rows).includes(firstToken),
        "the raw token is stored nowhere — not even inside the row's text",
      );

      const state = await readEmailOwnershipState(alice.authIdentityId, deps(T0));
      assert.equal(state.status, "unverified");
      assert.ok(state.status === "unverified" && state.latest?.delivery === "accepted" && state.deliveryAvailable);
      assert.ok(!JSON.stringify(state).includes(firstToken), "the state never carries the token");
    }

    /* ═══ 4. COOLDOWN, SUPERSESSION, ONE OPEN LINK ════════════════════════════ */
    let secondToken: string;
    {
      const { fetchImpl, sends } = createRecordingFetch();
      assert.deepEqual(
        await issueEmailVerification(alice.authIdentityId, deps(at(30), { fetchImpl })),
        { status: "refused", reason: "cooldown" },
      );
      assert.equal(sends.length, 0);
      assert.deepEqual(
        await issueEmailVerification(alice.authIdentityId, deps(at(61), { fetchImpl })),
        { status: "issued", delivery: "accepted" },
      );
      secondToken = tokenFromSend(sends[0]!);
      assert.equal(
        await count(setup, "auth_email_challenges", "consumed_at is null and superseded_at is null"),
        1,
        "exactly one open link",
      );
      assert.equal(await count(setup, "auth_email_challenges", "superseded_at is not null"), 1, "the old one is superseded");
      /* The database itself refuses a second open link. */
      await assert.rejects(
        setup.query(
          `insert into auth_email_challenges (auth_identity_id, purpose, email_at_issue, token_digest_version,
             token_hash, issued_at, expires_at)
           values ($1, 'email-verification', 'alice@acme.test', 1, repeat('c', 64), now(), now() + interval '1 hour')`,
          [alice.authIdentityId],
        ),
        /auth_email_challenges_open_uq/,
      );
      await assert.rejects(
        setup.query(
          `insert into auth_email_challenges (auth_identity_id, purpose, email_at_issue, token_digest_version,
             token_hash, issued_at, expires_at, superseded_at)
           values ($1, 'email-verification', 'alice@acme.test', 1, repeat('d', 64), now(), now() + interval '25 hours', now())`,
          [alice.authIdentityId],
        ),
        /auth_email_challenges_expiry_chk/,
        "no link may live longer than 24 hours",
      );
    }

    /* ═══ 5. CONFIRM REFUSALS CHANGE NOTHING ══════════════════════════════════ */
    {
      const aliceAs = { authIdentityId: alice.authIdentityId, sessionContextId: aliceSession };
      const bobAs = { authIdentityId: bob.authIdentityId, sessionContextId: bobSession };
      const keys = [TEST_EMAIL_DIGEST_KEY];
      const refuse = async (token: string, as: typeof aliceAs, when: Date, reason: string) =>
        assert.deepEqual(await confirmEmailVerification(token, as, deps(when, { digestKeys: keys })), {
          status: "refused",
          reason,
        });

      await refuse("not a token", aliceAs, at(62), "invalid-link");
      await refuse("A".repeat(43), aliceAs, at(62), "invalid-link");
      await refuse(firstToken, aliceAs, at(62), "invalid-link"); // superseded
      await refuse(secondToken, bobAs, at(62), "different-account");
      await refuse(secondToken, aliceAs, at(61 + 24 * 3600 + 1), "invalid-link"); // expired
      assert.deepEqual(
        await confirmEmailVerification(secondToken, aliceAs, deps(at(62), { digestKeys: [ROTATED_KEY] })),
        { status: "refused", reason: "invalid-link" },
        "a token is only recognised under the key version that digested it",
      );

      /* An address change after issue invalidates the link. */
      await setup.query(`update users set email = 'alice2@acme.test' where id = $1`, [alice.userId]);
      await refuse(secondToken, aliceAs, at(62), "invalid-link");
      await setup.query(`update users set email = 'Alice@Acme.test' where id = $1`, [alice.userId]);

      assert.equal(await count(setup, "auth_email_challenges", "consumed_at is not null"), 0);
      assert.equal(await count(setup, "auth_identities", "email_ownership_verified_at is not null"), 0);
    }

    /* ═══ 6. CONFIRM — rotated key, concurrency, replay ═══════════════════════ */
    {
      const aliceAs = { authIdentityId: alice.authIdentityId, sessionContextId: aliceSession };
      /* Two presentations at once: exactly one proof. Keys listed as after a rotation. */
      const [a, b] = await Promise.all([
        confirmEmailVerification(secondToken, aliceAs, deps(at(70), { digestKeys: [ROTATED_KEY, PREVIOUS_KEY] })),
        confirmEmailVerification(secondToken, aliceAs, deps(at(70), { digestKeys: [ROTATED_KEY, PREVIOUS_KEY] })),
      ]);
      const outcomes = [a, b].map((r) => (r.status === "verified" ? "verified" : r.reason)).sort();
      assert.equal(outcomes.filter((o) => o === "verified").length, 1, `exactly one wins: ${outcomes}`);
      assert.ok(["already-verified", "invalid-link"].includes(outcomes.find((o) => o !== "verified")!));

      const identity = await setup.query<{ ev: Date; ec: string; verified_at: Date }>(
        `select email_ownership_verified_at as ev, email_ownership_challenge_id as ec, verified_at
           from auth_identities where id = $1`,
        [alice.authIdentityId],
      );
      const challenge = await setup.query<{ id: string; consumed_session_context_id: string }>(
        `select id, consumed_session_context_id from auth_email_challenges where consumed_at is not null`,
      );
      assert.equal(challenge.rowCount, 1);
      assert.equal(identity.rows[0]!.ec, challenge.rows[0]!.id, "the proof names the challenge that made it");
      assert.equal(challenge.rows[0]!.consumed_session_context_id, aliceSession, "and the session that presented it");
      assert.equal(identity.rows[0]!.ev.toISOString(), at(70).toISOString());

      assert.deepEqual(
        await confirmEmailVerification(secondToken, aliceAs, deps(at(80), { digestKeys: [PREVIOUS_KEY] })),
        { status: "refused", reason: "already-verified" },
        "a replay is refused",
      );
      assert.deepEqual(
        await issueEmailVerification(alice.authIdentityId, deps(at(200))),
        { status: "refused", reason: "already-verified" },
        "a proven identity is sent nothing",
      );
      const state = await readEmailOwnershipState(alice.authIdentityId, deps(at(200)));
      assert.deepEqual(state, { status: "verified", verifiedAt: at(70).toISOString() });
      assert.ok(await findActiveLocalIdentityByEmail(db, "Alice@Acme.test"), "sign-in resolution is unchanged by a proof");
    }

    /* ═══ 7. DAILY LIMIT, CONCURRENT ISSUES, SUSPENDED IDENTITY ═══════════════ */
    {
      const carol = await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech", email: "carol@initech.test" });
      const { fetchImpl } = createRecordingFetch();
      const [x, y] = await Promise.all([
        issueEmailVerification(carol.authIdentityId, deps(T0, { fetchImpl })),
        issueEmailVerification(carol.authIdentityId, deps(T0, { fetchImpl })),
      ]);
      const pair = [x, y].map((r) => (r.status === "issued" ? "issued" : r.reason)).sort();
      assert.deepEqual(pair, ["cooldown", "issued"], "concurrent issues serialize on the identity lock");
      for (let i = 1; i <= 4; i += 1) {
        assert.equal(
          (await issueEmailVerification(carol.authIdentityId, deps(at(i * 61), { fetchImpl }))).status,
          "issued",
        );
      }
      assert.deepEqual(
        await issueEmailVerification(carol.authIdentityId, deps(at(5 * 61), { fetchImpl })),
        { status: "refused", reason: "daily-limit" },
      );
      assert.equal(
        (await issueEmailVerification(carol.authIdentityId, deps(at(24 * 3600 + 1), { fetchImpl }))).status,
        "issued",
        "the allowance is a rolling window",
      );

      await setup.query(`update auth_identities set status = 'suspended', is_primary = false where id = $1`, [bob.authIdentityId]);
      assert.deepEqual(
        await issueEmailVerification(bob.authIdentityId, deps(T0)),
        { status: "refused", reason: "identity-unavailable" },
      );
      await setup.query(`update auth_identities set status = 'active', is_primary = true where id = $1`, [bob.authIdentityId]);
    }

    /* ═══ 8. PROVIDER FAILURES ARE RECORDED TRUTHFULLY, ONCE ══════════════════ */
    {
      const cases = [
        ["rejected", "rejected"],
        ["server-error", "ambiguous"],
        ["throw-dns", "unreachable"],
        ["throw-abort", "ambiguous"],
      ] as const;
      let offset = 0;
      for (const [answer, expected] of cases) {
        offset += 61;
        const { fetchImpl } = createRecordingFetch(answer);
        const issued = await issueEmailVerification(bob.authIdentityId, deps(at(offset), { fetchImpl }));
        assert.deepEqual(issued, { status: "issued", delivery: expected }, `${answer} → ${expected}`);
        const recorded = await setup.query<{ delivery_outcome: string }>(
          `select delivery_outcome from auth_email_challenges
            where auth_identity_id = $1 and consumed_at is null and superseded_at is null`,
          [bob.authIdentityId],
        );
        assert.equal(recorded.rows[0]!.delivery_outcome, expected);
      }
      const state = await readEmailOwnershipState(bob.authIdentityId, deps(at(offset)));
      assert.ok(state.status === "unverified" && state.latest?.delivery === "ambiguous", "the banner reads the last outcome");
      /* A crash between commit and send leaves NO outcome, which reads as unknown — never as sent. */
      await setup.query(
        `update auth_email_challenges set delivery_outcome = null, delivery_attempted_at = null
          where auth_identity_id = $1 and consumed_at is null and superseded_at is null`,
        [bob.authIdentityId],
      );
      const unknown = await readEmailOwnershipState(bob.authIdentityId, deps(at(offset)));
      assert.ok(unknown.status === "unverified" && unknown.latest?.delivery === null);
    }

    /* ═══ 9. THE GLOBAL BREAKER ═══════════════════════════════════════════════ */
    {
      const dave = await seedLocalIdentity(setup, { companyName: "Hooli", companySlug: "hooli", email: "dave@hooli.test" });
      await setup.query(
        `insert into auth_email_challenges (auth_identity_id, purpose, email_at_issue, token_digest_version,
           token_hash, issued_at, expires_at, superseded_at)
         select $1, 'email-verification', 'dave@hooli.test', 1,
                md5(g::text) || md5((g + 100000)::text), $2::timestamptz, $2::timestamptz + interval '1 hour',
                $2::timestamptz
           from generate_series(1, 200) g`,
        [dave.authIdentityId, at(-60).toISOString()],
      );
      const eve = await seedLocalIdentity(setup, { companyName: "Vandelay", companySlug: "vandelay", email: "eve@vandelay.test" });
      assert.deepEqual(
        await issueEmailVerification(eve.authIdentityId, deps(T0)),
        { status: "refused", reason: "global-limit" },
      );
      await setup.query(`delete from auth_email_challenges where auth_identity_id = $1`, [dave.authIdentityId]);
    }

    /* ═══ 10. GENESIS ACCEPTANCE REQUIRES A PROVEN ADDRESS ════════════════════ */
    {
      const frank = await seedLocalIdentity(setup, { companyName: "Stark", companySlug: "stark", email: "frank@stark.test" });
      const frankSession = await sessionFor(setup, frank, "f");
      const frankCtx = contextFor(frank, frankSession);
      const target = await resolveNominationTarget(setup, "stark", "frank@stark.test");
      assert.ok(target, "an unproven human can still be nominated — nomination grants nothing");
      assert.equal((await nominateGenesisHuman(setup, target!)).status, "nominated");

      const genesisDeps = { getDb: () => db, now: () => at(500) };
      assert.deepEqual(await acceptGenesisNomination(frankCtx, genesisDeps), {
        status: "refused",
        reason: "email-ownership-unproven",
      });
      assert.equal(await count(setup, "genesis_nominations", "tenant_id = $1 and status = 'pending'", [frank.tenantId]), 1);
      assert.equal(
        await count(setup, "audit_log", "tenant_id = $1 and action = 'governance.genesis-nomination.accepted'", [frank.tenantId]),
        0,
        "a refusal writes no history",
      );

      await proveEmailOwnership(db, { authIdentityId: frank.authIdentityId, sessionContextId: frankSession, now: at(600) });
      const proof = await readEmailOwnershipProof(db, frank.authIdentityId);
      assert.ok(proof.proven && proof.challengeId);

      /* A proof stops counting the moment the address it proved is no longer the identity's. */
      await setup.query(`update users set email = 'frank+new@stark.test' where id = $1`, [frank.userId]);
      assert.deepEqual(await acceptGenesisNomination(frankCtx, genesisDeps), {
        status: "refused",
        reason: "email-ownership-unproven",
      });
      await setup.query(`update users set email = 'frank@stark.test' where id = $1`, [frank.userId]);

      const accepted = await acceptGenesisNomination(frankCtx, genesisDeps);
      assert.equal(accepted.status, "accepted");
      const audit = await setup.query<{ metadata: Record<string, unknown> }>(
        `select metadata from audit_log where tenant_id = $1 and action = 'governance.genesis-nomination.accepted'`,
        [frank.tenantId],
      );
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0]!.metadata.emailOwnershipChallengeId, proof.challengeId, "the history names the proof");
      assert.ok(!JSON.stringify(audit.rows[0]!.metadata).includes("@"), "and never an address");

      /* An already-accepted genesis is untouched: proving nothing, changing nothing. */
      assert.deepEqual(await acceptGenesisNomination(frankCtx, genesisDeps), { status: "refused", reason: "already-accepted" });
    }

    /* ═══ 11. THE OPERATOR LISTING REPORTS PROVEN ADDRESSES ═══════════════════ */
    {
      await setup.query(`update companies set provisioning_source = $1 where slug in ('acme', 'globex')`, [
        TENANT_PROVISIONING_SOURCE_SELF_SERVICE,
      ]);
      const pending = await listPendingSelfServiceTenants(setup, TENANT_PROVISIONING_SOURCE_SELF_SERVICE);
      const acme = pending.find((t) => t.tenantSlug === "acme")!;
      const globex = pending.find((t) => t.tenantSlug === "globex")!;
      assert.deepEqual(acme.memberEmails, ["alice@acme.test"]);
      assert.deepEqual(acme.provenEmails, ["alice@acme.test"], "alice proved her address");
      assert.deepEqual(globex.provenEmails, [], "bob did not");
    }

    /* ═══ 12. SIGNUP STILL ADMITS, AND ADMISSION IS NOT PROOF ═════════════════ */
    {
      const outcome = await createSelfServiceAccount(
        { fullName: "Grace Hopper", email: "grace@navy.test", password: "grace-correct-password-9Zt", organizationName: "Navy" },
        db,
      );
      assert.equal(outcome.status, "created");
      const row = await setup.query<{ verified_at: Date | null; ev: Date | null; status: string }>(
        `select i.verified_at, i.email_ownership_verified_at as ev, i.status
           from auth_identities i join users u on u.id = i.user_id where u.email = 'grace@navy.test'`,
      );
      assert.equal(row.rows[0]!.status, "active", "the new account can sign in immediately, as before");
      assert.ok(row.rows[0]!.verified_at, "admission is recorded as before");
      assert.equal(row.rows[0]!.ev, null, "and is not mistaken for proof");
    }

    console.log("auth-email-ownership-1 ownership-postgres: PASS");
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
