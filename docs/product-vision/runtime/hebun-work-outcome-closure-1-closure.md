# WORK-OUTCOME-CLOSURE-1 · closure record · VERIFIED

**Scope, stated first.** A person can read a work item's outcome from the records that hold it — the
drafts the work declares as evidence, the Governance review of each draft's current revision and the
work's declared state — on Heby, the Work register and the Operations review card, and is offered a
suggestion to declare the work complete only when every linked draft's current revision is accepted.
The declaration stays the Work Authority's existing human act. Implemented and verified locally in
commit `14159026`; **not pushed, not deployed, not production-accepted.** No schema, migration,
authority, provider, data-use class or model call changed.

## 1 · Problem

- **Acceptance fed nothing.** For plans and messages, an accepted revision had no consumer: the work item
  stayed `planned` or `active` while Heby said `"accepted — this task is complete"`.
- **The register did not show review.** `/director/work` listed a linked draft with its type, lifecycle
  and revision, never its Governance review.
- **The reviewer decided without the work in front of them.** The Operations artifact row already named
  the work a draft is evidence for (REV-3); the review control itself did not, and said nothing about
  what acceptance does to that work.
- **Two AE wordings overstated** the agent's role (AE2-RECOMMENDATION-WORDING-1) and one named no reason
  for a withheld answer or an agent before a choice (AE1-ASSIGN-UI-WORDING-1).

Correction to the discovery report of 2026-10-25: it said the Operations surface does not show the
related work. The artifact row does (REV-3 `DeclaredWorkPurpose`); only the review control lacked it.

## 2 · What was implemented (`14159026`)

- **`work-outcome/contracts.ts` (pure).** `suggestCompletion` — the one rule both surfaces call. Offered
  only when the work is in service, its declared state is known and not `complete`, the evidence read
  answered completely, at least one linked draft is not retired, and the current revision of every
  non-retired linked draft is `accepted`. Otherwise one closed reason: `work-unknown`, `work-retired`,
  `work-complete`, `evidence-unknown`, `no-evidence`, `review-unknown`, `changes-requested`,
  `awaiting-review` (`unknown` is checked first, so nothing is inferred over it). Fixed sentences:
  acceptance is not completion and authorizes no publication, sending or execution; declaring complete
  records what a person said and Hebun verifies nothing.
- **`work-outcome/read-work-outcome-evidence.server.ts` (read-only).** Composes `listWorkArtifacts`,
  `readWorkEvidenceReferences` (WEV-1) and `readCurrentRevisionReviewStates` (CGO-8), each asked once,
  tenant from the caller's session context only. A full evidence page (`MAX_WORK_EVIDENCE_REFERENCES`,
  no truncation flag) is refused `unavailable`: a missing declaration could be the one draft with changes
  requested. A declared draft the artifact authority cannot name is `unknown`.
- **Heby.** `readWorkDraftChoices` also returns the work's declared state and the suggestion. The
  affordance shows "This work is declared …", the suggestion or the reason it is withheld, and — to a
  holder of the Governance authority the writer asks — "Declare this work complete", which calls the
  existing `setWorkDeclaredStateAction` with the constant `complete`.
- **Work register.** Each in-service item lists its declared drafts with the review of each current
  revision, and the same suggestion with a "Declare complete" control (the same human action as
  Change → Declare state).
- **Operations review card.** At the moment of accepting: the work items the draft is evidence for (REV-3's
  index, already read by the page) and the acceptance-is-not-completion sentence.
- **Wording.** Accepted: "accepted for the next internal step — the agent's task is done; the work is
  complete only when a person declares it". Recommendation: the role "decides who is offered and recorded
  as the draft's author; the model is not told the agent's specialty". Result: "… wrote the draft … and is
  recorded as its author, chosen as this work's specialist". Withheld: named as withheld, with the note that
  which check withheld it is not recorded. The assign button reads "Choose an agent to assign" before a choice.
- **Pins changed with their reasons:** `agent-execution-1/capability-contract.ts` (accepted wording; import
  census gains `work-contracts`, `work-outcome/contracts`, `work-outcome/read-work-outcome-evidence.server`);
  `agent-execution-2/specialist-contract.ts` (fixture gains the two new fields; recommendation and result
  wording). No security, tenant or authority assertion was relaxed.

**Unchanged:** `setWorkDeclaredState` and its authority (Governance authority, human author), the review
writer (`review-revision.server.ts` reaches no Work module), the artifact lifecycle, permits, execution,
providers, the login form and every schema.

## 3 · Verification (V2)

V2: a shared read (Heby's agent-choice read) and three customer surfaces changed; no authority, tenant,
lifecycle or execution boundary moved. Test-stability rules applied: baseline first on unchanged
`b47d85b2`, mutating runs only in disposable detached worktrees (`woc1-baseline`, `woc1-candidate`,
`woc1-bite`).

| Check | Result |
|---|---|
| Baseline, 50 affected files (every test naming a touched file, plus `operational-reliability-1`, `heby-verified-work-outcomes`), unchanged `b47d85b2` | 49/50; `work2-provider-disclosure/bite-proofs.ts` red under the list run, PASS 2/2 run alone on the same tree — PRE-EXISTING flake (ORL-1 recorded the same file red on an `en_US` collation instance) |
| `tests/work-outcome-closure-1/outcome-postgres.ts` O1–O8, real PostgreSQL 18 | PASS — awaiting; accepted → suggested with the work row's md5, its audit rows, action requests and permits unchanged and the state still `planned`; a newer revision unreviewed; multiple evidence (changes requested withholds, reversal offers, retired excluded, unrecognised outcome withholds); tenant isolation (no cross reads, cross review refused `revision-unresolvable`, cross choices `work-unresolved`, the other tenant's decisions never reach); member refused `not-authorized`, holder declares, audit `actor_type human`, then `work-complete`; a full 200-reference page → `evidence-unknown`; no database → unavailable; Heby and the register agree at every step |
| `tests/work-outcome-closure-1/outcome-contract.ts` C1–C6 | PASS — the rule; the words; no writer or model seam in the outcome modules; the review writer reaches no Work module; declaration only on a click, through the human writer, with the constant state; corrected wording |
| Bite-proofs (disposable `woc1-bite`, match count 1 each) | 9/9 caught: rule ignores changes requested; bound dropped; Heby ignores evidence; retired counted; "task is complete" restored; review notice dropped; Heby declares `active`; unknown read as accepted; review read for revision 1 instead of the current one |
| Affected files on the candidate (disposable `woc1-candidate`) | 52/52 after the AE-1 import census was updated in the same change (first run 51/52: that census, a deliberate new reach); AE-1 capability-contract, bite-proofs and assignment-postgres PASS re-run |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check`, `npm run build` | PASS. Build lists `/director/work` as static, identical on unchanged `b47d85b2` (a local build without `DATABASE_URL`; PRE-EXISTING, not from this change) |
| Full suite (`node scripts/run-tests.mjs`, candidate copy; run because a new `features/` directory and server module could meet repo-wide census and firewall tests that name no touched file) | 1094/1095, REGRESSION 0; the one red `r3w-flow/ambient-database-safety.ts` BLOCKED (canonical `hebun_r1` at 127.0.0.1:55432 not running, ECONNREFUSED), identical on unchanged `b47d85b2`; not a pass, and the canonical instance was not started |

## 4 · Production

Not pushed, not deployed. `origin/main` = `b47d85b2` when this branch was cut; `14159026` is one commit
ahead of it on `feat/work-outcome-closure-1`.

## 5 · Production acceptance plan (Director-gated, not run)

1. Push gate, then read the Vercel deployment record for the pushed SHA (AE2-VERCEL-GIT-TRIGGER-1: confirm
   the Git integration created it).
2. Signed in by the Director, tenant hebun, read only: `/heby?workItem=5ba33201…` shows "This work is declared
   …" and, while `d71f8383@1` awaits review, "At least one linked draft's current revision is waiting for
   review" with no declare control; `/director/work` lists the draft with "current revision waiting for review".
3. `/operations`: open "Accept for next internal step" on `d71f8383@1` and read the "For: …" line and the
   acceptance-is-not-completion sentence. Whether to accept is the Director's own Governance decision; nothing
   is accepted for the purpose of this test.
4. Only if the Director accepts organically: re-read Heby and the register for the suggestion, confirm the work
   item's declared state did not change, then the Director decides whether to declare it complete; read back
   the register and the `work.state-declared` audit row (human).
5. `92e70b3e` (the linked decline `98904a8e@1`, AE2-DECLINE-GROUNDING-1) shows its own review state and no
   suggestion while it waits. No model call, no data created for the purpose.

## 6 · Not verified

- No signed-in render, local or production (WOC1-BROWSER-UNVERIFIED-1).
- Concurrency between a review decision and a declaration (both are separate human acts; the declaration
  writer locks the work row and re-asks its authority).

### Deferred risk detail

- **WOC1-BROWSER-UNVERIFIED-1 (DEFERRED).** The three surfaces were verified by contract and real-PostgreSQL
  tests only. Dependency: the signed-in production read of section 5.
- **WOC1-EVIDENCE-BOUND-1 (DEFERRED).** At 200 current evidence declarations in a tenant, every suggestion is
  withheld (`evidence-unknown`) on both surfaces. Dependency: a Director decision on a work-item-scoped evidence
  read when a tenant approaches the bound.

**Fixed here, still open in §22 until release:** AE1-ASSIGN-UI-WORDING-1 and AE2-RECOMMENDATION-WORDING-1 are
fixed in `14159026`. Their rows stay DEFERRED until the change is released; the release record moves them here
as CLOSED. AE1-WITHHELD-DIAGNOSABILITY-1 is unchanged: the withheld message names the outcome, not the check.

**Weekly three.** *Learned:* a suggestion built from a bounded read must refuse at the bound, and the outcome of
work is a composition of three owners' answers, not a new state. *Turkish Rug House:* its owner sees on one line
which drafts for a piece of work were accepted and declares the work done themselves; nothing closes on its own.
*Hebun AI:* the request → agent draft → Governance review → human declaration loop is now readable end to end
without a new authority.

## Closure Contract (v1)

- Phase: WORK-OUTCOME-CLOSURE-1
- Owner: Work outcome composition (`work-outcome/contracts.ts`, `work-outcome/read-work-outcome-evidence.server.ts`) over Organizational Work (WORK-1, WEV-1), Work Artifacts and Governance artifact review (TRH-10, CGO-8); Heby work-draft affordance, Work register, Operations review card
- Reached state: VERIFIED
- Implementation commit: 14159026
- Verification level: V2 — a shared read (Heby's agent-choice read) and three customer surfaces; no authority, tenant, lifecycle or execution boundary changed
- Verification evidence: outcome-postgres O1–O8 PASS; outcome-contract C1–C6 PASS; bite-proofs 9/9 caught; 52/52 affected files on the candidate (51/52 first run, the AE-1 import census updated in the same change); baseline 49/50 with work2-provider-disclosure/bite-proofs PRE-EXISTING flake (PASS 2/2 alone); tsc, eslint, git diff --check, npm run build PASS; full suite 1094/1095 with 0 REGRESSION, the one red r3w-flow/ambient-database-safety BLOCKED (canonical hebun_r1 :55432 not running), identical at baseline b47d85b2
- Test environment: worktree `.claude/worktrees/work-outcome-closure-1` (branch feat/work-outcome-closure-1, base b47d85b2); disposable detached worktrees `woc1-baseline`, `woc1-candidate`, `woc1-bite`; macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18.6 at 127.0.0.1:55433 (superuser admin) via HEBUN_TEST_ADMIN_DATABASE_URL with harness-created databases; no model, no network, no production database or provider
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: WOC1-BROWSER-UNVERIFIED-1 (DEFERRED); WOC1-EVIDENCE-BOUND-1 (DEFERRED)
- Director approvals: discovery and milestone selection 2026-10-26; architecture decisions (no new authority, table or migration; setWorkDeclaredState authority kept; no automatic transition; ACCEPTED != COMPLETE; DECLARED COMPLETE != VERIFIED; acceptance authorizes no publication, sending or execution; tenant from trusted authentication) and the multiple-evidence rule 2026-10-26; local implementation, verification and commit 2026-10-26; push, deployment, production data change and live model calls NOT approved
