# RA-EAI-1 · Research data-use policy · closure record · PRODUCTION-ACCEPTED (scoped)

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
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: a8195bb5, THIS COMMIT (two missed test pins and this record)
- Verification level: V3 — data-use authority widening + schema migration
- Verification evidence: 2026-10-29; ra-eai-1 policy-and-boundary, tenant-authorization-postgres and migration-postgres PASS; bite-proofs 7/7; full suite at a8195bb5 1116/1121 with 0 product REGRESSION (2 test-only pins fixed here and PASS in the real tree, r3w BLOCKED on canonical 55432, 2 copy environment artifacts PASS in the real tree); tsc 0; eslint 0 errors; git diff --check clean; migration 83 digest 3f114ef305ce39c580ba0282103b26b7
- Test environment: worktree .claude/worktrees/ra-eai-1 and disposable detached copy eai-a8195bb5; session-created PostgreSQL 18.6 (UTF8) on 127.0.0.1:55492; macOS Darwin 25.2.0, Node 24.16.0
- Deployment evidence: 2026-10-29, dpl_HVwkvPC66L8R9KMtxgpzaLnvcrar, githubCommitSha c7d2c4b6aa80c50b051cbed0991d9cac9e36959e (main, fast-forward a26e03a8..c7d2c4b6), target production, READY; www.hebuntech.com, hebuntech.com, hebun-ai-recovered.vercel.app bound to it; migration #83 ceremony SUCCESS ledger 82 → 83 digest 3f114ef305ce39c580ba0282103b26b7, backup hebun_production_pre_migration_20261029-100500.dump validated
- Production acceptance evidence: 2026-10-29, read-only production measurement before and after migration #83: ledger 83, purpose CHECK contains research, tenant authorizations 6 and every existing scope count unchanged, research scopes 0, mandates 10 with 0 prepare-research, 0 research-report artifacts; anonymous runtime 200/307 with no error lines; scoped — the phase has no rendered surface and the cell was not exercised in production
- Deferred risks: RA-EAI-1-WEB-SEARCH-1 (DEFERRED); RA-AUTH-1-HUMAN-REVISE-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: P2 design scope (research × anthropic/messages × conversation only; web search out of scope; no provider call), 2026-10-29 ("P1 FINAL CLOSURE → P2 RA-EAI-1 IMPLEMENTATION"); migration #83 run by the Director at a TTY, 2026-10-29; main integration, deployment, acceptance and closure, 2026-10-29 ("RA-EAI-1 — MAIN INTEGRATION → PRODUCTION ACCEPTANCE → P2 CLOSURE → RA-PREP-1 HANDOFF")

### Deferred risk detail

- **RA-EAI-1-WEB-SEARCH-1 (DEFERRED).** Anthropic's web-search tool sends search queries derived from
  tenant text and returns third-party results; that is a separate data-use fact. Closes on its own
  Director decision (P4) before any web-search transport is opened.
- **RA-AUTH-1-HUMAN-REVISE-1 (DEFERRED).** Owned by RA-AUTH-1; unchanged here.
- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED).** Owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1. The
  research cell, like every Anthropic cell, rests on an attested — not verified — processor identity.

## Release (2026-10-29)

| Step | Evidence |
|---|---|
| Preflight (read-only, ceremony credential, direct endpoint, `verify-full`) | pinned `system_identifier` and database match; ledger 82; purpose CHECK without `research`; tenant authorizations 6; scopes assistance 18, work-planning 1, agent-origination 8, research 0; mandates 10, 0 `prepare-research`; 0 `research-report` |
| Migration ceremony | Run by the Director at a TTY: posture PRODUCTION, cluster `7675444875863894887`, database `neondb`, PostgreSQL 18.6, applied 82 / canonical 83, prefix verified per-migration sha256, pending exactly `20261029090953_ra_eai_1_research_purpose`, backup `hebun_production_pre_migration_20261029-100500.dump` 983353 bytes, 864 archive entries, `pg_restore -l` OK (re-read independently: 864), **SUCCESS**, ledger 82 → 83, final digest `3f114ef305ce39c580ba0282103b26b7`, organizational data UNCHANGED across every counted table |
| Main integration | CAS `git ls-remote` = `a26e03a8`, fast-forward push `a26e03a8..c7d2c4b6`; remote re-read `c7d2c4b6` |
| Deployment | `dpl_HVwkvPC66L8R9KMtxgpzaLnvcrar`, githubCommitSha `c7d2c4b6aa80c50b051cbed0991d9cac9e36959e`, target production, READY 2026-10-29T10:08:19Z; `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` bound to it (alias API) |
| Runtime (anonymous) | `/`, `/login` 200; `/agents`, `/approvals`, `/operations`, `/heby` 307 → login; no error line in the deployment's runtime log window |
| Production acceptance (read-only, after) | ledger 83; purpose CHECK contains `research`; tenant authorizations 6 and scopes assistance 18 / work-planning 1 / agent-origination 8 — byte-for-byte the preflight; **research scopes 0** (the cell authorized nobody); mandates 10, 0 `prepare-research`; 0 `research-report` |
| Runtime (authenticated) | Not applicable to this phase's acceptance: RA-EAI-1 renders nothing — no component reads the research cell or the research declaration, and the in-app assistance decision filters cells by `purpose === "assistance"`. The cell's behaviour is proven by the targeted tests at the deployed SHA, not by a production call: no tenant was authorized and no provider was called to exercise it |

**Scope of the acceptance.** Production holds the schema, the deployed policy and an unchanged
authorization state. Nothing in production can use the research cell: no tenant holds a research
scope, nothing performs `prepare-research-report`, web search is not covered, and the provider binding
is unverified (GATE-D). This is not a claim that the Research Agent works.
