import { PageHeader } from "@/components/layout/page-header";
import { ProvidersModelsSurface } from "@/components/platform-providers/providers-models-surface";

export const metadata = { title: "Providers & Models — Hebun AI" };

/*
 * Providers & Models (Platform L2 · Hebun UI Phase 24B rebuild).
 *
 * The authoritative read-only provider/model capability surface. It reads the real offline provider
 * catalog and shows only proven facts (name, type, execution mode, declared capabilities, credential
 * status, connection state). It no longer presents the fabricated aggregate "Health X%", per-provider
 * availability/latency, or conformance score. Every provider is a registered offline descriptor — none
 * is connected or invokable. The "future live" provider's blocked state is computed by the real
 * eligibility engine. Read-only: no connect/configure/invoke/secret control.
 */

export default function ProviderMatrixPage() {
  return (
    <>
      <PageHeader
        title="Providers & Models"
        context="Every registered provider and model, and its real connection/execution state — offline descriptors, deterministic and simulation-first. No provider is connected; no live model is loaded."
      />
      <ProvidersModelsSurface />
    </>
  );
}
