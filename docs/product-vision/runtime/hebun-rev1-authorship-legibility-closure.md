# REV-1 — Authorship Legibility on the Review Surface — RELEASED · ACCEPTANCE PENDING

**Release** `33e47d4` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment**
`dpl_4V36MyL1usP3jwaLmGjwDbooPekp`, running `33e47d4` on `main`, aliased to `www.hebuntech.com`

**Status is deliberately not CLOSED.** The data half is production-accepted against real tenant
data through the released seam. The rendered half needs one authenticated look at `/operations`,
which cannot be performed honestly from an operator shell — see *Production acceptance*.

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

### Pending — the rendered half

The capability is something a human *sees*, and confirming that needs one authenticated view of
`/operations` on the deployed commit. Signing in requires entering the Director's credentials, which
this environment must not do, so the render is **unverified** and is reported as such rather than
simulated. What is established without it: the deployment runs the release commit, the route
fail-closes to `/login`, and the exact strings come from the released seam above.

**The confirming step is one look at `/operations` → any draft → History.**

---

## Truth limitations

- **Legible is not reviewed.** Reading a draft records nothing, and Hebun holds no review state.
- **Authorship is not endorsement**, for either kind of author.
- **Authorship is shown per revision, in the history** — not on the collapsed row, because
  `WorkArtifactView` carries no authorship field and inferring one is banned. A reader who never
  opens a history still cannot tell. Widening the listing projection was not taken.
- **The agent is named as a class, not as an identity.** Which durable agent wrote it is recorded
  and deliberately not shown.
- **Prepared is still not approved**, and approval still does not exist.

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
