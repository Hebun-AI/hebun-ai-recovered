import { PageHeader } from "@/components/layout/page-header";
import { ProviderRuntimeSurface } from "@/components/platform-runtime/provider-runtime-surface";

export const metadata = { title: "Provider Runtime — Hebun AI" };

/*
 * Provider Runtime (Platform L2 · Hebun UI Phase 24C rebuild).
 *
 * The authoritative read-only view of how far a provider invocation can actually progress: the offline
 * runtime stages, the real descriptive invocation pipeline, the real live-eligibility result (blocked),
 * and an honest-empty activity state. It no longer presents the fabricated "Invocation X%" health badge
 * or seeded invocation history as activity. Routing decides without dispatching; invocation prepares
 * without invoking. Execution is Operations' authority. Read-only: no connect/invoke/execute control.
 */

export default function ProviderRuntimePage() {
  return (
    <>
      <PageHeader
        title="Provider Runtime"
        context="What provider runtime machinery exists, and how far an invocation can actually progress — offline, contract-only, not connected. No provider can perform a real external invocation."
      />
      <ProviderRuntimeSurface />
    </>
  );
}
