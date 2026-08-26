# R7.1.1 — Recorded Act Drill-Through: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `d9dfcdc207606cded3797272388303f16b4c7f64`, authored 2026-08-26 22:06:02 +0300.
**Parent:** `f8ba0b589c34d83fab8b4969ae19529b23b4130b`.
**Tag:** none — convention **measured**, not assumed. See §11.
**Production deployment:** `dpl_Bsuwduufje14npDjZDQkLf31hF1v` — target **production**, state **Ready**,
`gitSource.sha` = `d9dfcdc207606cded3797272388303f16b4c7f64`, ref `main`, repo
`Hebun-AI/hebun-ai-recovered`. Aliased at `www.hebuntech.com`, `hebuntech.com`,
`hebun-ai-recovered.vercel.app` and the `git-main` alias.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessors:** `hebun-r7-1-governance-activity-observation-closure.md`;
`hebun-hebycap1-command-capability-truth-closure.md`.

> **Record provenance, stated so it cannot drift.**
> · Repository, validation, staging and release facts — **independently measured** by this process.
> · Deployment status, deployed SHA and alias set — **independently measured** via the Vercel API,
>   watched from `BUILDING` to `READY`.
> · Gate A (`platform:preflight` against production) — **Director-executed**, read-only; output
>   returned verbatim.
> · The production `/audit` invocation — **Director-observed**. This process did not authenticate to
>   production and did not run the command.
> · The reconstruction of that output from released source, and the counterfactual renders — **this
>   process**, executed locally against the released module.

---

## 1. What this closes

`/audit` told every tenant:

> "No persisted security audit history exists. Runtime provenance is not a forensic trail, so there
> is nothing authoritative to show."

The ledger it was denying has **nine production-reachable writers**, and R7.1 had already made it
countable per tenant. R7.1's own closure named the remaining gap in its limitations:

> "**No drill-through.** The counts do not link to the individual acts behind them."

This is that drill-through. The first clause of the old refusal was false; the second was true, and
§5 records how the true half was kept.

## 2. What shipped, and what emphatically did not

`audit_log` remains the **sole authority** for recorded acts, and the nine `governance-audit/*`
writers remain its **only** writers — not one of them was modified. What was added is a second
declared **reader**: `act-history-read.server.ts` issues `select` and nothing else.

No new authority. No new table. No `event_log` writer. No second sink. No cache, no persistence.
**Zero schema, zero migration, ledger remains 36.**

## 3. The architecture decision that changed under pressure

The bounded read was first appended to R7.1's `read.server.ts`. It tripped a released guarantee:
that file is structurally asserted to contain **no `.limit(`, `.offset(` or `fetch first` anywhere**.

A bounded list needs a bound. Keeping it there would have forced the firewall to be narrowed from
*"no bound in this file"* to *"no bound in this function"* — strictly weaker, and bought only to make
a suite pass. So `read.server.ts` was **reverted to its released bytes** and the bounded reader was
given its own sibling file. Both properties stay absolute, each checkable in the file that owns it.

The precedent for the Heby side is G6C's: `governance-audit/*` **mixes reads and writes**, so a Heby
file importing one would hold a reference into a module that can append to the ledger. G1 §17 bans
the literal string in `read-commands.server.ts` — a **raw-source** check, so even a comment would
trip it. Heby consumes the pure `governance-activity` reader instead.

## 4. Fields exposed, and fields withheld

**Exposed — eight.** `occurredAt`, `action`, `entityType`, `actorType`, `result`, `source`,
`authoritySource`, `simulation`. Each is a database enum, a CHECK-constrained value, a timestamp, or
a closed compile-time constant written by the audit writers. **No exposed field can carry text a
user typed.**

**Withheld — ten, by absence from the SELECT statement**, not by a downstream filter a later edit
could delete: `previous_state`, `next_state`, `metadata`, `entity_id`, `actor_id`, `correlation_id`,
`causation_id`, `request_id`, `session_context_id`, `principal_reference_hash`.

Omission, not heuristic sanitizing. Nine writers carry nine typed metadata shapes; no single
contract governs their union, and a redactor for payloads you do not control is a guess — a guess
that becomes a leak when a tenth writer arrives. The identifiers answer no question a chronology
asks, and each is one more handle for correlating a person across acts.

## 5. What the surface may never say

`audit_log` records what **authorized** actors did. `KNOWLEDGE_AUDIT_BOUNDARY` already states the
cost: unauthenticated and refused attempts are never written. So no reading of this ledger can
evidence an attack, an intrusion, a breach or a threat — the rows that would show one were never
recorded. That is a limit of the **source**, which no reader can lift.

The command was therefore renamed **"Security audit history" → "Recorded act history"**, and the
honest half of the retired refusal survives as an assertion rather than a memory: a released test
forbids the command describing itself as security, intrusion, incident or breach coverage.

Rendering is **deterministic**. No model is consulted, nothing is summarized or classified, and no
act is called suspicious, authorized or successful beyond the `result` the ledger itself stored.

## 6. Bounded, tenant-scoped, fail-closed

**Bound.** Twenty acts — default *and* hard maximum, deliberately one number, with no parameter a
caller could raise and no pagination. The total is counted **independently and unbounded**, never
inferred from the page length, so a truncated read says `Showing 20 of 137 recorded acts` rather
than showing twenty and letting a reader believe that is all that ever happened.

**Ordering** is `occurred_at DESC, id DESC`. The tie-breaker is load-bearing: writers stamp logical
time, and acts written inside one transaction share it, so without it "the most recent" could be a
different twenty rows on each call.

**Tenant.** From the authorized session and nowhere else. There is no tenant-id parameter, no
cross-tenant form and no whole-ledger form. One `tenantScope` expression governs both statements, so
removing it breaks both at once — which is what makes the isolation bite-proof honest.
`audit_log.tenant_id` is nullable; a NULL-tenant row belongs to no organization and reaches none,
proved against real Postgres with a seeded global row.

**Three outcomes, kept apart.** `recorded` · `empty` (the ledger was read and holds nothing — an
established fact) · `unavailable` (**UNKNOWN, never empty**). "Nothing was recorded" and "Hebun could
not look" are different sentences, and a failed read rendered as an empty history would be Hebun
asserting an organizational fact it never established.

## 7. Gate A — the production premise, measured before release

`platform:preflight`, the released read-only ceremony, run by the Director against production:

```
posture   : PRODUCTION deployment possession — cluster 7675444875863894887, database neondb
authored  : 36 migrations in this checkout        applied: 36
audit_log : 14
```

**That 14 is DATABASE-WIDE, not tenant-scoped.** `tenant_id` is nullable, so preflight's count could
not establish how many rows belonged to the production tenant, and this record did not claim it did.
It established only that the "nothing exists" clause was false.

## 8. Production acceptance

The Director authenticated into production Heby and ran `/audit`. It took the **`recorded`** branch:

```
14 recorded acts, most recent first.
```

**The tenant-scoped total is 14**, and Gate A's database-wide total is 14. The two agree, so **all
fourteen rows belong to the production tenant and none carries a NULL tenant** — established by the
tenant-scoped reader, not inferred from preflight.

### Reconstructed character-for-character from released source

`/audit` was rendered locally from the released module with the fourteen acts production reported,
and diffed against the observed text:

```
diff evidence-audit.txt rendered-prefix.txt   ->  no difference
sha256  62b3de457171e51702f9b0c69dee089f1c027cb8186ccdacd6b7f8189f1ccc48   (both files)
```

### The match is discriminating, not vacuous

A reconstruction proves nothing if every input produces the same text. Three counterfactuals were
rendered from the same released module; none resembles the observed output:

| Counterfactual | Renders |
|---|---|
| `empty` | *"Hebun has recorded no acts for your organization… the ledger was read and holds nothing for you."* |
| `unavailable` | *"UNKNOWN, not empty. Hebun did not establish that nothing was recorded — it established that it could not look."* |
| ledger larger than the bound | `Showing 20 of 137 recorded acts — the 20 most recent first.` |

Fourteen is below the bound of twenty, so `truncated` is false and no "showing X of Y" line appears —
which is itself the correct behaviour, and distinguishable from the truncated form above.

### What the live output confirmed

- **Ordering** strictly newest-first across fourteen distinct timestamps. Two near-simultaneous pairs
  (`06:28:39.128`/`.036` and `06:16:25.789`/`.722`, about 90 ms apart) make the tie-breaker's reason
  visible in real data.
- **Verbatim reporting** of the writers' own verbs — `governance.genesis-nomination.accepted`,
  `governance.bootstrap.established`, `governance.role.provisioned`,
  `integration.connection.created`, `integration.credential.stored` / `.replaced`,
  `knowledge.create` — never relabelled, grouped or scored.
- **Nothing withheld leaked.** No jsonb, no entity id, no actor id, no correlation, request or
  session id, no principal hash.
- **No forbidden claim.** No intrusion, breach, incident or threat language anywhere.

### One thing NOT observed in production, stated rather than glossed

The released output carries two closing lines and a provenance sentence (*"audit_log — Hebun's own
append-only record of acts it carried out… it is not an intrusion log and cannot show an attack, a
breach or a threat."*). The returned evidence ends at the last act, so **those lines were verified
against source and by suite only, never observed in production.** They are present in the deployed
code and asserted by `act-history-truth.ts` §9; that is a weaker form of evidence than the fourteen
rows above, and this record does not pretend otherwise.

## 9. Validation evidence

- R7.1.1 truth, firewall and real-Postgres suites: **pass**.
- Directly affected released suites: **45/45**.
- **Bite-proofs: 12/12 mutations bit.** Byte-identical restoration verified by SHA-256 across all six
  source files before staging.
- typecheck exit 0. lint exit 0 (14 pre-existing warnings, none in R7.1.1 files).
- Full suite from the exact candidate tree: **`502 passed, 0 failed, 502 total`** — rerun, not reused.
- Import graph re-proved by an independent walker from the final tree: **62 files**, reaches the
  reader and the ledger, **zero** banned-root reaches, **zero** write shapes.

### Two bite-proofs were wrong before they were right

**M2** initially mutated R7.1's catch block instead of this phase's. Both functions contain a
`status: "unavailable"` / `reason: "read-failed"` pair and `String.replace` takes the **first**
match, so the mutation edited a function no suite here exercises — and survived while looking
exactly like a bite that had been attempted. The find-string now carries this function's own detail
sentence. **M9** bites on the banned-root assertion rather than the model-name one; pinning the
latter would have been a bite-proof asserting a message the run never produces.

### A firewall claim that was retracted as false

An early version of the firewall asserted `event_log` was unreachable from this phase. **It is not.**
`db/client.server.ts` does `import * as schema from "./schema"` and the barrel re-exports every
table, so **every module in the repository that can open a database reaches `event-log.ts`** —
R7.1's own aggregate and all nine audit writers included. Asserting otherwise would have been a lie
in a firewall.

The honest guarantee is not "the table is unreachable" but **"no statement in this phase touches
it"**, and that is what is asserted: the phase's own files never name the binding. `audit_log` stays
the single sink for recorded acts, and this phase adds no second one.

## 10. Four released pins repaired by declaration, not weakened

G1, G2 and K2 each carry the **same** audit-sink reader allowlist — the census is duplicated three
times — and each now names the second reader. Their **write** censuses were untouched, and the new
file's absence from them is the proof it writes nothing. G1's own comment records why the two
censuses were split: *"the first READER of the sink appeared and tripped a WRITE firewall"*.

S1's availability census moves `/audit` into the available set, in the form R2F.1 used for `/usage`
and K1 used for `/knowledge`, and gains an assertion that the command may not describe itself as
security or intrusion coverage.

## 11. Release mechanics

One commit, thirteen paths, +1486/−13, staged by explicit pathspec — never `git add .`, `-A` or
`commit -a`. Before push the live remote was re-measured with `git ls-remote` and confirmed to be
exactly the commit's parent; the push was fast-forward, with no force, no rebase and no history
rewrite. The 75 unrelated untracked items were untouched throughout.

**Tag: none.** Measured, not assumed: the most recent tag sits eighteen commits back, and the eight
or more feature releases since it are all untagged. The convention in force is untagged.

## 12. Final truth ledger

| | |
|---|---|
| DESIGNED | **YES** |
| IMPLEMENTED | **YES** |
| VERIFIED | **YES** — 502/502 rerun, 12/12 bit, typecheck + lint clean, real-Postgres isolation |
| RELEASED | **YES** — `d9dfcdc…`, pushed, remote converged |
| DEPLOYED | **YES** — production Ready, deployed SHA independently verified |
| PRODUCTION_ACCEPTED | **YES** — Director-observed `/audit`, reconstructed byte-identically, discriminating against three counterfactuals |

NEW_AUDIT_AUTHORITY = **NO** · NEW_TABLE = **NO** · EVENT_LOG_WRITER = **NO** ·
SCHEMA_CHANGED = **NO** · MIGRATION_ADDED = **NO** · LEDGER = **36**

## 13. Remaining limitations

- **One page of twenty, no pagination.** A ledger past twenty lists only the most recent acts, though
  the total is always stated. Production holds fourteen, so the bound has not yet bitten in reality.
- **No `entity_id`.** An act cannot be traced to the specific record it touched.
- **Not an intrusion log**, by property of the writers. Unfixable by any reader.
- **The closing and provenance lines are source- and suite-verified only** (§8).
- **`event_log` is transitively reachable** via the schema barrel, as it is for every database module.
  Untouched by this phase, not unreachable.
- **One tenant.** Cross-tenant isolation is proved by suite and by a real-Postgres fixture, never in
  production, because production has one organization.

## 14. Closure boundary

R7.1.1 let one organization read the record of what Hebun did on its behalf. It created no operational
evidence, no candidate generation, no planning, no agents, no workflows and **no execution runtime**.
It added no authority and no table, and it made `audit_log` no more and no less authoritative than it
already was.

R7.1 said a bound bites where the statement groups, not where the reader assumes. R7.1.1 adds the
other half: a bound that cannot name its own total is a completeness claim nobody made out loud.
