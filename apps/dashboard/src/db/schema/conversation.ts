/* Conversations and messages — AI conversation history. */
import { check, foreignKey, pgTable, integer, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenantColumns } from "./_base";
import { agents } from "./agent";
import { integrations } from "./integration";

export const conversations = pgTable("conversations", {
  ...tenantColumns,
  agentId: uuid("agent_id").references(() => agents.id),
  subject: text("subject"),
});

export const messages = pgTable("messages", {
  ...tenantColumns,
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),

  /*
   * R2D model provenance (all nullable, additive — no backfill, no destructive change).
   * These are written ONLY from a real generation result: a value present here means the
   * transport actually returned it. `origin` = how the message content was produced
   * ("user" | "deterministic" | "model"); `transport` = "fake" | "live". A model-origin
   * assistant message may carry provider/model/transport/correlationId, and provider request
   * id + token counts ONLY when the transport actually supplied them.
   *
   * AGENT-PROPOSAL-4A widened WHICH rows may carry them, and weakened nothing. `origin` records
   * what was SERVED; these columns record the INVOCATION, and the two are orthogonal. A
   * `deterministic` row carrying a transport is a turn where a model was asked and its answer was
   * WITHHELD by the response validator — the call happened and the tokens were spent, so recording
   * it is the truthful act and omitting it was the false one. The R2D invariant is unchanged and
   * still exact: a value present here means the transport actually returned it, because these are
   * written only from a real `ModelGenerationResult`.
   *
   * READ THE PAIR, NOT ONE COLUMN. `origin='model'` = a model answer was served.
   * `origin='deterministic' AND transport IS NOT NULL` = a model was asked, its answer withheld.
   * `origin='deterministic' AND transport IS NULL` = no model invocation is proven for this turn.
   * The last case is not proof that none occurred: a call that fails before returning leaves no
   * result, so nothing is recorded.
   */
  origin: text("origin"),
  provider: text("provider"),
  model: text("model"),
  transport: text("transport"),
  correlationId: text("correlation_id"),
  providerRequestId: text("provider_request_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  /*
   * P5 BYOK B7 — WHOSE CREDENTIAL CARRIED THE CALL. Written only beside a live transport, from the
   * transport that actually sent: `platform` = Hebun's deployment key, `tenant` = this tenant's own
   * Anthropic connection, named by id (never the key). Null on every row with no live invocation.
   */
  credentialSource: text("credential_source"),
  credentialIntegrationId: uuid("credential_integration_id"),
}, (t) => [
  /*
   * KR5. `id` is already the primary key, so this index adds no uniqueness the table did not
   * have — it exists so a COMPOSITE foreign key can name (id, tenant_id) as its target, which
   * PostgreSQL only permits against a declared unique constraint on exactly those columns.
   *
   * `heby_answer_evidence_set` uses it to make cross-tenant attachment structurally impossible
   * rather than merely checked in application code. Additive, no data change, no backfill.
   */
  uniqueIndex("messages_id_tenant_uidx").on(t.id, t.tenantId),
  check(
    "messages_credential_source_chk",
    sql`(${t.credentialSource} is null and ${t.credentialIntegrationId} is null)
      or (${t.credentialSource} = 'platform' and ${t.credentialIntegrationId} is null and ${t.transport} = 'live')
      or (${t.credentialSource} = 'tenant' and ${t.credentialIntegrationId} is not null and ${t.transport} = 'live')`,
  ),
  /** A message can only name a connection of its own tenant. */
  foreignKey({
    name: "messages_credential_integration_fk",
    columns: [t.credentialIntegrationId, t.tenantId],
    foreignColumns: [integrations.id, integrations.tenantId],
  }).onDelete("restrict"),
]);

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));
