/*
 * security-center/pipeline.ts — the real Phase 19 security flow, stage by stage (UI refinement).
 *
 * A structural, derived-from-contracts view of how Hebun security works — NOT an animated activity
 * stream. Each stage carries an honest, color-independent availability state so an unavailable
 * stage reads as unavailable, not as decoration. It fabricates no signal, evidence, finding, or
 * event; it explains the architecture without inventing activity.
 */

import type { SecurityPipelineStage } from "./contracts";

/** The end-to-end flow: source → signal → … → receipt/audit, each with its honest state. */
export function getSecurityPipeline(): readonly SecurityPipelineStage[] {
  return [
    { stage: "sources", label: "Sources", state: "derived", detail: "Derived technical state and not-connected feeds." },
    { stage: "signals", label: "Signals", state: "none", detail: "No signal surfaced — no live feed." },
    { stage: "evidence", label: "Evidence", state: "none", detail: "No security evidence retained." },
    { stage: "correlation", label: "Correlation", state: "not-available", detail: "No correlation engine is connected." },
    { stage: "finding", label: "Finding", state: "none", detail: "No validated finding — none is fabricated." },
    { stage: "investigation", label: "Investigation", state: "structural", detail: "Lenses ready; nothing selected." },
    { stage: "governance", label: "Governance", state: "structural", detail: "Structural — no live policy evaluator." },
    { stage: "response-option", label: "Response option", state: "structural", detail: "Structural options only — not actions." },
    { stage: "prepared-action", label: "Phase 17 prepared action", state: "structural", detail: "Would route through the Phase 17 action pipeline." },
    { stage: "human-authority", label: "Human authority", state: "human-authority", detail: "A human decides in Decisions." },
    { stage: "runtime", label: "Phase 18 / tool runtime", state: "not-connected", detail: "Device Runtime is not connected." },
    { stage: "receipt-audit", label: "Receipt / audit", state: "not-available", detail: "No receipt; no persisted audit." },
  ];
}
