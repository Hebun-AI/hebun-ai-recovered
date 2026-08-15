/*
 * KR3 — retrieval against a REAL PostgreSQL database.
 *
 * WHY THIS NEEDS A REAL DATABASE. Everything retrieval DECIDES is pure and is proven without one
 * (see retrieval-contracts.ts). What is left is what PostgreSQL itself contributes: the `turkish`
 * text-search configuration, `websearch_to_tsquery`, `ts_rank_cd`, and the tenant-scoped join. A
 * hand-written fake of those would only prove the fake — and the Turkish defects this phase exists
 * to survive are defects IN PostgreSQL's configuration, invisible to any mock.
 *
 * WHAT THE ASSERTIONS ARE. Measured guarantees, not aspirations. The KR2 benchmark measured this
 * representation at 69.6% Recall@1 / 78.3% Recall@3 on a 172-fact corpus — good, and emphatically
 * not perfect. Where lexical retrieval is known to fail (genuine synonyms, and typos without
 * `pg_trgm`), this file asserts the FAILURE, so the limitation is recorded in the suite rather than
 * discovered by a user. A test that demanded 100% would be a test that had to be disabled.
 *
 * Disposable database, dropped on exit by its own ownership handle. Canonical is never touched.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { searchKnowledge, listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import type { RetrievalResult } from "../../src/features/knowledge-retrieval";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const EMPTY_TENANT = randomUUID();

type Standing =
  | "current"
  | "draft"
  | "contested"
  | "stale"
  | "unverified"
  | "expired"
  | "future"
  | "archived"
  | "retired"
  | "superseded";

interface Seed {
  readonly key: string;
  readonly domain: string;
  readonly title: string;
  readonly statement: string;
  readonly standing: Standing;
}

/*
 * A bounded subset of the KR2 benchmark corpus: enough Turkish to exercise every query class and
 * every eligibility standing, small enough that a failure names one record rather than a population.
 */
const CORPUS: readonly Seed[] = [
  { key: "iz-01", domain: "izin", standing: "current", title: "Yıllık izin talebi kime gönderilir", statement: "Yıllık izin talebi İnsan Kaynakları portalından açılır ve bağlı olunan departman yöneticisine gönderilir." },
  { key: "iz-02", domain: "izin", standing: "current", title: "İzin talep süresi", statement: "Yıllık izin talepleri kullanılacak tarihten en az 15 gün önce iletilir." },
  { key: "iz-03", domain: "izin", standing: "current", title: "Yıllık izin hakkı", statement: "1-5 yıl kıdemde 14 gün, 15 yıl üzeri kıdemde 26 gün yıllık ücretli izin hakkı doğar." },
  { key: "ia-01", domain: "iade", standing: "current", title: "Ürün iade süresi", statement: "Müşteri ürünü teslim aldığı tarihten itibaren 14 gün içinde iade edebilir." },
  { key: "ia-03", domain: "iade", standing: "current", title: "İade kargo ücretini kim öder", statement: "Ayıplı ürün iadelerinde kargo ücreti şirkete, cayma hakkı kullanılan iadelerde müşteriye aittir." },
  { key: "ka-06", domain: "kargo", standing: "current", title: "Gecikme tazmini", statement: "3 iş gününü aşan teslimat gecikmelerinde müşteriye kargo bedeli iade edilir." },
  { key: "gu-06", domain: "guvenlik", standing: "current", title: "Cihaz güvenliği", statement: "Şirket dizüstü bilgisayarlarında disk şifrelemesi açık olmalıdır." },
  { key: "gu-08", domain: "guvenlik", standing: "current", title: "Güvenlik olayı bildirimi", statement: "Şüpheli erişim, kayıp cihaz veya veri sızıntısı 1 saat içinde bilgi güvenliği ekibine bildirilir." },
  { key: "ha-01", domain: "harcama", standing: "current", title: "Harcama onay eşiği", statement: "5.000 TL'ye kadar olan harcamalar departman yöneticisi tarafından onaylanır." },

  /* Standings that must remain CANDIDATES — signal, never a gate. */
  { key: "de-01-drf", domain: "destek", standing: "draft", title: "İlk yanıt süresi önerisi", statement: "Müşteri taleplerine ilk yanıt süresinin iki saate çekilmesi önerilmektedir." },
  { key: "gu-01-con", domain: "guvenlik", standing: "contested", title: "Parola değişim aralığı", statement: "Parola değişim süresinin doksan günden yüz seksen güne çıkarılması tartışılmaktadır." },
  { key: "ha-09-stl", domain: "harcama", standing: "stale", title: "Konaklama limiti", statement: "Yurt içi konaklama gecelik iki bin lira ile sınırlıdır." },

  /* Standings that must be EXCLUDED — out of force is disqualification, not a penalty. */
  { key: "ka-04-exp", domain: "kargo", standing: "expired", title: "Ücretsiz kargo kampanyası", statement: "Kampanya süresince bin lira üzeri siparişlerde kargo ücretsizdir." },
  { key: "fi-01-fut", domain: "fiyatlandirma", standing: "future", title: "Çeyreklik fiyat güncellemesi", statement: "Ürün liste fiyatları çeyrek dönemlerde güncellenecektir." },
  { key: "sa-02-arc", domain: "satinalma", standing: "archived", title: "Eski satın alma yönetmeliği", statement: "Satın almalarda en az iki tedarikçiden teklif alınması yeterlidir." },
  { key: "es-04-ret", domain: "eskalasyon", standing: "retired", title: "Kaldırılan eskalasyon adımı", statement: "Kritik olaylarda önce çağrı merkezine bilgi verilir." },
  /* Not the active node of its fact — structurally unreachable, not filtered. */
  { key: "iz-03-v1", domain: "izin", standing: "superseded", title: "Yıllık izin hakkı (eski sürüm)", statement: "1-5 yıl kıdemde 12 gün yıllık ücretli izin hakkı doğar." },
];

/** One ingested source, four chunks, one digest — enough to make the diversity cap fire. */
const INGEST_DIGEST = "abcdef123456";
const INGEST: readonly Seed[] = [
  "Tedarik süreci ihtiyacın tanımlanmasıyla başlar ve tedarikçi seçimiyle sürer.",
  "Tedarikçi seçiminde fiyat, teslim süresi ve kalite karşılaştırılır.",
  "Tedarikçi teklifleri en az beş iş günü açık tutulur ve tedarikçi listesi güncellenir.",
  "Tedarikçi sözleşmeleri her yıl gözden geçirilir ve tedarikçi performansı raporlanır.",
].map((statement, index) => ({
  key: `ingest:tedarik-el-kitabi:${INGEST_DIGEST}:${index}`,
  domain: "satinalma",
  standing: "unverified" as const,
  title: `Tedarik El Kitabı (${index + 1}/4)`,
  statement,
}));

interface Columns {
  lifecycle: string | null; authority: string | null; health: string | null;
  from: Date | null; until: Date | null; review: Date | null; active: boolean;
}

function columnsFor(standing: Standing): Columns {
  const base: Columns = {
    lifecycle: "ratified", authority: "authoritative", health: "current",
    from: at(-365), until: null, review: at(180), active: true,
  };
  switch (standing) {
    case "current": return base;
    case "draft": return { ...base, lifecycle: "draft", authority: "provisional", health: "unknown", review: null };
    case "contested": return { ...base, lifecycle: "under-review", authority: "provisional", health: "contested", review: null };
    case "stale": return { ...base, health: "stale", review: at(-60) };
    case "unverified": return { ...base, lifecycle: "draft", authority: "provisional", health: "unknown", review: null };
    case "expired": return { ...base, until: at(-30) };
    case "future": return { ...base, from: at(120) };
    case "archived": return { ...base, lifecycle: "archived", health: "unknown", review: null };
    case "retired": return { ...base, lifecycle: "retired", health: "unknown", review: null };
    case "superseded": return { ...base, lifecycle: "superseded", health: "unknown", review: null, active: false };
  }
}

const keysOf = (result: RetrievalResult): readonly string[] =>
  result.status === "matched" ? result.candidates.map((c) => c.record.factKey) : [];

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("kr3retrieval");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;

  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    /* Seeding and counting use a plain driver; the repository under test uses the real Drizzle handle. */
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    const repo = createDurableKnowledgeRepository(handle.db);
    const deps = { getRepo: () => repo, now: () => NOW };
    const A = { tenantId: TENANT_A };

    /* ── seed ─────────────────────────────────────────────────────────────── */
    for (const [id, slug] of [[TENANT_A, "a"], [TENANT_B, "b"], [EMPTY_TENANT, "e"]] as const) {
      await client.query(`insert into companies (id, name, slug) values ($1,$2,$3)`, [id, `Tenant ${slug}`, `tenant-${slug}`]);
    }

    const insert = async (tenantId: string, seed: Seed) => {
      const c = columnsFor(seed.standing);
      const nodeId = randomUUID();
      await client!.query(
        `insert into knowledge_nodes (id, tenant_id, type, label, statement, knowledge_lifecycle_status,
           knowledge_health, knowledge_scope, knowledge_authority, domain_key, effective_from,
           effective_until, next_review_at, knowledge_version)
         values ($1,$2,'knowledge-fact',$3,$4,$5::knowledge_lifecycle_status,$6::knowledge_health,
           'company-wide',$7::knowledge_authority,$8,$9,$10,$11,1)`,
        [nodeId, tenantId, seed.title, seed.statement, c.lifecycle, c.health, c.authority,
         seed.domain, c.from, c.until, c.review],
      );
      if (!c.active) return;
      await client!.query(
        `insert into knowledge_facts (tenant_id, fact_key, domain_key, knowledge_scope,
           active_knowledge_node_id, fact_version)
         values ($1,$2,$3,'company-wide',$4,1)`,
        [tenantId, seed.key, seed.domain, nodeId],
      );
    };

    for (const seed of [...CORPUS, ...INGEST]) await insert(TENANT_A, seed);
    /* Tenant B holds a record whose TITLE is identical to A's best answer for the first query. */
    await insert(TENANT_B, {
      key: "iz-01", domain: "izin", standing: "current",
      title: "Yıllık izin talebi kime gönderilir",
      statement: "Yıllık izin talebi doğrudan Genel Müdür'e gönderilir ve otuz gün önce iletilir.",
    });

    /* ── 1. THE QUESTION NOW DECIDES THE ROWS — the whole point of KR3 ────── */
    const leave = await searchKnowledge(A, { queryText: "yıllık izin talebi kime gönderilir" }, deps);
    const refund = await searchKnowledge(A, { queryText: "müşteri ürünü kaç gün içinde iade edebilir" }, deps);
    assert.equal(leave.status, "matched");
    assert.equal(refund.status, "matched");
    assert.equal(keysOf(leave)[0], "iz-01", "the leave question's best answer is the leave record");
    assert.equal(keysOf(refund)[0], "ia-01", "and a refund question gets a refund record");
    assert.notDeepEqual(
      keysOf(leave), keysOf(refund),
      "TWO DIFFERENT QUESTIONS PRODUCE DIFFERENT EVIDENCE — before KR3 both returned the same alphabetical page",
    );
    /* And the irrelevant records are simply absent, rather than carried along alphabetically. */
    assert.ok(!keysOf(leave).includes("ha-01"), "an unrelated expense record is not swept in");

    /* ── 2. TURKISH: the dotted/dotless İ defect is actually fixed ────────── */
    {
      const upper = await searchKnowledge(A, { queryText: "İZİN HAKKI NE KADAR" }, deps);
      assert.equal(upper.status, "matched", "an ALL-CAPS Turkish question matches at all");
      assert.ok(
        keysOf(upper).slice(0, 3).includes("iz-03"),
        "to_tsvector('turkish','İZİN') is 'İzİn' — unlowercased and unstemmed. The fold is what makes this work.",
      );
      const dotless = await searchKnowledge(A, { queryText: "yillik izin hakki kac gun" }, deps);
      assert.ok(keysOf(dotless).slice(0, 3).includes("iz-03"), "diacritics stripped entirely still matches");
    }

    /* ── 3. TURKISH: morphology, natural language, cross-domain ───────────── */
    {
      const morph = await searchKnowledge(A, { queryText: "izin talebi kaç gün önce iletilir" }, deps);
      assert.ok(keysOf(morph).slice(0, 3).includes("iz-02"));

      const natural = await searchKnowledge(A, {
        queryText: "Bir müşteri ürünü beğenmedi, kaç gün içinde geri gönderebilir?",
      }, deps);
      assert.ok(keysOf(natural).slice(0, 3).includes("ia-01"), "a whole question, not a keyword");

      /*
       * CROSS-DOMAIN. "iade" and "kargo" both live in two domains. The refund-shipping-cost record
       * must outrank the shipping-delay-compensation record, which also contains both words.
       */
      const cross = await searchKnowledge(A, { queryText: "iade kargo ücretini kim öder" }, deps);
      const ranked = keysOf(cross);
      assert.ok(ranked.includes("ia-03"));
      assert.ok(
        ranked.indexOf("ia-03") < (ranked.includes("ka-06") ? ranked.indexOf("ka-06") : Number.MAX_SAFE_INTEGER),
        "the refund answer outranks the shipping record that shares its vocabulary",
      );
    }

    /* ── 4. THE MEASURED LIMITS, ASSERTED AS LIMITS ───────────────────────── */
    {
      /*
       * SYNONYM FAILURE, RECORDED HONESTLY. "çalındı" shares no surface form with "kayıp cihaz". KR2
       * measured this class at 67% Recall@3 even WITH trigram, and this is one of the cases it
       * misses. Asserting the failure keeps the limitation in the suite instead of in a user's lap.
       */
      const synonym = await searchKnowledge(A, { queryText: "şirket bilgisayarım çalındı ne yapmalıyım" }, deps);
      const hits = keysOf(synonym);
      assert.ok(
        !hits.slice(0, 1).includes("gu-08"),
        "lexical retrieval does NOT solve genuine synonyms — if this ever passes, re-measure and " +
          "loosen the claim deliberately rather than by accident",
      );
      assert.ok(hits.includes("gu-06"), "it finds the record that shares words, which is the honest failure mode");

      /*
       * TYPO TOLERANCE IS NOT CONNECTED. `pg_trgm` is absent from the canonical database, so no
       * trigram similarity is computed at all. The capability says so, and the score's trigram
       * component is null — never a substituted zero that would look like "computed, no match".
       */
      const capability = synonym.status === "matched" || synonym.status === "no-match"
        ? synonym.capability
        : undefined;
      assert.ok(capability, "every non-unavailable result reports what it could compute");
      if (!capability!.trigram) {
        assert.ok(capability!.degradedReason?.includes("pg_trgm"), "and names the missing extension exactly");
        if (leave.status === "matched") {
          assert.equal(leave.candidates[0].score.trigram, null, "not computed is null, not 0");
          assert.equal(
            leave.candidates[0].score.combined, leave.candidates[0].score.lexical,
            "with no trigram the lexical term IS the score",
          );
        }
      }
    }

    /* ── 5. ELIGIBILITY: out of force is disqualification ─────────────────── */
    {
      const sweep = await searchKnowledge(A, {
        queryText: "kargo fiyat satın alma tedarikçi eskalasyon izin hakkı kampanya çeyrek",
        limit: 20,
      }, deps);
      const served = new Set(keysOf(sweep));
      for (const forbidden of ["ka-04-exp", "fi-01-fut", "sa-02-arc", "es-04-ret", "iz-03-v1"]) {
        assert.ok(!served.has(forbidden), `${forbidden} must never be served`);
      }
      assert.equal(sweep.status, "matched");
      if (sweep.status === "matched") {
        const reasons = new Map(sweep.excluded.map((e) => [e.factKey, e.reason]));
        /* Excluded records are REPORTED, so a gap is never mysterious. */
        assert.equal(reasons.get("ka-04-exp"), "expired");
        assert.equal(reasons.get("fi-01-fut"), "not-yet-effective");
        assert.equal(reasons.get("sa-02-arc"), "lifecycle-archived");
        assert.equal(reasons.get("es-04-ret"), "lifecycle-retired");
        /*
         * A superseded version is NOT in `excluded` — it is not a candidate at all. The join is on
         * active_knowledge_node_id, so it is unrepresentable rather than filtered.
         */
        assert.ok(!reasons.has("iz-03-v1"), "superseded is structurally absent, not excluded");
      }

      /* And the standings that must stay eligible do. */
      const draft = await searchKnowledge(A, { queryText: "ilk yanıt süresi önerisi" }, deps);
      assert.ok(keysOf(draft).includes("de-01-drf"), "draft/provisional remains a candidate");
      const contested = await searchKnowledge(A, { queryText: "parola değişim süresi" }, deps);
      assert.ok(keysOf(contested).includes("gu-01-con"), "contested remains a candidate");
      const stale = await searchKnowledge(A, { queryText: "konaklama limiti" }, deps);
      assert.ok(keysOf(stale).includes("ha-09-stl"), "stale remains a candidate");
      const ingested = await searchKnowledge(A, { queryText: "tedarikçi seçimi" }, deps);
      assert.ok(
        keysOf(ingested).some((k) => k.startsWith("ingest:")),
        "unverified ingested text remains a candidate — filtering it would empty the corpus",
      );
      /* Standing travels WITH the record; it was never used to hide it. */
      if (draft.status === "matched") {
        const found = draft.candidates.find((c) => c.record.factKey === "de-01-drf")!;
        assert.equal(found.record.authorityClass, "provisional");
        assert.equal(found.record.ratified, false);
      }
    }

    /* ── 6. SOURCE DIVERSITY: one document may not own an answer ──────────── */
    {
      const supplier = await searchKnowledge(A, { queryText: "tedarikçi tedarik sözleşme teklif" }, deps);
      assert.equal(supplier.status, "matched");
      if (supplier.status === "matched") {
        const fromSource = supplier.candidates.filter((c) => c.sourceDigest === INGEST_DIGEST);
        assert.ok(fromSource.length <= 2, "at most two chunks from one ingested source");
        assert.ok(supplier.diversityPruned > 0, "and the cap REPORTS that it fired");
      }
    }

    /* ── 7. TENANT ISOLATION UNDER RETRIEVAL ──────────────────────────────── */
    {
      const asA = await searchKnowledge(A, { queryText: "yıllık izin talebi kime gönderilir" }, deps);
      assert.equal(asA.status, "matched");
      if (asA.status === "matched") {
        for (const candidate of asA.candidates) {
          assert.ok(
            candidate.record.statement?.includes("İnsan Kaynakları") ||
              !candidate.record.statement?.includes("Genel Müdür'e gönderilir"),
            "tenant B's identically-titled record never becomes a candidate for tenant A",
          );
        }
      }
      const asB = await searchKnowledge({ tenantId: TENANT_B }, { queryText: "yıllık izin talebi kime gönderilir" }, deps);
      assert.equal(asB.status, "matched");
      if (asB.status === "matched") {
        assert.equal(asB.candidates.length, 1, "tenant B sees exactly its own one record");
        assert.match(asB.candidates[0].record.statement ?? "", /Genel Müdür/);
      }
      /* A tenant with no rows at all sees an empty corpus, not the other tenants'. */
      const asEmpty = await searchKnowledge({ tenantId: EMPTY_TENANT }, { queryText: "yıllık izin" }, deps);
      assert.equal(asEmpty.status, "empty-corpus");
    }

    /* ── 8. EMPTY CORPUS ≠ NO MATCH ≠ EMPTY QUERY — the mandatory split ───── */
    {
      const emptyCorpus = await searchKnowledge({ tenantId: EMPTY_TENANT }, { queryText: "izin" }, deps);
      assert.equal(emptyCorpus.status, "empty-corpus", "an organization that holds nothing says so");

      const noMatch = await searchKnowledge(A, { queryText: "zeplin bakımı kriyojenik" }, deps);
      assert.equal(
        noMatch.status, "no-match",
        "an organization that HOLDS knowledge but does not cover this question is a DIFFERENT state",
      );

      const emptyQuery = await searchKnowledge(A, { queryText: "??? !!!" }, deps);
      assert.equal(emptyQuery.status, "empty-query", "and a question with no searchable word is a third");

      /* The corpus really is non-empty for tenant A — so `no-match` was about the question. */
      const listing = await listKnowledgeSources(A, deps);
      assert.equal(listing.status, "read");
      if (listing.status === "read") assert.ok(listing.records.length > 0);
    }

    /* ── 9. NARROWING HINTS SHRINK, NEVER WIDEN ───────────────────────────── */
    {
      const wide = await searchKnowledge(A, { queryText: "izin kargo iade", limit: 20 }, deps);
      const narrow = await searchKnowledge(A, { queryText: "izin kargo iade", domainKey: "izin", limit: 20 }, deps);
      const wideKeys = new Set(keysOf(wide));
      assert.ok(keysOf(narrow).length > 0);
      for (const key of keysOf(narrow)) {
        assert.ok(wideKeys.has(key), "a hint can only remove candidates the unhinted query already had");
      }
      assert.ok(keysOf(narrow).every((k) => k.startsWith("iz-")), "and it actually narrowed");
    }

    /* ── 10. RETRIEVAL WROTE NOTHING ──────────────────────────────────────── */
    {
      const counts = await client.query<Record<string, string>>(
        `select (select count(*) from knowledge_facts)::text f,
                (select count(*) from knowledge_nodes)::text n,
                (select count(*) from decision_records)::text d,
                (select count(*) from governance_sessions)::text g,
                (select count(*) from audit_log)::text a`,
      );
      const row = counts.rows[0];
      assert.equal(Number(row.f), CORPUS.filter((s) => s.standing !== "superseded").length + INGEST.length + 1);
      assert.equal(Number(row.n), CORPUS.length + INGEST.length + 1);
      assert.equal(Number(row.d), 0, "retrieval created no Governance decision");
      assert.equal(Number(row.g), 0, "and no Governance session");
      assert.equal(Number(row.a), 0, "and wrote no audit row — a read is not an event");
    }

    console.log("PASS kr3 retrieval against PostgreSQL");
  } finally {
    await client?.end();
    await handle?.dispose();
    await harness.dropDatabase();
  }
}

void main();
