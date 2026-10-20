/*
 * PLAN-FOLLOW-UP-REFERENCE-V1 — the plan step binding.
 *
 * Pure: a test-only secret, a fixed clock, no database, no network. Proves that a binding verifies
 * only for the exact step, human, session and tenant it was minted for, only before it expires, and
 * only under the dedicated secret — and that every failure is a named refusal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PLAN_FOLLOW_UP_BINDING_SECRET_ENV,
  PLAN_FOLLOW_UP_BINDING_TTL_MS,
  PLAN_FOLLOW_UP_MAX_SOURCES,
  mintPlanFollowUpBinding,
  planFollowUpBindingAvailable,
  verifyPlanFollowUpBinding,
} from "../../src/features/plan-follow-up-provenance/binding.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const SECRET = "test-only-plan-follow-up-binding-secret-0123456789";
const env = { [PLAN_FOLLOW_UP_BINDING_SECRET_ENV]: SECRET };
const T0 = 1_800_000_000_000;
const at = (ms: number) => ({ env, now: () => T0 + ms });

const ctx = (over: Partial<Record<"tenantId" | "userId" | "sessionContextId", string>> = {}): TenantContext =>
  asHumanTenantContext({
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    authIdentityId: "33333333-3333-4333-8333-333333333333",
    membershipId: "44444444-4444-4444-8444-444444444444",
    membershipVersion: 1,
    roleId: "55555555-5555-4555-8555-555555555555",
    sessionContextId: "66666666-6666-4666-8666-666666666666",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "pfr-binding",
    authenticatedAt: new Date(T0).toISOString(),
    ...over,
  });

const W1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const W2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const W3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const step = { planRef: "plan-ref-1", step: 2, move: "review-blocked", workItemIds: [W1, W2] };

function roundTrip(): void {
  const token = mintPlanFollowUpBinding(ctx(), step, at(0));
  assert.ok(token, "minted under the dedicated secret");
  const v = verifyPlanFollowUpBinding(ctx(), token, at(60_000));
  assert.deepEqual(v, { status: "valid", planRef: "plan-ref-1", step: 2, move: "review-blocked", workItemIds: [W1, W2] });
  assert.ok(!token!.includes(SECRET), "the secret never appears in the token");
  assert.equal(planFollowUpBindingAvailable({ env }), true);
}

function tampering(): void {
  const token = mintPlanFollowUpBinding(ctx(), step, at(0))!;
  const [body, sig] = token.split(".") as [string, string];
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  const reencode = (p: Record<string, unknown>) => Buffer.from(JSON.stringify(p)).toString("base64url");

  for (const [label, forged] of [
    ["added source", { ...payload, w: [W1, W2, W3] }],
    ["swapped source", { ...payload, w: [W1, W3] }],
    ["reordered sources", { ...payload, w: [W2, W1] }],
    ["other step", { ...payload, n: 3 }],
    ["other tenant", { ...payload, t: "99999999-9999-4999-8999-999999999999" }],
    ["later expiry", { ...payload, e: (payload.e as number) + 10 * PLAN_FOLLOW_UP_BINDING_TTL_MS }],
  ] as const) {
    assert.deepEqual(
      verifyPlanFollowUpBinding(ctx(), `${reencode(forged)}.${sig}`, at(1)),
      { status: "invalid", reason: "binding-signature-invalid" },
      `${label}: an altered body never verifies`,
    );
  }
  const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
  assert.deepEqual(verifyPlanFollowUpBinding(ctx(), `${body}.${flipped}`, at(1)), { status: "invalid", reason: "binding-signature-invalid" });

  /* Signed under a different secret: same shape, never accepted. */
  const other = mintPlanFollowUpBinding(ctx(), step, { env: { [PLAN_FOLLOW_UP_BINDING_SECRET_ENV]: `${SECRET}-other` }, now: () => T0 })!;
  assert.deepEqual(verifyPlanFollowUpBinding(ctx(), other, at(1)), { status: "invalid", reason: "binding-signature-invalid" });

  for (const malformed of ["", "no-dot", "a.b.c", ".", 42, null, { token }, "x".repeat(9000)]) {
    const v = verifyPlanFollowUpBinding(ctx(), malformed, at(1));
    assert.equal(v.status, "invalid", `malformed ${JSON.stringify(malformed)?.slice(0, 20)} is refused`);
  }
}

function expiryAndContext(): void {
  const token = mintPlanFollowUpBinding(ctx(), step, at(0))!;
  assert.equal(verifyPlanFollowUpBinding(ctx(), token, at(PLAN_FOLLOW_UP_BINDING_TTL_MS)).status, "valid", "valid at the edge");
  assert.deepEqual(verifyPlanFollowUpBinding(ctx(), token, at(PLAN_FOLLOW_UP_BINDING_TTL_MS + 1)), { status: "invalid", reason: "binding-expired" });

  for (const [label, other] of [
    ["another tenant", ctx({ tenantId: "77777777-7777-4777-8777-777777777777" })],
    ["another user", ctx({ userId: "88888888-8888-4888-8888-888888888888" })],
    ["another session", ctx({ sessionContextId: "99999999-9999-4999-8999-999999999999" })],
  ] as const) {
    assert.deepEqual(verifyPlanFollowUpBinding(other, token, at(1)), { status: "invalid", reason: "binding-context-mismatch" }, label);
  }
}

function secretAndShape(): void {
  for (const bad of [{}, { [PLAN_FOLLOW_UP_BINDING_SECRET_ENV]: "" }, { [PLAN_FOLLOW_UP_BINDING_SECRET_ENV]: "short-secret" }]) {
    assert.equal(mintPlanFollowUpBinding(ctx(), step, { env: bad, now: () => T0 }), null, "no usable secret, no binding");
    assert.equal(planFollowUpBindingAvailable({ env: bad }), false);
    assert.deepEqual(verifyPlanFollowUpBinding(ctx(), "a.b", { env: bad }), { status: "invalid", reason: "binding-secret-unavailable" });
  }
  assert.equal(mintPlanFollowUpBinding(ctx(), { ...step, workItemIds: [] }, at(0)), null, "an empty step is not bindable");
  assert.equal(mintPlanFollowUpBinding(ctx(), { ...step, workItemIds: [W1, W1] }, at(0)), null, "duplicates are not bindable");
  assert.equal(mintPlanFollowUpBinding(ctx(), { ...step, workItemIds: ["W1"] }, at(0)), null, "an alias is never bound");
  const many = Array.from({ length: PLAN_FOLLOW_UP_MAX_SOURCES + 1 }, (_, i) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`);
  assert.equal(mintPlanFollowUpBinding(ctx(), { ...step, workItemIds: many }, at(0)), null, "over the bound is not bindable");
  assert.ok(mintPlanFollowUpBinding(ctx(), { ...step, workItemIds: many.slice(0, PLAN_FOLLOW_UP_MAX_SOURCES) }, at(0)), "at the bound is bindable");
}

function dedicatedSecretOnly(): void {
  const source = readFileSync("src/features/plan-follow-up-provenance/binding.server.ts", "utf8");
  const envNames = [...source.matchAll(/"(HEBUN_[A-Z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(envNames)], [PLAN_FOLLOW_UP_BINDING_SECRET_ENV], "the binding reads one secret, its own");
  assert.ok(source.includes("timingSafeEqual"), "the signature is compared in constant time");
  assert.ok(/given\.length !== want\.length/.test(source), "with the length compared first");
}

roundTrip();
tampering();
expiryAndContext();
secretAndShape();
dedicatedSecretOnly();
console.log("plan-follow-up-reference-v1/binding: OK");
