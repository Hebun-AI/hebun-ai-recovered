/*
 * integrations — a TENANT'S CONNECTION to an external provider (I1).
 *
 * ── WHAT ONE ROW MEANS ───────────────────────────────────────────────────────
 *
 * "This tenant has a connection record for this provider." That is all. A row asserts no
 * credential, no verification, no capability and no authorization. `connection_state` says which
 * of those, if any, has actually been established, and in I1 a row can only ever reach `draft`.
 *
 * ── WHY THIS TABLE IS EXTENDED AND NOT REPLACED ──────────────────────────────
 *
 * The table already existed, already carried `tenantColumns`, and already had the right ownership
 * FK. It was dormant — zero readers and zero writers anywhere in `src/` — but dormant is not the
 * same as wrong, and a replacement would have orphaned any manually-created row.
 *
 * ── WHAT IS DELIBERATELY LEFT ALONE ──────────────────────────────────────────
 *
 * `status` (integration_status) is KEPT, INERT and UNREAD. It predates any connection runtime and
 * conflates lifecycle with health. Nothing in `integration-authority` writes it or reads it, and
 * dropping it would destroy the meaning of any hand-created row. It is recorded debt, not design.
 *
 * `provider_id` is KEPT and stays NULLABLE and unread for the same reason. `provider_key` is the
 * binding that means something, because it names an entry in the FROZEN CODE CATALOG. That
 * distinction is the whole point: a row in `providers` must never be able to make a new provider
 * connectable, exactly as `action-execution/adapter-registry.server.ts` already refused to let a
 * row make a new external capability runnable.
 *
 * `provider_key` is NULLABLE IN THE SCHEMA and NON-NULL IN THE WRITER. A `NOT NULL` without a
 * default cannot be added to a table that may already hold hand-created rows, and a default would
 * have manufactured a catalog key nobody chose. Promoting it to a constraint is a later migration,
 * once the application is provably the only writer.
 *
 * ── WHY THERE IS NO connection_metadata jsonb ────────────────────────────────
 *
 * An unbounded bag on the table adjacent to credentials is where a secret eventually lands by
 * accident. Every field such a bag would carry either has a named column here or does not exist
 * yet, so it would only ever be a place for one to hide.
 *
 * ── WHAT DOES NOT EXIST HERE, ON PURPOSE ─────────────────────────────────────
 *
 *   NO credential, ciphertext, token or secret of any kind — I1 stores none, and I2 puts them in
 *     their own table so a metadata read can never touch a secret store.
 *   NO read_capable / write_capable — both are DERIVED from the granted scope set and the frozen
 *     catalog. A stored copy would drift the moment a provider reduced a grant.
 *   NO write_authorized, permit, or approval — Governance owns authorization and this table has no
 *     column capable of expressing it.
 *   NO sync cursor, last_sync_at or watermark — no scheduler, worker or dispatcher exists.
 *
 * ── UNIQUENESS ───────────────────────────────────────────────────────────────
 *
 * `integrations_id_tenant_uq` on (id, tenant_id) exists so I2's credential table can carry the
 * composite foreign key that makes a cross-tenant credential unattachable at the database rather
 * than at the application. It is redundant with the primary key by design.
 *
 * `integrations_tenant_provider_account_uq` is PARTIAL — it excludes terminal rows. That is what
 * lets a tenant reconnect a provider account they previously disconnected while still refusing two
 * live connections to the same account. It is scoped to `tenant_id`, never global: two tenants
 * legitimately connecting the same external workspace is real, and a global unique would let one
 * tenant block another.
 */
import { pgTable, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantColumns } from "./_base";
import {
  integrationConnectionStateEnum,
  integrationHealthEnum,
  integrationStatusEnum,
} from "./_enums";
import { providers } from "./provider";

export const integrations = pgTable(
  "integrations",
  {
    ...tenantColumns,

    /** LEGACY, INERT. Kept so hand-created rows keep their meaning. Nothing reads it. */
    providerId: uuid("provider_id").references(() => providers.id),

    name: text("name").notNull(),

    /** LEGACY, INERT. Superseded by `connectionState`. Never read, never written by I1. */
    status: integrationStatusEnum("status").notNull().default("pending"),

    /**
     * The frozen-catalog entry this connection binds to. Nullable in the schema for existing rows;
     * the writer never produces a row without it, and an unresolvable key makes the connection
     * report as unusable rather than silently defaulting to something.
     */
    providerKey: text("provider_key"),

    /** THE LIFECYCLE. See `_enums.ts`. I1 can only ever create `draft`. */
    connectionState: integrationConnectionStateEnum("connection_state").notNull().default("draft"),

    /** THE SECOND DIMENSION. Never moves the lifecycle. I1 can only ever set `unknown`. */
    health: integrationHealthEnum("health").notNull().default("unknown"),

    /**
     * Set ONLY by a full verification (I2). A successful data read must never write it, or
     * "verified" degrades into "we talked to them recently".
     */
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    /** Health signal — the last time any provider call succeeded. */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),

    /** Health signal — the last time any provider call failed. */
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

    /**
     * A CLASSIFIED CODE from a closed set, never a provider payload. A raw body persisted here
     * would put an arbitrary third party in control of what this column contains.
     */
    failureReason: text("failure_reason"),

    /**
     * The provider-side identity this connection is bound to. Written only by verification, and a
     * CHANGE is a refusal rather than an update: a credential now pointing at a different account
     * would retroactively falsify every provenance record naming this connection.
     */
    externalAccountId: text("external_account_id"),

    /** Display only, so a tenant can tell two connections to the same provider apart. */
    externalAccountLabel: text("external_account_label"),

    /** Set on entry to a terminal state. Never cleared — reconnecting creates a NEW row. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /**
     * The granted scope set AS OBSERVED at the last verification — never what was requested.
     * Existing column; I1 only pins its meaning and never writes it.
     */
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  },
  (t) => [
    /* Redundant with the primary key on purpose: I2's composite FK target. */
    uniqueIndex("integrations_id_tenant_uq").on(t.id, t.tenantId),
    /*
     * One live connection per external account per tenant. Partial, so a reconnect after a
     * disconnect is allowed and a terminal row never blocks it.
     */
    uniqueIndex("integrations_tenant_provider_account_uq")
      .on(t.tenantId, t.providerKey, t.externalAccountId)
      .where(sql`${t.connectionState} not in ('revoked', 'disconnected')`),
  ],
);
