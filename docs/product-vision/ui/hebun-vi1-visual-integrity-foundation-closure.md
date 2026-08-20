# VI-1 — Visual Integrity Foundation (closure)

**Released 2026-08-20 · tag `hebun-vi1-visual-integrity-foundation` · implementation `a2ef1f2`**
**Classification: A — PRESENTATION-ONLY RELEASE**

Entry state: `main` at `76a8d3a`, `HEAD == origin/main`, 0 ahead / 0 behind, 422/422,
Stage 1 tag `hebun-stage1-canonical-knowledge-workspace` peeling to `8ddb87b`.

VI-1 is the first phase of the remediation program the Visual Integrity discovery gate
recommended. It implements exactly three of that gate's findings and nothing else. It writes no
schema, no migration, no runtime, no authority and no row.

---

## 1. `/heby` — the shell stopped claiming Heby is Command

`resolveActiveWorkspace` returns `WorkspaceId`. **That type cannot say "none of the seven"**, so its
only possible answer for a surface belonging to no workspace was a workspace — and the answer was
`"command"`. Measured in the authenticated product before the fix, on `/heby`:

| | Before |
|---|---|
| topbar title | `Command` |
| topbar tagline | `Executive operating surface — situational overview and the human decision.` |
| rail `aria-current="page"` | `Command` |

That is the shell asserting, in the product's own chrome **and in the accessibility tree**, that the
operator is somewhere they are not. It is a truth defect, not a cosmetic one — which is why it was
ranked P0 and fixed first.

The fix is a second resolver, not a change to the first. `resolveShellSurface` answers the identity
question and may return `workspace: null`. `resolveActiveWorkspace` is unchanged in behaviour (14
test files pin it) and now delegates to a shared `matchWorkspace`, so the two can never disagree
about what matches. Its `?? "command"` is re-documented as what it always was: a **navigation
default** — which way out to offer — never an identity.

Heby is tested **first, by its own constant**, so its ambient standing is structural rather than a
side effect of matching no prefix. Adding `/heby` to some workspace's `match` list later cannot
silently reclassify it.

The rail and the mobile drawer were included because `aria-current` on Command was the same lie.
`secondary-nav` and `tablet-sections` were deliberately **not** touched: they render a destination
list, not a claim about the current surface. The mobile drawer keeps its Command fallback for the
*opening list* for the same reason — an empty drawer on an ambient surface removes the way out,
which is the mistake this repository already learned once on the focused surface.

| | After |
|---|---|
| topbar title | `Heby` |
| topbar tagline | `Executive intelligence interface — ambient, and never one of the seven workspaces.` |
| rail `aria-current` | none |

Both halves of the tagline are quoted from published documents: "Executive Intelligence Interface"
from `heby-vision.md`, "never an eighth sidebar item" from the Navigation Architecture.

## 2. The seven-workspace invariant is preserved

`WORKSPACES.length === 7` and the seven ids are unchanged. `HEBY` gained a `tagline` and **not** a
workspace entry. Asserted three ways: the length, the exact id list, and that no workspace claims
Heby's route through a landing href or a legacy `match` prefix.

Naming Heby honestly did not make it an eighth workspace. That was the whole point of doing it in
the topbar rather than in the navigation model.

## 3. `/foundation` is explicitly unresolved, and stays that way

Its information-architecture decision is deferred by Director decision. A shell that guessed a
workspace for it would make the deferral invisible — which is exactly how it came to read "Command"
in the first place. It now resolves `kind: "unassigned"`, `workspace: null`, label `Hebun`, and **no
tagline is rendered**, because none is true. Its implementation is untouched; the three-`<h1>`
finding is recorded as deferred IA debt.

## 4. Nine region headers → one shared grammar

Nine workspaces each shipped a `*Region` component, and **six of the nine carried a byte-identical
header block**. All nine composed the `/finance` failure class into shared chrome: a `truncate`
heading beside a `shrink-0` action in a row that could not wrap.

Measured before, in the authenticated product:

| Surface | Symptom |
|---|---|
| `/knowledge` @1440 | h2 `Evidence & Provenance` given **96px** of the 153px it needed |
| `/command` @1440 | eight labels given **57px** of the 78–140px they needed |
| `/knowledge` @390 | the action block measured **415px wide inside a 390px viewport**, surviving only because `Card` clips |

`RegionHeader` replaces all nine header blocks (**−172 / +64** across the nine files). Three
mechanisms, each guarding one thing:

- **`flex-wrap` on the header row** — the action drops to its own full-width line instead of
  compressing the title.
- **`shrink grow basis-40` on the title group** — a *real* hypothetical size, so the browser has a
  reason to break the line. With `flex-basis: 0` the line always "fits" and the action starves the
  title again: the released behaviour in a different disguise.
- **`min-w-[min(10rem,100%)]`** — a floor that yields before the box does. A bare `min-w-40` would
  overflow a region narrower than 160px.

And the action wrapper is no longer `shrink-0`. **That single word is what let a 415px pill sit in a
390px viewport**: the wrapper claimed max-content, so its child was never asked to shrink.

**This unified geometry, not typography.** Every type size the nine already shipped is preserved
exactly — verified mechanically: the removed lines were `8 × text-[0.6rem]`, `8 × text-[0.8rem]`,
`1 × text-label`, `1 × text-meta`, `9 × text-sm`, and all are re-emitted through the `typeScale`
prop (`legacy` for the eight pre-Stage-0 regions, `stage0` for Knowledge). Folding a typography
change in here would have made a geometry fix indistinguishable from a sweep — and `/finance` is
the measured record of what happens when text grows inside a row that cannot yield.

## 5. Provenance detail is recoverable without hover

`truncate` removed from the chip's label span. Nothing else — no popover, no state, no interaction.

The detail names **which** authority answered. `title` carries the *kind's* meaning and so does the
screen-reader sentence; neither carried the detail. Truncated, it was recoverable by hover and by
nothing else, which on a touch device is not recoverable at all. Measured on `/knowledge` @390:
**five of six chips** needed 331–447px and were given 320px.

Wrapping yields without deleting. The chip sits on its own row — the grammar `WorkspaceSection`
established — where height is the only thing it can cost. The chip's own file header had said since
Stage 0 that it "is allowed to wrap rather than to starve a sibling"; the implementation now matches
its stated design.

---

## 6. Before / after — authenticated local product

Iframes at true 1440×900 and 390×844, against the real session.

| Measurement | Before (`76a8d3a`) | After |
|---|---|---|
| `/heby` topbar title | `Command` | `Heby` |
| `/heby` topbar tagline | Command's | Heby's own |
| `/heby` rail `aria-current` | `["Command"]` | `[]` |
| `/foundation` topbar | `Command` + Command's tagline | `Hebun`, no tagline |
| `/knowledge` @1440 · h2 `Evidence & Provenance` | 96px of 153 needed | **297px of 297 — whole** |
| `/knowledge` @390 · region action block | 415px in a 390px viewport | **0 escapes** |
| `/knowledge` @390 · chips losing detail | **5 of 6** (331–447 needed, 320 given) | **0 of 6** — wrap to h 54, right edge 374 ≤ 390 |
| `/knowledge` @1440 · chips | single line, intact | single line, intact — unchanged |
| Clipped `h1`–`h4` across 9 route×viewport combos | ≥1 | **0** |
| Uncontained overflow, same 9 | 0 | 0 |
| Horizontal page scroll, same 9 | none | none |
| Authoritative vs derived, both viewports | solid vs dashed, different bg | unchanged |
| Region header implementations | **9** (6 byte-identical) | **1** |
| Region files with their own `<header>` | 9 | **0** |

Heby regression: `--color-primary` `#e0a137` inside `.heby-surface` and `#2563eb` at the root, both
viewports; `data-heby-mode="hero"`; document height 900 / 844 unchanged; `scrollWidth === viewport`;
Heby's own header className byte-for-byte what it was, and it did **not** adopt `RegionHeader`.

No data was fabricated. Every surface rendered its real state — Knowledge is empty and says so.

## 7. Tests — 423/423

422 → 423 (one new suite). Lint 0 errors, typecheck clean, `next build` clean, `git diff --check`
clean, secret scan clean.

`tests/vi1-visual-integrity/foundation.ts` proves twelve claims: `/heby` never resolves to Command ·
the seven remain seven · `/foundation` stays unassigned · the heading wraps and never truncates ·
the action cannot starve the heading · the action stays inside its container · a long heading cannot
force page scroll · provenance detail is available without hover · authoritative ≠ derived · Heby is
untouched · Card / Badge / CardHeader / the global reset are untouched · nothing beneath
presentation moved.

### One released assertion amended

`tests/stage1-knowledge/canonical-workspace.ts` pinned `assert.match(chip, /truncate/)`. **The pinned
value was the expression, not the invariant.** The invariant is *a chip yields to its container
rather than starving a sibling*; `truncate` was one way to yield, and it yielded by deleting the one
thing the chip exists to carry. Replaced with the invariant, plus what the old assertion could not
say — and bite-proofed. The sibling-starvation assertion above it is unchanged. No other released
assertion moved.

## 8. Sixteen bite-proofs, and an audit of the guards themselves

`withDefect` **rejects a mutation that fails to apply**. A non-applying mutation produces sources
identical to the real ones, the check passes, and `assert.throws` reports "did not throw" —
indistinguishable from a proof that genuinely did not bite. That is a hard failure, never a quiet pass.

The navigation bite-proof is **behavioural**: it reconstructs the released resolver
(`getWorkspace(resolveActiveWorkspace(p))`), asserts it really answers `Command` for `/heby` — the
defect reproduced, not imagined — then requires the proof to catch it.

Mutations, all biting: restore the bare Command fallback · reintroduce `truncate` on the heading ·
truncate the **eyebrow** instead (invisible to an h2-scoped assertion) · restore the released action
wrapper wholesale · re-add only `shrink-0` · remove only `max-w-full` · remove only `flex-wrap` ·
remove only `basis-40` · remove only `grow` · add `flex-1` **alongside** `basis-40` · remove only the
min-width floor · stop the header row wrapping · give one region a private header again · make
provenance hover-only · collapse authoritative into derived · touch `Badge` · remove the global
min-width reset · change the `CardHeader` default · let the grammar import from `layout/heby` · let
it import a `.server` seam.

**Then the guards were audited.** Each assertion was neutered in turn and the suite re-run: a guard
whose removal leaves the suite green is not doing the work its wording claims. The first pass found
**five vacuous guards** — each caught only by a sibling assertion inside the same mutation. Six
surgical single-property mutations were added and the audit now reports load-bearing for all.

One assertion **cannot** be isolated and is recorded as such in the file rather than dressed up: any
mutation making the authoritative and derived class strings equal necessarily also breaks one of the
border-style assertions. Defence in depth, stated plainly.

## 9. Schema / runtime / authority impact — zero on every axis

No migration, no ledger change, no `.sql`, no `src/db`. No `src/features/**`, no `*.server.ts`. No
repository, projection, server action, resolver, session or tenant path. No provider, credential,
model or Computer Use. **No rows written anywhere.**

Proved rather than asserted: every changed presentational file is checked against `drizzle`, `@/db`,
`db/client`, `.server`, `use server`, `resolveTenantContext`, `tenantId`, `decision_records`,
`establishGovernance`, `migrations`; the new grammar additionally against `use client`, `useState`,
`useEffect`, `fetch(`, `window.` It is server-safe and holds no state.

`Card`, `Badge`, `globals.css` and `tokens.css` are **byte-identical to `76a8d3a`** — which covers
the `CardHeader` default and the global `* { min-width: 0 }` reset in one check.

## 10. Finance / HR / Legal — deliberately untouched

Director decision: **GATE BEFORE REAL TENANT**. Not remediated, not redesigned, not retired.

`LegacyAgentDefinitionCard` on `/finance`, `/hr`, `/legal` and `/tickets` still renders an agent name
at **15.5px of the 93px it needs** and a `size-10` icon at **3.67px**, leaving the disclosure badge
as the only legible element on the card. That is recorded, not fixed. Visual polish on a disclosed
mock surface makes fiction look more like organizational truth, which is an argument for gating and
not for remediation. Disposition belongs to its own gate.

## 11. Command-local starvation debt — deferred to VI-3

`command-region.tsx` **contains an unfixed sibling of the same class**. A different exported
component in that file renders a `truncate` label beside a `shrink-0` status; `/command` @1440 still
gives eight labels 57px of the 78–140px they need. It is workspace-local **body** content, not the
header grammar VI-1 owns.

This is named explicitly because migrating that file's header would otherwise imply the file is
clean. It is not.

Also deferred to VI-3: `/knowledge` @390 still clips one list-row label (`System Observation`,
137→116px), and nine duplicate `*EmptyState` implementations remain superseded by `StateBlock`.

## 12. VI-2 remains required before Command

**VI-1 made a true sentence the shell cannot fully show.** The topbar tagline slot is a fixed 208px;
Heby's new tagline needs 470px and is now the longest in the product. Six of seven workspace taglines
also clip. The secondary nav is a fixed 224px and clips its own labels (`Infrastructure & Settings`
163→149px). Rail labels render at 9.92px and the account role at 10.88px.

Fixed-width chrome that cannot hold its own content is now the largest remaining legible defect, and
it sits directly in front of Command. Recommendation unchanged: **VI-2, then Command.**

One further item stays with Heby's own gate: `/heby` @390 clips Heby's own subheader (233→175px). No
file under `layout/heby/` was modified by VI-1, so it is pre-existing by construction.
