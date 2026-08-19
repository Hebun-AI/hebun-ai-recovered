/*
 * tenant-role-baseline/provision-member-role.server.ts — Governance establishes the tenant's
 * ordinary member role (I1.1).
 *
 * WHY THIS PHASE EXISTS. I1 built a correct membership-authorization authority and then refused
 * every real tenant, because a tenant's only role is the seeded `owner` and I1 permits onboarding
 * into `member` alone. The gap was never in I1: nothing in the repository has ever created a role.
 * This is the narrowest thing that closes it.
 *
 * WHERE THE AUTHORITY COMES FROM. `resolveGovernanceAuthority(tenant)` — the same G2/G3 resolver
 * that answers it for ratification, delegation, revocation and membership authorization. There is
 * NO second resolver, and `roles.type`, `roles.authority_rank`, `memberships.authority_scope`,
 * `permissions` and `role_permissions` are consulted for nothing. Creating a role is a change to
 * the organization's authority structure, so only Governance may do it — an owner-band human with
 * no Governance authority is refused exactly like a stranger.
 *
 * THIS IS NOT ROLE ADMINISTRATION. There is no name parameter, no type parameter, no scope, no
 * update and no delete. The type is a constant and the name is a constant, so "provision an owner
 * role" has no representation to arrive in — it is not filtered, it is unsayable.
 *
 * WHY NO SEPARATE MUTEX. G3 serializes AUTHORITY mutations on the tenant's bootstrap decision row,
 * because authority is a query over decisions with no row to lock. That is not this invariant: the
 * thing that must be unique is a `roles` row, and `roles_one_member_per_tenant_uq` locks exactly
 * it. Borrowing G3's lock would couple two unrelated invariants and would still leave the index as
 * the real defense. The pre-flight existence read below is a courtesy that produces a clear
 * refusal; the index is what makes a second member role impossible.
 *
 * WHAT COMMITS TOGETHER. The governance session, the `approve` decision, the role row and the audit
 * row are one transaction. A role with no authorizing decision, and a decision claiming a role that
 * does not exist, are both unrepresentable rather than unlikely.
 *
 * WHAT THIS MODULE CANNOT DO. It never creates a user, an identity, a credential, an invitation or
 * a membership; it never modifies an existing role; it never grants authority of any kind. Those
 * absences are structural — the modules and tables involved are not imported.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { roles } from "@/db/schema/role";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceDbOrNull,
  validateJustification,
  type GovernanceDeps,
} from "@/features/governance-decision/persistence.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import {
  BASELINE_ROLE_NAME,
  BASELINE_ROLE_TYPE,
  BASELINE_UNIQUENESS,
  ORGANIZATIONAL_ROLE_AUDIT_ACTION,
  ORGANIZATIONAL_ROLE_DECISION_TYPE,
  ORGANIZATIONAL_ROLE_SUBJECT_TYPE,
  type RoleBaselineRefusal,
  type RoleBaselineResult,
} from "./contracts";
/* MOVED, NOT COPIED — the read lives in `role-baseline-read.server`, a module that cannot
 * provision anything. Callers import it there; this file exports only the act. */

function refused(reason: RoleBaselineRefusal): RoleBaselineResult {
  return { status: "refused", reason };
}

/**
 * Provision the tenant's ordinary member role, under an established Governance authority.
 *
 * The client supplies ONE thing: a human-authored justification. It cannot supply the tenant, the
 * actor, the role type, the role name, the role id, the authority source, the decision id, the
 * session id, or the time.
 */
export async function provisionMemberRole(
  tenant: TenantContext | null,
  input: { readonly justification: string },
  deps: GovernanceDeps = {},
): Promise<RoleBaselineResult> {
  if (typeof window !== "undefined") {
    throw new Error("Role provisioning is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  /* AUTHORITY FIRST, and from one place only. */
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  try {
    /*
     * Does the tenant already have its member role? Matched WITHOUT a lifecycle predicate, so this
     * read asks exactly the question the unique index answers. Reporting "already provisioned" for
     * a role this phase did not create is the truthful answer: a seeded role is still the tenant's
     * member role, and I1.1 does not rewrite history to claim otherwise.
     */
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.tenantId, tenant.tenantId), eq(roles.type, BASELINE_ROLE_TYPE)))
      .limit(1);
    if (existing.length > 0) return refused("already-provisioned");

    /* The id the decision will name, generated before the decision so the two can bind. */
    const roleId = randomUUID();
    let recorded: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: ORGANIZATIONAL_ROLE_DECISION_TYPE,
          subjectType: ORGANIZATIONAL_ROLE_SUBJECT_TYPE,
          subjectId: roleId,
          justification,
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            roleType: BASELINE_ROLE_TYPE,
          },
        },
        now,
      );

      await tx.insert(roles).values({
        id: roleId,
        tenantId: tenant.tenantId,
        name: BASELINE_ROLE_NAME,
        type: BASELINE_ROLE_TYPE,
        /*
         * Every unused authority column stays untouched. `system_role` false because this is an
         * ordinary tenant role, not a built-in; `authority_rank` and `policy_refs` are left NULL
         * because no runtime reads them and populating them would invent an authority.
         */
        systemRole: false,
        createdBy: tenant.userId,
        createdByType: "human",
      });

      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: ORGANIZATIONAL_ROLE_AUDIT_ACTION,
          outcome: "committed",
          entityId: decisionId,
          /* Identity and band only. No justification duplicate — the decision owns the sentence. */
          metadata: {
            governanceSessionId: sessionId,
            decisionType: ORGANIZATIONAL_ROLE_DECISION_TYPE,
            subjectType: ORGANIZATIONAL_ROLE_SUBJECT_TYPE,
            subjectId: roleId,
            bootstrap: false,
            provisionedRoleId: roleId,
            provisionedRoleType: BASELINE_ROLE_TYPE,
          },
        },
        now,
      );

      recorded = { decisionId, sessionId };
    });

    if (!recorded) return refused("persistence-unavailable");
    const outcome = recorded as { decisionId: string; sessionId: string };
    return {
      status: "provisioned",
      roleId,
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      provisionedAt: now.toISOString(),
    };
  } catch (error) {
    /*
     * LOSING THE RACE IS NOT AN OUTAGE. Two concurrent ceremonies both read "no member role" and
     * both proceed; the partial unique index stops the second, and the loser deserves the true
     * reason. Matched on the Postgres unique-violation code AND the constraint name, so an
     * unrelated conflict cannot borrow it.
     */
    if (isUniqueViolation(error, BASELINE_UNIQUENESS.constraint)) {
      return refused("already-provisioned");
    }
    return refused("persistence-unavailable");
  }
}

/** Narrow a thrown value to a Postgres unique violation on one named constraint. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23505" && candidate.constraint === constraint) return true;
  // drizzle wraps the driver error; the original is reachable through `cause`.
  return candidate.cause ? isUniqueViolation(candidate.cause, constraint) : false;
}
