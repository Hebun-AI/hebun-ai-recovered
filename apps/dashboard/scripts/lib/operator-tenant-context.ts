/*
 * scripts/lib/operator-tenant-context.ts — resolve the deciding human for an operator ceremony (AP-4A).
 *
 * The terminal supplies an organization slug and a human's email; the human's ACTIVE membership is read
 * from the database. Possession of the deployment grants nothing: every writer this context reaches
 * re-checks that the human holds THIS tenant's Governance authority. Same shape the released
 * ceremonies use (eai-authorize-tenant-external-ai-data-use.ts).
 */
import type { Client } from "pg";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

export async function resolveOperatorTenantContext(
  client: Client,
  input: { readonly tenantSlug: string; readonly email: string; readonly requestId: string },
): Promise<{ readonly tenant: TenantContext; readonly company: string } | null> {
  const row = (
    await client.query<{ user_id: string; tenant_id: string; membership_id: string; role_id: string; ai: string; provider: string; company: string }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider, c.name as company
         from users u
         join memberships m on m.user_id = u.id and m.status = 'active'
         join companies c on c.id = m.tenant_id
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 and c.slug = $2
        order by ai.is_primary desc
        limit 1`,
      [input.email, input.tenantSlug],
    )
  ).rows[0];
  if (!row) return null;
  return {
    company: row.company,
    tenant: asHumanTenantContext({
      tenantId: row.tenant_id,
      userId: row.user_id,
      authIdentityId: row.ai,
      membershipId: row.membership_id,
      membershipVersion: 1,
      roleId: row.role_id,
      sessionContextId: "00000000-0000-4000-8000-000000000005",
      provider: row.provider as never,
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: input.requestId,
      authenticatedAt: new Date().toISOString(),
    }),
  };
}
