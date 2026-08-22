# CMD-V3 — Command Overview composition: a primary column and a tertiary aside (closure)

**Released 2026-08-22 · tag `hebun-cmdv3-command-overview-composition`**
**Classification: B — GO WITH RECORDED VISUAL DEBT**

Entry state: `main` at `69d5695`, `HEAD == origin/main`, 0 ahead / 0 behind, 433/433, with the
CMD-V2 tag `hebun-cmdv2-shell-typography-floor` peeling to `ad233d2`.

A composition gate. Two product files, one new suite, 142 insertions and 21 deletions. No schema,
no migration, no row, no server action, no navigation change, no authority.

---

## 1. Two Step-0 corrections to the brief, recorded rather than worked around

The gate named `src/features/command-overview/command-overview.tsx` as the primary implementation
owner. **That file does not exist.** The real owner is `src/components/command-overview/
command-overview.tsx`; `features/command-overview/` holds only `workspace-model.ts`. The gate's own
instruction — "do not assume those paths are sufficient until inspected" — is what caught it.

**No CMD-V1 audit document exists in this repository.** `docs/product-vision/ui/` held cmd0, cmdb1
and cmdb2 only. CMD-V1's preferences were restated inside the CMD-V3 brief, so they were taken from
there and then VALIDATED BY MEASUREMENT rather than adopted (§3).

## 2. The composition, and why it is the authority ordering

At `xl` and above the Overview is a flex row: a flexible primary column carrying **Waiting on you**
and **Express intent**, and a 360px aside carrying **Not yet connected**. Below `xl` it is the
released single column, unchanged.

The ordering is not editorial. `Waiting on you` is the only authoritative tenant-scoped state on the
page, so it leads. `Express intent` is derived from a registry — a doorway, not organizational
state. `Not yet connected` discloses what Hebun cannot answer: it must stay visible and complete,
and it must not be the first thing a Director's eye lands on.

**DOM order never changes.** Waiting, then intent, then disclosure, in the markup, at every width.
The columns are a flex direction, not a reordering, so a screen reader and a keyboard walk the page
in the order the authority model puts it in. The suite bans `order-*`, `flex-*-reverse`,
`grid-flow-col-dense`, and any viewport branching (`useMediaQuery`, `matchMedia`, `window.inner`,
`useState`, `useEffect`) — one markup, therefore one reading order.

## 3. The breakpoint was DERIVED, not preferred

Inside this shell the canvas is the viewport less `--shell-nav-w` (92 + 224 = 316px) and the
`lg:px-8` gutters (64px). With a 360px aside and a 32px gap:

| viewport | canvas | primary column | composition |
|---|---|---|---|
| 1024 | 644px | **252px** | single — the aside would be wider than what it must not dominate |
| 1280 | 900px | 508px | two columns |
| 1440 | 1060px | 668px | two columns |

The suite computes the smallest Tailwind step where primary > aside and asserts the source arms
exactly that step. Mutating `xl:flex-row` to `lg:flex-row` fails with *"the arithmetic says the
smallest step where the primary column (508px) stays wider than the 360px aside is xl — at lg the
primary would be 252px."* CMD-V1's `xl` preference is therefore confirmed by measurement.

**A premise that was nearly left unstated.** Tailwind v4 emits `@media (min-width:80rem)`, not
`1280px`. "xl is 1280px" is a CONSEQUENCE of the root font size being the browser default of 16px,
not a constant. A single `html { font-size: 20px }` would move xl to 1600px and every number above
would still compute while describing a layout that no longer exists. The suite now fails if any
stylesheet sets a root font-size, with its own bite-proof.

## 4. `StateBlock` gains `density`, and the default is the released rendering byte for byte

`density?: "comfortable" | "compact"`, defaulting to `comfortable`. It changes padding, gap and mark
size — no tone, no wording, no icon, no border treatment, no role, no `aria-live`.

**The comfortable literals are the released class strings, written out whole, in the released
order.** A first implementation composed them from a shared base plus a density fragment: identical
class SET, different ORDER. That renders identically and is still a weaker guarantee than the one
available for free. Proved by rendering the released component and the new one side by side across
every tone × `hideEyebrow` × `action` combination: **byte-identical, 20/20**. The literals are now
pinned as strings in the suite, so a drift fails rather than merely looking similar.

Exactly one surface opts into `compact`. The other six `StateBlock` consumers are untouched.

## 5. Express intent: the doorway leads, the inventory follows

As released, the first thing this section said at reading size was a count of registry entries —
organizational-looking weight on a number that describes a source file. The registry sentence is
UNCHANGED and still present; it now reads at `text-meta`, beneath a `text-body` lead that says what
the section is for.

The lead contains **no digit**, and the suite asserts that. A prose claim about a derived count is
exactly the drift R3B had to repair once already; a lead that cannot contain a number cannot drift.
All five lifecycle claims survive verbatim.

## 6. The disclosure grid

`divide-y` can only rule between rows, so it cannot survive becoming two columns at `md`. One
pixel of grid gap over the border colour draws every divider in both axes for any column count:
two columns at `md`/`lg` where the section spans the full canvas, one at `xl` where it is the
narrow aside, one at base. Not a card deck — no shadow, no per-item radius, no per-item action.

## 7. Impact — presentation only, proved

| dimension | change |
|---|---|
| schema / migrations / ledger | none — 32, untouched |
| rows written | 0 |
| server actions | 9, unchanged |
| read seams | none added |
| authority | none |
| canonical navigation / legacy routes | unchanged |
| Heby navigation truth | unchanged |
| CMD-B1 read seam | unchanged |

## 8. Verification

433/433 → **434/434**. Typecheck clean. Lint 0 errors (14 pre-existing warnings, none in a CMD-V3
file). Build passes; `.xl\:w-\[360px\]{width:360px}`, `grid-cols-2`, `gap-px` and `size-7` confirmed
in the **production** stylesheet — not the stale `.next/dev` chunk whose measurement gave VI-2 its
false "inert scale" finding. `git diff --check` clean. Secret scan clean.

**20 bite-proofs, each audited to bite for the RIGHT reason**, plus a harness self-check: one
deliberately correct change (aside 360 → 336px, inside the approved band) is required to be
ACCEPTED. "Every mutation bit" means nothing if the assertions cannot tell a change from a
regression.

One proof was rewritten during the gate. Mutating `xl:flex-row` to `lg:flex-row` originally bit on a
string ban that merely happened to agree with the arithmetic. It now bites on the arithmetic itself.

## 9. Authenticated acceptance — IFRAME-BASED, and labelled as such

Measured by the Director in their own authenticated Chrome, in four same-origin hidden iframes on
the real `/command`. **This is not top-level-window evidence and is not recorded as such.**

| viewport | before | after | Δ |
|---|---|---|---|
| 1440×900 | 1766 | **1473** | −293 (−16.6%) |
| 1024×768 | 1896 | **1756** | −140 (−7.4%) |
| 768×1024 | 1872 | **1752** | −120 (−6.4%) |
| 390×844 | 2440 | **2416** | −24 (−1.0%) |

Truth clean at all four: 0 horizontal overflow, 0 clipped meaningful text, 0 text below the 12px
floor, 0 buttons / forms / inputs in `main`, one `h1`, section ids `waiting` / `intent` /
`not-connected`, provenance `authoritative` / `derived` / `not-connected`, L2 `Overview` /
`Decisions` / `Director Intent`, and the successful-empty state still reading as answered rather
than unavailable. Reason character counts identical at every width — 193 / 162 / 187 / 181 / 145 /
199 — so no reason was truncated anywhere. Composition measured 668 / 360 at 1440 against 668 / 360
predicted.

**One probe defect, recorded rather than glossed.** The `intentLink` field used
`querySelector('a[href="/command/intent"]')`, which returns the first match in document order — the
L2 nav link, never the Overview's own "Open Director Intent". It therefore measured the wrong
element at every viewport and reported `null` where the nav link was hidden. An instrument defect,
not a product defect; corrected for CMD-V4, which scopes the query to `#intent`.

## 10. Why this is B and not A

Two of the three height targets were missed. 768 improved 6.4%, which is not "materially below"
1872. 390 improved 1.0%, which no Director would notice. 1440 missed ≤1200 by 273px.

The compaction levers available WITHOUT hiding truth — density, the grid, the column — were spent.
At 390 the six architectural reasons alone are roughly 1,180px of a 2,416px page, and reaching the
target from there requires removing a reason. Truth outranks compactness, so the reasons stayed and
the measured numbers are reported as measured. That gap is what CMD-V4 exists to close, by layering
rather than deleting.

## 11. Remaining debt at release

1. **390×844 effectively unchanged (−1.0%).** Mobile did not benefit. → CMD-V4.
2. **768×1024 improved 6.4%**, below the brief's bar. → CMD-V4.
3. 1440 misses ≤1200 by 273px; irreducible here without hiding a reason.
4. Two `aria-current="page"` in the shell — rail and secondary nav. Pre-existing, not this phase's.
5. `"{connectedMutations} consequential action has a substrate"` reads correctly at 1 and becomes
   ungrammatical at ≥2. Pre-existing released copy, left verbatim rather than casually rewritten.

## 12. What this closes

Command's three sections now carry three different visual weights, and the weights are the authority
ordering. The Director's first question — *does anything require me?* — is answered at the top of a
668px primary column instead of competing with a full-width disclosure of what Hebun cannot do.

What it does not close is mobile, and the closure says so with a number rather than a hope.
