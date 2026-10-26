# AOR-1a · closure record · DEPLOYED — PRODUCTION ACCEPTANCE PENDING

**Scope, stated first.** AGENT-OUTPUT-RELIABILITY-1, first slice: when a model answers a work preparation, it
is now diagnosable which response-validator check withheld the answer and how the provider stopped — as closed
codes, never as text. Heby names a withheld draft's reason by class. Implemented in `2328dabf`, released and
**deployed** (`dpl_6KnPWAyi2RsnNvWWqdh2xNxuYRBN`, READY); **production behaviour UNVERIFIED** — no organic
preparation has been observed since the release (section 4). No table, migration, authority, data-use class, filter,
filing rule or Governance behaviour changed. AOR-1b and AOR-1c are not implemented (section 6).

## 1 · Problem

- **AE1-WITHHELD-DIAGNOSABILITY-1.** On the withheld path the validator's issues were discarded; a withheld
  preparation could not be diagnosed from production (AE-1 acceptance step 1).
- **The provider's stop reason** was read only to append the max-tokens note; a preparation's stop reason
  was recorded nowhere.
- Heby said only that "a check" withheld the answer.

## 2 · What was implemented

- **`heby-runtime/response-validator.ts`.** Each check also pushes one code of the closed
  `ResponseValidationCode`: `missing-title-or-body`, `authority-mismatch`, `action-claim:<verb>` (the verb a
  literal of the unchanged `FORBIDDEN_ACTION_CLAIMS`), `unsupported-evidence`, and four flag codes. `issues`
  prose is unchanged; it is never logged or sent to a browser because one line quotes an evidence reference the
  response itself carried.
- **`heby-runtime/contracts.ts`.** The `withheld` fallback gains optional `issueCodes` and `stopReason`
  (absent on earlier records). `classifyProviderStopReason` reduces the provider's string to `end_turn`,
  `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal` or `other`; nothing unknown is carried raw.
- **`heby-answer/model-answer.server.ts`.** The withheld fallback carries the codes and the classified stop
  reason; the answered result carries `modelStopReason` whenever a model answered, served or withheld.
- **`work-artifacts/preparation-diagnosis.ts` (pure) and `prepare-work-artifact.server.ts`.** One structured
  line, event `work-preparation-model-outcome`, written once when a model really answered, before anything
  decides what to do with the answer: `served` (`model` | `withheld`), `issueCodes`, `stopReason` (or
  `unreported`), `messageId` (joins the line to the provenance already recorded on that message row). No prompt,
  reply, validator prose, tenant, user or agent. The sink is injectable; the default is the host's runtime log,
  the channel OPERATIONAL-OBSERVABILITY-V1 uses.
- **Heby (`heby-work-draft-affordance.tsx`).** `describeWithheld` names the class from the codes alone ("it
  described an act as having happened (“approved”)", "it cited a source Hebun did not give it", "it failed
  Hebun's format checks"); without codes the pre-AOR sentence stays.
- **Decline stays undiagnosed, on purpose.** A provider `refusal` stop reason is recorded as the provider's
  signal and blocks nothing; no reply is classified as a decline; a reply declining in prose ends `end_turn`.
  No phrase filter was added.
- **Pins changed with their reasons:** `ca2-preparation-failure-legibility/fallback-postgres.ts` F2 and
  `heby-prompt-injection-boundary-1/adversarial-postgres.ts` (the withheld fallback now names its codes and stop
  reason; the injected claim's text still appears nowhere). ca2's single-line fallback census was met by writing
  the fallback on one line, not by changing that test.

## 3 · Verification (V2, full suite run)

V2: a shared seam (the answer flow and the preparation seam every path uses). The response validator is part
of the prompt-injection output boundary, so the full suite was run as well; no authority, tenant, lifecycle or
schema boundary moved.

| Check | Result |
|---|---|
| Baseline, 111 affected files (every test naming a touched module), unchanged `2961b562`, disposable `aor1a-baseline` | 111/111 |
| `tests/aor-1a/diagnosis-postgres.ts` D1–D6, real PostgreSQL 18 | PASS — withheld: codes and stop reason on the client result, nothing filed, one line with declared keys only and no prompt, reply, tenant, user, agent or work id, message row provenance kept; provider `refusal` recorded and the draft still prepared; `unreported`; unexpected reason → `other`, raw string nowhere; provider failure → no line; two tenants' lines share nothing |
| `tests/aor-1a/diagnosis-contract.ts` C1–C5 | PASS |
| Bite-proofs (disposable `aor1a-bite`, match count 1 each) | 7/7 caught |
| Affected files on the candidate (disposable `aor1a-candidate`) | 113/113 after the two pins and the one-line fallback (first run 109/113: those three causes, ca2 bite-proofs failing on the census) |
| Full suite (`node scripts/run-tests.mjs`, candidate copy) | 1096/1097, REGRESSION 0; the one red `r3w-flow/ambient-database-safety.ts` BLOCKED (canonical `hebun_r1` at 127.0.0.1:55432 not running), environmental, not a pass |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check`, `npm run build` | PASS |

## 4 · Production release and observations (2026-10-26)

| Fact | Evidence |
|---|---|
| Pre-release | `origin/main` = `2961b562`; `2328dabf` one commit on it, limited to the 13 AOR-1a files; worktree clean |
| Push | `2961b562..2328dabf` fast-forward, refspec written as the literal SHA; `git ls-remote` then read `2328dabf4e1ffabac8dfc9d0fb6a620ae0c30eca` |
| Deployment | `dpl_6KnPWAyi2RsnNvWWqdh2xNxuYRBN`, target production, `READY`, created 2026-10-26 19:38 +03 by the Git integration on its own; no manual trigger |
| Deployment source | Vercel API (`vercel api /v13/deployments/…?withGitRepoInfo=true`): `source: git`, sha `2328dabf4e1ffabac8dfc9d0fb6a620ae0c30eca`, ref `main` |
| GitHub deployment | `7337730678`, sha `2328dabf…`, environment Production, state `success` |
| Aliases | `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`, `hebun-ai-recovered-hebuntechs-projects.vercel.app`, `hebun-ai-recovered-git-main-hebuntechs-projects.vercel.app` |
| HTTP, signed out | `/` and `/login` 200; `/heby` 307 → `/login` |

Read-only observations after the release, through the authorized Vercel CLI (the Vercel MCP connection answered
403 for this team scope and was not used):

- **`work-preparation-model-outcome`: NOT OBSERVED.** The deployment's runtime log since 16:38Z held 19 records
  (`/` 7, `/login` 6, `/contact` 4, `/heby` 2); the event query matched 0, and an unfiltered scan matched 0.
- **No organic withheld or served preparation** occurred, so neither path, nor the absence of sensitive data in a
  real line, has been observed.
- **The new Heby withheld wording was not verified:** the built-in browser had no signed-in session, and this
  session enters no credentials.
- **The deployment SHA is verified; that is not proof the new behaviour runs** in production.
- The one error-level record (`/heby` 307, edge middleware) is the known `pg` SSL-mode warning
  (SH1-PG-SSLMODE-1), unrelated to this phase.

No Governance decision, artifact or work-state change, database write, model call or production event was made
for this record.

**A runtime log line is not durable audit evidence.** It lives in the host's runtime log for that log's
retention, is not tenant-scoped, and is not a record anyone reads back. Durable facts stay where they were: the
message row's provenance and the work artifact tables.

## 5 · Production acceptance evidence required

1. Release under its own Director gate; the deployment record read for the pushed SHA.
2. An organic preparation whose answer is withheld: the Heby message names its class, and one
   `work-preparation-model-outcome` line in the runtime log names its codes and stop reason, with a `messageId`
   that resolves to that tenant's message row. Nothing provoked for the purpose; no model call made for it.
3. A served preparation's line, read the same way.

### Deferred risk detail

- **AOR1A-PROD-UNVERIFIED-1 (DEFERRED).** Released and deployed; no production preparation has produced a diagnosis
  line, and the new withheld wording was not rendered (section 4). Dependency: section 5 on an organic preparation.
- **AOR1A-LOG-NOT-AUDIT-1 (DEFERRED).** The diagnosis lives in a runtime log with host retention, not in a
  durable record. Dependency: a Director decision whether diagnosis needs a durable home (a schema decision).
- **AE1-WITHHELD-DIAGNOSABILITY-1 (DEFERRED).** Implemented here; not CLOSED until a production withheld
  preparation is diagnosed from the line (section 5).
- **AE2-DECLINED-DRAFT-FILED-1** stays open in its own record, unchanged: a reply declining in prose is still
  filed as prepared work.

## 6 · Director decisions recorded (2026-10-26)

- **AOR-1b — not implemented.** First evaluate AOR-1a's production diagnosis evidence. The Heby response
  validator is not relaxed.
- **AOR-1c — not implemented.** The provider `refusal` signal does not become an automatic Governance or filing
  decision. Existing declined drafts (`98904a8e…`, `ea1433b4…`) are not changed or retired.

**Weekly three.** *Learned:* a validator's prose can quote model-controlled input; diagnosis must travel as the
validator's own closed codes, beside the prose, never instead of it. *Turkish Rug House:* when its agent's draft is
withheld, its owner reads which kind of check stopped it and can reword, instead of a bare "not written".
*Hebun AI:* every model answer on the preparation path leaves a content-free diagnosis line, so the next
reliability decision (AOR-1b) can be taken from measurement.

## Closure Contract (v1)

- Phase: AOR-1a
- Owner: Heby response validator (`heby-runtime/response-validator.ts` codes), Heby answer flow (`heby-answer/model-answer.server.ts` withheld fallback and stop reason), Work Artifacts preparation seam (`work-artifacts/prepare-work-artifact.server.ts`, `work-artifacts/preparation-diagnosis.ts`), Heby work-draft affordance
- Reached state: DEPLOYED
- Implementation commit: 2328dabf4e1ffabac8dfc9d0fb6a620ae0c30eca
- Verification level: V2 — a shared seam (answer flow and preparation seam); the full suite was run because the response validator is part of the prompt-injection output boundary
- Verification evidence: diagnosis-postgres D1–D6 PASS; diagnosis-contract C1–C5 PASS; bite-proofs 7/7 caught; baseline 111/111 at 2961b562; candidate 113/113 (109/113 first run, two pins updated and the fallback written on one line); full suite 1096/1097 with 0 REGRESSION, the one red r3w-flow/ambient-database-safety BLOCKED (canonical hebun_r1 :55432 not running); tsc, eslint, git diff --check, npm run build PASS
- Test environment: worktree `.claude/worktrees/aor-1a` (branch feat/aor-1a-output-diagnosis, base 2961b562); disposable detached worktrees `aor1a-baseline`, `aor1a-candidate`, `aor1a-bite`; macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18.6 at 127.0.0.1:55433 (superuser admin) via HEBUN_TEST_ADMIN_DATABASE_URL with harness-created databases; fake model transport; no network, no production database or provider
- Deployment evidence: dpl_6KnPWAyi2RsnNvWWqdh2xNxuYRBN — READY, target production, source git sha 2328dabf4e1ffabac8dfc9d0fb6a620ae0c30eca ref main, created by the Git integration for the push 2961b562..2328dabf; GitHub deployment 7337730678 environment Production state success; aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: N/A — production acceptance pending: work-preparation-model-outcome NOT OBSERVED (0 of 19 runtime records since the release), no organic withheld or served preparation, the Heby withheld wording not rendered; the deployment SHA is not proof of behaviour
- Deferred risks: AOR1A-PROD-UNVERIFIED-1 (DEFERRED); AOR1A-LOG-NOT-AUDIT-1 (DEFERRED); AE1-WITHHELD-DIAGNOSABILITY-1 (DEFERRED)
- Director approvals: AOR-1a implementation 2026-10-26; implementation report accepted, architecture kept, documentation, local commit and removal of the disposable worktrees 2026-10-26; AOR-1b and AOR-1c deferred (validator not relaxed, refusal signal not automated, declined drafts unchanged) 2026-10-26; push of 2328dabf and production deployment 2026-10-26; this deployment record 2026-10-26; push of this record NOT approved
