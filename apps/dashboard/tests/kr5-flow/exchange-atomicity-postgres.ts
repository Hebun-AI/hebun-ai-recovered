/*
 * KR5 — the Heby exchange is ONE transaction, proven by making it fail.
 *
 * ALL COMMIT OR NONE COMMIT:
 *
 *     user message  +  assistant message  +  evidence set  +  evidence items
 *
 * Before KR5 this was a sequence of independent awaits, and a failure part-way through committed
 * a question with no answer while REPORTING `durable: false` — the honest disposition and the
 * durable state disagreed. That defect predates KR5 and is closed here by Director decision,
 * because KR5 had to change this exact boundary and leaving a known partial write behind would
 * have preserved a broken transaction contract.
 *
 * FAILURES ARE REAL, NOT MOCKED. Each case below is a genuine PostgreSQL error — a foreign-key
 * violation, a unique violation, or a trigger raised inside the transaction — so what is proven is
 * the database's own rollback, not a stub's approximation of one. A stubbed writer can only show
 * that the code MEANT to be atomic.
 *
 * Disposable database, dropped by its own ownership handle. Canonical is never opened.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createDurableConversationRepository,
  type AppendEvidenceItemInput,
  type DurableConversationRepository,
} from "../../src/features/heby-conversation/durable-conversation-repository.server";

const TENANT = randomUUID();
const ABSENT_TENANT = randomUUID();

function item(factKey: string, ordinal: number): AppendEvidenceItemInput {
  return {
    factId: randomUUID(),
    knowledgeNodeId: randomUUID(),
    domainKey: "izin",
    factKey,
    scope: "company-wide",
    title: `Kayıt ${factKey}`,
    excerpt: "Bir cümle.",
    excerptTruncated: false,
    authorityClass: "authoritative",
    lifecycleStatus: "ratified",
    ratified: true,
    ratifiedAt: null,
    freshness: "current",
    knowledgeVersion: 1,
    factVersion: 1,
    effectiveFrom: null,
    effectiveUntil: null,
    nextReviewAt: null,
    origin: null,
    authoredThrough: null,
    textOriginUnverified: null,
    sourceTitle: null,
    sourceType: null,
    ingestedByActorType: null,
    ingestedAt: null,
    chunkIndex: null,
    chunkCount: null,
    matchedTerms: ["izin"],
    ordinal,
  };
}

/**
 * Assert a rejection whose REAL cause matches — drizzle wraps driver errors, so `error.message` is
 * "Failed query: insert into …" and the PostgreSQL sentence lives on `error.cause`. Matching only
 * the outer message would pass on any failed query at all, including the wrong one.
 */
async function rejectsBecause(work: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(work, (error: unknown) => {
    const chain: string[] = [];
    for (let current = error; current instanceof Error; current = current.cause) {
      chain.push(current.message);
    }
    assert.ok(
      chain.some((message) => pattern.test(message)),
      `expected ${pattern} in the error chain, got:\n${chain.join("\n---\n")}`,
    );
    return true;
  });
}

function turn(overrides: Partial<Parameters<DurableConversationRepository["persistExchange"]>[1]> = {}) {
  return {
    subject: "izin",
    userContent: "yıllık izin kaç gün",
    assistant: { role: "assistant" as const, content: "14 gün.", origin: "deterministic" as const },
    evidence: {
      status: "matched",
      truncated: false,
      diversityPruned: 0,
      excludedCount: 0,
      degradedReason: null,
      multipleRelevantSources: false,
      unavailableReason: null,
      items: [item("izin-hakki", 0)],
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("kr5atomic");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;

  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    const repo = createDurableConversationRepository(handle.db);
    const scope = { tenantId: TENANT, actorId: randomUUID() };

    await client.query(`insert into companies (id, name, slug) values ($1,'Tenant A','tenant-a')`, [
      TENANT,
    ]);

    /** Everything the turn could have written, counted in one shot. */
    async function counts(): Promise<Record<string, number>> {
      const { rows } = await client!.query<Record<string, string>>(
        `select (select count(*) from conversations)::text as conversations,
                (select count(*) from messages)::text as messages,
                (select count(*) from heby_answer_evidence_set)::text as sets,
                (select count(*) from heby_answer_evidence_item)::text as items`,
      );
      return Object.fromEntries(
        Object.entries(rows[0]!).map(([key, value]) => [key, Number(value)]),
      );
    }

    const empty = { conversations: 0, messages: 0, sets: 0, items: 0 };
    assert.deepEqual(await counts(), empty, "the database starts clean");

    /* ── A. CONVERSATION INSERT FAILS ─────────────────────────────────────── */
    {
      /* A tenant with no `companies` row violates the conversation's tenant foreign key. */
      await rejectsBecause(
        () => repo.persistExchange({ tenantId: ABSENT_TENANT }, turn()),
        /violates foreign key constraint/i,
      );
      assert.deepEqual(await counts(), empty, "A: nothing at all was written");
    }

    /* ── B. USER MESSAGE INSERT FAILS ─────────────────────────────────────── */
    {
      /*
       * A trigger is the only way to fail a specific statement in the middle of a real transaction
       * without weakening the schema. It raises inside the same transaction the repository opened,
       * so what rolls back is PostgreSQL's own work — including the conversation inserted moments
       * earlier in the same transaction.
       */
      await client.query(`
        create function kr5_fail_user_message() returns trigger as $$
        begin
          if new.role = 'user' then raise exception 'simulated user message failure'; end if;
          return new;
        end; $$ language plpgsql;
        create trigger kr5_fail_user before insert on messages
          for each row execute function kr5_fail_user_message();
      `);
      await rejectsBecause(() => repo.persistExchange(scope, turn()), /simulated user message failure/i);
      assert.deepEqual(
        await counts(),
        empty,
        "B: the user message failed, so no conversation survives either",
      );
      await client.query(`drop trigger kr5_fail_user on messages; drop function kr5_fail_user_message();`);
    }

    /* ── C. ASSISTANT MESSAGE INSERT FAILS ────────────────────────────────── */
    {
      await client.query(`
        create function kr5_fail_assistant_message() returns trigger as $$
        begin
          if new.role = 'assistant' then raise exception 'simulated assistant failure'; end if;
          return new;
        end; $$ language plpgsql;
        create trigger kr5_fail_assistant before insert on messages
          for each row execute function kr5_fail_assistant_message();
      `);
      await rejectsBecause(() => repo.persistExchange(scope, turn()), /simulated assistant failure/i);
      /*
       * THE ORPHAN THIS PHASE CLOSED. The user message was inserted successfully moments before the
       * assistant failed. Under the old sequential writes it would still be sitting there — a
       * question with no answer — while the caller was told the turn was not durable.
       */
      assert.deepEqual(
        await counts(),
        empty,
        "C: NO ORPHAN USER MESSAGE — the pre-existing partial-write defect is closed",
      );
      await client.query(
        `drop trigger kr5_fail_assistant on messages; drop function kr5_fail_assistant_message();`,
      );
    }

    /* ── D. EVIDENCE SET INSERT FAILS ─────────────────────────────────────── */
    {
      await client.query(`
        create function kr5_fail_evidence_set() returns trigger as $$
        begin raise exception 'simulated evidence set failure'; end; $$ language plpgsql;
        create trigger kr5_fail_set before insert on heby_answer_evidence_set
          for each row execute function kr5_fail_evidence_set();
      `);
      await rejectsBecause(() => repo.persistExchange(scope, turn()), /simulated evidence set failure/i);
      assert.deepEqual(
        await counts(),
        empty,
        "D: a durable answer must never survive without the evidence recorded with it",
      );
      await client.query(
        `drop trigger kr5_fail_set on heby_answer_evidence_set; drop function kr5_fail_evidence_set();`,
      );
    }

    /* ── E. EVIDENCE ITEM INSERT FAILS ────────────────────────────────────── */
    {
      /*
       * A REAL constraint, not a trigger: two items naming the same fact violate
       * UNIQUE(evidence_set_id, domain_key, fact_key). This is the strongest case in the file —
       * the failure lands at the very LAST statement, after the conversation, both messages and
       * the set have all been inserted, and every one of them must still disappear.
       */
      const duplicated = turn({
        evidence: {
          status: "matched",
          truncated: false,
          diversityPruned: 0,
          excludedCount: 0,
          degradedReason: null,
          multipleRelevantSources: false,
          unavailableReason: null,
          items: [item("izin-hakki", 0), item("izin-hakki", 1)],
        },
      });
      await rejectsBecause(() => repo.persistExchange(scope, duplicated), /duplicate key value violates unique constraint/i);
      assert.deepEqual(
        await counts(),
        empty,
        "E: a failure at the last statement rolls back the first — no partial evidence, no messages",
      );
    }

    /* ── F. THE SUCCESS PATH STILL COMMITS EVERYTHING ─────────────────────── */
    {
      const ok = await repo.persistExchange(scope, turn());
      assert.deepEqual(
        await counts(),
        { conversations: 1, messages: 2, sets: 1, items: 1 },
        "F: the whole turn commits together",
      );
      const stored = await repo.listAnswerEvidence(scope, [ok.assistantMessageId]);
      assert.equal(stored.length, 1);
      assert.equal(stored[0]!.items.length, 1);
    }

    console.log("PASS kr5 exchange atomicity against PostgreSQL");
  } finally {
    await client?.end();
    await handle?.dispose();
    await harness.dropDatabase();
  }
}

void main();
