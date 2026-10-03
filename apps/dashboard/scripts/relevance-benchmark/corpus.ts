/*
 * RELEVANCE-0 benchmark corpus. SYNTHETIC BENCHMARK DATA — NOT ORGANIZATIONAL TRUTH.
 *
 * "Zanzibar Textiles" is a fictional organization (the repository's test fixtures already use the
 * name "Zanzibar"). No statement here is a real organization's Knowledge, and no production record
 * was copied. The FAILURE MODES are taken from real findings — an English instruction against Turkish
 * Knowledge, an organization name that appears in every record, a voice-only instruction that
 * retrieval cannot ground, an internal fact that out-ranks the right one — but every text is written
 * for this file. It is loaded only into disposable databases by the benchmark and its tests.
 *
 * THREE THINGS ARE KEPT APART, ON PURPOSE:
 *
 *   FACTS         what the synthetic organization holds, with each version's language
 *   ELIGIBILITY   each version's standing — current, Governance-rejected, ratified, public use —
 *                 which decides whether it MAY participate in a purpose
 *   GOLD          which facts a human judged RELEVANT to each task, regardless of eligibility
 *
 * A fact can be relevant and ineligible (an internal pricing fact, for a pricing post). The benchmark
 * must be able to show that such a fact never reaches a public-content candidate set, so gold labels
 * deliberately ignore eligibility and eligibility deliberately ignores tasks.
 */
import type { PublicUseState } from "../../src/features/knowledge-public-use/contracts";
import type { TaskGroundingRequirement } from "../../src/features/knowledge-retrieval/relevance";

export const SYNTHETIC_BENCHMARK = true as const;
export const SYNTHETIC_ORGANIZATION = "Zanzibar Textiles";

export type Lang = "tr" | "en";

export interface BenchFact {
  /** The fact key. Unique per tenant. */
  readonly key: string;
  readonly domain: string;
  readonly lang: Lang;
  readonly title: string;
  readonly statement: string;
}

/** A non-current version of a fact: inserted as a node, never as the fact's active node. */
export interface BenchSupersededVersion {
  readonly factKey: string;
  readonly lang: Lang;
  readonly title: string;
  readonly statement: string;
}

export interface BenchEligibility {
  /** Governance rejected this exact current version on the truth axis. */
  readonly rejected: boolean;
  /** Governance ratified this exact current version. */
  readonly ratified: boolean;
  /** Governance's public-use state for this exact current version. */
  readonly publicUse: PublicUseState;
}

export type QueryClass =
  | "tr-to-tr"
  | "en-to-tr"
  | "tr-to-en"
  | "en-to-en"
  | "paraphrase"
  | "low-overlap"
  | "company-name"
  | "generic-noise"
  | "multi-relevant"
  | "no-relevant"
  | "internal-distractor"
  | "superseded"
  | "rejected"
  | "public-use-unknown"
  | "public-use-denied"
  | "public-use-allowed"
  | "unratified"
  | "outranking"
  | "voice-only";

export interface BenchQuery {
  readonly id: string;
  readonly lang: Lang;
  readonly task: string;
  readonly classes: readonly QueryClass[];
  /** Facts a human judged relevant to this task. Eligibility is NOT considered here. */
  readonly gold: readonly string[];
  /** Whether the task, as stated, needs organizational facts. Declared, as a preparing caller would. */
  readonly grounding: TaskGroundingRequirement;
}

/* ── facts ────────────────────────────────────────────────────────────────── */

export const FACTS: readonly BenchFact[] = [
  /* Products, materials, markets, logistics — the material public content is about. */
  { key: "z-products", domain: "products", lang: "tr", title: "Zanzibar Textiles ürün yelpazesi",
    statement: "Zanzibar Textiles el dokuması kilimler, yün halılar ve minder kılıfları satar." },
  { key: "z-materials", domain: "products", lang: "en", title: "Zanzibar Textiles materials",
    statement: "Zanzibar Textiles rugs are made from undyed sheep wool on cotton warps." },
  { key: "z-sizes", domain: "products", lang: "tr", title: "Kilim ölçüleri",
    statement: "Kilimler 60x90 cm'den 200x300 cm'ye kadar standart ölçülerde sunulur." },
  { key: "z-care", domain: "products", lang: "en", title: "Rug care",
    statement: "Spot-clean with cold water; professional washing is recommended once a year." },
  { key: "z-custom", domain: "products", lang: "en", title: "Custom orders",
    statement: "Custom sizes can be ordered; production takes six to eight weeks." },
  { key: "z-origin", domain: "products", lang: "tr", title: "Dokuma yeri",
    statement: "Zanzibar Textiles kilimlerinin tamamı Konya'da dokunur." },
  { key: "z-heritage", domain: "brand", lang: "en", title: "Zanzibar Textiles heritage",
    statement: "Every Zanzibar Textiles rug is hand-knotted by master artisans with generations of tradition." },
  { key: "z-markets", domain: "market", lang: "tr", title: "Zanzibar Textiles satış pazarları",
    statement: "Zanzibar Textiles ağırlıklı olarak Amerika Birleşik Devletleri'ne, ayrıca Avrupa ülkelerine satış yapar." },
  { key: "z-shipping", domain: "logistics", lang: "en", title: "Shipping times",
    statement: "Orders ship from Istanbul within five business days; international delivery takes two to three weeks." },
  { key: "z-returns", domain: "logistics", lang: "tr", title: "İade koşulları",
    statement: "Müşteriler ürünü teslimden sonra 30 gün içinde iade edebilir; iade kargosu müşteriye aittir." },
  { key: "z-brand", domain: "brand", lang: "tr", title: "Zanzibar Textiles marka konumlandırması",
    statement: "Zanzibar Textiles kendini sade, zamansız ve el emeğine saygı duyan bir ev tekstili markası olarak konumlandırmayı hedefler." },

  /* Internal and commercially sensitive: relevant to some tasks, never public grounding. */
  { key: "z-sourcing", domain: "operations", lang: "tr", title: "Zanzibar Textiles tedarik ve fiyatlama",
    statement: "Zanzibar Textiles ürünleri Uşak ve Kayseri'deki atölyelerden toptan alır ve maliyetin üzerine yüzde kırk marj ekler." },
  { key: "z-objectives", domain: "strategy", lang: "tr", title: "Zanzibar Textiles yıllık hedefleri",
    statement: "Zanzibar Textiles'ın bu yılki öncelikli hedefi sosyal medya paylaşımlarıyla marka bilinirliğini ve satışları artırmaktır." },
  { key: "z-weaver-pay", domain: "operations", lang: "en", title: "Weaver compensation",
    statement: "Workshop weavers are paid per finished square metre at an internally agreed rate." },

  /* Same organization name, nothing to do with content. */
  { key: "z-office-coffee", domain: "office", lang: "tr", title: "Zanzibar Textiles ofis düzeni",
    statement: "Zanzibar Textiles ofisindeki kahve makinesi her cuma temizlenir." },
  { key: "z-passwords", domain: "it", lang: "en", title: "Zanzibar Textiles password policy",
    statement: "Zanzibar Textiles staff change their email passwords every ninety days." },
  { key: "z-meetings", domain: "office", lang: "tr", title: "Zanzibar Textiles ekip toplantısı",
    statement: "Zanzibar Textiles haftalık ekip toplantısı pazartesi sabahı yapılır." },

  /* Generic content words in an unrelated record. */
  { key: "z-social-policy", domain: "hr", lang: "en", title: "Personal social media policy",
    statement: "Employees must not post about unreleased products on their personal social media accounts." },
  { key: "z-instagram-access", domain: "it", lang: "tr", title: "Instagram hesap erişimi",
    statement: "Instagram hesabının şifresi yalnızca pazarlama sorumlusunda bulunur." },
];

/** A superseded version of `z-markets`, which must be structurally unreachable. */
export const SUPERSEDED: readonly BenchSupersededVersion[] = [
  { factKey: "z-markets", lang: "tr", title: "Zanzibar Textiles satış pazarları (eski sürüm)",
    statement: "Zanzibar Textiles yalnızca Türkiye'de satış yapar." },
];

/* ── eligibility fixtures (separate from gold) ─────────────────────────────── */

const ALLOWED: BenchEligibility = { rejected: false, ratified: true, publicUse: "allowed" };
const DENIED: BenchEligibility = { rejected: false, ratified: true, publicUse: "denied" };
const UNKNOWN: BenchEligibility = { rejected: false, ratified: true, publicUse: "unknown" };

export const ELIGIBILITY: Readonly<Record<string, BenchEligibility>> = {
  "z-products": ALLOWED,
  "z-materials": ALLOWED,
  "z-sizes": ALLOWED,
  "z-care": ALLOWED,
  /* Cleared for public use but never ratified: public grounding still withholds it. */
  "z-custom": { rejected: false, ratified: false, publicUse: "allowed" },
  /* An unverified claim nobody decided on. */
  "z-origin": { rejected: false, ratified: false, publicUse: "unknown" },
  /* Governance rejected it as untrue. A rejected version cannot receive a public-use decision. */
  "z-heritage": { rejected: true, ratified: false, publicUse: "unknown" },
  "z-markets": ALLOWED,
  "z-shipping": ALLOWED,
  "z-returns": UNKNOWN,
  "z-brand": ALLOWED,
  "z-sourcing": DENIED,
  "z-objectives": DENIED,
  "z-weaver-pay": DENIED,
  "z-office-coffee": UNKNOWN,
  "z-passwords": UNKNOWN,
  "z-meetings": UNKNOWN,
  "z-social-policy": UNKNOWN,
  "z-instagram-access": UNKNOWN,
};

/* ── tasks and gold relevance ─────────────────────────────────────────────── */

export const QUERIES: readonly BenchQuery[] = [
  { id: "q01", lang: "tr", task: "Zanzibar Textiles hangi ürünleri satıyor?", classes: ["tr-to-tr", "company-name"], gold: ["z-products"], grounding: "organizational-facts-required" },
  { id: "q02", lang: "en", task: "Write an Instagram caption about our handwoven kilims", classes: ["en-to-tr", "generic-noise"], gold: ["z-products", "z-materials"], grounding: "organizational-facts-required" },
  { id: "q03", lang: "en", task: "Which countries do you sell to?", classes: ["en-to-tr", "low-overlap"], gold: ["z-markets"], grounding: "organizational-facts-required" },
  { id: "q04", lang: "tr", task: "Ürünler hangi malzemeden yapılıyor?", classes: ["tr-to-en"], gold: ["z-materials"], grounding: "organizational-facts-required" },
  { id: "q05", lang: "tr", task: "Siparişler ne kadar sürede teslim edilir?", classes: ["tr-to-en"], gold: ["z-shipping"], grounding: "organizational-facts-required" },
  { id: "q06", lang: "en", task: "How long does international delivery take?", classes: ["en-to-en"], gold: ["z-shipping"], grounding: "organizational-facts-required" },
  { id: "q07", lang: "tr", task: "Beğenmezsem geri gönderebilir miyim?", classes: ["tr-to-tr", "paraphrase", "low-overlap", "public-use-unknown"], gold: ["z-returns"], grounding: "organizational-facts-required" },
  { id: "q08", lang: "tr", task: "Ürünleriniz fabrikada mı üretiliyor yoksa elde mi?", classes: ["tr-to-tr", "paraphrase", "low-overlap"], gold: ["z-products"], grounding: "organizational-facts-required" },
  { id: "q09", lang: "en", task: "Are your rugs machine-made?", classes: ["en-to-tr", "low-overlap"], gold: ["z-products"], grounding: "organizational-facts-required" },
  { id: "q10", lang: "tr", task: "Zanzibar Textiles için bir Instagram gönderisi hazırla", classes: ["company-name", "generic-noise"], gold: ["z-brand", "z-products"], grounding: "no-organizational-facts-required" },
  { id: "q11", lang: "en", task: "Write a social media post for Instagram", classes: ["en-to-tr", "generic-noise"], gold: ["z-brand"], grounding: "no-organizational-facts-required" },
  { id: "q12", lang: "en", task: "Describe our kilims for American buyers: material, sizes and shipping time", classes: ["en-to-tr", "multi-relevant"], gold: ["z-products", "z-materials", "z-sizes", "z-shipping", "z-markets"], grounding: "organizational-facts-required" },
  { id: "q13", lang: "tr", task: "Kilimlerimizin ölçülerini ve bakımını anlatan bir paylaşım yaz", classes: ["tr-to-tr", "tr-to-en", "multi-relevant"], gold: ["z-sizes", "z-care", "z-products"], grounding: "organizational-facts-required" },
  { id: "q14", lang: "tr", task: "Mağazanızda hediye paketi yapıyor musunuz?", classes: ["no-relevant"], gold: [], grounding: "organizational-facts-required" },
  { id: "q15", lang: "en", task: "Do you offer a loyalty points programme?", classes: ["no-relevant"], gold: [], grounding: "organizational-facts-required" },
  { id: "q16", lang: "tr", task: "Bu metni markamızın kendi tonuna uyarla", classes: ["voice-only", "low-overlap"], gold: ["z-brand"], grounding: "no-organizational-facts-required" },
  { id: "q17", lang: "en", task: "Write a post explaining how we price our rugs", classes: ["en-to-tr", "internal-distractor", "public-use-denied"], gold: ["z-sourcing"], grounding: "organizational-facts-required" },
  { id: "q18", lang: "tr", task: "Ürün fiyatlarına ne kadar marj ekliyoruz?", classes: ["tr-to-tr", "internal-distractor", "public-use-denied"], gold: ["z-sourcing"], grounding: "organizational-facts-required" },
  { id: "q19", lang: "tr", task: "Zanzibar Textiles nerelere satış yapıyor?", classes: ["tr-to-tr", "superseded", "public-use-allowed"], gold: ["z-markets"], grounding: "organizational-facts-required" },
  { id: "q20", lang: "en", task: "Tell customers our rugs are hand-knotted by master artisans", classes: ["en-to-en", "rejected"], gold: ["z-heritage", "z-products"], grounding: "organizational-facts-required" },
  { id: "q21", lang: "tr", task: "İade koşullarınızı anlatan bir gönderi yaz", classes: ["tr-to-tr", "public-use-unknown"], gold: ["z-returns"], grounding: "organizational-facts-required" },
  { id: "q22", lang: "en", task: "Can I order a custom size?", classes: ["en-to-en", "unratified"], gold: ["z-custom"], grounding: "organizational-facts-required" },
  { id: "q23", lang: "tr", task: "Kilimleriniz nerede dokunuyor?", classes: ["tr-to-tr", "unratified", "low-overlap"], gold: ["z-origin"], grounding: "organizational-facts-required" },
  { id: "q24", lang: "tr", task: "Marka bilinirliğini artıracak, kilimlerimizi anlatan bir sosyal medya paylaşımı yaz", classes: ["tr-to-tr", "outranking", "internal-distractor"], gold: ["z-products", "z-brand"], grounding: "organizational-facts-required" },
  { id: "q25", lang: "en", task: "Describe our brand: timeless, simple and respectful of handwork", classes: ["en-to-tr", "paraphrase"], gold: ["z-brand"], grounding: "organizational-facts-required" },
  { id: "q26", lang: "tr", task: "Kilim yıkanır mı?", classes: ["tr-to-en", "low-overlap"], gold: ["z-care"], grounding: "organizational-facts-required" },
  { id: "q27", lang: "en", task: "What is your return policy?", classes: ["en-to-tr", "public-use-unknown"], gold: ["z-returns"], grounding: "organizational-facts-required" },
  { id: "q28", lang: "tr", task: "Kilimlerimizden bahset", classes: ["tr-to-tr"], gold: ["z-products"], grounding: "organizational-facts-required" },
  { id: "q29", lang: "en", task: "What sizes are available?", classes: ["en-to-tr"], gold: ["z-sizes"], grounding: "organizational-facts-required" },
  { id: "q30", lang: "tr", task: "Bugün hava nasıl?", classes: ["no-relevant"], gold: [], grounding: "no-organizational-facts-required" },
];

/**
 * Tenant B: a second synthetic organization whose records share keys and wording with A's. A
 * candidate from B in any of A's sets is a tenant-isolation failure, whatever its relevance.
 */
export const OTHER_TENANT_FACTS: readonly BenchFact[] = [
  { key: "z-products", domain: "products", lang: "tr", title: "Zanzibar Textiles ürün yelpazesi",
    statement: "Zanzibar Textiles kilimler, halılar ve el dokuması minderler satar; bu kayıt başka bir kuruluşa aittir." },
  { key: "z-markets", domain: "market", lang: "tr", title: "Zanzibar Textiles satış pazarları",
    statement: "Zanzibar Textiles yalnızca Japonya'ya satış yapar; bu kayıt başka bir kuruluşa aittir." },
  { key: "z-sourcing", domain: "operations", lang: "tr", title: "Zanzibar Textiles tedarik ve fiyatlama",
    statement: "Zanzibar Textiles ürünlere yüzde on marj ekler; bu kayıt başka bir kuruluşa aittir." },
];
