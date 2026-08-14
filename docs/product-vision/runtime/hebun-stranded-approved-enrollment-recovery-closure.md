# HEBUN — STRANDED APPROVED ENROLLMENT RECOVERY — CLOSURE RECORD

Date: 2026-08-14. Baseline: `cad04e7` (`main`, `0/0` with `origin/main`, tag
`hebun-onboarding-capability-handoff-custody-complete` published).

Gate A for this phase is PART SEVENTEEN of the ceremony record, which classified the incident
**G — multiple defects**, with the recovery-path defect as the serious one. This phase closes it.

---

## 1. The real incident

The third capability was issued and — thanks to the custody fix released immediately before — was
visibly preserved and saved. The bearer submitted it, Governance approved it, and then the browser
continuation binding was lost. What followed was not recoverable:

```
invitation  f754d23b-41ae-45a6-b55b-23afb9e3cf43   pending, live until 2026-08-17 16:41:40 +03
enrollment  d0fbdd47-aa92-4e5e-8974-0a05dbf93c30   approved 16:47:39, completed_at NULL
target      senoltr@gmail.com — no user, identity, credential or membership
```

**Approval is only permission for Act 3.** With the binding gone that permission could never be
spent, and three things then held the ceremony shut:

- `readPendingEnrollments` listed only `status = 'pending'` — the approved row was **invisible**
- `decideIdentityEnrollment` refused anything not `pending` — it was **unrejectable**
- `identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <> 'rejected'` —
  it **blocked every fresh submission** for that invitation

The bearer was told, in the released product: *"If you lose it or move to another browser, a
Governance authority rejects the stranded ceremony, which frees the invitation for a fresh submission
with the same capability."* **That sentence was not executable.** This phase makes it true.

It is the same trap class as the original `invitations_pending_email_uq` defect: a partial unique
index whose escape hatch is unreachable from a state the system actually reaches.

---

## 2. The state machine, before and after

| Transition | Before | After |
|---|---|---|
| `pending → approved` | allowed | allowed, unchanged |
| `pending → rejected` | allowed | allowed, unchanged |
| `approved → completed` | allowed | allowed, unchanged |
| **`approved` + `completed_at IS NULL` → `rejected`** | **impossible** | **allowed — the recovery** |
| `completed → rejected` | impossible | **still impossible** |
| `rejected → anything` | impossible | still impossible |
| `approved → approved` | impossible | still impossible |

Approval remains a once-only transition out of `pending`. Only **rejection** reaches the stranded
state, and only while `completed_at IS NULL` — a completed ceremony created a real human with a real
credential, and rejecting it would claim to undo that.

---

## 3. Authority

No new authority, no new resolver, no recovery-only side door. The recovery **is** the existing
reject path, taken by the existing `decideIdentityEnrollment` under the existing
`resolveGovernanceAuthority`, writing through the existing `writeGovernanceDecisionWithin` and the
existing audit sink. A structural test asserts there is exactly one Governance resolver, that only
the decision and completion runtimes transition an enrollment, and that no `recoverEnrollment`,
`forceReject`, `adminReject` or `unstrand` exists.

---

## 4. What a recovery does, and does not

It transitions one enrollment row and writes one Governance decision plus one audit row. It does
**not** touch `invitations` or `membership_authorizations` at all — asserted by test, since the
runtime contains no reference to either.

Concretely: the invitation stays `pending` and is **not revoked**; no capability is minted, rotated
or exposed; and no user, identity, credential or membership is created or destroyed. The freed slot
then accepts a fresh submission with the **same capability the bearer already holds**.

**The approval columns are cleared, and the schema requires it.**
`identity_enrollment_requests_approved_chk` welds `approved_at`, `approval_decision_id`,
`approved_by_actor_type` and `approved_by_actor_id` to the approved/completed statuses in both
directions, so a `rejected` row may not carry them. **No history is lost:** the approval is a
Governance decision and lives where every Governance decision lives — `decision_records`, findable by
`subject_type` + `subject_id` — plus its own audit row. The enrollment row was never the ledger. The
flow test asserts the original approval decision still exists after the recovery.

The decision's evidence records `recoveredFromStrandedApproval`, so history distinguishes a first
decision from a release.

---

## 5. The read seam

It now returns the two states a Governance authority can still act on:

- `pending` — awaiting a first decision
- `approved` with `completed_at IS NULL` — **stranded**, flagged `strandedAfterApproval`, with the
  approval timestamp so the approver can recognise their own act

`rejected` and `completed` are terminal and remain absent — listing them would be a control that does
nothing. The seam is still authority-gated, still tenant-scoped, still read-only, and still returns
**no** address, **no** continuation digest and **no** capability.

---

## 6. The surface

A stranded row renders as itself — *"Approved, but the account was never created"* — never as
"awaiting your decision". The **Approve** control is withheld from it, because approving it is
impossible. The reject control reads *"Reject so they can try again"* and is accompanied by four
frozen facts: nothing is undone, the invitation is not revoked, no new capability is issued, and the
person can reuse the capability they already hold. A 24-character reason is still mandatory.

---

## 7. The copy defect

`enrollment-already-started` fires whenever a non-rejected ceremony exists — `pending` **or**
`approved`. It said *"A submission for this capability is already waiting for approval"*, which was
simply false for the stranded bearer who read it.

It now says: *"An enrollment ceremony already exists for this capability. If you did not start it, or
you cannot finish the one you started, tell the person who gave you the capability — they can end it
so you can begin again with this same capability."*

State-neutral by design. This is the **unauthenticated** boundary: a thief holding a stolen
capability must not learn whether Governance has already approved it, and the remedy is identical in
both cases. A test asserts the sentence contains neither "waiting for approval" nor "approved".

---

## 8. The continuation receipt, audited but not redesigned

`completeEnrollmentAction` clears the receipt on `continuation-unrecognized`. Audited as instructed,
and deliberately left alone:

- **Before this phase** it was a compounding defect: clearing stranded the ceremony with no way back.
- **After this phase** the ceremony is recoverable, so clearing is no longer destructive.
- Keeping a receipt that provably matches no ceremony would be worse — `hasReceipt` would stay true
  and the surface would keep offering "Create my account" against a binding that can never work.

**One honest cost remains:** clearing it destroys the only evidence of *why* a mismatch happened, so
the root cause of the original binding loss is still unproven. That is a diagnostic limitation, not a
correctness or security defect, and it is recorded here rather than fixed — redesigning it was not
this phase's scope and would have broadened it without need.

---

## 9. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | 0 errors (14 pre-existing warnings, none in changed files) |
| `npm run test:run` | **354 passed, 0 failed** (was 352) |
| `npm run build` | clean |
| `git diff --check` | clean |
| schema / migration / dependency delta | **0 / 0 / 0** (24 files, 24 journal) |

`tests/stranded-enrollment-flow/recovery-postgres.ts` proves the whole story against real PostgreSQL,
with **one** C2 and **one** C3 for the entire flow: submit → approve → binding lost → stranded →
blocked → visible to Governance → still not re-approvable → refused for unauthenticated, foreign
tenant, owner-without-Governance, revoked delegate and a short reason → **rejected** → invitation
still pending → **same capability** submits again → approved again → completed → user, identity and
credential created → acceptance creates the membership → a completed ceremony can never be rejected →
exactly one authorization and one invitation for the whole story. Plus concurrency: two simultaneous
stranded rejections yield exactly one winner, one decision and one audit row.

`tests/stranded-enrollment-flow/boundaries-and-firewall.ts` locks eight structural invariants.

---

## 10. Two sibling tests corrected

Both failed on this change, and both were asserting something that had become wrong.

`tests/i1-2-flow/enrollment-postgres.ts` asserted that rejecting an approved ceremony returns
`already-decided`. That was not a safety property — **it was the bug**. It now asserts what the block
was really protecting: approval is a once-only transition out of `pending`. The rejection is not
performed there because the rest of that file completes the same ceremony.

`tests/onboarding-entry-flow/read-seam-postgres.ts` asserted that an approved ceremony leaves the
list, on the reasoning that a decided ceremony is history. Wrong for exactly one state, and it cost a
real ceremony. It now asserts the approved row stays and is flagged stranded, that a pending row is
not, and that a **rejected** row does leave. Its field-list assertion was widened to the new closed
set — still exact, still all real columns, still no PII.

---

## 11. `hebun_r1` non-effects

Read-only for the whole phase; every flow test used a disposable database through its own ownership
handle. Confirmed after the build, identical to before it:

```
enrollment  d0fbdd47…  approved · completed_at NULL · rejected_at NULL
                       approval_decision_id 526e4306… (untouched)
invitation  f754d23b…  pending · revoked_at NULL · accepted_at NULL
enrollments 1 · invitations 3 · authorizations 3 · decisions 6 · audit 13
users 2 · identities 2 · credentials 2 · memberships 2 · migrations 24
```

**The real stranded ceremony was not rejected, and was never used as a fixture.**

---

## 12. Browser validation — documented limitation

**Not performed, and it could not be done safely here.**

The repository has **no browser or e2e harness** — no Playwright, Puppeteer, Cypress, testing-library
or jsdom in `package.json`, and no such directory under `tests/`. Adding one was explicitly out of
scope for this phase.

The alternative — standing up a dev server on port 4000 pointed at a disposable fixture database —
was rejected as unsafe. Port 4000 is the ceremony URL the Director uses; leaving it serving a fixture
database mid-incident risks a Governance action being taken against the wrong data. Port 3000 belongs
to another project and was observed only, never touched.

So this phase's guarantees are: **real-PostgreSQL runtime proof** of every transition and refusal,
and **source-invariant proof** of the surface's shape and wording. What remains unproven is the
rendered control in front of a human. That is the third consecutive phase to name this gap, and it is
now the single largest verification risk in the onboarding ceremony.

---

## 13. Recovery point for the real incident

Nothing is recovered yet. After this phase is released:

1. `/governance/authority` → the stranded submission now appears as *"Approved, but the account was
   never created"* → **Reject so they can try again**, with a reason of at least 24 characters.
   → enrollment `d0fbdd47…` becomes `rejected`; invitation `f754d23b…` stays **pending**.
2. The Director hands nothing over — the bearer **already holds the capability**. They return to
   `/login/join` and submit the same one.
3. Governance approves the new submission; the bearer completes it in the same browser; acceptance
   creates the membership.

**No new C2. No new C3. No new capability.** The invitation is live until 2026-08-17 16:41:40 +03.

---

## 14. What this phase did not do

No migration, schema change, column, enum value or dependency. No new authority, resolver, decision
writer or audit sink. No recovery-only operator shortcut. No invitation revocation, reissue or token
rotation. No capability persisted, exposed or recovered. No continuation-receipt redesign. No commit,
tag or push. `hebun_r1` was read and never written.
