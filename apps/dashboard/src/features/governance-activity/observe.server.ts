/*
 * governance-activity/observe.server.ts — the R7.1 composition seam.
 *
 * Joins the authoritative tenant-scoped read to the pure projection and nothing else. It holds no
 * logic of its own beyond deciding which honest unavailable reason applies, so that the counting
 * lives in the database and the shaping lives in a pure function that a test can drive with no
 * database at all.
 *
 * Fails CLOSED. Every failure path returns an `unavailable` reason rather than an empty
 * observation, because a zeroed view is a claim ("Hebun recorded nothing for you") and must never
 * be produced by a read that simply could not run.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { GovernanceActivityObservationResult } from "./contracts";
import { projectGovernanceActivity } from "./observation";
import { readGovernanceActivityTallies, type GovernanceActivityReadDeps } from "./read.server";

export interface ObserveGovernanceActivityDeps extends GovernanceActivityReadDeps {
  /** Injected so `generatedAt` is deterministic under test. Never read inside the projection. */
  readonly now?: () => Date;
}

/**
 * Observe the recorded governance activity of the authorized tenant.
 *
 * The tenant comes from the caller's already-authorized context and is used verbatim as the SQL
 * predicate. This function does not widen it, does not accept a tenant id argument, and offers no
 * cross-tenant or whole-ledger form — a caller cannot ask for "all governance activity", only for
 * its own.
 */
export async function observeGovernanceActivity(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: ObserveGovernanceActivityDeps = {},
): Promise<GovernanceActivityObservationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }

  try {
    const tallies = await readGovernanceActivityTallies(tenant.tenantId, deps);
    if (!tallies) {
      /*
       * `null` means the read could not run: no database configured, or an id that is not a uuid
       * and therefore cannot name a tenant. Neither is "this tenant has no activity".
       */
      return { status: "unavailable", reason: "persistence-not-configured" };
    }
    const now = deps.now?.() ?? new Date();
    return {
      status: "observed",
      observation: projectGovernanceActivity(tenant.tenantId, tallies, now),
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "governance activity read failed",
    };
  }
}
