/*
 * platform/workspace-model.ts — the read model for the Platform Workspace
 * (Hebun UI Phase 13).
 *
 * PROVENANCE CONTRACT (no-fake-data):
 *
 *   Hebun has real provider/capability CONTRACT VOCABULARY but no populated,
 *   Director-safe integration or configured-provider records. The integrations
 *   feature is a mock ("Gmail connected, 12 events today"), and the provider
 *   matrix's catalog/health/metrics are seeded — none is surfaced here. No secret,
 *   API key, credential, or user record is ever rendered.
 *
 *   The only REAL, safe platform values are (a) the non-authoritative Executive
 *   Overview technical dependency sections (platform, runtime, monitoring,
 *   diagnostics, evaluation, authentication — each with a health state and widget
 *   source state), presented here as technical DEPENDENCY availability, and (b) the
 *   provider-matrix vocabulary (capabilities, capability support, execution modes,
 *   gap status), bound to its contract types with `satisfies` so drift breaks the
 *   build. Everything else is honest empty. This model fabricates no integration,
 *   provider, model, credential, uptime, latency, cost, or usage value.
 */

import type {
  CapabilitySupport,
  ExecutionModeKind,
  GapStatus,
  MatrixCapability,
} from "@/features/provider-matrix/types";
import type {
  ExecutiveSection,
  ExecutiveSectionId,
} from "@/features/director-dashboard-executive-overview";

/*
 * The Executive Overview sections that describe the TECHNICAL SUBSTRATE Platform
 * owns. The workforce-oriented sections (active-agents, active-workflows) belong to
 * Operations and are intentionally excluded here.
 */
const TECHNICAL_SECTION_COPY: Partial<Record<ExecutiveSectionId, { label: string; describes: string }>> = {
  "platform-status": { label: "Platform", describes: "The platform substrate Hebun runs on." },
  "runtime-status": { label: "Runtime", describes: "The execution runtime dependency." },
  "monitoring-summary": { label: "Monitoring", describes: "The monitoring dependency." },
  "diagnostics-summary": { label: "Diagnostics", describes: "The diagnostics dependency." },
  "evaluation-summary": { label: "Evaluation", describes: "The evaluation dependency." },
  "authentication-summary": { label: "Authentication", describes: "The authentication dependency." },
};

const SOURCE_STATE_LABEL: Record<ExecutiveSection["sourceState"], string> = {
  loading: "Loading",
  ready: "Available",
  empty: "No records",
  unavailable: "Unavailable",
  failed: "Failed",
};

export interface PlatformDependencyView {
  readonly sectionId: ExecutiveSectionId;
  readonly label: string;
  readonly describes: string;
  readonly health: ExecutiveSection["health"];
  readonly sourceState: ExecutiveSection["sourceState"];
  readonly sourceStateLabel: string;
}

/**
 * Re-frame the real technical Executive Overview sections as platform dependency
 * availability rows. Non-technical (workforce) sections are dropped. Pure.
 */
export function toPlatformDependencies(
  sections: readonly ExecutiveSection[],
): readonly PlatformDependencyView[] {
  return sections
    .filter((section) => TECHNICAL_SECTION_COPY[section.sectionId])
    .map((section) => {
      const copy = TECHNICAL_SECTION_COPY[section.sectionId]!;
      return {
        sectionId: section.sectionId,
        label: copy.label,
        describes: copy.describes,
        health: section.health,
        sourceState: section.sourceState,
        sourceStateLabel: SOURCE_STATE_LABEL[section.sourceState],
      };
    });
}

/** A platform capability the provider matrix recognises. Copy over a real value. */
export interface CapabilityView {
  readonly capability: MatrixCapability;
}

const CAPABILITIES = [
  { capability: "Reasoning" },
  { capability: "Code Generation" },
  { capability: "Repository" },
  { capability: "Browser" },
  { capability: "Desktop" },
  { capability: "Communication" },
  { capability: "Planning" },
  { capability: "Execution" },
  { capability: "Review" },
  { capability: "Knowledge Retrieval" },
  { capability: "Search" },
  { capability: "Human Approval" },
  { capability: "Simulation" },
  { capability: "Future Live" },
] as const satisfies readonly { capability: MatrixCapability }[];

export interface SupportView {
  readonly support: CapabilitySupport;
  readonly label: string;
}

const SUPPORT_LEVELS = [
  { support: "primary", label: "Primary" },
  { support: "secondary", label: "Secondary" },
  { support: "unsupported", label: "Unsupported" },
] as const satisfies readonly { support: CapabilitySupport; label: string }[];

export interface ExecutionModeView {
  readonly mode: ExecutionModeKind;
}

const EXECUTION_MODES = [
  { mode: "Simulation" },
  { mode: "Dry Run" },
  { mode: "Approval Required" },
  { mode: "Read Only" },
  { mode: "Planning Only" },
  { mode: "Future Live" },
] as const satisfies readonly { mode: ExecutionModeKind }[];

export interface GapStatusView {
  readonly status: GapStatus;
  readonly label: string;
}

const GAP_STATUSES = [
  { status: "covered", label: "Covered" },
  { status: "partial", label: "Partial" },
  { status: "missing", label: "Missing" },
] as const satisfies readonly { status: GapStatus; label: string }[];

/** One inspector lens. Instructional only — nothing is selectable yet. */
export interface PlatformLensView {
  readonly facet: string;
  readonly question: string;
}

const INSPECTOR_LENSES: readonly PlatformLensView[] = [
  { facet: "Overview", question: "What is this connection or dependency?" },
  { facet: "Capabilities", question: "What does it provide?" },
  { facet: "Dependencies", question: "What does it depend on?" },
  { facet: "Configuration", question: "How is it configured?" },
  { facet: "Health", question: "Is it available?" },
  { facet: "Governance", question: "What constraints apply?" },
  { facet: "Provenance", question: "Where did this come from?" },
];

export interface PlatformWorkspaceModel {
  readonly capabilities: readonly CapabilityView[];
  readonly supportLevels: readonly SupportView[];
  readonly executionModes: readonly ExecutionModeView[];
  readonly gapStatuses: readonly GapStatusView[];
  readonly inspectorLenses: readonly PlatformLensView[];
  /** Populated integrations. Always empty: the mock is excluded, none fabricated. */
  readonly integrations: readonly never[];
  /** Populated configured providers. Always empty: none is configured or faked. */
  readonly providers: readonly never[];
}

/** Build the Platform Workspace vocabulary model. Pure; fabricates nothing. */
export function getPlatformWorkspaceModel(): PlatformWorkspaceModel {
  return {
    capabilities: CAPABILITIES.map((entry) => ({ ...entry })),
    supportLevels: SUPPORT_LEVELS.map((entry) => ({ ...entry })),
    executionModes: EXECUTION_MODES.map((entry) => ({ ...entry })),
    gapStatuses: GAP_STATUSES.map((entry) => ({ ...entry })),
    inspectorLenses: INSPECTOR_LENSES,
    integrations: [],
    providers: [],
  };
}
