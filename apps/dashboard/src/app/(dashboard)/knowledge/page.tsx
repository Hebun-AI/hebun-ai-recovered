import { KnowledgeWorkspace } from "@/components/knowledge-workspace/knowledge-workspace";
import { getKnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";

export const metadata = { title: "Knowledge — Hebun AI" };

/*
 * Knowledge & Memory Workspace (Phase 9) — the primary Knowledge landing.
 *
 * Loads ONLY the real, canonical Enterprise Memory vocabulary (source kinds, the
 * five separated metadata dimensions, lifecycle, confidence, sensitivity,
 * relationship and authority types). No populated memory record, source, graph, or
 * history exists, so every place populated knowledge would appear renders an honest
 * empty state. No mock projection, no model call, no authority act (Phase 9 spec).
 */

export default function KnowledgePage() {
  const model = getKnowledgeWorkspaceModel();
  return <KnowledgeWorkspace model={model} />;
}
