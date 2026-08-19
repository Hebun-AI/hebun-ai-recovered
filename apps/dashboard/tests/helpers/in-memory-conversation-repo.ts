/*
 * In-memory DurableConversationRepository (tests only). Enforces the same tenant-ownership rule
 * as the real repository — a conversation is visible/appendable only to its owning tenant — so
 * tenant-isolation and continuity can be proven with no database.
 */
import type {
  AppendMessageInput,
  ConversationScope,
  DurableConversationRecord,
  DurableConversationRepository,
  DurableMessageRecord,
  PersistExchangeInput,
  StoredEvidenceSet,
  StoredSourceEvidence,
} from "../../src/features/heby-conversation/durable-conversation-repository.server";

export function createInMemoryConversationRepo(): DurableConversationRepository {
  const conversations = new Map<string, DurableConversationRecord>();
  const messages: DurableMessageRecord[] = [];
  const evidence = new Map<string, StoredEvidenceSet>();
  /* G6D — the non-Knowledge citations, kept per assistant message exactly as the real repo does. */
  const sourceEvidence = new Map<string, readonly StoredSourceEvidence[]>();
  let seq = 0;

  const owned = (tenantId: string, id: string): DurableConversationRecord | undefined => {
    const conversation = conversations.get(id);
    return conversation && conversation.tenantId === tenantId ? conversation : undefined;
  };

  return {
    async createConversation(scope: ConversationScope, input = {}) {
      const id = `conv-${++seq}`;
      const record: DurableConversationRecord = {
        id,
        tenantId: scope.tenantId,
        subject: input.subject ?? null,
        createdAt: new Date().toISOString(),
      };
      conversations.set(id, record);
      return record;
    },

    async appendMessage(scope: ConversationScope, input: AppendMessageInput) {
      if (!owned(scope.tenantId, input.conversationId)) {
        throw new Error("conversation not found for tenant");
      }
      const record: DurableMessageRecord = {
        id: `msg-${++seq}`,
        conversationId: input.conversationId,
        tenantId: scope.tenantId,
        role: input.role,
        content: input.content,
        origin: input.origin ?? null,
        provider: input.provider ?? null,
        model: input.model ?? null,
        transport: input.transport ?? null,
        correlationId: input.correlationId ?? null,
        providerRequestId: input.providerRequestId ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        tokenCount: input.tokenCount ?? null,
        createdAt: new Date().toISOString(),
      };
      messages.push(record);
      return record;
    },

    async getConversation(scope: ConversationScope, id: string) {
      return owned(scope.tenantId, id);
    },

    async listConversationMessages(scope: ConversationScope, id: string) {
      if (!owned(scope.tenantId, id)) return [];
      return messages.filter((message) => message.conversationId === id);
    },

    /*
     * KR5. The in-memory stand-in models the ATOMICITY CONTRACT, not a transaction: it builds the
     * whole turn locally and only then publishes it, so a throw leaves nothing behind — the same
     * observable guarantee the real repository gets from one `db.transaction`. Real rollback,
     * constraint enforcement and cascade behaviour are proven against PostgreSQL, not here.
     */
    async persistExchange(scope: ConversationScope, input: PersistExchangeInput) {
      const existing = input.providedConversationId
        ? owned(scope.tenantId, input.providedConversationId)
        : undefined;

      const staged: DurableMessageRecord[] = [];
      let conversationRecord: DurableConversationRecord | undefined;
      const conversationId =
        existing?.id ??
        (() => {
          const id = `conv-${++seq}`;
          conversationRecord = {
            id,
            tenantId: scope.tenantId,
            subject: input.subject,
            createdAt: new Date().toISOString(),
          };
          return id;
        })();

      const message = (
        role: string,
        content: string,
        extra: Partial<DurableMessageRecord> = {},
      ): DurableMessageRecord => ({
        id: `msg-${++seq}`,
        conversationId,
        tenantId: scope.tenantId,
        role,
        content,
        origin: null,
        provider: null,
        model: null,
        transport: null,
        correlationId: null,
        providerRequestId: null,
        inputTokens: null,
        outputTokens: null,
        tokenCount: null,
        createdAt: new Date().toISOString(),
        ...extra,
      });

      staged.push(message("user", input.userContent, { origin: "user" }));
      const assistant = message("assistant", input.assistant.content, {
        origin: input.assistant.origin ?? null,
        provider: input.assistant.provider ?? null,
        model: input.assistant.model ?? null,
        transport: input.assistant.transport ?? null,
        correlationId: input.assistant.correlationId ?? null,
        providerRequestId: input.assistant.providerRequestId ?? null,
        inputTokens: input.assistant.inputTokens ?? null,
        outputTokens: input.assistant.outputTokens ?? null,
        tokenCount: input.assistant.tokenCount ?? null,
      });
      staged.push(assistant);

      if (conversationRecord) conversations.set(conversationId, conversationRecord);
      messages.push(...staged);
      if (input.evidence) {
        evidence.set(assistant.id, { messageId: assistant.id, ...input.evidence });
      }
      if (input.sourceEvidence && input.sourceEvidence.length > 0) {
        sourceEvidence.set(
          assistant.id,
          input.sourceEvidence.map((item) => ({ messageId: assistant.id, ...item })),
        );
      }
      return { conversationId, assistantMessageId: assistant.id };
    },

    async listAnswerEvidence(scope: ConversationScope, messageIds: readonly string[]) {
      const visible = new Set(
        messages.filter((m) => m.tenantId === scope.tenantId).map((m) => m.id),
      );
      return messageIds
        .filter((id) => visible.has(id))
        .map((id) => evidence.get(id))
        .filter((set): set is StoredEvidenceSet => set !== undefined);
    },

    /* Tenant-visibility is enforced here too — a fake that leaks proves nothing about one that does not. */
    async listAnswerSourceEvidence(scope: ConversationScope, messageIds: readonly string[]) {
      const visible = new Set(
        messages.filter((m) => m.tenantId === scope.tenantId).map((m) => m.id),
      );
      return messageIds.filter((id) => visible.has(id)).flatMap((id) => sourceEvidence.get(id) ?? []);
    },
  };
}
