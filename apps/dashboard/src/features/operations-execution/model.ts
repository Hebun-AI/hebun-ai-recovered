/*
 * operations-execution/model.ts — builds the Execution surface from REAL contracts,
 * read-only (Hebun UI Phase 22B).
 *
 * Capability truth comes from the Phase 17 action registry (heby-actions · listActionTools,
 * INVOKABLE_SIDE_EFFECTS) and the Phase 18 device runtime (device-runtime ·
 * listCapabilityDescriptors). It never imports execution/mock, never fabricates a run,
 * receipt, timestamp, or status, and never invents an "AUTHORIZED" lifecycle state.
 */

import { listActionTools } from "@/features/heby-actions";
import { INVOKABLE_SIDE_EFFECTS, type ToolSideEffectClass } from "@/features/heby-runtime";
import { listCapabilityDescriptors } from "@/features/device-runtime";
import type {
  AuthorityStageView,
  ExecutionCapabilityRow,
  ExecutionCapabilityStatus,
  ExecutionDeviceRow,
  ExecutionSurfaceModel,
} from "./contracts";

const CLASS_ORDER: readonly ToolSideEffectClass[] = [
  "READ_ONLY",
  "PREPARATION_ONLY",
  "REVERSIBLE_MUTATION",
  "CONSEQUENTIAL_MUTATION",
  "DEVICE_ACTION",
];

const CLASS_LABEL: Record<ToolSideEffectClass, string> = {
  READ_ONLY: "Read-only actions",
  PREPARATION_ONLY: "Preparation-only actions",
  REVERSIBLE_MUTATION: "Reversible mutations",
  CONSEQUENTIAL_MUTATION: "Consequential mutations",
  DEVICE_ACTION: "Device actions",
};

const CLASS_DETAIL: Record<ToolSideEffectClass, string> = {
  READ_ONLY: "Inspect state and resolve navigation. The only class with a connected substrate.",
  PREPARATION_ONLY: "Prepare a plan without causing any side effect. Described, never executed.",
  REVERSIBLE_MUTATION: "Would change state with a deterministic inverse. No substrate is connected.",
  CONSEQUENTIAL_MUTATION: "Irreversible; requires a human authority. No substrate is connected.",
  DEVICE_ACTION: "Device/Computer-Use side effects. Restricted and not implemented.",
};

function statusForClass(cls: ToolSideEffectClass, substrateConnected: boolean): ExecutionCapabilityStatus {
  if (INVOKABLE_SIDE_EFFECTS.includes(cls) && substrateConnected) return "available";
  if (cls === "PREPARATION_ONLY") return "prepared-only";
  if (cls === "DEVICE_ACTION") return "restricted";
  if (cls === "CONSEQUENTIAL_MUTATION") return "requires-human-review";
  return "not-connected";
}

function buildCapabilities(): ExecutionCapabilityRow[] {
  const tools = listActionTools();
  return CLASS_ORDER.map((cls) => {
    const classTools = tools.filter((tool) => tool.sideEffect === cls);
    const substrateConnected = classTools.some((tool) => tool.substrateConnected);
    return {
      sideEffect: cls,
      label: CLASS_LABEL[cls],
      status: statusForClass(cls, substrateConnected),
      substrateConnected,
      detail: CLASS_DETAIL[cls],
    };
  });
}

function buildDeviceCapabilities(): ExecutionDeviceRow[] {
  return listCapabilityDescriptors().map((descriptor) => ({
    capability: descriptor.capability,
    sideEffect: descriptor.sideEffect,
    state: descriptor.defaultState,
    describes: descriptor.describes,
  }));
}

/*
 * The authority chain — the real separation. There is deliberately NO "AUTHORIZED" runtime
 * state (authorization is a human act with no persisted substrate). No stage past preparation
 * has actually caused a side effect.
 */
const AUTHORITY_CHAIN: readonly AuthorityStageView[] = [
  { stage: "Director Intent", owner: "Command", detail: "The Director expresses intent; Heby may prepare under authority.", sideEffectOccurred: false },
  { stage: "Proposed", owner: "Heby (advisory)", detail: "A typed action request exists. Nothing is prepared, checked, or run.", sideEffectOccurred: false },
  { stage: "Prepared", owner: "Heby (advisory)", detail: "Arguments validated and gate requirements computed. Not authorized, not executed.", sideEffectOccurred: false },
  { stage: "Governance gate", owner: "Governance", detail: "No live policy evaluator is connected — governance is not-connected, never silently passed.", sideEffectOccurred: false },
  { stage: "Human review", owner: "Decisions / Director", detail: "Mutations require a human authority. Heby prepares; it does not decide. There is no runtime 'authorized' state.", sideEffectOccurred: false },
  { stage: "Execution eligible", owner: "Phase 17 runtime", detail: "Derived only for READ_ONLY when every gate is satisfied. Eligible ≠ executed.", sideEffectOccurred: false },
  { stage: "Executed", owner: "Execution substrate", detail: "A READ_ONLY invocation completed. No mutation ever executes here.", sideEffectOccurred: false },
  { stage: "Receipt", owner: "Phase 17 runtime", detail: "A runtime receipt of THIS pass — not a persisted audit record. Absent because nothing ran.", sideEffectOccurred: false },
];

/** Build the Execution surface model. Pure, synchronous, read-only. */
export function getExecutionSurfaceModel(): ExecutionSurfaceModel {
  return {
    state: {
      headline: "No live execution substrate is connected",
      detail:
        "There is no execution dispatcher, and the runtime is in-memory (ACTIVE_PROVIDER = memory). No execution has occurred, so no run, status, or receipt is shown — the surface reports execution truth rather than a simulated live state.",
    },
    activity: {
      present: false,
      note: "No execution records available. No execution dispatcher is connected, so no run has occurred. No seeded or mock execution is substituted.",
    },
    capabilities: buildCapabilities(),
    deviceCapabilities: buildDeviceCapabilities(),
    computerUse: {
      status: "simulation-only",
      detail:
        "The only Computer Use surface is an offline, simulation-only planning provider. No real browser, device, or desktop is controlled, and terminal, shell, and unrestricted filesystem access remain restricted / not implemented.",
    },
    authorityChain: AUTHORITY_CHAIN,
    receipts: {
      present: false,
      note: "No execution receipt exists because no live execution has occurred. Receipts are produced only when a READ_ONLY action actually runs.",
    },
  };
}
