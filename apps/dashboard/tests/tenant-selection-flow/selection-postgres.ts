/*
 * Tenant Selection Authority — the zero / one / many outcomes and secure selection, against a REAL
 * PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A verified credential resolves to `authorized` when the human holds exactly one active
 *    membership — unchanged — to `onboarding-required` when they hold none, and to
 *    `tenant-selection-required` when they hold several. Choosing one of the server-derived
 *    candidates re-reads that membership by id AND by the authenticated human, re-checks its
 *    lifecycle and its tenant, and issues a FRESH tenant-bound session. Nothing shown in the
 *    candidate list is trusted on the way back, and a pre-tenant receipt authorizes nothing."
 *
 * Plus the Director's attack matrix, each case marked below.
 *
 * Uses a disposable local database created and destroyed through the ownership handle.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { hashPassword } from "../../src/features/auth-runtime/password-hash.server";
import {
  PRE_TENANT_SESSION_TTL_SECONDS,
  issueLocalSession,
  readSelectableWorkspaces,
  resolveSessionFromReference,
  selectTenantForSession,
} from "../../src/features/auth-runtime/session-service.server";
import {
  findActiveMemberships,
  findMembershipForUser,
  findPrimaryActiveMembership,
  findTenantCandidates,
} from "../../src/features/auth-runtime/identity-repository.server";
import type {
  AuthenticationDigestKey,
  ConfiguredAuthenticationEnvironment,
} from "../../src/features/auth/environment/auth-environment.server";

const NOW = new Date("2026-08-12T18:00:00.000Z");
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "tenant-selection-secret" });
const PASSWORD = "a-correct-horse-battery-7Qx";

function envFor(dbUrl: string): ConfiguredAuthenticationEnvironment {
  return {
    status: "configured",
    enabled: true,
    provider: "local",
    controlPlaneDatabaseUrl: dbUrl,
    sessionDigestCurrentKey: KEY,
  } as ConfiguredAuthenticationEnvironment;
}

/** A verified human with a real credential and NO membership anywhere. */
async function seedFreeHuman(client: Client, email: string): Promise<string> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1,$1) returning id`, [email],
  );
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1,'local','hebun-local',$2,'active',true,now()) returning id`,
    [user.rows[0]!.id, `local:${email}`],
  );
  const hashed = await hashPassword(PASSWORD);
  await client.query(
    `insert into auth_credentials (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
     values ($1,'password',$2,$3::jsonb,$4,$5,'active')`,
    [identity.rows[0]!.id, hashed.algorithm, JSON.stringify(hashed.params), hashed.salt, hashed.secretHash],
  );
  return user.rows[0]!.id;
}

/** Give an existing human a membership in an existing tenant, with that tenant's own member role. */
async function addMembership(
  client: Client, tenantId: string, userId: string, roleName: string,
): Promise<{ membershipId: string; roleId: string }> {
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1,$2,'member') returning id`,
    [tenantId, roleName],
  );
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1,$2,$3,'active') returning id`,
    [tenantId, userId, role.rows[0]!.id],
  );
  return { membershipId: membership.rows[0]!.id, roleId: role.rows[0]!.id };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_tenant_selection");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const env = envFor(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* Two tenants, each with a seeded owner human. */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme",
      email: "solo@acme.test", password: PASSWORD,
    });
    const B = await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex",
      email: "root@globex.test", password: PASSWORD,
    });

    /* ══ ATTACK 2 / 31: ONE membership → authorized, exactly as before ═══════ */
    {
      const issued = await issueLocalSession(
        handle.db, env, { email: "solo@acme.test", password: PASSWORD, requestId: "ts-1" }, NOW,
      );
      assert.equal(issued.diagnostic, "ok", "one membership still signs straight in");
      assert.equal(issued.result.status, "authorized");
      if (issued.result.status !== "authorized") throw new Error("unreachable");
      assert.equal(issued.result.tenantContext.tenantId, A.tenantId);
      assert.equal(issued.result.tenantContext.roleId, A.roleId);
      assert.equal(issued.maxAgeSeconds, 8 * 60 * 60, "and gets a full-length session");

      /* The row it wrote is tenant-bound, not pre-tenant. */
      const row = await setup.query<{ active_tenant_id: string; membership_version: number }>(
        `select active_tenant_id, membership_version from user_session_contexts
          where user_id=$1 order by created_at desc limit 1`, [A.userId],
      );
      assert.equal(row.rows[0]!.active_tenant_id, A.tenantId);
      assert.equal(Number(row.rows[0]!.membership_version), 1);

      /* And the two membership readers agree about which one that is. */
      const primary = await findPrimaryActiveMembership(handle.db, A.userId);
      const all = await findActiveMemberships(handle.db, A.userId);
      assert.equal(all.length, 1);
      assert.equal(
        all[0]!.membershipId, primary!.membershipId,
        "the first row of the list IS what an unqualified sign-in resolves",
      );
    }

    /* ══ ATTACK 1: ZERO memberships → onboarding-required ════════════════════ */
    const orphanId = await seedFreeHuman(setup, "orphan@acme.test");
    {
      const issued = await issueLocalSession(
        handle.db, env, { email: "orphan@acme.test", password: PASSWORD, requestId: "ts-2" }, NOW,
      );
      assert.equal(issued.result.status, "onboarding-required");
      assert.equal(issued.diagnostic, "no-membership");
      assert.equal(
        issued.maxAgeSeconds, PRE_TENANT_SESSION_TTL_SECONDS,
        "a half-finished sign-in gets a short-lived receipt, not an 8-hour one",
      );

      /* The receipt exists, is pre-tenant, and grants nothing. */
      const row = await setup.query<{ active_tenant_id: string | null; active_membership_id: string | null; membership_version: number | null }>(
        `select active_tenant_id, active_membership_id, membership_version
           from user_session_contexts where user_id=$1`, [orphanId],
      );
      assert.equal(row.rows.length, 1);
      assert.equal(row.rows[0]!.active_tenant_id, null);
      assert.equal(row.rows[0]!.active_membership_id, null);
      assert.equal(row.rows[0]!.membership_version, null);

      const resolved = await resolveSessionFromReference(
        handle.db, env, issued.reference, { requestId: "ts-2r" }, NOW,
      );
      assert.equal(
        resolved.status, "onboarding-required",
        "the pre-tenant receipt resolves to onboarding-required, never to authorized",
      );

      /* Nothing to choose. */
      const candidates = await readSelectableWorkspaces(handle.db, env, issued.reference, NOW);
      assert.equal(candidates.length, 0);

      /* ══ ATTACK 5 / 30: a guessed membership id cannot authorize ═══════════ */
      const guessed = await selectTenantForSession(
        handle.db, env, issued.reference,
        { membershipId: "00000000-0000-4000-8000-000000000000", requestId: "ts-2g" }, NOW,
      );
      assert.equal(guessed.status === "refused" && guessed.reason, "membership-unavailable");

      /* ══ ATTACK 6: another human's membership cannot authorize ═════════════ */
      const foreign = await selectTenantForSession(
        handle.db, env, issued.reference,
        { membershipId: A.membershipId, requestId: "ts-2f" }, NOW,
      );
      assert.equal(
        foreign.status === "refused" && foreign.reason, "membership-unavailable",
        "a real, live membership belonging to somebody else is indistinguishable from a guess",
      );
      const stillNone = await setup.query(
        `select count(*) from user_session_contexts where user_id=$1 and active_tenant_id is not null`,
        [orphanId],
      );
      assert.equal(Number(stillNone.rows[0]!.count), 0, "no tenant-bound session was created");
    }

    /* ══ TWO memberships → tenant-selection-required ═════════════════════════ */
    const multiId = await seedFreeHuman(setup, "multi@acme.test");
    const inA = await addMembership(setup, A.tenantId, multiId, "Member A");
    const inB = await addMembership(setup, B.tenantId, multiId, "Member B");

    const selectionSignIn = await issueLocalSession(
      handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-3" }, NOW,
    );
    {
      /* ══ ATTACK 3 ═══════════════════════════════════════════════════════════ */
      assert.equal(selectionSignIn.result.status, "tenant-selection-required");
      assert.equal(selectionSignIn.diagnostic, "tenant-selection-required");
      if (selectionSignIn.result.status !== "tenant-selection-required") throw new Error("x");
      assert.deepEqual(
        [...selectionSignIn.result.eligibleTenantIds].sort(),
        [A.tenantId, B.tenantId].sort(),
        "the eligible list is derived from live memberships",
      );
      assert.equal(selectionSignIn.result.canonicalIdentity.userId, multiId);

      /* ══ ATTACK 16: the candidate list is exactly this human's memberships ══ */
      const candidates = await readSelectableWorkspaces(handle.db, env, selectionSignIn.reference, NOW);
      assert.equal(candidates.length, 2);
      assert.deepEqual(
        candidates.map((c) => c.membershipId).sort(),
        [inA.membershipId, inB.membershipId].sort(),
      );
      assert.deepEqual(
        candidates.map((c) => c.tenantName).sort(), ["Acme", "Globex"],
        "the picker gets display names, so a human can tell workspaces apart",
      );
      /* And nothing authority-bearing beyond the entitlement being chosen. */
      for (const candidate of candidates) {
        assert.deepEqual(
          Object.keys(candidate).sort(),
          ["membershipId", "roleName", "tenantId", "tenantName"],
          "no role id, no membership version, no governance provenance",
        );
      }

      /* ══ The pre-tenant receipt authorizes NOTHING ════════════════════════ */
      const resolved = await resolveSessionFromReference(
        handle.db, env, selectionSignIn.reference, { requestId: "ts-3r" }, NOW,
      );
      assert.equal(resolved.status, "tenant-selection-required");
      assert.notEqual(resolved.status, "authorized");
    }

    /* ══ ATTACK 20 / 21: choosing tenant B produces the right context ════════ */
    const selected = await selectTenantForSession(
      handle.db, env, selectionSignIn.reference,
      { membershipId: inB.membershipId, requestId: "ts-4" }, NOW,
    );
    assert.equal(selected.status, "selected");
    if (selected.status !== "selected") throw new Error("unreachable");
    {
      assert.equal(selected.result.status, "authorized");
      if (selected.result.status !== "authorized") throw new Error("unreachable");
      assert.equal(selected.result.tenantContext.tenantId, B.tenantId, "the CHOSEN tenant");
      assert.equal(selected.result.tenantContext.roleId, inB.roleId, "and that tenant's own role");
      assert.equal(selected.result.tenantContext.userId, multiId);
      assert.equal(selected.result.applicationSession.membershipVersion, 1, "the live version");
      assert.equal(selected.maxAgeSeconds, 8 * 60 * 60, "a full-length session now");

      /* ══ SESSION ROTATION: a FRESH reference, and the old one is dead ══════ */
      assert.notEqual(selected.reference, selectionSignIn.reference);
      const dead = await resolveSessionFromReference(
        handle.db, env, selectionSignIn.reference, { requestId: "ts-4d" }, NOW,
      );
      assert.equal(
        dead.status, "unauthenticated",
        "the pre-tenant receipt is revoked the instant a workspace is chosen",
      );

      const live = await resolveSessionFromReference(
        handle.db, env, selected.reference, { requestId: "ts-4l" }, NOW,
      );
      assert.equal(live.status, "authorized");
      if (live.status !== "authorized") throw new Error("unreachable");
      assert.equal(live.tenantContext.tenantId, B.tenantId);

      /* The pre-tenant row was REVOKED, not rewritten — provenance survives. */
      const rows = await setup.query<{ active_tenant_id: string | null; revoked_at: string | null; revocation_reason: string | null }>(
        `select active_tenant_id, revoked_at, revocation_reason from user_session_contexts
          where user_id=$1 order by created_at`, [multiId],
      );
      assert.equal(rows.rows.length, 2, "two rows: the receipt and the tenant-bound session");
      assert.equal(rows.rows[0]!.active_tenant_id, null, "the receipt still says it had no tenant");
      assert.equal(rows.rows[0]!.revocation_reason, "tenant-selected");
      assert.equal(rows.rows[1]!.active_tenant_id, B.tenantId);
      assert.equal(rows.rows[1]!.revoked_at, null);
    }

    /* ══ ATTACK 22-27: selection created nothing ════════════════════════════ */
    {
      const counts = await setup.query<Record<string, string>>(`
        select (select count(*) from memberships)      as memberships,
               (select count(*) from roles)            as roles,
               (select count(*) from users)            as users,
               (select count(*) from auth_identities)  as identities,
               (select count(*) from auth_credentials) as credentials,
               (select count(*) from decision_records) as decisions,
               (select count(*) from knowledge_nodes)  as knowledge,
               (select count(*) from executions)       as executions,
               (select count(*) from provider_connectivity_controls) as providers,
               (select count(*) from invitations)      as invitations
      `);
      const c = counts.rows[0]!;
      assert.equal(Number(c.memberships), 4, "2 seeded owners + the multi human's 2");
      assert.equal(Number(c.roles), 4, "2 seeded owner roles + the 2 member roles this test created");
      assert.equal(Number(c.users), 4);
      assert.equal(Number(c.identities), 4);
      assert.equal(Number(c.credentials), 4);
      assert.equal(Number(c.decisions), 0, "selection makes no Governance decision");
      assert.equal(Number(c.knowledge), 0);
      assert.equal(Number(c.executions), 0);
      assert.equal(Number(c.providers), 0);
      assert.equal(Number(c.invitations), 0);
    }

    /* ══ ATTACK 7 / 17 / 35: revoked membership → refused, and access dies ═══ */
    {
      /* A fresh receipt for the same human, so the picker is open again. */
      const again = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-5" }, NOW,
      );
      assert.equal(again.result.status, "tenant-selection-required");

      /* Candidate list is read... */
      const candidates = await readSelectableWorkspaces(handle.db, env, again.reference, NOW);
      assert.equal(candidates.length, 2, "both still offered at read time");

      /* ...and THEN the membership is revoked, before the human clicks. */
      await setup.query(
        `update memberships set status='revoked', revoked_at=now(),
                                revocation_reason='removed while the picker was open' where id=$1`,
        [inA.membershipId],
      );

      const stale = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inA.membershipId, requestId: "ts-5s" }, NOW,
      );
      assert.equal(
        stale.status === "refused" && stale.reason, "membership-unavailable",
        "the candidate list is not trusted — revalidation refuses a membership revoked since",
      );

      /* The live one still works. */
      const ok = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inB.membershipId, requestId: "ts-5o" }, NOW,
      );
      assert.equal(ok.status, "selected");
      if (ok.status !== "selected") throw new Error("unreachable");

      /* ══ ATTACK 35: revoking the SELECTED membership invalidates access ════ */
      await setup.query(
        `update memberships set status='revoked', revoked_at=now(),
                                revocation_reason='removed after selection' where id=$1`,
        [inB.membershipId],
      );
      const afterRevocation = await resolveSessionFromReference(
        handle.db, env, ok.reference, { requestId: "ts-5x" }, NOW,
      );
      assert.equal(
        afterRevocation.status, "forbidden",
        "the resolver revalidates the selected membership on the very next request",
      );
      assert.equal(
        afterRevocation.status === "forbidden" ? afterRevocation.reason : "", "membership",
      );

      /* Restore for the remaining cases. */
      await setup.query(
        `update memberships set status='active', revoked_at=null, revocation_reason=null
          where id in ($1,$2)`, [inA.membershipId, inB.membershipId],
      );
    }

    /* ══ ATTACK 9: a stale membership VERSION cannot authorize ═══════════════ */
    {
      const again = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-6" }, NOW,
      );
      assert.equal(again.result.status, "tenant-selection-required");
      /* The membership's version moves while the picker is open. */
      await setup.query(`update memberships set version = version + 1 where id=$1`, [inA.membershipId]);

      const ok = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inA.membershipId, requestId: "ts-6s" }, NOW,
      );
      assert.equal(ok.status, "selected", "selection succeeds — with the version read NOW");
      if (ok.status !== "selected") throw new Error("unreachable");
      assert.equal(ok.result.status, "authorized");
      if (ok.result.status !== "authorized") throw new Error("unreachable");
      assert.equal(
        ok.result.applicationSession.membershipVersion, 2,
        "the session carries the CURRENT version, never one remembered from the candidate list",
      );
      const live = await resolveSessionFromReference(
        handle.db, env, ok.reference, { requestId: "ts-6r" }, NOW,
      );
      assert.equal(live.status, "authorized", "so the resolver's version check passes immediately");
    }

    /* ══ ATTACK 8 / 10: inactive tenant is neither offered nor selectable ════ */
    {
      const again = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-7" }, NOW,
      );
      assert.equal(again.result.status, "tenant-selection-required");
      await setup.query(
        `update companies set authentication_disabled_at = now() where id=$1`, [B.tenantId],
      );

      const candidates = await readSelectableWorkspaces(handle.db, env, again.reference, NOW);
      assert.deepEqual(
        candidates.map((c) => c.tenantId), [A.tenantId],
        "a workspace that would refuse the session is not offered",
      );
      const refused = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inB.membershipId, requestId: "ts-7s" }, NOW,
      );
      assert.equal(refused.status === "refused" && refused.reason, "membership-unavailable");
      await setup.query(
        `update companies set authentication_disabled_at = null where id=$1`, [B.tenantId],
      );
    }

    /* ══ ATTACK 19: a spent receipt cannot be replayed ═══════════════════════ */
    {
      const again = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-8" }, NOW,
      );
      assert.equal(again.result.status, "tenant-selection-required");
      const first = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inA.membershipId, requestId: "ts-8a" }, NOW,
      );
      assert.equal(first.status, "selected");

      const replay = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inB.membershipId, requestId: "ts-8b" }, NOW,
      );
      assert.equal(
        replay.status === "refused" && replay.reason, "no-selection-context",
        "replaying a spent receipt cannot mint a second tenant context",
      );
    }

    /* ══ A tenant-bound receipt is not a selection context ═══════════════════ */
    {
      const bound = await issueLocalSession(
        handle.db, env, { email: "solo@acme.test", password: PASSWORD, requestId: "ts-9" }, NOW,
      );
      assert.equal(bound.result.status, "authorized");
      const refused = await selectTenantForSession(
        handle.db, env, bound.reference, { membershipId: A.membershipId, requestId: "ts-9s" }, NOW,
      );
      assert.equal(
        refused.status === "refused" && refused.reason, "no-selection-context",
        "an already-authorized session cannot be re-pointed — post-login switching is not this",
      );
      const candidates = await readSelectableWorkspaces(handle.db, env, bound.reference, NOW);
      assert.equal(candidates.length, 0, "and it offers no picker");
    }

    /* ══ An EXPIRED receipt is not a selection context ═══════════════════════ */
    {
      const again = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-10" }, NOW,
      );
      const later = new Date(NOW.getTime() + (PRE_TENANT_SESSION_TTL_SECONDS + 60) * 1000);
      const refused = await selectTenantForSession(
        handle.db, env, again.reference, { membershipId: inA.membershipId, requestId: "ts-10s" }, later,
      );
      assert.equal(refused.status === "refused" && refused.reason, "no-selection-context");
      const resolved = await resolveSessionFromReference(
        handle.db, env, again.reference, { requestId: "ts-10r" }, later,
      );
      assert.equal(resolved.status, "unauthenticated");
    }

    /* ══ ATTACK 18: concurrent selections do not corrupt session state ═══════ */
    {
      const again = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "ts-11" }, NOW,
      );
      assert.equal(again.result.status, "tenant-selection-required");
      const before = await setup.query<{ c: string }>(
        `select count(*)::text as c from user_session_contexts where user_id=$1`, [multiId],
      );

      const attempts = await Promise.all([
        selectTenantForSession(
          handle.db, env, again.reference, { membershipId: inA.membershipId, requestId: "ts-11a" }, NOW,
        ),
        selectTenantForSession(
          handle.db, env, again.reference, { membershipId: inB.membershipId, requestId: "ts-11b" }, NOW,
        ),
      ]);
      const selectedRuns = attempts.filter((a) => a.status === "selected");
      assert.ok(selectedRuns.length >= 1, "at least one selection must succeed");

      /*
       * Whatever the interleaving, each successful run produced its own FRESH row and revoked the
       * receipt. No row was ever re-pointed, so no session can claim a tenant it was not issued for
       * — the property that matters is that authority is never mutated in place.
       */
      const rows = await setup.query<{ id: string; active_tenant_id: string | null; revoked_at: string | null }>(
        `select id, active_tenant_id, revoked_at from user_session_contexts
          where user_id=$1 order by created_at`, [multiId],
      );
      const after = rows.rows.length;
      assert.equal(
        after, Number(before.rows[0]!.c) + selectedRuns.length,
        "exactly one new row per successful selection — none reused",
      );
      for (const run of selectedRuns) {
        if (run.status !== "selected") continue;
        const resolved = await resolveSessionFromReference(
          handle.db, env, run.reference, { requestId: "ts-11r" }, NOW,
        );
        if (resolved.status === "authorized") {
          assert.ok(
            [A.tenantId, B.tenantId].includes(resolved.tenantContext.tenantId),
            "and every live session points at a tenant the human really belongs to",
          );
        }
      }
    }

    /* ══ The revalidation reader refuses a foreign membership directly ═══════ */
    {
      assert.equal(
        await findMembershipForUser(handle.db, orphanId, inA.membershipId), undefined,
        "findMembershipForUser matches by id AND user together",
      );
      assert.ok(await findMembershipForUser(handle.db, multiId, inA.membershipId));
      assert.equal(
        (await findTenantCandidates(handle.db, orphanId)).length, 0,
        "a human with no memberships has no candidates",
      );
    }

    console.log("PASS tenant selection (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
