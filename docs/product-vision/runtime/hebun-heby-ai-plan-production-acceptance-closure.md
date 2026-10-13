# HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1 · Gates B–D · closure record · DEPLOYED

The released Heby AI planning runtime (`e0c96157`) was taken through its production gates: migration 77,
a Hebun-only `work-planning × operational-record` grant, and one controlled real model invocation from an
authenticated browser. **Browser acceptance and plan-contract acceptance passed. Independent
reconciliation of the provider account did not**, so this record stops at `DEPLOYED` and does not claim
`PRODUCTION-ACCEPTED`.

## 1 · Gate B — migration 77 (Director ceremony, 2026-10-13)

| Check | Measured (read-only) |
|---|---|
| Ledger | 76 → 77; last tag `20261013113340_eai_work_planning_purpose`; prod digest = local digest `66fde9c77c3593f8a98c4f1a88a92b6a`; 0 prefix mismatches |
| CHECK | `tenant_ai_data_use_scopes_purpose_chk` names five purposes incl. `work-planning`; `convalidated = true` |
| Authorization data | auths 4 / scopes 17; row md5 `34f015b0…` / `4f3dc35f…` equal to the pre-migration snapshot; 0 `work-planning` rows |
| Organizational data | 80 tables counted against the backup: only `drizzle.__drizzle_migrations` differs (76 → 77) |
| Backup | `hebun_production_pre_migration_20261013-220226.dump`, pg_dump 18.6 custom, 832 TOC entries; full `pg_restore -f /dev/null` exit 0; inside: ledger 76, scopes 17, auths 4, 0 `work-planning` |
| Deployment | `dpl_7hZy2EcCWRCHnTomkQb1oP8mP6Hw` READY at `e0c96157`, ready 21:55:45Z — before the migration (backup 22:02:26Z) |

## 2 · Gate C — Hebun-only grant (Director ceremony, 2026-10-13T22:28:32Z)

| Check | Measured (read-only) |
|---|---|
| Grant | `hebun` revision 4 `242a0db8` active, supersedes `b2de774d`; attestation `ffb0c160` r1 |
| Scopes | assistance × {conversation, knowledge, work-artifact}, agent-origination × {conversation, organization, knowledge}, **work-planning × operational-record** |
| Only Hebun | exactly one `work-planning` row in production; every pre-existing authorization and scope row byte-identical (md5); TRH revision 1 assistance only; Mulify none |
| Governance | decision `0890073d` (approve, subject `242a0db8`, evidence lists the seven scopes) · session `d5adbbc0` · audit `c5401123` `governance.decision.recorded`, request id `eai-tenant-external-ai-data-use-ceremony` |
| Side effects | count delta exactly: authorizations +1, scopes +7, governance_sessions +1, decision_records +1, audit_log +1 |
| Provider | EAI disclosure audit unchanged (21 authorized / 1 refused) — the ceremony called no provider |
| Revoke path | the released `revisionScopesWithout` over the seven scopes in force returns exactly the six prior pairs (pure, no write) |

**AI-PLAN-INDIRECT-PROFILING-1** was accepted by the Director for this Hebun-only grant, bounded to the
existing projection and EAI boundary; it authorizes no other field, tenant or disclosure.

## 3 · Gate D — one controlled real invocation (Director-authorized, 2026-10-13T22:38Z)

| Check | Measured |
|---|---|
| Session | `user_session_contexts` 22:34:27Z: Director, `active_tenant_id` = `hebun` |
| Invocation | one message `AI ile Engineering için aksiyon planı hazırla` on `/heby`; one `POST /heby` (server action) → 200, 3.18 s server time, 1406 bytes; no retry |
| Browser | `AI plan · Engineering`, three recommendations over 3 work items, provenance "A model proposed the order…"; console: no messages; network: no failed request |
| Plan contract | **PASS** — the runtime shows a plan only after `validateOperationalPlanCandidate` accepts it; a refused answer is never shown |
| EAI audit | exactly +1 `external-ai.disclosure.authorized` 22:38:15.665Z: tenant `f625b683`, purpose `work-planning`, classes `[operational-record]`, tenant revision 4, `claude-haiku-4-5-20251001` |
| Side effects | 80 tables: only `audit_log` +1 (280 → 281); no work item, Governance row, request, permit or execution |

**What proves a real call, and what does not.** In the deployed code the EAI gate runs only for a
transport that carries the Anthropic egress mark (the fake transport does not and writes no audit), and
the fake transport returns prose that cannot pass the JSON plan contract. The URL is the constant
`https://api.anthropic.com/v1/messages`; the key is the single project-scope `ANTHROPIC_API_KEY`
(production, sensitive, no integration, no shared env). So the response came from that endpoint with
that key — **by deduction from deployed code and observed outputs, not from a provider-side record.**

**Provider-account reconciliation: UNVERIFIED.** The Director's Anthropic Console (organization
`14ea4a95…`, workspace Dashboard) showed 0 Haiku 4.5 tokens for 2026-10-13 and the Dashboard key "last
used 2026-10-12". The Gate D call is 2026-10-13 UTC / 2026-10-14 Europe/Istanbul. Whether production's key
is the Dashboard key was never verified (B1B attestation record, *Unresolved*), the response `id` and
`usage` are not persisted, and runtime logs carry no request line content. Open as
GATE-D-PROVIDER-RECONCILIATION-1.

## 4 · Rollback

RELEASE-ROLLBACK-FLOOR-1 is now active: no deployment older than `a27e5ad4` may serve production while
Hebun holds `work-planning`. Order: run `--tenant=hebun --work-planning --revoke` (dry run, then
`--confirm`, phrase `REVOKE EXTERNAL AI DATA USE`), verify six scopes and zero `work-planning` rows, then
roll back.

## Closure Contract (v1)

- Phase: HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1
- Owner: apps/dashboard/src/features/heby-commands/ai-operational-plan.server.ts and the tenant EAI authorization of `hebun`
- Reached state: DEPLOYED
- Implementation commit: e0c96157 — the released runtime under acceptance; this phase added no code
- Verification level: V3 — a production schema migration, a tenant external-AI authorization and the first real provider invocation of a new purpose; every step measured read-only in production
- Verification evidence: Gate B ledger 77 and digest 66fde9c77c3593f8a98c4f1a88a92b6a, CHECK validated, 80-table count diff vs backup = ledger only, backup full read exit 0; Gate C revision 4 242a0db8 only work-planning row, prior rows md5-identical, decision 0890073d / session d5adbbc0 / audit c5401123, count delta exactly the ceremony's; Gate D authenticated browser PASS (plan shown, no console or network error), plan contract PASS, EAI audit +1 work-planning × operational-record rev 4, 80-table delta audit_log +1 only
- Test environment: production read-only (`default_transaction_read_only=on`) from the release-aligned worktree at e0c96157; Claude desktop browser pane, Director-authenticated session; Vercel CLI 59.1.4 for deployment reads; no test database
- Deployment evidence: dpl_7hZy2EcCWRCHnTomkQb1oP8mP6Hw READY production at e0c96157 (www.hebuntech.com, hebuntech.com)
- Production acceptance evidence: N/A — withheld: GATE-D-PROVIDER-RECONCILIATION-1 is BLOCKED; browser and contract acceptance alone are not the full evidence package
- Deferred risks: GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED); AI-PLAN-UI-THROW-1 (DEFERRED); AI-PLAN-RUNTIME-BROWSER-1 (CLOSED); RELEASE-ROLLBACK-FLOOR-1 (DEFERRED); AI-PLAN-INDIRECT-PROFILING-1 (DEFERRED); AI-PLAN-TITLE-PII-1 (DEFERRED)
- Director approvals: Gate B production migration 77 (executed by the Director, 2026-10-13); Gate C Hebun-only work-planning grant and bounded acceptance of AI-PLAN-INDIRECT-PROFILING-1 for Hebun only (2026-10-13); Gate D exactly one real invocation from the Director's own authenticated session (2026-10-13); this record prepared on Director decision D3 (2026-10-14); commit, push and deploy NOT approved

### Deferred risk detail

- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)** — blocks `PRODUCTION-ACCEPTED` of this phase. Production's
  Anthropic credential is not proven to belong to the Console organization/workspace observed, and no
  provider-side identifier exists for the Gate D call. Closes with either Console usage and key "last
  used" matching production's call days (2026-10-06/07/08/10/11/12/14 Europe/Istanbul), or a
  Director-approved change that persists the provider message id and usage in disclosure evidence plus one
  approved verification call.
- **AI-PLAN-UI-THROW-1 (DEFERRED)** — `runAiOperationalPlan` rethrows any error that is not a
  `ModelConnectivityError`; `use-heby-conversation.ts` awaits it in `try/finally` without `catch`, so such
  an error leaves "Preparing an AI plan…" on screen. Fails closed (nothing shown, nothing sent twice); a
  wording defect, not a disclosure.
- **AI-PLAN-RUNTIME-BROWSER-1 (CLOSED)** — the AI plan surface was exercised in an authenticated
  production browser at Gate D (section 3).
