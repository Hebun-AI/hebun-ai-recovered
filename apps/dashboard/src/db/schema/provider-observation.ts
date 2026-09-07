/*
 * provider_observations — WHAT AN EXTERNAL PROVIDER REPORTED, AND WHEN (TRH-21).
 *
 * ── WHAT ONE ROW MEANS, EXACTLY ──────────────────────────────────────────────
 *
 *   "Provider P reported these typed facts about subject S at instant T, read through connection C
 *    on behalf of this tenant."
 *
 * That is the whole sentence, and every word of it is load-bearing. It is a record of a PROVIDER
 * UTTERANCE, not of an organizational fact.
 *
 * ── WHAT IT DOES NOT MEAN ────────────────────────────────────────────────────
 *
 * `subscriberCount: 100` here means "YouTube reported 100 at T". It does NOT mean this organization
 * has 100 subscribers. The distinction is not a comment — it is the reason this table exists at all
 * rather than the row being filed under an authority whose meaning is "what this organization
 * holds". A number filed there becomes that claim regardless of what any comment says.
 *
 *     PROVIDER UTTERANCE  != ORGANIZATIONAL FACT
 *     STORED OBSERVATION  != KNOWLEDGE
 *     OBSERVATION         != METRIC
 *     METRIC              != TREND
 *     TWO SAMPLES         != A DIRECTION
 *     A LATER NUMBER      != A CORRECTION
 *
 * Not Knowledge (that authority is human-admitted, versioned and ratifiable). Not Governance
 * evidence (a decision cites records; a provider said this). Not Work. Not a trend, a delta, a
 * rate, a score, a projection, a recommendation or a summary — none of those is representable here,
 * on purpose, because a representation that cannot express a judgement cannot leak one.
 *
 * ── WHY A NEW TABLE, AND WHY NOT ANY EXISTING ONE ────────────────────────────
 *
 * TRH-21's discovery measured every candidate rather than arguing about them:
 *
 *   heby_answer_source_evidence  `message_id` is NOT NULL with a composite FK to `messages` that
 *                                CASCADES on delete. An observation taken by a ceremony has no
 *                                message, and history that disappears when somebody clears a chat
 *                                is not history. It also needs a `record_ref` naming a record this
 *                                system holds — an observation names nothing internal — and a
 *                                source class, which CGO-7 deliberately refused to mint for a
 *                                provider.
 *   knowledge_*                  human-admitted, ratifiable, retractable. Admitting provider counts
 *                                there gives outside numbers the organization's own standing, which
 *                                the provider-content bridge already forbids in its own words.
 *   work_evidence_references     means "a HUMAN declared this work concerns that referent", with
 *                                typed FKs and a human-only constraint. An observation declares
 *                                nothing and names nothing internal.
 *   audit_log                    answers "who did what under which authority". A provider reporting
 *                                a number is nobody doing anything.
 *   event_log, telemetry_events, enterprise_projection_snapshots, reasoning_traces, memories,
 *   working_memories, learning_sessions, executions
 *                                ALL MEASURED DEAD: zero rows and zero writers in production.
 *                                Reviving one because its name looks convenient is the mistake
 *                                TRH-19 refused by name, and several are already FORBIDDEN imports
 *                                in released firewalls.
 *
 * ── IMMUTABLE, AND DELIBERATELY NOT `tenantColumns` ──────────────────────────
 *
 * `tenantColumns` models a MUTABLE row: a version counter, updatedAt/updatedBy, soft delete. A
 * historical observation has none of those. It is never rewritten, never regenerated and never
 * repaired in place — a later different number is a NEW observation, never a correction of an old
 * one. The established precedent for this shape is `audit_log`, and `heby_answer_source_evidence`
 * follows it for the same reason.
 *
 * ── TENANT ISOLATION IS STRUCTURAL ───────────────────────────────────────────
 *
 * The composite foreign key (integration_id, tenant_id) → integrations(id, tenant_id) makes it
 * impossible to file one tenant's observation against another tenant's connection, even with a
 * hand-crafted INSERT. `integrations` already carries the (id, tenant_id) unique index this needs,
 * so nothing about the connection authority changes.
 *
 * ── THE IDEMPOTENCY KEY IS THE INSTANT, NEVER THE VALUES ─────────────────────
 *
 * The unique index is (tenant_id, provider_key, subject_ref, observed_at): ONE observation of one
 * subject at one instant. A replay of the SAME observation collides and writes nothing. A genuinely
 * later read is a different instant and therefore a NEW row — even when every measured value is
 * identical, because "the number did not change" is itself an observation and deduplicating it away
 * would delete the only evidence that anyone looked.
 *
 * Deduplicating on values would do exactly that. It is not done here and must never be.
 *
 * KNOWN BOUND, STATED RATHER THAN HIDDEN: two genuinely distinct reads of one subject inside the
 * same millisecond collapse to one row. No caller can produce that today — a read costs three
 * sequential provider calls — and the alternative (an opaque sequence number) would make the key
 * meaningless as a fact.
 *
 * ── WHAT MAY NEVER BE STORED HERE ────────────────────────────────────────────
 *
 * No API key, no credential, no token, no raw provider response, no arbitrary payload blob, no
 * request URL, no header, no model output, no prompt, and no inferred organizational claim.
 * `facts` holds ONLY the typed projection the released provider contract already defines, written
 * by a pure mapper with a closed key set that a test asserts.
 */
import { char, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { actorTypeEnum } from "./_enums";
import { companies } from "./company";
import { integrations } from "./integration";

export const providerObservations = pgTable(
  "provider_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),

    /* ── WHICH CONNECTION WAS SPENT ──────────────────────────────────────────
     * The connection the authorized read actually used, surfaced by the provider seam itself. It
     * is NOT a caller argument anywhere: the capability authority chose it, and this records which
     * one it chose. Without it, "read through connection C" would be a sentence nothing supports.
     */
    integrationId: uuid("integration_id").notNull(),

    /* ── WHAT WAS ASKED, AND OF WHOM ─────────────────────────────────────────
     * Provider and capability are the released constants of the provider that answered — never
     * free text a caller supplies. The capability is recorded separately from the provider because
     * a future capability on the SAME provider (an owner-analytics read, say) reports different
     * facts about the same subject, and a reader must be able to tell them apart without parsing.
     */
    providerKey: text("provider_key").notNull(),
    capabilityKey: text("capability_key").notNull(),

    /*
     * WHAT THE PROVIDER WAS ASKED ABOUT, as the PROVIDER identifies it — not as a human typed it.
     * A handle is a name that can be changed and reassigned; the provider's own immutable id is
     * what makes two observations comparable at all. Deriving this from the response rather than
     * from the request is also what stops a caller filing an observation against a subject the
     * provider never confirmed.
     */
    subjectKind: text("subject_kind").notNull(),
    subjectRef: text("subject_ref").notNull(),

    /*
     * WHEN. `observed_at` is Hebun's own read instant in UTC, taken by the released observation
     * seam at the moment it completed the read. It is NOT a provider-supplied time: no provider in
     * this system reports when it computed a count, and a timestamp is only comparable across
     * observations if one clock produced all of them.
     */
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    /** When Hebun wrote it down. Distinct from `observed_at`, and never a substitute for it. */
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),

    /*
     * WHO CAUSED THE READ. Today this is always a human, because a human session is the only
     * principal that can reach a provider at all (PRINCIPAL-FW-1). The columns exist so that a
     * future non-human principal cannot be introduced without this record saying so — an
     * unattributed observation would be the first place unattended collection could hide.
     */
    observedByActorType: actorTypeEnum("observed_by_actor_type").notNull(),
    observedByActorId: uuid("observed_by_actor_id").notNull(),

    /*
     * WHAT WAS REPORTED. The typed projection, never the provider's response.
     *
     * `0` is a reported value and stays `0`. A count the provider withheld is `null` and stays
     * `null`. JSON preserves both distinctly, which is the whole reason the mapper may not
     * coalesce: "absent is not zero" is a sentence this column has to be able to keep.
     */
    facts: jsonb("facts").notNull(),

    /*
     * The content identity of `facts`, as a hex SHA-256 over their canonical serialization.
     *
     * It is a DIAGNOSTIC and never a key: nothing branches on it and no uniqueness rests on it. It
     * exists so a reader can tell "the provider reported the same thing again" from "the row was
     * rewritten" — and the second is impossible here, which the digest lets anyone verify rather
     * than trust.
     */
    factsDigest: char("facts_digest", { length: 64 }).notNull(),
  },
  (t) => [
    /*
     * ONE OBSERVATION OF ONE SUBJECT AT ONE INSTANT. This is the idempotency contract, and it is
     * deliberately about WHEN rather than about WHAT — see the header. Its leading columns also
     * serve the only read this table has: one tenant's observations of one subject, newest first.
     */
    uniqueIndex("provider_observations_subject_instant_uidx").on(
      t.tenantId,
      t.providerKey,
      t.subjectRef,
      t.observedAt,
    ),
    index("provider_observations_tenant_observed_at_idx").on(t.tenantId, t.observedAt),
    /*
     * STRUCTURAL TENANT ISOLATION. One tenant's observation cannot name another tenant's
     * connection, and no application check is trusted to prevent it.
     */
    foreignKey({
      name: "provider_observations_tenant_integration_fk",
      columns: [t.integrationId, t.tenantId],
      foreignColumns: [integrations.id, integrations.tenantId],
    }),
  ],
);
