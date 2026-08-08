/*
 * intelligence/workspace-model.ts — the read model for the Intelligence Workspace
 * (Hebun UI Phase 8).
 *
 * PROVENANCE CONTRACT (Phase 8 §25 no-fake-data gate):
 *
 *   The Organizational Intelligence Runtime is, in this repository, a CONTRACT +
 *   pure-function layer. It declares an honest vocabulary — candidate kinds,
 *   lifecycle stages, confidence levels, restriction responses, an approval state,
 *   its own capabilities and non-responsibilities — but it produces NO populated
 *   candidate, briefing, or evidence instance: those require settled Memory
 *   Context, Reasoning Understanding, and Organizational Assembly inputs that are
 *   NOT connected, and the Runtime never calls a model to invent them.
 *
 *   Therefore this model surfaces ONLY the REAL, frozen Runtime vocabulary (the
 *   descriptor tables) plus short human-authored explanatory copy that names each
 *   real term. It fabricates no signal, pattern, candidate, evidence reference,
 *   count, score, percentage, confidence value, timestamp, or activity. Every
 *   place populated intelligence would appear, the workspace renders an honest
 *   empty state — because none is surfaced yet.
 *
 *   The mock files (features/intelligence/mock.ts, features/enterprise-intelligence/
 *   mock.ts) are SYNTHETIC and are deliberately NOT imported here.
 */

import {
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_DEPENDENCY_KIND_DESCRIPTORS,
  RUNTIME_RESTRICTION_DESCRIPTORS,
  RUNTIME_STAGE_DESCRIPTORS,
  RUNTIME_CAPABILITIES,
  RUNTIME_NON_RESPONSIBILITIES,
  type RuntimeCandidateKind,
  type RuntimeConfidenceLevel,
  type RuntimeDependencyKind,
  type RuntimeRestrictionKind,
  type RuntimeStageKind,
} from "@/features/enterprise-organizational-intelligence-runtime";

/**
 * A candidate kind the Runtime recognizes, joined to human-authored copy. The
 * `kind`, `sourcePhase`, and `requiresBasis` are REAL (frozen descriptors); the
 * `label` and `describes` are static explanatory copy naming the real term. There
 * are zero populated instances of any kind — `surfaced` is always 0.
 */
export interface IntelligenceKindView {
  readonly kind: RuntimeCandidateKind;
  readonly label: string;
  readonly describes: string;
  readonly sourcePhase: number;
  readonly requiresBasis: boolean;
  readonly surfaced: 0;
}

/** Static, human-authored names for each REAL candidate kind. Copy only. */
const KIND_COPY: Record<RuntimeCandidateKind, { label: string; describes: string }> = {
  learning: { label: "Learning", describes: "What the organization has learned from settled experience." },
  optimization: { label: "Optimization", describes: "Where a grounded learning suggests a concrete improvement." },
  "awareness-signal": { label: "Awareness Signal", describes: "A single observation worth noticing, grounded in optimization." },
  "awareness-assessment": { label: "Awareness Assessment", describes: "A read of what a set of signals may mean together." },
  "evolution-readiness": { label: "Evolution Readiness", describes: "Whether the organization is ready to change in some direction." },
  "evolution-pathway": { label: "Evolution Pathway", describes: "A described route the organization could evolve along." },
};

export interface LifecycleStageView {
  readonly stage: RuntimeStageKind;
  readonly order: number;
  readonly label: string;
  readonly describes: string;
}

/** Static copy for each REAL Runtime stage. The stage set and order are real. */
const STAGE_COPY: Record<RuntimeStageKind, { label: string; describes: string }> = {
  input: { label: "Input", describes: "Settled Memory, Reasoning, and Assembly are read — never invented." },
  context: { label: "Context", describes: "The inputs are assembled into one bounded runtime context." },
  analysis: { label: "Analysis", describes: "The context is examined for what it may support." },
  "candidate-generation": { label: "Candidate", describes: "Attributable candidates are formed — each requiring an evidence basis." },
  validation: { label: "Validation", describes: "Candidates are validated; the unsupported are restricted, deferred, or escalated." },
  explanation: { label: "Explanation", describes: "Each candidate carries an explainability record, not hidden reasoning." },
  confidence: { label: "Confidence", describes: "A declared, ordinal confidence level is carried through — never a computed score." },
  governance: { label: "Governance", describes: "Applicable constraints and restrictions are exposed, never waived or enforced." },
  "director-approval": { label: "Director", describes: "The briefing terminates here, pending a human decision. The Runtime never decides." },
  output: { label: "Output", describes: "A preserved, non-authoritative briefing is handed to the Director and to Heby." },
};

export interface ConfidenceLevelView {
  readonly level: RuntimeConfidenceLevel;
  readonly order: number;
  readonly label: string;
}

const CONFIDENCE_COPY: Record<RuntimeConfidenceLevel, string> = {
  indeterminate: "Indeterminate",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

const RESTRICTION_COPY: Record<RuntimeRestrictionKind, { label: string; describes: string }> = {
  restrict: { label: "Restrict", describes: "Hold the candidate back rather than assert it." },
  defer: { label: "Defer", describes: "Wait for stronger grounds before surfacing." },
  escalate: { label: "Escalate", describes: "Raise it for a human to look at directly." },
};

export interface DependencyView {
  readonly kind: RuntimeDependencyKind;
  readonly label: string;
  readonly required: boolean;
  /** Honest connection state. No settled input is wired to the workspace yet. */
  readonly connected: false;
}

const DEPENDENCY_COPY: Record<RuntimeDependencyKind, string> = {
  "memory-context": "Memory Context",
  "reasoning-understanding": "Reasoning Understanding",
  "organization-assembly": "Organizational Assembly",
};

/** A humanized capability/prohibition string. The underlying token set is real. */
export interface AuthorityLine {
  readonly token: string;
  readonly label: string;
}

function humanizeToken(token: string): string {
  return token
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface IntelligenceWorkspaceModel {
  /** Real candidate-kind taxonomy — zero instances surfaced. */
  readonly kinds: readonly IntelligenceKindView[];
  /** Real Runtime lifecycle, ordered. Explanatory architecture, not telemetry. */
  readonly stages: readonly LifecycleStageView[];
  /** Real ordinal confidence levels. Not probabilities, not scores. */
  readonly confidenceLevels: readonly ConfidenceLevelView[];
  /** Real closed responses to a failed candidate. */
  readonly restrictions: readonly { kind: RuntimeRestrictionKind; label: string; describes: string }[];
  /** Real required upstream inputs — each honestly not connected. */
  readonly dependencies: readonly DependencyView[];
  /** What the Runtime is permitted to do (real, frozen). */
  readonly capabilities: readonly AuthorityLine[];
  /** What the Runtime must never do (real, frozen). */
  readonly prohibitions: readonly AuthorityLine[];
  /**
   * Populated emerging intelligence. Always empty: no candidate instances are
   * surfaced, and none are fabricated. The workspace renders honest states.
   */
  readonly emerging: readonly never[];
}

/**
 * Build the Intelligence Workspace model from REAL Runtime vocabulary only. Pure
 * and synchronous: reads frozen descriptor tables, joins human copy, fabricates
 * nothing.
 */
export function getIntelligenceWorkspaceModel(): IntelligenceWorkspaceModel {
  const kinds = Object.values(RUNTIME_CANDIDATE_KIND_DESCRIPTORS)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map<IntelligenceKindView>((descriptor) => ({
      kind: descriptor.candidateKind,
      label: KIND_COPY[descriptor.candidateKind].label,
      describes: KIND_COPY[descriptor.candidateKind].describes,
      sourcePhase: descriptor.sourcePhase,
      requiresBasis: descriptor.requiresBasis,
      surfaced: 0,
    }));

  const stages = Object.values(RUNTIME_STAGE_DESCRIPTORS)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map<LifecycleStageView>((descriptor) => ({
      stage: descriptor.stageKind,
      order: descriptor.order,
      label: STAGE_COPY[descriptor.stageKind].label,
      describes: STAGE_COPY[descriptor.stageKind].describes,
    }));

  const confidenceLevels = Object.values(RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map<ConfidenceLevelView>((descriptor) => ({
      level: descriptor.level,
      order: descriptor.order,
      label: CONFIDENCE_COPY[descriptor.level],
    }));

  const restrictions = Object.values(RUNTIME_RESTRICTION_DESCRIPTORS)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((descriptor) => ({
      kind: descriptor.restrictionKind,
      label: RESTRICTION_COPY[descriptor.restrictionKind].label,
      describes: RESTRICTION_COPY[descriptor.restrictionKind].describes,
    }));

  const dependencies = Object.values(RUNTIME_DEPENDENCY_KIND_DESCRIPTORS)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map<DependencyView>((descriptor) => ({
      kind: descriptor.dependencyKind,
      label: DEPENDENCY_COPY[descriptor.dependencyKind],
      required: descriptor.required,
      connected: false,
    }));

  const capabilities = RUNTIME_CAPABILITIES.map<AuthorityLine>((token) => ({
    token,
    label: humanizeToken(token),
  }));

  const prohibitions = RUNTIME_NON_RESPONSIBILITIES.map<AuthorityLine>((token) => ({
    token,
    label: humanizeToken(token),
  }));

  return {
    kinds,
    stages,
    confidenceLevels,
    restrictions,
    dependencies,
    capabilities,
    prohibitions,
    emerging: [],
  };
}
