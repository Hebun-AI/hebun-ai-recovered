/*
 * heby-conversation/durable-conversation-repository.server.ts — the narrowest durable,
 * tenant-scoped repository over the EXISTING `conversations`/`messages` tables (R2D).
 *
 * It reuses the R1 control-plane Drizzle/Postgres infrastructure (same schema, same driver,
 * same authored migrations) — NOT a second persistence framework. Every read and write is
 * tenant-scoped: the tenant id comes only from an already-resolved server-side TenantContext,
 * never from the client. A conversation id alone is never trusted — ownership is always
 * re-checked against the tenant, so tenant B can never read, list, or append to tenant A's
 * conversation. Fail-closed: no in-memory fallback; a missing database throws upstream.
 *
 * Server-only. Not re-exported from any client-importable index.
 */

import { and, asc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { conversations, messages } from "@/db/schema/conversation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The minimal server-side authority projection the repository needs. */
export interface ConversationScope {
  readonly tenantId: string;
  /** The acting user id (durable actor attribution). Optional. */
  readonly actorId?: string;
}

export interface DurableConversationRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly subject: string | null;
  readonly createdAt: string;
}

export type DurableMessageRole = "user" | "assistant";
export type DurableMessageOrigin = "user" | "deterministic" | "model";

/** A message to append. Provenance fields are written only when actually known. */
export interface AppendMessageInput {
  readonly conversationId: string;
  readonly role: DurableMessageRole;
  readonly content: string;
  readonly origin: DurableMessageOrigin;
  readonly provider?: string;
  readonly model?: string;
  readonly transport?: "fake" | "live";
  readonly correlationId?: string;
  readonly providerRequestId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** Derived total (input + output) when both are known; never invented. */
  readonly tokenCount?: number;
}

export interface DurableMessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly content: string;
  readonly origin: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly transport: string | null;
  readonly correlationId: string | null;
  readonly providerRequestId: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly tokenCount: number | null;
  readonly createdAt: string;
}

export class ConversationNotFoundError extends Error {
  readonly code = "CONVERSATION_NOT_FOUND";
  constructor() {
    super("Conversation not found for this tenant.");
    this.name = "ConversationNotFoundError";
  }
}

export class ConversationScopeError extends Error {
  readonly code = "CONVERSATION_SCOPE_INVALID";
  constructor(detail: string) {
    super(detail);
    this.name = "ConversationScopeError";
  }
}

export interface DurableConversationRepository {
  createConversation(
    scope: ConversationScope,
    input?: { readonly subject?: string },
  ): Promise<DurableConversationRecord>;
  appendMessage(scope: ConversationScope, input: AppendMessageInput): Promise<DurableMessageRecord>;
  getConversation(
    scope: ConversationScope,
    conversationId: string,
  ): Promise<DurableConversationRecord | undefined>;
  listConversationMessages(
    scope: ConversationScope,
    conversationId: string,
  ): Promise<readonly DurableMessageRecord[]>;
}

function requireTenant(scope: ConversationScope): string {
  const tenantId = scope.tenantId?.trim();
  if (!tenantId) throw new ConversationScopeError("A tenant id is required for every durable operation.");
  return tenantId;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toConversation(row: typeof conversations.$inferSelect): DurableConversationRecord {
  return { id: row.id, tenantId: row.tenantId, subject: row.subject, createdAt: iso(row.createdAt) };
}

function toMessage(row: typeof messages.$inferSelect): DurableMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    tenantId: row.tenantId,
    role: row.role,
    content: row.content,
    origin: row.origin,
    provider: row.provider,
    model: row.model,
    transport: row.transport,
    correlationId: row.correlationId,
    providerRequestId: row.providerRequestId,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    tokenCount: row.tokenCount,
    createdAt: iso(row.createdAt),
  };
}

/**
 * Build a durable conversation repository over a control-plane database handle. Every method
 * is tenant-scoped; a malformed conversation id is treated as an honest not-found (never a
 * thrown SQL error), and appends/lists first verify tenant ownership of the conversation.
 */
export function createDurableConversationRepository(
  db: ControlPlaneDatabase,
): DurableConversationRepository {
  async function ownedConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<DurableConversationRecord | undefined> {
    // A malformed id can never belong to the tenant — fail safe, do not query.
    if (!UUID_RE.test(conversationId)) return undefined;
    const rows = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? toConversation(rows[0]) : undefined;
  }

  return {
    async createConversation(scope, input = {}) {
      const tenantId = requireTenant(scope);
      const rows = await db
        .insert(conversations)
        .values({ tenantId, subject: input.subject ?? null, createdBy: scope.actorId ?? null })
        .returning();
      return toConversation(rows[0]!);
    },

    async appendMessage(scope, input) {
      const tenantId = requireTenant(scope);
      // Ownership is authoritative: a conversation the tenant does not own cannot be appended.
      const owned = await ownedConversation(tenantId, input.conversationId);
      if (!owned) throw new ConversationNotFoundError();
      const rows = await db
        .insert(messages)
        .values({
          tenantId,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          origin: input.origin,
          provider: input.provider ?? null,
          model: input.model ?? null,
          transport: input.transport ?? null,
          correlationId: input.correlationId ?? null,
          providerRequestId: input.providerRequestId ?? null,
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
          tokenCount: input.tokenCount ?? null,
          createdBy: scope.actorId ?? null,
        })
        .returning();
      return toMessage(rows[0]!);
    },

    async getConversation(scope, conversationId) {
      const tenantId = requireTenant(scope);
      return ownedConversation(tenantId, conversationId);
    },

    async listConversationMessages(scope, conversationId) {
      const tenantId = requireTenant(scope);
      // No ownership → honest empty (never another tenant's messages).
      const owned = await ownedConversation(tenantId, conversationId);
      if (!owned) return [];
      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId)))
        .orderBy(asc(messages.createdAt));
      return rows.map(toMessage);
    },
  };
}

let singleton: DurableConversationRepository | undefined;

/**
 * Process-level durable conversation repository over the control-plane database. Fail-closed:
 * `getControlPlaneDb()` throws when DATABASE_URL is unset rather than degrading to memory.
 */
export function getDurableConversationRepository(): DurableConversationRepository {
  if (!singleton) singleton = createDurableConversationRepository(getControlPlaneDb());
  return singleton;
}

/** True only when durable conversation persistence is configured (control-plane DB present). */
export function isDurableConversationConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}

/**
 * The production repository resolver: the durable repository when configured, or an honest
 * `null` when it is not (never an in-memory impostor). Constructing the pool never connects,
 * so a genuinely-down database surfaces only on first query — reported as a persistence
 * failure, never as durable success.
 */
export function resolveConversationRepoOrNull(): DurableConversationRepository | null {
  if (!isDurableConversationConfigured()) return null;
  try {
    return getDurableConversationRepository();
  } catch {
    return null;
  }
}
