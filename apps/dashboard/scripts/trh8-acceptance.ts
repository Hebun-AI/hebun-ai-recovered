/*
 * scripts/trh8-acceptance.ts — TRH-8 production acceptance: the first REAL operational chain for
 * Turkish Rug House, through the RELEASED seams and nothing else.
 *
 *   1. recordWork                  — the Work Authority, human-authorized
 *   2. prepareWorkArtifact         — ONE billable model call; the model authors the bytes
 *   3. declareWorkEvidenceReference × 4 — the Work Authority again, never the artifact writer
 *
 * TENANT IS PINNED. The CGO acceptance scripts resolved "the Director's first active membership",
 * which for this human now matches TWO tenants. That would have written Turkish Rug House's first
 * operational work into Hebun AI. The membership lookup below is predicated on the TRH tenant id
 * and refuses if it does not resolve.
 *
 * Touches NO provider: no Google, no Drive, no YouTube, no Instagram, no credential of any kind.
 * It creates no mandate, no action request, no permit and no execution attempt, and it sends
 * nothing. Operator only.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.hosted.local"], ["DATABASE_URL"]);

/*
 * THE MODEL RUNTIME LIVES IN A DIFFERENT FILE, AND THIS SCRIPT LEARNED IT THE SAME WAY CGO-6 DID.
 *
 * `.env.hosted.local` carries the production database and the encryption keys and no model
 * configuration at all; the configuration is in `.env.local`. The first TRH-8 run refused with
 * `no-provider-configured` for exactly that reason, and correctly: the released writer stores only
 * model-origin text, so an unconfigured runtime must produce no artifact rather than a fallback.
 *
 * `loadQuietEnv` loads ONLY the variables it is given, so naming these seven brings the model
 * runtime and nothing else — in particular NOT that file's `DATABASE_URL`, which points at the
 * local `hebun_r1` database. The production connection string above stays the one in force.
 */
loadQuietEnv(
  [".env.local"],
  [
    "ANTHROPIC_API_KEY",
    "HEBUN_MODEL_ID",
    "HEBUN_MODEL_PROVIDER",
    "HEBUN_MODEL_TRANSPORT",
    "HEBUN_MODEL_CREDENTIAL",
    "HEBUN_MODEL_CONNECTIVITY_ENABLED",
    "HEBUN_MODEL_MAX_OUTPUT_TOKENS",
  ],
);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DIRECTOR_EMAIL = process.env.TRH8_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const TRH_TENANT_ID = "9947c78e-2080-4331-81c6-456cb4be7a96";

/** The approved Work payload. */
const WORK_TITLE = "Turkish Rug House ilk sosyal medya içerik taslağını hazırla";

/** The approved artifact parameters. */
const ARTIFACT_TITLE = "Turkish Rug House — ilk Instagram içerik taslağı";

/*
 * REVISION 2 — the Director-approved corrected prompt.
 *
 * Revision 1 truncated at the 300-token ceiling and carried `#TurkishTextiles`, a provenance
 * implication Turkish Rug House Knowledge does not establish. The ceiling is a released source
 * constant and a deliberate spend bound, so it was NOT raised: the request was shortened to fit it
 * instead. Every factual, grounding, internal-information and hashtag-safety restriction is
 * unchanged; only the output-format section is shorter.
 */
const PROMPT_REVISION_2 = `Turkish Rug House için Instagram'a yönelik reviewable sosyal medya içerik taslağının yeni revision'ını hazırla.

Organizasyonun kayıtlı Knowledge'ını grounding olarak kullan ve kayıtların standing'ini koru.

PUBLIC FACTUAL CLAIM:
Yalnızca kayıt tarafından desteklenen ürün bilgisini doğrudan olgu olarak kullan:
Turkish Rug House el yapımı halılar, kilimler ve minderler satmaktadır.

CONTEXT ONLY:
Marka konumlandırması ve satış pazarları kayıtları provisional ve unratified durumdadır.
Bunları yalnızca ton, dil ve hedef kitle seçimine yardımcı olan bağlam olarak kullan.
Bu kayıtlardaki "koleksiyonluk", "uygun fiyatlı", "Amerika pazarı", "Avrupa" veya "Asya" ifadelerini kamuya açık doğrulanmış marka iddiaları olarak yazma.

İç ticari bilgileri kullanma veya açığa çıkarma.
Özellikle ürün tedarik modeli, toptancı ilişkisi ve marj bilgisini gönderide kullanma.

Kayıt bulunmayan hiçbir şeyi uydurma:
- fiyat
- indirim
- kampanya
- stok
- ürün ölçüsü
- malzeme
- kargo
- teslimat süresi
- müşteri yorumu
- ürün menşei veya provenance iddiası
- ürün bulunabilirliği
- URL
- mağaza politikası

HASHTAG SAFETY:
Hashtag'ler yaratıcı öneri olabilir, ancak ürünlerin menşei, üretim ülkesi, kültürel provenance'ı veya doğrulanmamış marka niteliği hakkında iddia üretmemelidir.

Özellikle kullanma:
- #TurkishTextiles
- #MadeInTurkey
- #TurkishMade
- veya aynı anlamı ima eden hashtag'ler.

Çıktı formatı (KISA TUT — toplam çıktı 300 token sınırındadır):

1. Primary version — English
   - short headline
   - 3 sentence Instagram caption
   - 4 hashtags

2. Alternative version — Turkish
   - short headline
   - 3 sentence Instagram caption
   - 4 hashtags

Başlık, ayırıcı çizgi veya belge başlığı ekleme. Sadece iki versiyonu yaz.
Her iki versiyon da TAMAMLANMIŞ olmalı. Hashtag listesi yarıda kesilmemeli.

The result is a DRAFT FOR HUMAN REVIEW.
It is not approved for publication.
It must not claim that Instagram is connected.
It must not trigger publishing or any external execution.`;

/** Revision 1's prompt, kept for the record. Superseded by the Director at the revision-2 gate. */
const PROMPT = `Turkish Rug House için Instagram'a yönelik ilk reviewable sosyal medya içerik taslağını hazırla.

Organizasyonun kayıtlı Knowledge'ını grounding olarak kullan, fakat kayıtların standing'ini koru.

PUBLIC FACTUAL CLAIM:
Yalnızca kayıt tarafından desteklenen ürün bilgisini doğrudan olgu olarak kullan:
Turkish Rug House el yapımı halılar, kilimler ve minderler satmaktadır.

CONTEXT ONLY:
Marka konumlandırması ve satış pazarları kayıtları provisional ve unratified durumdadır.
Bunları yalnızca ton, dil ve hedef kitle seçimine yardımcı olan bağlam olarak kullan.
Bu kayıtlardaki “koleksiyonluk”, “uygun fiyatlı”, “Amerika pazarı”, “Avrupa” veya “Asya” ifadelerini kamuya açık doğrulanmış marka iddiaları olarak yazma.

İç ticari bilgileri kullanma veya açığa çıkarma.
Özellikle ürün tedarik modeli, toptancı ilişkisi ve marj bilgisini gönderide kullanma.

Kayıt bulunmayan hiçbir şeyi uydurma:
- fiyat
- indirim
- kampanya
- stok
- ürün ölçüsü
- malzeme
- kargo
- teslimat süresi
- müşteri yorumu
- ürün menşei/provenance iddiası
- ürün bulunabilirliği
- URL
- mağaza politikası

Çıktı formatı:

1. Primary version — English
   - short headline
   - 3–5 sentence Instagram caption
   - a small set of relevant hashtags

2. Alternative version — Turkish
   - short headline
   - 3–5 sentence Instagram caption
   - a small set of relevant hashtags

Hashtag'ler yaratıcı öneri olabilir ancak organizasyonel gerçek gibi sunulmamalıdır.

The result is a DRAFT FOR HUMAN REVIEW.
It is not approved for publication.
It must not claim that Instagram is connected.
It must not trigger publishing or any external execution.`;

/** The approved Knowledge grounding, by FACT id — never node id: a declaration must not go stale. */
const KNOWLEDGE_FACTS = [
  { key: "trh-product-offering", id: "2197217f-3bee-4e8e-9f6e-af14d9cfb2ad" },
  { key: "trh-brand-positioning", id: "08b747d6-b626-4d4f-8518-604580464db1" },
  { key: "trh-sales-markets", id: "07f88607-b3ba-4b54-b09b-892b341e5e53" },
] as const;

const COUNTED = [
  "work_items",
  "work_artifacts",
  "work_evidence_references",
  "agent_mandates",
  "integrations",
  "integration_credentials",
  "heby_action_requests",
  "action_permits",
  "action_execution_attempts",
  "knowledge_facts",
  "knowledge_nodes",
  "decision_records",
  "governance_sessions",
  "audit_log",
] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { recordWork, declareWorkEvidenceReference } = await import(
    "../src/features/organizational-work/write-work.server"
  );
  const { prepareWorkArtifact } = await import(
    "../src/features/work-artifacts/prepare-work-artifact.server"
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    /* The membership is resolved INSIDE the pinned tenant. A wrong tenant is a refusal, not a write. */
    const who = await client.query<{
      user_id: string;
      tenant_id: string;
      membership_id: string;
      role_id: string;
      ai: string;
      provider: string;
    }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider
         from users u
         join memberships m on m.user_id = u.id and m.status = 'active' and m.tenant_id = $2
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL, TRH_TENANT_ID],
    );
    const w = who.rows[0];
    if (!w) throw new Error(`no active TRH membership for ${DIRECTOR_EMAIL}`);
    if (w.tenant_id !== TRH_TENANT_ID) throw new Error("resolved tenant is not Turkish Rug House");

    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id,
      userId: w.user_id,
      authIdentityId: w.ai,
      membershipId: w.membership_id,
      membershipVersion: 1,
      roleId: w.role_id,
      sessionContextId: "00000000-0000-4000-8000-000000000008",
      provider: w.provider as never,
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "trh8-acceptance",
      authenticatedAt: new Date().toISOString(),
    });

    const counts = async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) {
        out[t] = (
          await client
            .query<{ n: number }>(`select count(*)::int as n from ${t} where tenant_id = $1`, [
              TRH_TENANT_ID,
            ])
            .catch(() => ({ rows: [{ n: -1 }] }))
        ).rows[0]!.n;
      }
      return out;
    };

    const before = await counts();
    console.log("BEFORE:", JSON.stringify(before));

    /*
     * ── 1 · THE WORK ───────────────────────────────────────────────────────
     *
     * IDEMPOTENT BY INSTRUCTION, NOT BY GUESS. The first run recorded the work and then refused at
     * the artifact for a missing model runtime. Re-recording would give Turkish Rug House two work
     * items for one objective, so the already-recorded id is supplied and this step is skipped.
     * There is no dedupe heuristic here: an operator names the existing item or a new one is made.
     */
    const existingWorkItemId = process.env.TRH8_WORK_ITEM_ID?.trim();
    let workItemId: string;
    if (existingWorkItemId) {
      workItemId = existingWorkItemId;
      console.log("\n1. recordWork: SKIPPED — reusing already-recorded work item");
      console.log("   workItemId:", workItemId);
    } else {
      const work = await recordWork(tenant, { title: WORK_TITLE });
      console.log("\n1. recordWork:", work.status);
      if (work.status !== "recorded") {
        console.log(JSON.stringify(work));
        process.exitCode = 2;
        return;
      }
      workItemId = work.workItem.workItemId;
      console.log("   workItemId:", workItemId);
    }

    /* ── 2 · THE ARTIFACT. One billable model call; the model authors the bytes. ── */
    /*
     * REVISION MODE. Naming an existing artifact adds a revision to it; omitting the id creates a
     * new artifact. Revision 1 is never read, edited or replaced by this path — the released writer
     * appends, and the prior revision keeps its own bytes, digest, author and ordinal.
     */
    const reviseArtifactId = process.env.TRH8_ARTIFACT_ID?.trim();
    const started = Date.now();
    const prepared = await prepareWorkArtifact(
      {
        prompt: reviseArtifactId ? PROMPT_REVISION_2 : PROMPT,
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: ARTIFACT_TITLE,
        ...(reviseArtifactId ? { artifactId: reviseArtifactId } : {}),
      },
      { resolveTenant: async () => tenant },
    );
    console.log(`\n2. prepareWorkArtifact: ${prepared.status} in ${Date.now() - started} ms`);
    if (prepared.status !== "prepared") {
      console.log(JSON.stringify(prepared, null, 1));
      process.exitCode = 2;
      return;
    }
    const artifactId = prepared.artifactId;
    console.log(
      "   artifactId:", artifactId,
      "revisionNo:", prepared.revisionNo,
      "ref:", prepared.ref,
      "conversationId:", prepared.conversationId,
      "sourceMessageId:", prepared.sourceMessageId,
    );

    /*
     * ── 3 · THE EVIDENCE DECLARATIONS. Work Authority, never the artifact writer. ──
     *
     * SKIPPED WHEN REVISING. A reference names the ARTIFACT, not a revision — "a declaration about
     * what work concerns must not go stale when its subject is revised" — so the four already
     * declared for revision 1 remain exactly as valid for revision 2. Re-declaring would attempt a
     * duplicate the partial unique index exists to prevent.
     */
    if (reviseArtifactId) {
      console.log("\n3. declareWorkEvidenceReference: SKIPPED — references name the artifact, not a revision");
      const after0 = await counts();
      console.log("\nAFTER:", JSON.stringify(after0));
      console.log("\nDELTA:");
      for (const t of COUNTED) {
        const d = after0[t]! - before[t]!;
        if (d !== 0) console.log(`   ${t}: ${before[t]} -> ${after0[t]}  (${d > 0 ? "+" : ""}${d})`);
      }
      console.log("\nIDS:", JSON.stringify({ workItemId, artifactId }));
      return;
    }

    console.log("\n3. declareWorkEvidenceReference:");
    for (const fact of KNOWLEDGE_FACTS) {
      const r = await declareWorkEvidenceReference(tenant, {
        workItemId,
        referent: { kind: "knowledge-fact", referentId: fact.id },
      });
      console.log(`   knowledge-fact ${fact.key}: ${r.status}`);
      if (r.status !== "recorded") console.log("   ", JSON.stringify(r));
    }
    const selfRef = await declareWorkEvidenceReference(tenant, {
      workItemId,
      referent: { kind: "work-artifact", referentId: artifactId },
    });
    console.log(`   work-artifact ${artifactId}: ${selfRef.status}`);
    if (selfRef.status !== "recorded") console.log("   ", JSON.stringify(selfRef));

    const after = await counts();
    console.log("\nAFTER:", JSON.stringify(after));
    console.log("\nDELTA:");
    for (const t of COUNTED) {
      const d = after[t]! - before[t]!;
      if (d !== 0) console.log(`   ${t}: ${before[t]} -> ${after[t]}  (${d > 0 ? "+" : ""}${d})`);
    }
    console.log("\nIDS:", JSON.stringify({ workItemId, artifactId }));
  } finally {
    await client.end();
  }
}

void main();
