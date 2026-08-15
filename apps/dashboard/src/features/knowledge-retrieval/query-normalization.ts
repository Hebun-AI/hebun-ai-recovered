/*
 * knowledge-retrieval/query-normalization.ts — turning a Turkish question into a search query.
 *
 * ── THE TWO DEFECTS THIS EXISTS TO SURVIVE, BOTH MEASURED IN KR2 ─────────────
 *
 * 1. CONJUNCTIVE QUERY BUILDING IS FATAL, AND IT LOOKS LIKE A LANGUAGE PROBLEM.
 *    `plainto_tsquery` ANDs every term. "yıllık izin talebi KİME gönderilir" then fails against a
 *    record holding four of the five words, because the fifth is a question word no policy uses.
 *    Measured: 4.3% Recall@1 and 95.7% zero-result — which reads as "Turkish full-text search does
 *    not work" and is not true. The same corpus, the same gold set, OR-joined: 67.4% Recall@1.
 *    So the terms are OR-ed and `ts_rank_cd` is left to reward the records that match more of them.
 *
 * 2. POSTGRESQL'S `turkish` CONFIGURATION SILENTLY FAILS ON THE DOTTED CAPITAL İ.
 *      to_tsvector('turkish', 'İZİN')  →  'İzİn'   ← neither lowercased nor stemmed
 *      to_tsvector('turkish', 'izin')  →  'iz'
 *      to_tsvector('turkish', 'ızın')  →  'ız'     ← does not meet 'iz' either
 *    An uppercase Turkish query matches nothing at all, and nothing in the result would say why.
 *
 * ── WHY `translate()` AND NOT `unaccent` ─────────────────────────────────────
 *
 * KR2's winning representation folded the Turkish letters with `unaccent`. That works, and it costs
 * an extension the canonical database does not have. `translate()` is a PostgreSQL BUILT-IN, and on
 * this corpus it is not merely close to `unaccent` — it is IDENTICAL on every metric measured
 * (Recall@1/3/5, MRR, zero-result, distractor rate, domain confusion), because the only characters
 * Turkish text needs folded are exactly the ones the table below covers.
 *
 * It is also IMMUTABLE, which `unaccent` is not, so `to_tsvector('turkish', translate(...))` can back
 * a GIN index later. The expression that needed a migration to be indexed no longer does.
 *
 * BOUNDED LIMITATION, stated rather than discovered later: this folds the THIRTEEN Turkish letters
 * and nothing else. A tenant whose knowledge contains é, à, ñ or ø keeps those characters as written.
 * They still match when the question spells them the same way; only cross-form matching is lost.
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────────
 *
 * It does not rewrite the user's meaning, expand synonyms, translate, spell-correct, or call a model.
 * Case folding and diacritic folding are the whole of it. The verbatim question is preserved for the
 * trigram component and for anything that needs to quote what was actually asked.
 *
 * Pure. No I/O, no clock, no database, no network.
 */

/**
 * The Turkish fold table. Source and target MUST stay the same length — `translate()` maps
 * character-for-character and a mismatch silently drops characters.
 *
 *   Ç Ğ İ I Ö Ş Ü ç ğ ı ö ş ü   (13)
 *   C G I I O S U c g i o s u   (13)
 *
 * `İ` and `I` both become `I` so the dotted and dotless capitals converge; `to_tsvector` lowercases
 * afterwards, so both arrive as `i` and meet `ı`→`i` from the lowercase half. That convergence is
 * the entire fix for defect 2 above.
 */
export const TURKISH_FOLD_FROM = "ÇĞİIÖŞÜçğıöşü";
export const TURKISH_FOLD_TO = "CGIIOSUcgiosu";

/**
 * The SQL fragment that folds an expression. Kept here, beside the table it uses, so the repository
 * cannot drift into folding one side of a comparison and not the other.
 */
export function foldSql(expression: string): string {
  return `translate(${expression}, '${TURKISH_FOLD_FROM}', '${TURKISH_FOLD_TO}')`;
}

/** The same fold in TypeScript, for the pure layer and for tests that must not need a database. */
export function foldTurkish(value: string): string {
  let out = "";
  for (const character of value) {
    const index = TURKISH_FOLD_FROM.indexOf(character);
    out += index === -1 ? character : TURKISH_FOLD_TO[index];
  }
  return out;
}

/**
 * Query words that carry no retrieval signal in a Turkish question.
 *
 * DELIBERATELY TINY, and deliberately only interrogatives and pronouns. This is not a stop-word list
 * for the corpus — PostgreSQL's `turkish` configuration already owns that — it exists because a
 * question word like "kime" or "nasıl" appears in the QUESTION and essentially never in the POLICY,
 * so OR-ing it in adds noise to the rank without ever helping. Removing content words here would be
 * rewriting the user's meaning, which is forbidden; these are not content words.
 */
const QUESTION_WORDS: ReadonlySet<string> = new Set([
  "kim", "kime", "kimin", "kimde", "kimi",
  "ne", "neyi", "neye", "neler", "nedir", "nelerdir",
  "nasıl", "nasil", "niye", "neden", "nicin", "niçin",
  "hangi", "hangisi", "kac", "kaç",
  "mi", "mı", "mu", "mü", "mıdır", "midir",
  "ve", "veya", "ile", "için", "icin",
]);

/**
 * Tokens `websearch_to_tsquery` would read as operators rather than as words. Stripped so a question
 * containing a dash or a quote cannot accidentally negate or phrase-bind part of itself.
 */
const OPERATORWISH = /^[-+"'()]+|[-+"')(]+$/g;

/** English boolean keywords `websearch_to_tsquery` interprets. A Turkish query rarely means them. */
const RESERVED = /^(or|and|not)$/i;

/**
 * A token must contain at least one letter or digit to be searchable.
 *
 * Without this, a question of pure punctuation ("???") survives normalization, `orForm` becomes
 * "???", `websearch_to_tsquery` reduces it to an empty tsquery, `@@` matches nothing — and the
 * caller reports NO-MATCH, telling the operator their organization's knowledge does not cover a
 * question they never actually asked. The two states must not be reachable from one another, so the
 * emptiness has to be decided here rather than inferred from a zero-row result.
 */
const HAS_SEARCHABLE_CHARACTER = /[\p{L}\p{N}]/u;

export interface NormalizedQuery {
  /** Exactly what the human typed. Never modified. */
  readonly raw: string;
  /** The searchable tokens, folded and de-noised, in the order they were asked. */
  readonly tokens: readonly string[];
  /**
   * The tokens joined with " or ", ready for `websearch_to_tsquery`. Empty string when nothing
   * searchable survived — the caller must treat that as `empty-query`, never as a match-all.
   */
  readonly orForm: string;
  /** True when the question carried no searchable token at all. */
  readonly isEmpty: boolean;
}

/**
 * Normalize a question into a searchable OR form.
 *
 * Order matters and is deliberate: split on whitespace first (so punctuation attached to a word does
 * not split it), strip operator characters, fold the Turkish letters, drop question words, drop
 * reserved booleans, and only then join. Folding before the question-word check is what lets "NASIL"
 * and "nasıl" both be recognised as the same question word.
 */
export function normalizeQuery(raw: string): NormalizedQuery {
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.replace(OPERATORWISH, ""))
    .map((token) => foldTurkish(token))
    .filter((token) => token.length > 0)
    .filter((token) => HAS_SEARCHABLE_CHARACTER.test(token))
    .filter((token) => !RESERVED.test(token))
    /*
     * The question-word check runs on the LOWERCASED fold so "Kime"/"KİME"/"kime" are one word.
     * `toLowerCase()` is safe here because the fold has already removed every Turkish-specific
     * letter, so the notorious locale-dependent I/ı mapping cannot apply.
     */
    .filter((token) => !QUESTION_WORDS.has(token.toLowerCase()));

  return {
    raw,
    tokens,
    orForm: tokens.join(" or "),
    isEmpty: tokens.length === 0,
  };
}
