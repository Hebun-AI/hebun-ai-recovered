/*
 * knowledge/knowledge-write-authority.server.ts — who may establish organizational Knowledge (K2).
 *
 * WHY THIS IS A ROLE BAND AND NOT A PERMISSION KEY. Hebun has two authorization models on disk,
 * and only one of them is connected:
 *
 *   `permissions` + `role_permissions`  — a real fine-grained, allow-only grant model. It is
 *     IMPLEMENTED AS SCHEMA ONLY: zero application code reads either table, and both are empty.
 *     Gating K2 on it would mean building a permission-resolution runtime and seeding a permission
 *     catalogue — inventing a new authorization model, which K2 is explicitly forbidden from doing.
 *
 *   `roles.type` (roleTypeEnum authority band)  — CONNECTED. It already gates Hebun's
 *     highest-authority mutation, the R2E Director provider kill-switch
 *     (`heby-provider-ops/provider-authority.server.ts`), using exactly this pattern.
 *
 * K2 therefore reuses the connected primitive with its OWN policy. Knowledge authorship and
 * provider connectivity are different authorities that happen to require the same band today;
 * they are kept as separate modules so tightening one never silently moves the other.
 *
 * THE AUTHORITY IS RESOLVED SERVER-SIDE. The tenant and role id come from the durable
 * session/membership row in the R1 TenantContext, never from the client. The role's TYPE is then
 * looked up in the TENANT-SCOPED `roles` table, so a client cannot claim a band it does not durably
 * hold, and a role id belonging to another tenant resolves to nothing. Fail-closed at every step:
 * a missing tenant, a missing role, an unknown role, or any read error is FORBIDDEN.
 *
 * LIMITATION, STATED HONESTLY. This is a coarse authority: it says "this actor holds a
 * platform-governing band", not "this actor has been granted the right to author Knowledge". A
 * later phase that connects `role_permissions` should replace this with a real `knowledge.create`
 * grant. Until then, the narrowest correct gate is the highest band, not the most convenient one.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { roles } from "@/db/schema/role";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { KNOWLEDGE_WRITE_AUTHORITY_MODEL } from "./create-contracts";

export { KNOWLEDGE_WRITE_AUTHORITY_MODEL };

/**
 * The role bands permitted to establish organizational Knowledge. Deliberately the two highest
 * bands in `roleTypeEnum` — `operator`, `auditor` and `member` are NOT included, and adding one
 * is a governance decision, not a convenience.
 */
export const KNOWLEDGE_AUTHOR_ROLE_TYPES: ReadonlySet<string> = new Set(
  KNOWLEDGE_WRITE_AUTHORITY_MODEL.bands,
);

export interface KnowledgeWriteAuthority {
  readonly authorized: boolean;
  /** The resolved role type, or null when it could not be resolved (→ forbidden). */
  readonly roleType: string | null;
}

/**
 * Resolve whether the authenticated actor may create canonical Knowledge for their tenant.
 * Read-only, tenant-scoped, and fail-closed.
 */
export async function resolveKnowledgeWriteAuthority(
  tenant: TenantContext,
  db: ControlPlaneDatabase = getControlPlaneDb(),
): Promise<KnowledgeWriteAuthority> {
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
    return {
      authorized: roleType !== null && KNOWLEDGE_AUTHOR_ROLE_TYPES.has(roleType),
      roleType,
    };
  } catch {
    return { authorized: false, roleType: null };
  }
}
