/*
 * Bootstrap credential recovery (G5A.1) — the core, separated from the CLI so a real database can
 * prove its semantics without driving an interactive prompt.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * G5A can give an empty production deployment its first human. It closed with one operational gap:
 * if that human loses their password BEFORE tenant zero exists, nothing can help them.
 * `auth:dev-credential` is local-only by design, enrollment needs an invitation that needs a
 * tenant, and there is no product surface to reset anything because there is no organization yet.
 * The human would exist, hold the only copy of their email address, and be permanently unable to
 * sign in — with no way forward except deleting production.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 * Not a password reset. Not account recovery. Not an admin capability. Not a tenant administrator
 * capability. It cannot choose whom it acts on, and it stops existing the moment an organization
 * does. It is one escape hatch for one human during one window, and the window is not a policy —
 * it is a database state.
 *
 * ── THE BOOTSTRAP WINDOW, AND WHY IT IS TWO PREDICATES ───────────────────────
 *
 * The window is:
 *
 *     exactly one row in `users`   AND   zero rows in `companies`
 *
 * and that is the WHOLE condition, because the second predicate implies every other thing the
 * window is supposed to exclude. Measured, not assumed: 44 tables carry a NOT NULL foreign key to
 * `companies`, and they include `roles`, `memberships`, `invitations`,
 * `membership_authorizations`, `genesis_nominations`, `governance_sessions`, `decision_records`
 * and `identity_enrollment_requests`. **Zero companies therefore means zero organizational state of
 * any kind**, enforced by referential integrity rather than by this module remembering to check a
 * list. A test re-derives that implication from the live catalogue, so a future table that escapes
 * it fails the build instead of silently widening the window.
 *
 * `users = 1` is the other half, and it is doing two jobs: it proves the bootstrap human exists,
 * and it makes "which human" unanswerable in any way other than "the only one". There is no email
 * parameter and no id parameter, so arbitrary targeting is not forbidden — it is unrepresentable.
 *
 * The ONE exception to the implication is `user_session_contexts`, whose `active_tenant_id` is
 * nullable so a signed-in human can belong nowhere. That is exactly the state G5A leaves behind and
 * it is not organizational authority, so it correctly does not close the window.
 *
 * ── THE CLOSURE CONDITION, STATED ONCE ───────────────────────────────────────
 *
 * **The moment the first company row exists, this ceremony refuses forever.** Not "warns", not
 * "requires a flag" — refuses, on every subsequent run, with no configuration that can reopen it.
 * There is no environment variable, no override argument and no force mode anywhere in this phase.
 * Tenant provisioning is therefore the event that permanently retires this capability.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ───────────────────────────────────────────
 *
 *   - create a human, an identity, a company, a role, a membership, an invitation, a Governance
 *     decision or a genesis nomination
 *   - change an email, an identity provider, an issuer or a subject
 *   - act on any human but the single one the database resolves
 *   - leave two active password credentials, or none
 *   - name an actor: `revoked_by_id` and `revoked_by_type` stay NULL together
 *   - write `audit_log` — `actor_id` and `actor_type` are NOT NULL there and possession has no
 *     actor to name, exactly as R4A, G2.1, R5.1, G4 and G5A each concluded
 *   - hash anything: all cryptography stays inside Credential authority
 */
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import { replacePasswordCredential } from "../../src/features/auth-runtime/credential-repository.server";
import { MIN_ENROLLMENT_PASSWORD_LENGTH } from "../../src/features/identity-enrollment/contracts";

/** The product's own floor. A recovery password is a password. */
export const MIN_RECOVERY_PASSWORD_LENGTH = MIN_ENROLLMENT_PASSWORD_LENGTH;

/**
 * The reason written onto the revoked row.
 *
 * `auth_credentials_revoked_chk` requires a non-blank reason, so this string is not decoration — it
 * is the only durable record of WHY the previous credential stopped working, and it names the
 * ceremony rather than a person because no person is known.
 */
export const RECOVERY_REVOCATION_REASON =
  "replaced by the bootstrap credential recovery ceremony (pre-tenant window)";

/**
 * The lock this ceremony takes, and why it is not stronger.
 *
 * `share row exclusive` self-conflicts, so two recoveries serialize, and conflicts with the
 * `row exclusive` that both the revoke and the insert take. It leaves `access share` readers alone,
 * so a sign-in attempt reading the credential is never blocked by a recovery in flight.
 */
export const RECOVERY_LOCK_MODE = "share row exclusive";

export interface BootstrapHuman {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly email: string;
}

export type RecoveryRefusal =
  /** The password is shorter than the product's own floor. Nothing was read. */
  | "password-too-short"
  /** No human exists. There is nobody to recover. */
  | "no-bootstrap-human"
  /** More than one human exists. "The bootstrap human" is no longer a well-defined phrase. */
  | "not-a-single-human"
  /** The single human holds no active local identity, so there is no password to replace. */
  | "no-local-identity"
  /** An organization exists. The bootstrap window is closed, permanently. */
  | "bootstrap-window-closed"
  /** The operator's confirmation did not match the human the database resolved. */
  | "confirmation-mismatch";

export interface RecoveryEligibility {
  readonly eligible: boolean;
  readonly reason?: RecoveryRefusal;
  readonly human?: BootstrapHuman;
  readonly humanCount: number;
  readonly companyCount: number;
}

interface CountRow {
  readonly users: number;
  readonly companies: number;
}

/**
 * Resolve the window and, if it is open, the single human inside it.
 *
 * READ ONLY — two selects, no transaction of its own. Safe for a preflight to call, and called
 * AGAIN inside the locked transaction below, because a report is not a guarantee.
 */
export async function resolveRecoveryEligibility(
  reader: Pick<ControlPlaneDatabase, "execute">,
): Promise<RecoveryEligibility> {
  const counts = (await reader.execute(
    "select (select count(*)::int from users) as users, (select count(*)::int from companies) as companies",
  )) as unknown as { rows: CountRow[] };
  const humanCount = Number(counts.rows[0]?.users ?? 0);
  const companyCount = Number(counts.rows[0]?.companies ?? 0);

  /*
   * WINDOW FIRST. A closed window is reported as closed even when the human count is also wrong,
   * because "an organization exists" is the permanent answer and the more important one to see.
   */
  if (companyCount > 0) {
    return { eligible: false, reason: "bootstrap-window-closed", humanCount, companyCount };
  }
  if (humanCount === 0) {
    return { eligible: false, reason: "no-bootstrap-human", humanCount, companyCount };
  }
  if (humanCount > 1) {
    return { eligible: false, reason: "not-a-single-human", humanCount, companyCount };
  }

  /*
   * THE HUMAN IS RESOLVED, NEVER SELECTED. No predicate on this query comes from a caller: it reads
   * the only row there is. The same active-identity shape D1.1 and R4A already use.
   */
  const resolved = (await reader.execute(
    `select u.id as user_id, u.email as email, i.id as auth_identity_id
       from users u
       join auth_identities i on i.user_id = u.id
      where u.lifecycle_status = 'active'
        and i.status = 'active'
        and i.lifecycle_status = 'active'
        and i.revoked_at is null
      order by i.created_at asc
      limit 1`,
  )) as unknown as { rows: { user_id: string; email: string; auth_identity_id: string }[] };

  const row = resolved.rows[0];
  if (!row) {
    return { eligible: false, reason: "no-local-identity", humanCount, companyCount };
  }

  return {
    eligible: true,
    human: { userId: row.user_id, authIdentityId: row.auth_identity_id, email: row.email },
    humanCount,
    companyCount,
  };
}

export interface RecoverBootstrapCredentialInput {
  readonly password: string;
  /**
   * An OPERATOR SAFETY CHECK, never a selector.
   *
   * When present it must equal the email the database already resolved. It cannot choose a
   * different human, because the resolution above reads the only row that exists and never consults
   * this value. Its whole job is to let an operator discover they are pointed at the wrong
   * deployment before they change a password on it.
   */
  readonly confirmEmail?: string;
}

export type RecoveryOutcome =
  | {
      readonly status: "recovered";
      readonly human: BootstrapHuman;
      readonly credentialId: string;
      /** How many active credentials were revoked. Zero when the human had none. */
      readonly revokedCount: number;
    }
  | { readonly status: "refused"; readonly reason: RecoveryRefusal; readonly detail?: string };

/**
 * The whole ceremony, in ONE transaction.
 *
 *   1. validate the password against the product's floor  (refuse before anything is read)
 *   2. lock `auth_credentials`                            (serialize against a concurrent recovery)
 *   3. re-resolve the window AND the human                (the guarantee; the preflight was a report)
 *   4. check the operator's confirmation, if given
 *   5. Credential authority revokes the old and writes the new, both inside this transaction
 *
 * Any failure rolls back all of it. There is no committed state in which the bootstrap human holds
 * no usable credential because a recovery failed halfway, and none in which two are active.
 */
export async function recoverBootstrapCredential(
  db: ControlPlaneDatabase,
  input: RecoverBootstrapCredentialInput,
  now: Date = new Date(),
): Promise<RecoveryOutcome> {
  if (
    typeof input.password !== "string" ||
    input.password.length < MIN_RECOVERY_PASSWORD_LENGTH
  ) {
    return { status: "refused", reason: "password-too-short" };
  }

  return db.transaction(async (tx) => {
    await tx.execute(`lock table auth_credentials in ${RECOVERY_LOCK_MODE} mode`);

    const eligibility = await resolveRecoveryEligibility(tx);
    if (!eligibility.eligible || !eligibility.human) {
      return { status: "refused" as const, reason: eligibility.reason! };
    }
    const human = eligibility.human;

    if (input.confirmEmail !== undefined) {
      const typed = input.confirmEmail.trim().toLowerCase();
      if (typed !== human.email.trim().toLowerCase()) {
        return { status: "refused" as const, reason: "confirmation-mismatch" as const };
      }
    }

    /*
     * CREDENTIAL AUTHORITY owns both statements. This module passes a plaintext in and receives ids
     * out; no salt, no derived key and no SQL of its own ever touches the secret.
     */
    const { revokedCount, credentialId } = await replacePasswordCredential(
      tx,
      human.authIdentityId,
      input.password,
      RECOVERY_REVOCATION_REASON,
      now,
    );

    return { status: "recovered" as const, human, credentialId, revokedCount };
  });
}
