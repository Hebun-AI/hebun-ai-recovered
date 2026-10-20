/*
 * PLAN-FOLLOW-UP-REFERENCE-V1 — which work items a governed follow-up was proposed for, and which
 * work items the resulting work follows up.
 *
 * Two relationships, two owners, one direction of flow:
 *
 *   heby_action_request_source_work_items   OWNED BY Action Authorization's request writer.
 *       Written in the SAME transaction that records the request, from a server-verified plan
 *       binding, and never again. It is provenance beside the frozen proposal — it is NOT part of
 *       the canonical payload, does not enter `payload_digest`, and authorizes nothing.
 *
 *   work_item_follow_up_sources             OWNED BY the Work authority.
 *       Written in the SAME transaction that records the follow-up work item, copied from the
 *       request's rows after the executor revalidates every source. It is what a work surface
 *       reads; the request rows are what an approval surface reads.
 *
 * Both are INSERT-ONLY: a database trigger (in the migration) refuses UPDATE, DELETE and TRUNCATE,
 * so a recorded relationship cannot be substituted after the fact. Every reference is composite on
 * `tenant_id`, so a row naming another organization's request or work is a database error.
 * RESTRICT on every parent: a work item or request named by provenance cannot be deleted from under
 * it. Historical requests and work items have no rows and remain valid unchanged.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, smallint, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { hebyActionRequests } from "./action-authorization";
import { workItems } from "./work-item";

/** A plan step names at most this many work items; the binding refuses more before any write. */
export const MAX_FOLLOW_UP_SOURCE_WORK_ITEMS = 40;

export const hebyActionRequestSourceWorkItems = pgTable(
  "heby_action_request_source_work_items",
  {
    ...tenantColumns,
    actionRequestId: uuid("action_request_id").notNull(),
    workItemId: uuid("work_item_id").notNull(),
    /** The order the plan step listed the item in, so a surface shows what the plan showed. */
    ordinal: smallint("ordinal").notNull(),
  },
  (t) => [
    uniqueIndex("heby_action_request_source_work_items_request_work_uq").on(t.actionRequestId, t.workItemId),
    uniqueIndex("heby_action_request_source_work_items_request_ordinal_uq").on(t.actionRequestId, t.ordinal),
    index("heby_action_request_source_work_items_tenant_work_idx").on(t.tenantId, t.workItemId),
    foreignKey({
      name: "heby_action_request_source_work_items_tenant_request_fk",
      columns: [t.tenantId, t.actionRequestId],
      foreignColumns: [hebyActionRequests.tenantId, hebyActionRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "heby_action_request_source_work_items_tenant_work_fk",
      columns: [t.tenantId, t.workItemId],
      foreignColumns: [workItems.tenantId, workItems.id],
    }).onDelete("restrict"),
    check(
      "heby_action_request_source_work_items_ordinal_chk",
      sql`${t.ordinal} >= 0 and ${t.ordinal} < ${sql.raw(String(MAX_FOLLOW_UP_SOURCE_WORK_ITEMS))}`,
    ),
  ],
);

export const workItemFollowUpSources = pgTable(
  "work_item_follow_up_sources",
  {
    ...tenantColumns,
    /** The work item the governed follow-up created. */
    workItemId: uuid("work_item_id").notNull(),
    /** A work item it follows up. */
    sourceWorkItemId: uuid("source_work_item_id").notNull(),
    /** The request whose provenance this was copied from — the audit trail back to the decision. */
    actionRequestId: uuid("action_request_id").notNull(),
    ordinal: smallint("ordinal").notNull(),
  },
  (t) => [
    uniqueIndex("work_item_follow_up_sources_work_source_uq").on(t.workItemId, t.sourceWorkItemId),
    uniqueIndex("work_item_follow_up_sources_work_ordinal_uq").on(t.workItemId, t.ordinal),
    index("work_item_follow_up_sources_tenant_source_idx").on(t.tenantId, t.sourceWorkItemId),
    foreignKey({
      name: "work_item_follow_up_sources_tenant_work_fk",
      columns: [t.tenantId, t.workItemId],
      foreignColumns: [workItems.tenantId, workItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "work_item_follow_up_sources_tenant_source_fk",
      columns: [t.tenantId, t.sourceWorkItemId],
      foreignColumns: [workItems.tenantId, workItems.id],
    }).onDelete("restrict"),
    /* The source pair must be one the request recorded — not merely any request and any work item. */
    foreignKey({
      name: "work_item_follow_up_sources_request_source_fk",
      columns: [t.actionRequestId, t.sourceWorkItemId],
      foreignColumns: [hebyActionRequestSourceWorkItems.actionRequestId, hebyActionRequestSourceWorkItems.workItemId],
    }).onDelete("restrict"),
    foreignKey({
      name: "work_item_follow_up_sources_tenant_request_fk",
      columns: [t.tenantId, t.actionRequestId],
      foreignColumns: [hebyActionRequests.tenantId, hebyActionRequests.id],
    }).onDelete("restrict"),
    check("work_item_follow_up_sources_not_self_chk", sql`${t.workItemId} <> ${t.sourceWorkItemId}`),
    check(
      "work_item_follow_up_sources_ordinal_chk",
      sql`${t.ordinal} >= 0 and ${t.ordinal} < ${sql.raw(String(MAX_FOLLOW_UP_SOURCE_WORK_ITEMS))}`,
    ),
  ],
);
