# HEBY-OBSERVED-PERFORMANCE-READ-1 · closure record · PRODUCTION-ACCEPTED

A person in `/heby` can now type `/performance` and see what Hebun has RECORDED about their
organization's accepted Instagram and YouTube publications: the provider id, the content draft and
revision it was published from (current or superseded), when it was published, and the latest stored
counts with the instant they describe. A count Hebun does not hold is written "not reported", never 0.

It is a deterministic read command. It composes three released readers (`listWorkArtifacts`,
`readWorkArtifactHistory`, `readPublicationMeasurements`) and writes no SQL of its own. It writes
nothing, contacts no provider, builds no transport, imports no model client, and its output is a local
command result: never a durable message, never model context. It adds no table, no migration, no
environment variable, no permission, and no change to Knowledge, Governance, EAI or any provider
authority. It ranks, scores and judges nothing.

## 1 · What was released

| Commit | Content |
|---|---|
| `ed5499d8` | `feat(heby): add /performance read of recorded publication measurements`. 5 files, +671 / −0: `heby-commands/performance-read.server.ts` (new), `read-commands.server.ts` and `registry.ts` (wiring), and 2 new test files under `tests/heby-observed-performance-read-1/`. No schema file, no migration. |

On `main`: fast-forward `b57d4364 → ed5499d8` on 2026-10-15 under the Director's release approval.
Remote and HEAD were re-read immediately before the push. No force, no tag.

**Bounds the command states instead of hiding.** At most `CONTENT_PUBLICATION_REVISIONS_LIMIT` (50)
revisions are checked per read, newest draft first and newest revision first; beyond that the answer
says older revisions were not checked. A draft whose history reads empty, or a revision whose ledger
reads `unknown`, is named. "No accepted … publication is recorded" is said only when every listed
revision was read and checked.

## 2 · Verification (V2)

V2: the change wires one command into the shared Heby command registry and reads through tenant-scoped
released seams. It changes no write path, no grant, no schema and no provider boundary.

| Item | Measured |
|---|---|
| Static checks | `tsc --noEmit -p .` exit 0; `eslint` on the 3 changed source files and the phase test directory exit 0 |
| Phase tests | `tests/heby-observed-performance-read-1/render-and-firewall.ts` PASS (rendering, absence wording, import firewall: no model, transport, provider, writer, EAI or grounding module, and nothing model-facing imports the command). `performance-postgres.ts` PASS on a disposable PostgreSQL 18 database. |

## 3 · Production release and acceptance

Production reads used a script outside the repository that imports only `pg`, opens
`BEGIN TRANSACTION READ ONLY` and ends with `ROLLBACK`. It printed aggregates and the five public
provider ids. Tenant ids, session data, credentials and provider payloads were not printed.

| Gate | Time (UTC) | Measured |
|---|---|---|
| Readiness | 2026-10-15 | origin/main `b57d4364` (expected parent); production `dpl_G8GYQktX…` at `b57d4364`; no deployment building; worktree clean; `tsc` 0 |
| Release | 2026-10-15 | Fast-forward push `b57d4364..ed5499d8`; remote re-read as `ed5499d8` |
| Deploy | 18:44:38Z → Ready 18:45:59Z | `dpl_EBY38pXpFMXxVvR53D5RY4EQUDQb`, target production, `githubCommitSha` `ed5499d8…`, created by the git integration (no manual deployment). `www.hebuntech.com` and `hebuntech.com` resolve to it. |
| Smoke | after deploy | `/` 200, `/login` 200, signed-out `/heby` 307 → `/login`. Deployment runtime log: 30 requests, 0 5xx, 0 error-level lines. |
| First Director attempt | 2026-10-16 | In the **Hebun AI** organization `/performance` answered "No accepted Instagram or YouTube publication is recorded for this organization's content drafts." Read-only investigation: that organization holds 4 content drafts / 6 revisions and **0** publication requests; every publication is in **Turkish Rug House**. The answer was true for the scope it read. See HOPR-1-ORG-LEGIBILITY-1. |
| Director acceptance | 2026-10-16 | Signed in, switched to Turkish Rug House, ran `/performance`: 3 Instagram, 2 YouTube, 1 superseded Instagram revision, values and "as of" instants as below. UI acceptance PASSED. |
| Authoritative comparison | 2026-10-16 | Below. |

**The five publications against production records.** Ledger: 3 `publish-instagram-media` and 2
`publish-youtube-video` requests in Turkish Rug House, all `approved`, each with an `accepted` attempt
carrying the provider id. Every `target_ref` is canonical and resolves to an existing content-draft
revision in the same tenant. Counts are the newest stored observation containing that id.

| Provider id | Revision | Published | Displayed | Stored | Observed (stored → displayed) |
|---|---|---|---|---|---|
| IG `18636992128059388` | 7, current | 2026-10-11 20:16 | likes 1, comments 0 | 1 / 0 | 2026-10-16 07:00:20.762Z → 07:00 UTC |
| IG `18147024463562197` | 2, current | 2026-10-10 12:04 | likes 2, comments 0 | 2 / 0 | 2026-10-16 07:00:20.762Z → 07:00 UTC |
| IG `18091512017663172` | 3, **superseded** | 2026-09-25 10:13 | likes 3, comments 0 | 3 / 0 | 2026-10-16 07:00:20.762Z → 07:00 UTC |
| YT `DQr18fVuevM` | 2, current | 2026-09-28 20:40 | views 0, likes 0, comments 0 | 0 / 0 / 0 | 2026-10-01 12:31:30.481Z → 12:31 UTC |
| YT `Rlp-bPNHXkw` | 2, current | 2026-09-28 15:38 | views 1, likes 0, comments 0 | 1 / 0 / 0 | 2026-10-01 12:31:15.273Z → 12:31 UTC |

5 of 5 match on provider id, revision and status, counts and observation instant (the display prints
minutes).

**Writes, model and provider calls, EAI.** Rows created from 2026-10-15 00:00Z to the comparison:
`heby_action_requests` 0, `action_execution_attempts` 0, `messages` 0, `conversations` 0,
`work_artifact_revisions` 0, `heby_origination_invocations` 0, `tenant_ai_data_use_authorizations` 0.
`provider_observations` 5, every one written under a standing observation authorization with an
invocation id at the scheduled cadence (06:00Z and 15:00Z on 10-15, before the deploy; 07:00Z on
10-16), matching the daily pattern since 2026-10-11. None is attributable to `/performance`. No model
message means no model call and no EAI disclosure decision; the import firewall excludes provider and
model code from the command.

## 4 · Not verified

- **No screenshot of production.** The acceptance is the Director's report of the displayed output.
- **"not reported" and clipped-window wording in production.** All five stored values are numbers; the
  missing-metric and `outside-clipped-window` / `absent-from-complete-window` paths are proven locally
  only (HOPR-1-NOT-REPORTED-PATH-1).
- **The 50-revision bound in production.** Turkish Rug House holds 16 content-draft revisions, so the
  truncation wording was not reached (HOPR-1-REVISION-BOUND-1).
- **`/help` listing and HGC-1/HCC-1 commands** were not separately confirmed on screen. `/performance`
  ran, and the deployment log showed no 5xx.
- **The Director session's membership** was not read: the probe of the latest session's user and
  memberships was refused by the session's permission layer. The tenant finding rests on the active
  tenant of every live session context, and on the switched run matching Turkish Rug House records
  exactly.

## Closure Contract (v1)

- Phase: HEBY-OBSERVED-PERFORMANCE-READ-1
- Owner: apps/dashboard/src/features/heby-commands/performance-read.server.ts (the `/performance` composition) with read-commands.server.ts and registry.ts (wiring); Work Artifacts, Action Authorization's ledger, Provider Observation History, Knowledge, Governance and EAI unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: ed5499d8529f150a97dcc30292b7ab6f4ac3460c — released on `main` (fast-forward from b57d4364)
- Verification level: V2 — one read command wired into the shared Heby command registry over tenant-scoped released readers; no write path, grant, schema or provider boundary changed
- Verification evidence: tsc --noEmit 0; eslint on the changed source and phase tests 0; tests/heby-observed-performance-read-1/render-and-firewall.ts PASS; tests/heby-observed-performance-read-1/performance-postgres.ts PASS
- Test environment: worktree `.claude/worktrees/heby-observed-performance-read-1` at ed5499d8; macOS (Darwin 25.2.0); Node 24.16.0 with tsx; PostgreSQL at localhost:5432 as `postgres` via HEBUN_TEST_ADMIN_DATABASE_URL (disposable databases); no provider, no model
- Deployment evidence: dpl_EBY38pXpFMXxVvR53D5RY4EQUDQb READY production at ed5499d8 (githubCommitSha), created 2026-10-15T18:44:38Z by the git integration, aliases www.hebuntech.com and hebuntech.com
- Production acceptance evidence: section 3 — Director signed-in run in Turkish Rug House showing 3 Instagram and 2 YouTube publications including 1 superseded revision; read-only comparison 5/5 on provider id, revision, counts and observation instant against the ledger and stored observations; 0 new request, attempt, message, conversation, revision, origination or EAI authorization rows, and 5 standing scheduled observations not attributable to the command
- Deferred risks: HOPR-1-ORG-LEGIBILITY-1 (DEFERRED); HOPR-1-NOT-REPORTED-PATH-1 (DEFERRED); HOPR-1-REVISION-BOUND-1 (DEFERRED)
- Director approvals: fast-forward push and production deployment of ed5499d8 only, confirmed in chat (2026-10-15); read-only root-cause investigation of the first acceptance result (2026-10-16); UI acceptance PASSED and timestamp confirmation, production acceptance approved (2026-10-16); closure documentation and one local documentation commit (2026-10-16); push of the documentation commit NOT yet approved

### Deferred risk detail

- **HOPR-1-ORG-LEGIBILITY-1 (DEFERRED).** The answer does not name the organization it read. In a
  session whose active organization holds no publications it says, truthfully, that none is recorded,
  and the reader cannot tell it looked at the wrong organization. Measured on 2026-10-16. Acceptance
  dependency: a Director-approved wording change that names the active organization.
- **HOPR-1-NOT-REPORTED-PATH-1 (DEFERRED).** Missing-metric ("not reported") and clipped or complete
  observation-window wording are proven by local tests only; no production record exercised them.
  Acceptance dependency: a production publication whose stored observation lacks a count or falls
  outside the observation window.
- **HOPR-1-REVISION-BOUND-1 (DEFERRED).** One read checks at most 50 content revisions, newest first.
  Older publications are then omitted, and the answer says so explicitly. Acceptance dependency: a
  Director decision when an organization's content revisions approach 50 (Turkish Rug House: 16).

**Existing limitation, not a new risk: YouTube measurement freshness.** YouTube counts come from
measurements a person records (`google-youtube` / `google.youtube.video.metrics.read`); nothing records
them automatically. The newest is from 2026-10-01, and `/performance` shows that instant as stored.
This phase sets no freshness policy and changes none.

**Rollback.** Re-promoting `dpl_G8GYQktX…` (`b57d4364`) is safe: no migration and no data written by
this phase. Only `/performance` disappears. Unless `main` is also reverted, the next push redeploys it.

**Weekly three.** *Learned:* a tenant-scoped "none recorded" is a statement about the active
organization, and an answer that does not name that organization reads like a defect when the person
is in another one. *Turkish Rug House:* the people running TRH content can see, in one command, what
each accepted post and video has recorded, including a post published from an older revision.
*Hebun AI:* Heby reads publication outcomes from Hebun's own records, without a provider call or a
model, which is the ground any later measurement reasoning has to stand on.
