/*
 * P5-5 — standing agent task authorizations and their weekly runs (Director decisions 2026-11-24: new
 * tables beside P6's, own key only, brief + role, Monday 08:00 Istanbul, one kill switch).
 *
 * `standing_agent_task_authorizations` mirrors `standing_research_authorizations`: an append-only lineage of
 * Governance revisions, here ONE lineage per (tenant, template). `scheduled_agent_task_runs` is the ledger:
 * one row per (tenant, template, ISO week), claimed before anything is asked, so a week runs at most once
 * whatever the number of ticks or revisions.
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
import { actorTypeEnum } from "./_enums";
import { agents } from "./agent";
import { companies } from "./company";
import { decisionRecords, governanceSessions } from "./governance";
import { workArtifacts } from "./work-artifact";
import { workItems } from "./work-item";

export const STANDING_AGENT_TASK_TEMPLATES = ["weekly-content-plan", "weekly-operations-summary"] as const;
const TEMPLATE_CHECK = sql.raw(`('${STANDING_AGENT_TASK_TEMPLATES.join("', '")}')`);

export const standingAgentTaskAuthorizations = pgTable(
  "standing_agent_task_authorizations",
  {
    ...tenantColumns,
    template: text("template").notNull(),
    authorizationRevision: integer("authorization_revision").notNull(),
    state: text("state").notNull(),
    workItemId: uuid("work_item_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),
    supersedesAuthorizationId: uuid("supersedes_authorization_id").references(
      (): AnyPgColumn => standingAgentTaskAuthorizations.id,
    ),
  },
  (t) => [
    uniqueIndex("standing_agent_task_authorizations_lineage_revision_uq").on(t.tenantId, t.template, t.authorizationRevision),
    uniqueIndex("standing_agent_task_authorizations_tenant_id_uq").on(t.tenantId, t.id),
    uniqueIndex("standing_agent_task_authorizations_decision_uq").on(t.governanceDecisionId),
    uniqueIndex("standing_agent_task_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),
    index("standing_agent_task_authorizations_tenant_template_idx").on(t.tenantId, t.template),
    foreignKey({
      name: "standing_agent_task_authorizations_tenant_work_item_fk",
      columns: [t.tenantId, t.workItemId],
      foreignColumns: [workItems.tenantId, workItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "standing_agent_task_authorizations_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),
    check("standing_agent_task_authorizations_template_chk", sql`${t.template} in ${TEMPLATE_CHECK}`),
    check("standing_agent_task_authorizations_state_chk", sql`${t.state} in ('active', 'withdrawn')`),
    check("standing_agent_task_authorizations_human_authorizer_chk", sql`${t.authorizedByActorType} = 'human'`),
    check("standing_agent_task_authorizations_revision_chk", sql`${t.authorizationRevision} >= 1`),
    check(
      "standing_agent_task_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),
    check(
      "standing_agent_task_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),
    check(
      "standing_agent_task_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),
    check(
      "standing_agent_task_authorizations_brief_chk",
      sql`char_length(btrim(${t.title})) between 1 and 200 and char_length(btrim(${t.brief})) between 1 and 4000`,
    ),
  ],
);

export const scheduledAgentTaskRuns = pgTable(
  "scheduled_agent_task_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    template: text("template").notNull(),
    standingAuthorizationId: uuid("standing_authorization_id").notNull(),
    /** ISO week in Europe/Istanbul, `YYYY-Www`. */
    periodKey: text("period_key").notNull(),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    artifactId: uuid("artifact_id"),
    correlationId: text("correlation_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("scheduled_agent_task_runs_week_uq").on(t.tenantId, t.template, t.periodKey),
    index("scheduled_agent_task_runs_tenant_period_idx").on(t.tenantId, t.periodKey),
    foreignKey({
      name: "scheduled_agent_task_runs_tenant_authorization_fk",
      columns: [t.tenantId, t.standingAuthorizationId],
      foreignColumns: [standingAgentTaskAuthorizations.tenantId, standingAgentTaskAuthorizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "scheduled_agent_task_runs_tenant_artifact_fk",
      columns: [t.tenantId, t.artifactId],
      foreignColumns: [workArtifacts.tenantId, workArtifacts.id],
    }).onDelete("restrict"),
    check("scheduled_agent_task_runs_template_chk", sql`${t.template} in ${TEMPLATE_CHECK}`),
    check("scheduled_agent_task_runs_period_chk", sql`${t.periodKey} ~ '^[0-9]{4}-W[0-9]{2}$'`),
    check("scheduled_agent_task_runs_status_chk", sql`${t.status} in ('claimed', 'filed', 'failed')`),
    check(
      "scheduled_agent_task_runs_outcome_chk",
      sql`(${t.status} = 'claimed' and ${t.finishedAt} is null and ${t.artifactId} is null and ${t.failureReason} is null)
        or (${t.status} = 'filed' and ${t.finishedAt} is not null and ${t.artifactId} is not null and ${t.failureReason} is null)
        or (${t.status} = 'failed' and ${t.finishedAt} is not null and ${t.artifactId} is null and char_length(${t.failureReason}) between 1 and 120)`,
    ),
  ],
);
