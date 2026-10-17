# L-2a — Agent Service Status Truth — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `b356abd3f893e0f8053f9f694ff5570e796e20c7` (parent `1f08c153`), 2026-10-08, 34 files, no schema, no lifecycle writer |
| On `main` | yes — ancestor of `f9ae3b4c` |
| Recorded verification at release | commit message: "L3 PG18 on the staged tree: 926/994, the 68 failures first-error-identical to baseline" |

## What it changed (from the commit message)

Every agent surface had rendered `inService === false` as "retired". The identity seam now also
reports a service status derived from the same fields as `isAgentInService`
(`features/agent-identity/service-status.ts`): `in-service`, `suspended`, `retired`, `indeterminate`.
`/agents` cards, Live Map, the Heby mandate source and the Heby agent source render it. It also fixed
an L-1b pin (see `hebun-l1b-agent-lifecycle-governance-closure.md`).

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/l2a-service-status-truth/status.ts` and `firewall.ts` exit 0.
  `status-postgres.ts` and `bite-proofs.ts` were not re-run.
- No production render of a suspended or indeterminate agent is recorded; with every production agent
  in service, only the `in-service` branch can render.

## Closure Contract (v1)

- Phase: L-2a
- Owner: Agent Identity service status (`features/agent-identity/service-status.ts`) and the surfaces that render it
- Reached state: DEPLOYED
- Implementation commit: b356abd3f893e0f8053f9f694ff5570e796e20c7 — on `main` (ancestor of f9ae3b4c)
- Verification level: V2 — shared identity read seam rendered on every agent surface, including Heby grounding
- Verification evidence: at release, recorded in the commit message — L3 PG18 926/994, the 68 failures first-error-identical to baseline; re-measured 2026-10-17 at f9ae3b4c — `tests/l2a-service-status-truth/status.ts` exit 0 ("status: ok"), `firewall.ts` exit 0 ("firewall: ok"); postgres and bite-proof suites not re-run
- Test environment: at release, local PostgreSQL 18 (per commit message); re-measure in worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset
- Deployment evidence: dpl_3WiFeB1jLebse3vTuBKdp1at21Ri — production at 1f8f9a47 (`hebun-eai-history-origin-1-closure.md`), and b356abd3 is an ancestor of 1f8f9a47; no deployment of b356abd3 itself is recorded; not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — no L-2a production acceptance is recorded in the repository; acceptance stays OPEN (L2A-PROD-ACCEPTANCE-1)
- Deferred risks: L2A-PROD-ACCEPTANCE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); the original commit, push and deploy approvals are not recorded in the repository

## Deferred risks

- **L2A-PROD-ACCEPTANCE-1 (DEFERRED)** — the `suspended` and `indeterminate` renderings are unexercised
  in production. Closes with a recorded production read of a suspended agent's surfaces (AP-5 A12, if
  the Director approves a production suspension).
