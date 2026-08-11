/*
 * heby-provider-ops/provider-authority.server.ts — who may change provider connectivity.
 *
 * The Director control is a high-authority operation. Write access requires the acting
 * membership's role to be an authority band that governs the platform: `owner` or `director`
 * (the highest bands in `roleTypeEnum`; `role.type` is documented as "the authority band").
 *
 * The role is resolved SERVER-SIDE from the already-authenticated TenantContext: the tenant and
 * role id come from the durable session/membership row, never from the client. The role's TYPE
 * is looked up in the tenant-scoped `roles` table, so a client cannot claim a role it does not
 * durably hold. Fail-closed: an unresolved role → forbidden.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { roles } from "@/db/schema/role";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

/** The role bands permitted to change provider connectivity. Highest-authority only. */
export const PROVIDER_CONTROL_ROLE_TYPES: ReadonlySet<string> = new Set(["owner", "director"]);

export interface ProviderControlAuthority {
  readonly authorized: boolean;
  /** The resolved role type, or null when the role could not be resolved (→ forbidden). */
  readonly roleType: string | null;
}

/**
 * Resolve whether the authenticated actor may change provider connectivity. The role type is
 * read from the tenant-scoped `roles` table using the server-resolved `roleId` + `tenantId`; a
 * client-supplied role/tenant is never consulted. Any unresolved role fails closed to forbidden.
 */
export async function resolveProviderControlAuthority(
  tenant: TenantContext,
  db: ControlPlaneDatabase = getControlPlaneDb(),
): Promise<ProviderControlAuthority> {
  const roleId = tenant.roleId?.trim();
  const tenantId = tenant.tenantId?.trim();
  if (!roleId || !tenantId) return { authorized: false, roleType: null };
  try {
    const rows = await db
      .select({ type: roles.type })
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)))
      .limit(1);
    const roleType = rows[0]?.type ?? null;
    return { authorized: roleType !== null && PROVIDER_CONTROL_ROLE_TYPES.has(roleType), roleType };
  } catch {
    return { authorized: false, roleType: null };
  }
}
