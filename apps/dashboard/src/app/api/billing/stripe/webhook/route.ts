/*
 * POST /api/billing/stripe/webhook — COMMERCIAL-ACTIVATION-1. Stripe's only way in.
 *
 * Exempt from the SESSION check in middleware (Stripe carries no cookie) and authenticated instead by
 * the Stripe signature over the RAW body, verified before anything is parsed or read. The response
 * carries the outcome word only — never the event, a tenant id or a reason that echoes input.
 */
import { processStripeWebhook } from "@/features/billing/billing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const result = await processStripeWebhook(rawBody, request.headers.get("stripe-signature"));
  if (result.outcome === "refused" || result.outcome === "retry") {
    console.warn(JSON.stringify({ event: "billing-webhook-unsuccessful", outcome: result.outcome, reason: result.reason ?? null }));
  }
  return Response.json({ outcome: result.outcome }, { status: result.httpStatus });
}
