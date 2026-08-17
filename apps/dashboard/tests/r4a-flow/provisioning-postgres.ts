/*
 * R4A — the tenant bootstrap ceremony, proved against a REAL PostgreSQL database.
 *
 * THE CLAIM UNDER TEST. A tenant can be born through one atomic ceremony that writes exactly three
 * tables, fabricates no provenance, records no audit event, and hands off to the existing Genesis
 * chain with no special-casing whatsoever.
 *
 * The proofs that only a real database can give:
 *   - the three rows commit together, and `provisioning` is never observable;
 *   - a failure at ANY step leaves zero rows of all three kinds — no orphan role, no orphan
 *     membership, no stranded tenant;
 *   - `companies_slug_uq` decides a concurrent race and the loser's whole transaction disappears;
 *   - the CHECK constraint actually rejects a foreign provisioning source;
 *   - **the cycle is really broken**: `resolveNominationTarget`'s ten-predicate join resolves the new
 *     tenant, acceptance works, G2 establishes bootstrap, and `provision-member-role` — which
 *     refused with `no-governance-authority` before — now succeeds and its `member` role coexists
 *     with the bootstrap `owner` role;
 *   - the ordinary invitation path still works afterwards, so bootstrap did not become a bypass.
 *
 * FIXTURES ARE STATE-RELATIVE. No calendar literal decides an outcome and no global migration count
 * is pinned: counts are measured before the ceremony and compared after it, so this file keeps
 * proving the same thing when a later phase adds a table or a migration.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST on purpose: the schema barrel is the only safe entry point for
// `src/db/schema/*` (a pre-existing _base → company → organization cycle).
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  BOOTSTRAP_ROLE_NAME,
  BOOTSTRAP_ROLE_TYPE,
  TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR,
  provisionTenant,
  resolveExistingHuman,
  validateProvisionInput,
} from "../../scripts/lib/provision-tenant";
import { resolveNominationTarget, nominateGenesisHuman } from "../../scripts/lib/nominate-genesis-human";
import { acceptGenesisNomination } from "../../src/features/governance-genesis/genesis-acceptance.server";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/**
 * A clock for the modules that take one. It is NOT an expiry decision anywhere in this file — the
 * ceremony reads no clock at all, and Genesis adjudicates on the database's `now()`. Pinning a
 * literal that some later authority compared against its own clock is the R3A time-bomb.
 */
const NOW = new Date();

interface Human {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly email: string;
}

/** A bare human: `users` + `auth_identities`, no tenant, no membership. R4A's precondition. */
async function seedHuman(client: Client, email: string): Promise<Human> {
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
  return { userId, authIdentityId: identity.rows[0]!.id, email };
}

async function sessionRowFor(
  client: Client,
  human: Human,
  tenantId: string,
  membershipId: string,
  tag: string,
): Promise<string> {
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
      human.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      human.userId,
      tenantId,
      membershipId,
    ],
  );
  return row.rows[0]!.id;
}

function contextFor(
  human: Human,
  tenantId: string,
  membershipId: string,
  roleId: string,
  sessionContextId: string,
): TenantContext {
  return {
    tenantId,
    userId: human.userId,
    authIdentityId: human.authIdentityId,
    membershipId,
    membershipVersion: 1,
    roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "r4a-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function count(client: Client, table: string, where = "true", params: unknown[] = []) {
  const r = await client.query<{ n: string }>(
    `select count(*)::text n from ${table} where ${where}`,
    params,
  );
  return Number(r.rows[0]!.n);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r4a_bootstrap");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW };

  try {
    harness.migrateDatabase();
    await db.connect();

    /* ── The schema delta is real, and the CHECK enforces ─────────────────── */
    {
      const col = await db.query<{ t: string; len: number; nullable: string }>(
        `select data_type t, character_maximum_length len, is_nullable nullable
           from information_schema.columns
          where table_name = 'companies' and column_name = 'provisioning_source'`,
      );
      assert.equal(col.rows.length, 1, "companies.provisioning_source exists");
      assert.equal(col.rows[0]!.t, "character varying");
      assert.equal(col.rows[0]!.len, 64);
      assert.equal(col.rows[0]!.nullable, "YES", "nullable, so seeded rows need no invented history");

      await assert.rejects(
        db.query(
          `insert into companies (name, slug, provisioning_source) values ('X','x','platform-admin')`,
        ),
        /companies_provisioning_source_chk/,
        "a foreign provisioning source is refused by the database, not by application code",
      );
      /* A NULL source is legal — that is what a fixture-seeded row truthfully carries. */
      await db.query(`insert into companies (name, slug) values ('Fixture','fixture-null')`);
      assert.equal(await count(db, "companies", "slug = 'fixture-null'"), 1);
      await db.query(`delete from companies where slug = 'fixture-null'`);
    }

    /* ── Input validation is pure and refuses before any read ─────────────── */
    {
      const bad = [
        { slug: "", displayName: "A", identityEmail: "a@b.test" },
        { slug: "Acme Corp", displayName: "A", identityEmail: "a@b.test" },
        { slug: "acme--corp", displayName: "A", identityEmail: "a@b.test" },
        { slug: "-acme", displayName: "A", identityEmail: "a@b.test" },
        { slug: "acme", displayName: "", identityEmail: "a@b.test" },
        { slug: "acme", displayName: "A", identityEmail: "not-an-email" },
        { slug: "a".repeat(65), displayName: "A", identityEmail: "a@b.test" },
      ];
      for (const input of bad) {
        assert.equal(validateProvisionInput(input), false, `rejected: ${JSON.stringify(input)}`);
      }
      assert.equal(
        validateProvisionInput({ slug: "acme-holdings", displayName: "Acme", identityEmail: "a@b.test" }),
        true,
      );
    }

    /* ── A missing human refuses BEFORE any write ─────────────────────────── */
    {
      const before = await count(db, "companies");
      const outcome = await provisionTenant(db, {
        slug: "ghost",
        displayName: "Ghost",
        identityEmail: "nobody@nowhere.test",
      });
      assert.deepEqual(outcome, { status: "refused", reason: "identity-not-found" });
      assert.equal(await count(db, "companies"), before, "nothing was written");
      assert.equal(await count(db, "roles"), 0);
      assert.equal(await count(db, "memberships"), 0);
    }

    /* ── An inactive identity is not a human R4A will accept ──────────────── */
    {
      const revoked = await seedHuman(db, "revoked@acme.test");
      /*
       * A revocation must carry its full evidence, and `is_primary` must drop with the status:
       * `auth_identities_revoked_chk` makes "revoked, but we do not know when, why, or whether it is
       * still primary" unrepresentable. Constructing the state honestly is part of the fixture.
       */
      await db.query(
        `update auth_identities
            set status = 'revoked', is_primary = false, revoked_at = now(),
                revocation_reason = 'r4a fixture: an identity R4A must refuse'
          where id = $1`,
        [revoked.authIdentityId],
      );
      assert.equal(await resolveExistingHuman(db, revoked.email), undefined);
      const outcome = await provisionTenant(db, {
        slug: "revoked-co",
        displayName: "Revoked Co",
        identityEmail: revoked.email,
      });
      assert.deepEqual(outcome, { status: "refused", reason: "identity-not-found" });
      assert.equal(await count(db, "companies"), 0);
    }

    /* ── THE CEREMONY ─────────────────────────────────────────────────────── */
    const alice = await seedHuman(db, "alice@acme.test");
    const auditBefore = await count(db, "audit_log");

    const provisioned = await provisionTenant(db, {
      slug: "acme-holdings",
      displayName: "Acme Holdings",
      identityEmail: "ALICE@ACME.TEST",
    });
    assert.equal(provisioned.status, "provisioned");
    const tenant = provisioned.status === "provisioned" ? provisioned.tenant : undefined!;

    /* ── The company row, field by field ──────────────────────────────────── */
    {
      const row = (
        await db.query(
          `select name, slug, plan, tenant_status, tenant_status_changed_at, lifecycle_status,
                  version, created_by, created_by_type, updated_by, provisioning_source, deleted_at
             from companies where id = $1`,
          [tenant.tenantId],
        )
      ).rows[0]! as Record<string, unknown>;

      assert.equal(row.name, "Acme Holdings");
      assert.equal(row.slug, "acme-holdings");
      assert.equal(row.tenant_status, "active", "active at commit — `provisioning` never survives");
      assert.ok(row.tenant_status_changed_at, "the transition is stamped");
      assert.equal(row.lifecycle_status, "active");
      assert.equal(row.version, 1);
      assert.equal(row.created_by, null, "no actor to name");
      assert.equal(row.created_by_type, null, "…and none invented");
      assert.equal(row.updated_by, null);
      assert.equal(row.deleted_at, null);
      assert.equal(row.provisioning_source, TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR);
      assert.equal(row.plan, "free", "the column keeps its own default; R4A assigns it no meaning");
    }

    /* ── The owner role, field by field ───────────────────────────────────── */
    {
      const roles = (
        await db.query(
          `select id, name, type, system_role, authority_rank, policy_refs, lifecycle_status,
                  version, created_by, created_by_type
             from roles where tenant_id = $1`,
          [tenant.tenantId],
        )
      ).rows as Record<string, unknown>[];
      assert.equal(roles.length, 1, "exactly one role");
      const role = roles[0]!;
      assert.equal(role.id, tenant.roleId);
      assert.equal(role.name, BOOTSTRAP_ROLE_NAME);
      assert.equal(role.type, BOOTSTRAP_ROLE_TYPE);
      assert.equal(role.system_role, false, "an ordinary tenant role, not a built-in");
      assert.equal(role.authority_rank, null, "unused authority columns stay untouched");
      assert.equal(role.policy_refs, null);
      assert.equal(role.lifecycle_status, "active");
      assert.equal(role.version, 1);
      assert.equal(role.created_by, null);
      assert.equal(role.created_by_type, null);
    }

    /* ── The bootstrap membership, field by field ─────────────────────────── */
    {
      const memberships = (
        await db.query(
          `select id, user_id, role_id, status, status_changed_at, lifecycle_status, version,
                  accepted_invitation_id, delegated_by_id, delegated_by_type, authority_scope,
                  created_by, created_by_type, revoked_at, suspended_at
             from memberships where tenant_id = $1`,
          [tenant.tenantId],
        )
      ).rows as Record<string, unknown>[];
      assert.equal(memberships.length, 1, "exactly one membership");
      const m = memberships[0]!;
      assert.equal(m.id, tenant.membershipId);
      assert.equal(m.user_id, alice.userId);
      assert.equal(m.role_id, tenant.roleId, "bound to the owner role in the same transaction");
      assert.equal(m.status, "active", "a NULL status would be invisible to sign-in");
      assert.ok(m.status_changed_at);
      assert.equal(m.lifecycle_status, "active");
      assert.equal(m.version, 1);
      assert.equal(m.accepted_invitation_id, null, "truthful: no invitation exists");
      assert.equal(m.delegated_by_id, null, "no delegating actor is fabricated");
      assert.equal(m.delegated_by_type, null);
      assert.equal(m.authority_scope, null);
      assert.equal(m.created_by, null);
      assert.equal(m.created_by_type, null);
      assert.equal(m.revoked_at, null);
      assert.equal(m.suspended_at, null);
    }

    /* ── ZERO audit events, and zero of everything else ───────────────────── */
    {
      assert.equal(await count(db, "audit_log"), auditBefore, "a terminal has no actor to attribute");
      for (const table of [
        "genesis_nominations",
        "decision_records",
        "governance_sessions",
        "membership_authorizations",
        "invitations",
        "identity_enrollment_requests",
        "user_session_contexts",
        "auth_credentials",
        "role_permissions",
        "provider_connectivity_controls",
        "action_execution_attempts",
        "external_recipients",
        "work_artifacts",
        "knowledge_facts",
        "organizations",
        "departments",
        "documents",
      ]) {
        assert.equal(await count(db, table), 0, `${table} must be untouched by the ceremony`);
      }
      /* Only the humans the fixture seeded — the ceremony minted nobody. */
      assert.equal(await count(db, "users"), 2, "alice + the revoked fixture; no user was created");
      assert.equal(await count(db, "auth_identities"), 2);
    }

    /* ── A duplicate slug refuses and modifies nothing ────────────────────── */
    {
      const bob = await seedHuman(db, "bob@acme.test");
      const before = (
        await db.query(`select name, slug, provisioning_source from companies where id = $1`, [
          tenant.tenantId,
        ])
      ).rows[0]!;

      const outcome = await provisionTenant(db, {
        slug: "acme-holdings",
        displayName: "Impostor Holdings",
        identityEmail: bob.email,
      });
      assert.deepEqual(outcome, { status: "refused", reason: "slug-already-taken" });

      const after = (
        await db.query(`select name, slug, provisioning_source from companies where id = $1`, [
          tenant.tenantId,
        ])
      ).rows[0]!;
      assert.deepEqual(after, before, "the existing tenant was NOT renamed or re-pointed");
      assert.equal(await count(db, "companies"), 1, "no second tenant");
      assert.equal(await count(db, "roles"), 1, "no orphan role");
      assert.equal(await count(db, "memberships"), 1, "no orphan membership");
    }

    /* ── A failure INSIDE the transaction rolls back all three tables ─────── */
    {
      /*
       * Injected at the last step by making the activation UPDATE fail: a deferred-style breakage is
       * the hardest window, because the company, role and membership are all already inserted. If
       * anything survives here, the ceremony is not atomic.
       *
       * The CHECK is the injection mechanism — a trigger would need DDL this test has no business
       * writing, and a CHECK that rejects 'active' proves the same thing with the schema's own tools.
       */
      const carol = await seedHuman(db, "carol@acme.test");
      const beforeCompanies = await count(db, "companies");
      const beforeRoles = await count(db, "roles");
      const beforeMemberships = await count(db, "memberships");

      await db.query(
        `alter table companies add constraint r4a_injected_failure
           check (slug <> 'crash-co' or tenant_status <> 'active')`,
      );
      try {
        await assert.rejects(
          provisionTenant(db, {
            slug: "crash-co",
            displayName: "Crash Co",
            identityEmail: carol.email,
          }),
          /r4a_injected_failure/,
          "the failure surfaces rather than being swallowed",
        );
      } finally {
        await db.query(`alter table companies drop constraint r4a_injected_failure`);
      }

      assert.equal(await count(db, "companies"), beforeCompanies, "no stranded tenant");
      assert.equal(await count(db, "roles"), beforeRoles, "no orphan role");
      assert.equal(await count(db, "memberships"), beforeMemberships, "no orphan membership");
      assert.equal(
        await count(db, "companies", "tenant_status = 'provisioning'"),
        0,
        "`provisioning` is transient and never durable",
      );
    }

    /* ── Concurrency: two ceremonies, one slug, exactly one tenant ────────── */
    {
      const dave = await seedHuman(db, "dave@race.test");
      const erin = await seedHuman(db, "erin@race.test");
      const a = new Client({ connectionString: harness.dbUrl });
      const b = new Client({ connectionString: harness.dbUrl });
      await a.connect();
      await b.connect();
      try {
        const [ra, rb] = await Promise.all([
          provisionTenant(a, { slug: "race-co", displayName: "Race A", identityEmail: dave.email }),
          provisionTenant(b, { slug: "race-co", displayName: "Race B", identityEmail: erin.email }),
        ]);
        const outcomes = [ra.status, rb.status].sort();
        assert.deepEqual(outcomes, ["provisioned", "refused"], "exactly one winner");
        const loser = ra.status === "refused" ? ra : rb.status === "refused" ? rb : undefined!;
        assert.equal(loser.reason, "slug-already-taken");
      } finally {
        await a.end();
        await b.end();
      }

      assert.equal(await count(db, "companies", "slug = 'race-co'"), 1, "one tenant on the slug");
      const raceTenant = (
        await db.query<{ id: string }>(`select id from companies where slug = 'race-co'`)
      ).rows[0]!.id;
      assert.equal(await count(db, "roles", "tenant_id = $1", [raceTenant]), 1, "no orphan role");
      assert.equal(
        await count(db, "memberships", "tenant_id = $1", [raceTenant]),
        1,
        "the loser's membership did not survive",
      );
    }

    /* ══ THE HANDOFF — the proof that the bootstrap cycle is really broken ══ */

    /* ── 1. The EXISTING Genesis resolver sees the tenant, with no branch ─── */
    let nominationId: string;
    {
      const target = await resolveNominationTarget(db, "acme-holdings", "alice@acme.test");
      assert.ok(
        target,
        "resolveNominationTarget must satisfy all ten of its predicates against an R4A tenant, " +
          "unchanged — this is the whole point of the ceremony",
      );
      assert.equal(target!.tenantId, tenant.tenantId);
      assert.equal(target!.userId, alice.userId);
      assert.equal(target!.membershipId, tenant.membershipId);

      const outcome = await nominateGenesisHuman(db, target!);
      assert.equal(outcome.status, "nominated");
      nominationId = outcome.status === "nominated" ? outcome.nominationId : "";
      assert.ok(nominationId);
    }

    /* ── 2. Acceptance under a verified session ───────────────────────────── */
    {
      const sessionId = await sessionRowFor(db, alice, tenant.tenantId, tenant.membershipId, "r4a1");
      const context = contextFor(alice, tenant.tenantId, tenant.membershipId, tenant.roleId, sessionId);
      const accepted = await acceptGenesisNomination(context, deps);
      assert.equal(accepted.status, "accepted", `acceptance failed: ${JSON.stringify(accepted)}`);

      const row = (
        await db.query(`select status, accepted_at, accepted_assurance_level from genesis_nominations
                         where id = $1`, [nominationId])
      ).rows[0]! as Record<string, unknown>;
      assert.equal(row.status, "accepted");
      assert.ok(row.accepted_at);
      assert.equal(row.accepted_assurance_level, "aal1");
    }

    /* ── 3. The member baseline REFUSES before G2, and succeeds after ─────── */
    let sessionId: string;
    let context: TenantContext;
    {
      sessionId = await sessionRowFor(db, alice, tenant.tenantId, tenant.membershipId, "r4a2");
      context = contextFor(alice, tenant.tenantId, tenant.membershipId, tenant.roleId, sessionId);

      const premature = await provisionMemberRole(
        context,
        { justification: "Baseline before Governance exists — this must be refused." },
        deps,
      );
      assert.equal(premature.status, "refused");
      assert.equal(
        premature.status === "refused" ? premature.reason : "",
        "no-governance-authority",
        "the owner BAND is not Governance authority — Genesis is",
      );
    }

    /* ── 4. G2 establishes the tenant's first and only bootstrap decision ─── */
    {
      const established = await establishGovernanceAuthority(
        context,
        { justification: "Establishing this tenant's genesis Governance authority for the record." },
        deps,
      );
      assert.equal(established.status, "established", `G2 failed: ${JSON.stringify(established)}`);
      assert.equal(await count(db, "decision_records", "bootstrap = true"), 1);
      assert.equal(
        await count(db, "genesis_nominations", "consumed_at is not null"),
        1,
        "the entitlement is spent exactly once",
      );
    }

    /* ── 5. The member role now provisions, and does NOT collide ──────────── */
    {
      const baseline = await provisionMemberRole(
        context,
        { justification: "Provisioning the ordinary member baseline for this tenant." },
        deps,
      );
      assert.equal(baseline.status, "provisioned", `baseline failed: ${JSON.stringify(baseline)}`);

      const roles = (
        await db.query<{ type: string; name: string }>(
          `select type, name from roles where tenant_id = $1`,
          [tenant.tenantId],
        )
      ).rows;
      /* Sorted in JS, not in SQL: `order by type` sorts by the enum's ORDINAL (`owner` is declared
       * before `member`), and pinning that would make this assertion depend on the declaration order
       * of `roleTypeEnum` rather than on the fact under test. */
      assert.deepEqual(
        roles.map((r) => `${r.type}:${r.name}`).sort(),
        ["member:Member", "owner:Owner"],
        "the bootstrap owner role and the baseline member role coexist",
      );
    }

    /* ── 6. The ordinary onboarding path still works after bootstrap ──────── */
    {
      const memberRoleId = (
        await db.query<{ id: string }>(
          `select id from roles where tenant_id = $1 and type = 'member'`,
          [tenant.tenantId],
        )
      ).rows[0]!.id;
      const ordinaryDecisionsBefore = await count(db, "decision_records", "bootstrap = false");

      const authorized = await authorizeMembership(
        context,
        {
          targetEmail: "frank@acme.test",
          intendedRoleId: memberRoleId,
          justification: "Onboarding an ordinary member through the normal authority, post-bootstrap.",
        },
        deps,
      );
      assert.equal(
        authorized.status,
        "authorized",
        `the normal path must still work: ${JSON.stringify(authorized)}`,
      );
      assert.equal(await count(db, "membership_authorizations"), 1);
      /*
       * State-relative on purpose. Ordinary decisions accumulate — the member-baseline provisioning
       * above wrote one too — so pinning a total would break the moment another governed act joined
       * this test. What must hold is that the count GREW by one and the bootstrap count did not.
       */
      assert.equal(
        await count(db, "decision_records", "bootstrap = false"),
        ordinaryDecisionsBefore + 1,
        "exactly one new ordinary Governance decision",
      );
      assert.equal(
        await count(db, "decision_records", "bootstrap = true"),
        1,
        "still exactly one bootstrap decision, ever",
      );
    }

    /* ── 7. A human already in another tenant gains a second membership ───── */
    {
      const outcome = await provisionTenant(db, {
        slug: "alice-second",
        displayName: "Alice Second Co",
        identityEmail: alice.email,
      });
      assert.equal(outcome.status, "provisioned", "one human may found more than one tenant");
      const second = outcome.status === "provisioned" ? outcome.tenant : undefined!;

      assert.notEqual(second.tenantId, tenant.tenantId);
      assert.equal(
        await count(db, "memberships", "user_id = $1", [alice.userId]),
        2,
        "two memberships, one per tenant",
      );

      const first = (
        await db.query(
          `select status, role_id, lifecycle_status from memberships where id = $1`,
          [tenant.membershipId],
        )
      ).rows[0]! as Record<string, unknown>;
      assert.equal(first.status, "active", "the first membership is undamaged");
      assert.equal(first.role_id, tenant.roleId);
      assert.equal(first.lifecycle_status, "active");

      /* And the second tenant carries no Governance authority of its own. */
      assert.equal(await count(db, "decision_records", "tenant_id = $1", [second.tenantId]), 0);
      assert.equal(await count(db, "genesis_nominations", "tenant_id = $1", [second.tenantId]), 0);
    }

    /* ── The audit ledger begins at Genesis, not at bootstrap ─────────────── */
    {
      const entries = (
        await db.query<{ action: string }>(
          `select action from audit_log where tenant_id = $1 order by occurred_at`,
          [tenant.tenantId],
        )
      ).rows.map((r) => r.action);
      assert.ok(entries.length > 0, "Genesis and G2 DO write audit rows");
      for (const action of entries) {
        assert.doesNotMatch(
          action,
          /tenant[._-]?(provision|bootstrap|created)/i,
          "no audit action claims the bootstrap ceremony — it wrote none",
        );
      }
      const actorless = await count(db, "audit_log", "actor_id is null or actor_type is null");
      assert.equal(actorless, 0, "every audit row that exists names a real actor");
    }

    console.log("r4a-flow/provisioning-postgres: ok");
  } finally {
    await db.end().catch(() => {});
    await handle.dispose?.();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
