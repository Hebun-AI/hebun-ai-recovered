# L-2b — Suspend and Reactivate Agents — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `13bc65da70091affa6768099a0680c531b777b94` (parent `b356abd3`), 2026-10-09, 36 files, no migration; commit message records no test counts |
| On `main` | yes — ancestor of `f9ae3b4c` |

## What it changed (from the commit message)

Suspension and reactivation are `agent-lifecycle` Governance decisions (`suspend` → `agent-suspended`,
`approve` → `agent-reactivated`), written with the lifecycle change and audit in one transaction, by
the owner holding Governance authority (`features/agent-identity/suspend-durable-agent-identity.server.ts`).
Reactivation writes lifecycle `active`, never reactivates a retired agent, and is refused while the
agent holds a usable permit or a valid standing envelope. Spend, standing issuance and envelope
authorization read agent liveness FOR SHARE in their own transaction; email, Instagram and YouTube
re-check the proposing agent immediately before the provider call.

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/l2b-agent-suspension/firewall.ts` and `card-render.ts` exit 0.
  `suspension-postgres.ts`, `dispatch-liveness-postgres.ts` and `bite-proofs.ts` were not re-run.
- No production suspension or reactivation is recorded in the repository. The only production agents
  are one Heby per tenant; suspending one stops that tenant's agent work.

## Closure Contract (v1)

- Phase: L-2b
- Owner: Agent Identity lifecycle writer (`features/agent-identity/suspend-durable-agent-identity.server.ts`) and the liveness re-checks at spend, standing issuance and provider egress
- Reached state: DEPLOYED
- Implementation commit: 13bc65da70091affa6768099a0680c531b777b94 — on `main` (ancestor of f9ae3b4c)
- Verification level: V3 — lifecycle, Governance decision and provider-egress liveness boundary
- Verification evidence: re-measured 2026-10-17 at f9ae3b4c — `tests/l2b-agent-suspension/firewall.ts` exit 0 ("firewall: ok"), `card-render.ts` exit 0 ("card render: ok"); the release commit records no counts; postgres and bite-proof suites not re-run
- Test environment: worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset; no PostgreSQL
- Deployment evidence: dpl_3WiFeB1jLebse3vTuBKdp1at21Ri — production at 1f8f9a47 (`hebun-eai-history-origin-1-closure.md`), and 13bc65da is an ancestor of 1f8f9a47; no deployment of 13bc65da itself is recorded; not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — no production suspension, reactivation or L-2b acceptance is recorded in the repository; acceptance stays OPEN (L2B-PROD-ACCEPTANCE-1)
- Deferred risks: L2B-PROD-ACCEPTANCE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); the original commit, push and deploy approvals are not recorded in the repository

## Deferred risks

- **L2B-PROD-ACCEPTANCE-1 (DEFERRED)** — live suspend and reactivate are unverified in production, and
  so are the egress liveness re-checks against a suspended proposer. Closes with a Director-approved
  production suspend/reactivate (AP-5 A12), recorded with decision, audit and refusal evidence.
