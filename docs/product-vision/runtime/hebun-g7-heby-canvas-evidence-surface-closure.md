# Hebun G7 — Heby Spatial Canvas + Evidence Surface — Closure

**Classification: B — EVIDENCE VISIBLE / MODEL SYNTHESIS UNAVAILABLE.**

Baseline entering the phase: HEAD `eeb8f48`, 418/418, canonical `hebun_r1` at 58 tables / 32
applied migrations, provider `claude` `director_enabled = false`, `heby_answer_source_evidence`
present and populated by G6D.

**Released at 420/420. Zero schema, zero migration, zero dependency, zero new authority, zero
writer, zero provider activation, zero global design token change.**

---

## The claim, and the four things it is not

> **"A Heby answer's non-Knowledge sources are visually inspectable on Heby's own spatial canvas.
> An authoritative organizational record is distinguishable in words from a derived read model, and
> what a reader sees after a reload is the same value they saw live — because it is one projection,
> not two."**

The subject is *what Hebun already recorded, made visible*. **This phase created no organizational
truth and no authority.**

- It is not a new **fact**. Every record shown was written by the authority that owns it — G6A's
  genesis decision, G6C's read boundary, G6D's durable citation. G7 wrote none of them.
- It is not a new **authority**. `authoritative` names who owns a record. It is not a claim that
  the record is correct, current, or agreed with by anything else. K4 settled the deeper form:
  ratified is not true.
- It is not **activity**. The rail shows the decisions Hebun is holding for a human. It is silent
  about what the organization did, because Hebun cannot know that.
- It is not **synthesis**. Provider connectivity is disabled by the Director. Every answer in the
  acceptance pass is `Provider disabled by Director — answered deterministically`.

---

## 1. Commits

| | |
|---|---|
| Implementation | `feat: give Heby a spatial canvas and make its source evidence inspectable` |
| Closure (tagged) | `docs: record Heby canvas and evidence surface closure` |
| Learnings | `docs: record G7 learnings` |
| Tag | `hebun-g7-heby-canvas-evidence-surface` (annotated) |

Exact hashes are recorded in the release report handed to the Director; this file is written before
the commits exist and deliberately does not restate them.

---

## 2. Files changed

### Modified — 16 tracked files, +842 / −134

| File | Δ | What changed |
|---|---|---|
| `components/layout/heby/heby-workspace.tsx` | +287/−84 | The spatial canvas: three ambient layers, presence field, emerging composer dock, dismissible rail column, reworked hero hierarchy. |
| `app/globals.css` | +136/−16 | Heby's accent emerald → amber inside the scope that was already Heby's; aurora, horizon and floor tokens and rules. |
| `components/layout/heby/heby-quick-panel.tsx` | +82/−11 | Collapse/expand to a 4.25rem strip. Stays mounted. |
| `components/layout/heby/heby-turns.tsx` | +65/−5 | Evidence chain → three independent decisions; source-evidence disclosure; stale-state fix. |
| `features/heby-runtime/contracts.ts` | +52/−0 | `HebySourceEvidenceItem` / `Group`; `HebyRuntimeResponse.sourceEvidence?`. |
| `features/heby-conversation/answer-evidence.ts` | +50/−2 | `toResponseSourceEvidence`; `fromStoredSourceEvidence` widened to the row-input shape. |
| `components/layout/heby/heby-visualizer.tsx` | +35/−1 | Hero size bound to viewport height. No other change: states, captions, point field and motion contract untouched. |
| `components/layout/heby/heby-thread.ts` | +31/−1 | `ThreadMessage.sourceEvidence` declared and carried onto the turn. |
| `app/(dashboard)/heby/page.tsx` | +28/−0 | `readStream()` — one server read, R3A's own. |
| `features/heby-answer/model-answer.server.ts` | +25/−5 | Step 8b: attach the live citations from the same resolutions persistence is given. |
| `components/layout/heby/heby-composer.tsx` | +14/−2 | The row wraps and the field declares a real basis, so a narrow viewport no longer crushes it. |
| `components/layout/heby/heby-workspace-client.tsx` | +13/−1 | Passes the server-read stream through. |
| `features/heby-surface/index.ts` | +1/−0 | Re-export. |
| `tests/hw3-flow/dual-surface-render.ts` | +4/−3 | Hero-invitation copy pin restated. |
| `tests/hw2-flow/presence-and-truth.ts` | +3/−2 | Same. |
| `tests/h1c-flow/render.ts` | +2/−1 | Same. |
| `learnings.md` | +14/−0 | Phase learnings (separate commit). |

### New — 7 source/test files + 3 documents

```
src/components/layout/heby/heby-source-evidence.tsx    176   the G7 Evidence Surface
src/components/layout/heby/heby-stream-rail.tsx        116   Hebun Akışı
src/features/heby-stream/activity-stream.ts            119   the rail's pure projection
src/features/heby-stream/index.ts                        9
src/features/heby-surface/canvas-mode.ts                59   the pure dock rule
tests/g7-flow/evidence-surface.ts                      397
tests/g7-flow/canvas-and-firewall.ts                   627
docs/…/hebun-g7-heby-ui-migration-plan.md              444   the approved UI architecture gate
docs/…/hebun-g7-heby-canvas-pre-release.md             425   pre-release report + visual addendum
docs/…/hebun-g7-heby-canvas-evidence-surface-closure.md       this file
```

### Deleted — none. Schema — none. Migrations — none. Dependencies — none.

### Three released test suites were edited, and only in one respect

`h1c-flow`, `hw2-flow` and `hw3-flow` pinned the literal string `"How can I help?"`. The
**invariant** they protect is unchanged and still asserted: the hero carries an invitation, it is
gone once a conversation exists, and it never appears in the Quick Panel. Only the sentence moved,
to `"The field below is ready when you are."` on the composer dock. Each edit carries a comment
saying so. **No other released assertion was touched, and nine suites that pin
`heby-workspace.tsx` by path or symbol now guard the new composition unedited** — which is why the
file was replaced in place rather than renamed.

---

## 3. Final visual decisions, as approved

- **Acceptance was performed on the authenticated real `/heby` route**, in a real Chrome, on a
  session the Director signed in themselves. No credential was entered by the agent. An isolated
  component render was explicitly not accepted as proof, and three sizing defects and one mobile
  defect were found only because of that.
- **Desktop-first spatial Heby canvas — approved.**
- **Amber/gold applies only to the Heby surface.** The product's palette lives in
  `src/styles/tokens.css` under `:root` and is a different colour entirely; the emerald that was
  replaced was already declared inside `.heby-surface`. Nothing global was in reach.
- **The central presence uses viewport-height constrained sizing** — `min(30rem, 32dvh)`. Two
  width-based attempts were measured against the real product and both cropped it. A fraction of
  the height that exists makes "as large as the room allows" and "never larger than the room" the
  same statement.
- **Atmospheric depth is static presentation, not simulated activity.** Three layers — aurora,
  horizon, floor — all `aria-hidden`, all pointer-transparent, none taking a prop, and the block
  contains no state, clock or randomness. Asserted per layer.
- **Hebun Akışı renders only legitimate connected event-like data and may honestly be empty.** It
  carries pending authorization requests, read through R3A's own tenant-scoped reader. Four of the
  five entry types in the design reference have no read seam at all; the fifth exists only as a
  tally, which is not an event and was not used. The projection has no branch that can emit an item
  without a row behind it. It is dismissible, and dismissing is a width — it reads nothing, marks
  nothing, and there is no acknowledge act near the control.
- **The Quick Panel remains secondary and collapsible.** Collapsing is not closing: the component
  stays mounted, so the session and the voice claim survive.
- **Governance authoritative evidence is visible live and after reload**, with identical records
  and identical standings.
- **Derived evidence remains visually distinct** — a grey hairline and the words *derived read
  model*, against an amber hairline and *authoritative organizational record*. The words carry it;
  colour alone never does.
- **Knowledge evidence behaviour remains intact.** KR4/KR5 suites are green and untouched;
  Knowledge keeps its own evidence authority and its own panel, and is excluded from the source
  view by construction and by a CHECK constraint.
- **The mobile composer wrapping fix is included.**
- **Live Map is not part of G7.**
- **Provider/model synthesis is not part of G7.**

---

## 4. Evidence live / reload parity

### Two defects, and where they actually were

1. **Reload.** G6D's citations reached the browser and died at a **type declaration** —
   `ThreadMessage` did not declare `sourceEvidence`, so `buildTurns` dropped it and the turn fell
   through to *"Evidence details were not retained for this earlier response."* Fix: three
   declarations. No server change.
2. **Live.** `HebyEvidenceReference` carries `{ sourceClass, recordRef, lifecycle }` only, so the
   live answer showed **less than its own reload**. Fix: an additive
   `HebyRuntimeResponse.sourceEvidence`, attached from the same `resolutions` array persistence is
   given, in the same function, on the same turn.

### Parity is structural, not tested-for

```ts
export function toResponseSourceEvidence(resolutions) {
  return fromStoredSourceEvidence(toStoredSourceEvidence(resolutions));
}
```

Two views cannot drift when they are one composition. A divergence would require editing one of the
two projections, which changes both views at once.

### Proved on the authenticated product

One answer on `/heby?from=operations`, live then reloaded:

| | Live | After reload |
|---|---|---|
| Disclosure | `Sources (8)` | `Recorded sources (8)` |
| Historical frame | absent | present |
| Groups | `operations:derived` (6), `governance:authoritative` (2) | **identical** |
| `data-heby-evidence-not-retained` | absent | **absent** |

The two authoritative records shown are the tenant's real ones: `Governance authority — established
2026-08-13T19:48:48.654Z · 1 active holder · you do not hold it` and `Genesis governance session —
certify / tenant · outcome authority-established · actor type human · bootstrap true`.

---

## 5. Writer / provider firewall state

| Check | Result |
|---|---|
| Governance writer reachability from Heby | **0.** No Heby file imports a Governance writer. The four textual matches are the word "ratification" in prose and in a rendered Knowledge chip. `tests/g6c-flow/authority-reachability.ts` walks the real import graph and passes. |
| Provider-control writers in `src` | **0.** R5.1 removed the capability; the only writer is `npm run provider:connectivity`. |
| Provider / model state | `provider_connectivity_controls`: one row, `claude`, `director_enabled = false`, `version = 30` — **unchanged by G7**. No external-send arming row exists. |
| Computer Use / execution connection | **none added.** The only matches in the change set are pre-existing R2C code in `model-answer.server.ts` (no added line contains them) and G7's own ban list. |
| Writers in G7's own files | **0** — `.insert(`, `.update(`, `.delete(`, `transaction(`, `executeAuthorizedAction`, `establishGovernanceAuthority`, `persistExchange`, `recordActionRequest`, `approveActionRequest` have no representation in any file G7 introduced or rewrote. |
| Model boundary in G7's own files | **0** — `generateHebyModelAnswer`, `selectModelTransport`, `claude-model-client`, `heby-model`, `anthropic`. |
| Schema / migrations | 32 journal entries, 32 `.sql` files, 0 changed paths under `src/db`. |
| Secret scan | clean across every G7 file. No `.env` is tracked or in the change set. |
| `git diff --check` | clean. |

### What the acceptance pass wrote

The authenticated pass ran against the **canonical development database**, not production
(production is the Neon deployment). It produced 12 message rows — six ordinary Heby exchanges —
and their citations. `decision_records = 8`, `companies = 2`, `users = 3`, `audit_log = 17`:
**unchanged**. No authority, no organizational record and no audit entry was created.

---

## 6. Test results

```
lint       0 errors, 14 warnings (all pre-existing, none in a G7 file)
typecheck  clean
tests      420 passed, 0 failed, 420 total
build      ✓ compiled, /heby renders
```

Baseline 418 → 420 (two new G7 suites).

### Bite-proofs — six, each applied, verified applied, observed to fail, restored

| Mutation | Assertion that fired |
|---|---|
| Reinstate the G6D drop in `heby-thread.ts` | `a reloaded turn keeps its recorded citations` |
| Restore the old `turn.historical && !turn.knowledgeEvidence` condition | `a reloaded answer with recorded citations never claims they were not retained` |
| Replace the composition with a parallel `toResponseSourceEvidence` | `the live view and the reloaded view are the same value` |
| Add `db.insert(...)` to the rail component | `must have no representation for ".insert("` |
| Fabricate the reference image's document-upload row for an empty queue | `no rows, no items — there is no default entry` |
| Delete the dock hint / weaken the dock rule to `hasDraft` only | both failed |

### One flake, proved pre-existing by measurement

`tests/k2-flow/create-and-read-postgres.ts` — `exactly one creation won`, a Knowledge concurrency
race. It imports `model-answer.server.ts`, so inspection was not enough. Measured 12 runs each:
**7/12 failing with G7's three shared files reverted to `eeb8f48`, 4/12 with G7**. Same assertion,
less frequent with G7. Matches the rate documented at G6D. Not caused, not fixed, not masked. It
appeared once during the release re-proof and passed on the immediate re-run.

---

## 7. Remaining limitations

1. **On a 900px viewport the presence is 288px — the same as before G7.** 32dvh is the measured
   ceiling that keeps the caption, framing line, chips and composer on screen inside the shell. The
   presence reads considerably larger because most of its scale is now the atmospheric field, which
   has no such budget. Growing the geometry further means removing something else from the canvas.
2. **A long evidence panel scrolls.** With eight cited records the transcript region cannot show
   both groups at once on a 900px viewport.
3. **The rail is empty on Tenant Zero** — zero pending requests. The endorsed outcome.
4. **The rail is not rendered below `lg`.** Every record it points at stays reachable at
   `/approvals` through the shell's own navigation.
5. **No per-event governance read exists.** R7.1 built tallies over `audit_log` and no per-event
   reader, so the rail cannot show a ratification, an authority change or any recorded act. That is
   a Governance-side read seam, not a UI change.
6. **Four of the design reference's five rail entries remain unimplementable** — no ingestion event
   stream, no task runtime, no signal detection.
7. **Ambient layers are static by choice.** Ambient motion was permitted; it was not taken, because
   a moving field beneath Heby is the shortest path to implying activity that does not exist.
8. **Only the deterministic path was exercised.** Provider connectivity is disabled by the
   Director. The evidence path is identical either way.
9. **The Quick Panel's collapsed state is not persisted.** Re-opening starts expanded.
10. **Acceptance screenshots were reviewed in-session and are not committed.** The repository has
    no tracked image precedent and the six PNGs are ~12MB; they are held outside the tree.

---

## 8. What the next phase inherits

- A Heby surface whose presentation is its own, and whose colour, size and depth are all bounded by
  something real rather than by a breakpoint.
- An evidence surface that cannot show a citation the answer did not make, and cannot show a
  different one after a reload.
- A contextual rail with exactly one legitimate feed and a projection that cannot be given a second
  one without a row behind it.
- The same runtime, the same authorities, the same firewalls, and the same disarmed provider.

Nothing here is a step toward synthesis, execution, or Live Map. None of those moved.
