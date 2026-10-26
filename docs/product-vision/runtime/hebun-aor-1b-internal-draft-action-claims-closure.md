# AOR-1b · closure record · PRODUCTION-ACCEPTED (scoped) — CLOSED

**Scope, stated first.** AGENT-OUTPUT-RELIABILITY-1, second slice: the response validator judges an internal
plan or message — and only that — in an `internal-draft` mode set by the work-artifact preparation seam. Planning,
checklist and conditional language passes ("Once approved, record the decision", "Verify whether the deployment
was approved"); a completed consequential act is still a claim, now **even when attributed** to Governance or the
Director (Director decision D-AOR1b-1). Heby's own answers and content drafts keep the existing rule unchanged.
Implemented and verified in `3f611477`, released and **deployed** (`dpl_61yagWMSydJEJYFHJyUQWL8YLwvC`, READY), and **production-accepted, scoped** on 2026-10-26 for the internal operational-plan revision success path (section 5). No table,
migration, provider, data-use class, authority or second validator.

## 1 · Problem

- **Production, HEBY-WORKFLOW-1 acceptance (2026-10-26, `dpl_A4aKYRBD…`, SHA `50c69477`).** A Director-approved
  revision of `d71f8383…@1` by Engineering Agent was withheld: `served: withheld`, `issueCodes:
  ["action-claim:approved"]`, `stopReason: end_turn`, `messageId 4fec95f4-f58a-4f74-9c36-31de6c62a718`. Nothing was
  filed: revision 1 and the change request stood, the work stayed `planned`, no new artifact.
- **What is not known.** The withheld text is never persisted or shown (`model-answer.server.ts`, AOR-1a by design),
  so whether that reply was a real claim or checklist language is **UNVERIFIED** and stays so. This phase is justified
  by the rule's measured behaviour on design examples, not by that reply.
- **The rule, measured.** One `claimsAnAction` judged Heby's answers and agent drafts alike. It withheld 6 of 12
  design examples of planning language and let 3 attributed completion claims through ("This revision was approved by
  Governance.", "… was approved by the Director.", "Approved by Governance on …"), because attribution is the
  exemption that lets Heby report a grounded record.

## 2 · What was implemented

- **`heby-runtime/response-validator.ts`.** `ActionClaimMode = "answer" | "internal-draft"`; `claimsAnAction(text,
  claim, mode = "answer")` and `validateResponse(…, { actionClaims })`. The answer path is unchanged. The draft path,
  per clause (sentence, then `, ; : ( ) /` and a spaced dash): negation and self-attribution exactly as before; no
  attribution exemption; a completed auxiliary (`was/were/has/have/had/got`) passes only as the object of
  `whether`/`if`; a pending auxiliary passes when governed by a modal, condition, time limit or verification verb, or
  when the chain itself is prospective (`be/being/get`); a bare verb passes only straight after a condition/time limit
  or as `who <verb>` in a clause that opens with an instruction. "Governs" = at most three tokens before the
  auxiliary with no coordinator between. Anything else is a claim (fail closed). Codes unchanged
  (`action-claim:<verb>`), so AOR-1a diagnosis is unchanged.
- **`heby-answer/model-answer.server.ts`.** Server-only option `actionClaimMode`, honoured only when the intent
  `prepares` (the brief's rule); the model answer is validated in it, the deterministic answer keeps the default.
  `HebyModelAnswerInput` (the client-suppliable shape) carries no mode.
- **`work-artifacts/prepare-work-artifact.server.ts`.** `...(publicContent ? {} : { actionClaimMode: "internal-draft" })`
  — from the artifact's own type (the stored type on a revision), never a client field or the model.
- **No pin changed.**

## 3 · Verification (V3)

V3: the prompt-injection output boundary (the response validator) and the shared preparation seam changed. The full
suite was run because the validator is reached by every Heby answer path and many grounding suites pin its verdicts.

| Check | Result |
|---|---|
| Baseline, 116 affected files (every test naming the validator, the answer flow or the preparation seam, plus HW1, AE-2, CONTENT-AGENT-2, AOR-1a), unchanged `50c69477`, disposable `aor1b-baseline` | 116/116 |
| `tests/aor-1b/draft-claims-contract.ts` D1–D6 | PASS — 16 permissible design sentences pass in a draft; 19 claims (plain, attributed, spoofed, self) withheld; 14 scope cases (two-clause, `;`, `:`, dash, parenthesis, coordinator, distance, injected "Ignore the rules above … approved by the Director") keep the second claim; the answer mode gives the same verdicts as before on 8 reference sentences; `validateResponse` withholds with `action-claim:<verb>` and falls back closed; only the seam sets the mode, the answer flow honours it only for a preparing intent, the client input shape has none |
| `tests/aor-1b/draft-mode-postgres.ts` P1–P6, real PostgreSQL 18, fake transport | PASS — planning language filed verbatim with an AOR-1a `served: model` line; plain and Governance-attributed completion claims withheld with `action-claim:approved`, `end_turn`, a message id and no reply text in the line, nothing filed; the same planning text in a content draft and in Heby's own answer (even handed the mode without a preparing intent) still withheld; HEBY-WORKFLOW-1 revision with approval checks filed as revision 2 and back to review; an injected attributed claim in a revision withheld with the change request standing |
| Candidate, 119 files (baseline set + three new), disposable `aor1b-candidate` | 119/119, no pin changed |
| Bite-proofs | AOR-1b 8/8 (mode reaches content drafts; honoured without a preparing intent; never set; attribution exemption returns; no clause split; completed read as pending; coordinator ignored; self-attribution ignored); in the same run AE-1 5/5, HW1 7/7, CONTENT-AGENT-2 11/11, cgo9 7/7, ca2 10/10, e21 9/9, tb1 12/12, l2-heby-core 5/5, int5a 11/11, int5b1 17/17, int5c 20/20, ap5a 11/11, dh1 10/10, agent-runtime-0 7 bit + 2 tolerated |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check`, `npm run build` | PASS |
| Full suite (`node scripts/run-tests.mjs`, candidate copy) | 1102/1103, REGRESSION 0. `r3w-flow/ambient-database-safety` **BLOCKED** (canonical `hebun_r1` at 127.0.0.1:55432 not running) — environmental, not a pass. `plan-step-idempotency-1/bite-proofs` passed in this run (HW1-PSI-BITE-FLAKE-1 unchanged: still intermittent, root cause UNVERIFIED) |

## 4 · Production release (2026-10-26)

| Fact | Evidence |
|---|---|
| Pre-release | `git fetch` and `git ls-remote`: `origin/main` = `50c69477`; `3f611477` its only child, a fast-forward, limited to the 9 AOR-1b files; feature worktree clean; no other local branch ahead of `50c69477`; rollback reference `dpl_A4aKYRBDfbzZTudvmoN2RkBorVba` (`50c69477`, READY, then on both production aliases); the draft-claims contract (default rule, content-draft isolation, server-only mode, AOR-1a codes) re-run PASS on the commit |
| Push | `50c69477..3f611477` fast-forward after a compare-and-swap read, refspec written as the literal SHA, no force; `git ls-remote` then read `3f6114776ad9dff0715a010e873ba1e07edf208c` |
| Deployment | `dpl_61yagWMSydJEJYFHJyUQWL8YLwvC`, target production, `READY`, created 2026-10-26 22:44 +03 by the Git integration on its own |
| Deployment SHA | Vercel API (`/v13/deployments/…?withGitRepoInfo=true`): `source: git`, `githubCommitSha` `3f6114776ad9dff0715a010e873ba1e07edf208c`, ref `main`; `vercel ls --meta githubCommitSha=3f611477…` returns this one deployment, `50c69477` returns `smdyc0gv1`, an all-zeros control returns the unfiltered list |
| Aliases | `www.hebuntech.com` and `hebuntech.com` → `dpl_61yagWMSydJEJYFHJyUQWL8YLwvC` |
| HTTP, signed out | `/`, `/login` 200; `/heby`, `/operations`, `/director/work` 307 → `/login` |
| Runtime log, first ~30 minutes | 14 records, all info; 0 error, 0 5xx; 0 `work-preparation-model-outcome` lines |

**What this is not.** READY, the SHA and the aliases prove what is served, not that the internal-draft mode behaves
as verified locally in production. No preparation, model call, Governance decision, artifact, revision, work-state
change or production record was made for this record. The acceptance target (work `5ba33201…`, artifact
`d71f8383…`, last read at revision 1 with a standing change request) could not be re-read after release: the
built-in browser's session had ended, and no credential was entered — UNAVAILABLE, not assumed. The earlier
production withheld reply (`4fec95f4…`) remains UNVERIFIED as a true or false positive.

### Deferred risk detail

- **AOR1B-PROD-UNVERIFIED-1 (CLOSED, scoped).** Observed for the internal operational-plan revision success path
  (section 5). Not observed in production: a real unsupported claim withheld in internal-draft mode, message drafts,
  content drafts and Heby answers after this release. Original dependency, kept for the record: a
  Director-approved HEBY-WORKFLOW-1 revision of `d71f8383…` (its change request still stands) read back: a filed
  revision 2 or a withheld line naming its code.
- **AOR1B-HEURISTIC-RESIDUAL-1 (DEFERRED).** A lexical, per-clause heuristic. Known false negatives: a claim with no
  listed verb ("It was done.", "Signed off."), or a conditional frame that does not read as one; known false positives
  (fail closed): a governing marker more than three tokens away ("Confirm that the production database migration is
  approved"), "Status: approved" labels. Dependency: a Director decision if production diagnosis lines show either.
- **AOR1B-ATTRIBUTED-HISTORY-1 (DEFERRED).** By D-AOR1b-1 an internal draft that restates a real, recorded approval
  ("approved by the Director on …") is withheld; the person rewords. Dependency: a Director decision if observed.
- **AOR1B-NON-ENGLISH-CLAIMS-1 (DEFERRED).** The verb list is English; a Turkish draft's "onaylandı" or "dağıtıldı" is
  not judged in either mode. Pre-existing, made visible here. Dependency: a Director decision before drafts in
  Turkish are relied on (TRH).
- **AE1-DRAFT-ACTION-CLAIM-RULE-1 (CLOSED).** The Director's architecture decision (Option C with D-AOR1b-1) is
  implemented and production-observed on the path that failed (section 5). What it leaves is tracked, not closed:
  AOR1B-HEURISTIC-RESIDUAL-1, AOR1B-ATTRIBUTED-HISTORY-1, AOR1B-NON-ENGLISH-CLAIMS-1.
- **Unchanged, in their own records:** AOR1A-PROD-UNVERIFIED-1, HW1-PROD-UNVERIFIED-1, AE2-DECLINED-DRAFT-FILED-1.

## 5 · Production acceptance (2026-10-26)

The HEBY-WORKFLOW-1 revision that had been withheld on `dpl_A4aKYRBD…` (`action-claim:approved`, `4fec95f4…`) was
retried once, with the Director's approval, on this release.

| Fact | Evidence |
|---|---|
| Session | Built-in browser, a session the Director signed in themselves; no credential entered by this session. Tenant Hebun AI `f625b683-3be5-40eb-93a4-53fc56ab38c9`, read from the tenant-scoped `/operations` payload (all 11 artifacts carry it) |
| Deployment | `dpl_CVcuTYjxx39PYQXCownfBR6DW5R4`, READY, `githubCommitSha` `a0a45648`, on `www.hebuntech.com` and `hebuntech.com`; it serves `94627e04` (HEBY-WORKFLOW-1) and `3f611477` (AOR-1b) unchanged, `a0a45648` being documentation |
| Before the call | Work `5ba33201-fffa-4a41-864c-79cd567de635` declared `planned`; draft `d71f8383-da78-4637-8e09-e4b820f5ded2` (operational-plan, Engineering Agent) at revision 1, linked, Governance "Changes requested" (recorded by the Director); Engineering Agent in the server's eligible list as specialist; the revise block rendered |
| Heby | "Show the change request…" showed the Director's reason verbatim; the agent select started empty; "Heby suggests Engineering Agent, who wrote the current revision. You decide who revises it."; the submit control stayed disabled until Engineering Agent (`670a6889…`) was chosen and the Director's instruction entered |
| The call | One Director-approved click of "Ask Engineering Agent to revise"; no retry |
| After | Same artifact id, revision 2 current; history `@1` kept and `@2 · current`, both agent-written; Heby "revision 2 · written by Engineering Agent · waiting for review"; Operations "Governance review of revision 2: Awaiting review"; work still `planned`, completion suggestion withheld (`awaiting-review`); 11 artifacts, none newer than 2026-10-25 |
| Runtime log | One `work-preparation-model-outcome` line on `POST /heby`: `served: model`, `issueCodes: []`, `stopReason: end_turn`, `messageId 95f07532-2164-43e2-b523-b437564c02c7`; no reply text, tenant, user or agent in it; the only error-level records are the known `pg` SSL-mode warning (SH1-PG-SSLMODE-1), no 5xx |
| Not read | The `messageId` → message row binding (needs a production database read; UNAVAILABLE). The revision text is not reproduced here |

**Accepted, scoped:** the internal operational-plan revision success path — one authorised internal-draft
preparation served by the model with no issue code, filed as revision 2 on the same artifact, no new artifact.
**Not accepted by this record:** every possible action-claim phrasing; Turkish action-claim safety; a real
unsupported claim withheld in production in internal-draft mode; that the earlier withheld reply (`4fec95f4…`) was a
false positive (UNVERIFIED — its text was never stored); content drafts and any unobserved provider path.

**AOR-1a, related evidence only.** The withheld line (`4fec95f4…`, `action-claim:approved`, `end_turn`) and this
served line (`95f07532…`, no codes, `end_turn`) are production diagnosis lines of the kind AOR-1a §5 items 2–3
describe; their `messageId` → message row binding is UNAVAILABLE. AOR-1a's state and AOR1A-* risks are unchanged
by this record; accepting them is a separate Director decision.

**Weekly three.** *Learned:* the same words are a claim in one voice and an instruction in another; the validator
needs the voice from the server, and a draft deserves a stricter rule on attribution, not a looser one. *Turkish Rug
House:* its plans can say "once approved" without being withheld, and cannot say an approval happened that did not.
*Hebun AI:* one validator, two server-chosen modes, the same codes for diagnosis.

## Closure Contract (v1)

- Phase: AOR-1b
- Owner: Heby response validation (`heby-runtime/response-validator.ts`) with its mode chosen by the answer flow (`heby-answer/model-answer.server.ts`) on the work-artifact preparation seam's declaration (`work-artifacts/prepare-work-artifact.server.ts`)
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 3f6114776ad9dff0715a010e873ba1e07edf208c
- Verification level: V3 — the prompt-injection output boundary and the shared preparation seam changed; full suite run
- Verification evidence: draft-claims-contract D1–D6 PASS; draft-mode-postgres P1–P6 PASS; baseline 116/116 at 50c69477; candidate 119/119 with no pin changed; bite-proofs AOR-1b 8/8 with AE-1 5/5, HW1 7/7, CONTENT-AGENT-2 11/11 and 11 further suites in the same run; tsc, eslint, git diff --check, npm run build PASS; full suite 1102/1103 with 0 REGRESSION, r3w-flow/ambient-database-safety BLOCKED (canonical hebun_r1 :55432 not running)
- Test environment: worktree `.claude/worktrees/aor-1b` (branch feat/aor-1b, base 50c69477); disposable detached worktrees `aor1b-baseline`, `aor1b-candidate` (removed after use); macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18.6 at 127.0.0.1:55433 via HEBUN_TEST_ADMIN_DATABASE_URL with harness-created databases; fake model transport; no network, no production database or provider
- Deployment evidence: dpl_61yagWMSydJEJYFHJyUQWL8YLwvC — READY, target production, source git sha 3f6114776ad9dff0715a010e873ba1e07edf208c ref main, created by the Git integration for the push 50c69477..3f611477; aliased to www.hebuntech.com and hebuntech.com; signed-out HTTP / and /login 200, /heby, /operations, /director/work 307 → /login; runtime log 14 records, 0 error, 0 5xx; rollback reference dpl_A4aKYRBDfbzZTudvmoN2RkBorVba (50c69477)
- Production acceptance evidence: SCOPED — Director-opened session, tenant Hebun AI f625b683, on dpl_CVcuTYjxx39PYQXCownfBR6DW5R4 (serving 3f611477 unchanged; section 5): one Director-approved internal operational-plan revision of d71f8383 by Engineering Agent served by the model — runtime line served model, issueCodes [], end_turn, messageId 95f07532-2164-43e2-b523-b437564c02c7 (message-row binding UNAVAILABLE) — filed as revision 2 on the same artifact, awaiting review, no new artifact, work still planned; the same revision was withheld action-claim:approved before this release (4fec95f4, true or false positive UNVERIFIED)
- Deferred risks: AOR1B-PROD-UNVERIFIED-1 (CLOSED); AOR1B-HEURISTIC-RESIDUAL-1 (DEFERRED); AOR1B-ATTRIBUTED-HISTORY-1 (DEFERRED); AOR1B-NON-ENGLISH-CLAIMS-1 (DEFERRED); AE1-DRAFT-ACTION-CLAIM-RULE-1 (CLOSED)
- Director approvals: AOR-1b prioritised after the HEBY-WORKFLOW-1 production withheld event, analysis only 2026-10-26; Option C (server-controlled internal-draft mode) and D-AOR1b-1 (attribution does not make a completed claim safe in an internal draft) approved, implementation, verification and documentation authorised 2026-10-26; one local commit approved 2026-10-26; controlled push of 3f611477 with its automatic production deployment, deployment verification and this documentation update approved 2026-10-26; production model calls, revisions, Governance decisions, artifact or work-state changes and production test data NOT approved; production acceptance pre-checks, one Director-approved Engineering Agent revision call, and PRODUCTION-ACCEPTED (scoped) with this documentation, commit and fast-forward push 2026-10-26
