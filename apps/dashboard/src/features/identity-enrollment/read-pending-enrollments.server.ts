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
/* The receipt's lifetime has exactly one owner; this seam reads it, never restates it. */
import { ENROLLMENT_CONTINUATION_TTL_SECONDS } from "@/features/identity-enrollment/continuation-cookie";
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
   * WHICH OF THE THREE ACTIONABLE STATES THIS IS.
   *
   *   pending             awaiting the tenant's first decision
   *   approved-in-flight  approved, uncompleted, and the bearer can still finish
   *   approved-stranded   approved, uncompleted, and the continuation receipt has expired
   *
   * The last two are the SAME durable row shape — `approved` with `completed_at IS NULL` — and the
   * schema cannot tell them apart, because "the bearer is about to finish" and "the bearer can never
   * finish" differ only in elapsed time. Calling both of them stranded described a healthy ceremony
   * as a broken one within seconds of its approval, and invited an approver to reject work that was
   * still in progress. The boundary below is what makes the distinction honest.
   */
  readonly lifecycle: PendingEnrollmentLifecycle;
  /** When Governance approved it. Present for both approved states, null while pending. */
  readonly approvedAt: string | null;
  /**
   * When the bearer's continuation receipt lapses — `submittedAt` plus the receipt's own TTL.
   *
   * Derived here rather than in the component so `ENROLLMENT_CONTINUATION_TTL_SECONDS` keeps exactly
   * one owner. Present for both approved states; null while pending, where it would only distract.
   */
  readonly receiptExpiresAt: string | null;
}

export type PendingEnrollmentLifecycle = "pending" | "approved-in-flight" | "approved-stranded";

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
     * TWO ACTIONABLE ROW SHAPES, THREE ACTIONABLE STATES.
     *
     *   pending                       awaiting the tenant's first decision
     *   approved + completed_at NULL  approved and unfinished — either in flight or stranded,
     *                                 separated below by the continuation receipt's lifetime
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

    /*
     * THE BOUNDARY, AND WHY IT IS THIS ONE.
     *
     * The server cannot see whether the browser still holds its httpOnly continuation cookie, so it
     * must never claim the continuation is "lost". What it CAN know is when that receipt lapses:
     * Act 1 sets it for `ENROLLMENT_CONTINUATION_TTL_SECONDS` from `submitted_at`, and after that
     * instant the ceremony the bearer started can no longer be completed by anyone. Before it, the
     * bearer may simply not have finished yet.
     *
     * Inclusive at the boundary — at exactly `submittedAt + TTL` the cookie's max-age has elapsed,
     * so that instant already belongs to the stranded side.
     */
    const now = (deps.now ?? (() => new Date()))();
    const receiptLifetimeMs = ENROLLMENT_CONTINUATION_TTL_SECONDS * 1000;

    return {
      status: "read",
      view: {
        viewerIsGovernanceAuthority: true,
        pending: rows.map((row) => {
          const receiptExpiresAt = new Date(row.submittedAt.getTime() + receiptLifetimeMs);
          const approved = row.status === "approved";
          return {
            enrollmentId: row.enrollmentId,
            invitationId: row.invitationId,
            submittedAt: row.submittedAt.toISOString(),
            lifecycle: !approved
              ? ("pending" as const)
              : now.getTime() >= receiptExpiresAt.getTime()
                ? ("approved-stranded" as const)
                : ("approved-in-flight" as const),
            approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
            receiptExpiresAt: approved ? receiptExpiresAt.toISOString() : null,
          };
        }),
      },
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
