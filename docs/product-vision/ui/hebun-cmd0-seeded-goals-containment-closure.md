# CMD-0 — Seeded strategic goals, contained (closure)

**Released 2026-08-20 · tag `hebun-cmd0-seeded-goals-contained` · implementation `5fc7d10`**
**Classification: A — SEEDED GOALS CONTAINED / NO NEW AUTHORITY**

Entry state: `main` at `aaee4e9`, `HEAD == origin/main`, 0 ahead / 0 behind, 425/425, typography tag
`hebun-typography-contract-proven` peeling to `84ccaeb`.

A narrow truth repair, taken before the canonical Command architecture gate. Two source files and
two test files. No schema, no migration, no row, no writer, no resolver, no repository, no
authority, no tenant-boundary change, no canonical Knowledge change, no Command IA change.

---

## 1. The defect

`/director/goals` — Command · Strategic Goals — reported `connected: true` over four goal rows and
described them as **"goal-runtime — derived from the knowledge graph (Goal Registry)"**. Reproduced
by execution, not inspection:

```
connected: true | count: 4 | source: goal-runtime — derived from the knowledge graph (Goal Registry)
   goals:GO-104  Legacy CRM sunset       fromSeedRegistry: true
   goals:GO-101  Reduce churn below 8%   fromSeedRegistry: true
   goals:GO-102  Launch enterprise tier  fromSeedRegistry: true
   goals:GO-103  SOC2 readiness          fromSeedRegistry: true
```

A real authenticated tenant was told their organization holds four strategic goals. It holds none
that Hebun knows about.

## 2. The exact source chain

```
src/features/registries/records.ts            4 literal rows, GO-101 … GO-104
  -> knowledge-graph/graph-builder            registry records -> graph nodes
    -> knowledge-crud/node-adapter            seed(); every node forced lifecycleStatus "active",
                                              createdBy / updatedBy "Seed"
      -> runtime-projection goal-projection-builder   filters nodeType Goal + lifecycleStatus active
        -> GoalRuntimeService.listGoals()
          -> command-goals/workspace-model     connected: goals.length > 0
```

"Legacy CRM sunset" is `archived` in the registry and survives the active filter **only** because
the seeder forces every node active. The surface therefore listed a retired goal as current.

## 3. Why the seed is neither canonical Knowledge nor a tenant-scoped authority

- **Not canonical Knowledge.** `getAdapter` in `persistence/storage-manager.ts` resolves to the
  **memory** adapter — the postgres and supabase cases are commented out. Nothing on this path ever
  opens a connection. Canonical Postgres holds one unrelated `knowledge_nodes` row.
- **Not tenant-scoped.** `grep tenant` over the whole chain — workspace model, `GoalRuntimeService`,
  `goal-projection-builder`, `node-adapter` — returns nothing. Not one function takes a tenant.
- **Not an authority.** Every row carries `createdBy: "Seed"`. No writer, no ratification, no
  provenance beyond the compiler.

## 4. The repair: the gate that already existed

The G2 mock-surface gate (`mock-surface-gating/gate.server.ts`) already answers "may a compiled-in
organizational fiction be presented right now?", and already withholds the Director dashboard for
exactly this reason. It was simply never consulted here. The goals read model now calls it.

**Withheld, not relabelled.** Marking the four rows "Seeded" and showing them anyway would still
tell the Director their organization has a SOC2 readiness goal. The G2 precedent is explicit — the
whole snapshot is withheld rather than partially trusted — and this follows it.

**No boolean a seed can turn true.** `connected` is gone. Both facts the model states are derived
from something outside it, so neither can go stale the way a literal does:

```ts
withheld   = !organizationalDemoDataPermitted()             // is a real tenant reachable?
provenance = activeProvider() === "memory" ? "seeded" : "unverified"
```

`GoalProvenance` has **no `"authoritative"` member**. If a durable store is ever wired this reads
`unverified`, never authoritative: establishing a goal authority is a separate gate and this file
may not award one by changing a string.

## 5. Real tenant — WITHHELD

`withheld: true`, `goals: []`, zero goal cards. The surface says so in its own words:

> **Strategic goals are unavailable** — The only goal source in this system is a compiled-in seed,
> so it is withheld rather than shown as this organization's goals. Hebun does not know what goals
> this organization holds.

Badge reads WITHHELD — never a count, never "Not connected". **Unavailable is not empty**, and the
released copy that collapsed them ("The goal authority returned no active goals") is gone.

## 6. Demo — SEEDED, explicitly non-authoritative

Nothing was deleted. Where the gate permits it, the pre-auth shell still shows all four rows:

- badge **"4 SEEDED"** (was "4 derived")
- source line: *"goal-runtime — a compiled-in registry seed in the in-memory store, not an
  organizational goal authority"*
- every card footer: **"Seeded · Row source: goals registry"**
- page context: *"No goal authority is established — nothing here is an organizational commitment."*
- the node status word (`VERIFIED` / `REVIEW`) is **withheld on seeded rows** — beside a compiled-in
  goal that word reads as an authority's verdict on an organizational commitment.

## 7. The honesty firewall: from path names to a property

**Before.** `command-l2/honesty.ts` banned `features/director/mock` and `features/intelligence/mock`
**by import path**, and `goalsHonest()` asserted only that `source` contained `"goal-runtime"` and
that `connected === goals.length > 0`. The seed walked past because its file is called `records.ts`,
and the count-derived boolean was *satisfied* by the seed rows. The guard protected nothing it was
written for. A longer list of forbidden names would fail the same way for the next innocent filename.

**After.** The load-bearing property is an outcome, measured by executing the real model:

> **While a real tenant is reachable, the Strategic Goals surface presents no goal at all.**

That sentence contains no path, no module name and no filename.

Supporting properties: the demo branch must be labelled `seeded` and must claim neither "knowledge
graph" nor "derived" nor "authoritative"; every listed row must carry `createdBy: "Seed"` in the
store; the two owned files may import no repository, no writer, no `drizzle-orm`, no `@/db/`, and no
`*.server.ts` other than the released gate; and the migration ledger (32 files, digest
`a54ab468e15c816f`), the repo-wide server-action count (9) and Command's eight-destination L2 are
each pinned.

## 8. Rename and intermediate-module proof

Demonstrated, not asserted. The suite injects two goal rows that never touch `records.ts` —

- **4a** an innocently named origin (`source: "company-data registry"`),
- **4b** written straight through the adapter's public API, as an intermediate module would —

proves each is **observable through the projection in the demo branch**, then proves each is
contained under a closed gate. Without the observability step the containment assertion would have
been proving that a stale cache was empty rather than that a new origin is contained.

## 9. Authenticated production-build verification

Verified on a `next build` served by `next start`, real shell, real session
(`senoltr@gmail.com` / tenant `acme`), signed in by the Director. Not the dev server: the typography
gate proved the dev CSS pipeline diverges from production.

| check | 1440 | 1024 | 768 | 390 |
|---|---|---|---|---|
| redirected to `/login` | no | no | no | no |
| **seeded goal titles in the DOM** | **0** | **0** | **0** | **0** |
| goal cards rendered | 0 | 0 | 0 | 0 |
| horizontal overflow | 0 | 0 | 0 | 0 |
| clipped text | 0 | 0 | 0 | 0 |
| text below the 12px floor | 1 | 1 | 1 | 1 |
| document height | 900 | 768 | 1024 | 844 |
| shell rail + header present | ✔ | ✔ | ✔ | ✔ |

`GO-101` / `GO-102` / `GO-103` / `GO-104` and all four titles are **absent from the DOM entirely**,
not hidden. Route-level, unauthenticated: `/director/goals` → 307 → `/login`, with zero seeded goal
titles in the served bytes. Shell unchanged — VI-1 identity, VI-2 rail and Level-2 column, and the
typography contract all intact.

## 10. What this release did not touch

Schema **0** · migration **0** (ledger 32 files, digest `a54ab468e15c816f`, unchanged) · rows **0** ·
new writer **0** (`"use server"` modules still 9) · new resolver **0** · new repository **0** ·
new authority **0** · new table **0** · new tenant projection **0** · new runtime **0** ·
provider / model / Computer Use **0** · canonical Knowledge **untouched** · tenant boundary
**unchanged** · **Command IA unchanged** (eight destinations, same order, Strategic Goals still at
`/director/goals`).

Two new import edges, both from the goals model, neither a writer: the released
`mock-surface-gating/gate.server` and `persistence/storage-manager#activeProvider`.

## 11. Bite-proofs

The in-suite proofs run in-process. Because a text mutation of a module cannot be re-imported inside
one process, **every behavioural guard was additionally mutated in the real production source and
the suite re-run in a fresh process**:

| production-source mutation | result |
|---|---|
| remove the real-tenant gate | RED — "the projection is withheld while a real tenant is reachable" |
| restore the released count-derived semantics | RED — same assertion |
| relabel the source "derived from the knowledge graph" | RED — "the stated source names the seed" |
| component badge `seeded` → `derived` | RED — "and never says derived" |
| seeder markers `"Seed"` → `"System"` | RED — "GO-101 was created by the seeder" |
| add a migration file | RED — "no migration was added or removed" |
| add a `"use server"` module | RED — "no server-action module was added" |
| remove a Command L2 destination | RED — "Command L2 is untouched" |
| `createRepository` import in the model | RED — "must not contain /createRepository/" |
| render the node status word on a seeded row | RED — "a seeded row's status word is withheld" |

Every mutation asserted it applied before counting; all files restored byte-identical, verified by
`shasum -c`. The first three also turn the released `command-l2/honesty.ts` red.

**Guard audit, stated honestly.** Neutering each of the 32 property assertions one at a time leaves
the suite green for 30, because assertion and bite-proof live in different sections and removing the
assertion also removes what the bite-proof re-checks. That measure is the wrong one here; the ten
production-source mutations above are the real audit, and each maps to a distinct property.

## 12. Tests

**426 passed, 0 failed, 426 total** on the released tree (425 → 426, the new suite), with no K2
flake. Typecheck clean · lint 0 errors (14 pre-existing warnings) · build clean ·
`git diff --check` clean · secret scan clean.

An earlier run on an intermediate tree showed the known
`tests/k2-flow/create-and-read-postgres.ts` concurrency flake. It was bounded rather than chased:
**4/8 on this tree, 3/8 at baseline with the change stashed**, and K2 imports nothing CMD-0 touched.
Pre-existing and unchanged in character. Two other failures in that run were
`53100 No space left on device` — the environment, not a verdict.

## 13. Remaining goals limitation

**Hebun still does not know this organization's goals, and now says so.** There is no goal
authority: no table, no writer, no tenant-scoped read, no canonical-Knowledge connection.
`/director/goals` under a real tenant is a permanently unavailable surface until one is designed.

Two residuals recorded, not fixed:

- The seed-provenance property keys on the literal `"Seed"` written by `node-adapter`. A future
  seeder writing a different marker would slip that classifier — but not the containment property,
  which is load-bearing and reads no markers at all.
- `goal-runtime` itself is unchanged and still seeded. Its other consumers
  (`listGoalsForDepartment`, `getPrimaryGoalForDepartment`) were **not** audited by this gate.

## 14. Known remaining Command defects — not this gate's scope

1. **Fabricated zero under withholding on `/command`.** `ExecutiveStateStrip` renders
   `recordCount(...) ?? 0` and `{overview.criticalAlertCount} critical`. Authenticated, that prints
   **"0 critical · 0 warning · 8 unavailable · 0 AGENTS · 0 WORKFLOWS"**. The adapter's own comment
   says *"WITHHELD, NOT ZEROED… A fabricated zero would be its own lie."* The adapter withholds
   correctly; the presentation layer puts the zero back.
2. **Stale `DecisionPressure` copy.** It states *"The decision surface records simulated intent
   only."* R3A/R3B made `/approvals` durable, approvable and executable. The sentence is false, and
   the panel does not read the real pending-request count that exists two files away.
3. **Authenticated Command starvation is worse than the demo measurements reported at Discovery.**
   Measured authenticated for the first time: text below the 12px floor **30 → 49**; clipped status
   labels at 1440 **5 of 8 → 8 of 8**; document height at 1440 **900 → 1407** and at 390
   **1718 → 3675**. "Unavailable" is a wider status word than "Healthy", so the `shrink-0` side takes
   more and every label loses. The owner is unchanged: `HealthCell` in `command-region.tsx`.

## 15. Entry condition

The one live falsehood Discovery found in Command is contained, and the firewall now catches the
class rather than the filename.

**CMD-A — Command Read Seam Architecture Gate is safe to begin from the seeded-goals perspective.**
