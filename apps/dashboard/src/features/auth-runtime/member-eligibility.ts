/*
 * auth-runtime/member-eligibility.ts — WHAT MAKES A HUMAN A CURRENTLY ELIGIBLE MEMBER OF A TENANT,
 * written once.
 *
 * ── IT INVENTS NOTHING ───────────────────────────────────────────────────────
 *
 * Every condition below already existed and is copied from the modules that own it. The membership
 * half is the SESSION predicate — `identity-repository.server.ts` applies exactly these three
 * conditions at `findPrimaryActiveMembership`, `findActiveMemberships` and `findTenantCandidates`,
 * which is what decides whether a human can hold a session in a tenant at all. The identity half is
 * the one `findActiveLocalIdentityByEmail` applies to `users`, plus the soft-delete column that
 * `create-durable-agent-identity.server.ts` checks when it verifies an agent's human owner.
 *
 * So this file introduces no lifecycle semantics. It states the existing ones in one place, because
 * they were being re-typed at every call site and had already drifted: the Organization Structure
 * Authority's owner check tested `memberships.lifecycle_status` ALONE, which accepted a human whose
 * membership was revoked and one whose identity had been soft-deleted.
 *
 *     ELIGIBLE != AUTHORIZED.        A PREDICATE IS NOT AN AUTHORITY.
 *
 * ── IT IS NOT AN AUTHORITY, AND CANNOT BECOME ONE ────────────────────────────
 *
 * It holds no database handle, opens no connection, runs no query and exports no function that
 * touches one. It returns drizzle conditions and nothing else, so a caller must already have its own
 * authorized transaction and its own scoping. Identity still owns `users`, Membership Authority
 * still owns `memberships`, and neither loses anything by having its rule quoted here.
 *
 * It is deliberately NOT a `.server.ts` module: it is pure, and the writers that consume it are
 * pinned by a firewall to an exact list of server modules they may reach.
 *
 * ── WHAT IT DOES NOT DECIDE ──────────────────────────────────────────────────
 *
 * Not whether the caller may ask. Not whether the subject holds Governance authority, a role, a
 * permission or a mandate. Not whether a human may sign in — an auth identity and a credential are
 * separate facts this file never reads. Eligibility is "this human currently belongs to this tenant
 * and their identity is live", and nothing more.
 */
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { memberships } from "@/db/schema/membership";
import { users } from "@/db/schema/user";

/**
 * The `lifecycle_status` value every governed read in this repository treats as in service.
 *
 * Stated as a literal here rather than imported from a feature, because this module sits UNDER the
 * features that consume it and must not depend on any of them. `organization-authority` exports its
 * own `ACTIVE_LIFECYCLE_STATUS` with the same value; a test pins the two equal so the duplication
 * can never become a divergence.
 */
export const ACTIVE_LIFECYCLE = "active" as const;

/** The `memberships.status` value that means the membership is in force. */
export const ACTIVE_MEMBERSHIP_STATUS = "active" as const;

/**
 * THE CONDITIONS, IN ONE PLACE.
 *
 * Six, and each one is load-bearing for a different way a human stops being eligible:
 *
 *   memberships.tenant_id       they belong to a DIFFERENT organization
 *   memberships.status          the membership was revoked
 *   memberships.revoked_at      the membership was revoked, recorded on the other column
 *   memberships.lifecycle_status the membership row was archived or deleted
 *   users.lifecycle_status      the identity was archived or deleted
 *   users.deleted_at            the identity was soft-deleted
 *
 * `status` and `revoked_at` are BOTH checked and that is not redundancy for its own sake: a row
 * where the two disagree is exactly the drift a single check would admit, and a bite-proof that
 * removed one of them survived until a fixture existed whose two revocation facts disagreed.
 *
 * REQUIRES A JOIN. These conditions name both tables, so a caller must join `users` and
 * `memberships` on `memberships.user_id = users.id`. `joinUsersToMemberships` is that join, so the
 * two halves cannot be wired up differently by two callers.
 *
 * SCOPING IS THE CALLER'S. There is no user-id condition here: a caller asking about ONE human adds
 * `eq(users.id, …)`, and a caller enumerating a tenant's members adds nothing. That is what keeps
 * this file from being a roster read or a membership authority.
 */
export function eligibleTenantMemberConditions(tenantId: string): readonly SQL[] {
  return [
    eq(memberships.tenantId, tenantId),
    eq(memberships.status, ACTIVE_MEMBERSHIP_STATUS),
    eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(memberships.revokedAt),
    eq(users.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(users.deletedAt),
  ] as SQL[];
}

/** The join the conditions above require. Stated here so two callers cannot wire it differently. */
export const joinUsersToMemberships = () => eq(memberships.userId, users.id);

/**
 * The whole predicate for ONE named human, which is the shape an authority uses when it verifies a
 * value a caller already supplied — never to discover anybody.
 */
export function eligibleTenantMemberWhere(tenantId: string, userId: string): SQL {
  return and(...eligibleTenantMemberConditions(tenantId), eq(users.id, userId)) as SQL;
}

/**
 * THE MEMBERSHIP HALF ALONE.
 *
 * For a caller that legitimately may not read `users` at all. The Organization Structure Authority's
 * READ is exactly that caller: a released firewall asserts it names `users` nowhere, so that no name
 * or email can travel with a department, and that restriction is worth more than the one dimension
 * it costs.
 *
 * It is a STRICT SUBSET of the full predicate — it can call a human eligible whose identity has been
 * soft-deleted. A caller using this must say so rather than imply it checked everything.
 */
export function activeMembershipOnlyConditions(tenantId: string): readonly SQL[] {
  return [
    eq(memberships.tenantId, tenantId),
    eq(memberships.status, ACTIVE_MEMBERSHIP_STATUS),
    eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE),
    isNull(memberships.revokedAt),
  ] as SQL[];
}
