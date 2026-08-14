# HEBUN — ONBOARDING CAPABILITY HUMAN-HANDOFF CUSTODY — CLOSURE RECORD

Date: 2026-08-14. Baseline: `940e4e3` (`main`, `0/0` with `origin/main`, tags
`hebun-public-onboarding-entry-surface-complete` and `hebun-invitation-revocation-complete`
published).

Gate A for this phase is PART SIXTEEN of the ceremony record, which classified the incident
**B — UI bug, existing runtime correct, narrow frontend fix required**. That classification held.

---

## 1. The real incident

Two onboarding capabilities were issued for `senoltr@gmail.com` and neither reached the human.

| | | |
|---|---|---|
| First C3 | `9e3af81e…` issued 11:22:19 | shown, but closed before it was saved → later revoked 15:27:00 |
| Second C3 | `16eaa349…` issued 15:33:25 | **never visibly rendered at all** |

The second is the one that proved this was not user error. The Director pressed *Issue onboarding
capability* exactly once, the screen "went and came back", and no plaintext was ever displayed.

Durable state was correct both times. Authorization `bbcf87fa…` is `consumed`, invitation
`16eaa349…` is `pending` with a correct 72-hour window, exactly one
`onboarding.invitation.issued` audit row carrying no secret, and zero enrollments, users,
identities, credentials or memberships for the address.

**C3 durable execution: successful. Human handoff: failed.**

---

## 2. Root cause

Issuance marks its authorization `consumed` **in the same transaction** that creates the invitation.
The card mounted the issuance component behind that very status:

```tsx
{!entry.consumed && entry.status === "authorized" ? (
  <InvitationIssuance authorizationId={entry.authorizationId} />
) : null}
```

and the success branch stored the secret and refreshed the server tree **in the same transition**:

```ts
setCapability(result.capability);
setExpiresAt(result.expiresAt);
router.refresh();            // ← the defect
```

So a **successful** issuance destroyed its own output: the refreshed tree flipped the mount
condition to false, React unmounted the component, and the only copy of the plaintext — component
state — went with it. Whether the human saw anything at all was a race between a local state commit
and a server round-trip. The first issuance won that race; the second lost it.

The component was introduced in `9c9155f` with this shape. It was not a regression from the
revocation work: `InvitationIssuance` is byte-identical across `35ae657`, and the `router.refresh()`
added by that commit belongs to the new `revoke()` function.

---

## 3. The runtime was never wrong

`issueInvitation` returns the capability correctly, and that was already proven —
`tests/i2-flow/onboarding-postgres.ts:254` asserts `issued.capability.length >= 40`. No backend
defect, no schema defect, no authority defect. **The bug lived entirely between "the server returned
the secret" and "a human could read it."**

---

## 4. The fix

Two changes, one file.

**The component is no longer mount-gated on server status.** The parent always renders it; the old
predicate arrives as an `issuable` prop that gates the *button* instead of the *mount*. No
server-side status change can now unmount a component that is holding a plaintext secret.

**The refresh moved behind an explicit human acknowledgement.** `issue()` stores the capability and
does nothing else. A new `acknowledge()` — wired to *"I have saved this capability"* — clears the
local copy **first**, then calls `router.refresh()`. It calls no server action and touches no durable
state, so acknowledging can never issue a second capability.

Render order inside the component is now: **capability panel first**, then the unknown-outcome
notice, then the spent-authorization case, then the button. A held secret outranks every other
render path.

---

## 5. Nothing was traded away for visibility

The capability gained **no** new custody. It still lives only in component-local React state:

- not persisted to any table — the schema still stores only `token_hash` and `token_version`
- not written to audit or any log
- no `localStorage`, `sessionStorage`, `document.cookie`, URL, query or fragment
- no clipboard abstraction was invented, and nothing auto-copies; the value sits in a labelled
  readonly field the human selects deliberately
- no read seam returns it, and no recovery path was added

**The capability remains unrecoverable by design.** This phase made it *visible*, not *retrievable*.

---

## 6. Failure states

| Case | Behaviour |
|---|---|
| Refused issuance | shows the refusal; capability state is never set — a fake capability is unrepresentable |
| Thrown action / transport failure | caught, reported as an **unknown outcome**, and the handler returns immediately. It deliberately does **not** say "nothing was changed" — the request may well have committed — and offers no retry that could spend a second authorization |
| Double click | the issue button is `disabled` while the transition is pending, and once a capability is held the button branch is not rendered at all |
| Acknowledgement | local state disposal plus a refresh; calls no action |
| Refresh delayed or failing | irrelevant to custody — the refresh only happens *after* the human has confirmed they saved the secret |

---

## 7. Regression protection

`tests/capability-handoff-flow/custody-lifecycle.ts` — seven source invariants:

1. `issue()` stores the capability and **must not** call `router.refresh()` (or reload by any other
   means)
2. refresh exists only inside `acknowledge()`, after `setCapability(null)`, and that function issues
   nothing
3. `InvitationIssuance` is **not** conditionally mounted on the authorization's server status
4. the capability branch is checked **before** the spent-authorization branch
5. no storage, cookie, URL, clipboard or logging custody, and component state remains the only home
6. failure states are honest — the catch block sets an unknown outcome, returns, and never sets a
   refusal or a capability; the copy never claims nothing happened
7. the panel states shown-once, save-it-now, unrecoverable, do-not-reload, who may use it, and when
   it expires

**This is a source-invariant test, not a browser test, and the file says so.** It renders no React
and simulates no click. Pretending a structural test is end-to-end proof is precisely what let this
bug ship, and it is not claimed here.

**Negative control.** Run against the released `940e4e3` card, invariant 1 fails
(`issue()` calls `router.refresh()`), invariant 3 fails (the component is mount-gated), and
`acknowledge()` is absent. The guard genuinely catches the bug it was written for.

---

## 8. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | 0 errors (14 pre-existing warnings, none in changed files) |
| `npm run test:run` | **352 passed, 0 failed** (was 351) |
| `npm run build` | clean |
| `git diff --check` | clean |
| schema / migration / dependency delta | **0 / 0 / 0** (24 files, 24 journal) |

---

## 9. `hebun_r1` non-effects

Read-only for the whole phase. Confirmed after the build:

```
invitation    16eaa349…  pending · revoked_at NULL · accepted_at NULL
authorization bbcf87fa…  consumed
invitations 2 · authorizations 2 · enrollments 0 · audit_log 9 · users for target 0
```

**The real invitation was not revoked. No new C2, no new C3, no capability, no audit delta.**

---

## 10. Remaining limitation — browser proof

**Browser-level human-handoff proof remains unproven until the next real C3 ceremony.**

It could not be obtained here, and the reason is structural rather than a matter of effort: both
authorizations in `hebun_r1` are `consumed`, so **zero** issuable authorizations exist and the issue
button would not render at all. Producing one would require a new C2, which this phase was forbidden
to perform — correctly. Reaching the page also needs an authenticated Governance session whose
credentials were not available and were not requested. The dev server on port 4000 was not running
at the end of this phase and was not started, because starting it would not have made the panel
reachable.

What *is* proven: the component compiles and builds; the seven invariants hold; and the exact shape
that caused the incident now fails the test suite. What is *not* proven is the rendered panel with a
real secret in front of a real human — and that is exactly the layer whose absence produced this
incident in the first place. It closes at the next issuance.

---

## 11. Recovery point after release

Nothing is recovered yet. Invitation `16eaa349…` still holds an outstanding capability that no human
possesses, and the address's onboarding slot with it.

After this fix is released, the Director's sequence is the same three steps as before, and this time
the third one should actually hand over a secret:

1. `/governance/authority` → **Revoke onboarding capability** on `16eaa349…`, with a reason.
   → the unseen capability dies; the slot is freed; authorization `bbcf87fa…` stays **consumed**.
2. **Authorize New Member** for `senoltr@gmail.com` — the third C2, a new Governance decision.
3. **Issue onboarding capability** — the third C3. The panel now stays until
   *"I have saved this capability"* is pressed.

Historical truth, unrewritten: the first capability was lost after being shown, the invitation was
revoked, a second C2 and C3 followed, and the second capability was lost **because of this UI
defect** rather than by human error.

---

## 12. What this phase did not do

No runtime change — `issueInvitation` is untouched. No schema, migration, dependency, authority,
token format or audit change. No capability persistence, recovery seam, readback, browser storage,
cookie, URL transport or logging. No clipboard abstraction and no auto-copy. No revocation, no new
C2, no new C3, no Act 1. No commit, tag or push. `hebun_r1` was read and never written.
