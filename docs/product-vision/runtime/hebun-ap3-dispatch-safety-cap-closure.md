# AP-3 — Durable Per-Tenant AI Dispatch Safety Cap — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed. Nothing here re-grades an earlier record; every claim cites the evidence it
rests on, and acceptance that was never recorded stays open.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `5c338f10ec244513e3c13e78323a07ddef312ce3` (parent `9fe101ed`, AP-2 closure), 2026-10-07, 30 files, no schema |
| On `main` | yes — ancestor of `f9ae3b4c` (`git merge-base --is-ancestor`) |
| Selected in | `hebun-agent-platform-phase0-design-gate.md` §5 (`AP-3 Durable per-tenant model spend cap`) |
| Deployment | `dpl_6rrgcG3Yyh58FHL3UmV7yvquB65b` named as the production deployment of `5c338f10` in `hebun-ap4a-work-domain-foundation.md` (*Recovery plan*, step 2) |

## What it changed (from the commit message)

Per-tenant, per-UTC-day ceilings on external AI dispatch — model 50, media 5; invalid configuration
resolves to 0; no unlimited value — counted from rows Hebun already writes before dispatch, under a
per-tenant advisory lock. Model order: EAI decision → cap + process budget → authorized evidence →
transport. A cap refusal sends nothing, spends no process budget, writes no evidence and records
`ai-dispatch-cap.refused`. Code: `apps/dashboard/src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts`
(`DEFAULT_AI_DISPATCH_CAPS` at line 66).

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/ap3-dispatch-safety-cap/firewall.ts` and `config-and-prepay.ts`
  exit 0. `cap-postgres.ts` and `bite-proofs.ts` were not re-run.
- A later production read observed the cap in service: WORK-UPDATE-V1 G5 recorded "dispatch cap 0 of
  50 today" (`hebun-work-update-v1-closure.md`). That is an observation made by another phase, not an
  AP-3 acceptance: no refusal was exercised in production.
- No repository record of an AP-3 production acceptance, push approval or deploy approval exists.

## Closure Contract (v1)

- Phase: AP-3
- Owner: AI dispatch safety cap (`apps/dashboard/src/features/ai-dispatch-cap/`)
- Reached state: DEPLOYED
- Implementation commit: 5c338f10ec244513e3c13e78323a07ddef312ce3 — on `main` (ancestor of f9ae3b4c)
- Verification level: V3 — provider/execution boundary and tenant spend bound; this reconciliation re-measured only the structural and configuration suites, so the V3 claim rests on the original release, which recorded no counts
- Verification evidence: re-measured 2026-10-17 at f9ae3b4c — `node --import tsx tests/ap3-dispatch-safety-cap/firewall.ts` exit 0 ("firewall: ok"), `tests/ap3-dispatch-safety-cap/config-and-prepay.ts` exit 0 ("passed"); `cap-postgres.ts` and `bite-proofs.ts` not re-run
- Test environment: worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset; no PostgreSQL
- Deployment evidence: dpl_6rrgcG3Yyh58FHL3UmV7yvquB65b — recorded as the production deployment of 5c338f10 in `hebun-ap4a-work-domain-foundation.md`; also contained in dpl_3WiFeB1jLebse3vTuBKdp1at21Ri (production at 1f8f9a47, `hebun-eai-history-origin-1-closure.md`), 5c338f10 being an ancestor of 1f8f9a47; not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — no AP-3 production acceptance is recorded in the repository; acceptance stays OPEN (AP3-PROD-ACCEPTANCE-1)
- Deferred risks: AP3-PROD-ACCEPTANCE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); the original commit, push and deploy approvals are not recorded in the repository

## Deferred risks

- **AP3-PROD-ACCEPTANCE-1 (DEFERRED)** — AP-3 has no recorded production acceptance: no production
  refusal (`ai-dispatch-cap.refused`) and no read-back of the configured caps is recorded as AP-3
  evidence. Closes with a Director-approved read-only production measurement of the cap configuration
  and refusal audit, recorded against AP-3.
