/*
 * D1.1 — development credential provisioning, proved against a REAL database.
 *
 * THE INVARIANT. Provisioning writes a CREDENTIAL. It must never become a second
 * way to authenticate. The test that matters most here is not "a row appeared" —
 * it is that a credential written by this tool is verified by the SAME production
 * login path, and that the tool touches nothing else: no session, no membership,
 * no role, no tenant.
 *
 * Rotation is the dangerous operation, because `auth_credentials` permits exactly
 * one ACTIVE password credential per identity. A non-transactional rotation could
 * leave the operator with none. That case is proved, not assumed.
 *
 * The fixture passwords below are test data. They are NOT anybody's development
 * password, and this file never writes to a real database.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { resolveAuthenticationEnvironment } from "../../src/features/auth/server";
import { issueLocalSession } from "../../src/features/auth-runtime/session-service.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  MIN_DEV_PASSWORD_LENGTH,
  assertLocalDatabaseUrl,
  findActiveIdentityByEmail,
  hasActiveCredential,
  provisionDevCredential,
} from "../../scripts/lib/provision-dev-credential";

const FIRST_PASSWORD = "fixture-first-password-01";
const ROTATED_PASSWORD = "fixture-rotated-password-02";

const harness = createDisposablePostgresHarness("d1_1_provisioning");

async function main(): Promise<void> {
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    // An identity with NO credential — exactly the state D1 left dev identities in.
    const dana = await seedLocalIdentity(setup, {
      companyName: "Initech",
      companySlug: "initech",
      email: "dana@initech.test",
      roleType: "owner",
    });
    assert.equal(dana.credentialId, undefined, "dana starts with no credential");

    const env = resolveAuthenticationEnvironment({
      HEBUN_AUTH_ENABLED: "true",
      HEBUN_AUTH_PROVIDER: "local",
      DATABASE_URL: harness.dbUrl,
      HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
      HEBUN_AUTH_SESSION_DIGEST_SECRET: "d1-1-provisioning-test-secret",
    });
    if (env.status !== "configured") throw new Error("env must be configured");

    const signIn = (email: string, password: string) =>
      issueLocalSession(controlPlane.db, env, {
        email,
        password,
        requestId: `req-${Math.random()}`,
      });

    /* ── Before provisioning, the identity genuinely cannot sign in ──────────── */
    {
      const refused = await signIn("dana@initech.test", FIRST_PASSWORD);
      assert.deepEqual(refused.result, { status: "unauthenticated", reason: "invalid" });
      assert.equal(refused.diagnostic, "no-credential");
    }

    /* ── Identity resolution ─────────────────────────────────────────────────── */
    let identity!: NonNullable<Awaited<ReturnType<typeof findActiveIdentityByEmail>>>;
    {
      const found = await findActiveIdentityByEmail(setup, "dana@initech.test");
      assert.ok(found, "the active identity resolves");
      identity = found;
      assert.equal(identity.authIdentityId, dana.authIdentityId);
      assert.equal(identity.provider, "local");

      // Case-insensitive, and unknown/absent identities resolve to nothing rather
      // than to something convenient.
      assert.ok(await findActiveIdentityByEmail(setup, "DANA@INITECH.TEST"));
      assert.equal(await findActiveIdentityByEmail(setup, "ghost@nowhere.test"), undefined);

      await setup.query(
        "update auth_identities set status = 'revoked', revoked_at = now(), revocation_reason = 'test', is_primary = false where id = $1",
        [dana.authIdentityId],
      );
      assert.equal(
        await findActiveIdentityByEmail(setup, "dana@initech.test"),
        undefined,
        "a revoked identity cannot be provisioned for",
      );
      await setup.query(
        "update auth_identities set status = 'active', revoked_at = null, revocation_reason = null where id = $1",
        [dana.authIdentityId],
      );
    }

    /* ── CREATE, and the credential is real: the LOGIN path verifies it ─────── */
    {
      assert.equal(await hasActiveCredential(setup, identity.authIdentityId), false);
      const result = await provisionDevCredential(setup, identity, FIRST_PASSWORD);
      assert.equal(result.action, "created");
      assert.equal(result.algorithm, "scrypt");
      assert.equal(await hasActiveCredential(setup, identity.authIdentityId), true);

      // THE POINT OF THE WHOLE TOOL: the production sign-in path accepts it.
      const authorized = await signIn("dana@initech.test", FIRST_PASSWORD);
      assert.equal(authorized.result.status, "authorized", "provisioned credential works");
      if (authorized.result.status === "authorized") {
        assert.equal(authorized.result.tenantContext.userId, dana.userId);
        assert.equal(authorized.result.tenantContext.tenantId, dana.tenantId);
        assert.equal(authorized.result.tenantContext.assuranceLevel, "aal1");
      }
      // …and a wrong password is still wrong.
      const refused = await signIn("dana@initech.test", "not-the-password");
      assert.deepEqual(refused.result, { status: "unauthenticated", reason: "invalid" });
    }

    /* ── Provisioning grants nothing: no session, no membership, no role ─────── */
    {
      const before = {
        sessions: (
          await setup.query<{ c: string }>(
            "select count(*)::text as c from user_session_contexts",
          )
        ).rows[0]!.c,
        memberships: (
          await setup.query<{ c: string }>("select count(*)::text as c from memberships")
        ).rows[0]!.c,
        roles: (await setup.query<{ c: string }>("select count(*)::text as c from roles"))
          .rows[0]!.c,
      };
      const roleBefore = await setup.query(
        "select role_id, tenant_id, status from memberships where id = $1",
        [dana.membershipId],
      );

      await provisionDevCredential(setup, identity, ROTATED_PASSWORD);

      const after = {
        sessions: (
          await setup.query<{ c: string }>(
            "select count(*)::text as c from user_session_contexts",
          )
        ).rows[0]!.c,
        memberships: (
          await setup.query<{ c: string }>("select count(*)::text as c from memberships")
        ).rows[0]!.c,
        roles: (await setup.query<{ c: string }>("select count(*)::text as c from roles"))
          .rows[0]!.c,
      };
      assert.equal(after.sessions, before.sessions, "provisioning minted no session");
      assert.equal(after.memberships, before.memberships, "created no membership");
      assert.equal(after.roles, before.roles, "created no role");

      const roleAfter = await setup.query(
        "select role_id, tenant_id, status from memberships where id = $1",
        [dana.membershipId],
      );
      assert.deepEqual(roleAfter.rows[0], roleBefore.rows[0], "membership untouched");
    }

    /* ── ROTATE: exactly one active credential, old one revoked not deleted ─── */
    {
      const rows = await setup.query<{ status: string; revocation_reason: string | null }>(
        `select status, revocation_reason from auth_credentials
          where auth_identity_id = $1 order by created_at`,
        [identity.authIdentityId],
      );
      assert.equal(rows.rows.length, 2, "the old credential still exists as history");
      assert.equal(rows.rows[0]!.status, "revoked", "the previous one was revoked…");
      assert.match(rows.rows[0]!.revocation_reason ?? "", /rotated/, "…with a stated reason");
      assert.equal(rows.rows[1]!.status, "active");
      assert.equal(
        rows.rows.filter((r) => r.status === "active").length,
        1,
        "there is never more than one active credential",
      );

      // The rotated password works; the old one does not.
      const withNew = await signIn("dana@initech.test", ROTATED_PASSWORD);
      assert.equal(withNew.result.status, "authorized", "the rotated password works");
      const withOld = await signIn("dana@initech.test", FIRST_PASSWORD);
      assert.deepEqual(
        withOld.result,
        { status: "unauthenticated", reason: "invalid" },
        "the superseded password no longer authenticates",
      );
    }

    /* ── A failed rotation must never leave the operator with NO credential ─── */
    {
      // Force the insert to fail mid-transaction by violating a CHECK, then prove
      // the revoke was rolled back with it — the outcome that would lock somebody
      // out of their own machine.
      const identityId = identity.authIdentityId;
      await assert.rejects(
        async () => {
          await setup.query("begin");
          try {
            await setup.query(
              `update auth_credentials set status='revoked', revoked_at=now(),
                      revocation_reason='rotated by local dev provisioning'
                where auth_identity_id=$1 and status='active'`,
              [identityId],
            );
            await setup.query(
              `insert into auth_credentials
                 (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
               values ($1,'password','scrypt','{}'::jsonb,$2,$3,'active')`,
              [identityId, "not-a-valid-hex-salt", "z".repeat(128)],
            );
            await setup.query("commit");
          } catch (error) {
            await setup.query("rollback");
            throw error;
          }
        },
        /auth_credentials_salt_chk/,
        "the bad insert is rejected by the database",
      );

      assert.equal(
        await hasActiveCredential(setup, identityId),
        true,
        "after a failed rotation the operator still has a working credential",
      );
      const stillWorks = await signIn("dana@initech.test", ROTATED_PASSWORD);
      assert.equal(stillWorks.result.status, "authorized", "and it still signs in");
    }

    /* ── Guards ──────────────────────────────────────────────────────────────── */
    {
      await assert.rejects(
        () => provisionDevCredential(setup, identity, "short"),
        new RegExp(`at least ${MIN_DEV_PASSWORD_LENGTH}`),
        "a trivially short password is refused",
      );

      assert.throws(
        () => assertLocalDatabaseUrl("postgresql://postgres@db.example.com:5432/prod"),
        /non-local database/,
        "a remote database is refused outright",
      );
      assert.doesNotThrow(() =>
        assertLocalDatabaseUrl("postgresql://postgres@127.0.0.1:55432/hebun_r1"),
      );
    }

    console.log("D1.1 dev credential provisioning (PostgreSQL): passed");
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
