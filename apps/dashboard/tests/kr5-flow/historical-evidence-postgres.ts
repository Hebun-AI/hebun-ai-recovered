/*
 * KR5 — historical answer evidence, against real PostgreSQL.
 *
 * THE INVARIANT UNDER TEST:
 *
 *   HISTORICAL ANSWER EVIDENCE  !=  CURRENT KNOWLEDGE TRUTH
 *
 * An answer records what it was given. Knowledge moves on. A reload must show the first without
 * quietly substituting the second — which is exactly what re-running retrieval would do, and why
 * the supersession proof below is release-blocking rather than a nicety.
 *
 * Everything here runs on a disposable database, dropped by its own ownership handle. Canonical is
 * never opened. No LLM: the retrieval is real, the answer text is irrelevant to every assertion.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import {
  fromStoredEvidence,
  toStoredEvidence,
} from "../../src/features/heby-conversation/answer-evidence";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { buildRetrievalEvidence } from "../../src/features/knowledge-retrieval";
import { loadHebyConversation } from "../../src/features/heby-answer/load-conversation.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const NOW = new Date("2026-08-15T12:00:00.000Z");

const QUESTION = "yıllık izin kaç gün";
const DOMAIN = "izin";
const FACT = "izin-hakki";

const V3_TITLE = "Yıllık izin hakkı (v3)";
const V3_STATEMENT = "Çalışanlar yılda 14 gün yıllık izin kullanabilir.";
const V4_TITLE = "Yıllık izin hakkı (v4)";
const V4_STATEMENT = "Çalışanlar yılda 20 gün yıllık izin kullanabilir.";

/**
 * A fully-shaped authorized tenant context. Built rather than cast: the loader resolves the tenant
 * server-side and reads `tenantId` off this object, so a partial stand-in would prove tenant
 * isolation against a shape the real code never sees.
 */
function tenantContext(tenantId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId: randomUUID(),
    authIdentityId: randomUUID(),
    membershipId: randomUUID(),
    membershipVersion: 1,
    roleId: randomUUID(),
    sessionContextId: randomUUID(),
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: `req-${tenantId}`,
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("kr5evidence");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;

  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();

    const repo = createDurableConversationRepository(handle.db);
    const knowledge = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = { getRepo: () => knowledge, now: () => NOW };
    const scopeA = { tenantId: TENANT_A, actorId: tenantContext(TENANT_A).userId };
    const scopeB = { tenantId: TENANT_B, actorId: tenantContext(TENANT_B).userId };

    for (const [id, slug] of [
      [TENANT_A, "a"],
      [TENANT_B, "b"],
    ] as const) {
      await client.query(`insert into companies (id, name, slug) values ($1,$2,$3)`, [
        id,
        `Tenant ${slug}`,
        `tenant-${slug}`,
      ]);
    }

    /* ── seed Knowledge at v3 ─────────────────────────────────────────────── */
    const v3NodeId = randomUUID();
    await client.query(
      `insert into knowledge_nodes (id, tenant_id, type, label, statement, knowledge_lifecycle_status,
         knowledge_health, knowledge_scope, knowledge_authority, domain_key, knowledge_version)
       values ($1,$2,'knowledge-fact',$3,$4,'ratified','current','company-wide','authoritative',$5,3)`,
      [v3NodeId, TENANT_A, V3_TITLE, V3_STATEMENT, DOMAIN],
    );
    await client.query(
      `insert into knowledge_facts (tenant_id, fact_key, domain_key, knowledge_scope,
         active_knowledge_node_id, fact_version)
       values ($1,$2,$3,'company-wide',$4,3)`,
      [TENANT_A, FACT, DOMAIN, v3NodeId],
    );

    /* ── 1. A REAL RETRIEVAL, PERSISTED WITH THE ANSWER ───────────────────── */
    const dayOneResult = await searchKnowledge(
      { tenantId: TENANT_A },
      { queryText: QUESTION },
      knowledgeDeps,
    );
    assert.equal(dayOneResult.status, "matched", "the seeded v3 fact answers the question");
    const dayOneEvidence = buildRetrievalEvidence(dayOneResult, QUESTION);
    assert.equal(dayOneEvidence.items.length, 1);
    assert.equal(dayOneEvidence.items[0]!.knowledgeVersion, 3, "the live answer saw v3");
    assert.equal(dayOneEvidence.items[0]!.knowledgeNodeId, v3NodeId, "and that exact node");

    const persisted = await repo.persistExchange(scopeA, {
      subject: QUESTION,
      userContent: QUESTION,
      assistant: { role: "assistant", content: "14 gün.", origin: "deterministic" },
      evidence: toStoredEvidence(dayOneEvidence),
    });

    {
      const { rows } = await client.query<{ n: string }>(
        `select count(*)::text as n from messages where tenant_id = $1`,
        [TENANT_A],
      );
      assert.equal(rows[0]!.n, "2", "one user message and one assistant message");
      const sets = await client.query<{ n: string }>(
        `select count(*)::text as n from heby_answer_evidence_set where message_id = $1`,
        [persisted.assistantMessageId],
      );
      assert.equal(sets.rows[0]!.n, "1", "and exactly one evidence set on the assistant message");
    }

    /* ── 2. SUPERSESSION: v4 REPLACES v3 AS CURRENT ───────────────────────── */
    const v4NodeId = randomUUID();
    await client.query(
      `insert into knowledge_nodes (id, tenant_id, type, label, statement, knowledge_lifecycle_status,
         knowledge_health, knowledge_scope, knowledge_authority, domain_key, knowledge_version)
       values ($1,$2,'knowledge-fact',$3,$4,'ratified','current','company-wide','authoritative',$5,4)`,
      [v4NodeId, TENANT_A, V4_TITLE, V4_STATEMENT, DOMAIN],
    );
    await client.query(
      `update knowledge_nodes set knowledge_lifecycle_status = 'superseded' where id = $1`,
      [v3NodeId],
    );
    await client.query(
      `update knowledge_facts
         set active_knowledge_node_id = $1, previous_knowledge_node_id = $2, fact_version = 4
       where tenant_id = $3 and fact_key = $4`,
      [v4NodeId, v3NodeId, TENANT_A, FACT],
    );

    /* Current Knowledge really did move. If it did not, the next assertion proves nothing. */
    {
      const current = await searchKnowledge(
        { tenantId: TENANT_A },
        { queryText: QUESTION },
        knowledgeDeps,
      );
      assert.equal(current.status, "matched");
      const record = current.status === "matched" ? current.candidates[0]!.record : undefined;
      assert.equal(record?.knowledgeVersion, 4, "current Knowledge is now v4");
      assert.equal(record?.title, V4_TITLE);
      assert.match(record?.statement ?? "", /20 gün/);
    }

    /* ── 3. THE RELOAD STILL SHOWS v3 ─────────────────────────────────────── */
    const reloaded = await loadHebyConversation(
      { conversationId: persisted.conversationId },
      { resolveTenant: async () => tenantContext(TENANT_A), getConversationRepo: () => repo },
    );
    assert.equal(reloaded.status, "loaded");
    if (reloaded.status !== "loaded") throw new Error("unreachable");

    const assistant = reloaded.view.messages.find((m) => m.id === persisted.assistantMessageId);
    assert.ok(assistant, "the assistant message reloaded");
    const historical = assistant!.knowledgeEvidence;
    assert.ok(historical, "and it carries the evidence recorded with it");

    assert.equal(historical!.status, "matched");
    assert.equal(historical!.items.length, 1);
    const item = historical!.items[0]!;
    assert.equal(item.knowledgeVersion, 3, "the historical card still says v3");
    assert.equal(item.knowledgeNodeId, v3NodeId, "and names the exact version that answered");
    assert.equal(item.title, V3_TITLE, "with the title as it read then");
    assert.match(item.excerpt ?? "", /14 gün/, "and the excerpt the reader actually saw");

    /* The whole point, stated as its own assertion. */
    assert.notEqual(item.title, V4_TITLE, "v4 is NOT silently substituted");
    assert.ok(!(item.excerpt ?? "").includes("20 gün"), "and neither is its statement");
    assert.equal(item.lifecycleStatus, "ratified", "standing is answer-time, not today's superseded");

    /* ── 4. THE LIVE AND RELOADED SETS ARE THE SAME SET ───────────────────── */
    {
      const live = dayOneEvidence;
      assert.deepEqual(
        historical!.items.map((i) => i.recordRef),
        live.items.map((i) => i.recordRef),
        "live and reloaded evidence identity converge",
      );
      assert.equal(historical!.status, live.status);
      assert.equal(historical!.excludedCount, live.excludedCount);
      assert.equal(historical!.truncated, live.truncated);
      /* A round trip through storage must not invent or drop a matched term. */
      assert.deepEqual(historical!.items[0]!.explanation.matchedTerms, [
        ...live.items[0]!.explanation.matchedTerms,
      ]);
    }

    /* ── 5. CURRENT KNOWLEDGE WAS NOT REWRITTEN BY ANY OF THIS ────────────── */
    {
      const { rows } = await client.query<{ n: string; f: string }>(
        `select (select count(*) from knowledge_nodes where tenant_id = $1)::text as n,
                (select count(*) from knowledge_facts where tenant_id = $1)::text as f`,
        [TENANT_A],
      );
      assert.equal(rows[0]!.n, "2", "two knowledge nodes: v3 and v4, exactly as seeded");
      assert.equal(rows[0]!.f, "1", "and one fact registry row");
      const active = await client.query<{ id: string }>(
        `select active_knowledge_node_id as id from knowledge_facts where tenant_id = $1`,
        [TENANT_A],
      );
      assert.equal(active.rows[0]!.id, v4NodeId, "the active version is still v4 — history read it, never moved it");
    }

    /* ── 6. ZERO-ITEM SET SURVIVES, AND MEANS SOMETHING DIFFERENT FROM ABSENT ─ */
    {
      const noMatch = await searchKnowledge(
        { tenantId: TENANT_A },
        { queryText: "kuantum bilgisayar mimarisi" },
        knowledgeDeps,
      );
      assert.equal(noMatch.status, "no-match", "the corpus holds records, none answer this");
      const ranAndFoundNothing = await repo.persistExchange(scopeA, {
        subject: "kuantum",
        userContent: "kuantum bilgisayar mimarisi",
        assistant: { role: "assistant", content: "Bilgi yok.", origin: "deterministic" },
        evidence: toStoredEvidence(buildRetrievalEvidence(noMatch, "kuantum bilgisayar mimarisi")),
      });
      const neverRan = await repo.persistExchange(scopeA, {
        subject: "no retrieval",
        userContent: "merhaba",
        assistant: { role: "assistant", content: "Merhaba.", origin: "deterministic" },
      });

      const stored = await repo.listAnswerEvidence(scopeA, [
        ranAndFoundNothing.assistantMessageId,
        neverRan.assistantMessageId,
      ]);
      assert.equal(stored.length, 1, "only the turn where retrieval RAN has a set");
      assert.equal(stored[0]!.messageId, ranAndFoundNothing.assistantMessageId);
      assert.equal(stored[0]!.status, "no-match", "and it says retrieval ran and matched nothing");
      assert.equal(stored[0]!.items.length, 0);

      /*
       * The distinction the set exists to preserve. "No rows" would collapse these two into one
       * statement, and a reader could not tell "we searched and your organization has nothing on
       * this" from "we never looked".
       */
      const projected = fromStoredEvidence(stored[0]!);
      assert.equal(projected.status, "no-match");
      assert.equal(projected.items.length, 0);
    }

    /* ── 7. TENANT ISOLATION ──────────────────────────────────────────────── */
    {
      /* B cannot read A's conversation at all. */
      const asB = await loadHebyConversation(
        { conversationId: persisted.conversationId },
        { resolveTenant: async () => tenantContext(TENANT_B), getConversationRepo: () => repo },
      );
      assert.equal(asB.status, "not-found", "tenant B cannot load tenant A's conversation");

      /* And cannot reach A's evidence by naming A's message id directly. */
      const stolen = await repo.listAnswerEvidence(scopeB, [persisted.assistantMessageId]);
      assert.deepEqual(stolen, [], "tenant B cannot read tenant A's historical evidence");

      /* A foreign conversation id yields nothing rather than someone else's thread. */
      const foreign = await loadHebyConversation(
        { conversationId: randomUUID() },
        { resolveTenant: async () => tenantContext(TENANT_A), getConversationRepo: () => repo },
      );
      assert.equal(foreign.status, "not-found");

      /*
       * STRUCTURAL, not merely checked. The composite foreign key makes a cross-tenant attachment
       * unconstructible even from raw SQL that bypasses every line of application code.
       */
      await assert.rejects(
        () =>
          client!.query(
            `insert into heby_answer_evidence_set (tenant_id, message_id, status)
             values ($1,$2,'matched')`,
            [TENANT_B, persisted.assistantMessageId],
          ),
        /foreign key|violates/i,
        "the database itself refuses tenant B evidence on a tenant A message",
      );
    }

    /* ── 8. IDEMPOTENCY ──────────────────────────────────────────────────── */
    {
      /* One set per assistant message. */
      await assert.rejects(
        () =>
          client!.query(
            `insert into heby_answer_evidence_set (tenant_id, message_id, status)
             values ($1,$2,'matched')`,
            [TENANT_A, persisted.assistantMessageId],
          ),
        /duplicate key|unique/i,
        "a second evidence set for one answer is refused",
      );

      /* One row per fact within a set. */
      const setId = (
        await client.query<{ id: string }>(
          `select id from heby_answer_evidence_set where message_id = $1`,
          [persisted.assistantMessageId],
        )
      ).rows[0]!.id;
      await assert.rejects(
        () =>
          client!.query(
            `insert into heby_answer_evidence_item
               (tenant_id, evidence_set_id, fact_id, domain_key, fact_key, scope, title,
                freshness, knowledge_version, fact_version, ordinal)
             values ($1,$2,$3,$4,$5,'company-wide','dup','current',3,3,1)`,
            [TENANT_A, setId, randomUUID(), DOMAIN, FACT],
          ),
        /duplicate key|unique/i,
        "one answer cites a given fact once",
      );

      /* Ordinal is stable and preserves retrieval order. */
      const ordinals = await client.query<{ ordinal: number }>(
        `select ordinal from heby_answer_evidence_item where evidence_set_id = $1 order by ordinal`,
        [setId],
      );
      assert.deepEqual(ordinals.rows.map((r) => r.ordinal), [0]);
    }

    /* ── 9. A USER RETRY IS A NEW TURN, NOT A DUPLICATE ───────────────────── */
    {
      const before = await client.query<{ n: string }>(
        `select count(*)::text as n from messages where tenant_id = $1`,
        [TENANT_A],
      );
      const retry = await repo.persistExchange(scopeA, {
        providedConversationId: persisted.conversationId,
        subject: QUESTION,
        userContent: QUESTION,
        assistant: { role: "assistant", content: "14 gün.", origin: "deterministic" },
        evidence: toStoredEvidence(dayOneEvidence),
      });
      assert.notEqual(retry.assistantMessageId, persisted.assistantMessageId);
      const after = await client.query<{ n: string }>(
        `select count(*)::text as n from messages where tenant_id = $1`,
        [TENANT_A],
      );
      assert.equal(
        Number(after.rows[0]!.n) - Number(before.rows[0]!.n),
        2,
        "a retry is a new turn under current semantics — two more messages, its own evidence",
      );
      assert.equal(retry.conversationId, persisted.conversationId, "in the same conversation");
    }

    /* ── 10. CASCADE: EVIDENCE IS ITS PARENT'S, AND OUTLIVES NOTHING ──────── */
    {
      const setId = (
        await client.query<{ id: string }>(
          `select id from heby_answer_evidence_set where message_id = $1`,
          [persisted.assistantMessageId],
        )
      ).rows[0]!.id;

      /*
       * SCHEMA-INTEGRITY PROOF ONLY. Hebun has no product deletion path — no UI, no runtime, and
       * no retention policy. This deletes a message with raw SQL purely to prove that IF such a
       * path is ever built, evidence follows its parent instead of being stranded. Retention
       * remains a deferred Director decision.
       */
      await client.query(`delete from messages where id = $1`, [persisted.assistantMessageId]);

      const sets = await client.query<{ n: string }>(
        `select count(*)::text as n from heby_answer_evidence_set where id = $1`,
        [setId],
      );
      assert.equal(sets.rows[0]!.n, "0", "the evidence set went with its message");
      const items = await client.query<{ n: string }>(
        `select count(*)::text as n from heby_answer_evidence_item where evidence_set_id = $1`,
        [setId],
      );
      assert.equal(items.rows[0]!.n, "0", "and so did its items — no orphan survives");
    }

    /* ── 11. NO GOVERNANCE, NO AUDIT, NO MEMORY WAS WRITTEN ───────────────── */
    {
      const { rows } = await client.query<Record<string, string>>(
        `select (select count(*) from decision_records)::text as d,
                (select count(*) from governance_sessions)::text as g,
                (select count(*) from audit_log)::text as a,
                (select count(*) from memories)::text as m,
                (select count(*) from working_memories)::text as w,
                (select count(*) from learning_sessions)::text as l`,
      );
      assert.equal(rows[0]!.d, "0", "recording evidence created no Governance decision");
      assert.equal(rows[0]!.g, "0", "and no Governance session");
      assert.equal(rows[0]!.a, "0", "and wrote no audit row — storing a record is not an event");
      assert.equal(rows[0]!.m, "0", "and promoted nothing into Memory");
      assert.equal(rows[0]!.w, "0", "or working memory");
      assert.equal(rows[0]!.l, "0", "and started no learning session");
    }

    /* ── 12. NO SCORE, CONFIDENCE, TRUST OR FULL STATEMENT IS STORED ──────── */
    {
      const columns = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_name in ('heby_answer_evidence_set','heby_answer_evidence_item')`,
      );
      const names = columns.rows.map((r) => r.column_name);
      for (const forbidden of [
        "score",
        "lexical",
        "trigram",
        "combined",
        "rank",
        "weight",
        "confidence",
        "trust",
        "certainty",
        "reasoning",
        "statement",
      ]) {
        assert.ok(
          !names.some((name) => name.includes(forbidden)),
          `no evidence column may carry "${forbidden}"`,
        );
      }

      /*
       * The excerpt is BOUNDED presentation, not the Knowledge statement. Storing the statement
       * would make this table a second Knowledge content store, which is the one thing the whole
       * design refuses.
       */
      const stored = await client.query<{ excerpt: string; len: number }>(
        `select excerpt, length(excerpt) as len from heby_answer_evidence_item limit 1`,
      );
      assert.ok(stored.rows[0]!.len <= 240, "the excerpt respects the KR4 evidence bound");
    }

    /* ── 13. NO EXTENSION, NO SEARCH STRUCTURE ───────────────────────────── */
    {
      const { rows } = await client.query<{ extname: string }>(`select extname from pg_extension`);
      const names = rows.map((r) => r.extname).sort();
      assert.deepEqual(names, ["plpgsql"], "KR5 installs no extension — no pg_trgm, unaccent or vector");

      const indexes = await client.query<{ indexdef: string }>(
        `select indexdef from pg_indexes where tablename like 'heby_answer_evidence%'`,
      );
      for (const def of indexes.rows.map((r) => r.indexdef)) {
        assert.ok(!/gin|gist|tsvector|vector/i.test(def), `no search index: ${def}`);
      }
    }

    console.log("PASS kr5 historical answer evidence against PostgreSQL");
  } finally {
    await client?.end();
    await handle?.dispose();
    await harness.dropDatabase();
  }
}

void main();
