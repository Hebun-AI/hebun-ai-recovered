# RA-AUTH-1 · Research preparation authority · closure record · DEPLOYED

First package of the Research Agent. It adds the AUTHORITY to prepare research and nothing that
performs it: a preparation mandate kind, a declared-but-not-performable capability and a stored artifact
type. **The Research Agent does not run in production.** No research is performed, no provider is
called, no research mandate is granted and no research report exists.

## What changed

- Mandate vocabulary = released originable action kinds + released PREPARATION kinds
  (`AGENT_PREPARATION_KINDS = ["prepare-research"]`). A preparation kind maps to no registry kind.
- `refuseOutsideAgentPreparation` beside the action ceiling; `refuseOutsideAgentMandate` admits only
  own-property origination aliases, so `prepare-research` can never admit a proposal, permit,
  Governance decision or machine act.
- Capability registry: `prepare-research-report` DECLARED, NOT PERFORMABLE (`dataUse: null`, no seam).
  Mandate condition is `prepare-research` alone; `prepare-work-draft` is not reachable through it.
- `work_artifact_type` += `research-report` as a STORED type only; `WORK_ARTIFACT_TYPES` unchanged, so
  the general writer, forms and both agent revise seams refuse it.
- Migration #82 `20261028183456_ra_auth_1_research_preparation`: one `ALTER TYPE … ADD VALUE`, one
  CHECK drop/re-add widened by one value. Additive. Ledger 81 → 82, digest `0b5c377bdc7415f672ba87c08ae7192a`.

## Artifact revision boundary

- Measured: no writer can create a `research-report` (`validateWorkArtifactInput` → `isWorkArtifactType`;
  test D7). Agent revise seams (`prepareWorkArtifact` revise branch, `reviseWorkDraft`) refuse it.
- The human `reviseWorkArtifact` (Operations) does not check type. Unreachable today: no row exists
  (production count 0, measured 2026-10-29).
- **RA-PREP-1 acceptance criterion:** when the research writer lands, research-report revision is owned
  by the `prepare-research-report` capability (agent) and by Governance review; the general human
  Operations revise path must either refuse `research-report` or be explicitly approved as a human
  edit path, with a postgres test proving the chosen rule.

## Release (2026-10-29)

| Step | Evidence |
|---|---|
| Ceremony TLS | First ceremony refused `BACKUP_FAILED` (`sslmode=require`, SH1-PG-CEREMONY-TLS-1 contract). `.env.ceremony.local` changed in two fields only, value-free: Neon pooler host → direct host of the same endpoint, `sslmode=require` → `verify-full`; database, role, password, `channel_binding=require` unchanged. Direct/pooled identity proven by read-only probe: same `system_identifier` (= pin), database, role, Neon tenant and timeline; direct backend client is not loopback (no pgbouncer). |
| libpq TLS acceptance | PG18.6 `psql` with the ceremony's own `libpqChildEnv`: `verify-full` + `PGSSLROOTCERT=system`, TLSv1.3. Negative, credential-free: untrusted root → certificate chain rejected; wrong host name on the real address → host name mismatch rejected; control with correct name reached the authentication stage. `pg_stat_ssl.ssl=f` is Neon's proxy terminating TLS, not a TLS failure. |
| Migration ceremony | Run by the Director at a TTY: posture PRODUCTION, cluster `7675444875863894887`, database `neondb`, PostgreSQL 18.6, applied 81 / canonical 82, prefix verified per-migration sha256, backup `hebun_production_pre_migration_20261029-083032.dump` 982932 bytes, 864 archive entries, `pg_restore -l` OK (re-read independently: 864 entries), **SUCCESS**, ledger 81 → 82, digest `0b5c377bdc7415f672ba87c08ae7192a`, organizational data UNCHANGED across every counted table. |
| Main integration | CAS `git ls-remote` = `73e362e2`, fast-forward push `73e362e2..5b1bb853`; remote re-read `5b1bb853`. |
| Deployment | `dpl_BD9v1CMLfwsa3jj2FzF33rx2cSz4`, githubCommitSha `5b1bb8535a0709df9284839994005d220958e8bf`, main, target production, READY 2026-10-29T08:33:47Z. Aliases `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` resolve to it (alias API). |
| Runtime (anonymous) | `/` and `/login` 200; `/agents`, `/approvals`, `/operations`, `/heby`, `/knowledge` 307 → login; no error lines in the deployment's runtime log window. |
| Production schema (read-only, ceremony credential, read-only transaction) | ledger 82; `agent_mandates_scope_subset_chk` contains `prepare-research`; `work_artifact_type` contains `research-report`; `agent_mandates` 10 rows, 0 carry `prepare-research`; `work_artifacts` 19 rows, 0 `research-report`. |
| Runtime (authenticated) | UNVERIFIED — no signed-in session in the inspecting browser; credentials are not entered by the agent. |

## Closure Contract (v1)

- Phase: RA-AUTH-1
- Owner: features/agent-mandate (vocabulary) + features/action-authorization/agent-mandate-ceiling (ceilings)
- Reached state: DEPLOYED
- Implementation commit: 5b1bb853
- Verification level: V3 — authority/mandate boundary + schema migration
- Verification evidence: full suite `npm run test:run` at 5b1bb853 in a disposable detached copy: 1115/1118, tree clean after; 3 red classified — plan-step-idempotency-1/bite-proofs PRE-EXISTING flake (baseline 73e362e2 2/5 FAIL, P1 3/4 FAIL, varying race assertions, seam untouched), r4c2-flow/pdf-extraction and test-runner/failure-reporting environment artifacts of the copy's relocated node_modules (both FAIL on baseline copy too, both PASS at 5b1bb853 in the real tree); 0 REGRESSION; 9/9 bite-proofs in disposable detached copy; tsc exit 0; eslint 0 errors on 92 changed files; `next build` exit 0; `git diff --check` clean; fresh 82-migration apply on disposable PG18; r3w ambient-database-safety PASS against a disposable stand-in (canonical 55432 not running); production ceremony SUCCESS ledger 81 → 82 digest 0b5c377bdc7415f672ba87c08ae7192a with validated backup (see Release)
- Test environment: disposable PostgreSQL 18.6, 127.0.0.1:55492 (session-owned); stand-in PG18 on 55432 for the ambient test only; macOS Darwin 25.2.0, Node 24.16.0
- Deployment evidence: 2026-10-29, dpl_BD9v1CMLfwsa3jj2FzF33rx2cSz4, githubCommitSha 5b1bb8535a0709df9284839994005d220958e8bf (main, fast-forward 73e362e2..5b1bb853), target production, READY; www.hebuntech.com, hebuntech.com, hebun-ai-recovered.vercel.app bound to it; read-only production schema acceptance PASS (ledger 82, CHECK and enum widened, 0 prepare-research mandates, 0 research-report artifacts)
- Production acceptance evidence: N/A — withheld: authenticated runtime acceptance not performed (RA-AUTH-1-AUTH-RUNTIME-1); anonymous and schema checks alone are not the full package
- Deferred risks: RA-AUTH-1-HUMAN-REVISE-1 (DEFERRED); RA-AUTH-1-AUTH-RUNTIME-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: implementation and final verification, 2026-10-28; controlled production release and closure, 2026-10-29 ("P1 / RA-AUTH-1 — CONTROLLED PRODUCTION RELEASE & FINAL CLOSURE"); ceremony credential change of host and sslmode only, 2026-10-29 ("NEON DIRECT CONNECTION, TLS VERIFICATION & CONTROLLED PRODUCTION RELEASE"); migration #82 run by the Director at a TTY, 2026-10-29; main integration, deployment, acceptance and closure, 2026-10-29 ("RA-AUTH-1 — PRODUCTION DEPLOYMENT, ACCEPTANCE & FINAL CLOSURE")

### Deferred risk detail

- **RA-AUTH-1-HUMAN-REVISE-1 (DEFERRED).** The human Operations `reviseWorkArtifact` path does not check
  artifact type. Unreachable while no `research-report` row exists. Closes in RA-PREP-1 by the
  acceptance criterion above, before any research artifact can be created.
- **RA-AUTH-1-AUTH-RUNTIME-1 (DEFERRED).** Signed-in production behaviour is unmeasured: the mandate
  view's "May propose" / "May prepare" split and the existing Heby, Governance and Work read paths at
  `5b1bb853`. Closes, and moves this record to PRODUCTION-ACCEPTED, on a Director signed-in read-only
  check of `/agents` (mandate scope sentence), `/approvals` and `/operations` with no mutation.
- **GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED).** Owned by HEBY-AI-PLAN-PRODUCTION-ACCEPTANCE-1.
  Production Anthropic credential binding is unverified; any research execution package depends on it.
