# Hebun R6D — Knowledge Source Retraction — Closure

**Released at `8676060`. 404/404. Zero schema, zero migration, zero dependency, zero new authority.**

Baseline entering the phase: HEAD `c2795b6`, R6B tag
`hebun-company-understanding-projection-complete`, 30/30/30, `knowledge_nodes=1`,
`knowledge_facts=1`, `documents=0`, `audit_log=17`, provider `version=30` disarmed,
attempts/permits/requests `0/0/0`, zero disposable residue.

---

## The defect

One ingested source produces up to `MAX_CHUNKS_PER_SOURCE` (40) facts. Undoing a wrong upload meant
superseding them one at a time — each with its own observed-version precondition and its own
replacement statement. Forty governed acts to reverse one.

That is not a missing convenience. No operator performs it, so the wrong Knowledge stays in service.

---

## What was built

One governed human act that withdraws every fact a source produced.

Each affected fact's **active node** moves to `knowledge_lifecycle_status = 'retired'` with
`retired_at` stamped. Nothing else changes: the statement, the label, the version counter, the
provenance, the supersession chain and any ratification linkage all stay, and the fact keeps pointing
at the node so history stays readable. **There is no `DELETE` anywhere in the writer**, and a test
pins the write set to exactly `knowledgeLifecycleStatus`, `retiredAt`, `updatedAt`, `updatedBy`,
`updatedByType`.

---

## Why this needed no schema, and why the readers needed no change

**`retired` was not invented for R6D.** It is an existing enum value that every reader already treats
as terminal:

- **KR3 retrieval** excludes it and reports `lifecycle-retired` rather than hiding it.
- **R6B Company Understanding** counts it as `withdrawn` rather than as coverage.

R6D is simply its **first writer**. That is the whole argument for the design: Heby stops serving a
retracted source and coverage drops, and *neither was told retraction exists*. A test forbids the
strings `retract` and `sourceDigest` inside the Company Understanding modules and asserts
`eligibility.ts` still says `lifecycle-retired` and still has no idea R6D happened.

A phase that had to teach every reader a new state would have been the wrong design.

---

## Authority

**The one that already exists.** `retractKnowledgeSource` resolves the same K2 write band that
authoring and ingestion resolve. No new role, no new permission, no new governance authority, no
second Knowledge writer. The server action holds **no gate of its own**, so it cannot drift from the
one it delegates to — asserted structurally.

`AUTHENTICATED HUMAN → TENANT CONTEXT → EXISTING KNOWLEDGE WRITE AUTHORITY → SOURCE-SCOPED
RETRACTION → EXISTING DURABLE MUTATION → EXISTING KNOWLEDGE AUDIT`

---

## Source identity

`provenance.sourceDigest` — the sha256 ingestion writes identically onto every chunk of one source.
Proved sufficient:

- written for every ingested chunk (file and paste), by the one writer;
- **stable** across all chunks of a source;
- **tenant-scoped** by the surrounding rows and by three tenant predicates in the lookup;
- **hand-authored Knowledge carries no `sourceDigest` key at all**, so a single authored fact cannot
  be reached by a source-level act — tested;
- **matching cannot cross tenants** — tested in both directions.

It is a **content identity, not an upload identity**. Hebun keeps no record that a file was received
(`documents` has no consumer and the bytes end with the request), so the same bytes ingested under two
titles are one source carrying both titles. That is the honest reading of what is stored, and the
more useful one: retracting the content withdraws both copies. **No ingestion table was invented to
make this easier.**

---

## The ratification boundary

**A source containing ratified Knowledge is REFUSED — all of it, including the unratified part.**

Ratification is a decision by the tenant's **Governance** authority. This act is gated on the
**authoring** band, and K4 states plainly that the two are different authorities — an owner-band
author is refused at the ratify gate. Letting the weaker band withdraw what the stronger one approved
is a Governance reversal wearing a lifecycle change as a disguise, and K4 has no reversal runtime and
deliberately refuses to invent one.

A **partial** retraction would be worse than a refusal: the operator would believe the source was
withdrawn while part of it stayed in service. So one ratified fact refuses the whole act, and the
source listing shows `ratifiedFactCount` so the operator learns why rather than guessing.

**No un-ratification mechanism was manufactured.** Nothing writes to a ratification column.

---

## Edge cases, all determined and tested

| Case | Behaviour |
|---|---|
| A — provisional, unratified | **Retracted.** Every chunk moves together |
| B — ratified | **Refused** `source-contains-ratified-knowledge` |
| C — partially ratified | **Refused**, entirely. The unratified siblings are untouched |
| D — chunks already superseded | **`source-not-found`.** A superseded ingested node is no longer any fact's active node; retracting history would be the rollback K3 refuses to build |
| E — expired / stale / future-effective chunks | Retracted like any other: standing is orthogonal to withdrawal |
| F — digest not found | **`source-not-found`**, fail-closed |
| G — digest belongs only to another tenant | **`source-not-found`** — indistinguishable from absent, so it cannot probe what other organizations hold |
| H — repeated retraction | **`source-not-found`.** Deterministic, and files no second mutation |
| malformed digest | **`invalid-source-identity`**, refused before any statement runs |

---

## Transaction and concurrency

```
BEGIN
  lock every live fact/node pair carrying this digest      FOR UPDATE OF n
  refuse if the set is empty
  refuse if ANY of them is ratified
  retire each active node, predicated on it still being live
  append one knowledge.retract audit event per fact        (same transaction)
COMMIT
```

**The serialization guarantee, stated exactly:** two concurrent retractions of the same source are
serialized by `FOR UPDATE OF n` on the node rows. The loser blocks, then finds every row already
retired and refuses `source-not-found`. A concurrent supersession or ratification of one of those
facts is serialized by the same lock. Each retirement is additionally predicated on the node still
being live, so a zero-row update aborts the whole transaction rather than reporting a silent success —
the same compare-and-swap shape the rest of the repository uses.

A partially retracted source is not a state this code can produce, and neither is
mutation-without-audit or audit-without-mutation: both live in the same control-plane database and
the same transaction, exactly as K3 and K4 already arrange it. Proved by a test-only failure seam
that aborts midway and asserts every affected row is unchanged.

---

## Audit

The **existing** G1 sink, through `recordKnowledgeMutationWithin`. No new audit table.

The vocabulary gained one verb, `knowledge.retract` — `action` is free text on `audit_log`, so this
cost zero schema, exactly as `knowledge.supersede` and `knowledge.ratify` did before it.
`knowledge.delete` stays absent, and a test asserts it: a vocabulary entry is a claim, and nothing
deletes.

**One event per fact, not one per source.** A single event for N facts would need an identity this
vocabulary does not have and would make history unqueryable by fact key. Two narrow metadata fields
tie them into one act: `retractedSourceDigest` and `retractedFactCount`. Actor is server-resolved and
`actor_type` is hard-coded `human` by the sink — **no actor provenance was fabricated**.

---

## R6B integration

**No R6B change whatsoever.** Company Understanding was not taught about retraction and is
structurally forbidden from knowing. Tested end-to-end against a real database:

- category counts drop as facts are withdrawn, and the withdrawn ones appear as `withdrawnCount`
  rather than vanishing;
- retracting the last source in a category turns it **covered → missing**;
- unrelated categories are unchanged;
- **no cache invalidation exists to introduce**, because R6B persists nothing.

---

## Heby / agent firewall

Heby gains **zero** mutation authority, proved structurally: no `heby-*` module imports the writer,
the action, the contracts or the source listing; the action registry names no retraction; the writer
reaches no model, provider, embedding, execution, permit, `fetch` or `child_process`. Heby simply
stops retrieving the withdrawn Knowledge through the eligibility rule it already had.

---

## Schema verdict

**ZERO.** 30 files / 30 journal / 30 applied, unchanged. No table, column, enum value, CHECK, FK,
index or migration. `drizzle-kit generate` was never run.

---

## Tests

`tests/r6d-flow/retraction-postgres.ts` (real disposable Postgres) — source listing sees ingested
sources only; gates refuse in order and write nothing; malformed identities refused before any
statement; **tenant isolation both directions**; atomic multi-chunk retraction with row counts
unchanged (nothing deleted), statement/version/provenance preserved, the selection intact, unrelated
sources and the hand-authored fact **byte-identical**; exactly one committed `knowledge.retract` per
fact with a real actor; repetition deterministic and silent; **KR3 excludes all five and reports
`lifecycle-retired`**; R6B counts drop and covered → missing; ratified refused entirely with the
unratified sibling untouched; **rollback leaves every row unchanged**; superseded chunks are not
targets; no permit/attempt/request/provider/document delta; the only audit action in the suite is
`knowledge.retract`.

`tests/r6d-flow/boundaries-and-firewall.ts` (structural) — the writer cannot delete; the write set is
bounded by column; `retired` is an existing enum value; **exactly one module under `src` retires a
node**; it resolves the K2 authority and reaches no Governance one; the audit joins the transaction;
the action re-resolves nothing; the read seam and contracts are inert and pure; the surface says
retract and never delete and requires a typed confirmation; the coverage card offers no retraction;
Heby and the registry cannot reach it; R6B and retrieval do not know retraction exists; no schema, no
route, and the dead adapter is re-pinned as unreachable and unused.

### Bite-proofs — broken, watched fail, restored, sha256-verified

| Bite | Result |
|---|---|
| **A** — remove the `WHERE f.tenant_id` predicate | **did not fail** — investigated (below) |
| **A2** — remove the join-side `n.tenant_id = $tenant` predicate | **did not fail** — same reason |
| **A3** — remove **all three** tenant predicates | **failed as required** |
| **B** — remove the transaction wrapping | **failed as required** — rollback test caught it |
| **C** — add a hard `DELETE` to the writer | **failed as required** |
| **D** — add a retraction action kind to the registry | **failed as required** |
| **D2** — a Heby module imports the writer | **failed as required** |
| **E** — make R6B special-case retraction | **failed as required** |
| **F** — bypass the authority resolver | **failed at runtime; the structural assertion did NOT** — fixed (below) |

**Two results worth recording rather than smoothing over.**

**A and A2 did not fail because either tenant predicate alone blocks the tested scenario.** That is
what defence in depth means, and it is the same finding R6B recorded for its aggregate. The
meaningful bite removes all three, and that is what is recorded. The individual predicates are
redundant by design, not load-bearing alone.

**F exposed an assertion that could not fail.** `writer.includes("resolveKnowledgeWriteAuthority")`
matched the **import statement**, so it stayed true even with the call deleted. This is the R4C.1
ordering trap in both directions — the same file's transaction-ordering assertion had failed for the
mirror-image reason, matching the import instead of the call site. Both are now scoped to the
function body, and the strengthened authority assertion fails under bite F.

---

## Released firewall repairs

Three released suites failed, each on an honest pin R6D legitimately moved. **None was weakened.**

1. **`g1-flow` / `k3-flow` — the audit action vocabulary** was pinned to exactly three verbs. G1's own
   comment says this is the assertion it wrote to be updated by exactly this kind of change: an added
   action, no new authority, no migration. Now four, with `knowledge.delete` and `knowledge.rollback`
   still explicitly refused.
2. **`k2-flow` / `k3-flow` — the exported server-action census** gained `retractKnowledgeSourceAction`.
3. **`k3-flow` — "only the ratification writer updates a knowledge node."** This one mattered most.
   The rule K3 actually protects is *no in-place **content** edit*, and that still holds. So the
   retraction writer joins the allow-list **and** its `.set({…})` columns are now pinned exactly as
   K4's are — if a content column ever appears there, K3's invariant breaks through R6D's door and
   this fails.

---

## Canonical firewall

Byte-identical to Step 0, re-proved after the full suite: `applied=30`, `companies=2`,
`knowledge_nodes=1`, `knowledge_facts=1`, `documents=0`, `audit_log=17`, **`retired` nodes = 0**,
provider `version=30`, permits/attempts/requests `0/0/0`, databases `hebun_r1, postgres` — zero
disposable residue, `.env.local` sha256 unchanged. Every Postgres test and every bite-proof ran on a
disposable database. No provider call, no ceremony, no canonical write.

---

## Product truth

- Knowledge remains the **sole** authority; K4 remains the **sole** ratification authority.
- Retraction **withdraws**; it never deletes. Row counts are unchanged by design.
- The authoring band **cannot** withdraw what Governance ratified.
- Heby remains a read-only Knowledge consumer and gained nothing.
- Hebun still never stored the file, and the surface says so rather than implying a cleanup.

---

## Remaining limitations

1. **Ratified sources cannot be withdrawn at all.** The successor is a Governance-authorized
   withdrawal, which is K4's reversal question and needs its own gate. Today the operator must
   correct the individual records.
2. **Retraction is not reversible.** There is no un-retract act; restoring a source means ingesting
   it again — and it will be refused as a duplicate, because the chunk fact keys still exist.
   Re-ingesting after retraction is a known gap, not a solved case.
3. **The target is content, not an upload event.** The same bytes ingested twice under two titles are
   one source and retract together. Hebun retains no upload record that could distinguish them.
4. **Superseded chunks are unreachable** by a source-level act — correct, but it means a partly
   corrected source cannot be withdrawn as a unit.
5. **A retracted record still occupies its fact identity**, so the duplicate-ingestion rule still
   applies to it.
6. The dead raw-SQL Knowledge write path in `supabase-postgres-adapter.ts` still exists, unreachable
   and unaudited. R6D neither used, revived nor cleaned it up.

---

## Three questions

**What did we learn?** The cheapest way to add a capability is to become the first writer of a state
the readers already honour. `retired` had a defined meaning in retrieval and in coverage and no
writer at all; R6D supplied the writer and every downstream surface reacted correctly without a line
of change. The test that proves the design is the one FORBIDDING the readers from mentioning
retraction — if they had needed to know, the state would have been the wrong one to reuse.

**How does this improve Turkish Rug House?** Uploading the wrong price list is now one act to undo
instead of forty, and the corrected knowledge stops reaching Heby immediately — without anything
being destroyed, so the mistake and its correction both stay on the record.

**How does this become part of Hebun AI?** Bounded exceptions to an invariant are now a recorded
pattern: K3's no-in-place-edit rule admits a second writer, and the same column-level pin that bounds
K4's exception bounds R6D's. An invariant with a tested boundary survives; one with an unexamined
allow-list rots.
