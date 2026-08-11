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
} from "../../src/features/heby-conversation/durable-conversation-repository.server";

export function createInMemoryConversationRepo(): DurableConversationRepository {
  const conversations = new Map<string, DurableConversationRecord>();
  const messages: DurableMessageRecord[] = [];
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
  };
}
