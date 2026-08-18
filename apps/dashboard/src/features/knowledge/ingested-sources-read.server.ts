/*
 * knowledge/ingested-sources-read.server.ts — the sources a retraction could target (R6D).
 *
 * A read, and only a read. It opens the same gates every Knowledge read opens, asks the canonical
 * repository which ingestion sources the tenant still holds live Knowledge from, and returns them.
 * It resolves no authority of its own and writes nothing.
 *
 * WHY THE AUTHORING BAND IS RESOLVED BY THE CALLER, NOT HERE. Seeing which sources exist is a read
 * of records the viewer can already list; RETRACTING one is a mutation. The page resolves the band
 * once for authoring, ingestion and retraction together — whatever stops you adding a source stops
 * you withdrawing one — and this seam stays a read so it cannot become a second gate that drifts
 * from the first.
 *
 * Server-only.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeRepoOrNull,
  type DurableKnowledgeRepository,
  type IngestedSourceSummary,
} from "./durable-knowledge-repository.server";

export type IngestedSourcesTenant = Pick<TenantContext, "tenantId">;

export interface IngestedSourcesReadDeps {
  readonly getRepo?: () => DurableKnowledgeRepository | null;
}

export type IngestedSourcesListing =
  | { readonly status: "read"; readonly sources: readonly IngestedSourceSummary[] }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed";
      readonly detail: string;
    };

export async function listIngestedSources(
  tenant: IngestedSourcesTenant | null,
  deps: IngestedSourcesReadDeps = {},
): Promise<IngestedSourcesListing> {
  if (typeof window !== "undefined") {
    throw new Error("Ingested source reads are server-only.");
  }

  if (!tenant?.tenantId) {
    return {
      status: "unavailable",
      reason: "no-authorized-tenant-context",
      detail: "No authorized organization context, so nothing was read.",
    };
  }

  const repo = (deps.getRepo ?? resolveKnowledgeRepoOrNull)();
  if (!repo) {
    return {
      status: "unavailable",
      reason: "persistence-not-configured",
      detail:
        "Durable persistence is not configured, so the canonical Knowledge tables cannot be read.",
    };
  }

  try {
    return { status: "read", sources: await repo.listIngestedSources({ tenantId: tenant.tenantId }) };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "Ingested source read failed.",
    };
  }
}
