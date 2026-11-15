/*
 * P6-4 (D6, D9) — the scheduled research run ledger: one row per (tenant, standing research
 * authorization revision, Istanbul local date), claimed BEFORE the model is asked.
 *
 * The unique key is the idempotency: a second, retried or concurrent tick for the same day cannot
 * claim, so it asks nothing and files nothing. A claimed run ends exactly once, `filed` (naming the
 * report it filed) or `failed` (naming why); nothing deletes a row, and a failed run is not retried
 * the same day. Rows are written by the scheduled research runner alone, attributed to `system`.
 */
import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./company";
import { standingResearchAuthorizations } from "./standing-research-authorization";
import { workArtifacts } from "./work-artifact";

export const SCHEDULED_RESEARCH_RUN_STATUSES = ["claimed", "filed", "failed"] as const;

export const scheduledResearchRuns = pgTable(
  "scheduled_research_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    standingAuthorizationId: uuid("standing_authorization_id").notNull(),
    /** The Europe/Istanbul calendar date the run belongs to (D7). */
    localDate: date("local_date").notNull(),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    artifactId: uuid("artifact_id"),
    /** The model invocation's correlation id, when a model was asked: joins the disclosure decision. */
    correlationId: text("correlation_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("scheduled_research_runs_day_uq").on(t.tenantId, t.standingAuthorizationId, t.localDate),
    index("scheduled_research_runs_tenant_date_idx").on(t.tenantId, t.localDate),
    foreignKey({
      name: "scheduled_research_runs_tenant_authorization_fk",
      columns: [t.tenantId, t.standingAuthorizationId],
      foreignColumns: [standingResearchAuthorizations.tenantId, standingResearchAuthorizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "scheduled_research_runs_tenant_artifact_fk",
      columns: [t.tenantId, t.artifactId],
      foreignColumns: [workArtifacts.tenantId, workArtifacts.id],
    }).onDelete("restrict"),
    check("scheduled_research_runs_status_chk", sql`${t.status} in ('claimed', 'filed', 'failed')`),
    check(
      "scheduled_research_runs_outcome_chk",
      sql`(${t.status} = 'claimed' and ${t.finishedAt} is null and ${t.artifactId} is null and ${t.failureReason} is null)
        or (${t.status} = 'filed' and ${t.finishedAt} is not null and ${t.artifactId} is not null and ${t.failureReason} is null)
        or (${t.status} = 'failed' and ${t.finishedAt} is not null and ${t.artifactId} is null and char_length(${t.failureReason}) between 1 and 120)`,
    ),
  ],
);
