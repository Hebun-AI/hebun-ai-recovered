import { StrategicGoals } from "@/components/command-goals/strategic-goals";
import { getStrategicGoalsModel } from "@/features/command-goals/workspace-model";

export const metadata = { title: "Strategic Goals — Hebun AI" };

/*
 * Command · Strategic Goals (Phase 20B rebuild) — reads the real goal authority (`goal-runtime`,
 * active Goal nodes derived from the knowledge graph). It no longer imports `@/features/director/mock`.
 * Goals shown are exactly what the authority returns (attributed as derived); if none, an honest
 * empty state. No fabricated target, percentage, due date, owner, or progress.
 */

export default function StrategicGoalsPage() {
  return <StrategicGoals model={getStrategicGoalsModel()} />;
}
