/*
 * operations-substrate/model.ts — builds the Execution Substrate readiness surface from
 * real Phase 17/18 contracts, read-only (Hebun UI Phase 22C).
 *
 * The terminal state is read from the real Phase 18 device capability descriptor; the gate
 * model reflects the real Phase 17 gate semantics (capability / governance / authority /
 * substrate). It never marks a layer connected merely because code exists, never invents an
 * "AUTHORIZED" state, and connects no shell, terminal, browser, device, or provider.
 */

import { listActionTools } from "@/features/heby-actions";
import { INVOKABLE_SIDE_EFFECTS } from "@/features/heby-runtime";
import { listCapabilityDescriptors } from "@/features/device-runtime";
import type {
  ExecutionGateView,
  ExecutionLayerView,
  SubstrateModel,
} from "./contracts";

/*
 * The execution stack. `implemented` is true only for layers backed by a real contract or a
 * connected runtime; the dispatcher, device/provider runtime, and receipt layers are missing.
 */
const LAYERS: readonly ExecutionLayerView[] = [
  { layer: "Intent", owner: "Command", state: "human-gated", implemented: true, detail: "The Director expresses intent; Heby may prepare under authority." },
  { layer: "Prepared action", owner: "Heby · Phase 17", state: "contract-only", implemented: true, detail: "A typed, gated prepared action. A contract exists; nothing runs from it." },
  { layer: "Capability gate", owner: "Phase 17", state: "connected", implemented: true, detail: "Computes whether a tool and its substrate can run the side-effect class. Satisfied only for READ_ONLY." },
  { layer: "Governance gate", owner: "Governance", state: "not-connected", implemented: false, detail: "No live policy evaluator is connected — governance is not-connected, never silently passed." },
  { layer: "Human authority", owner: "Decisions / Director", state: "human-gated", implemented: true, detail: "Mutations require a human authority. There is no runtime 'authorized' state; authorization is a human act." },
  { layer: "Execution eligibility", owner: "Phase 17", state: "connected", implemented: true, detail: "Derived only for READ_ONLY when every gate is satisfied. Eligible ≠ executed." },
  { layer: "Execution dispatcher / runtime", owner: "Operations", state: "not-connected", implemented: false, detail: "No execution dispatcher is connected. This layer is missing — nothing can be invoked beyond READ_ONLY." },
  { layer: "Device / provider runtime", owner: "Phase 18 · providers", state: "simulation-only", implemented: false, detail: "Device Runtime is contract-only (empty registry, no session); Computer Use is simulation-only. No real device or provider executes." },
  { layer: "Receipt / result", owner: "Phase 17", state: "not-connected", implemented: false, detail: "Produced only after a READ_ONLY invocation actually runs. None has run, so none exists." },
];

const GATES: readonly ExecutionGateView[] = [
  { gate: "Capability", status: "satisfied", detail: "Satisfied for READ_ONLY (a connected substrate exists); unmet for every mutation — no substrate is connected." },
  { gate: "Governance", status: "not-connected", detail: "A governance check is required for consequential classes, but no live policy evaluator is connected. Not-connected is not a pass." },
  { gate: "Authority", status: "requires-human-review", detail: "Mutations require a human authority; Heby may never act (hebyMayAct = false). READ_ONLY is advisory-only." },
  { gate: "Execution substrate", status: "not-connected", detail: "No execution dispatcher is connected, so nothing beyond READ_ONLY could be invoked even if gated." },
  { gate: "Device runtime", status: "not-connected", detail: "No device is registered and no session runs; device actions are restricted." },
];

function terminalCapability() {
  const terminal = listCapabilityDescriptors().find((d) => d.capability === "TERMINAL_COMMAND");
  return {
    capability: terminal?.capability ?? "TERMINAL_COMMAND",
    state: terminal?.defaultState ?? "restricted",
    detail:
      "Terminal command execution is a restricted consequential mutation with no connected runtime. There is no shell, PTY, or terminal backend — the capability is a contract, not a terminal.",
  };
}

/** Build the Execution Substrate model. Pure, synchronous, read-only. */
export function getSubstrateModel(): SubstrateModel {
  // Real invariant: only READ_ONLY actions are invokable; every mutation/device tool declares
  // no connected substrate, so no mutation or device action can run and nothing has executed.
  const mutationTools = listActionTools().filter(
    (tool) => !INVOKABLE_SIDE_EFFECTS.includes(tool.sideEffect) && tool.sideEffect !== "PREPARATION_ONLY",
  );
  const noMutationInvokable = mutationTools.every((tool) => tool.substrateConnected === false);

  return {
    state: {
      headline: "No execution runtime is connected",
      detail:
        "The execution stack exists as contracts and gates, but the dispatcher, device/provider runtime, and receipt layers are not connected. Only READ_ONLY actions can be invoked; every mutation and device action is non-executable. This surface exposes the execution architecture — it does not activate it.",
    },
    layers: LAYERS,
    gates: GATES,
    computerUse: {
      status: "simulation-only",
      detail:
        "The only Computer Use surface is an offline, simulation-only planning provider. Simulation is not execution: no real browser, device, or desktop is controlled.",
    },
    terminal: terminalCapability(),
    requiredToExecute: [
      "A connected execution dispatcher / runtime that could invoke a mutation.",
      "A live governance / policy evaluator (governance is currently not-connected).",
      "A persisted authorization substrate plus an explicit human authority act.",
      "A connected device / session runtime for any device action (Phase 18 is contract-only).",
      "A real, non-simulation Computer Use / provider execution channel.",
      "Explicit Director architecture authorization before any real-world execution is connected.",
    ],
    receiptBoundary: noMutationInvokable
      ? "Execution receipts exist only after an action actually runs. No live execution has occurred, so no receipt is surfaced — and none is fabricated."
      : "Execution receipts exist only after an action actually runs.",
  };
}
