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
  /*
   * R3B REPAIR. These two layers said "not connected" and that stopped being true: a narrow
   * execution runtime exists for exactly one action kind. It is deliberately NOT a dispatcher —
   * there is no queue, no worker and no scheduler — and it is not armed, so the honest state is
   * "connected for one action, disabled" rather than either "missing" or "running".
   */
  { layer: "Execution dispatcher / runtime", owner: "Operations · R3B", state: "human-gated", implemented: true, detail: "A narrow execution runtime exists for exactly one action kind (send-external-communication), reached only by an explicit human Execute. There is no dispatcher, worker or scheduler, and the durable external-send switch is disabled." },
  { layer: "Device / provider runtime", owner: "Phase 18 · providers", state: "simulation-only", implemented: false, detail: "Device Runtime is contract-only (empty registry, no session); Computer Use is simulation-only. No real device or provider executes." },
  { layer: "Receipt / result", owner: "Phase 17 · R3B", state: "human-gated", implemented: true, detail: "A durable execution attempt records what the provider said, including an explicit UNKNOWN outcome. No attempt has ever reached a live provider, so no receipt exists." },
];

const GATES: readonly ExecutionGateView[] = [
  { gate: "Capability", status: "satisfied", detail: "Satisfied for READ_ONLY, and for the one mutation R3B connected (send-external-communication). Unmet for every other mutation and for every device action — no substrate is connected." },
  { gate: "Governance", status: "not-connected", detail: "A governance check is required for consequential classes, but no live policy evaluator is connected. Not-connected is not a pass." },
  { gate: "Authority", status: "requires-human-review", detail: "Mutations require a human authority; Heby may never act (hebyMayAct = false). READ_ONLY is advisory-only." },
  { gate: "Execution substrate", status: "requires-human-review", detail: "One narrow execution runtime is connected, for one action kind, spendable only by an explicit human Execute against an approved single-spend permit — and disabled at the durable switch. Nothing else beyond READ_ONLY could be invoked even if gated." },
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
  /*
   * R3B REPAIR. This used to assert that NO mutation had a substrate, which is how the surface
   * justified saying nothing could execute. Exactly one now does, so the derived fact is a COUNT
   * rather than a boolean — and every other mutation and device tool must still be disconnected
   * for the rest of this model's claims to hold.
   */
  const mutationTools = listActionTools().filter(
    (tool) => !INVOKABLE_SIDE_EFFECTS.includes(tool.sideEffect) && tool.sideEffect !== "PREPARATION_ONLY",
  );
  const connectedMutations = mutationTools.filter((tool) => tool.substrateConnected);
  /*
   * GIA-1 — TWO ACTIONS HAVE AN EXECUTION PATH, AND THEY ARE NOT THE SAME KIND OF PATH.
   *
   * This used to be `connectedMutations.length === 1`, and the sentence it chose said "the one
   * connected action" and "no live execution has occurred". Both became false the moment a second,
   * INTERNAL act was authorized: the internal one has no attempt ledger at all, and it is expected
   * to run. The distinction the surface must keep is therefore between the two paths, not a count.
   */
  const externalConnected = connectedMutations.some(
    (tool) => tool.actionKind === "send-external-communication",
  );
  const internalConnected = connectedMutations.some((tool) => tool.actionKind === "record-work");

  return {
    state: {
      headline: "One execution runtime is connected, and it is disabled",
      detail:
        "Exactly one action kind (send-external-communication) has a durable execution runtime: an approved single-spend permit, an explicit human Execute, one bounded adapter, and a recorded attempt. Resend is the selected vendor and its request mapping is implemented. It is still NOT armed — the durable external-send switch is disabled, and no credential, sender or subject is configured, so the adapter does not exist at runtime and no real send has ever occurred. Every other mutation and every device action remains non-executable, and there is no dispatcher, worker or scheduler anywhere. This surface exposes the execution architecture — it does not activate it.",
    },
    layers: LAYERS,
    gates: GATES,
    computerUse: {
      status: "simulation-only",
      detail:
        "The only Computer Use surface is an offline, simulation-only planning provider. Simulation is not execution: no real browser, device, or desktop is controlled.",
    },
    terminal: terminalCapability(),
    /*
     * What is still missing — for the one connected action, and for everything else. The first
     * three entries were satisfied by R3A and R3B and have been replaced by what actually remains.
     */
    requiredToExecute: [
      "A configured Resend credential, a system-owned sender, and the fixed subject; without all three, the adapter does not exist. The vendor itself is settled and its host is fixed in code.",
      "The durable external-send switch armed by the Director in Providers & Models; it ships disabled, refuses to arm until configuration is complete, and is read twice per execution.",
      "For any OTHER mutation: its own execution runtime — none of the remaining three has one.",
      "A connected device / session runtime for any device action (Phase 18 is contract-only).",
      "A real, non-simulation Computer Use / provider execution channel.",
    ],
    receiptBoundary:
      externalConnected && internalConnected
        ? "Execution receipts exist only after an action actually runs. The external send keeps a durable attempt record and no live send has ever occurred, so no receipt is surfaced for it. The governed internal act keeps no attempt ledger at all — the record it creates and that record's audit event ARE its outcome. Neither is fabricated."
        : "Execution receipts exist only after an action actually runs, and none is fabricated.",
  };
}
