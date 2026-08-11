import { PlugZap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProvidersModelsSurface } from "@/components/platform-providers/providers-models-surface";
import { ProviderConnectivityControlCard } from "@/components/platform-providers/provider-connectivity-control-card";
import { readProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";

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

export default async function ProviderMatrixPage() {
  // Truthful, secret-free provider-ops view (durable Director control + server config). Fail-closed.
  const providerOps = await readProviderOpsView();

  return (
    <>
      <PageHeader
        title="Providers & Models"
        context="Every registered provider and model, and its real connection/execution state. The catalog holds offline execution-provider descriptors; Claude additionally has a real, Director-controlled model-generation connectivity path (below) — model connectivity only, not agent execution."
      />
      <ProvidersModelsSurface />

      {/*
        The authoritative surface for provider connectivity control (R2E, moved here in R2E.1).
        Reuses the existing R2E component + projection + server action — no second implementation,
        no duplicate authority. Governs model-generation connectivity only.
      */}
      <section className="mt-6 flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <PlugZap className="size-4 text-primary" aria-hidden="true" />
          Anthropic / Claude — connectivity control
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">
          Director-controlled Claude model-generation connectivity. Turning it off blocks new Hebun→
          Anthropic requests server-side, before any network dispatch. This governs model generation
          only — it activates no agent execution, tools, Computer Use, browser control, shell, or
          consequential mutation.
        </p>
        <ProviderConnectivityControlCard view={providerOps} />
      </section>
    </>
  );
}
