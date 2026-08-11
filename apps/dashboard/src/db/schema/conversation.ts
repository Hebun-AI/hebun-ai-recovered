/* Conversations and messages — AI conversation history. */
import { pgTable, integer, text, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenantColumns } from "./_base";
import { agents } from "./agent";

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
   */
  origin: text("origin"),
  provider: text("provider"),
  model: text("model"),
  transport: text("transport"),
  correlationId: text("correlation_id"),
  providerRequestId: text("provider_request_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));
