# REV-1 — Authorship Legibility on the Review Surface — CLOSED / PRODUCTION-ACCEPTED

**Release** `33e47d4` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment**
`dpl_4V36MyL1usP3jwaLmGjwDbooPekp` (`33e47d4`), superseded in place by
`dpl_2vDJyZvnhtzU96tGq6gBsVVgKF5t` (`f7eda65`) — both serving byte-identical surface code, proved
below — aliased to `www.hebuntech.com`

**Both halves are accepted.** The data half was accepted from an operator shell through the released
seam. The rendered half was accepted by the Director on the deployed surface, which is the evidence
this document previously recorded as pending.

---

## The discovery that changed the phase

CGO-7's closure named the next gap as *"making prepared content reachable by the human who must
review it"*, and supported it with *"`/operations` has server seams and no caller"*.

**That was wrong, and it is corrected here rather than quietly fixed.** OPS-P1 (`9498cae`,
2026-08-27) shipped the review surface: a listing of every prepared artifact, a per-revision history
that renders the bytes, create, revise and retire — all wired to `OperationsPreparation` on
`/operations`. The CGO-7 sentence was true of `prepareWorkArtifactAction` specifically and was
over-generalised to the whole route.

**Reachability already existed. Candidate A as specified was already provided.**

---

## What was actually missing

OPS-P1 withheld `authoredByActorType`, grouping it with `tenantId`, `contentDigest`,
`sourceMessageId` and `authoredByActorId` as an audit internal.

**That was correct when it was written.** AGENT-RUNTIME-0 had not landed, every revision then in
existence was written by a person, and a field with one possible value distinguishes nothing.

Three releases falsified it without moving the pin — AGENT-RUNTIME-0 made the durable agent the
author of model-produced bytes, CGO-3 made an agent able to prepare a content draft, and CGO-4 and
CGO-7 made the model the direct author of the stored text. Measured in production before any code
was written:

| | Revisions |
|---|---|
| Written by a person | **4** |
| Written by the durable agent | **3** |
| Rendered differently by `/operations` | **0** |

A Director reviewing seven drafts could not tell which three a model wrote.

---

## What was built

One pure vocabulary and one rendered line.

| File | Change |
|---|---|
| `work-artifacts/contracts.ts` | `WORK_ARTIFACT_AUTHOR_LABELS`, `WORK_ARTIFACT_AUTHOR_UNKNOWN`, `workArtifactAuthorLabel`, `WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS` — pure, no I/O |
| `operations-preparation/prepared-work-section.tsx` | the authorship sentence, per revision, beside the bytes |
| `tests/ops-p1-flow/preparation-firewall.ts` | the withheld-fields pin rewritten |
| `tests/ops-p1-flow/bite-proofs.ts` | two new mutations |
| `tests/rev1-authorship-legibility/` | the capability and its boundaries |

**A classification, never an identifier.** `authoredByActorId` stays withheld and a bite-proof still
proves it. A reviewer needs to know a model wrote the text, not which row records the writer — and
that distinction is the only reason this could be shown without reopening what OPS-P1 closed.

**It fails closed.** The `actor_type` enum has four members and the view types the field as
`string`. An unrecognised value renders *"Authorship was recorded in a form this surface cannot
name. It is unknown, not human."* Defaulting to the human sentence is the one failure this field
exists to prevent.

**The denial is adjacent to the fact.** The three non-claims render with the history, at the moment
a reader is deciding what to make of the text — the placement rule CGO-1 established for the
destination caption.

---

## Nothing was invented

The stop conditions were checked against the repository, not assumed, and a test asserts each:

| Question | Repository answer |
|---|---|
| Does an approval authority for artifacts exist? | **No.** R3W states in code: *"not a decision — no approval field exists to set."* |
| What states exist? | **`draft` and `retired`.** Unchanged by this phase, asserted by `deepEqual`. |
| Does Governance own artifact approval? | **No.** `GOVERNANCE_SUBJECT_TYPES` is still closed at `knowledge_node`. |
| Does a review-feedback persistence owner exist? | **No.** None was invented; none was needed. |

So this phase shipped **a rendered sentence, not a transition**. No approval, no rejection, no review
record, no lifecycle state, no new authority, no new workspace, no new source class, no schema, no
migration, no provider call, no scheduling, no publishing.

---

## The pin was rewritten, not relaxed

The OPS-P1 assertion listed eight withheld fields. Its invariant is that **integrity internals and
identifiers do not reach the surface** — and seven of the eight are exactly that. All seven remain
forbidden.

The eighth was never one of them in kind: it is a four-value classification, not an identifier or a
digest. It is now **required to be present**, so a surface that stopped naming the author fails.
Two bite-proofs cover both halves — rendering the identifier bites, and removing the classification
bites.

---

## Tenancy and security

- Tenant comes from `resolveTenantContext()` server-side. The client supplies an artifact id only.
- Every query is `AND tenant_id = <server-resolved>`. A foreign artifact id returns **the same empty
  result** as a nonexistent one — proved indistinguishable by test, so an absent answer confirms no
  other tenant's row exists.
- Nothing withheld became visible: `tenantId`, both digests, `sourceMessageId` and
  `authoredByActorId` are still absent, and no view is spread.
- The deployed route fail-closes: `GET /operations` unauthenticated → **307 → `/login`**.

## The CGO-7 provenance firewall holds

**Reviewing is not preparing, and costs no quota.** Walking the real import graph from the read seam:
no provider `.server.ts`, no `content-observation` composition, no model transport, no Knowledge
writer, no ratification authority, no execution module, no proposal inlet. The components are
additionally banned by name from importing any preparation entry point, so a review can never
silently become a YouTube observation.

No observation is presented as organizational Knowledge, and no causal claim is made or
representable — CGO-7 stores no observation at all, so an artifact carries no trace of one.

---

## Tests

**674 passed, 2 failed, 676 total.** Both failures are pre-existing and unchanged from CGO-7's
closure, where they were verified to fail identically at `11496b4`:

- `tests/ama1-agent-mandate/bite-proofs.ts` — reference equality of a frozen action-kind array.
- `tests/hebycap1-flow/capability-truth.ts` — `/work-activity` has no capability binding.

All 14 OPS-P1 bite-proofs bite, including the two new ones. `tsc --noEmit` clean, lint 0 errors,
build green.

---

## Production acceptance

### Accepted — the data half

`scripts/rev1-acceptance.ts` ran the **released** read seam and the **released** vocabulary against
production data as the real Director's tenant. All seven artifacts resolved, and the surface's
sentence was produced for every revision:

| Artifact | Renders |
|---|---|
| CGO-7 observed reel caption | *Written by this organization's durable agent* |
| Rug washing video caption | *Written by this organization's durable agent* |
| Agent-prepared reel caption | *Written by this organization's durable agent* |
| Loom weaving reel | *Written by a person* |
| Provenance Acceptance Note · Hebun Production Acceptance Note · Test Email | *Written by a person* |

**human 4 · agent 3 · unnamed 0.** Before this release all seven read identically.

**Nothing moved.** `work_artifacts` 7, `work_artifact_revisions` 7, `knowledge_nodes` 2,
`work_items` 2, `integrations` 3, `integration_credentials` 21, `decision_records` 7,
`heby_action_requests` 5, `action_execution_attempts` 1 — every count identical before and after.
No model call, no provider call, no credential opened, no write.

### Accepted — the rendered half

**Director UI acceptance: PASS.** The `/operations` surface was inspected on the deployed
production commit. A real prepared artifact — *CGO-7 observed reel caption* — rendered its current
revision and displayed the authorship classification:

> Written by this organization's durable agent

The same surface truthfully stated, in the Director's own reading of it: that seeing who wrote a
revision is not a review of it, that reading it records nothing, that this authority holds no
review, approval or rejection semantics, and that agent-written does not mean endorsed.

This is the exact render evidence this document previously recorded as pending. Nothing about it was
simulated, and nothing was inferred from a button, a route or a local render.

---

## Post-acceptance verification — READ-ONLY, against production

Run after the Director's view, against the pre-view baseline recorded by
`scripts/rev1-acceptance.ts`. Nine checks, all passing.

**1 · The rendered artifact is the authoritative row.** `18a0ac6e-eaea-4218-bd22-5aa6f2139784` —
the artifact CGO-7 created — `content-draft`, `instagram`, `operations`, revision 1, authored
`agent`, digest `588c0b66e277…`, 256 bytes.

**2 · No lifecycle transition occurred because it was viewed.** `version` **1** and `updated_at`
**equal to `created_at`** (`2026-09-03T22:35:04.492Z`): the row has not been touched since CGO-7
wrote it, the Director's view included. All seven artifacts are `draft`, and the production enum is
still exactly `["draft", "retired"]`.

**3 · No review, approval or rejection record was created.** Zero columns matching review, approval
or reject on `work_artifacts` or `work_artifact_revisions`. A pre-existing Governance-era
`approvals` table exists, holds **0 rows**, and carries **no column referencing an artifact** — so
it neither gained anything nor could name one.

**4–6 · Knowledge, Governance, execution, publishing, scheduling — all unmoved.** Every counter is
identical to the pre-view baseline:

| Table | Before the view | After |
|---|---|---|
| `work_artifacts` · `work_artifact_revisions` | 7 · 7 | **7 · 7** |
| `knowledge_nodes` | 2 | **2** |
| `work_items` | 2 | **2** |
| `decision_records` | 7 | **7** |
| `heby_action_requests` | 5 | **5** |
| `action_execution_attempts` | 1 | **1** |
| `integrations` · `integration_credentials` | 3 · 21 | **3 · 21** |

**7 · No provider call or credential lifecycle was triggered by viewing.** All three connections
unchanged — `youtube` `connected`/`healthy` version 3 last verified `2026-09-03T19:05:09.844Z`,
`google-workspace` version 9, `github-organization` version 3 — and **zero audit rows in the last
four hours** (`audit_log` total 50). Credential rows unchanged at 21, so no refresh occurred either.

**8 · Tenant isolation and withheld fields intact.** `work_artifacts`: 1 distinct tenant, 7 rows,
**0 untenanted**. The released firewall and the REV-1 suite both re-run green against the shipped
source, so `tenantId`, both digests, `sourceMessageId` and `authoredByActorId` are still absent from
the surface and no view is spread.

**9 · The deployed release is the intended one.** Production serves `f7eda65`, which is the closure
commit. The delta from the release `33e47d4` is **384 added lines across one script, one document
and `learnings.md`, and zero files under `apps/dashboard/src/`** — the two commits carry
byte-identical surface code, proved by hash:

    prepared-work-section.tsx   2b7d1f8ecdc1a083   at BOTH 33e47d4 and f7eda65
    work-artifacts/contracts.ts de4c79f9f6ff5579   at BOTH 33e47d4 and f7eda65

So the surface the Director inspected is the released surface, and the SHA difference is measured
rather than waved through.

---

## Truth limitations

- **Legible is not reviewed.** Reading a draft records nothing, and Hebun holds no review state.
- **Authorship is not endorsement**, for either kind of author.
- **Authorship is shown per revision, in the history** — not on the collapsed row, because
  `WorkArtifactView` carries no authorship field and inferring one is banned. A reader who never
  opens a history still cannot tell. Widening the listing projection was not taken.
- **The agent is named as a class, not as an identity.** Which durable agent wrote it is recorded
  and deliberately not shown.
- **Prepared is still not approved**, and approval still does not exist. Production confirms it:
  two lifecycle states, no approval column, and an empty `approvals` table that cannot name an
  artifact.
- **One human looked at one surface.** UI acceptance is a real observation, not a coverage claim:
  it establishes that the classification renders and reads truthfully, not that every artifact,
  browser or viewport does.

---

## Repository parity

`HEAD` = `origin/main` = `33e47d4`. Fast-forward `c042618..33e47d4`. Concurrent work untouched: the
in-flight GOOGLE-PICKER-1 closure edit and seven untracked paths were excluded from the staged diff
and remain exactly as found.

---

## Next newly exposed gap

**Row-level authorship.** The listing renders title, type, revision and destination; authorship
arrives only after opening a history. Closing it means adding one field to the artifact listing
projection — no schema, no authority — and was not taken here because the read seam and its pins are
a wider blast radius than the defect justified.

**Approval remains genuinely undefined, and that is a finding, not a task.** Introducing it needs a
decision this repository has not made: whether an artifact becomes a Governance subject type, or
whether the artifact authority grows a state of its own. Either is architecture, not a capability,
and nothing here should be read as preparing for one.

Not started.
