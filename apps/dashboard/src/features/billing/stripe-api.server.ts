/*
 * billing/stripe-api.server.ts — COMMERCIAL-ACTIVATION-1. The few Stripe REST calls Hebun makes,
 * over `fetch`, with no SDK: one fixed origin (https://api.stripe.com/v1), redirects refused, 15 s
 * timeout, no retry. Form-encoded requests, JSON responses, bearer secret key.
 *
 * Every call is server-side; the secret key never reaches a browser, a log or a response. An error
 * surfaces as `StripeCallFailed` carrying the HTTP status and Stripe's error code only — never the
 * request body, the key or Stripe's message text, which can echo submitted values.
 */
import type { BillingConfig } from "./billing-config.server";

export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string; redirect?: "error"; signal?: AbortSignal },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;

export class StripeCallFailed extends Error {
  constructor(
    readonly httpStatus: number | null,
    readonly stripeCode: string | null,
  ) {
    super(`Stripe call failed (${httpStatus ?? "network"}${stripeCode ? `, ${stripeCode}` : ""})`);
  }
}

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = 15_000;

type FormValue = string | number | boolean;

/** Stripe's bracket encoding for one level of nesting is all Hebun needs: `a[b][c]=v`. */
export function encodeStripeForm(params: Readonly<Record<string, FormValue>>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k).replace(/%5B/g, "[").replace(/%5D/g, "]")}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export async function stripeRequest(
  config: Pick<BillingConfig, "secretKey">,
  method: "GET" | "POST",
  path: string,
  params: Readonly<Record<string, FormValue>> = {},
  options: { readonly idempotencyKey?: string; readonly fetchImpl?: FetchLike } = {},
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const body = encodeStripeForm(params);
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${config.secretKey}` };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    /* One fixed origin; a redirect is refused, and a hung call is abandoned after the timeout. */
    response = await fetchImpl(url, {
      method,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
      ...(method === "POST" ? { body } : {}),
    });
  } catch {
    throw new StripeCallFailed(null, null);
  }
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    const code = (json as { error?: { code?: unknown } } | null)?.error?.code;
    throw new StripeCallFailed(response.status, typeof code === "string" ? code : null);
  }
  if (!json || typeof json !== "object") throw new StripeCallFailed(response.status, "unreadable-response");
  return json as Record<string, unknown>;
}

/* ── Narrow readers: Stripe objects are untrusted JSON until each field is checked. ── */

export function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export interface StripeSubscriptionSummary {
  readonly id: string;
  readonly status: string;
  readonly created: number;
  readonly priceIds: readonly string[];
}

export function readSubscriptions(list: Record<string, unknown>): StripeSubscriptionSummary[] {
  const data = Array.isArray(list.data) ? list.data : [];
  const out: StripeSubscriptionSummary[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const id = str(s.id);
    const status = str(s.status);
    if (!id || !status) continue;
    const items = (s.items as { data?: unknown } | undefined)?.data;
    const priceIds = Array.isArray(items)
      ? items.map((i) => str((i as { price?: { id?: unknown } } | null)?.price?.id)).filter((p): p is string => p !== null)
      : [];
    out.push({ id, status, created: typeof s.created === "number" ? s.created : 0, priceIds });
  }
  return out;
}
