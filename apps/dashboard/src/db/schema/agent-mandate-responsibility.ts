/*
 * agent_mandate_responsibilities — the RESPONSIBILITY dimension of one Agent Mandate revision (AP-4A).
 *
 * Owned by the Agent Mandate Authority, written ONLY by its one transactional core, in the SAME
 * transaction and under the SAME Governance decision as the mandate revision it belongs to. It is not
 * a second authority and has no writer of its own: a row cannot exist without the revision that
 * granted it, and it is never updated or deleted.
 *
 * A row says: "at this revision, Governance made this agent responsible for this scope of work".
 *
 *   kind = 'domain'        one work domain (`work_domain_id`), in this tenant
 *   kind = 'organization'  organization-level work ONLY. It does NOT cover any work domain.
 *
 * A revision written through the released 5-value contract has NO rows: "responsibility undeclared".
 * There is no marker column because there is nothing to mark — rows exist exactly when the
 * responsibility-aware entry wrote them.
 *
 * Retiring a work domain leaves its rows here (history), and leaves them inert: eligibility reads the
 * domain's lifecycle every time.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./company";
import { agentMandates } from "./agent-mandate";
import { workDomains } from "./work-domain";

export const agentMandateResponsibilities = pgTable(
  "agent_mandate_responsibilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    mandateId: uuid("mandate_id").notNull(),
    responsibilityKind: text("responsibility_kind").notNull(),
    workDomainId: uuid("work_domain_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (t) => [
    index("agent_mandate_responsibilities_tenant_mandate_idx").on(t.tenantId, t.mandateId),
    foreignKey({
      name: "agent_mandate_responsibilities_tenant_mandate_fk",
      columns: [t.tenantId, t.mandateId],
      foreignColumns: [agentMandates.tenantId, agentMandates.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "agent_mandate_responsibilities_tenant_domain_fk",
      columns: [t.tenantId, t.workDomainId],
      foreignColumns: [workDomains.tenantId, workDomains.id],
    }).onDelete("restrict"),
    /* One row per domain per revision, and at most one organization-level row per revision. */
    uniqueIndex("agent_mandate_responsibilities_mandate_domain_uq")
      .on(t.mandateId, t.workDomainId)
      .where(sql`${t.workDomainId} is not null`),
    uniqueIndex("agent_mandate_responsibilities_mandate_organization_uq")
      .on(t.mandateId)
      .where(sql`${t.responsibilityKind} = 'organization'`),
    check(
      "agent_mandate_responsibilities_kind_chk",
      sql`(${t.responsibilityKind} = 'domain' and ${t.workDomainId} is not null)
          or (${t.responsibilityKind} = 'organization' and ${t.workDomainId} is null)`,
    ),
  ],
);
