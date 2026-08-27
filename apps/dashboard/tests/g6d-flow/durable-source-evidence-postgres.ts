/*
 * G6D — durable answer-source evidence, against real PostgreSQL.
 *
 * THE INVARIANT UNDER TEST:
 *
 *   HISTORICAL ANSWER CITATION  !=  CURRENT SOURCE TRUTH
 *
 * G6C connected Governance and made an authoritative source reachable. What an answer CITED must
 * survive a reload with the standing it asserted then — not re-read from Governance today, which
 * would let a delegation granted since appear inside an answer that never saw it.
 *
 * Governance remains the source of truth throughout. These rows say only "answer X cited record Y,
 * and Y was authoritative when it did". Nothing here is read to decide what is true.
 *
 * Disposable database, dropped by its own ownership handle. Canonical is never opened. No LLM.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import {
  fromStoredSourceEvidence,
  toStoredSourceEvidence,
} from "../../src/features/heby-conversation/answer-evidence";
import { readGovernanceGroundingSource } from "../../src/features/governance-grounding/heby-governance-source.server";
import { loadHebyConversation } from "../../src/features/heby-answer/load-conversation.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const NOW = new Date("2026-08-19T12:00:00.000Z");

/** Real record ids, as the owning authorities would supply them. */
const DECISION = randomUUID();
const SESSION = randomUUID();
const ROLE = randomUUID();

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

/**
 * The owners' reads, injected. The RESOLUTION is still produced by the released G6C projection —
 * this substitutes only what Governance itself would have returned, so the shape under test is the
 * real one rather than a hand-built stand-in.
 */
const governanceDeps = (holders: number) =>
  ({
    readRoster: async () => ({
      status: "read" as const,
      roster: {
        active: [
          { kind: "bootstrap" as const, decisionId: DECISION, since: NOW.toISOString() },
          ...Array.from({ length: holders - 1 }, () => ({
            kind: "delegation" as const,
            decisionId: randomUUID(),
            since: NOW.toISOString(),
          })),
        ],
        viewerIsAuthority: true,
        viewerIsBootstrapAuthority: true,
      },
    }),
    readBootstrap: async () => ({
      status: "read" as const,
      authority: {
        bootstrap: {
          decisionId: DECISION,
          sessionId: SESSION,
          decidedAt: NOW.toISOString(),
          decisionType: "certify",
          subjectType: "tenant",
          outcome: "authority-established",
          actorType: "human",
          bootstrap: true,
        },
      },
    }),
    readRoleBaseline: async () => ({
      status: "read" as const,
      viewerIsGovernanceAuthority: true,
      memberRoleId: ROLE,
    }),
  }) as never;

/** A derived (non-authoritative) source, exactly as Operations and prepared work declare themselves. */
const DERIVED_RESOLUTION = {
  sourceClass: "work-artifacts",
  state: "resolved",
  authoritative: false,
  items: [{ recordRef: `work-artifact/${randomUUID()}@1`, label: "Draft note", detail: "revision 1" }],
} as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("g6devidence");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;

  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();

    const repo = createDurableConversationRepository(handle.db);
    const ctxA = tenantContext(TENANT_A);
    const ctxB = tenantContext(TENANT_B);
    const scopeA = { tenantId: TENANT_A, actorId: ctxA.userId };
    const scopeB = { tenantId: TENANT_B, actorId: ctxB.userId };

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

    /* ── 1. THE MIGRATION LANDED, AND LANDED ADDITIVELY ──────────────────── */
    {
      const { rows } = await client.query<{ n: string }>(
        `select count(*)::text n from information_schema.tables
          where table_schema='public' and table_name='heby_answer_source_evidence'`,
      );
      assert.equal(rows[0]!.n, "1", "the generic citation table exists");

      /* KR5's tables are untouched — the same nine Knowledge NOT NULLs still stand. */
      const { rows: kr5 } = await client.query<{ n: string }>(
        `select count(*)::text n from information_schema.columns
          where table_name='heby_answer_evidence_item' and is_nullable='NO'
            and column_name in ('fact_id','domain_key','fact_key','scope','title','ratified',
                                'freshness','knowledge_version','fact_version')`,
      );
      assert.equal(kr5[0]!.n, "9", "KR5's Knowledge columns were neither dropped nor relaxed");
    }

    /* ── 2. A REAL GOVERNANCE RESOLUTION, PERSISTED WITH THE ANSWER ──────── */
    const dayOne = await readGovernanceGroundingSource(ctxA as never, governanceDeps(1));
    assert.equal(dayOne.state, "resolved");
    assert.equal(dayOne.authoritative, true, "decision_records IS the record");
    assert.equal(dayOne.items.length, 3, "authority, genesis session, role baseline");
    const dayOneDetail = dayOne.items[0]!.detail;
    assert.match(dayOneDetail, /1 active holder/, "the answer saw exactly one holder");

    const rows = toStoredSourceEvidence([dayOne, DERIVED_RESOLUTION as never]);
    assert.equal(rows.length, 4, "three Governance citations plus one derived");
    assert.deepEqual(
      rows.map((r) => r.ordinal),
      [0, 1, 2, 3],
      "ordinal runs across the whole answer, preserving the order the reader met them in",
    );

    const persisted = await repo.persistExchange(scopeA, {
      subject: "who governs here",
      userContent: "who governs here",
      assistant: { role: "assistant", content: "Read from authoritative organizational records:", origin: "deterministic" },
      sourceEvidence: rows,
    });

    {
      const { rows: stored } = await client.query<{ n: string }>(
        `select count(*)::text n from heby_answer_source_evidence where message_id=$1`,
        [persisted.assistantMessageId],
      );
      assert.equal(stored[0]!.n, "4", "every citation is durable");
    }

    /* ── 3. GOVERNANCE MOVES ON. THE ANSWER DOES NOT. ────────────────────── */
    {
      /*
       * A second authority is delegated after the answer. Re-reading Governance now returns a
       * different sentence — which is exactly what replay must NOT show.
       */
      const dayTwo = await readGovernanceGroundingSource(ctxA as never, governanceDeps(2));
      assert.match(dayTwo.items[0]!.detail, /2 active holders/, "Governance really did change");
      assert.notEqual(dayTwo.items[0]!.detail, dayOneDetail, "the two readings genuinely differ");

      const loaded = await loadHebyConversation(
        { conversationId: persisted.conversationId },
        { resolveTenant: async () => ctxA, getConversationRepo: () => repo },
      );
      assert.equal(loaded.status, "loaded");
      if (loaded.status !== "loaded") throw new Error("unreachable");

      const assistant = loaded.view.messages.find((m) => m.role === "assistant")!;
      const replayed = assistant.sourceEvidence;
      assert.ok(replayed, "the answer replays the records it cited");

      const governance = replayed!.find((g) => g.sourceClass === "governance")!;
      assert.ok(governance, "the Governance citations survived the reload");
      assert.equal(governance.authoritative, true, "and kept the standing they asserted");
      assert.deepEqual(
        governance.items.map((i) => i.recordRef),
        [DECISION, SESSION, ROLE],
        "keyed to the exact records, in the order the answer showed them",
      );
      assert.equal(
        governance.items[0]!.detail,
        dayOneDetail,
        "REPLAY SHOWS WHAT THE ANSWER SAW, not what Governance says today",
      );
      assert.doesNotMatch(
        governance.items[0]!.detail,
        /2 active holders/,
        "the delegation granted after the answer must not appear inside it",
      );
    }

    /* ── 4. A MIXED ANSWER STAYS MIXED ───────────────────────────────────── */
    {
      const loaded = await loadHebyConversation(
        { conversationId: persisted.conversationId },
        { resolveTenant: async () => ctxA, getConversationRepo: () => repo },
      );
      if (loaded.status !== "loaded") throw new Error("unreachable");
      const replayed = loaded.view.messages.find((m) => m.role === "assistant")!.sourceEvidence!;

      const governance = replayed.find((g) => g.sourceClass === "governance")!;
      const derived = replayed.find((g) => g.sourceClass === "work-artifacts")!;
      assert.equal(governance.authoritative, true, "the authoritative half stays authoritative");
      assert.equal(derived.authoritative, false, "the derived half stays derived");
      assert.equal(
        new Set(replayed.map((g) => g.authoritative)).size,
        2,
        "the MIXTURE survives — neither half is rounded to the other",
      );
    }

    /* ── 5. KNOWLEDGE IS REFUSED HERE, BY THE DATABASE ───────────────────── */
    {
      /* The write projection excludes it… */
      const knowledgeRows = toStoredSourceEvidence([
        {
          sourceClass: "knowledge",
          state: "resolved",
          authoritative: true,
          items: [{ recordRef: randomUUID(), label: "a fact", detail: "detail" }],
        },
      ]);
      assert.deepEqual(knowledgeRows, [], "the projection never routes Knowledge here");

      /* …and the CHECK refuses it even for a hand-crafted insert that bypasses the projection. */
      let refused = false;
      try {
        await client.query(
          `insert into heby_answer_source_evidence
             (tenant_id, message_id, source_class, record_ref, label, detail, authoritative, ordinal)
           values ($1,$2,'knowledge',$3,'l','d',true,0)`,
          [TENANT_A, persisted.assistantMessageId, randomUUID()],
        );
      } catch {
        refused = true;
      }
      assert.ok(refused, "Knowledge has its own evidence authority and may not be recorded twice");
    }

    /* ── 6. TENANT ISOLATION — CHECKED, AND STRUCTURAL ───────────────────── */
    {
      /* The read predicate refuses another tenant's citations. */
      const foreign = await repo.listAnswerSourceEvidence(scopeB, [persisted.assistantMessageId]);
      assert.deepEqual(foreign, [], "tenant B cannot read tenant A's citations");

      /* And the loader refuses the conversation itself. */
      const loadedByB = await loadHebyConversation(
        { conversationId: persisted.conversationId },
        { resolveTenant: async () => ctxB, getConversationRepo: () => repo },
      );
      assert.equal(loadedByB.status, "not-found", "a foreign conversation id grants nothing");

      /* The composite FK makes a cross-tenant row unconstructible even by hand. */
      let fkRefused = false;
      try {
        await client.query(
          `insert into heby_answer_source_evidence
             (tenant_id, message_id, source_class, record_ref, label, detail, authoritative, ordinal)
           values ($1,$2,'governance',$3,'l','d',true,9)`,
          [TENANT_B, persisted.assistantMessageId, randomUUID()],
        );
      } catch {
        fkRefused = true;
      }
      assert.ok(fkRefused, "tenant B's citation cannot hang off tenant A's message");
    }

    /* ── 7. NO CROSS-CONVERSATION LEAK ───────────────────────────────────── */
    {
      const second = await repo.persistExchange(scopeA, {
        subject: "second thread",
        userContent: "second thread",
        assistant: { role: "assistant", content: "nothing cited here.", origin: "deterministic" },
      });
      assert.notEqual(second.conversationId, persisted.conversationId);

      const loaded = await loadHebyConversation(
        { conversationId: second.conversationId },
        { resolveTenant: async () => ctxA, getConversationRepo: () => repo },
      );
      if (loaded.status !== "loaded") throw new Error("unreachable");
      for (const message of loaded.view.messages) {
        assert.equal(
          message.sourceEvidence,
          undefined,
          "a conversation that cited nothing replays nothing — never another thread's citations",
        );
      }
    }

    /* ── 8. ONE ANSWER CITES A RECORD ONCE ───────────────────────────────── */
    {
      let duplicateRefused = false;
      try {
        await client.query(
          `insert into heby_answer_source_evidence
             (tenant_id, message_id, source_class, record_ref, label, detail, authoritative, ordinal)
           values ($1,$2,'governance',$3,'l','d',true,99)`,
          [TENANT_A, persisted.assistantMessageId, DECISION],
        );
      } catch {
        duplicateRefused = true;
      }
      assert.ok(duplicateRefused, "the unique index is the idempotency key, not a hopeful comment");
    }

    /* ── 9. THE ROUND TRIP IS LOSSLESS ───────────────────────────────────── */
    {
      const stored = await repo.listAnswerSourceEvidence(scopeA, [persisted.assistantMessageId]);
      const replayed = fromStoredSourceEvidence(stored);
      const flattened = replayed.flatMap((g) =>
        g.items.map((i) => ({
          sourceClass: g.sourceClass,
          authoritative: g.authoritative,
          recordRef: i.recordRef,
          label: i.label,
          detail: i.detail,
        })),
      );
      assert.deepEqual(
        flattened,
        rows.map((r) => ({
          sourceClass: r.sourceClass,
          authoritative: r.authoritative,
          recordRef: r.recordRef,
          label: r.label,
          detail: r.detail,
        })),
        "what went in is exactly what comes out — the projections cannot drift apart",
      );
    }

    /* ── 10. EVERY PROTECTED VALUE IS SERVER-DERIVED ─────────────────────── */
    {
      /*
       * A caller cannot choose the tenant, the standing, or the record a citation names. None of
       * the three is representable in the input the writer accepts — so the attack is expressed by
       * SMUGGLING the fields onto the input object and proving the stored row ignores them.
       */
      const smuggled = await repo.persistExchange(scopeA, {
        subject: "smuggle",
        userContent: "smuggle",
        assistant: { role: "assistant", content: "…", origin: "deterministic" },
        sourceEvidence: [
          {
            sourceClass: "governance",
            recordRef: DECISION,
            label: "Governance authority",
            detail: "established",
            authoritative: false,
            ordinal: 0,
            /* None of these exist in AppendSourceEvidenceInput. They must reach no column. */
            tenantId: TENANT_B,
            messageId: randomUUID(),
            recordedAt: new Date("1999-01-01T00:00:00.000Z"),
          } as never,
        ],
      });

      const { rows: row } = await client.query<{
        tenant_id: string;
        message_id: string;
        authoritative: boolean;
        record_ref: string;
        recorded_at: string;
      }>(
        `select tenant_id, message_id, authoritative, record_ref, recorded_at
           from heby_answer_source_evidence where message_id=$1`,
        [smuggled.assistantMessageId],
      );
      assert.equal(row.length, 1);
      assert.equal(row[0]!.tenant_id, TENANT_A, "the tenant is the server-resolved scope, never the input's");
      assert.notEqual(row[0]!.tenant_id, TENANT_B, "a smuggled tenant id reaches no column");
      assert.equal(
        row[0]!.message_id,
        smuggled.assistantMessageId,
        "the message is the one this transaction created, never the input's",
      );
      assert.ok(
        new Date(row[0]!.recorded_at).getUTCFullYear() > 2000,
        "recorded_at is the database clock, never a supplied timestamp",
      );

      /*
       * `authoritative` DOES come from the input here — because the only production caller builds
       * that input from the owning resolution and nothing else. That is asserted at its source: the
       * write projection reads `resolution.authoritative`, so a class cannot declare one standing
       * and store another, and no client-reachable shape carries the field at all.
       */
      const projected = toStoredSourceEvidence([
        { sourceClass: "governance", state: "resolved", authoritative: true, items: [
          { recordRef: DECISION, label: "l", detail: "d" },
        ] },
      ]);
      assert.equal(projected[0]!.authoritative, true, "standing is taken from the owning resolution");
      const projectedDerived = toStoredSourceEvidence([
        { sourceClass: "work-artifacts", state: "resolved", authoritative: false, items: [
          { recordRef: "w/1", label: "l", detail: "d" },
        ] },
      ]);
      assert.equal(projectedDerived[0]!.authoritative, false, "and a derived source stays derived");

      /* And a record_ref is whatever the OWNING AUTHORITY returned — the projection invents none. */
      assert.equal(projected[0]!.recordRef, DECISION, "the reference comes from the authority's own item");
    }

    console.log("PASS g6d durable source evidence (postgres)");
  } finally {
    client?.end().catch(() => {});
    handle?.dispose?.();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
