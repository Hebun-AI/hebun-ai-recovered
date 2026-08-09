/*
 * operations-overview/model.ts — builds the Operations Overview truth surface from
 * REAL contracts, read-only (Hebun UI Phase 22B).
 *
 * The execution-boundary counts come from the real Phase 17 action registry
 * (heby-actions · listActionTools / invokableActionTools). The availability map is
 * structural truth about each operational subsystem's actual backing. Nothing is
 * fabricated: no health %, no run/queue/incident counts, no timestamps.
 */

import { listActionTools, invokableActionTools } from "@/features/heby-actions";
import type {
  ExecutionBoundaryView,
  OperationalAreaView,
  OperationsOverviewModel,
} from "./contracts";

/*
 * Honest availability of each operational subsystem, grounded in Phase 22A discovery:
 * runtime self-observation is real; execution is not connected; workflows/orchestration/
 * task dispatch/events are seeded/simulated/derived; device runtime and Computer Use are
 * contract-only / simulation-only; persistence is in-memory.
 */
const AVAILABILITY: readonly OperationalAreaView[] = [
  {
    area: "Runtime observation",
    question: "Can Hebun observe its own runtime?",
    status: "connected",
    detail:
      "The runtime observability layer is connected and instruments the runtime's own operation (projection refreshes, startup). Signals are recorded; a signal feed is not surfaced here.",
  },
  {
    area: "Execution records",
    question: "Is anything running?",
    status: "not-connected",
    detail:
      "No live execution substrate is connected. There is no execution dispatcher, so no execution record exists.",
    href: "/director/execution-center",
  },
  {
    area: "Workflow runtime",
    question: "What workflows exist?",
    status: "seeded",
    detail: "Workflow state is a seeded, non-authoritative projection — not live runs.",
    href: "/workflows",
  },
  {
    area: "Orchestration",
    question: "How is work routed?",
    status: "simulated",
    detail: "Orchestration is backed by simulated agent data, not a connected runtime.",
    href: "/director/orchestration",
  },
  {
    area: "Task dispatch",
    question: "What is queued?",
    status: "seeded",
    detail: "The task queue is seeded in-memory from a deterministic dispatch — not live work.",
    href: "/director/task-planning",
  },
  {
    area: "Events",
    question: "What has happened?",
    status: "derived",
    detail: "Events are a derived projection with no connected source; the stream is empty.",
    href: "/events",
  },
  {
    area: "Device runtime",
    question: "Can Hebun use a device?",
    status: "not-connected",
    detail:
      "Device Runtime is contract-only: no device is registered and no session runs. (Phase 18)",
  },
  {
    area: "Computer Use",
    question: "Can Hebun control a browser or desktop?",
    status: "simulated",
    detail:
      "Computer Use is simulation-only. No real browser, device, or desktop is controlled.",
  },
  {
    area: "Persistence",
    question: "Is operational state durable?",
    status: "in-memory",
    detail: "The operational runtime is in-memory (ACTIVE_PROVIDER = memory); nothing is persisted.",
  },
];

function buildExecutionBoundary(): ExecutionBoundaryView {
  const declared = listActionTools().length;
  const invokable = invokableActionTools().length;
  return {
    declared,
    invokable,
    nonExecutable: declared - invokable,
    summary: [
      "Prepared actions can be described, gated, and routed — never silently authorized or executed.",
      "Only READ_ONLY actions with a connected substrate are invokable.",
      "Every mutation is non-executable here; its requirements are reported unmet / not-connected, never faked.",
      "Authorization is a separate human act — Heby prepares; it does not decide.",
      "Prepared ≠ authorized ≠ executed ≠ successful.",
    ],
  };
}

/** Build the Operations Overview model. Pure, synchronous, read-only. */
export function getOperationsOverviewModel(): OperationsOverviewModel {
  return {
    availability: AVAILABILITY,
    executionBoundary: buildExecutionBoundary(),
    signalsNote:
      "No operational signals are currently surfaced. The runtime records observability signals about its own operation; a live signal feed is a later phase (Runtime & Signals).",
  };
}
