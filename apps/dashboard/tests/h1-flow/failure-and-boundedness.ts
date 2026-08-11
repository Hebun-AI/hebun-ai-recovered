/*
 * H1B — failure semantics (fail-closed to empty history, never fabricated memory) + boundedness
 * (only recent, bounded by count AND chars, oldest dropped, current always retained).
 * Fake transport, in-memory repo, no network.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest, type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";
import { createInMemoryConversationRepo } from "../helpers/in-memory-conversation-repo";
import type { DurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { MAX_HISTORY_MESSAGES, MAX_HISTORY_CHARS } from "../../src/features/heby-answer/bounded-history";

function tenant(id: string): TenantContext {
  return { tenantId: id, userId: `${id}-user` } as unknown as TenantContext;
}
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;
const OPS = "/operations";

function deps(
  repo: DurableConversationRepository | null,
  fake: ReturnType<typeof createFakeClaudeTransport>,
  over: Partial<HebyModelAnswerDeps> = {},
): HebyModelAnswerDeps {
  return {
    resolveTenant: async () => tenant("acme"),
    readOverview: () => undefined,
    env: MODEL_ENV,
    resolveDirectorEnabled: async () => true,
    selectTransport: () => ({ transport: fake, transportProvenance: "fake" }),
    generate: generateHebyModelAnswer,
    getConversationRepo: () => repo,
    newCorrelationId: () => "corr",
    ...over,
  };
}

const scope = { tenantId: "acme", actorId: "acme-user" };

async function seedConversation(repo: DurableConversationRepository, turns: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const conv = await repo.createConversation(scope, { subject: "seed" });
  for (const t of turns) {
    await repo.appendMessage(scope, { conversationId: conv.id, role: t.role, content: t.content, origin: t.role === "user" ? "user" : "model" });
  }
  return conv.id;
}

async function main(): Promise<void> {
  // ---------- Failure semantics: every path fails closed to EMPTY history, still answers ----------
  const repo = createInMemoryConversationRepo();
  const convId = await seedConversation(repo, [
    { role: "user", content: "prior question" },
    { role: "assistant", content: "prior answer" },
  ]);

  // 1. No conversationId → no history.
  {
    const fake = createFakeClaudeTransport("success");
    const r = await answerHebyModelRequest({ prompt: "hi", route: OPS }, deps(repo, fake));
    assert.equal(r.status, "answered");
    assert.equal(fake.lastRequest!.messages.length, 1, "no conversationId → no history");
  }
  // 2. Unknown conversationId → no history.
  {
    const fake = createFakeClaudeTransport("success");
    await answerHebyModelRequest({ prompt: "hi", route: OPS, conversationId: "conv-does-not-exist" }, deps(repo, fake));
    assert.equal(fake.lastRequest!.messages.length, 1, "unknown conversation → no history");
  }
  // 3. Repository unavailable (null) → no history, still answers.
  {
    const fake = createFakeClaudeTransport("success");
    const r = await answerHebyModelRequest({ prompt: "hi", route: OPS, conversationId: convId }, deps(null, fake));
    assert.equal(r.status, "answered");
    assert.equal(fake.lastRequest!.messages.length, 1, "no repo → no history");
  }
  // 4. History read throws → fail-closed to empty history, still answers (persist path independent).
  {
    const throwingRepo: DurableConversationRepository = {
      ...createInMemoryConversationRepo(),
      async listConversationMessages() {
        throw new Error("history store down");
      },
    };
    const fake = createFakeClaudeTransport("success");
    const r = await answerHebyModelRequest({ prompt: "hi", route: OPS, conversationId: convId }, deps(throwingRepo, fake));
    assert.equal(r.status, "answered");
    assert.equal(fake.lastRequest!.messages.length, 1, "history read failure → fail-closed empty history");
  }

  // ---------- Boundedness ----------
  // 5. Many short messages → capped at MAX_HISTORY_MESSAGES; current always the last turn.
  {
    const manyRepo = createInMemoryConversationRepo();
    const turns = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`,
    }));
    const id = await seedConversation(manyRepo, turns);
    const fake = createFakeClaudeTransport("success");
    await answerHebyModelRequest({ prompt: "current", route: OPS, conversationId: id }, deps(manyRepo, fake));
    const msgs = fake.lastRequest!.messages;
    const history = msgs.slice(0, msgs.length - 1); // all but the current turn
    assert.ok(history.length <= MAX_HISTORY_MESSAGES, `history capped at ${MAX_HISTORY_MESSAGES} (got ${history.length})`);
    assert.equal(msgs[msgs.length - 1]!.content, "current", "current prompt is always retained as the last turn");
    // Newest prior messages retained, oldest dropped.
    assert.ok(history.some((m) => m.content === "m19"), "newest prior turn retained");
    assert.ok(!history.some((m) => m.content === "m0"), "oldest prior turn dropped");
  }

  // 6. Large messages → capped by char budget; oldest dropped; current retained; evidence intact.
  {
    const bigRepo = createInMemoryConversationRepo();
    const turns = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `${i}:` + "x".repeat(2000),
    }));
    const id = await seedConversation(bigRepo, turns);
    const fake = createFakeClaudeTransport("success");
    await answerHebyModelRequest({ prompt: "current", route: OPS, conversationId: id }, deps(bigRepo, fake));
    const msgs = fake.lastRequest!.messages;
    const history = msgs.slice(0, msgs.length - 1);
    const historyChars = history.reduce((n, m) => n + m.content.length, 0);
    assert.ok(historyChars <= MAX_HISTORY_CHARS, `history within char budget (got ${historyChars})`);
    assert.ok(history.length < MAX_HISTORY_MESSAGES, "char budget trimmed below the message cap");
    assert.equal(msgs[msgs.length - 1]!.content, "current", "current prompt retained");
    assert.ok(history.every((m) => m.content.length === 2002), "kept turns are intact (never split)");
    assert.ok(history.some((m) => m.content.startsWith("7:")), "newest prior turn retained");
    assert.ok(!history.some((m) => m.content.startsWith("0:")), "oldest prior turn dropped");
    // Evidence budget is not replaced by conversation history — the fresh grounding block is present.
    assert.ok(/Grounding context/.test(fake.lastRequest!.system), "current evidence still present alongside bounded history");
  }

  console.log("h1 failure + boundedness checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
