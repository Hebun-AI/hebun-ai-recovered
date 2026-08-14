/*
 * identity-enrollment/decide-enrollment.server.ts — ACT 2, turning KEY 2 (I1.2).
 *
 * WHERE THE AUTHORITY COMES FROM, AND WHERE IT DOES NOT. The only question this module asks about
 * authority is `resolveGovernanceAuthority(tenant)` — the same G2/G3 resolver that already answers
 * it for ratification, delegation, revocation, membership authorization and role provisioning.
 * There is NO second resolver here, and none of `roles.type`, `roles.authority_rank`,
 * `memberships.authority_scope`, `permissions`, `role_permissions`, provider state or anything the
 * client supplied is consulted. An `owner`-band human without Governance authority is refused
 * exactly like a stranger; a revoked delegate is refused exactly like someone never delegated,
 * because the resolver's `not exists` on the revocation already says so.
 *
 * WHAT THIS ACT CHANGES. The ceremony's status, and a Governance decision that says why. It creates
 * no user, no identity, no credential, no session, no membership and no role — approval is
 * PERMISSION for Act 3, never the act itself.
 *
 * WHAT COMMITS TOGETHER. The governance session, the decision, the status transition and the audit
 * row are one transaction. "Decided but the ceremony still reads pending" and "approved but
 * unaudited" are both unrepresentable rather than unlikely.
 *
 * WHY A REJECTION LEAVES `approval_decision_id` NULL. The column is named for what it holds: the
 * decision that APPROVED. `identity_enrollment_requests_approved_chk` welds the four approval
 * columns to the approved/completed statuses in both directions, so a refusal could not store one
 * there even if it wanted to. A rejection's decision is found the way every Governance decision is
 * found — by `subject_type` + `subject_id` on `decision_records` — and the row's own terminal
 * evidence is `rejected_at` + `rejection_reason`. There is no second rejection to guard against: the
 * conditional transition below matches zero rows the second time and aborts the transaction with it.
 *
 * Server-only.
 */
import { and, eq, isNull } from "drizzle-orm";
import { identityEnrollmentRequests } from "@/db/schema/identity-enrollment";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceDbOrNull,
  validateJustification,
  type GovernanceDeps,
} from "@/features/governance-decision/bootstrap-authority.server";
import {
  resolveGovernanceAuthority,
  writeGovernanceDecisionWithin,
} from "@/features/governance-decision/decision-authority.server";
import {
  IDENTITY_ENROLLMENT_APPROVED_ACTION,
  IDENTITY_ENROLLMENT_APPROVE_TYPE,
  IDENTITY_ENROLLMENT_REJECTED_ACTION,
  IDENTITY_ENROLLMENT_REJECT_TYPE,
  IDENTITY_ENROLLMENT_SUBJECT_TYPE,
  type EnrollmentDecision,
  type EnrollmentDecisionRefusal,
  type EnrollmentDecisionResult,
} from "./contracts";
import { looksLikeUuid } from "./start-enrollment.server";

function refused(reason: EnrollmentDecisionRefusal): EnrollmentDecisionResult {
  return { status: "refused", reason };
}

/** Thrown inside the transaction when the conditional status transition matched nothing. */
class EnrollmentRaceLost extends Error {}

/**
 * Approve or refuse ONE enrollment ceremony, under an established Governance authority.
 *
 * The client supplies three things: which ceremony, which way, and a human-authored justification.
 * It cannot supply the tenant, the actor, the authority source, the decision id, the session id, the
 * resulting status, or the time.
 */
export async function decideIdentityEnrollment(
  tenant: TenantContext | null,
  input: {
    readonly enrollmentId: string;
    readonly decision: EnrollmentDecision;
    readonly justification: string;
  },
  deps: GovernanceDeps = {},
): Promise<EnrollmentDecisionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Enrollment decisions are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const approving = input?.decision === "approve";
  if (!approving && input?.decision !== "reject") return refused("enrollment-unresolvable");

  const justification = validateJustification(input?.justification);
  if (!justification) {
    return refused(approving ? "justification-required" : "rejection-reason-required");
  }

  /* AUTHORITY FIRST, and from one place only. */
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  const enrollmentId = String(input?.enrollmentId ?? "");
  if (!looksLikeUuid(enrollmentId)) return refused("enrollment-unresolvable");

  try {
    /*
     * Resolved by id AND tenant together, so a ceremony belonging to another tenant is
     * indistinguishable from one that never existed. The composite tenant FK on the row repeats this
     * structurally; this read exists to produce an honest refusal rather than a constraint error.
     */
    const rows = await db
      .select({
        id: identityEnrollmentRequests.id,
        invitationId: identityEnrollmentRequests.invitationId,
        status: identityEnrollmentRequests.status,
        completedAt: identityEnrollmentRequests.completedAt,
      })
      .from(identityEnrollmentRequests)
      .where(
        and(
          eq(identityEnrollmentRequests.id, enrollmentId),
          eq(identityEnrollmentRequests.tenantId, tenant.tenantId),
        ),
      )
      .limit(1);

    const enrollment = rows[0];
    if (!enrollment) return refused("enrollment-unresolvable");

    /*
     * ── WHAT MAY STILL BE DECIDED ─────────────────────────────────────────────
     *
     * APPROVAL is unchanged: only a `pending` ceremony may be approved, so an approved row can never
     * be approved twice.
     *
     * REJECTION now also reaches an APPROVED ceremony that never completed — the STRANDED case, and
     * the reason this seam exists. Approval is only permission for Act 3; if the bearer loses the
     * browser binding that permission is unusable, and before this the row could not be seen by the
     * read seam, could not be decided by this runtime, and permanently held
     * `identity_enrollment_requests_one_live_per_invitation_uq` against a fresh submission. The
     * product told the bearer a Governance authority could reject a stranded ceremony; this is what
     * makes that sentence true.
     *
     * A COMPLETED ceremony is never rejectable. It created a real human with a real credential, and
     * rejecting it would claim to undo that.
     */
    const strandedApproved = enrollment.status === "approved" && enrollment.completedAt === null;
    const decidable = enrollment.status === "pending" || (!approving && strandedApproved);
    if (!decidable) return refused("already-decided");

    let recorded: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: approving
            ? IDENTITY_ENROLLMENT_APPROVE_TYPE
            : IDENTITY_ENROLLMENT_REJECT_TYPE,
          subjectType: IDENTITY_ENROLLMENT_SUBJECT_TYPE,
          subjectId: enrollment.id,
          justification,
          /*
           * Evidence carries the SHAPE of what was decided, never the prospective human's contact
           * details and never the continuation secret. `invitations.normalized_email` owns the
           * address; the decision owns the sentence.
           */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            identityEnrollmentRequestId: enrollment.id,
            enrollmentInvitationId: enrollment.invitationId,
            /* Which case this was: an initial decision, or a stranded approved ceremony released. */
            recoveredFromStrandedApproval: !approving && strandedApproved,
          },
        },
        now,
      );

      /*
       * THE CONDITIONAL TRANSITION. Predicated on the ceremony still being pending, so a concurrent
       * decision that got here first makes this update zero rows — and the abort below unwinds the
       * session, the decision and the audit row with it. This is the G2 `EntitlementRaceLost`
       * pattern, and it is what makes "approval racing rejection" have exactly one winner.
       */
      const transitioned = await tx
        .update(identityEnrollmentRequests)
        .set(
          approving
            ? {
                status: "approved",
                approvedAt: now,
                approvalDecisionId: decisionId,
                approvedByActorType: "human",
                approvedByActorId: tenant.userId,
                updatedAt: now,
                updatedBy: tenant.userId,
                updatedByType: "human",
              }
            : {
                status: "rejected",
                rejectedAt: now,
                rejectionReason: justification.slice(0, 128),
                /*
                 * THE APPROVAL COLUMNS ARE CLEARED, AND THE SCHEMA REQUIRES IT.
                 * `identity_enrollment_requests_approved_chk` welds those four columns to the
                 * approved/completed statuses in BOTH directions, so a `rejected` row that still
                 * carried them would violate the constraint. They are NULL on a pending rejection
                 * already; this makes the stranded-approved rejection legal too.
                 *
                 * NO HISTORY IS LOST. The approval is a Governance decision and lives where every
                 * Governance decision lives — `decision_records`, findable by `subject_type` +
                 * `subject_id` — plus its own audit row. The enrollment row was never the ledger.
                 */
                approvedAt: null,
                approvalDecisionId: null,
                approvedByActorType: null,
                approvedByActorId: null,
                updatedAt: now,
                updatedBy: tenant.userId,
                updatedByType: "human",
              },
        )
        .where(
          and(
            eq(identityEnrollmentRequests.id, enrollment.id),
            eq(identityEnrollmentRequests.tenantId, tenant.tenantId),
            /*
             * The conditional predicate mirrors the eligibility decided above, so the race window is
             * exactly as narrow as before: an approval still requires `pending`, and a rejection
             * matches `pending` or the stranded approved row it was resolved from. A concurrent
             * decision that got here first makes this update zero rows and aborts everything.
             */
            approving
              ? eq(identityEnrollmentRequests.status, "pending")
              : strandedApproved
                ? and(
                    eq(identityEnrollmentRequests.status, "approved"),
                    isNull(identityEnrollmentRequests.completedAt),
                  )
                : eq(identityEnrollmentRequests.status, "pending"),
          ),
        )
        .returning({ id: identityEnrollmentRequests.id });

      if (transitioned.length === 0) throw new EnrollmentRaceLost();

      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: approving
            ? IDENTITY_ENROLLMENT_APPROVED_ACTION
            : IDENTITY_ENROLLMENT_REJECTED_ACTION,
          outcome: approving ? "committed" : "rejected",
          entityId: decisionId,
          /*
           * Identity and shape only — the G1 doctrine. No email, no continuation reference, no
           * digest, no credential, no justification duplicate.
           */
          metadata: {
            governanceSessionId: sessionId,
            decisionType: approving
              ? IDENTITY_ENROLLMENT_APPROVE_TYPE
              : IDENTITY_ENROLLMENT_REJECT_TYPE,
            subjectType: IDENTITY_ENROLLMENT_SUBJECT_TYPE,
            subjectId: enrollment.id,
            bootstrap: false,
            identityEnrollmentRequestId: enrollment.id,
            enrollmentInvitationId: enrollment.invitationId,
          },
        },
        now,
      );

      recorded = { decisionId, sessionId };
    });

    if (!recorded) return refused("persistence-unavailable");
    const outcome = recorded as { decisionId: string; sessionId: string };
    return {
      status: approving ? "approved" : "rejected",
      enrollmentId: enrollment.id,
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      decidedAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof EnrollmentRaceLost) return refused("already-decided");
    return refused("persistence-unavailable");
  }
}
