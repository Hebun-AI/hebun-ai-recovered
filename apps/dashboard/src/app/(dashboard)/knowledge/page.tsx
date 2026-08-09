import { KnowledgeWorkspace } from "@/components/knowledge-workspace/knowledge-workspace";
import { getKnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";

export const metadata = { title: "Knowledge Overview — Hebun AI" };

/*
 * Knowledge Overview (Phase 9 honesty, refined into the Overview in UI Phase 21B) —
 * the Knowledge workspace landing.
 *
 * Answers: what organizational knowledge is available, where does it come from, and
 * how trustworthy/available is it? Loads ONLY the real, canonical Enterprise Memory
 * vocabulary (source kinds, the five separated metadata dimensions, lifecycle,
 * confidence, sensitivity, relationship and authority types) plus an honest
 * availability map (memory, sources, provenance/evidence, graph, registries, Heby
 * retrieval). No populated record, source, graph, or history exists, so every place
 * populated knowledge would appear renders an honest empty/derived state. No mock
 * projection, no model call, no authority act.
 */

export default function KnowledgePage() {
  const model = getKnowledgeWorkspaceModel();
  return <KnowledgeWorkspace model={model} />;
}
