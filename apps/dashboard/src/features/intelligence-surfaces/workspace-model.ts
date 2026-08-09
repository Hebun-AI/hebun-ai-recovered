/*
 * intelligence-surfaces/workspace-model.ts — the read models for the Intelligence L2
 * surfaces (Hebun UI Phase 20C): Signals & Assessments, Candidates, Insights,
 * Readiness & Pathways, Recommendations.
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   These surfaces REUSE the single, frozen Organizational Intelligence Runtime vocabulary
 *   via the Phase 8 `getIntelligenceWorkspaceModel()` — they do NOT introduce a second
 *   intelligence architecture and do NOT duplicate the runtime contracts. The Runtime is
 *   contract-only here: it generates no candidate, so every surface's instance collection is
 *   ALWAYS empty and renders an honest empty state. Nothing fabricates a signal, assessment,
 *   candidate, insight, recommendation, evidence reference, confidence value, score, or
 *   timestamp, and no model is called.
 *
 *   The candidate-kind sets below are pinned with `satisfies readonly RuntimeCandidateKind[]`
 *   so a runtime taxonomy drift (a renamed/removed kind) breaks typecheck rather than silently
 *   mis-mapping a surface. There is deliberately NO `pattern` kind — none exists in the runtime
 *   taxonomy (Phase 20A D3), so no Patterns surface is modelled.
 */

import {
  getIntelligenceWorkspaceModel,
  type IntelligenceKindView,
  type LifecycleStageView,
  type ConfidenceLevelView,
  type DependencyView,
  type IntelligenceWorkspaceModel,
} from "@/features/intelligence/workspace-model";
import type {
  RuntimeCandidateKind,
  RuntimeStageKind,
} from "@/features/enterprise-organizational-intelligence-runtime";

/** The restriction view shape, borrowed from the base model so it stays a single source. */
export type RestrictionView = IntelligenceWorkspaceModel["restrictions"][number];

/* Drift-safe kind/stage sets — renaming a runtime kind/stage breaks the build here. */
const AWARENESS_KINDS = ["awareness-signal", "awareness-assessment"] as const satisfies readonly RuntimeCandidateKind[];
const VALIDATED_KINDS = ["learning", "optimization"] as const satisfies readonly RuntimeCandidateKind[];
const EVOLUTION_KINDS = ["evolution-readiness", "evolution-pathway"] as const satisfies readonly RuntimeCandidateKind[];
const ADVISORY_KINDS = ["optimization", "evolution-pathway"] as const satisfies readonly RuntimeCandidateKind[];
const AWARENESS_PIPELINE = ["input", "context", "analysis", "candidate-generation"] as const satisfies readonly RuntimeStageKind[];
const CANDIDATE_LIFECYCLE = ["candidate-generation", "validation", "explanation", "confidence", "governance", "director-approval"] as const satisfies readonly RuntimeStageKind[];

function pickKinds(base: IntelligenceWorkspaceModel, kinds: readonly RuntimeCandidateKind[]): readonly IntelligenceKindView[] {
  return base.kinds.filter((k) => kinds.includes(k.kind));
}
function pickStages(base: IntelligenceWorkspaceModel, stages: readonly RuntimeStageKind[]): readonly LifecycleStageView[] {
  return base.stages.filter((s) => stages.includes(s.stage));
}

/* ─────────────────────────── Signals & Assessments ─────────────────────────── */

export interface SignalsAssessmentsModel {
  /** awareness-signal + awareness-assessment, in runtime order. */
  readonly kinds: readonly IntelligenceKindView[];
  /** The observation → signal → assessment pipeline, from the real lifecycle. */
  readonly pipeline: readonly LifecycleStageView[];
  readonly dependencies: readonly DependencyView[];
  /** Live signals. Always empty — the Runtime surfaces none. */
  readonly signals: readonly never[];
  /** Live assessments. Always empty. */
  readonly assessments: readonly never[];
  readonly connected: false;
}

export function getSignalsAssessmentsModel(): SignalsAssessmentsModel {
  const base = getIntelligenceWorkspaceModel();
  return {
    kinds: pickKinds(base, AWARENESS_KINDS),
    pipeline: pickStages(base, AWARENESS_PIPELINE),
    dependencies: base.dependencies,
    signals: [],
    assessments: [],
    connected: false,
  };
}

/* ──────────────────────────────── Candidates ───────────────────────────────── */

export interface CandidatesModel {
  /** All candidate kinds — a candidate may be of any kind before it is validated. */
  readonly kinds: readonly IntelligenceKindView[];
  /** The candidate lifecycle from generation to the Director boundary. */
  readonly lifecycle: readonly LifecycleStageView[];
  /** Ordinal confidence levels a candidate carries. Never a score. */
  readonly confidenceLevels: readonly ConfidenceLevelView[];
  /** The closed responses to a failed candidate — restrictions are never hidden. */
  readonly restrictions: readonly RestrictionView[];
  readonly dependencies: readonly DependencyView[];
  /** Live candidates. Always empty — none is fabricated. */
  readonly candidates: readonly never[];
  readonly connected: false;
}

export function getCandidatesModel(): CandidatesModel {
  const base = getIntelligenceWorkspaceModel();
  return {
    kinds: base.kinds,
    lifecycle: pickStages(base, CANDIDATE_LIFECYCLE),
    confidenceLevels: base.confidenceLevels,
    restrictions: base.restrictions,
    dependencies: base.dependencies,
    candidates: [],
    connected: false,
  };
}

/* ───────────────────────────────── Insights ────────────────────────────────── */

export interface InsightsModel {
  /** Validated intelligence draws from learning + optimization candidates. */
  readonly validatedKinds: readonly IntelligenceKindView[];
  /** The validation stage — the boundary a candidate must cross to become an insight. */
  readonly validationStage: LifecycleStageView | undefined;
  readonly confidenceLevels: readonly ConfidenceLevelView[];
  readonly dependencies: readonly DependencyView[];
  /** Live validated intelligence. Always empty — none is fabricated. */
  readonly insights: readonly never[];
  readonly connected: false;
}

export function getInsightsModel(): InsightsModel {
  const base = getIntelligenceWorkspaceModel();
  return {
    validatedKinds: pickKinds(base, VALIDATED_KINDS),
    validationStage: base.stages.find((s) => s.stage === "validation"),
    confidenceLevels: base.confidenceLevels,
    dependencies: base.dependencies,
    insights: [],
    connected: false,
  };
}

/* ───────────────────────────── Readiness & Pathways ─────────────────────────── */

export interface ReadinessPathwaysModel {
  /** evolution-readiness + evolution-pathway, in runtime order. */
  readonly kinds: readonly IntelligenceKindView[];
  readonly dependencies: readonly DependencyView[];
  /** Live readiness reads. Always empty. */
  readonly readiness: readonly never[];
  /** Live pathway reads. Always empty. */
  readonly pathways: readonly never[];
  readonly connected: false;
}

export function getReadinessPathwaysModel(): ReadinessPathwaysModel {
  const base = getIntelligenceWorkspaceModel();
  return {
    kinds: pickKinds(base, EVOLUTION_KINDS),
    dependencies: base.dependencies,
    readiness: [],
    pathways: [],
    connected: false,
  };
}

/* ──────────────────────────────── Recommendations ──────────────────────────── */

/** One structural step in the recommendation → … → execution chain. Ownership only. */
export interface RecommendationChainStep {
  readonly order: number;
  readonly label: string;
  readonly describes: string;
  readonly owner: string;
}

/** The canonical chain that keeps a recommendation distinct from a decision or execution. */
const RECOMMENDATION_CHAIN: readonly RecommendationChainStep[] = [
  { order: 0, label: "Validated intelligence", describes: "A grounded, validated understanding.", owner: "Intelligence" },
  { order: 1, label: "Recommendation", describes: "A suggested course of action. Advisory — not a decision.", owner: "Intelligence" },
  { order: 2, label: "Command attention", describes: "Surfaced to the Director as something to consider.", owner: "Command" },
  { order: 3, label: "Director review", describes: "The Director weighs evidence, consequences, and uncertainty.", owner: "Director" },
  { order: 4, label: "Decision (if consequential)", describes: "A recorded human decision. Only a human decides.", owner: "Decisions" },
  { order: 5, label: "Prepared action", describes: "Heby prepares the action; prepared ≠ authorized.", owner: "Phase 17" },
  { order: 6, label: "Governance", describes: "Applicable policy and authority requirements apply.", owner: "Governance" },
  { order: 7, label: "Human authority", describes: "A human authorizes. The system never authorizes itself.", owner: "Director" },
  { order: 8, label: "Execution elsewhere", describes: "Execution happens in the runtime — not in Intelligence.", owner: "Operations" },
];

export interface RecommendationsModel {
  /** Recommendations draw from optimization + evolution-pathway advisory output. */
  readonly advisoryKinds: readonly IntelligenceKindView[];
  /** The chain that keeps a recommendation distinct from a decision, action, or execution. */
  readonly chain: readonly RecommendationChainStep[];
  readonly confidenceLevels: readonly ConfidenceLevelView[];
  /** Live recommendations. Always empty — none is fabricated. */
  readonly recommendations: readonly never[];
  readonly connected: false;
}

export function getRecommendationsModel(): RecommendationsModel {
  const base = getIntelligenceWorkspaceModel();
  return {
    advisoryKinds: pickKinds(base, ADVISORY_KINDS),
    chain: RECOMMENDATION_CHAIN,
    confidenceLevels: base.confidenceLevels,
    recommendations: [],
    connected: false,
  };
}
