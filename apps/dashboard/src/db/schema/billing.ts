/*
 * billing.ts — COMMERCIAL-ACTIVATION-1. Stripe customer ↔ tenant binding and webhook idempotency.
 *
 * `billing_accounts` is the ONLY source of tenant identity for a Stripe event: a webhook resolves its
 * tenant by `stripe_customer_id` here, never from metadata or anything the event body claims. A row is
 * written only by the Owner-initiated checkout path, server-side, before Stripe sees the customer.
 * One row per (tenant, mode): test and live never share a customer.
 *
 * `base_plan` is the plan the tenant returns to when its subscription ends — captured at first
 * checkout, so a founding tenant that subscribes and later cancels returns to founding, not free.
 *
 * `billing_webhook_events` is append-only: its primary key makes a redelivered event a no-op.
 * Nothing here is deleted when a subscription ends; cancellation changes `companies.plan` only.
 */
import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./company";
import { users } from "./user";

export const billingAccounts = pgTable(
  "billing_accounts",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    mode: text("mode").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    basePlan: text("base_plan").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status"),
    /** When the Stripe read that produced the current state STARTED; an older read never overwrites a newer one. */
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "billing_accounts_pk", columns: [t.tenantId, t.mode] }),
    uniqueIndex("billing_accounts_customer_uq").on(t.stripeCustomerId),
    check("billing_accounts_mode_chk", sql`${t.mode} in ('test', 'live')`),
    check("billing_accounts_customer_chk", sql`${t.stripeCustomerId} like 'cus\\_%'`),
    check("billing_accounts_base_plan_chk", sql`${t.basePlan} in ('free', 'founding')`),
  ],
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    eventId: text("event_id").primaryKey(),
    mode: text("mode").notNull(),
    eventType: text("event_type").notNull(),
    tenantId: uuid("tenant_id").references(() => companies.id),
    outcome: text("outcome").notNull(),
    planBefore: text("plan_before"),
    planAfter: text("plan_after"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("billing_webhook_events_tenant_idx").on(t.tenantId, t.receivedAt),
    check("billing_webhook_events_id_chk", sql`${t.eventId} like 'evt\\_%'`),
    check("billing_webhook_events_mode_chk", sql`${t.mode} in ('test', 'live')`),
    check("billing_webhook_events_outcome_chk", sql`${t.outcome} in ('applied', 'unchanged', 'ignored')`),
  ],
);
