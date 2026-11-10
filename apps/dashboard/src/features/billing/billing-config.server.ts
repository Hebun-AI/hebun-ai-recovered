/*
 * billing/billing-config.server.ts — COMMERCIAL-ACTIVATION-1. Stripe configuration, FAIL-CLOSED.
 *
 * Five deployment-owned values, all required; any missing or malformed value makes billing
 * `unavailable` and no Stripe call is made:
 *
 *   HEBUN_BILLING_MODE            test | live
 *   HEBUN_STRIPE_SECRET_KEY       sk_test_… / rk_test_… in test, sk_live_… / rk_live_… in live
 *   HEBUN_STRIPE_WEBHOOK_SECRET   whsec_…
 *   HEBUN_STRIPE_PRO_PRICE_ID     price_…
 *   HEBUN_BILLING_RETURN_ORIGIN   https origin the customer returns to (never a request's Host)
 *
 * TEST AND LIVE CANNOT CROSS. The declared mode must match the key's own prefix, and `live` is
 * refused unless the process runs as the Vercel production environment (`VERCEL_ENV=production`).
 * A live key in a preview, or a test key declared live, is a configuration error — not a fallback.
 * The mode is also stamped on every billing row, and a webhook's own `livemode` must agree with it.
 */
import { canonicalLinkOrigin } from "@/features/auth-email-ownership/auth-mail.server";

export type BillingMode = "test" | "live";

export const BILLING_ENV_KEYS = Object.freeze({
  mode: "HEBUN_BILLING_MODE",
  secretKey: "HEBUN_STRIPE_SECRET_KEY",
  webhookSecret: "HEBUN_STRIPE_WEBHOOK_SECRET",
  proPriceId: "HEBUN_STRIPE_PRO_PRICE_ID",
  returnOrigin: "HEBUN_BILLING_RETURN_ORIGIN",
});

export interface BillingConfig {
  readonly mode: BillingMode;
  readonly secretKey: string;
  readonly webhookSecret: string;
  readonly proPriceId: string;
  readonly returnOrigin: string;
}

export type BillingConfigResolution =
  | { readonly status: "configured"; readonly config: BillingConfig }
  | { readonly status: "unavailable"; readonly problems: readonly string[] };

const KEY_PREFIX: Readonly<Record<BillingMode, readonly string[]>> = Object.freeze({
  test: ["sk_test_", "rk_test_"],
  live: ["sk_live_", "rk_live_"],
});

export function resolveBillingConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BillingConfigResolution {
  const read = (key: string) => env[key]?.trim() ?? "";
  const problems: string[] = [];
  const modeRaw = read(BILLING_ENV_KEYS.mode);
  const mode: BillingMode | null = modeRaw === "test" || modeRaw === "live" ? modeRaw : null;
  if (!mode) problems.push(`${BILLING_ENV_KEYS.mode} must be test or live`);
  const secretKey = read(BILLING_ENV_KEYS.secretKey);
  if (!secretKey) problems.push(`${BILLING_ENV_KEYS.secretKey} is missing`);
  else if (mode && !KEY_PREFIX[mode].some((p) => secretKey.startsWith(p))) {
    problems.push(`${BILLING_ENV_KEYS.secretKey} does not match ${BILLING_ENV_KEYS.mode}=${mode}`);
  }
  if (mode === "live" && env.VERCEL_ENV !== "production") {
    problems.push(`${BILLING_ENV_KEYS.mode}=live is refused outside the production environment`);
  }
  const webhookSecret = read(BILLING_ENV_KEYS.webhookSecret);
  if (!webhookSecret.startsWith("whsec_")) problems.push(`${BILLING_ENV_KEYS.webhookSecret} is missing or malformed`);
  const proPriceId = read(BILLING_ENV_KEYS.proPriceId);
  if (!/^price_[A-Za-z0-9]+$/.test(proPriceId)) problems.push(`${BILLING_ENV_KEYS.proPriceId} is missing or malformed`);
  const originRaw = read(BILLING_ENV_KEYS.returnOrigin);
  const returnOrigin = originRaw ? canonicalLinkOrigin(originRaw) : null;
  if (!returnOrigin) problems.push(`${BILLING_ENV_KEYS.returnOrigin} must be an https origin`);
  if (problems.length > 0 || !mode || !returnOrigin) return { status: "unavailable", problems };
  return { status: "configured", config: { mode, secretKey, webhookSecret, proPriceId, returnOrigin } };
}
