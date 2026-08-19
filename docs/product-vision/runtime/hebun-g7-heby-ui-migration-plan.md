# Hebun G7 — Heby UI Migration Plan (Director Gate: UI Architecture)

**Status: PLAN ONLY. Nothing implemented. Stops here for Director approval.**

Baseline: `eeb8f48` (main). Approved reference: the attached Heby interface image
(dark spatial canvas, central luminous presence, cursor-revealed conversation,
right-hand "Hebun Akışı", amber/gold, minimal chrome).

Scope rule this plan obeys: **replace obsolete presentation, preserve runtime and
authority boundaries.** No schema, no migration, no new server authority, no
provider activation, no Live Map, no Computer Use.

---

## 1. Current Heby components

All Heby presentation lives in one directory. This is the complete tree as of `eeb8f48`.

### 1.1 `src/components/layout/heby/` — 17 files, 4,692 lines

| File | Lines | What it owns |
|---|---|---|
| `heby-workspace.tsx` | 295 | The `/heby` full-workspace composition (hero / emerging / conversation), header, `Fact` peripheral labels, composer slot. Pure presentation. |
| `heby-workspace-client.tsx` | 84 | Container for `/heby`. Registers the server-validated return target, calls the shared conversation hook + voice binding. |
| `heby-quick-panel.tsx` | 199 | The right-hand overlay surface ("ask without leaving my work"). Pure presentation. |
| `heby-quick-panel-client.tsx` | 90 | Quick Panel container. Mounts nothing unless surface state is `quick-panel`. |
| `heby-surface-context.tsx` | 111 | Presentation-state provider. Delegates every transition to the pure planner `planHebyTransition`. Mutual exclusivity is structural. |
| `heby-launcher.tsx` | 75 | The two controls (rail = full workspace, topbar = quick panel). |
| `heby-visualizer.tsx` | 384 | The presence field. Six truthful states, deterministic Fibonacci point shells, `motion-safe:` only. |
| `heby-presence.ts` | 44 | Pure arbiter: conversation state vs voice state → one presence state. |
| `heby-composer.tsx` | 328 | THE composer, shared by both surfaces via a `density` prop. Keyboard semantics, command palette, command-output block, peripheral facts, advisory boundary line, voice control slot. |
| `heby-turns.tsx` | 220 | The only component that knows how a turn looks. Renders `HebyTurnView`, provenance pill, evidence disclosures, limitations. |
| `heby-evidence.tsx` | 332 | KR4/KR5 **Knowledge** evidence panel: standing chips, why-this, provenance, set notices, five empty states, historical notice, `HebyEvidenceNotRetained`. |
| `heby-provenance.ts` | 72 | Message/response → provenance badge. |
| `heby-thread.ts` | 100 | Pure thread composition: durable messages + optional ephemeral turn → `HebyTurnView[]`. Decides which evidence set a turn shows. |
| `use-heby-conversation.ts` | 558 | The single `askHebyAction` dispatch site, the single slash-command gate, the durable-conversation pointer, presence derivation, restore. |
| `use-heby-voice-surface.ts` | 125 | The one voice binding a surface uses. |
| `heby-voice-runtime.tsx` | 1,366 | The one microphone owner. Feature detection, disclosure, capture, transcript, playback. |
| `heby-voice-control.tsx` | 414 | Voice buttons + notices, rendered inside the composer. |

### 1.2 Mount points and supporting modules

| File | Role |
|---|---|
| `src/components/layout/hebun-shell.tsx` | Mounts `HebySurfaceProvider` → `HebyVoiceProvider` → shell → `HebyQuickPanelClient`. |
| `src/app/(dashboard)/heby/page.tsx` | Server route. Resolves context + authority + return target through closed allow-lists. |
| `src/app/(dashboard)/heby/actions.ts` | Four server actions: ask, load-conversation, read-command, propose-command. |
| `src/features/heby-surface/` | `composition.ts` (hero/emerging/conversation), `surface-state.ts` (the pure transition planner). |
| `src/app/globals.css` | `--heby-presence`, `--heby-aura`, `--heby-canvas`, the `heby-breathe` / `heby-orbit` / `heby-ripple` keyframes, the `--heby-audio` amplitude rules. Currently **emerald** (`#34d399`). |

### 1.3 Test surfaces that pin the current presentation

`h1c-flow`, `hw1-flow`, `hw2-flow`, `hw3-flow`, `kr4-flow`, `kr5-flow`, `s1-flow`,
`voice-v1`, `r2c-flow`, `r2d-flow`, `heby-integration`, `command-l2`, `intelligence-l2`.
Several assert rendered markup via `renderToStaticMarkup`. A visual replacement
**will** turn some of these red on purpose; that is expected work, not a defect.

---

## 2. Keep / restyle / replace / remove

### KEEP — untouched, or extended only in type

| File | Why |
|---|---|
| `use-heby-conversation.ts` | The only dispatch site. Presentation must not acquire conversation authority. |
| `use-heby-voice-surface.ts` | The one voice binding. |
| `heby-voice-runtime.tsx` | The one microphone owner. Reference image implies no voice change. |
| `heby-presence.ts` | The presence arbiter stays the arbiter. |
| `heby-provenance.ts` | Provenance vocabulary is pinned by `provenance-vocabulary` tests. |
| `heby-surface-context.tsx` | Presentation state only. Extended in §5 with one new *sub-state*, not a new surface. |
| `heby-workspace-client.tsx` | Container ownership unchanged; renders the new canvas instead of the old workspace. |
| `heby-quick-panel-client.tsx` | Mount-gating is the structural mutual-exclusivity guarantee. |
| `heby-thread.ts` | **Extended, not restyled** — carries `sourceEvidence` through (§4). |
| `heby-launcher.tsx` | Restyled colours only; behaviour and `data-heby-*` attributes unchanged. |
| `src/app/(dashboard)/heby/actions.ts` | No new action. No new server boundary. |
| `src/app/(dashboard)/heby/page.tsx` | Context/authority/return resolution unchanged. |

### RESTYLE — same contract, new visual language

| File | Change |
|---|---|
| `globals.css` (Heby block) | Emerald → amber/gold token swap: `--heby-presence`, `--heby-aura`, `--heby-canvas`, the three `data-heby-mode` recessions. Add a wave-floor and depth-field token. The keyframes' *truthfulness contract* is unchanged (nothing new animates on a timer). |
| `heby-visualizer.tsx` | Larger hero scale, concentric ring traces + luminous core matching the reference. **The six states stay six states.** Determinism (module-load Fibonacci distribution, no `Math.random`, no `Date`) stays. |
| `heby-turns.tsx` | Restyled for the dark spatial canvas; gains the source-evidence disclosure (§4). |
| `heby-composer.tsx` | Restyled; gains a `density: "canvas"` variant for the emergent dock. Keyboard semantics, palette, voice slot, facts line unchanged. |
| `heby-voice-control.tsx` | Colour/spacing only. |
| `heby-evidence.tsx` | Colour/spacing only. Its five empty states, three standing chips, set notices and historical notice are honesty machinery — **not** visual debt. |
| `heby-quick-panel.tsx` | Colour/spacing only. See the note below. |

**Note on the Quick Panel — Director decision requested.** The reference image
governs the *full workspace*. The Quick Panel is a different runtime job ("ask
without leaving my work") whose mutual exclusivity with the workspace is
structural. Recommendation: **restyle it, do not remove it.** Removing it would
delete a runtime surface, not obsolete presentation — outside this gate's mandate.
If the Director wants Heby to have exactly one surface, that is a separate gate.

### REPLACE

| File | Replaced by | Why |
|---|---|---|
| `heby-workspace.tsx` | `heby-canvas.tsx` (+ children, §3) | The hero/emerging/conversation *layout* is the obsolete presentation. Its prop contract is largely reusable; its DOM is not. |
| `features/heby-surface/composition.ts` | Extended in place | Three modes (`hero`/`emerging`/`conversation`) become the canvas's *dominance* model rather than three page layouts. Pure function stays pure. |

### REMOVE

**Nothing is removed.** Specifically **not** removed:

- `HebyEvidenceNotRetained` — still the only truthful thing to say for a turn that
  genuinely stored nothing (pre-KR5 / pre-G6D answers, and turns where no retrieval
  and no source resolution ran). Its **call-site condition** is the defect, not the
  component (§4.3).
- The `Fact` peripheral label component — it is folded into the canvas's field labels.

---

## 3. Proposed component hierarchy

```
/heby (server route — unchanged)
└─ HebyWorkspaceClient                    KEEP  (container, conversation + voice)
   └─ HebyCanvas                          NEW   (replaces HebyWorkspace)
      ├─ HebyCanvasChrome                 NEW   minimal: "Heby", context · authority,
      │                                         Back, New conversation
      ├─ HebyField                        NEW   the spatial layer
      │  ├─ HebyVisualizer                RESTYLE  central luminous presence
      │  ├─ HebyFieldLabels               NEW   (absorbs `Fact`) Context / Authority,
      │  │                                      rendered only when a real value exists
      │  └─ HebyDepthFloor                NEW   pure CSS wave/particle floor, decorative,
      │                                         zero data binding
      ├─ HebyConversationLayer            NEW   overlays the field when open (§5)
      │  └─ HebyTurnList                  RESTYLE
      │     ├─ UserBubble                 RESTYLE
      │     └─ HebyBubble                 RESTYLE
      │        ├─ ProvenancePill          RESTYLE
      │        ├─ HebyEvidencePanel       RESTYLE  (Knowledge — KR4/KR5, unchanged behaviour)
      │        ├─ HebySourceEvidencePanel NEW      ← the G7 Evidence Surface (§4)
      │        └─ HebyEvidenceNotRetained KEEP     (condition fixed)
      ├─ HebyComposerDock                 NEW   bottom-centre reveal zone (§5)
      │  └─ HebyComposer                  RESTYLE (density: "canvas")
      │     └─ HebyVoiceButtons/Notices   RESTYLE
      └─ HebyStreamRail                   NEW   "Hebun Akışı" (§6)
         └─ HebyStreamItem                NEW
```

Ownership rules carried forward unchanged:

- `HebyCanvas` and every child is **pure presentation**: props in, callbacks out,
  provable with `renderToStaticMarkup`. No server action, no fetch, no state
  beyond scroll/hover refs.
- `HebyWorkspaceClient` remains the only place the conversation hook is called on
  this surface.
- The presence field remains driven only by `resolveHebyPresence`.

---

## 4. Where the G7 Evidence Surface lives

**Inside the turn, under the Heby answer it belongs to — not in the rail, not in a
separate inspector.** Evidence is a property of one answer; a global panel would
detach it from the sentence it justifies.

New file: `src/components/layout/heby/heby-source-evidence.tsx`, sibling to
`heby-evidence.tsx`. Knowledge evidence keeps its own panel and its own behaviour;
the two render **side by side** under one answer, because G6D's own schema comment
requires that a mixed answer replays as the mixture it was.

### 4.1 What it renders

From `ReplayedSourceEvidence` (`src/features/heby-conversation/answer-evidence.ts`):

- `sourceClass` — the class that resolved the record, verbatim.
- `authoritative` — **the distinction the Director named.** Rendered as two visually
  distinct standings: *authoritative organizational record* vs *derived read model*.
  This value is the one **snapshotted at answer time**; it is never re-derived.
- per item: `label`, `detail`, `recordRef`.

Nothing else exists to render. There is no `content` (deliberately never stored),
no `lifecycle` (constant `settled` today), no `provenance` per row.

### 4.2 The data path — three gaps, all additive, zero schema

**Replay path (durable rows already exist and already reach the client).**
`loadHebyConversation` already returns `sourceEvidence` on each message, and
`use-heby-conversation.ts` passes the loader's message objects straight into
`buildTurns`. The rows are already in the browser. They are dropped because:

1. `ThreadMessage` (heby-thread.ts:20) does not declare `sourceEvidence`.
2. `buildTurns` does not copy it onto the turn.
3. `HebyTurnView` (heby-turns.tsx:29) has no field for it.

→ Fix: declare it in all three. **No server change. No schema. No new read.**

**Live path (the answer just produced).** `HebyRuntimeOutcome` carries
`response.evidence: HebyEvidenceReference[]`, which holds only
`{ sourceClass, recordRef, lifecycle }` — **no `label`, no `detail`, no
`authoritative`.** The `SourceResolution` objects that *do* carry them never leave
the server. So a live answer cannot show what its own reload will show.

→ Fix: `HebyRuntimeResponse` gains an **additive, derived** field
`sourceEvidence?: readonly ReplayedSourceEvidence[]`, built in `response-builder.ts`
from the same resolutions, through the **same pure grouper** that
`toStoredSourceEvidence` uses. Sharing the grouper is what guarantees the live view
and the stored view cannot disagree.

Constraints this must respect:
- `evidence` stays the **identity authority**. The response validator keeps checking
  references against `assembleEvidence` only; `sourceEvidence` adds no reference and
  can introduce no citation.
- Knowledge is excluded here exactly as it is in storage (`sourceClass !== "knowledge"`),
  so Knowledge keeps one evidence authority.
- Unresolved sources contribute nothing; their reason is already in the answer body.

### 4.3 The stale-state fix

`heby-turns.tsx:167` currently reads:

```
) : turn.historical ? (
  <HebyEvidenceNotRetained />
) : null}
```

A reloaded Heby turn is always `historical: true`. If it has G6D citations but no
Knowledge retrieval, it hits this branch and prints
*"Evidence details were not retained for this earlier response."* while durable
evidence sits unread in `heby_answer_source_evidence`. **That is the defect.**

→ Fixed condition: the notice renders only when the turn has **no** Knowledge
evidence **and no** source evidence **and no** reference list. A regression test
must assert that a turn carrying `sourceEvidence` never emits
`data-heby-evidence-not-retained`.

### 4.4 Retention after reload

Guaranteed by the existing durable rows — no new persistence. The historical framing
(`HistoricalNotice`, "as it stood at the time") extends to the source panel, because
G6D's `recordRef` deliberately has **no foreign key**: the cited record may have
changed or gone, and the panel must not imply otherwise. No live re-read, no link
into current Governance.

---

## 5. How conversation opens and closes

The reference states it plainly: *"Sohbet başlatmak için imlecinizi alt orta bölgeye
getirin"* — conversation is invited, not permanently mounted.

**Model: one surface, four canvas modes.** This is an extension of the existing pure
`resolveHebyComposition`, not a new state machine and not a new surface.

| Mode | Trigger | What is on screen |
|---|---|---|
| `field` | default, empty conversation | Presence dominant. Composer dock **collapsed** to a hint affordance at bottom-centre. Rail visible. |
| `inviting` | pointer enters the bottom-centre dock zone, **or** any keystroke, **or** `⌘K`/`/`, **or** the voice control | Composer rises into view. Presence unchanged. |
| `emerging` | first turn exists | Presence compacts upward; conversation layer fades in beneath it. (Existing `emerging` semantics.) |
| `conversation` | thread has depth | Conversation layer owns the room; presence collapses to the inline mark in chrome; canvas atmosphere recedes (existing `data-heby-mode` CSS). |

Closing:

- **Composer collapse** — pointer leaves the dock zone *and* the composer is empty
  *and* nothing is in flight *and* voice is not capturing. Never collapses with text
  in it, never mid-request, never while the microphone is open.
- **Conversation layer dismiss** — an explicit control, and `Escape` when nothing
  nearer claimed the key (same `defaultPrevented` handshake the Quick Panel already
  uses). **Dismiss hides the layer only.** It ends no conversation, deletes nothing,
  clears no durable history — identical to today's `onClose` semantics.
- **New conversation** — unchanged, still the existing `onNewConversation`.
- **Leaving the surface** — unchanged: the server-validated return target.

Accessibility, non-negotiable: hover is an *enhancement*, never the only path. Tab
into the dock reveals it; the reveal zone is a real focusable control with an
accessible name; `prefers-reduced-motion` flattens the reveal to an instant state
change. A pointerless device gets a persistently visible composer.

---

## 6. How "Hebun Akışı" receives only truthful data

**Finding: the rail as depicted in the reference has no read seam today.**

Audited what exists:

| Candidate | Verdict |
|---|---|
| `audit_log` via `readGovernanceActivityTallies` (R7.1) | **Aggregates only** — counts, latest timestamp, breakdowns by `action`/`result`/`authority_source`. **No per-event list exists.** Cannot produce "17:05 Governance onayı". |
| `readPendingActionRequests` (R3A.1) | **Real, tenant-scoped, per-item, timestamped.** Genuine feed material. |
| `readActionPermits` | Real, tenant-scoped, per-item. |
| Heby conversation messages | Real, tenant-scoped, timestamped — already loaded by this surface. |
| Knowledge ingestion events ("Yeni belge yüklendi") | **No event stream.** Knowledge reads expose records, not upload events. |
| "Heby analizini tamamladı", "Görev tamamlandı", "Yeni sinyal oluştu" | **No source of any kind.** No task runtime, no signal detector. |

**Rule for the rail, and it is absolute:** it renders items only from an
authoritative or explicitly-classified read the server already performs for this
surface. It performs no new read of its own, adds no server action, and adds no
schema.

Consequence, stated plainly: **at G7 the rail will be sparse or empty for a real
tenant.** That is the honest outcome and it is the correct one. An empty rail says
*"Hebun has recorded nothing to show you here yet"* — it does not say *"nothing
happened"*, and it never fabricates a row.

Proposed G7 content, in order of confidence:

1. **Pending authorization requests** — real, per-item, timestamped, already a
   product surface (`/approvals`). Each item links there.
2. **This conversation's own recorded answers** — real, timestamped, already in
   hand, and each one has evidence to open (which ties the rail to §4 rather than
   making it a second source of truth).

Deferred to a later gate, with a named reason:

3. **Recorded governance activity** — needs a per-event read that R7.1 deliberately
   did not build. Adding one is a Governance-side read seam, not a UI change, and
   belongs in its own gate. Until then the rail may show the R7.1 **tally** as a
   single non-event summary line, or nothing. *Director's call.*

Forbidden in the rail, enforced by test: any item whose text is not derived from a
value a read seam returned; any relative-time claim beyond the stored timestamp;
any status word (`active`, `online`, `running`, `syncing`, `scanning`); any count
that is not a count of rows actually read.

---

## 7. Reference elements that cannot yet be truthfully implemented

| In the reference | Why it cannot ship at G7 |
|---|---|
| "Yeni belge yüklendi — Q2 Finansal Rapor.pdf" | No Knowledge **ingestion event** stream exists. Records exist; upload events do not. |
| "Governance onayı — Tedarikçi Politikası onaylandı" | `audit_log` has no per-event read (R7.1 built tallies only). A ratification event cannot be listed. |
| "Heby analizini tamamladı — 3 kaynaktan bilgi kullanıldı ve özet çıkarıldı" | "Analysis" is not a thing Heby does. Model synthesis is **not activated**; a summary claim would be fabricated. Source counts alone are honest and belong on the answer, not the rail. |
| "Görev tamamlandı — Aylık Bütçe Hazırlığı" | No task runtime, no task records. |
| "Yeni sinyal oluştu — Satışlarda %12'lik artış eğilimi" | No signal detection, no trend computation, no percentage anywhere in the system. Pure fabrication. |
| The green/purple/amber event-type colour coding | Depends on a taxonomy no authority published. R7.1 settled this: `action` is rendered verbatim, never classified. |
| Live "activity" implied by the flowing particle floor | Ships as **explicitly decorative** with a zero data binding, matching the visualizer's existing contract. It must never read a value. |
| The top-right pulsing status dot | Would read as "connected"/"online". No such read seam exists. **Omitted.** |

Everything else in the reference — the dark spatial canvas, the central luminous
presence, the depth field, the amber/gold restraint, the minimal chrome, the
cursor-revealed conversation, the rail *frame* — is implementable now.

---

## 8. Exact files expected to change

### New (9)

```
src/components/layout/heby/heby-canvas.tsx
src/components/layout/heby/heby-field.tsx
src/components/layout/heby/heby-composer-dock.tsx
src/components/layout/heby/heby-conversation-layer.tsx
src/components/layout/heby/heby-source-evidence.tsx        ← G7 Evidence Surface
src/components/layout/heby/heby-stream-rail.tsx
src/features/heby-surface/canvas-mode.ts                   ← pure mode resolver
tests/g7-flow/canvas-render.ts
tests/g7-flow/evidence-surface-and-firewall.ts
```

### Modified — presentation (8)

```
src/app/globals.css                                        emerald → amber tokens, depth floor
src/components/layout/heby/heby-visualizer.tsx             restyle, six states unchanged
src/components/layout/heby/heby-turns.tsx                  restyle + sourceEvidence + not-retained fix
src/components/layout/heby/heby-composer.tsx               restyle + density: "canvas"
src/components/layout/heby/heby-evidence.tsx               restyle only
src/components/layout/heby/heby-voice-control.tsx          restyle only
src/components/layout/heby/heby-quick-panel.tsx            restyle only
src/components/layout/heby/heby-launcher.tsx               restyle only
```

### Modified — wiring (5)

```
src/components/layout/heby/heby-workspace-client.tsx       renders HebyCanvas
src/components/layout/heby/heby-thread.ts                  ThreadMessage/turn carry sourceEvidence
src/components/layout/heby/heby-surface-context.tsx        canvas sub-mode (no new surface)
src/features/heby-surface/composition.ts                   extended for canvas modes
src/features/heby-surface/index.ts                         re-export
```

### Modified — runtime, additive only (2)

```
src/features/heby-runtime/contracts.ts                     HebyRuntimeResponse.sourceEvidence?
src/features/heby-runtime/response-builder.ts              build it from the SAME grouper
```

### Modified — shared pure helper (1)

```
src/features/heby-conversation/answer-evidence.ts          extract the grouper used by
                                                           toStoredSourceEvidence so live and
                                                           stored views cannot disagree
```

### Deleted (1)

```
src/components/layout/heby/heby-workspace.tsx              replaced by heby-canvas.tsx
```

### Expected to go red and need updating (7 suites)

```
tests/hw1-flow/workspace-render.ts
tests/hw2-flow/presence-and-truth.ts
tests/hw3-flow/dual-surface-render.ts
tests/kr4-flow/surfaces-and-firewall.ts
tests/kr5-flow/boundaries-and-firewall.ts
tests/s1-flow/firewall-and-surfaces.ts
tests/voice-v1/voice-surfaces.ts
```

### Explicitly NOT touched

```
src/app/(dashboard)/heby/actions.ts        no new server action
src/app/(dashboard)/heby/page.tsx          context/authority/return unchanged
src/components/layout/heby/use-heby-conversation.ts
src/components/layout/heby/use-heby-voice-runtime* / heby-voice-runtime.tsx
src/components/layout/heby/heby-presence.ts
src/components/layout/heby/heby-provenance.ts
src/db/schema/**                           ZERO schema
src/db/migrations/**                       ZERO migrations
src/features/governance-grounding/**       G6C boundary untouched
```

**Migration count: zero.** No repository evidence was found that any G7 requirement
needs one — the durable evidence G6D wrote is already loaded and already crosses to
the client; it is dropped in three type declarations, not missing from the database.

---

## Director decisions requested before implementation

1. **Quick Panel** — restyle and keep (recommended), or collapse Heby to one surface
   (a separate gate)?
2. **Hebun Akışı at G7** — pending authorizations + this conversation's answers only,
   or also the R7.1 governance **tally** as a single non-event summary line?
3. **Amber/gold vs emerald** — the reference is amber. Confirm the token swap is
   global to the Heby surface only, and that the product's emerald `--color-primary`
   elsewhere in the shell stays as it is.
