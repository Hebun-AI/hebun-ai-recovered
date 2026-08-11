/*
 * R1 seed helper (tests only). Seeds a complete, durable local-identity chain
 * into an already-migrated control plane:
 *   company (tenant) -> user -> auth_identity(provider='local') -> role -> membership
 * Returns the ids so tests can assert the resolved tenant context.
 *
 * D1: an identity with no credential can no longer sign in, so this helper also
 * provisions a REAL scrypt password credential when `password` is supplied. It
 * hashes through the same production module the login path verifies with — the
 * fixture is a real credential, not a shortcut around one. This provisioning
 * exists ONLY here, in test/disposable infrastructure; no product surface
 * creates credentials.
 */

import type { Client } from "pg";
import { hashPassword } from "../../src/features/auth-runtime/password-hash.server";

export interface SeededLocalIdentity {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly roleId: string;
  readonly membershipId: string;
  readonly email: string;
  /** Present only when a password was seeded. */
  readonly credentialId?: string;
}

export interface SeedLocalIdentityInput {
  readonly companyName: string;
  readonly companySlug: string;
  readonly email: string;
  readonly userName?: string;
  readonly roleName?: string;
  readonly roleType?: "owner" | "director" | "operator" | "auditor" | "member";
  /**
   * Development/test credential. When omitted the identity exists but CANNOT
   * sign in — which is itself a case worth seeding deliberately.
   */
  readonly password?: string;
}

export async function seedLocalIdentity(
  client: Client,
  input: SeedLocalIdentityInput,
): Promise<SeededLocalIdentity> {
  const company = await client.query<{ id: string }>(
    `insert into companies (name, slug, plan, tenant_status)
     values ($1, $2, 'free', 'active')
     returning id`,
    [input.companyName, input.companySlug],
  );
  const tenantId = company.rows[0]!.id;

  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1, $2) returning id`,
    [input.email, input.userName ?? input.email],
  );
  const userId = user.rows[0]!.id;

  const identity = await client.query<{ id: string }>(
    `insert into auth_identities
       (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now())
     returning id`,
    [userId, `local:${input.email}`],
  );
  const authIdentityId = identity.rows[0]!.id;

  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type)
     values ($1, $2, $3)
     returning id`,
    [tenantId, input.roleName ?? "Owner", input.roleType ?? "owner"],
  );
  const roleId = role.rows[0]!.id;

  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active')
     returning id`,
    [tenantId, userId, roleId],
  );
  const membershipId = membership.rows[0]!.id;

  let credentialId: string | undefined;
  if (input.password !== undefined) {
    // Hashed by the production module, so the fixture is a real credential the
    // real login path must verify — never a bypass.
    const hashed = await hashPassword(input.password);
    const credential = await client.query<{ id: string }>(
      `insert into auth_credentials
         (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
       values ($1, 'password', $2, $3::jsonb, $4, $5, 'active')
       returning id`,
      [
        authIdentityId,
        hashed.algorithm,
        JSON.stringify(hashed.params),
        hashed.salt,
        hashed.secretHash,
      ],
    );
    credentialId = credential.rows[0]!.id;
  }

  return {
    tenantId,
    userId,
    authIdentityId,
    roleId,
    membershipId,
    email: input.email,
    credentialId,
  };
}
