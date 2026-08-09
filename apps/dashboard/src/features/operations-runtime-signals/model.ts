/*
 * operations-runtime-signals/model.ts — builds the Runtime & Signals truth surface
 * from real runtime observation seams, read-only (Hebun UI Phase 22C).
 *
 * The sources are the real runtime observation layers discovered on disk:
 * runtime-observability (instrumentation), observability (canonical signal pipeline),
 * monitoring (evaluation engine), and the derived Executive Overview read model. Their
 * connection states are structural facts. No signal, alert, incident, event, timestamp,
 * count, or provenance is fabricated; the surfaced-signal feed is honestly empty.
 */

import type {
  MonitoringDistinction,
  RuntimeSignalSource,
  RuntimeSignalsModel,
} from "./contracts";

const SOURCES: readonly RuntimeSignalSource[] = [
  {
    source: "Runtime observability",
    backing: "runtime-observability · instrumentation",
    authority: "Operations (read)",
    connection: "connected",
    derived: false,
    limitations:
      "Records signals about the runtime's own operation (projection refreshes, startup). A live signal feed is not surfaced here.",
  },
  {
    source: "Canonical signal pipeline",
    backing: "observability · collection pipeline",
    authority: "Operations (read)",
    connection: "connected",
    derived: false,
    limitations:
      "Normalizes producer observations into canonical signals. No external producer is connected, so it carries only the runtime's own observations.",
  },
  {
    source: "Monitoring",
    backing: "monitoring · evaluation engine",
    authority: "Operations (read)",
    connection: "empty",
    derived: false,
    limitations:
      "Evaluates monitor definitions into alert candidates. No monitor is fed, so it is structurally empty — no alert is produced.",
  },
  {
    source: "Executive Overview",
    backing: "Executive Overview read model",
    authority: "Command / Platform (derived)",
    connection: "derived",
    derived: true,
    limitations:
      "A derived, non-authoritative operational read model. Its record counts are seeded and are deliberately not surfaced here as live truth.",
  },
];

const MONITORING_BOUNDARY: readonly MonitoringDistinction[] = [
  { left: "Signal", right: "Alert", note: "A signal is an observation; an alert is a signal that crossed a monitor threshold." },
  { left: "Alert", right: "Incident", note: "An alert is not an incident — no incident authority exists here." },
  { left: "Incident", right: "Failure", note: "A failure is an execution outcome; an incident is an operational judgement." },
  { left: "Failure", right: "Root cause", note: "A failure is not its root cause." },
  { left: "Absence of signal", right: "Healthy", note: "Nothing observed is not the same as nothing wrong." },
];

/** Build the Runtime & Signals model. Pure, synchronous, read-only. */
export function getRuntimeSignalsModel(): RuntimeSignalsModel {
  return {
    observation: {
      state: "connected",
      detail:
        "Hebun's runtime observes its own operation: the observability layer is instrumented and records canonical signals about projection refreshes and startup. No external producer is connected, and no live signal feed is surfaced here.",
    },
    sources: SOURCES,
    surfacedSignals: {
      present: false,
      note:
        "No runtime signals are currently surfaced. Signals are recorded internally by the observability layer; a surfaced feed is not built here, and none is fabricated.",
    },
    monitoringBoundary: MONITORING_BOUNDARY,
    provenanceNote:
      "Every surfaced signal would carry the source and runtime that produced it. None is surfaced, so no provenance is shown — and none is invented.",
  };
}
