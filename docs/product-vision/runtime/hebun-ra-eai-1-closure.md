# RA-EAI-1 · Research data-use policy · closure record · VERIFIED

Second package of the Research Agent. It adds the DATA-USE POLICY for research and nothing that uses
it. Policy declaration ≠ tenant authorization ≠ provider availability ≠ execution permission: this
package records only the first.

## What changed

- `PURPOSES` and its SQL mirror `EXTERNAL_AI_PURPOSES_SQL` append `research`. No other purpose moves.
- `tenant_ai_data_use_scopes_purpose_chk` widened by migration #83
  `20261029090953_ra_eai_1_research_purpose`: one DROP, one ADD of the same CHECK (the D1 precedent,
  `20261013113340_eai_work_planning_purpose`). Additive. Ledger 82 → 83; canonical digest
  `3f114ef305ce39c580ba0282103b26b7`; the first 82 still digest to `0b5c377bdc7415f672ba87c08ae7192a`
  (production).
- `RECORDED_PLATFORM_DISCLOSURE_POLICY` gains exactly one cell: `anthropic/messages × research ×
  conversation` — the research question in the person's own words — under the existing
  `ANTHROPIC_ASSISTANCE_BOUNDS` and attestation `ffb0c160…`. `RecordedAllowedCell` admits only that
  pair for `research`. Every other research pair is UNKNOWN and refuses; Higgsfield stays DENIED.
- `prepare-research-report` declares `dataUse: { purpose: "research", dataClasses: ["conversation"] }`.
  It stays `PREPARATION_ONLY`, `authorizationRequired: false` and performed by nothing (`no seam yet`).
  The capability type no longer admits `dataUse: null`; no capability used it any more.

**Owners reused, unchanged.** Tenant authorization: `authorizeTenantExternalAiDataUse` /
`withdrawTenantExternalAiDataUse` under the existing `external-ai-data-use` Governance domain (no new
decision type). Disclosure: `composeExternalAiDisclosure`. No new subsystem, provider adapter, seam,
mandate kind or agent lifecycle.

**Not covered — and not authorized by this cell.** Anthropic's web-search tool: no search query,
search result or third-party search transfer (RA-EAI-1-WEB-SEARCH-1). No tenant is authorized. No
provider is called. Nothing performs research (RA-PREP-1).

## Verification (V3)

V3 because it widens a data-use authority and changes the schema.

| Check | Result |
|---|---|
| `tests/ra-eai-1/policy-and-boundary.ts` | PASS — vocabulary and mirror; one research cell; every other research class UNKNOWN, denied scope DENIED; the seven earlier cells unchanged; capability declaration, still no seam; the purpose named only by its vocabulary, mirror, cell and declaration; no web-search transport |
| `tests/ra-eai-1/tenant-authorization-postgres.ts` | PASS — platform cell alone authorizes nobody; writer refuses every other research pair and writes nothing; A authorizes research × conversation through Governance; research grants no assistance; B cannot use A's grant; provider unavailable is a refusal; withdrawal ends it; 0 Work artifacts |
| `tests/ra-eai-1/migration-postgres.ts` | PASS — at ledger 82 with five purposes' rows, migration 83 changes one CHECK: earlier rows and authorizations unchanged, `research` valid, near-misses refused, no grant created, no Work artifact; rollback only while no research row exists |
| Bite-proofs E-B1…E-B7 (disposable detached copy at a8195bb5, restored and clean after each) | 7/7 bite — second research cell, cell removed, wider bounds, capability declares work-artifact, capability gains a seam, tenant check ignores purpose, migration omits research |
| Pin fan-out | ledger and tail pins across the suite moved to 83 by rule; ama2's "mandate storage" list deliberately NOT extended (RA-EAI-1 touches no mandate storage); D1's own migration test now pins D1's five-purpose file |
| Full suite `npm run test:run` at a8195bb5, disposable detached copy, tree clean after | 1116/1121. 5 red classified: content-intake-1/batch-firewall and google-capability-scope-repair-1/scope-composition — missed migration-tail pins of THIS phase, test-only, fixed in THIS COMMIT and PASS in the real tree; r3w-flow/ambient-database-safety BLOCKED (canonical 55432 not running, not a pass); r4c2-flow/pdf-extraction and test-runner/failure-reporting environment artifacts of the copy's relocated node_modules (PASS in the real tree). 0 product REGRESSION |
| `tsc --noEmit` | 0 |
| `eslint` on 80 changed files | 0 errors; 1 pre-existing warning (trh24 unused `READER`) |
| `git diff --check` | clean |

## Closure Contract (v1)

- Phase: RA-EAI-1
- Owner: features/external-ai-data-use (purpose vocabulary, recorded platform policy) + db/schema/external-ai-data-use (purpose CHECK) + features/agent-work/capabilities (declaration only)
- Reached state: VERIFIED
- Implementation commit: a8195bb5, THIS COMMIT (two missed test pins and this record)
- Verification level: V3 — data-use authority widening + schema migration
- Verification evidence: 2026-10-29; ra-eai-1 policy-and-boundary, tenant-authorization-postgres and migration-postgres PASS; bite-proofs 7/7; full suite at a8195bb5 1116/1121 with 0 product REGRESSION (2 test-only pins fixed here and PASS in the real tree, r3w BLOCKED on canonical 55432, 2 copy environment artifacts PASS in the real tree); tsc 0; eslint 0 errors; git diff --check clean; migration 83 digest 3f114ef305ce39c580ba0282103b26b7
- Test environment: worktree .claude/worktrees/ra-eai-1 and disposable detached copy eai-a8195bb5; session-created PostgreSQL 18.6 (UTF8) on 127.0.0.1:55492; macOS Darwin 25.2.0, Node 24.16.0
- Deployment evidence: N/A
- Production acceptance evidence: N/A
- Deferred risks: RA-EAI-1-WEB-SEARCH-1 (DEFERRED); RA-AUTH-1-HUMAN-REVISE-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: P2 design scope (research × anthropic/messages × conversation only; web search out of scope; no provider call), 2026-10-29 ("P1 FINAL CLOSURE → P2 RA-EAI-1 IMPLEMENTATION"); push, production migration #83 and deployment NOT approved

### Deferred risk detail

- **RA-EAI-1-WEB-SEARCH-1 (DEFERRED).** Anthropic's web-search tool sends search queries derived from
  tenant text and returns third-party results; that is a separate data-use fact. Closes on its own
  Director decision (P4) before any web-search transport is opened.
- **RA-AUTH-1-HUMAN-REVISE-1 (DEFERRED).** Owned by RA-AUTH-1; unchanged here.
- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED).** Owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1. The
  research cell, like every Anthropic cell, rests on an attested — not verified — processor identity.

## Release (not done)

Production migration #83 needs its own Director ceremony (same command as RA-AUTH-1, from this
worktree), expected `applied 82 / canonical 83`, digest `3f114ef305ce39c580ba0282103b26b7`; then a
fast-forward push of this branch to `main` (= production deploy).
