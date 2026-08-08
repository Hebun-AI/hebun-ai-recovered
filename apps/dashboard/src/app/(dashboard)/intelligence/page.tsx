import { IntelligenceWorkspace } from "@/components/intelligence-workspace/intelligence-workspace";
import { getIntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";

export const metadata = { title: "Intelligence — Hebun AI" };

/*
 * Intelligence Workspace (Phase 8) — the primary Intelligence landing.
 *
 * Loads ONLY the REAL, frozen Organizational Intelligence Runtime vocabulary
 * (candidate kinds, lifecycle stages, confidence levels, dependencies, capabilities
 * and prohibitions). No populated candidate/evidence/briefing instance exists —
 * the Runtime is contract-only here — so every place populated intelligence would
 * appear renders an honest empty state. No mock data, no model call, no authority
 * act (Phase 8 spec).
 */

export default function IntelligencePage() {
  const model = getIntelligenceWorkspaceModel();
  return <IntelligenceWorkspace model={model} />;
}
