# G7.1 — Focused Heby Mode + reference-locked field — pre-release report

**Classification C — PRESENTATION ARCHITECTURE / NO NEW TRUTH.**
G7 was not reopened. No schema, no migration, no writer, no provider path, no new authority.

---

## 1. What was asked, in two directions

**Option B, Focused Heby Mode** (approved first): route-derived focus on `/heby`, one shell, no
persistence, desktop only, adaptive Hebun Akışı, presence bounded by both hero axes.

**Reference-locked visual pass** (approved second): move the authenticated surface materially closer
to the supplied reference image — one continuous dark field, luminous origin low in the frame,
ascending points, particle landscape, receded chrome, translucent Akışı column, near-absent
composer — *without* copying the reference's fabricated events or its awareness claim.

Two further subtractions were directed during the pass and are part of this release: the large
concentric arcs, and the three example prompt chips.

---

## 2. The mode

    focused ⟺ surface === "full-workspace"  AND  no per-visit restore request  AND  viewport ≥ lg

- Derived from the released surface model, which is derived from the route. `resolveHebyFocusMode`
  is pure: no React, no DOM, no storage, no clock.
- Expressed as ONE root data attribute plus one stylesheet block — the same mechanism the released
  secondary-navigation collapse already uses. There is no second shell.
- Never persisted, and it never writes the operator's own `hebun.secondary.collapsed` preference.
- Below `lg` the mode does not exist: every declaration lives inside one desktop media block.

### The defect the real product found

Unmounting the generic secondary toggle on `/heby` stopped the operator's stored preference from
being **applied**, so restoring the navigation there showed an expanded column to someone whose
saved preference was collapsed. The stored value was never touched — it simply stopped being read.
The toggle now stays mounted on every route and is hidden while Heby owns the decision.

---

## 3. The presence bound

    xl:size-[min(36rem, 66cqh, 34cqw)]        — heby-visualizer.tsx
    pb-[max(2rem, calc(0.2 * min(36rem,66cqh,34cqw)))]   — heby-workspace.tsx

The hero region is a `container-type: size` query container, so both terms measure the room that
actually exists after every piece of chrome has taken its share — and they re-measure when focused
mode moves that chrome.

The padding is the field's **decorative bleed**, reserved rather than clipped:

| Attempt | Result |
|---|---|
| Fixed 64px reserve | 0 phantom scroll at 1512×900, **30px at 1920×1080** |
| `overflow-clip`, 8rem / 4rem margin | 42px phantom scroll, unchanged |
| `overflow-clip`, 1rem / 0 margin | 0 scroll, **visible soft-edged rectangle around the orb** |
| Reserve = 0.2 × the bound | 0 at both sizes, no edges |

The bleed is 0.177 of the presence, measured twice (63px on 355px, 84px on 474px).

**The bound is written twice under protest.** It belongs in one custom property and it *was* one —
the build pipeline silently drops a custom property whose value is a `min()` of mixed absolute and
container units. The presence fell back to its `lg` step in the real product while every test still
passed. A test now pins the two literals to each other.

---

## 4. Measured geometry (authenticated `/heby`, real session, real read)

| | 1512×900 | 1920×1080 |
|---|---|---|
| canvas share of viewport | 96.3% | 93.8% |
| non-centre chrome | 3.7% | 6.3% |
| presence | 362px | 474px |
| presence / hero region | 64.2% | 66% |
| hero region / canvas | 67.4% | 70.6% |
| Akışı width / canvas | 20.9% | 16.9% |
| Akışı height / canvas | 85.3% | 87.9% |
| hero overflow | 0 | 0 |
| horizontal page scroll | 0 | 0 |

Receded chrome measured: rail and top bar `rgb(5, 9, 10)`, hairlines `#131c20`. On `/command` both
return to `rgb(255,255,255)` / `rgb(241,244,248)` with `--rail-w: 92px`, `--secondary-w: 224px`.

Mobile 390×844: `--rail-w` 92px and `--secondary-w` 224px **unchanged**, top bar white, focus
control `display: none`. The mode has no effect there.

---

## 5. What the reference asked for and did not get

| Reference element | Shipped | Why not, where not |
|---|---|---|
| Five example stream entries | **Refused** | Four have no read seam; the fifth is a tally, not an event |
| "Heby senses you and reveals the chat" | **Refused** | No read seam for attention, intent or need. The node states the released dock mechanism instead |
| Composer invisible until hover | **Partly** | Resting opacity 0.40. It stays mounted, tabbable, and carries the notice line — hiding it would hide the reason Heby cannot answer |
| Concentric arcs | **Built, then removed** | Behind the presence they read as a radar sweep, and Heby has nothing to sweep |
| Turkish copy | Not changed | Out of scope; released copy is pinned by three suites |
| Origin at ~55% of frame | 41.6% at 1512×900 | The reference has no visible composer; ours reserves the lower ~33% for one |

---

## 6. Tests

421/421. Build ✓. Lint 0 errors (14 pre-existing warnings in unrelated files).

`tests/k2-flow/create-and-read-postgres.ts` fails intermittently under full-suite load with

    AssertionError: exactly one creation won
      actual:   [ 'created', 'unavailable' ]
      expected: [ 'created', 'duplicate' ]

— a concurrent-create race inside the disposable-Postgres harness. It passes 6/6 standalone, imports
none of the files this phase touched, and is recorded as pre-existing since G6D.

### Assertions amended, and why

| Suite | Was | Now |
|---|---|---|
| g7-flow | presence bounded on ONE axis (`dvh`) | bounded on BOTH axes of its container, plus the container's existence |
| g7-flow | rail default adaptive per read | rail present by default; the read's truth is carried by its CONTENT. **This reverses a strengthening from the previous pass** and is stated so in the test |
| g7-flow | example prompts render | example prompts do NOT render; the composer they filled is untouched |
| h1c-flow | suggestion rendered | workspace shows no example prompt; composer and keyboard semantics intact |

Three released suites (`h1c`, `hw2`, `hw3`) pin the dock's invitation sentence; a copy change was
reverted rather than amend them for cosmetics.

---

## 7. Bite-proofs — 8/8 applied and bit

Each mutation was verified to change the file on disk, then reverted.

1. presence falls back to one-axis sizing → RED
2. presence bound enlarged past its room → RED
3. focused mode written to localStorage → RED
4. top bar `display:none` in focused mode → RED
5. `SecondaryNav` returns null when the mode attribute is set → RED
6. unavailable stream collapsed into the empty strip → RED
7. focus rules moved outside the `lg` media block → RED
8. restore control removed from the top bar → RED

---

## 8. Firewall

Swept files carry no `.insert(`, `.update(`, `.delete(`, `transaction(`, `drizzle-orm`, `@/db/`,
`.server`, no model boundary, no computer-use, no live-map. `_journal.json` has no entry for this
phase. The live acceptance answer read **"Provider disabled by Director — answered
deterministically"**; the reload read **"Recorded sources (6)"** with the historical framing
sentence. Governance writers 0, provider-control writers 0.

---

## 9. Limitations at release

- **Akışı with rows was never seen in the real product.** Tenant Zero has zero pending action
  requests, and manufacturing one would have been the fabrication the whole rail exists to refuse.
  The rows path is proved at component level and by bite-proof 6.
- **The final chip removal was not visually re-verified.** The browser instance lost its session and
  signing in is the Director's act; the subtraction is proved by two inverted assertions and a clean
  build. Everything else in this report was captured on the authenticated route.
- Focused mode applies in a mount effect, so a cold load of `/heby` paints one frame of released
  layout first — the same pattern as the released collapse toggle.
- At 1920 the canvas is capped by the shell's existing `max-w-[1800px]`.
- The particle landscape is materially quieter than the reference's, because the region the
  reference fills with it is the region our composer occupies.
