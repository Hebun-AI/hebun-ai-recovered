/*
 * operations/operational-view.ts — pure view helpers for the Operations Workspace
 * (Hebun UI Phase 10).
 *
 * PROVENANCE CONTRACT (no-fake-data):
 *
 *   The only real operational data Hebun surfaces today is the non-authoritative
 *   Executive Overview (features/director-dashboard-executive-overview), derived by
 *   the widget runtime from the organization/agent/workflow runtime snapshots and
 *   observability evidence. It reports, per operational section, a health state, a
 *   record count, the widget source state, and a machine reason code, plus overall
 *   counts and freshness. It is `authoritative: false` and the Command Center
 *   already treats it as the real system/operational view.
 *
 *   This module only RE-FRAMES that real data for operational reading (section →
 *   operational label + source-state label). It computes no new number, invents no
 *   execution/workflow/task/event/failure/gate record, and derives no rate, score,
 *   duration, or trend. Individual operational records are not populated in this
 *   model, so the workspace renders honest empty states and drills through to the
 *   existing detail routes.
 */

import type {
  ExecutiveSection,
  ExecutiveSectionId,
} from "@/features/director-dashboard-executive-overview";

/** Human label + one-line operational meaning for each real section. Copy only. */
const SECTION_COPY: Record<ExecutiveSectionId, { label: string; describes: string }> = {
  "platform-status": { label: "Platform", describes: "The platform the work runs on." },
  "runtime-status": { label: "Runtime", describes: "The execution runtime itself." },
  "active-agents": { label: "Agents at work", describes: "Agents the runtime reports as active." },
  "active-workflows": { label: "Workflows", describes: "Workflows the runtime reports as active." },
  "monitoring-summary": { label: "Monitoring", describes: "What monitoring observes about live work." },
  "diagnostics-summary": { label: "Diagnostics", describes: "Diagnostic signals from running operations." },
  "evaluation-summary": { label: "Evaluation", describes: "Evaluation of operational output." },
  "authentication-summary": { label: "Authentication", describes: "Operational authentication surface." },
};

/** Readable label for the widget source state. Real value, humanized. */
const SOURCE_STATE_LABEL: Record<ExecutiveSection["sourceState"], string> = {
  loading: "Loading",
  ready: "Ready",
  empty: "No records",
  unavailable: "Unavailable",
  failed: "Failed",
};

export interface OperationalSectionView {
  readonly sectionId: ExecutiveSectionId;
  readonly label: string;
  readonly describes: string;
  readonly health: ExecutiveSection["health"];
  readonly recordCount: number;
  readonly sourceState: ExecutiveSection["sourceState"];
  readonly sourceStateLabel: string;
}

/** Re-frame a real ExecutiveSection into an operational view row. Pure. */
export function toOperationalSection(section: ExecutiveSection): OperationalSectionView {
  const copy = SECTION_COPY[section.sectionId];
  return {
    sectionId: section.sectionId,
    label: copy.label,
    describes: copy.describes,
    health: section.health,
    recordCount: section.recordCount,
    sourceState: section.sourceState,
    sourceStateLabel: SOURCE_STATE_LABEL[section.sourceState],
  };
}
