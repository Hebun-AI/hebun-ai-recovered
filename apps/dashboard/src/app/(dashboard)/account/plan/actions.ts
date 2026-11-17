"use server";

/*
 * Plan & Usage actions — COMMERCIAL-ACTIVATION-1. Each takes NO input: the tenant, the actor and the
 * price all come from the server (session, membership, configuration), so a client cannot choose a
 * tenant, a price or a plan. Success leaves the app for Stripe; a refusal returns to Plan & Usage
 * with one closed reason word.
 */
import { redirect } from "next/navigation";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { openBillingPortal, startProCheckout } from "@/features/billing/billing.server";

export async function startProCheckoutAction(): Promise<void> {
  const result = await startProCheckout(await resolveTenantContext());
  redirect(result.status === "redirect" ? result.url : `/account/plan?billing=${result.reason}`);
}

export async function openBillingPortalAction(): Promise<void> {
  const result = await openBillingPortal(await resolveTenantContext());
  redirect(result.status === "redirect" ? result.url : `/account/plan?billing=${result.reason}`);
}
