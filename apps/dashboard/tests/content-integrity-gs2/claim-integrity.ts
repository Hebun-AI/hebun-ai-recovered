/*
 * GS-2 — CONTENT INTEGRITY: a production revision dropped the qualification its Knowledge kept.
 *
 * The record supplied to the generation said "most of the range is handmade"; the revision said
 * "Handmade rugs, kilims and cushions" and added "a carefully selected collection". GS-1 flagged the
 * English sentence only because the record was written in Turkish, missed the Turkish one because the
 * record contains "el yapımı", and had no word for a selection process at all.
 *
 * Every case below runs the real evaluator on the exact text. Where text comparison cannot decide,
 * the assertion is the truthful abstention, never a fabricated `supported`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assessClaimSupport,
  assessRevisionSupport,
  type ClaimEvidence,
  type ClaimSupport,
} from "../../src/features/knowledge-retrieval/claim-support";
import {
  GROUNDING_CHECK_MANUAL_INSPECTION,
  groundingClaimLabel,
} from "../../src/features/heby-answer/revision-generation-evidence";
import { CONTENT_DRAFT_PREPARATION_BRIEF, preparationBriefFor } from "../../src/features/work-artifacts/preparation-brief";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const importsOf = (rel: string) => [...read(rel).matchAll(/^import[\s\S]*?from "([^"]+)";/gm)].map((m) => m[1]);

/* The three records supplied whole to the generation of the failing revision, verbatim. */
const PRODUCTION_EVIDENCE: ClaimEvidence = {
  provenance: "bounded-universe",
  items: [
    {
      nodeId: "brand-v2",
      text: "Turkish Rug House kendini el yapımı, koleksiyonluk ve uygun fiyatlı ürünler sunan bir marka olarak konumlandırmayı hedefler. Bu bir konumlandırma tercihidir.",
    },
    {
      nodeId: "markets-v1",
      text: "Turkish Rug House ağırlıklı olarak Amerika pazarına hizmet etmektedir. Avrupa ve Asya ülkeleri de satış pazarları arasındadır.",
    },
    {
      nodeId: "offering-v2",
      text: "Turkish Rug House halı, kilim ve minder satmaktadır. Ürün yelpazesinin büyük bölümünü el yapımı ürünler oluşturmaktadır.",
    },
  ],
};

/* The revision as stored, byte for byte. */
const FAILING_REVISION =
  "Handmade rugs, kilims and cushions that bring warmth and character to your home. Turkish Rug House offers a carefully selected collection of traditional textiles for your space.\n#TurkishRugs #Kilim #HomeDecor #TextileArt\n---\nEl yapımı halılar, kilimler ve yastıklar evinize sıcaklık ve karakter katıyor. Turkish Rug House, mekanlarınız için seçilmiş geleneksel tekstil koleksiyonu sunar.\n#TurkishRugs #Kilim #HomeDecor #TextileArt";

const evidenceOf = (...texts: string[]): ClaimEvidence => ({
  provenance: "matched",
  items: texts.map((text, i) => ({ nodeId: `n${i}`, text })),
});
const signalsOf = (support: ClaimSupport) =>
  support.status === "insufficient" && support.reason === "unsupported-signal" ? support.signals : [];

/* ── 1 · English qualifier loss ── */
{
  const most = evidenceOf("Most products are handmade.");
  assert.deepEqual(signalsOf(assessClaimSupport("Handmade products.", most)), ["qualifier-dropped"], "1 · most → all");
  const real = assessClaimSupport("Handmade rugs, kilims and cushions that bring warmth and character to your home.", PRODUCTION_EVIDENCE);
  assert.ok(signalsOf(real).includes("qualifier-dropped"), "1 · the production sentence drops the record's qualification");
  assert.ok(!signalsOf(real).includes("production-method"), "1 · and is no longer flagged merely for being written in English");
}

/* ── 2 · Turkish qualifier loss ── */
{
  const most = evidenceOf("Ürünlerin büyük bölümü el yapımıdır.");
  assert.deepEqual(signalsOf(assessClaimSupport("El yapımı ürünler.", most)), ["qualifier-dropped"], "2 · büyük bölümü → all");
  const real = assessClaimSupport("El yapımı halılar, kilimler ve yastıklar evinize sıcaklık ve karakter katıyor.", PRODUCTION_EVIDENCE);
  assert.ok(signalsOf(real).includes("qualifier-dropped"), "2 · the production Turkish sentence, missed by GS-1, is now caught");
}

/* ── 3 · 4 · unsupported selection, both languages ── */
{
  const en = assessClaimSupport("Turkish Rug House offers a carefully selected collection of traditional textiles for your space.", PRODUCTION_EVIDENCE);
  assert.ok(signalsOf(en).includes("quality-process"), "3 · carefully selected");
  const tr = assessClaimSupport("Turkish Rug House, mekanlarınız için seçilmiş geleneksel tekstil koleksiyonu sunar.", PRODUCTION_EVIDENCE);
  assert.ok(signalsOf(tr).includes("quality-process"), "4 · seçilmiş");
  assert.ok(signalsOf(assessClaimSupport("Özenle seçilmiş koleksiyon.", PRODUCTION_EVIDENCE)).includes("quality-process"), "4 · özenle seçilmiş");
  for (const claim of ["Every piece is quality checked.", "Sertifikalı ürünler.", "Kalite kontrolünden geçmiş halılar."]) {
    assert.ok(signalsOf(assessClaimSupport(claim, PRODUCTION_EVIDENCE)).includes("quality-process"), `4 · ${claim}`);
  }
  /* A record that does name the process supports naming it. */
  assert.ok(!signalsOf(assessClaimSupport("Our buyers selected each rug.", evidenceOf("Our buyers selected each rug in person."))).includes("quality-process"));
}

/* ── 5 · hand-knotted is a different method from handmade ── */
{
  const s = assessClaimSupport("Hand-knotted rugs and kilims from Turkish Rug House.", PRODUCTION_EVIDENCE);
  assert.ok(signalsOf(s).includes("production-method"), "5 · handmade evidence never licenses hand-knotted");
  assert.ok(signalsOf(assessClaimSupport("Elde düğümlenmiş kilimler.", PRODUCTION_EVIDENCE)).includes("production-method"), "5 · TR");
}

/* ── 6 · supported claims with the qualification kept ── */
{
  const kept = assessClaimSupport("Most of our range is handmade.", PRODUCTION_EVIDENCE);
  assert.notEqual(kept.status, "insufficient", "6 · a qualified paraphrase is not warned");
  assert.equal(kept.status, "undetermined", "6 · and is not called supported: a paraphrase is not provable by text");
  const verbatim = assessClaimSupport("Ürün yelpazesinin büyük bölümünü el yapımı ürünler oluşturmaktadır.", PRODUCTION_EVIDENCE);
  assert.equal(verbatim.status, "supported", "6 · the record's own sentence is supported");
  const tr = assessClaimSupport("Ürünlerimizin çoğu el yapımıdır.", PRODUCTION_EVIDENCE);
  assert.notEqual(tr.status, "insufficient", "6 · a Turkish qualifier is a qualifier");
}

/* ── 7 · a denial is not a claim of the method ── */
{
  for (const claim of ["Our kilims are not hand-knotted.", "Kilimlerimiz el düğümlü değil."]) {
    const s = assessClaimSupport(claim, PRODUCTION_EVIDENCE);
    assert.ok(!signalsOf(s).includes("production-method"), `7 · ${claim}`);
    assert.notEqual(s.status, "supported", `7 · ${claim} is not thereby supported`);
  }
}

/* ── 8 · marketing language with no factual assertion ── */
{
  for (const claim of ["Bring warmth and character to your home.", "Evinize sıcaklık katın."]) {
    assert.equal(assessClaimSupport(claim, PRODUCTION_EVIDENCE).status, "undetermined", `8 · ${claim}`);
  }
}

/* ── 9 · missing or unreadable evidence ── */
{
  assert.equal(assessClaimSupport("Handmade rugs.", null).status, "unavailable");
  assert.equal(assessClaimSupport("Handmade rugs.", { provenance: "unavailable", items: [] }).status, "unavailable");
  assert.deepEqual(assessClaimSupport("Handmade rugs.", { provenance: "bounded-universe", items: [] }), { status: "insufficient", reason: "no-evidence" });
  assert.equal(assessRevisionSupport(FAILING_REVISION, null).status, "unavailable");
}

/* An aim restated as a fact is the same loss of qualification. */
{
  const aim = evidenceOf("The company aims to offer handmade rugs.");
  assert.ok(signalsOf(assessClaimSupport("The company offers handmade rugs.", aim)).includes("qualifier-dropped"));
  assert.ok(!signalsOf(assessClaimSupport("The company aims to offer handmade rugs.", aim)).includes("qualifier-dropped"));
}

/* ── the failing revision as a whole ── */
{
  const r = assessRevisionSupport(FAILING_REVISION, PRODUCTION_EVIDENCE);
  assert.equal(r.status, "insufficient");
  const flagged = r.claims.filter((c) => c.support.status === "insufficient").map((c) => c.text);
  for (const sentence of [
    "Handmade rugs, kilims and cushions that bring warmth and character to your home.",
    "Turkish Rug House offers a carefully selected collection of traditional textiles for your space.",
    "El yapımı halılar, kilimler ve yastıklar evinize sıcaklık ve karakter katıyor.",
    "Turkish Rug House, mekanlarınız için seçilmiş geleneksel tekstil koleksiyonu sunar.",
  ]) {
    assert.ok(flagged.includes(sentence), `revision 5: ${sentence}`);
  }
  for (const claim of r.claims) assert.notEqual(claim.support.status, "supported", "nothing in it is called supported");
  const label = groundingClaimLabel(r.claims[0]!.support);
  assert.match(label, /drops a qualification the supplied record keeps/);
}

/* ── 10 · the check sees only the evidence it is handed ── */
{
  const other = evidenceOf("All products are handmade.");
  assert.equal(signalsOf(assessClaimSupport("Handmade products.", other)).length, 0, "another organization's wording supports it there");
  assert.ok(signalsOf(assessClaimSupport("Handmade products.", PRODUCTION_EVIDENCE)).includes("qualifier-dropped"), "and nothing of it reaches this one");
  assert.deepEqual(importsOf("src/features/knowledge-retrieval/claim-support.ts"), ["./evidence", "./query-normalization"], "pure: no database, tenant or network");
}

/* ── 11 · review stays a human act ── */
{
  const evidenceUi = read("src/components/operations-preparation/revision-generation-evidence.tsx");
  assert.ok(!/accept|requestArtifactRevisionChanges|Governance/i.test(importsOf("src/components/operations-preparation/revision-generation-evidence.tsx").join(" ")), "the evidence panel imports no decision writer");
  assert.ok(/readRevisionGenerationEvidenceAction/.test(evidenceUi), "it only reads");
  assert.match(evidenceUi, /GROUNDING_CHECK_MANUAL_INSPECTION/, "manual inspection is shown beside a non-supported verdict");
  assert.match(GROUNDING_CHECK_MANUAL_INSPECTION, /can miss an unsupported claim and can flag an acceptable one/);
  const review = read("src/components/operations-preparation/artifact-revision-review.tsx");
  assert.match(review, /openWhenDeciding=\{intent !== null\}/, "the check opens when a reviewer starts to decide");
  assert.equal((review.match(/acceptArtifactRevisionAction\(/g) ?? []).length, 1, "acceptance is still the one explicit submit");
  assert.match(review, /disabled=\{pending \|\| tooShort\}/, "and still needs a justification");
}

/* ── 12 · 13 · no capability, no disclosure ── */
{
  for (const file of [
    "src/features/knowledge-retrieval/claim-support.ts",
    "src/features/heby-answer/revision-generation-evidence.ts",
    "src/components/operations-preparation/revision-generation-evidence.tsx",
  ]) {
    for (const imp of importsOf(file)) {
      assert.ok(!/action-execution|instagram-publishing|heby-action-inlet|permit|heby-model|external-ai-data-use/.test(imp), `${file} imports ${imp}`);
    }
  }
  assert.deepEqual(preparationBriefFor({ artifactType: "content-draft" }), {
    instruction: CONTENT_DRAFT_PREPARATION_BRIEF.join(" "),
    material: [],
  }, "the brief adds instruction only: no material, so no new data reaches the model");
}

/* ── the brief now says what Knowledge can and cannot establish ── */
{
  const brief = CONTENT_DRAFT_PREPARATION_BRIEF.join(" ");
  assert.match(brief, /Keep every qualification a record states/);
  assert.match(brief, /must not turn an aim, a preference or a plan into a present fact/);
  assert.match(brief, /how products are made, chosen, curated, inspected or certified/);
  assert.match(brief, /does not mean anyone independently verified it/);
  assert.ok(!/owner-declared|owner attestation/i.test(brief), "no classification the data model cannot establish");
}

console.log("PASS content-integrity-gs2 claim-integrity");
