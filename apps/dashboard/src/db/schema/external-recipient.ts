/*
 * external_recipients — durable, tenant-local addressable recipients (R3R).
 *
 * ── THE ONE FACT, AND WHY IT IS ONE TABLE ────────────────────────────────────
 *
 *   "this tenant recorded one way to reach someone outside the organization."
 *
 * Gate A expected two tables mirroring `work_artifacts` / `work_artifact_revisions` and concluded
 * the opposite. The revision table exists because an artifact's CONTENT IS EDITED REPEATEDLY and
 * its history matters. An address is never edited — it is REPLACED. Immutable rows give the same
 * "approved bytes cannot drift" guarantee with one less table, and grouping several addresses
 * under one person is not a proven requirement: the only consumer,
 * `heby.operations.send-communication`, takes exactly one recipient.
 *
 *   RECIPIENT ≠ USER ≠ MEMBER ≠ TENANT ≠ ORGANIZATION ≠ KNOWLEDGE ≠ DECISION ≠ PERMIT ≠ EXECUTION
 *
 * ── WHY NOT `users` ──────────────────────────────────────────────────────────
 *
 * `users` uses `rootColumns` — it has NO `tenant_id` at all — and carries `users_email_uq` as a
 * GLOBAL unique on email. One customer address could therefore exist exactly once across the whole
 * installation, so two tenants could not both hold the same customer. That alone disqualifies it.
 * Beyond that, three foreign keys make a `users` row an authenticatable principal
 * (`auth_identities`, `user_session_contexts`, `memberships`) and the schema states that a human
 * actor resolves as `(actorType="human", actorId=users.id)`. Recording a customer must never mint
 * a login.
 *
 * ── WHY NOT `companies` / `organizations` ────────────────────────────────────
 *
 * `companies` IS the tenant root — `plan`, `tenant_status`, `authentication_disabled_at`,
 * `deleting_at`. Modelling an external counterparty there makes that counterparty a TENANT.
 * `organizations` is, in its own words, "sub-structure under a company (tenant-owned)": using it
 * would declare an outside company part of this tenant's internal hierarchy.
 *
 * ── WHY THE ADDRESS IS IMMUTABLE ─────────────────────────────────────────────
 *
 * `endpoint_kind`, `endpoint_value` and `endpoint_digest` are written once and never updated. A
 * mutable address column would silently re-point every approved-but-unspent permit — precisely the
 * drift R3W was built to stop. "Changing Jane's email" is therefore RETIRE + CREATE, never UPDATE,
 * and a permit bound to the retired row must refuse at execution rather than quietly deliver
 * somewhere nobody approved. That refusal is R3B's to enforce; this table's job is to make the
 * bytes incapable of moving underneath it.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * It is NOT a CRM record. There is no pipeline, stage, deal value, activity, note, tag, score,
 * campaign, segment, lifetime value, forecast or owner. `party_kind` and `organization_label` were
 * both cut at Gate A on the same test: neither changes delivery, binding or authority, and
 * `display_name` already carries "Globex Inc." or "Ayşe Yılmaz (Globex)" to the human reading an
 * approval.
 *
 * It is NOT Knowledge. A recorded address is operational directory data, not organizational truth,
 * and no writer in this domain touches `knowledge_nodes` or `knowledge_facts`.
 *
 * It is NOT a verification claim. No email verification system exists anywhere in this repository,
 * so there is no `verified`, no `verified_at`, and no badge. Stored ≠ verified ≠ deliverable.
 *
 * It is NOT an identity claim. Two rows with the same `display_name` are two records. Hebun stores
 * tenant-local addressable records and never asserts that two of them are the same human — there
 * is no merge, no `merged_into`, no fuzzy matching and no person graph.
 *
 * It carries NO credential, NO provider token, NO external system id, NO confidence and NO trust.
 *
 * ── WHY A DIGEST ─────────────────────────────────────────────────────────────
 *
 * `endpoint_digest` is SHA-256 over the NORMALIZED address. It is EVIDENCE OF BYTES, never proof
 * that the address works or that anyone owns it. A future action request carries the recipient ref
 * and this digest as ordinary typed scalars inside R3A's existing canonical payload, so R3A's
 * `payload_digest` already covers them and R3A needs no change to bind a recipient.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { char, check, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { externalRecipientEndpointKindEnum, externalRecipientStatusEnum } from "./_enums";
import { companies } from "./company";

export const externalRecipients = pgTable(
  "external_recipients",
  {
    ...tenantColumns,

    /** What a human reads on an approval surface. Mutable — it names nothing that binds. */
    displayName: text("display_name").notNull(),

    /** IMMUTABLE. See the header: no writer in this domain updates these three columns. */
    endpointKind: externalRecipientEndpointKindEnum("endpoint_kind").notNull(),
    endpointValue: text("endpoint_value").notNull(),
    endpointDigest: char("endpoint_digest", { length: 64 }).notNull(),

    status: externalRecipientStatusEnum("status").notNull().default("active"),
  },
  (t) => [
    /*
     * The composite-FK anchor. Nothing references recipients yet, and it exists anyway for the
     * same reason `work_artifacts_tenant_id_uq` does: the moment something does, tenant safety has
     * to be structural rather than an application `where` clause somebody can forget.
     */
    uniqueIndex("external_recipients_tenant_id_uq").on(t.tenantId, t.id),

    /*
     * THE TENANCY INVARIANT, and it points in two directions at once.
     *
     * Scoped to `tenant_id`, so tenant A and tenant B may BOTH hold jane@example.com — required,
     * ordinary, and exactly what the global `users_email_uq` makes impossible.
     *
     * Partial on `status = 'active'`, so one LIVE address maps to one record inside a tenant.
     * Without it two records could carry the same address and an approval surface could not say
     * which one the Director approved — ambiguity at an irreversible act. Retired rows are outside
     * the predicate, so a retired address can be recorded again later; this is the shape
     * `invitations_pending_email_uq` already established for pending invitations.
     */
    uniqueIndex("external_recipients_tenant_active_endpoint_uq")
      .on(t.tenantId, t.endpointValue)
      .where(sql`${t.status} = 'active'`),

    index("external_recipients_tenant_status_idx").on(t.tenantId, t.status),

    check(
      "external_recipients_display_name_chk",
      sql`char_length(btrim(${t.displayName})) > 0`,
    ),
    check("external_recipients_endpoint_value_chk", sql`char_length(btrim(${t.endpointValue})) > 0`),
    /* The stored digest shape, enforced by the database rather than hoped for by the writer. */
    check("external_recipients_endpoint_digest_chk", sql`${t.endpointDigest} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const externalRecipientsRelations = relations(externalRecipients, ({ one }) => ({
  tenant: one(companies, {
    fields: [externalRecipients.tenantId],
    references: [companies.id],
  }),
}));
