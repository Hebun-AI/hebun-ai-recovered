import { PageHeader } from "@/components/layout/page-header";
import { ExecutionSurface } from "@/components/operations-execution/execution-surface";

export const metadata = { title: "Execution — Hebun AI" };

/*
 * Execution (Operations L2 · Hebun UI Phase 22B rebuild).
 *
 * Distinguishes execution ACTIVITY (nothing has run — no dispatcher is connected) from
 * execution CAPABILITY (only READ_ONLY is invokable; every mutation and device action is
 * non-executable). Capability facts come from the REAL Phase 17 action registry and Phase 18
 * device runtime, read-only. It no longer imports execution/mock, and shows no fabricated
 * Execution Health %, run, receipt, timestamp, or status. Prepared ≠ authorized ≠ executed.
 *
 * Timeline and Failures remain separate legacy routes (still mock-backed) and are scheduled
 * for Phase 22C honesty cleanup — Phase 22 is not closed.
 */

export default function ExecutionCenterPage() {
  return (
    <>
      <PageHeader
        title="Execution"
        context="What execution has actually occurred, and what execution capability is currently available."
      />
      <ExecutionSurface />
    </>
  );
}
