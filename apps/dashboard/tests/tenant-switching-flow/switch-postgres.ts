/*
 * Post-Login Tenant Switching — session authority transition, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human holding a session that is authorized in tenant A can move that session to another
 *    membership they already hold. The current session's authority is judged by the same resolver
 *    every request uses; the target membership is re-read by id AND by the authenticated human and
 *    re-checked from that row; the previous session is spent CONDITIONALLY inside the transaction
 *    that mints the replacement, so two concurrent switches produce exactly one new session; the
 *    old reference is dead immediately; and the absolute expiry is carried over, never restarted.
 *    Nothing is created, nothing is granted, and no membership is changed."
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
  SESSION_ABSOLUTE_TTL_SECONDS,
  SESSION_INACTIVITY_TTL_SECONDS,
  issueLocalSession,
  readSwitchableWorkspaces,
  resolveSessionFromReference,
  selectTenantForSession,
  switchTenantForSession,
} from "../../src/features/auth-runtime/session-service.server";
import { revokeSessionIfActive } from "../../src/features/auth-runtime/identity-repository.server";
import type {
  AuthenticationDigestKey,
  ConfiguredAuthenticationEnvironment,
} from "../../src/features/auth/environment/auth-environment.server";

const NOW = new Date("2026-08-13T09:00:00.000Z");
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "tenant-switching-secret" });
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

/** Sign in and land on ONE chosen workspace, returning the authorized reference. */
async function signInAndSelect(
  db: ReturnType<typeof createControlPlaneDb>["db"],
  env: ConfiguredAuthenticationEnvironment,
  email: string,
  membershipId: string,
  requestId: string,
  now: Date = NOW,
): Promise<string> {
  const issued = await issueLocalSession(db, env, { email, password: PASSWORD, requestId }, now);
  assert.equal(issued.result.status, "tenant-selection-required");
  const selected = await selectTenantForSession(
    db, env, issued.reference, { membershipId, requestId: `${requestId}-s` }, now,
  );
  assert.equal(selected.status, "selected");
  if (selected.status !== "selected") throw new Error("unreachable");
  return selected.reference;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_tenant_switching");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const env = envFor(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* Three tenants, each with a seeded owner human. */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme",
      email: "solo@acme.test", password: PASSWORD,
    });
    const B = await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex",
      email: "root@globex.test", password: PASSWORD,
    });
    const C = await seedLocalIdentity(setup, {
      companyName: "Initech", companySlug: "initech",
      email: "root@initech.test", password: PASSWORD,
    });

    /* One human who belongs to all three. */
    const multiId = await seedFreeHuman(setup, "multi@acme.test");
    const inA = await addMembership(setup, A.tenantId, multiId, "Member A");
    const inB = await addMembership(setup, B.tenantId, multiId, "Member B");
    const inC = await addMembership(setup, C.tenantId, multiId, "Member C");

    /* ══ THE HAPPY PATH: an authorized session moves from A to B ═════════════ */
    {
      const inTenantA = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-1");

      /* The switcher offers every workspace, including the current one. */
      const options = await readSwitchableWorkspaces(
        handle.db, env, inTenantA, { requestId: "sw-1o" }, NOW,
      );
      assert.equal(options.length, 3);
      assert.deepEqual(
        options.map((o) => o.membershipId).sort(),
        [inA.membershipId, inB.membershipId, inC.membershipId].sort(),
      );
      for (const option of options) {
        assert.deepEqual(
          Object.keys(option).sort(),
          ["membershipId", "roleName", "tenantId", "tenantName"],
          "no role id, no membership version, no governance provenance",
        );
      }

      /* The clock the session started with. */
      const before = await setup.query<{ authenticated_at: Date; absolute_expires_at: Date; id: string }>(
        `select id, authenticated_at, absolute_expires_at from user_session_contexts
          where user_id=$1 and revoked_at is null`, [multiId],
      );
      assert.equal(before.rows.length, 1);
      const originalAbsolute = before.rows[0]!.absolute_expires_at.getTime();
      const originalAuthenticated = before.rows[0]!.authenticated_at.getTime();
      const originalSessionId = before.rows[0]!.id;

      /* Some time passes inside the working session, then the human changes workspace. */
      const later = new Date(NOW.getTime() + 20 * 60 * 1000);
      const switched = await switchTenantForSession(
        handle.db, env, inTenantA, { membershipId: inB.membershipId, requestId: "sw-2" }, later,
      );
      assert.equal(switched.status, "switched");
      if (switched.status !== "switched") throw new Error("unreachable");
      assert.equal(switched.result.status, "authorized");
      if (switched.result.status !== "authorized") throw new Error("unreachable");

      assert.equal(switched.result.tenantContext.tenantId, B.tenantId, "the CHOSEN tenant");
      assert.equal(switched.result.tenantContext.roleId, inB.roleId, "and that tenant's own role");
      assert.equal(switched.result.tenantContext.userId, multiId, "the same human throughout");
      assert.equal(switched.result.tenantContext.membershipId, inB.membershipId);
      assert.equal(switched.result.applicationSession.membershipVersion, 1, "the live version");

      /* ══ SESSION ROTATION: a FRESH reference, and the old one is dead ══════ */
      assert.notEqual(switched.reference, inTenantA);
      const dead = await resolveSessionFromReference(
        handle.db, env, inTenantA, { requestId: "sw-2d" }, later,
      );
      assert.equal(
        dead.status, "unauthenticated",
        "the session that authorized the switch is revoked the instant the new one exists",
      );

      const live = await resolveSessionFromReference(
        handle.db, env, switched.reference, { requestId: "sw-2l" }, later,
      );
      assert.equal(live.status, "authorized");
      if (live.status !== "authorized") throw new Error("unreachable");
      assert.equal(live.tenantContext.tenantId, B.tenantId);

      /* ══ THE CLOCK IS CARRIED OVER, NEVER RESTARTED ════════════════════════ */
      const after = await setup.query<{
        id: string; active_tenant_id: string | null; authenticated_at: Date;
        absolute_expires_at: Date; inactivity_expires_at: Date;
        revoked_at: Date | null; revocation_reason: string | null;
      }>(
        `select id, active_tenant_id, authenticated_at, absolute_expires_at, inactivity_expires_at,
                revoked_at, revocation_reason
           from user_session_contexts where user_id=$1 order by created_at`, [multiId],
      );
      const fresh = after.rows.find((r) => r.revoked_at === null)!;
      assert.equal(fresh.active_tenant_id, B.tenantId);
      assert.equal(
        fresh.absolute_expires_at.getTime(), originalAbsolute,
        "a switch may NEVER extend how long one authentication is good for",
      );
      assert.equal(
        fresh.authenticated_at.getTime(), originalAuthenticated,
        "and it re-authenticates nothing",
      );
      assert.equal(
        fresh.inactivity_expires_at.getTime(),
        later.getTime() + SESSION_INACTIVITY_TTL_SECONDS * 1000,
        "only the inactivity window slides",
      );
      assert.ok(
        switched.maxAgeSeconds < SESSION_ABSOLUTE_TTL_SECONDS,
        "the cookie must not outlive the receipt it carries",
      );

      /* ══ THE OLD ROW WAS REVOKED, NOT REWRITTEN — provenance survives ══════ */
      const spent = after.rows.find((r) => r.id === originalSessionId)!;
      assert.equal(
        spent.active_tenant_id, A.tenantId,
        "the spent session still says which tenant it was issued for",
      );
      assert.equal(spent.revocation_reason, "tenant-switched");
      assert.ok(spent.revoked_at !== null);

      /* ══ ATTACK: replaying the old reference after a successful switch ═════ */
      const replay = await switchTenantForSession(
        handle.db, env, inTenantA, { membershipId: inC.membershipId, requestId: "sw-2r" }, later,
      );
      assert.equal(
        replay.status === "refused" && replay.reason, "no-active-session",
        "a spent session cannot mint a second tenant context",
      );

      /* ══ SAME-TARGET: refused, and no session is minted ════════════════════ */
      const sameCountBefore = after.rows.length;
      const same = await switchTenantForSession(
        handle.db, env, switched.reference, { membershipId: inB.membershipId, requestId: "sw-2s" }, later,
      );
      assert.equal(same.status === "refused" && same.reason, "already-active");
      const sameCountAfter = await setup.query<{ c: string }>(
        `select count(*)::text as c from user_session_contexts where user_id=$1`, [multiId],
      );
      assert.equal(
        Number(sameCountAfter.rows[0]!.c), sameCountBefore,
        "switching to the workspace you are already in must not spam new sessions",
      );
      const stillLive = await resolveSessionFromReference(
        handle.db, env, switched.reference, { requestId: "sw-2sl" }, later,
      );
      assert.equal(stillLive.status, "authorized", "and it must not cost the session either");
    }

    /* ══ ATTACK: a guessed membership id, and another human's real one ═══════ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-3");

      const guessed = await switchTenantForSession(
        handle.db, env, session,
        { membershipId: "00000000-0000-4000-8000-000000000000", requestId: "sw-3g" }, NOW,
      );
      assert.equal(guessed.status === "refused" && guessed.reason, "membership-unavailable");

      const foreign = await switchTenantForSession(
        handle.db, env, session, { membershipId: B.membershipId, requestId: "sw-3f" }, NOW,
      );
      assert.equal(
        foreign.status === "refused" && foreign.reason, "membership-unavailable",
        "a real, live membership belonging to somebody else is indistinguishable from a guess",
      );

      /* Neither attempt cost the session, and neither created anything. */
      const live = await resolveSessionFromReference(handle.db, env, session, { requestId: "sw-3l" }, NOW);
      assert.equal(live.status, "authorized");
      if (live.status !== "authorized") throw new Error("unreachable");
      assert.equal(live.tenantContext.tenantId, A.tenantId, "still exactly where it was");
    }

    /* ══ ATTACK: revoked / suspended / soft-deleted target membership ════════ */
    for (const [label, mutation, restore] of [
      [
        "revoked",
        `update memberships set status='revoked', revoked_at=now(), revocation_reason='removed' where id=$1`,
        `update memberships set status='active', revoked_at=null, revocation_reason=null where id=$1`,
      ],
      [
        "suspended",
        `update memberships set status='suspended' where id=$1`,
        `update memberships set status='active' where id=$1`,
      ],
      [
        "soft-deleted",
        `update memberships set lifecycle_status='deleted' where id=$1`,
        `update memberships set lifecycle_status='active' where id=$1`,
      ],
    ] as const) {
      const session = await signInAndSelect(
        handle.db, env, "multi@acme.test", inA.membershipId, `sw-4-${label}`,
      );
      await setup.query(mutation, [inB.membershipId]);

      /* It is not offered... */
      const options = await readSwitchableWorkspaces(
        handle.db, env, session, { requestId: `sw-4o-${label}` }, NOW,
      );
      assert.ok(
        !options.some((o) => o.membershipId === inB.membershipId),
        `a ${label} membership must not be offered`,
      );
      /* ...and naming it anyway is refused with the one reason. */
      const refused = await switchTenantForSession(
        handle.db, env, session, { membershipId: inB.membershipId, requestId: `sw-4-${label}-x` }, NOW,
      );
      assert.equal(
        refused.status === "refused" && refused.reason, "membership-unavailable",
        `a ${label} membership must be refused`,
      );
      await setup.query(restore, [inB.membershipId]);
    }

    /* ══ ATTACK: suspended / deleted / auth-disabled target TENANT ═══════════ */
    for (const [label, mutation, restore] of [
      [
        "suspended",
        `update companies set tenant_status='suspended' where id=$1`,
        `update companies set tenant_status='active' where id=$1`,
      ],
      [
        "deleted",
        `update companies set tenant_status='deleted' where id=$1`,
        `update companies set tenant_status='active' where id=$1`,
      ],
      [
        "archived",
        `update companies set lifecycle_status='archived' where id=$1`,
        `update companies set lifecycle_status='active' where id=$1`,
      ],
      [
        "authentication-disabled",
        `update companies set authentication_disabled_at=now() where id=$1`,
        `update companies set authentication_disabled_at=null where id=$1`,
      ],
    ] as const) {
      const session = await signInAndSelect(
        handle.db, env, "multi@acme.test", inA.membershipId, `sw-5-${label}`,
      );
      await setup.query(mutation, [B.tenantId]);

      const options = await readSwitchableWorkspaces(
        handle.db, env, session, { requestId: `sw-5o-${label}` }, NOW,
      );
      assert.ok(
        !options.some((o) => o.tenantId === B.tenantId),
        `a ${label} tenant must not be offered`,
      );
      const refused = await switchTenantForSession(
        handle.db, env, session, { membershipId: inB.membershipId, requestId: `sw-5-${label}-x` }, NOW,
      );
      assert.equal(
        refused.status === "refused" && refused.reason, "membership-unavailable",
        `a ${label} tenant must be refused`,
      );
      await setup.query(restore, [B.tenantId]);
    }

    /* ══ ATTACK: the TARGET membership's version moved while the card was open ═ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-6");
      await setup.query(`update memberships set version = version + 1 where id=$1`, [inB.membershipId]);

      const switched = await switchTenantForSession(
        handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-6s" }, NOW,
      );
      assert.equal(switched.status, "switched", "the switch succeeds — with the version read NOW");
      if (switched.status !== "switched") throw new Error("unreachable");
      if (switched.result.status !== "authorized") throw new Error("unreachable");
      assert.equal(
        switched.result.applicationSession.membershipVersion, 2,
        "the session carries the CURRENT version, never one remembered from the switcher",
      );
      const live = await resolveSessionFromReference(
        handle.db, env, switched.reference, { requestId: "sw-6r" }, NOW,
      );
      assert.equal(live.status, "authorized", "so the resolver's version check passes immediately");
    }

    /* ══ ATTACK: the CURRENT session is stale — it may not mint a new one ════ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-7");
      /* The membership this session is bound to moves version underneath it. */
      await setup.query(`update memberships set version = version + 1 where id=$1`, [inA.membershipId]);

      const resolved = await resolveSessionFromReference(handle.db, env, session, { requestId: "sw-7r" }, NOW);
      assert.equal(resolved.status, "forbidden", "the resolver already refuses this session");

      const refused = await switchTenantForSession(
        handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-7s" }, NOW,
      );
      assert.equal(
        refused.status === "refused" && refused.reason, "no-active-session",
        "a session the product refuses cannot launder itself into a fresh one",
      );
      const options = await readSwitchableWorkspaces(handle.db, env, session, { requestId: "sw-7o" }, NOW);
      assert.equal(options.length, 0, "and it is offered nothing");
    }

    /* ══ ATTACK: a REVOKED current session ══════════════════════════════════ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-8");
      await setup.query(
        `update user_session_contexts set revoked_at=now(), revocation_reason='logout'
          where user_id=$1 and revoked_at is null`, [multiId],
      );
      const refused = await switchTenantForSession(
        handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-8s" }, NOW,
      );
      assert.equal(refused.status === "refused" && refused.reason, "no-active-session");
    }

    /* ══ ATTACK: an EXPIRED current session ═════════════════════════════════ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-9");
      const wayLater = new Date(NOW.getTime() + (SESSION_ABSOLUTE_TTL_SECONDS + 60) * 1000);
      const refused = await switchTenantForSession(
        handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-9s" }, wayLater,
      );
      assert.equal(refused.status === "refused" && refused.reason, "no-active-session");
    }

    /* ══ ATTACK: a PRE-TENANT receipt handed to the switching entry point ════ */
    {
      const issued = await issueLocalSession(
        handle.db, env, { email: "multi@acme.test", password: PASSWORD, requestId: "sw-10" }, NOW,
      );
      assert.equal(issued.result.status, "tenant-selection-required");
      const refused = await switchTenantForSession(
        handle.db, env, issued.reference, { membershipId: inB.membershipId, requestId: "sw-10s" }, NOW,
      );
      assert.equal(
        refused.status === "refused" && refused.reason, "no-active-session",
        "the sign-in picker's receipt belongs to the picker; switching refuses it as the mirror " +
        "image of the picker refusing a tenant-bound one",
      );
      const options = await readSwitchableWorkspaces(handle.db, env, issued.reference, { requestId: "sw-10o" }, NOW);
      assert.equal(options.length, 0, "and it offers no switcher");

      /* The receipt is untouched and still usable for its own job. */
      const selected = await selectTenantForSession(
        handle.db, env, issued.reference, { membershipId: inA.membershipId, requestId: "sw-10x" }, NOW,
      );
      assert.equal(selected.status, "selected", "a refused switch must not spend the picker's receipt");
    }

    /* ══ ATTACK: two CONCURRENT switches, A→B and A→C ════════════════════════ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-11");
      const before = await setup.query<{ c: string }>(
        `select count(*)::text as c from user_session_contexts where user_id=$1`, [multiId],
      );

      const attempts = await Promise.all([
        switchTenantForSession(
          handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-11b" }, NOW,
        ),
        switchTenantForSession(
          handle.db, env, session, { membershipId: inC.membershipId, requestId: "sw-11c" }, NOW,
        ),
      ]);

      const winners = attempts.filter((a) => a.status === "switched");
      const losers = attempts.filter((a) => a.status === "refused");
      assert.equal(winners.length, 1, "EXACTLY one concurrent switch may win");
      assert.equal(losers.length, 1);
      /*
       * TWO HONEST LOSING REASONS, and which one appears depends on interleaving:
       *
       *   `no-active-session`   the loser reached the resolver AFTER the winner committed, so the
       *                         session was already revoked and it never got as far as the write.
       *   `switch-superseded`   the loser resolved while the session was still live and then lost
       *                         the conditional revoke, so its transaction unwound.
       *
       * Both mean the same thing to a caller — nothing was changed — and neither may be a reason
       * that talks about the membership, which would be a lie about where the refusal came from.
       * The single-spend primitive itself is proven deterministically below.
       */
      assert.ok(
        losers[0]!.status === "refused" &&
          ["no-active-session", "switch-superseded"].includes(losers[0]!.reason),
        `the loser must be refused for a session reason, got ${
          losers[0]!.status === "refused" ? losers[0]!.reason : losers[0]!.status
        }`,
      );

      const after = await setup.query<{ c: string }>(
        `select count(*)::text as c from user_session_contexts where user_id=$1`, [multiId],
      );
      assert.equal(
        Number(after.rows[0]!.c), Number(before.rows[0]!.c) + 1,
        "exactly ONE new row — the loser's insert unwound with its transaction",
      );

      /*
       * The session both attempts started from is dead, and the winner holds a live one. Scoped to
       * this transition on purpose: earlier blocks in this file deliberately leave stale sessions
       * behind (forbidden, expired, unused), so a global live-count would measure those instead.
       */
      const spentSource = await resolveSessionFromReference(
        handle.db, env, session, { requestId: "sw-11p" }, NOW,
      );
      assert.equal(spentSource.status, "unauthenticated", "the source session is spent either way");

      const winner = winners[0]!;
      if (winner.status !== "switched") throw new Error("unreachable");
      const resolved = await resolveSessionFromReference(
        handle.db, env, winner.reference, { requestId: "sw-11r" }, NOW,
      );
      assert.equal(resolved.status, "authorized");
      if (resolved.status !== "authorized") throw new Error("unreachable");
      assert.ok(
        [B.tenantId, C.tenantId].includes(resolved.tenantContext.tenantId),
        "and it points at a tenant this human really belongs to",
      );
    }

    /*
     * ══ THE SINGLE-SPEND PRIMITIVE, PROVEN DETERMINISTICALLY ═════════════════
     *
     * The concurrency case above cannot pin which refusal a loser gets, because that depends on
     * interleaving. What it must never depend on is whether a session can be spent twice — so the
     * conditional revoke is asserted directly here, with no race involved.
     */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-11d");
      const resolvedNew = await resolveSessionFromReference(
        handle.db, env, session, { requestId: "sw-11di" }, NOW,
      );
      assert.equal(resolvedNew.status, "authorized");
      if (resolvedNew.status !== "authorized") throw new Error("unreachable");
      const sessionContextId = resolvedNew.applicationSession.sessionContextId;

      assert.equal(
        await revokeSessionIfActive(handle.db, sessionContextId, NOW, "tenant-switched"), true,
        "the first spend wins",
      );
      assert.equal(
        await revokeSessionIfActive(handle.db, sessionContextId, NOW, "tenant-switched"), false,
        "and a session can never be spent twice — this is what makes one winner one winner",
      );
      /* The reason recorded is the FIRST spender's, not the second's. */
      const spent = await setup.query<{ revocation_reason: string }>(
        `select revocation_reason from user_session_contexts where id=$1`, [sessionContextId],
      );
      assert.equal(spent.rows[0]!.revocation_reason, "tenant-switched");
      const dead = await resolveSessionFromReference(handle.db, env, session, { requestId: "sw-11dr" }, NOW);
      assert.equal(dead.status, "unauthenticated");
    }

    /* ══ ATTACK: two SIMULTANEOUS switches to the SAME target ════════════════ */
    {
      const session = await signInAndSelect(handle.db, env, "multi@acme.test", inA.membershipId, "sw-12");
      const before = await setup.query<{ c: string }>(
        `select count(*)::text as c from user_session_contexts where user_id=$1`, [multiId],
      );
      const attempts = await Promise.all([
        switchTenantForSession(
          handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-12a" }, NOW,
        ),
        switchTenantForSession(
          handle.db, env, session, { membershipId: inB.membershipId, requestId: "sw-12b" }, NOW,
        ),
      ]);
      assert.equal(
        attempts.filter((a) => a.status === "switched").length, 1,
        "the same target twice is still one transition, not two sessions",
      );
      const after = await setup.query<{ c: string }>(
        `select count(*)::text as c from user_session_contexts where user_id=$1`, [multiId],
      );
      assert.equal(
        Number(after.rows[0]!.c), Number(before.rows[0]!.c) + 1,
        "exactly ONE new row, even when both attempts want the same workspace",
      );
    }

    /*
     * ══ ROLE / TENANT MISMATCH ═══════════════════════════════════════════════
     *
     * `memberships.role_id` references `roles.id` alone — no constraint ties the role's tenant to
     * the membership's. So a membership in tenant C carrying tenant B's role is REPRESENTABLE, and
     * every session path reads the role straight off the membership row.
     *
     * This phase does not silently change that: it belongs to Membership authority (who WRITES such
     * a row), and tightening the shared reader would retroactively change I1/I1.1 and the sign-in
     * picker. What is asserted here is the property this phase owns — switching is EXACTLY as strict
     * as an ordinary sign-in, never weaker. The mismatch is reported as a limitation.
     */
    {
      await setup.query(`update memberships set role_id=$1 where id=$2`, [inB.roleId, inC.membershipId]);

      const viaSignIn = await signInAndSelect(handle.db, env, "multi@acme.test", inC.membershipId, "sw-13");
      const signInContext = await resolveSessionFromReference(
        handle.db, env, viaSignIn, { requestId: "sw-13r" }, NOW,
      );
      assert.equal(signInContext.status, "authorized");
      if (signInContext.status !== "authorized") throw new Error("unreachable");

      const viaSwitch = await switchTenantForSession(
        handle.db, env, viaSignIn, { membershipId: inA.membershipId, requestId: "sw-13a" }, NOW,
      );
      assert.equal(viaSwitch.status, "switched");
      if (viaSwitch.status !== "switched") throw new Error("unreachable");
      const back = await switchTenantForSession(
        handle.db, env, viaSwitch.reference, { membershipId: inC.membershipId, requestId: "sw-13b" }, NOW,
      );
      assert.equal(back.status, "switched");
      if (back.status !== "switched") throw new Error("unreachable");
      if (back.result.status !== "authorized") throw new Error("unreachable");

      assert.equal(
        back.result.tenantContext.roleId, signInContext.tenantContext.roleId,
        "switching reads the role exactly as an ordinary sign-in does — no weaker, no different",
      );
      assert.equal(back.result.tenantContext.tenantId, C.tenantId);

      await setup.query(`update memberships set role_id=$1 where id=$2`, [inC.roleId, inC.membershipId]);
    }

    /* ══ ABSOLUTE NON-EFFECTS: switching created and changed NOTHING ═════════ */
    {
      const counts = await setup.query<Record<string, string>>(`
        select (select count(*) from memberships)               as memberships,
               (select count(*) from roles)                     as roles,
               (select count(*) from users)                     as users,
               (select count(*) from auth_identities)           as identities,
               (select count(*) from auth_credentials)          as credentials,
               (select count(*) from invitations)               as invitations,
               (select count(*) from membership_authorizations) as authorizations,
               (select count(*) from identity_enrollment_requests) as enrollments,
               (select count(*) from decision_records)          as decisions,
               (select count(*) from governance_sessions)       as governance,
               (select count(*) from knowledge_nodes)           as knowledge,
               (select count(*) from executions)                as executions,
               (select count(*) from provider_connectivity_controls) as providers,
               (select count(*) from audit_log)                 as audit
      `);
      const c = counts.rows[0]!;
      assert.equal(Number(c.memberships), 6, "3 seeded owners + the multi human's 3");
      assert.equal(Number(c.roles), 6, "3 seeded owner roles + the 3 member roles this test created");
      assert.equal(Number(c.users), 4);
      assert.equal(Number(c.identities), 4);
      assert.equal(Number(c.credentials), 4);
      assert.equal(Number(c.invitations), 0);
      assert.equal(Number(c.authorizations), 0);
      assert.equal(Number(c.enrollments), 0);
      assert.equal(Number(c.decisions), 0, "switching makes no Governance decision");
      assert.equal(Number(c.governance), 0);
      assert.equal(Number(c.knowledge), 0);
      assert.equal(Number(c.executions), 0);
      assert.equal(Number(c.providers), 0);
      assert.equal(
        Number(c.audit), 0,
        "Session authority writes no audit today, and switching invented none",
      );

      /* Every membership is still exactly what it was: active, version untouched by any switch. */
      const memberships = await setup.query<{ status: string; lifecycle_status: string; revoked_at: Date | null }>(
        `select status, lifecycle_status, revoked_at from memberships where user_id=$1`, [multiId],
      );
      assert.equal(memberships.rows.length, 3);
      for (const row of memberships.rows) {
        assert.equal(row.status, "active");
        assert.equal(row.lifecycle_status, "active");
        assert.equal(row.revoked_at, null);
      }

      /* No session row was ever re-pointed: every tenant a session claims is one it was issued for. */
      const sessions = await setup.query<{ active_tenant_id: string | null; revocation_reason: string | null }>(
        `select active_tenant_id, revocation_reason from user_session_contexts where user_id=$1`,
        [multiId],
      );
      for (const row of sessions.rows) {
        assert.ok(
          row.active_tenant_id === null ||
            [A.tenantId, B.tenantId, C.tenantId].includes(row.active_tenant_id),
          "a session may only ever name a tenant this human belongs to",
        );
      }
      assert.ok(
        sessions.rows.some((r) => r.revocation_reason === "tenant-switched"),
        "and the switch is legible in the session's own history",
      );
    }

    console.log("PASS post-login tenant switching (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
