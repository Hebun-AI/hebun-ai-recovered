/*
 * KR3 — THE PHASE EXIT TEST.
 *
 * Everything else proves a part. This proves the claim: a human ingests several knowledge sources,
 * asks Heby a specific question, and the evidence Heby grounds on is the evidence that bears on THAT
 * question — not the first fifty records in alphabetical order, which is what every Knowledge answer
 * carried before this phase.
 *
 * It runs the REAL path end to end: the real ingestion producer writing through the real governed
 * writer, the real K1 read seam, the real retrieval, and the real Heby evidence resolution. The only
 * thing not exercised is the model call itself, which needs a provider and is governed by the R2E
 * kill switch — and which is downstream of everything this phase changed.
 *
 * Disposable database, dropped on exit by its own ownership handle.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { ingestKnowledgeSource } from "../../src/features/knowledge/knowledge-ingest.server";
import { resolveKnowledgeWriteAuthority } from "../../src/features/knowledge/knowledge-write-authority.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import {
  resolveKnowledgeEvidence,
  resolveKnowledgeListingEvidence,
} from "../../src/features/heby-answer/knowledge-evidence.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const SCOPE = "company-wide" as const;

/** Three genuinely different Turkish policies, each in its own domain. */
const SOURCES: ReadonlyArray<{ title: string; domain: string; text: string }> = [
  {
    title: "İzin Yönetmeliği",
    domain: "izin",
    text: [
      "Yıllık izin talebi İnsan Kaynakları portalından açılır ve bağlı olunan departman yöneticisine gönderilir.",
      "Yıllık izin talepleri kullanılacak tarihten en az on beş gün önce iletilir.",
      "Bir ile beş yıl kıdemde on dört gün, on beş yıl üzeri kıdemde yirmi altı gün yıllık ücretli izin hakkı doğar.",
    ].join("\n\n"),
  },
  {
    title: "İade ve Kargo Politikası",
    domain: "iade",
    text: [
      "Müşteri ürünü teslim aldığı tarihten itibaren on dört gün içinde iade edebilir.",
      "Ayıplı ürün iadelerinde kargo ücreti şirkete, cayma hakkı kullanılan iadelerde müşteriye aittir.",
      "İade onaylandıktan sonra bedel beş iş günü içinde müşterinin ödeme yaptığı yönteme geri yatırılır.",
    ].join("\n\n"),
  },
  {
    title: "Harcama Onay Matrisi",
    domain: "harcama",
    text: [
      "Beş bin liraya kadar olan harcamalar departman yöneticisi tarafından onaylanır.",
      "Yirmi beş bin lira üzerindeki harcamalar Genel Müdür onayı olmadan gerçekleştirilemez.",
      "Ofis sarf malzemesi ve beş yüz lira altındaki günlük giderler ön onay gerektirmez.",
    ].join("\n\n"),
  },
];

function refsOf(resolution: { items: readonly { recordRef: string }[] }): readonly string[] {
  return resolution.items.map((item) => item.recordRef);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("kr3e2e");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;

  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();

    const seeded = await seedLocalIdentity(client, {
      companyName: "KR3 Retrieval Co",
      companySlug: "kr3-retrieval-co",
      email: "director@kr3.example",
      roleType: "director",
    });
    const tenant: TenantContext = {
      tenantId: seeded.tenantId,
      userId: seeded.userId,
      authIdentityId: seeded.authIdentityId,
      membershipId: seeded.membershipId,
      membershipVersion: 1,
      roleId: seeded.roleId,
      sessionContextId: randomUUID(),
      provider: "local",
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "kr3-retrieval-request",
      authenticatedAt: NOW.toISOString(),
    };

    const repo = createDurableKnowledgeRepository(handle.db);
    const deps = { getRepo: () => repo, now: () => NOW };

    /* ── 1. A HUMAN PUTS KNOWLEDGE IN, THROUGH THE REAL GOVERNED PATH ────── */
    const authority = await resolveKnowledgeWriteAuthority(tenant, handle.db);
    assert.equal(authority.authorized, true, "the seeded director may author knowledge");

    for (const source of SOURCES) {
      const result = await ingestKnowledgeSource(
        tenant,
        { sourceTitle: source.title, sourceText: source.text, domainKey: source.domain, scope: SCOPE },
        {
          getDb: () => handle!.db,
          /* Injected, or the authority resolver would reach for the process-wide DATABASE_URL. */
          resolveAuthority: (actor) => resolveKnowledgeWriteAuthority(actor, handle!.db),
          now: () => NOW,
        },
      );
      assert.equal(result.status, "ingested", `${source.title} was ingested`);
    }

    const listing = await listKnowledgeSources(tenant, deps);
    assert.equal(listing.status, "read");
    const total = listing.status === "read" ? listing.records.length : 0;
    assert.ok(total >= 3, `the organization now holds ${total} records across three domains`);

    /* ── 2. THE QUESTION SELECTS THE EVIDENCE — the phase's whole claim ──── */
    const leave = await resolveKnowledgeEvidence(tenant, "Yıllık izin talebini kime göndermeliyim?", deps);
    const refund = await resolveKnowledgeEvidence(tenant, "Müşteri ürünü kaç gün içinde iade edebilir?", deps);
    const expense = await resolveKnowledgeEvidence(tenant, "Kırk bin liralık harcamayı kim onaylar?", deps);

    for (const [label, resolution] of [["leave", leave], ["refund", refund], ["expense", expense]] as const) {
      assert.equal(resolution.state, "resolved", `${label} question resolved to real evidence`);
      assert.ok(resolution.items.length > 0, `${label} carries at least one record`);
    }

    /*
     * EACH QUESTION'S BEST EVIDENCE COMES FROM ITS OWN DOMAIN.
     *
     * The assertion is on the TOP-RANKED item, not on every item, and that is deliberate. Lower
     * ranks legitimately contain cross-domain matches: "Müşteri ürünü kaç gün içinde iade edebilir?"
     * shares the word "gün" with the leave policy, so the leave record is a real, weaker lexical
     * match. Demanding that every returned item be from one domain would be demanding perfect
     * precision, which KR2 measured this representation as NOT having (78.3% Recall@3, and a
     * measured domain-confusion rate). A test that asserted it would be a test that has to be
     * weakened later — so it asserts what was actually measured: the right answer ranks first.
     */
    assert.ok(refsOf(leave)[0].startsWith("izin/"), `leave evidence: ${refsOf(leave).join(", ")}`);
    assert.ok(refsOf(refund)[0].startsWith("iade/"), `refund evidence: ${refsOf(refund).join(", ")}`);
    assert.ok(refsOf(expense)[0].startsWith("harcama/"), `expense evidence: ${refsOf(expense).join(", ")}`);

    /* And they are genuinely different sets — not three views of the same page. */
    assert.notDeepEqual(refsOf(leave), refsOf(refund));
    assert.notDeepEqual(refsOf(refund), refsOf(expense));
    assert.notDeepEqual(refsOf(leave), refsOf(expense));

    /* ── 3. IRRELEVANT RECORDS ARE NOT SWEPT IN, WHICH THEY USED TO BE ───── */
    {
      /*
       * The pre-KR3 behaviour, still reachable and still correct for `/knowledge`: a question-blind
       * listing. Running BOTH here is the comparison that makes the phase's claim checkable rather
       * than asserted — the listing carries every domain, the retrieval carries one.
       */
      const alphabetical = await resolveKnowledgeListingEvidence(tenant, deps);
      assert.equal(alphabetical.state, "resolved");
      const listedDomains = new Set(refsOf(alphabetical).map((ref) => ref.split("/")[0]));
      assert.ok(listedDomains.size >= 3, "the LISTING carries every domain regardless of any question");

      /*
       * The comparison that makes the phase's claim checkable: the expense policy is in the
       * listing Heby used to receive for EVERY question, and is absent from the evidence for a
       * question about leave. That is the behaviour change, stated as a difference rather than as
       * a count — a count would drift the moment the corpus grew.
       */
      assert.ok(
        refsOf(alphabetical).some((ref) => ref.startsWith("harcama/")),
        "the question-blind listing carries the expense policy",
      );
      assert.ok(
        !refsOf(leave).some((ref) => ref.startsWith("harcama/")),
        "and retrieval for a LEAVE question does not — before KR3 it always did",
      );
      assert.ok(
        refsOf(alphabetical).length >= refsOf(leave).length,
        "retrieval is never wider than the listing it replaced",
      );
    }

    /* ── 4. HEBY'S EXISTING GROUNDING SHAPE IS UNCHANGED ─────────────────── */
    {
      const item = leave.items[0];
      /* The same SourceResolution contract every other source produces. */
      assert.equal(leave.sourceClass, "knowledge");
      assert.ok(typeof leave.provenance === "string" && leave.provenance.length > 0);
      assert.equal(typeof leave.authoritative, "boolean");
      /* Standing still travels per item, unflattened. */
      for (const field of ["authority:", "lifecycle:", "ratified:", "freshness:", "scope:"]) {
        assert.ok(item.detail.includes(field), `${field} still travels with the item`);
      }
      /* The verbatim organizational wording rides on `content`, never on Heby's own prose. */
      assert.ok(item.content && item.content.length > 0, "the human's words reach the grounding context");
      assert.ok(!item.detail.includes(item.content!), "and stay out of the machine-derived detail");
      /* Ingested text is provisional and says so — retrieval did not promote anything. */
      assert.match(item.detail, /authority: provisional/);
      assert.match(item.detail, /ratified: no/);
      /* The provenance names retrieval as DERIVED, and denies that rank means truth. */
      assert.match(leave.provenance, /TEXT-MATCH score/);
      assert.match(leave.provenance, /not a measure of truth/);
    }

    /* ── 5. NO-MATCH IS ABOUT THE QUESTION, NEVER ABOUT THE ORGANIZATION ─── */
    {
      const nonsense = await resolveKnowledgeEvidence(tenant, "kriyojenik zeplin bakım prosedürü", deps);
      assert.equal(nonsense.state, "unavailable");
      assert.match(nonsense.unavailableReason ?? "", /holds knowledge records, but none of them match/);
      assert.ok(
        !/holds no knowledge records/.test(nonsense.unavailableReason ?? ""),
        "THE REGRESSION THIS GUARDS: never tell an operator their organization knows nothing " +
          "on the evidence that one question missed",
      );
    }

    /* ── 6. RETRIEVAL WROTE NOTHING, AND PERSISTED NOTHING ───────────────── */
    {
      const before = await client.query<Record<string, string>>(
        `select (select count(*) from knowledge_facts)::text f,
                (select count(*) from knowledge_nodes)::text n,
                (select count(*) from decision_records)::text d,
                (select count(*) from governance_sessions)::text g,
                (select count(*) from audit_log)::text a`,
      );

      /* Ask several more questions — the state after must be identical to the state before. */
      for (const question of [
        "izin hakkı kaç gün",
        "iade bedeli ne zaman ödenir",
        "harcama onayı kimde",
        "kriyojenik zeplin",
      ]) {
        await resolveKnowledgeEvidence(tenant, question, deps);
      }

      const after = await client.query<Record<string, string>>(
        `select (select count(*) from knowledge_facts)::text f,
                (select count(*) from knowledge_nodes)::text n,
                (select count(*) from decision_records)::text d,
                (select count(*) from governance_sessions)::text g,
                (select count(*) from audit_log)::text a`,
      );
      assert.deepEqual(after.rows[0], before.rows[0], "four retrievals changed NOTHING in the database");
      assert.equal(Number(after.rows[0].d), 0, "no Governance decision was created");
      assert.equal(Number(after.rows[0].g), 0, "no Governance session was created");

      /* No retrieval artifact was persisted anywhere — there is no table for one, by design. */
      const tables = await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public'`,
      );
      const names = tables.rows.map((r) => r.table_name);
      for (const forbidden of ["retrieval_results", "search_index", "knowledge_embeddings", "retrieval_cache"]) {
        assert.ok(!names.includes(forbidden), `${forbidden} must not exist — retrieval owns no table`);
      }
      /* And no audit row: a read is not an event. */
      assert.equal(Number(after.rows[0].a), Number(before.rows[0].a));
    }

    console.log("PASS kr3 Heby end-to-end (question selects evidence)");
  } finally {
    await client?.end();
    await handle?.dispose();
    await harness.dropDatabase();
  }
}

void main();
