/*
 * membership-authority/authorize-membership.server.ts — Governance permits ONE future human (I1).
 *
 * WHERE THE AUTHORITY COMES FROM, AND WHERE IT DOES NOT. The only question this module asks about
 * authority is `resolveGovernanceAuthority(tenant)` — the same G2/G3 resolver that already answers
 * it for ratification, delegation and revocation. There is NO second resolver here, and none of
 * `roles.type`, `memberships.authority_scope`, `permissions`, `role_permissions`, provider state or
 * anything the client supplied is consulted for authority. A tenant owner without Governance
 * authority is refused exactly like a stranger; a revoked delegate is refused exactly like someone
 * who was never delegated, because the resolver's `not exists` on the revocation already says so.
 *
 * `roles.type` IS read here — but never for the CALLER'S authority. It is read to decide whether the
 * TARGET band may be onboarded into. Those are different questions and conflating them is what
 * would have re-invented a role-based authority model.
 *
 * THE CIRCULAR-REFERENCE PROBLEM, AND THE AUTHORIZED SOLUTION. The decision must name the
 * authorization as its subject, and the authorization must name the decision as its provenance;
 * both columns are NOT NULL. The Director authorized generating the authorization's UUID in the
 * application so the decision can bind to it before the row exists. The alternative — creating an
 * `invitations` row to obtain an id — would have minted token material inside an authority phase.
 * Nothing is fabricated: the id is a v4 UUID from `crypto.randomUUID`, and the row it names is
 * written in the same transaction or not at all.
 *
 * WHAT COMMITS TOGETHER. The governance session, the `approve` decision, the authorization artifact
 * and the audit row are one transaction. "Decision committed but no authorization" and
 * "authorization committed but unaudited" are both unrepresentable rather than unlikely.
 *
 * WHAT THIS MODULE CANNOT DO. It never creates a user, an auth identity, a credential, an
 * invitation, a token, a membership or a role; it never grants Governance authority; it never
 * touches provider state or execution. Those absences are structural — the modules and tables
 * involved are not imported.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { membershipAuthorizations } from "@/db/schema/membership-authorization";
import { roles } from "@/db/schema/role";
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
  ELIGIBLE_ROLE_TYPE_LIST,
  MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION,
  MEMBERSHIP_AUTHORIZATION_DECISION_TYPE,
  MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE,
  NORMALIZED_EMAIL_MAX_LENGTH,
  ONBOARDING_ELIGIBLE_ROLE_TYPES,
  type MembershipAuthorizationRefusal,
  type MembershipAuthorizationResult,
} from "./contracts";

function refused(reason: MembershipAuthorizationRefusal): MembershipAuthorizationResult {
  return { status: "refused", reason };
}

/**
 * Normalize the intended human's email the same way `invitations` requires it to be stored.
 *
 * Deliberately conservative: this is a target address, not an identity, and over-clever
 * canonicalization (stripping dots, plus-addressing) would silently merge two different people.
 * Lower + trim only, then a shape check — the same normalization the database CHECK enforces, so
 * the application and the storage layer cannot disagree about what "the same human" means.
 */
export function normalizeTargetEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > NORMALIZED_EMAIL_MAX_LENGTH) return null;
  // One @, something before it, and a dotted something after it. Not RFC 5322 — a shape gate.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(normalized)) return null;
  return normalized;
}

/**
 * Authorize ONE future onboarding, under an established Governance authority.
 *
 * The client supplies three things: the intended human's email, the id of an EXISTING role in its
 * own tenant, and a human-authored justification. It cannot supply the tenant, the actor, the
 * authority source, the decision id, the session id, the status, or the time.
 */
export async function authorizeMembership(
  tenant: TenantContext | null,
  input: {
    readonly targetEmail: string;
    readonly intendedRoleId: string;
    readonly justification: string;
  },
  deps: GovernanceDeps = {},
): Promise<MembershipAuthorizationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Membership authorization is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const normalizedEmail = normalizeTargetEmail(input?.targetEmail);
  if (!normalizedEmail) return refused("invalid-target-email");

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  /* AUTHORITY FIRST, and from one place only. */
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  try {
    /*
     * THE TARGET ROLE. Resolved by id AND tenant together, so a role belonging to another tenant is
     * indistinguishable from one that never existed. The composite foreign key on the table repeats
     * this structurally; this read exists to produce an honest refusal reason rather than a
     * constraint violation.
     */
    const roleRows = await db
      .select({ id: roles.id, type: roles.type })
      .from(roles)
      .where(
        and(
          eq(roles.id, String(input?.intendedRoleId ?? "")),
          eq(roles.tenantId, tenant.tenantId),
          eq(roles.lifecycleStatus, "active"),
        ),
      )
      .limit(1);

    const role = roleRows[0];
    if (!role) {
      /*
       * Distinguish "you named something that is not a role here" from "this tenant has no role you
       * could ever name". The second is the role-baseline gap, and reporting it as a bad input
       * would hide a real product absence behind a user error.
       */
      const eligibleRows = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, tenant.tenantId),
            eq(roles.lifecycleStatus, "active"),
            inArray(roles.type, ELIGIBLE_ROLE_TYPE_LIST),
          ),
        )
        .limit(1);
      return refused(
        eligibleRows.length === 0 ? "no-eligible-role-in-tenant" : "role-unresolvable",
      );
    }

    if (!ONBOARDING_ELIGIBLE_ROLE_TYPES.has(role.type)) return refused("role-not-eligible");

    /*
     * A live authorization for the same human already exists. The partial unique index is the real
     * defense against two concurrent authorizations; this read turns the common case into a clear
     * refusal instead of a caught constraint error.
     */
    const existing = await db
      .select({ id: membershipAuthorizations.id })
      .from(membershipAuthorizations)
      .where(
        and(
          eq(membershipAuthorizations.tenantId, tenant.tenantId),
          eq(membershipAuthorizations.normalizedEmail, normalizedEmail),
          eq(membershipAuthorizations.status, "authorized"),
        ),
      )
      .limit(1);
    if (existing.length > 0) return refused("already-authorized");

    /* The id the decision will name. See the header for why it is generated here. */
    const authorizationId = randomUUID();
    let recorded: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: MEMBERSHIP_AUTHORIZATION_DECISION_TYPE,
          subjectType: MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE,
          subjectId: authorizationId,
          justification,
          /*
           * Evidence carries the SHAPE of what was authorized, never the human's contact details:
           * `decision_records.evidence` is Governance history, and the authorization row already
           * owns the address. One copy, one owner.
           */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            intendedRoleId: role.id,
            intendedRoleType: role.type,
            membershipAuthorizationId: authorizationId,
          },
        },
        now,
      );

      await tx.insert(membershipAuthorizations).values({
        id: authorizationId,
        tenantId: tenant.tenantId,
        normalizedEmail,
        intendedRoleId: role.id,
        governanceDecisionId: decisionId,
        governanceSessionId: sessionId,
        authorizedByActorType: "human",
        authorizedByActorId: tenant.userId,
        status: "authorized",
        authorizedAt: now,
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
          action: MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION,
          outcome: "committed",
          entityId: decisionId,
          /*
           * Identity and versions only — the G1 doctrine. No email, no token, no credential, no
           * justification duplicate. The authorization row owns the address; the decision owns the
           * sentence.
           */
          metadata: {
            governanceSessionId: sessionId,
            decisionType: MEMBERSHIP_AUTHORIZATION_DECISION_TYPE,
            subjectType: MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE,
            subjectId: authorizationId,
            bootstrap: false,
            membershipAuthorizationId: authorizationId,
            intendedRoleId: role.id,
            intendedRoleType: role.type,
          },
        },
        now,
      );

      recorded = { decisionId, sessionId };
    });

    if (!recorded) return refused("persistence-unavailable");
    const outcome = recorded as { decisionId: string; sessionId: string };
    return {
      status: "authorized",
      authorizationId,
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      authorizedAt: now.toISOString(),
    };
  } catch (error) {
    /*
     * LOSING THE RACE IS NOT AN OUTAGE. Two concurrent authorizations for the same intended human
     * both pass the read above; the partial unique index is what actually stops the second, and the
     * loser deserves the true reason rather than a generic failure. Matched on the Postgres
     * unique-violation code AND the constraint name, so an unrelated conflict cannot borrow it.
     */
    if (isUniqueViolation(error, "membership_authorizations_one_active_per_email_uq")) {
      return refused("already-authorized");
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
