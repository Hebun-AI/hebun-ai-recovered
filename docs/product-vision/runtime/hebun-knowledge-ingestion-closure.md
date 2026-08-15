# HEBUN — KNOWLEDGE INGESTION — CLOSURE RECORD

Date: 2026-08-15. Baseline `61c6d32` (origin/main, 0/0, 24/24 migrations).
Canonical `hebun_r1` was read and never written.

---

## 1. The gap this closes, in the repository's own words

Two places in the released code named it. **Both are quoted here as the PRIOR state — neither
sentence survives, and §13 records what replaced them:**

```
src/features/heby-answer/knowledge-evidence.server.ts:88   (before this phase)
  "Your organization holds no knowledge records. The canonical Knowledge authority was read and
   is empty — no ingestion path exists to put knowledge there yet."

src/features/knowledge/capability-map.ts:113               (before this phase)
  "None. The `documents` table exists but has no consumer anywhere: no upload, no parser, no
   normalizer, no chunker, no storage binding, and no writer to knowledge_facts or knowledge_nodes."
```

K1 read, K2 created, K3 superseded, K4 ratified, G1 audited — and nothing produced. A real human
could be onboarded, sign in, open Heby, and find nothing of their organization's. **The consumer was
already built and wired; only the producer was missing.**

---

## 2. What was built

One plain-text source, pasted by an authorized human, becomes N canonical Knowledge facts:

```
paste → normalize → deterministic chunks → N facts through the EXISTING K2 writer
      → one transaction → K1 lists them → Heby's evidence path reads them
```

No second authority, no second writer, no second read path, no new workspace.

---

## 3. Contract

| | |
|---|---|
| Input | `sourceTitle`, `sourceText`, `domainKey`, `scope` — content only |
| Server-derived | tenant, actor, timestamp — never client-supplied |
| Max source | **60 000** characters, refused not truncated |
| Chunk target | **1 500** characters |
| Max chunks per ingestion | **40** |
| Overlap | none |

**Normalization changes layout, never wording.** CRLF/CR→LF, trailing whitespace per line, blank-line
runs collapsed, document ends trimmed. Nothing is lowercased, de-punctuated, reworded or summarized.

**Chunking is deterministic and uses no model.** Paragraphs are packed in source order up to the
target; an oversized paragraph splits on sentence boundaries, and only a single oversized sentence is
cut on character count. Blank content is never emitted. A heading travels with the paragraph beneath
it whenever they fit together.

---

## 4. Identity and idempotency

```
factKey = ingest:<title-key>:<sha256(normalized)[0..12]>:<chunk-index>
```

The content digest is in the identity deliberately. Title alone would have collided the moment
somebody ingested a **corrected** version of the same document — the second ingestion would have
landed on the first one's identity and been refused as a duplicate, which is a lie. With the digest:

- the **same** normalized source is refused as `duplicate-ingestion`, writing nothing;
- the **same title with changed content** is a distinct ingestion, and the earlier one survives
  untouched — nothing is superseded, overwritten or repaired;
- reformatting (extra blank lines, trailing spaces, CRLF) is **not** new knowledge, because the
  digest is taken over the normalized form.

A **partial** match is refused, not completed. An ingestion that previously left some chunks and not
others is an inconsistent state this code did not create and will not paper over.

---

## 5. Atomicity — the one architectural change

`durable-knowledge-writer.server.ts` opened its own transaction, so N chunks would have been N
transactions and "6 of 12 committed" a reachable state. The writer now accepts an **optional**
caller-supplied transaction:

- omitted → it opens its own, byte-for-byte as before, and every existing caller is unchanged;
- supplied → it joins the caller's, and a failure **throws** rather than returning a status, because
  Postgres has already aborted that transaction and a returned status would invite the caller to
  continue inside a dead one.

All N chunks and all N audit rows commit together or not at all. Proved by injecting a failure
mid-ingestion and asserting zero surviving rows.

---

## 6. Provenance — no schema change

`knowledge_nodes.provenance` and `source_attribution` are pre-existing nullable `jsonb`. K2 wrote
only the former; ingestion extends it and fills the latter:

```
provenance          origin: human-ingested · sourceType · sourceDigest · chunkIndex · chunkCount
                    · submittedAt · textOriginUnverified: true
source_attribution  sourceTitle · sourceType · ingestedByActorType/Id · ingestedAt
```

`textOriginUnverified` stays **true**. A paste is a paste whether it arrives as one fact or forty;
Hebun still does not know whether the words are the human's own.

---

## 7. Ingested is not ratified

Every ingested row is written `draft` / `provisional`, `ratified_at` NULL — the same values K2 has
always written, through the same code path. There is no call to K4 anywhere in the ingestion module,
and the boundary test asserts the words `ratify`/`ratification` do not appear in it. The workspace
states it before the button, not after: *"Ingested knowledge is provisional. It is not ratified
organizational truth."*

Proved: an ingestion creates **zero** `decision_records` and **zero** `governance_sessions`.

---

## 8. Heby needed no change

`listFacts` filters on `tenant_id` alone — no authority or lifecycle predicate — so ingested facts
become eligible for `resolveKnowledgeEvidence` immediately, each presented as `ratified: no` and
`authoritative: false`. The test drives the real K1 repository and the real evidence path, and
asserts the resolution moves from `unavailable` ("your organization holds no knowledge records") to
`resolved`. No second retrieval path exists.

---

## 9. Ingestion is not search

This phase makes an organization's knowledge **present**, not **findable by meaning**. No embeddings,
no pgvector, no similarity, no reranking, no `/search`. `/search` remains deliberately unavailable —
*"A substring scan is not search, and Hebun will not run one and call it that."*

---

## 10. The 50-record limitation, handled rather than hidden

`KNOWLEDGE_LISTING_LIMIT = 50` bounds the same listing Heby consumes. An ingestion that produced more
records than the evidence view can show would look successful and then be partly invisible. So one
ingestion may create at most **40** facts, refused with the real reason when exceeded, and the
boundary test asserts `MAX_CHUNKS_PER_SOURCE < KNOWLEDGE_LISTING_LIMIT` so the two cannot drift apart.

**This bound is a limitation, not a solution.** A tenant that ingests several sources will exceed 50
records in total, and the listing truncates honestly. That is the point at which a retrieval phase —
not this one — becomes necessary.

---

## 11. `documents` was left alone

The table exists from the first migration, has zero consumers, and carries `storage_path` — a
file-storage model this slice does not build. Adopting it would have created a second source of truth
for "what was ingested" beside `knowledge_nodes.provenance`. The boundary test asserts ingestion does
not reference it, and the flow test asserts its row count never moves.

---

## 12. Verification

`tsc` clean · eslint 0 errors (14 pre-existing warnings) · **356 passed, 0 failed** (was 354) ·
build clean · `git diff --check` clean.

**Zero schema, migration and dependency delta.** Migrations remain 24 SQL / 24 journal.

**Four** suites were repaired, not loosened — two here, and two more at the commit gate, recorded
in §13.

`k2-flow/governance-hardening.ts` and `k3-flow/no-in-place-edit.ts` both assert the *closed list* of exported Knowledge server actions —
a guard that exists to stop a delete/edit/rollback action appearing. `ingestKnowledgeAction` was
added to both lists with the reason recorded: it is **create-class**, writing many facts through the
same writer `create` uses, and can neither edit nor promote anything. The bans on delete, edit,
rollback and un-ratify are untouched.

**Browser validation was not performed.** The repository still has no browser or e2e harness, and
standing a fixture-backed server on port 4000 was rejected because that is the ceremony URL. The
ingestion card is therefore proved by source assertions — including that it previews with the
server's own chunker rather than a second implementation — and not by rendering. Fifth consecutive
phase to name this; it remains the largest verification gap.

---

## 13. The truth surface, repaired at the commit gate

The first commit gate **failed**, and correctly. Ingestion was built, verified and about to be
committed while five shipped strings still told the operator it did not exist — and four assertions
held them green, so the suite passed *because* the stale claims survived.

The contradiction was live on one page: `/knowledge` rendered the ingestion card beside a capability
map reporting `ingestion → not-connected`, and `KNOWLEDGE_CLOSING` appended *"No ingestion path
exists, so nothing can add knowledge to Hebun yet"* to **every** `/knowledge` and `/source` read —
including reads of records somebody had just ingested.

Repaired, as copy and state only — no runtime behaviour changed:

| Site | Was | Is |
|---|---|---|
| `knowledge/capability-map.ts` | `ingestion` → `not-connected`, "no chunker … no writer to knowledge_facts" | `connected`, bounded by `cannotProve`: not ratified, no upload/URL/connector, not findable by meaning |
| `knowledge/capability-map.ts` | `source-listing.cannotProve` "…because nothing writes knowledge" | an empty listing means the organization holds nothing, never a failed read |
| `heby-answer/knowledge-evidence.server.ts` | "no ingestion path exists to put knowledge there yet" | "read and is genuinely empty … Knowledge is put there through the Knowledge workspace, and none has been yet" |
| `heby-commands/read-commands.server.ts` | "No ingestion path exists, so nothing can add knowledge" | "lands as a provisional draft — stored is not reviewed", plus an explicit "no search, embedding or semantic retrieval" |
| 4 comments in `read-commands.server.ts` / `registry.ts` / `capability-map.ts` | ingestion absent; `connected` glossed as read-only | current, and `connected` now means a real runtime path, read **or** governed write |

Tests were made **stronger**, not looser: the obsolete pins were replaced by positive assertions
plus negative locks (`!/no ingestion path|nothing can add knowledge/`), the `Not connected (4)` → `(3)`
change is pinned to the one capability that moved by asserting search, semantic retrieval and
embeddings are still named, and `boundaries-and-firewall.ts` gained a repo-wide sweep so no `src`
file can deny ingestion again.

Two pre-existing firewalls caught the repair itself and were **obeyed, not widened**: g2 and k4
forbid any `heby-commands` file from naming a Governance approval mutation, and they scan the raw
file — a denial reads the same as an offer to a regular expression. The closing was reworded around
it, and the formal statement lives in the capability map, which the command already renders.

**The lesson, recorded because it has now cost two phases:** a closure document that can quote the
sentence its phase falsifies must put that sentence in the diff. Quoting it as "the gap this closes"
is a grep target, not a citation.

---

## 14. Non-effects

No embeddings, pgvector, semantic search or `/search`. No file upload, URL or connector ingestion.
No external storage. No provider call. No agent or autonomous ingestion. No execution, permit or
dispatch. No Computer Use. No automatic ratification. No new workspace, authority, writer or read
path. No schema, migration or dependency change. Canonical `hebun_r1` read and never written; all
mutation tests ran on disposable databases.

---

## VERDICT

# KNOWLEDGE INGESTION IMPLEMENTED — CANONICAL, PROVISIONAL, AND NOT SEARCH
