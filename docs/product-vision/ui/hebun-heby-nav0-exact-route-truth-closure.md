# HEBY-NAV-0 — an exact path is answered exactly, or not at all (closure)

**Released 2026-08-21 · tag `hebun-heby-nav0-exact-route-truth` · implementation `1d1b326`**
**Classification: A — HEBY EXACT-ROUTE TRUTH RESTORED / CANONICAL IA UNCHANGED**

Entry state: `main` at `c6c8922`, `HEAD == origin/main`, 0 ahead / 0 behind, 431/431, CMD-B2 tag
`hebun-cmdb2-canonical-command-l2` peeling to `e0ac2b2`.

Two product files inside Heby's navigation resolver, one new suite. No new route authority, no
registry, no writer, no schema, no row.

---

## 1. The defect, and when it started

`resolveNavigation` builds its directory from the **canonical navigation model**. That is the right
source for DISCOVERY — what Heby may suggest when someone describes a place. It is not a register of
which routes exist, and the resolver used it as one: a path it could not find fell through into term
matching, where `"/command/inbox"` contains `"command"`.

Measured on the released resolver, four inputs took that path:

| input | class | resolved to |
|---|---|---|
| `/command/inbox` | real, reachable, non-canonical | **`/command`** |
| `/command/briefings` | likewise | **`/command`** |
| `command/inbox` | the unslashed form | **`/command`** |
| **`/command/does-not-exist`** | **never existed at all** | **`/command`** |

**The fourth is the proof that this predates CMD-B2.** Any path under a workspace prefix was answered
with the workspace, long before any destination was removed from a menu. The defect is not about
legacy routes and never was.

## 2. CMD-B2 exposed it and widened it; it did not create it

CMD-B2 removed five destinations from Command's canonical L2, which took `/command/inbox` and
`/command/briefings` out of the resolver's lookup table and moved them from the "resolves correctly"
column into the "answered with something else" column. Two real routes joined a class that already
had members.

That distinction is why this is its own gate with its own history. CMD-B2 owns canonical Command
navigation; HEBY-NAV-0 owns Heby's navigation truth. Combining them would have made the record say
CMD-B2 caused a defect it merely revealed.

## 3. Two responsibilities, kept apart

```
CANONICAL DISCOVERY        what Heby may suggest when a human DESCRIBES a place
                           source: WORKSPACES destinations
EXACT ROUTE RESOLUTION     whether a path the caller ALREADY SUPPLIED can be honoured
                           source: the same directory — and that is the honest limit
```

They had one implementation and one fall-through between them. They no longer do.

## 4. WORKSPACES remains the canonical navigation authority

Unchanged, and asserted: the directory is still built by iterating `WORKSPACES`, the resolver imports
**exactly one** module (`@/config/workspace-nav`), and it hard-codes **no** route literal. Nothing
about Command's canonical three, its five legacy routes, or any other workspace's L2 moved.

## 5. No legitimate route-existence authority exists

Measured, not assumed. The only candidate in the repository is `sidebar.config.ts`'s `staticRoutes`,
a Set used by the legacy `_internal` catch-all:

| | |
|---|---|
| real routes on disk | **127** |
| `staticRoutes` entries | **94** |
| real routes **missing** from it | **34** — including `/command`, `/command/intent`, `/command/inbox`, `/command/briefings` |
| entries with **no page** on disk | **1** — `/director/execution-center/graphs` |

It is stale in both directions and would refuse the Command landing itself. Adopting it would have
created a second, wrong source of truth. `resolveActiveWorkspace` is not a candidate either: it
answers *which workspace owns a path* and returns an answer for paths that do not exist.

## 6. Legacy exact routes are therefore NOT-FOUND, not falsely redirected

This is the chosen limit, stated plainly rather than dressed up. Resolving `/command/inbox`
**correctly** would require knowing it exists, and nothing in this repository can answer that. So
Heby refuses.

Refusal is honest; substitution is not. `found: false` means *"I cannot resolve that"*, which is
true — it does not mean *"that route does not exist"*, which Heby is not in a position to say.

That distinction is now in the copy too. The refusal read **"No real route matches that"** — a claim
about the *product*. It now reads:

> Heby could not resolve that to a canonical destination, and did not substitute a different one.
> Nothing was navigated.

## 7. The repair: a route-shaped query gets one chance

A query is **route-shaped** when it contains a separator — `"director intent"` describes a place,
`"/command/inbox"` and `"command/inbox"` specify one. The unslashed form is included deliberately: it
reached the same fuzzy fall-through and produced the same wrong answer, so treating only the
leading-slash form as a path would have fixed half a defect and left the other half looking fixed.

```
route-shaped  ->  exact hit in the canonical directory, or NOT-FOUND. Never a neighbour.
described     ->  fuzzy discovery over the canonical directory, exactly as before.
```

## 8. Behaviour, before and after

| input | before | **after** |
|---|---|---|
| `/command` · `/approvals` · `/command/intent` | itself | **itself** |
| `/command/inbox` · `/command/briefings` | **`/command`** | **NOT-FOUND** |
| `/director/goals` · `/director/organization-health` · `/director/reports` | NOT-FOUND | NOT-FOUND |
| `/command/does-not-exist` · `command/inbox` | **`/command`** | **NOT-FOUND** |
| `decisions` → `/approvals`, `director intent` → `/command/intent`, `command` → `/command`, `governance` → `/governance`, `platform` → `/platform`, `security center` → `/director/governance/security` | correct | **unchanged** |
| `inbox` · `briefings` · `strategic goals` · `organization health` · `reports` | NOT-FOUND | **NOT-FOUND** |
| `gov` (ambiguous) | candidates | candidates |

Canonical fuzzy discovery is unchanged, and the removed labels do **not** regain discoverability
merely because their routes still exist.

## 9. No second route registry

Asserted three ways, and one of them is a live re-measurement:

- the resolver imports **exactly one** module, and it is the navigation model;
- the resolver contains **zero** route literals (a bare `"/"` is the separator test, not a route);
- the `staticRoutes` gap from §5 is **re-measured inside the suite**, so the day it closes — the day a
  real route authority appears — the test fails and says so. That is where the next phase starts.

## 10. Route authority remains explicit architecture debt

Exact resolution of a legacy route is **deferred, not abandoned**. It needs an authority for which
routes exist, and building one is its own gate with its own question: what may be treated as the
register — a derived route map, a generated manifest, or something the framework already owns —
without becoming a hand-maintained list that goes stale exactly as `staticRoutes` did.

Until then, a user who hands Heby `/command/inbox` is told Heby cannot resolve it. They are never
sent somewhere else.

## 11. Impact — resolution only

| dimension | change |
|---|---|
| schema · migration · rows | **none** |
| writer · resolver · read seam · persistence · repository | none |
| Governance · Knowledge · action-authorization | none |
| runtime · provider · Computer Use · credential | none |
| server actions | 9, unchanged |
| tenant boundary | unchanged |
| route deletion · redirect | none |
| CMD-B1 | untouched — the Command route still resolves the tenant once and reuses the pending seam |
| CMD-B2 | untouched — canonical three intact, landing still matches by equality, five legacy routes present |

**A resolution is not an authorization.** A returned target carries exactly `{route, label}` — asserted
by key comparison, not by inspection. Resolving `/approvals` says nothing about who may decide there,
and the suite proves the tool's output mentions no authorization, permission or grant. Both touched
files are held to an **import census**: neither may import `node:fs`, `.next`, drizzle, `/db/`,
persistence, `action-authorization`, `governance-decision` or `auth-runtime`. Heby remains
`advisory-only` in Command.

## 12. Verification

| check | result |
|---|---|
| full suite, on the exact staged tree | **433 passed, 0 failed, 433 total** |
| HEBY-NAV-0 contract | green — 20 properties, argued by OUTCOME wherever possible |
| HEBY-NAV-0 bite-proofs | **12/12 bit** — applied → failed → for the intended reason → restored byte-identically |
| harness self-check | a comment-only mutation is **rejected** as non-biting, inside the same run |
| CMD-B2 suite · CMD-B2 bite-proofs | green · **14/14 still bite** |
| typecheck · lint · build | clean · **0 errors** (14 pre-existing warnings) · clean |
| `git diff --check` · secret scan · `next-env.d.ts` | clean · 0 hits · untouched |

Two bite-proofs were redesigned rather than accepted during the work: **M2** was narrowed to deep
paths so it proves the unknown-path guard *independently* of M1 instead of tripping the same
assertion twice, and **M7** became an alias on an existing entry rather than a new route entry so it
proves DISCOVERY rather than the path contract. A proof that fails for the wrong reason proves
nothing about the guard it targets.

## 13. Release sequencing — and the correction that produced it

HEBY-NAV-0 was originally approved to release **first**, on the argument that its defect predates
CMD-B2. That was wrong, and it was caught by measurement rather than by review: a throwaway worktree
at the pre-CMD-B2 HEAD, with only the HEBY-NAV-0 files dropped in, ran the contract and **4 of its 7
checks failed**. The suite's expected outcomes are written against the post-CMD-B2 product — with the
eight-destination menu in place, `/command/inbox` *is* canonical, `"inbox"` *is* legitimately
discoverable, and the five routes are not legacy yet.

Releasing it first would have put a commit on `main` whose own suite fails at its own HEAD. The order
was swapped before any history was written, and both authorship histories stayed separate.

**Check the ordering dependency between a fix and its proofs, not only between the fixes.**
