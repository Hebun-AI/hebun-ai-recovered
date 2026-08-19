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

import { and, asc, eq, inArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { conversations, messages } from "@/db/schema/conversation";
import {
  hebyAnswerEvidenceItems,
  hebyAnswerEvidenceSets,
} from "@/db/schema/heby-answer-evidence";
import { hebyAnswerSourceEvidence } from "@/db/schema/heby-answer-source-evidence";

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

/* ── KR5: historical answer evidence ────────────────────────────────────────
 *
 * Storage-shaped input, deliberately NOT the runtime's `RetrievalEvidenceSet`. The repository owns
 * rows; the answer layer owns projections. Keeping the retrieval contract out of this file is what
 * stops the storage schema from quietly becoming the retrieval contract's second definition.
 */

/** One historical evidence row: identity referenced, standing snapshot. */
export interface AppendEvidenceItemInput {
  readonly factId: string;
  readonly knowledgeNodeId: string | null;
  readonly domainKey: string;
  readonly factKey: string;
  readonly scope: string;

  readonly title: string;
  readonly excerpt: string | null;
  readonly excerptTruncated: boolean;
  readonly authorityClass: string | null;
  readonly lifecycleStatus: string | null;
  readonly ratified: boolean;
  readonly ratifiedAt: Date | null;
  readonly freshness: string;
  readonly knowledgeVersion: number;
  readonly factVersion: number;
  readonly effectiveFrom: Date | null;
  readonly effectiveUntil: Date | null;
  readonly nextReviewAt: Date | null;
  readonly origin: string | null;
  readonly authoredThrough: string | null;
  readonly textOriginUnverified: boolean | null;
  readonly sourceTitle: string | null;
  readonly sourceType: string | null;
  readonly ingestedByActorType: string | null;
  readonly ingestedAt: Date | null;
  readonly chunkIndex: number | null;
  readonly chunkCount: number | null;
  readonly matchedTerms: readonly string[];

  readonly ordinal: number;
}

/**
 * The retrieval that produced one answer. Written whenever retrieval RAN — a zero-item set is a
 * real statement ("ran, matched nothing"), not an absence.
 */
export interface AppendEvidenceSetInput {
  readonly status: string;
  readonly truncated: boolean;
  readonly diversityPruned: number;
  readonly excludedCount: number;
  readonly degradedReason: string | null;
  readonly multipleRelevantSources: boolean;
  readonly unavailableReason: string | null;
  readonly items: readonly AppendEvidenceItemInput[];
}

/** One complete Heby turn, persisted atomically. */
/*
 * G6D — one citation an answer made, in storage shape.
 *
 * IDENTITY REFERENCED, STANDING SNAPSHOT, the same rule KR5 states for Knowledge. `recordRef` names
 * the owning authority's record; `label`, `detail` and `authoritative` are copied because the record
 * they describe is mutable and re-reading it later would substitute today's state for the answer's.
 *
 * `authoritative` is derived from the owning RESOLUTION, never from a request: no client-reachable
 * input shape carries it, which is the property the G6D firewall test asserts by mechanism.
 */
export interface AppendSourceEvidenceInput {
  readonly sourceClass: string;
  readonly recordRef: string;
  readonly label: string;
  readonly detail: string;
  readonly authoritative: boolean;
  readonly ordinal: number;
}

/** One stored citation, read back for a reload. Identical shape — this record is never reshaped. */
export interface StoredSourceEvidence extends AppendSourceEvidenceInput {
  readonly messageId: string;
}

export interface PersistExchangeInput {
  /** Honoured only if the tenant owns it; otherwise a fresh conversation is created. */
  readonly providedConversationId?: string;
  /** Used only when a conversation is actually created. */
  readonly subject: string;
  readonly userContent: string;
  readonly assistant: Omit<AppendMessageInput, "conversationId">;
  /** Present only when a Knowledge retrieval actually ran for this turn. */
  readonly evidence?: AppendEvidenceSetInput;
  /**
   * G6D — the non-Knowledge sources this answer cited. Knowledge is deliberately absent: it has its
   * own evidence authority above, and a CHECK constraint refuses it here so the two can never
   * become two records of one citation.
   */
  readonly sourceEvidence?: readonly AppendSourceEvidenceInput[];
}

export interface PersistedExchange {
  readonly conversationId: string;
  readonly assistantMessageId: string;
}

/** The stored form of one historical evidence set, as read back for a reload. */
export interface StoredEvidenceSet extends Omit<AppendEvidenceSetInput, "items"> {
  readonly messageId: string;
  readonly items: readonly AppendEvidenceItemInput[];
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
  /**
   * KR5 — persist one whole Heby turn in ONE transaction: conversation (resolved or created),
   * user message, assistant message, and the historical evidence set with its items.
   *
   * ALL COMMIT OR NONE COMMIT. This replaces a sequence of independent awaits that could leave a
   * user message with no answer, and it is the reason evidence cannot exist without its assistant
   * message or an assistant message silently lose its evidence.
   */
  persistExchange(
    scope: ConversationScope,
    input: PersistExchangeInput,
  ): Promise<PersistedExchange>;
  /** The historical evidence recorded with the given messages, keyed by assistant message id. */
  listAnswerEvidence(
    scope: ConversationScope,
    messageIds: readonly string[],
  ): Promise<readonly StoredEvidenceSet[]>;
  /**
   * G6D — the non-Knowledge citations recorded with the given messages. A SIBLING read on the SAME
   * authority, not a second one: it shares this repository, its tenant requirement and its
   * conversation-ownership gate, and there is deliberately no standalone evidence endpoint.
   */
  listAnswerSourceEvidence(
    scope: ConversationScope,
    messageIds: readonly string[],
  ): Promise<readonly StoredSourceEvidence[]>;
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
  /**
   * Ownership lookup against a given executor — the pooled handle, or a transaction.
   *
   * Parameterized rather than duplicated so the in-transaction check is provably the SAME check
   * the non-transactional callers make. Two copies of a tenant predicate is how one of them
   * eventually stops matching the other.
   */
  async function ownedConversationWith(
    executor: Pick<ControlPlaneDatabase, "select">,
    tenantId: string,
    conversationId: string,
  ): Promise<DurableConversationRecord | undefined> {
    // A malformed id can never belong to the tenant — fail safe, do not query.
    if (!UUID_RE.test(conversationId)) return undefined;
    const rows = await executor
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? toConversation(rows[0]) : undefined;
  }

  async function ownedConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<DurableConversationRecord | undefined> {
    return ownedConversationWith(db, tenantId, conversationId);
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

    async persistExchange(scope, input) {
      const tenantId = requireTenant(scope);
      /*
       * ONE transaction, and conversation creation is INSIDE it on purpose.
       *
       * Leaving the create outside would trade one partial state for another: a rolled-back turn
       * would strand an empty conversation row that the reader would see as a thread that never
       * said anything. A conversation exists because a turn was recorded in it.
       *
       * The ownership check for a client-carried id is a read and rides along, so the id cannot be
       * revalidated against a different snapshot than the one the insert lands in.
       */
      return db.transaction(async (tx) => {
        const owned = input.providedConversationId
          ? await ownedConversationWith(tx, tenantId, input.providedConversationId)
          : undefined;

        const conversationId =
          owned?.id ??
          (
            await tx
              .insert(conversations)
              .values({ tenantId, subject: input.subject, createdBy: scope.actorId ?? null })
              .returning()
          )[0]!.id;

        await tx.insert(messages).values({
          tenantId,
          conversationId,
          role: "user",
          content: input.userContent,
          origin: "user",
          createdBy: scope.actorId ?? null,
        });

        const assistant = input.assistant;
        const assistantRows = await tx
          .insert(messages)
          .values({
            tenantId,
            conversationId,
            role: assistant.role,
            content: assistant.content,
            origin: assistant.origin,
            provider: assistant.provider ?? null,
            model: assistant.model ?? null,
            transport: assistant.transport ?? null,
            correlationId: assistant.correlationId ?? null,
            providerRequestId: assistant.providerRequestId ?? null,
            inputTokens: assistant.inputTokens ?? null,
            outputTokens: assistant.outputTokens ?? null,
            tokenCount: assistant.tokenCount ?? null,
            createdBy: scope.actorId ?? null,
          })
          .returning();
        const assistantMessageId = assistantRows[0]!.id;

        if (input.evidence) {
          const set = input.evidence;
          const setRows = await tx
            .insert(hebyAnswerEvidenceSets)
            .values({
              tenantId,
              messageId: assistantMessageId,
              status: set.status,
              truncated: set.truncated,
              diversityPruned: set.diversityPruned,
              excludedCount: set.excludedCount,
              degradedReason: set.degradedReason,
              multipleRelevantSources: set.multipleRelevantSources,
              unavailableReason: set.unavailableReason,
            })
            .returning();
          const evidenceSetId = setRows[0]!.id;

          /*
           * A zero-item set is written and left empty — that is the "retrieval ran and matched
           * nothing" state, which must stay distinguishable from "no retrieval ran" after reload.
           */
          if (set.items.length > 0) {
            await tx.insert(hebyAnswerEvidenceItems).values(
              set.items.map((item) => ({
                tenantId,
                evidenceSetId,
                factId: item.factId,
                knowledgeNodeId: item.knowledgeNodeId,
                domainKey: item.domainKey,
                factKey: item.factKey,
                scope: item.scope,
                title: item.title,
                excerpt: item.excerpt,
                excerptTruncated: item.excerptTruncated,
                authorityClass: item.authorityClass,
                lifecycleStatus: item.lifecycleStatus,
                ratified: item.ratified,
                ratifiedAt: item.ratifiedAt,
                freshness: item.freshness,
                knowledgeVersion: item.knowledgeVersion,
                factVersion: item.factVersion,
                effectiveFrom: item.effectiveFrom,
                effectiveUntil: item.effectiveUntil,
                nextReviewAt: item.nextReviewAt,
                origin: item.origin,
                authoredThrough: item.authoredThrough,
                textOriginUnverified: item.textOriginUnverified,
                sourceTitle: item.sourceTitle,
                sourceType: item.sourceType,
                ingestedByActorType: item.ingestedByActorType,
                ingestedAt: item.ingestedAt,
                chunkIndex: item.chunkIndex,
                chunkCount: item.chunkCount,
                matchedTerms: [...item.matchedTerms],
                ordinal: item.ordinal,
              })),
            );
          }
        }

        /*
         * G6D — the answer's non-Knowledge citations, in the SAME transaction as the assistant
         * message they belong to. All commit or none commit: a citation cannot exist without its
         * answer, and an answer cannot silently lose the record it was grounded on.
         *
         * `tenantId` is the server-resolved scope tenant, never a caller-supplied value, and
         * `messageId` is the id this transaction just generated — so a row here can only ever
         * belong to the message this turn produced, for the tenant that produced it.
         */
        if (input.sourceEvidence && input.sourceEvidence.length > 0) {
          await tx.insert(hebyAnswerSourceEvidence).values(
            input.sourceEvidence.map((item) => ({
              tenantId,
              messageId: assistantMessageId,
              sourceClass: item.sourceClass,
              recordRef: item.recordRef,
              label: item.label,
              detail: item.detail,
              authoritative: item.authoritative,
              ordinal: item.ordinal,
            })),
          );
        }

        return { conversationId, assistantMessageId };
      });
    },

    async listAnswerSourceEvidence(scope, messageIds) {
      const tenantId = requireTenant(scope);
      const ids = messageIds.filter((id) => UUID_RE.test(id));
      if (ids.length === 0) return [];

      /*
       * Tenant-scoped explicitly, exactly as `listAnswerEvidence` is and for the same reason: the
       * composite FK already makes a cross-tenant row unconstructible, but a read relying on that
       * alone would be one schema change away from leaking. The predicate costs nothing and states
       * the requirement where the query lives.
       */
      const rows = await db
        .select()
        .from(hebyAnswerSourceEvidence)
        .where(
          and(
            eq(hebyAnswerSourceEvidence.tenantId, tenantId),
            inArray(hebyAnswerSourceEvidence.messageId, ids),
          ),
        )
        .orderBy(asc(hebyAnswerSourceEvidence.ordinal));

      return rows.map((row) => ({
        messageId: row.messageId,
        sourceClass: row.sourceClass,
        recordRef: row.recordRef,
        label: row.label,
        detail: row.detail,
        authoritative: row.authoritative,
        ordinal: row.ordinal,
      }));
    },

    async listAnswerEvidence(scope, messageIds) {
      const tenantId = requireTenant(scope);
      const ids = messageIds.filter((id) => UUID_RE.test(id));
      if (ids.length === 0) return [];

      /*
       * Tenant-scoped on BOTH tables, not just the set. The composite FK already makes a
       * cross-tenant row unconstructible, but a read that relied on that alone would be one schema
       * change away from leaking; the predicate costs nothing and states the requirement locally.
       */
      const setRows = await db
        .select()
        .from(hebyAnswerEvidenceSets)
        .where(
          and(
            eq(hebyAnswerEvidenceSets.tenantId, tenantId),
            inArray(hebyAnswerEvidenceSets.messageId, ids),
          ),
        );
      if (setRows.length === 0) return [];

      const itemRows = await db
        .select()
        .from(hebyAnswerEvidenceItems)
        .where(
          and(
            eq(hebyAnswerEvidenceItems.tenantId, tenantId),
            inArray(
              hebyAnswerEvidenceItems.evidenceSetId,
              setRows.map((row) => row.id),
            ),
          ),
        )
        .orderBy(asc(hebyAnswerEvidenceItems.ordinal));

      return setRows.map((set) => ({
        messageId: set.messageId,
        status: set.status,
        truncated: set.truncated,
        diversityPruned: set.diversityPruned,
        excludedCount: set.excludedCount,
        degradedReason: set.degradedReason,
        multipleRelevantSources: set.multipleRelevantSources,
        unavailableReason: set.unavailableReason,
        items: itemRows
          .filter((item) => item.evidenceSetId === set.id)
          .map((item) => ({
            factId: item.factId,
            knowledgeNodeId: item.knowledgeNodeId,
            domainKey: item.domainKey,
            factKey: item.factKey,
            scope: item.scope,
            title: item.title,
            excerpt: item.excerpt,
            excerptTruncated: item.excerptTruncated,
            authorityClass: item.authorityClass,
            lifecycleStatus: item.lifecycleStatus,
            ratified: item.ratified,
            ratifiedAt: item.ratifiedAt,
            freshness: item.freshness,
            knowledgeVersion: item.knowledgeVersion,
            factVersion: item.factVersion,
            effectiveFrom: item.effectiveFrom,
            effectiveUntil: item.effectiveUntil,
            nextReviewAt: item.nextReviewAt,
            origin: item.origin,
            authoredThrough: item.authoredThrough,
            textOriginUnverified: item.textOriginUnverified,
            sourceTitle: item.sourceTitle,
            sourceType: item.sourceType,
            ingestedByActorType: item.ingestedByActorType,
            ingestedAt: item.ingestedAt,
            chunkIndex: item.chunkIndex,
            chunkCount: item.chunkCount,
            matchedTerms: item.matchedTerms,
            ordinal: item.ordinal,
          })),
      }));
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
