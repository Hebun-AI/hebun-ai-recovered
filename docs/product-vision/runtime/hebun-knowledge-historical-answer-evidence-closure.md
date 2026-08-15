# Hebun — Historical Answer Evidence Persistence (KR5) — Closure

**Phase:** KR5 — Historical Answer Evidence Persistence
**Date:** 2026-08-15
**Baseline:** `3e654f5` (origin/main = real remote, 0/0)
**Gate A:** approved with three Director decisions (transaction scope, retention, persistence shape)

---

## 1. The defect this phase closes

KR4 made Knowledge evidence visible for the **live** response and recorded its own limitation
plainly: evidence was not persisted with the historical message. On reload, a past answer showed
`Evidence details were not retained for this earlier response.`

That was honest, and it was the right call at the time — the alternative on offer was worse. Re-running
retrieval at reload would have returned **today's** records, after supersessions, ratifications and
expiries the original answer never saw, and presented them as "the evidence behind this answer".
A fabricated history is worse than an admitted gap.

KR5 removes the gap rather than the honesty. The central invariant:

> **HISTORICAL ANSWER EVIDENCE ≠ CURRENT KNOWLEDGE TRUTH**

A historical snapshot records what an answer relied on at answer time. It never becomes a second
Knowledge authority, a replacement Knowledge record, a Governance decision, a ratification, a
retrieval cache, a search index, a memory, or a truth score.

---

## 2. The persistence cliff, as it was

Traced from source before any edit:

| Stage | Evidence present |
|---|---|
| `withKnowledge()` → `{resolutions, knowledgeEvidence}` | full `RetrievalEvidenceSet` |
| `persistExchange(…, response: answer.response)` | **none** — the field was attached afterwards |
| written to PostgreSQL | content, role, origin, provider, model, transport, correlation, tokens |
| reload (`HebyConversationMessageView`) | **no evidence field existed** |

`messages` carried fourteen columns and **zero jsonb**. The cliff was exactly
`persistExchange → repo.appendMessage`.

---

## 3. The fact KR5 records

Gate A stress-tested five candidate meanings. Decisive measurement:
`resolveKnowledgeEvidenceDetailed` runs **one** search and projects it twice —
`toRetrievalResolution` and `buildRetrievalEvidence` both map over `result.candidates` — so
"admitted to the model" and "displayed to the reader" are the **same set**.

> At time T, assistant message M was generated from Knowledge evidence set E — the records
> **admitted** to the model's grounding context and **shown** to the reader, as they stood at T.

Not "the model used these". Model-internal causation is unobservable, and a record asserting it
would be inventing proof. A firewall test bans that phrasing from the panel copy.

---

## 4. Reference + bounded snapshot, and why neither alone works

**Reference alone fails.** `recordRef` is `domainKey/factKey` and is **not** version-pinned — after
a supersession it resolves to different text. Even a node-id reference re-reads mutable
`provenance`/`sourceAttribution` jsonb and a `ratifiedAt` a later K4 ratification can still set, and
`freshness` is clock-derived, so recomputing it later returns a different value by construction.

**Full snapshot fails.** Copying `statement` makes the tables a second Knowledge content store.

**What shipped:** identity is *referenced* (`fact_id`, `knowledge_node_id`), standing is
*snapshot*, and the only content stored is the **bounded excerpt the reader actually saw** —
already capped at `EVIDENCE_EXCERPT_LIMIT = 240` by the KR4 contract. That bound is the line
between "what was on screen" and "the organization's knowledge".

`RetrievalEvidenceItem` gained exactly two fields — `factId`, `knowledgeNodeId` — carried for
history, never rendered. A test pins that the evidence panel never prints either.

---

## 5. Ownership, and two tables because five states must survive

**Historical answer evidence is owned by Heby conversation persistence, as an immutable child of
the assistant message.** It is not owned by Knowledge, which remains the sole authority for what
the organization holds; not by Governance, which records no decision here; and not by Retrieval,
which stays a derived selector with nothing durable of its own. The claim being recorded is about
*one answer*, and the answer is the assistant message row — so that row is the parent, and the
evidence lives and dies with it.

```
heby_answer_evidence_set    1:1 with an assistant message that ran a retrieval
heby_answer_evidence_item   N per set, ordered by `ordinal`
```

A set row is written **whenever retrieval ran — including when it matched nothing**. Without it,
"no rows" would mean both *retrieval never ran* and *retrieval ran and your organization has nothing
on this*, which are completely different statements. KR4's four-empty-states discipline would have
been lost at exactly the moment it mattered.

Both tables are immutable by shape: no `updated_at`, no `deleted_at`, no version counter, and
deliberately **not** `tenantColumns` (which models a mutable row). The precedent is `audit_log`.

---

## 6. Tenant isolation is structural

```sql
FOREIGN KEY (message_id, tenant_id) REFERENCES messages(id, tenant_id) ON DELETE CASCADE
```

A plain `message_id` FK would let tenant A's evidence hang off tenant B's message, with only
application code in the way. The composite key makes it unconstructible — proven by raw SQL that
bypasses every line of TypeScript and is refused by the database itself.

This required one additive `UNIQUE (id, tenant_id)` on `messages`: `id` is already the primary key,
so the index adds no uniqueness the table lacked — PostgreSQL simply requires a declared unique
constraint on exactly those columns before a composite FK may target them.

**drizzle-kit emitted the statements in the wrong order** — the `ALTER TABLE … ADD CONSTRAINT`
before the `CREATE UNIQUE INDEX` it depends on — and the migration failed with
`there is no unique constraint matching given keys for referenced table "messages"`. The index is
hoisted above the constraint; a firewall test pins the ordering.

---

## 7. One transaction — the pre-existing orphan closed

`persistExchange` was three independent awaits. A failure between the user and assistant inserts
committed a **question with no answer** and then reported `durable: false` — the honest disposition
and the durable state disagreed. Adding evidence as a fourth independent write would have been
worse: an assistant message that persisted while its evidence did not is indistinguishable, on
reload, from an answer where retrieval never ran.

By Director decision the fix is inside KR5, because KR5 had to change this exact boundary and
leaving a known partial write would preserve a broken transaction contract.

```
conversation (resolved or created) + user message + assistant message + evidence set + items
                      →  ALL COMMIT   or   NONE COMMIT
```

Conversation creation is **inside** the transaction: leaving it outside would trade one partial
state for another — a rolled-back turn stranding an empty thread that never said anything.

The failures proven are **real PostgreSQL errors**, not stubs: foreign-key violations, unique
violations, and triggers raised inside the transaction. A stubbed writer can only show the code
*meant* to be atomic. Case E is the sharpest — the failure lands on the **last** statement, after
the conversation, both messages and the set are all inserted, and every one of them disappears.

---

## 8. Admission, and what has no path to a row

The persisted set is the server-produced `RetrievalEvidenceSet` for **this** answer, handed to the
writer as a runtime object. Nothing parses the assistant's text for citations, so a model-invented
reference has no code path to a row — an absence of the mechanism, not a check that could be
forgotten. The client's only input is an opaque conversation id that must already belong to the
tenant.

Absent by construction: lexical/trigram/combined score, rank, weights, `sourceDigest`,
chain-of-thought, and any trust/confidence/certainty figure. A test asserts no column and no
contract field carries them.

---

## 9. Reload replays; it never re-reads

Historical evidence rides the **existing** conversation authorization — ownership is proven first,
and the message ids handed to the evidence read are the ones that read returned. There is
deliberately **no standalone evidence endpoint**: a caller holding a raw evidence id has no surface
to spend it on.

The reload path imports no Knowledge module at all. A negative control confirmed the guard bites:
adding `searchKnowledge` to the loader fails the suite.

---

## 10. The historical frame

A preserved snapshot without a frame **is** a current-state claim. Restored turns render:

> Evidence recorded with this answer, as it stood at the time. Your organization's current
> knowledge may have changed since.

and their disclosure reads **"Recorded evidence"** rather than "Evidence", so a reader scanning a
thread learns it before opening anything.

No current-vs-historical comparison, and no deep link. A comparison needs a live re-read this panel
must not perform; a link would quietly turn a historical reference back into a current-state one.
Re-checked: there is still **no Knowledge detail route** — only `/knowledge` and
`/director/knowledge-graph`. KR4's finding holds.

---

## 11. The supersession proof

Release-blocking, against real PostgreSQL:

1. Knowledge seeded at **v3** ("14 gün"), retrieved by a **real** search
2. the answer persisted with that evidence
3. **v4** ("20 gün") supersedes v3; the fact registry moves to v4, v3 becomes `superseded`
4. current Knowledge verified to have actually moved — otherwise step 5 proves nothing
5. reload shows **v3**: title, excerpt, version and standing as they read then
6. v4 is **not** substituted, and its statement appears nowhere
7. `active_knowledge_node_id` is still v4 — history read Knowledge, never moved it

---

## 12. Retention remains deferred

By Director decision KR5 invents **no** retention policy. Historical evidence follows the lifecycle
of its parent assistant message via `ON DELETE CASCADE`, proven as schema integrity only.

Hebun has **no product deletion path at all** — measured, not assumed: zero `.delete(` against any
table anywhere in `src/features/`. No retention window, no expiry, no right-to-forget workflow, no
tenant deletion, no independent evidence deletion, no archival.

**Immutability means historical evidence is never rewritten in place. It does not mean evidence
outlives the legitimate deletion of its parent.**

---

## 13. Boundaries held

| Firewall | Status |
|---|---|
| Governance | no decision, no session, no ratification — verified zero rows |
| Audit | no `audit_log` write — storing a record is not an authority-bearing event |
| Knowledge | no writer; `knowledge_nodes` / `knowledge_facts` unchanged, active version unmoved |
| Memory / Learning | no `memories`, `working_memories`, `learning_sessions`, no `knowledgeRefs` |
| Search / vector | no extension installed; no gin/gist/tsvector index; no `/search`, no embeddings |
| Guided Learning / Twin | no integration, no prediction, no lesson or progress state |

---

## 14. Verification

- **368 tests pass, 0 fail** (365 → 368: three KR5 suites)
- lint **0 errors** (14 pre-existing warnings), typecheck PASS, build PASS
- schema delta: **2 tables + 1 index**; migration delta: **1**; dependency delta: **0**
- canonical `hebun_r1` **untouched** and read-only: conversations 34, messages 124,
  knowledge_nodes 1, knowledge_facts 1, decision_records 8, governance_sessions 8, audit_log 17;
  24 applied migrations; `plpgsql` only; KR5 tables absent; no leaked disposable database
- both new firewall guards proven non-vacuous by negative control

Nine pre-existing tests failed on first run and were **repaired, not weakened**. Seven asserted a
repo-wide migration count or "nothing sorts after my boundary" — claims about the *future* that a
later Gate-B phase legitimately falsifies. Each is now scoped to its own phase, naming what
followed. Two were KR4's own claims that KR5 supersedes by Director decision, updated to state the
new truth. One R2D failure assertion was **strengthened**: it now asserts zero orphan rows, which
is the defect §7 closes.

---

## 15. Remaining limitations

1. **Answers produced before KR5 have no recorded evidence.** `HebyEvidenceNotRetained` remains for
   them, and for any turn whose retrieval never ran. No backfill is possible or attempted —
   inventing history is the thing this phase exists to prevent.
2. **Retention policy deferred** (§12) — a Director/governance decision, not an engineering gap.
3. **No deep link** (§10) — the Knowledge detail route still does not exist.
4. **No current-vs-historical comparison** — deliberately out of scope.
5. **Knowledge soft-delete is unfiltered on the read path** — found during Gate A, explicitly **not**
   KR5's scope, unrepaired, and recorded here so it is not lost. `deletedAt` exists on
   `knowledge_nodes` but no read filters it, so soft-deleting a record today would not remove it
   from retrieval. Separate defect, separate phase.
6. **No browser verification.** `/heby` renders through the Next router; the repository still has no
   browser/e2e harness. The reload path is proven end-to-end against real PostgreSQL through the
   real loader, and the UI framing is proven at source level.

---

## 16. Next gate

Commit gate. No commit, tag or push was made in this phase.
