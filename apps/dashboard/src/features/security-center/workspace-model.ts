/*
 * security-center/workspace-model.ts — the Security Center page model (UI Phase 19).
 *
 * Composes the whole Governance Level-2 Security Center surface from REAL/STRUCTURAL vocabulary and
 * honest empties. It mirrors the Governance workspace honesty contract: it carries the security
 * source map, the signal-kind / finding-status / risk-class vocabularies, the structural response
 * options, and the inspector lenses — and every populated collection (findings, signals, incidents,
 * timeline) is ALWAYS empty. Device security is read from the real, disconnected Phase 18 boundary.
 * It fabricates no incident, finding, signal, attacker, CVE, score, timestamp, or evidence. Pure.
 */

import {
  SECURITY_FINDING_STATUSES,
  SECURITY_RISK_CLASSES,
  SECURITY_SIGNAL_KINDS,
  type SecurityCenterModel,
  type SecurityInspectorLens,
} from "./contracts";
import { listSecuritySources } from "./source-map";
import { listSecuritySignals } from "./signals";
import { listSecurityFindings } from "./findings";
import { listResponseOptions } from "./response-options";
import { getSecurityStateStrip, getDeviceSecuritySummary } from "./security-state";
import { getSecurityPipeline } from "./pipeline";
import { listSecurityDomains } from "./domains";
import { getSecurityArchitecture } from "./architecture";

/** The investigation inspector lenses. Instructional only — nothing is selectable in Phase 19. */
export const SECURITY_INSPECTOR_LENSES: readonly SecurityInspectorLens[] = Object.freeze([
  { facet: "Overview", question: "What security state is this?" },
  { facet: "Signals", question: "What raw signals relate to it?" },
  { facet: "Evidence", question: "What evidence supports it?" },
  { facet: "Identity", question: "Which identity or access is involved?" },
  { facet: "Device", question: "Which device or session is involved?" },
  { facet: "Policy", question: "What policy or control applies?" },
  { facet: "Timeline", question: "What is the sequence of events?" },
  { facet: "Provenance", question: "Where did this come from?" },
  { facet: "Uncertainty", question: "What remains uncertain?" },
]);

export function getSecurityCenterModel(tenantId: string): SecurityCenterModel {
  return {
    stateStrip: getSecurityStateStrip(),
    sources: listSecuritySources(),
    signalKinds: SECURITY_SIGNAL_KINDS,
    findingStatuses: SECURITY_FINDING_STATUSES,
    riskClasses: SECURITY_RISK_CLASSES,
    responseOptions: listResponseOptions(),
    inspectorLenses: SECURITY_INSPECTOR_LENSES,
    pipeline: getSecurityPipeline(),
    domains: listSecurityDomains(),
    architecture: getSecurityArchitecture(),
    findings: listSecurityFindings(tenantId),
    signals: listSecuritySignals(tenantId),
    incidents: [],
    timeline: [],
    deviceSecurity: getDeviceSecuritySummary(),
  };
}
