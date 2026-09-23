/*
 * read-tenant-external-send.server.ts — the read of ONE TENANT'S external-send arming.
 *
 * ── WHY THIS SEAM TAKES A TENANT ID AND THAT IS STILL SAFE ──────────────────
 *
 * Its machine sibling wrote the rule this follows, and it is worth repeating because getting it
 * wrong here is the attack: THE CALLER DOES NOT CHOOSE THE TENANT, IT FORWARDS ONE IT ALREADY READ
 * OFF AN AUTHORITATIVE SOURCE.
 *
 * In this feature the authoritative source is stronger still. The executor forwards
 * `TenantContext.tenantId` — a branded projection minted only from an authenticated human session,
 * which no client can construct and no request body can influence. A tenant id arriving here is a
 * fact the session already established, never a claim a caller made.
 *
 * A SEAM THAT ACCEPTED A TENANT FROM AN HTTP REQUEST WOULD BE THE ATTACK. This one is reachable
 * only from server-side paths that already hold such a context; the way to keep it that way is
 * that nothing between here and the ingress is allowed to widen it.
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
import { desc, eq } from "drizzle-orm";
import { tenantExternalSendAuthorizations } from "@/db/schema/tenant-external-send-authorization";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import type { TenantExternalSendState } from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantExternalSendReadDeps {
  /** Injectable for tests. `null` means "no durable authority", which FAILS CLOSED. */
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** The effective revision of one tenant's arming lineage. */
export interface EffectiveTenantExternalSend {
  readonly authorizationId: string;
  readonly tenantId: string;
  readonly authorizationRevision: number;
  readonly state: TenantExternalSendState;
  readonly authorizedByActorId: string;
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly authorizedAt: string;
}

export type TenantExternalSendReadResult =
  /** A lineage exists; `effective` is its latest revision, active or withdrawn. */
  | { readonly status: "read"; readonly effective: EffectiveTenantExternalSend }
  /** No lineage exists for this tenant. Nobody ever armed this organization. */
  | { readonly status: "absent" }
  /** The control plane could not be reached. NEVER reported as absent. */
  | { readonly status: "unavailable" };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Tenant external-send arming reads are server-only.");
  }
}

/**
 * Read the effective external-send arming for one tenant.
 *
 * Returns the LATEST revision whatever it says. Deciding what that means is the composition's job,
 * not this one's — a reader that returned only active rows would make "withdrawn" and "never
 * armed" indistinguishable to every caller, which is exactly the distinction this authority exists
 * to keep.
 */
export async function readEffectiveTenantExternalSend(
  tenantId: string,
  deps: TenantExternalSendReadDeps = {},
): Promise<TenantExternalSendReadResult> {
  assertServerOnly();

  const tenant = (tenantId ?? "").trim();
  /*
   * A malformed id is not a database question. Treated as ABSENT — which fails closed — and never
   * as an error to retry. It is also the one branch a caller could reach by losing its context, so
   * it must resolve to "no" rather than to "we could not tell".
   */
  if (!UUID_RE.test(tenant)) return { status: "absent" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };

  try {
    const rows = await db
      .select({
        id: tenantExternalSendAuthorizations.id,
        tenantId: tenantExternalSendAuthorizations.tenantId,
        authorizationRevision: tenantExternalSendAuthorizations.authorizationRevision,
        state: tenantExternalSendAuthorizations.state,
        authorizedByActorId: tenantExternalSendAuthorizations.authorizedByActorId,
        governanceDecisionId: tenantExternalSendAuthorizations.governanceDecisionId,
        governanceSessionId: tenantExternalSendAuthorizations.governanceSessionId,
        authorizedAt: tenantExternalSendAuthorizations.authorizedAt,
      })
      .from(tenantExternalSendAuthorizations)
      /*
       * THE TENANT PREDICATE IS THE CONTAINMENT. There is no code path in this module that reads a
       * row without it, and no fallback that widens to another tenant when this one has no row.
       */
      .where(eq(tenantExternalSendAuthorizations.tenantId, tenant))
      .orderBy(desc(tenantExternalSendAuthorizations.authorizationRevision))
      .limit(1);

    const row = rows[0];
    if (!row) return { status: "absent" };

    return {
      status: "read",
      effective: {
        authorizationId: row.id,
        tenantId: row.tenantId,
        authorizationRevision: row.authorizationRevision,
        state: row.state as TenantExternalSendState,
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
    /* FAIL CLOSED, and honestly: we could not find out. Not "nobody armed it". */
    return { status: "unavailable" };
  }
}
