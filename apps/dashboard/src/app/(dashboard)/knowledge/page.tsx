import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { KnowledgeOverview } from "@/components/knowledge-domain/knowledge-overview";
import { KnowledgeSources } from "@/components/knowledge-domain/knowledge-sources";
import { KnowledgeHealthAndCategories, KnowledgeRelationships, RecentlyAddedKnowledge } from "@/components/knowledge-domain/knowledge-intelligence";
import { getKnowledgeProjection } from "@/features/enterprise-projection-providers";

export default async function KnowledgePage() {
  const knowledge = await getKnowledgeProjection();

  return (
    <>
      <PageHeader
        title="Knowledge Domain"
        context="The canonical enterprise knowledge foundation — provenance, trust, coverage, and relationships understood as one asset."
        action={
          <><Badge variant="primary">Domain foundation</Badge><Badge variant="success">Mock projection</Badge></>
        }
      />
      <div className="space-y-6">
        <KnowledgeOverview items={knowledge.health} />
        <KnowledgeSources items={knowledge.sources} />
        <KnowledgeHealthAndCategories items={knowledge.categories} />
        <RecentlyAddedKnowledge items={knowledge.recentChanges} />
        <KnowledgeRelationships items={knowledge.relationships} />
      </div>
    </>
  );
}
