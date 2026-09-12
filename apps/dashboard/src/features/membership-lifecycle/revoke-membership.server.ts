/*
 * membership-lifecycle/revoke-membership.server.ts — THE SINGLE WRITER THAT ENDS A MEMBERSHIP.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * `memberships` had exactly two writers before this file — the tenant provisioning authority and
 * invitation acceptance — and BOTH are INSERT. There was no `update(memberships)` anywhere in the
 * repository. Meanwhile `membership_status` already contains `suspended`, `revoked` and `expired`,
 * and `member-eligibility.ts` already refuses any membership that is not `active`, not
 * `lifecycle_status = 'active'`, or has a `revoked_at`.
 *
 * So the ENFORCEMENT was complete and the WRITER was missing: the states were representable and
 * unreachable. This file adds the writer and nothing else. Every read path that decides who may act
 * in a tenant already honours the result without being touched.
 *
 * ── ONE TRANSITION, AND DELIBERATELY NO OTHERS ───────────────────────────────
 *
 * `active` → `revoked`, for one membership named by id. It is not a membership editor: it cannot
 * change a role, move a membership between tenants, reinstate anything, or write `suspended` or
 * `expired`. Those are different transitions and each would need its own justification. It creates
 * and deletes nothing — no user, no identity, no role, no tenant, no session, no credential.
 *
 * ── WHY GOVERNANCE AUTHORITY, NOT THE OWNER ROLE ─────────────────────────────
 *
 * `membership-authority/authorize-membership.server.ts` requires `resolveGovernanceAuthority` to
 * permit a future human INTO a tenant, and states plainly that `roles.type` is never consulted for
 * the caller's authority. Ending an existing human's access is at least as consequential as
 * permitting a future one, so it answers to the same resolver. Reading `roles.type = 'owner'` to
 * authorize the CALLER here would have introduced a second, weaker authority model beside the one
 * the repository already settled on.
 *
 * The owner role IS read — but only to answer a different question: whether the tenant would be
 * left with nobody. That distinction is the same one `authorize-membership` draws.
 *
 * ── THE LOCKOUT RULE, AND WHY IT IS A REFUSAL RATHER THAN A WARNING ──────────
 *
 * Revoking the last active owner would leave a tenant no human able to administer it. There is no
 * recovery: both membership writers are INSERT paths reachable only through tenant provisioning or
 * an invitation acceptance, and an invitation must be issued by somebody who is already inside. A
 * tenant stranded this way could not be repaired by any released code — only by direct database
 * surgery, which this repository treats as illegitimate.
 *
 * Every tenant in this deployment currently has exactly ONE active owner, so this is not a
 * theoretical guard: it fires on the very first realistic use. The intended production sequence is
 * to onboard the replacement owner FIRST and revoke second, and this refusal is what forces that
 * order instead of trusting an operator to remember it.
 *
 * ── WHAT IT DOES NOT DO: SESSIONS ────────────────────────────────────────────
 *
 * It revokes no session. `session-service` re-validates identity, membership and tenant on every
 * resolve and fails closed, so a revoked membership stops authorizing on the very next request
 * without help. A session authority already exists (`revokeSession`, `revokeSessionByReference`); if
 * a caller wants immediate termination rather than next-request termination, it composes the two —
 * the way `provider-connection-lifecycle` composes the credential and integration authorities. This
 * module quietly becoming a second session writer is precisely what that separation prevents.
 *
 * Server-only.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { memberships } from "@/db/schema/membership";
import { roles } from "@/db/schema/role";
import { users } from "@/db/schema/user";
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  eligibleTenantMemberConditions,
  joinUsersToMemberships,
} from "@/features/auth-runtime/member-eligibility";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import { recordMembershipRevokedWithin } from "@/features/governance-audit/membership-lifecycle-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import {
  OWNER_ROLE_TYPE,
  REVOCATION_REASON_MAX_LENGTH,
  type RevokeMembershipRefusal,
  type RevokeMembershipResult,
} from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIVE = "active" as const;

function refused(reason: RevokeMembershipRefusal): RevokeMembershipResult {
  return { status: "refused", reason } as const;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Membership revocation is server-only.");
  }
}

export interface RevokeMembershipInput {
  /** The membership to end. An ID — there is no by-email form; see the header. */
  readonly membershipId: string;
  /** Recorded on the row and in the audit. Bounded by the column. */
  readonly reason: string;
  /**
   * Optional compare-and-swap. When supplied, the transition applies only if the row is still at
   * this version, so a caller that read, showed a human a confirmation, and then acted cannot
   * revoke a membership that changed underneath the confirmation.
   */
  readonly expectedVersion?: number;
}

export interface RevokeMembershipDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/**
 * End one membership.
 *
 * THE TENANT IS THE CALLER'S RESOLVED CONTEXT, never an argument. Every statement below is
 * predicated on `tenant.tenantId`, so a membership id belonging to another organization cannot be
 * reached — it answers `not-found`, exactly as a nonexistent id does.
 */
export async function revokeMembership(
  tenant: TenantContext | null,
  input: RevokeMembershipInput,
  deps: RevokeMembershipDeps = {},
): Promise<RevokeMembershipResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("no-authorized-tenant-context");

  const membershipId = typeof input?.membershipId === "string" ? input.membershipId : "";
  if (!UUID_RE.test(membershipId)) return refused("invalid-input");

  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (reason.length === 0 || reason.length > REVOCATION_REASON_MAX_LENGTH) {
    return refused("invalid-input");
  }
  if (input.expectedVersion !== undefined && !Number.isInteger(input.expectedVersion)) {
    return refused("invalid-input");
  }

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  /*
   * AUTHORITY BEFORE ANYTHING IS READ ABOUT THE TARGET. Resolving the target first would let an
   * unauthorized caller learn whether a membership id exists in this tenant by timing or by the
   * shape of a later refusal.
   */
  const authority = await resolveGovernanceAuthority(tenant, { getDb: () => db });
  if (!authority.authorized) return refused("not-authorized");

  const now = (deps.now ?? (() => new Date()))();

  return db.transaction(async (tx) => {
    /* Locked, because the last-owner count below must not race another revocation. */
    const [current] = await tx
      .select({
        id: memberships.id,
        userId: memberships.userId,
        roleId: memberships.roleId,
        status: memberships.status,
        revokedAt: memberships.revokedAt,
        version: memberships.version,
      })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenant.tenantId), eq(memberships.id, membershipId)))
      .limit(1)
      .for("update");

    if (!current) return refused("not-found");

    /* Idempotent, and it says so rather than pretending a fresh transition happened. */
    if (current.status === "revoked" || current.revokedAt !== null) {
      return { status: "already-revoked", membershipId } as const;
    }
    if (current.status !== ACTIVE) return refused("not-active");

    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      return refused("version-conflict");
    }

    /*
     * ── THE LOCKOUT CHECK ───────────────────────────────────────────────────
     *
     * Only asked when the membership being ended is itself an owner: revoking a non-owner cannot
     * remove the tenant's last owner, and asking anyway would refuse legitimate work whenever a
     * tenant happened to have exactly one owner.
     *
     * It counts OTHER active owner memberships — `ne(id)` — under the same lock, so two concurrent
     * revocations cannot each observe the other's owner as still present and both succeed.
     */
    const [targetRole] = current.roleId
      ? await tx
          .select({ type: roles.type })
          .from(roles)
          .where(and(eq(roles.tenantId, tenant.tenantId), eq(roles.id, current.roleId)))
          .limit(1)
      : [];

    if (targetRole?.type === OWNER_ROLE_TYPE) {
      /*
       * THE SHARED ELIGIBILITY PREDICATE, NOT A LOCAL COPY OF IT.
       *
       * A first version spelled the conditions out here — tenant, status, lifecycle, `revoked_at` —
       * and a released OSA firewall exists precisely to catch "a module enforcing eligibility with
       * its own copy of the conditions". It was right to: the copy would have drifted the moment
       * eligibility gained a condition.
       *
       * The FULL predicate is used rather than `activeMembershipOnlyConditions`, whose own docs warn
       * it is a strict subset that "can call a human eligible whose identity has been soft-deleted".
       * A soft-deleted human cannot sign in, so counting one as the remaining owner would strand the
       * tenant while reporting that it had not been stranded. This joins `users` for exactly that
       * reason.
       */
      const [remaining] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(memberships)
        .innerJoin(users, joinUsersToMemberships())
        .innerJoin(roles, eq(roles.id, memberships.roleId))
        .where(
          and(
            ...eligibleTenantMemberConditions(tenant.tenantId),
            ne(memberships.id, membershipId),
            eq(roles.type, OWNER_ROLE_TYPE),
          ),
        );
      if ((remaining?.n ?? 0) === 0) return refused("would-strand-tenant");
    }

    /*
     * ── THE CANONICAL REVOKED SHAPE ─────────────────────────────────────────
     *
     * `status` and `revoked_at` together, because `member-eligibility` tests BOTH and a row failing
     * only one of them would be a contradiction waiting to be read as eligible by whichever check
     * someone forgets. `revoked_by_type`/`revoked_by_id` move as a pair — the schema's
     * `memberships_revocation_actor_chk` requires it.
     *
     * `lifecycle_status` is deliberately LEFT ALONE. It is the row's soft-delete axis, a different
     * concept from a membership that legitimately existed and has ended; writing it here would
     * invent a second revocation signal for the same fact.
     */
    const [row] = await tx
      .update(memberships)
      .set({
        status: "revoked",
        statusChangedAt: now,
        revokedAt: now,
        revokedByType: "human",
        revokedById: tenant.userId,
        revocationReason: reason,
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${memberships.version} + 1`,
      })
      .where(
        and(
          eq(memberships.tenantId, tenant.tenantId),
          eq(memberships.id, membershipId),
          /* The predicate re-states the precondition, so a lost race writes nothing. */
          eq(memberships.status, ACTIVE),
        ),
      )
      .returning({ id: memberships.id, version: memberships.version, revokedAt: memberships.revokedAt });

    if (!row) return refused("version-conflict");

    /* Same transaction: an unaudited revocation is unrepresentable, not merely unlikely. */
    await recordMembershipRevokedWithin(
      tx,
      auditActorFrom(tenant),
      {
        membershipId,
        subjectUserId: current.userId,
        roleId: current.roleId ?? null,
        reason,
        authorityVia: authority.via,
      },
      now,
    );

    return {
      status: "revoked",
      membershipId,
      version: row.version,
      revokedAt: (row.revokedAt ?? now).toISOString(),
    } as const;
  });
}
