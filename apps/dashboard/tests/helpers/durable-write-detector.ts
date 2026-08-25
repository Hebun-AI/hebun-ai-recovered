/*
 * tests/helpers/durable-write-detector.ts — "does this source perform a DURABLE WRITE?", once.
 *
 * ── WHY THIS EXISTS AS ONE DEFINITION (INT-5B1) ──────────────────────────────
 *
 * Two firewalls now ask the question — INT-5A's grounding firewall and INT-5B1's provider-read
 * firewall — and a security predicate that exists twice is a security predicate that will one day
 * disagree with itself. It lives here so both roots are measured by the same rule and one repair
 * fixes both.
 *
 * ── WHY IT IS NOT `\.insert\(|\.update\(|\.delete\(` ────────────────────────
 *
 * It was, through INT-5A, and it accused code of writing a database when it did not.
 * `provider-github/github-app-jwt.server.ts` mints the App assertion with
 * `createSign("RSA-SHA256").update(signingInput).sign(...)` — a CRYPTO call — and the bare pattern
 * read it as an UPDATE statement. Measured across `src/`, the bare pattern flagged 78 files where
 * 36 write; the remaining 42 are `Set.delete`, `Map.delete`, `cipher.update`, and in-memory
 * repository abstractions that import no database at all.
 *
 * That direction of error is the dangerous one over time: a firewall that cries wolf is one
 * somebody eventually relaxes, and this one would have blocked a provider-read subgraph over a
 * signature.
 *
 * ── THE SHAPE, NARROWED TO HOW THIS REPOSITORY ACTUALLY WRITES ──────────────
 *
 *   BUILDER  `.insert(table)` / `.update(table)` / `.delete(table)` continuing into `.values(`,
 *            `.set(`, `.where(` or `.returning(` — the drizzle chain, across line breaks, which is
 *            how every write in `src/` is spelled. `createSign(...).update(x).sign(...)` continues
 *            into `.sign(`, so it does not match; `Set.delete(x)` continues into nothing.
 *
 *   HANDLE   the same three verbs called directly on a database or transaction handle, so a future
 *            `db.delete(table)` with no chained call still bites.
 *
 * Against the released tree the narrowed rule flags 36 files and adds NONE the bare rule missed, so
 * it removes false accusations only. `tests/int5b1-flow/write-detector.ts` proves both directions.
 */

/** Comments stripped: a guard must not fire on a paragraph that explains it. */
export function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

export const DRIZZLE_WRITE_CHAIN =
  /\.\s*(?:insert|update|delete)\s*\(\s*[A-Za-z_$][A-Za-z0-9_$.]*\s*\)\s*(?:\r?\n\s*)*\.\s*(?:values|set|where|returning)\s*\(/;

export const DATABASE_HANDLE_WRITE =
  /\b(?:db|tx|trx|database|conn|connection)\s*\.\s*(?:insert|update|delete)\s*\(/;

/** True when this source performs a durable write in EXECUTABLE code. */
export function performsDurableWrite(source: string): boolean {
  const code = codeOf(source);
  return DRIZZLE_WRITE_CHAIN.test(code) || DATABASE_HANDLE_WRITE.test(code);
}
