# CMD-FINAL + RESPONSIVE-L2 — the Director cockpit and the integrated shell (closure)

**Released 2026-08-25 · implementation commit `f88c3199d4b3b5e5528bcc6f7c36c6d1ffda7404`**
**Classification: A — GO (with one visual branch explicitly unexercised)**

Entry state: `main` at `d67f1a2` (GitHub repository-activity release). One ownership set of **21
paths** — 10 product files, 2 deletions, 7 amended pins, 2 new suites. No schema, no migration, no
row, no server action, no provider, no authority.

Two phase labels, one boundary. RESPONSIVE-L2 is recorded here rather than in a file of its own
because the integrated rail is what the cockpit's grid presupposes: the two are not separable into
commits that each build. The precedent is INT-3 + INT-3.1, which shipped as one commit under one
tag for the same reason.

---

## 1. Why CMD-V5 failed, stated precisely

CMD-V5 changed typography — smaller labels, rules removed, provenance demoted — and failed its
visual acceptance. It failed correctly. The measured verdict was that a normal person would see
*"they changed some typography"*, not a redesign.

The reason was structural, and four phases missed it:

> **Three sections with different semantic roles were rendering through one visible grammar.**

`WorkspaceSection` gives every region the same skeleton: heading, question, provenance, rule,
content. That is the right grammar for a workspace built from comparable regions — which is what
`/knowledge` is. It is the wrong grammar for a page whose three answers are an operating **state**,
an **action**, and a **coverage limit**. Restyling one skeleton cannot express three roles. CMD-V5
is the proof: every metric it set out to move, moved, and the page still read as a document.

## 2. The structural correction

| region | grammar | what it is |
|---|---|---|
| **Waiting on you** | **state** | An unboxed operating statement. Mark and answer set directly on the canvas, the largest text on the page after the workspace identity. A card is the right shape for *"this region is empty"* and the wrong shape for *"here is where your organization stands."* |
| **Express intent** | **doorway** | One line of what it is for, then the only bordered affordance on the page. It navigates and does nothing else, which is why it is an anchor and not a button. |
| **Not yet connected** | **inventory** | Six capability names first, doctrine after. What Hebun cannot answer is a list of capabilities, not an essay with a list at the end. |

They share a local scaffold (`CommandRegion`, nine lines, living beside its only consumer), the tone
table, the provenance chip and the type scale. They do **not** share a body grammar. That is the
whole change.

**`WorkspaceSection` was not modified.** Adding a Command-shaped variant would have put this page's
semantics inside a primitive another workspace depends on — and CMD-V5 already tried exactly that.
What `CommandRegion` borrows is the one property worth borrowing: **`provenance` is a required
prop**, so a region cannot be added to this page without answering where its content came from.

**`TONES` became an export, not a duplicate.** Command composes its own status line and takes the
word, the mark and the badge from `state-block.tsx` unchanged. Authority over what `empty` and
`unavailable` look like stays in one table for every surface. Only the *arrangement* is Command's.
A second table would be a second authority; a second layout is not.

**The questions are still declared, and no longer printed.** Each region attaches its question to
its `<section>` via `aria-describedby`. A screen reader still hears *"What is waiting for a human
decision in this organization?"*; a sighted Director no longer reads three of them before reaching
any state.

## 3. RESPONSIVE-L2 — one integrated navigation column

- **Integrated rail from tablet upward.** `@media (min-width: 768px)` sets `--rail-w:
  var(--rail-inline-w)`. Level-2 renders inline beneath its Level-1 workspace inside the rail's own
  width.
- **Mobile keeps its sheet.** `MobileNav` is untouched, and remains a consumer of the same canonical
  `SecondaryNavContent`.
- **`secondary-toggle.tsx` removed.** The user-collapsible Level-2 column it governed no longer
  exists, so the control governed nothing.
- **`tablet-sections.tsx` removed.** The tablet drawer it opened no longer exists.
- **The detached `SecondaryNav` column removed.** `SecondaryNavContent` survives as the single
  canonical list, now rendered by the rail and by the mobile sheet.

**The rail width is derived, not chosen.** `--rail-inline-w: 220px` = the measured longest canonical
Level-2 label ("Infrastructure & Settings", 141px at the row's own 12px/500) plus 71px of chrome,
plus slack. The earlier 156px experiment gave that label 77px and bought the difference with
`w-max` — which is how Level-2 rows came to paint across the workspace. `whitespace-nowrap` is gone
with it: a longer label added later **wraps** rather than clipping, truncating, or escaping the
column. The integrated shell is still 96px narrower than the released `92 + 224 = 316px`.

`--secondary-w` is retired; `--shell-nav-w` is now `calc(var(--rail-w) + var(--secondary-offset))`
with the offset at `0px`, so `md:pl-(--rail-w)` and `lg:pl-(--shell-nav-w)` resolve to the same
220px and the arithmetic stays single-sourced.

## 4. Authority boundary — presentation only

| dimension | change |
|---|---|
| schema / migrations / ledger | none |
| rows written | 0 |
| server actions | unchanged |
| read seams | none added |
| provider state | none read, none inferred |
| capability availability | none inferred |
| authority | none held, none checked, none granted |
| execution | none |
| seeded goals containment (CMD-0) | preserved |
| ProvenanceChip requirement | preserved, and now enforced by a required prop |

`CommandOverview` remains server-safe: it reads nothing, resolves nothing, and grants nothing.
`command/page.tsx` changed only its context string — the authority sentence *"Command summarizes and
routes; every act belongs to the workspace that owns it"* is kept verbatim, and the removed sentence
was a table of contents for the page's own two sections.

## 5. Released-pin repairs

Three released pins were repaired rather than weakened.

**Route census restored to 129.** `DASHBOARD_ROUTE_COUNT` preserves the released GITHUB-2 reality.

**CMD-V3's composition arithmetic re-sourced.** It derived the space available to the split from
`--rail-w + --secondary-w`. `--secondary-w` no longer exists, so reading it would have made the
proof unfalsifiable. It now derives from the surviving shell composition.

**HW1's navigation clause repaired — see §6.** It had gone vacuous, and was found *after* the
implementation commit was already on remote main.

## 6. The HW1 pin was vacuous, and this is how it was proved

`tests/hw1-flow/navigation-and-firewall.ts` guarded, inside the "the pre-H1 drawer is RETIRED"
section:

```ts
assert.ok(shell.includes("WorkspaceRail") && shell.includes("SecondaryNav"), "Hebun navigation is intact");
```

**ORIGINAL INVARIANT.** Retiring the pre-H1 Heby side drawer must not have cost Hebun its own two
navigation levels. The shell still mounts Level-1 and Level-2.

**WHY CMD-FINAL LEGITIMATELY FALSIFIED THE OLD REPRESENTATION.** The invariant still holds — both
levels are mounted on every route. What changed is *where*: Level-2 is no longer a detached column
the shell mounts, it is `SecondaryNavContent`, rendered by the rail from tablet upward and by the
mobile sheet below it. The clause did not fail. It kept passing on the word `SecondaryNavContent`
inside the shell's own **prose**, with no import and no mount anywhere in the file.

Proved, not asserted:

| probe | result |
|---|---|
| occurrences of `SecondaryNav` in `hebun-shell.tsx` | **1** — line 50, inside a block comment |
| `<SecondaryNav />` mounted in the shell | no |
| `SecondaryNav` component exported anywhere in `src/` | **none** |
| released clause on the current tree | PASS |
| released clause with Level-2 **deleted from the rail** | **PASS** |
| released clause with the shell's comments stripped | FAIL |

The last two rows are the finding: the clause could not distinguish an intact Level-2 from a deleted
one, and its only surviving evidence was comment text.

**NEW ASSERTION.** Against code rather than text, against the mount rather than the name, across
both responsive paths:

```ts
const shellCode = codeOf(shell);
assert.match(shellCode, /<WorkspaceRail\s*\/>/, "the shell still mounts Level-1 navigation");
for (const [surface, path] of [["the rail", RAIL], ["the mobile sheet", MOBILE_NAV]] as const) {
  const src = codeOf(read(path));
  assert.match(src, /from "\.\/secondary-nav"/, `${surface} imports the canonical Level-2 list`);
  assert.match(src, /<SecondaryNavContent\b/, `${surface} mounts Level-2 navigation`);
}
assert.ok(!/export\s+function\s+SecondaryNav\s*\(/.test(read(SECONDARY_NAV)),
  "the detached Level-2 column is retired");
```

**WHY IT IS STRONGER.** The old clause tested two bare substrings against one raw file. The new one
tests executable source (`codeOf`, the repository's established helper) in three files, requires an
actual JSX **mount** rather than a name, covers **both** responsive paths rather than neither, and
adds a retirement guard the old clause never had. It cannot be satisfied by prose.

**SecondaryNav was NOT restored, and no runtime was changed to satisfy the old wording.** `src/` is
byte-identical to `f88c319`.

**Four bite-proofs, each verified to apply before being run** (a mutation that fails to apply is
indistinguishable from one that failed to bite), run against a scratch copy so the real tree was
never mutated:

| mutation | assertion that fired |
|---|---|
| shell stops mounting Level-1 | *the shell still mounts Level-1 navigation* |
| rail stops mounting Level-2 | *the rail mounts Level-2 navigation* |
| mobile sheet stops mounting Level-2 | *the mobile sheet mounts Level-2 navigation* |
| the detached `SecondaryNav` column returns | *the detached Level-2 column is retired* |

G7's parallel pin was audited and needed **no** repair: it already reads `codeOf(read(SHELL))` and
asserts on the `<WorkspaceRail />` mount, and its `SecondaryNav` mention is a *negative* assertion
against stripped code.

## 7. Validation

**At the implementation commit `f88c319`** — 11 release-critical suites passed: cmdfinal-command-
cockpit, responsive-l2, cmdb1, cmdb2/navigation, cmdb2/bite-proofs, cmdv3, cmdv4, g7-focus-mode,
typography-contract, vi2, vi1. Typecheck clean. Lint **0 errors** (14 pre-existing warnings, none in
an owned file). Build `✓ Compiled successfully`, 174/174 static pages. `git diff --cached --check`
clean.

Full suite: **470 passed, 1 failed, 471 total.**

> **THE FULL SUITE IS NOT GREEN.** The sole failure is
> `tests/int3-google-connection/bite-proofs.ts` — the pre-existing **INT-3 M9** defect, in a file
> this release does not touch. It was failing before this work and is failing after it. It is not
> repaired here and is not counted as passing.

**At this closure commit** — the HW1 repair is test-only and `src/` is byte-identical to `f88c319`,
so the full-suite figures above stand as **historical release evidence** for that runtime rather
than as a re-run. Newly executed here: the whole HW1 suite (5/5), cmdfinal-command-cockpit,
responsive-l2, g7-focus-mode, the four HW1 bite-proofs, typecheck, and lint on the changed file —
all clean.

## 8. Visual acceptance

**GO**, on the authenticated surface at **1440 / 1280 / 1024 / 834 / 390**:

- zero horizontal overflow
- zero clipping or truncation
- zero duplicate navigation controls
- zero unreachable controls
- zero console errors or warnings
- correct **state → action → coverage** reading order
- the CMD-V5 structural defect absent

**Branch coverage, stated honestly:**

| branch | status |
|---|---|
| `none-waiting` | **visually verified** |
| `unavailable` | rendered through the same statement primitive; covered structurally |
| `waiting` (a real pending decision) | **NOT visually exercised** |

The `waiting` branch was not exercised because doing so would require mutating dev data. It is the
one branch whose region renders inside a panel rather than on bare canvas, so it is also the branch
where the unboxed-statement claim is narrowest. This is a known, deliberate gap.

## 9. Truth ledger

| state | verdict | evidence |
|---|---|---|
| DESIGNED | ✅ | three semantic grammars replacing one skeleton (§2), integrated rail (§3) |
| IMPLEMENTED | ✅ | `f88c3199d4b3b5e5528bcc6f7c36c6d1ffda7404`, 21 paths, +1325 / −710 |
| VALIDATED | ✅ | §7 — 11 suites, typecheck, lint, build; full suite 470/1/471, **not green** |
| VISUALLY-ACCEPTED | ✅ *(partial)* | §8 — GO at five widths; `waiting` branch unexercised |
| RELEASED | ✅ | remote `main` = `f88c319` |
| PRODUCTION-SERVING | ✅ | §10 |
| CLOSED | — | pending this record and the release tag on remote |

## 10. Production-serving evidence

| signal | value |
|---|---|
| push accepted | `d67f1a2..f88c319  main -> main`, no force |
| deployment created | GitHub deployment `6076332145`, sha `f88c319`, env Production, `2026-08-25T04:15:15Z` |
| deployment ready | state `success`, project `hebuntechs-projects/hebun-ai-recovered` |
| production alias serving | `www.hebuntech.com` etag `79e071ae…` → `d3e5847c…`, age 32484 → 0 |
| auth boundaries | `/command`, `/command/intent`, `/approvals`, `/knowledge`, `/integrations/github`, `/settings`, `/platform` all `307 → /login` |
| public routes | `/`, `/login`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml` all `200` |

Alias ownership was corroborated independently rather than assumed: the pre-push `age: 32403`
resolved to exactly the previous deployment's timestamp, proving the alias tracks this project.

Nothing was deployed manually. No Vercel setting, domain, alias, environment variable or Git
connection was modified.

## 11. Remaining limitations

1. **The `waiting` branch was never visually exercised** (§8). Exercising it needs a mutation of dev
   data, which this phase declined to make.
2. **The full suite is not green** (§7). INT-3 M9 stands, untouched and unrepaired.
3. **The deployment SHA was read from GitHub, not from the Vercel API.** The available Vercel
   connector authenticates as team `mulifyco`, which owns zero projects; the real project lives
   under `hebuntechs-projects`, and the deployment URL returns 302 under deployment protection. The
   chain is the GitHub deployment record plus the alias etag/age flip — strong, but not a
   first-party Vercel SHA readback.
4. **`"{connectedMutations} consequential substrate"` remains ungrammatical at ≥2.** Pre-existing
   released copy, carried forward verbatim rather than silently corrected.
5. **HW1 keeps no committed bite-proof file.** The four proofs in §6 were run against a scratch copy
   and are recorded here rather than as a suite, matching HW1's existing convention — which means
   they are evidence, not a standing guard.

## 12. What this closes

Command is an operating surface rather than a document. A Director meets, in order: whether anything
requires them, what they can ask Hebun to prepare, and what Hebun still cannot answer — three
questions in three different visible grammars, on one screen at desktop width and in the same
priority order on a phone. The shell carries both navigation levels in one integrated column from
tablet upward with two controls fewer than before, and the phone keeps its sheet.

Nothing was deleted to buy the height. No capability lost its reason, no state word became a colour,
no authority moved, and the one branch that was not looked at is named rather than assumed.
