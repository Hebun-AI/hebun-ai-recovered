/**
 * content_publication_intents — V1-STAGE-2: WHEN A READY CONTENT REVISION IS MEANT TO GO OUT.
 *
 * A schedule is an INTENT, never an authorization. It records that a human chose a moment for one
 * approved content revision to be published. It grants nothing: when the moment arrives, a human
 * proposes the publication through the existing governed path (request → Governance approval →
 * permit → executor), and every check that path makes still runs. Nothing here is read by an
 * executor, a permit, a cron or a machine path.
 *
 *   SCHEDULED != REQUESTED != APPROVED != PUBLISHED
 *
 * States (closed): `scheduled` (waiting for its moment, may be rescheduled or cancelled),
 * `cancelled` (terminal), `requested` (terminal: the governed request it produced is `request_id`).
 * Whether the request was approved, executed, accepted or failed is NOT stored here: it is read from
 * the publication ledger by `request_id`, so this table can never disagree with it.
 *
 * Time: `scheduled_for` is the UTC instant; `time_zone` is the IANA zone the human chose it in, kept
 * so the calendar can show the moment as they meant it. Both are required.
 *
 * At most ONE `scheduled` row per revision (partial unique index). A revision can be scheduled again
 * after its schedule is cancelled or requested. Tenant isolation is the composite FK to the revision
 * and the tenant-qualified FK to the request.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { hebyActionRequests } from "./action-authorization";
import { companies } from "./company";
import { workArtifactRevisions } from "./work-artifact";

export const contentPublicationIntents = pgTable(
  "content_publication_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    artifactId: uuid("artifact_id").notNull(),
    revisionNo: integer("revision_no").notNull(),
    destination: text("destination").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    timeZone: varchar("time_zone", { length: 64 }).notNull(),
    /** YouTube upload settings frozen at scheduling; null for Instagram. */
    youtubeOptions: jsonb("youtube_options"),
    state: text("state").notNull().default("scheduled"),
    requestId: uuid("request_id"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("content_publication_intents_one_open_uq")
      .on(t.tenantId, t.artifactId, t.revisionNo)
      .where(sql`${t.state} = 'scheduled'`),
    index("content_publication_intents_calendar_idx").on(t.tenantId, t.scheduledFor),
    foreignKey({
      name: "content_publication_intents_revision_fk",
      columns: [t.tenantId, t.artifactId, t.revisionNo],
      foreignColumns: [workArtifactRevisions.tenantId, workArtifactRevisions.artifactId, workArtifactRevisions.revisionNo],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_publication_intents_request_fk",
      columns: [t.tenantId, t.requestId],
      foreignColumns: [hebyActionRequests.tenantId, hebyActionRequests.id],
    }).onDelete("restrict"),
    check("content_publication_intents_revision_no_chk", sql`${t.revisionNo} >= 1`),
    check("content_publication_intents_destination_chk", sql`${t.destination} in ('instagram', 'youtube')`),
    check("content_publication_intents_state_chk", sql`${t.state} in ('scheduled', 'cancelled', 'requested')`),
    check("content_publication_intents_request_chk", sql`(${t.state} = 'requested') = (${t.requestId} is not null)`),
    check(
      "content_publication_intents_youtube_chk",
      sql`(${t.destination} = 'youtube') = (${t.youtubeOptions} is not null)`,
    ),
    check("content_publication_intents_time_zone_chk", sql`char_length(${t.timeZone}) between 1 and 64`),
    check("content_publication_intents_version_chk", sql`${t.version} >= 1`),
  ],
);
