/*
 * support_tickets — V1-STAGE-5 Customer Ops. A support request a member of an organization filed by
 * hand, inside Hebun. Tenant-scoped: every reader and writer carries `tenant_id = <session tenant>`.
 *
 * Not an inbox: no email, DM or webhook writes a row, and nothing here sends anything. Status is a
 * human declaration, changed only by the organization's Governance authority, and every change is
 * an `audit_log` row in the same transaction. Title and description are what the filer typed;
 * they are never copied into the audit trail.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { companies } from "./company";
import { users } from "./user";

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("open"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("support_tickets_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("support_tickets_title_chk", sql`char_length(${t.title}) between 1 and 200`),
    check("support_tickets_description_chk", sql`char_length(${t.description}) between 1 and 5000`),
    check("support_tickets_status_chk", sql`${t.status} in ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')`),
    check("support_tickets_version_chk", sql`${t.version} >= 1`),
  ],
);
