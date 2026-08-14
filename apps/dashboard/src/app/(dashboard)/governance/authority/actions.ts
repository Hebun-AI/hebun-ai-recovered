"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { establishGovernanceAuthority } from "@/features/governance-decision/bootstrap-authority.server";
import { recordGovernanceDecision } from "@/features/governance-decision/decision-authority.server";
import type {
  BootstrapResult,
  DecisionResult,
} from "@/features/governance-decision/contracts";
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "@/features/governance-decision/authority-delegation.server";
import type {
  DelegationResult,
  RevocationResult,
} from "@/features/governance-decision/delegation-contracts";
import { authorizeMembership } from "@/features/membership-authority/authorize-membership.server";
import type { MembershipAuthorizationResult } from "@/features/membership-authority/contracts";
import { provisionMemberRole } from "@/features/tenant-role-baseline/provision-member-role.server";
import type { RoleBaselineResult } from "@/features/tenant-role-baseline/contracts";
import { getAuthEnvironment } from "@/features/auth-runtime/request-session.server";
import { issueInvitation } from "@/features/human-onboarding/issue-invitation.server";
import type { InvitationIssuanceResult } from "@/features/human-onboarding/contracts";
import { decideIdentityEnrollment } from "@/features/identity-enrollment/decide-enrollment.server";
import type {
  EnrollmentDecision,
  EnrollmentDecisionResult,
} from "@/features/identity-enrollment/contracts";

/*
 * The G2 Governance boundary — the only client-crossable way to write a Governance decision.
 *
 * WHAT THE CLIENT MAY SUPPLY, EXHAUSTIVELY: a justification, and (for an ordinary decision) a
 * decision type and a subject reference. Nothing else has a parameter. The tenant, the actor, the
 * identity, the session, the authority source, the bootstrap flag, the outcome and every timestamp
 * are resolved SERVER-SIDE from the durable R1 session — so a forged `tenantId`, `actorId`,
 * `authIdentityId`, `roleId`, `authorityRank`, `bootstrap`, `sessionId` or `decisionId` is
 * unrepresentable here rather than filtered somewhere downstream.
 *
 * There is deliberately NO update, delete, supersede, escalate or appeal action in this file or
 * anywhere else the client can reach. Reversing a decision is itself a Governance decision, and
 * that runtime does not exist. `delegate` and `revoke` gained one in G3; `approve` gained one in
 * I1, for membership authorization ONLY — and an authorized membership is not authority.
 *
 * Heby's server actions do not import this module, so no message, model answer, slash command or
 * voice transcript has a representation in which it could reach Governance.
 */

/*
 * ── G3: moving Governance authority ─────────────────────────────────────────────────────────────
 *
 * The client names the human to grant, or the delegation to end, and writes a justification.
 * Everything authoritative — the tenant, the caller's identity, whether they hold authority and how,
 * the decision type, the authority source, the session, the timestamp — is resolved server-side.
 *
 * Neither action can end the genesis: a revocation's subject is a delegation decision, and the
 * bootstrap decision is not one (A2-a).
 */
export async function delegateGovernanceAuthorityAction(input: {
  toUserId: string;
  justification: string;
}): Promise<DelegationResult> {
  const tenant = await resolveTenantContext();
  const result = await delegateGovernanceAuthority(tenant, {
    toUserId: input?.toUserId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "delegated") revalidatePath("/governance/authority");
  return result;
}

/** End one delegated authority. Never deletes the delegation decision it names. */
export async function revokeGovernanceAuthorityAction(input: {
  delegationDecisionId: string;
  justification: string;
}): Promise<RevocationResult> {
  const tenant = await resolveTenantContext();
  const result = await revokeGovernanceAuthority(tenant, {
    delegationDecisionId: input?.delegationDecisionId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "revoked") revalidatePath("/governance/authority");
  return result;
}

/** Spend the tenant's accepted genesis entitlement to establish its first Governance authority. */
export async function establishGovernanceAuthorityAction(input: {
  justification: string;
}): Promise<BootstrapResult> {
  const tenant = await resolveTenantContext();
  const result = await establishGovernanceAuthority(tenant, {
    justification: input?.justification ?? "",
  });
  if (result.status === "established") revalidatePath("/governance/authority");
  return result;
}

/**
 * Record one ratify/reject decision under an established authority.
 *
 * Recording is ALL this does. A `ratify` decision does not mark Knowledge ratified — the server
 * module behind this action does not import the Knowledge schema at all.
 */
export async function recordGovernanceDecisionAction(input: {
  decisionType: string;
  subjectType: string;
  subjectId: string;
  justification: string;
}): Promise<DecisionResult> {
  const tenant = await resolveTenantContext();
  const result = await recordGovernanceDecision(tenant, {
    decisionType: input?.decisionType ?? "",
    subjectType: input?.subjectType ?? "",
    subjectId: input?.subjectId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "recorded") revalidatePath("/governance/authority");
  return result;
}

/*
 * ── I1: authorizing ONE future human ────────────────────────────────────────────────────────────
 *
 * The client names the intended human's email, chooses an EXISTING role in its own tenant, and
 * writes a justification. Everything authoritative — the tenant, the caller's identity, whether
 * they hold Governance authority and how, the decision type, the domain, the outcome, the session,
 * the authorization id, its status and every timestamp — is resolved server-side.
 *
 * This action creates NO invitation, NO token, NO user, NO identity, NO credential, NO membership
 * and NO role. It records that Governance permitted one onboarding to happen later.
 */
export async function authorizeMembershipAction(input: {
  targetEmail: string;
  intendedRoleId: string;
  justification: string;
}): Promise<MembershipAuthorizationResult> {
  const tenant = await resolveTenantContext();
  const result = await authorizeMembership(tenant, {
    targetEmail: input?.targetEmail ?? "",
    intendedRoleId: input?.intendedRoleId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "authorized") revalidatePath("/governance/authority");
  return result;
}

/*
 * ── I1.1: establishing the tenant's ordinary member role ────────────────────────────────────────
 *
 * The client supplies ONE thing: a justification. The role's type, name and id, the tenant, the
 * actor, the authority source, the decision, the session and every timestamp are resolved
 * server-side — so "provision an owner role" has no parameter to arrive in.
 *
 * This action creates NO human, membership, invitation, credential or identity, and modifies NO
 * existing role. It establishes the least-authority role a new person can hold.
 */
export async function provisionMemberRoleAction(input: {
  justification: string;
}): Promise<RoleBaselineResult> {
  const tenant = await resolveTenantContext();
  const result = await provisionMemberRole(tenant, {
    justification: input?.justification ?? "",
  });
  if (result.status === "provisioned") revalidatePath("/governance/authority");
  return result;
}

/*
 * ── I2: issuing the bearer capability against an existing authorization ─────────────────────────
 *
 * The client supplies ONE thing: which authorization to spend. The tenant, the invited address, the
 * intended role, the expiry, the capability and every timestamp are read from that authorization row
 * or generated server-side — so "invite this other person into that other role" has no parameter to
 * arrive in.
 *
 * THE CAPABILITY IS RETURNED ONCE, TO THE AUTHORITY WHO ASKED. Hebun has no mail runtime and sends
 * nothing; the returned string is handed over out of band by the human who issued it. Issuing is not
 * delivering, and no wording on this surface may suggest otherwise.
 *
 * The digest key is resolved from the server environment here rather than inside the feature,
 * because reading configuration is a request concern. A misconfigured environment refuses instead of
 * minting a capability nobody could later verify.
 */
export async function issueInvitationAction(input: {
  membershipAuthorizationId: string;
}): Promise<InvitationIssuanceResult> {
  const tenant = await resolveTenantContext();
  const env = getAuthEnvironment();
  if (env.status !== "configured") {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  const result = await issueInvitation(
    tenant,
    { membershipAuthorizationId: input?.membershipAuthorizationId ?? "" },
    { digestKey: env.sessionDigestCurrentKey },
  );
  if (result.status === "issued") revalidatePath("/governance/authority");
  return result;
}

/*
 * ── I1.2: turning the SECOND key on one enrollment submission ───────────────────────────────────
 *
 * The client supplies three things: which submission, which way, and a human-authored justification.
 * The tenant, the caller's identity, whether they hold Governance authority and how, the decision
 * type, the domain, the outcome, the session, the resulting status and every timestamp are resolved
 * server-side — so "approve somebody else's tenant's submission" has no parameter to arrive in.
 *
 * APPROVAL IS PERMISSION, NEVER THE ACT. This creates no user, identity, credential, session,
 * membership or role. It records that a Governance authority reviewed one submission and said yes or
 * no; the bearer still has to come back and complete the ceremony themselves.
 *
 * WHY IT BELONGS ON THIS SURFACE. The second key is a Governance act by the same authority that made
 * the membership decision and issued the capability. Putting it anywhere else would create a second
 * place where authority is exercised, which is the thing this whole file exists to prevent.
 */
export async function decideIdentityEnrollmentAction(input: {
  enrollmentId: string;
  decision: EnrollmentDecision;
  justification: string;
}): Promise<EnrollmentDecisionResult> {
  const tenant = await resolveTenantContext();
  const result = await decideIdentityEnrollment(tenant, {
    enrollmentId: input?.enrollmentId ?? "",
    decision: input?.decision ?? "approve",
    justification: input?.justification ?? "",
  });
  if (result.status === "approved" || result.status === "rejected") {
    revalidatePath("/governance/authority");
  }
  return result;
}
