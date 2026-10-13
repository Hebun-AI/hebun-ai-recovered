# EAI-WORK-PLANNING-AUTHORIZATION-1 · Controlled Agent Reasoning phase 5 · closure record · VERIFIED

This phase records Director decisions D1 and D4 inside the existing EAI authority, so the Phase 4
AI planning runtime can be authorized later through the normal chain. It is implemented and tested
locally. It is **not deployed, no tenant is authorized and no provider was contacted**:

- D1: `work-planning` is a fifth EAI purpose, in the vocabulary, the CHECK constraint and a new
  migration (77). The migration is committed, not applied anywhere but disposable databases.
- D4: the recorded platform policy gains exactly one cell, `anthropic/messages × work-planning ×
  operational-record`. `assistance × operational-record` stays unrecorded and refuses.
- No tenant grant is written. The tenant ceremony cannot grant `work-planning` yet (§6).

## 1 · Baseline (measured 2026-10-13)

- **`origin/main`:** `64ffae70`. Instructions (`CLAUDE.md`, `hebun-loop.md`) identical to it; the
  roadmap differs only by this branch's own commits.
- **Branch:** `docs/heby-ai-planning-phase1` (worktree `.claude/worktrees/heby-ai-planning-phase1`) at
  `ef48cb4a`; `ebe6df78`, `4543af9a`, `666ce9c5`, `ee7a84e1`, `bd7ced7d`, `ef48cb4a` present, none pushed.
- **Primary tree:** `main` at `b18cb693`, not touched. No other tree written.
- **Purpose owner:** `PURPOSES` in `src/features/external-ai-data-use/contracts.ts`; the SQL mirror
  `EXTERNAL_AI_PURPOSES_SQL` in `src/db/schema/external-ai-data-use.ts` (the 1A firewall pins them equal).
- **Platform policy owner:** `RECORDED_PLATFORM_DISCLOSURE_POLICY` in
  `src/features/external-ai-data-use/platform-disclosure-policy.ts`; its cell set is a closed type.
- **Ledger:** 76 migrations, newest `20261008143657_l1b_agent_lifecycle_domain`.
- **Concurrent work:** no active connection to any `hebun_test_*` database before the runs; 167 such
  databases exist on the local PostgreSQL 18 and were left as they are.
- **Throwaway baseline:** a detached worktree at `ef48cb4a` in the session scratchpad.

## 2 · D1 — the `work-planning` purpose

| Where | Change |
|---|---|
| `contracts.ts` | `PURPOSES` gains `"work-planning"` last |
| `db/schema/external-ai-data-use.ts` | `EXTERNAL_AI_PURPOSES_SQL` gains it last |
| `db/migrations/20261013113340_eai_work_planning_purpose.sql` | drizzle-kit generated, two statements |
| `meta/_journal.json`, `meta/20261013113340_snapshot.json` | idx 76; the snapshot differs from the previous one only in this CHECK |

```sql
ALTER TABLE "tenant_ai_data_use_scopes" DROP CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk";--> statement-breakpoint
ALTER TABLE "tenant_ai_data_use_scopes" ADD CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk" CHECK ("tenant_ai_data_use_scopes"."purpose" in ('assistance', 'relevance-selection', 'agent-origination', 'media-generation', 'work-planning'));
```

It is byte-identical to the SQL Phase 4 designed. Drizzle's migrator runs the pending set in one
transaction, so the DROP and ADD are not observable apart. The ADD validates the existing rows.

**Effect of the wider vocabulary.** `MAX_SCOPE_PAIRS` (`PURPOSES × DATA_CLASSES`) rises from 40 to
50; it only bounds an authorization's input length. The tenant writer still checks every pair
against the recorded policy, so no new pair is reachable except the D4 cell.

**Rollback (verified on PG18, see §5):**

```sql
ALTER TABLE "tenant_ai_data_use_scopes" DROP CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk";
ALTER TABLE "tenant_ai_data_use_scopes" ADD CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk" CHECK ("tenant_ai_data_use_scopes"."purpose" in ('assistance', 'relevance-selection', 'agent-origination', 'media-generation'));
```

Rollback limitation: the scopes table is append-only. Once any tenant holds a `work-planning`
scope row, the rollback's ADD fails (`23514`) until a separate, Director-approved data repair removes
those rows. A withdrawal supersedes rows, it does not delete them. Before any ceremony the rollback
is clean. Reverting the code without the schema leaves a CHECK wider than the vocabulary, which is
harmless: the writer refuses any purpose outside `PURPOSES`.

## 3 · D4 — the platform cell

- `RecordedAllowedCell` gains `{ purpose: "work-planning"; dataClass: "operational-record" }` and
  nothing else: another class under `work-planning`, or `operational-record` under another purpose,
  is a type error.
- `RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells` gains one frozen cell with
  `ANTHROPIC_ASSISTANCE_BOUNDS` (no training, at most 30-day retention, Anthropic commercial terms,
  attested identity, ZDR not required) and evidence naming attestation `ffb0c160` (attested, not
  verified), its reviewed record at `dbbe8a30`, the closed projection, what stays unverified and that
  the cell authorizes no tenant.
- The evidence states that the derived booleans can single out a person in a small register
  (AI-PLAN-INDIRECT-PROFILING-1), so the projection is not claimed free of personal data.

**Not changed:** the composer, the resolver, the tenant writer, the generator, the attestation, the
Director control, the dispatch cap, the audit record, the projection contract and its validator,
the output validator, `/plan`, NL planning, Governance and Execution. The runtime's vocabulary guard
(`workPlanningDeclaration`) stays and still fails closed; only its comments changed.

## 4 · The authorization chain, as it now stands

| # | Requirement | Owner | State after this phase |
|---|---|---|---|
| 1 | Trusted tenant identity | `resolveTenantContext`; generator tenant-mismatch check | unchanged |
| 2 | Declared purpose | `workPlanningDeclaration` → `work-planning × operational-record` | now declares |
| 3 | Permitted data class | projection contract + closed-world validator (≤ 40, five fields) | unchanged |
| 4 | Tenant authorization | `tenant_ai_data_use_*` lineage, composer | **no tenant holds the scope** |
| 5 | Model/provider attestation | composer + APF-5 per-call model check | unchanged |
| 6 | Usable transport | `selectModelTransport` | unchanged |
| 7 | Director kill switch | `resolveClaudeDirectorEnabled`, operator control | unchanged |
| 8 | Invocation limits | dispatch cap, spend budget | unchanged |
| 9 | Audit | EAI evidence record | unchanged |

Platform policy (D4) is now ALLOW for the one cell. Requirement 4 is what stops every real request:
the released code, as committed, sends nothing.

## 5 · Tests

**New:** `tests/eai-work-planning-purpose/migration-postgres.ts` (PostgreSQL 18, disposable database):

- applies the ledger up to L-1b through the production migrator (`applyPendingMigrations`);
- seeds one scope row per earlier purpose (foreign keys and append-only triggers bypassed with
  `session_replication_role = replica`; the CHECK is still enforced) and shows `work-planning`
  refused before;
- applies the canonical ledger: all 77 recorded; scope and authorization fingerprints (count + md5
  of every row) unchanged; zero `work-planning` rows; one validated CHECK naming the five purposes;
- every purpose, old and new, inserts (rolled back); `"work-planning "`, `Work-Planning`,
  `planning`, the empty string and a comma list are refused with `23514`;
- the rollback applies with no `work-planning` row and fails with `23514` when one exists; both
  inside transactions that are rolled back, fingerprint unchanged afterwards.

**Changed pins, each with a stated reason in the file:**

| Suite | Change |
|---|---|
| `external-ai-data-use-1a/vocabulary-and-policy` | five purposes; seven ALLOWED cells; the cell type names three purposes |
| `external-ai-data-use-b1d/platform-allow` | the D4 cell in order; seven across the vocabulary; `work-planning` × every other class UNKNOWN; every other purpose × `operational-record` UNKNOWN; no other scope ALLOWS it; the compose test gains `work-planning` (no tenant → `tenant-not-authorized`, unreadable → `unavailable`, no attestation → `platform-unknown`, widened retention → `platform-denied`) |
| `external-ai-data-use-b1a/ceremony-firewall` | the policy pin gains the D4 row |
| `eai-operational-record/contract-and-boundary` | §1: only `work-planning` may carry the class; under the recorded policy no tenant → `tenant-not-authorized`, an assistance-only grant → `tenant-not-authorized`, the full chain → `authorized` |
| `heby-ai-operational-plan/runtime` | runs over the **recorded** policy and the **released** declaration (the hypothetical D4 cell and declaration are gone). §0: no tenant authorization → asked once, fetch 0. The vocabulary guard still yields no generator call. §2: `assistance × operational-record`, even with an assistance grant for it, fetch 0; the recorded policy without the D4 cell, fetch 0 |
| `grounding-sufficiency-gs0/claim-support` | the purpose list (no grounding purpose was added) |
| 49 ledger-count pins in 35 files (`l1b-agent-lifecycle-governance/firewall` among them); 6 canonical-digest pins in `prodmig-flow` and `g4-flow` | 76 → 77, digest `03d142f8…` → `66fde9c7…`, each with a one-line note, as L-1b did. L-1b's own suite now pins migration 76 by index instead of as the last entry |
| Newest-migration pins: `a1a-flow`, `app2-decision-truth`, `ops-p1-flow` bite-proofs (journal-tail anchor); `content-intake-1/batch-firewall`, `trh19-agent-proposal-rationale/firewall`, `prodmig-flow/canonical-prefix-postgres` (newest tag); `g4-flow/possession-and-firewall`, `kr3-flow/boundaries-and-firewall` (declared later phases) | the tail is now `20261013113340_eai_work_planning_purpose`; `prodmig-flow`'s pending-migration probe now looks for the purpose CHECK admitting `work-planning`, which only this migration adds |

**The 21 required cases:**

| # | Case | Where proved |
|---|---|---|
| 1 | `work-planning` recognized | 1A vocabulary; runtime §0 (`isPurpose`, the real declaration) |
| 2 | Earlier purposes valid | 1A vocabulary; PG18 migration (insert after) |
| 3 | Assistance policy unchanged | B1D (three cells, same bounds); runtime §2 |
| 4 | D4 cell as specified | B1D §2; 1A §2; operational-record §1 |
| 5 | Missing tenant authorization | runtime §0 and §3–6; operational-record §1/§2; B1D §4 |
| 6 | Revoked authorization | runtime §3–6; operational-record §2 |
| 7 | Wrong tenant | runtime (refused before the authority is asked) |
| 8 | Missing attestation | runtime §3–6; operational-record §2; B1D §4 |
| 9 | Wrong model attestation | runtime ("an attestation for another model"); operational-record §2 |
| 10 | Missing transport | runtime §7 (no generator call) |
| 11 | Director disabled | runtime §7 (no generator call); operational-record §2 (`operator-paused`) |
| 12 | Unauthorized field | operational-record §3 |
| 13 | Title leakage | operational-record §3; runtime control (12, what crossed the wire) |
| 14 | Unknown projection field | operational-record §3 |
| 15 | Invalid model response | runtime §8–11 |
| 16 | Fabricated evidence | runtime §8–11 |
| 17 | No Governance bypass | runtime §13 |
| 18 | No Execution authorization | runtime §14 |
| 19 | No autonomous execution | runtime §14, §18 (nothing persisted, proposed or executed) |
| 20 | `/plan` unchanged | runtime §15 |
| 21 | NL planning unchanged | runtime §16 |

The provider is a counting `fetch` behind the real live Claude transport; the EAI decision is the
real composer over the recorded policy; the tenant grant is a stated test value. **This is not a
provider acceptance.** No real provider was called.

**Bite-proofs.** Each was applied by exact-string replacement, confirmed by md5, made the named
suites exit 1, and was restored from its own copy and confirmed by `cmp`:

| # | Mutation | Suites that failed |
|---|---|---|
| B1 | A recorded `assistance × operational-record` cell | B1D platform-allow, operational-record, runtime |
| B2 | The D4 cell removed | runtime, operational-record |
| B3 | The composer lets `work-planning` past the tenant scope | runtime, operational-record |
| B4 | The SQL vocabulary drops `work-planning` | 1A firewall-and-inertness |
| B5 | The D4 cell widened to `work-artifact` | B1D platform-allow, 1A vocabulary-and-policy |
| B6 | The migration drops `media-generation` | PG18 migration suite |

## 6 · Regression

Run sequentially, never two at once, against PostgreSQL 18 at 127.0.0.1:5432 (`npm run test:run`
semantics, `node scripts/run-tests.mjs`). No other session held a `hebun_test_*` connection.

| Run | Tree | Pass | Fail |
|---|---|---|---|
| 1 | change (before the newest-migration pins) | 969 | 55 |
| 2 | baseline: clean `ef48cb4a` | 977 | 46 |
| 3 | change, final | **978** | **46** |

- **Run 1 found 9 genuine change-only failures, all of one kind:** suites that pin the *newest*
  migration tag or the journal tail (listed in §5). One of them, `prodmig-flow/bite-proofs`, failed at
  a different mutation (M2) only because its target suite was red on the stale probe; after the fix
  it fails at M6 on both trees, twice each.
- **Run 3 against run 2:** the same 46 suites fail on both trees, and every one fails on the same
  first error line (compared mechanically). No suite fails only on the change; the one extra pass
  is the new migration suite. The 46 are the known red baseline, not investigated here.
- **`TEST-HARNESS-PG18-TEARDOWN-1` did not show in these runs:** no `42501` in any log, and the
  `hebun_test_*` count stayed at 167 before, between and after all three runs. The flake is
  intermittent; its absence here is an observation, not a fix. The harness was not modified.
- **Focused:** every EAI suite (1A, B1A, B1D, B2, tenant ceremony, PG suites included), the
  operational-record contract, the AI planning runtime, the planning projection and output contract,
  NL planning and `g4-flow/production-ceremony-postgres` pass in run 3.
- **Static:** `tsc --noEmit` exit 0; `eslint` on all 53 touched `.ts` files exit 0 with one warning
  (`trh24-machine-observation/authority-firewall.ts:28`, an unused `READER`, on an untouched line,
  present at baseline); `git diff --check` exit 0; development-continuity closure contract exit 0.

## 7 · Implemented / tested / configured / authorized / deployed / executed / verified

| | State |
|---|---|
| Implemented | Yes: the purpose, the CHECK migration, the D4 cell, the tests |
| Tested | Yes, locally: §5 and §6 |
| Configured | No. The migration is applied to no shared or production database; production stands at its own ledger |
| Authorized | No. No tenant holds `work-planning × operational-record`; the tenant ceremony cannot grant it yet |
| Deployed | No. Not pushed |
| Executed | No. No provider call was made with Work data; no AI plan was produced from real records |
| Verified | Locally only, as above. Not in a browser, not in production |

## 8 · Production release prerequisites, in order

1. **Director gate: push** of this branch (`ebe6df78` … this commit) to `main`. A push to `main` is a
   Vercel production deploy. Before it, `tsc --noEmit` on the final tree (Vercel type-checks `tests/`).
2. **Director gate: production migration** of `20261013113340_eai_work_planning_purpose` through the
   production migration authority's ceremony (backup, lock, prefix verification). Production must be
   at 76 first; the release digest becomes `66fde9c7…`. The code may deploy before the schema: until
   the migration runs, a `work-planning` grant cannot be written and requests still refuse.
3. **Code change, separately reviewed:** the tenant ceremony
   (`scripts/eai-authorize-tenant-external-ai-data-use.ts`) gains `work-planning: ["operational-record"]`
   in `EXPECTED_DATA_CLASSES` behind an explicit `--work-planning` flag. Not done here: the brief did
   not authorize ceremony work, and the current script reads cells by purpose, so its existing
   behaviour is unchanged by D4.
4. **Director gate: tenant ceremony** for a named tenant, after confirming the production attestation
   `ffb0c160` is still active and lists the configured model.
5. **Director gate: first real provider call** with a pilot tenant's Work records, and its
   production acceptance (fetch observed, refusal paths observed, nothing persisted).
6. **Open risks to decide before release:** AI-PLAN-TITLE-PII-1 (D3 kept titles out; stays
   deferred), AI-PLAN-INDIRECT-PROFILING-1 (D4 recorded the cell; small-register re-identification
   remains), AI-PLAN-RUNTIME-BROWSER-1 (browser verification of the surface).

## Closure Contract (v1)

- Phase: EAI-WORK-PLANNING-AUTHORIZATION-1
- Owner: apps/dashboard/src/features/external-ai-data-use (contracts.ts PURPOSES, platform-disclosure-policy.ts RECORDED_PLATFORM_DISCLOSURE_POLICY), apps/dashboard/src/db/schema/external-ai-data-use.ts and migration 20261013113340_eai_work_planning_purpose
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — a schema migration on an authorization table and a platform disclosure decision on the provider boundary. The full suite was run, sequentially, on the change and on a clean `ef48cb4a` worktree, because the suite carries a red baseline and a PostgreSQL 18 teardown flake that only a measured comparison can separate from a regression.
- Verification evidence: full suite run sequentially: change 978 pass / 46 fail vs clean ef48cb4a 977 / 46, identical failing set and identical first error per failing suite (the extra pass is the new suite); an earlier change run (969 / 55) exposed 9 newest-migration pins, fixed and re-run individually before the final run; tests/eai-work-planning-purpose/migration-postgres.ts exit 0 on PostgreSQL 18.0; six bite-proofs exit 1 (applied by md5, restored by cmp); hebun_test_* count 167 before and after every run, no 42501; tsc --noEmit exit 0; eslint exit 0 on touched files; git diff --check exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-ai-planning-phase1` at ef48cb4a plus this phase's changes; detached baseline worktree at ef48cb4a in the session scratchpad; macOS (Darwin 25.2.0); tsx and drizzle-kit 0.31 from the shared `apps/dashboard/node_modules`; PostgreSQL 18.0 at 127.0.0.1:5432 through `HEBUN_TEST_ADMIN_DATABASE_URL`; no provider, no credential, no production data
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released; the migration is not applied to production, no tenant is authorized, no provider call was made
- Deferred risks: AI-PLAN-TITLE-PII-1 (DEFERRED); AI-PLAN-INDIRECT-PROFILING-1 (DEFERRED); AI-PLAN-RUNTIME-BROWSER-1 (DEFERRED); TEST-HARNESS-PG18-TEARDOWN-1 (DEFERRED); EAI-WORK-PLANNING-CEREMONY-1 (DEFERRED)
- Director approvals: D1 and D4 narrow local implementation, the migration file, the tests, census updates, documentation and a focused local commit (CONTROLLED AGENT REASONING · PHASE 5 brief, 2026-10-13); production migration, policy activation in production, the tenant ceremony, provider credential changes, a real provider call, push, deploy, machine-execution ARM and deletion of the hebun_test_* databases NOT approved
