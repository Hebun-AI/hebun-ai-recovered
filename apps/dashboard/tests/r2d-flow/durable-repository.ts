/*
 * R2D — durable conversation repository (INTEGRATION, real local Postgres).
 *
 * Uses a disposable local database (throwaway, localhost only) migrated with the authored
 * migrations — including the additive R2D message-provenance columns. Proves that conversations
 * and messages persist durably, survive re-instantiation, carry real provenance/usage, and are
 * strictly tenant-isolated. No provider, no network, no key.
 */

import assert from "node:assert/strict";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createDurableConversationRepository,
  ConversationNotFoundError,
  ConversationScopeError,
} from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { randomUUID } from "node:crypto";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r2d_conversation");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  let controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    const acme = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "alice@acme.test" });
    const globex = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex", email: "bob@globex.test" });
    const scopeA = { tenantId: acme.tenantId, actorId: acme.userId };
    const scopeB = { tenantId: globex.tenantId, actorId: globex.userId };

    let repo = createDurableConversationRepository(controlPlane.db);

    // --- Create a conversation + user and model-assistant messages (with provenance/usage) ---
    const conversation = await repo.createConversation(scopeA, { subject: "What is the operational health?" });
    assert.ok(conversation.id);
    assert.equal(conversation.tenantId, acme.tenantId);

    await repo.appendMessage(scopeA, {
      conversationId: conversation.id, role: "user", content: "What is the operational health?", origin: "user",
    });
    await repo.appendMessage(scopeA, {
      conversationId: conversation.id, role: "assistant", content: "Simulated model answer.", origin: "model",
      provider: "claude", model: "synthetic-test-model", transport: "fake",
      correlationId: "corr-123", providerRequestId: "req_fake_0001",
      inputTokens: 42, outputTokens: 7, tokenCount: 49,
    });

    const messages = await repo.listConversationMessages(scopeA, conversation.id);
    assert.equal(messages.length, 2);
    assert.equal(messages[0]!.role, "user");
    assert.equal(messages[1]!.role, "assistant");
    // Provenance + usage persisted exactly as supplied.
    const assistant = messages[1]!;
    assert.equal(assistant.origin, "model");
    assert.equal(assistant.provider, "claude");
    assert.equal(assistant.model, "synthetic-test-model");
    assert.equal(assistant.transport, "fake");
    assert.equal(assistant.correlationId, "corr-123");
    assert.equal(assistant.providerRequestId, "req_fake_0001");
    assert.equal(assistant.inputTokens, 42);
    assert.equal(assistant.outputTokens, 7);
    assert.equal(assistant.tokenCount, 49);

    // --- Reload / re-instantiation: a brand-new pool + repo still reads the durable rows ---
    await controlPlane.dispose();
    controlPlane = createControlPlaneDb(harness.dbUrl);
    repo = createDurableConversationRepository(controlPlane.db);

    const reloaded = await repo.getConversation(scopeA, conversation.id);
    assert.ok(reloaded, "conversation survives re-instantiation");
    const reloadedMessages = await repo.listConversationMessages(scopeA, conversation.id);
    assert.equal(reloadedMessages.length, 2);
    assert.equal(reloadedMessages[1]!.inputTokens, 42);

    // --- Tenant isolation: tenant B cannot read, list, or append to tenant A's conversation ---
    assert.equal(await repo.getConversation(scopeB, conversation.id), undefined);
    assert.deepEqual(await repo.listConversationMessages(scopeB, conversation.id), []);
    await assert.rejects(
      () => repo.appendMessage(scopeB, { conversationId: conversation.id, role: "user", content: "intrude", origin: "user" }),
      (e: unknown) => e instanceof ConversationNotFoundError,
    );
    // Tenant A's message count is unchanged after B's rejected append.
    assert.equal((await repo.listConversationMessages(scopeA, conversation.id)).length, 2);

    // --- Missing tenant fails closed ---
    await assert.rejects(
      () => repo.createConversation({ tenantId: "" }),
      (e: unknown) => e instanceof ConversationScopeError,
    );

    // --- Malformed / unknown conversation id → honest not-found (never a thrown SQL error) ---
    assert.equal(await repo.getConversation(scopeA, "not-a-uuid"), undefined);
    assert.deepEqual(await repo.listConversationMessages(scopeA, "not-a-uuid"), []);
    assert.equal(await repo.getConversation(scopeA, randomUUID()), undefined);

    console.log("r2d durable conversation repository checks passed");
  } finally {
    await controlPlane.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
