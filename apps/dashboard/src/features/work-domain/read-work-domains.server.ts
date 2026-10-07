/*
 * work-domain/read-work-domains.server.ts — the Work Domain Authority's read seam (AP-4A).
 *
 * Lists THIS tenant's work domains, in service and retired, by slug. The tenant comes from the
 * authenticated context; there is no parameter that names another one. It selects no person.
 *
 * RELEASE A: read by the operator ceremonies and the Release B preflight only; no product path
 * reads `work_domains` yet (a firewall pins it).
 */
import { asc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { workDomains } from "@/db/schema/work-domain";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { ACTIVE_WORK_DOMAIN_STATUS, type WorkDomain } from "./contracts";

export type ReadWorkDomainsResult =
  | { readonly status: "read"; readonly workDomains: readonly WorkDomain[] }
  | { readonly status: "refused"; readonly reason: "no-authorized-tenant-context" | "authority-unavailable" };

export async function readWorkDomains(
  tenant: TenantContext | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<ReadWorkDomainsResult> {
  if (typeof window !== "undefined") throw new Error("Work domain reads are server-only.");
  if (!tenant?.tenantId) return { status: "refused", reason: "no-authorized-tenant-context" };
  let db: ControlPlaneDatabase | null;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return { status: "refused", reason: "authority-unavailable" };
  try {
    const rows = await db
      .select({ id: workDomains.id, slug: workDomains.slug, name: workDomains.name, lifecycleStatus: workDomains.lifecycleStatus })
      .from(workDomains)
      .where(eq(workDomains.tenantId, tenant.tenantId))
      .orderBy(asc(workDomains.slug));
    return {
      status: "read",
      workDomains: rows.map((r) => ({
        workDomainId: r.id,
        slug: r.slug,
        name: r.name,
        inService: r.lifecycleStatus === ACTIVE_WORK_DOMAIN_STATUS,
      })),
    };
  } catch {
    return { status: "refused", reason: "authority-unavailable" };
  }
}
