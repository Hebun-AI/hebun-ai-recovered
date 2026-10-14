# HEBY-GROUNDED-CONVERSATION-1 · closure record · PRODUCTION-ACCEPTED

Through `/heby` (the Command workspace), Heby may now ground an answer on Knowledge, but only on a
version Governance ratified. The Knowledge reaches the external model only as far as the tenant's own
EAI authorization reaches. Every Heby turn says what the model received, read from the EAI decision
recorded for that request. A conversation belongs to the human who started it. Exactly one live
acceptance request was made in production.

This phase does not make Heby an agent system. It does not change what Heby may do, propose or
execute, and it adds no tool, no action and no authority. The other workspaces' Knowledge paths are
unchanged.

Director decisions this phase implements, as named in the code (no separate design document was
written):

- **A**: individual conversation ownership. Tenant AND `conversations.created_by` must match the
  acting human.
- **B**: through `/heby`, ratified Knowledge only.
- **C**: Knowledge is an OPTIONAL class at the EAI gate. A tenant authorized for conversation but
  not for Knowledge keeps its model answer, and its Knowledge is withheld from the model.

## 1 · What was released

| Commit | Content |
|---|---|
| `63847a56` | `feat(heby): add governed Knowledge grounding and disclosure visibility`. 24 files, +1246 / −36: 12 source, 3 new test files, 8 updated census and pin tests, `learnings.md`. No migration, no schema file. |

On `main`: fast-forward `29e01ff5 → 63847a56`, pushed by the Director on 2026-10-14.

**Status of each part:**

| Part | Implementation | State |
|---|---|---|
| Conversation ownership | `durable-conversation-repository.server.ts`: `requireActor`; every read and append checks tenant and `created_by`; a row without an owner is no longer reachable, and is not deleted | IMPLEMENTED · VERIFIED (local) · PRODUCTION-ACCEPTED for the owner path |
| Ratified Knowledge | `knowledge-evidence.server.ts` `resolveRatifiedKnowledgeEvidence`. The `knowledge_nodes.ratification_decision_id` claim counts only when Governance holds a `ratify` decision with that id for that version in this tenant. An unreadable ratification refuses all Knowledge. An unratified candidate is dropped whole: no statement, no key, no exclusion line. | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |
| Optional EAI disclosure | `model-answer.server.ts` declares `knowledge` through the released composer's `optionalDataClasses`. `heby-model-generation.server.ts` re-runs the model-facing projection with the decision's authorized classes (`projectAuthorizedEvidence`). The composer and the platform policy are unchanged. | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED for the authorized path |
| Model disclosure visibility | `governance-audit/external-ai-disclosure-read.server.ts`, a new declared reader with a closed shape. `heby-runtime/model-disclosure.ts` gives one of three states: `recorded`, `unavailable` or `no-invocation-recorded`. The "What the model received" panel is in `heby-turns.tsx`. | IMPLEMENTED · VERIFIED · PRODUCTION-ACCEPTED |
| Workspace profile | `workspace-registry.ts`: `command` gains the `knowledge` source class | IMPLEMENTED · PRODUCTION-ACCEPTED |

**What this does not change.** Provider permission is not widened:

- `anthropic/messages × assistance × knowledge` was already an ALLOW cell (B1D).
- `platform-disclosure-policy.ts` and `compose-external-ai-disclosure.ts` are untouched.
- No other workspace's Knowledge resolution changed.
- `/knowledge` keeps `resolveKnowledgeEvidenceDetailed`.

## 2 · Verification (V3)

V3 was chosen because tenant isolation, the conversation authority and a provider-disclosure
boundary changed together.

| Item | Measured |
|---|---|
| Static checks | `tsc --noEmit` 0, `eslint` (12 changed source files) 0, `git diff --check` clean |
| Phase suites | `tests/heby-grounded-conversation-1/{grounded-conversation-postgres, optional-disclosure-postgres, model-disclosure-surface}.ts` PASS, plus the 8 changed census and pin suites PASS |
| Full suite command | `env -u DATABASE_URL HEBUN_TEST_ADMIN_DATABASE_URL=postgresql://postgres@localhost:5432/postgres node scripts/run-tests.mjs` in `apps/dashboard`, PostgreSQL 18.0, superuser role, run sequentially |
| Candidate `63847a56` | `989 passed, 46 failed, 1035 total`. 2026-10-14T19:14:31Z → 19:44:30Z |
| Baseline `29e01ff5` | `986 passed, 46 failed, 1032 total`. 19:44:30Z → 20:13:33Z |
| Comparison | The candidate's 3 extra files are the HGC-1 tests, all PASS. Same 46 failing files on both sides. First error identical in 46 of 46. Log-and-continue soft-assert re-run of the 36 non-bite-proof red files: failing-assertion sets identical in 36 of 36 (278 = 278). The 10 red bite-proofs were compared at first error only, because they rewrite source. **0 regressions.** |
| Worktrees | Both clean after the runs (only the untracked `node_modules` symlink). Bite-proof restore intact. |

**Environment findings.** These were not caused by this phase.

- The harness's default admin URL is the PostgreSQL 14 instance on `55432`, which cannot apply this
  migration set: collation `pg_c_utf8` needs PostgreSQL 17 or later.
- A non-superuser admin role (`senolsevim`, `rolsuper = f`) makes teardown fail with `permission
  denied to terminate process`. The first, parallel run was invalid for this reason: 100 and 92
  failures, with different sets on each side. It also leaked 101 disposable databases.
- With Director approval, those 101 were proven by origin and dropped, which freed 1545 MB. Proof of
  origin: a contiguous OID range above the 167 pre-existing databases, names mapping to that run's
  tests, and no active connections.

## 3 · Production release and acceptance (each a separate Director gate)

Production reads used read-only scripts outside the repository. Each script opens the session with
`default_transaction_read_only=on` and fails closed unless it is on, then opens `BEGIN TRANSACTION
READ ONLY` and fails closed unless that is on. Timeouts are set: statement 30 s, lock 5 s, idle in
transaction 120 s. Every script ends with `ROLLBACK`, prints error codes only, and prints no
credential, no message content and no Knowledge statement. Each was dry-run on a migrated local
PostgreSQL 18 before production. All are SELECT-only and import only `pg`.

| Gate | Time (UTC) | Measured |
|---|---|---|
| Readiness | 20:17:41 | Neon PG 18.6, ledger 78 (equal to the candidate). 69 conversations, 0 with a null owner, 0 whose owner is not a user, 0 whose owner is not a tenant member, 1 owner per tenant. 152 messages: 0 cross-user, 0 multi-author, 0 cross-tenant. Assistant correlations: 15 with exactly one decision, 51 with none, 0 with several. Both tenants hold `assistance×knowledge`. Ratified Knowledge (Governance-verified): tenant `9947…` 5 of 5, Hebun 1 of 2. Required columns and `audit_log_correlation_idx` present. **Expected ownership impact: none.** |
| Release | 2026-10-14 | Director pushed `29e01ff5 → 63847a56` by hand. Claude Code's auto mode refused the push as a production deploy. |
| Deploy | 20:28:27 → 20:29:59 | `dpl_2LRykQ5P2fdLjRQgG2rCft8biX8G` READY, target production, `gitSource.sha` = `63847a56…`, ref `main`, `aliasAssigned: true`. `www.hebuntech.com` and `hebun-ai-recovered.vercel.app` both resolve to it (alias records). `/` and `/login` 200, signed-out `/heby` 307 → `/login`, no error-level runtime log. |
| Knowledge preparation | 20:38:35 | Hebun facts: `ingest:hebun-knowledge-test:9c400b0af84b:0` (node `2ce5847e…`, v2, ratify decision `54877736…` verified, no reject, a test canary) and `hebun-repository` (node `143d8eaf…`, v1, not ratified). EAI revision 4 `242a0db8` active. Attestation `ffb0c160` active, model `claude-haiku-4-5-20251001`. `claude` control enabled. Last live model answer 2026-10-12. The question was matched offline against production lexemes: both facts match lexically (0.70 and 0.20), so the request also tests the drop. |
| Acceptance | 20:42:32 | Director, one request, new conversation: "Hebun Knowledge Test kaydına göre test kod adı nedir?". Observed answer: the canary. |
| After-probe | 20:43:20 | See below. |

**Acceptance: 14 of 14 PASS**, measured at 20:43:20Z against the 20:38:35Z baseline:

1. Conversations 46 → 47 (`03fccf21…`).
2. Messages 104 → 106: one user message and one assistant message.
3. Assistant message `f981f174…` has `origin = model`.
4. `transport = live`.
5. `provider = claude`.
6. Model `claude-haiku-4-5-20251001`, the same in the message, the decision and the attestation.
7. Correlation `6419261a-55b3-4797-a110-8922dd4ce9d5` is present.
8. Exactly 1 decision for that correlation. Disclosure decisions 20 → 21; audit 112 → 113, and the
   decision is the only new audit row.
9. `external-ai.disclosure.authorized`, purpose `assistance`, declared = authorized =
   `["conversation","knowledge"]`, so nothing was withheld.
10. The evidence set is `matched` with exactly one item: the ratified fact, node `2ce5847e…`, v2/v2.
11. `hebun-repository` is absent, and `excluded_count = 0`, so it was dropped whole. The model-facing
    text itself is not recorded; it is built from the same filtered resolutions.
12. Knowledge facts 2 → 2 and Governance decisions 24 → 24. Both facts keep their versions and
    `ratification_decision_id`.
13. Both new messages are authored by the conversation's owner.
14. The deployment's runtime log has 50 entries, all HTTP 200, no 5xx. The only error-level line is the
    pre-existing `pg` SSL-mode deprecation warning.

The panel's recorded classes follow from the one decision row: "The model received: your question
and this conversation, Knowledge.", with no withheld line. The UI texts ("Model-assisted · live
provider", "Evidence (1) · sent to the model", "Sources (61)") are the Director's report. Claude did
not drive the browser. "Sources (61)" is human-facing source evidence. The Command workspace discloses
no class but `knowledge`, as the decision row shows.

## 4 · Not verified

- **Conversation-only path in production.** Every production tenant holds `assistance×knowledge`, so a
  Knowledge-withheld answer was proven locally only (`optional-disclosure-postgres.ts`).
  HGC-1-CONVERSATION-ONLY-PROD-1.
- **Second member denied.** Every production tenant has one conversation owner, so a second member's
  denial was proven locally only (`grounded-conversation-postgres.ts`). HGC-1-SECOND-MEMBER-PROD-1.
- **The model-facing text.** No record holds what the provider received. Criterion 11 rests on the
  persisted evidence and the code path.
- **Older answers.** The 51 earlier answers with a correlation but no decision row show
  `unavailable`, which is honest. The 10 without a correlation show `no-invocation-recorded`.
- **Refusal paths.** A refused decision and an unreadable ratification were not exercised in
  production; they are proven locally.

## Closure Contract (v1)

- Phase: HEBY-GROUNDED-CONVERSATION-1
- Owner: apps/dashboard/src/features/heby-answer (model-answer.server.ts, knowledge-evidence.server.ts, load-conversation.server.ts) with heby-conversation/durable-conversation-repository.server.ts (conversation authority) and governance-audit/external-ai-disclosure-read.server.ts (declared reader); the external-AI disclosure composer and platform policy unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 63847a56 — released on `main` (fast-forward from 29e01ff5)
- Verification level: V3 — tenant isolation, conversation authority and an external-AI provider-disclosure boundary changed together; full suite run on candidate and baseline with the reason stated before the run (section 2)
- Verification evidence: tsc 0, eslint 0, git diff --check clean; tests/heby-grounded-conversation-1 (3 files) PASS; full suite against PostgreSQL 18: candidate 63847a56 989 passed, 46 failed, 1035 total; baseline 29e01ff5 986 passed, 46 failed, 1032 total; same 46 failing files, first error identical 46/46, soft-assert failing-assertion sets identical 36/36 (278 = 278), 0 regressions
- Test environment: worktrees `.claude/worktrees/heby-grounded-conversation-1` (63847a56) and `.claude/worktrees/hgc1-baseline` (29e01ff5), clean but for the shared node_modules symlink; macOS (Darwin 25.2.0); tsx; PostgreSQL 18.0 at localhost:5432 as superuser `postgres` via HEBUN_TEST_ADMIN_DATABASE_URL; no provider, no credential, no browser
- Deployment evidence: dpl_2LRykQ5P2fdLjRQgG2rCft8biX8G READY production at 63847a56 (gitSource.sha), aliases www.hebuntech.com and hebun-ai-recovered.vercel.app, ready 2026-10-14T20:29:59Z
- Production acceptance evidence: section 3 — readiness read (69 conversations, 0 null or invalid owners, 0 cross-user writes, ledger 78); one live Claude request (assistant f981f174, origin model, transport live, claude-haiku-4-5-20251001, correlation 6419261a) with exactly one authorized assistance decision declaring and authorizing conversation and knowledge; evidence set holding exactly the ratified fact (node 2ce5847e v2, decision 54877736); unratified hebun-repository absent; Knowledge facts and Governance decisions unchanged; acceptance 14/14 PASS
- Deferred risks: HGC-1-CONVERSATION-ONLY-PROD-1 (DEFERRED); HGC-1-SECOND-MEMBER-PROD-1 (DEFERRED); HGC-1-RATIFIED-POOL-ORDER-1 (DEFERRED); HGC-1-RATIFIED-DRAFT-LIFECYCLE-1 (DEFERRED); HGC-1-ROLLBACK-NOT-EQUIVALENT-1 (DEFERRED); TEST-HARNESS-ADMIN-ROLE-1 (DEFERRED)
- Director approvals: decisions A, B, C (2026-10-14); one local commit of 63847a56 (2026-10-14); read-only release readiness; V3 full suite against PostgreSQL 18 and probe preparation; production readiness read and conditional cleanup of the 101 proven leaked local test databases; controlled release of 63847a56 (push performed by the Director); post-push verification; one real-provider Knowledge acceptance request (performed by the Director); PRODUCTION-ACCEPTED (2026-10-15); documentation closure prepared, commit NOT yet approved

### Deferred risk detail

- **HGC-1-CONVERSATION-ONLY-PROD-1 (DEFERRED).** A tenant authorized for `assistance × conversation`
  but not for `knowledge` should keep its model answer with Knowledge withheld. This is proven
  locally. It is unobservable in production until such a tenant exists.
- **HGC-1-SECOND-MEMBER-PROD-1 (DEFERRED).** A second member of the same tenant must not read or append
  to another member's conversation. This is proven locally on a disposable database. Production has
  one conversation owner per tenant, so a negative production test needs a second account.
- **HGC-1-RATIFIED-POOL-ORDER-1 (DEFERRED).** The ratification filter runs after retrieval has ranked
  and limited candidates, so unratified matches can crowd ratified ones out of the served set. This is
  a quality limit, not a disclosure risk: an unratified version never reaches the model. Filter inside
  the ranked pool if a tenant's corpus makes this visible.
- **HGC-1-RATIFIED-DRAFT-LIFECYCLE-1 (DEFERRED).** A Governance-ratified version can still read
  `draft` / `provisional` in Knowledge. Production's accepted fact does. Runtime eligibility admits
  `draft`, so behaviour is correct, but the evidence card can show a draft badge on ratified
  Knowledge. This is a legibility decision for the Knowledge owner.
- **HGC-1-ROLLBACK-NOT-EQUIVALENT-1 (DEFERRED).** Rolling back to `29e01ff5` (`dpl_57HHUJYi…`) is
  technically safe: no migration, and the data written since is readable by the old code. But it
  restores tenant-only conversation access, under which any member holding a conversation id could
  read and append. It is not security-equivalent to this release. Any rollback is a Director decision
  that accepts that exposure.
- **TEST-HARNESS-ADMIN-ROLE-1 (DEFERRED).** The disposable-database harness needs a superuser admin
  role on PostgreSQL 17 or later. Its default (the PostgreSQL 14 instance on `55432`) cannot migrate,
  and a non-superuser role leaks databases on teardown and turns parallel runs into false
  regressions. The fix belongs to test infrastructure; no change is proposed here.
