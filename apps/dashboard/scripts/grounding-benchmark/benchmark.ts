/*
 * GROUNDING SUFFICIENCY GS-0 benchmark. SYNTHETIC BENCHMARK DATA — NOT ORGANIZATIONAL TRUTH.
 *
 * Evidence is the RELEVANCE-0 "Zanzibar Textiles" corpus, restricted to versions eligible for public
 * content (current, not rejected, ratified, public use allowed) — what Phase 5 would supply. Every
 * claim and every gold label below was written and labelled by hand for this file; no model wrote or
 * labelled any of it. Gold answers ONE question: does the supplied evidence establish the claim?
 *
 *   supported      a careful human reader would say the supplied records state it
 *   insufficient   they do not state it (including: nothing was supplied)
 *   contradicted   a supplied record states the opposite
 *   unavailable    the evidence could not be read
 *
 * q22 / q23 are the RELEVANCE-1 regression tasks, unchanged: the facts that would answer them
 * (`z-custom`, `z-origin`) are not eligible for public use, so the public universe cannot ground them.
 */
import { ELIGIBILITY, FACTS } from "../relevance-benchmark/corpus";
import {
  assessClaimSupport,
  type ClaimEvidence,
  type ClaimSupport,
} from "../../src/features/knowledge-retrieval/claim-support";
import type { RetrievalEvidenceStatus } from "../../src/features/knowledge-retrieval/evidence";

export const SYNTHETIC_BENCHMARK = true as const;

export const PUBLIC_ELIGIBLE = FACTS.filter((f) => {
  const e = ELIGIBILITY[f.key];
  return e && !e.rejected && e.ratified && e.publicUse === "allowed";
}).map((f) => f.key);

export type Gold = "supported" | "insufficient" | "contradicted" | "unavailable";

export interface GroundingCase {
  readonly id: string;
  readonly claim: string;
  /** Public-eligible fact keys supplied; `null` = the evidence could not be read. */
  readonly evidence: readonly string[] | null;
  readonly provenance: RetrievalEvidenceStatus;
  readonly gold: Gold;
  readonly note: string;
}

const ALL = PUBLIC_ELIGIBLE;

export const CASES: readonly GroundingCase[] = [
  /* ── supported ── */
  { id: "s-exact-en", claim: "Zanzibar Textiles rugs are made from undyed sheep wool on cotton warps.", evidence: ["z-materials"], provenance: "matched", gold: "supported", note: "exact sentence" },
  { id: "s-exact-tr", claim: "Kilimler 60x90 cm'den 200x300 cm'ye kadar standart ölçülerde sunulur.", evidence: ["z-sizes"], provenance: "matched", gold: "supported", note: "exact sentence, Turkish" },
  { id: "s-one-of-many", claim: "Spot-clean with cold water; professional washing is recommended once a year.", evidence: ALL, provenance: "bounded-universe", gold: "supported", note: "one of seven supplied records supports it" },
  { id: "s-clause", claim: "International delivery takes two to three weeks.", evidence: ["z-shipping"], provenance: "matched", gold: "supported", note: "one whole clause of the record" },
  { id: "s-paraphrase-en", claim: "Our rugs use undyed sheep wool.", evidence: ["z-materials"], provenance: "matched", gold: "supported", note: "paraphrase / narrowing" },
  { id: "s-narrow-xlang", claim: "Zanzibar Textiles sells kilims.", evidence: ["z-products"], provenance: "bounded-universe", gold: "supported", note: "narrower claim, cross-language" },
  { id: "s-xlang-name", claim: "We sell mainly to the United States.", evidence: ["z-markets"], provenance: "bounded-universe", gold: "supported", note: "cross-language name (Amerika Birleşik Devletleri)" },
  { id: "s-xlang-handmade", claim: "We sell handwoven kilims and wool rugs.", evidence: ["z-products"], provenance: "matched", gold: "supported", note: "'el dokuması' = handwoven, cross-language" },
  { id: "s-multi", claim: "Orders ship from Istanbul within five business days, and our rugs are made from undyed sheep wool.", evidence: ["z-shipping", "z-materials"], provenance: "bounded-universe", gold: "supported", note: "jointly supported by two records" },
  { id: "s-tr-paraphrase", claim: "Ağırlıklı olarak ABD'ye satış yapıyoruz.", evidence: ["z-markets"], provenance: "matched", gold: "supported", note: "Turkish paraphrase with abbreviation" },

  /* ── insufficient: escalation ── */
  { id: "i-artisan", claim: "Every rug is hand-knotted by master artisans.", evidence: ["z-products", "z-materials"], provenance: "bounded-universe", gold: "insufficient", note: "universal + production method from a general product fact" },
  { id: "i-artisan-tr", claim: "Tüm kilimlerimiz usta zanaatkârlar tarafından elde düğümlenir.", evidence: ["z-products"], provenance: "matched", gold: "insufficient", note: "same escalation in Turkish" },
  { id: "i-quantity", claim: "We have sold over 10,000 rugs.", evidence: ["z-products"], provenance: "matched", gold: "insufficient", note: "invented quantity" },
  { id: "i-percent", claim: "40% of our customers are in the US.", evidence: ["z-markets"], provenance: "matched", gold: "insufficient", note: "invented percentage" },
  { id: "i-date", claim: "Zanzibar Textiles was founded in 1985.", evidence: ["z-brand"], provenance: "matched", gold: "insufficient", note: "invented date" },
  { id: "i-superlative", claim: "Zanzibar Textiles makes the finest kilims in Turkey.", evidence: ["z-products", "z-brand"], provenance: "bounded-universe", gold: "insufficient", note: "invented superlative" },
  { id: "i-superlative-tr", claim: "Türkiye'nin en iyi kilimlerini satıyoruz.", evidence: ["z-products"], provenance: "matched", gold: "insufficient", note: "invented superlative, Turkish" },
  { id: "i-leading", claim: "Zanzibar Textiles is the leading kilim brand in Europe.", evidence: ["z-markets", "z-brand"], provenance: "bounded-universe", gold: "insufficient", note: "stronger claim than 'sells to Europe'" },
  { id: "i-award", claim: "Our award-winning designs are loved worldwide.", evidence: ["z-brand"], provenance: "matched", gold: "insufficient", note: "invented recognition" },
  { id: "i-named-artisan", claim: "Each kilim is woven by Ayşe Hanım in Konya.", evidence: ["z-products"], provenance: "matched", gold: "insufficient", note: "invented named artisan and origin" },
  { id: "i-causal", claim: "Because we use undyed wool, our rugs never fade.", evidence: ["z-materials"], provenance: "matched", gold: "insufficient", note: "causal inference" },
  { id: "i-current", claim: "We are currently shipping to Canada.", evidence: ["z-markets", "z-shipping"], provenance: "bounded-universe", gold: "insufficient", note: "current-state claim + unnamed market" },
  { id: "i-new", claim: "Our new collection is now available.", evidence: ["z-products"], provenance: "matched", gold: "insufficient", note: "temporal claim from non-temporal evidence" },
  { id: "i-aspiration", claim: "Zanzibar Textiles sade ve zamansız bir markadır.", evidence: ["z-brand"], provenance: "matched", gold: "insufficient", note: "aspiration ('hedefler') escalated to fact" },
  { id: "i-one-insufficient", claim: "Rugs come in any size you like.", evidence: ["z-sizes"], provenance: "matched", gold: "insufficient", note: "standard sizes do not establish any size" },
  { id: "i-irrelevant", claim: "Our rugs are safe for children and pets.", evidence: ["z-care", "z-brand"], provenance: "bounded-universe", gold: "insufficient", note: "eligible but irrelevant evidence" },
  { id: "i-universe-none", claim: "Free shipping on all orders.", evidence: ALL, provenance: "bounded-universe", gold: "insufficient", note: "seven eligible records supplied, none supports it" },
  { id: "i-universe-none-2", claim: "Our weavers are paid fairly.", evidence: ALL, provenance: "bounded-universe", gold: "insufficient", note: "the fact exists only as an internal, denied record" },
  { id: "i-mixed", claim: "International delivery takes two to three weeks. Every parcel is tracked door to door.", evidence: ["z-shipping"], provenance: "matched", gold: "insufficient", note: "one exact sentence does not carry a second, unsupported one" },
  { id: "i-mixed-quiet", claim: "International delivery takes two to three weeks. Parcels are tracked door to door.", evidence: ["z-shipping"], provenance: "matched", gold: "insufficient", note: "same, with no detectable signal" },
  { id: "i-no-evidence", claim: "Our rugs are made from undyed sheep wool.", evidence: [], provenance: "no-match", gold: "insufficient", note: "nothing supplied" },
  { id: "i-matched-unsupported", claim: "All our wool is organic.", evidence: ["z-materials"], provenance: "matched", gold: "insufficient", note: "lexically matched record, stronger claim" },

  /* ── RELEVANCE-1 regressions, unchanged tasks ── */
  { id: "q22-full", claim: "Custom sizes can be ordered; production takes six to eight weeks.", evidence: ALL, provenance: "bounded-universe", gold: "insufficient", note: "q22: z-custom is unratified, so not public-eligible" },
  { id: "q22-short", claim: "You can order a custom size.", evidence: ["z-sizes"], provenance: "matched", gold: "insufficient", note: "q22: adjacent z-sizes is related, not support" },
  { id: "q23-tr", claim: "Kilimlerimizin tamamı Konya'da dokunur.", evidence: ALL, provenance: "bounded-universe", gold: "insufficient", note: "q23: z-origin is unratified / public use unknown" },
  { id: "q23-en", claim: "Our kilims are woven in Konya.", evidence: ["z-products", "z-markets"], provenance: "bounded-universe", gold: "insufficient", note: "q23: adjacent product/market facts" },

  /* ── contradicted ── */
  { id: "c-dyed", claim: "Our rugs are dyed with natural plant dyes.", evidence: ["z-materials"], provenance: "matched", gold: "contradicted", note: "record says undyed" },
  { id: "c-two-days", claim: "Orders ship within two days.", evidence: ["z-shipping"], provenance: "matched", gold: "contradicted", note: "record says five business days; 'two' occurs elsewhere in it" },
  { id: "c-only-turkey", claim: "Zanzibar Textiles sells only in Turkey.", evidence: ["z-markets"], provenance: "matched", gold: "contradicted", note: "the superseded version's claim; current says US + Europe" },
  { id: "c-size", claim: "Standard sizes go up to 300x400 cm.", evidence: ["z-sizes"], provenance: "matched", gold: "contradicted", note: "record says up to 200x300" },
  { id: "c-machine", claim: "Rugs can be machine washed at home.", evidence: ["z-care"], provenance: "matched", gold: "contradicted", note: "record says spot-clean / professional washing" },

  /* ── unavailable ── */
  { id: "u-unreadable", claim: "Our rugs are made from undyed sheep wool.", evidence: null, provenance: "unavailable", gold: "unavailable", note: "the generation record could not be read" },
];

const TEXT = new Map(FACTS.map((f) => [f.key, f.statement]));

export function evidenceOf(c: GroundingCase): ClaimEvidence {
  if (c.evidence === null) return null;
  return { provenance: c.provenance, items: c.evidence.map((key) => ({ nodeId: key, text: TEXT.get(key)! })) };
}

export interface Measured {
  readonly rows: readonly { readonly c: GroundingCase; readonly out: ClaimSupport }[];
  readonly unsupportedTotal: number;
  /** Unsupported (insufficient + contradicted) predicted insufficient or contradicted. */
  readonly detected: number;
  /** THE DANGEROUS ERROR: an unsupported or unavailable case predicted supported. */
  readonly falseSupported: number;
  readonly supportedTotal: number;
  readonly supportedRetained: number;
  /** Gold-supported predicted insufficient: over-blocking, safe but costly. */
  readonly supportedOverBlocked: number;
  readonly undetermined: number;
  readonly contradictedTotal: number;
  readonly contradictedDetected: number;
  readonly unavailableCorrect: number;
}

export function measure(assess: typeof assessClaimSupport = assessClaimSupport): Measured {
  const rows = CASES.map((c) => ({ c, out: assess(c.claim, evidenceOf(c)) }));
  const unsupported = rows.filter((r) => r.c.gold === "insufficient" || r.c.gold === "contradicted");
  const supported = rows.filter((r) => r.c.gold === "supported");
  const contradicted = rows.filter((r) => r.c.gold === "contradicted");
  return {
    rows,
    unsupportedTotal: unsupported.length,
    detected: unsupported.filter((r) => r.out.status === "insufficient" || r.out.status === "contradicted").length,
    falseSupported: rows.filter((r) => r.c.gold !== "supported" && r.out.status === "supported").length,
    supportedTotal: supported.length,
    supportedRetained: supported.filter((r) => r.out.status === "supported").length,
    supportedOverBlocked: supported.filter((r) => r.out.status === "insufficient").length,
    undetermined: rows.filter((r) => r.out.status === "undetermined").length,
    contradictedTotal: contradicted.length,
    contradictedDetected: contradicted.filter((r) => r.out.status === "contradicted").length,
    unavailableCorrect: rows.filter((r) => r.c.gold === "unavailable" && r.out.status === "unavailable").length,
  };
}

if (process.argv[1]?.endsWith("benchmark.ts")) {
  const m = measure();
  for (const { c, out } of m.rows) {
    const detail = out.status === "insufficient" && out.reason === "unsupported-signal" ? ` [${out.signals.join(",")}]` : "";
    console.log(`${c.id.padEnd(22)} gold=${c.gold.padEnd(12)} out=${out.status}${detail}`);
  }
  const pct = (a: number, b: number) => `${a}/${b} (${b ? Math.round((100 * a) / b) : 0}%)`;
  console.log(`\nunsupported-claim detection recall: ${pct(m.detected, m.unsupportedTotal)}`);
  console.log(`false-supported:                    ${pct(m.falseSupported, m.rows.length)}`);
  console.log(`supported retention:                ${pct(m.supportedRetained, m.supportedTotal)}`);
  console.log(`supported over-blocked:             ${pct(m.supportedOverBlocked, m.supportedTotal)}`);
  console.log(`undetermined (abstention):          ${pct(m.undetermined, m.rows.length)}`);
  console.log(`contradiction labelled:             ${pct(m.contradictedDetected, m.contradictedTotal)}`);
  console.log(`unavailable kept unavailable:       ${m.unavailableCorrect}/1`);
}
