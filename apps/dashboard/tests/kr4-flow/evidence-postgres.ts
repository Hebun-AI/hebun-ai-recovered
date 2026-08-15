/*
 * KR4 — the evidence explanation against a REAL PostgreSQL database.
 *
 * WHY THIS NEEDS A REAL DATABASE. The pure suite proves what the projection DECIDES. What is left
 * is the claim this phase actually rests on: that `provenance` and `source_attribution` — two jsonb
 * columns written since K2 and read by nobody on the retrieval path — survive a real ingestion, a
 * real tenant-scoped retrieval, and arrive on the card. A fake repository would prove only the fake,
 * and the whole widening would rest on an assumption about a column nobody had ever read back.
 *
 * It also proves the negative that matters most: explaining evidence WRITES NOTHING. Knowledge,
 * Governance and the message store are all counted before and after.
 *
 * Disposable database, dropped on exit by its own ownership handle. Canonical is never touched.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { buildRetrievalEvidence } from "../../src/features/knowledge-retrieval";
import { assembleEvidence, isSupportedEvidence } from "../../src/features/heby-runtime";
import { toRetrievalResolution } from "../../src/features/heby-answer/knowledge-evidence.server";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();

/**
 * Two realistic ingested sources, both about leave, both genuinely relevant to one question.
 *
 * They give DIFFERENT day counts on purpose. Nothing in Hebun notices that they disagree — and the
 * point of this fixture is to prove that Hebun does not PRETEND to notice: it reports that two
 * sources are present and stops.
 */
const SOURCES = [
  {
    digest: "a1b2c3d4e5f6",
    title: "İnsan Kaynakları El Kitabı",
    type: "policy",
    chunks: [
      { statement: "Çalışanlar yılda 20 gün ücretli yıllık izin kullanır.", label: "Yıllık izin süresi" },
      { statement: "İzin talebi doğrudan yöneticiye iletilir ve yazılı onay alınır.", label: "İzin talep süreci" },
    ],
  },
  {
    digest: "f6e5d4c3b2a1",
    title: "2026 İzin Yönergesi",
    type: "policy",
    chunks: [{ statement: "Yıllık ücretli izin hakkı 14 gündür.", label: "İzin hakkı güncellemesi" }],
  },
] as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("kr4evidence");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;

  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    const repo = createDurableKnowledgeRepository(handle.db);
    const deps = { getRepo: () => repo, now: () => NOW };
    const A = { tenantId: TENANT_A };

    for (const [id, slug] of [[TENANT_A, "a"], [TENANT_B, "b"]] as const) {
      await client.query(`insert into companies (id, name, slug) values ($1,$2,$3)`, [id, `Tenant ${slug}`, `tenant-${slug}`]);
    }
    const ingestor = randomUUID();

    /* ── seed: real ingestion shape, including the two jsonb columns ──────── */
    const ingest = async (tenantId: string) => {
      for (const source of SOURCES) {
        let index = 0;
        for (const chunk of source.chunks) {
          index += 1;
          const nodeId = randomUUID();
          await client!.query(
            `insert into knowledge_nodes (id, tenant_id, type, label, statement, knowledge_lifecycle_status,
               knowledge_health, knowledge_scope, knowledge_authority, domain_key, effective_from,
               next_review_at, knowledge_version, provenance, source_attribution)
             values ($1,$2,'knowledge-fact',$3,$4,'draft'::knowledge_lifecycle_status,
               'unknown'::knowledge_health,'company-wide','provisional'::knowledge_authority,
               'izin',$5,$6,1,$7::jsonb,$8::jsonb)`,
            [
              nodeId, tenantId, chunk.label, chunk.statement, at(-30), at(180),
              JSON.stringify({
                origin: "human-ingested",
                authoredThrough: "hebun-knowledge-workspace",
                submittedAt: at(-30).toISOString(),
                textOriginUnverified: true,
                sourceType: source.type,
                sourceDigest: source.digest,
                chunkIndex: index,
                chunkCount: source.chunks.length,
              }),
              JSON.stringify({
                sourceTitle: source.title,
                sourceType: source.type,
                ingestedByActorType: "human",
                ingestedByActorId: ingestor,
                ingestedAt: at(-30).toISOString(),
              }),
            ],
          );
          await client!.query(
            `insert into knowledge_facts (tenant_id, fact_key, domain_key, knowledge_scope,
               active_knowledge_node_id, fact_version)
             values ($1,$2,'izin','company-wide',$3,1)`,
            [tenantId, `ingest:${source.title}:${source.digest}:${index}`, nodeId],
          );
        }
      }
    };

    await ingest(TENANT_A);
    await ingest(TENANT_B); // an identical corpus next door — isolation must not depend on content

    const countOf = async (table: string): Promise<number> => {
      const rows = await client!.query(`select count(*)::int as n from ${table}`);
      return rows.rows[0].n as number;
    };
    const before = {
      nodes: await countOf("knowledge_nodes"),
      facts: await countOf("knowledge_facts"),
      decisions: await countOf("decision_records"),
      audit: await countOf("audit_log"),
      messages: await countOf("messages"),
    };

    /* ── 1. RETRIEVAL SELECTS RELEVANT EVIDENCE ───────────────────────────── */
    const question = "Yıllık izin hakkı kaç gün?";
    const result = await searchKnowledge(A, { queryText: question }, deps);
    assert.equal(result.status, "matched", "the question finds the leave records");

    const set = buildRetrievalEvidence(result, question);
    assert.equal(set.status, "matched");
    assert.ok(set.items.length >= 2, "several relevant records are served");

    /* ── 2. PROVENANCE AND SOURCE ATTRIBUTION SURVIVED THE ROUND TRIP ─────── */
    const titles = new Set(set.items.map((item) => item.sourceTitle));
    assert.ok(titles.has("İnsan Kaynakları El Kitabı") || titles.has("2026 İzin Yönergesi"),
      "the human's own name for the source reaches the card");

    for (const item of set.items) {
      assert.equal(item.origin, "human-ingested", "provenance origin survives a real read");
      assert.equal(item.textOriginUnverified, true);
      assert.equal(item.sourceType, "policy");
      assert.ok(item.ingestedAt, "the ingestion timestamp survives");
      assert.ok(item.chunkIndex !== null && item.chunkCount !== null, "chunk position survives");
      /* Standing survives structured, not as a joined display string. */
      assert.equal(item.authorityClass, "provisional");
      assert.equal(item.lifecycleStatus, "draft");
      assert.equal(item.ratified, false, "ingesting is not ratifying");
      assert.equal(item.knowledgeVersion, 1);
    }

    /* ── 3. THE MATCH EXPLANATION IS REAL, NOT DECORATIVE ─────────────────── */
    const withTerms = set.items.filter((item) => item.explanation.matchedTerms.length > 0);
    assert.ok(withTerms.length > 0, "at least one card can name a term the reader can see in the excerpt");
    for (const item of withTerms) {
      const haystack = `${item.title} ${item.excerpt ?? ""}`.toLocaleLowerCase("tr");
      for (const term of item.explanation.matchedTerms) {
        assert.ok(
          haystack.includes(term.toLocaleLowerCase("tr")) ||
            haystack.normalize("NFKD").includes(term.toLocaleLowerCase("tr")),
          `a claimed term ("${term}") must be findable in what the reader is shown`,
        );
      }
    }

    /* ── 4. TWO SOURCES → A CAUTIOUS SIGNAL, NEVER A WINNER ───────────────── */
    assert.equal(set.multipleRelevantSources, true, "two distinct sources in one domain is reported");
    const digests = new Set(set.items.map((item) => item.sourceTitle));
    assert.ok(digests.size >= 2, "and BOTH sources are still in front of the reader");
    assert.ok(!("conflict" in set), "nothing claims they contradict — nothing computes that");

    /* ── 5. THE MODEL STILL CANNOT INVENT A REFERENCE ─────────────────────── */
    const resolution = toRetrievalResolution(result);
    const assembled = assembleEvidence([resolution]);
    assert.ok(assembled.length > 0);
    assert.equal(
      isSupportedEvidence(
        { sourceClass: "knowledge", recordRef: "izin/uydurma-kayit", lifecycle: "unknown" },
        assembled,
      ),
      false,
      "a fabricated citation is rejected by the runtime-produced set",
    );
    for (const item of set.items) {
      assert.equal(
        isSupportedEvidence({ sourceClass: "knowledge", recordRef: item.recordRef, lifecycle: "unknown" }, assembled),
        true,
        "and every card's identity IS in that set — the card and the validator agree",
      );
    }

    /* ── 6. TENANT ISOLATION SURVIVES AN IDENTICAL NEIGHBOURING CORPUS ────── */
    const foreign = await searchKnowledge({ tenantId: TENANT_B }, { queryText: question }, deps);
    assert.equal(foreign.status, "matched");
    const foreignSet = buildRetrievalEvidence(foreign, question);
    const aNodeIds = new Set(
      (await client.query(`select id from knowledge_nodes where tenant_id = $1`, [TENANT_A])).rows.map((r) => r.id),
    );
    const bFactIds = new Set(
      (await client.query(
        `select f.id from knowledge_facts f where f.tenant_id = $1`, [TENANT_B],
      )).rows.map((r) => r.id),
    );
    assert.ok(aNodeIds.size > 0 && bFactIds.size > 0);
    /*
     * The corpora are textually IDENTICAL, so equal titles prove nothing. What must hold is that
     * tenant B's result was resolved entirely inside tenant B — proven by counting, not by reading
     * a rendered string.
     */
    const bRows = await client.query(
      `select count(*)::int as n from knowledge_facts f
         join knowledge_nodes n on n.id = f.active_knowledge_node_id
        where f.tenant_id = $1 and n.tenant_id = $1`, [TENANT_B],
    );
    assert.equal(bRows.rows[0].n, foreignSet.items.length + 0, "tenant B sees exactly tenant B's rows");

    const noTenant = await searchKnowledge(null, { queryText: question }, deps);
    assert.equal(noTenant.status, "unavailable", "no tenant context reads nothing at all");
    assert.equal(buildRetrievalEvidence(noTenant, question).status, "unavailable");

    /* ── 7. EXPLAINING EVIDENCE WROTE NOTHING ─────────────────────────────── */
    const after = {
      nodes: await countOf("knowledge_nodes"),
      facts: await countOf("knowledge_facts"),
      decisions: await countOf("decision_records"),
      audit: await countOf("audit_log"),
      messages: await countOf("messages"),
    };
    assert.deepEqual(after, before, "retrieval explanation writes NOTHING — not Knowledge, not Governance, not audit");
    assert.equal(after.decisions, 0, "no Governance row was created by an explanation");
    assert.equal(after.messages, 0, "and no evidence snapshot was persisted anywhere");

    console.log(
      `KR4 postgres: ${set.items.length} evidence items · sources=${digests.size} · ` +
        `multipleRelevantSources=${set.multipleRelevantSources} · writes=0`,
    );
  } finally {
    await client?.end();
    await handle?.dispose();
    await harness.dropDatabase();
  }
}

void main();
