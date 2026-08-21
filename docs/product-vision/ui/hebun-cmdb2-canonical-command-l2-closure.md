# CMD-B2 — the canonical Command L2: three destinations, five surviving routes (closure)

**Released 2026-08-21 · tag `hebun-cmdb2-canonical-command-l2` · implementation `62a89a9`**
**Classification: A — CANONICAL COMMAND L2 ESTABLISHED / LEGACY ROUTES PRESERVED**

Entry state: `main` at `8e79528`, `HEAD == origin/main`, 0 ahead / 0 behind, 429/429, CMD-B1 tag
`hebun-cmdb1-command-canonical-overview` peeling to `e2f27bf`.

A navigation-only gate. Two product files, seven amended released pins, one new suite. No page
deleted, no redirect added, no model retired, no authority moved, no schema, no row.

---

## 1. Canonical Command L2: eight → three

| before (Phase 20B) | after (CMD-B2) |
|---|---|
| Overview · Inbox · Briefings · **Decisions** · Strategic Goals · Organization Health · Reports · **Director Intent** | Overview · **Decisions** · **Director Intent** |

```
Overview          /command
Decisions         /approvals          elevated, roles: ["director"]
Director Intent   /command/intent     elevated, roles: ["director"]
```

Icons, purposes, role scopes and elevated treatment preserved verbatim. `match: ["/dashboard",
"/director", "/approvals"]` unchanged, so route ownership did not move.

**Why the five went.** CMD-A measured what the eight could answer for a real tenant; CMD-B1 rebuilt
the Overview on the one connected read that exists. What was left was a menu whose other five rows
lead to surfaces with no source at all — the same six capabilities CMD-B1 discloses as *Not yet
connected*. A navigation menu is a statement about what matters **now**; five rows that lead to
nothing are five promises the product does not keep, made in the first place a Director looks.

## 2. The five left the menu, not the product

`/command/inbox` · `/command/briefings` · `/director/goals` · `/director/organization-health` ·
`/director/reports`

All five: still on disk, still `export default`, **not redirected**, still
`resolveActiveWorkspace(...) === "command"`, and all five present in the **production build
manifest** as compiled routes. The dashboard route census is 127 before and after.

> **A ROUTE EXISTING IS NOT THE SAME CLAIM AS A ROUTE BEING CANONICAL.**

That distinction is the whole point of the phase and it is asserted, not asserted-about: the CMD-B2
suite checks removal in the config *and* in the rendered menu, and survival on disk, in the census,
in the shell's workspace resolution, and in the absence of a redirect.

## 3. One navigation authority, three viewports

`src/config/workspace-nav.ts` → `WORKSPACES[0].destinations`. Desktop `SecondaryNav`, tablet
`TabletSections` and mobile `MobileNav` all render the **same** `SecondaryNavContent` over the
**same** `destinationsForRole`. There is no per-viewport list and none was added; the suite asserts
that exactly one module in `src` declares destination lists, and that it declares exactly seven.

Two look-alikes were audited and ruled out rather than assumed dead: `src/config/sidebar.config.ts`
and `src/components/layout/sidebar-nav.tsx` reach the product only through `src/app/_internal/`, a
different route group with a different IA. Untouched.

## 4. The active-destination rule was corrected, and it had to be

Longest-prefix matching worked while every sub-route was **also** a destination — something more
specific always outranked the landing. CMD-B2 removed five destinations and the guard's premise went
with them. Measured on the real component:

```
/command/inbox      -> Overview marked ACTIVE   (false: you are not on the Overview)
/command/briefings  -> Overview marked ACTIVE   (false)
```

The workspace landing now matches by **equality**. Every other destination keeps prefix matching, so
`/approvals/<id>` still highlights Decisions. A route that is no longer canonical highlights
**nothing** — the honest answer, and the reason no removed row was added back to manufacture a
highlight. No breadcrumb was invented.

Blast radius measured over all **127** dashboard routes: **4 change.**

| route | before | after |
|---|---|---|
| `/command/inbox` | Overview | none |
| `/command/briefings` | Overview | none |
| `/governance/authority` | Governance Overview | none |
| `/governance/genesis` | Governance Overview | none |

The last two were **pre-existing false highlights** the same rule corrects. The fix is general
because the component is general; special-casing Command inside a shared renderer would have been
the worse trade.

## 5. Shell identity stays truthful on a legacy route

`resolveShellSurface` returns `kind: "workspace"`, `workspace: "command"`, `label: "Command"` on all
five. The workspace still owns them and still says so. The secondary nav shows the canonical three,
none of which claims to be the page you are on.

## 6. Seven released pins amended — and why none is weakened

The eight-item sequence had become a de-facto cross-phase invariant that six other phases copied.

| file | was | now | why this is not a weakening |
|---|---|---|---|
| `command-l2/navigation.ts` | eight labels | canonical three **+ the five still resolve** | this file's own subject; Alerts-merged, Console-renamed and no-duplicate-Decisions untouched |
| `phase-20d/closure.ts` | "Command 8-surface IA intact" | canonical three | it asks whether the *redirect closure* disturbed the IA, not what the count is |
| `intelligence-l2/navigation.ts` | "Phase 20B Command IA is untouched" | "untouched **by Intelligence**" | the same question, renamed to what it actually asks |
| `cmdb1-command-overview` | "frozen until CMD-B2" | canonical three | **the freeze expired by design; it was not lifted** |
| `cmd0-seeded-goals` | Strategic Goals menu membership | route exists **and** resolves under Command | membership was a *proxy*; the route is the real property |
| `operations-legacy` | same proxy | same replacement | — |
| `knowledge-closure` | "Command owns Strategic Goals" via the menu | via the route + registry `authoritativeOwner` | a strictly better instrument for an ownership claim |

**A vacuous released bite-proof was found and repaired.** CMD-B1's M12 compared a 7-element
`slice(0, 7)` against an 8-element literal, so it threw for the slice — it would have "bitten"
against any configuration whatsoever, including a correct one. It now forges a real alternative L2
and fails if and only if the config says that.

## 7. Heby's exact-route defect: found here, NOT fixed here

During verification, `resolveNavigation` was measured directly:

```
"/command/inbox"          -> /command        a real, reachable, non-canonical route
"/command/briefings"      -> /command        likewise
"/command/does-not-exist" -> /command        a route that has never existed
"command/inbox"           -> /command        the unslashed form
```

The resolver builds its directory from the canonical navigation model and used it as a register of
which routes exist. A path it could not find fell through to term matching, where `"/command/inbox"`
contains `"command"`.

**This defect predates CMD-B2.** `/command/does-not-exist → /command` proves it: any path under a
workspace prefix was answered with the workspace, long before any destination was removed. CMD-B2
widened the visible blast radius by two real routes; it did not create the class.

**CMD-B2 does not fix it and makes no claim that Heby navigation truth is closed.** The repair is
**HEBY-NAV-0**, the immediate required follow-up: a route-shaped query gets one chance at the exact
lookup and is refused if it misses, never substituted. It is released separately, because CMD-B2
owns canonical Command navigation and HEBY-NAV-0 owns Heby's navigation truth, and combining them
would make the history say CMD-B2 caused a defect it only exposed.

## 8. Impact — navigation-only, proved

| dimension | change |
|---|---|
| schema · migration | none (ledger 32 files, digest `a54ab468e15c816f`) |
| rows | **0** |
| writer · resolver · read seam · authority | none |
| server actions | 9, unchanged |
| runtime · provider · Computer Use · credential | none |
| tenant boundary | unchanged |
| route deletion · redirect | **none** |
| CMD-B1 Overview | unchanged — asserted by rendering its three sections |
| Heby | not a destination, not a workspace, still ambient, still advisory in Command |

The two touched files are asserted by **import census**, not by a word ban: neither may import a
`.server` module, `/db/`, drizzle, persistence, `governance-decision`, `auth-runtime` or
`action-authorization`. (`workspace-nav.ts` honestly contains the word "governance" — it declares the
Governance workspace — so a word ban would have failed on the file's own correct content.)

## 9. Verification

| check | result |
|---|---|
| full suite, on the exact staged CMD-B2 tree | **431 passed, 0 failed, 431 total** |
| CMD-B2 suite | green — 20 required properties |
| CMD-B2 bite-proofs | **14/14 bit**, each applied → failed → for the intended reason → restored byte-identically |
| harness self-check | a comment-only mutation is **rejected** as non-biting |
| bounded regression set | 21/21 PASS |
| typecheck · lint · build | clean · **0 errors** (14 pre-existing warnings) · clean |
| `git diff --check` · secret scan · `next-env.d.ts` | clean · 0 hits · untouched |

Three instruments, chosen per property: the **config** for what the menu is, the **filesystem** for
what still exists, and a real **render** of `SecondaryNavContent` for what an operator is shown —
including which row is marked active, which was measurably wrong before this phase.

The full suite was run on a tree containing **only** CMD-B2: the HEBY-NAV-0 work was parked aside and
sha-verified on return, so the 431 is a measurement of what this commit contains and nothing else.

## 10. Authenticated acceptance — TOOLING-BLOCKED, as in CMD-B1 §15

No release-session screenshot is claimed. The in-app browser pane has its own cookie jar and never
received a sign-in; the Director's session lives in their own browser, which the agent does not
drive.

A calibration worth recording: an unauthenticated production probe **cannot** distinguish an existing
route from a missing one — `/zzz-not-a-route` also returns `307 → /login`, because the auth gate runs
before routing. That measurement is VOID and is not reported as evidence. What *is* real production
evidence is the **app-paths manifest**, which shows all eight routes compiled into the production
server, the five legacy ones included.

## 11. Remaining Command debt

1. **Heby exact-route substitution** — HEBY-NAV-0, released immediately after this.
2. `/director/alerts` still redirects into `/command/inbox`, now a non-canonical route. Harmless;
   both reachable.
3. The five legacy surfaces remain unconnected — the same capabilities CMD-B1 discloses.
4. The `_internal` shell and `sidebar.config.ts` carry a stale parallel IA. Dead, unswept.
5. Authenticated pixel evidence for CMD-B1 and CMD-B2 is still outstanding.

## 12. What this closes

Command's **structure** is complete: one connected L1, three canonical L2 destinations, one owner,
honest legacy handling, and an active-state that does not lie. Visual design for Command can begin —
and should begin by obtaining the authenticated pixel pass that both this phase and CMD-B1 could not.
