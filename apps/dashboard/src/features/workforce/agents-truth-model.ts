/*
 * workforce/agents-truth-model.ts — the authoritative Agents read model (UI Phase 25B).
 *
 * Director-locked definition: Workforce = WHO can perform work. The /agents surface must
 * present agent DEFINITIONS honestly and MUST NOT present seeded runtime activity as live
 * organizational truth. This model is the single read seam the authoritative Agents UI
 * consumes: it never exposes raw runtime/projection objects, and it never surfaces
 * tasksToday / costToday / lastActive / live status / workload / queue as live facts.
 *
 * Every value carries an explicit provenance class, and the classes are never collapsed:
 *
 *   structural           — a real, present fact: an id, a declared field, the active
 *                          persistence provider, CRUD availability.
 *   seeded               — originates from features/agents/mock.ts (record.createdBy === "Seed").
 *   derived-from-seeded  — computed from seeded stores; not surfaced as live.
 *   simulated            — runtime mode / projection status; there is no real runtime.
 *   unavailable          — NOT connected: live activity, execution, live provider invocation,
 *                          durable persistence, Computer Use.
 *
 * Substrate facts are recomputed from repository evidence, not asserted blindly:
 *   - persistenceProvider is read from the live persistence layer (activeProvider()).
 *   - durablePersistence is derived: any provider other than "memory" is durable.
 *   - runtimeMode is derived from the definitions' declared runtime field.
 * Execution / live-provider / Computer-Use remain unavailable because Phase 25A discovery
 * proved no such substrate exists in this repository; they flip only when one is connected.
 */

import { getSnapshot } from "@/features/agent-crud/agent-adapter";
import { activeProvider } from "@/features/persistence";
import type { AgentCrudRecord } from "@/features/agent-crud/types";
import type { AgentStatus } from "@/types";

export type ProvenanceClass =
  | "structural"
  | "seeded"
  | "derived-from-seeded"
  | "simulated"
  | "unavailable";

/** The marker `agent-crud` writes on seed-origin definitions. */
const SEED_MARKER = "Seed";

export interface ProvenanceLegendEntry {
  readonly provenance: ProvenanceClass;
  readonly label: string;
  readonly describes: string;
}

/**
 * An agent DEFINITION — declared structure only. It deliberately carries NO live-activity
 * field (no tasksToday, costToday, lastActive, workload, queue). `seededStatus` is a seeded
 * definition attribute, explicitly NOT a live signal, and is rendered as such.
 */
export interface AgentDefinitionView {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly department: string;
  readonly declaredCapabilities: readonly string[];
  readonly declaredTools: readonly string[];
  /** Declared permissions — a declaration, NOT a grant (grants are owned by Decisions/Governance). */
  readonly declaredPermissions: readonly string[];
  /** Provider reference — Platform-owned descriptor; not a connected provider. */
  readonly referencedProvider: string;
  /** Model reference — Platform-owned descriptor; not a connected model. */
  readonly referencedModel: string;
  /** Declared runtime mode (e.g. "simulation"). */
  readonly runtimeMode: string;
  readonly lifecycleStatus: AgentCrudRecord["lifecycleStatus"];
  /** Where the definition came from. */
  readonly origin: "seeded" | "user-defined";
  /** Seeded status attribute — a definition attribute, NOT a live signal. */
  readonly seededStatus: AgentStatus;
}

export type LadderState = "reached" | "not-reached" | "not-applicable";

/** One rung of the definition → execution ladder. */
export interface ExecutionLadderStage {
  readonly key: string;
  readonly label: string;
  readonly state: LadderState;
  readonly provenance: ProvenanceClass;
  readonly detail: string;
}

export interface AgentsTruthModel {
  /* Counts — structural. */
  readonly definitionCount: number;
  readonly seededDefinitionCount: number;
  readonly userDefinedCount: number;
  readonly activeDefinitionCount: number;
  /* Substrate truth. */
  readonly persistenceProvider: string;
  readonly durablePersistence: boolean;
  readonly runtimeMode: string;
  readonly crudAvailable: boolean;
  readonly liveExecutionAvailable: boolean;
  readonly liveProviderInvocation: boolean;
  readonly computerUseAvailable: boolean;
  readonly referencedProviders: readonly string[];
  /* Rows, ladder, legend. */
  readonly definitions: readonly AgentDefinitionView[];
  readonly executionLadder: readonly ExecutionLadderStage[];
  readonly provenanceLegend: readonly ProvenanceLegendEntry[];
}

function toDefinitionView(record: AgentCrudRecord): AgentDefinitionView {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    department: record.department,
    declaredCapabilities: record.capabilities,
    declaredTools: record.tools,
    declaredPermissions: record.permissions,
    referencedProvider: record.provider,
    referencedModel: record.model,
    runtimeMode: record.runtime,
    lifecycleStatus: record.lifecycleStatus,
    origin: record.createdBy === SEED_MARKER ? "seeded" : "user-defined",
    seededStatus: record.status,
  };
}

function deriveRuntimeMode(records: readonly AgentCrudRecord[]): string {
  const modes = new Set(records.map((record) => record.runtime));
  if (modes.size === 0) return "none";
  if (modes.size === 1) return [...modes][0] ?? "unknown";
  return "mixed";
}

function buildLadder(
  definitionCount: number,
  provider: string,
  durable: boolean,
  runtimeMode: string,
): ExecutionLadderStage[] {
  return [
    {
      key: "defined",
      label: "Defined",
      state: definitionCount > 0 ? "reached" : "not-reached",
      provenance: "structural",
      detail: `${definitionCount} agent definitions exist in the registry.`,
    },
    {
      key: "configured",
      label: "Configured",
      state: definitionCount > 0 ? "reached" : "not-reached",
      provenance: "seeded",
      detail: "Definitions declare capabilities, tools, and provider/model references.",
    },
    {
      key: "persisted-durable",
      label: "Persisted (durable)",
      state: durable ? "reached" : "not-reached",
      provenance: durable ? "structural" : "unavailable",
      detail: durable
        ? `Durable persistence via the "${provider}" provider.`
        : `In-memory only via the "${provider}" provider — not durable across restart, no database write.`,
    },
    {
      key: "runtime-available",
      label: "Runtime available",
      state: runtimeMode === "simulation" || runtimeMode === "none" ? "not-reached" : "not-reached",
      provenance: "simulated",
      detail: `Runtime mode is "${runtimeMode}" — no real agent runtime is available.`,
    },
    {
      key: "connected",
      label: "Provider connected",
      state: "not-reached",
      provenance: "unavailable",
      detail: "No live provider is connected; provider references are offline descriptors owned by Platform.",
    },
    {
      key: "authorized",
      label: "Authorized",
      state: "not-applicable",
      provenance: "unavailable",
      detail: "Human authority is owned by Decisions; no execution reaches an authorization gate.",
    },
    {
      key: "executed",
      label: "Executed",
      state: "not-reached",
      provenance: "unavailable",
      detail: "No execution substrate is connected; execution is owned by Operations.",
    },
    {
      key: "successful",
      label: "Successful",
      state: "not-reached",
      provenance: "unavailable",
      detail: "No execution has run, so no success is observed.",
    },
  ];
}

const PROVENANCE_LEGEND: readonly ProvenanceLegendEntry[] = [
  { provenance: "structural", label: "Structural", describes: "A real, present fact — an id, a declared field, the active storage provider." },
  { provenance: "seeded", label: "Seeded", describes: "Originates from the built-in seed roster. A definition, not a live workforce." },
  { provenance: "derived-from-seeded", label: "Derived", describes: "Computed from seeded stores. Not surfaced as live activity." },
  { provenance: "simulated", label: "Simulated", describes: "Runtime mode and projection status. There is no real runtime." },
  { provenance: "unavailable", label: "Not connected", describes: "Live activity, execution, live providers, durable storage, and Computer Use are not connected." },
];

/**
 * Build the authoritative Agents truth model. Pure and deterministic: it reads the current
 * in-memory definition snapshot and the live persistence provider, and fabricates nothing.
 */
export function getAgentsTruthModel(): AgentsTruthModel {
  const records = getSnapshot();
  const provider = activeProvider();
  const durable = provider !== "memory";
  const runtimeMode = deriveRuntimeMode(records);
  const seededCount = records.filter((record) => record.createdBy === SEED_MARKER).length;
  const activeCount = records.filter((record) => record.lifecycleStatus === "active").length;
  const referencedProviders = [...new Set(records.map((record) => record.provider))];

  return {
    definitionCount: records.length,
    seededDefinitionCount: seededCount,
    userDefinedCount: records.length - seededCount,
    activeDefinitionCount: activeCount,
    persistenceProvider: provider,
    durablePersistence: durable,
    runtimeMode,
    // Real in-memory definition CRUD exists (agent-crud service + Command Bus).
    crudAvailable: true,
    // No execution / live-provider / Computer-Use substrate exists in this repository
    // (Phase 25A). These remain false until such a substrate is actually connected.
    liveExecutionAvailable: false,
    liveProviderInvocation: false,
    computerUseAvailable: false,
    referencedProviders,
    definitions: records.map(toDefinitionView),
    executionLadder: buildLadder(records.length, provider, durable, runtimeMode),
    provenanceLegend: PROVENANCE_LEGEND,
  };
}
