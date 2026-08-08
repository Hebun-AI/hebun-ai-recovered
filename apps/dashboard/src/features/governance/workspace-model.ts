/*
 * governance/workspace-model.ts — the read model for the Governance Workspace
 * (Hebun UI Phase 12).
 *
 * PROVENANCE CONTRACT (no-fake-data):
 *
 *   Hebun has real governance/policy/approval CONTRACT VOCABULARY but no populated,
 *   Director-safe governance instances. The seeded governance data (this feature's
 *   policies.ts / risk.ts / compliance.ts / audit.ts, and the policy engine's
 *   built registry) is SYNTHETIC and powers only the legacy /director/governance/*
 *   pages. The human-approval engine operates over SIMULATED execution and persists
 *   no approvals (the Decision Center records "simulated Director intent only").
 *   None of that feeds this workspace.
 *
 *   This model therefore carries only the REAL, canonical governance vocabulary —
 *   the governance decision statuses, the approval modes, the policy categories,
 *   the policy check statuses, the approval risk classes, the human-approval
 *   statuses, and the governance pipeline stages — each bound to its contract type
 *   with `satisfies` so vocabulary drift breaks the build. It fabricates no policy,
 *   risk, approval request, violation, evidence record, count, score, percentage,
 *   actor, or timestamp. Every place populated governance data would appear renders
 *   an honest empty state. Governance here inspects and explains; it grants no
 *   authority.
 */

import type { ApprovalRisk } from "@/types";
import type { HumanApprovalStatus, HumanApprovalHistoryEntry } from "@/features/human-approval/types";
import type {
  ApprovalMode,
  GovernanceDecisionStatus,
  PolicyCategory,
  PolicyCheckStatus,
} from "@/features/policy/types";

/** A governance decision status the model recognises, joined to explanatory copy. */
export interface DecisionStatusView {
  readonly status: GovernanceDecisionStatus;
  readonly label: string;
  readonly describes: string;
  /** Whether this status withholds the action pending human authority. */
  readonly gated: boolean;
}

/*
 * The real governance authority gradient. Order runs from least to most
 * constrained; the ordering is presentational only and confers no authority.
 */
const DECISION_STATUSES = [
  { status: "allow", label: "Allow", describes: "No human authority required.", gated: false },
  { status: "allow-with-review", label: "Allow with review", describes: "Proceeds, but a human review is expected.", gated: false },
  { status: "approval-required", label: "Approval required", describes: "Held until a human explicitly approves.", gated: true },
  { status: "blocked", label: "Blocked", describes: "Not permitted under current governance.", gated: true },
] as const satisfies readonly { status: GovernanceDecisionStatus; label: string; describes: string; gated: boolean }[];

export interface ApprovalModeView {
  readonly mode: ApprovalMode;
  readonly label: string;
}

/** The real approval modes — who must act when authority is required. */
const APPROVAL_MODES = [
  { mode: "none", label: "None" },
  { mode: "manager", label: "Manager" },
  { mode: "director", label: "Director" },
  { mode: "executive", label: "Executive" },
  { mode: "multi-stage", label: "Multi-stage" },
  { mode: "human-review", label: "Human review" },
  { mode: "emergency-override", label: "Emergency override" },
] as const satisfies readonly { mode: ApprovalMode; label: string }[];

export interface PolicyCategoryView {
  readonly category: PolicyCategory;
  readonly label: string;
}

const POLICY_CATEGORIES = [
  { category: "business", label: "Business" },
  { category: "security", label: "Security" },
  { category: "compliance", label: "Compliance" },
  { category: "financial", label: "Financial" },
  { category: "hr", label: "HR" },
  { category: "it", label: "IT" },
  { category: "ai", label: "AI" },
  { category: "workflow", label: "Workflow" },
  { category: "approval", label: "Approval" },
  { category: "data-access", label: "Data access" },
  { category: "risk", label: "Risk" },
] as const satisfies readonly { category: PolicyCategory; label: string }[];

export interface CheckStatusView {
  readonly status: PolicyCheckStatus;
  readonly label: string;
}

const CHECK_STATUSES = [
  { status: "pass", label: "Pass" },
  { status: "watch", label: "Watch" },
  { status: "fail", label: "Fail" },
] as const satisfies readonly { status: PolicyCheckStatus; label: string }[];

export interface RiskClassView {
  readonly risk: ApprovalRisk;
  readonly label: string;
}

const RISK_CLASSES = [
  { risk: "low", label: "Low" },
  { risk: "medium", label: "Medium" },
  { risk: "high", label: "High" },
  { risk: "critical", label: "Critical" },
] as const satisfies readonly { risk: ApprovalRisk; label: string }[];

export interface ApprovalStatusView {
  readonly status: HumanApprovalStatus;
  readonly label: string;
}

const APPROVAL_STATUSES = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
  { status: "changes-requested", label: "Changes requested" },
] as const satisfies readonly { status: HumanApprovalStatus; label: string }[];

export interface PipelineStageView {
  readonly stage: HumanApprovalHistoryEntry["stage"];
  readonly label: string;
  readonly describes: string;
}

/** The real governance/approval pipeline stages. Process description, not telemetry. */
const PIPELINE_STAGES = [
  { stage: "inspect", label: "Inspect", describes: "The action and its context are read." },
  { stage: "policy", label: "Policy", describes: "Applicable policy is evaluated against it." },
  { stage: "resolve", label: "Resolve", describes: "The governance decision status is resolved." },
  { stage: "validate", label: "Validate", describes: "The resolution is validated for completeness." },
  { stage: "report", label: "Report", describes: "The outcome is reported for the human record." },
] as const satisfies readonly { stage: HumanApprovalHistoryEntry["stage"]; label: string; describes: string }[];

/** One inspector lens. Instructional only — nothing is selectable yet. */
export interface GovernanceLensView {
  readonly facet: string;
  readonly question: string;
}

const INSPECTOR_LENSES: readonly GovernanceLensView[] = [
  { facet: "Policy", question: "What rule governs this?" },
  { facet: "Applicability", question: "What does it apply to?" },
  { facet: "Restriction", question: "What does it restrict?" },
  { facet: "Authority", question: "What authority does it require?" },
  { facet: "Risk", question: "What risk is associated?" },
  { facet: "Evidence", question: "What supports this state?" },
  { facet: "Provenance", question: "Where did this come from?" },
  { facet: "History", question: "How did it change?" },
];

export interface GovernanceWorkspaceModel {
  readonly decisionStatuses: readonly DecisionStatusView[];
  readonly approvalModes: readonly ApprovalModeView[];
  readonly policyCategories: readonly PolicyCategoryView[];
  readonly checkStatuses: readonly CheckStatusView[];
  readonly riskClasses: readonly RiskClassView[];
  readonly approvalStatuses: readonly ApprovalStatusView[];
  readonly pipelineStages: readonly PipelineStageView[];
  readonly inspectorLenses: readonly GovernanceLensView[];
  /** Populated policies/controls. Always empty: none is surfaced or fabricated. */
  readonly controls: readonly never[];
}

/** Build the Governance Workspace model from REAL vocabulary only. Pure. */
export function getGovernanceWorkspaceModel(): GovernanceWorkspaceModel {
  return {
    decisionStatuses: DECISION_STATUSES.map((entry) => ({ ...entry })),
    approvalModes: APPROVAL_MODES.map((entry) => ({ ...entry })),
    policyCategories: POLICY_CATEGORIES.map((entry) => ({ ...entry })),
    checkStatuses: CHECK_STATUSES.map((entry) => ({ ...entry })),
    riskClasses: RISK_CLASSES.map((entry) => ({ ...entry })),
    approvalStatuses: APPROVAL_STATUSES.map((entry) => ({ ...entry })),
    pipelineStages: PIPELINE_STAGES.map((entry) => ({ ...entry })),
    inspectorLenses: INSPECTOR_LENSES,
    controls: [],
  };
}
