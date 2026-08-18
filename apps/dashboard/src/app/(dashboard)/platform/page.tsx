import Link from "next/link";
import { ArrowUpRight, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformOverview } from "@/components/platform-overview/platform-overview";
import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";
import { toPlatformDependencies } from "@/features/platform/workspace-model";
import { readProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";

export const metadata = { title: "Platform — Hebun AI" };

/*
 * Platform Overview (Platform L2 · Hebun UI Phase 24B rebuild; refines the honest Phase 13 surface).
 *
 * The authoritative Platform availability/authority surface. It states what platform capability
 * exists and what is actually connected (nothing): the deterministic offline provider substrate, the
 * authority boundary per concept, the provider execution ladder, and the advisory Heby profile. It
 * shows the REAL, non-authoritative technical dependency availability from the Executive Overview.
 * No aggregate Platform health, no fabricated metric, no connection, no mutation control.
 */

export default async function PlatformPage() {
  const { overview } = getDirectorDashboardUiModel();
  const dependencies = toPlatformDependencies(overview.sections);
  // Truthful, secret-free provider-ops view (durable Director control + server config). The
  // resolver is fail-closed, so this never throws even when the control-plane DB is absent.
  const providerOps = await readProviderOpsView();

  return (
    <>
      <PageHeader
        title="Platform"
        context="What platform capability exists, and what is actually connected — contract-only and offline. Platform describes and configures; Operations executes."
      />
      <PlatformOverview dependencies={dependencies} />

      {/*
        Overview is status-only. The full connectivity DETAIL lives in Providers & Models (its
        authoritative surface). This is a READ-ONLY summary over the SAME R2E projection — no second
        state, no duplicate authority.

        Since R5.1 neither surface offers a control: the global permission is changed only by the
        deployment-possession ceremony, so this link goes to the detail, not to a toggle.
      */}
      <Link
        href="/director/provider-matrix"
        className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-surface p-4 text-sm text-fg-secondary transition-colors hover:bg-surface-raised"
      >
        <PlugZap className="size-4 text-primary" aria-hidden="true" />
        <span className="font-medium text-fg">Claude model connectivity:</span>
        <span className={providerOps.directorEnabled ? "font-semibold text-success" : "font-semibold text-fg-muted"}>
          Director {providerOps.directorEnabled ? "Enabled" : "Disabled"}
        </span>
        <span className="text-fg-muted">— details in Providers &amp; Models</span>
        <ArrowUpRight className="size-3.5 text-fg-muted" aria-hidden="true" />
      </Link>
    </>
  );
}
