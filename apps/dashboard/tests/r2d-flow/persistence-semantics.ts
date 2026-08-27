/*
 * R2D — durable persistence SEMANTICS (service level, no database).
 *
 * Exercises the orchestration service with a recording in-memory repository and a no-network
 * fake transport. It proves the honest persistence contract: what is written, what is NOT,
 * and how durability is reported on success and on every failure — with no real DB, provider,
 * key, or network.
 */

import assert from "node:assert/strict";
import {
  answerHebyModelRequest,
  type HebyModelAnswerDeps,
} from "../../src/features/heby-answer/model-answer.server";
import { loadHebyConversation } from "../../src/features/heby-answer/load-conversation.server";
import type {
  AppendMessageInput,
  ConversationScope,
  DurableConversationRecord,
  DurableConversationRepository,
  DurableMessageRecord,
  StoredEvidenceSet,
} from "../../src/features/heby-conversation/durable-conversation-repository.server";
import type { ExecutiveOverviewLike } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createFakeClaudeTransport, type FakeClaudeScenario } from "../helpers/fake-claude-transport";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "synthetic-test-model",
  HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "256",
} as const;

function tenant(tenantId: string): TenantContext {
  return asHumanTenantContext({
    tenantId, userId: `user-${tenantId}`, authIdentityId: `id-${tenantId}`,
    membershipId: `m-${tenantId}`, membershipVersion: 1, roleId: `r-${tenantId}`,
    sessionContextId: `s-${tenantId}`, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId: `req-${tenantId}`,
    authenticatedAt: new Date("2026-08-10T00:00:00.000Z").toISOString(),
  });
}

function overview(): ExecutiveOverviewLike {
  return {
    organizationHealth: "stable", criticalAlertCount: 0, warningCount: 0, unavailableCount: 0,
    freshness: { state: "fresh", ageSeconds: 1 },
    sections: [{ sectionId: "active-agents", label: "Active agents", health: "ok", sourceState: "connected", recordCount: 1, reasonCode: "healthy" }],
    authoritative: false,
  };
}

interface RecordingRepo {
  readonly repo: DurableConversationRepository;
  readonly conversations: DurableConversationRecord[];
  readonly messages: DurableMessageRecord[];
  readonly evidenceSets: StoredEvidenceSet[];
}

/** An in-memory recording repository. `failOn` forces a throw to prove failure semantics. */
function recordingRepo(failOn?: "create" | "append"): RecordingRepo {
  const conversations: DurableConversationRecord[] = [];
  const messages: DurableMessageRecord[] = [];
  const evidenceSets: StoredEvidenceSet[] = [];
  let seq = 0;
  const now = () => new Date("2026-08-10T00:00:00.000Z").toISOString();
  const repo: DurableConversationRepository = {
    async createConversation(scope: ConversationScope, input) {
      if (failOn === "create") throw new Error("simulated create failure");
      const record: DurableConversationRecord = {
        id: `conv-${++seq}`, tenantId: scope.tenantId, subject: input?.subject ?? null, createdAt: now(),
      };
      conversations.push(record);
      return record;
    },
    async appendMessage(scope: ConversationScope, input: AppendMessageInput) {
      if (failOn === "append") throw new Error("simulated append failure");
      const owns = conversations.some((c) => c.id === input.conversationId && c.tenantId === scope.tenantId);
      if (!owns) throw new Error("conversation not owned");
      const record: DurableMessageRecord = {
        id: `msg-${++seq}`, conversationId: input.conversationId, tenantId: scope.tenantId,
        role: input.role, content: input.content, origin: input.origin,
        provider: input.provider ?? null, model: input.model ?? null, transport: input.transport ?? null,
        correlationId: input.correlationId ?? null, providerRequestId: input.providerRequestId ?? null,
        inputTokens: input.inputTokens ?? null, outputTokens: input.outputTokens ?? null,
        tokenCount: input.tokenCount ?? null, createdAt: now(),
      };
      messages.push(record);
      return record;
    },
    async getConversation(scope, conversationId) {
      return conversations.find((c) => c.id === conversationId && c.tenantId === scope.tenantId);
    },
    async listConversationMessages(scope, conversationId) {
      return messages.filter((m) => m.conversationId === conversationId && m.tenantId === scope.tenantId);
    },
    /*
     * KR5. Models the atomic contract: the whole turn is staged locally and published only on
     * success, so a simulated failure at ANY point leaves no conversation, no message and no
     * evidence. `failOn: "append"` used to leave a user message behind — the orphan this phase
     * closes — and the assertions below now prove it does not.
     */
    async persistExchange(scope: ConversationScope, input) {
      if (failOn === "create") throw new Error("simulated create failure");
      const existing = input.providedConversationId
        ? conversations.find((c) => c.id === input.providedConversationId && c.tenantId === scope.tenantId)
        : undefined;
      const stagedConversation: DurableConversationRecord | undefined = existing
        ? undefined
        : { id: `conv-${++seq}`, tenantId: scope.tenantId, subject: input.subject, createdAt: now() };
      const conversationId = existing?.id ?? stagedConversation!.id;

      const build = (role: string, content: string, extra: Partial<DurableMessageRecord>): DurableMessageRecord => ({
        id: `msg-${++seq}`, conversationId, tenantId: scope.tenantId, role, content,
        origin: null, provider: null, model: null, transport: null, correlationId: null,
        providerRequestId: null, inputTokens: null, outputTokens: null, tokenCount: null,
        createdAt: now(), ...extra,
      });
      const staged = [
        build("user", input.userContent, { origin: "user" }),
        build("assistant", input.assistant.content, {
          origin: input.assistant.origin ?? null,
          provider: input.assistant.provider ?? null,
          model: input.assistant.model ?? null,
          transport: input.assistant.transport ?? null,
          correlationId: input.assistant.correlationId ?? null,
          providerRequestId: input.assistant.providerRequestId ?? null,
          inputTokens: input.assistant.inputTokens ?? null,
          outputTokens: input.assistant.outputTokens ?? null,
          tokenCount: input.assistant.tokenCount ?? null,
        }),
      ];

      // The failure lands AFTER both rows are built and BEFORE anything is published.
      if (failOn === "append") throw new Error("simulated append failure");

      if (stagedConversation) conversations.push(stagedConversation);
      messages.push(...staged);
      if (input.evidence) evidenceSets.push({ messageId: staged[1]!.id, ...input.evidence });
      return { conversationId, assistantMessageId: staged[1]!.id };
    },
    /* G6D — this double records no source evidence; these tests assert message/exchange semantics. */
    async listAnswerSourceEvidence() {
      return [];
    },
    async listAnswerEvidence(scope: ConversationScope, messageIds) {
      const visible = new Set(messages.filter((m) => m.tenantId === scope.tenantId).map((m) => m.id));
      return evidenceSets.filter((set) => messageIds.includes(set.messageId) && visible.has(set.messageId));
    },
  };
  return { repo, conversations, messages, evidenceSets };
}

function baseDeps(rec: RecordingRepo, scenario: FakeClaudeScenario, overrides: Partial<HebyModelAnswerDeps> = {}): HebyModelAnswerDeps {
  return {
    resolveTenant: async () => tenant("acme"),
    readOverview: () => overview(),
    selectTransport: () => ({ transport: createFakeClaudeTransport(scenario), transportProvenance: "fake" }),
    env: MODEL_ENV,
    newCorrelationId: () => "corr-fixed",
    getConversationRepo: () => rec.repo,
    // The R2E Director connectivity gate defaults fail-closed; these persistence tests exercise
    // the model path, so they explicitly permit connectivity (fail-closed default proven in R2E).
    resolveDirectorEnabled: async () => true,
    ...overrides,
  };
}

const input = { prompt: "What is the operational health?", route: "/operations" };

async function main(): Promise<void> {
  // 1. Durable success: user + assistant persisted; result reports durable + conversationId.
  {
    const rec = recordingRepo();
    const result = await answerHebyModelRequest(input, baseDeps(rec, "success"));
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.persistence.durable, true);
    if (result.persistence.durable) assert.ok(result.persistence.conversationId);
    assert.equal(rec.conversations.length, 1);
    assert.equal(rec.messages.length, 2);
    assert.equal(rec.messages[0]!.role, "user");
    assert.equal(rec.messages[0]!.origin, "user");
    assert.equal(rec.messages[1]!.role, "assistant");
    assert.equal(rec.messages[1]!.origin, "model");
  }

  // 2. Model message carries real provenance + usage when the transport supplies it.
  {
    const rec = recordingRepo();
    await answerHebyModelRequest(input, baseDeps(rec, "success"));
    const assistant = rec.messages.find((m) => m.role === "assistant")!;
    assert.equal(assistant.provider, "claude");
    assert.equal(assistant.model, "synthetic-test-model");
    assert.equal(assistant.transport, "fake");
    assert.equal(assistant.correlationId, "corr-fixed");
    assert.equal(assistant.providerRequestId, "req_fake_0001");
    assert.equal(assistant.inputTokens, 42);
    assert.equal(assistant.outputTokens, 7);
    assert.equal(assistant.tokenCount, 49);
  }

  // 3. Missing usage stays UNAVAILABLE — never invented.
  {
    const rec = recordingRepo();
    await answerHebyModelRequest(input, baseDeps(rec, "success-no-usage"));
    const assistant = rec.messages.find((m) => m.role === "assistant")!;
    assert.equal(assistant.inputTokens, null);
    assert.equal(assistant.outputTokens, null);
    assert.equal(assistant.tokenCount, null);
    // Provider/model/transport are still real for a model answer.
    assert.equal(assistant.transport, "fake");
  }

  // 4. Deterministic fallback (model disabled) is persisted as DETERMINISTIC — never model,
  //    and carries NO provider/model/transport (no false implication of provider success).
  {
    const rec = recordingRepo();
    const result = await answerHebyModelRequest(input, baseDeps(rec, "success", { env: {} }));
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.outcome.response.origin, "deterministic");
    assert.equal(result.persistence.durable, true);
    const assistant = rec.messages.find((m) => m.role === "assistant")!;
    assert.equal(assistant.origin, "deterministic");
    assert.equal(assistant.provider, null);
    assert.equal(assistant.model, null);
    assert.equal(assistant.transport, null);
    assert.equal(assistant.providerRequestId, null);
  }

  // 5. Model transport failure → deterministic fallback persisted as deterministic (no fake model row).
  {
    const rec = recordingRepo();
    const result = await answerHebyModelRequest(input, baseDeps(rec, "timeout"));
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.outcome.response.origin, "deterministic");
    const assistant = rec.messages.find((m) => m.role === "assistant")!;
    assert.equal(assistant.origin, "deterministic");
    assert.equal(assistant.provider, null);
  }

  // 6. Persistence not configured (repo null) → honest non-durable, answer still returned.
  {
    const result = await answerHebyModelRequest(input, baseDeps(recordingRepo(), "success", { getConversationRepo: () => null }));
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.persistence.durable, false);
    if (!result.persistence.durable) assert.equal(result.persistence.reason, "not-configured");
    assert.equal(result.outcome.response.origin, "model");
  }

  // 7. Create failure → non-durable (persistence-failed); no false durable claim.
  {
    const rec = recordingRepo("create");
    const result = await answerHebyModelRequest(input, baseDeps(rec, "success"));
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.persistence.durable, false);
    if (!result.persistence.durable) assert.equal(result.persistence.reason, "persistence-failed");
    assert.equal(rec.messages.length, 0);
  }

  // 8. Append failure → non-durable (persistence-failed), AND NOTHING PARTIAL SURVIVES.
  {
    const rec = recordingRepo("append");
    const result = await answerHebyModelRequest(input, baseDeps(rec, "success"));
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.persistence.durable, false);
    if (!result.persistence.durable) assert.equal(result.persistence.reason, "persistence-failed");
    /*
     * KR5 closed a real orphan. Before the exchange became one transaction, a failure here left
     * the user message committed and then reported `durable: false` — the honest disposition and
     * the durable state disagreed, and the reader saw a question with no answer. Asserting zero
     * rows is what keeps that from coming back.
     */
    assert.equal(rec.messages.length, 0, "a failed turn leaves no orphan user message");
    assert.equal(rec.conversations.length, 0, "a failed turn leaves no empty conversation");
    assert.equal(rec.evidenceSets.length, 0, "a failed turn leaves no evidence");
  }

  // 9. Unauthenticated → unauthorized, NO persistence attempted.
  {
    const rec = recordingRepo();
    const result = await answerHebyModelRequest(input, baseDeps(rec, "success", { resolveTenant: async () => null }));
    assert.equal(result.status, "unauthorized");
    assert.equal(rec.conversations.length, 0);
    assert.equal(rec.messages.length, 0);
  }

  // 10. Foreign/unknown conversation id → a NEW server-owned conversation (never the foreign id).
  {
    const rec = recordingRepo();
    const result = await answerHebyModelRequest(
      { ...input, conversationId: "conv-does-not-exist" },
      baseDeps(rec, "success"),
    );
    if (result.status !== "answered") throw new Error("expected answered");
    assert.equal(result.persistence.durable, true);
    if (result.persistence.durable) assert.notEqual(result.persistence.conversationId, "conv-does-not-exist");
    assert.ok(rec.messages.every((m) => m.conversationId !== "conv-does-not-exist"));
  }

  // 11. Continuation: a second ask reusing the returned conversation id appends to the SAME thread.
  {
    const rec = recordingRepo();
    const first = await answerHebyModelRequest(input, baseDeps(rec, "success"));
    if (first.status !== "answered" || !first.persistence.durable) throw new Error("expected durable");
    const convId = first.persistence.conversationId;
    await answerHebyModelRequest({ ...input, conversationId: convId }, baseDeps(rec, "success"));
    assert.equal(rec.conversations.length, 1);
    assert.equal(rec.messages.length, 4);
  }

  // 12. Load flow: unauthorized / not-configured / not-found / loaded.
  {
    assert.equal((await loadHebyConversation({ conversationId: "x" }, { resolveTenant: async () => null })).status, "unauthorized");
    assert.equal((await loadHebyConversation({ conversationId: "x" }, { resolveTenant: async () => tenant("acme"), getConversationRepo: () => null })).status, "not-configured");

    const rec = recordingRepo();
    const created = await answerHebyModelRequest(input, baseDeps(rec, "success"));
    if (created.status !== "answered" || !created.persistence.durable) throw new Error("expected durable");
    const convId = created.persistence.conversationId;

    const foreign = await loadHebyConversation({ conversationId: convId }, { resolveTenant: async () => tenant("other"), getConversationRepo: () => rec.repo });
    assert.equal(foreign.status, "not-found");

    const loaded = await loadHebyConversation({ conversationId: convId }, { resolveTenant: async () => tenant("acme"), getConversationRepo: () => rec.repo });
    assert.equal(loaded.status, "loaded");
    if (loaded.status === "loaded") {
      assert.equal(loaded.view.messages.length, 2);
      assert.equal(loaded.view.messages[0]!.role, "user");
    }
  }

  console.log("r2d persistence semantics checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
