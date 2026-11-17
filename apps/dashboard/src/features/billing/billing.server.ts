/*
 * billing/billing.server.ts — COMMERCIAL-ACTIVATION-1. Free → Pro through Stripe, and back.
 *
 * THE ONLY WRITER OF `companies.plan` after tenant birth. Three acts:
 *
 *   startProCheckout   Owner-only. Verifies the configured Stripe price IS the public Pro price,
 *                      binds (tenant, mode) → Stripe customer in `billing_accounts` server-side,
 *                      then opens a Checkout Session. Writes no plan: paying is not yet proven.
 *   openBillingPortal  Owner-only. Stripe Customer Portal for an existing binding.
 *   processStripeWebhook
 *                      Signature-verified. Resolves the tenant ONLY through `billing_accounts`
 *                      (never metadata, never the event body's claims), RE-READS the customer's
 *                      subscriptions from Stripe, derives the plan, and writes it with the event id
 *                      in one transaction. A redelivered event is a no-op (primary key); events in
 *                      any order converge, because each one applies Stripe's CURRENT state and an
 *                      older read never overwrites a newer one (`synced_at`).
 *
 * Entitled to Pro ⇔ some subscription of this customer on the configured Pro price is `active`,
 * `trialing` or `past_due` (Stripe is still retrying the payment). Anything else — `incomplete`,
 * `unpaid`, `canceled`, `incomplete_expired`, `paused`, or no subscription — returns the tenant to
 * the `base_plan` captured at first checkout (`free`, or `founding` for a pre-billing tenant).
 *
 * Cancellation deletes nothing. It changes `companies.plan` and the subscription fields only; every
 * row the tenant owns stays exactly where it was.
 *
 * No transaction spans a Stripe call: network first, then a short transaction under a per-tenant
 * advisory lock.
 */
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { billingAccounts, billingWebhookEvents } from "@/db/schema/billing";
import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import { roles } from "@/db/schema/role";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readTenantPlan } from "@/features/tenant-entitlements/tenant-dispatch-ceiling.server";
import { asPlanCode, PRO_PRICE, type BasePlanCode, type PlanCode } from "@/features/tenant-entitlements/plans";
import { resolveBillingConfig, type BillingConfig, type BillingMode } from "./billing-config.server";
import { readSubscriptions, str, stripeRequest, StripeCallFailed, type FetchLike, type StripeSubscriptionSummary } from "./stripe-api.server";
import { verifyStripeSignature } from "./stripe-signature";

export interface BillingDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => Date;
}

export type BillingRefusal =
  | "unauthenticated"
  | "billing-unavailable"
  | "not-the-owner"
  | "already-pro"
  | "price-mismatch"
  | "no-billing-account"
  | "stripe-unavailable"
  | "persistence-unavailable";

export type BillingRedirect = { readonly status: "redirect"; readonly url: string } | { readonly status: "refused"; readonly reason: BillingRefusal };

const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

function dbOrNull(deps: BillingDeps): ControlPlaneDatabase | null {
  try {
    return (deps.getDb ?? getControlPlaneDb)();
  } catch {
    return null;
  }
}

/** The session's own active membership, in its own tenant, holds the tenant's `owner` role. */
export async function isTenantOwner(db: ControlPlaneDatabase, tenant: TenantContext): Promise<boolean> {
  const [row] = await db
    .select({ type: roles.type })
    .from(memberships)
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.tenantId, memberships.tenantId)))
    .where(
      and(
        eq(memberships.id, tenant.membershipId),
        eq(memberships.tenantId, tenant.tenantId),
        eq(memberships.userId, tenant.userId),
        eq(memberships.status, "active"),
        eq(memberships.lifecycleStatus, "active"),
      ),
    )
    .limit(1);
  return row?.type === "owner";
}

/** Pro iff a subscription on the configured Pro price is in an entitled state. Pure. */
export function deriveEntitlement(
  subscriptions: readonly StripeSubscriptionSummary[],
  proPriceId: string,
): { readonly entitled: boolean; readonly subscription: StripeSubscriptionSummary | null } {
  const onPro = subscriptions.filter((s) => s.priceIds.includes(proPriceId));
  const entitled = onPro.find((s) => ENTITLED_STATUSES.has(s.status)) ?? null;
  if (entitled) return { entitled: true, subscription: entitled };
  const latest = [...onPro].sort((a, b) => b.created - a.created)[0] ?? null;
  return { entitled: false, subscription: latest };
}

async function listCustomerSubscriptions(config: BillingConfig, customerId: string, fetchImpl?: FetchLike) {
  const list = await stripeRequest(config, "GET", "/subscriptions", { customer: customerId, status: "all", limit: 20 }, { fetchImpl });
  return readSubscriptions(list);
}

/** The configured price must BE the public Pro price, in the configured mode. Nothing else is sold. */
export async function verifyProPrice(config: BillingConfig, fetchImpl?: FetchLike): Promise<boolean> {
  const p = await stripeRequest(config, "GET", `/prices/${encodeURIComponent(config.proPriceId)}`, {}, { fetchImpl });
  const recurring = (p.recurring ?? null) as { interval?: unknown; interval_count?: unknown } | null;
  return (
    p.id === config.proPriceId &&
    p.active === true &&
    p.type === "recurring" &&
    p.unit_amount === PRO_PRICE.unitAmount &&
    p.currency === PRO_PRICE.currency &&
    recurring?.interval === PRO_PRICE.interval &&
    recurring?.interval_count === 1 &&
    p.livemode === (config.mode === "live")
  );
}

async function readAccount(db: ControlPlaneDatabase, tenantId: string, mode: BillingMode) {
  const [row] = await db
    .select()
    .from(billingAccounts)
    .where(and(eq(billingAccounts.tenantId, tenantId), eq(billingAccounts.mode, mode)))
    .limit(1);
  return row ?? null;
}

function basePlanFor(current: PlanCode): BasePlanCode {
  return current === "founding" ? "founding" : "free";
}

/** Owner-only. Opens Stripe Checkout for Pro; writes the customer binding, never the plan. */
export async function startProCheckout(tenant: TenantContext | null, deps: BillingDeps = {}): Promise<BillingRedirect> {
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const resolved = resolveBillingConfig(deps.env ?? process.env);
  if (resolved.status !== "configured") return { status: "refused", reason: "billing-unavailable" };
  const config = resolved.config;
  const db = dbOrNull(deps);
  if (!db) return { status: "refused", reason: "persistence-unavailable" };

  let plan: PlanCode;
  let orgName: string;
  let account: Awaited<ReturnType<typeof readAccount>>;
  try {
    if (!(await isTenantOwner(db, tenant))) return { status: "refused", reason: "not-the-owner" };
    plan = await readTenantPlan(db, tenant.tenantId);
    const [org] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, tenant.tenantId)).limit(1);
    orgName = org?.name ?? "";
    account = await readAccount(db, tenant.tenantId, config.mode);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (plan === "pro") return { status: "refused", reason: "already-pro" };

  try {
    if (!(await verifyProPrice(config, deps.fetchImpl))) return { status: "refused", reason: "price-mismatch" };

    if (!account) {
      /* Same idempotency key for the same (mode, tenant): a double click creates one customer. */
      const customer = await stripeRequest(
        config,
        "POST",
        "/customers",
        { name: orgName.slice(0, 200), "metadata[hebun_tenant_id]": tenant.tenantId, "metadata[hebun_mode]": config.mode },
        { idempotencyKey: `hebun-billing-customer-${config.mode}-${tenant.tenantId}`, fetchImpl: deps.fetchImpl },
      );
      const customerId = str(customer.id);
      if (!customerId?.startsWith("cus_")) throw new StripeCallFailed(200, "unreadable-customer");
      await db
        .insert(billingAccounts)
        .values({ tenantId: tenant.tenantId, mode: config.mode, stripeCustomerId: customerId, basePlan: basePlanFor(plan), createdBy: tenant.userId })
        .onConflictDoNothing();
      account = await readAccount(db, tenant.tenantId, config.mode);
      if (!account) return { status: "refused", reason: "persistence-unavailable" };
    } else {
      /* A paid subscription whose webhook has not landed yet must not be bought twice. */
      const { entitled } = deriveEntitlement(await listCustomerSubscriptions(config, account.stripeCustomerId, deps.fetchImpl), config.proPriceId);
      if (entitled) return { status: "refused", reason: "already-pro" };
    }

    const session = await stripeRequest(
      config,
      "POST",
      "/checkout/sessions",
      {
        mode: "subscription",
        customer: account.stripeCustomerId,
        "line_items[0][price]": config.proPriceId,
        "line_items[0][quantity]": 1,
        client_reference_id: tenant.tenantId,
        "subscription_data[metadata][hebun_tenant_id]": tenant.tenantId,
        success_url: `${config.returnOrigin}/account/plan?billing=success`,
        cancel_url: `${config.returnOrigin}/account/plan?billing=cancelled`,
      },
      { fetchImpl: deps.fetchImpl },
    );
    const url = str(session.url);
    if (!url?.startsWith("https://")) return { status: "refused", reason: "stripe-unavailable" };
    return { status: "redirect", url };
  } catch (error) {
    return { status: "refused", reason: error instanceof StripeCallFailed ? "stripe-unavailable" : "persistence-unavailable" };
  }
}

/** Owner-only. The Stripe Customer Portal for this tenant's own customer in the configured mode. */
export async function openBillingPortal(tenant: TenantContext | null, deps: BillingDeps = {}): Promise<BillingRedirect> {
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const resolved = resolveBillingConfig(deps.env ?? process.env);
  if (resolved.status !== "configured") return { status: "refused", reason: "billing-unavailable" };
  const config = resolved.config;
  const db = dbOrNull(deps);
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  let account: Awaited<ReturnType<typeof readAccount>>;
  try {
    if (!(await isTenantOwner(db, tenant))) return { status: "refused", reason: "not-the-owner" };
    account = await readAccount(db, tenant.tenantId, config.mode);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (!account) return { status: "refused", reason: "no-billing-account" };
  try {
    const portal = await stripeRequest(
      config,
      "POST",
      "/billing_portal/sessions",
      { customer: account.stripeCustomerId, return_url: `${config.returnOrigin}/account/plan` },
      { fetchImpl: deps.fetchImpl },
    );
    const url = str(portal.url);
    return url?.startsWith("https://") ? { status: "redirect", url } : { status: "refused", reason: "stripe-unavailable" };
  } catch {
    return { status: "refused", reason: "stripe-unavailable" };
  }
}

/* ── Webhook ─────────────────────────────────────────────────────────────────────────────────── */

/** The event types that can change entitlement. Every other type is recorded as ignored. */
export const SUBSCRIPTION_EVENT_TYPES: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

export interface WebhookOutcome {
  /** 2xx tells Stripe to stop retrying; 4xx/5xx makes it retry (only for transient causes). */
  readonly httpStatus: number;
  readonly outcome: "applied" | "unchanged" | "ignored" | "duplicate" | "refused" | "retry";
  readonly reason?: string;
}

class DuplicateEvent extends Error {}

export async function processStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  deps: BillingDeps = {},
): Promise<WebhookOutcome> {
  const resolved = resolveBillingConfig(deps.env ?? process.env);
  if (resolved.status !== "configured") return { httpStatus: 503, outcome: "retry", reason: "billing-unavailable" };
  const config = resolved.config;
  const now = (deps.now ?? (() => new Date()))();

  const signature = verifyStripeSignature(rawBody, signatureHeader, config.webhookSecret, Math.floor(now.getTime() / 1000));
  if (signature.status !== "verified") return { httpStatus: 400, outcome: "refused", reason: signature.reason };

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { httpStatus: 400, outcome: "refused", reason: "unparseable" };
  }
  const eventId = str(event.id);
  const eventType = str(event.type);
  if (!eventId?.startsWith("evt_") || !eventType) return { httpStatus: 400, outcome: "refused", reason: "malformed-event" };
  if (event.livemode !== (config.mode === "live")) return { httpStatus: 400, outcome: "refused", reason: "mode-mismatch" };

  const db = dbOrNull(deps);
  if (!db) return { httpStatus: 503, outcome: "retry", reason: "persistence-unavailable" };

  const object = ((event.data as { object?: unknown } | undefined)?.object ?? null) as Record<string, unknown> | null;
  const customerId = str(object?.customer);

  const recordIgnored = async (tenantId: string | null): Promise<WebhookOutcome> => {
    const inserted = await db
      .insert(billingWebhookEvents)
      .values({ eventId, mode: config.mode, eventType, tenantId, outcome: "ignored" })
      .onConflictDoNothing()
      .returning({ eventId: billingWebhookEvents.eventId });
    return { httpStatus: 200, outcome: inserted.length === 0 ? "duplicate" : "ignored" };
  };

  try {
    const [seen] = await db.select({ id: billingWebhookEvents.eventId }).from(billingWebhookEvents).where(eq(billingWebhookEvents.eventId, eventId)).limit(1);
    if (seen) return { httpStatus: 200, outcome: "duplicate" };
    if (!SUBSCRIPTION_EVENT_TYPES.has(eventType) || !customerId) return await recordIgnored(null);

    /* THE ONLY TENANT RESOLUTION: the binding this server wrote at checkout. */
    const [account] = await db
      .select()
      .from(billingAccounts)
      .where(and(eq(billingAccounts.stripeCustomerId, customerId), eq(billingAccounts.mode, config.mode)))
      .limit(1);
    if (!account) return await recordIgnored(null);

    /* Network first, outside any transaction. A Stripe failure is transient: let Stripe retry. */
    const readStartedAt = now;
    let derived: ReturnType<typeof deriveEntitlement>;
    try {
      derived = deriveEntitlement(await listCustomerSubscriptions(config, customerId, deps.fetchImpl), config.proPriceId);
    } catch {
      return { httpStatus: 502, outcome: "retry", reason: "stripe-unavailable" };
    }

    const result = await db.transaction(async (tx) => {
      const handle = tx as unknown as ControlPlaneDatabase;
      await handle.execute(sql`select pg_advisory_xact_lock(hashtext('hebun.billing-sync'), hashtext(${account.tenantId}))`);
      const before = await readTenantPlan(handle, account.tenantId);
      const target: PlanCode = derived.entitled ? "pro" : asPlanCode(account.basePlan) === "founding" ? "founding" : "free";

      /* Stale-read guard: a read that started before the stored one never overwrites it. */
      const fresh = await handle
        .update(billingAccounts)
        .set({
          stripeSubscriptionId: derived.subscription?.id ?? null,
          subscriptionStatus: derived.subscription?.status ?? null,
          syncedAt: readStartedAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(billingAccounts.tenantId, account.tenantId),
            eq(billingAccounts.mode, config.mode),
            or(isNull(billingAccounts.syncedAt), lt(billingAccounts.syncedAt, readStartedAt)),
          ),
        )
        .returning({ tenantId: billingAccounts.tenantId });

      let after = before;
      if (fresh.length > 0 && target !== before) {
        await handle.update(companies).set({ plan: target, updatedAt: now }).where(eq(companies.id, account.tenantId));
        after = target;
      }
      const outcome = after !== before ? ("applied" as const) : ("unchanged" as const);
      const inserted = await handle
        .insert(billingWebhookEvents)
        .values({ eventId, mode: config.mode, eventType, tenantId: account.tenantId, outcome, planBefore: before, planAfter: after })
        .onConflictDoNothing()
        .returning({ eventId: billingWebhookEvents.eventId });
      /* A concurrent delivery of the same event committed first: undo everything this one did. */
      if (inserted.length === 0) throw new DuplicateEvent();
      return outcome;
    });
    return { httpStatus: 200, outcome: result };
  } catch (error) {
    if (error instanceof DuplicateEvent) return { httpStatus: 200, outcome: "duplicate" };
    return { httpStatus: 503, outcome: "retry", reason: "persistence-unavailable" };
  }
}

/* ── Read model for Plan & Usage ─────────────────────────────────────────────────────────────── */

export interface BillingStateRead {
  readonly billingConfigured: boolean;
  readonly mode: BillingMode | null;
  readonly isOwner: boolean;
  readonly hasBillingAccount: boolean;
  readonly subscriptionStatus: string | null;
}

/** Read only. Keyed by the session's tenant; never reveals a customer id or any Stripe secret. */
export async function readBillingState(tenant: TenantContext | null, deps: BillingDeps = {}): Promise<BillingStateRead | null> {
  if (!tenant?.tenantId) return null;
  const db = dbOrNull(deps);
  if (!db) return null;
  const resolved = resolveBillingConfig(deps.env ?? process.env);
  const mode = resolved.status === "configured" ? resolved.config.mode : null;
  try {
    const isOwner = await isTenantOwner(db, tenant);
    const account = mode ? await readAccount(db, tenant.tenantId, mode) : null;
    return {
      billingConfigured: mode !== null,
      mode,
      isOwner,
      hasBillingAccount: account !== null,
      subscriptionStatus: account?.subscriptionStatus ?? null,
    };
  } catch {
    return null;
  }
}
