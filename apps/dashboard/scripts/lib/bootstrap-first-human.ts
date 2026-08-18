/*
 * First-human bootstrap (G5A) — the core, separated from the CLI so a real database can prove its
 * semantics without driving an interactive prompt.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * The act that gives an empty production deployment its first person. Until now every path to a
 * `users` row ran through enrollment, and enrollment needs an invitation, which needs a role, which
 * needs a tenant — and `tenant:provision` refuses to create a human. Production therefore had no
 * first human and no way to get one.
 *
 * ── WHAT IT IS NOT: IT IS NOT AN IDENTITY WRITER ─────────────────────────────
 *
 * This module contains **no INSERT of any kind**. It orchestrates two existing authorities inside
 * one transaction and owns neither:
 *
 *   `insertLocalIdentity`              Identity authority — the sole writer of `users` and
 *                                      `auth_identities`, whose own header says it does not decide
 *                                      whether the human MAY be created: that is the caller's
 *                                      authority to have established.
 *   `establishFirstPasswordCredential` Credential authority — hashes AND persists, so the plaintext
 *                                      goes in and an id comes out, and no derived material ever
 *                                      exists in this file.
 *
 * That is the whole design. Deployment possession supplies the authorization those writers
 * deliberately refuse to decide; it does not supply a second implementation of what they do. A test
 * asserts this file contains no `insert`, no `values`, and no credential column name.
 *
 * ── ONE-SHOT, AND WHY THE LOCK IS WHAT IT IS ─────────────────────────────────
 *
 * "First" is the whole authorization. If any human already exists, this ceremony has no business
 * running, and it refuses — including when the existing human has a *different* email.
 * `users_email_uq` is not the guard: it prevents the same address twice and would happily admit a
 * second, different first human.
 *
 * The check is therefore taken INSIDE the transaction, after a table lock. Without the lock two
 * concurrent ceremonies both read zero and both insert, and the unique index does not save you
 * because the emails differ.
 *
 * `SHARE ROW EXCLUSIVE` is the narrowest level that works. It self-conflicts, so two ceremonies
 * serialize; it conflicts with `ROW EXCLUSIVE`, which is what `INSERT` takes, so no other writer can
 * add a user between the check and the insert. It does NOT conflict with `ACCESS SHARE`, so ordinary
 * reads — a sign-in attempt, a session lookup — are never blocked by a bootstrap. `EXCLUSIVE` would
 * also work and would additionally block `SELECT ... FOR UPDATE` for no benefit here.
 *
 * There is no rotation, no update, no reset, and no "re-run to fix it". A second run refuses and
 * changes nothing.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ───────────────────────────────────────────
 *
 *   - create a company, role, membership, invitation, Governance decision or Genesis nomination
 *   - mint a session, a cookie, or any capability
 *   - touch providers, Knowledge, Memory, actions or artifacts
 *   - write `audit_log` — `actor_id` and `actor_type` are both NOT NULL there, and a terminal has
 *     no actor to name. Silence, exactly as R4A and G2.1 chose
 *   - name an actor on the rows it does create: `created_by` and `created_by_type` stay NULL
 *     together, because possession is a SOURCE and never an ACTOR
 *   - accept a tenant, a role, a provenance value, or an actor as input — none of those has a
 *     parameter to arrive in
 *
 * ── PROVENANCE, HONESTLY ─────────────────────────────────────────────────────
 *
 * The released schema has no `users.*_source` column, so this row cannot record WHICH root created
 * it. That is a limitation, not a licence to invent one: silence writes nothing false, while a
 * fabricated actor or a borrowed tenant vocabulary would. G1 widened provenance for `companies` and
 * `genesis_nominations` because those rows had a lie to avoid; this row does not.
 */
/*
 * Relative imports, not the `@/` alias: `tsconfig.json` maps `@/*` only for the application build,
 * and every other ceremony under `scripts/` reaches into `src/` this way. The direction is the
 * allowed one — `scripts/` may read `src/`, never the reverse.
 */
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import { establishFirstPasswordCredential } from "../../src/features/auth-runtime/credential-repository.server";
import { insertLocalIdentity } from "../../src/features/auth-runtime/identity-repository.server";
import {
  LOCAL_IDENTITY_ISSUER,
  LOCAL_IDENTITY_PROVIDER,
  MIN_ENROLLMENT_PASSWORD_LENGTH,
  NORMALIZED_EMAIL_MAX_LENGTH,
  localIdentitySubject,
} from "../../src/features/identity-enrollment/contracts";

/**
 * The password floor, taken from the product's own enrollment contract rather than restated.
 *
 * A bootstrap human signs in through the same `/login` as everybody else, so a different floor here
 * would be a second password policy for the most privileged account in the deployment.
 */
export const MIN_BOOTSTRAP_PASSWORD_LENGTH = MIN_ENROLLMENT_PASSWORD_LENGTH;

/**
 * The lock this ceremony takes on `users`, and the reason it is not stronger.
 *
 * Exported so a test can pin it: the concurrency guarantee lives in this string, and a later edit
 * that weakened it to `ROW EXCLUSIVE` would silently allow two first humans.
 */
export const FIRST_HUMAN_LOCK_MODE = "share row exclusive";

export interface BootstrapFirstHumanInput {
  /** The address the human will sign in with. Normalized here, never trusted pre-normalized. */
  readonly email: string;
  /** Plaintext. Used once, for the derivation, by Credential authority. Never stored or returned. */
  readonly password: string;
}

export interface BootstrappedHuman {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly credentialId: string;
  readonly email: string;
}

export type BootstrapRefusal =
  /** The email is empty, over-long, or not an address. Nothing was read. */
  | "invalid-email"
  /** The password is shorter than the product's own floor. Nothing was read. */
  | "password-too-short"
  /** A human already exists. This ceremony creates the FIRST one and never a second. */
  | "humans-already-exist";

export type BootstrapOutcome =
  | { readonly status: "bootstrapped"; readonly human: BootstrappedHuman }
  | { readonly status: "refused"; readonly reason: BootstrapRefusal; readonly existingHumans?: number };

/** Same normalization the invitation column and the seed both use. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Structural validity only — never deliverability, and never a policy about who may be first.
 *
 * Deliberately permissive on shape and strict on bounds: `NORMALIZED_EMAIL_MAX_LENGTH` is the
 * product's own column bound, restated from the contract rather than guessed.
 */
export function isBootstrapEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return (
    normalized.length > 0 &&
    normalized.length <= NORMALIZED_EMAIL_MAX_LENGTH &&
    /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(normalized)
  );
}

/**
 * Count the humans that already exist.
 *
 * Read-only and safe to call outside a transaction — the preflight uses it for a courtesy report.
 * It is NOT the guard: the guard is the same question asked again inside the locked transaction
 * below, exactly as R4A's slug read is a courtesy and `companies_slug_uq` is the invariant.
 */
export async function countExistingHumans(
  reader: Pick<ControlPlaneDatabase, "execute">,
): Promise<number> {
  const result = (await reader.execute("select count(*)::int as n from users")) as unknown as {
    rows: { n: number }[];
  };
  return Number(result.rows[0]?.n ?? 0);
}

/**
 * The whole ceremony, in ONE transaction.
 *
 *   1. validate the inputs                    (refuse before anything is read)
 *   2. lock `users`                           (serialize against any concurrent ceremony or insert)
 *   3. prove no human exists                  (the authorization: "first")
 *   4. Identity authority creates the human   (users + auth_identities, NO actor named)
 *   5. Credential authority establishes the password credential
 *
 * Any failure rolls back all of it. There is no state in which a human exists without a credential —
 * which would be a person who holds the only copy of an email address and can never sign in with
 * it — and none in which a credential exists without its identity.
 */
export async function bootstrapFirstHuman(
  db: ControlPlaneDatabase,
  input: BootstrapFirstHumanInput,
  now: Date = new Date(),
): Promise<BootstrapOutcome> {
  if (!isBootstrapEmail(input.email)) return { status: "refused", reason: "invalid-email" };
  if (typeof input.password !== "string" || input.password.length < MIN_BOOTSTRAP_PASSWORD_LENGTH) {
    return { status: "refused", reason: "password-too-short" };
  }

  const normalizedEmail = normalizeEmail(input.email);

  return db.transaction(async (tx) => {
    /*
     * The lock is taken BEFORE the count, and both are inside the transaction. Taken after, it would
     * protect nothing: the answer would already be stale by the time it was trusted.
     */
    await tx.execute(`lock table users in ${FIRST_HUMAN_LOCK_MODE} mode`);

    const existing = await countExistingHumans(tx);
    if (existing > 0) {
      return {
        status: "refused" as const,
        reason: "humans-already-exist" as const,
        existingHumans: existing,
      };
    }

    /*
     * IDENTITY AUTHORITY creates the human. `createdByType` is OMITTED, which is the whole point:
     * `created_by` and `created_by_type` both stay NULL, because a terminal is not a person and
     * this human did not create themselves.
     */
    const identity = await insertLocalIdentity(tx, {
      normalizedEmail,
      provider: LOCAL_IDENTITY_PROVIDER,
      issuer: LOCAL_IDENTITY_ISSUER,
      subject: localIdentitySubject(normalizedEmail),
      verifiedAt: now,
    });

    /*
     * CREDENTIAL AUTHORITY hashes AND persists. The plaintext goes in, an id comes back, and no
     * salt or derived key ever crosses this boundary — the confinement D1 established, unchanged.
     */
    const credentialId = await establishFirstPasswordCredential(
      tx,
      identity.authIdentityId,
      input.password,
      now,
    );

    return {
      status: "bootstrapped" as const,
      human: {
        userId: identity.userId,
        authIdentityId: identity.authIdentityId,
        credentialId,
        email: normalizedEmail,
      },
    };
  });
}
