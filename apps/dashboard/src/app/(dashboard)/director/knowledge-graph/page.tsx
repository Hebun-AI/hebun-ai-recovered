import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeGraphSurface } from "@/components/knowledge-graph/knowledge-graph-surface";
import {
  readKnowledgeGraph,
  resolveKnowledgeGraphTenant,
} from "@/features/knowledge-graph-surface/active-read.server";

export const metadata = { title: "Knowledge Graph — Hebun AI" };

/*
 * Knowledge Graph (Knowledge L2 · Hebun UI Phase 21C rebuild).
 *
 * Reads the honest state of the REAL canonical knowledge read layer (canonical-read
 * over public.knowledge_facts / public.knowledge_nodes), read-only. It no longer
 * renders the legacy seeded graph (mock registry records + hand-authored relationship
 * blueprints) or any fabricated strength / confidence / graph-health / coverage /
 * count. Without a configured canonical read layer or an authorized organization
 * context it fails closed to an honest state; it never falls back to mock graph data.
 */

export const dynamic = "force-dynamic";

export default async function KnowledgeGraphPage() {
  const tenant = await resolveKnowledgeGraphTenant();
  const model = await readKnowledgeGraph(tenant);

  return (
    <>
      <PageHeader
        title="Knowledge Graph"
        context="What organizational relationships are known, and what evidence supports them — read-only inspection of the canonical knowledge layer."
      />
      <KnowledgeGraphSurface model={model} />
    </>
  );
}
