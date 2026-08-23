import { PageHeader } from "@/components/layout/page-header";
import { IntegrationsSurface } from "@/components/platform-integrations/integrations-surface";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { getIntegrationsModel } from "@/features/platform-integrations";

export const metadata = { title: "Integrations — Hebun AI" };

/*
 * Integrations (Platform L2).
 *
 * ── WHAT THIS PAGE STOPPED SAYING ───────────────────────────────────────────
 *
 * It used to state, in its own header prose and through its model, that Hebun is connected to
 * nothing — "none", "no integration is authenticated or connected". That was written when it was
 * true and no connection authority existed. A tenant has since completed a real Google
 * authorization, so the sentence became a false product claim that the page could not detect,
 * because its only source was the offline provider-matrix simulation catalog.
 *
 * ── WHERE THE TRUTH COMES FROM NOW ──────────────────────────────────────────
 *
 * `listConnections` on the integration authority, scoped to the tenant this request resolved. The
 * authority stays the sole owner of connection truth; this page performs the authorized read and
 * hands the result to a pure model. It writes nothing, and it asks no provider anything.
 *
 * ── WHAT IT STILL REFUSES ───────────────────────────────────────────────────
 *
 * No connect control, no OAuth start, no disconnect, no credential read. The credential authority
 * is not imported here and cannot be: a Platform surface that could see a secret would eventually
 * render one, and "a credential is stored" is not "a connection works". Starting a Google
 * authorization remains `/integrations/google`, which is the surface that owns that act.
 *
 * `force-dynamic` because the answer is per-tenant and per-request. A cached rendering of one
 * organization's connection state is the same class of untruth this phase exists to remove.
 */

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const tenant = await resolveTenantContext();
  const listing = tenant
    ? await listConnections(tenant)
    : ({ status: "unavailable", reason: "no-authorized-tenant-context" } as const);
  const model = getIntegrationsModel(listing);

  return (
    <>
      <PageHeader
        title="Integrations"
        context="Which external services this organization is actually connected to, read from its connection authority. Offline provider descriptors are listed separately and are not connections."
      />
      <IntegrationsSurface model={model} />
    </>
  );
}
