/*
 * G2.1 — the two-key genesis ceremony, proved against a REAL PostgreSQL database.
 *
 * THE CLAIM UNDER TEST. A tenant's pre-Governance root is established by two independent acts, and
 * neither one alone establishes anything:
 *
 *   KEY 1  a local operator ceremony writes a PENDING nomination;
 *   KEY 2  the NOMINATED human accepts it under a verified session.
 *
 * The proofs that only a real database can give:
 *   - the composite membership foreign key makes a cross-tenant nomination impossible, not merely
 *     unwise;
 *   - the partial unique index refuses a second root per tenant;
 *   - acceptance is one-time by predicate, so a replay changes nothing;
 *   - the acceptance and its audit row commit together;
 *   - a revoked nomination can never be accepted;
 *   - no Governance decision row and no Knowledge mutation appear anywhere as a side effect.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST on purpose: the schema barrel is the only safe entry point for
// `src/db/schema/*` (a pre-existing _base → company → organization cycle).
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  findExistingNomination,
  nominateGenesisHuman,
  resolveNominationTarget,
} from "../../scripts/lib/nominate-genesis-human";
import {
  acceptGenesisNomination,
  readGenesisNomination,
} from "../../src/features/governance-genesis/genesis-acceptance.server";
import { readGenesisNominationHistory } from "../../src/features/governance-audit/genesis-nomination-audit.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-11T16:00:00.000Z");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

/**
 * A TenantContext exactly as the R1 session resolver would produce it. Tests may CONSTRUCT one
 * because they stand in for a real signed-in session; the product cannot, because the only
 * production construction is `resolveTenantContext()` reading the durable session row.
 */
function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return {
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
    requestId: "g2-1-request",
    authenticatedAt: NOW.toISOString(),
  };
}

/** Add a SECOND active member to an existing tenant. The seed helper makes one tenant per person. */
async function addMember(
  client: Client,
  tenantId: string,
  email: string,
  roleType = "member",
): Promise<Seeded> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1, $1) returning id`,
    [email],
  );
  const userId = user.rows[0]!.id;
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [userId, `local:${email}`],
  );
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, $2, $3) returning id`,
    [tenantId, `Role ${email}`, roleType],
  );
  const roleId = role.rows[0]!.id;
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active') returning id`,
    [tenantId, userId, roleId],
  );
  return {
    tenantId,
    userId,
    authIdentityId: identity.rows[0]!.id,
    membershipId: membership.rows[0]!.id,
    roleId,
  };
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g21_genesis");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW };

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed: tenant A (alice + dave), tenant B (bob), tenant C (carol) ────── */
    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const dave = await addMember(setup, alice.tenantId, "dave@acme.test");
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
      password: "bob-correct-password-4Lm",
    });
    const carol = await seedLocalIdentity(setup, {
      companyName: "Initech",
      companySlug: "initech",
      email: "carol@initech.test",
    });

    const aliceSession = await sessionRowFor(setup, alice, "aaaa");
    const daveSession = await sessionRowFor(setup, dave, "dddd");
    const bobSession = await sessionRowFor(setup, bob, "bbbb");

    const aliceCtx = contextFor(alice, aliceSession);
    const daveCtx = contextFor(dave, daveSession);
    const bobCtx = contextFor(bob, bobSession);

    /* ── T1: before any ceremony, there is no nomination ────────────────────── */
    {
      const lookup = await readGenesisNomination(aliceCtx, deps);
      assert.equal(lookup.status, "read");
      assert.equal(lookup.status === "read" ? lookup.nomination : "x", null);

      const refused = await acceptGenesisNomination(aliceCtx, deps);
      assert.deepEqual(refused, { status: "refused", reason: "no-nomination" });
    }

    /* ── T2: the composite membership FK refuses a cross-tenant nomination ──── */
    {
      // bob's user, alice's tenant. No membership joins them, so the DATABASE refuses —
      // this is not an application check that could later be removed.
      await assert.rejects(
        () =>
          setup.query(
            `insert into genesis_nominations
               (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source)
             values ($1, $2, $3, 'pending', 'local-operator-ceremony')`,
            [alice.tenantId, bob.authIdentityId, bob.userId],
          ),
        /genesis_nominations_tenant_member_fk|foreign key/i,
        "a human with no membership in the tenant must be unnominatable at the database level",
      );
    }

    /* ── T3: the operator ceremony resolves its target and writes PENDING ───── */
    {
      const target = await resolveNominationTarget(setup, "acme", "alice@acme.test");
      assert.ok(target, "the operator ceremony resolves an active member of an active tenant");
      assert.equal(target!.tenantId, alice.tenantId);
      assert.equal(target!.authIdentityId, alice.authIdentityId);

      // A human who is not a member of that tenant does not resolve at all.
      assert.equal(
        await resolveNominationTarget(setup, "acme", "bob@globex.test"),
        undefined,
      );
      // Nor does a tenant that does not exist.
      assert.equal(
        await resolveNominationTarget(setup, "nope", "alice@acme.test"),
        undefined,
      );

      const outcome = await nominateGenesisHuman(setup, target!);
      assert.equal(outcome.status, "nominated");

      const row = await setup.query(
        `select status, nomination_source, accepted_at, accepted_session_context_id,
                accepted_assurance_level
           from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.equal(row.rows.length, 1);
      assert.equal(row.rows[0]!.status, "pending");
      assert.equal(row.rows[0]!.nomination_source, "local-operator-ceremony");
      assert.equal(row.rows[0]!.accepted_at, null, "KEY 1 must not accept anything");
      assert.equal(row.rows[0]!.accepted_session_context_id, null);
      assert.equal(row.rows[0]!.accepted_assurance_level, null);
    }

    /* ── T4: a second nomination for the same tenant is refused ─────────────── */
    {
      const target = await resolveNominationTarget(setup, "acme", "dave@acme.test");
      assert.ok(target);
      const outcome = await nominateGenesisHuman(setup, target!);
      assert.equal(
        outcome.status,
        "already-nominated",
        "a tenant has exactly one pre-Governance root",
      );

      // And the raw INSERT is refused by the partial unique index, not only by the read above.
      await assert.rejects(
        () =>
          setup.query(
            `insert into genesis_nominations
               (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source)
             values ($1, $2, $3, 'pending', 'local-operator-ceremony')`,
            [dave.tenantId, dave.authIdentityId, dave.userId],
          ),
        /genesis_nominations_one_active_per_tenant_uq|duplicate key/i,
        "the database, not the application, enforces one active root per tenant",
      );
    }

    /* ── T5: ATTACKS on acceptance ──────────────────────────────────────────── */
    {
      // 1. unauthenticated
      assert.deepEqual(await acceptGenesisNomination(null, deps), {
        status: "refused",
        reason: "unauthenticated",
      });

      // 2. an ordinary member of the SAME tenant who is not the nominated human
      assert.deepEqual(await acceptGenesisNomination(daveCtx, deps), {
        status: "refused",
        reason: "not-the-nominated-human",
      });

      // 3. the owner of ANOTHER tenant, using their own honest context
      assert.deepEqual(await acceptGenesisNomination(bobCtx, deps), {
        status: "refused",
        reason: "no-nomination",
      });

      // 4. FORGED tenantId: bob claims Acme's tenant while holding his own identity.
      assert.deepEqual(
        await acceptGenesisNomination({ ...bobCtx, tenantId: alice.tenantId }, deps),
        { status: "refused", reason: "not-the-nominated-human" },
      );

      // 5. FORGED userId: bob claims alice's user id but keeps his own identity.
      assert.deepEqual(
        await acceptGenesisNomination(
          { ...bobCtx, tenantId: alice.tenantId, userId: alice.userId },
          deps,
        ),
        { status: "refused", reason: "not-the-nominated-human" },
      );

      // 6. FORGED authIdentityId: bob claims alice's identity but keeps his own user id.
      assert.deepEqual(
        await acceptGenesisNomination(
          { ...bobCtx, tenantId: alice.tenantId, authIdentityId: alice.authIdentityId },
          deps,
        ),
        { status: "refused", reason: "not-the-nominated-human" },
      );

      // 7. FORGED role band: dave claims the owner role. The band is irrelevant to genesis —
      //    it is neither checked nor sufficient, which is exactly the Director's ruling.
      assert.deepEqual(
        await acceptGenesisNomination({ ...daveCtx, roleId: alice.roleId }, deps),
        { status: "refused", reason: "not-the-nominated-human" },
      );

      // Nothing above changed the row.
      const row = await setup.query(
        `select status from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.equal(row.rows[0]!.status, "pending", "no refused attempt may advance the ceremony");

      // And no refusal was written to the ledger — the boundary G1 drew, repeated.
      const history = await readGenesisNominationHistory({ tenantId: alice.tenantId }, deps);
      assert.equal(history.status, "read");
      assert.deepEqual(history.status === "read" ? history.records : "x", []);
    }

    /* ── T6: the nominated human accepts — KEY 2 ────────────────────────────── */
    {
      const view = await readGenesisNomination(aliceCtx, deps);
      assert.equal(view.status, "read");
      assert.equal(view.status === "read" ? view.nomination?.viewerIsNominatedHuman : false, true);
      // The other member is told nothing about WHO was nominated, only that it is not them.
      const daveView = await readGenesisNomination(daveCtx, deps);
      assert.equal(
        daveView.status === "read" ? daveView.nomination?.viewerIsNominatedHuman : true,
        false,
      );

      const accepted = await acceptGenesisNomination(aliceCtx, deps);
      assert.equal(accepted.status, "accepted");

      const row = await setup.query(
        `select status, accepted_at, accepted_session_context_id, accepted_assurance_level,
                updated_by, updated_by_type
           from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.equal(row.rows[0]!.status, "accepted");
      assert.ok(row.rows[0]!.accepted_at, "acceptance records when");
      assert.equal(row.rows[0]!.accepted_session_context_id, aliceSession);
      assert.equal(
        row.rows[0]!.accepted_assurance_level,
        "aal1",
        "the assurance level is recorded honestly, never upgraded",
      );
      assert.equal(row.rows[0]!.updated_by, alice.userId);
      assert.equal(row.rows[0]!.updated_by_type, "human");
    }

    /* ── T7: acceptance is ONE-TIME — a replay changes nothing ──────────────── */
    {
      const before = await setup.query(
        `select accepted_at from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.deepEqual(await acceptGenesisNomination(aliceCtx, deps), {
        status: "refused",
        reason: "already-accepted",
      });
      const after = await setup.query(
        `select accepted_at from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.deepEqual(
        after.rows[0]!.accepted_at,
        before.rows[0]!.accepted_at,
        "a replay must not move the acceptance instant",
      );
    }

    /* ── T8: exactly ONE audit event, and it is truthful ────────────────────── */
    {
      const history = await readGenesisNominationHistory({ tenantId: alice.tenantId }, deps);
      assert.equal(history.status, "read");
      const records = history.status === "read" ? history.records : [];
      assert.equal(records.length, 1, "one acceptance, one event — the replay added nothing");
      assert.equal(records[0]!.action, "governance.genesis-nomination.accepted");
      assert.equal(records[0]!.actorType, "human");
      assert.equal(records[0]!.actorId, alice.userId);

      const raw = await setup.query(
        `select entity_type, result, authority_source, source, session_context_id, metadata
           from audit_log where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.equal(raw.rows.length, 1);
      assert.equal(raw.rows[0]!.entity_type, "genesis_nomination");
      assert.equal(raw.rows[0]!.result, "committed");
      assert.equal(raw.rows[0]!.authority_source, "membership");
      assert.equal(raw.rows[0]!.source, "governance-genesis");
      assert.equal(raw.rows[0]!.session_context_id, aliceSession);

      // Identity references only. No email, no name, no credential material, no bearer reference.
      const metadata = JSON.stringify(raw.rows[0]!.metadata);
      assert.ok(metadata.includes(alice.userId));
      assert.ok(metadata.includes(alice.authIdentityId));
      assert.match(metadata, /"assuranceLevel":"aal1"/);
      assert.match(metadata, /"mfaVerified":false/);
      for (const forbidden of ["alice@acme.test", "password", "secret", "salt", "hash"]) {
        assert.ok(
          !metadata.toLowerCase().includes(forbidden),
          `audit metadata must not carry ${forbidden}`,
        );
      }

      // The OPERATOR ceremony is deliberately absent from the ledger — audit_log requires a
      // non-null actor and deployment possession cannot name one truthfully. The nomination row
      // itself is that act's durable record.
      const created = await setup.query(
        `select count(*)::int n from audit_log where action like '%nomination.created%'`,
      );
      assert.equal(created.rows[0]!.n, 0);
    }

    /* ── T9: a REVOKED nomination can never be accepted ─────────────────────── */
    {
      // No G2.1 code path writes `revoked`, so this state is seeded directly to prove the
      // acceptance path fails closed against it.
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            revoked_at, revocation_reason)
         values ($1, $2, $3, 'revoked', 'local-operator-ceremony', now(), 'seeded for test')`,
        [carol.tenantId, carol.authIdentityId, carol.userId],
      );
      const carolSession = await sessionRowFor(setup, carol, "cccc");
      const carolCtx = contextFor(carol, carolSession);

      assert.deepEqual(await acceptGenesisNomination(carolCtx, deps), {
        status: "refused",
        reason: "revoked",
      });

      // A revoked nomination FREES the tenant's genesis slot — the partial unique index excludes it.
      const target = await resolveNominationTarget(setup, "initech", "carol@initech.test");
      assert.ok(target);
      const outcome = await nominateGenesisHuman(setup, target!);
      assert.equal(outcome.status, "nominated");
    }

    /* ── T10: tenant isolation ──────────────────────────────────────────────── */
    {
      const bobView = await readGenesisNomination(bobCtx, deps);
      assert.equal(bobView.status, "read");
      assert.equal(
        bobView.status === "read" ? bobView.nomination : "x",
        null,
        "another tenant's genesis nomination must be invisible",
      );
      const bobHistory = await readGenesisNominationHistory({ tenantId: bob.tenantId }, deps);
      assert.deepEqual(bobHistory.status === "read" ? bobHistory.records : "x", []);
      assert.equal(await findExistingNomination(setup, bob.tenantId), undefined);
    }

    /* ── T11: NOTHING else moved — G2 and K4 firewalls hold at runtime ──────── */
    {
      const governance = await setup.query(
        `select (select count(*)::int from governance_sessions) sessions,
                (select count(*)::int from decision_records) decisions,
                (select count(*)::int from decision_records where bootstrap) bootstraps`,
      );
      assert.deepEqual(
        governance.rows[0],
        { sessions: 0, decisions: 0, bootstraps: 0 },
        "G2.1 must create no Governance session and no decision — that is G2's job",
      );

      const knowledge = await setup.query(
        `select (select count(*)::int from knowledge_facts) facts,
                (select count(*)::int from knowledge_nodes) nodes,
                (select count(*)::int from knowledge_nodes where ratified_at is not null) ratified`,
      );
      assert.deepEqual(
        knowledge.rows[0],
        { facts: 0, nodes: 0, ratified: 0 },
        "G2.1 must not touch Knowledge — K4 stays blocked behind G2",
      );

      // No role, permission, or provider control was created as a side effect.
      const authority = await setup.query(
        `select (select count(*)::int from permissions) permissions,
                (select count(*)::int from role_permissions) role_permissions,
                (select count(*)::int from provider_connectivity_controls) providers`,
      );
      assert.deepEqual(authority.rows[0], {
        permissions: 0,
        role_permissions: 0,
        providers: 0,
      });
    }

    console.log("PASS g2-1 genesis ceremony (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
