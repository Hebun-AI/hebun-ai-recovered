# Hebun — Knowledge Retrieval Explanation & Evidence UX (KR4) — Closure

**Phase:** KR4 · **Status:** implemented and verified, uncommitted
**Baseline:** `80f3c1d` (origin/main = remote main, 0/0 at start)

KR3 made Heby's Knowledge evidence question-aware. KR4 makes that evidence **understandable to the
person reading the answer**, without making it look more authoritative than the runtime can justify.

---

## 1. The defect this phase closes

KR3 computed a great deal about each retrieval and then discarded almost all of it one function
later. `toRetrievalResolution` flattened five structured standing fields into a single display
string and dropped the rest outright: the diversity cap, the truncation flag, the eligibility
exclusions, the degraded-capability notice, and the source identity.

The result was an asymmetry that is easiest to state plainly:

| | Was told |
|---|---|
| **The model** | `[knowledge/izin/izin-hakki] Yıllık izin hakkı — authority: authoritative · lifecycle: ratified · ratified: yes · freshness: within-cadence · scope: company-wide \| source text: … \| provenance: …` |
| **The human** | `knowledge · izin/izin-hakki` |

The grounding context was richer than the user interface. A person could not tell which record was
used, where it came from, whether it was ratified, whether other evidence had been withheld, or
whether the sweep had been partial.

---

## 2. What was built

**A derived evidence explanation, and nothing else.** `RetrievalEvidenceSet` /
`RetrievalEvidenceItem` / `RetrievalExplanation` are a pure projection of a `RetrievalResult` that
already happened. The layer reads nothing, writes nothing, ranks nothing and resolves nothing.

```
Knowledge            = authoritative
Retrieval            = derived
Evidence explanation = derived PRESENTATION of a derivation
```

- **Read-shape widening, no schema change.** `knowledge_nodes.provenance` and
  `.source_attribution` have been written since K2 and read by nobody on the retrieval path. Both
  are now projected onto `KnowledgeSourceRecord` as optional, defensively typed fields. No column,
  no migration, no writer change.
- **One search, two projections.** `resolveKnowledgeEvidenceDetailed` returns the unchanged
  `SourceResolution` (for grounding, the validator, the kill switch and persistence) **and** the
  evidence set (for the reader) from a single retrieval. Running retrieval twice would risk the
  card and the prose describing different result sets, with no way for the reader to tell.
- **The card, in the existing disclosure.** `heby-turns.tsx`'s `Evidence (n)` disclosure now renders
  title, excerpt, domain/scope, three separate standing chips, freshness, source attribution,
  matched terms and provenance details. No new workspace, no new panel, no route.

---

## 3. Relevance is not truth

Deliberately absent from everything a reader can see: `lexical`, `trigram`, `combined`, rank,
weight, `confidence`, `truthScore`, `trustScore`, `qualityScore`, `certainty`, and `sourceDigest`.
The scores still exist upstream on `RetrievalCandidate` — they were **withheld, not deleted**.

A single number beside a policy is read as a verdict on the policy, and Hebun computes no such
verdict. Ordering already carries the match, and the panel says so in as many words: *"Records are
ordered by how closely their text matches your question. That ordering is not a measure of truth,
approval or currency."*

Standing is rendered as **three separate claims** — authority, lifecycle, ratification — plus
freshness. Merging them would let a provisional draft that happens to be current borrow the
appearance of an approved policy. `RATIFIED ≠ TRUE` still holds: it means Governance approved this
version, not that reality agrees with it.

---

## 4. "Why this evidence?" is deterministic

No model writes the reason. The explanation is computed from retrieval facts and rendered as fixed
copy around them: matched terms, domain narrowing, scope narrowing, active-version status, and
whether the diversity cap affected the set.

**One defect the tests caught.** `normalizeQuery` returns *folded* tokens, so the first
implementation printed `Yillik` under a record that reads `Yıllık` — a word the reader cannot find
anywhere on screen, in a panel whose entire purpose is to be checkable. Matched terms are now
reported **as the record spells them**, recovered exactly rather than approximately: `foldTurkish`
is `translate()`, a character-for-character map of thirteen letters, so it never changes length and
the offset in the folded text is the same offset in the original.

An empty matched-terms list prints nothing rather than "matched". PostgreSQL can match on a stemmed
form this literal check cannot see, and an unverifiable claim is worse than a short list.

---

## 5. Multiple sources is not contradiction

Nothing in this repository detects that two statements disagree — KR3's closure records
contradiction detection as having no owner — so **no `conflict` field exists**.

The runtime vocabulary is **`multipleRelevantSources`**, and the name is the claim: it says several
sources are relevant, and it does **not** say they contradict. `multipleRelevantSources` is not
contradiction truth, and no field in this phase carries a contradiction verdict.

What is reported is the structural fact the runtime actually has: several eligible, active records
from **distinct sources** in **one domain** answered one question. The copy is cautious and states
its own limit: *"Multiple relevant organizational sources were found. Review their standing if they
disagree — Hebun does not check whether they agree."*

Two deliberate asymmetries make the signal true rather than noisy:

- **Two chunks of one document are one source**, not two disagreeing ones — otherwise a long policy
  split into forty chunks would report itself as forty conflicting sources.
- **Different domains do not trigger it.** A leave policy and a travel policy can both be relevant
  without either being wrong.

No winner is picked, no ordering implies one, and nothing routes to Governance automatically.

---

## 6. Eight states, eight sentences

`matched`, `no-match`, `empty-corpus`, `empty-query`, `unavailable` are five distinguishable
renders, proven by markup comparison. `truncated`, `diversity-pruned` and `multiple-relevant-sources`
are separate set-level notices, each with its own count, because each has a different remedy.
Collapsing them into "some results omitted" would tell the reader something is missing without
telling them which kind of missing. Nothing renders as "No data".

The substitution this codebase has repaired three times is pinned by a test: a missed question must
never be reported as an empty organization.

---

## 7. Reload honesty

No evidence snapshot is stored, and KR4 adds no table and no column.

The explanation is attached to the response **after `persistExchange` has already returned**. The
ordering is the guarantee: a future writer would have to be handed the field on purpose for it to
reach a durable row.

A reloaded answer therefore has no evidence, and says so: *"Evidence details were not retained for
this earlier response."* Re-running retrieval to fill the gap was rejected — it would return
**today's** records, after supersessions, ratifications and expiries the original answer never saw,
and presenting those as the evidence behind that text would be a fabricated history.

---

## 8. Boundaries held

- **The model still cannot invent evidence.** `isSupportedEvidence` is untouched and still compares
  against the runtime-produced set. The presentation field is not consulted for identity, and a test
  asserts the assembler never mentions it. Every card's `recordRef` is verified to be in the
  validated set — the card and the validator cannot drift.
- **No sentence-level citations.** Gate A ruled them unreliable and none were built. The model is
  not asked to annotate sentences, and no post-hoc inference of sentence support exists. Source-level
  cards only.
- **`/search`, semantic retrieval and embeddings stay `not-connected`.** No search route, and the
  evidence panel carries no input, no submit, no fetch and no navigation — it renders, it does not
  search.
- **Tenant scoping is unchanged.** Evidence is a projection of an already tenant-scoped result and
  introduces **no new read seam**, so no new authorization surface exists. Proven against two tenants
  holding textually identical corpora, so isolation cannot be mistaken for content difference.
- **Guided Learning and Director Twin remain deferred.** No lesson model, no progress, no spotlight,
  no Twin integration. Cards carry stable `data-heby-evidence-*` attributes following the existing
  `data-heby-role` convention — a rendering hook for a future guided surface, explicitly **not** the
  semantic anchor contract, which remains Guided Learning's own prerequisite.

---

## 9. Deep link — seam still missing

No dynamic route exists anywhere except the catch-all `[...slug]`, so there is no Knowledge record
detail surface to link to. Cards are non-navigable and no database id is rendered. The narrowest
future seam remains a deterministic anchor or filter on the existing `/knowledge` page keyed on
`domainKey/factKey` — not a new route, and not a raw `factId` URL. Not built here.

---

## 10. Deferred product truth defect — NOT fixed by this phase

`/director` mounts `HebyAssistantPanel`, which renders a **confidence percentage** beside items
labelled "evidence", and `decision-domain/mock.ts` carries hard-coded `confidence: 94` with
`trust: "Verified"`.

This was audited and **deliberately left untouched**. It is a different component, on a different
route, fed by a different pipeline (`enterprise-projections` through the unit-of-work), rendering
`evidence: string[]` — entirely disjoint from the KR3/KR4 retrieval path. It is not adjacent to
Heby's Knowledge evidence, and silently cleaning up unrelated legacy surfaces is not this phase's
work.

It nevertheless contradicts KR4's doctrine, and shipping honest evidence cards on `/heby` while a
fabricated confidence percentage sits on `/director` is a contradiction worth a Director decision.
**Recorded, not repaired.**

---

## 11. Verification

```
lint       0 errors, 14 warnings (all pre-existing; none in any KR4 file)
typecheck  PASS
tests      363 passed, 0 failed, 363 total   (360 before this phase, +3 new files)
build      Compiled successfully
git diff --check  clean
```

Canonical `hebun_r1`, read-only before and after and byte-identical:
`applied=24 · facts=1 · nodes=1 · edges=0 · conversations=34 · messages=124 · audit=17 ·
decisions=8 · sessions=8 · extensions=plpgsql`.
No disposable database was left behind.

**Delta: schema 0 · migration 0 (24 SQL / 24 journal, unmodified) · extension 0 · dependency 0 ·
database 0 · Knowledge writer 0.**

---

## 12. Remaining limitations

1. **No browser or e2e harness exists in this repository** — no Playwright, Cypress, Puppeteer or
   testing-library. Every UI claim here comes from `renderToStaticMarkup` and from reading source.
   Anything beyond that markup is unproven, and none was created in this phase.
2. **Evidence is not retained across a reload.** This is a deliberate product asymmetry, stated in
   the UI, not a bug. A durable *historical answer evidence snapshot* — explicitly not authoritative
   Knowledge — remains a justified future phase.
3. **Matched terms are a literal substring check.** Records matched through PostgreSQL stemming will
   sometimes show no terms. Under-claiming is the intended failure direction.
4. **The multiple-sources signal will over-warn.** Two records from different sources that agree are
   still flagged as worth reviewing. Accepted: the copy says *may*, and over-warning is safer than a
   silent contradiction.
5. **No contradiction detection.** Unchanged from KR3, and still without an owner.
6. **No typo tolerance, no semantic retrieval.** `pg_trgm` and pgvector remain absent; the
   `degradedReason` notice now reaches the reader in the `matched` state, where KR3 dropped it.
7. **Cards are non-navigable** until a Knowledge record surface exists.

---

## 13. Next gate

Director decision on committing this phase, and separately on the `/director` fake-confidence
surface recorded in §10.
