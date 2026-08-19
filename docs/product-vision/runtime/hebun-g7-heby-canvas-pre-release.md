# Hebun G7 — Heby Spatial Canvas + Evidence Surface — Pre-Release Report

**Not committed. Not tagged. Not pushed. Not deployed.**

Baseline entering the phase: HEAD `eeb8f48`, 418/418, `heby_answer_source_evidence` present
and populated by G6D, zero pending schema.

**Result: 420/420, zero schema, zero migration, zero dependency, zero writer, zero provider
path, zero global token change.**

---

## 1. Exact files changed

> **Corrected at the final visual pass.** This table originally read "11 files, +621/−127". The
> authenticated pass added `heby-visualizer.tsx` (viewport-height presence bound) and
> `heby-composer.tsx` (mobile wrap fix), and reworked `heby-workspace.tsx` and `globals.css`
> further. The numbers below are the final measured ones; the closure record carries the same set.

### Modified — 16 files, +842 / −134 (including 3 released test suites and `learnings.md`)

| File | Δ | What changed |
|---|---|---|
| [heby-workspace.tsx](apps/dashboard/src/components/layout/heby/heby-workspace.tsx) | +287/−84 | Composition replaced by the spatial canvas: depth floor, presence field, emerging composer dock, contextual rail column. |
| [globals.css](apps/dashboard/src/app/globals.css) | +136/−16 | Heby's accent emerald → amber, in the token scope that was already Heby's. Depth-floor tokens and rules. |
| [heby-quick-panel.tsx](apps/dashboard/src/components/layout/heby/heby-quick-panel.tsx) | +82/−11 | Collapse/expand to a 4.25rem strip. Kept mounted. |
| [heby-turns.tsx](apps/dashboard/src/components/layout/heby/heby-turns.tsx) | +70 | Evidence chain → three independent decisions; source-evidence disclosure; stale-state fix. |
| [answer-evidence.ts](apps/dashboard/src/features/heby-conversation/answer-evidence.ts) | +52 | `toResponseSourceEvidence`; `fromStoredSourceEvidence` widened to the row-input shape. |
| [contracts.ts](apps/dashboard/src/features/heby-runtime/contracts.ts) | +52 | `HebySourceEvidenceItem` / `Group`; `HebyRuntimeResponse.sourceEvidence?`. |
| [heby-thread.ts](apps/dashboard/src/components/layout/heby/heby-thread.ts) | +32 | `ThreadMessage.sourceEvidence` declared and carried onto the turn. |
| [model-answer.server.ts](apps/dashboard/src/features/heby-answer/model-answer.server.ts) | +30 | Step 8b: attach the live citations from the same resolutions persistence was given. |
| [heby/page.tsx](apps/dashboard/src/app/(dashboard)/heby/page.tsx) | +28 | `readStream()` — one server read, R3A's own. |
| [heby-workspace-client.tsx](apps/dashboard/src/components/layout/heby/heby-workspace-client.tsx) | +14 | Passes the server-read stream through. |
| [heby-surface/index.ts](apps/dashboard/src/features/heby-surface/index.ts) | +1 | Re-export. |

### New — 6 files

```
src/components/layout/heby/heby-source-evidence.tsx    the G7 Evidence Surface
src/components/layout/heby/heby-stream-rail.tsx        Hebun Akışı
src/features/heby-stream/activity-stream.ts            the rail's pure projection
src/features/heby-stream/index.ts
src/features/heby-surface/canvas-mode.ts               the pure dock rule
tests/g7-flow/evidence-surface.ts                      + tests/g7-flow/canvas-and-firewall.ts
```

### Deleted — none.

### Explicitly untouched

`heby-presence.ts`, `heby-provenance.ts`, `heby-composer.tsx`,
`heby-voice-runtime.tsx`, `heby-voice-control.tsx`, `use-heby-conversation.ts`,
`use-heby-voice-surface.ts`, `heby-surface-context.tsx`, `heby-launcher.tsx`,
`heby-evidence.tsx`, `heby/actions.ts`, `src/db/**`, `src/styles/tokens.css`.
(`heby-visualizer.tsx` and `heby-composer.tsx` moved out of this list at the final visual pass.)

---

## 2. Keep / restyle / replace / remove — plan vs result

| Plan | Result | Why it changed |
|---|---|---|
| **Replace** `heby-workspace.tsx` with a new `heby-canvas.tsx`; delete the old file | **Replaced IN PLACE**, same path, same exported symbol | Nine released firewall suites reference that path or symbol. Renaming would have meant editing nine released proofs so they point at the new file — which is the moment a proof stops guarding anything. Keeping the path means `hw1`, `hw2`, `hw3`, `h1c`, `voice-v1`, `d1`, `r3b`, `r2c`, `r2d` now guard the **new** composition, unedited. |
| **Restyle** `heby-visualizer.tsx` (amber, larger hero) | **NOT TOUCHED — zero source change** | It already spent every colour through `--heby-presence` / `--heby-aura`. Retargeting those variables re-skinned it completely. Its released geometry, determinism (`buildShell` ×3, >250 circles, no `Math.random`, no `Date`) and six-state truthfulness proofs therefore still guard the amber presence. |
| **Restyle** the shell's global `--color-primary` scope carefully | **No global token exists to protect** | The audit found the emerald was **already** declared inside `.heby-surface`. The product's palette is blue (`#2563eb`) in `src/styles/tokens.css` under `:root`. The swap was an edit to a block that was Heby's all along. |
| **Restyle** `heby-composer.tsx` with a `density: "canvas"` variant | **Not needed** | The dock is a wrapper. `density="workspace"` was already correct; a third density would have been a second composer in all but name. |
| **Restyle** `heby-evidence.tsx` (Knowledge) | **Not touched** | Its colour comes from the same scoped tokens. Its behaviour is KR4/KR5 honesty machinery and had no visual debt. |
| **Keep + restyle** `heby-quick-panel.tsx`, made secondary/collapsible | **Done as approved** | Collapse ≠ close: the component stays mounted, so the session and the voice claim survive. |
| **Remove** — nothing | **Nothing removed** | `HebyEvidenceNotRetained` kept; only its call-site condition was wrong. |
| **New** `heby-canvas` / `heby-field` / `heby-conversation-layer` / `heby-composer-dock` as four files | **Composed inside `heby-workspace.tsx`** | Four wrappers that each take the same props and render one div is indirection, not architecture. The rail, the source panel, the stream projection and the dock rule — the parts with their own logic or their own truth obligations — did become their own modules. |

---

## 3. Runtime before / after

| | Before (`eeb8f48`) | After |
|---|---|---|
| Server actions on the Heby surface | 4 | **4** (unchanged) |
| `askHebyAction` dispatch sites | 1 | **1** |
| Conversation authorities | 1 durable server conversation | **1** |
| Microphone owners | 1 (`HebyVoiceProvider`, mounted in the shell) | **1** |
| Heby presentation surfaces | 2, mutually exclusive by construction | **2**, unchanged |
| Server reads performed by `/heby` | 0 | **1** — `readPendingActionRequests`, R3A's own, tenant-scoped |
| Tables | 57 | **57** |
| Migrations | 32 | **32** |
| Dependencies | unchanged | **unchanged** |
| Model/provider path from the UI | none | **none** |
| Global design tokens changed | — | **0** |

The one added read is somebody else's reader, taken unchanged: the tenant comes from the R1
session, the predicate is `tenant_id = <that tenant> AND status = 'pending'`, and there is no
parameter through which the page could ask about another tenant. It performs no query of its own.

---

## 4. Evidence live / reload parity — proof

### The two defects, precisely

1. **Reload.** `loadHebyConversation` has returned `sourceEvidence` since G6D, and the hook passes
   the loader's message objects straight into `buildTurns`. The rows were already in the browser.
   `ThreadMessage` did not declare the field, so `buildTurns` dropped it — and the turn then fell
   through to *"Evidence details were not retained for this earlier response."*
2. **Live.** `HebyEvidenceReference` carries `{ sourceClass, recordRef, lifecycle }` only. The
   label, the detail and the standing existed in the `SourceResolution` objects, were written to
   the durable row, and never crossed to the client. **The live answer showed less than its own
   reload.**

### Parity is structural, not tested-for

```ts
export function toResponseSourceEvidence(resolutions) {
  return fromStoredSourceEvidence(toStoredSourceEvidence(resolutions));
}
```

The rows in the middle are the rows `persistExchange` is given, from the same `resolutions` array,
in the same function, on the same turn. There is no second definition of "what this answer cited"
that could drift. A divergence would require editing one of the two projections — which changes
both views at once.

### Behavioural proof (`tests/g7-flow/evidence-surface.ts` §1)

The round trip is walked for real — resolutions → stored rows → replay — and compared to the live
value. It is not a tautology: the values pass through the storage row shape, where ordinal
ordering, per-class grouping and the Knowledge exclusion are applied.

| Assertion | Result |
|---|---|
| live value `deepEqual` replayed value | ✅ |
| mixed answer keeps two standings (`authoritative` + `derived`) | ✅ |
| Knowledge excluded from the source view (it has its own authority) | ✅ |
| unavailable source contributes nothing | ✅ |
| record order the reader met is preserved | ✅ |
| `sourceEvidence` survives `ThreadMessage → buildTurns → HebyTurnView` | ✅ |
| a user turn never acquires citations | ✅ |
| **`data-heby-evidence-not-retained` absent when citations exist** | ✅ |
| the notice still renders when a turn genuinely stored nothing | ✅ |
| an **empty** citation list is not evidence, and does not suppress the notice | ✅ |
| the richer panel replaces the bare reference list rather than doubling it | ✅ |
| a non-durable turn shows its citations **and** still says it was not saved | ✅ |
| Knowledge evidence behaviour unchanged (KR4/KR5 suites) | ✅ 2 suites green, untouched |
| `HebySourceEvidenceGroup` ≡ `ReplayedSourceEvidence` | ✅ compile-time, both directions |

### Visually confirmed

The rendered surface shows `GOVERNANCE · authoritative organizational record` above
*Genesis decision / bootstrap · accepted / decision-1*, and `OPERATIONS · derived read model`
above *Execution queue / 0 running / op-7*, in one answer, with the closing line
*"A record being authoritative means the source that resolved it owns it. It is not a statement
that the record is correct, current, or agreed with by anything else."*

---

## 5. Hebun Akışı truthfulness — proof

### What the rail carries

Pending authorization requests. Real, per-item, tenant-scoped, timestamped, already a product
surface at `/approvals`. Nothing else.

### What it cannot carry, and why

| Reference entry | Status |
|---|---|
| "Yeni belge yüklendi — Q2 Finansal Rapor.pdf" | **No read seam.** Knowledge exposes records, not ingestion events. |
| "Governance onayı — Tedarikçi Politikası onaylandı" | **No read seam.** R7.1 built tallies over `audit_log`; no per-event read exists. |
| "Heby analizini tamamladı" | **Impossible.** Heby performs no analysis; synthesis is not activated. |
| "Görev tamamlandı" | **No task runtime, no task records.** |
| "Yeni sinyal oluştu — %12 artış" | **Nothing detects signals or computes a trend.** |
| Event-type colour coding | Would assert a taxonomy no authority published (R7.1 settled this). |
| Top-right status dot | Would read as "online". No read seam. **Omitted.** |

**R7.1's aggregate was NOT used.** The Director permitted it as a separate summary element; it was
left out. A count rendered beside a timeline is the single most likely thing to be misread as an
event stream, and the Director also said a sparse rail is preferable. One line to add later if
wanted.

### Proofs (`tests/g7-flow/canvas-and-firewall.ts` §4–7)

| Assertion | Result |
|---|---|
| `toStreamItems([])` → `[]` — no default entry exists | ✅ |
| every rendered field **moves when the row moves** (label, detail, instant) | ✅ |
| an absent target prints the record's own `actionKind` verbatim, never a placeholder | ✅ |
| a hostile row (`https://…`, `javascript:…`) **cannot influence the destination** | ✅ |
| time is copied by ISO string slice — no `Date`, no `Intl`, no locale, no relative phrasing | ✅ |
| the projection module contains no `Date`, `Math.random`, `Intl`, `fetch`, `db`, `drizzle` | ✅ |
| **empty ≠ unavailable ≠ absent** — three states, three different sentences | ✅ |
| the failure names its own reason instead of looking like an empty queue | ✅ |
| empty refuses the reading "nothing happened in your organization" | ✅ |
| the rail is an `<aside>`; the workspace ships no `<nav>` | ✅ |
| the rail has **no representation** for uploaded/analysis/completed/signal/trend/workflow/agent/online/healthy/synced/scanning | ✅ |
| no percentage; the rail renders records, never a tally (`.length` banned) | ✅ |

**Bite-proof:** a "helpful" placeholder row reproducing the reference's *"Yeni belge yüklendi — Q2
Finansal Rapor.pdf"* for an empty queue was inserted into the projection. → `no rows, no items —
there is no default entry` **FAILED**. Restored, green.

---

## 6. Responsive / accessibility result

Verified by rendering the shipped component with the real compiled stylesheet at 1512×900 and
375×812.

| | Result |
|---|---|
| Desktop ≥ `lg` | Presence centred, Context/Authority peripheral labels, dock hint, rail at 19rem. |
| Below `lg` | Rail hidden; context and authority remain in the header line. **No record is lost** — `/approvals` is in the shell navigation. This is the one deliberate hide, stated rather than silent. |
| Mobile 375 | Presence, invitation, suggestions, composer. **No horizontal page scroll.** |
| The composer | **Always mounted, always tabbable, always clickable, in every state** — including a resting hero canvas. Resting dims and lowers it; it is never `opacity-0`, never `pointer-events-none`, never `aria-hidden`. |
| Keyboard-only | Tab into the dock ⇒ `focusInDock` ⇒ `inviting`. Hover is an enhancement, never the only path. |
| Draft / in-flight / voice open / unavailable | Each **forces** the dock forward. A draft can never be hidden; nor can the notice explaining why Heby cannot answer. |
| `autoFocus` | Dropped in hero mode only, so the empty canvas belongs to Heby. Restored the moment a conversation exists. |
| Motion | The depth floor is **static** — no animation, no transition, no interpolated value. Asserted against the CSS rule and the component. |
| Standing indicators | Carried by **words** (`authoritative organizational record` / `derived read model`), never colour alone. |
| Panel collapse | `aria-expanded` on both controls; expand and close both reachable from the collapsed strip. |

---

## 7. Test / bite-proof results

```
lint       0 errors, 14 warnings (all pre-existing, none in G7 files)
typecheck  clean
tests      420 passed, 0 failed, 420 total
build      ✓ compiled, /heby renders
```

Baseline 418 → 420 (two new G7 suites). **No released suite was edited.** All nine suites that pin
`heby-workspace.tsx` by path or symbol now guard the new composition unmodified.

### Bite-proofs — six, each applied, verified applied, observed to fail, restored

| # | Mutation | Assertion that fired |
|---|---|---|
| 1 | Reinstate the G6D drop in `heby-thread.ts` | `a reloaded turn keeps its recorded citations` |
| 2 | Restore the old `turn.historical && !turn.knowledgeEvidence` condition | `a reloaded answer with recorded citations never claims they were not retained` |
| 3 | Replace the composition with a parallel implementation of `toResponseSourceEvidence` | `the live view and the reloaded view are the same value` |
| 4 | Add `db.insert(...)` to the rail component | `heby-stream-rail.tsx must have no representation for ".insert("` |
| 5 | Fabricate the reference's document-upload row for an empty queue | `no rows, no items — there is no default entry` |
| 6a | Delete the dock hint / 6b weaken the dock rule to `hasDraft` only | both failed |

### One flake, proved pre-existing

`tests/k2-flow/create-and-read-postgres.ts` — `exactly one creation won`, a Knowledge concurrency
race (`created`/`unavailable` instead of `created`/`duplicate`). It **does** import
`model-answer.server.ts` and `heby-runtime/contracts.ts`, so it could not be dismissed by
inspection. Measured instead, 12 runs each:

| | fail rate |
|---|---|
| Those three files reverted to `eeb8f48` | **7 / 12** |
| With G7 | **4 / 12** |

Same assertion, same shape, **less** frequent with G7. Matches the rate documented at G6D
(7/12 vs 4/12). Pre-existing. Not caused, not fixed, not masked.

---

## 8. Writer / provider reachability

Swept across all eleven G7-introduced or G7-rewritten files, as a permanent assertion:

- **No writer.** `.insert(`, `.update(`, `.delete(`, `transaction(`, `executeAuthorizedAction`,
  `establishGovernanceAuthority`, `persistExchange`, `recordActionRequest`,
  `approveActionRequest` — **none has any representation.**
- **No provider path.** `generateHebyModelAnswer`, `selectModelTransport`, `claude-model-client`,
  `heby-model`, `anthropic`, `ANTHROPIC` — **none.** Model synthesis is not activated.
- **No out-of-scope surface.** `computer-use`, `live-map` — **none.** Neither was built.
- **No server reach from a client surface.** The canvas, the rail, the source panel and the stream
  projection contain no `.server`, no `drizzle-orm`, no `@/db/`, no `fetch(`, no `askHebyAction`,
  no `resolveTenant`.
- **Zero schema.** The migration journal contains no G7 entry. The durable rows the surface reads
  are G6D's, unchanged.
- **G6C boundary untouched.** `governance-grounding/` not modified.

---

## 9. Remaining limitations

1. **The rail will be empty for Tenant Zero.** Zero pending requests today ⇒ the honest empty
   sentence. This is the endorsed outcome, not a defect.
2. **No per-event governance read exists.** Until Governance publishes one, the rail cannot show a
   ratification, an authority change or any recorded act. That is a Governance-side read seam, not
   a UI change.
3. **No ingestion, task or signal events exist anywhere.** Four of the reference's five entries
   remain unimplementable.
4. **Below `lg` the rail is not rendered.** Deliberate; the records stay reachable at `/approvals`.
5. **`/heby` was not exercised end-to-end in a browser.** Local auth is enabled and I will not
   enter credentials. The surface was verified by rendering the shipped component with the real
   compiled stylesheet at two viewports, plus 420 assertions. **A signed-in pass on the real route
   is outstanding and is the Director's to run.**
6. **The rail's read is per-request and uncached.** One extra query per `/heby` load. Bounded at 50
   rows by R3A's own limit.
7. **The Quick Panel's collapsed state is not persisted.** Re-opening starts expanded. Deliberate:
   persisting it would need a store, and a panel someone opened should show them what they opened.
8. **`data-heby-dock` has no reduced-motion variant of its own.** It relies on the global
   `prefers-reduced-motion` rule and a `motion-safe:` translate. Verified by class, not by an
   emulated media query.
9. **The visualizer's hero size is unchanged** (`size-72`). The reference's larger feel comes from
   the canvas around it. Growing it would break released geometry pins and was not attempted.

---

## 10. Proposed release classification

**RELEASE — presentation migration with a durable-evidence repair. Zero schema, zero migration,
zero new authority, zero writer, zero provider activation.**

Two claims:

> **"Heby's dedicated workspace is a dark spatial canvas with Heby at its centre, its conversation
> emerges from that surface rather than occupying it, and a contextual rail beside it renders only
> records a read seam returned."**

> **"A Heby answer's non-Knowledge sources are visually inspectable, an authoritative
> organizational record is distinguishable in words from a derived read model, and what the reader
> sees after a reload is the same value they saw live — because it is one projection, not two."**

What it is **not**: not a Live Map, not model synthesis, not Computer Use, not an organizational
activity feed, and not a redesign of the Hebun product — the shell keeps its own design-system
authority and its own palette.

Suggested tag on the docs commit: `hebun-g7-heby-canvas-evidence-surface`.

**Stopped before commit / tag / push / deploy, as instructed.**

---

# ADDENDUM — G7 FINAL VISUAL PASS (authenticated)

Director verdict on the first build: *"technically clean but visually too sparse and too close to
a conventional premium chat landing page."* Six corrections were requested. All six are applied and
verified **on the real authenticated `/heby` route**, not on an isolated component render.

**420/420, lint 0 errors, typecheck clean, build ✓. Still zero schema, zero writer, zero provider
path. Nothing committed, tagged, pushed or deployed.**

## How the pass was run

The Claude browser pane's renderer stopped compositing (`Render frame was disposed`), and the
gstack `/browse` daemon needs a Playwright browser that is not installed. The pass ran through the
**chrome-devtools MCP**, in a real Chrome, on a session the Director signed in themselves — no
credential was entered by me at any point.

Screenshots: [docs/g7-shots/](apps/dashboard/docs/g7-shots) — desktop at a true 1512×900 viewport
(CDP emulation), mobile at 390×844×3 with touch.

| | File | What it proves |
|---|---|---|
| **A** | `A-idle-desktop.png` | Authenticated `/heby?from=governance` idle. Presence dominant with its amber field and energy paths, CONTEXT/AUTHORITY labels, READY, framing line, three chips, dock hint, composer, rail. |
| **B** | `B-rail-hidden.png` | Rail dismissed — Heby alone on the canvas, with the restore control. |
| **C** | `C-evidence-live.png` | Live answer, `Sources (8)`, `OPERATIONS · derived read model`. |
| **C2** | `C2-evidence-authoritative-live.png` | Same answer, `GOVERNANCE · authoritative organizational record` with the two real Genesis records. |
| **D** | `D-evidence-reloaded.png` | After reload: `Recorded sources (8)`, historical notice, **identical records and standings**. |
| **E** | `E-mobile.png` | 390×844. No rail, no horizontal scroll, composer usable. |

## The six corrections

**1. Presence.** The ceiling is now `min(30rem, 32dvh)` at `xl`, replacing the `lg:size-72` cap.
Two earlier attempts — a width-only `26rem`, then width+height breakpoints — were both measured
against the real product and **both cropped it**. A fraction of the height that actually exists
makes "as large as the room allows" and "never larger than the room" the same statement. The six
states, captions, accessible names, point field and motion contract are untouched.

**2. Spatial depth.** Three ambient layers, all `aria-hidden`, all pointer-transparent, all
**static**: `.heby-aurora` (wide light + five fixed amber rays, angles chosen off the vertical axis
so no ray points at the caption), `.heby-horizon` (a real `rotateX(74deg)` perspective grid
receding to a vanishing line), `.heby-floor` (dot lattice + glow). None takes a prop; the block
contains no state, clock or randomness, asserted per layer.

**3. Chatbot feel removed.** `"How can I help?"` is gone. The prompt cards are quiet chips that now
live **on the dock**, with the composer they fill. The framing line moved there too — it describes
what the field below will do. The hero is the presence and its two real labels, and nothing else.

**4. Hebun Akışı.** Present, honest, and dismissible. On Tenant Zero it reads *"Nothing is waiting
on a decision. This is what Hebun has recorded — it is not a statement about what your organization
has been doing."* No reference-image event was reproduced. Hiding it is a width: it reads nothing,
marks nothing, and there is no acknowledge act near the control.

**5. Evidence surface.** Card chrome removed. Structure is a single hairline — amber for the
authority, grey for the derived read — plus the standing in words. It is the transcript's own
grammar, not a widget pasted onto it.

**6. Desktop first.** Verified at 1512×900, then mobile.

## Discrepancies found on the authenticated surface, and fixed

Each was invisible to the isolated render and appeared only in the real shell:

1. **Suggestion chips scrolled out of view.** The hero's scroll region is sized by what the shell
   bar, canvas header and dock leave. → chips moved to the dock.
2. **Framing line and peripheral labels cropped** at a 26rem presence. → viewport-height bound.
3. **Presence overflowed again** under width+height breakpoints. → `min()` on `dvh`.
4. **Mobile composer clipped its own placeholder.** At 390px the language selector, two voice
   controls and Send left the field ~150px, so `Message Heby…` wrapped inside a one-row textarea
   and was cut mid-word. → the form wraps and the field declares a real basis; the controls move to
   a second row. Desktop is unchanged (verified: one row, 62px).

## Released assertions changed, and why

Three suites pinned the literal string `"How can I help?"` (`h1c-flow`, `hw2-flow`, `hw3-flow`).
The **invariant** they protect is unchanged and still asserted: the hero carries an invitation, it
is gone once a conversation exists, and it never appears in the Quick Panel. Only the sentence
moved — to `"The field below is ready when you are."` on the dock. Each edit carries a comment
saying so. No other released assertion was touched.

## Remaining limitations

1. **On a 900px viewport the presence is 288px — the same as before.** 32dvh is the measured
   ceiling that keeps the caption, framing line, chips and composer on screen inside the shell. The
   presence reads considerably larger because most of its scale is now the atmospheric field around
   it, which has no such budget. Growing the geometry further requires removing something else from
   the canvas, which is a Director call, not mine.
2. **A long evidence panel scrolls.** With eight cited records the transcript region cannot show
   both groups at once on a 900px viewport. It scrolls; nothing is hidden.
3. **The rail is empty on Tenant Zero** — zero pending requests. Endorsed outcome.
4. **The rail is not rendered below `lg`.** Records stay reachable at `/approvals`.
5. **Ambient layers are static by choice.** The Director allowed ambient behaviour; I kept it still
   because a moving field beneath Heby is the shortest path to implying activity that does not
   exist. One line to change if you want slow drift.
6. **Only the deterministic path was exercised.** Provider connectivity is disabled by the Director,
   so every answer above is `Provider disabled by Director — answered deterministically`. That is
   the correct state for G7 and the evidence path is identical either way.

## Classification

**RELEASE** — unchanged from the main report, now with the authenticated visual gate satisfied.
Stopped before commit / tag / push / deploy.
