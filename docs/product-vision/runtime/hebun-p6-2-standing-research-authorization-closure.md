# P6-2 — Standing research authorization and `research-schedule` kill switch

Master Plan V2 P6, slice 2 of the P6 design gate (`hebun-p6-research-design-gate.md`, decisions D1, D2,
D5, D8). Research now runs only under a tenant's standing research authorization. The release is
deployed and its schema is in production. **No research has run in production, no standing
authorization exists there, the `research-schedule` kill switch is off, and no end-to-end acceptance
has been done.** This record closes P6-2 at DEPLOYED, not PRODUCTION-ACCEPTED.

## What changed

- **Migration 88** (`20261115064039_p6_2_standing_research_authorization`), additive only:
  - table `standing_research_authorizations`, an append-only lineage per tenant with tenant-bound FKs to
    the work item and agent, Governance decision and session FKs, and 6 CHECKs (human authorizer,
    revision ≥ 1, lineage, supersedes-not-self, first revision active, title/brief length);
  - enum `standing_research_state` (`active`, `withdrawn`);
  - value `standing-research` on `governance_domain`.
- **Governance writer** (`features/standing-research-authority/standing-research.server.ts`): Governance
  authorizes one brief, one work item and one responsible agent holding `prepare-research`. Withdrawal is
  a new revision under a `revoke` decision; nothing is updated or deleted.
- **Run now** runs exactly the brief in force and re-reads the authorization inside the filing
  transaction, so a withdrawal while the model writes files nothing. The free-form P6-1 run action is
  replaced by the authorized run.
- **`research-schedule` kill switch**: a `provider_connectivity_controls` key, off when absent or
  unreadable. `admitScheduledResearch` reads it before the lineage. It is not production-reachable
  until P6-4.
- **Audit**: authorized/withdrawn rows in the revision transaction; refused authorize, withdraw and run
  attempts filed as `standing-research.refused`; filed reports name the authorization revision.
- **Surface**: the "Research report" section of `/heby?workItem=` (`heby-research-affordance.tsx`).

Not claimed: re-checking the granter's authority at scheduled run time. That needs the P6-4 machine
principal.

## What is proven

**Before release (PR #9, head `f2ca6f34`).** Required checks on GitHub: `quick` (typecheck, lint, build,
continuity), `targeted` and `full-suite (disposable PostgreSQL)`, run 43689897465, all SUCCESS, plus
Vercel preview. Locally: zero REGRESSION. hlr/work2 ordering reds were local collation, reproduced on
unchanged source and green on a C-locale cluster. r3w was BLOCKED locally (no `hebun_r1`). New R11
Postgres scenarios, F9 firewall, bite-proofs B14–B18 (18/18 bit). No security assertion weakened.

**Production schema (2026-11-15).** `platform:migrate` ceremony from a detached worktree at `f2ca6f34`,
production posture, target pins verified by the ceremony:
- before: ledger 87 of 88, prefix verified exact by per-migration sha256, 1 pending;
- validated pre-migration backup before the prompt (`pg_restore -l` OK, 990 archive entries). The
  applying run's backup is `hebun_production_pre_migration_20261115-090833.dump` on the operator host;
- after: a second, read-only ceremony run reported `ALREADY_CONVERGED`, 88 of 88, digest
  `bd3a1eccd013c1a52efbbf5d967f7409` = this release's canonical digest;
- read-back: the table exists with 0 rows; enum `{active,withdrawn}`; `standing-research` present on
  `governance_domain`; 6 CHECK, 6 FK, 4 indexes plus primary key, matching the migration SQL;
- organizational rows unchanged against the pre-migration backup: companies 4, agents 5, work_items 11,
  decision_records 115, governance_sessions 115, integrations 13.

**Deployment (2026-11-15).** PR #9 merged to `main` as `cee23d2b` (parents `e84d92eb`, `f2ca6f34`). Vercel
production deployment `dpl_2cAVm6QJmDuUqSgLB2yDHNDZ29oc`: READY at 09:16:40Z, target production,
`githubCommitSha` `cee23d2b`, ref `main`. Aliased to `www.hebuntech.com` and `hebuntech.com`.

**Live UI, read-only, signed in as the tenant's human (2026-11-15).**
- `/home`: "Research reports — No research reports yet". No console errors.
- `/heby?workItem=5ba33201-…` ("AP-5 two-agent origination acceptance check"): the Research report
  section shows the P6-2 text, "Research runs only on a brief your Governance authority has
  authorized…". This string is absent at `e84d92eb` and present at `cee23d2b`, so the deployed bundle
  serves P6-2. The section also shows "No research is authorized for your organization." and "No agent
  in service holds a research mandate for this work's scope." It has no button and no text field, so
  no "Run research now" without an authorization. No console errors.
- No button was pressed and no form was submitted.

**Kill switch and authority, read-only SQL (2026-11-15).** No `provider_connectivity_controls` row for
`research-schedule`, so the switch is off (`admitScheduledResearch` refuses unless the value is `true`).
`standing_research_authorizations` holds 0 rows.

## What is not proven

- **The Governance writer has never run in production.** No agent holds a `prepare-research` mandate,
  so the surface correctly hides the authorize form. The authorize, withdraw and run-now paths are
  proven only by tests (P6-2-LIVE-WRITE-UNEXERCISED-1).
- No research report has been filed in production, and no Anthropic call was made. Reports are still
  unsourced drafts; web search is P6-3, and the 08:00 schedule is P6-4.

## Closure Contract (v1)

- Phase: P6-2-STANDING-RESEARCH-AUTHORIZATION
- Owner: apps/dashboard/src/features/standing-research-authority/ (standing research authority and kill switch), apps/dashboard/src/db/schema/standing-research-authorization.ts and migration 20261115064039_p6_2_standing_research_authorization (schema), apps/dashboard/src/components/layout/heby/heby-research-affordance.tsx (surface), docs/product-vision/runtime/hebun-p6-research-design-gate.md (decisions)
- Reached state: DEPLOYED
- Implementation commit: f2ca6f34d3e853d49c2670b828c0648dfba607fc (released on main by merge cee23d2b7b7efb0b63bd631f35362c092c189e28)
- Verification level: V3 — schema/migration, Governance authority and a provider-spend kill switch; full suite justified on the pull request for that reason
- Verification evidence: PR #9 checks on f2ca6f34 — quick, targeted and full-suite (run 43689897465) SUCCESS; local zero REGRESSION with collation reds classified PRE-EXISTING and r3w BLOCKED; bite-proofs B14–B18 18/18 bit; tsc, eslint (changed files) and npm run build exit 0
- Test environment: GitHub Actions with disposable PostgreSQL for the required checks; local isolated worktree from the session scratchpad for the local suites
- Deployment evidence: Vercel dpl_2cAVm6QJmDuUqSgLB2yDHNDZ29oc, production, READY 2026-11-15T09:16:40Z, githubCommitSha cee23d2b, aliased to www.hebuntech.com; production ledger 88/88, digest bd3a1eccd013c1a52efbbf5d967f7409 (platform:migrate ALREADY_CONVERGED read-back); live read-only /home and /heby?workItem= render of the P6-2 surface, no console errors
- Production acceptance evidence: N/A — no standing research authorization was created, no research ran, the research-schedule kill switch stays off and no Anthropic call was made; end-to-end acceptance not done
- Deferred risks: P6-2-LIVE-WRITE-UNEXERCISED-1 (DEFERRED); P6-2-GRANTER-RECHECK-1 (DEFERRED); PRODMIG-PROMPT-IDLE-DISCONNECT-1 (DEFERRED)
- Director approvals: P6 design gate decisions D1–D8, 2026-11-14; P6-2 production migration 88 apply, 2026-11-15; PR #9 merge and production deploy, 2026-11-15; P6-2 production acceptance check and closure records, 2026-11-15; standing authorization creation, kill-switch enablement, Anthropic calls and P6-3 NOT approved

### Deferred risk detail

- **P6-2-LIVE-WRITE-UNEXERCISED-1 (DEFERRED).** The authorize, withdraw and run-now paths have not run
  in production, because no agent holds a `prepare-research` mandate and no authorization was approved.
  Acceptance dependency: a Director decision to grant a research mandate and authorize one brief, then
  a read-back of the revision, its Governance decision and audit rows. Running a report is a further
  gate (own key, data-use, spend).
- **P6-2-GRANTER-RECHECK-1 (DEFERRED).** D1 requires the granting person's authority to be re-checked at
  every scheduled run. That needs the P6-4 machine principal and is not built. Acceptance dependency:
  P6-4.
- **PRODMIG-PROMPT-IDLE-DISCONNECT-1 (DEFERRED).** Two production ceremony runs died with an unhandled
  pg client `'error'` event ("Connection terminated unexpectedly") while waiting at the confirmation
  prompt. Neon closed the idle connection, and the ceremony attaches no `'error'` listener, so the
  process crashed instead of reporting `MIGRATION_FAILED`. Nothing was applied either time; a read-only
  check confirmed ledger 87 and no lingering lock. The operator must answer the prompt promptly.
  Acceptance dependency: a Director-selected fix (an `'error'` listener, and a reconnect or keepalive
  before applying), proven with a bite-proof.

## Weekly three questions

1. **What did we learn?** A production ceremony that waits for a human holds an idle database
   connection, and the provider may close it. A ceremony's safety includes surviving that wait, not only
   refusing early. The read-only `ALREADY_CONVERGED` path is a clean, independent way to verify an
   outcome nobody saw printed.
2. **How does this improve Turkish Rug House?** TRH's research can now run only on a brief its own
   Governance authority approved and can withdraw. Nothing runs unasked, and a withdrawal stops a run
   in flight.
3. **How does this become part of Hebun AI?** The standing authorization is the authority the 08:00
   scheduled run (P6-4) will act under, behind its own kill switch, for every tenant.
