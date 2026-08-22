# CMD-V4 — Command visual priority: truth layered, never hidden (closure)

**Released 2026-08-22 · tag `hebun-cmdv4-command-visual-priority`**
**Classification: A — GO**

Entry state: `main` at the CMD-V3 release, tag `hebun-cmdv3-command-overview-composition`,
434/434. Two product files, one new suite, four amended CMD-V3 pins. No schema, no migration, no
row, no server action, no navigation change, no authority.

---

## 1. What CMD-V3 measured, and what this phase had to do about it

CMD-V3 closed at **B**, with a number rather than a hope: at 390px the six architectural reasons in
`Not yet connected` were roughly **1,180px of a 2,416px page**. A Director read half a screen of
prose about what Hebun CANNOT do before reaching what it can. CMD-V3 refused to fix that by deleting
a reason, and recorded the gap.

CMD-V4 closes it by LAYERING. Nothing is deleted, shortened, softened, or moved behind navigation.

## 2. The distinction the whole phase rests on

Truth may be **layered**; it may not be **hidden**. Those are separated by properties a test can
check, and the suite checks them rather than trusting the word "disclosure":

| layered | hidden |
|---|---|
| every capability NAME on screen while closed | a name that appears only once expanded |
| every "Not connected" state word on screen while closed | state carried by colour, or by a tooltip |
| every reason in the SAME document, one keystroke away | a reason behind a link, a fetch, or a route |
| the browser's own disclosure widget | a div with `onClick` and hand-rolled ARIA |
| only the tertiary section collapses | authoritative or derived content collapsed |

## 3. `<details>` at every width, and why native

Each of the six rows is a native `<details>`. The `<summary>` carries a chevron, the capability
name, and the words "Not connected". The reason is the body, aligned to the name by arithmetic
(`pl-[34px]` = the summary's 12px padding + the 14px chevron + the 8px gap).

**Native, not reimplemented.** `<details>`/`<summary>` is a disclosure widget the browser already
gives keyboard operation, focus, and expanded/collapsed announcement. A div with `onClick` would
need `aria-expanded`, `aria-controls`, a tabindex and key handlers, and would turn this server
component into a client one. The suite bans `role=`, `tabindex=` and `aria-expanded=` on any
summary, and bans `onClick`, `onToggle`, `useState`, `useEffect` and `"use client"` from the file.

**Only the tertiary section.** Zero `<details>` inside `#waiting` or `#intent` — asserted. A
Director may not have to click to learn whether something is waiting on them.

## 4. The panel went; its sentence stayed

`Not yet connected` opened with an `unavailable` StateBlock whose tone stated a fact the section's
`not-connected` provenance chip already stated, and which the six rows now each state again in their
own summary. Three statements of one fact, the largest of them a box.

What that block uniquely carried was one sentence — *"None is shown as an empty result, a zero, or a
placeholder figure, because Hebun does not know these facts — it is not that they are none."* That
sentence stayed, **verbatim**, as `text-meta` prose. The box did not.

## 5. `StateBlock` gains `layout`, and the default is again byte-identical

`layout?: "stack" | "row"`, defaulting to `stack`. `row` is the executive status line: mark, title
and eyebrow on one line, sentence beneath at `text-meta` (13px — a pixel above CMD-V2's floor).

As with `density` in CMD-V3, the `stack` literals are the released class strings written out whole,
and the default path is proved **byte-identical across all 20 tone × hideEyebrow × action
combinations**. The suite additionally asserts that a layout may carry no eyebrow, role, aria, icon,
tone colour, border treatment, raw size, or the `text-label` floor step.

**Both Waiting states get the row arrangement, on purpose.** A reader tells empty from unavailable by
comparison; giving the successful answer a status line and the unanswered read a panel would make the
two differ for a reason unrelated to which is which. The eyebrow moves to the end of the title line —
it does not leave, and a bite-proof enforces that.

## 6. The aside narrowed because its content did

360px → **320px**. CMD-V3 sized that column for six wrapped paragraphs; it now holds six one-line
summaries. Every pixel it gives back goes to the primary column, which grows 668 → **708px** at 1440.
320px is the floor of the approved band, not below it: an opened reason still wraps at roughly forty
characters. The CMD-V3 suite's width pins were amended, not weakened — the arithmetic that derives
the breakpoint is unchanged and still recomputed from the shell's tokens.

## 7. Authenticated acceptance — IFRAME-BASED, and recorded as such

Measured by the Director in their own authenticated Chrome, in four same-origin hidden iframes on
the real `/command`. **This is not top-level-window evidence and is not recorded as such.** The
controlled browser pane's renderer was proved dead during this gate (`Render frame was disposed`
across two tabs, `read_page`, `javascript_tool` and `screenshot`), so the console fallback was
explicitly authorized rather than silently substituted.

| viewport | CMD-V2 | CMD-V3 | **CMD-V4 closed** | Δ vs baseline |
|---|---|---|---|---|
| 1440×900 | 1766 | 1473 | **≤900** (not exactly 900 — see below) | ≥ −49% |
| 1024×768 | 1896 | 1756 | **1290** | −32% |
| 768×1024 | 1872 | 1752 | **1266** | −32% |
| 390×844 | 2440 | 2416 | **1731** | −29% |

390 with all six disclosures opened: **2263** — still below the 2,416px CMD-V3 page in which the
same reasons were permanently expanded.

**The 1440 number is a bound, not a measurement.** `docHeightClosed` came back as exactly 900, which
is the measuring iframe's own height; `scrollHeight` floors at the viewport. The section heights
prove it is a clamp: primary column 301 + 32 + 295 = 628, aside 571, row = 628, plus 56px main
padding = 684, so a true 900 would require a 216px PageHeader. The real value is ≈800. Recorded as
**≤900**, and the gate accepted that bound rather than chasing the exact figure.

Truth clean at all four viewports: horizontal overflow **0**, clipped meaningful text **0**, text
below the 12px floor **0**, buttons / forms / inputs in `main` **0/0/0**, exactly one `h1`, section
ids `waiting` / `intent` / `not-connected`, provenance `authoritative` / `derived` /
`not-connected`, L2 `Overview` / `Decisions` / `Director Intent`.

Disclosure contract, measured: 6 `<details>`; **6** capability names visible while closed; **6**
"Not connected" state words visible while closed; **6** reasons in the same `<details>` as their
summary; **6** collapsed by default; **6** reasons visible when opened; `navigatedWhileOpening:
false`; and `docHeightRestored === docHeightClosed` at every viewport, so the measurement left no
dirtied document behind.

**Reason lengths unchanged: 193 / 162 / 187 / 181 / 145 / 199** — identical to CMD-V3's measurement,
character for character. Nothing was shortened.

Composition measured: 1440 two-column, primary **708**, tertiary **320**, gap 32px, disclosure 1
column. 1024 / 768 / 390 single-column. 768 disclosure **2** columns. 390 disclosure 1 column.

## 8. Two probe defects, recorded rather than glossed

**`reasonsVisibleWhenClosed: 6` is wrong, and the heights disprove it.** Chrome still returns a
non-zero `getBoundingClientRect()` for descendants of a closed `<details>`, so the visibility helper
cannot answer that question at all. **Collapse is proved by the open/closed height delta instead** —
+596 / +336 / +336 / +532px when all six are opened. If the reasons were laid out while closed, that
delta would be zero. The field was discarded; the conclusion was not.

**The 1440 clamp** (§7) is the second. Both are instrument defects, not product defects, and both
are recorded here because a closure that reports only the fields that behaved would be a closure
that cannot be checked.

## 9. Impact — presentation only, proved

| dimension | change |
|---|---|
| schema / migrations / ledger | none — 32, untouched |
| rows written | 0 |
| server actions | 9, unchanged |
| read seams | none added |
| authority | none |
| canonical navigation / legacy routes | unchanged |
| Heby navigation truth | unchanged |
| CMD-B1 read seam / CMD-B2 contract | unchanged |

## 10. Verification

434/434 → **435/435**. Typecheck clean. Lint 0 errors (14 pre-existing warnings, none in a CMD-V3 or
CMD-V4 file). Build passes; `.xl\:w-\[320px\]{width:320px}`, `.pl-\[34px\]{padding-left:34px}`,
`group-open:rotate-90`, `::-webkit-details-marker` and `list-style:none` confirmed in the
**production** stylesheet, with the old 360px rule gone. `git diff --check` clean. Secret scan clean.

**18 bite-proofs, each audited to bite for the RIGHT reason**, plus a harness self-check: rendering
every disclosure `open` by default is a legitimate product choice and is required to be ACCEPTED.

One proof was rewritten during the gate. "Collapse the authoritative section" originally injected an
unclosed `<details>` that the parser could not read, so the per-section guard saw nothing and the
total-count assertion three lines later is what threw — it bit, for the wrong reason. It now fails
with *"the waiting section collapses nothing."*

## 11. Remaining debt at release

1. **Iframe evidence, never top-level.** The controlled browser pane's renderer died mid-gate and the
   limitation was proved, not assumed, before the fallback was used.
2. **1440 closed height known only as ≤900** (≈800 by arithmetic). Accepted as sufficient.
3. `reasonsVisibleWhenClosed` unusable in this Chrome; collapse proved by height delta.
4. Two `aria-current="page"` in the shell — rail and secondary nav. Pre-existing, not this phase's.
5. `"{connectedMutations} consequential action has a substrate"` ungrammatical at ≥2. Pre-existing
   released copy, left verbatim.

## 12. What this closes

Command answers a Director's three questions in order and in one screen at desktop width: *does
anything require me* at the top of a 708px primary column, *what can I ask Hebun to prepare* beneath
it, *what does Hebun still not know* in a quiet 320px rail — six named capabilities, six state
words, and six full reasons one keystroke away.

The mobile page fell from 2,440px at the CMD-V2 baseline to **1,731px**, and every pixel of that
came from composition and layering. Not one reason was deleted, not one character was truncated, and
not one word of type went below the floor.
