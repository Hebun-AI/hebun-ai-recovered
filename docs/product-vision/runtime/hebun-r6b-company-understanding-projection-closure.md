# Hebun R6B — Company Understanding Projection — Closure

**Released at `df95a7e`. 402/402. Zero schema, zero migration, zero dependency, zero new authority.**

Named *Company Understanding Projection*, deliberately not *Customer Onboarding*: three released
phases already own the word onboarding for identity and membership, and reusing it would collide
with `hebun-public-onboarding-entry-surface-complete`,
`hebun-p3-identity-and-membership-onboarding-runtime-complete` and
`hebun-onboarding-capability-handoff-custody-complete`.

---

## What was actually wrong

Hebun could ingest a file, chunk it, write it through a governed writer with an audit row, let
Governance ratify it, retrieve it for a question and cite it back — and told the customer **nothing**.
They uploaded a document, watched up to forty records appear in a fifty-row list, and had no way to
learn what Hebun now held, what was unconfirmed, or what it had no evidence about at all.

Every part of the machine existed. The feedback loop did not.

---

## What R6B is

A derived read model over the existing Knowledge authority. Ten declared areas, counted per tenant,
rendered as a section of the `/knowledge` page that already governs Knowledge.

It owns no table, writes nothing, calls no model, resolves no second authority, and adds no route.

---

## Coverage, and the three things it is not

An area is **covered** when the organization holds at least one Knowledge fact **in force** in it —
in force being the eligibility retrieval already enforces: readable, not archived or retired, not
expired, not yet to take effect.

- **Coverage is not correctness.** Hebun holds what it was given and verifies none of it.
- **Coverage is not ratification.** An area held up entirely by unapproved drafts is covered.
- **Coverage is not understanding.** It counts records, and a count is not comprehension.

These are not hedges. Each blocks a specific misreading, the surface repeats all three verbatim, and
a test asserts the operator summary still contains them.

**Missing** means one thing: Hebun holds no Knowledge evidence in force in that declared area. It
never means the organization lacks it.

---

## The finding that shaped the implementation

Gate A assumed the projection could count over `listKnowledgeSources`. It cannot.

`listFacts` is bounded at `KNOWLEDGE_LISTING_LIMIT = 50` and ordered by `(domain_key, fact_key)`. A
coverage view built on it loses the **alphabetically last** domains first — so `systems`, `policies`
and `partners` disappear before `customers` does, and the view reports a covered area as missing.
That is a false negative in the one claim it makes. `MAX_CHUNKS_PER_SOURCE` is 40, so **two ingested
sources reach the bound**.

Raising the bound was the other option and was wrong: `MAX_CHUNKS_PER_SOURCE` was chosen against it,
and Heby's evidence cap mirrors it, so widening it here would silently widen the model's context.

R6B added `countFactsByDomain` instead — one row per domain rather than per fact, so it needs no
bound at all. It is a second **statement** over the same join, never a second authority: no table, no
cache, no rollup, no write, no transaction. It shares `activeNodeJoin` with `baseQuery` rather than
restating the tenant predicate, so the boundary cannot drift by a clause.

A bite-proof reimplements the projection over `listFacts` and watches the >50-fact test fail. That is
why the aggregate exists.

---

## domain_key: classify, never erase

`domain_key` is free text, validated only for length and control characters, trimmed and otherwise
**case-preserving**. Canonical holds `Security`; fixtures hold `security`, `goals`, `ops` and Turkish
words. Exact matching would miss real records.

Matching folds through the **same `foldTurkish` KR3 already uses**, then lowercases. Order matters:
`"İ".toLowerCase()` yields `i` plus a combining dot above, which never equals a plain `i`. Folding
first turns `İ` into `I`, and only then does lowercasing produce `i`. A test pins this.

Nothing is rewritten — not a `domain_key`, not ingestion normalization, not a canonical row.

**Every domain no category claims is reported as `uncategorized`.** A taxonomy may classify what
Hebun knows; it may never erase it. The vocabulary is English, and a tenant filing under Turkish keys
will see them uncategorized and its categories missing — the honest outcome, stated in the descriptor
rather than papered over with a guessed mapping.

---

## Standing is reported, never summarised

`ratified` and `provisional` are counted per area rather than folded into a verdict, because K4's
ratification path writes the decision linkage and **deliberately leaves `knowledge_authority`
alone** — a ratified record is still `provisional`. The test asserts that exact truth rather than the
intuitive opposite.

`stale` (past review date) stays **covered**; `expired` and `not-yet-effective` are **not** coverage
and are reported separately, because *"you had evidence and it lapsed"* is a different thing to be
told than *"you never supplied any"*.

No score, no percentage, no confidence, no health figure, no truth value, no category-level
authoritative or confirmed flag. A test asserts the **serialized** view carries none of those words,
so a future field cannot smuggle one in under a different name.

---

## The write firewall is scoped, and says why

The obvious assertion is R5.1's shape — *"no file under `src/` writes this table"*. It would be
**false**.

`src/features/persistence/supabase-postgres-adapter.ts` contains raw-SQL `insert into
knowledge_nodes`, `update` and `delete`, pointed at `HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL`. It is
unreachable — `storage-manager.ts` has its postgres branch commented out and always returns the
memory adapter, and the only `knowledge-nodes` adapter ever constructed is built in
`provider-registry.ts` purely to call `.health()` and then disposed — but it exists.

A firewall that states something false is worse than none: the next reader trusts the claim, not the
code. So the test asserts the true, narrower thing (the R6B modules write nothing) **and pins the
adapter's existence**, so the scoping stays a recorded decision rather than an accident. If that
adapter is ever removed, the pin fails and the firewall can legitimately widen.

Auditing or removing it is its own phase. R6B neither reactivated nor cleaned it up.

---

## IMPLEMENTED

- **Frozen taxonomy** — ten declared areas as a product descriptor in the `capability-map.ts` /
  `workspace-model.ts` style. Global, identical for every tenant, independent of database, tenant,
  clock and model. No table, no writer, no tenant-configurable variant.
- **Uncapped per-domain aggregate** — `countFactsByDomain` on the existing repository, sharing
  `activeNodeJoin`, `GROUP BY domain_key`, `count(*) filter`, read-only.
- **Deterministic projection** — pure function, injected clock, no I/O.
- **`/knowledge` understanding section** — above `KnowledgeRecords`, presentational, no controls.
- **Visibility** — covered / missing / ratified / provisional / stale / expired / not-yet-effective /
  withdrawn / uncategorized.

## NOT IMPLEMENTED

AI extraction · contradiction detection · confidence · scoring · onboarding percentage ·
`company_profiles` table · model calls · embeddings · semantic retrieval · persisted onboarding state ·
new Governance mechanism · new role · new route · new workspace · R7 Organizational Intelligence.

---

## Record-integrity repairs

Two live claims in `capability-map.ts` that the new surface makes visible:

1. *"knowledge_facts / knowledge_nodes / knowledge_edges … hold no rows, because nothing writes to
   them"* — **false since K2**. Facts and nodes now have a governed writer and canonical holds rows.
   The sentence grouped three tables that have since diverged; `knowledge_edges` genuinely still has
   zero writers and zero readers and is now stated separately.
2. The **schema-only organizational tables** (`organizations`, `departments`, `missions`, `goals`,
   `plans`, `policies`, `workflows`, `memories`) are now named as having zero runtime — because R6B
   reports areas called *organization*, *goals*, *policies* and *operations*, and a reader could
   otherwise conclude those tables had been connected. They have not: every area is counted over
   `knowledge_facts` alone.

Not repaired, recorded and unchanged: the stale reference to the R5.1-deleted
`provider-authority.server.ts` in `knowledge-write-authority.server.ts`; the unreachable
`case "ratified"` branch in `knowledge-evidence.server.ts`; `knowledge_health = 'contested'` as
vocabulary with no writer; the dead persistence adapter above.

---

## Tests

`tests/r6b-flow/coverage-postgres.ts` (real disposable Postgres) — empty tenant reports all ten
missing with no score; standing preserved and ratified-still-provisional asserted; covered ≠ ratified;
stale covered while expired is not; tenant isolation including a fact pointing at another tenant's
node; **60 bulk facts proving the aggregate survives past the listing bound while `listFacts` reports
`truncated: true`**; case-insensitive `Security`; the Turkish fold pinned; superseded versions cannot
reappear; **the SQL buckets asserted equal to `exclusionReasonFor` and `deriveKnowledgeFreshness`**
over the same rows; audit/permit/attempt/request counts asserted as a **delta across one read**, never
against zero; malformed tenant ids query nothing.

`tests/r6b-flow/boundaries-and-firewall.ts` (structural) — taxonomy frozen, exactly ten, stable order,
no duplicate key, no key claimed twice, accepted keys stored pre-folded; mapping classifies and never
erases; no category-level standing claim under any name; the scoped write firewall plus the adapter
pin; no model, provider, agent, execution or `fetch` reach; the projection is pure; the read seam
resolves no second authority; `/knowledge` has no child route; 30 migrations; no
company-profile-shaped schema file; the section renders above the records and offers no control.

### Bite-proofs — broken, watched fail, restored, sha256-verified

| Bite | Result |
|---|---|
| A — tenant predicate removed from the aggregate | **failed as required**; restored byte-identical |
| A′ — both tenant clauses removed from the join | **failed as required**; restored byte-identical |
| B — fake Knowledge write in an R6B module | **failed as required**; and the dead adapter proven **not** to trip the same assertion |
| C — category-level `authoritative`/`confirmed` | **failed as required** in the structural suite |
| D — eleventh category added | **failed as required** |
| E — projection reimplemented over `listFacts` | **failed as required** — this is what proves the aggregate necessary |

**A worthwhile negative result:** removing *only* the node↔fact tenant clause did **not** fail. Either
tenant clause alone blocks the tested cross-tenant scenario — which is what defence in depth means —
so the meaningful bite removes both, and that is what is recorded. The individual clause is redundant
by design, not load-bearing alone.

---

## Product truth

- Knowledge remains the **sole** authority. Company Understanding derives and owns nothing.
- Coverage ≠ correctness. Coverage ≠ ratification. Coverage ≠ understanding.
- RATIFIED ≠ TRUE, unchanged from K4. A ratified record is still `provisional`.
- No model was called, no provider armed, no fact created, ratified or superseded.
- Canonical is byte-identical: 30/30/30, `companies=2`, `knowledge_nodes=1`, `knowledge_facts=1`,
  `documents=0`, `audit_log=17`, provider `version=30` disarmed, external-send absent,
  permits/attempts/requests `0/0/0`, zero disposable residue.

---

## Remaining limitations

1. **The taxonomy is English.** Non-English domain keys surface as uncategorized rather than being
   guessed into an area. Stated in the descriptor; not a defect to fix by guessing.
2. **No contradiction detection.** Two documents disagreeing about the same policy both count.
   `knowledge_health = 'contested'` remains vocabulary with no writer, and detecting it needs
   semantics — `semantic-retrieval` and `embeddings` are both `not-connected`.
3. **No deduplication.** The pinned R4C.1 behaviour stands: the same content under a different source
   title is a second fact set, and the projection cannot tell a duplicate from a corroboration.
4. **Coverage cannot see quality.** Forty chunks of one weak document cover an area as thoroughly as
   one precise statement.
5. **Categories are Hebun's, not the tenant's.** A business whose knowledge does not fit them reports
   as missing in areas it may not have.
6. **Value is unproven at scale.** Canonical holds one fact and two fixture tenants; the >50 test
   proves the mechanism, and no real corpus has exercised it.
7. The dead raw-SQL Knowledge write path in `supabase-postgres-adapter.ts` still exists, unreachable
   and unaudited.

---

## Three questions

**What did we learn?** A read seam's bound is part of its meaning. `listFacts` capping at 50 is
correct for a list — the caller is told it was capped — and silently wrong for a count, because the
bound sorts by domain and therefore deletes whole categories rather than trimming each. The same rows,
the same predicate, the same tenant: what changed was the question being asked of them. Before reusing
a seam, ask what its limits mean *for the new question*, not whether it returns the right shape.

**How does this improve Turkish Rug House?** When the business runs on Hebun, uploading the catalogue
and the returns policy produces something the owner can see: these areas are covered, this one is
still unapproved, and about suppliers Hebun knows nothing. Today that ends at forty rows in a list.

**How does this become part of Hebun AI?** Derived read models are now an established shape beside
the authority they read: a frozen product descriptor, an uncapped aggregate on the existing
repository, a pure projection, and a section on the workspace that already owns the authority. Nothing
new was created for Hebun to be honest about.
