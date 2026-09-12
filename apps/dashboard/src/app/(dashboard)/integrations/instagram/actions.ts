"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { disconnectProviderConnection } from "@/features/provider-connection-lifecycle/disconnect-connection.server";
import { INSTAGRAM_PROVIDER_KEY } from "@/features/provider-instagram/contracts";

/**
 * End this tenant's Instagram connection in Hebun.
 *
 * ── IT TAKES NO ARGUMENTS, AND THAT IS THE SECURITY DESIGN ──────────────────
 *
 * No integration id, no credential id, no tenant. There is nothing for a forged form field to
 * arrive in, so "the browser cannot disconnect another tenant's connection" is a property of the
 * signature rather than a validation rule somebody has to remember to write. The tenant comes from
 * the session, and the lifecycle module re-derives the connection from that tenant's own listing.
 *
 * ── IT IS A THIN CALLER, DELIBERATELY ───────────────────────────────────────
 *
 * The composition — revoke every live credential, then transition the connection — lives in
 * `provider-connection-lifecycle`, not here. An earlier version did it inline and imported the
 * credential authority directly; a released INT-2 firewall refused that, because only the two OAuth
 * callback routes may reach `integration-credentials` from `src/app`. The refusal was correct and
 * the composition moved rather than the boundary.
 *
 * So this file knows a provider key and a redirect. It does not know what a credential is.
 */
export async function disconnectInstagramAction(): Promise<void> {
  const tenant = await resolveTenantContext();
  if (!tenant) redirect("/login");

  const outcome = await disconnectProviderConnection(tenant, INSTAGRAM_PROVIDER_KEY);

  if (outcome.status === "refused") {
    redirect(`/integrations/instagram?outcome=disconnect-${outcome.reason}`);
  }
  if (outcome.status === "nothing-to-do") {
    redirect("/integrations/instagram?outcome=disconnect-nothing-to-do");
  }

  revalidatePath("/integrations/instagram");
  redirect("/integrations/instagram?outcome=disconnected");
}
