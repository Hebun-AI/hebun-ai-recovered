/*
 * COMMERCIAL-ACTIVATION-1 — pure contracts: plan caps, Stripe signature, billing configuration.
 *
 * Proves:
 *   P1 founding keeps the released AP-3 resolution byte-for-byte (default 50 / 5, every env override).
 *   P2 free and pro enforce their PUBLIC limits; an operator env value still bounds them from above and
 *      0 still turns a class off; an unknown plan string reads as free (fail closed).
 *   P3 plan features: video and member limit per plan; founding has no member limit.
 *   S1–S6 the webhook signature: valid, tampered body, wrong secret, replayed timestamp, missing or
 *      malformed header, and v0-only — every refusal is a refusal.
 *   C1–C5 billing configuration: test/live cannot cross, live is refused outside production, every
 *      required value is checked, nothing is defaulted.
 */
import assert from "node:assert/strict";
import { AI_DISPATCH_CAP_ENV_KEYS, resolveAiDispatchCap } from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { ceilingForPlan } from "../../src/features/tenant-entitlements/tenant-dispatch-ceiling.server";
import { asPlanCode, COMMERCIAL_PLAN_LIMITS, planFeatures, PRO_PRICE } from "../../src/features/tenant-entitlements/plans";
import { signStripePayload, verifyStripeSignature } from "../../src/features/billing/stripe-signature";
import { resolveBillingConfig } from "../../src/features/billing/billing-config.server";
import { deriveEntitlement } from "../../src/features/billing/billing.server";

const NONE = {};
/* Exactly what the cap passes in: its own resolution plus whether an operator set the value. */
const resolvePlanDispatchCap = (plan: "free" | "pro" | "founding", c: "model" | "media", env: Record<string, string | undefined>) =>
  ceilingForPlan(plan, c, { cap: resolveAiDispatchCap(c, env), operatorSet: (env[AI_DISPATCH_CAP_ENV_KEYS[c]]?.trim() ?? "") !== "" });
const MODEL = "HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY";
const MEDIA = "HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY";

/* P1 */
for (const env of [NONE, { [MODEL]: "200" }, { [MEDIA]: "0" }, { [MODEL]: "garbage" }, { [MODEL]: "1001" }]) {
  for (const c of ["model", "media"] as const) {
    assert.equal(resolvePlanDispatchCap("founding", c, env), resolveAiDispatchCap(c, env), `P1 founding ≡ released cap (${c}, ${JSON.stringify(env)})`);
  }
}
assert.equal(resolvePlanDispatchCap("founding", "model", NONE), 50);
assert.equal(resolvePlanDispatchCap("founding", "media", NONE), 5);
console.log("ok P1 founding keeps the released cap exactly");

/* P2 */
assert.deepEqual([resolvePlanDispatchCap("free", "model", NONE), resolvePlanDispatchCap("free", "media", NONE)], [15, 1]);
assert.deepEqual([resolvePlanDispatchCap("pro", "model", NONE), resolvePlanDispatchCap("pro", "media", NONE)], [100, 10]);
assert.equal(resolvePlanDispatchCap("pro", "model", { [MODEL]: "40" }), 40, "env bounds pro from above");
assert.equal(resolvePlanDispatchCap("free", "model", { [MODEL]: "40" }), 15, "env never raises a plan");
assert.equal(resolvePlanDispatchCap("pro", "media", { [MEDIA]: "0" }), 0, "0 turns the class off for every plan");
assert.equal(resolvePlanDispatchCap("pro", "model", { [MODEL]: "nope" }), 0, "a malformed env value fails closed");
assert.equal(asPlanCode("enterprise"), "free");
assert.equal(asPlanCode(undefined), "free");
assert.equal(asPlanCode("founding"), "founding");
assert.deepEqual(COMMERCIAL_PLAN_LIMITS.free, { model: 15, media: 1, videoGeneration: false, memberLimit: 1 });
assert.deepEqual(COMMERCIAL_PLAN_LIMITS.pro, { model: 100, media: 10, videoGeneration: true, memberLimit: 5 });
assert.equal(PRO_PRICE.unitAmount, 4900);
console.log("ok P2 free/pro public limits, env upper bound, fail-closed unknown plan");

/* P3 */
assert.deepEqual(planFeatures("free"), { videoGeneration: false, memberLimit: 1 });
assert.deepEqual(planFeatures("pro"), { videoGeneration: true, memberLimit: 5 });
assert.deepEqual(planFeatures("founding"), { videoGeneration: true, memberLimit: null });
console.log("ok P3 plan features");

/* S1–S6 */
const secret = "whsec_test_commercial_activation";
const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
const t = 1_794_000_000;
assert.deepEqual(verifyStripeSignature(body, signStripePayload(body, secret, t), secret, t + 10), { status: "verified", timestamp: t }, "S1 valid");
assert.equal(verifyStripeSignature(`${body} `, signStripePayload(body, secret, t), secret, t).status, "refused", "S2 one byte changed");
assert.equal(verifyStripeSignature(body, signStripePayload(body, "whsec_other", t), secret, t).status, "refused", "S3 wrong secret");
assert.deepEqual(verifyStripeSignature(body, signStripePayload(body, secret, t), secret, t + 301), { status: "refused", reason: "timestamp-outside-tolerance" }, "S4 replay");
assert.deepEqual(verifyStripeSignature(body, null, secret, t), { status: "refused", reason: "missing-header" });
assert.deepEqual(verifyStripeSignature(body, "garbage", secret, t), { status: "refused", reason: "malformed-header" });
const v1 = signStripePayload(body, secret, t).split(",")[1]!.slice(3);
assert.equal(verifyStripeSignature(body, `t=${t},v0=${v1}`, secret, t).status, "refused", "S6 v0 is never accepted");
assert.equal(verifyStripeSignature(body, `t=${t},v1=${"0".repeat(64)},v1=${v1}`, secret, t).status, "verified", "any matching v1 among several");
console.log("ok S1-S6 signature");

/* C1–C5 */
const good = {
  HEBUN_BILLING_MODE: "test",
  HEBUN_STRIPE_SECRET_KEY: "sk_test_abc",
  HEBUN_STRIPE_WEBHOOK_SECRET: "whsec_abc",
  HEBUN_STRIPE_PRO_PRICE_ID: "price_abc123",
  HEBUN_BILLING_RETURN_ORIGIN: "https://preview.example.com",
};
assert.equal(resolveBillingConfig(good).status, "configured", "C1 complete test config");
assert.equal(resolveBillingConfig({ ...good, HEBUN_STRIPE_SECRET_KEY: "sk_live_abc" }).status, "unavailable", "C2 live key in test mode");
assert.equal(resolveBillingConfig({ ...good, HEBUN_BILLING_MODE: "live" }).status, "unavailable", "C2 test key in live mode");
assert.equal(resolveBillingConfig({ ...good, HEBUN_BILLING_MODE: "live", HEBUN_STRIPE_SECRET_KEY: "sk_live_abc" }).status, "unavailable", "C3 live outside production");
assert.equal(
  resolveBillingConfig({ ...good, HEBUN_BILLING_MODE: "live", HEBUN_STRIPE_SECRET_KEY: "sk_live_abc", VERCEL_ENV: "production" }).status,
  "configured",
  "C3 live in production with a live key",
);
for (const [k, v] of [
  ["HEBUN_STRIPE_WEBHOOK_SECRET", "abc"],
  ["HEBUN_STRIPE_PRO_PRICE_ID", "prod_abc"],
  ["HEBUN_BILLING_RETURN_ORIGIN", "http://insecure.example.com"],
  ["HEBUN_BILLING_RETURN_ORIGIN", "https://example.com/path"],
  ["HEBUN_BILLING_MODE", ""],
] as const) {
  assert.equal(resolveBillingConfig({ ...good, [k]: v }).status, "unavailable", `C4 ${k}=${v} refused`);
}
assert.equal(resolveBillingConfig({}).status, "unavailable", "C5 nothing configured → unavailable, never defaulted");
console.log("ok C1-C5 billing configuration");

/* E1 — entitlement derivation */
const sub = (id: string, status: string, price: string, created: number) => ({ id, status, created, priceIds: [price] });
assert.equal(deriveEntitlement([sub("sub_1", "active", "price_pro", 1)], "price_pro").entitled, true);
assert.equal(deriveEntitlement([sub("sub_1", "past_due", "price_pro", 1)], "price_pro").entitled, true, "Stripe still retrying");
for (const s of ["incomplete", "unpaid", "canceled", "incomplete_expired", "paused"]) {
  assert.equal(deriveEntitlement([sub("sub_1", s, "price_pro", 1)], "price_pro").entitled, false, `${s} is not Pro`);
}
assert.equal(deriveEntitlement([sub("sub_1", "active", "price_other", 1)], "price_pro").entitled, false, "another price is not Pro");
assert.equal(deriveEntitlement([sub("sub_old", "canceled", "price_pro", 1), sub("sub_new", "active", "price_pro", 2)], "price_pro").subscription?.id, "sub_new");
assert.deepEqual(deriveEntitlement([], "price_pro"), { entitled: false, subscription: null });
console.log("ok E1 entitlement derivation");

console.log("PASS commercial-activation-1 plans, signature, config");
