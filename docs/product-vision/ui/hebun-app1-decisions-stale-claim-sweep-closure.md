# APP-1 — the Decisions surface stops denying the queue it renders (closure)

**Released 2026-08-21 · tag `hebun-app1-decisions-truth-consistent` · implementation `3e77310`**
**Classification: A — DECISIONS SURFACE TRUTH CONSISTENT / NO DUPLICATE AUTHORITY**

Entry state: `main` at `1d7c43e`, `HEAD == origin/main`, 0 ahead / 0 behind, 427/427, APP-0 tag
`hebun-app0-approvals-truth-consistent` peeling to `2ef044d`.

The second and final truth-consistency pass over `/approvals`, taken before CMD-B1. Three
presentation/model files. No writer, no resolver, no read seam, no Governance change, no
tenant-boundary change, no schema, no migration, no row, no navigation, no Command change.

---

## 1. The three reproduced stale claims

Each traced to its owner, reproduced in source **and** on the authenticated surface:

| # | claim | owner | kind | authenticated |
|---|---|---|---|---|
| 1 | "DECISION QUEUE ● No source connected" | `decision-state-strip.tsx` | **static copy** — the component takes no props and performs no read | **visible** |
| 2 | "No decision-request source is connected to this surface." | `pending-decisions.tsx` | **static copy** — its only prop is `kinds`, vocabulary | **visible** |
| 3 | `decisionRecordingConnected: false` | `features/decisions/workspace-model.ts` | **stale literal, and dead** | **not visible** |

Correction to the entering brief on #3, recorded rather than glossed: it is a hard-coded literal
with **zero consumers**. `model.decisionRecordingConnected` and `model.pendingDecisions` are read by
no component, and neither appears in the authenticated DOM. It was never a visible contradiction —
it is dead code that documents a false claim.

All three coexisted with a real connected seam: `readPendingActionRequests`, `readActionPermits`,
`approveActionRequest`, `rejectActionRequest`, `revokeActionPermit`, `consumeActionPermit`.

## 2. Decision-model ownership audit

Every field of `features/decisions/workspace-model.ts`, counted against real consumers:

| field | consumers |
|---|---|
| `preparationKinds` | 1 (`PendingDecisions`) |
| `authorityChain` | 2 |
| `inspectorLenses` | 5 |
| `decisionStates` | **0** |
| `history` | **0** |
| `pendingDecisions` | **0** |
| `decisionRecordingConnected` | **0** |

Findings:

- **`decisionRecordingConnected` represents no live capability.** Dead.
- **`pendingDecisions` is not the durable requests.** It is a permanently empty array standing beside
  a real queue the route reads — a shadow of the same concept, owned by nobody.
- **Two routes legitimately depend on the model**, but only for the three vocabulary lists.
- **The model is vocabulary-only**, and that is a genuine responsibility: the Heby Phase 6 contract.
- **Connecting it to action-authorization would duplicate authority.** Rejected.
- **Deleting the model would break a released pin.**
  `director-truth-surface/verification-badges-stay-unreachable.ts` asserts that `/approvals` still
  imports it and that the model keeps recording *why* it refuses the legacy mock projection. Both
  preserved.

## 3. Two fields retired as dead shadow state

`decisionRecordingConnected` and `pendingDecisions` are removed from the interface and the builder.
They denied a connected seam, were read by nothing, and are the exact shape R3B has already had to
repair twice elsewhere. The model's header now records that it carries **no connection flag at all**,
because a boolean here could only ever be a second opinion about a seam it does not read.

`decisionStates` and `history` remain declared with zero consumers. They are outside this gate's
named scope and are recorded here rather than swept in; `history`'s comment was corrected in passing
to "no chronological history READ is connected", matching APP-0's released wording.

## 4. No second reader was introduced

The seam is read **once per surface**, by the route that owns it. Repo-wide, exactly three files
reference `readPendingActionRequests` / `readActionPermits`:

```
src/app/(dashboard)/approvals/page.tsx
src/app/(dashboard)/heby/page.tsx
src/features/action-authorization/read-action-authorizations.server.ts   (defines them)
```

That set is pinned by the suite. No second repository, no second connection flag, no duplicated
queue model.

## 5. The strip's claim was removed, not inverted

`DecisionStateStrip` takes no props and performs no read. Any connection claim it made would be an
unverifiable second source of truth about the queue, and the next phase to connect something would
leave it stale — which is precisely how R3A left it stale. So the "Decision queue · No source
connected" pair is **deleted**, and the strip keeps what it actually owns: the two admissible facts
from the real Heby contract ("pending at the Director"; "a decision is recorded only by a human
act") and its Structural view marker.

**The region that performs the read is the region that reports it.**

## 6. Pending Decisions was narrowed, not deleted

This region is about a genuinely different class — material prepared for a human review or approval
process — and that class still has no source. The sentence now says which is which:

> *"A pending decision is grounded material prepared for a human process — it states its
> consequences and always awaits the Director. **Consequential action requests ARE connected and
> appear above, under Actions Awaiting Authorization; what has no source here is prepared review and
> approval material**, and none is fabricated…"*

## 7. Authenticated acceptance

Production build served by `next start`, real shell, live session, tenant `acme`. Re-verified at
release on the released tree.

| check | 1440×900 | 390×844 |
|---|---|---|
| authenticated | ✔ | ✔ |
| all four stale sentences | **0 found** | **0 found** |
| `Actions Awaiting Authorization` connected read state | ✔ | ✔ |
| badge `0 PENDING` | ✔ | ✔ |
| badge "Not connected" | absent | absent |
| narrowed prepared-review wording, both classes named | ✔ | ✔ |
| duplicate queue | none — two regions, two different classes | same |
| authority implication | none | none |
| mutation controls | **0 buttons** | **0 buttons** |
| horizontal overflow | 0 | 0 |
| clipped text | 0 | 0 |
| sections | 11 | 11 |
| sub-floor text | 95 (was 96) | 95 |
| document height | 3361 (unchanged) | **6044 (was 6021, +23px)** |
| shell rail + header | intact | intact |

Recorded honestly: mobile document height grew **23px** because the narrowed sentence is longer and
wraps one more line. Not overflow, not clipping — the cost of saying more precisely what is true.

## 8–12. The distinctions this surface keeps

- **`0 PENDING` is a successful empty read.** `connected` means *both durable reads answered*, not
  that rows exist. Tenant `acme` holds 0 pending requests, so a successful read of an empty queue
  renders `0 PENDING` beside "No action is waiting for authorization" — a fact about the tenant.
- **Empty is not unavailable.** With no tenant or unconfigured persistence the same region renders
  "Not connected" and "Authorization persistence is not configured" — never a count, never "nothing
  is waiting".
- **Read permission is not Governance approval authority.** The reader takes a tenant and resolves no
  authority; `approveActionRequest` and `rejectActionRequest` additionally resolve Governance and
  refuse `not-the-governance-authority`. Asserted against the **function bodies**, because a
  module-wide search would match the import line and could never fail.
- **A permit is not an execution.** "A permit exists only once a Governance decision authorized one."
- **An execution is not a success.** "Accepted is not delivered. Hebun has no delivery confirmation."

## 13. Tests

**428 passed, 0 failed, 428 total** on the released tree (427 → 428, the new suite), with **no K2
flake**.

An earlier run on the same tree showed 427/1, the failure being the known
`tests/k2-flow/create-and-read-postgres.ts` concurrency flake (`['created','unavailable']` vs
`['created','duplicate']`). The established exception protocol was applied: reproduced standalone
once — **passes** — and K2 reaches nothing APP-1 touched (zero references to `decision-workspace`,
`features/decisions`, or either component). Recorded, not chased.

Typecheck clean · lint 0 errors (14 pre-existing warnings) · build clean · `git diff --check` clean ·
secret scan clean.

**On instrument choice.** APP-0's guards render their regions. These two **cannot** be rendered in a
bare Node harness — both reach `next/link` or the client Heby affordance, and `renderToStaticMarkup`
throws on missing routing context. So they are asserted at source **with comments stripped**, the
instrument the released `director-truth-surface` suite already uses on this exact directory, for the
reason it gives: these files discuss at length the sentences they no longer render, and a guard that
tripped on that prose would punish the documentation that makes the repair legible.

## 14. Nine production-source bite-proofs

Each applied to real source, suite re-run in a fresh process, **all RED**, all four touched files
restored byte-identical (`shasum -c`):

| mutation | result |
|---|---|
| restore "No source connected" in the state strip | RED |
| restore "No decision-request source is connected to this surface" | RED |
| drop the narrowed sentence entirely | RED |
| re-declare `decisionRecordingConnected` | RED |
| re-declare `pendingDecisions` | RED |
| **smuggle the flag back as `queueConnected: false`** | RED |
| import a second seam reader into the legacy model | RED |
| describe a permit as delivered | RED |
| imply read permission is approval permission | RED |
| import Command into the Decisions model | RED |

Two defects in the harness itself, found by the audit rather than by luck and recorded in the suite:

- The narrowed-sentence assertions read `read(PENDING)` instead of the override, so the
  "drop the sentence" proof could never reach them — an assertion that could not fail.
- The second-reader mutation appended a **comment**, which `codeOf` strips, so it proved nothing
  while the guard worked correctly. A second reader is a second import, not a second mention.

## 15. What this release did not touch

Schema **0** · migration **0** (ledger 32 files, digest `a54ab468e15c816f`) · rows **0**
(`heby_action_requests` 0, `action_permits` 0, `action_execution_attempts` 0, `decision_records` 8,
unchanged) · new writer **0** (`"use server"` modules still 9) · new resolver **0** · new read seam
**0** · duplicate reader **0** · Governance **0** · tenant boundary **0** · navigation **0** ·
Command **0**.

`action-authorization`, `action-execution` and `governance-decision` show **zero changed files**.
**No mutation executed** — zero buttons render on an empty queue, and no approval, refusal,
revocation or consumption occurred.

## 16. Remaining visual debt — explicitly separate

95 sub-floor text elements (down to 8.8px in `authority-chain.tsx`), 6044px document height at 390,
seven section `h2` at 12.8px, and an `<h2>` carrying a full sentence as the boundary region's title.
None of it is a truth defect and none of it belongs to this gate.

## 17. CMD-B1 entry condition

**Satisfied.** The destination surface no longer denies its own connected queue in any of the three
places, the read seam is untouched with exactly one reader per surface, and the
empty / unavailable / count grammar is pinned by two suites. A Director following Command's link now
arrives at a page that agrees with itself.
