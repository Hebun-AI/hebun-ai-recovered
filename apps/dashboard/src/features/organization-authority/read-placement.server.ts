/*
 * organization-authority/read-placement.server.ts — WHO WORKS WHERE, read.
 *
 * READ-ONLY, AND PROVABLY: no insert, no update, no delete, no transaction. It answers one
 * question — which humans this organization has RECORDED as working in which department — and it
 * answers it only for the tenant the server already resolved.
 *
 * ── IT IS NOT A MEMBER ROSTER, AND THE DIFFERENCE IS MEASURABLE ──────────────
 *
 * An UNPLACED member is INVISIBLE here. This read returns placement rows, so a human this
 * organization has not placed cannot be discovered through it at all — which is what keeps L3's
 * "a COUNT, never a roster" rule about MEMBERS intact while still answering a real question about
 * PLACEMENTS. The released member list is the Human Legibility Reach picker; this is not a second
 * one, and it selects no name and no email of its own.
 *
 *     PLACEMENT REGISTER != MEMBER ROSTER
 *
 * ── STANDING IS DERIVED, NEVER DESTROYED ─────────────────────────────────────
 *
 * A placement keeps naming a human after their membership ends, and `currentlyActiveMember` says
 * so on read. That is `departments.owner_actor_id`'s released posture, for its released reason:
 * erasing them would destroy the record that anyone ever worked there. The flag is computed by a
 * LEFT JOIN against the shared eligibility rule, so this read and the writer cannot disagree about
 * what "still a member" means.
 *
 * ── IT IS TENANT-SCOPED AND DELIBERATELY NOT GOVERNANCE-GATED ────────────────
 *
 * Stated rather than left to be inferred, because it is a security decision.
 *
 * `readOrganizationStructure` — this authority's released sibling — is tenant-scoped and ungated,
 * and this read matches it exactly. Knowing how your own organization is arranged, and who it has
 * recorded as working where, is ordinary information for a member of it. CHANGING any of it
 * requires this organization's Governance authority, and `write-placement.server.ts` enforces that.
 *
 *     READING YOUR OWN ORGANIZATION != CHANGING IT
 *
 * One consequence is worth naming here rather than discovering later: `resolveHumanLabels` and
 * `resolveHumanNames` ARE Governance-gated, so a member without that authority sees this register
 * with identifiers and `name unavailable` in place of every name. The placement is visible; the
 * legibility is not. That is Identity's boundary, not this one's, and it fails in the safe
 * direction.
 *
 * ── WHAT IT CANNOT DO ────────────────────────────────────────────────────────
 *
 * No tenant parameter, no department filter parameter, no offset, no cursor. A caller cannot point
 * it at another organization and cannot page through this one. Bounded by a constant; the caller is
 * told when the bound was reached rather than handed a silently partial list.
 *
 * Server-only.
 */
import { and, asc, eq, exists, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { departmentPlacements } from "@/db/schema/department-placement";
import { departments } from "@/db/schema/department";
import { memberships } from "@/db/schema/membership";
import { users } from "@/db/schema/user";
/*
 * THE SHARED ELIGIBILITY RULE, IMPORTED RATHER THAN RE-TYPED.
 *
 * The FULL predicate, not the membership half: unlike `read-structure.server.ts` — which a released
 * firewall forbids from naming `users` at all — this read is free to reach the identity columns, so
 * it takes the same four membership conditions AND the two identity ones the WRITER enforces. The
 * derived flag therefore agrees with the writer exactly, rather than being a strict subset of it.
 *
 * The first version of this file hand-wrote those six conditions as raw SQL. It was correct on the
 * day it was written and it was the exact shape the rule exists to prevent: a second copy that can
 * drift. Caught in review, before release.
 */
import {
  eligibleTenantMemberConditions,
  joinUsersToMemberships,
} from "@/features/auth-runtime/member-eligibility";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { ACTIVE_LIFECYCLE_STATUS } from "./read-structure.server";
import { MAX_PLACEMENTS_READ } from "./placement-contracts";

export interface PlacementReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** One recorded placement. Identifiers only — legibility is Identity's, resolved by the caller. */
export interface PlacementView {
  readonly placementId: string;
  readonly userId: string;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly departmentSlug: string;
  /** False when the department this human is placed in has since been retired. */
  readonly departmentInService: boolean;
  /**
   * DERIVED, never stored. False when the human is no longer an eligible member of this tenant —
   * the record still names them, and the surface says why.
   */
  readonly currentlyActiveMember: boolean;
}

export type PlacementRegister =
  | {
      readonly status: "available";
      readonly placements: readonly PlacementView[];
      readonly truncated: boolean;
      readonly detail: string;
    }
  | { readonly status: "unavailable"; readonly detail: string };

/** Said when the authority answered and this organization has placed nobody. */
export const PLACEMENT_NONE_RECORDED =
  "This organization has recorded no departmental placements. Hebun looked and found none — a " +
  "measured absence in this organization's records, never a statement that nobody works anywhere. " +
  "A placement exists in Hebun only once an authorized human records it.";

/** Said when the read itself could not answer. UNAVAILABLE IS NOT NONE. */
export const PLACEMENT_UNAVAILABLE =
  "Hebun could not read this organization's departmental placements, so who works where is " +
  "unknown — not absent. Nothing here says whether any placement exists.";

function describe(count: number, truncated: boolean): string {
  if (count === 0) return PLACEMENT_NONE_RECORDED;
  return (
    `This organization has recorded ${count} departmental placement${count === 1 ? "" : "s"}` +
    `${truncated ? ", and holds more than are listed here" : ""}. Each was declared by an ` +
    "authorized human through the product; Hebun did not observe anyone working anywhere."
  );
}

/**
 * Read this organization's recorded placements.
 *
 * Tenant-scoped by predicate on the placement row AND structurally by the composite foreign key, so
 * a cross-organization read is not refused here — it is UNREPRESENTABLE.
 */
export async function readPlacementRegister(
  tenant: TenantContext | null,
  deps: PlacementReadDeps = {},
): Promise<PlacementRegister> {
  if (typeof window !== "undefined") {
    throw new Error("Departmental placement reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", detail: PLACEMENT_UNAVAILABLE };
  }

  let db: ControlPlaneDatabase | null;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return { status: "unavailable", detail: PLACEMENT_UNAVAILABLE };

  try {
    const rows = await db
      .select({
        placementId: departmentPlacements.id,
        userId: departmentPlacements.userId,
        departmentId: departments.id,
        departmentName: departments.name,
        departmentSlug: departments.slug,
        departmentLifecycle: departments.lifecycleStatus,
        /*
         * THE STANDING PROBE. A correlated existence check built from the SHARED rule and
         * correlated to the placement's own `user_id`, so it can never drift from the writer.
         *
         * It is NOT A ROSTER: it answers "is THIS id still eligible" for ids the register already
         * names, enumerates nobody, and projects no name and no email.
         */
        stillMember: exists(
          db
            .select({ one: sql`1` })
            .from(users)
            .innerJoin(memberships, joinUsersToMemberships())
            .where(
              and(
                ...eligibleTenantMemberConditions(tenant.tenantId),
                eq(users.id, departmentPlacements.userId),
              ),
            ),
        ),
      })
      .from(departmentPlacements)
      .innerJoin(
        departments,
        and(
          eq(departments.id, departmentPlacements.departmentId),
          eq(departments.tenantId, departmentPlacements.tenantId),
        ),
      )
      .where(
        and(
          eq(departmentPlacements.tenantId, tenant.tenantId),
          eq(departmentPlacements.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
          isNull(departmentPlacements.deletedAt),
        ),
      )
      .orderBy(asc(departments.slug), asc(departmentPlacements.createdAt))
      .limit(MAX_PLACEMENTS_READ + 1);

    const truncated = rows.length > MAX_PLACEMENTS_READ;
    const kept = truncated ? rows.slice(0, MAX_PLACEMENTS_READ) : rows;

    const placements: PlacementView[] = kept.map((row) => ({
      placementId: row.placementId,
      userId: row.userId,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      departmentSlug: row.departmentSlug,
      departmentInService: row.departmentLifecycle === ACTIVE_LIFECYCLE_STATUS,
      currentlyActiveMember: Boolean(row.stillMember),
    }));

    return {
      status: "available",
      placements,
      truncated,
      detail: describe(placements.length, truncated),
    };
  } catch {
    return { status: "unavailable", detail: PLACEMENT_UNAVAILABLE };
  }
}
