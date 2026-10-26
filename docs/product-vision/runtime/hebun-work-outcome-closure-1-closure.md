# WORK-OUTCOME-CLOSURE-1 · closure record · DEPLOYED — PRODUCTION ACCEPTANCE PENDING

**Scope, stated first.** A person can read a work item's outcome from the records that hold it — the
drafts the work declares as evidence, the Governance review of each draft's current revision and the
work's declared state — on Heby, the Work register and the Operations review card, and is offered a
suggestion to declare the work complete only when every linked draft's current revision is accepted.
The declaration stays the Work Authority's existing human act. Implemented in `14159026`, released with
its closure documentation `e7770d59` and **deployed** (`dpl_F3mn4UuzQRAt3jcVTii8TNFw5Qoo`, READY). The
read-only production walk passed for the waiting-for-review path; **the completion suggestion's positive path
has not been observed in production**, so this record is not production-accepted. No Governance decision was
made and no work state was changed for this record. No schema, migration, authority, provider, data-use class
or model call changed.

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

## 4 · Production release (2026-10-26)

| Fact | Evidence |
|---|---|
| Pre-release | `origin/main` = `b47d85b2` (`git ls-remote`); `e7770d59` a fast-forward of it carrying exactly `14159026` and `e7770d59` |
| Push | `b47d85b2..e7770d59` fast-forward, refspec written as the literal SHA; `git ls-remote` then read `e7770d5924e2946190cf8e2c0d4af6ff945888a2` |
| Deployment | `dpl_F3mn4UuzQRAt3jcVTii8TNFw5Qoo`, target production, `READY` (Vercel CLI), created 2026-10-26 13:53 +03 by the Git integration on its own — no manual trigger, no second push |
| Deployment SHA | GitHub deployment `7329964102`: sha `e7770d5924e2946190cf8e2c0d4af6ff945888a2`, environment Production, state `success`, URL `hebun-ai-recovered-g1ue52krs-…`, the same deployment (the CLI's JSON carries no commit field) |
| Aliases | `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`, `hebun-ai-recovered-hebuntechs-projects.vercel.app`, `hebun-ai-recovered-git-main-hebuntechs-projects.vercel.app` |
| HTTP, signed out | `/` and `/login` 200; `/heby` and `/director/work` 307 → `/login` |

## 5 · Production observations (2026-10-26, read only)

Built-in browser, a session the Director signed in themselves, tenant hebun, on `dpl_F3mn4UuzQRAt3jcVTii8TNFw5Qoo`.
No credential was entered by this session. **No Governance decision was made** (nothing accepted, no change
requested), **no work state was declared or changed**, no model was called and nothing was created.

| Surface | Observed | Verdict |
|---|---|---|
| Heby, `/heby?workItem=5ba33201-fffa-4a41-864c-79cd567de635` | "This work is declared planned." · "At least one linked draft's current revision is waiting for review." · no declare control (`data-work-outcome="awaiting-review"`) · the draft line "Plan “Engineering implementation notes review checklist (final acceptance)” · revision 1 · written by Engineering Agent · waiting for review" · the assign button "Choose an agent to assign" (disabled) | PASS |
| Heby recommendation wording | Not rendered: the work's only specialist has a draft waiting, so no recommendation is made | NOT OBSERVED |
| Work register, `/director/work` | Three in-service items with linked drafts, each `awaiting-review` with "current revision waiting for review" per draft and the withheld reason; no suggestion and no "Declare complete" control; "AP-4B Production Acceptance Test" lists its two drafts separately (multiple evidence); no `evidence-unknown` | PASS |
| Operations, `d71f8383-da78-4637-8e09-e4b820f5ded2@1` | Row: "Governance review of revision 1: Awaiting review" · "Declared evidence for: AP-5 two-agent origination acceptance check · declared planned". History opened; "Accept for next internal step" opened the intent panel only, showing "For: AP-5 two-agent origination acceptance check · declared planned", the acceptance-is-not-completion sentence and the publication notice; "Record acceptance" stayed disabled with no justification entered; closed with Cancel; re-read "Awaiting review" | PASS |
| Completion suggestion, positive path | Needs an accepted current revision on every linked draft; none exists, and no decision is taken for the purpose of this test | NOT OBSERVED |

### React #418 on `/operations` (found during this walk; not caused by this phase)

`/operations` raises React #418 (server-rendered text did not match the client). Measured read only: a fresh tab
shows no error on `/command`, `/director/work`, `/heby?workItem=…` or `/agents`, and the error on `/operations`;
an iframe load of `/operations` reproduced it; an ordered text diff of the server HTML against the hydrated DOM
(801 to 801 text nodes) differs only in two "Generated" times of AI-generated images — server (UTC)
`9/17/2026, 10:07:07 PM` and `9/18/2026, 12:30:56 PM`, client (Europe/Istanbul) `9/18/2026, 1:07:07 AM` and
`9/18/2026, 3:30:56 PM`. Source: `src/components/operations-preparation/revision-media-assets.tsx:292`,
`new Date(asset.admittedAt).toLocaleString()` in a client component, from `2a065f82` (MEDIA-3, 2026-09-18), which
this phase did not touch. Effect: React discards the server HTML and renders `/operations` on the client; the time
shown is the browser's local time without a zone. No data, authority or Governance effect. Not fixed here
(MEDIA3-ADMITTED-AT-HYDRATION-1).

Correction: an earlier report of this session attributed #418 to `/command` and `/director/work` as well. The
browser pane's console accumulates across navigations in one tab; the same single entry had been re-read on each
page. The fresh-tab measurement above supersedes it.

## 6 · Remaining production acceptance conditions

1. An organic Governance decision accepting the current revision of the draft linked to `5ba33201`
   (`d71f8383@1`), taken for the work's own sake — never for this test.
2. After it, read only: the suggestion appears on Heby and the register; the work item's `declared_state` is
   unchanged; the acceptance created no permit and no action request.
3. Whether to declare the work complete is the Director's decision; if declared, read back the register and the
   `work.state-declared` audit row (`actor_type human`).
4. A later documentation change raises this record to PRODUCTION-ACCEPTED (scoped) on that evidence.

## 7 · Acceptance plan as written before release (kept)

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

## 8 · Not verified

- The completion suggestion's positive path in production, and the AE-2 recommendation wording (not rendered).
- Concurrency between a review decision and a declaration (both are separate human acts; the declaration
  writer locks the work row and re-asks its authority).

### Deferred risk detail

- **WOC1-BROWSER-UNVERIFIED-1 (DEFERRED).** The signed-in production read passed for the waiting-for-review path
  on all three surfaces (section 5). The positive path — a suggestion after every linked current revision is
  accepted — is unobserved. Dependency: section 6, after an organic Governance decision.
- **MEDIA3-ADMITTED-AT-HYDRATION-1 (DEFERRED).** `/operations` React #418 from
  `revision-media-assets.tsx:292` (section 5). Dependency: a Director-selected fix rendering the time
  deterministically (the released `utcInstant`, as APPROVALS-EXPIRY-HYDRATION-1 did) with a render-determinism test.
- **AE1-ASSIGN-UI-WORDING-1 (CLOSED).** Fixed in `14159026`; observed in production: the button reads "Choose an
  agent to assign" before a choice (section 5). The withheld-result wording is deployed and test-verified; no
  withheld result was provoked.
- **AE2-RECOMMENDATION-WORDING-1 (DEFERRED).** Fixed in `14159026` and deployed; the recommendation was not
  rendered in production (section 5). Dependency: a read-only render when Heby recommends a specialist organically.
- **AE2-VERCEL-GIT-TRIGGER-1 (DEFERRED).** The `e7770d59` push was deployed by the Git integration on its own
  (`dpl_F3mn4UuzQRAt3jcVTii8TNFw5Qoo`, GitHub deployment `7329964102` success). Why the `74a13247` push created
  none stays UNVERIFIED. Dependency: a read of the Vercel GitHub App deliveries for `74a13247`, or a Director
  decision to accept the unexplained miss.
- **WOC1-EVIDENCE-BOUND-1 (DEFERRED).** At 200 current evidence declarations in a tenant, every suggestion is
  withheld (`evidence-unknown`) on both surfaces. Dependency: a Director decision on a work-item-scoped evidence
  read when a tenant approaches the bound.

AE1-WITHHELD-DIAGNOSABILITY-1 is unchanged: the withheld message names the outcome, not the check.

**Weekly three.** *Learned:* a suggestion built from a bounded read must refuse at the bound, and the outcome of
work is a composition of three owners' answers, not a new state. *Turkish Rug House:* its owner sees on one line
which drafts for a piece of work were accepted and declares the work done themselves; nothing closes on its own.
*Hebun AI:* the request → agent draft → Governance review → human declaration loop is now readable end to end
without a new authority.

## Closure Contract (v1)

- Phase: WORK-OUTCOME-CLOSURE-1
- Owner: Work outcome composition (`work-outcome/contracts.ts`, `work-outcome/read-work-outcome-evidence.server.ts`) over Organizational Work (WORK-1, WEV-1), Work Artifacts and Governance artifact review (TRH-10, CGO-8); Heby work-draft affordance, Work register, Operations review card
- Reached state: DEPLOYED
- Implementation commit: 14159026
- Verification level: V2 — a shared read (Heby's agent-choice read) and three customer surfaces; no authority, tenant, lifecycle or execution boundary changed
- Verification evidence: outcome-postgres O1–O8 PASS; outcome-contract C1–C6 PASS; bite-proofs 9/9 caught; 52/52 affected files on the candidate (51/52 first run, the AE-1 import census updated in the same change); baseline 49/50 with work2-provider-disclosure/bite-proofs PRE-EXISTING flake (PASS 2/2 alone); tsc, eslint, git diff --check, npm run build PASS; full suite 1094/1095 with 0 REGRESSION, the one red r3w-flow/ambient-database-safety BLOCKED (canonical hebun_r1 :55432 not running), identical at baseline b47d85b2
- Test environment: worktree `.claude/worktrees/work-outcome-closure-1` (branch feat/work-outcome-closure-1, base b47d85b2); disposable detached worktrees `woc1-baseline`, `woc1-candidate`, `woc1-bite`; macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18.6 at 127.0.0.1:55433 (superuser admin) via HEBUN_TEST_ADMIN_DATABASE_URL with harness-created databases; no model, no network, no production database or provider
- Deployment evidence: dpl_F3mn4UuzQRAt3jcVTii8TNFw5Qoo — READY, target production, created by the Git integration for the push b47d85b2..e7770d59; GitHub deployment 7329964102 sha e7770d5924e2946190cf8e2c0d4af6ff945888a2 environment Production state success; aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: N/A — production acceptance pending: the read-only walk of 2026-10-26 passed the waiting-for-review path on Heby, the Work register and the Operations review card (section 5); the completion suggestion's positive path needs an organic Governance decision and is unobserved
- Deferred risks: WOC1-BROWSER-UNVERIFIED-1 (DEFERRED); WOC1-EVIDENCE-BOUND-1 (DEFERRED); MEDIA3-ADMITTED-AT-HYDRATION-1 (DEFERRED); AE1-ASSIGN-UI-WORDING-1 (CLOSED); AE2-RECOMMENDATION-WORDING-1 (DEFERRED); AE2-VERCEL-GIT-TRIGGER-1 (DEFERRED)
- Director approvals: discovery and milestone selection 2026-10-26; architecture decisions (no new authority, table or migration; setWorkDeclaredState authority kept; no automatic transition; ACCEPTED != COMPLETE; DECLARED COMPLETE != VERIFIED; acceptance authorizes no publication, sending or execution; tenant from trusted authentication) and the multiple-evidence rule 2026-10-26; local implementation, verification and commit 2026-10-26; production release of 14159026 and e7770d59, removal of woc1-baseline and woc1-candidate, and the read-only production acceptance walk 2026-10-26; the React #418 read-only investigation result accepted and its fix deferred 2026-10-26; this documentation update 2026-10-26; no Governance decision for the purpose of acceptance; push of this update, production data change and live model calls NOT approved
