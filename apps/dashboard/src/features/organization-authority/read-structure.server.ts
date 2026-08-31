/*
 * organization-authority/read-structure.server.ts — reading this organization's recorded structure
 * (OSA-1).
 *
 * READ-ONLY, and read-only in the way that can be proved: this module contains no insert, no update,
 * no delete and no transaction. It grants nothing, decides nothing, and starts nothing.
 *
 * ── IT IS NOT A SECOND ORGANIZATION READ SYSTEM ──────────────────────────────
 *
 * `readOrganizationAuthority` remains the ONE seam every consumer calls. This module is the
 * structural half of that seam's answer, and it is imported by exactly one caller. Heby, the Live
 * Map, the Agents surface and the Organization surface all continue to read L3 and now inherit
 * structure through it — none of them learns a second way to ask.
 *
 * ── THE THREE STATES ARE THE POINT ───────────────────────────────────────────
 *
 *   unavailable            the authority could not be reached. NOT "no departments".
 *   available, empty       looked, found none. A real, measured answer about the organization.
 *   available, departments the recorded structure.
 *
 * A read that fails returns `unavailable` and never an empty list, because a surface must not tell
 * a human "you have no departments" when the truth is that Hebun could not look.
 *
 * ── OWNERSHIP IS HISTORICAL TRUTH; MEMBERSHIP IS CURRENT ─────────────────────
 *
 * A department keeps naming the human recorded as accountable even after their membership ends —
 * erasing them would destroy the record that anyone ever was. What changes is a SEPARATE derived
 * flag, `currentlyActiveMember`, resolved by a per-owner predicate against `memberships`.
 *
 * That predicate is NOT A ROSTER. It answers "is THIS id an active member" for ids the structure
 * already names; it cannot enumerate the organization's people, carries no name and no email, and
 * L3's own rule — "a COUNT, never a roster" — is untouched by it.
 *
 * Server-only.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { departments } from "@/db/schema/department";
import { memberships } from "@/db/schema/membership";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  ORGANIZATION_STRUCTURE_EMPTY_DETAIL,
  ORGANIZATION_STRUCTURE_UNAVAILABLE,
  type DepartmentView,
  type OrganizationStructure,
} from "./contracts";

export interface OrganizationStructureReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** The lifecycle value every governed read in this repository treats as in service. */
export const ACTIVE_LIFECYCLE_STATUS = "active" as const;

/**
 * THE COLUMN VALUE A RETIRED DEPARTMENT CARRIES, and the naming mismatch stated rather than hidden.
 *
 * The product word is RETIRED. The column value is `archived`, because `departments` uses the
 * GENERIC `lifecycle_status` enum — `active | archived | deleted` — and OSA-1 adds no enum value:
 * widening a shared enum for one table's vocabulary would change every table that uses it.
 *
 * Agent Identity and Knowledge each own a lifecycle enum of their own and can spell `retired`
 * literally; departments do not, and inventing one here would be schema work the OSA-0 gate did not
 * authorize. So the word lives in the product, the value lives in the column, and this constant is
 * the single place the two are tied together.
 *
 * `deleted` is deliberately NOT used: OSA retires in place and deletes nothing.
 */
export const RETIRED_LIFECYCLE_STATUS = "archived" as const;

function resolveDbOrNull(deps: OrganizationStructureReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** The sentence for a structure that has departments. A count, never a list of names. */
function recordedDetail(total: number, retired: number): string {
  const live = total - retired;
  const parts = [
    `${live} department${live === 1 ? "" : "s"} in service`,
    retired > 0 ? `${retired} retired` : null,
  ].filter(Boolean);
  return (
    `This organization has recorded ${parts.join(", ")}. Ownership names an accountable human ` +
    `and grants nothing — no permission, no Governance authority, no approval right.`
  );
}

/**
 * Read this organization's recorded structure.
 *
 * Tenant-scoped by the authority's own predicate. There is no department id, slug or tenant
 * parameter, so a caller cannot point this at another organization — a cross-organization read is
 * not refused here; it is UNREPRESENTABLE.
 *
 * Retired departments are RETURNED, not hidden, and carry `inService: false`. A surface that wants
 * only live ones filters; a surface that hides them by omission would make a retirement look like a
 * deletion, and OSA retires in place.
 */
export async function readOrganizationStructure(
  tenant: TenantContext | null,
  deps: OrganizationStructureReadDeps = {},
): Promise<OrganizationStructure> {
  if (typeof window !== "undefined") {
    throw new Error("Organization structure reads are server-only.");
  }
  if (!tenant?.tenantId) return ORGANIZATION_STRUCTURE_UNAVAILABLE;

  const db = resolveDbOrNull(deps);
  if (!db) return ORGANIZATION_STRUCTURE_UNAVAILABLE;

  try {
    const rows = await db
      .select({
        id: departments.id,
        name: departments.name,
        slug: departments.slug,
        lifecycleStatus: departments.lifecycleStatus,
        ownerActorType: departments.ownerActorType,
        ownerActorId: departments.ownerActorId,
        createdAt: departments.createdAt,
        updatedAt: departments.updatedAt,
      })
      .from(departments)
      .where(eq(departments.tenantId, tenant.tenantId))
      .orderBy(asc(departments.slug));

    if (rows.length === 0) {
      return {
        status: "available",
        departments: [],
        detail: ORGANIZATION_STRUCTURE_EMPTY_DETAIL,
      };
    }

    /*
     * ONE predicate, for the owner ids this structure already names. Scoped to this tenant and to
     * those exact ids — it can neither list the organization's members nor reach another tenant's.
     */
    const ownerIds = [
      ...new Set(rows.map((row) => row.ownerActorId).filter((id): id is string => Boolean(id))),
    ];
    const activeOwnerIds = new Set<string>();
    if (ownerIds.length > 0) {
      const memberRows = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.tenantId, tenant.tenantId),
            eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
            inArray(memberships.userId, ownerIds),
          ),
        );
      for (const member of memberRows) activeOwnerIds.add(member.userId);
    }

    const views: DepartmentView[] = rows.map((row) => ({
      departmentId: row.id,
      name: row.name,
      slug: row.slug,
      lifecycleStatus: row.lifecycleStatus,
      inService: row.lifecycleStatus === ACTIVE_LIFECYCLE_STATUS,
      owner:
        row.ownerActorId && row.ownerActorType === "human"
          ? {
              actorType: "human" as const,
              actorId: row.ownerActorId,
              currentlyActiveMember: activeOwnerIds.has(row.ownerActorId),
            }
          : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const retired = views.filter((view) => !view.inService).length;
    return {
      status: "available",
      departments: views,
      detail: recordedDetail(views.length, retired),
    };
  } catch {
    /* "Could not look" is never "looked and found none". */
    return ORGANIZATION_STRUCTURE_UNAVAILABLE;
  }
}
