/*
 * knowledge-graph-surface/active-read.server.ts — server-only binding of the
 * Knowledge Graph read to the REAL canonical read services (Hebun UI Phase 21C).
 *
 * Creates the governed canonical read services, probes availability (read-only),
 * and disposes them per request. No writes, no graph mutation, no legacy fallback.
 *
 * Server-only by convention (the `.server.ts` suffix and its pg-backed canonical
 * import mean only server components import it). Tenant resolution fails closed
 * until authenticated requests are wired — the same seam as Company Memory.
 */

import { createCanonicalReadServices } from "@/features/canonical-read";
import { readKnowledgeGraphFrom, type KnowledgeGraphTenant } from "./read-service";
import type { KnowledgeGraphReadModel } from "./contracts";

/** Resolve the authorized tenant for this request, or null to fail closed. */
export async function resolveKnowledgeGraphTenant(): Promise<KnowledgeGraphTenant | null> {
  return null;
}

/** Read the Knowledge Graph model from the active canonical read services. */
export async function readKnowledgeGraph(
  tenant: KnowledgeGraphTenant | null,
): Promise<KnowledgeGraphReadModel> {
  const services = createCanonicalReadServices();
  try {
    return await readKnowledgeGraphFrom(() => services.availability(), tenant);
  } finally {
    await services.dispose().catch(() => undefined);
  }
}
