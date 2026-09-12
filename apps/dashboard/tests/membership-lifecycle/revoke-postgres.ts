/*
 * MEMBERSHIP REVOCATION — against a real PostgreSQL.
 *
 * `memberships` had two writers before this authority and both were INSERT, while
 * `member-eligibility` already refused any membership that is not active or carries a `revoked_at`.
 * The enforcement was complete and the writer was missing. These assertions are about ROWS: that the
 * new writer produces exactly the shape the existing readers already refuse, and that it cannot be
 * turned into a membership editor, a cross-tenant reach, or a way to strand a tenant.
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import { revokeMembership } from "../../src/features/membership-lifecycle/revoke-membership.server";
import { eligibleTenantMemberWhere } from "../../src/features/auth-runtime/member-eligibility";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const REASON = "account separation: this human keeps only their other tenant";

interface Seeded {
  readonly tenantId: string;
  readonly ownerUserId: string;
  readonly ownerMembershipId: string;
  readonly ownerRoleId: string;
  readonly memberRoleId: string;
  readonly context: TenantContext;
}

async function seedTenant(db: Client, slug: string): Promise<Seeded> {
  const co = await db.query<{ id: string }>(
    `insert into companies (name, slug, tenant_status) values ($1,$2,'active') returning id`,
    [slug, slug],
  );
  const tenantId = co.rows[0]!.id;
  const u = await db.query<{ id: string }>(`insert into users (email) values ($1) returning id`, [
    `owner@${slug}.test`,
  ]);
  const ownerUserId = u.rows[0]!.id;
  const ai = await db.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1,'local','hebun-local',$2,'active',true, now()) returning id`,
    [ownerUserId, `local:owner@${slug}.test`],
  );
  const ownerRole = await db.query<{ id: string }>(
    `insert into roles (tenant_id, name, type, system_role) values ($1,'Owner','owner',false) returning id`,
    [tenantId],
  );
  const memberRole = await db.query<{ id: string }>(
    `insert into roles (tenant_id, name, type, system_role) values ($1,'Member','member',false) returning id`,
    [tenantId],
  );
  const m = await db.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status, status_changed_at)
     values ($1,$2,$3,'active',now()) returning id`,
    [tenantId, ownerUserId, ownerRole.rows[0]!.id],
  );
  /*
   * GENESIS. Without it `resolveGovernanceAuthority` answers NO_AUTHORITY and nothing below runs.
   *
   * The shape is COPIED FROM PRODUCTION — `certify` / `tenant` / `authority-established` — rather
   * than invented. A first attempt used a `genesis` decision type, which the enum does not contain;
   * a fixture whose genesis row is not the shape real genesis rows have would prove the authority
   * against a world that does not exist.
   */
  await db.query(
    `insert into decision_records
       (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id,
        bootstrap, outcome, justification)
     values ($1,'certify','tenant',$1,'human',$2,true,'authority-established',$3)`,
    [tenantId, ownerUserId, "test genesis"],
  );

  return {
    tenantId,
    ownerUserId,
    ownerMembershipId: m.rows[0]!.id,
    ownerRoleId: ownerRole.rows[0]!.id,
    memberRoleId: memberRole.rows[0]!.id,
    context: asHumanTenantContext({
      tenantId,
      userId: ownerUserId,
      authIdentityId: ai.rows[0]!.id,
      membershipId: m.rows[0]!.id,
      membershipVersion: 1,
      roleId: ownerRole.rows[0]!.id,
      sessionContextId: "00000000-0000-4000-8000-0000000000a1",
      provider: "local" as never,
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: `revoke-${slug}`,
      authenticatedAt: new Date().toISOString(),
    } as never),
  };
}

async function addMember(
  db: Client,
  tenantId: string,
  roleId: string,
  email: string,
): Promise<{ userId: string; membershipId: string }> {
  const u = await db.query<{ id: string }>(`insert into users (email) values ($1) returning id`, [
    email,
  ]);
  const m = await db.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status, status_changed_at)
     values ($1,$2,$3,'active',now()) returning id`,
    [tenantId, u.rows[0]!.id, roleId],
  );
  return { userId: u.rows[0]!.id, membershipId: m.rows[0]!.id };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_membership_revoke");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as const;

  try {
    harness.migrateDatabase();
    await db.connect();

    const a = await seedTenant(db, "revoke-a");
    const b = await seedTenant(db, "revoke-b");

    const rowOf = async (membershipId: string) => {
      const r = await db.query<{
        status: string;
        revoked_at: string | null;
        revoked_by_id: string | null;
        revoked_by_type: string | null;
        revocation_reason: string | null;
        lifecycle_status: string;
        version: number;
        role_id: string;
        user_id: string;
      }>(
        `select status, revoked_at, revoked_by_id, revoked_by_type, revocation_reason,
                lifecycle_status, version, role_id, user_id
           from memberships where id=$1`,
        [membershipId],
      );
      return r.rows[0]!;
    };

    /* ═══ 11a. THE LAST OWNER CANNOT BE REVOKED ════════════════════════ */
    {
      /*
       * Asserted FIRST, while tenant A genuinely has one owner. Every tenant in production is in
       * exactly this shape, so this is the realistic first use of the authority.
       */
      const out = await revokeMembership(a.context, { membershipId: a.ownerMembershipId, reason: REASON }, deps);
      assert.equal(out.status, "refused", "the last owner is not revocable");
      assert.equal(out.status === "refused" && out.reason, "would-strand-tenant");
      const row = await rowOf(a.ownerMembershipId);
      assert.equal(row.status, "active", "and the refusal wrote nothing");
      assert.equal(row.revoked_at, null);
    }

    /* A second owner and a plain member, so the interesting cases become reachable. */
    const secondOwner = await addMember(db, a.tenantId, a.ownerRoleId, "owner2@revoke-a.test");
    const member = await addMember(db, a.tenantId, a.memberRoleId, "member@revoke-a.test");

    /* ═══ 1 + 2. ACTIVE → REVOKED, IN THE CANONICAL SHAPE ══════════════ */
    {
      const before = await rowOf(member.membershipId);
      const out = await revokeMembership(
        a.context,
        { membershipId: member.membershipId, reason: REASON },
        deps,
      );
      assert.equal(out.status, "revoked", `refused: ${JSON.stringify(out)}`);

      const row = await rowOf(member.membershipId);
      assert.equal(row.status, "revoked", "status moved");
      assert.ok(row.revoked_at !== null, "revoked_at is set");
      assert.equal(row.revoked_by_id, a.ownerUserId, "the actor is the caller, not the subject");
      assert.equal(row.revoked_by_type, "human");
      assert.equal(row.revocation_reason, REASON);
      assert.equal(row.version, before.version + 1, "the version moved, invalidating stale reads");
      assert.equal(
        row.lifecycle_status,
        "active",
        "lifecycle_status is UNTOUCHED — a revoked membership is not a soft-deleted row",
      );
    }

    /* ═══ 4. THE EXISTING ELIGIBILITY READ NO LONGER RETURNS IT ════════ */
    {
      /*
       * The released predicate, imported rather than restated. If this authority ever wrote a shape
       * the real reader still accepted, this is the assertion that would catch it.
       */
      const { memberships: m } = await import("../../src/db/schema/membership");
      const { users } = await import("../../src/db/schema/user");
      const rows = await handle.db
        .select({ id: m.id })
        .from(m)
        .innerJoin(users, (await import("drizzle-orm")).eq(m.userId, users.id))
        .where(eligibleTenantMemberWhere(a.tenantId, member.userId));
      assert.equal(rows.length, 0, "the revoked human is no longer an eligible member");

      /* The control: the second owner still is, so the predicate is not simply matching nothing. */
      const still = await handle.db
        .select({ id: m.id })
        .from(m)
        .innerJoin(users, (await import("drizzle-orm")).eq(m.userId, users.id))
        .where(eligibleTenantMemberWhere(a.tenantId, secondOwner.userId));
      assert.equal(still.length, 1, "an untouched member is still eligible");
    }

    /* ═══ 3. THE AUDIT ROW EXISTS, IN THE SAME TRANSACTION ═════════════ */
    {
      const audit = await db.query<{
        action: string;
        entity_type: string;
        entity_id: string;
        actor_id: string;
        actor_type: string;
        result: string;
        metadata: Record<string, unknown>;
      }>(
        `select action, entity_type, entity_id, actor_id, actor_type, result, metadata
           from audit_log where tenant_id=$1 and action='governance.membership.revoked'`,
        [a.tenantId],
      );
      assert.equal(audit.rows.length, 1, "exactly one revocation audit row");
      const row = audit.rows[0]!;
      assert.equal(row.entity_type, "membership");
      assert.equal(row.entity_id, member.membershipId, "the subject is the MEMBERSHIP row");
      assert.equal(row.actor_id, a.ownerUserId, "attributed to the caller");
      assert.equal(row.actor_type, "human");
      assert.equal(row.result, "committed");
      assert.equal(row.metadata.subjectUserId, member.userId);
      assert.equal(row.metadata.reason, REASON);
      /* NO ADDRESS EVER REACHES THE AUDIT. */
      assert.ok(
        !JSON.stringify(row.metadata).includes("@"),
        "no email address appears in the audit metadata",
      );
    }

    /* ═══ 7. ALREADY REVOKED IS SAFE AND SAYS SO ═══════════════════════ */
    {
      const before = await rowOf(member.membershipId);
      const out = await revokeMembership(
        a.context,
        { membershipId: member.membershipId, reason: REASON },
        deps,
      );
      assert.equal(out.status, "already-revoked", "a second call is not an error");
      const after = await rowOf(member.membershipId);
      assert.equal(after.version, before.version, "…and writes nothing at all");
      assert.equal(
        String(after.revoked_at),
        String(before.revoked_at),
        "the original instant is preserved",
      );
      const audits = await db.query<{ n: string }>(
        `select count(*)::text n from audit_log where tenant_id=$1 and action='governance.membership.revoked'`,
        [a.tenantId],
      );
      assert.equal(audits.rows[0]!.n, "1", "no second audit row was appended");
    }

    /* ═══ 5 + 9. CROSS-TENANT IS REFUSED AS ABSENCE ════════════════════ */
    {
      const stolen = await revokeMembership(
        a.context,
        { membershipId: b.ownerMembershipId, reason: REASON },
        deps,
      );
      assert.equal(stolen.status, "refused", "tenant A cannot revoke tenant B's membership");
      assert.equal(
        stolen.status === "refused" && stolen.reason,
        "not-found",
        "…and it looks like absence, disclosing nothing about another tenant",
      );
      const row = await rowOf(b.ownerMembershipId);
      assert.equal(row.status, "active", "B's membership is untouched");
      assert.equal(row.revoked_at, null);
      const bAudit = await db.query<{ n: string }>(
        `select count(*)::text n from audit_log where tenant_id=$1`,
        [b.tenantId],
      );
      assert.equal(bAudit.rows[0]!.n, "0", "and nothing was written into B's audit");
    }

    /* ═══ 6. UNKNOWN AND MALFORMED IDS ═════════════════════════════════ */
    {
      const missing = await revokeMembership(
        a.context,
        { membershipId: "11111111-1111-4111-8111-111111111111", reason: REASON },
        deps,
      );
      assert.equal(missing.status === "refused" && missing.reason, "not-found");

      const malformed = await revokeMembership(a.context, { membershipId: "nope", reason: REASON }, deps);
      assert.equal(malformed.status === "refused" && malformed.reason, "invalid-input");

      const noReason = await revokeMembership(
        a.context,
        { membershipId: secondOwner.membershipId, reason: "   " },
        deps,
      );
      assert.equal(noReason.status === "refused" && noReason.reason, "invalid-input");

      const tooLong = await revokeMembership(
        a.context,
        { membershipId: secondOwner.membershipId, reason: "x".repeat(129) },
        deps,
      );
      assert.equal(
        tooLong.status === "refused" && tooLong.reason,
        "invalid-input",
        "a reason longer than the column is refused rather than truncated",
      );
    }

    /* ═══ CAS: A STALE EXPECTED VERSION LOSES ══════════════════════════ */
    {
      const stale = await revokeMembership(
        a.context,
        { membershipId: secondOwner.membershipId, reason: REASON, expectedVersion: 999 },
        deps,
      );
      assert.equal(stale.status === "refused" && stale.reason, "version-conflict");
      assert.equal((await rowOf(secondOwner.membershipId)).status, "active", "nothing was written");
    }

    /* ═══ 8. NO COLLATERAL MUTATION ════════════════════════════════════ */
    {
      const counts = await db.query<{
        users: string; identities: string; roles: string; companies: string; other_memberships: string;
      }>(
        `select (select count(*)::text from users) users,
                (select count(*)::text from auth_identities) identities,
                (select count(*)::text from roles) roles,
                (select count(*)::text from companies) companies,
                (select count(*)::text from memberships where status='active') other_memberships`,
      );
      /* 2 seeded owners + 2 added humans = 4 users; 2 identities; 4 roles; 2 companies. */
      assert.equal(counts.rows[0]!.users, "4", "no user was created or deleted");
      assert.equal(counts.rows[0]!.identities, "2", "no identity was touched");
      assert.equal(counts.rows[0]!.roles, "4", "no role was created or deleted");
      assert.equal(counts.rows[0]!.companies, "2", "no tenant was touched");
      assert.equal(
        counts.rows[0]!.other_memberships,
        "3",
        "exactly one membership left the active set — A's owner, A's second owner, B's owner remain",
      );
      /* The revoked human's USER row is untouched: revoking access is not deleting a person. */
      const user = await db.query<{ n: string }>(
        `select count(*)::text n from users where id=$1 and deleted_at is null and lifecycle_status='active'`,
        [member.userId],
      );
      assert.equal(user.rows[0]!.n, "1", "the human still exists and is not soft-deleted");
    }

    /* ═══ 11b. A NON-LAST OWNER IS REVOCABLE, AND THEN THE LAST IS NOT ══ */
    {
      const out = await revokeMembership(
        a.context,
        { membershipId: secondOwner.membershipId, reason: REASON },
        deps,
      );
      assert.equal(out.status, "revoked", "a second owner may be revoked while another remains");

      /* Tenant A is back to one owner — the caller's own. It is now protected again. */
      const last = await revokeMembership(
        a.context,
        { membershipId: a.ownerMembershipId, reason: REASON },
        deps,
      );
      assert.equal(
        last.status === "refused" && last.reason,
        "would-strand-tenant",
        "the guard re-arms as soon as the tenant is down to one owner",
      );
      const owners = await db.query<{ n: string }>(
        `select count(*)::text n from memberships m join roles r on r.id=m.role_id
          where m.tenant_id=$1 and m.status='active' and r.type='owner'`,
        [a.tenantId],
      );
      assert.equal(owners.rows[0]!.n, "1", "the tenant still has an owner");
    }

    /* ═══ 10. A REVOKED MEMBERSHIP NO LONGER AUTHORIZES A SESSION ══════ */
    {
      /*
       * The runtime re-resolves membership on every request, so the proof that matters is that the
       * released eligibility predicate — the one the session resolver uses — refuses the row.
       * Asserted here for the SECOND OWNER, whose revocation happened above.
       */
      const { memberships: m } = await import("../../src/db/schema/membership");
      const { users } = await import("../../src/db/schema/user");
      const { eq } = await import("drizzle-orm");
      const rows = await handle.db
        .select({ id: m.id })
        .from(m)
        .innerJoin(users, eq(m.userId, users.id))
        .where(eligibleTenantMemberWhere(a.tenantId, secondOwner.userId));
      assert.equal(rows.length, 0, "the revoked owner can no longer be resolved into a context");
    }

    /* ═══ AUTHORITY: A CALLER WITHOUT GOVERNANCE IS REFUSED ════════════ */
    {
      /*
       * Tenant B's genesis names B's owner. A context for a DIFFERENT human in B therefore holds no
       * Governance authority, and must be refused BEFORE the target is even looked up.
       */
      const outsider = await addMember(db, b.tenantId, b.memberRoleId, "outsider@revoke-b.test");
      const outsiderContext = asHumanTenantContext({
        tenantId: b.tenantId,
        userId: outsider.userId,
        authIdentityId: "00000000-0000-4000-8000-0000000000b1",
        membershipId: outsider.membershipId,
        membershipVersion: 1,
        roleId: b.memberRoleId,
        sessionContextId: "00000000-0000-4000-8000-0000000000b2",
        provider: "local" as never,
        assuranceLevel: "aal1",
        mfaVerified: false,
        requestId: "revoke-outsider",
        authenticatedAt: new Date().toISOString(),
      } as never);

      const refusedOut = await revokeMembership(
        outsiderContext,
        { membershipId: outsider.membershipId, reason: REASON },
        deps,
      );
      assert.equal(
        refusedOut.status === "refused" && refusedOut.reason,
        "not-authorized",
        "Governance authority is required — the owner role is not consulted for the caller",
      );
      assert.equal(
        (await rowOf(outsider.membershipId)).status,
        "active",
        "…and even a self-revocation writes nothing without authority",
      );
    }

    /* ═══ NO TENANT CONTEXT AT ALL ═════════════════════════════════════ */
    {
      const out = await revokeMembership(null, { membershipId: member.membershipId, reason: REASON }, deps);
      assert.equal(out.status === "refused" && out.reason, "no-authorized-tenant-context");
    }

    console.log("Membership revocation (PostgreSQL): all assertions passed");
  } finally {
    await db.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
