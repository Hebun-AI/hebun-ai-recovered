/*
 * HEBY-CONVERSATION-CONTINUITY-1 — a human returns to their OWN Heby conversations, against a real
 * PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   A. The list holds only the acting human's conversations: not another member's of the same
 *      tenant, not another tenant's; no actor or no tenant is refused.
 *   B. Newest activity first; continuing an old conversation moves it to the top.
 *   C. Keyset pages neither repeat nor skip, including activity that differs below a millisecond.
 *   D. A malformed or foreign cursor is an honest empty page or stays owner-scoped — never an error.
 *   E. A deep link to a foreign, unknown or malformed id is indistinguishable from the outside.
 *   F. A turn's question and answer share one timestamp, and the question is read back first.
 *   G. The server read maps a missing session, missing persistence and a failed read honestly.
 *
 * Writes go through the released writer (`persistExchange`). Disposable database, dropped on exit.
 * No provider, no network, no credential.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  ConversationScopeError,
  createDurableConversationRepository,
  type ConversationScope,
  type DurableConversationRepository,
} from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { loadHebyConversation } from "../../src/features/heby-answer/load-conversation.server";
import { listHebyConversations } from "../../src/features/heby-answer/list-conversations.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const asTenant = (scope: { tenantId: string; actorId: string }) =>
  ({ tenantId: scope.tenantId, userId: scope.actorId }) as unknown as TenantContext;

async function exchange(repo: DurableConversationRepository, scope: ConversationScope, question: string, conversationId?: string) {
  return repo.persistExchange(scope, {
    providedConversationId: conversationId,
    subject: question,
    userContent: question,
    assistant: { role: "assistant", content: `answer to ${question}`, origin: "deterministic" },
  });
}

async function allPages(repo: DurableConversationRepository, scope: ConversationScope, limit: number) {
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await repo.listOwnedConversations(scope, { limit, cursor });
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor ?? undefined;
    pages += 1;
    assert.ok(pages < 100, "pagination terminates");
  } while (cursor);
  return { ids, pages };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_hcc1_continuity");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();
    const acme = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-hcc1", email: "alice@hcc1.test" });
    const globex = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-hcc1", email: "bob@hcc1.test" });
    const alice = { tenantId: acme.tenantId, actorId: acme.userId };
    /* A second human of Acme: the same tenant, a different person. */
    const carol = { tenantId: acme.tenantId, actorId: randomUUID() };
    const bob = { tenantId: globex.tenantId, actorId: globex.userId };
    const repo = createDurableConversationRepository(controlPlane.db);

    /* ── A + B: owner-only, activity-ordered ─────────────────────────────────────────────────── */
    const first = await exchange(repo, alice, "first question");
    const second = await exchange(repo, alice, "second question");
    const third = await exchange(repo, alice, "third question");
    const carolOwn = await exchange(repo, carol, "carol private question");
    const bobOwn = await exchange(repo, bob, "bob private question");
    // Continuing the oldest makes it the most recent.
    await exchange(repo, alice, "follow-up", first.conversationId);

    const alicePage = await repo.listOwnedConversations(alice);
    assert.deepEqual(
      alicePage.items.map((item) => item.id),
      [first.conversationId, third.conversationId, second.conversationId],
      "newest activity first",
    );
    assert.equal(alicePage.nextCursor, null);
    assert.equal(alicePage.items[0]!.subject, "first question", "the subject is the first prompt, not the latest");
    assert.ok(Date.parse(alicePage.items[0]!.lastActivityAt) >= Date.parse(alicePage.items[0]!.createdAt));
    assert.deepEqual(Object.keys(alicePage.items[0]!).sort(), ["createdAt", "id", "lastActivityAt", "subject"], "no message content crosses");

    assert.deepEqual((await repo.listOwnedConversations(carol)).items.map((i) => i.id), [carolOwn.conversationId], "same-tenant member sees only their own");
    assert.deepEqual((await repo.listOwnedConversations(bob)).items.map((i) => i.id), [bobOwn.conversationId], "other tenant sees only its own");
    assert.deepEqual((await repo.listOwnedConversations({ tenantId: globex.tenantId, actorId: acme.userId })).items, [], "alice's id under another tenant lists nothing");
    await assert.rejects(repo.listOwnedConversations({ tenantId: acme.tenantId }), ConversationScopeError, "no actor is refused");
    await assert.rejects(repo.listOwnedConversations({ tenantId: " ", actorId: acme.userId }), ConversationScopeError, "no tenant is refused");

    /* ── C: keyset pages ─────────────────────────────────────────────────────────────────────── */
    for (let i = 0; i < 22; i += 1) await exchange(repo, alice, `bulk ${i}`);
    const full = (await repo.listOwnedConversations(alice, { limit: 50 })).items.map((i) => i.id);
    assert.equal(full.length, 25);
    const paged = await allPages(repo, alice, 7);
    assert.deepEqual(paged.ids, full, "pages concatenate to the full ordered list, no repeat, no skip");
    assert.equal(paged.pages, 4);
    const defaultPage = await repo.listOwnedConversations(alice);
    assert.equal(defaultPage.items.length, 20, "default page size");
    assert.ok(defaultPage.nextCursor);
    assert.equal((await repo.listOwnedConversations(alice, { limit: 10_000 })).items.length, 25, "limit is clamped, not trusted");
    assert.equal((await repo.listOwnedConversations(alice, { limit: 0 })).items.length, 1, "limit floor is one");

    /* Sub-millisecond activity: two conversations 400µs apart must both survive a page boundary. */
    const t = "2026-01-01 00:00:00.000100+00";
    await setup.query(`update messages set created_at = $2::timestamptz where conversation_id = $1`, [second.conversationId, t]);
    await setup.query(`update messages set created_at = $2::timestamptz + interval '400 microseconds' where conversation_id = $1`, [third.conversationId, t]);
    const pagedFine = await allPages(repo, alice, 1);
    assert.equal(new Set(pagedFine.ids).size, 25, "single-row pages repeat nothing");
    assert.deepEqual(pagedFine.ids.slice(-2), [third.conversationId, second.conversationId], "microsecond order is kept across pages");

    /* ── D: cursors ──────────────────────────────────────────────────────────────────────────── */
    for (const cursor of ["", "garbage", "1:not-a-uuid", "-1:" + randomUUID(), "99999999999999999999:" + randomUUID(), "1:x' or '1'='1"]) {
      const page = await repo.listOwnedConversations(alice, { cursor });
      assert.deepEqual(page, { items: [], nextCursor: null }, `malformed cursor ${JSON.stringify(cursor)} → empty page`);
    }
    // A cursor naming another person's conversation is only a position; the rows stay alice's.
    const bobCursor = `${Date.now() * 1000 + 10_000_000}:${bobOwn.conversationId}`;
    const fromForeign = await repo.listOwnedConversations(alice, { cursor: bobCursor, limit: 50 });
    assert.equal(fromForeign.items.length, 25, "a position after every row returns all of alice's");
    assert.ok(fromForeign.items.every((i) => full.includes(i.id)), "a foreign cursor never yields a foreign row");

    /* ── E: deep links ───────────────────────────────────────────────────────────────────────── */
    const loadAs = (scope: { tenantId: string; actorId: string }, conversationId: string) =>
      loadHebyConversation({ conversationId }, { resolveTenant: async () => asTenant(scope), getConversationRepo: () => repo, readDisclosureDecisions: async () => ({ status: "unavailable" }) as never });
    const owned = await loadAs(alice, first.conversationId);
    assert.equal(owned.status, "loaded");
    const refusals = [
      await loadAs(carol, first.conversationId),
      await loadAs(bob, first.conversationId),
      await loadAs(alice, randomUUID()),
      await loadAs(alice, "not-a-uuid"),
      await loadAs(alice, bobOwn.conversationId),
    ];
    for (const refusal of refusals) assert.deepEqual(refusal, { status: "not-found" }, "foreign, unknown and malformed are one answer");

    /* ── F: message order inside a turn ──────────────────────────────────────────────────────── */
    const pair = await setup.query<{ n: string; stamps: string; txs: string }>(
      `select count(*) as n, count(distinct created_at) as stamps, count(distinct xmin::text) as txs
         from messages where conversation_id = $1`,
      [carolOwn.conversationId],
    );
    assert.deepEqual(pair.rows[0], { n: "2", stamps: "1", txs: "1" }, "question and answer share one created_at and one inserting transaction");
    if (owned.status !== "loaded") throw new Error("unreachable");
    assert.deepEqual(
      owned.view.messages.map((m) => `${m.role}:${m.content}`),
      ["user:first question", "assistant:answer to first question", "user:follow-up", "assistant:answer to follow-up"],
      "each question precedes its answer, turns in order",
    );
    for (let i = 0; i < 5; i += 1) {
      const again = await repo.listConversationMessages(alice, first.conversationId);
      assert.deepEqual(again.map((m) => m.role), ["user", "assistant", "user", "assistant"], "the order is deterministic across reads");
    }

    /* ── G: the server read ──────────────────────────────────────────────────────────────────── */
    const listAs = (resolveTenant: () => Promise<TenantContext | null>, getConversationRepo: () => DurableConversationRepository | null, cursor?: string) =>
      listHebyConversations({ cursor }, { resolveTenant, getConversationRepo });
    assert.deepEqual(await listAs(async () => null, () => repo), { status: "unauthorized" });
    assert.deepEqual(await listAs(async () => asTenant(alice), () => null), { status: "not-configured" });
    const failing = { ...repo, listOwnedConversations: async () => { throw new Error("db down"); } } as DurableConversationRepository;
    assert.deepEqual(await listAs(async () => asTenant(alice), () => failing), { status: "unavailable" }, "a failed read is not an empty list");
    const listed = await listAs(async () => asTenant(carol), () => repo);
    assert.equal(listed.status, "listed");
    if (listed.status !== "listed") throw new Error("unreachable");
    assert.deepEqual(listed.items.map((i) => i.id), [carolOwn.conversationId]);
    const tampered = await listHebyConversations({ cursor: 42 as unknown as string }, { resolveTenant: async () => asTenant(alice), getConversationRepo: () => repo });
    assert.equal(tampered.status, "listed", "a non-string cursor is ignored, not trusted");

    console.log("heby-conversation-continuity-1 continuity checks passed");
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
