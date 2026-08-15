# Hebun — Knowledge Retrieval Runtime (KR3) — Closure

**Status:** implemented, verified, **uncommitted**. Awaiting the Director commit gate.
**Baseline:** `915b543` (`origin/main` = real remote `refs/heads/main`, 0 ahead / 0 behind).
**Schema delta:** none. **Migration delta:** none (24/24/24). **Extension delta:** none. **Dependency delta:** none.

---

## 1. What changed

Before this phase, the Knowledge evidence path took **no query**. Every Knowledge answer Heby gave
carried the same first fifty records of the tenant's corpus, ordered `domain_key, fact_key`,
regardless of what the human asked. `resolveKnowledgeEvidence(tenant, deps)` had nowhere to put a
question, and neither did `listKnowledgeSources` or `repo.listFacts`.

It now takes one:

```
validation.prompt
  → withKnowledge(resolutions, tenant, query, deps)      model-answer.server.ts
  → resolveKnowledgeEvidence(tenant, query, deps)        knowledge-evidence.server.ts
  → searchKnowledge(tenant, { queryText }, deps)         knowledge-read.server.ts
  → repo.searchFacts(scope, orQuery, rawQuery, now)      durable-knowledge-repository.server.ts
  → ONE SQL statement over the SAME tenant-scoped active-node join
```

Everything downstream is untouched: evidence assembly, grounding context, the model call, the
response validator, persistence, and the R2E kill switch. Retrieval changed **which records** are in
the resolution, not what a resolution is.

## 2. The measured basis

KR2 measured the winning representation as `FTS(turkish + unaccent) + pg_trgm`, hybrid-weighted
0.6 / 0.4, at 78.3% Recall@1 and 89.1% Recall@3 on a 172-fact synthetic Turkish corpus.

**Canonical `hebun_r1` has neither extension installed.** Proven, not assumed:

```
ERROR:  function unaccent(unknown) does not exist
ERROR:  function word_similarity(unknown, unknown) does not exist
```

Rather than turn an architecture gate into an extension migration, the prerequisite was re-measured.
`translate()` is a PostgreSQL **built-in** and folds the thirteen Turkish letters. On the same corpus
and the same 46-query gold set it is not merely close to `unaccent` — it is **identical on every
metric**:

| representation | R@1 | R@3 | R@5 | MRR | zero | needs |
|---|---|---|---|---|---|---|
| `translate()` fold + `turkish` FTS (OR) | 67.4% | 78.3% | 80.4% | 0.725 | 0% | **nothing** |
| `unaccent` + `turkish` FTS (OR) | 67.4% | 78.3% | 80.4% | 0.725 | 0% | `unaccent` |
| **shipped** (fold + shipped normalizer) | **69.6%** | **78.3%** | **80.4%** | **0.736** | **0%** | **nothing** |
| KR2 winner (`unaccent` + `pg_trgm`) | 78.3% | 89.1% | 91.3% | 0.827 | 0% | both |

`translate()` is also **IMMUTABLE**, so `to_tsvector('turkish', translate(...))` can back a GIN index
— which the `unaccent` expression could not (`functions in index expression must be marked
IMMUTABLE`). The prerequisite that looked like a migration turned out to remove one.

**`unaccent` is therefore unnecessary. Only `pg_trgm` buys anything**, and only typo tolerance:
+10.9pp Recall@1 overall, concentrated in the typo class (50% → 100% Recall@3). That remains an
open, Director-gated option — see §9.

## 3. Retrieval is derived; Knowledge remains authoritative

Retrieval owns candidate selection, eligibility, relevance, diversity, and its own explanation.
It owns no table, writes nothing, and persists nothing — a match score does not outlive the request.
There is still exactly **one** writer of `knowledge_nodes` / `knowledge_facts`, locked by an
assertion that greps the whole of `src/features` and `src/app`.

## 4. Eligibility is a gate; relevance is a score; neither is truth

Six dimensions stay separate and unflattened.

**Hard filters (disqualification, never a penalty):** tenant · active node only · `deleted_at IS NULL`
on both sides · lifecycle ∉ {archived, retired} · `effective_from ≤ now` where stated ·
`effective_until ≥ now` where stated.

**Never filtered, always reported:** provisional · draft · proposed · under-review · unratified ·
contested · stale · `textOriginUnverified` · deprecated. Filtering on ratification would return
nothing (canonical holds zero ratified rows); filtering on unverified origin would empty the corpus
(every authored and ingested record carries it).

Superseded versions need no rule: the join is on `active_knowledge_node_id`, so they are
unrepresentable as candidates rather than filtered out of them.

There is no `confidence`, no `truthScore`, no `knowledgeQualityScore`. The score's components stay
separate (`lexical`, `trigram`, `combined`), and `trigram` is `null` — never a substituted zero —
when the extension is absent, because "not computed" and "computed as no match" are different facts.

## 5. Turkish

PostgreSQL's `turkish` configuration has a defect this phase had to survive:

```
to_tsvector('turkish', 'İZİN')  →  'İzİn'    ← neither lowercased nor stemmed
to_tsvector('turkish', 'izin')  →  'iz'
to_tsvector('turkish', 'ızın')  →  'ız'      ← does not meet 'iz' either
```

An uppercase Turkish question matched nothing, and nothing said why. The fold repairs all four forms
to `iz`. **On Turkish, folding is a correctness requirement, not a nicety.**

Query terms are **OR-joined**, not conjoined. `plainto_tsquery` ANDs every term, which measured 4.3%
Recall@1 and 95.7% zero-result and reads as "Turkish full-text search does not work" — it is not
true, it is the query builder. Question words (`kime`, `nasıl`, `kaç`, …) are dropped because they
live in questions and essentially never in policies; that was measured as +2.2pp Recall@1 with no
regression in any class.

**What lexical retrieval does not solve, recorded rather than hidden:** genuine synonyms and register
shifts (`çalındı` vs `kayıp cihaz`, `patronumun patronu` vs `Genel Müdür`), and cross-language
questions (an English question does not reach a Turkish record). Both are asserted as failures in the
suite.

## 6. Source diversity

At most **2** chunks from one `sourceDigest` in a result. The digest is recovered from `fact_key`
(`ingest:<title>:<digest>:<index>`), so no column, join or migration is needed. Pruning is **counted
and reported**.

It is a cap, never a merge and never a dedupe: two sources that disagree have different digests, both
survive, and both reach the reader. Retrieval **exposes** disagreement; resolving it belongs to
Governance and a future Knowledge Quality phase, not to a sort function.

## 7. Chunk-title pollution — audited, hypothesis falsified, no change made

KR2 observed that `chunkTitle()` repeats the source title in every chunk label, putting 40 copies of
one document's title tokens into the corpus. Two retrieval-side fixes were measured:

| ranking over | R@1 | R@3 | ingested-source slots (6 purchasing queries) |
|---|---|---|---|
| label + statement (current) | **67.4%** | **78.3%** | **8** |
| statement only | 43.5% | 58.7% | 10 |
| statement weighted A / label weighted D | 52.2% | 76.1% | 9 |

Both "fixes" are **worse on quality and worse on domination**. `ts_rank_cd` scores per-document term
positions and cover density, not corpus-wide inverse document frequency, so the repeated title never
distorted ranking in the first place. Titles carry real signal.

**Narrowest fix = no fix.** No ingestion redesign, no stored record rewritten.

## 8. Empty corpus ≠ no match ≠ empty query

Four states, kept apart, each with its own sentence:

- `empty-corpus` — the organization holds no knowledge records at all.
- `no-match` — the organization **holds** knowledge; none of it matches this question.
- `empty-query` — the question carried no searchable term.
- `unavailable` — no tenant, no persistence, or the read failed.

Telling an operator "your organization holds no knowledge records" because one question missed would
be false **about their organization**. A source-level test asserts the two sentences can never reach
each other's branch.

A defect was caught here during implementation: a question of pure punctuation (`???`) survived
normalization, produced an empty tsquery, matched zero rows, and would have been reported as
`no-match`. Emptiness is now decided in the normalizer, not inferred from a zero-row result.

## 9. Remaining limitations

1. **Typo tolerance is not connected.** `pg_trgm` is absent; no trigram similarity is computed. The
   capability map reports it as `not-connected` and names the extension. Installing it is a schema
   change and therefore a Director gate. Measured value: +10.9pp Recall@1, typo class 50% → 100%.
2. **No semantic retrieval.** Synonyms and register shifts fail. pgvector is not available on the
   host at all, and KR2's verdict (B, not C) stands.
3. **The measured numbers come from a synthetic corpus.** 172 facts, 46 hand-authored queries, one
   annotator. They are directional, **not a production quality guarantee**. Canonical `hebun_r1`
   holds one knowledge fact.
4. **The fold covers the thirteen Turkish letters only.** É, à, ñ, ø are carried through as written;
   they still match when spelled identically, only cross-form matching is lost.
5. **On-the-fly `to_tsvector` is a sequential scan.** Measured 3.5 ms at 176 facts, ~95 ms at 5 000,
   ~471 ms at 50 000. Correct at Hebun's real scale; the boundary is ~5 000 facts per tenant, and the
   indexable expression is already in place for when it is crossed.
6. **Contradiction detection has no owner.** Two ingestions of the same policy with different digests
   both stand active and nothing notices.
7. **No browser or e2e harness exists in this repository.** No Playwright, no Cypress, no
   testing-library. Every UI-adjacent claim in this document comes from reading source and from Node
   assertion tests — **not** from a rendered page. None was created in this phase.

## 10. Firewalls held

- **`/search` stays unavailable** — `availability: "requires-source"`, and the capability map keeps
  `search`, `semantic-retrieval` and `embeddings` at `not-connected`. Internal evidence retrieval for
  Heby is not an enterprise search product. No search route exists.

  **Its stated REASON had to be repaired, because KR3 falsified it.** `/search` previously explained
  itself with *"no index, no ranking model, and no relevance authority exists anywhere in the
  repository."* A ranking model and a relevance computation now exist, so that sentence became false
  while the verdict it supported stayed true — a true conclusion resting on a dead premise, which is
  the record-integrity defect this codebase has had to repair before. The reason now names what is
  actually missing: **no search surface, no result presentation, no citation experience** — enabling
  one is a separate, explicitly authorized product phase. Three tests pinned the retired premise and
  were moved to pin the new one, plus a negative lock so the old wording cannot come back.
- **Enterprise Memory remains a separate authority** — a new structural test asserts that nothing in
  `features/knowledge/**` or `features/knowledge-retrieval/**` imports `enterprise-memory-retrieval`
  or `enterprise-memory-persistence`, and that the reverse import does not appear either.
- **No vectors, no embeddings, no provider, no filesystem, no execution** in any retrieval module.
- **No write path** — retrieval contains no `insert` / `update` / `delete` / `transaction`, in the
  query builder or in raw SQL.
- **No learning, no write-back, no promotion** of model output into Knowledge.

## 11. Verification

```
lint       0 errors, 14 warnings (all pre-existing; none in any KR3 file)
typecheck  PASS
tests      360 passed, 0 failed, 360 total   (356 before this phase, +4 new)
build      Compiled successfully
git diff --check  clean
```

Canonical `hebun_r1`, read-only before and after and byte-identical:
`applied=24 · facts=1 · nodes=1 · decisions=8 · sessions=8 · audit=17 · extensions=plpgsql`.
No disposable database was left behind.

Seven tests reachable only because the widening exposed them were repaired at their root rather than
loosened — including one guard that banned the substring `execute(` as a proxy for "read-only" and
had started catching a `SELECT`, one that banned `vector` and therefore banned `to_tsvector`, one
that passed only because an English prompt reached a Turkish record while evidence was
question-blind, and three that pinned the retired `/search` premise. A proxy that catches the thing
it protects gets deleted by whoever it blocks.

One pre-existing flake was observed and deliberately **not** touched: the K2 duplicate-creation race
(`tests/k2-flow/create-and-read-postgres.ts`, *"exactly one creation won"*) failed once under
parallel database load and passed 3/3 in isolation. Its block is untouched by this phase — a
concurrency assertion that is occasionally scheduled unluckily is not a reason to weaken it.

## 12. Next gate

Director decision on `pg_trgm`. It is one `CREATE EXTENSION` in one migration, worth a measured
+10.9pp Recall@1 concentrated in misspelled questions, rollback is `DROP EXTENSION`, and it adds no
table and no column. It is **not** required for this phase to ship.
