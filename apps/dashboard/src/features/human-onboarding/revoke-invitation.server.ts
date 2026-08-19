/*
 * human-onboarding/revoke-invitation.server.ts — ending ONE outstanding capability.
 *
 * ── THE INCIDENT THIS CLOSES ─────────────────────────────────────────────────
 *
 * A one-time capability was lost before it was spent. It is unrecoverable by construction, and that
 * is correct. What was wrong is what happened next: the invitation stayed `pending`,
 * `invitations_pending_email_uq` is keyed on exactly that status, and NOTHING in the runtime ever
 * wrote `expired` or `revoked`. So the tenant/address slot was held permanently and no replacement
 * could be issued — not after expiry either, because expiry is a predicate the runtime EVALUATES,
 * never a state it RECORDS.
 *
 * This is the missing writer, and it is deliberately the only thing that was missing.
 *
 * ── WHERE THE AUTHORITY COMES FROM ───────────────────────────────────────────
 *
 * `resolveGovernanceAuthority(tenant)` — the same G2/G3 resolver issuance already uses, and the same
 * shape: revocation is an act performed UNDER Governance authority, not a Governance DECISION.
 * `decision_records` is not written, exactly as `issueInvitation` does not write it. The decision was
 * made at I1; ending the capability it produced is mechanical, and inflating the constitutional
 * ledger with it would make history claim decisions nobody made.
 *
 * Requiring the same authority as issuance is the point: whoever may create an outstanding bearer
 * secret is precisely who may destroy one.
 *
 * ── WHAT THE CLIENT MAY SUPPLY ───────────────────────────────────────────────
 *
 * Two things: which invitation, and why. The tenant, the actor, the status, the timestamps and every
 * authority-bearing value are read from the session or the row, so a forged tenant, email, role,
 * actor or authorization has nowhere to arrive.
 *
 * ── A LAPSED INVITATION IS REVOCABLE, ON PURPOSE ─────────────────────────────
 *
 * Eligibility is `status = 'pending'` and NOTHING ELSE. `expires_at` is deliberately not consulted:
 * a lapsed capability is the exact case that strands the slot forever, so refusing to revoke it
 * would leave the original defect open. The result reports which case it was; the act is identical.
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────────
 *
 * It does not delete the row, rotate the digest, reveal anything, un-consume the authorization, or
 * create a replacement. A revoked invitation is not a deleted one: the digest stays, so the lost
 * capability is now permanently bound to a row every validation path refuses.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { invitations } from "@/db/schema/invitation";
import { membershipAuthorizations } from "@/db/schema/membership-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordInvitationRevokedWithin } from "@/features/governance-audit/human-onboarding-audit.server";
import { resolveGovernanceDbOrNull, validateJustification, type GovernanceDeps } from "@/features/governance-decision/persistence.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  INVITATION_REVOKED_ACTION,
  REVOCATION_REASON_COLUMN_LENGTH,
  type InvitationRevocationRefusal,
  type InvitationRevocationResult,
} from "./contracts";

function refused(reason: InvitationRevocationRefusal): InvitationRevocationResult {
  return { status: "refused", reason };
}

/** Thrown inside the transaction when the conditional revocation matched nothing. */
class RevocationRaceLost extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Revoke ONE pending invitation, under an established Governance authority.
 *
 * On success the capability issued against it can never be spent, and the tenant/address slot the
 * invitation occupied is released so a fresh authorization can eventually produce a new one.
 */
export async function revokeInvitation(
  tenant: TenantContext | null,
  input: { readonly invitationId: string; readonly reason: string },
  deps: GovernanceDeps = {},
): Promise<InvitationRevocationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Invitation revocation is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /*
   * The reason is validated with the SAME primitive every governed human act uses, so "24 characters"
   * means one thing across the product. The column keeps the leading 128 — see
   * `REVOCATION_REASON_COLUMN_LENGTH`.
   */
  const reason = validateJustification(input?.reason);
  if (!reason) return refused("reason-required");

  /* AUTHORITY FIRST, and from one place only. */
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  const invitationId = String(input?.invitationId ?? "");
  if (!UUID_RE.test(invitationId)) return refused("invitation-unresolvable");

  try {
    /*
     * Resolved by id AND tenant together, so an invitation belonging to another tenant is
     * indistinguishable from one that never existed.
     */
    const rows = await db
      .select({
        id: invitations.id,
        tenantId: invitations.tenantId,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.tenantId, tenant.tenantId)))
      .limit(1);

    const invitation = rows[0];
    if (!invitation) return refused("invitation-unresolvable");
    /*
     * `pending` is the ONLY revocable state. An accepted invitation produced a real membership and
     * revoking it would claim to undo that; an already-revoked one has nothing left to end.
     */
    if (invitation.status !== "pending") return refused("invitation-not-revocable");

    /* Reported, never used as a gate. A lapsed invitation is exactly the case that must be revocable. */
    const wasAlreadyExpiredByClock = invitation.expiresAt.getTime() <= now.getTime();

    /*
     * PROVENANCE, READ ONLY. The authorization that produced this invitation is named in history so
     * the tenant can see which onboarding ended — and it is NOT written to. It stays `consumed`,
     * because it really did produce an invitation, and re-inviting is a new Governance decision.
     */
    const provenance = await db
      .select({ id: membershipAuthorizations.id })
      .from(membershipAuthorizations)
      .where(
        and(
          eq(membershipAuthorizations.consumedByInvitationId, invitation.id),
          eq(membershipAuthorizations.tenantId, invitation.tenantId),
        ),
      )
      .limit(1);
    const membershipAuthorizationId = provenance[0]?.id ?? null;

    let done = false;

    await db.transaction(async (tx) => {
      /*
       * THE CONDITIONAL REVOCATION. Predicated on the invitation still being pending, so a concurrent
       * revocation that got here first makes this update zero rows — and the abort below unwinds the
       * audit row with it. Same pattern as issuance's conditional consumption and acceptance's
       * conditional acceptance, which is what makes "exactly one winner" true under concurrency
       * rather than by hope.
       */
      const revoked = await tx
        .update(invitations)
        .set({
          status: "revoked",
          revokedAt: now,
          revokedByType: "human",
          revokedById: tenant.userId,
          /* `invitations_revoked_chk` requires a non-empty reason; the column is varchar(128). */
          revocationReason: reason.slice(0, REVOCATION_REASON_COLUMN_LENGTH),
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(invitations.id, invitation.id),
            eq(invitations.tenantId, tenant.tenantId),
            eq(invitations.status, "pending"),
          ),
        )
        .returning({ id: invitations.id });

      if (revoked.length === 0) throw new RevocationRaceLost();

      await recordInvitationRevokedWithin(
        tx,
        {
          action: INVITATION_REVOKED_ACTION,
          tenantId: invitation.tenantId,
          invitationId: invitation.id,
          revokedByUserId: tenant.userId,
          membershipAuthorizationId,
          wasAlreadyExpiredByClock,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        now,
      );

      done = true;
    });

    if (!done) return refused("persistence-unavailable");
    return {
      status: "revoked",
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      revokedAt: now.toISOString(),
      wasAlreadyExpiredByClock,
    };
  } catch (error) {
    if (error instanceof RevocationRaceLost) return refused("already-revoked");
    return refused("persistence-unavailable");
  }
}
