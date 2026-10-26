# HEBY-WORKFLOW-1 · closure record · DEPLOYED — PRODUCTION ACCEPTANCE PENDING

**Scope, stated first.** When Governance requests changes on an agent's draft linked to a work item, the person
can stay on that work in Heby: read the change request, choose a responsible agent explicitly and give an
instruction; the agent writes the next revision through the released preparation seam at the work item's own
scope, and the new revision returns to Governance review. Implemented and verified in `94627e04`, released and
**deployed** (`dpl_C6i4qh1dewV9KDuHsmqEdU4j1H7E`, READY). **Production behaviour UNVERIFIED** — no revision has
been made in production (section 5). No table, migration, provider, data-use
class or authority was added; no Governance decision, work state or production record was changed.

## 1 · Problem (discovery 2026-10-26, at `59c00b99`)

- **The review loop stopped at "changes requested" for agent work.** The internal-draft brief ignored the
  current revision (AE-2), so a plan or message could not be revised by a model at all; Operations offers
  "Prepare revision with Hebun" for content drafts only; Operations prepares at organization scope, so a
  domain-only specialist is refused (`work-outside-agent-responsibility`); and Heby counted the draft as open
  (`draft-open`) and sent the person to Operations, where no path existed. The only way forward was a manual
  human revision or retiring the draft.

## 2 · What was implemented

- **`work-artifacts/preparation-brief.ts` (D1).** An internal draft with a current revision gets the CGO-9
  revision framing (`revisionInstruction`, minted from an integer, now naming the draft kind) in the
  instruction channel and the revision text as SCI-1 **material** only. Content-draft bytes are unchanged; an
  internal draft without a revision is unchanged; the observation supplement still never attaches to it.
- **`agent-work/assign-work-draft.server.ts` — `reviseWorkDraft`.** Before the model: tenant → work item (in
  service, scoped) → the person's Governance authority → the revision and the change request the person read
  (both required) → an explicitly named agent eligible under the shared ceiling for the work's scope → under a
  per-draft advisory lock (`hebun.agent-work.revise`, tenant × artifact): the draft is declared as THIS work's
  evidence, not retired, and its current revision's latest decision is `changes-requested`. Then
  `prepareWorkArtifact` with the stored type and title, `expectedRevisionNo`, `reviewBasisDecisionId`,
  the agent and the work item's recorded scope. Afterwards the work, its scope, the link and the agent's
  eligibility are read again (`prepared-stale`). It links, reviews and declares nothing.
- **`work-artifacts/prepare-work-artifact.server.ts` (2 lines).** Under the revision writer's artifact lock the
  seam now asks the requester's right to revise from the review (`mayReviseFromReview`) together with the
  review basis; before, it was asked only before the model. This applies to every revise-from-review path,
  including Operations content drafts (CONTENT-AGENT-2); it narrows, never widens.
- **Heby (`heby-work-draft-affordance.tsx`, `work-state-origination-actions.ts`).** For a linked draft with a
  change request and a Governance holder: "Show the change request and ask an agent to revise" reads the reason
  through the existing CONTENT-AGENT-2 read (Governance only); "Use this reason as my instruction" copies it for
  the person to edit; Heby suggests the current revision's author while it is still responsible ("You decide
  who revises it"); the agent select starts empty and nothing is asked without an explicit choice (D2); a
  failure says the current revision and its change request are unchanged.
- **D2 as implemented:** the author is suggested; any agent responsible for the work may be chosen explicitly.
- **Pins changed with their reasons:** `cgo9-hebun-preparation/surface-and-firewall.ts` (a message revision now
  carries its text as material, never instruction — Director decision D1); `agent-execution-1/capability-contract.ts`
  (the seam's own statements are two advisory locks, still no row or write).

## 3 · Verification (V3)

V3: an authority re-check moved into a shared writer seam used by every revise-from-review path, agent
authorship of revisions now reaches domain scope, and the instruction channel gained material for two more types.

| Check | Result |
|---|---|
| Baseline, 47 affected files, unchanged `59c00b99`, disposable `hw1-baseline` | 47/47 |
| `tests/heby-workflow-1/revision-postgres.ts` W1–W14, real PostgreSQL 18, fake transport | PASS — specialist revises its own plan at domain scope (one call, revision 2 by the agent, text verbatim, revision 1 unchanged, revision text only below the grounding delimiter, the reason never sent on its own); Operations refuses the same agent before the model; revision returns to review and WOC-1 waits for its acceptance; another work's and an unlinked draft refused; cross-tenant refused; superseded basis, wrong revision, no basis refused with zero calls; awaiting/accepted refused; five simultaneous requests across two connection pools → one call, one revision, four `revision-in-progress`; provider failure files nothing and the change request stands; mandate withdrawn mid-call and delegated Governance revoked mid-call file nothing; member, no agent, ineligible agent refused; coordinator chosen explicitly may revise; injected earlier text stays fenced material |
| `tests/heby-workflow-1/revision-contract.ts` C1–C4 | PASS |
| Candidate, affected files plus the three new ones, disposable `hw1-candidate` | 50/50 (first run 47/49: the two pins above, changed with their reasons) |
| Bite-proofs (disposable `hw1-candidate`) | HEBY-WORKFLOW-1 7/7 (material channel, D1, scope, link, change request, lock, writer-lock authority); AE-1 5/5; CONTENT-AGENT-2 11/11 |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check`, `npm run build` | PASS (build on the final source) |
| Full suite (`node scripts/run-tests.mjs`, candidate copy) | 1098/1100, 0 confirmed REGRESSION. `r3w-flow/ambient-database-safety` **BLOCKED** (canonical `hebun_r1` at 127.0.0.1:55432 not running) — environmental, not a pass. `plan-step-idempotency-1/bite-proofs` red: **PRE-EXISTING FLAKE — ROOT CAUSE UNVERIFIED** (red 1 of 6 runs on unchanged `59c00b99`; 2/2 PASS alone on the candidate; reaches none of the changed modules; in the candidate run its B1 mutation failed on I3 rather than its intended assertion; the baseline red's message was not captured) |

## 4 · Production release (2026-10-26)

| Fact | Evidence |
|---|---|
| Pre-release | `git fetch` and `git ls-remote`: `origin/main` = `59c00b99`; `94627e04` its only child, a fast-forward; no migration, schema or package path; no other local branch ahead of `59c00b99`; production aliases on `dpl_66XDK7e6x2NTyzBYKAEZrAYidx3e` (the `59c00b99` deployment) |
| Push | `59c00b99..94627e04` fast-forward, refspec written as the literal SHA, no force; `git ls-remote` then read `94627e042863da5562de9ef8b7eec14831ffc349` |
| Deployment | `dpl_C6i4qh1dewV9KDuHsmqEdU4j1H7E`, target production, `READY`, created 2026-10-26 21:07 +03 by the Git integration on its own |
| Deployment SHA | Vercel API (`/v13/deployments/…?withGitRepoInfo=true`): `source: git`, `githubCommitSha` `94627e042863da5562de9ef8b7eec14831ffc349`, ref `main`; `vercel ls --meta githubCommitSha=94627e04…` returns this one deployment, `59c00b99` returns `cd1jinjci`, an all-zeros control returns the unfiltered list (21) |
| Aliases | `www.hebuntech.com` and `hebuntech.com` → `dpl_C6i4qh1dewV9KDuHsmqEdU4j1H7E` |
| HTTP, signed out | `/`, `/login` 200; `/heby`, `/operations`, `/director/work` 307 → `/login` |
| Runtime log, first 15 minutes | 21 records (`/`, `/login`, `/contact`), 0 at error level, 0 with a 5xx status |

**What this is not.** READY, the SHA and the aliases prove what is served, not that the revision flow works in
production. No signed-in surface was read and no credential was entered; no Governance decision, artifact,
revision, work-state change, model call or production record was made for this record. Operations content-draft
revise-from-review (the shared writer seam) is covered by CONTENT-AGENT-2's suites and 11/11 bite-proofs on the
candidate, not by a production observation (HW1-WRITER-AUTHORITY-RECHECK-1).

### Deferred risk detail

- **HW1-PROD-UNVERIFIED-1 (DEFERRED).** Deployed (`dpl_C6i4qh1dewV9KDuHsmqEdU4j1H7E`); production UI and
  revision flow unobserved. Dependency: section 5.
- **HW1-WRITER-AUTHORITY-RECHECK-1 (DEFERRED).** The writer-lock Governance re-check also governs Operations
  content-draft revise-from-review (CONTENT-AGENT-2); its suites and bite-proofs pass, but a production content
  revision from a review has not been observed since. Dependency: the next organic content-draft revision from a
  review, read back.
- **HW1-REVISION-STALE-1 (DEFERRED).** If the work item is retired or re-scoped, the link withdrawn, or the agent
  stops being responsible while the model writes, the revision is filed and reported `prepared-stale` (AE-1's
  pattern); it waits for review like any revision. Dependency: a Director decision if such revisions are observed.
- **HW1-OPERATIONS-INTERNAL-REVISION-1 (DEFERRED).** Operations still offers model revision for content drafts
  only, at organization scope; plan and message revisions exist only through Heby on their work item.
  Dependency: a Director decision.
- **HW1-PSI-BITE-FLAKE-1 (DEFERRED).** `plan-step-idempotency-1/bite-proofs` fails intermittently on unchanged
  code; root cause UNVERIFIED. Dependency: a captured failing run on an unchanged tree.
- **Still open in their own records, unchanged:** AE1-UNLINKED-SECOND-DRAFT-1, AE2-DOMAIN-SPECIALTY-1,
  AE2-DECLINED-DRAFT-FILED-1 (a revision that declines in prose is filed like any draft).

## 5 · Production acceptance evidence required

1. Push and deployment under their own Director gate; the deployment record read for the pushed SHA — done (section 4).
2. In tenant hebun, a Director-recorded change request on an agent's linked draft; on Heby the reason shown,
   no agent preselected, the author suggested.
3. One Director-approved model call: revision N+1 authored by the chosen agent, "awaiting review", work state
   unchanged, one `work-preparation-model-outcome` line whose `messageId` resolves to that tenant's message row.

**Weekly three.** *Learned:* a re-check is only as late as the lock it runs under — the requester's right must be
asked inside the writer's lock with the review basis, not only before the model. *Turkish Rug House:* when its
reviewer asks for changes, its agent revises the same draft on the same work instead of the work stalling.
*Hebun AI:* the Governance review loop is now closed for agent work: request changes, revise, review again.

## Closure Contract (v1)

- Phase: HEBY-WORKFLOW-1
- Owner: Agent work capability (`agent-work/assign-work-draft.server.ts` `reviseWorkDraft`) composing Work Artifacts preparation (`prepare-work-artifact.server.ts`, `preparation-brief.ts`), Governance artifact review (CONTENT-AGENT-2 change request), Agent Mandate's shared ceiling and Organizational Work (WEV-1); Heby work-draft affordance
- Reached state: DEPLOYED
- Implementation commit: 94627e042863da5562de9ef8b7eec14831ffc349
- Verification level: V3 — an authority re-check in a shared writer seam used by every revise-from-review path, agent revision authorship at domain scope, and instruction-channel material for internal drafts
- Verification evidence: revision-postgres W1–W14 PASS; revision-contract C1–C4 PASS; baseline 47/47 at 59c00b99; candidate 50/50 (47/49 first run, two pins changed with stated reasons); bite-proofs HW1 7/7, AE-1 5/5, CONTENT-AGENT-2 11/11; tsc, eslint, git diff --check, npm run build PASS; full suite 1098/1100 with 0 confirmed REGRESSION, r3w-flow/ambient-database-safety BLOCKED (canonical hebun_r1 :55432 not running), plan-step-idempotency-1/bite-proofs PRE-EXISTING FLAKE — ROOT CAUSE UNVERIFIED (red 1/6 on unchanged 59c00b99)
- Test environment: worktree `.claude/worktrees/heby-workflow-1` (branch feat/heby-workflow-1, base 59c00b99); disposable detached worktrees `hw1-baseline`, `hw1-candidate` (removed after use); macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18.6 at 127.0.0.1:55433 via HEBUN_TEST_ADMIN_DATABASE_URL with harness-created databases; fake model transport; no network, no production database or provider
- Deployment evidence: dpl_C6i4qh1dewV9KDuHsmqEdU4j1H7E — READY, target production, source git sha 94627e042863da5562de9ef8b7eec14831ffc349 ref main, created by the Git integration for the push 59c00b99..94627e04; aliased to www.hebuntech.com and hebuntech.com; signed-out HTTP / and /login 200, /heby, /operations, /director/work 307 → /login; runtime log 21 records, 0 error, 0 5xx in the first 15 minutes
- Production acceptance evidence: N/A — production acceptance pending: no signed-in surface read, no change request, revision or model call made in production; the deployment SHA is not proof of behaviour
- Deferred risks: HW1-PROD-UNVERIFIED-1 (DEFERRED); HW1-WRITER-AUTHORITY-RECHECK-1 (DEFERRED); HW1-REVISION-STALE-1 (DEFERRED); HW1-OPERATIONS-INTERNAL-REVISION-1 (DEFERRED); HW1-PSI-BITE-FLAKE-1 (DEFERRED)
- Director approvals: discovery report accepted and HEBY-WORKFLOW-1 implementation authorized with decisions D1 (revision text through SCI-1 material only) and D2 (author suggested, explicit choice, no model call without it) 2026-10-26; implementation report accepted, documentation and one local commit approved 2026-10-26; controlled push of 94627e04 with its automatic production deployment, deployment verification and this documentation update approved 2026-10-26; Governance change requests, artifact or revision changes, live model calls, work lifecycle changes and production test data NOT approved
