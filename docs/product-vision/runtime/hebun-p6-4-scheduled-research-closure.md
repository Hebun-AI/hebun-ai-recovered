# P6-4 — 08:00 scheduled research under a machine principal

Master Plan V2 P6, slice 4 of the P6 design gate (`hebun-p6-research-design-gate.md`, decisions D1, D5–D7
and D9). Research can now run every day at 08:00 Europe/Istanbul for a tenant whose standing research
authorization is in force. The release is deployed and its schema is in production. **The cron secret
is not configured, the `research-schedule` kill switch is off and no standing research authorization
exists in production, so no scheduled run has happened. No real Anthropic or web-search call was made
and no end-to-end acceptance has been done.** This record closes P6-4 at DEPLOYED, not
PRODUCTION-ACCEPTED.

## What changed

- **D9 recorded** (Director, 2026-11-15, design A): who acts at 08:00.
- **Research schedule principal**
  (`features/standing-research-authority/scheduled-research.server.ts`):
  - ephemeral, minted only from the effective, active standing research authorization row;
  - tenant, brief, work item, agent and granting person are read off that row;
  - not a `TenantContext`, and inherits nobody's authority.
- **Re-checked before every model call:**
  - the kill switch;
  - that the authorization revision is still the one in force and active;
  - that the organization is active;
  - that the granting person is an active member holding Governance authority;
  - the work item, the agent's eligibility and mandate;
  - the Director's Claude control;
  - the tenant's own verified Anthropic key;
  - the research data-use decision (web search only under its own decision).

  The generator re-checks data use, the dispatch cap and the live budget at dispatch.
- **Migration 90** (`20261115183900_p6_4_scheduled_research_runs`), additive:
  - table `scheduled_research_runs`, unique per (tenant, authorization, Istanbul date) and claimed
    before the model;
  - a CHECK ties each outcome (`claimed` / `filed` / `failed`) to its columns;
  - tenant-bound FKs to the authorization and the report;
  - a `(tenant_id, id)` unique index on `standing_research_authorizations`.

  A failed run is recorded with its reason and is not retried that day.
- **Filing** (`createResearchReportFromScheduledResearch`, `recordScheduledResearchReportFiled`):
  - the report is created by `system` (the run) and authored by the agent; it has no source message;
  - it is filed in one transaction with the ledger's `filed` outcome and a `system` audit row that names
    the granter;
  - the authorization and the mandate are re-read inside that transaction.

  The released data-use evidence and dispatch-cap rows are human-keyed. They name the granter as the
  accountable authorizer.
- **Own key only** (`selectScheduledResearchModelTransport`): the tenant's Anthropic connection and its
  one `api_key`, through `withConnectionScopedSecret`. Never by credential id, never the platform key.
- **Reads narrowed to `Pick<TenantContext, "tenantId">`**, the released pattern for tenant-only reads:
  - work target, agent eligibility (through `readEffectiveAgentMandateForRuntime`) and agent authorship;
  - tenant key metadata;
  - Governance authority (`tenantId`, `userId`).
- **Cron**: `/api/standing-research/scan`, `0 5 * * *`, machine ingress with the bearer secret
  `HEBUN_STANDING_RESEARCH_TRIGGER_SECRET`.
  - An unset secret refuses every request.
  - With the switch off, nothing else is read.
  - The response carries counts and reasons only.
- **Surfaces**: none new. Filed reports are ordinary research reports on the work item and in the
  `/home` list.

## What is proven

**Before release (PR #13).**
- Head `0f6b1fab`: required checks `quick`, `targeted` and `full-suite (disposable PostgreSQL)` all
  SUCCESS, plus the Vercel preview.
  - Full suite run 43755650937: 1177 passed, 0 failed, 2 excluded.
- The first full-suite run, 43749957253 on `181cbe94`, failed two pins the sweep missed: the B2
  generator-caller census, and the TRH-24 B3 bite expectation. Both were fixed in `0f6b1fab`; the TRH-24
  bite-proofs bit 13/13 in a disposable copy.
- Locally, on a session-owned PostgreSQL 18:
  - `tests/p6-4-scheduled-research/scheduled-research-postgres.ts`, S1–S9, on SIMULATED provider
    payloads only. It covers:
    - switch off;
    - filed once;
    - same-day idempotency and the Istanbul day boundary;
    - every re-check with zero dispatch;
    - no same-day retry;
    - withdrawal mid-call;
    - tenant isolation;
    - the route answering 401 and `disabled`.
  - Research firewall F11.
  - 180 affected suites on the final tree: 179 PASS. `r3w-flow/ambient-database-safety` is BLOCKED
    because the canonical `hebun_r1` is absent; that is an environment block, not a pass.
  - `tsc --noEmit`, eslint (0 errors) and `npm run build` pass.

**Production schema (2026-11-15).** The Director ran the `platform:migrate` ceremony at a TTY from a
detached worktree at `0f6b1fab`.
- Before: a read-only check found ledger 89 of 89, no `scheduled_research_runs` table and no advisory
  lock.
- A validated pre-migration backup was taken:
  `hebun_production_pre_migration_20261115-211025.dump` (`pg_restore -l` OK, 1005 entries).
- After: a read-only ceremony re-run reported `ALREADY_CONVERGED`, 90 of 90, digest
  `3911655973f604962b196126d5dd81d4`. That is this release's canonical digest; the first 89 files still
  digest to `01126461`, the P6-3 release.
- Read-back:
  - the table exists with 0 rows;
  - all three indexes are present;
  - constraints are 2 CHECK, 3 FK and 1 PK;
  - no advisory lock.
- Organizational rows are unchanged: companies 4, agents 5, work_items 11, decision_records 115,
  governance_sessions 115, integrations 13, standing research authorizations 0.

**Deployment (2026-11-16).**
- PR #13 was merged to `main` as `5e73b805` (parents `3b7b37f7`, `0f6b1fab`), pinned to the verified
  head.
- Vercel production deployment `dpl_B4MzNcxgfnd7phcbe979fMrbGcEk`: READY, target production,
  `githubCommitSha` `5e73b805`, ref `main`, aliased to `www.hebuntech.com` and `hebuntech.com`.
- `/` and `/login` return 200.
- `/api/standing-research/scan` without a secret returns 401. The route is reached, not redirected to
  sign-in, and it refuses.

## What is not proven

- **No scheduled run has happened anywhere but the disposable database** (P6-4-LIVE-RUN-UNEXERCISED-1):
  - the cron secret is unset and the kill switch is off;
  - no tenant holds a standing research authorization, a research mandate, an own Anthropic key or a
    research grant in production.
- A searching scheduled run may take up to 90 s. The cron function's duration is not measured against it
  (P6-3-SEARCH-DURATION-1, unchanged).
- The disposable proof injects the kill switch and the provider transport. The real switch read is
  proven only as "absent = off" (S9).

## Closure Contract (v1)

- Phase: P6-4-SCHEDULED-RESEARCH
- Owner: apps/dashboard/src/features/standing-research-authority/scheduled-research.server.ts (principal and run), apps/dashboard/src/db/schema/scheduled-research-run.ts and migration 20261115183900_p6_4_scheduled_research_runs (run ledger), apps/dashboard/src/app/api/standing-research/scan/route.ts (cron ingress), docs/product-vision/runtime/hebun-p6-research-design-gate.md (decisions D1–D9)
- Reached state: DEPLOYED
- Implementation commit: 0f6b1fabd26c081cee3f7f3203d61ae86685e8e0 (feature 181cbe94 plus pin fix; released on main by merge 5e73b80515fabef095f0eeda64b15f1385fe95b4)
- Verification level: V3 — schema/migration, a machine principal, an execution and provider boundary and a new machine ingress; full suite justified on the pull request for that reason
- Verification evidence: PR #13 checks on 0f6b1fab — quick, targeted and full-suite (run 43755650937, 1177 passed, 0 failed) SUCCESS; S1–S9 and F11 pass on simulated payloads; 180 affected suites 179 PASS with r3w BLOCKED (environment); TRH-24 bite-proofs 13/13 bit; tsc, eslint (changed files) and npm run build exit 0
- Test environment: GitHub Actions with disposable PostgreSQL for the required checks; local isolated worktree and a session-owned PostgreSQL 18 for the local suites, bite-proofs in a disposable copy
- Deployment evidence: Vercel dpl_B4MzNcxgfnd7phcbe979fMrbGcEk, production, READY, githubCommitSha 5e73b805, aliased to www.hebuntech.com, / and /login 200, /api/standing-research/scan 401 without a secret; production ledger 90/90, digest 3911655973f604962b196126d5dd81d4 (platform:migrate ALREADY_CONVERGED read-back)
- Production acceptance evidence: N/A — the cron secret is unset, the research-schedule kill switch is off and no standing research authorization exists, so no scheduled run happened; no Anthropic or web-search call was made; end-to-end acceptance not done
- Deferred risks: P6-4-LIVE-RUN-UNEXERCISED-1 (DEFERRED); P6-4-AUTHORIZER-ATTRIBUTION-1 (DEFERRED); P6-4-SCAN-LIMIT-1 (DEFERRED); P6-2-GRANTER-RECHECK-1 (CLOSED)
- Director approvals: P6 design gate decisions D1–D8, 2026-11-14; D9 design A, 2026-11-15; P6-4 implementation, local migration 90 and PR, 2026-11-15; production migration 90 run by the Director, 2026-11-15; PR #13 merge and production deploy, 2026-11-16; P6-4 closure record, 2026-11-16; the cron secret, kill-switch enablement, any standing authorization, Anthropic or web-search calls NOT approved

### Deferred risk detail

- **P6-4-LIVE-RUN-UNEXERCISED-1 (DEFERRED).** No scheduled run has happened in production. Acceptance
  dependency, each a separate Director gate:
  - a tenant's own Anthropic key, research grant, research mandate and standing authorization;
  - the cron secret configured in Vercel production;
  - the `research-schedule` switch turned on.

  Then one 08:00 run, observed in `scheduled_research_runs`, its report, its filing audit row and its
  disclosure decision.
- **P6-4-AUTHORIZER-ATTRIBUTION-1 (DEFERRED).** The released data-use evidence and dispatch-cap rows are
  keyed to a human, so a scheduled run's rows carry the granter as `human` actor (accountable
  authorizer). The rows P6-4 writes itself say `system`. Acceptance dependency: a Director decision on
  a machine actor for those two records, with its own migration.
- **P6-4-SCAN-LIMIT-1 (DEFERRED).** One tick considers at most 25 tenants, ordered by tenant id, with no
  cursor. Acceptance dependency: more than 25 tenants holding an authorization, then a cursor or a
  second tick.
- **P6-2-GRANTER-RECHECK-1 (CLOSED).** Closed in code by P6-4 (`5e73b805`): every scheduled run re-checks
  that the granting person is an active member holding Governance authority, before the model (S5,
  F11). Its production run is part of P6-4-LIVE-RUN-UNEXERCISED-1.

## Weekly three questions

1. **What did we learn?** A machine path through human-typed seams goes by narrowing reads to the
   tenant and adding system-attributed writers, never by building a person's context; and a ledger row
   claimed before the model is the simplest honest idempotency.
2. **How does this improve Turkish Rug House?** When TRH's Governance authorizes a brief and the
   Director turns the schedule on, TRH gets one research report every morning on its own key. It stops
   the moment the authority, the grant, the key or the switch goes away.
3. **How does this become part of Hebun AI?** Every tenant's standing research runs under the same
   principal, the same re-checks and the same one-run-per-day ledger, behind one platform kill switch.
