/*
 * knowledge-retrieval/claim-support.ts — GROUNDING SUFFICIENCY GS-0: does the evidence SUPPLIED to a
 * generation support ONE claim the generation states? Pure, deterministic, provider-free. NOT WIRED.
 *
 * ── WHAT THE ANSWER IS ALLOWED TO BE ─────────────────────────────────────────
 *
 *   supported      ONLY when the claim is, after normalization, a whole sentence of one supplied
 *                  record. That is the one support relationship text comparison can prove. The
 *                  verdict names that record and is shaped as the `verified` + `deterministic`
 *                  support verdict RELEVANCE-2A's grounding port (`./grounding`) already accepts.
 *   insufficient   nothing was supplied, or the claim states something of a kind (a number, a
 *                  name, a superlative, a universal, a production method, a cause, a current
 *                  state) that NO supplied record states at all. Absence of the signal is checkable;
 *                  that is the whole basis of the verdict, and each one names its signals.
 *   undetermined   everything else. Paraphrase, translation, narrowing, contradiction, joint support
 *                  across records — all semantic, none decidable here. A guess would be a false
 *                  `supported`, the one error public content cannot afford, so this abstains.
 *   unavailable    the evidence could not be read. Never an absence.
 *
 * `contradicted` belongs to the contract (a human or a future semantic evaluator may establish it);
 * nothing here produces it — no text rule tells "contradicts" from "is about something else".
 *
 * ── WHAT IS NOT AN INPUT TO SUPPORT ──────────────────────────────────────────
 *
 * How the evidence was chosen (`matched`, `bounded-universe`, …) is carried only so that an
 * unavailable read stays unavailable. Ratification, public-use clearance and relevance never reach
 * this module: a fact can be all three and still not say what the claim says.
 *
 * No database, clock, network, model, eligibility or authority. Nothing in `src` imports this module.
 */
import type { RetrievalEvidenceStatus } from "./evidence";
import { foldTurkish } from "./query-normalization";

export interface ClaimEvidenceItem {
  readonly nodeId: string;
  /** The record's statement as supplied to generation. */
  readonly text: string;
}

/** What was supplied to the generation. `null` = the generation record could not be read. */
export type ClaimEvidence = {
  readonly provenance: RetrievalEvidenceStatus;
  readonly items: readonly ClaimEvidenceItem[];
} | null;

export type UnsupportedSignal =
  | "number"
  | "proper-noun"
  | "superlative"
  | "universal"
  | "production-method"
  | "causal"
  | "current-state";

export type ClaimSupport =
  | {
      readonly status: "supported";
      readonly verifierKind: "deterministic";
      readonly verifierId: typeof CLAIM_SUPPORT_VERIFIER_ID;
      readonly supportedNodeIds: readonly string[];
    }
  | { readonly status: "insufficient"; readonly reason: "no-evidence" }
  | { readonly status: "insufficient"; readonly reason: "unsupported-signal"; readonly signals: readonly UnsupportedSignal[] }
  /** Contract only: produced by a human or semantic evaluator, never by this module. */
  | { readonly status: "contradicted"; readonly contradictedBy: readonly string[] }
  | { readonly status: "undetermined" }
  | { readonly status: "unavailable" };

export const CLAIM_SUPPORT_VERIFIER_ID = "gs0-deterministic-sentence-identity" as const;

/*
 * ponytail: closed bilingual (en/tr) word lists, measured in scripts/grounding-benchmark. They can
 * only DETECT unsupported kinds of statement; they never produce `supported`. A missed word is an
 * abstention, not a false support. Grow only against a labelled benchmark case.
 */
const LEXICON: Readonly<Record<Exclude<UnsupportedSignal, "number" | "proper-noun">, readonly string[]>> = {
  superlative: [
    "best", "finest", "leading", "top", "only", "unique", "unmatched", "award", "premium", "luxury", "world class",
    "en iyi", "en kaliteli", "lider", "tek", "essiz", "benzersiz", "odullu", "luks",
  ],
  universal: [
    "every", "each", "all", "always", "never", "none", "entire",
    "her", "hepsi", "tamami", "tum", "butun", "daima", "asla", "hicbir",
  ],
  "production-method": [
    "handmade", "hand made", "hand knotted", "handknotted", "hand woven", "handwoven", "artisan", "master", "organic",
    "natural dye", "plant dye", "vegetable dye", "antique", "vintage", "sustainable", "fair trade",
    "el dokumasi", "el yapimi", "el dugum", "usta", "zanaatkar", "organik", "dogal boya", "bitkisel boya", "antika",
  ],
  causal: ["because", "therefore", "thanks to", "which is why", "cunku", "sayesinde", "bu yuzden", "bu nedenle"],
  "current-state": [
    "now", "currently", "today", "this year", "at the moment", "new", "latest",
    "simdi", "su anda", "bugun", "bu yil", "artik", "yeni",
  ],
};

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "twenty", "thirty", "forty", "fifty", "hundred", "thousand", "million", "dozen", "half", "double", "twice",
  "iki", "uc", "dort", "bes", "alti", "yedi", "sekiz", "dokuz", "yirmi", "otuz", "kirk", "elli", "yuz bin", "milyon",
];

/** Folded, lower-cased, diacritic-free text as ` word word ` so phrases match on word boundaries. */
function norm(text: string): string {
  const folded = foldTurkish(text).toLocaleLowerCase("en").normalize("NFD").replace(/\p{M}/gu, "");
  return ` ${folded.replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

/**
 * A term occurs: under 5 letters as whole words; otherwise also as a prefix, so suffixes still match
 * ("zanaatkarlar", "plant dyes") without "one" matching "online".
 */
function occurs(haystack: string, term: string): boolean {
  return haystack.includes(term.length < 5 ? ` ${term} ` : ` ${term}`);
}

const sentencesOf = (text: string) => text.split(/[.;!?]+/).map(norm).filter((s) => s.trim().length > 0);
const numbersOf = (text: string) => new Set(text.match(/\d+(?:[.,]\d+)*/g)?.map((n) => n.replace(/[.,]/g, "")) ?? []);

/** Capitalized words that do not start a sentence: the deterministic stand-in for a name. */
function properNounsOf(claim: string): string[] {
  const out: string[] = [];
  for (const sentence of claim.split(/[.;!?]+/)) {
    const words = sentence.trim().split(/\s+/);
    for (const word of words.slice(1)) {
      const bare = word.replace(/[^\p{L}'’]/gu, "").split(/['’]/)[0] ?? "";
      if (bare.length > 1 && /^\p{Lu}/u.test(bare)) out.push(norm(bare).trim());
    }
  }
  return out;
}

export function assessClaimSupport(claim: string, evidence: ClaimEvidence): ClaimSupport {
  if (evidence === null || evidence.provenance === "unavailable") return { status: "unavailable" };
  if (evidence.items.length === 0) return { status: "insufficient", reason: "no-evidence" };

  const claimSentences = sentencesOf(claim);
  if (claimSentences.length === 0) return { status: "undetermined" };

  /* SUPPORTED: every claim sentence is a whole sentence of ONE supplied record. */
  for (const item of evidence.items) {
    const own = new Set(sentencesOf(item.text));
    if (claimSentences.every((sentence) => own.has(sentence))) {
      return {
        status: "supported",
        verifierKind: "deterministic",
        verifierId: CLAIM_SUPPORT_VERIFIER_ID,
        supportedNodeIds: [item.nodeId],
      };
    }
  }

  /* INSUFFICIENT: the claim states a kind of thing nothing supplied states. */
  const all = evidence.items.map((item) => item.text).join(" . ");
  const supplied = norm(all);
  const said = norm(claim);
  const signals = new Set<UnsupportedSignal>();

  const suppliedNumbers = numbersOf(all);
  if ([...numbersOf(claim)].some((n) => !suppliedNumbers.has(n))) signals.add("number");
  if (NUMBER_WORDS.some((w) => occurs(said, w) && !occurs(supplied, w))) signals.add("number");
  if (properNounsOf(claim).some((name) => !occurs(supplied, name))) signals.add("proper-noun");
  for (const [signal, terms] of Object.entries(LEXICON) as [UnsupportedSignal, readonly string[]][]) {
    if (terms.some((term) => occurs(said, term) && !occurs(supplied, term))) signals.add(signal);
  }

  return signals.size > 0
    ? { status: "insufficient", reason: "unsupported-signal", signals: [...signals].sort() }
    : { status: "undetermined" };
}
