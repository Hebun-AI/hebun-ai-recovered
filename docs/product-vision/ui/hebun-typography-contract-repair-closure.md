# Typography Contract — proven, and the merge contract repaired (closure)

**Released 2026-08-20 · tag `hebun-typography-contract-proven` · implementation `1e393de`**
**Classification: A — TYPOGRAPHY CONTRACT PROVEN; MERGE CONTRACT REPAIRED / NO RUNTIME CHANGE**

Entry state: `main` at `045f137`, `HEAD == origin/main`, 0 ahead / 0 behind, 425/425, VI-2 tag
`hebun-vi2-shell-readability` peeling to `92f7102`.

One source file changed — `src/lib/utils.ts`, the `cn()` merge configuration. One new test suite,
`tests/typography-contract/contract.ts`. No token moved, no stylesheet touched, no call site
touched, no schema, no migration, no runtime, no authority, no row.

---

## 1. VI-2's diagnosis was wrong, and this record corrects it

VI-2 reported that the five Stage 0 semantic type utilities — `text-display`, `text-title`,
`text-body`, `text-meta`, `text-label` — were **inert**: "5 utilities emit no CSS, 165 live uses",
and it left an instruction to *activate the scale before Command*.

There was nothing to activate. That measurement was taken through the **dev server**, and the dev
server is not the product.

## 2. The production stylesheet already contained all five

Re-proved in this release against a real `next build`, reading the emitted chunk directly:

```
.next/static/chunks/1h39oe4rdhcjj.css

.text-display{font-size:var(--fs-display);line-height:var(--tw-leading,var(--lh-display))}
.text-title  {font-size:var(--fs-title);  line-height:var(--tw-leading,var(--lh-title))}
.text-body   {font-size:var(--fs-body);   line-height:var(--tw-leading,var(--lh-body))}
.text-meta   {font-size:var(--fs-meta);   line-height:var(--tw-leading,var(--lh-meta))}
.text-label  {font-size:var(--fs-label);  line-height:var(--tw-leading,var(--lh-label))}
```

All five present, each resolving through its own token, each carrying an intentional line height.
The same grep over the dev chunk (`.next/dev/static/chunks/src_app_globals_*.css`) returns **zero
matches for all five** — the divergence VI-2 measured, in one command, with the product's own build
output on both sides.

The suite does not trust that grep either: it compiles `globals.css` with the real Tailwind plugin
and asserts the rule text, so the compile contract is proved from source rather than from a report.

## 3. The rendered sizes are the intended scale

Declared in `src/styles/tokens.css`, aliased once each in the theme block of `globals.css`, and
measured in the browser against the production build served by `next start`:

| step | token | declared | rendered | line height |
|---|---|---|---|---|
| display | `--fs-display` | 1.75rem | **28px** | 1.15 |
| title | `--fs-title` | 1.125rem | **18px** | 1.35 |
| body | `--fs-body` | 1rem | **16px** | 1.6 |
| meta | `--fs-meta` | 0.8125rem | **13px** | 1.5 |
| label | `--fs-label` | 0.75rem | **12px** | 1.35 |

`label` **is** the reading floor, and the suite pins it as such: no semantic step may be declared
below 12px.

## 4. What was actually broken: `cn()`

tailwind-merge builds its class groups from Tailwind's **default** scale. It therefore knows
`text-xs` is a font size, and it does not know `text-label` is one — an unrecognised `text-*`
candidate falls into the text **colour** group. `cn()` consequently treated a semantic size and a
text colour as *the same conflict* and kept whichever came last, deleting the other. Which of the
two died depended only on the order they happened to be written in:

| call site | shape | what was deleted | rendered |
|---|---|---|---|
| `ProvenanceChip` | `cn("… text-label font-medium", spec.className /* text-fg-secondary */)` | the **size** | chip 264×30px instead of 208×22px — 16px text |
| `RegionHeader` eyebrow | `cn("… text-fg-muted", "text-label")` | the **colour** | `#142033` instead of `#5b687a` |
| `RegionHeader` title | `cn("… text-fg-secondary", "text-meta")` | the **colour** | `#142033` instead of `#526075` |
| `KnowledgeRegion` detail | `cn("leading-5 text-fg-secondary", compact ? "text-meta" : …)` | the **colour** | same failure, compact rows |

The decisive property: **the same class was correct in a plain `className` and silently broken the
moment it passed through `cn()`.** Counted over `src` with comments stripped — 80 usages in 21
files, **76 written plainly, 4 passing through `cn()`**. Two spellings of one class may not mean
two different things, which is why this could not be repaired at the call sites.

## 5. The fix belongs to the merge contract, and nowhere else

```ts
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["display","title","body","meta","label"] }] } },
});
```

The five are registered **where the merge decides** — one configuration, one owner. `text-xs` and
`text-sm` are untouched, which is precisely why VI-2's explicit shell floor was written in `text-xs`
and stays there; this gate does not migrate the shell onto the semantic scale, and a bite-proof
fails if it quietly does.

Registering them as sizes also keeps them behaving as sizes: `cn("text-meta","text-label")` still
resolves to `text-label`, `cn("text-xs","text-title")` to `text-title`, and `cn("text-title","text-xs")`
to `text-xs`. A registration in the wrong class group would stop two sizes conflicting and let them
stack — that exact mistake is reproduced and caught by two separate bite-proofs.

## 6. Zero tokens, zero stylesheets, zero call sites

`git diff --name-only` over the release: `apps/dashboard/src/lib/utils.ts` and the new
`apps/dashboard/tests/typography-contract/contract.ts`. `tokens.css` unchanged. `globals.css`
unchanged. No component, no page, no feature file. The suite additionally pins that **only**
`src/lib/utils.ts` may configure a merge — it walks the real `src` tree to say so — and that the
scale is declared exactly once and aliased exactly once, with the frozen `.heby-surface` scope
forbidden from re-pointing any of it.

## 7. Knowledge — before and after

The canonical Knowledge workspace is where the defect was visible, and it is repaired without one
line of Knowledge code changing:

| element | before | after |
|---|---|---|
| provenance chip | 264 × 30px, 16px text | **208 × 22px, 12px text** |
| region eyebrow | `#142033` at 12px | **`#5b687a` at 12px** |
| region plain title | `#142033` at 13px | **`#526075` at 13px** |
| compact region detail | colour lost | **colour and 13px both kept** |

And Knowledge compensates for nothing: the suite fails if any canonical Knowledge component carries
a raw `text-[…rem]` size or an inline `fontSize`, with a bite-proof on each.

## 8. Non-Knowledge regression

Full suite, this tree, canonical Postgres: **425 passed, 0 failed, 425 total** on the implementation
tree, and **424 / 1** on the re-run after a comment-only amendment, where the single failure was the
known `tests/k2-flow/create-and-read-postgres.ts` concurrency flake (`['created','unavailable']` vs
`['created','duplicate']`). Reproduced once standalone: **passes**. Recorded as the existing
exception, not investigated here.

`typecheck` clean, `lint` 0 errors (14 pre-existing warnings), `build` clean, `git diff --check`
clean, secret scan clean.

## 9. Heby regression

Heby is untouched and stays frozen. All Heby suites green: `heby-core` (approval, briefing,
composition, governance, grounding, identity, input-context, intent, presentation),
`heby-actions`, `heby-integration`, `heby-runtime`, `g7-flow` (canvas + firewall, evidence
surface), `g7-focus-mode`, `g6c-flow`, `g6d-flow`. The typography suite additionally asserts that
`.heby-surface` redefines neither a `--fs-*`, nor a `--lh-*`, nor a `--text-*` alias — with two
bite-proofs, one on the token and one on the alias — so the frozen surface cannot start answering
to the ordinary product's typography gate.

## 10. Deferred, explicitly: dev/prod CSS divergence

The dev-server chunk still emits none of the five while the production chunk emits all five. That is
a **developer-experience defect**, and it is the reason VI-2 reached a false conclusion. It is not
fixed in this release and was not investigated. Recorded here so the next reader does not repeat
VI-2's measurement and reach VI-2's answer.

## 11. Command entry condition

VI-2 left one blocking condition: *the Stage 0 type scale is inert; activate it and prove it before
Command.* The scale was never inert, and it is now **proved** — compiled, merged, rendered, pinned
by 42 assertions with bite-proofs on every load-bearing one, and owned in a single place.

**Command is cleared to begin from the typography-contract perspective.**

## 12. What this release did not touch

Zero schema. Zero migration. Zero rows. Zero authority. Zero tenant, provider, or runtime change.
Zero `src/features/**`. Zero `*.server.ts`. The ledger is unmoved; production state is unchanged.

---

## Guard audit

All 42 assertions were neutered one at a time and the suite re-run. **9 are load-bearing.** The
remaining 33 are recorded honestly rather than dressed up with mutations that isolate nothing: 24
are sibling-covered inside a five-step loop, 4 are recorded contract constants that no source
mutation can move, 3 are disk walks that would prove less against a fake tree, and 2 are defect
reproductions that exist so a future reader can see the mutation reproduces the *released*
behaviour rather than an invention.

Two traps found while writing the suite, both recorded in the file:

- **A cached compiler makes a bite-proof lie.** The Tailwind postcss plugin caches by input path.
  With a fixed `from`, every mutated stylesheet returned the baseline CSS — the mutation applied,
  the compiler ignored it, and each proof reported "did not bite" while guarding correctly. A unique
  `from` per compile is load-bearing.
- **An `async` check with nothing to await loses its failures.** Written async first, its rejections
  became unhandled promises the bite harness never saw, and the first proof reported "did not bite"
  while the assertion fired into the void.
