import { PageHeader } from "@/components/layout/page-header";
import { ExecutionSubstrateSurface } from "@/components/operations-substrate/execution-substrate-surface";

export const metadata = { title: "Execution Substrate — Hebun AI" };

/*
 * Execution Substrate (Operations L2 · Hebun UI Phase 22C).
 *
 * The execution readiness surface: what infrastructure would actually have to exist for Hebun
 * to execute. It renders the real execution stack (each layer connected / contract-only /
 * missing), the gate model, the Computer Use (simulation-only) and terminal (restricted)
 * reality from real Phase 17/18 contracts, and what must become true before execution. It is
 * NOT an execution console, terminal, or Computer Use — it exposes the architecture, it does
 * not activate it. Read-only.
 */

export default function ExecutionSubstratePage() {
  return (
    <>
      <PageHeader
        title="Execution Substrate"
        context="What infrastructure would have to exist for Hebun to execute — the real stack, its gates, and what is missing."
      />
      <ExecutionSubstrateSurface />
    </>
  );
}
