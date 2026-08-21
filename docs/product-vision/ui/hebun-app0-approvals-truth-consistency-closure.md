# APP-0 — /approvals stops denying the decision act it offers (closure)

**Released 2026-08-21 · tag `hebun-app0-approvals-truth-consistent` · implementation `81defbc`**
**Classification: A — APPROVALS TRUTH CONSISTENT / AUTHORITY UNCHANGED**

Entry state: `main` at `4a701a5`, `HEAD == origin/main`, 0 ahead / 0 behind, 426/426, CMD-0 tag
`hebun-cmd0-seeded-goals-contained` peeling to `70ee17d`.

A narrow truth repair on the Decisions surface, taken before CMD-B1 so that the authority Command
is about to summarize does not contradict itself. Two presentation files. No writer, no resolver,
no read seam, no Governance change, no tenant-boundary change, no schema, no migration, no row, no
navigation, no Command change.

---

## 1. The contradiction, as seen authenticated

On the authenticated real product, tenant `acme`, `/approvals` rendered both of these — three
regions and a few hundred pixels apart:

```
CONSEQUENTIAL ACTION AUTHORIZATION
Actions Awaiting Authorization                                     0 PENDING
No action is waiting for authorization
ISSUED PERMITS — None issued. A permit exists only once a Governance decision authorized one.

...

RECORDING A DECISION
Decision Act                                                   NOT CONNECTED
Decision recording is not connected yet
No approve, reject, or authorize action is offered here.
```

Both cannot be true. The first is R3A/R3B: consequential requests read from the durable store, with
real Approve, Refuse and Revoke affordances behind a server-resolved Governance authority, and
execution as a separate second click.

## 2. Root cause: static copy

Not a stale literal, not a stale model value, not disconnected contract vocabulary.
`DecisionActAndHistory()` took **no arguments and read no model** — the denial was hard-coded JSX.

The deeper cause is one sentence in `decision-workspace.tsx`'s own R3A header:

> *"Every OTHER region is unchanged and still an honest, explained empty state — no persisted
> briefing, evidence, recommendation, consequence or history source became connected…"*

That enumeration was written about **sources**, and it holds for all five it names. It silently
excluded the **decision act** — because R3A *is* the act. The act region was never in the
"unchanged" set, and nobody went back for it. The header now records that correction.

## 3. Why the region was removed rather than rewritten

Every condition the stale copy named as missing is met by `ActionAuthorizations`, on the same page:

| the copy promised, "when connected" | `ActionAuthorizations` today |
|---|---|
| a real, server-authorized path | `approveActionRequest`, server-only |
| verifying the Director's identity | `tenant.userId` from the session |
| checking the governance requirement | `resolveGovernanceAuthority`, refusing `no-governance-authority` / `not-the-governance-authority` |
| writing an accountable record | `status='approved'`, `approvalDecisionId`, `approvedAt`, `approvedByActorType/Id`, plus a permit carrying `governanceDecisionId` and `authorizedByActorId` |
| restating the exact decision, scope and target | `expectedEffect`, tool, target, typed parameters |
| consequences before confirmation | rendered before any control, never collapsed |
| execution as a separate step | a permit is issued; spending it is a second human click |

So the section owned **no unique responsibility**. Its only remaining content was a promise about a
future that had arrived, rendered next to the arrival, denying it. Rewording it would have produced
a second decision surface describing the first. It is deleted; no replacement component was created.

## 4. Decision History: corrected in the other direction

History survives, because a different fact is still genuinely absent — but its wording had become
false the opposite way. It said *"No decision record is connected"*, and records now exist.

What does not exist is a **chronological read** over them: `readPendingActionRequests` filters to
`status = 'pending'`, and no seam presents decided requests. The records exist; the account of them
does not.

| | before | after |
|---|---|---|
| marker | `None recorded` | `Not surfaced here` |
| title | "No decisions have been recorded" | "Past decisions are not listed on this surface" |
| detail | "No decision record is connected, so none is shown" | "Authorizing, refusing or revoking above writes an accountable record… What is not connected here is a chronological read over those records" |

## 5. Authenticated acceptance

Production build served by `next start`, real shell, live session on tenant `acme`. Re-verified at
release on the released tree.

| check | 1440×900 | 390×844 |
|---|---|---|
| authenticated (no `/login` redirect) | ✔ | ✔ |
| `Actions Awaiting Authorization` renders the **connected** read state | ✔ | ✔ |
| badge **`0 PENDING`** | ✔ | ✔ |
| badge "Not connected" | absent | absent |
| "No action is waiting for authorization" | ✔ | ✔ |
| `Decision Act` section | **absent** | **absent** |
| "Decision recording is not connected yet" | **absent** | **absent** |
| "No approve, reject, or authorize action is offered here" | **absent** | **absent** |
| Decision History truthful wording + `NOT SURFACED HERE` | ✔ | ✔ |
| Decision History old wording | absent | absent |
| authority implication ("you may approve" …) | none | none |
| mutation controls rendered | **0 buttons** | **0 buttons** |
| horizontal overflow | 0 | 0 |
| clipped text | 0 | 0 |
| sub-floor text | 96 (was 99; none added) | 96 |
| sections | 11 (was 12) | 11 |
| document height | 3361 (was 3490) | 6021 (was 6304) |
| shell rail + header | intact | intact |

## 6. `0 PENDING` is a successful empty read

The badge is `connected ? "${requests.length} pending" : "Not connected"`, and `connected` means
**both durable reads answered** — not that rows exist. Tenant `acme` holds 0 pending requests and 0
permits, so a successful read of an empty queue renders `0 PENDING` beside "No action is waiting for
authorization", a fact about the tenant.

**Unavailable is not empty.** When no tenant resolves or persistence is unconfigured, the same
region renders "Not connected" and "Authorization persistence is not configured" — never a count,
never "nothing is waiting". Both renderings were exercised and asserted `notEqual`.

## 7. The distinctions this surface must keep

- **Read permission is not Governance approval authority.** `readPendingActionRequests` takes a
  tenant and resolves no authority; `approveActionRequest` and `rejectActionRequest` additionally
  resolve Governance and refuse without it. Asserted against the **function bodies**, because a
  module-wide search would match the import line and could never fail.
- **A permit is not an execution.** `derivePermitState` knows `active`, `expired`, `consumed`,
  `revoked` and nothing about outcomes; `expired` exists nowhere in the database.
- **An execution is not a success.** Acceptance is the strongest claim available and is stated as
  acceptance: *"Accepted is not delivered. Hebun has no delivery confirmation."*

## 8. Tests

**427 passed, 0 failed, 427 total** (426 → 427, the new suite), with no K2 flake. Typecheck clean ·
lint 0 errors (14 pre-existing warnings) · build clean · `git diff --check` clean · secret scan
clean.

The suite is **render-based where it matters**. A banned-substring sweep over the component tree
would fire on honest prose — this surface is *supposed* to say "not connected" about evidence,
recommendations and briefings, none of which became connected. So the regions are rendered with
`renderToStaticMarkup`, tags are stripped, and the assertions read the visible sentence.

## 9. Bite-proofs

Eight mutations applied to **real production source** and the suite re-run in a fresh process:

| mutation | result |
|---|---|
| restore the exact stale copy into a surface file | RED — "a rendered region still says 'Decision recording is not connected yet'" |
| re-add the act denial in a new component file | RED — "stale-probe.tsx declares 'No approve, reject, or authorize action…'" |
| route stops resolving the tenant | RED — "the route resolves the tenant" |
| `connected` redefined as "rows exist" instead of "both reads answered" | RED — "connected still means both reads answered" |
| acceptance described as delivery | RED — "acceptance is stated as acceptance, never as delivery" |
| re-compose the deleted act region | RED — "the act-and-history region is no longer composed" |
| Governance resolver imported into presentation | RED — "must not contain /resolveGovernanceAuthority/" |
| Command model imported into the Decisions surface | RED — "must not import a Command model or surface" |

Every mutation asserted it applied before counting; all touched files restored **byte-identical**,
verified by `shasum -c`.

## 10. What this release did not touch

Schema **0** · migration **0** (ledger 32 files, digest `a54ab468e15c816f`) · rows **0**
(`heby_action_requests` 0, `action_permits` 0, `action_execution_attempts` 0, `decision_records` 8,
unchanged) · new writer **0** (`"use server"` modules still 9) · new resolver **0** · new read seam
**0** · Governance **0** · tenant boundary **0** · navigation **0** · Command **0**.

`readPendingActionRequests`, `readActionPermits`, `approveActionRequest`, `rejectActionRequest`,
`revokeActionPermit`, `consumeActionPermit`, `resolveGovernanceAuthority`, every tenant predicate,
the human-click boundary and permit semantics: all untouched, all green. **No mutation executed** —
zero buttons render on an empty queue, and no approval, refusal, revocation or consumption occurred.

A presentation repair did not become an authority repair.

## 11. Remaining approvals truth debt

Confirmed still present on this surface, authenticated, and deliberately **not** fixed:

1. **`decision-state-strip.tsx` — "DECISION QUEUE ● No source connected"**, rendered directly above
   a connected queue.
2. **`pending-decisions.tsx` — "No decision-request source is connected to this surface."**
3. **`features/decisions/workspace-model.ts` — `decisionRecordingConnected: false` hard-coded**, with
   `pendingDecisions: readonly never[]`. A stale literal of the class R3B repaired twice elsewhere,
   and the reason CMD-A rejected "Command consumes the `/approvals` workspace model".

These three are one coherent follow-up gate.

**Typography and document-height debt is explicitly separate**: 96 sub-floor text elements (down to
8.8px in `authority-chain.tsx`), 6021px document height at 390, seven section `h2` at 12.8px, and an
`<h2>` carrying a full sentence as the boundary region's title. None of it is a truth defect and
none of it belongs to this gate.

## 12. CMD-B1

**Technically ready.** The authority CMD-B1 will summarize no longer denies itself; its read seam,
tenant predicate, Governance boundary and permit/execution semantics are untouched and re-proved.

**But the destination surface still carries the three truth defects above.** A Director who follows
Command's link to `/approvals` will still meet "No source connected" in the state strip above a
connected queue. Command can be built on this authority; a reader arriving at it will still be told
something false until that follow-up gate runs.
