/*
 * identity-enrollment/start-enrollment.server.ts — ACT 1, turning KEY 1 (I1.2).
 *
 * A bearer presents an invitation capability. This act records that a submission happened, and
 * NOTHING ELSE. It creates no `users` row, no `auth_identity`, no credential, no session and no
 * membership; it marks nobody verified; and it stores no password, no hash and no salt.
 *
 * WHY IT CREATES NOTHING GLOBAL. `users_email_uq` and `auth_identities_provider_issuer_subject_uq`
 * are both NON-partial, both tables are soft-delete only, and a revoked identity keeps its row. So a
 * `pending` identity created here and refused at Act 2 would permanently burn the intended human's
 * email address and local subject — a stolen invitation would harm the very person the second key
 * exists to protect. Creating nothing global before approval is the design, not a precaution.
 *
 * WHAT IT DELIBERATELY DOES NOT INFER. Possession of the capability proves possession of the
 * capability. It does not prove the bearer controls the invited address — Hebun has no mail runtime
 * and delivered nothing — and this module never treats it as if it did.
 *
 * NO AUDIT ROW. The submitter is unauthenticated, and `audit_log.actor_type` / `actor_id` are both
 * NOT NULL: there is no honest actor to name. `GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts`
 * is `false` by doctrine, and inventing a system actor would put a claim in a tenant's ledger that
 * no human made. The enrollment row itself, with `submitted_at`, is the durable evidence.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { identityEnrollmentRequests } from "@/db/schema/identity-enrollment";
import { invitations } from "@/db/schema/invitation";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";
import {
  isEmailClaimed,
  isTenantOnboardingEligible,
} from "@/features/auth-runtime/identity-repository.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import {
  digestContinuationReference,
  digestInvitationToken,
  generateContinuationReference,
} from "./enrollment-digest.server";
import type { EnrollmentStartRefusal, EnrollmentStartResult } from "./contracts";

/**
 * Dependencies an unauthenticated act needs. `digestKey` is supplied by the caller because reading
 * the environment is a request concern; nothing here reads `process.env` for a secret.
 */
export interface EnrollmentDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly digestKey: AuthenticationDigestKey;
  /** Test seam only: forces a known continuation reference so a digest can be asserted. */
  readonly mintContinuation?: () => string;
}

function refused(reason: EnrollmentStartRefusal): EnrollmentStartResult {
  return { status: "refused", reason };
}

/**
 * Begin ONE enrollment ceremony.
 *
 * The client supplies exactly one thing: the raw invitation capability. It cannot supply the tenant,
 * the email, the role, the status, the time, or the enrollment id — every one of those is read from
 * the invitation row or generated server-side.
 */
export async function startIdentityEnrollment(
  input: { readonly capability: string },
  deps: EnrollmentDeps,
): Promise<EnrollmentStartResult> {
  if (typeof window !== "undefined") {
    throw new Error("Identity enrollment is server-only.");
  }

  const capability = typeof input?.capability === "string" ? input.capability.trim() : "";
  if (!capability) return refused("capability-unrecognized");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    /*
     * LOOKUP IS BY DIGEST, NEVER BY ID. `invitations_token_hash_uq` is global, so a matching digest
     * names at most one row, and a bearer who does not hold the secret cannot enumerate invitations
     * by guessing identifiers.
     */
    const tokenHash = digestInvitationToken(capability, deps.digestKey);
    const invitationRows = await db
      .select({
        id: invitations.id,
        tenantId: invitations.tenantId,
        normalizedEmail: invitations.normalizedEmail,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    const invitation = invitationRows[0];
    if (!invitation) return refused("capability-unrecognized");

    /*
     * USABILITY IS A PREDICATE, NOT A STATUS READ. `invitation_status` has an `expired` value that
     * nothing writes, so trusting `status = 'pending'` alone would accept a lapsed capability.
     * Expiry is compared against the clock, every time.
     */
    if (invitation.status !== "pending" || invitation.expiresAt.getTime() <= now.getTime()) {
      return refused("capability-not-usable");
    }

    /*
     * R4B — THE TENANT MUST BE ACCEPTING ACTIVITY. Checked BEFORE the enrollment row is written, so a
     * refusal costs no durable state at all.
     *
     * This flow resolves its tenant from the invitation, never from a session, so none of the four
     * session gates ever ran for it. Until R4B a bearer holding a live invitation into a suspended
     * tenant could start a ceremony there, and later finish it into a real identity and membership.
     *
     * `capability-not-usable` is REUSED rather than joined by a new reason, and that is a security
     * choice as much as a contract one: this act is unauthenticated, and a distinguishable
     * "the tenant is suspended" would tell an unknown bearer something true about an organization
     * they have not yet proved any relationship to. The module's own doctrine already collapses
     * expired, revoked and already-accepted for the same reason.
     */
    if (!(await isTenantOnboardingEligible(db, invitation.tenantId))) {
      return refused("capability-not-usable");
    }

    /*
     * I1.2 BOOTSTRAPS NEW HUMANS ONLY. If someone already exists at this address, creating a second
     * identity is impossible (`users_email_uq`) and would be wrong anyway: that human needs a
     * membership, which is I2's existing-human path. Refuse here so the failure is a sentence rather
     * than a constraint violation three acts later.
     */
    if (await isEmailClaimed(db, invitation.normalizedEmail)) {
      return refused("already-enrolled");
    }

    const continuationReference = (deps.mintContinuation ?? generateContinuationReference)();
    const continuationHash = digestContinuationReference(continuationReference, deps.digestKey);

    const inserted = await db
      .insert(identityEnrollmentRequests)
      .values({
        tenantId: invitation.tenantId,
        invitationId: invitation.id,
        continuationHash,
        continuationVersion: deps.digestKey.version,
        status: "pending",
        submittedAt: now,
      })
      .returning({ id: identityEnrollmentRequests.id });

    return {
      status: "started",
      enrollmentId: inserted[0]!.id,
      continuationReference,
      submittedAt: now.toISOString(),
    };
  } catch (error) {
    /*
     * LOSING THE RACE IS NOT AN OUTAGE. Two concurrent submissions against one invitation both pass
     * every read above; the partial unique index is what actually stops the second, and the loser
     * deserves the true reason. Matched on the Postgres code AND the constraint name so an unrelated
     * conflict cannot borrow it.
     */
    if (
      isUniqueViolation(error, "identity_enrollment_requests_one_live_per_invitation_uq")
    ) {
      return refused("enrollment-already-started");
    }
    return refused("persistence-unavailable");
  }
}

/**
 * Read one ceremony for the Governance authority that must decide it.
 *
 * Tenant-scoped by predicate, and it returns identity and timing only — never the continuation
 * digest, never the invited address. The approver needs to know THAT a submission arrived and WHEN,
 * so they can correlate it with the handover they performed out of band.
 */
export async function readPendingEnrollment(
  db: ControlPlaneDatabase,
  tenantId: string,
  enrollmentId: string,
): Promise<
  | {
      readonly enrollmentId: string;
      readonly invitationId: string;
      readonly submittedAt: Date;
    }
  | undefined
> {
  const rows = await db
    .select({
      enrollmentId: identityEnrollmentRequests.id,
      invitationId: identityEnrollmentRequests.invitationId,
      submittedAt: identityEnrollmentRequests.submittedAt,
    })
    .from(identityEnrollmentRequests)
    .where(
      and(
        eq(identityEnrollmentRequests.id, enrollmentId),
        eq(identityEnrollmentRequests.tenantId, tenantId),
        eq(identityEnrollmentRequests.status, "pending"),
      ),
    )
    .limit(1);
  return rows[0];
}

/** True when the value is a syntactically possible uuid. Cheap gate before a uuid-typed query. */
export function looksLikeUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Narrow a thrown value to a Postgres unique violation on one named constraint. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23505" && candidate.constraint === constraint) return true;
  return candidate.cause ? isUniqueViolation(candidate.cause, constraint) : false;
}

/** Narrow a thrown value to ANY Postgres unique violation, whatever the constraint. */
export function isAnyUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23505") return true;
  return candidate.cause ? isAnyUniqueViolation(candidate.cause) : false;
}
