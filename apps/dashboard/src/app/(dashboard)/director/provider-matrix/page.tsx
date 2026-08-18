import { Gauge, Mail, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProvidersModelsSurface } from "@/components/platform-providers/providers-models-surface";
import { ProviderConnectivityControlCard } from "@/components/platform-providers/provider-connectivity-control-card";
import { ExternalSendArmingCard } from "@/components/platform-providers/external-send-arming-card";
import { RecordedUsageCard } from "@/components/platform-providers/recorded-usage-card";
import { readProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";
import { readRecordedProviderUsage } from "@/features/heby-provider-ops/provider-usage-aggregation.server";
import { readExternalSendOpsView } from "@/features/action-execution/execution-arming-projection.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

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
  // The external-send arming boundary (R3B). A DIFFERENT provider key, a different blast radius.
  const externalSendOps = await readExternalSendOpsView();
  /*
   * R2F.1 — recorded provider usage, scoped to the tenant this session is authorized in. The
   * tenant is resolved SERVER-SIDE here exactly as every other authorized read resolves it; an
   * unauthenticated or suspended session yields no context and the card says so rather than
   * showing another tenant's numbers or a fabricated zero.
   */
  const recordedUsage = await readRecordedProviderUsage(await resolveTenantContext());

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

      {/*
        The external-send arming boundary (R3B). A SEPARATE control row under the same authority
        and the same surface — never a second kill-switch table and never a second admin page.
        Model connectivity and outbound sending are different permissions with different blast
        radii: enabling Hebun to think must not thereby have enabled it to act.
      */}
      <section className="mt-6 flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Mail className="size-4 text-primary" aria-hidden="true" />
          Resend — external send arming
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">
          Director-controlled outbound external sending. Disarmed, the runtime refuses before the
          permit is even spent. Armed, it still sends nothing on its own: every message needs an
          approved single-spend permit and an explicit human Execute. Arming is refused entirely
          until the credential, sender and subject are configured.
        </p>
        <ExternalSendArmingCard view={externalSendOps} />
      </section>

      {/*
        RECORDED PROVIDER USAGE (R2F.1). Reporting, not governing: this section shows what was
        already measured and stored, and controls nothing. It reads durable rows only — no
        transport is constructed and the Director permission is not consulted, so the totals stay
        readable while connectivity is off. The kill switch above governs the NEXT request; it
        does not retract usage that already happened.
      */}
      <section className="mt-6 flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Gauge className="size-4 text-primary" aria-hidden="true" />
          Recorded provider usage
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">
          Provider-reported token counts Hebun has durably recorded for this organization, totalled
          from the conversation records themselves. These are recorded measurements, not a bill:
          Hebun holds no pricing, applies no budget, and refuses no request on the basis of them.
        </p>
        <RecordedUsageCard read={recordedUsage} />
      </section>
    </>
  );
}
