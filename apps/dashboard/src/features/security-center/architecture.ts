/*
 * security-center/architecture.ts — Hebun's security ownership flow (UI refinement).
 *
 * The real ownership boundaries, using real system names — never a fake animated network, agent
 * swarm, or "AI orchestrator online". Technical state → security intelligence → governance/authority
 * → prepared action (Phase 17) → device/tool runtime (Phase 18) → receipt/audit.
 */

import type { SecurityArchitectureLayer } from "./contracts";

export function getSecurityArchitecture(): readonly SecurityArchitectureLayer[] {
  return [
    { layer: "Technical State", owner: "Platform / Operations", flowLabel: "evidence", describes: "Devices, providers, integrations, runtime — the non-authoritative technical state." },
    { layer: "Security Intelligence", owner: "Security Center", flowLabel: "policy / authority", describes: "Interprets technical state as security signals and findings. Detects, explains, prepares." },
    { layer: "Governance & Decisions", owner: "Governance / Decisions", flowLabel: "prepared action", describes: "Policy and the human authority act. A consequential response is decided here." },
    { layer: "Action Layer", owner: "Phase 17 heby-actions", flowLabel: "execution", describes: "Prepares and gates a controlled action — capability, governance, authority, eligibility." },
    { layer: "Device / Tool Runtime", owner: "Phase 18 device-runtime", flowLabel: "result", describes: "Would execute a permitted action. Disconnected — nothing runs today." },
    { layer: "Receipt / Audit", owner: "Runtime provenance", flowLabel: "", describes: "A validated receipt of what actually ran. No persisted forensic history exists yet." },
  ];
}
