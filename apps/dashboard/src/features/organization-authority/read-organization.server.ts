/*
 * organization-authority/read-organization.server.ts — L3. THE READ SEAM.
 *
 * ── THE TENANT COMES FROM THE SESSION AND FROM NOWHERE ELSE ──────────────────
 *
 * The only parameter is a `TenantContext`, which is minted at ONE site in the human session runtime
 * and only after a live membership carrying a non-null role is revalidated. There is deliberately no
 * `organizationId` argument, no slug argument and no filter argument, so there is no expression a
 * caller — or a caller's query string — could use to ask about another organization. Cross-tenant
 * reads are not refused here; they are UNREPRESENTABLE.
 *
 * ── IT READS, AND THAT IS ALL IT CAN DO ──────────────────────────────────────
 *
 * No INSERT, no UPDATE, no DELETE, no transaction. It imports no writer, no Governance module and
 * no authorization module, so it cannot acquire authority through a transitive dependency either.
 *
 * ── FAIL CLOSED, AND NEVER FABRICATE AN EMPTY ORGANIZATION ───────────────────
 *
 * Every failure path returns `unavailable` with its own reason. A missing tenant row is
 * `organization-not-found`, not an organization named "". A thrown read is `read-failed`, not a
 * membership count of zero. The distinction is the whole point of the milestone:
 *
 *   UNAVAILABLE != EMPTY ORGANIZATION
 *
 * ── WHY NO AUTHORITY GATE ────────────────────────────────────────────────────
 *
 * Stated rather than assumed: this returns nothing a member does not already hold. The name and
 * slug are shown to the same human by the workspace picker before they are even inside the tenant,
 * and the member count is a fact about the room they are standing in. Adding a band check here
 * would invent an access rule no released authority states — the exact thing the SEC-2 gate warns
 * against. What it must never do instead is widen: no role, no permission, no authority scope, no
 * credential, no provider state and no human roster leaves this module.
 *
 * Server-only.
 */
import { and, count, eq } from "drizzle-orm";
import { getControlPlaneDb, isControlPlaneConfigured, type ControlPlaneDatabase } from "@/db/client.server";
import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR,
  COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR,
} from "@/db/schema/company";
import {
  ORGANIZATION_PROVENANCE_DETAIL,
  ORGANIZATION_STRUCTURE_UNAVAILABLE,
  type OrganizationAuthorityRead,
  type OrganizationProvenance,
} from "./contracts";

export interface OrganizationAuthorityDeps {
  /** Injected only by tests. Returning null means "durable persistence is not configured". */
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** The process control-plane handle, or null when this deployment configures none. */
function resolveOrganizationDbOrNull(): ControlPlaneDatabase | null {
  if (!isControlPlaneConfigured()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Translate the released `provisioning_source` column.
 *
 * The column's CHECK admits exactly the two ceremony values or NULL, so an unrecognized string is
 * not representable in a healthy database — but it is still mapped to `unrecorded` rather than
 * passed through, because a value this function does not know is a value it cannot vouch for.
 *
 * The two values are IMPORTED from the schema module that declares them, never respelled. G1's
 * released guard makes that a rule rather than a preference, and it is the right rule: a literal
 * copied here could drift from the CHECK that enforces it, and the drift would be silent.
 */
function toProvenance(source: string | null): OrganizationProvenance {
  if (source === COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR) {
    return COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR;
  }
  if (source === COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR) {
    return COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR;
  }
  return "unrecorded";
}

/**
 * WHAT ORGANIZATION EXISTS, for the authenticated human's own tenant.
 *
 * Two reads, both tenant-predicated, neither of them widenable by a caller.
 */
export async function readOrganizationAuthority(
  tenant: TenantContext | null,
  deps: OrganizationAuthorityDeps = {},
): Promise<OrganizationAuthorityRead> {
  if (typeof window !== "undefined") {
    throw new Error("Organization authority reads are server-only.");
  }

  const tenantId = tenant?.tenantId?.trim();
  if (!tenantId) return { status: "unavailable", reason: "no-tenant" };

  const db = (deps.getDb ?? resolveOrganizationDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        lifecycleStatus: companies.lifecycleStatus,
        tenantStatus: companies.tenantStatus,
        provisioningSource: companies.provisioningSource,
      })
      .from(companies)
      .where(and(eq(companies.id, tenantId), eq(companies.lifecycleStatus, "active")))
      .limit(1);

    const row = rows[0];
    /* No live row for the tenant this session names. Fail closed, exactly as every governed read. */
    if (!row) return { status: "unavailable", reason: "organization-not-found" };

    /*
     * A COUNT, not a roster, and predicated on the SAME tenant id the row was found by — so this
     * cannot become a census of another organization even if the first predicate were weakened.
     * `active` memberships only: a revoked member is not a member of the organization today.
     */
    const provenance = toProvenance(row.provisioningSource ?? null);

    const memberRows = await db
      .select({ value: count() })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.lifecycleStatus, "active")));

    return {
      status: "available",
      organization: {
        organizationId: row.id,
        name: row.name,
        slug: row.slug,
        lifecycleStatus: row.lifecycleStatus,
        tenantStatus: row.tenantStatus ?? null,
        provenance,
        provenanceDetail: ORGANIZATION_PROVENANCE_DETAIL[provenance],
        humanMemberCount: Number(memberRows[0]?.value ?? 0),
        structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,
      },
    };
  } catch {
    /* "Could not look" is never "looked and found none". */
    return { status: "unavailable", reason: "read-failed" };
  }
}
