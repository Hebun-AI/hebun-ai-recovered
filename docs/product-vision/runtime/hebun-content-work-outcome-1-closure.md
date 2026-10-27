# CONTENT-WORK-OUTCOME-1 · closure record · DEPLOYED — REAL PUBLICATION ACCEPTANCE PENDING

**Scope, stated first.** Authorized by the Director on 2026-10-27 ("GO — SCOPED IMPLEMENTATION"). A work
item whose evidence includes a content draft is no longer offered the completion suggestion on Governance
acceptance alone: the provider must have accepted a publication of that draft's current revision, to its
declared destination, as Hebun's action ledger records it. Plans and messages keep the released
WORK-OUTCOME-CLOSURE-1 rule. Released on 2026-10-27 ("GO — CONTROLLED RELEASE") and **deployed**; the
pending path renders in production from the live ledger, **the verified-publication path has not been
observed in production** (§4). No new agent,
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

**Release.** `git ls-remote` read `a806571f` immediately before the push; `c7754598` descends from it.
Fast-forward push `a806571f..c7754598` to `refs/heads/main` at 08:08:59Z on 2026-10-27, no force; remote
read back `c7754598c42a2586c41009e0eb9d6140973c1808`. Pre-push on the release commit: `tsc --noEmit` exit 0;
CWO-1 contract (8/8 bites) and WOC-1 outcome-contract PASS; CWO-1 P1–P7 and WOC-1 O1–O8 PostgreSQL PASS (this
session's PG 18.6, `system_identifier` 7701071965303287020); continuity PASS; `git diff --check` clean. The
affected-file regression and build (§3) were not rerun: code unchanged since.

**Deployment** (Vercel record, project `hebun-ai-recovered`): `dpl_8XSkAZrfMbCiUfAvK1ZQDUpvvsDs`, target
production, READY 2026-10-27T08:09:32.983Z, `githubCommitSha` `c7754598…`, ref `main`. Aliases
`www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`,
`hebun-ai-recovered-hebuntechs-projects.vercel.app`. Smoke: `/` 200, `/login` 200, apex 308; signed-out
`/director/work` and `/heby` 307. Runtime logs for the deployment: 16 × 200, 2 × 307, 0 × 5xx. READY is not
functional acceptance.

**Production UI, hebun tenant** (2026-10-27, Director-signed-in built-in browser, read-only — page loads
and DOM/bundle reads only; no decision, completion, model call or publication):

| Check | Result |
|---|---|
| Work register | 5 work items in service, no error; served bundle contains the new wording |
| Plans and messages unchanged | Two works with operational-plan drafts read `awaiting-review` with no publication line |
| Content work, live ledger | "Loom weaving reel — three knots per centimetre" (content draft, revision 1): `awaiting-review` · "no publication of this revision accepted by the provider yet" (`data-work-publication="pending"`) |
| Heby work view | AP-5 work renders "This work is declared planned. At least one linked draft's current revision is waiting for review." and its drafts; the scope-less Era III work shows its released "recorded without a work scope" notice |
| Verified-publication path | **UNVERIFIED** — no work in this tenant links a content draft whose current revision is accepted and published; no data was created to make one |

Observed, not attributed: the browser console held React #418 (hydration text mismatch) errors while on
`/heby`. They carry no timestamps that separate them from earlier page loads in the same tab; no Heby file
changed in this release. Not investigated (Director scope).

**TRH readiness: UNVERIFIED.** The signed-in session is in the hebun tenant; it was not switched.

## Closure Contract (v1)

- Phase: CONTENT-WORK-OUTCOME-1
- Owner: apps/dashboard/src/features/work-outcome (rule and composition) and apps/dashboard/src/components/organizational-work/work-register.tsx; Action Authorization's publication projection, Organizational Work, Work Artifacts, Governance and the declaration writer unchanged
- Reached state: DEPLOYED
- Implementation commit: 329db5225371f5d34703e874b9ae2af28a01a626 — released to main by fast-forward a806571f..c7754598
- Verification level: V2 — shared outcome read gains a read-only projection; no authority, tenant, lifecycle, schema or execution boundary moved
- Verification evidence: 2026-10-27, affected files baseline 63/63 and candidate 65/65 in disposable detached worktrees; tests/content-work-outcome-1/contract.ts PASS with 8/8 bites; tests/content-work-outcome-1/outcome-postgres.ts P1–P7 PASS; work-outcome-closure-1 O1–O8 PASS; tsc, eslint, git diff --check exit 0; npm run build exit 0
- Test environment: worktree .claude/worktrees/content-work-outcome-1 (npm ci, published lockfile); disposable cwo1-baseline and cwo1-candidate; macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701071965303287020, via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider
- Deployment evidence: dpl_8XSkAZrfMbCiUfAvK1ZQDUpvvsDs — production, READY 2026-10-27T08:09:32.983Z, githubCommitSha c7754598c42a2586c41009e0eb9d6140973c1808, aliases www.hebuntech.com and hebuntech.com; / and /login 200; 0 × 5xx
- Production acceptance evidence: N/A — real publication acceptance pending: the pending path renders from the live ledger in production; the verified-publication path is UNVERIFIED (§4)
- Deferred risks: CWO1-TRH-READINESS-1 (DEFERRED); CWO1-REAL-PUBLICATION-PATH-1 (DEFERRED); CWO1-UNPUBLISHED-CONTENT-WITHHOLDS-1 (DEFERRED)
- Director approvals: scoped implementation in an isolated worktree, targeted and regression tests, local commit, 2026-10-27; controlled production release with read-only UI acceptance, 2026-10-27; Governance decisions, model calls, publication and work completion NOT approved

### Deferred risk detail

- **CWO1-TRH-READINESS-1 (DEFERRED).** TRH production readiness not read (§4). Acceptance dependency: a
  read-only signed-in pass in the TRH tenant.
- **CWO1-REAL-PUBLICATION-PATH-1 (DEFERRED).** The verified and failed paths are proven on the projection's
  answers, not on a publication executed in the same test or in production. In production the pending
  path is observed (§4); no content work with an accepted, published current revision exists in the hebun
  tenant. Acceptance dependency: a read-only production render of a work whose content draft has a
  provider-accepted attempt for its current revision.
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
