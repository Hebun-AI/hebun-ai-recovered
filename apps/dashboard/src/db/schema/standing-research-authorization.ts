/*
 * standing-research-authorization.ts — P6-2: Governance's standing permission for ONE TENANT to have
 * research prepared on ONE brief it wrote, by ONE agent, onto ONE work item, until a later revision
 * withdraws it.
 *
 * The same append-only revision lineage as `standing_observation_authorizations` (TRH-23): every
 * change — authorizing, re-authorizing with a new brief, withdrawing — is an INSERT of the next
 * revision under its own Governance decision. Nothing here is updated or deleted, and no module in
 * `src/` holds an update or delete against this table.
 *
 * ONE LINEAGE PER TENANT. Multiple briefs per tenant are out of P6's scope, so the lineage key is
 * the tenant alone: `(tenant_id, authorization_revision)` is UNIQUE, and two simultaneous writers
 * both computing N+1 produce one commit and one unique violation.
 *
 * Writing a revision prepares nothing, calls no model and schedules nothing. Research runs only
 * through the released research seam, which reads this lineage before the model and again inside
 * the filing transaction.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, standingResearchStateEnum } from "./_enums";
import { agents } from "./agent";
import { decisionRecords, governanceSessions } from "./governance";
import { workItems } from "./work-item";

export const standingResearchAuthorizations = pgTable(
  "standing_research_authorizations",
  {
    ...tenantColumns,

    /** The ordinal of this revision within the tenant's lineage. Starts at 1 and advances by one. */
    authorizationRevision: integer("authorization_revision").notNull(),

    /** What THIS revision says. */
    state: standingResearchStateEnum("state").notNull(),

    /** The work item reports are filed onto. Tenant-bound by the composite foreign key below. */
    workItemId: uuid("work_item_id").notNull(),
    /** The agent that prepares them. Tenant-bound by the composite foreign key below. */
    agentId: uuid("agent_id").notNull(),
    /** The report title, as the organization wrote it. */
    title: text("title").notNull(),
    /** The brief: the ONLY text that reaches the model. The organization's own words (D2). */
    brief: text("brief").notNull(),

    /** The decision that authorized THIS revision. RESTRICT: history is not deletable. */
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /** The accountable human. CHECK-constrained to `human`: an agent never authorizes research. */
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),

    supersedesAuthorizationId: uuid("supersedes_authorization_id").references(
      (): AnyPgColumn => standingResearchAuthorizations.id,
    ),
  },
  (t) => [
    uniqueIndex("standing_research_authorizations_lineage_revision_uq").on(t.tenantId, t.authorizationRevision),
    uniqueIndex("standing_research_authorizations_decision_uq").on(t.governanceDecisionId),
    uniqueIndex("standing_research_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),
    index("standing_research_authorizations_tenant_state_idx").on(t.tenantId, t.state),

    foreignKey({
      name: "standing_research_authorizations_tenant_work_item_fk",
      columns: [t.tenantId, t.workItemId],
      foreignColumns: [workItems.tenantId, workItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "standing_research_authorizations_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),

    check("standing_research_authorizations_human_authorizer_chk", sql`${t.authorizedByActorType} = 'human'`),
    check("standing_research_authorizations_revision_chk", sql`${t.authorizationRevision} >= 1`),
    check(
      "standing_research_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),
    check(
      "standing_research_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),
    check(
      "standing_research_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),
    check(
      "standing_research_authorizations_brief_chk",
      sql`char_length(btrim(${t.title})) between 1 and 200 and char_length(btrim(${t.brief})) between 1 and 4000`,
    ),
  ],
);
