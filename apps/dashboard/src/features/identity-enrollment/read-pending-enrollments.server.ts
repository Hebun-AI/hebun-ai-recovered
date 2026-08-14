/*
 * identity-enrollment/read-pending-enrollments.server.ts — the approver's read seam (I1.2).
 *
 * WHY THIS EXISTS. `readPendingEnrollment` answers "tell me about ceremony X", which is only useful
 * to a caller who already knows X. Nothing gives the Governance authority that id: Act 1 returns it
 * to the BEARER, and Hebun sends nothing. Without a list, the second key could never be turned
 * through the product, and an approved-by-nobody ceremony is the same as no ceremony at all.
 *
 * AUTHORITY-ONLY, LIKE `readMembershipAuthority` AND `readDelegationCandidates`. A caller without
 * Governance authority gets an empty view rather than a directory. This is not decoration: a pending
 * ceremony is evidence that somebody, somewhere, holds a live capability for this tenant, and that is
 * not a fact an ordinary member needs.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN:
 *
 *   the invited email address   `readPendingEnrollment`'s own header states the rule — the approver
 *                               correlates the submission with the handover THEY performed out of
 *                               band, and does not learn an address from this surface
 *   the continuation digest     it is the bearer's half of the ceremony and has no reader
 *   the capability              never stored anywhere, so it could not be returned even in error
 *
 * Read-only. No writes, no authority decisions, no side effects.
 *
 * Server-only.
 */
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { identityEnrollmentRequests } from "@/db/schema/identity-enrollment";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveGovernanceDbOrNull,
  type GovernanceDeps,
} from "@/features/governance-decision/bootstrap-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/decision-authority.server";

/**
 * One pending ceremony, as the Governance surface may show it.
 *
 * Every field is a real column and none of them identifies the prospective human. The approver is
 * being asked "did you hand a capability to someone at about this time?", which is the only question
 * they can honestly answer — Hebun never verified who the bearer is.
 */
export interface PendingEnrollmentView {
  readonly enrollmentId: string;
  readonly invitationId: string;
  /** When the bearer submitted. The approver's correlation handle. */
  readonly submittedAt: string;
  /**
   * TRUE when this ceremony was already APPROVED and never completed — the stranded case.
   *
   * It is listed, and listed as itself. Approval is only permission for Act 3; if the bearer loses
   * the browser binding, that permission can never be spent, the row is uncompletable, and it holds
   * `identity_enrollment_requests_one_live_per_invitation_uq` against every fresh submission. A
   * surface that hid it, or called it "awaiting your decision", would be describing a state the
   * tenant cannot act on. Rejecting it is the documented recovery.
   */
  readonly strandedAfterApproval: boolean;
  /** When Governance approved it. Present only for a stranded row. */
  readonly approvedAt: string | null;
}

export interface PendingEnrollmentsView {
  readonly viewerIsGovernanceAuthority: boolean;
  readonly pending: readonly PendingEnrollmentView[];
}

export type PendingEnrollmentsLookup =
  | { readonly status: "read"; readonly view: PendingEnrollmentsView }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-unavailable";
    };

const EMPTY_VIEW: PendingEnrollmentsView = {
  viewerIsGovernanceAuthority: false,
  pending: [],
};

/**
 * Every ceremony in this tenant still awaiting a Governance decision.
 *
 * Tenant-scoped by predicate, and scoped to the two states a Governance authority can still act on:
 * `pending` (awaiting a first decision) and `approved` with no completion (stranded, and blocking a
 * fresh submission until it is rejected). `rejected` and `completed` are terminal and are history —
 * their decisions are already in `decision_records` where every other Governance act is found.
 */
export async function readPendingEnrollments(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<PendingEnrollmentsLookup> {
  if (typeof window !== "undefined") {
    throw new Error("Enrollment reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const authority = await resolveGovernanceAuthority(tenant, deps);
    if (!authority.authorized) return { status: "read", view: EMPTY_VIEW };

    /*
     * TWO ACTIONABLE STATES, NOT ONE.
     *
     *   pending                     awaiting the tenant's first decision
     *   approved + completed_at NULL  stranded — approved, never completed, and blocking
     *
     * `rejected` and `completed` are terminal and are deliberately absent: neither can be decided,
     * and listing them would be a control that does nothing.
     */
    const rows = await db
      .select({
        enrollmentId: identityEnrollmentRequests.id,
        invitationId: identityEnrollmentRequests.invitationId,
        submittedAt: identityEnrollmentRequests.submittedAt,
        status: identityEnrollmentRequests.status,
        approvedAt: identityEnrollmentRequests.approvedAt,
      })
      .from(identityEnrollmentRequests)
      .where(
        and(
          eq(identityEnrollmentRequests.tenantId, tenant.tenantId),
          or(
            eq(identityEnrollmentRequests.status, "pending"),
            and(
              eq(identityEnrollmentRequests.status, "approved"),
              isNull(identityEnrollmentRequests.completedAt),
            ),
          ),
        ),
      )
      /* Oldest first: the one that has been waiting longest is the one to look at. */
      .orderBy(asc(identityEnrollmentRequests.submittedAt), asc(identityEnrollmentRequests.id));

    return {
      status: "read",
      view: {
        viewerIsGovernanceAuthority: true,
        pending: rows.map((row) => ({
          enrollmentId: row.enrollmentId,
          invitationId: row.invitationId,
          submittedAt: row.submittedAt.toISOString(),
          strandedAfterApproval: row.status === "approved",
          approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
        })),
      },
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
