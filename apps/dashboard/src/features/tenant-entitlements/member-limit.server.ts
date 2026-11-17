/*
 * tenant-entitlements/member-limit.server.ts — COMMERCIAL-ACTIVATION-1. The plan's member limit,
 * enforced server-side inside the invitation's own transaction.
 *
 * A seat is a membership that is pending, active or suspended, or a pending invitation that has not
 * expired. Issuing an invitation needs a free seat counting both; accepting one needs a free seat
 * counting memberships only (the invitation being accepted already held its seat). Founding tenants
 * have no plan limit, so nothing about their membership behavior changes.
 *
 * A per-tenant transaction-scoped advisory lock serializes two concurrent issuances or acceptances,
 * so "count then insert" cannot both see the last free seat.
 */
import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { invitations } from "@/db/schema/invitation";
import { memberships } from "@/db/schema/membership";
import { readTenantPlan } from "./tenant-dispatch-ceiling.server";
import { planFeatures } from "./plans";

/** Thrown inside the caller's transaction; the caller maps it to `plan-member-limit-reached`. */
export class PlanMemberLimitReached extends Error {}

const SEAT_MEMBERSHIP_STATUSES = ["pending", "active", "suspended"] as const;

type TransactionHandle = Pick<ControlPlaneDatabase, "execute" | "select">;

export async function enforceMemberLimitWithin(
  tx: TransactionHandle,
  tenantId: string,
  now: Date,
  act: "issue-invitation" | "accept-invitation",
): Promise<void> {
  const limit = planFeatures(await readTenantPlan(tx as Pick<ControlPlaneDatabase, "select">, tenantId)).memberLimit;
  if (limit === null) return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hebun.plan-member-limit'), hashtext(${tenantId}))`);
  const [members] = await tx
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), inArray(memberships.status, [...SEAT_MEMBERSHIP_STATUSES])));
  let occupied = Number(members?.n ?? 0);
  if (act === "issue-invitation") {
    const [pending] = await tx
      .select({ n: count() })
      .from(invitations)
      .where(and(eq(invitations.tenantId, tenantId), eq(invitations.status, "pending"), gt(invitations.expiresAt, now)));
    occupied += Number(pending?.n ?? 0);
  }
  if (occupied >= limit) throw new PlanMemberLimitReached();
}
