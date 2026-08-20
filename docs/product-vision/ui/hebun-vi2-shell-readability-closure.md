# VI-2 — Shell Readability + Label Geometry (closure)

**Released 2026-08-20 · tag `hebun-vi2-shell-readability` · implementation `4b60d1a`**
**Classification: A — PRESENTATION-ONLY SHELL RELEASE**

Entry state: `main` at `1f8d078`, `HEAD == origin/main`, 0 ahead / 0 behind, 424/424, VI-1 tag
`hebun-vi1-visual-integrity-foundation` peeling to `47471d3`.

VI-2 makes the ordinary Hebun shell readable and geometrically honest **without changing shell
architecture**. Four files, 103 insertions, 14 deletions. No token moved. No schema, no migration,
no runtime, no authority, no row.

---

## 1. The top bar stopped describing what it could only show a fragment of

The identity slot carried the surface tagline in a 208px column, `truncate`d. Measured in the
authenticated product before the change:

| Surface | Needed | Given | |
|---|---|---|---|
| Heby | 470px | 208px | cut |
| Command | 425px | 208px | cut |
| Intelligence | 266px | 208px | cut |
| Platform | 242px | 208px | cut |
| Governance | 224px | 208px | cut |
| Knowledge | 156px | 208px | fits |
| Operations | 136px | 208px | fits |

Five of seven at ≥1024px, three of seven at 768px. **A description severed mid-clause is not a
shorter description**, and VI-1 had just made the worst of them true — Heby's own honest sentence
became the longest in the product and therefore the most badly cut.

**Widening was not available.** Measured topbar child geometry: at 1440px there are 23px between
this slot and the search field, and 12px at 1024px. Only 1920px has slack (503px), so growing the
column would have repaired the one width that was least broken. **Wrapping was not available
either**: Command's sentence needs three lines at 208px — 83px inside a 64px bar, which is the
height contract.

**It was also a duplicate.** `SecondaryNavContent` already renders the same sentence in full,
wrapped, never truncated — `need == got == 191px` in the 224px column, measured on every workspace.
Tracing the bands: below 640px the mobile sheet carries it; 640–1024px the tablet drawer carries it;
at ≥1024px the Level-2 column carries it permanently, **beside the truncated copy**.

So the duplicate goes and the one owner keeps it. The title stays at every width and cannot be cut:
the widest of the eight surface names is "Governance" at 83.1px, in a slot that is 208px at ≥1024,
245–269px at 768 and 110px at 390.

The one place the description is now absent is `/heby` in focused mode at ≥1024, where the column is
collapsed by design. Heby's own surface renders its identity, and receding chrome is what that mode
is for. Recorded, not hidden.

## 2. Level-2 names wrap; the 224px contract did not move

Available label width = `224 − nav px-3 (24) − item px-3 (24) − icon 16 − gap 10` = **150px**. Of
all **thirty** canonical Level-2 labels, exactly **two** exceed it:

| Label | Needs | Over |
|---|---|---|
| Infrastructure & Settings | 163.4px | +13.4 |
| Signals & Assessments | 152.4px | +2.4 |
| *Readiness & Pathways (3rd widest)* | 148.5px | fits by 1.5 |

Tightening padding and gap (`nav px-2`, `item px-2.5`, `gap-2`) yields 164px — clearing the worst
label by **0.6px**, while degrading all thirty items to rescue two. That is a coin toss, not a fix,
so it was rejected and `--secondary-w` was never a candidate.

**Wrapping costs nothing here, which is why it is the fix.** `text-sm` at `leading-5` is 20px a
line, so two lines are exactly the 40px the row already reserves with `min-h-10`. Measured before
and after: **item height 40px, unchanged**; "Infrastructure & Settings" now renders 149px × 40px
with nothing clipped. Twenty-eight labels are unaffected. No icon was shrunk, no name abbreviated.

## 3. The reading floor reached the rail and the account block

The seven workspace names — the product's primary navigation — rendered at **9.92px**, and the
operator's role at **10.88px**. Both are now 12px.

Available rail label width = `92 − 16 (the item's own calc) − 2 × padding`. At `px-1` that is 68px
and "Governance" needs **68.3px** at the floor. `px-0.5` gives **72px**, clearing it by 3.7px. The
two pixels came from the item's own padding — never from `--rail-w`, never from the icon, which
stays at `size-5`. All seven fit on one line; `truncate` was removed because nothing needs it and a
workspace name is the one label this rail may not silently shorten.

`.text-xs` is `0.75rem` — exactly `--fs-label`. Three sites, no other size touched, no sweep.

Audited and deliberately NOT changed: the Heby launcher label (9.6px) lives under
`components/layout/heby/` and is out of scope by Director decision; the secondary "Soon" marker was
raised for consistency but renders nowhere — no destination sets `unavailable: true`.

## 4. The ambient-surface identity fixes VI-1 did not reach

VI-1 fixed the top bar, the rail and the mobile mark. Two ordinary shell sites still made an
identity claim through `getWorkspace(resolveActiveWorkspace(pathname))`:

- the **Level-2 column header**, which renders a name and a description at the top of the column and
  therefore reads as "where you are" — on `/heby` it read *"Command / Executive operating surface —
  situational overview and the human decision."*
- the **tablet trigger**, whose visible text read *"Command"* on `/heby` at 768px — **unconditionally**,
  because focused mode is desktop-only and nothing hid it.

Both now name the surface. The list below is not wrong — an ambient surface still needs a way out —
so the two facts are stated as two facts: measured after, the `/heby` tablet drawer reads
**"Heby" / "Sections of Command"** and offers **8** destinations, and the mobile sheet lists all
eight entries with `aria-current` on **none**. The header is derived inside `SecondaryNavContent`,
the one owner of the Level-2 list, rather than in each of its three consumers.

---

## 5. Five-viewport measurements

7 routes × 5 viewports, authenticated product, before and after.

| Criterion | BEFORE | AFTER |
|---|---|---|
| Horizontal page scroll | none | **none** |
| `--topbar-h` rendered | 64 | **64** at all five |
| `--rail-w` rendered | 92 / 56 focused | **92 / 56** |
| `--secondary-w` rendered | 224 / 0 focused | **224 / 0** |
| Clipped topbar taglines | **5 of 7** ≥1024; 3 of 7 @768 | **0** — none rendered |
| Clipped topbar titles | 0 | **0** |
| Clipped secondary labels | 2 (163/149, 152/149) | **0 at every viewport** |
| Secondary item height | 40 | **40 — unchanged** |
| Rail label size | **9.92px** | **12px, one line, all seven** |
| Rail item height | 52.4 | 56 |
| Account role | **10.88px** | **12px** |
| Sub-floor shell text leaves | 9 | **1** — the Heby launcher, out of scope |
| Clipped focusable controls | 0 | **0** |
| Topbar control overlaps | 0 | **0** |
| `/heby` topbar / rail / trigger / column | Heby / none / **Command** / **Command + Command's tagline** | Heby / none / **Heby** / **Heby + "Sections of Command"** |

Search, org selector, Heby launcher, account block and both collapse points are unchanged at every
width. At 390px the rail and column are hidden as before and the shell has **zero** sub-floor text.

## 6. Shell token contracts unchanged

`--rail-w: 92px`, `--secondary-w: 224px`, `--topbar-h: 64px`,
`--shell-nav-w: calc(var(--rail-w) + var(--secondary-w))`. `tokens.css` and `globals.css` are
**byte-identical to `1f8d078`**. Both desktop blocks — the operator's collapse and focused mode —
remain bound to the 1024px breakpoint. VI-2 wrote no global rule at all.

## 7. Tests — 424/424, and the K2 flake reported honestly

**424 passed / 0 failed / 424 total** on this tree. Typecheck clean, lint 0 errors (14 pre-existing
warnings, all in `tests/`), build clean, `git diff --check` clean, secret scan clean.

A later re-prove run returned **423/1**, failing `tests/k2-flow/create-and-read-postgres.ts` with the
documented signature `['created','unavailable']` against `['created','duplicate']` — the concurrency
classifier mapping a serialization loser to `unavailable`. **Bounded with numbers on both sides**:
**3 of 6 failures on this tree, 2 of 6 at baseline `1f8d078`** with the VI-2 changes stashed — the
same pre-existing flake, in the band this repository has recorded before (3/6 vs 2/6 at Stage 0,
7/12 vs 4/12 at G6D). K2 imports only `src/features/**` and `src/db/**`, **none** of which VI-2
touched. Not re-run for cosmetic green.

## 8. Thirty-four bite-proofs, and what they caught

Every mutation is verified to APPLY before it counts; a non-applying mutation is VOID, never a quiet
pass. All ten required mutations are present, plus fourteen surgical single-property variants.

**Three mutations found real defects in the assertions themselves**, which is what they are for:

1. *"hide the surface title at a breakpoint"* did not bite — the guard sliced from inside the class
   list, so a `hidden` added ahead of it landed **outside the window**. The fourth window-scoped
   assertion bug in this repository. Re-anchored on the whole opening tag.
2. *"stop focused mode collapsing the column"* and *"move the desktop collapse point"* did not bite —
   `--secondary-w: 0px` and `@media (min-width: 1024px)` each appear **twice** in `globals.css`, so
   an unscoped assertion could not tell which one it was reading and a regression in one was
   invisible while the other stood. Now scoped to the focused-mode block, and the breakpoint asserted
   **by count**.
3. *"stop the tablet trigger asking the honest resolver"* did not bite — the assertion was satisfied
   by the **import line**. A `bodyOf()` helper now strips imports, so a mention can never stand in
   for a call.

**Guard audit:** all 56 assertions neutered one at a time. **23 load-bearing**, up from 12 before
fourteen surgical mutations were added. The remaining 33 are classified in the suite rather than
papered over: 2 harness rails, **9 structurally un-mutatable** (asserted against the *imported*
frozen module — a text mutation cannot reach a module already loaded, which is why "Heby becomes an
eighth workspace" is proved directly rather than faked), 18 sibling-covered defence in depth, and 4
assertions about the recorded measurements themselves.

## 9. Released assertions amended — none

Zero. Every released suite passed unchanged, including VI-1, Stage 1 Knowledge, g7 focused-Heby,
hw1 navigation firewall, hw3 ×3, command-l2, intelligence-l2, platform-closure, governance-closure
and phase-20d.

## 10. Heby regression proof

`--color-primary` `#e0a137` inside `.heby-surface` and `#2563eb` at the root; `data-heby-mode="hero"`;
document height 900 / 844 unchanged; `scrollWidth == viewport`; `h1` "Heby"; rail 56px in focused
mode; the focused-mode block byte-identical. No file under `components/layout/heby/` was touched.
The suite bans ordinary shell rules from being written inside `.heby-surface` and blocks the ordinary
shell from importing anything there beyond its two released controls.

## 11. Knowledge regression proof

`/knowledge` at 1440×900: one `<h1>`, `scrollWidth` 1440, **zero clipped headings**, six provenance
chips. The Stage 1 canonical suite passes unchanged. Untouched.

## 12. Schema / runtime / authority impact — zero on every axis

No migration, `.sql`, `src/db`, `src/features/**` or `*.server.ts`. No repository, projection, server
action, authority resolver, tenant resolver, session, provider, credential, model, worker, execution
path, Computer Use capability or external connection. **No rows written.** Proved rather than
claimed: every changed file is checked against `drizzle`, `@/db`, `db/client`, `.server`,
`use server`, `resolveTenantContext`, `tenantId`, `decision_records`, `migrations` and `fetch(`.

---

## 13. BLOCKING NEXT GATE — the Stage 0 type scale is inert

**This was discovered by VI-2 and deliberately NOT fixed in it.**

The floor was first written as `text-label`, the Stage 0 scale utility. A source-level assertion
would have passed. The product rendered **16px**. Measured in the running product:

| Utility | Rule in the compiled CSS | Renders |
|---|---|---|
| `.text-display` `.text-title` `.text-body` `.text-meta` `.text-label` | **NO RULE AT ALL** | 16px, inherited |
| `.text-xs` `.text-sm` | present | 12px / 14px |

Cause: `@theme inline { --text-label: var(--fs-label); … }` cannot be resolved, because `--fs-label`
is declared in an imported plain stylesheet rather than in `@theme`. Tailwind emits nothing, and the
`--text-*` theme variables all read empty while every `--fs-*` source token is correctly defined.
`cn()` compounds it: tailwind-merge does not know `text-label` is a font size and drops it as a
colour when a `text-*` colour follows.

**The five utilities are used by 165 elements in the live Knowledge DOM** — `text-meta` ×99,
`text-label` ×33, `text-body` ×23, `text-title` ×10. So Stage 1's canonical workspace does not render
at the scale it names: `WorkspaceSection`'s `text-title` heading renders 16px rather than 18px, and
every `text-meta` renders 16px rather than 13px. The discovery report's "Knowledge is 16px-dominant"
was true for the wrong reason — it was the browser default, not the token.

This is Stage 0's own recorded lesson repeating one level up: *a token can be DECLARED and never
DEFINED, and nothing fails.* Stage 0 fixed `--font-jakarta` and then created the identical defect in
the type scale it introduced.

VI-2 states the floor in `text-xs`, a utility that exists, and its suite **bans the inert five from
the ordinary shell** — a class that names a size it does not set is worse than no class at all.

**ENTRY CONDITION FOR THE NEXT PHASE: activate and prove the Stage 0 typography contract before
Command.** Repairing the theme block resizes 165 elements across the canonical workspace, so it
needs its own gate, its own geometry proof per surface, and its own bite-proofs — including a guard
that asserts a *rendered* size rather than the presence of a class string, since a source-only test
passed on `text-label` while the product rendered 16px.

## 14. Command is explicitly NOT started

By Director decision, Command does not begin after VI-2. The inert type scale above is a blocking
prerequisite for the next canonical workspace. VI-3's workspace-local debt also remains open:
`command-region.tsx` still holds an unfixed sibling of the VI-1 starvation class in a different
exported component (eight labels at 57px of the 78–140px they need), `/knowledge` at 390px still
clips one list-row label, 458 sub-floor arbitrary sizes remain repo-wide, and nine duplicate
`*EmptyState` implementations remain superseded by `StateBlock`.

Finance, HR, Legal and `/foundation` remain untouched by decision.
