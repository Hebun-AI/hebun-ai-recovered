import { PageHeader } from "@/components/layout/page-header";
import { IntegrationsSurface } from "@/components/platform-integrations/integrations-surface";

export const metadata = { title: "Integrations — Hebun AI" };

/*
 * Integrations (Platform L2 · Hebun UI Phase 24C rebuild).
 *
 * The authoritative read-only Integrations surface. It no longer presents the fabricated integration
 * mock (Gmail/GitHub/Supabase "connected", sync times, scopes, event counts) or any Add/Manage control.
 * No external integration is connected or authenticated; the connected list is honestly empty. Only
 * offline provider descriptors that could back an integration are shown. No connect/OAuth/secret control.
 */

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        context="Which external services Hebun is actually connected to — none. Offline provider descriptors exist, but no integration is authenticated or connected."
      />
      <IntegrationsSurface />
    </>
  );
}
