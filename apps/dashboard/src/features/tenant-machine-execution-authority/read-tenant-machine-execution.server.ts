/*
 * read-tenant-machine-execution.server.ts — the MACHINE-SAFE read of tenant participation.
 *
 * ── WHY THIS SEAM TAKES A TENANT ID AND THAT IS STILL SAFE ──────────────────
 *
 * Every product read in this repository requires a `TenantContext`, minted only from an
 * authenticated human session. A machine execution path has no such context and must never
 * manufacture one — so this seam takes a bare tenant id instead.
 *
 * THAT IS SAFE HERE FOR ONE REASON, AND IT IS WORTH SPELLING OUT: the caller does not CHOOSE the
 * tenant, it FORWARDS one it already read off an authoritative row. RUNG 1's executor reads the
 * tenant off the permit, never from an argument a caller supplied, and a permit is written under a
 * human's Governance decision. So the tenant travelling into this function is a fact the database
 * already asserted, not a claim the caller made.
 *
 * A SEAM THAT ACCEPTED A TENANT FROM AN HTTP REQUEST WOULD BE THE ATTACK. This one is reachable
 * only from server-side execution paths that have a permit row in hand; the way to keep it that
 * way is that nothing between here and the ingress is allowed to widen it.
 *
 * ── ABSENT, WITHDRAWN AND UNAVAILABLE ARE THREE FACTS ───────────────────────
 *
 * They are never collapsed. A caller that only wants to proceed treats all three as "no", which is
 * correct and fail-closed; a human reading why deserves to know which one it was, and an outage
 * must never be recorded as a decision.
 *
 * ── EFFECTIVE = HIGHEST REVISION IN THE LINEAGE ─────────────────────────────
 *
 * Identical to the reduction the writer applies, deliberately. `superseded` is derived from a later
 * revision existing and is never stored.
 *
 * Server-only. This module reads; it has no writer and opens no transaction.
 */
import { and, desc, eq } from "drizzle-orm";
import { tenantMachineExecutionAuthorizations } from "@/db/schema/tenant-machine-execution-authorization";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import type { TenantMachineExecutionState } from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantMachineExecutionReadDeps {
  /** Injectable for tests. `null` means "no durable authority", which FAILS CLOSED. */
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** The effective revision of one (tenant, capability) lineage. */
export interface EffectiveTenantMachineExecution {
  readonly authorizationId: string;
  readonly tenantId: string;
  readonly capabilityKey: string;
  readonly authorizationRevision: number;
  readonly state: TenantMachineExecutionState;
  readonly authorizedByActorId: string;
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly authorizedAt: string;
}

export type TenantMachineExecutionReadResult =
  /** A lineage exists; `effective` is its latest revision, active or withdrawn. */
  | { readonly status: "read"; readonly effective: EffectiveTenantMachineExecution }
  /** No lineage exists for this tenant and capability. Nobody ever enrolled this organization. */
  | { readonly status: "absent" }
  /** The control plane could not be reached. NEVER reported as absent. */
  | { readonly status: "unavailable" };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Tenant machine-execution authority reads are server-only.");
  }
}

/**
 * Read the effective tenant machine-execution authorization for one capability.
 *
 * Returns the LATEST revision whatever it says. Deciding what that means is the composition's job,
 * not this one's — a reader that returned only active rows would make "withdrawn" and "never
 * enrolled" indistinguishable to every caller, which is exactly the distinction this authority
 * exists to keep.
 */
export async function readEffectiveTenantMachineExecution(
  tenantId: string,
  capabilityKey: string,
  deps: TenantMachineExecutionReadDeps = {},
): Promise<TenantMachineExecutionReadResult> {
  assertServerOnly();

  const tenant = (tenantId ?? "").trim();
  const capability = (capabilityKey ?? "").trim();
  /* A malformed id is not a database question. Treated as absent — never as an error to retry. */
  if (!UUID_RE.test(tenant) || capability.length === 0) return { status: "absent" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };

  try {
    const rows = await db
      .select({
        id: tenantMachineExecutionAuthorizations.id,
        tenantId: tenantMachineExecutionAuthorizations.tenantId,
        capabilityKey: tenantMachineExecutionAuthorizations.capabilityKey,
        authorizationRevision: tenantMachineExecutionAuthorizations.authorizationRevision,
        state: tenantMachineExecutionAuthorizations.state,
        authorizedByActorId: tenantMachineExecutionAuthorizations.authorizedByActorId,
        governanceDecisionId: tenantMachineExecutionAuthorizations.governanceDecisionId,
        governanceSessionId: tenantMachineExecutionAuthorizations.governanceSessionId,
        authorizedAt: tenantMachineExecutionAuthorizations.authorizedAt,
      })
      .from(tenantMachineExecutionAuthorizations)
      .where(
        and(
          eq(tenantMachineExecutionAuthorizations.tenantId, tenant),
          eq(tenantMachineExecutionAuthorizations.capabilityKey, capability),
        ),
      )
      .orderBy(desc(tenantMachineExecutionAuthorizations.authorizationRevision))
      .limit(1);

    const row = rows[0];
    if (!row) return { status: "absent" };

    return {
      status: "read",
      effective: {
        authorizationId: row.id,
        tenantId: row.tenantId,
        capabilityKey: row.capabilityKey,
        authorizationRevision: row.authorizationRevision,
        state: row.state as TenantMachineExecutionState,
        authorizedByActorId: row.authorizedByActorId,
        governanceDecisionId: row.governanceDecisionId,
        governanceSessionId: row.governanceSessionId,
        authorizedAt:
          row.authorizedAt instanceof Date
            ? row.authorizedAt.toISOString()
            : new Date(row.authorizedAt as unknown as string).toISOString(),
      },
    };
  } catch {
    /* FAIL CLOSED, and honestly: we could not find out. Not "nobody authorized it". */
    return { status: "unavailable" };
  }
}
