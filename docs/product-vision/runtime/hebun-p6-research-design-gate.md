# P6 · Research & Opportunity Intelligence · DESIGN GATE — DECIDED, NOT IMPLEMENTED

Master Plan V2 P6 is done when **research runs every morning at 08:00 for an authorized tenant and
files a sourced report**. This gate records the facts that target starts from and the decisions the
Director must take before any code, schema, migration, provider call, cron or spend exists. Nothing
below is built, and nothing here authorizes any of those.

**Director decision (2026-11-14):** D1–D8 accepted as recommended, each decided separately. See
"Final decisions". Each migration, the web-search data-use cell, the first provider call, the cron
secret and every production step remain separate Director gates.

## Measured at `d97c36c6` (remote `main`, 2026-11-14)

1. **The research seam exists and is dormant.** `assignResearchReport(input, deps)`
   (`features/agent-work/assign-research-report.server.ts:159`) takes
   `{workItemId, agentId, question, title}` and files one `research-report` work artifact (draft) plus a
   `work-artifact.research-report.filed` audit row. RA-AUTH-1 and RA-EAI-1 are PRODUCTION-ACCEPTED;
   RA-PREP-1 is DEPLOYED as a dormant release (`471e0dc8`). Production holds 0 research data-use
   grants, 0 `prepare-research` mandate revisions and 0 research reports. The "may prepare" path has
   never run in production.
2. **No surface reaches it.** No route, action or component calls the seam
   (RA-PREP-1-NO-SURFACE-1, DEFERRED).
3. **The seam requires a person.** It needs a `TenantContext` with a `userId` holding Governance
   authority, checked before the model and again before filing. There is no machine-principal path,
   so a scheduled run cannot call it as built.
4. **Every report is unsourced.** The only data-use cell is
   `anthropic/messages × research × conversation` (the question in the person's own words). A reply
   containing a link is refused; every report is labelled `UNSOURCED RESEARCH DRAFT`. Anthropic web
   search is deferred (RA-EAI-1-WEB-SEARCH-1): search queries derived from tenant text and third-party
   results are a new data-use decision.
5. **Concurrency is open.** Two requests for the same (work, agent) both dispatch and both file
   (RA-PREP-1-CONCURRENT-DISPATCH-1, DEFERRED). Reports cannot be revised.
6. **Scheduling pattern exists.** Three hourly crons in `apps/dashboard/vercel.json`, each behind its own
   bearer secret (`timingSafeEqual`), a path pinned in `MACHINE_INGRESS_PATHS`, per-tick scan limits,
   sequential failure-isolated processing and no scheduler state. Standing authorizations are
   append-only Governance revisions (`standing_observation_authorizations`,
   `standing_mutation_authorizations`); each permission has a fail-closed kill switch in
   `provider_connectivity_controls`. Model spend is bounded by
   `HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY` (default 50) and `HEBUN_MODEL_LIVE_CALL_BUDGET`.
7. **Credential path.** The seam does not inject a selector, so it uses P5's `selectTenantModelTransport`:
   the tenant's own Anthropic key when it holds a live one, the platform key when it holds none,
   nothing otherwise.
8. **Account mismatch for BYOK tenants (finding).** The seam's preflight calls
   `authorizeExternalAiDisclosure` without `accountRef` (`assign-research-report.server.ts:208-212`), so
   it asks about the platform account; the generator then judges dispatch against `tenant-byok:<id>`.
   Both checks must pass, so this fails closed (no disclosure leaks), but a BYOK tenant's research
   could be refused by the preflight for the wrong account. Needs alignment before any BYOK tenant
   uses research.
9. **GATE-D-PROVIDER-RECONCILIATION-1 is BLOCKED.** The RA-PREP-1 closure records that it blocks any
   production research execution on the platform credential. Whether research on the tenant's own
   key is outside GATE-D is not recorded anywhere.

## Principles every option is held to

- Research prepares; it never acts, publishes or sends.
- A scheduled run spends money: it needs its own Governance authorization, a cost bound and a
  fail-closed kill switch. No standing run without all three.
- Data-use is decided per purpose × class × source; nothing new crosses to a provider without a cell.
- Every report states its sources, or says it has none. No unsourced claim is presented as sourced.
- Existing security and tenant assertions stay; none is weakened for this package.

## Decisions for the Director

**D1 — Who runs the 08:00 job.** The seam needs a person with Governance authority.
- (a) *Recommended:* a **standing research authorization** — an append-only Governance revision
  (tenant, research brief, cadence, daily cap, granting person), following
  `standing_observation_authorizations`. The scheduled run acts **under** that revision; the
  granting person's authority is re-checked at every run and a lapse stops the run.
- (b) No schedule; research is manual only. Does not meet P6's "done".

**D2 — What is researched every morning.** (a) *Recommended:* the brief recorded in the standing
authorization (D1), written by the tenant, fixed per revision. (b) Questions generated by the system.
(b) means the system decides what to spend on and what to disclose; not recommended.

**D3 — Source.** A "sourced report" needs a source the model is allowed to reach.
- (a) *Recommended:* open RA-EAI-1-WEB-SEARCH-1 as its own data-use decision: Anthropic web search,
  a new cell `research × web-search`, queries and result URLs recorded with the report.
- (b) Keep unsourced drafts. Does not meet P6's "done".

**D4 — Credential and GATE-D.** (a) *Recommended:* scheduled research runs **only on the tenant's
own key** (P5 BYOK) until GATE-D closes; a tenant without a live key is refused, never moved to the
platform key. This needs a Director statement that a tenant-key run is outside GATE-D's scope.
(b) Platform key — blocked by GATE-D. Fix finding 8 (preflight `accountRef`) in either case.

**D5 — Cost bound.** Per-tenant daily research cap (recommended: 1 scheduled run per tenant per day,
counted inside the existing dispatch cap), a web-search use cap per run, and one new kill switch
`research-schedule` in `provider_connectivity_controls`, off by default.

**D6 — Concurrency and idempotency.** (a) *Recommended:* one scheduled report per (tenant,
authorization revision, local date), enforced by a unique key, so a retried or duplicated tick files
nothing new. This also answers RA-PREP-1-CONCURRENT-DISPATCH-1 for the scheduled path.

**D7 — Time zone.** Vercel cron runs in UTC. (a) *Recommended:* 08:00 Europe/Istanbul (05:00 UTC),
one cron. (b) 08:00 in each tenant's own zone — needs a stored zone and an hourly tick.

**D8 — Where reports appear.** (a) *Recommended:* the work item's artifacts and the Customer Dashboard
(`/home`) list, read-only; a manual "run now" for the same brief, under the same caps. This closes
RA-PREP-1-NO-SURFACE-1.

## What implementation must prove before it can be called done

- A tenant with no standing authorization, a withdrawn one, a lapsed granting authority, the kill
  switch off, or no live tenant key gets **zero** provider calls.
- One tick, run twice, files one report.
- Every report carries its sources (query, URL, retrieval time) or none, and says which.
- The cost bound holds under repeated ticks; the dispatch cap counts research.
- A BYOK tenant's preflight and dispatch judge the same account.
- In production: one authorized tenant receives an 08:00 report, observed in the ledger.

## Explicitly out of scope

Opportunity scoring, competitor monitoring feeds, report revision, multiple briefs per tenant,
any action taken on a report.

## Implementation path (after decisions)

1. **P6-1** — Surface and manual run: work-item and `/home` read-only list, "run now", concurrency key,
   BYOK `accountRef` alignment. Still unsourced.
2. **P6-2** — Standing research authorization (schema, Governance writer, withdrawal) and the
   `research-schedule` kill switch.
3. **P6-3** — Web-search source under its own data-use cell; sourced report format.
4. **P6-4** — 08:00 cron route under the existing machine-ingress pattern, with cost bound.

Each migration, the new data-use cell, the first provider call, the cron secret and every production
step are separate Director gates.

## Final decisions (Director, 2026-11-14)

| # | Decision |
|---|---|
| D1 | Standing research authorization: append-only Governance revision; the granting person's authority is re-checked at every run. |
| D2 | The tenant-written brief recorded in that authorization; the system generates no questions. |
| D3 | Web search, opened through RA-EAI-1-WEB-SEARCH-1 as its own data-use decision; queries and URLs recorded with the report. |
| D4 | Scheduled research runs only on the tenant's own key until GATE-D closes; a tenant without a live key is refused and never moved to the platform key. The Director accepted that a tenant-key run is outside GATE-D's scope. Finding 8 is fixed in P6-1. |
| D5 | One scheduled run per tenant per day, counted inside the dispatch cap; a per-run web-search cap; a `research-schedule` kill switch, off by default. |
| D6 | One scheduled report per (tenant, authorization revision, local date), enforced by a unique key. |
| D7 | 08:00 Europe/Istanbul (05:00 UTC), one cron. |
| D8 | Reports on the work item and a read-only `/home` list, with a "run now" under the same caps. |

## D9 — Who acts at 08:00 (Director, 2026-11-15)

Recorded at P6-4 start, because D1 decided the authority (a standing research authorization, the
granting person re-checked at every run) but not the actor of an unattended run.

**Decided: design A.** A scheduled run acts as an ephemeral **research schedule principal**, minted
only from the effective, active standing research authorization row; it is not a `TenantContext` and
inherits no user's authority. Immediately before the model, every run re-checks: the
`research-schedule` kill switch, that the authorization revision is still the one in force and
active, that the granting person is still an active member holding this organization's Governance
authority, the agent's mandate and responsibility, the tenant's own verified Anthropic key and the
research data-use decision. Rows the scheduled path writes itself (the report, its filing audit row,
the run ledger) are attributed to `system` with the authorization and run ids; the released
data-use evidence and dispatch-cap records, which are keyed to a human, name the granting person as
the accountable authorizer. One run per (tenant, authorization revision, Istanbul date) is enforced
by a unique run ledger (migration 90), claimed before the model; a failed run is recorded and not
retried that day. The cron route is inert until its secret is configured and the kill switch is on,
each a separate Director gate. Rejected: design B (rebuild the granting person's context each run),
because the run would be recorded as a human act.
