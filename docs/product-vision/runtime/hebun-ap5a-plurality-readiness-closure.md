# AP-5A — Plurality Readiness for Named Agents — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed. AP-5A is readiness for AP-5; it is **not** AP-5 and proves nothing about two
agents in production.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `5a392d0da0c39508e08aa4621ff1449dfc587e0f` (parent `5e3fd3f7`), 2026-10-08, 25 files, no schema; commit message records no test counts |
| On `main` | yes — ancestor of `f9ae3b4c` |
| Existing record | the only AP-5A text in the repository is the revision note it added to `hebun-ap1-plurality-foundation.md` (Director gate G1, 2026-10-08) |

## What it changed (from the code and the AP-1 revision note)

- Operations preparation, media generation (sync and async) and the `/approvals` agent request pass an
  explicit agent selection to `resolveAgentAuthorship` / `resolveAgentProposer`
  (`features/work-artifacts/prepare-work-artifact.server.ts:319`,
  `features/media-assets/request-media-generation.server.ts:191`,
  `features/media-assets/async-generation-lifecycle.server.ts:275`).
- A chooser (`components/agents/agent-choice-select.tsx`) renders only when more than one agent
  serves, fed by `listInServiceAgentsAction` (`app/(dashboard)/operations/actions.ts`).
- The origination persona line became agent-neutral; refusal wording names the agent.
- **Not covered:** the Heby work-state affordance (added later by WORK-UPDATE-V1) has no chooser —
  `WORK-UPDATE-AGENT-SELECTION-1`.

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/ap5a-plurality-readiness/surface-and-firewall.ts` exit 0.
  `readiness-postgres.ts` and `bite-proofs.ts` were not re-run.
- No repository record of a production acceptance, push approval or deploy approval exists.
- With one in-service agent per tenant, no production surface can render the chooser; the two-agent
  behaviour is unexercised in production by construction.

## Closure Contract (v1)

- Phase: AP-5A
- Owner: Agent Identity selection seams (`features/action-authorization/agent-proposer.server.ts`, `features/work-artifacts/agent-authorship.server.ts`) and the surfaces that call them
- Reached state: DEPLOYED
- Implementation commit: 5a392d0da0c39508e08aa4621ff1449dfc587e0f — on `main` (ancestor of f9ae3b4c)
- Verification level: V2 — shared selection seam across preparation, media and origination surfaces; this reconciliation re-measured only the structural suite
- Verification evidence: re-measured 2026-10-17 at f9ae3b4c — `node --import tsx tests/ap5a-plurality-readiness/surface-and-firewall.ts` exit 0 ("passed"); `readiness-postgres.ts` and `bite-proofs.ts` not re-run
- Test environment: worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset; no PostgreSQL
- Deployment evidence: dpl_3WiFeB1jLebse3vTuBKdp1at21Ri — production at 1f8f9a47 (`hebun-eai-history-origin-1-closure.md`), and 5a392d0d is an ancestor of 1f8f9a47; no deployment of 5a392d0d itself is recorded in the repository; not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — no AP-5A production acceptance is recorded in the repository; acceptance stays OPEN (AP5A-PROD-ACCEPTANCE-1)
- Deferred risks: AP5A-PROD-ACCEPTANCE-1 (DEFERRED); WORK-UPDATE-AGENT-SELECTION-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); AP-5A gate G1 (persona line change) is recorded in `hebun-ap1-plurality-foundation.md`; the commit, push and deploy approvals are not recorded in the repository

## Deferred risks

- **AP5A-PROD-ACCEPTANCE-1 (DEFERRED)** — no single-agent production acceptance of AP-5A is recorded
  (that the choosers stay hidden and the neutral copy is live). Its two-agent half is AP-5 itself
  (`hebun-ap5-two-agent-acceptance-contract.md` A5). Closes with a recorded production read of the
  single-agent surfaces, or is subsumed by the AP-5 acceptance.
