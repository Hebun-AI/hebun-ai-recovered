/*
 * COMMERCIAL-ACTIVATION-1 — Free / Pro / Founding against a real, disposable PostgreSQL, with Stripe
 * replaced by a scripted fetch (no network, no Stripe account, no secret).
 *
 * Tenants: Acme (founding — the seeded pre-billing tenant), Globex (free, plus a non-owner editor),
 * Initech (pro, set directly, for the member limit).
 *
 *   M1 migration semantics: default `founding`, CHECK refuses an unknown plan, and the migration's own
 *      UPDATE turns every pre-existing `free` row into `founding` (run in a rolled-back transaction).
 *   L1 the cap the usage read reports is the plan's: founding 50/5, free 15/1, pro 100/10.
 *   V1 video is refused for Free before any row or provider call; founding passes the gate.
 *   N1 member limit: Free (1) refuses issue and accept; Pro (5) counts pending invitations at issue
 *      only; founding has no limit.
 *   B1–B5 checkout: non-owner refused, price mismatch refused before any customer, owner gets a Stripe
 *      URL with a server-side tenant binding and an idempotent customer, a second checkout reuses it.
 *   W1–W12 webhook: forged signature, unknown customer, applied, duplicate, already-pro, stale read,
 *      cancellation keeps data, past_due keeps Pro, livemode mismatch, founding returns to founding,
 *      Stripe outage retries without recording, and one tenant's event never touches another.
 *   R1 portal: owner only, own customer only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readAiDispatchUsageToday } from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { registerAsyncMediaGeneration } from "../../src/features/media-assets/async-generation-lifecycle.server";
import { createFakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { enforceMemberLimitWithin, PlanMemberLimitReached } from "../../src/features/tenant-entitlements/member-limit.server";
import { openBillingPortal, processStripeWebhook, startProCheckout } from "../../src/features/billing/billing.server";
import { signStripePayload } from "../../src/features/billing/stripe-signature";
import type { FetchLike } from "../../src/features/billing/stripe-api.server";

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("commercial-activation-1/billing-postgres: exited before completing");
    process.exitCode = 1;
  }
});

const MIGRATION = "src/db/migrations/20261110092021_commercial_billing.sql";
const WHSEC = "whsec_commercial_activation_test";
const ENV = {
  HEBUN_BILLING_MODE: "test",
  HEBUN_STRIPE_SECRET_KEY: "sk_test_SIMULATED_NOT_A_KEY",
  HEBUN_STRIPE_WEBHOOK_SECRET: WHSEC,
  HEBUN_STRIPE_PRO_PRICE_ID: "price_pro49",
  HEBUN_BILLING_RETURN_ORIGIN: "https://app.example.test",
};

/* ── Scripted Stripe ─────────────────────────────────────────────────────────────────────────── */
interface Call { readonly method: string; readonly path: string; readonly params: URLSearchParams; readonly idempotencyKey?: string }
const stripe = {
  calls: [] as Call[],
  priceAmount: 4900,
  down: false,
  customers: 0,
  subs: new Map<string, { id: string; status: string; created: number; price: string }[]>(),
};
const fetchImpl: FetchLike = async (url, init) => {
  if (stripe.down) throw new Error("network");
  const u = new URL(url);
  const path = u.pathname.replace(/^\/v1/, "");
  const params = new URLSearchParams(init.method === "GET" ? u.search : init.body ?? "");
  stripe.calls.push({ method: init.method, path, params, idempotencyKey: init.headers["Idempotency-Key"] });
  const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });
  if (init.method === "GET" && path === "/prices/price_pro49") {
    return ok({ id: "price_pro49", active: true, type: "recurring", unit_amount: stripe.priceAmount, currency: "usd", recurring: { interval: "month", interval_count: 1 }, livemode: false });
  }
  if (init.method === "POST" && path === "/customers") {
    stripe.customers += 1;
    return ok({ id: `cus_${params.get("metadata[hebun_tenant_id]")!.slice(0, 8)}` });
  }
  if (init.method === "GET" && path === "/subscriptions") {
    const list = stripe.subs.get(params.get("customer")!) ?? [];
    return ok({ data: list.map((s) => ({ id: s.id, status: s.status, created: s.created, items: { data: [{ price: { id: s.price } }] } })) });
  }
  if (init.method === "POST" && path === "/checkout/sessions") return ok({ url: "https://checkout.stripe.com/c/pay/cs_test_sim" });
  if (init.method === "POST" && path === "/billing_portal/sessions") return ok({ url: "https://billing.stripe.com/p/session/test_sim" });
  return { ok: false, status: 404, json: async () => ({ error: { code: "resource_missing" } }) };
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_commercial_billing");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = (): ControlPlaneDatabase => handle.db;
  try {
    const session = async (s: Seeded, tag: string) =>
      (await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false,now(),now(),now(),now()+interval '1 day',now()+interval '1 hour') returning id`,
        [s.authIdentityId, tag.padEnd(64, "c").slice(0, 64), s.userId, s.tenantId, s.membershipId],
      )).rows[0]!.id;
    const ctxFor = async (s: Seeded, tag: string): Promise<TenantContext> =>
      asHumanTenantContext({
        tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
        membershipVersion: 1, roleId: s.roleId, sessionContextId: await session(s, tag), provider: "local", assuranceLevel: "aal1",
        mfaVerified: false, requestId: "commercial-activation-1", authenticatedAt: new Date().toISOString(),
      });
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme Rugs", companySlug: "acme-ca1", email: "o@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ca1", email: "o@globex.test" })) as Seeded;
    const initech = (await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech-ca1", email: "o@initech.test" })) as Seeded;
    const plan = async (tenantId: string) => (await setup.query<{ plan: string }>(`select plan from companies where id = $1`, [tenantId])).rows[0]!.plan;

    /* ── M1 ── */
    assert.equal(await plan(acme.tenantId), "founding", "M1 the seeded (ceremony-shaped) tenant is founding by default");
    await assert.rejects(setup.query(`update companies set plan = 'enterprise' where id = $1`, [acme.tenantId]), /companies_plan_chk/);
    await setup.query(`update companies set plan = 'free' where id = $1`, [globex.tenantId]);
    const update = readFileSync(MIGRATION, "utf8").split("--> statement-breakpoint").map((s) => s.trim()).find((s) => s.includes(`UPDATE "companies"`))!;
    await setup.query("begin");
    await setup.query(update.replace(/^--.*$/gm, "").trim());
    assert.equal(await plan(globex.tenantId), "founding", "M1 the migration's UPDATE turns a pre-existing free row into founding");
    await setup.query("rollback");
    assert.equal(await plan(globex.tenantId), "free");
    await setup.query(`update companies set plan = 'pro' where id = $1`, [initech.tenantId]);
    console.log("ok M1 default founding, CHECK, pre-existing rows become founding");

    /* ── L1 ── */
    const caps = async (s: Seeded) => {
      const r = await readAiDispatchUsageToday(s.tenantId, { getDb, env: {} });
      assert.equal(r.status, "read");
      return r.status === "read" ? r.classes.map((c) => c.capPerTenantUtcDay) : [];
    };
    assert.deepEqual(await caps(acme), [50, 5], "L1 founding keeps 50 / 5");
    assert.deepEqual(await caps(globex), [15, 1], "L1 free is 15 / 1");
    assert.deepEqual(await caps(initech), [100, 10], "L1 pro is 100 / 10");
    console.log("ok L1 the enforced cap is the plan's");

    /* ── V1 ── */
    const videoInput = { artifactId: crypto.randomUUID(), revisionNo: 1, promptText: "a rug on a loom", requestKey: crypto.randomUUID() };
    const fake = createFakeAsyncVideoTransport();
    const videoDeps = { getDb, resolveTransport: async () => ({ status: "available" as const, transport: fake }) };
    const globexCtx = await ctxFor(globex, "b1");
    const refusedVideo = await registerAsyncMediaGeneration(globexCtx, videoInput, videoDeps as never);
    assert.deepEqual(refusedVideo, { status: "refused", reason: "plan-video-not-included" });
    assert.equal(fake.dispatchCalls.length, 0, "V1 no provider call");
    assert.equal((await setup.query(`select count(*)::int n from media_generation_invocations where tenant_id = $1`, [globex.tenantId])).rows[0]!.n, 0, "V1 no row");
    const acmeCtx = await ctxFor(acme, "a1");
    const passed = await registerAsyncMediaGeneration(acmeCtx, { ...videoInput, requestKey: crypto.randomUUID() }, videoDeps as never);
    assert.ok(passed.status !== "refused" || passed.reason !== "plan-video-not-included", "V1 founding is not refused for its plan");
    console.log("ok V1 video is a plan feature, refused for Free before any row or call");

    /* ── N1 ── */
    const addMember = async (s: Seeded, email: string, status = "active") => {
      const u = (await setup.query<{ id: string }>(`insert into users (email, name) values ($1,$1) returning id`, [email])).rows[0]!.id;
      /* One `member` role per tenant (roles_one_member_per_tenant_uq): created once, then reused. */
      const existing = (await setup.query<{ id: string }>(`select id from roles where tenant_id = $1 and type = 'member'`, [s.tenantId])).rows[0];
      const r = existing?.id ?? (await setup.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1,'Member','member') returning id`, [s.tenantId])).rows[0]!.id;
      await setup.query(`insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,$4)`, [s.tenantId, u, r, status]);
      return r;
    };
    const within = async (s: Seeded, act: "issue-invitation" | "accept-invitation") => {
      try {
        await handle.db.transaction(async (tx) => enforceMemberLimitWithin(tx as unknown as ControlPlaneDatabase, s.tenantId, new Date(), act));
        return "seat";
      } catch (error) {
        if (error instanceof PlanMemberLimitReached) return "full";
        throw error;
      }
    };
    assert.equal(await within(globex, "issue-invitation"), "full", "N1 free: the owner holds the only seat");
    assert.equal(await within(globex, "accept-invitation"), "full");
    const memberRole = await addMember(initech, "m1@initech.test");
    await addMember(initech, "m2@initech.test");
    await addMember(initech, "m3@initech.test", "suspended");
    assert.equal(await within(initech, "issue-invitation"), "seat", "N1 pro: 4 of 5 seats");
    await setup.query(
      `insert into invitations (tenant_id, normalized_email, intended_role_id, inviter_type, inviter_id, token_hash, expires_at)
       values ($1,'next@initech.test',$2,'human',$3,$4, now() + interval '1 day')`,
      [initech.tenantId, memberRole, initech.userId, "a".repeat(64)],
    );
    assert.equal(await within(initech, "issue-invitation"), "full", "N1 a pending invitation holds the fifth seat");
    assert.equal(await within(initech, "accept-invitation"), "seat", "N1 accepting it needs only a membership seat");
    await addMember(initech, "m5@initech.test", "revoked");
    assert.equal(await within(initech, "accept-invitation"), "seat", "N1 a revoked membership holds no seat");
    for (let i = 0; i < 6; i += 1) await addMember(acme, `f${i}@acme.test`);
    assert.equal(await within(acme, "issue-invitation"), "seat", "N1 founding has no member limit");
    console.log("ok N1 member limit per plan, server-side, under lock");

    /* ── B1–B5 checkout ── */
    const deps = { getDb, env: ENV, fetchImpl, now: () => new Date() };
    const editorRole = (await setup.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1,'Editor','operator') returning id`, [globex.tenantId])).rows[0]!.id;
    const editorUser = (await setup.query<{ id: string }>(`insert into users (email, name) values ('e@globex.test','Ed') returning id`)).rows[0]!.id;
    const editorIdentity = (await setup.query<{ id: string }>(
      `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at) values ($1,'local','hebun-local','local:e@globex.test','active',true,now()) returning id`, [editorUser],
    )).rows[0]!.id;
    const editorMembership = (await setup.query<{ id: string }>(`insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active') returning id`, [globex.tenantId, editorUser, editorRole])).rows[0]!.id;
    const editorCtx = await ctxFor({ tenantId: globex.tenantId, userId: editorUser, authIdentityId: editorIdentity, membershipId: editorMembership, roleId: editorRole }, "e1");

    stripe.calls.length = 0;
    assert.deepEqual(await startProCheckout(editorCtx, deps), { status: "refused", reason: "not-the-owner" }, "B1");
    assert.equal(stripe.calls.length, 0, "B1 no Stripe call for a non-owner");
    assert.deepEqual(await startProCheckout({ ...globexCtx, membershipId: editorMembership }, deps), { status: "refused", reason: "not-the-owner" }, "B1 a forged membership id is not the owner");

    stripe.priceAmount = 3900;
    assert.deepEqual(await startProCheckout(globexCtx, deps), { status: "refused", reason: "price-mismatch" }, "B2");
    assert.equal(stripe.customers, 0, "B2 no customer is created for a wrong price");
    stripe.priceAmount = 4900;

    const checkout = await startProCheckout(globexCtx, deps);
    assert.deepEqual(checkout, { status: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_sim" }, "B3");
    const account = (await setup.query(`select tenant_id, mode, stripe_customer_id, base_plan, created_by from billing_accounts where tenant_id = $1`, [globex.tenantId])).rows[0];
    const globexCustomer = `cus_${globex.tenantId.slice(0, 8)}`;
    assert.deepEqual(account, { tenant_id: globex.tenantId, mode: "test", stripe_customer_id: globexCustomer, base_plan: "free", created_by: globex.userId });
    const created = stripe.calls.find((c) => c.path === "/customers")!;
    assert.equal(created.idempotencyKey, `hebun-billing-customer-test-${globex.tenantId}`, "B3 idempotent customer creation");
    const checkoutCall = stripe.calls.find((c) => c.path === "/checkout/sessions")!;
    assert.deepEqual(
      [checkoutCall.params.get("customer"), checkoutCall.params.get("line_items[0][price]"), checkoutCall.params.get("client_reference_id"), checkoutCall.params.get("success_url"), checkoutCall.params.get("mode")],
      [globexCustomer, "price_pro49", globex.tenantId, "https://app.example.test/account/plan?billing=success", "subscription"],
      "B3 tenant, price and return URL are the server's",
    );
    assert.equal(await plan(globex.tenantId), "free", "B3 opening checkout grants nothing");
    stripe.calls.length = 0;
    assert.equal((await startProCheckout(globexCtx, deps)).status, "redirect", "B4");
    assert.equal(stripe.calls.filter((c) => c.path === "/customers").length, 0, "B4 the binding is reused");
    console.log("ok B1-B5 checkout: owner only, verified price, server-side binding");

    /* ── W1–W12 webhook ── */
    let n = 0;
    const event = (customer: string | null, type = "customer.subscription.updated", livemode = false) => {
      n += 1;
      return JSON.stringify({ id: `evt_ca1_${n}`, type, livemode, data: { object: customer ? { customer } : {} } });
    };
    const deliver = (body: string, at = new Date(), secret = WHSEC) =>
      processStripeWebhook(body, signStripePayload(body, secret, Math.floor(at.getTime() / 1000)), { ...deps, now: () => at });
    const events = async () => (await setup.query<{ n: number }>(`select count(*)::int n from billing_webhook_events`)).rows[0]!.n;

    const forged = event(globexCustomer);
    assert.deepEqual(await deliver(forged, new Date(), "whsec_attacker"), { httpStatus: 400, outcome: "refused", reason: "no-matching-signature" }, "W1");
    assert.equal(await events(), 0);

    assert.deepEqual(await deliver(event("cus_unknown")), { httpStatus: 200, outcome: "ignored" }, "W2 unknown customer");
    assert.equal(await plan(globex.tenantId), "free");

    stripe.subs.set(globexCustomer, [{ id: "sub_g1", status: "active", created: 1, price: "price_pro49" }]);
    const activated = event(globexCustomer, "customer.subscription.created");
    const t3 = new Date();
    assert.deepEqual(await deliver(activated, t3), { httpStatus: 200, outcome: "applied" }, "W3");
    assert.equal(await plan(globex.tenantId), "pro");
    assert.equal(await plan(acme.tenantId), "founding", "W12 another tenant is untouched");
    const row = (await setup.query(`select tenant_id, outcome, plan_before, plan_after from billing_webhook_events where event_id = $1`, [JSON.parse(activated).id])).rows[0];
    assert.deepEqual(row, { tenant_id: globex.tenantId, outcome: "applied", plan_before: "free", plan_after: "pro" });

    assert.deepEqual(await deliver(activated, t3), { httpStatus: 200, outcome: "duplicate" }, "W4 redelivery is a no-op");
    assert.equal((await setup.query(`select count(*)::int n from billing_webhook_events where event_id = $1`, [JSON.parse(activated).id])).rows[0]!.n, 1);

    assert.deepEqual(await startProCheckout(globexCtx, deps), { status: "refused", reason: "already-pro" }, "W5");

    stripe.subs.set(globexCustomer, [{ id: "sub_g1", status: "canceled", created: 1, price: "price_pro49" }]);
    assert.deepEqual(await deliver(event(globexCustomer), new Date(t3.getTime() - 60_000)), { httpStatus: 200, outcome: "unchanged" }, "W6 an older read never overwrites a newer one");
    assert.equal(await plan(globex.tenantId), "pro");

    stripe.subs.set(globexCustomer, [{ id: "sub_g1", status: "past_due", created: 1, price: "price_pro49" }]);
    assert.deepEqual(await deliver(event(globexCustomer, "invoice.payment_failed"), new Date(t3.getTime() + 1_000)), { httpStatus: 200, outcome: "unchanged" }, "W8 past_due keeps Pro");
    assert.equal(await plan(globex.tenantId), "pro");

    await setup.query(
      `insert into support_tickets (tenant_id, title, description, created_by, updated_by) values ($1,'Keep me','Data that must survive cancellation',$2,$2)`,
      [globex.tenantId, globex.userId],
    );
    const before = (await setup.query(`select (select count(*) from memberships where tenant_id = $1)::int m, (select count(*) from support_tickets where tenant_id = $1)::int t, (select count(*) from billing_accounts where tenant_id = $1)::int b`, [globex.tenantId])).rows[0];
    stripe.subs.set(globexCustomer, [{ id: "sub_g1", status: "canceled", created: 1, price: "price_pro49" }]);
    assert.deepEqual(await deliver(event(globexCustomer, "customer.subscription.deleted"), new Date(t3.getTime() + 2_000)), { httpStatus: 200, outcome: "applied" }, "W7");
    assert.equal(await plan(globex.tenantId), "free", "W7 cancellation returns to the base plan");
    const after = (await setup.query(`select (select count(*) from memberships where tenant_id = $1)::int m, (select count(*) from support_tickets where tenant_id = $1)::int t, (select count(*) from billing_accounts where tenant_id = $1)::int b`, [globex.tenantId])).rows[0];
    assert.deepEqual(after, before, "W7 cancellation deletes nothing");

    assert.deepEqual(await deliver(event(globexCustomer, "customer.subscription.updated", true)), { httpStatus: 400, outcome: "refused", reason: "mode-mismatch" }, "W9");

    /* W10 — a founding tenant subscribes and cancels: it returns to founding, never free. */
    const acmeOwner = acmeCtx;
    assert.equal((await startProCheckout(acmeOwner, deps)).status, "redirect");
    const acmeCustomer = `cus_${acme.tenantId.slice(0, 8)}`;
    assert.equal((await setup.query(`select base_plan from billing_accounts where tenant_id = $1`, [acme.tenantId])).rows[0]!.base_plan, "founding");
    stripe.subs.set(acmeCustomer, [{ id: "sub_a1", status: "active", created: 1, price: "price_pro49" }]);
    assert.equal((await deliver(event(acmeCustomer, "checkout.session.completed"), new Date(t3.getTime() + 3_000))).outcome, "applied");
    assert.equal(await plan(acme.tenantId), "pro");
    assert.equal(await plan(globex.tenantId), "free", "W12 Acme's subscription never touches Globex");
    stripe.subs.set(acmeCustomer, [{ id: "sub_a1", status: "canceled", created: 1, price: "price_pro49" }]);
    assert.equal((await deliver(event(acmeCustomer, "customer.subscription.deleted"), new Date(t3.getTime() + 4_000))).outcome, "applied");
    assert.equal(await plan(acme.tenantId), "founding", "W10 founding returns to founding");

    /* W11 — Stripe unreachable: retry, record nothing, so the redelivery is processed. */
    const outage = event(acmeCustomer);
    const countBefore = await events();
    stripe.down = true;
    assert.deepEqual(await deliver(outage, new Date(t3.getTime() + 5_000)), { httpStatus: 502, outcome: "retry", reason: "stripe-unavailable" }, "W11");
    assert.equal(await events(), countBefore, "W11 nothing recorded");
    stripe.down = false;
    assert.equal((await deliver(outage, new Date(t3.getTime() + 6_000))).outcome, "unchanged", "W11 the retry is processed");
    console.log("ok W1-W12 webhook: signed, idempotent, ordered, tenant-bound, non-destructive");

    /* ── R1 portal ── */
    assert.deepEqual(await openBillingPortal(editorCtx, deps), { status: "refused", reason: "not-the-owner" });
    assert.deepEqual(await openBillingPortal(globexCtx, deps), { status: "redirect", url: "https://billing.stripe.com/p/session/test_sim" });
    assert.equal(stripe.calls.at(-1)!.params.get("customer"), globexCustomer, "R1 the portal opens the session tenant's own customer");
    assert.deepEqual(await openBillingPortal(await ctxFor(initech, "c1"), deps), { status: "refused", reason: "no-billing-account" });
    console.log("ok R1 portal: owner only, own customer");

    finished = true;
    console.log("PASS commercial-activation-1 billing postgres");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
