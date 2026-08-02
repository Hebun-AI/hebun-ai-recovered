import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { KnowledgeOverview } from "@/components/knowledge-domain/knowledge-overview";
import { KnowledgeSources } from "@/components/knowledge-domain/knowledge-sources";
import { KnowledgeHealthAndCategories, KnowledgeRelationships, RecentlyAddedKnowledge } from "@/components/knowledge-domain/knowledge-intelligence";
import { knowledgeCategories, knowledgeMetrics, knowledgeRelationships, knowledgeSources, recentlyAddedKnowledge } from "@/features/knowledge-domain/mock";

export default function KnowledgePage() {
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
        <KnowledgeOverview items={knowledgeMetrics} />
        <KnowledgeSources items={knowledgeSources} />
        <KnowledgeHealthAndCategories items={knowledgeCategories} />
        <RecentlyAddedKnowledge items={recentlyAddedKnowledge} />
        <KnowledgeRelationships items={knowledgeRelationships} />
      </div>
    </>
  );
}
