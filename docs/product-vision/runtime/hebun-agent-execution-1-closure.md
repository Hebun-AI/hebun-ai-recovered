# AGENT-EXECUTION-1 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope, stated first.** A person can assign a responsible agent one bounded task on a work item — write
one draft — from Heby, link the draft to the work as its evidence, and read the task back from the records
that hold it. Every agent named as a draft's author, on every preparation path, is now held to the one
shared mandate ceiling, and concurrent assignments of the same (work item, agent) are serialised. Released
in production deployment `dpl_GV6optZcPTv78sXoSL7RteEnN99E` (commits `ca8b12cc`, `106e54bd`). Accepted on
one Director-approved live assignment with a real model call in tenant hebun and one observed mandate
refusal (section 6). Design and inventory: `hebun-agent-execution-1-design.md`.

## 1 · Problem

- **No bounded agent work.** Heby could ask an agent to *propose*; a person could not assign an agent to
  *do* a bounded task for a work item.
- **AE1-OPERATIONS-AUTHOR-MANDATE-1.** The Operations preparation path recorded any in-service agent as a
  draft's author with no mandate or responsibility bound — the one agent-authored work path outside the
  shared ceiling.
- **AE1-CONCURRENT-ASSIGNMENT-DUPLICATE-1.** The assignment's open-draft rule was read-then-act: two
  simultaneous assignments of the same agent to the same work both passed and both spent a model call.

## 2 · What was released

- **`ca8b12cc` — the workflow.** `agent-work/capabilities.ts` declares the work capability
  `prepare-work-draft` (side effect `PREPARATION_ONLY`, data use `assistance` × conversation, work-artifact,
  completion = Governance acceptance). `assignWorkDraft` asks tenant → work item (in service, scoped) →
  the requester's Governance authority → the agent's eligibility → no open draft, all before the model;
  calls the released `prepareWorkArtifact`; asks the work and the agent's eligibility again afterwards
  (`prepared-stale`). Heby's affordance on `/heby?workItem=…` offers only responsible agents, states what
  the agent cannot do, and offers "Link this draft to the work" — the person's own WEV-1 act. No table, no
  task state, no new authority.
- **`106e54bd` — hardening.** `prepareWorkArtifact`, the seam every preparation path calls, asks
  `refuseOutsideAgentWorkCapability` (built only from `refuseOutsideAgentMandate` and
  `refuseOutsideAgentResponsibility`) of the named author before the model and again before filing
  (`agent-mandate-changed-while-preparing`). The scope is a server-side dependency, never an input field:
  the assignment seam passes the work item's recorded scope; Operations drafts are organization work and
  need organization-level responsibility. `assignWorkDraft` holds a transaction-scoped
  `pg_try_advisory_xact_lock` on (tenant, work item, agent) from the open-draft read until the draft is
  filed; a second request in flight is refused `assignment-in-progress` before the model. No schema,
  migration, package, Governance, provider or authentication change.

## 3 · Verification (V3)

V3: an authority boundary (who may be recorded as an agent author) changed in a shared seam used by every
preparation path, plus a concurrency control; full suite and bite-proofs required.

| Check | Result |
|---|---|
| `tests/agent-execution-1/assignment-postgres.ts` E1–E16, real PostgreSQL, fake model transport | PASS — E13 Operations ceiling (no mandate · send-only · domain-only refused with zero calls; a client `workScope` field widens nothing; revisions held to the same ceiling); E14 mandate withdrawn mid-call files nothing; E15 five simultaneous assignments across two connection pools → 1 model call, 1 draft, 4 `assignment-in-progress`, a second agent not blocked; E16 a thrown assignment releases its lock |
| `tests/agent-execution-1/capability-contract.ts` | PASS |
| `tests/agent-execution-1/bite-proofs.ts` (B1–B5) | 5/5 caught, 0 void; `ca8b12cc` session bite-proofs 13/13 |
| Affected suites (131 files), census pins ama1 · ama2 · AP-4B F1/F2 · CGO-3 · CGO-9, 11 preparation fixtures given a mandate | PASS; each pin edit states its reason; no check relaxed |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check` | PASS; `npm run build` PASS at `ca8b12cc` |
| Full suite (`node scripts/run-tests.mjs`, PG18) | 1090/1091; the one red `r3w-flow/ambient-database-safety` BLOCKED (canonical `hebun_r1` stopped), identical at baseline `16459905` |
| `r3w-flow/ambient-database-safety`, run alone | PASS — canonical PG14 started with `default_transaction_read_only=on` (a temp table refused); `hebun_r1` fingerprint before = after: 53 migrations, digest `6e1388be…`, 2 artifacts, 2 revisions, WAL LSN `90/787F2F08`; instance stopped again |

## 4 · Production mandate compatibility (pre-release)

Read-only `/agents` renders in a session the Director signed in themselves; the write-capable ceremony
credential was declined by the Director and not used.

| Tenant | Agents in service | Compatible with the Operations ceiling | Refused |
|---|---|---|---|
| hebun | 2 | Heby (rev 5: send, record-work, set-work-declared-state; organization + Engineering) | Engineering Agent (rev 1: record-work; Engineering only) — `/operations` drafts only; its Engineering work stays reachable through assignment |
| TRH | 1 | Heby (rev 2: record-work; organization + Marketing) | none |
| Mulify | 0 | — | none (Operations preparation already refused: `no-durable-agent-identity`) |

No running Operations workflow lost its last eligible author. Tenants the Director is not a member of were
not observed (AE1-NONMEMBER-TENANT-COMPAT-1).

## 5 · Production release

| Fact | Evidence |
|---|---|
| Pre-release | `origin/main` = `16459905`; `106e54bd` two commits ahead, fast-forward; no migration, schema or package path |
| Push | `16459905..106e54bd` fast-forward; `git ls-remote` reads `106e54bd66497e94e80e1d78bdb6e5e92c8fc565` |
| Deployment | `dpl_GV6optZcPTv78sXoSL7RteEnN99E`, target production, `READY` (Vercel CLI); GitHub deployment `7316257481` sha `106e54bd66497e94e80e1d78bdb6e5e92c8fc565`, environment Production, state `success` |
| Aliases | `www.hebuntech.com`, `hebuntech.com` on this deployment |
| HTTP, signed out | `/` and `/login` 200; `/agents` and `/operations` 307 → `/login` |
| Runtime logs | not read |

## 6 · Production acceptance (2026-10-25)

Built-in browser, a session the Director signed in themselves, tenant hebun (organization `f625b683…`);
work item "AP-4B Production Acceptance Test" (`92e70b3e…`, an existing test item). Each model call was
approved individually by the Director.

| Step | Observed | Verdict |
|---|---|---|
| Assignment 1 — Heby, Plan, "three-step plan for verifying an internal software release in production …" | server result `not-prepared` · `no-model-answer` · `modelFallback.kind: withheld`: the provider answered and the shared response validator withheld the answer; no artifact (Prepared work 7 → 7). The validator's issues are not persisted (AE1-WITHHELD-DIAGNOSABILITY-1); a forbidden action claim (`deployed`, `executed`, `approved`) is the likely cause, reproduced locally on plan-like sentences, UNVERIFIED for the production text | FAIL, not retried |
| Operations comparison — Heby, content draft, same instruction | `refused` · `no-model-answer` · `public-knowledge-blocked / no-public-eligible-knowledge`: KT-5 stopped it before the model; nothing written | Not discriminating |
| Engineering Agent on `/operations` | `{"status":"refused","reason":"work-outside-agent-responsibility"}`; shown "The chosen agent is not responsible for this work … Hebun was not asked, and nothing was written."; Prepared work 7 → 7 | VERIFIED |
| Assignment 2 — Heby, Plan, "Prepare a three-step checklist for reviewing this week's internal notes." | `{"status":"prepared","artifactId":"09550491-f0f1-43d3-9d80-4614fd5d2eb1","revisionNo":1,"agentName":"Heby"}` — `prepared` is returned only for model-origin, durably persisted text; Operations lists "Weekly internal notes review checklist · operational-plan · revision 1 · Written by this organization's durable agent"; Prepared work 7 → 8 | VERIFIED |
| Link | "You linked the draft to this work as its evidence. It waits for review in Operations." (WEV-1 human action) | VERIFIED |
| Review stage | "Governance review of revision 1: Awaiting review"; no Governance decision recorded, work state unchanged | VERIFIED |

Process note: the link control was clicked by element reference before reading its label; it was the link
control and the outcome was read back, but the step was not confirmed in advance.

## 7 · Not verified in production

- Concurrent assignment (`assignment-in-progress`) and the mid-call mandate withdrawal: proven by E14–E16
  against real PostgreSQL; not provoked in production.
- Production runtime logs and the served build marker beyond the alias record.

### Deferred risk detail

- **AE1-OPERATIONS-AUTHOR-MANDATE-1 (CLOSED).** Fixed in `106e54bd`, deployed in
  `dpl_GV6optZcPTv78sXoSL7RteEnN99E`; observed in production (section 6, Engineering Agent).
- **AE1-CONCURRENT-ASSIGNMENT-DUPLICATE-1 (CLOSED).** Fixed in `106e54bd`; proven by E15 across two
  connection pools and bite-proof B3; not provoked in production.
- **AE1-WITHHELD-DIAGNOSABILITY-1 (DEFERRED).** On the `withheld` path the validator's issues are
  discarded (`model-answer.server.ts`), so a withheld preparation cannot be diagnosed from production.
  Dependency: a Director-selected change recording issue codes only — never the withheld text — on the
  existing invocation record or server log.
- **AE1-DRAFT-ACTION-CLAIM-RULE-1 (DEFERRED).** The response validator's forbidden action claims, written
  for Heby's own voice, also apply to drafts, where "is deployed" or "was approved" is ordinary plan text;
  such drafts are withheld after a spent model call. Dependency: a Director architecture decision; the
  validator is not relaxed by this phase.
- **AE1-ASSIGN-UI-WORDING-1 (DEFERRED).** The assignment button reads "Assign to The agent" before an agent
  is chosen, and a `withheld` result is shown only as the generic "Hebun did not return a model-written
  draft" without its reason. Dependency: a Director-selected UI wording change.
- **AE1-MEDIA-AUTHORSHIP-MANDATE-1 (DEFERRED).** Image and video generation
  (`request-media-generation.server.ts`, `async-generation-lifecycle.server.ts`) record a named in-service
  agent as author with no mandate bound; media is not a work capability in this contract and its authority
  excludes Governance by design. Dependency: a Director decision on the media authorship authority boundary.
- **AE1-UNLINKED-SECOND-DRAFT-1 (DEFERRED).** After a draft is filed and before the person links it, a
  deliberate second assignment can still write a second draft: nothing records which work an unlinked draft
  was for, and no table was added. Dependency: a Director decision if unlinked duplicates are observed.
- **AE1-NONMEMBER-TENANT-COMPAT-1 (DEFERRED).** Mandate compatibility was measured only in the Director's
  member tenants (hebun, TRH, Mulify). Dependency: a read-only access path for other tenants, if any exist.

**Behaviour change, intended.** A draft in Operations is written only by an agent whose mandate admits work
drafting and whose responsibility covers the organization; a domain-only agent drafts only for its domain's
work, through assignment. Two simultaneous assignments of one agent to one work produce one draft.

**Weekly three.** *Learned:* agent authorization is enforced at the shared execution seam, re-asked before
the result is persisted, and concurrency is serialised by the database and proven with separate connection
pools. *Turkish Rug House:* its Heby drafts organization work only under the mandate its owner recorded.
*Hebun AI:* every agent-authored artifact sits under the same mandate ceiling as every agent proposal.

## Closure Contract (v1)

- Phase: AGENT-EXECUTION-1
- Owner: Agent work capability (`agent-work/capabilities.ts`, `assign-work-draft.server.ts`) composing Work Artifacts preparation (`prepare-work-artifact.server.ts`), Agent Mandate's shared ceiling, Organizational Work (WEV-1) and Governance review; Heby work-draft affordance
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: ca8b12ccb58c103e4e5c96a2f536d0dff7308f3d, 106e54bd66497e94e80e1d78bdb6e5e92c8fc565
- Verification level: V3 — an authority boundary (who may be recorded as an agent author) in a shared seam used by every preparation path, and a concurrency control; full suite and bite-proofs run
- Verification evidence: assignment-postgres E1–E16 PASS; capability-contract PASS; bite-proofs B1–B5 5/5 (ca8b12cc 13/13); 131 affected files PASS; tsc, eslint, diff --check PASS; npm run build PASS at ca8b12cc; full suite 1090/1091 with 0 REGRESSION, the one red r3w-flow/ambient-database-safety BLOCKED (canonical hebun_r1 stopped) and then PASS run alone against canonical started read-only with fingerprint and WAL LSN unchanged
- Test environment: worktree `.claude/worktrees/agent-execution-1` (base 16459905); disposable detached worktrees `ae1-baseline` and `ae1-candidate`; macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18 at 127.0.0.1:55433 (`~/Developer/hebun-data/postgresql18`) and a session-owned initdb cluster at 127.0.0.1:55493 (system_identifier 7700581022196873046); canonical PostgreSQL 14 at 127.0.0.1:55432 read-only for the r3w proof; fake model transport; no production database or provider
- Deployment evidence: dpl_GV6optZcPTv78sXoSL7RteEnN99E — READY, production; GitHub deployment 7316257481 sha 106e54bd66497e94e80e1d78bdb6e5e92c8fc565 state success; aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: SCOPED — Director-opened session, tenant hebun, on dpl_GV6optZcPTv78sXoSL7RteEnN99E (section 6): a real assignment to Heby on work item 92e70b3e returned prepared, artifact 09550491-f0f1-43d3-9d80-4614fd5d2eb1 revision 1 authored by the durable agent, linked as the work's evidence by the person and shown "Awaiting review"; Engineering Agent on /operations refused work-outside-agent-responsibility with nothing written; the first assignment's answer was withheld by the shared validator (AE1-WITHHELD-DIAGNOSABILITY-1, AE1-DRAFT-ACTION-CLAIM-RULE-1); pre-release mandate compatibility read on /agents for hebun, TRH and Mulify (section 4); concurrency and mid-call withdrawal not provoked in production
- Deferred risks: AE1-OPERATIONS-AUTHOR-MANDATE-1 (CLOSED); AE1-CONCURRENT-ASSIGNMENT-DUPLICATE-1 (CLOSED); AE1-WITHHELD-DIAGNOSABILITY-1 (DEFERRED); AE1-DRAFT-ACTION-CLAIM-RULE-1 (DEFERRED); AE1-ASSIGN-UI-WORDING-1 (DEFERRED); AE1-MEDIA-AUTHORSHIP-MANDATE-1 (DEFERRED); AE1-UNLINKED-SECOND-DRAFT-1 (DEFERRED); AE1-NONMEMBER-TENANT-COMPAT-1 (DEFERRED)
- Director approvals: AGENT-EXECUTION-1 mandate and local commit ca8b12cc 2026-10-25; hardening of the Operations mandate gap and concurrent duplicates with one local commit 106e54bd 2026-10-25; ceremony credential for a production read declined, mandate compatibility through Director-opened /agents renders 2026-10-25; canonical PG14 start for the single r3w proof 2026-10-25; fast-forward push of 106e54bd with its automatic production deployment 2026-10-25; live acceptance with individually approved model calls (assignment 1, one Operations comparison, assignment 2) 2026-10-25; PRODUCTION-ACCEPTED, closure documentation and one local documentation commit with the four named follow-ups left open 2026-10-25
