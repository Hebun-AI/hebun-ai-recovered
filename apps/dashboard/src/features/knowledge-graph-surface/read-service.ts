/*
 * knowledge-graph-surface/read-service.ts — pure, read-only orchestration for the
 * Knowledge Graph surface (Hebun UI Phase 21C).
 *
 * It probes the REAL canonical knowledge read availability and reports an honest
 * connection state. It performs no writes, no graph mutation, and no fabrication;
 * it never falls back to the legacy seeded graph. Tenant isolation is preserved:
 * without an authorized context the read fails closed.
 *
 * Deliberately free of server-only / pg imports (only the availability TYPE is
 * imported) so it stays deterministically testable. The active canonical services
 * are supplied by the server wrapper (active-read.server.ts).
 */

import type { CanonicalReadAvailability } from "@/features/canonical-read";
import type { KnowledgeGraphReadModel } from "./contracts";

/** The narrow tenant slice this read depends on. */
export interface KnowledgeGraphTenant {
  readonly tenantId: string;
}

function base(
  connection: KnowledgeGraphReadModel["connection"],
  configured: boolean,
  extras: Partial<KnowledgeGraphReadModel> = {},
): KnowledgeGraphReadModel {
  return {
    connection,
    source: "canonical-postgres",
    configured,
    warnings: [],
    nodes: [],
    relationships: [],
    ...extras,
  };
}

/**
 * Resolve the Knowledge Graph read model from a canonical availability probe and an
 * authorized tenant. Read-only; canonical-not-available and no-tenant both fail
 * closed to honest states rather than showing seeded graph data.
 */
export async function readKnowledgeGraphFrom(
  probeAvailability: () => Promise<CanonicalReadAvailability>,
  tenant: KnowledgeGraphTenant | null,
): Promise<KnowledgeGraphReadModel> {
  try {
    const availability = await probeAvailability();

    if (!availability.available) {
      return base("not-connected", availability.configured, {
        reason: availability.reason,
        warnings: [...availability.warnings],
      });
    }

    if (!tenant || !tenant.tenantId) {
      return base("requires-authorized-context", true, {
        reason: "no-authorized-tenant-context",
      });
    }

    return base("connected-empty", true);
  } catch (error) {
    return base("read-failed", false, {
      reason: error instanceof Error ? error.message : "availability-probe-failed",
    });
  }
}
