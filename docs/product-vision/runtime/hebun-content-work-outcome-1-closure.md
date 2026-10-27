# CONTENT-WORK-OUTCOME-1 · closure record · VERIFIED (local) — RELEASE APPROVAL REQUIRED

**Scope, stated first.** Authorized by the Director on 2026-10-27 ("GO — SCOPED IMPLEMENTATION"). A work
item whose evidence includes a content draft is no longer offered the completion suggestion on Governance
acceptance alone: the provider must have accepted a publication of that draft's current revision, to its
declared destination, as Hebun's action ledger records it. Plans and messages keep the released
WORK-OUTCOME-CLOSURE-1 rule. Verified locally only: **nothing was pushed or deployed**. No new agent,
dashboard, table, migration, authority, provider capability, Governance decision or model call. The
declaration stays the Organizational Work Authority's existing human act. WORK-OUTCOME-CLOSURE-1 is not
reopened; its record stands as written.

## 1 · Contract gate (answered before any code)

**A. Can publication-required work be told apart from draft-only work?** Yes, structurally — through the
artifact the work declares as its evidence, not through the work item. `content-draft` is the one artifact
type that must declare a destination: `validation.ts` `checkIntendedDestination` refuses a content draft
without one and refuses a destination on every other type, and two database CHECKs enforce the same
(`contracts.ts` `CreateWorkArtifactInput.intendedDestination`). The listing returns
`intendedDestination` (`null` = "not a content draft"). No title or free text is read. The work item
itself carries no publication attribute; the evidence declaration (WEV-1) is the link.

**B. Can a successful publication be matched to the right work, artifact and revision?** Yes. Publish
proposals record `target_ref = work-artifact/<id>@<n>`; `readRevisionPublicationHistory` joins request →
permit → attempt with a tenant predicate on every join and filters on that exact reference
(`content-publication-state.server.ts`). An attempt's `status = accepted` with `provider_message_id` is the
provider's answer. Work → artifact is the WEV-1 evidence declaration; artifact → revision is the artifact
authority's `currentRevision`.

## 2 · What changed (`329db522`)

| File | Change |
|---|---|
| `work-outcome/contracts.ts` | `WorkPublicationStatus` (`verified` · `pending` · `failed` · `unavailable`); pure `workPublicationStatus(state, destination)`; `suggestCompletion` adds `publication-unavailable`, `publication-failed`, `publication-pending` after the review reasons, for content drafts only; wording |
| `work-outcome/read-work-outcome-evidence.server.ts` | Asks `readContentPublicationStates` once, for the current revisions of content drafts only, under the session tenant; a throw or an unanswered revision reads `unavailable` |
| `organizational-work/work-register.tsx` | A content draft's line shows its publication state beside its review |
| `tests/work-outcome-closure-1/outcome-contract.ts` | Pin narrowed with its reason: the reader may name the read-only publication projection exactly once; every other Action Authorization and Action Execution module stays refused |
| `tests/content-work-outcome-1/contract.ts`, `outcome-postgres.ts` | New |

**The reduction.** `verified` only for an entry at stage `execution-accepted`, attempt `accepted`, a
non-null provider id and the draft's own destination. Otherwise: `unavailable` when the ledger was not
read (`unknown`, missing, a throw, the projection's 50-revision bound), when the history was truncated
without an accepted attempt, or when the destination has no publication route (TikTok);
`failed` when the latest entry is an attempt that failed, was refused or is unknown; else `pending`
(no request, a pending or rejected request, an active or expired permit, an attempt started). Governance
acceptance, approval and a permit are never publication. Measurement is not a condition.

Heby shows the new withheld reasons through the existing `COMPLETION_WITHHELD_TEXT`; Heby and the
register still call the one rule and agree (asserted in P2–P3).

## 3 · Verification (V2)

V2: a shared read (the outcome composition both Heby and the register use) gains a second authority's
read-only projection. No authority, tenant, lifecycle, schema or execution boundary moved, so the full
suite was not run; every test file naming a touched module was.

| Check | Result (2026-10-27) |
|---|---|
| Baseline, 63 affected files, disposable detached `cwo1-baseline` at unchanged `a806571f` | 63/63 PASS |
| Candidate, same 63 + 2 new, disposable detached `cwo1-candidate` | 65/65 PASS, zero REGRESSION; source-mutating bite-proofs restored their files (status showed only this change) |
| `tests/content-work-outcome-1/contract.ts` | PASS — R1–R7, surface, 8/8 in-memory bites (publication ignored; permit counted; any destination; truncation ignored; missing read as pending; failures read as pending; plans swept in; TikTok assumed publishable) |
| `tests/content-work-outcome-1/outcome-postgres.ts` | PASS — P1 draft-only unchanged; P2 accepted content draft, REAL ledger, `publication-pending`, no request filed by reading; P3 plan does not cover content; P4 tenant isolation; P5 15 ledger answers through the real composition; P6 only content revisions, under the caller's tenant; P7 no database |
| `tests/work-outcome-closure-1/outcome-postgres.ts` O1–O8 | PASS |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check` | exit 0 |
| `npm run build` | exit 0 (175 static pages) |

**Test environment.** macOS Darwin 25.2.0; PostgreSQL 18.6 initialised by this session in its scratchpad
on 127.0.0.1:55499 (`system_identifier` 7701071965303287020) via `HEBUN_TEST_ADMIN_DATABASE_URL`;
`DATABASE_URL` unset; disposable databases; no production database, no provider, no network.

**Not covered by execution.** P5 feeds the projection's answers to the real composition; a real executed
publication is not driven in this test (the projection is proven against released writers by
`content-publication-state-1/publication-postgres.ts`). No browser render.

## 4 · Production

Not released, not deployed. `main` = `a806571f` at the start of this phase.

**TRH readiness: UNVERIFIED.** The only signed-in session is in the hebun tenant; switching it to TRH
changes session state and was not authorized. Agent mandate and work scope, AI assistance Governance,
publication capability, publish arming and existing TRH work/artifact/publication links were not read.

## Closure Contract (v1)

- Phase: CONTENT-WORK-OUTCOME-1
- Owner: apps/dashboard/src/features/work-outcome (rule and composition) and apps/dashboard/src/components/organizational-work/work-register.tsx; Action Authorization's publication projection, Organizational Work, Work Artifacts, Governance and the declaration writer unchanged
- Reached state: VERIFIED
- Implementation commit: 329db5225371f5d34703e874b9ae2af28a01a626 — local branch feat/content-work-outcome-1 on a806571f, not pushed
- Verification level: V2 — shared outcome read gains a read-only projection; no authority, tenant, lifecycle, schema or execution boundary moved
- Verification evidence: 2026-10-27, affected files baseline 63/63 and candidate 65/65 in disposable detached worktrees; tests/content-work-outcome-1/contract.ts PASS with 8/8 bites; tests/content-work-outcome-1/outcome-postgres.ts P1–P7 PASS; work-outcome-closure-1 O1–O8 PASS; tsc, eslint, git diff --check exit 0; npm run build exit 0
- Test environment: worktree .claude/worktrees/content-work-outcome-1 (npm ci, published lockfile); disposable cwo1-baseline and cwo1-candidate; macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701071965303287020, via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released
- Deferred risks: CWO1-TRH-READINESS-1 (DEFERRED); CWO1-REAL-PUBLICATION-PATH-1 (DEFERRED); CWO1-UNPUBLISHED-CONTENT-WITHHOLDS-1 (DEFERRED)
- Director approvals: scoped implementation in an isolated worktree, targeted and regression tests, local commit, 2026-10-27; push, deployment, Governance decisions, model calls and publication NOT approved

### Deferred risk detail

- **CWO1-TRH-READINESS-1 (DEFERRED).** TRH production readiness not read (§4). Acceptance dependency: a
  read-only signed-in pass in the TRH tenant.
- **CWO1-REAL-PUBLICATION-PATH-1 (DEFERRED).** The verified and failed paths are proven on the projection's
  answers, not on a publication executed in the same test or in production. Acceptance dependency: a
  read-only production render of a work whose content draft has a provider-accepted attempt.
- **CWO1-UNPUBLISHED-CONTENT-WITHHOLDS-1 (DEFERRED).** A content draft that was never meant to be
  published through Hebun (published elsewhere, or TikTok) withholds the suggestion for good; the person
  can still declare the work complete through Change → Declare state. Acceptance dependency: a Director
  decision only if this proves to be a real workflow.

**Weekly three.** *Learned:* the work item does not say what its deliverable is, but the evidence it
declares does — a content draft must name a destination, so the ledger's answer for that exact revision
is the outcome. *Turkish Rug House:* a TRH content task is no longer suggested complete the moment its
caption is accepted; it waits for the post the provider accepted. *Hebun AI:* the outcome read now spans
Work, Governance and Action Authorization without a new authority, and fails closed on every unread
answer.
