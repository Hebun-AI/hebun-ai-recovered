# R2F.1 — Provider Usage Aggregation — Closure

**Status:** released
**Scope:** the provider-reported token usage Hebun **already recorded** becomes truthfully readable
and aggregatable, tenant-scoped.
**Predecessor:** R4C.2 PDF ingestion (`a64234b`, `hebun-pdf-ingestion-complete`).
**Schema change:** none. **Migration:** none. **New dependency:** none. **New workspace:** none.

---

## 1. What already existed, and what R2F.1 actually added

The measurement was never the gap. Since R2D, `persistExchange` has written the provider's own
token counts onto the assistant `messages` row, alongside the tenant, provider, model, transport,
correlation id and provider request id. Every one of those columns was written correctly — and then
read by nothing. A repository-wide search for a consumer of `input_tokens` / `output_tokens` outside
the write path returned only mock data and simulation fixtures. Zero `sum()`. Zero `GROUP BY`.

So Hebun could state, per exchange, exactly what a call consumed, and could not answer "how much in
total" at all. Its own `/usage` command said so out loud:

> *"No usage-aggregation authority exists. Individual exchanges record their own token counts, but
> Hebun has no seam that totals them, and an invented total would be worse than none."*

**R2F.1 adds the aggregation/read authority. It adds no measurement.** The numbers it reports are
the same numbers that were already on disk; the phase closes the link between measured and readable.

That distinction is the whole scope. Cost derivation, pricing, budgets, quotas, reservation,
dispatch-time enforcement and billing are all explicitly **out**, and none of them is partially
present.

## 2. Definition: recorded provider usage

> Durably persisted, provider-**reported** token counts, belonging to the requesting tenant, written
> from a **real** provider transport.

It is deliberately **not**: estimated spend, the external provider's bill, monetary cost, total
historical consumption, simulated usage, or usage including calls whose local record never landed.

Every surface preserves that distinction in its vocabulary — *recorded tokens*, *recorded provider
calls*, *unknown-token rows*. Nothing says *spent*, *cost*, *charged* or *billed* as a claim.

## 3. Totals are a lower bound, and the surfaces say so

A provider call and its local record are two separate events. `persistExchange` runs **after** the
HTTP call returns, in its own transaction, and swallows failure into an honest `durable: false`. So
a request can succeed — resources really consumed — while no row is ever written: a timeout after
the provider already did the work, a crash between response and commit, a persistence error.

Nothing downstream can recover those. An aggregation over what **was** recorded is therefore a
floor, never the true total. Both surfaces state this in their own words rather than letting a floor
be read as a fact.

## 4. The real-transport predicate was proved, not guessed

`messages.transport` is the closed union `"fake" | "live"`, written only for a model-origin answer.
Canonical confirms the vocabulary: `live` 5 rows, `fake` 6, NULL 115.

`"live"` is bound to the exported constant `REAL_PROVIDER_TRANSPORT` and asserted against real rows
in the durability suite. The `fake` rows come from the local dev-proof transport, which contacts no
provider and emits a synthetic `{0, 0}` — counting them as usage would report proof runs as
consumption, and would do it invisibly, because zero looks like nothing.

## 5. Unknown is a count, never a zero

A row whose token columns are NULL means *the provider did not report this*, which is a different
statement from *this consumed nothing*. Folding the first into the second manufactures a measurement
out of an absence.

So the contract carries `recordedCalls`, `fullyMeasuredCalls`, `unknownTokenRows`, `inputTokens`,
`outputTokens`, `totalTokens`, with the invariant

```
recordedCalls === fullyMeasuredCalls + unknownTokenRows
```

held **by construction** — `unknownTokenRows` is derived by subtraction rather than counted
separately, so two aggregates cannot drift apart.

The sums cover fully measured rows only, restricted in SQL by
`filter (where input_tokens is not null and output_tokens is not null)`. This mirrors the rule the
response validator already applies per row: `totalTokens` there is `undefined` unless both counts
came back. A half-measured row contributing its known half would produce a figure that is neither
the input total nor the output total.

The single `coalesce(…, 0)` wraps a sum over an **empty set** — a bucket where no row was fully
measured — and never converts a NULL token value into a zero; the `filter` removed those rows from
the sum before `coalesce` is reached.

## 6. Query shape

One statement, grouped at the finest granularity any surface needs — `provider × model × UTC day`.
The result set is bounded by the **cardinality** of those dimensions, not by the number of messages,
so this does not degenerate into "select every row and sum it in JavaScript" as history grows. The
coarser views are folded from those buckets in memory: one round trip, not four.

**No index, no migration, no rollup table, no materialized view, no cache, no stored counter.** At
126 rows a sequential scan is the honest answer, and an index added before any query had ever run
would have been a guess.

Days are UTC, computed in PostgreSQL with an explicit `at time zone 'UTC'` so the result never
depends on the server's local zone. No tenant timezone exists anywhere in this schema and R2F.1 did
not invent one. `to_char` is used rather than a `::date` cast so the value arrives as a plain string
instead of a driver-dependent date object.

## 7. Tenant isolation

`tenantId` never appears in a client contract. Both consumers resolve the tenant server-side via
`resolveTenantContext()` and hand over a `TenantContext`; the module takes the context, not an id.
The predicate lives in the statement itself, and there is no unscoped read and no "all tenants" mode.

## 8. Suspension and provider-off, both inherited rather than re-implemented

**Suspension** is R4B's boundary and stays there. `resolveSessionFromReference` re-reads company
state per request, so a suspended tenant resolves to `null` and is refused before any read. No
company-state query was added to the usage path — a second lifecycle check would be a second place
for the two to disagree.

**Provider-off** is structural, not a flag. The aggregation module imports no control, no
projection and no transport, so the Director kill switch has no path by which it could suppress a
usage read. The switch governs the *next* request; it does not retract usage that already happened,
which is precisely when somebody is most likely to ask what was used.

## 9. `/usage` is now real

`availability: "available"`, `kind: "read"`, `safeWhenProviderOff: true`, `requiresModel: false`.
The stale `unavailableReason` is gone, and its absence from the whole repository is asserted by
test — a suite can otherwise pass *because* a stale claim survived. The description changed from
"Show token or spend totals" to "Show recorded provider token totals", because Hebun holds no
pricing and should not offer spend in a description either.

The command answers from the **same** `readRecordedProviderUsage` seam the provider matrix uses.
There is deliberately no second computation inside command dispatch: two implementations of one
number is how two surfaces come to disagree about it. The mechanism proving there is only one is
that `REAL_PROVIDER_TRANSPORT` — the predicate deciding what counts as usage — appears in exactly
one non-test source module, asserted by `deepEqual` on the file list.

## 10. UI

A read-only card on the **existing** `/director/provider-matrix`. No Billing, Cost, AI Spend or
Provider Budget workspace was created. No currency, no price, no budget, no percentage-of-anything.
The day list is truncated to the 7 most recent and **says so in its caption** when it truncates — a
window silently trimmed to look complete is the same defect as a fabricated total.

## 11. Audit

Reading usage writes nothing, including no "usage viewed" audit row. Reading a total is not a
governed state transition, and the `messages` rows are already the evidence. The durability suite
proves it by comparing row counts across nine tables before and after three reads.

Where a provider call left no row because persistence failed, aggregation cannot recover it, and
both surfaces state that limitation rather than implying completeness.

## 12. Two defects this phase found in released code

**A stale claim lived in another phase's test.** `tests/s1-flow/dispatch-and-availability.ts` pinned
`/usage` to `requires-source` and asserted its gap message. That pin was correct when written and
false the moment the aggregation seam shipped. It was repaired the way the same file already records
the K1 move: `/usage` was taken out of the source-blocked map and given an explicit available-set
assertion. A phase that closes a limitation has to repair every phase's record of it, not only its
own.

**The G2 Heby↔Governance firewall caught a real import edge.** The aggregation module first reached
its database handle through the Governance feature's null-safe resolver, purely because that helper
was convenient. `heby-provider-ops` is a Heby surface, and G2 forbids any Heby surface from
importing Governance decision authority — "I only wanted the database handle it happened to expose"
is still an import, and exactly the incidental edge the firewall exists to keep out of the graph.
Fixed by resolving the handle directly from the database client, the way the sibling
`provider-authority.server.ts` and the durable conversation repository already do. The seam now
carries its own copy of that assertion, so a re-import fails locally instead of only in a distant
suite.

## 13. `MAX_LIVE_CALLS` — a stale claim repaired, the gap left open

The live transport documented `MAX_LIVE_CALLS = 1` as *"a hard per-process live-call budget"*. It is
not one and never was: the counter lives in the closure `createLiveClaudeTransport` returns, and
`selectModelTransport` builds a **fresh** transport on every request with nothing memoising it. The
count resets each time.

The comment, the constant's doc and the runtime error message now state the true guarantee — **one
transport instance allows one live call**, and therefore one answered request makes at most one
call. The mechanism was not redesigned.

**The gap is real and remains open:** Hebun has **no cross-request or per-process bound** on live
calls. The controls that do exist are the durable Director connectivity switch (all-or-nothing, read
before dispatch) and `MAX_LIVE_OUTPUT_TOKENS` (per request, refused before any network I/O). Closing
it means deciding who may own a durable spend bound — see below.

## 14. What R2F.1 deliberately does not do

No pricing, no currency, no monetary cost. No budget, quota, credit, reservation, hard cap, soft cap
or request-count cap. No dispatch refusal on the basis of any total. No billing, subscriptions or
invoicing. No `companies.plan` semantics — that column still has **zero readers and zero writers**
and was not promoted. No new Security authority. No cross-tenant view and no platform operator.
No change to provider dispatch.

Their absence is asserted structurally, against comment-stripped source, so a header explaining why
pricing is absent does not itself read as pricing.

## 15. Standing debt, unchanged by this phase

- **Budget enforcement is still blocked on authority ownership.** Gate A found no existing authority
  that can honestly own a tenant provider budget: the provider-control authority writes a **global**
  row from a **tenant-scoped** role, and tenant Governance would strand itself. R2F.1 reuses neither
  for anything, and reads stay tenant-scoped.
- **`provider_connectivity_controls` is global while its write gate is tenant-scoped** — an `owner`
  in one tenant can flip connectivity for every tenant. Pre-existing; R5/architecture debt.
- **No cross-request live-call bound** (§13).
- Totals remain lower bounds for as long as persistence can fail after a provider call (§3).

## 16. Verification

| Gate | Result |
|---|---|
| `npm run verify` | **exit 0** |
| Test suite | **398 passed, 0 failed** (396 at R4C.2 + this phase's 2 files) |
| Lint | 0 errors (14 pre-existing warnings, untouched files) |
| Typecheck | exit 0 |
| Build | compiled successfully |
| `git diff --check` | clean |
| Migrations | 30 files / 30 journal / **30 applied** — unchanged |
| Canonical | 2 companies, 126 messages, 5 live (3798 in / 894 out), `claude/false`, external-send absent, attempts/permits/requests 0/0/0, Knowledge 1n·1f, documents 0, audit_log 17 — **all unchanged** |
| `.env.local` | sha256 unchanged |
| Disposable DB residue | none |

**Bite-proofs — each defect induced, observed, reverted, module restored byte-identical:**

| Guard | Induced defect | Observed failure |
|---|---|---|
| Tenant isolation | removed the `tenant_id` predicate | `recordedCalls` 3 → **4** (another tenant's row) |
| Real-transport filter | removed the `transport` predicate | `recordedCalls` 3 → **5** (fake + deterministic) |
| Unknown-token semantics | `filter` → plain `coalesce(sum, 0)` | `inputTokens` 300 → **8077** |
| Stale-claim guard | reintroduced the old `unavailableReason` fragment | record-integrity assertion failed |
| One-computation guard | referenced the predicate from a second module | file-list `deepEqual` failed |

## 17. An operational note

During this phase the host disk filled. That stopped the Hebun PostgreSQL instance
(`~/Developer/hebun-data/postgresql14`, port 55432 set in its own `postgresql.conf`) and made every
shell command fail. Recovery: free space, then restart from the data directory named by that
instance's own `postmaster.opts` — not from a similarly-named Homebrew data directory, one of which
exists on this machine and contains **no** `hebun_r1`. Crash recovery replayed a `DROP DATABASE` for
a disposable test database and canonical came back byte-identical on every counted value.

---

**Released at:** see the phase tag `hebun-provider-usage-aggregation-complete`.
**Next gate:** R2F budget enforcement remains **blocked** pending an answer to who may own a tenant
provider budget. That is an authority question, not an engineering one, and it is unchanged by this
phase.
