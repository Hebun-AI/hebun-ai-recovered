import { PageHeader } from "@/components/layout/page-header";
import { RuntimeSignalsSurface } from "@/components/operations-runtime-signals/runtime-signals-surface";

export const metadata = { title: "Runtime & Signals — Hebun AI" };

/*
 * Runtime & Signals (Operations L2 · Hebun UI Phase 22C).
 *
 * What Hebun's runtime actually observes about itself: real observation sources
 * (runtime-observability, observability, monitoring, the derived Executive Overview) with
 * honest connection states, and an honest surfaced-signals state (empty is valid). No
 * fabricated signal / alert / incident / event / failure / timestamp, and signal ≠ alert ≠
 * incident ≠ failure stays explicit. Read-only.
 */

export default function RuntimeSignalsPage() {
  return (
    <>
      <PageHeader
        title="Runtime & Signals"
        context="What Hebun's runtime observes about itself — real observation sources and honest signal state."
      />
      <RuntimeSignalsSurface />
    </>
  );
}
