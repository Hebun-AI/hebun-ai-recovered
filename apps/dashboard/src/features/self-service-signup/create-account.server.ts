/*
 * self-service-signup/create-account.server.ts — one visitor, one transaction, one organization.
 *
 * ── THE INVARIANT THIS MODULE EXISTS TO HOLD ────────────────────────────────
 *
 *   SUCCESS means the human, their credential, their organization, its owner role and their
 *   membership ALL exist. Anything less means none of them does.
 *
 * "User created, tenant absent" is the state that would leave a real person with an account they
 * can sign into and nowhere to go, and no recovery path that any authority here owns. It is not
 * made unlikely — it is made UNREPRESENTABLE, by doing every write inside one database transaction
 * that either commits whole or leaves nothing behind.
 *
 * That is only possible because every authority involved takes a WRITER rather than a database:
 * Identity already did, Credential already did, and Tenant Provisioning was changed to, in this
 * phase, for exactly this reason.
 *
 * ── IT WRITES NOTHING ITSELF ────────────────────────────────────────────────
 *
 * No schema import, no `insert`, no table. Every row is written by the authority that owns it. If
 * this file ever needs to name a table, the design is wrong.
 *
 *   users, auth_identities        Identity authority        insertLocalIdentity
 *   auth_credentials              Credential authority      establishFirstPasswordCredential
 *   companies, roles, memberships Tenant Provisioning       provisionTenant
 *
 * ── WHAT IT CANNOT DO ───────────────────────────────────────────────────────
 *
 *   - attach the human to an EXISTING tenant (it has no parameter for one, and provisions a new one)
 *   - grant any authority outside the tenant it just created
 *   - nominate or establish Governance — a self-service tenant has no Governance authority
 *   - create a provider connection, credential or authorization
 *   - execute anything external, or reach a model
 *   - write audit_log: `actor_type`/`actor_id` are NOT NULL there and, at the instant the tenant is
 *     born, the only candidate actor does not exist yet. `provisioning_source` carries the fact.
 */
import { and, eq, isNull, sql } from "drizzle-orm";

import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { users } from "@/db/schema/user";
import { establishFirstPasswordCredential } from "@/features/auth-runtime/credential-repository.server";
import { insertLocalIdentity } from "@/features/auth-runtime/identity-repository.server";
import {
  LOCAL_IDENTITY_ISSUER,
  LOCAL_IDENTITY_PROVIDER,
  MIN_ENROLLMENT_PASSWORD_LENGTH,
  localIdentitySubject,
} from "@/features/identity-enrollment/contracts";
import {
  TENANT_PROVISIONING_SOURCE_SELF_SERVICE,
  type TenantBootstrapOutcome,
} from "@/features/tenant-provisioning/contracts";
import {
  isUniqueViolation,
  provisionTenant,
  type TenantBootstrapWriter,
} from "@/features/tenant-provisioning/provision-tenant.server";

import {
  deriveTenantSlugCandidate,
  normalizeEmail,
  normalizeName,
  validateSignupInput,
  type SignupInput,
  type SignupOutcome,
  type SignupRefusal,
} from "./contracts";

function refused(reason: SignupRefusal): SignupOutcome {
  return Object.freeze({ status: "refused" as const, reason });
}

/** Thrown to abort the transaction with a typed reason. Never escapes this module. */
class SignupAbort extends Error {
  constructor(readonly reason: SignupRefusal) {
    super(`signup aborted: ${reason}`);
    this.name = "SignupAbort";
  }
}

/**
 * Does this address already name a human?
 *
 * A COURTESY READ. `users_email_uq` is the real defense and it is global, so a losing race still
 * surfaces as a unique violation that the catch below maps to the same refusal. This read exists so
 * the common case is a clean answer rather than an integrity error, and so the visitor is told to
 * sign in before a password is ever hashed.
 *
 * Soft-deleted humans COUNT: the unique index does not exclude them, so reporting the address as
 * free would promise a write the database will refuse.
 */
async function emailIsRegistered(db: ControlPlaneDatabase, normalizedEmail: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  return rows.length > 0;
}

/**
 * Create a human, their credential, and the organization they will own.
 *
 * ── ORDER IS FORCED, NOT CHOSEN ─────────────────────────────────────────────
 *
 * The identity must exist before the credential can reference it, and before the membership can
 * name its user. The tenant must exist before its role, and the role before the membership. There
 * is exactly one valid order and it is the one below.
 *
 * ── WHY THE HASH HAPPENS INSIDE THE TRANSACTION ─────────────────────────────
 *
 * Deriving the key earlier would mean spending scrypt on a signup the slug check might still refuse,
 * and producing credential material that has nowhere legitimate to go. Holding the transaction
 * across the derivation is the honest price, and it is the same call `complete-enrollment` made.
 */
export async function createSelfServiceAccount(
  input: SignupInput,
  db: ControlPlaneDatabase | null = getControlPlaneDb(),
): Promise<SignupOutcome> {
  const invalid = validateSignupInput(input, MIN_ENROLLMENT_PASSWORD_LENGTH);
  if (invalid !== null) return refused(invalid);

  /*
   * FAIL CLOSED. No database means no account — never a partially-created one, and never an
   * optimistic success the visitor would discover was false at their first sign-in.
   */
  if (db === null) return refused("persistence-unavailable");

  const normalizedEmail = normalizeEmail(input.email);
  const organizationName = normalizeName(input.organizationName);
  const slug = deriveTenantSlugCandidate(organizationName);
  /* `validateSignupInput` already refused a name that derives to nothing; this satisfies the type. */
  if (slug === null) return refused("invalid-organization-name");

  const now = new Date();

  try {
    if (await emailIsRegistered(db, normalizedEmail)) return refused("email-already-registered");

    const account = await db.transaction(async (tx) => {
      /* IDENTITY AUTHORITY creates the human. This module never touches users/auth_identities. */
      const identity = await insertLocalIdentity(tx, {
        normalizedEmail,
        provider: LOCAL_IDENTITY_PROVIDER,
        issuer: LOCAL_IDENTITY_ISSUER,
        subject: localIdentitySubject(normalizedEmail),
        verifiedAt: now,
        /*
         * The human performed this act themselves. Unlike a possession-bootstrapped human — where
         * claiming self-creation was a documented G5A defect — a visitor filling in this form really
         * is the actor, so the attribution is true.
         */
        createdByType: "human",
      });

      /*
       * CREDENTIAL AUTHORITY hashes AND persists the secret. The plaintext goes in, an id comes
       * back, and no derived material ever exists in this module — which is what keeps the stored
       * secret confined to the files D1 permits to name it.
       */
      await establishFirstPasswordCredential(tx, identity.authIdentityId, input.password, now);

      /*
       * TENANT PROVISIONING AUTHORITY creates the organization, its owner role and the membership.
       * The SAME authority the operator ceremony calls — there is no second implementation.
       *
       * The provenance is a LITERAL supplied here. It is not a parameter of `SignupInput`, so no
       * browser field can reach it and no caller can claim a ceremony root it did not have.
       */
      const outcome: TenantBootstrapOutcome = await provisionTenant(
        tx as unknown as TenantBootstrapWriter,
        {
          slug,
          displayName: organizationName,
          userId: identity.userId,
          provisioningSource: TENANT_PROVISIONING_SOURCE_SELF_SERVICE,
        },
      );

      /*
       * A REFUSAL MUST UNWIND THE HUMAN. The tenant authority returns rather than throws, precisely
       * so its two callers can differ here: the CLI reports and stops, because nothing else was
       * written; signup MUST abort, because the identity and credential above would otherwise
       * commit into a world with no organization to belong to.
       */
      if (outcome.status === "refused") {
        throw new SignupAbort(
          outcome.reason === "slug-already-taken"
            ? "organization-name-unavailable"
            : "invalid-organization-name",
        );
      }

      /*
       * THE HUMAN'S OWN NAME, written by the authority that owns `users`.
       *
       * `insertLocalIdentity` deliberately takes only the email — it is the identity authority's
       * minimal shape and widening its parameters is not this phase's call. The name is therefore
       * set here, in the same transaction, predicated on the row just created AND on its name still
       * being unset, so this statement can never overwrite an existing human's name.
       *
       * `name` and not `display_name`: the released label expression is
       * `coalesce(display_name, name, email)`, so writing the base column is what makes a human read
       * as their own name, and leaves the S5 override free for whatever later phase owns it.
       */
      await tx
        .update(users)
        .set({ name: normalizeName(input.fullName), updatedAt: sql`now()` })
        .where(and(eq(users.id, identity.userId), isNull(users.name)));

      return {
        userId: identity.userId,
        authIdentityId: identity.authIdentityId,
        tenantId: outcome.tenant.tenantId,
        membershipId: outcome.tenant.membershipId,
        roleId: outcome.tenant.roleId,
        normalizedEmail,
        organizationName,
      };
    });

    return Object.freeze({ status: "created" as const, account: Object.freeze(account) });
  } catch (error) {
    if (error instanceof SignupAbort) return refused(error.reason);
    /*
     * A lost race on `users_email_uq` or `companies_slug_uq`. Both are the database deciding
     * something the courtesy reads could not, both roll the whole transaction back, and both have an
     * honest refusal. The email unique is checked first because it is the one a visitor can act on.
     */
    if (isUniqueViolation(error)) {
      return refused(
        /* The constraint name travels on the driver error's `cause`; `isUniqueViolation` already
         * walked the chain, so this only has to distinguish WHICH unique lost. */
        JSON.stringify(error).includes("companies_slug")
          ? "organization-name-unavailable"
          : "email-already-registered",
      );
    }
    /*
     * ANYTHING ELSE IS NOT TRANSLATED INTO A FRIENDLY LIE. The transaction rolled back, so nothing
     * partial survives, and the visitor is told setup did not complete rather than that their input
     * was wrong.
     */
    return refused("persistence-unavailable");
  }
}
