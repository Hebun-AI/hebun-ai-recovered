/*
 * Development credential provisioning — the core, separated from the CLI so a
 * real database can prove its semantics without driving an interactive prompt.
 *
 * This lives under `scripts/` on purpose. It writes credentials, which is operator
 * tooling, not product behaviour: nothing in `src/` may import it, and a test
 * enforces that. Keeping it out of the application tree is what stops "provision a
 * credential" from ever becoming a reachable product capability.
 *
 * It provisions; it never authenticates. No session, no cookie, no membership, no
 * role, no tenant — a credential and nothing else.
 */
import type { Client } from "pg";
import { hashPassword } from "../../src/features/auth-runtime/password-hash.server";

export const MIN_DEV_PASSWORD_LENGTH = 12;

export interface DevIdentity {
  readonly authIdentityId: string;
  readonly userId: string;
  readonly provider: string;
}

export interface ProvisionResult {
  readonly action: "created" | "rotated";
  readonly authIdentityId: string;
  readonly algorithm: string;
}

/**
 * Resolve an ACTIVE local identity by email. Returns undefined rather than
 * throwing so the caller decides the wording — this tool never creates people.
 */
export async function findActiveIdentityByEmail(
  client: Client,
  email: string,
): Promise<DevIdentity | undefined> {
  const result = await client.query<{
    auth_identity_id: string;
    user_id: string;
    provider: string;
  }>(
    `select i.id as auth_identity_id, u.id as user_id, i.provider
       from users u
       join auth_identities i on i.user_id = u.id
      where lower(u.email) = $1
        and u.lifecycle_status = 'active'
        and i.status = 'active'
        and i.lifecycle_status = 'active'
        and i.revoked_at is null
      order by i.created_at asc
      limit 1`,
    [email.trim().toLowerCase()],
  );
  const row = result.rows[0];
  return row
    ? {
        authIdentityId: row.auth_identity_id,
        userId: row.user_id,
        provider: row.provider,
      }
    : undefined;
}

/** True when this identity already holds an active password credential. */
export async function hasActiveCredential(
  client: Client,
  authIdentityId: string,
): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `select id from auth_credentials
      where auth_identity_id = $1 and credential_type = 'password' and status = 'active'`,
    [authIdentityId],
  );
  return result.rows.length > 0;
}

/**
 * Create or rotate the password credential for an identity.
 *
 * ROTATION IS TRANSACTIONAL. `auth_credentials` permits exactly one ACTIVE
 * password credential per identity, so rotation must revoke the old one and
 * insert the new one together. Doing it in one transaction means there is never
 * an instant with two active credentials, and — the failure that would actually
 * hurt — never an outcome where the old credential is revoked and the new one
 * did not land, locking the operator out of their own machine.
 *
 * The old credential is REVOKED, never deleted, preserving D1's lifecycle.
 */
export async function provisionDevCredential(
  client: Client,
  identity: DevIdentity,
  password: string,
): Promise<ProvisionResult> {
  if (password.length < MIN_DEV_PASSWORD_LENGTH) {
    throw new Error(
      `password must be at least ${MIN_DEV_PASSWORD_LENGTH} characters.`,
    );
  }

  // Hashed by the SAME module the login path verifies with. A fixture that used
  // its own hashing would prove nothing about whether sign-in works.
  const hashed = await hashPassword(password);
  const rotating = await hasActiveCredential(client, identity.authIdentityId);

  await client.query("begin");
  try {
    if (rotating) {
      await client.query(
        `update auth_credentials
            set status = 'revoked',
                revoked_at = now(),
                revocation_reason = 'rotated by local dev provisioning',
                updated_at = now()
          where auth_identity_id = $1 and credential_type = 'password' and status = 'active'`,
        [identity.authIdentityId],
      );
    }
    await client.query(
      `insert into auth_credentials
         (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
       values ($1, 'password', $2, $3::jsonb, $4, $5, 'active')`,
      [
        identity.authIdentityId,
        hashed.algorithm,
        JSON.stringify(hashed.params),
        hashed.salt,
        hashed.secretHash,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  return {
    action: rotating ? "rotated" : "created",
    authIdentityId: identity.authIdentityId,
    algorithm: hashed.algorithm,
  };
}

/** Refuse anything that is not an unmistakably local database. */
export function assertLocalDatabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection string.");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error(
      `refusing to provision a credential on a non-local database (${parsed.hostname}). ` +
        "This tool is for local development only.",
    );
  }
}
