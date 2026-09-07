/*
 * provider-observation-history/read-provider-observations.server.ts — the read seam (TRH-21).
 *
 * ── WHAT IT RETURNS, AND WHAT IT REFUSES TO ──────────────────────────────────
 *
 * Stored observations for ONE tenant, newest first, bounded. That is all.
 *
 * It computes NO delta, NO rate, NO direction, NO cadence, NO score and NO summary. TRH-21 stores
 * history and derives nothing from it, and this file is where that restraint has to be visible:
 * a "helpful" subtraction here would be the first derived metric, with no owner and no rule about
 * how many samples earn a word like *trend*.
 *
 * Two rows are two rows. Whether they mean anything is a question this seam cannot answer and does
 * not try to.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { providerObservations } from "@/db/schema/provider-observation";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ObservationFacts, StoredProviderObservation } from "./contracts";

/** One page. A history read is a bounded page, never "everything ever observed". */
export const MAX_OBSERVATIONS_PER_READ = 50 as const;

export interface ProviderObservationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export interface ProviderObservationQuery {
  readonly providerKey?: string;
  readonly subjectRef?: string;
  readonly limit?: number;
}

export type ProviderObservationReadResult =
  | { readonly status: "read"; readonly observations: readonly StoredProviderObservation[] }
  | { readonly status: "unavailable"; readonly reason: "unauthenticated" | "persistence-unavailable" };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider observation history is server-only.");
  }
}

function resolveDbOrNull(deps: ProviderObservationReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Read one tenant's stored observations.
 *
 * THE TENANT PREDICATE IS NOT OPTIONAL AND IS NOT A FILTER A CALLER SUPPLIES. It comes from the
 * authorized context, and there is no argument that could widen it — which is what makes a
 * cross-tenant read unrepresentable at this seam rather than merely unlikely.
 */
export async function readProviderObservations(
  tenant: TenantContext | null,
  query: ProviderObservationQuery = {},
  deps: ProviderObservationReadDeps = {},
): Promise<ProviderObservationReadResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "unauthenticated" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  const limit = Math.min(Math.max(query.limit ?? MAX_OBSERVATIONS_PER_READ, 1), MAX_OBSERVATIONS_PER_READ);
  const predicates = [eq(providerObservations.tenantId, tenant.tenantId)];
  if (query.providerKey) predicates.push(eq(providerObservations.providerKey, query.providerKey));
  if (query.subjectRef) predicates.push(eq(providerObservations.subjectRef, query.subjectRef));

  try {
    const rows = await db
      .select({
        observationId: providerObservations.id,
        providerKey: providerObservations.providerKey,
        capabilityKey: providerObservations.capabilityKey,
        subjectKind: providerObservations.subjectKind,
        subjectRef: providerObservations.subjectRef,
        integrationId: providerObservations.integrationId,
        observedAt: providerObservations.observedAt,
        recordedAt: providerObservations.recordedAt,
        observedByActorType: providerObservations.observedByActorType,
        facts: providerObservations.facts,
      })
      .from(providerObservations)
      .where(and(...predicates))
      .orderBy(desc(providerObservations.observedAt))
      .limit(limit);

    return {
      status: "read",
      observations: rows.map((row) =>
        Object.freeze({
          observationId: row.observationId,
          providerKey: row.providerKey,
          capabilityKey: row.capabilityKey,
          subjectKind: row.subjectKind,
          subjectRef: row.subjectRef,
          integrationId: row.integrationId,
          observedAt: row.observedAt.toISOString(),
          recordedAt: row.recordedAt.toISOString(),
          observedByActorType: row.observedByActorType,
          facts: row.facts as ObservationFacts,
        }),
      ),
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
