import { PageHeader } from "@/components/layout/page-header";
import { PlatformOverview } from "@/components/platform-overview/platform-overview";
import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";
import { toPlatformDependencies } from "@/features/platform/workspace-model";

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

export default function PlatformPage() {
  const { overview } = getDirectorDashboardUiModel();
  const dependencies = toPlatformDependencies(overview.sections);

  return (
    <>
      <PageHeader
        title="Platform"
        context="What platform capability exists, and what is actually connected — contract-only and offline. Platform describes and configures; Operations executes."
      />
      <PlatformOverview dependencies={dependencies} />
    </>
  );
}
