# P6-3 — Web-search research under its own data-use class

Master Plan V2 P6, slice 3 of the P6 design gate (`hebun-p6-research-design-gate.md`, decisions D3 and D5).
Research can now be sourced from Anthropic's web-search tool, under its own data-use decision. The
release is deployed and its schema is in production. **No platform cell records research × web-search
(RA-EAI-1-WEB-SEARCH-1 stays DEFERRED), so no tenant can grant it, no web search has run in production and
every production research report is still unsourced. No end-to-end acceptance has been done.** This
record closes P6-3 at DEPLOYED, not PRODUCTION-ACCEPTED.

## What changed

- **Migration 89** (`20261115142234_p6_3_web_search_data_class`), additive only: the
  `tenant_ai_data_use_scopes_data_class_chk` CHECK admits a new data class `web-search`. No table,
  column or data change.
- **Data-use vocabulary**: `web-search` is its own class, so no earlier research grant
  (research × conversation, RA-EAI-1) covers a search. The research capability declares it separately
  (`webSearchDataClass`).
- **Seam** (`features/agent-work/assign-research-report.server.ts`): asks research ×
  {conversation, web-search} as a separate, required decision. Authorized, the run is sourced;
  otherwise the released unsourced path runs unchanged.
- **Generator** (`features/heby-model/heby-model-generation.server.ts`): refuses a search that is not a
  REQUIRED declared class, before the data-use authority is asked, and one the decision did not
  authorize. No search reaches the wire without that decision.
- **Live transport**: sends `web_search_20250305` (the basic version; the dynamic-filtering versions run
  provider-side code execution, a further data flow no decision covers) with a per-run cap
  (`HEBUN_RESEARCH_WEB_SEARCH_MAX_USES`, default 3, ceiling 5). Any other cap is refused before any
  budget unit or fetch. A searching request gets 90 s instead of 30 s. One HTTP call per run: a
  `pause_turn` is not continued and nothing is retried.
- **Sourced report** (`features/agent-work/sourced-research-report.ts`): topic, research date,
  sourcing line, the model's four sections (missing ones are named, never written), numbered sources
  only for URLs the search returned in this call, cited excerpts, search queries, uncited passages,
  uncited results and search errors. A model-written link, or cited blocks that are not the validated
  answer, file nothing. Search results are stored as untrusted text; the provider's encrypted payloads
  are not kept. The model is told never to follow instructions inside a result.
- **Audit**: the filing row records `sourcing` (`web-search` or `unsourced`) and, for a sourced report,
  the search and source counts, joined to the dispatch's disclosure decision by correlation id.
- **Surface**: the research section and labels no longer claim every report is unsourced; the
  report's own SOURCING line says which.

Unchanged: the tenant's own Anthropic key requirement (P6 D4), the P6-2 standing research
authorization, the dispatch cap and the process live-spend budget.

## What is proven

**Before release (PR #11).** Head `19dda067`: required checks `quick`, `targeted` and
`full-suite (disposable PostgreSQL)` run 43731684911 (1176 passed, 0 failed, 2 excluded), all SUCCESS,
plus Vercel preview. The first full-suite run 43726214482 on `de7d573c` failed one test
(`content-intake-1/batch-firewall.ts`, a newest-migration pin written as a regex); fixed in `19dda067`.
Locally, on a session-owned PostgreSQL 18 (system identifier 7708403266536779794):
- new `tests/p6-3-web-research/web-research.ts` (W1–W5) and R12 in
  `ra-prep-1/research-preparation-postgres.ts`, on SIMULATED provider payloads only;
- research firewall F10; the RA-EAI-1 "no web-search transport" pin rewritten to where the tool may be
  named, not deleted;
- bite-proofs in a disposable copy: ra-prep-1 24/24 (B1–B18 in one run, B19–B24 new in the next, on
  identical source); ap3, apf5, int5c, tb1, a1a, app2 and ops-p1 bite-proofs green;
- about 160 affected suites green; `tsc --noEmit`, eslint (0 errors) and `npm run build` exit 0.

**Production schema (2026-11-15).** `platform:migrate` ceremony run by the Director at a TTY from a
detached worktree at `19dda067`, production posture, target pins verified by the ceremony:
- before: read-only check, ledger 88 of 88, no advisory lock;
- validated pre-migration backup `hebun_production_pre_migration_20261115-164055.dump` on the operator
  host (`pg_restore -l` OK, 1005 archive entries);
- after: a second, read-only ceremony run reported `ALREADY_CONVERGED`, 89 of 89, digest
  `01126461862e7f3d3385fa41e6dfd1a2` = this release's canonical digest (the first 88 files still digest
  to `bd3a1ecc`, the P6-2 release);
- read-back: the data-class CHECK admits `web-search` and keeps every earlier class; 0 scope rows for
  `web-search`; no advisory lock;
- organizational rows unchanged: companies 4, agents 5, work_items 11, decision_records 115,
  governance_sessions 115, integrations 13; standing research authorizations 0.

**Deployment (2026-11-15).** PR #11 merged to `main` as `00c30bc5` (parents `632f5e0f`, `19dda067`),
pinned to the verified head. Vercel production deployment `dpl_BHkjD1AHGe7f3WvrwAxN1LHGeheZ`: READY,
target production, `githubCommitSha` `00c30bc5`, ref `main`, aliased to `www.hebuntech.com` and
`hebuntech.com`; `/` and `/login` return 200.

## What is not proven

- **No real web search has run anywhere.** The tool definition and response shapes follow Anthropic's
  web-search tool documentation and are exercised only against simulated payloads
  (P6-3-LIVE-SEARCH-UNEXERCISED-1).
- The research surface was not re-read signed in after this release.
- Whether a 90 s searching request fits the deployment's function duration is not measured
  (P6-3-SEARCH-DURATION-1).
- The 08:00 schedule is P6-4 and is not built.

## Closure Contract (v1)

- Phase: P6-3-WEB-RESEARCH
- Owner: apps/dashboard/src/features/agent-work/ (research seam and sourced report), apps/dashboard/src/features/heby-model/ and apps/dashboard/src/features/heby-model-live/ (web-search gate and transport), apps/dashboard/src/features/external-ai-data-use/contracts.ts and migration 20261115142234_p6_3_web_search_data_class (data class), docs/product-vision/runtime/hebun-p6-research-design-gate.md (decisions)
- Reached state: DEPLOYED
- Implementation commit: 19dda0676b2a5667ed254bb97b69aa94b913c628 (feature de7d573c plus pin fix; released on main by merge 00c30bc515def4f80df227014934a651a95e00a7)
- Verification level: V3 — schema/migration, an External-AI data-use class and a provider execution boundary; full suite justified on the pull request for that reason
- Verification evidence: PR #11 checks on 19dda067 — quick, targeted and full-suite (run 43731684911, 1176 passed, 0 failed) SUCCESS; local bite-proofs ra-prep-1 24/24 bit plus seven other bite-proof files green; W1–W5, R12 and F10 pass on simulated payloads; tsc, eslint (changed files) and npm run build exit 0
- Test environment: GitHub Actions with disposable PostgreSQL for the required checks; local isolated worktree and a session-owned PostgreSQL 18 (system identifier 7708403266536779794) for the local suites, bite-proofs in a disposable copy
- Deployment evidence: Vercel dpl_BHkjD1AHGe7f3WvrwAxN1LHGeheZ, production, READY, githubCommitSha 00c30bc5, aliased to www.hebuntech.com, / and /login 200; production ledger 89/89, digest 01126461862e7f3d3385fa41e6dfd1a2 (platform:migrate ALREADY_CONVERGED read-back)
- Production acceptance evidence: N/A — no platform cell records research × web-search, so no tenant can grant it and no web search ran; no Anthropic call was made; end-to-end acceptance not done
- Deferred risks: RA-EAI-1-WEB-SEARCH-1 (DEFERRED); P6-3-LIVE-SEARCH-UNEXERCISED-1 (DEFERRED); P6-3-SEARCH-DURATION-1 (DEFERRED)
- Director approvals: P6 design gate decisions D1–D8, 2026-11-14; P6-3 implementation and local migration 89, 2026-11-15; PR #11 push and open, 2026-11-15; production migration 89 run by the Director, 2026-11-15; PR #11 merge and production deploy, 2026-11-15; P6-3 closure record, 2026-11-15; the research × web-search platform cell, a real web search, Anthropic calls and P6-4 NOT approved

### Deferred risk detail

- **RA-EAI-1-WEB-SEARCH-1 (DEFERRED, owned by RA-EAI-1).** Unchanged. P6-3 built the transport and the
  gate; the platform cell that would let a tenant grant research × web-search is still a Director
  decision, and until it exists the tenant writer refuses the grant (`platform-not-allowed`).
- **P6-3-LIVE-SEARCH-UNEXERCISED-1 (DEFERRED).** The web-search request and response handling have run
  only against simulated payloads. Acceptance dependency: the RA-EAI-1-WEB-SEARCH-1 decision, a tenant's
  own key and grant, then one authorized run whose filed report, disclosure decision and audit row are
  read back.
- **P6-3-SEARCH-DURATION-1 (DEFERRED).** A searching request may take up to 90 s; the deployment's
  function duration limit for the run-now action is not measured against it. Acceptance dependency:
  that first authorized run, or a recorded function-duration setting.

## Weekly three questions

1. **What did we learn?** A new provider data flow needs its own data-use class, not a reused one; and
   because the tenant writer already refuses a class no platform cell records, the code can ship
   fail-closed before the decision exists. A pin that says "this does not exist" has to be rewritten
   to where it may exist and under which gate, not deleted.
2. **How does this improve Turkish Rug House?** When TRH's Governance authorizes web search, its research
   reports will name their sources and say plainly which statements no source supports.
3. **How does this become part of Hebun AI?** Every tenant's research gets the same gate: sourced only
   under its own data-use decision, on its own key, capped per run, with the sources filed with the
   report.
