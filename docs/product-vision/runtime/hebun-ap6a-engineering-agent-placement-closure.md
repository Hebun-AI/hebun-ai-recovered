# AP-6a — Engineering Agent Placement — Closure

Roadmap position: §20.4 *Proposed sequencing*, the step after same-tenant multi-agent acceptance
(AP-5): "department-scoped workforce". AP-6 was opened as an architecture design review by the
Director (2026-10-18). AP-6a is its first part and only that part is closed here.

**Status: PRODUCTION-ACCEPTED (Director, 2026-10-18), scoped to AP-6a.** One existing,
Governance-gated organizational fact was recorded in production: the Engineering Agent is placed in
the Engineering department. No code, schema, migration, authority, persistence or execution path was
created or changed for it.

## What AP-6a is, and what it is not

| Claim | State |
|---|---|
| Engineering Agent placed in Engineering, production | **PRODUCTION-ACCEPTED** (8/8 invariants, below) |
| Placement grants authority | **NO.** Placement is read only by `/agents`; no mandate, capability, proposer, permit, origination or execution module reads it (AP-2 firewall rule 6, re-verified at `ee5b5874`) |
| Agent execution | **NOT PERFORMED.** No proposal, permit, spend or agent run is part of AP-6a |
| AP-6b — department-scoped authority | **NOT IMPLEMENTED.** Design question only: whether placement may ever bound an agent, against the invariant "placement grants nothing". Department scope is today expressed by work-domain responsibility (AP-4A/B). Any enforcement needs its own Director decision and a V3 phase |
| Heby | unplaced, unchanged |
| `/approvals` rationale label | production (`ee5b5874`) still titles every agent rationale "Heby's" (`AP5-APPROVALS-RATIONALE-LABEL-1`, owned by AP-5) — a UI limitation of the two-agent workforce, not of placement. The fix is implemented locally on `release/ap5-approvals-rationale-label-1`, **not deployed** |

## Authority used

`organization-authority/write-agent-placement.server.ts` → `setAgentPlacement` (AP-2, `db970ef8`):
gated by `resolveGovernanceAuthority`; the only identity parameter is a human-session
`TenantContext`; in one transaction: agent row `FOR UPDATE`, retired-agent refusal, compare-and-swap
on the shown placement, no-op refusal, target department `FOR SHARE`, the column-scoped UPDATE
(`department_id`, `updated_*`, `version`) and the `organization.agent-placement.set` audit row.
Reached from `/agents` → `setAgentPlacementAction` (`app/(dashboard)/agents/actions.ts`).

## Production measurements

Mechanism: the AP-5 read-only procedure — credentials loaded only by `node --env-file` from the
ceremony file and never printed; `set session characteristics as transaction read only`, one
transaction, `transaction_read_only = on` verified, rolled back; database name and system identifier
matched the ceremony pins (values not printed); ledger 78; every query filtered to tenant Hebun AI
`f625b683-3be5-40eb-93a4-53fc56ab38c9` and the TRH reference tenant
`9947c78e-2080-4331-81c6-456cb4be7a96`. Deployment throughout: `dpl_7aLjj2kEe5Fn4uKhnWiM17AoC7wb`,
production, READY, `githubCommitSha` `ee5b58742d640f945b5e8c60c252da19ff1a321b`, aliased to
`www.hebuntech.com` and `hebuntech.com`.

| Read | UTC | Engineering Agent `670a6889…` | Placement audit |
|---|---|---|---|
| Baseline | 2026-10-18 12:00:33 | `department_id` NULL, version 1, in service | 0 |
| Ceremony (Director, `/agents`, "Placed in Engineering", result Recorded) | 12:07:33 | — | — |
| After | 12:08:53 | `department_id` `e40866a8-deb1-416e-a3fd-47b4dcce809f` (Engineering, active, version 2 unchanged), version 2, `updated_by` the Director `d5b496df…` (human) at 12:07:33.182 | 1 × `organization.agent-placement.set`, entity agent `670a6889…`, actor human `d5b496df…`, 12:07:33.182 |

Timestamps: the read scripts' own `at` field serialized UTC wall time with a local-zone `Z`; the
times above are corrected to true UTC (baseline 12:00:33Z, not 09:00:33Z as first reported).

| # | Invariant | Result |
|---|---|---|
| 1 | `department_id` is the Engineering department | PASS |
| 2 | Agent version 1 → 2 | PASS |
| 3 | Exactly one `organization.agent-placement.set` audit row; no other audit row in either tenant since the baseline | PASS |
| 4 | Effective mandates and responsibilities unchanged (Hebun `agent_mandates` 6 · `2c39b017…`, responsibilities 5 · `9b466a44…`) | PASS |
| 5 | Decisions 27 · `d6dca151…`, requests 16 · `62646ae8…` (same status split; `bb6e707e` pending), permits 6 · `71de4079…`, execution attempts, EAI authorizations and scopes, standing, machine and external-send counts unchanged | PASS |
| 6 | Heby (`4ffeeb83…` Hebun, `67f4460c…` TRH) unplaced, version 1, `updated_at` unchanged | PASS |
| 7 | TRH six-table fingerprints unchanged (agents 1 · `10dc00e7…`, mandates 2 · `e69905b3…`, responsibilities 2 · `e269d21f…`, decisions 65 · `86d0f745…`, requests 11 · `fafad813…`, permits 9 · `7e107e0a…`) | PASS |
| 8 | No lifecycle or authorization change: suspended/retired/deleted unchanged, in-service counts 2 (Hebun) / 1 (TRH), no new decision, permit or authorization | PASS |

The only production differences: the Engineering Agent row (`department_id`, `version`,
`updated_by`, `updated_by_type`, `updated_at`), one audit row, and therefore the Hebun `agents`
fingerprint `6045e1b8…` → `62919ce4…`. Every value AP-5 recorded a fingerprint for matched at the
baseline. Not read: the platform-scoped `machine-internal-execution` control (outside the two-tenant
scope); AP-6a does not touch it.

## Verification

Released seam suites re-run at the deployed commit `ee5b5874` (detached worktree), disposable
PostgreSQL 18, `DATABASE_URL` unset, all exit 0: `ap2-agent-placement/{firewall, placement-postgres,
bite-proofs}`, `l1a-agent-in-service/in-service-postgres`, `agent-id-0-1/boundaries-and-firewall`,
`osa3-departmental-placement/placement-postgres`, `osa4-people-register/people-postgres`. The
source-class census pins that keep `osa3/firewall`, `osa3/placement-truth` and `osa4/people-truth`
red at `ee5b5874` are repaired on the unreleased branch `fix/suite-recovery-1` (`bebde54f`, B4a),
where the full OSA3/OSA4/AP-2 set and the osa3 P6 bite-proof pass; that branch is not deployed.

## Rollback

`withdrawAgentPlacement` from the same `/agents` card, through the same Governance gate and
compare-and-swap: the row returns to unplaced, version increments, one
`organization.agent-placement.withdrawn` audit row is written. No migration or data repair. Audit
rows are append-only; a withdrawal adds history, it does not erase it. Never exercised in production
(`AP6A-WITHDRAW-UNEXERCISED-1`).

## Closure Contract (v1)

- Phase: AP-6a
- Owner: Organization Authority (`organization-authority/write-agent-placement.server.ts`, AP-2); program: Agent Platform (`hebun-agent-platform-phase0-design-gate.md`)
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: db970ef8 (AP-2, the placement writer AP-6a used; AP-6a itself changed no code), deployed in ee5b58742d640f945b5e8c60c252da19ff1a321b
- Verification level: V2 — no code changed; the released AP-2 seam and its consumers' suites re-run at the deployed commit, plus production before/after invariant reads of an authority-gated write (full suite not required: no source changed)
- Verification evidence: 7/7 seam suites exit 0 at ee5b5874 (2026-10-18); production baseline and post-ceremony read-only reads, 8/8 invariants PASS, as recorded above
- Test environment: detached worktree `.claude/worktrees/b1-m11-baseline-ee5b5874` at ee5b5874, per-file `node --import tsx`, disposable PostgreSQL 18 on 127.0.0.1:55433, `DATABASE_URL` unset
- Deployment evidence: dpl_7aLjj2kEe5Fn4uKhnWiM17AoC7wb, production, READY, githubCommitSha ee5b58742d640f945b5e8c60c252da19ff1a321b, aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: Director ceremony on `/agents` 2026-10-18 12:07:33Z (result Recorded); read-only baseline 12:00:33Z and post-ceremony 12:08:53Z, ledger 78, 8/8 invariants PASS; accepted by the Director 2026-10-18
- Deferred risks: AP6A-WITHDRAW-UNEXERCISED-1 (DEFERRED); AP5-APPROVALS-RATIONALE-LABEL-1 (DEFERRED)
- Director approvals: AP-6 architecture design review (2026-10-18); scoped read-only production baseline (2026-10-18); the placement ceremony, performed by the Director (2026-10-18); read-only post-ceremony verification (2026-10-18); AP-6a acceptance (2026-10-18); local commit of this record (2026-10-18, `410f97d5`); push NOT yet approved

## Deferred risks

- **AP6A-WITHDRAW-UNEXERCISED-1 (DEFERRED)** — the rollback path (`withdrawAgentPlacement`) is
  test-verified only; it has never run in production. Closes with a Director-approved production
  withdrawal, or is carried until a placement is genuinely withdrawn.
- **AP5-APPROVALS-RATIONALE-LABEL-1 (DEFERRED)** — owned by AP-5; restated because the department
  workforce AP-6 names is mislabelled on `/approvals` until it is fixed and deployed. The fix is
  implemented locally (`release/ap5-approvals-rationale-label-1`), not deployed; the risk stays
  DEFERRED until production carries it.

## Three questions

1. **What did we learn?** A placement is an organizational fact, not a grant: the first production
   run of the AP-2 writer changed one row and one audit entry and nothing an agent can act on — and
   that is provable only because the baseline fingerprinted everything else first.
2. **How does this improve Turkish Rug House?** Not directly: TRH has no department and one agent.
   Its six-table fingerprints were unchanged, which is the isolation evidence it needs.
3. **How does this become part of Hebun AI?** Hebun AI's workforce now has its first
   department-placed agent through the same authority that places humans; any department-scoped
   authority (AP-6b) starts from a real placement, not a hypothetical one.
