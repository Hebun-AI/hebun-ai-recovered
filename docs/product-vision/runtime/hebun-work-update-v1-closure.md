# WORK-UPDATE V1 · closure record · PRODUCTION-ACCEPTED

An agent may now PROPOSE changing the declared state of one existing work item that a human selected, to
a state the human chose. A human with Governance authority approves; a different, later human action
executes; the Organizational Work Authority performs the single `declared_state` UPDATE with the permit
spend joined to its transaction. Nothing is approved, permitted or executed automatically. The act was
accepted in production end to end exactly once: `bb56f9dc` planned → active.

Design authority: `docs/product-vision/runtime/hebun-work-update-v1-design.md` (§13 Director decisions,
§14.5 the T1 doctrine exception). This record does not change it; §18 of that document adds the
disclosure clarification below.

## 1 · What was released

| Commit | Content |
|---|---|
| `3ec2fb38` | `feat: WORK-UPDATE V1 governed set-work-declared-state` — new originable kind `set-work-declared-state`; migration 78; Heby-only origination (Director Option A) with the Work register linking to `/heby?workItem=<id>`; injected, required, read-only pre-model preflight; Work-Authority-owned transaction with the permit spend as a savepoint (T1); stale-state notice in the approval card (U6); WF-2 card separation; transitive import-graph firewall; 13 bite-proofs |
| `025c59ba` | `test: acknowledge WORK-UPDATE V1 in two historical pins` — test-only (wev1 masked pin; google-capability-scope-repair-1 git-diff allowlist) |

Both are on `main` (`origin/main` = `025c59ba`, fast-forward from `9308e12c` at 2026-10-14T09:30:39Z).

**Ownership, unchanged in kind.** The Organizational Work Authority (`organizational-work/write-work.server.ts`,
`declareWorkStateUnderPermit` → `declareWorkStateCore`) owns the only `declared_state` UPDATE; Action
Authorization (`consume-action-permit.server.ts`) owns the spend, unchanged; Governance
(`decide-action-request.server.ts`) owns the approval, unchanged; `governed-internal-action/execute-set-work-state.server.ts`
owns nothing and checks only the envelope. `PermitConsumptionTx` was not widened (design D3). Not
machine-executable, not standing-authorizable.

**Disclosure, as implemented.** The model receives Hebun's fixed instructions and one fixed sentence
keyed by the human's target state (`WORK_STATE_ORIGINATION_GOALS`); no grounding lines; no work
identifier, title, description, current state, domain, department or person. Declared data classes:
`["conversation"]` only (`WORK_STATE_ORIGINATION_DATA_CLASSES`, pinned by
`tests/work-update-v1/work-state-firewall.ts` F6). The design's `{conversation, organization}` was not
implemented; see WORK-UPDATE-DISCLOSURE-DESIGN-TEXT-1.

## 2 · Verification

G0 (before release, recorded in the release session): full suite on `3ec2fb38` = 985 passed / 47 failed;
46 of 47 had first errors identical to `1a9ce862`, the 47th (google-capability-scope-repair-1) was fixed
in `025c59ba`; one masked WORK-UPDATE pin in wev1 found by a log-and-continue assert preload, fixed in
`025c59ba`. The expected count for `025c59ba` was **not** measured then.

Closure re-run on the released commit, measured:

| Item | Measured |
|---|---|
| Command | `PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH" HEBUN_TEST_ADMIN_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/postgres npm run test:run` in `apps/dashboard` |
| Commit | `025c59ba` (worktree `.claude/worktrees/work-update-v1`, clean before and after; no bite-proof residue, `git status` shows only the untracked `node_modules` symlink) |
| Window | 2026-10-14T12:06:34Z → 12:33:36Z; free disk never below 10.0 GB (ENOSPC guard) |
| Result | `Test summary: 986 passed, 46 failed, 1032 total.` Runner exit 1. No skips (the runner has none) |
| Reason for the full suite | V3: schema migration, authority, execution boundary and a provider boundary changed; G0 measured `3ec2fb38`, not the released commit |

**Failure classification — 0 regressions.** Each of the 46 red suites was re-run alone on `025c59ba` and
its first error compared with the G0 logs of `3ec2fb38` and of the pre-change base `1a9ce862`:

- 46 / 46 have the **same first error as `3ec2fb38`**; the set equals G0's 47 minus
  `google-capability-scope-repair-1/scope-composition.ts`, which `025c59ba` fixed and which now passes.
- 30 / 46 have the same first error as `1a9ce862`.
- The other 16 are the same assertion with an explained difference: 7 ledger pins read `78 !== 67`
  where the base read `77 !== 67` (migration 78 is the one this phase adds); 1 (`mv6-higgsfield-video/lifecycle-postgres.ts`)
  names `20261014042643_work_update_v1_mandate_scope` as the newest migration where the base named
  `20261013113340_eai_work_planning_purpose`; 8 differ only in the absolute path printed in the stack.

All 46 are base-red at `1a9ce862`, before WORK-UPDATE V1 (pins of older phases asserting their own historical facts —
ledger counts, the newest migration, firewall reach). First-error matching proves nothing about assertions after the first;
G0's log-and-continue comparison covered those and found the one masked pin fixed in `025c59ba`. These
suites are not modified here.

Phase-specific suites in the same run, all PASS: `tests/work-update-v1/{work-state-firewall,work-state-postgres,work-register-reach-firewall,selection-render,bite-proofs}.ts`
(bite-proofs B1–B13), and `tests/development-continuity/closure-contract.ts`.

## 3 · Production release and acceptance (each a separate Director gate, 2026-10-14)

Every production number below is a read-only measurement. From G5 on, Claude Code's auto mode refused
production reads, so each probe was **run by the Director in their own terminal**: a script that opens the
session with `default_transaction_read_only=on`, starts `BEGIN TRANSACTION READ ONLY`, aborts before any
query unless `transaction_read_only = on`, and always ends with `ROLLBACK`; loaded with
`node --env-file=apps/dashboard/.env.ceremony.local` from this worktree; it prints no credential, no
payload body beyond the act's own fields and no work description. Claude read the output files.

| Gate | Time (UTC) | Measured |
|---|---|---|
| G1 backup | 09:16:30 | `pg_dump` 18 backup `hebun_production_pre_migration_20261014-091630.dump`, 832 834 B, sha256 `363be3c4…`, 827 TOC entries, full local restore matched production; production unchanged (ledger 77) |
| G2 migration 78 | ~09:24 | `20261014042643_work_update_v1_mandate_scope.sql` through `scripts/platform-migrate.ts` (Director typed the confirmation): ledger 77 → 78, digest `631074fb`, `agent_mandates_scope_subset_chk` widened and `convalidated`, constraint shape `90511eda` = canonical 78; nothing else changed |
| G3 deploy | 09:30:47 | push `9308e12c..025c59ba` → `dpl_H26ph9fbJ1wwB9Ed4eUX9KvxKNBU` READY, target production, aliased `www.hebuntech.com`; database unchanged by the deploy (ledger 78, audit 283, invocations 19, `work_items` md5 `0f459f0a…`, `159b49ce` pending) |
| G4 mandate | 10:31:29 | Heby (`4ffeeb83`) revision 5 `e1f3a684` through `/agents` "Revise this mandate": scope `{send, record-work, set-work-declared-state}`, 566-character Director-approved purpose, supersedes rev 4 `eec43290`; responsibility restated exactly (organization + Engineering `e48da4bb`); decision `ef09aad3` (human `d5b496df`, approve agent_mandate), session `492345cf`; audit +2 (`governance.decision.recorded`, `agent-mandate.revised`); nothing else changed |
| G5 preflight | 11:09:23, 11:15:08 | identical: ledger 78; rev 5; one in-service agent (Heby, so the affordance's proposer is unambiguous); tenant EAI revision 4 `242a0db8` holds `agent-origination × conversation`, attestation `ffb0c160` (model `claude-haiku-4-5-20251001`); `claude` provider control enabled; dispatch cap 0 of 50 today; `bb56f9dc` planned, active, domain `e48da4bb`, no related request |
| G5 origination | 11:21:24 | Director on `/heby?workItem=bb56f9dc…`, target `active`, one click. Invocation `1b35e25f-d1e9-4279-9fdb-f5ebbd43287b`: live, `claude-haiku-4-5-20251001`, provider message `msg_011Cg23M…`, 262 / 32 tokens, `selection-valid`, filing `proposed`. Request `bc195e09-81c2-4050-a817-6314082480b5`: `set-work-declared-state`, tool `heby.work.set-declared-state`, target `work-item/bb56f9dc-c833-4bbe-892e-6456bec3d8c3`, **pending**, proposer agent `4ffeeb83`, payload `{workItemRef: work-item/bb56f9dc…, fromState: planned, toState: active, workScope: domain, workDomainRef: work-domain/e48da4bb…}`; digest `9ae1619cb6a2c0b29288d8fc227a730b5f30264a84253335c055bed8557e6499` recomputed with `digestCanonicalAction` from `025c59ba`: **match**. Audit +1 `external-ai.disclosure.authorized` `65261576`: purpose `agent-origination`, declared = authorized classes `["conversation"]`, correlation = the invocation. Delta: invocations 19 → 20, requests 24 → 25, audit 285 → 286, dispatch 0 → 1; `work_items` md5, decisions, sessions, permits, attempts unchanged |
| G6 preflight | 11:46:57 | `bc195e09` pending, digest match; `bb56f9dc` planned, version 1, `updated_at` 2026-10-12T17:51:42Z; no decision, permit or attempt on either target; the one pre-existing active permit `012f9795` belongs to record-work `57f488cb` and expired 2026-09-14 |
| G6a approval | 11:52:42 | Director at `/approvals`, justification typed, TTL 1 hour. Decision `e3961a42-684f-4a04-9550-19af2b4a3abb`: `approve`, outcome `action-authorized`, human `d5b496df`, subject `heby_action_request` `bc195e09`; `bc195e09` → approved; permit `a47cbc9e-1a70-4d69-bed8-15455262a38d` active, bound digest `9ae1619c…`, expires 12:52:42.959Z; audit +2 (`governance.action.approved`, `governance.action.permit.issued`); decisions and sessions 88 → 89; `work_items` md5 and attempts unchanged |
| G6b preflight | 11:56:39 | identical to the post-approval read (22 fields); permit unexpired |
| G6b execution | 11:57:45 | Director "Execute now", one click. Permit `a47cbc9e` consumed 11:57:45.550Z, handoff `1f074fe3-139c-4186-943b-0ad466f15281`. `bb56f9dc` `declared_state` planned → **active**, `updated_at` 11:57:45.546Z, `updated_by_type = system`, `updated_by` the Director, `version` 1 (no writer sets it — design §11 D8). Audit +2: `governance.action.permit.consumed` and `work.state-declared` `23ef2834` with `{handoffId: 1f074fe3…, declaredState: active}`. `bc195e09` stays approved; decisions 89, sessions 89, invocations 20, execution attempts 6 unchanged |
| Row-level | 12:01 | only `bb56f9dc` changed or was created since 11:00Z; the other 7 rows: md5 `921051b2…`, latest `updated_at` 2026-10-08T06:43:22Z; the only Work audit since G5 is `23ef2834`. `159b49ce` pending throughout, digest `14777add…` match |

The browser texts ("Heby proposed declaring this item active (from planned)…", "Authorized — not
executed", "Executed") are the Director's report; Claude did not drive or capture the browser.

**What this does not prove.** Provider-account reconciliation is not done (GATE-D-PROVIDER-RECONCILIATION-1,
owned elsewhere, stays BLOCKED); this acceptance adds origination message `msg_011Cg23M…` (full id in
`heby_origination_invocations` `1b35e25f`) as a further reconciliation candidate. No refusal path was
exercised in production; refusals are proved locally (§2).

## 4 · Deviations from the design, stated

- U5 (work item page only) was superseded by Director Option A: origination lives on Heby; the Work
  register offers a plain link. Design §17 records it.
- The design's mandate step named a scripted scope ceremony; G4 used the released `/agents` mandate
  revision form under the Director's hand, with the same decision, session and audit footprint.
- The rev 5 purpose is the 566-character Director text combining rev 4 with U4, not U4 alone.
- The design's disclosure classes `{conversation, organization}` (§2, §3 step 4, §10.8) were not
  implemented; production records `conversation` only.

## Closure Contract (v1)

- Phase: WORK-UPDATE-V1
- Owner: apps/dashboard/src/features/organizational-work/write-work.server.ts (Organizational Work Authority, the only declared_state writer) with governed-internal-action/execute-set-work-state.server.ts; Action Authorization, Governance and the external-AI disclosure gate unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 3ec2fb38, 025c59ba — released on `main` (`origin/main` = 025c59ba)
- Verification level: V3 — authority, execution boundary, schema migration and an external-AI provider boundary changed together; full suite run on the released commit with its reason stated (§2), plus the WORK-UPDATE firewall, reach firewall and 13 bite-proofs
- Verification evidence: full suite on 025c59ba `npm run test:run` against PostgreSQL 18: 986 passed, 46 failed, 1032 total, exit 1; all 46 failures re-run alone with first errors identical to 3ec2fb38 and base-red at 1a9ce862 (16 differ from the base only by the ledger 77→78, the newest migration name or the printed path), 0 regressions; tests/work-update-v1 (5 files, bite-proofs B1–B13) PASS; development-continuity closure-contract PASS; G0 log-and-continue comparison at 3ec2fb38 recorded in section 2
- Test environment: worktree `.claude/worktrees/work-update-v1` at 025c59ba (clean but for the shared node_modules symlink); macOS (Darwin 25.2.0); tsx; PostgreSQL 18 at 127.0.0.1:55433 via HEBUN_TEST_ADMIN_DATABASE_URL; no provider, no credential, no browser
- Deployment evidence: dpl_H26ph9fbJ1wwB9Ed4eUX9KvxKNBU READY production at 025c59ba (www.hebuntech.com), pushed 2026-10-14T09:30:39Z
- Production acceptance evidence: section 3 — ledger 78 digest 631074fb; Heby rev 5 e1f3a684; one live origination (invocation 1b35e25f, msg_011Cg23M…, conversation only) filing request bc195e09 PENDING with digest 9ae1619c recomputed match; human approval decision e3961a42 and permit a47cbc9e; one human execution consuming the permit (handoff 1f074fe3) and changing exactly one work_items row (bb56f9dc planned → active) with one work.state-declared audit; row-level read proves the other 7 rows untouched; 159b49ce pending and unchanged throughout
- Deferred risks: WORK-UPDATE-DISCLOSURE-DESIGN-TEXT-1 (CLOSED); WORK-UPDATE-UNSCOPED-ITEMS-1 (DEFERRED); WORK-UPDATE-AGENT-SELECTION-1 (DEFERRED); WORK-UPDATE-LOGIN-QUERY-LOSS-1 (DEFERRED); WORK-UPDATE-ROLLBACK-FLOOR-1 (DEFERRED); PERMIT-EXPIRED-STATUS-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: design decisions D1–D8 and U1–U6 (2026-10-14); Option A replacing U5 (2026-10-14); G1 commit of 3ec2fb38; G1 backup; G2 migration 78 (typed in the Director's terminal); G3 push and deploy of 025c59ba; G4 mandate revision 5 with the approved purpose; G5 one origination on bb56f9dc planned → active, no retry; G6a one approval of bc195e09 only; G6b one execution of permit a47cbc9e only; closure preparation in feat/work-update-v1 with a full-suite re-run and the §22 dispositions above (2026-10-14); commit, push and deploy of this record NOT approved

### Deferred risk detail

- **WORK-UPDATE-DISCLOSURE-DESIGN-TEXT-1 (CLOSED)** — the design named `{conversation, organization}`;
  the implementation declares and production recorded `conversation` only (narrower). Closed by design §18,
  which states the discrepancy and keeps the original text. Provider disclosure is not widened.
- **WORK-UPDATE-UNSCOPED-ITEMS-1 (DEFERRED)** — a work item with no work domain cannot be a V1 target
  (`work-not-domain-scoped`, design R3); two Hebun items are unscoped. Scope them through the human Work
  path first; no automatic scoping.
- **WORK-UPDATE-AGENT-SELECTION-1 (DEFERRED)** — the Heby affordance sends no `agentId`; with a second
  in-service agent the proposer resolution refuses `ambiguous-durable-agent-identity` before any provider
  call. Harmless today (one agent); needs an agent choice before a second agent is placed.
- **WORK-UPDATE-LOGIN-QUERY-LOSS-1 (DEFERRED)** — the login redirect drops the query string, so a
  signed-out person following `/heby?workItem=…` lands on Heby with no selected item. Nothing is filed;
  the person must follow the link again after signing in.
- **WORK-UPDATE-ROLLBACK-FLOOR-1 (DEFERRED)** — since G4 a historical mandate revision holds the kind, so
  migration 78 cannot be reversed without rewriting history (design §9). Rollback is a new mandate
  revision without the kind plus a code disable; the pre-release reader drops unknown scope kinds, so a
  deployment rollback to `9308e12c` stays readable. Director decision on a formal floor.
- **PERMIT-EXPIRED-STATUS-1 (DEFERRED)** — an expired permit keeps `status = active`
  (`012f9795`, expired 2026-09-14); spend refuses it on `expires_at`, but a count of "active" permits
  overstates live authority. Legibility only; no behaviour change proposed here.
- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)** — owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1;
  unchanged. This phase adds candidate message `msg_011Cg23M…`.
