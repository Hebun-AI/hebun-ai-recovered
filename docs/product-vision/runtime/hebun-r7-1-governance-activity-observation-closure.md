# Hebun R7.1 — Governance Activity Observation — Closure

**Released at `01d4d3f`. 406/406. Zero schema, zero migration, zero dependency, zero new authority, zero writers.**

Baseline entering the phase: HEAD `b9f16f5`, R6 closure tag
`hebun-r6-customer-knowledge-complete`, 30/30/30, `companies=2`, `knowledge_nodes=1`,
`knowledge_facts=1`, `audit_log=17`, provider `claude` `version=30` disarmed,
attempts/permits/requests `0/0/0`, zero disposable residue, 404/404.

---

## The gap

`audit_log` has existed since the audit-event-backbone migration. Seven governed writers append to
it, canonical holds seventeen real rows spanning two tenants, and **nothing read it**.

The only tenant-scoped read, `readKnowledgeMutationHistory`, answers one question about one
Knowledge fact and caps at 100 rows. Meanwhile `/director/governance/audit` stated that durable
audit records were empty.

So the one durable organizational event stream Hebun has was write-only, and the product said it did
not exist. R2F.1 named this class already: **a measurement nothing reads is not a capability.**

---

## What was built

One tenant-scoped derived observation of recorded governance activity, on the already-designated
Intelligence surface.

For the authorized tenant, and no other, it reports: how many acts Hebun recorded, when the most
recent one occurred, and how those acts break down by the ledger's own `action`, `result` and
`authority_source` values, plus the simulated/non-simulated split.

That is the whole capability. It is a reader.

---

## The claim, and the four things it is not

> **"Hebun can show a tenant a derived view of the governance activity Hebun has durably recorded."**

The subject is *what Hebun recorded*. Not what the organization did, and never how well it did it.

- A count is not **quality**. Sixteen committed acts is not good governance.
- A count is not **completeness**. It is what Hebun recorded, not what happened.
- A count is not **a rate**. No observation window is exposed, so no per-period reading is available.
- A count is not **a judgement**. Nothing scores, grades, ranks, explains or recommends.

Absent by construction: score, percentage, confidence, health, maturity, risk, efficiency,
bottleneck, recommendation, prediction, causal claim. A contract test walks every key of the
serialized view at every depth against a frozen forbidden vocabulary, so a judgement field cannot be
added quietly — the bite-proof added `healthScore` and the walk caught it on the key name, not on
the type.

**`action` is rendered verbatim.** No mapping to a friendly label, no grouping into categories, no
severity. Classifying `knowledge.retract` as a negative act would assert a taxonomy no authority
published. K4 settled the deeper form of this: **ratified is not true**.

---

## Authority

| | |
|---|---|
| **AUTHORITATIVE** | `audit_log`. Append-only; 9 insert sites across 7 governed writers, **zero** update and **zero** delete anywhere in `src/`. |
| **OBSERVED** | The rows themselves — actor-attributed, tenant-scoped, dual-timestamped. |
| **DERIVED** | Everything R7.1 produces. Recomputed per read. |
| **NOT** | Not human-confirmed, not Governance-ratified, not authoritative, not persisted. |

R7.1 creates **no authority and no second source of truth**. It owns no table, no row, no cache and
no state, so it cannot disagree with the ledger — the same property R6B's Company Understanding
relies on.

---

## Read seam

The existing audit subsystem was extended, not duplicated: same table, same tenant-predicate shape,
same locally-resolved database handle each audit writer already uses.

It counts **in the database**. Four `select` statements — scalars, then one grouping each for
`action`, `result` and `authority_source` — and **no `LIMIT`, `OFFSET` or `FETCH FIRST` anywhere**.
Three groupings cannot share one statement without a cross-product that would have to be
re-aggregated in JavaScript, which is the client-side counting this exists to avoid.

`resolveAuditDbOrNull` was deliberately **not** reused: it is exported from the Knowledge mutation
audit module, and reaching through it for a database handle would pull the Knowledge authority into
R7.1's import graph. R2F.1 paid for that lesson once, when an import taken "just for the DB handle"
tripped a firewall.

**The tenant predicate is one named expression** taken by all four statements — `tenantScope`, not
four copies. One place to audit, and removing it breaks every statement at once. There is no second,
redundant predicate, which is what makes the isolation bite-proof honest rather than theatre.

A tenant id that is not a uuid is refused before any statement runs.

---

## Pure projection

`audit_log` → tenant-scoped aggregate → pure projection → `/intelligence`.

The projection performs no I/O, owns no client, and never reads a clock: `generatedAt` comes from an
injected `now`. Ordering carries an explicit tie-break so two runs produce byte-identical output,
and comparison is by code unit rather than `localeCompare`, because a projection whose order depends
on ambient locale is not deterministic.

`totalRecordedActs` is passed through from the **independent** `count(*)` and never summed from the
grouped rows. Deriving it from them would make the two agree by construction and delete the only
signal that exposes a truncated grouping.

The `null` `authority_source` bucket is kept and sorts last. Dropping it would make the buckets sum
to less than the total — the silent-truncation defect R6B found.

---

## Tenant isolation

Enforced in SQL. Nothing is filtered after retrieval, and the entry point takes an authorized
`TenantContext` rather than a caller-supplied id — there is no cross-tenant or whole-ledger form.

Proven against real Postgres with two populated tenants and one empty one. Tenant A's ledger is
asserted from five independent angles that tenant B's rows would each disturb: total, action list,
result list, authority-source list, recency and simulated count.

**The bite was real.** Removing the predicate produced `132` against an expected `125` — tenant A's
125 rows plus tenant B's 7. No redundant clause masked it, so no defence-in-depth caveat is owed
here.

---

## Firewalls

Structural, over comment-stripped source, so prose cannot trip a check and a real capability cannot
hide behind prose.

- **No writer.** The strongest form is available because R7.1 writes nothing: no `.insert(`,
  `.update(`, `.delete(` or `.transaction(` in any R7.1 file, and no raw write statement in any
  server module. Exactly four `.select(` calls. It never appends to the ledger it observes.
- **No Knowledge.** Total prohibition — not the scoped kind R6B and R6D needed. No Knowledge table,
  schema, repository, retrieval, taxonomy or vocabulary is reachable. R6 holds **statements**; R7
  observes **acts**.
- **No model or agent.** No provider, Heby runtime, embedding, `fetch`, `child_process`, permit,
  attempt or action-request is reachable. The provider stayed disarmed throughout; no provider call
  was made during implementation or testing.
- **No persistence.** No placeholder table is reachable — `enterprise_projection_snapshots`,
  `enterprise_memory_records`, `learning_sessions`, `improvement_proposals`, `reasoning_traces`,
  `telemetry_events`, `event_log`, `command_audit`. No cache, no snapshot, no new table.
- **No new route.** The whole `src/app` tree is asked, not just the Intelligence subtree.

One deliberate scoping, stated rather than hidden: raw-SQL keyword checks run over the four server
modules, not the `.tsx` section. Applied to the component, `/truncate/i` matches the Tailwind
utility class. A firewall that fires on a class name teaches the next author to loosen the pattern,
which is how a real check gets weakened; the section is held to the ORM-verb and read-only-surface
checks instead.

---

## Migration verdict

**ZERO.** No migration, no column, no index — `audit_log_tenant_action_time_idx` already existed for
exactly this shape, and eight indexes were already on the table.

Pinned by **timestamp-prefix boundary**, not by a repo-wide count: no migration file sorts after
`20260817195446_r4a_tenant_provisioning_source`. A total would be false the moment another phase
lands one, and a drifting count stops proving what it was written for.

---

## Tests

Two new files. Both are new; no existing test was modified.

**`tests/r7-1-flow/boundaries-and-firewall.ts`** — structural, no database. Eight groups: no writer,
Knowledge unreachable, no model/agent, no persistence and no migration, tenant scope is one
expression with no cap, projection purity and determinism, no judgement vocabulary in the serialized
view, surface ownership and no new route.

**`tests/r7-1-flow/observation-postgres.ts`** — disposable Postgres. Tenant A seeded with **125
rows deliberately above the 100-row bound** the existing audit read carries, plus a second populated
tenant and an empty one. Proves correctness of every tally, per-action recency versus tenant-wide
recency, tenant isolation from five angles, honest empty observation, SQL/projection equivalence,
fail-closed behaviour on every unavailable path, and that reading changes nothing — verified by row
counts **and** by an md5 digest over the whole ledger, so a rewritten row would be caught, not only
an added one.

Canonical was never opened; the harness claims `DATABASE_URL` and restores it on drop.

---

## Bite-proofs

Every invariant broken deliberately, failure observed, restored, and all five source files verified
**byte-identical by sha256**.

| | Bite | Result |
|---|---|---|
| A | Tenant predicate removed | **FAILED** — `132` vs expected `125` |
| B | Real `.insert()` added to the read seam | **FAILED** — write firewall |
| C | `knowledgeFacts` imported | **FAILED** — Knowledge firewall |
| D | Real `fetch()` to the provider added | **FAILED** — model firewall |
| E | `healthScore` field added | **FAILED** — key walk caught `"score"` in `"healthScore"` |
| F1 | `.limit(100)` on the grouped statement | **DID NOT FAIL the count** — see below |
| F2 | `.limit(3)` on the grouped statement | **FAILED** — `4` vs expected `125` |
| F3 | Aggregate reimplemented over a bounded row listing | **FAILED** — `100` vs expected `125` |
| G | Projection snapshot persisted | **FAILED** — persistence firewall |
| H | Non-owner file writes `audit_log` | **FAILED** in all three repaired firewalls |
| I | Non-owner file merely imports the sink | **FAILED** in all three repaired firewalls |
| J | NUL byte injected into a module | **FAILED** — source-is-text guard |

**F1 did not fail the completeness assertion, and that is reported rather than smoothed over.**

A `LIMIT` on a *grouped* statement bites at the number of **groups**, not the number of rows. Tenant
A holds 125 rows but only five distinct actions, so `.limit(100)` truncates nothing and every
integration assertion still passes. What refused it was the structural prohibition on `.limit(`.

The two checks are therefore genuinely different, not redundant: the integration file catches a
bound that truncates real rows (F2, F3), and the structural file catches a bound that has not
truncated anything **yet**. Neither alone is sufficient. The test's own header comment originally
claimed the fixture covered both; that overclaim was repaired as part of this phase, because a
comment that promises more than the assertion delivers is the defect this codebase repairs
elsewhere.

F3 is the one that matters most — it is the literal R6B defect shape, and only the deliberately
oversized fixture catches it.

H and I bite-prove the **repaired** released firewalls, because a repair that quietly weakens a
check is worse than the defect it fixed. Both a write by a non-owner and a bare import by a
non-owner still fail all three.

---

## A NUL byte that every gate passed

A stray `\x00` reached a React key in this phase's own component — the character intended as a
leading space in `?? " unattributed"` was written as a NUL.

**It passed typecheck, lint, all 406 tests and a production build.** A NUL inside a string literal is
valid UTF-8, and nothing asserted on that key. What caught it was `git add`: the staged diff read
`Bin 0 -> 9021 bytes`, because git classifies a file with a NUL in its first 8000 bytes as binary —
and a source file git cannot diff is unreviewable from then on.

Two repairs, both in this phase: the key is now an explicit, collision-proof
`"authority-source:none"` / `` `authority-source:${…}` ``, and a `sourceIsText` assertion (bite J)
now fails on any NUL or invalid UTF-8 in an R7.1 file. A related obscurity went with it — the
projection sorted the `null` authority-source bucket last using a `"￿"` sentinel string; it now
uses an explicit `null` check, which reads plainly and does not invite this class of byte.

---

## Record-integrity repairs

R7.1 makes the product state, on one page, that Hebun holds durable governance records — while other
surfaces said it holds none. Those claims were already inaccurate before R7.1; R7.1 makes the
contradiction live. Repaired narrowly, and only where R7.1 makes them false:

- `director/governance/audit/page.tsx` — "why **it** is not a durable authoritative record" →
  "why **that trace** is not the durable authoritative record". The trace genuinely is not; the
  ledger genuinely is.
- `governance-audit-explainability/model.ts` — "There is no durable, authoritative audit persistence
  connected" was **false**. Now: durable records exist, written by the governed writers, and *this
  surface does not read them*.
- `governance-overview/model.ts` — "There is no durable audit persistence" → "**This surface reads
  no** durable audit persistence".
- `audit-explainability-surface.tsx` — "durable audit records are honestly empty" → "this surface
  reads no durable audit record".
- `intelligence-state-strip.tsx` — "Not connected" → "**Runtime inputs** not connected". The claim
  was true of the Organizational Intelligence Runtime's declared inputs and remains so, but
  unqualified at the top of a page that now shows real records it would read as "nothing here is
  real".

`durableRecords.present: false` was **kept**: that surface genuinely surfaces no durable record, a
released test pins it, and R7.1 does not change it. None of these repairs turns another surface into
a second R7 product surface — each states its own scope and stops.

---

## Product truth

Hebun can now show one organization how much governance activity it has durably recorded, broken
down by the ledger's own vocabulary, on the surface already designated for Intelligence.

`/intelligence` was already the honesty-compliant owner — `/director/intelligence` has redirected to
it since Phase 20D — so no mock became authority and no route was added. One region of that
workspace stopped being a vocabulary display and became a real derived reading. Everything else on
the page is unchanged and still honestly empty.

---

## Remaining limitations

- **This is governance activity, not operations.** `audit_log` records governance, identity and
  Knowledge acts. It holds no task, workflow, execution or outcome, because none of those tables has
  a writer. R7.1 cannot say how the organization *operates*, and does not pretend to.
- **Recorded is not complete.** The ledger records what **authorized** actors did.
  `KNOWLEDGE_AUDIT_BOUNDARY` already states the cost: unauthenticated and forbidden attempts are not
  recorded, so this is not an intrusion log.
- **No observation window.** `latestOccurredAt` is exposed; no earliest is. That is deliberate — a
  window invites rate reasoning, and a rate is one step from a judgement.
- **No `previous_state` / `next_state`.** Per-row payloads with no honest place in an aggregate, and
  no product requirement asks for them.
- **No drill-through.** The counts do not link to the individual acts behind them.
- **`entity_type` is not surfaced.** Truthfully derivable and deliberately omitted — adding a
  dimension because it looks useful is how a minimum slice stops being minimum.
- **One organization at a time.** By construction. There is no cross-tenant form and there must not be.

---

## Exact R7.2 dependency

R7.1 exhausts what the current substrate can truthfully support. **R7.2 — Operational Evidence
Substrate** is blocked on the same fact R7 Gate A established: there is no operational evidence to
observe.

Twenty candidate tables are migrated, empty, and have zero writers and zero readers. Their
dependency graph is closed with no entry point — `learning_sessions` needs `agents`,
`reasoning_traces` needs eight empty parents. Connecting any of them would produce a reader over
nothing.

R7.2 must therefore begin by earning **one real operational writer**, not by activating a table. Its
own Gate A decides which act is first, and it stays a separate Director gate.

---

## Three questions

**What did we learn?** A bound bites where the statement groups, not where the reader assumes. A
`LIMIT` on an aggregate truncates *groups*; a `LIMIT` on a listing truncates *rows*. A fixture sized
against the wrong one proves nothing and reads as if it proved everything — which is why the bite
that **did not** fail was the most useful one in the phase.

**How does this improve Turkish Rug House?** The record of who did what under whose authority is
readable by the business it belongs to, instead of only existing.

**How does this become part of Hebun AI?** R7 now has a released shape: read an authoritative
ledger, derive, carry provenance, claim nothing more. R7.2 inherits it and must earn its evidence
before it may observe anything.
