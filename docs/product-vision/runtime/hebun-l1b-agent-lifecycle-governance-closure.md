# L-1b — Governed and Audited Agent Retirement — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `1f08c153aefac7db95ad52a479bdbc4175754ece` (parent `cf2e66a7`), 2026-10-08, 62 files |
| Schema | migration 76, additive: `ALTER TYPE "public"."governance_domain" ADD VALUE 'agent-lifecycle'` |
| On `main` | yes — ancestor of `f9ae3b4c` |
| Recorded verification at release | commit message: "L3 PG18: failures first-error-identical to the cf2e66a7 baseline (68)"; pins ledger 75 → 76, canonical digest `03d142f8e2dcb6e04e58b5b4ff471bfd` |
| Later fix to its pins | `b356abd3` (L-2a) states main `1f08c153` failed `google-capability-scope-repair-1` because migration 76's files were untracked during L-1b's own L3; L-2a allowed the two file patterns |

## What it changed (from the commit message)

Retiring a durable agent is a Governance decision. One transaction locks the agent row, applies the
guarded update, writes one `agent-lifecycle` decision (type `revoke`, outcome `agent-retired`) and
one `governance.decision.recorded` audit event; any failure rolls all three back; a justification is
required. Registration is unchanged; no suspend, reactivate or successor writer.

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/l1b-agent-lifecycle-governance/firewall.ts` exit 0.
  `retirement-governance-postgres.ts` and `bite-proofs.ts` were not re-run.
- Migration 76 is in production by ledger order: WORK-UPDATE-V1 G5 read production ledger 78
  (`hebun-work-update-v1-closure.md`). That proves the schema, not a retirement.
- No production retirement under L-1b, and no production acceptance, push or deploy approval, is
  recorded in the repository.

## Closure Contract (v1)

- Phase: L-1b
- Owner: Agent Identity retirement writer (`features/agent-identity/retire-durable-agent-identity.server.ts`) and the Governance decision authority
- Reached state: DEPLOYED
- Implementation commit: 1f08c153aefac7db95ad52a479bdbc4175754ece — on `main` (ancestor of f9ae3b4c)
- Verification level: V3 — lifecycle, Governance decision and schema (migration 76)
- Verification evidence: at release, recorded in the commit message — L3 PG18 failures first-error-identical to the cf2e66a7 baseline (68), with a pin defect later fixed by b356abd3; re-measured 2026-10-17 at f9ae3b4c — `tests/l1b-agent-lifecycle-governance/firewall.ts` exit 0 ("firewall: ok"); postgres and bite-proof suites not re-run
- Test environment: at release, local PostgreSQL 18 (per commit message); re-measure in worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset
- Deployment evidence: dpl_3WiFeB1jLebse3vTuBKdp1at21Ri — production at 1f8f9a47 (`hebun-eai-history-origin-1-closure.md`), and 1f08c153 is an ancestor of 1f8f9a47; production ledger 78 read by WORK-UPDATE-V1 G5 places migration 76 in production; no deployment of 1f08c153 itself is recorded; not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — no production retirement or L-1b acceptance is recorded in the repository; acceptance stays OPEN (L1B-PROD-ACCEPTANCE-1)
- Deferred risks: L1B-PROD-ACCEPTANCE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); the original commit, migration, push and deploy approvals are not recorded in the repository

## Deferred risks

- **L1B-PROD-ACCEPTANCE-1 (DEFERRED)** — governed retirement has never been executed in production by
  any recorded acceptance. Retirement is terminal, so it is exercised only on an agent the Director
  chooses to retire; until then it stays test-verified.
