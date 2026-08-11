import assert from "node:assert/strict";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import { resolveAuthenticationEnvironment } from "../../src/features/auth/server";
import {
  issueLocalSession,
  resolveSessionFromReference,
  revokeSessionByReference,
} from "../../src/features/auth-runtime/session-service.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r1_session");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    // D1: an identity with no credential can no longer sign in, so the R1 session
    // fixture now carries a real scrypt password. The session assertions below are
    // unchanged — only the precondition for reaching them is stronger.
    const ALICE_PASSWORD = "r1-fixture-password-9f2c";
    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: ALICE_PASSWORD,
    });

    const env = resolveAuthenticationEnvironment({
      HEBUN_AUTH_ENABLED: "true",
      HEBUN_AUTH_PROVIDER: "local",
      DATABASE_URL: harness.dbUrl,
      HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
      HEBUN_AUTH_SESSION_DIGEST_SECRET: "r1-session-test-secret",
    });
    if (env.status !== "configured") throw new Error("env must be configured");

    // --- Issue a durable session and check the resolved tenant context ---
    const issued = await issueLocalSession(controlPlane.db, env, {
      email: "alice@acme.test",
      password: ALICE_PASSWORD,
      requestId: "req-issue",
    });
    if (issued.result.status !== "authorized") {
      throw new Error(`expected authorized, got ${issued.result.status}`);
    }
    const ctx = issued.result.tenantContext;
    assert.equal(ctx.tenantId, alice.tenantId);
    assert.equal(ctx.userId, alice.userId);
    assert.equal(ctx.authIdentityId, alice.authIdentityId);
    assert.equal(ctx.membershipId, alice.membershipId);
    assert.equal(ctx.roleId, alice.roleId);
    assert.equal(ctx.provider, "local");
    assert.equal(ctx.assuranceLevel, "aal1");
    assert.ok(ctx.sessionContextId);
    assert.ok(issued.reference.length > 0);

    // --- Resolve the reference back to the same tenant (server-side) ---
    const resolved = await resolveSessionFromReference(controlPlane.db, env, issued.reference, {
      requestId: "req-resolve",
    });
    assert.equal(resolved.status, "authorized");
    if (resolved.status === "authorized") {
      assert.equal(resolved.tenantContext.tenantId, alice.tenantId);
      assert.equal(resolved.tenantContext.userId, alice.userId);
    }

    // --- Fail closed: missing / invalid references ---
    assert.deepEqual(
      await resolveSessionFromReference(controlPlane.db, env, "", { requestId: "r" }),
      { status: "unauthenticated", reason: "missing" },
    );
    assert.deepEqual(
      await resolveSessionFromReference(controlPlane.db, env, "not-a-real-reference", {
        requestId: "r",
      }),
      { status: "unauthenticated", reason: "invalid" },
    );

    // --- Fail closed: expired session (issued in the past) ---
    const past = new Date(Date.now() - 9 * 60 * 60 * 1000);
    const expiredIssue = await issueLocalSession(
      controlPlane.db,
      env,
      { email: "alice@acme.test", password: ALICE_PASSWORD, requestId: "req-expired" },
      past,
    );
    assert.equal(expiredIssue.result.status, "authorized");
    const expiredResolve = await resolveSessionFromReference(
      controlPlane.db,
      env,
      expiredIssue.reference,
      { requestId: "r" },
    );
    assert.deepEqual(expiredResolve, { status: "unauthenticated", reason: "expired" });

    // --- Fail closed: revoked session ---
    const revokable = await issueLocalSession(controlPlane.db, env, {
      email: "alice@acme.test",
      password: ALICE_PASSWORD,
      requestId: "req-revoke",
    });
    assert.equal(await revokeSessionByReference(controlPlane.db, env, revokable.reference), true);
    assert.deepEqual(
      await resolveSessionFromReference(controlPlane.db, env, revokable.reference, {
        requestId: "r",
      }),
      { status: "unauthenticated", reason: "invalid" },
    );

    // --- Fail closed: membership revoked AFTER issue (live re-validation) ---
    const liveCheck = await issueLocalSession(controlPlane.db, env, {
      email: "alice@acme.test",
      password: ALICE_PASSWORD,
      requestId: "req-live",
    });
    await setup.query(
      "update memberships set status = 'revoked', revoked_at = now() where id = $1",
      [alice.membershipId],
    );
    const afterRevoke = await resolveSessionFromReference(controlPlane.db, env, liveCheck.reference, {
      requestId: "r",
    });
    assert.deepEqual(afterRevoke, { status: "forbidden", reason: "membership" });

    console.log("r1 session + tenant resolution checks passed");
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
