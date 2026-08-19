/*
 * tenant-role-baseline/role-baseline-read.server.ts — the READ of this tenant's member role.
 *
 * MOVED, NOT COPIED, out of `provision-member-role.server.ts`, which also exports
 * `provisionMemberRole` — the Governance act that CREATES the role. A consumer that only needs to
 * know whether the role exists should not have to hold a reference to the act that makes one.
 *
 * Authority is still resolved by the one resolver, imported from the Governance read module. This
 * file adds no gate of its own and removes none: a caller without Governance authority still learns
 * nothing about the tenant's role structure here, exactly as before.
 *
 * No INSERT, no UPDATE, no DELETE, no transaction.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { roles } from "@/db/schema/role";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveGovernanceDbOrNull,
  type GovernanceDeps,
} from "@/features/governance-decision/persistence.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { BASELINE_ROLE_TYPE } from "./contracts";

/**
 * Does this tenant already hold its ordinary member role? Authority-gated, like every other read on
 * this surface — a non-authority learns nothing about the tenant's role structure here.
 */
export async function readRoleBaselineState(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<
  | { readonly status: "read"; readonly viewerIsGovernanceAuthority: boolean; readonly memberRoleId: string | null }
  | { readonly status: "unavailable" }
> {
  if (typeof window !== "undefined") {
    throw new Error("Role baseline reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };

  try {
    const authority = await resolveGovernanceAuthority(tenant, deps);
    if (!authority.authorized) {
      return { status: "read", viewerIsGovernanceAuthority: false, memberRoleId: null };
    }
    const rows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.tenantId, tenant.tenantId), eq(roles.type, BASELINE_ROLE_TYPE)))
      .limit(1);
    return {
      status: "read",
      viewerIsGovernanceAuthority: true,
      memberRoleId: rows[0]?.id ?? null,
    };
  } catch {
    return { status: "unavailable" };
  }
}
