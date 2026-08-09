/*
 * workforce/capabilities-model.ts — the authoritative Capabilities read model (UI Phase 25C).
 *
 * Capabilities answers: what is this workforce structurally DECLARED capable of? It aggregates
 * the declared capabilities, referenced tools, and declared permissions on the seeded agent
 * definitions (agent-crud) — the same single seam as the Agents truth surface.
 *
 * The whole point of this surface is to keep six things separate and never collapse them:
 *   DECLARED CAPABILITY  ≠  CONNECTED TOOL  ≠  GRANTED PERMISSION  ≠  AUTHORIZATION  ≠
 *   EXECUTION  ≠  SUCCESS.
 *
 * Authority ownership is explicit and never absorbed:
 *   - Workforce DECLARES capabilities.
 *   - Platform owns tool/provider connection.
 *   - Governance owns policy applicability; Decisions owns the human authorization.
 *   - Operations owns execution.
 * This surface therefore carries NO grant/revoke/approve/authorize/enable/connect/execute/dispatch
 * control, and no fake health/activity/performance score. It reports counts and categories only.
 */

import { getSnapshot } from "@/features/agent-crud/agent-adapter";
import type { AgentCrudRecord } from "@/features/agent-crud/types";

export type CapabilityProvenance = "declared-seeded" | "referenced-unconnected" | "declared-not-granted";

export interface CapabilityAggregate {
  readonly name: string;
  /** How many active definitions declare/reference this. A real structural count — not a score. */
  readonly declaredBy: number;
}

export type LadderState = "reached" | "not-reached";

export interface CapabilityLadderStage {
  readonly key: string;
  readonly label: string;
  readonly state: LadderState;
  readonly detail: string;
}

export interface AuthorityOwnershipRow {
  readonly concept: string;
  readonly owner: string;
  readonly note: string;
}

export interface CapabilitiesModel {
  readonly declaredCapabilities: readonly CapabilityAggregate[];
  readonly referencedTools: readonly CapabilityAggregate[];
  readonly declaredPermissions: readonly CapabilityAggregate[];
  readonly capabilityLadder: readonly CapabilityLadderStage[];
  readonly authorityOwnership: readonly AuthorityOwnershipRow[];
  readonly runtimeMode: string;
  /** Always false — no execution substrate is connected. */
  readonly executionAvailable: boolean;
  readonly definitionCount: number;
  readonly provenanceNote: string;
}

function aggregate(records: readonly AgentCrudRecord[], pick: (r: AgentCrudRecord) => readonly string[]): CapabilityAggregate[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const value of pick(record)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, declaredBy]) => ({ name, declaredBy }))
    .sort((a, b) => b.declaredBy - a.declaredBy || a.name.localeCompare(b.name));
}

function deriveRuntimeMode(records: readonly AgentCrudRecord[]): string {
  const modes = new Set(records.map((record) => record.runtime));
  if (modes.size === 0) return "none";
  if (modes.size === 1) return [...modes][0] ?? "unknown";
  return "mixed";
}

const AUTHORITY_OWNERSHIP: readonly AuthorityOwnershipRow[] = [
  { concept: "Declared capability", owner: "Workforce", note: "A definition declares what it is meant to be capable of." },
  { concept: "Tool / provider connection", owner: "Platform", note: "Tools and providers are referenced descriptors — Platform owns whether one is connected." },
  { concept: "Permission grant", owner: "Governance · Decisions", note: "Permissions are declared here; Governance rules apply and a human grants via Decisions." },
  { concept: "Execution", owner: "Operations", note: "Running a capability is owned by Operations; nothing executes here." },
];

export function getCapabilitiesModel(): CapabilitiesModel {
  const active = getSnapshot().filter((record: AgentCrudRecord) => record.lifecycleStatus === "active");
  const runtimeMode = deriveRuntimeMode(active);

  const capabilityLadder: CapabilityLadderStage[] = [
    { key: "declared", label: "Declared", state: "reached", detail: "Definitions declare capabilities. This is a declaration, not an ability." },
    { key: "tool-connected", label: "Tool connected", state: "not-reached", detail: "Referenced tools are offline descriptors owned by Platform — none is connected." },
    { key: "permission-granted", label: "Permission granted", state: "not-reached", detail: "Permissions are declared, not granted. Governance applies; Decisions authorizes." },
    { key: "authorized", label: "Authorized", state: "not-reached", detail: "Human authorization is owned by Decisions; nothing is authorized here." },
    { key: "executed", label: "Executed", state: "not-reached", detail: `Runtime is "${runtimeMode}" and execution is owned by Operations — nothing runs.` },
    { key: "successful", label: "Successful", state: "not-reached", detail: "No capability has executed, so no success is observed." },
  ];

  return {
    declaredCapabilities: aggregate(active, (r) => r.capabilities),
    referencedTools: aggregate(active, (r) => r.tools),
    declaredPermissions: aggregate(active, (r) => r.permissions),
    capabilityLadder,
    authorityOwnership: AUTHORITY_OWNERSHIP,
    runtimeMode,
    executionAvailable: false,
    definitionCount: active.length,
    provenanceNote:
      "Every capability, tool, and permission below is DECLARED or REFERENCED on seeded agent definitions. Declaration is not a connected tool, a granted permission, an authorization, an execution, or a success.",
  };
}
