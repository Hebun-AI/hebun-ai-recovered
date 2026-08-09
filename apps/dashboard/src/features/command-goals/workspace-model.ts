/*
 * command-goals/workspace-model.ts — the read model for Command · Strategic Goals
 * (Hebun UI Phase 20B).
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   Strategic Goals answers: "Where is the organization trying to go?" Phase 20A pinned
 *   the goal authority to `goal-runtime`, which projects active Goal nodes DERIVED from the
 *   canonical knowledge graph (the Goal Registry) — NOT the synthetic `@/features/director/mock`
 *   strategic goals, which this surface no longer imports.
 *
 *   This model reads the real authority and surfaces exactly what it returns, honestly
 *   attributed as DERIVED. It fabricates no goal, target, percentage, due date, owner, or
 *   progress. If the authority returns nothing, the surface renders an honest empty state.
 *   A Goal is not a metric, not a task, and not a recommendation.
 */

import { GoalRuntimeService, type GoalRuntimeModel } from "@/features/goal-runtime";

export interface StrategicGoalsModel {
  /** Active goals DERIVED from the knowledge graph (the goal authority). May be empty. */
  readonly goals: readonly GoalRuntimeModel[];
  /** Honest provenance label for the derived goals. */
  readonly source: string;
  /** Whether the authority returned any goal. Derived from the real projection, not faked. */
  readonly connected: boolean;
}

/**
 * Build the Strategic Goals model from the real goal authority. Pure read; the returned
 * goals are DERIVED from the knowledge graph, never fabricated here.
 */
export function getStrategicGoalsModel(): StrategicGoalsModel {
  const goals = GoalRuntimeService.listGoals();
  return {
    goals,
    source: "goal-runtime — derived from the knowledge graph (Goal Registry)",
    connected: goals.length > 0,
  };
}
