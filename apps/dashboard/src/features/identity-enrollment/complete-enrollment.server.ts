/*
 * identity-enrollment/complete-enrollment.server.ts — ACT 3, the ceremony completing (I1.2).
 *
 * BOTH KEYS ARE REQUIRED HERE, AND BOTH ARE CHECKED. The bearer must present the invitation
 * capability AND the continuation reference minted at Act 1, and the ceremony must already be
 * `approved`. Requiring the continuation reference is what makes the second key an approval OF THAT
 * SUBMISSION rather than of whoever next turns up holding the invitation.
 *
 * MODEL C — THE SECRET ARRIVES LAST. The password is supplied only now, after approval. It is passed
 * straight to Credential authority's hasher and never written anywhere else: not to the enrollment
 * row, not to the decision, not to audit, not to a log. There is no pending-credential state to
 * clean up because there was never a moment when a credential existed without an identity.
 *
 * WHAT COMMITS TOGETHER, AND WHY IT MUST. The `users` row, the `auth_identity`, the first credential
 * and the ceremony's completion are ONE transaction. A failure during credential establishment must
 * not leave a ceremony that claims success, and must not leave an active identity with no usable
 * credential — the human would then exist, be unable to sign in, and hold the only email slot that
 * would have let them try again.
 *
 * WHO OWNS WHAT. Identity authority creates the human (`insertLocalIdentity`); Credential authority
 * BOTH hashes and persists the secret (`establishFirstPasswordCredential`). This module orchestrates
 * and owns neither, and deliberately never holds derived credential material: it passes a plaintext
 * string into the authority and receives an id back, so `salt` and the derived key never cross this
 * boundary. The development-only credential tooling under `scripts/` is not imported, not
 * referenced, and its raw SQL is not duplicated — it stays quarantined, and reusing the production
 * primitive never approaches it.
 *
 * WHAT THIS ACT STILL DOES NOT DO. No membership, no session, no role, no Governance grant. The
 * human ends this act able to prove who they are and belonging nowhere.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { identityEnrollmentRequests } from "@/db/schema/identity-enrollment";
import { invitations } from "@/db/schema/invitation";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";
import { establishFirstPasswordCredential } from "@/features/auth-runtime/credential-repository.server";
import {
  insertLocalIdentity,
  isTenantOnboardingEligible,
} from "@/features/auth-runtime/identity-repository.server";
import { recordEnrollmentCompletionWithin } from "@/features/governance-audit/identity-enrollment-audit.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import {
  IDENTITY_ENROLLMENT_COMPLETED_ACTION,
  LOCAL_IDENTITY_ISSUER,
  LOCAL_IDENTITY_PROVIDER,
  MIN_ENROLLMENT_PASSWORD_LENGTH,
  localIdentitySubject,
  type EnrollmentCompletionRefusal,
  type EnrollmentCompletionResult,
} from "./contracts";
import {
  digestContinuationReference,
  digestInvitationToken,
  timingSafeEqualHex,
} from "./enrollment-digest.server";
import { isAnyUniqueViolation } from "./start-enrollment.server";

export interface EnrollmentCompletionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly digestKey: AuthenticationDigestKey;
}

function refused(reason: EnrollmentCompletionRefusal): EnrollmentCompletionResult {
  return { status: "refused", reason };
}

/** Thrown inside the transaction when the conditional completion matched nothing. */
class CompletionRaceLost extends Error {}

/**
 * Complete ONE approved enrollment ceremony.
 *
 * The client supplies three things: the invitation capability, the continuation reference, and a
 * password. It cannot supply the tenant, the email, the identity coordinates, the status, the
 * verification timestamp, or the time.
 */
export async function completeIdentityEnrollment(
  input: {
    readonly capability: string;
    readonly continuationReference: string;
    readonly password: string;
  },
  deps: EnrollmentCompletionDeps,
): Promise<EnrollmentCompletionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Identity enrollment is server-only.");
  }

  const capability = typeof input?.capability === "string" ? input.capability.trim() : "";
  const continuation =
    typeof input?.continuationReference === "string" ? input.continuationReference.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!capability || !continuation) return refused("continuation-unrecognized");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    /* KEY 1 continuity: the ceremony is found by its continuation digest, never by id. */
    const continuationHash = digestContinuationReference(continuation, deps.digestKey);
    const rows = await db
      .select({
        id: identityEnrollmentRequests.id,
        tenantId: identityEnrollmentRequests.tenantId,
        invitationId: identityEnrollmentRequests.invitationId,
        status: identityEnrollmentRequests.status,
        invitationTokenHash: invitations.tokenHash,
        invitationStatus: invitations.status,
        invitationExpiresAt: invitations.expiresAt,
        normalizedEmail: invitations.normalizedEmail,
      })
      .from(identityEnrollmentRequests)
      .innerJoin(invitations, eq(invitations.id, identityEnrollmentRequests.invitationId))
      .where(eq(identityEnrollmentRequests.continuationHash, continuationHash))
      .limit(1);

    const enrollment = rows[0];
    if (!enrollment) return refused("continuation-unrecognized");

    /*
     * The presented capability must be the SAME invitation this ceremony was started against.
     * Compared in constant time, so a near-miss cannot be distinguished from a wild guess.
     */
    const presentedTokenHash = digestInvitationToken(capability, deps.digestKey);
    if (!timingSafeEqualHex(presentedTokenHash, enrollment.invitationTokenHash.trim())) {
      return refused("continuation-unrecognized");
    }

    /* KEY 2 must already have been turned. Pending, rejected and completed all refuse here. */
    if (enrollment.status !== "approved") return refused("enrollment-not-approved");

    /* The capability may have lapsed between approval and completion. Predicate, not status read. */
    if (
      enrollment.invitationStatus !== "pending" ||
      enrollment.invitationExpiresAt.getTime() <= now.getTime()
    ) {
      return refused("capability-not-usable");
    }

    /*
     * R4B — THE TENANT MUST BE ACCEPTING ACTIVITY. Checked BEFORE the transaction opens, so a refusal
     * creates no user, no identity and no credential.
     *
     * This is the act R4B most needed to close. A tenant can be suspended in the window between an
     * approved ceremony and its completion, and until now nothing looked: the ceremony row carries
     * the tenant, but no gate ever read that tenant's state. The enrollment row itself is left exactly
     * as it is — it stays `approved` and remains completable once the tenant is active again, because
     * a suspension is a pause, not a rejection of the human.
     *
     * `capability-not-usable` is reused for the same reason `start-enrollment` reuses it: this act is
     * unauthenticated, and the module already collapses lapsed/revoked into one reason so a bearer
     * learns nothing about an organization from a refusal.
     */
    if (!(await isTenantOnboardingEligible(db, enrollment.tenantId))) {
      return refused("capability-not-usable");
    }

    /*
     * POLICY LIVES HERE, NOT IN CREDENTIAL AUTHORITY. `insertPasswordCredential` is a persistence
     * primitive and performs no strength check by design; the caller is the one that knows which act
     * is being performed.
     */
    if (password.length < MIN_ENROLLMENT_PASSWORD_LENGTH) {
      return refused("password-unacceptable");
    }

    let established: { userId: string; authIdentityId: string } | null = null;

    await db.transaction(async (tx) => {
      /* IDENTITY AUTHORITY creates the human. This module never inserts into users/auth_identities. */
      const identity = await insertLocalIdentity(tx, {
        normalizedEmail: enrollment.normalizedEmail,
        provider: LOCAL_IDENTITY_PROVIDER,
        issuer: LOCAL_IDENTITY_ISSUER,
        subject: localIdentitySubject(enrollment.normalizedEmail),
        verifiedAt: now,
        createdByType: "human",
      });

      /*
       * CREDENTIAL AUTHORITY hashes AND persists the secret. The plaintext goes in, an id comes
       * back, and no derived material ever exists in this module — which is what keeps the stored
       * secret confined to the three files D1 permits to name it.
       *
       * The scrypt derivation happens inside the transaction. That is deliberate: doing it earlier
       * would mean deriving a key for a ceremony that the conditional completion below might refuse,
       * and the cost of holding the transaction is the honest price of never producing credential
       * material that has nowhere legitimate to go.
       */
      await establishFirstPasswordCredential(tx, identity.authIdentityId, password, now);

      /*
       * THE CONDITIONAL COMPLETION. Predicated on the ceremony still being approved, so a concurrent
       * completion that got here first makes this update zero rows — and the abort unwinds the
       * identity and the credential with it. This is what makes retry safe: a completed ceremony
       * matches nothing and refuses rather than creating a second human.
       */
      const completed = await tx
        .update(identityEnrollmentRequests)
        .set({
          status: "completed",
          completedAt: now,
          enrolledAuthIdentityId: identity.authIdentityId,
          updatedAt: now,
          updatedBy: identity.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(identityEnrollmentRequests.id, enrollment.id),
            eq(identityEnrollmentRequests.status, "approved"),
          ),
        )
        .returning({ id: identityEnrollmentRequests.id });

      if (completed.length === 0) throw new CompletionRaceLost();

      /*
       * HISTORY, IN THE SAME TRANSACTION, THROUGH ITS OWNING WRITER. The shared sink has declared
       * owners under `governance-audit/`, and an ordinary feature module may never reach it
       * directly — a structural test enforces that. The actor is the human who just came into
       * existence: their `users.id` is real by this point and the event is genuinely about them.
       */
      await recordEnrollmentCompletionWithin(
        tx,
        {
          action: IDENTITY_ENROLLMENT_COMPLETED_ACTION,
          tenantId: enrollment.tenantId,
          enrollmentId: enrollment.id,
          invitationId: enrollment.invitationId,
          enrolledUserId: identity.userId,
          enrolledAuthIdentityId: identity.authIdentityId,
          identityProvider: LOCAL_IDENTITY_PROVIDER,
        },
        now,
      );

      established = identity;
    });

    if (!established) return refused("persistence-unavailable");
    const outcome = established as { userId: string; authIdentityId: string };
    return {
      status: "completed",
      enrollmentId: enrollment.id,
      userId: outcome.userId,
      authIdentityId: outcome.authIdentityId,
      completedAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof CompletionRaceLost) return refused("enrollment-not-approved");
    /*
     * Somebody claimed the address or the local subject first — `users_email_uq`,
     * `auth_identities_provider_issuer_subject_uq`, or the ceremony's own identity uniqueness. All
     * mean the same thing to the bearer and all deserve the same honest sentence.
     */
    if (isAnyUniqueViolation(error)) return refused("already-enrolled");
    return refused("persistence-unavailable");
  }
}
