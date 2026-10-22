# SECURITY-HARDENING-1 · Next.js security release · closure record · PRODUCTION-ACCEPTED

Next.js moved from 16.2.10 to 16.3.8 in production. The release changes two package files and nothing
else. It was first recorded `DEPLOYED` on corroborated identity alone; section 6 adds the direct
deployment record, a complete runtime-log window and the Director's authenticated observations, and the
Director accepted it in production on 2026-10-22. The acceptance covers this security release — not every
Hebun subsystem, and not every Server Action (section 6 says which were and were not verified).

## 1 · Why

A read-only stack audit (2026-10-22) found Hebun on Next.js 16.2.10, affected by 17 GitHub advisories
for `next`. Read from the GitHub Advisory API, they patch at three boundaries:

| Patched in | Advisories |
|---|---|
| 16.2.11 | GHSA-6gpp-xcg3-4w24 proxy bypass, GHSA-m99w-x7hq-7vfj Server Actions DoS, GHSA-89xv-2m56-2m9x and GHSA-p9j2-gv94-2wf4 SSRF, GHSA-q8wf-6r8g-63ch SVG DoS, GHSA-955p-x3mx-jcvp Server Function endpoint disclosure, GHSA-68g3-v927-f742 and GHSA-4633-3j49-mh5q cache confusion, GHSA-4c39-4ccg-62r3 Edge payload |
| 16.3.3 / 16.3.6 | critical: GHSA-p293-qw3h-jr36 (CVE-2026-75604) Windows RCE, GHSA-2xp9-vwfh-vxw4 Image Optimization AVIF RCE, GHSA-vcvr-r3jv-pc5j `next/og` RCE |
| 16.3.8 | GHSA-cjq9-62q9-8jv4 Image Optimization SSRF, GHSA-mcj8-r9mp-w47p and GHSA-4jqv-mc3x-m676 cache poisoning, GHSA-f87g-xv8r-7p7x metadata route disclosure, GHSA-39w2-rjm5-chcv dev MCP disclosure |

16.3.8 is the lowest release that patches all of them; `latest` (16.4.2) adds no security fix over it
and was not taken. Exposure on Hebun's configuration was not uniform — several need features Hebun
does not use (custom server, rewrites, `next/og`, i18n, Windows) — but the Server Actions DoS and
Server Function disclosure apply directly, and the Image Optimization path on Vercel was not proven
unexposed, so the upgrade was taken whole rather than argued advisory by advisory.

## 2 · What changed

| Package | Before | After |
|---|---|---|
| `next` | 16.2.10 | 16.3.8 (exact pin) |
| `eslint-config-next` (dev) | 16.2.10 | 16.3.8 (exact pin) |
| transitive | — | `@next/env`, `@next/swc-*`, `@next/eslint-plugin-next` 16.3.8; `@swc/helpers` 0.5.23; `postcss` 8.5.23 (Next's nested 8.4.31 removed); Next's own optional `sharp` 0.35.5 under `next/node_modules` for its image optimizer; `@emnapi/runtime`, `fastq` patch drift |

Unchanged: the app's own `sharp` 0.34.5 (the JPEG publish derivative's bytes stay pinned), React and
React DOM 19.2.4, every file under `src/`, `next.config.ts`, `vercel.json`, the schema and the
migration ledger. npm 11, `lockfileVersion` 3.

## 3 · Verification (local)

Baseline `14eaf051` and candidate measured in isolated worktrees, the candidate on a clean `npm ci`:

| Check | 14eaf051 (16.2.10) | candidate (16.3.8) |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| `eslint` | 0 errors / 24 warnings | 0 errors / 24 warnings, findings identical |
| `next build` | green, 175 static pages | green, 175 static pages, same 156-route set (16.3 prints catch-all child markers differently) |
| full suite | 1067 / 2 of 1069 (recorded at the same app content, `e6c00be6`) | 1067 / 2 of 1069 |
| production `npm audit --omit=dev` | 6 (critical 1, high 4, moderate 1) | 4 (critical 0, high 3, moderate 1); `next`, `postcss` gone |
| development continuity | — | PASS |

The two reds: `r3w-flow/ambient-database-safety` BLOCKED (canonical `hebun_r1` at :55432 unreachable),
as in the baseline; `trh25-observation-trigger/bite-proofs` failed once because `trigger-postgres.ts`
accepts three of the four legal race outcomes for the losing scan (`not-due` is missing). Alone it
passed 5/5 and the bite-proofs bit 11/11 with 0 void; that path imports no Next.js. Not a regression;
recorded as SH1-TRH25-RACE-TEST-1 and left unchanged.

A differential HTTP smoke ran both production builds locally (`HEBUN_AUTH_ENABLED=true`, no database):
21 requests, byte-identical status and redirect results — protected pages and querystrings 307 to
`/login`, the three cron ingresses 401 without and with a wrong bearer, a remote `/_next/image` URL
400. No server errors.

## 4 · Release and deployment (2026-10-22)

| Check | Measured |
|---|---|
| Release | `a6ba1dae` (single parent `14eaf051`, two files) fast-forward pushed to `main` after a fresh `ls-remote` read `14eaf051`; push printed `14eaf051..a6ba1dae`; `ls-remote` and the GitHub API then read `main = a6ba1dae` |
| Vercel status on GitHub | commit status `Vercel` pending 08:36:12Z → **success "Deployment has completed"** 08:38:17Z, target `…/hebun-ai-recovered/E4GpHBnQGWZjSbSd8t5sKnta8iyo`; GitHub deployment `7247654518`, environment Production, sha `a6ba1dae`, status success, URL `hebun-ai-recovered-fqpye0ab0-hebuntechs-projects.vercel.app` |
| Serving | `www.hebuntech.com` `/` and `/login` HTML carry the skew-protection marker `dpl_E4GpHBnQGWZjSbSd8t5sKnta8iyo` |
| Framework | a served client chunk carries `version:"16.3.8"` |
| Domains | `www.hebuntech.com` 200; `hebuntech.com` 308 → `https://www.hebuntech.com/` |
| Signed-out smoke | `/` 200 · `/login` 200 · `/heby`, `/approvals`, `/director/work`, `/agents` 307 → `/login` · `/api/observation/scan`, `/api/machine-delivery/scan`, `/api/standing-issuance/scan` 401 · scan with a wrong bearer 401 |
| Not measured at release time | direct Vercel inspection of the deployment's READY state (the read-only `vercel ls` was denied by the session's permission classifier; the Vercel connector returned 403 for this team scope) and the deployment's runtime / error / 5xx logs — UNAVAILABLE then, never counted as a pass. **Corrected 2026-10-22: both were later measured directly (section 6).** |

**What the identity chain proves, and what it does not.** The GitHub deployment status ties `a6ba1dae`
to `E4GpHBnQ…`, and the served HTML names the same deployment, so the release SHA is serving production
traffic. It is corroboration from two independent surfaces, not a reading of Vercel's own deployment
record, and it says nothing about runtime errors.

Rollback: promote `dpl_9nzYSvvxHwXXtgVYgWMbHvUHwwer` (`14eaf051`). No migration is involved;
RELEASE-ROLLBACK-FLOOR-1 (`a27e5ad4`) and the PSI1 floor are older and unaffected. No rollback was made.

## 5 · Legacy project containment — PAUSED (2026-10-22)

The legacy Vercel project carrying the same Next.js advisories was paused, not deleted. This section
records the containment of SH1-LEGACY-PROJECT-1; it does not change this phase's reached state.

**Target and authority.** `hebun-ai`, `prj_Kjm298MklOpTVUl9vxavae888B8v`, team
`team_H71EbsO2RrI2sgorB0PA3l1E`, repository `hebuntech/hebun-ai`, production deployment
`dpl_8Pxu7KS3Cu87PE1wu7Uwt6F87uHD` (built 2026-06-18, commit `a73c8b25`, Next.js 16.2.7). The Director
confirmed the application had not been used for a long time and authorized a reversible pause without
deletion.

**Pre-pause investigation (read-only).**

| Question | Evidence | Standing |
|---|---|---|
| Shared infrastructure | Separate project, repository, production aliases (three `*.vercel.app` only), env set (6 names), no crons, no deploy hooks, 0 webhooks on either repository; `hebuntech.com` / `www` resolve by A record to Vercel, `media` to the VPS, none to the legacy project; current repository has 0 references to the legacy aliases, repository or project id; current production has no `AUTH_URL` / `NEXTAUTH_*` | VERIFIED |
| Database | Current production cluster `system_identifier` `7675444875863894887` decodes to `initdb` 2026-08-18T18:46:10Z; the legacy project's `DATABASE_URL` and `DIRECT_URL` were last updated 2026-06-18 and its running deployment was built that day, two months before that cluster existed. Values were never read | Legacy cannot target the current production cluster — very high confidence, inferred from authoritative timestamps, not from the value |
| Legacy database itself | Which service it names, whether it is live, and what personal data it holds | UNAVAILABLE |
| External webhooks | Legacy code has Stripe and reply webhooks; the deployment holds no `STRIPE_*` or `RESEND_*` variable; no POST to either route in the observed logs | Provider-side registrations (Stripe, Resend dashboards) UNAVAILABLE |
| Usage | 2026-10-18 → 10-22: only GET/HEAD to `/`, `/dashboard`, `/login` in short bursts (crawler pattern), no POST, no sign-in or registration | Earlier windows returned no records without error — UNAVAILABLE, not zero usage |

**Pause.** `POST /v1/projects/prj_Kjm298MklOpTVUl9vxavae888B8v/pause` (Vercel REST, through the CLI),
**2026-10-22T10:23:56Z**. The target id was checked against the production project id before the call.

| Check | Before (10:23:12Z) | After (10:24:16Z) |
|---|---|---|
| Legacy project metadata | `paused` absent | `paused: true` |
| `hebun-ai.vercel.app/login` | 200 "Sign in" | **503**, `x-vercel-error: DEPLOYMENT_PAUSED` |
| `hebun-ai.vercel.app/` | 307 | 503 |
| `hebun-ai-hebuntechs-projects.vercel.app`, `hebun-ai-git-main-hebuntechs-projects.vercel.app` | 302 | 503 |
| Legacy resources | — | deployment `dpl_8Pxu7KS3…`, 3 aliases, 6 env variables, GitHub link: all preserved |

**Current production isolation.** Project `hebun-ai-recovered` metadata unchanged (`paused` absent,
`updatedAt` 08:38:17Z, deployment `dpl_E4GpHBnQGWZjSbSd8t5sKnta8iyo`, 5 aliases, 45 env). The signed-out
smoke was byte-identical before and after: `/` 200, `/login` 200, apex 308 → www, `/heby`,
`/approvals`, `/director/work`, `/agents` 307 → `/login`, the three cron ingresses 401 with no and with a
wrong bearer, deployment marker unchanged. Production logs after the pause: 13 requests, none 5xx.
Production `fatal` since 08:38Z: none. Production `error` since 08:38Z: one line, before the pause
(09:00:18Z, the hourly observation scan, response 200) — a `pg` deprecation warning that SSL modes
`prefer`, `require` and `verify-ca` are aliases for `verify-full`; unrelated to the pause, noted for the
future `pg` v9 upgrade.

**States, kept apart.** The legacy project is **PAUSED**, not DELETED: nothing was removed and deletion
is not authorized. Production isolation is **VERIFIED** by the checks above. The legacy database's
identity and contents and any provider-side webhook registrations are **UNAVAILABLE**.

**Resume — only on explicit Director authorization.** Vercel → `hebun-ai` → Settings → General →
**Resume Project**, or `POST /v1/projects/prj_Kjm298MklOpTVUl9vxavae888B8v/unpause?teamId=team_H71EbsO2RrI2sgorB0PA3l1E`.
Resume is immediate and unconfirmed; Vercel documents that the production deployment returns within a
few minutes without a redeploy. Verify `https://hebun-ai.vercel.app/login` returns 200 and the
production smoke is unchanged. While paused, nothing should be pushed to `hebuntech/hebun-ai`: Vercel does
not document whether a push to a paused project builds.

## 6 · Production acceptance (2026-10-22)

All reads below are read-only metadata: route, method, status, timestamp and log level. No cookie, token,
request body or conversation content was read; no synthetic request, mutation or provider call was made.

**Deployment record, read directly.** Vercel `GET /v13/deployments/dpl_E4GpHBnQGWZjSbSd8t5sKnta8iyo`:
`readyState: READY`, target `production`, `githubCommitSha` `a6ba1dae39bda55b210b915e8c943a3f3a4fc90f`,
ref `main`, repository `Hebun-AI/hebun-ai-recovered`, ready 2026-10-22T08:38:16.843Z, aliased to
`www.hebuntech.com` and `hebuntech.com`; the project's production target is this deployment; GitHub `main`
reads the same SHA. This replaces the corroboration-only identity of section 4.

**Runtime logs — complete window.** `vercel logs` returns at most 50 records per call, so the window was
paged backward with `--until` and de-duplicated by record id until a page came back short: 2026-10-22
08:38:17Z → 11:09:24Z, **310 records, 7 pages, complete**, every record from `dpl_E4GpHBnQ…`.

| Measure | Result |
|---|---|
| Status codes | 200 ×274 · 307 ×20 · 401 ×16 |
| HTTP 5xx | **0** — and 0 again from the server-side `--status-code 5xx` filter, whose control (`--status-code 401`) returned records |
| Fatal | **0** |
| Error level | 10 records, every one the `pg` deprecation warning that SSL modes `prefer`, `require` and `verify-ca` are aliases for `verify-full`; every response 200. The previous deployment (`dpl_9nzY…`, `14eaf051`) logs the same warning (4 of 4 error-level records), and `pg` did not change in this release: pre-existing, recorded as SH1-PG-SSLMODE-1 |
| Scheduled crons | the three ingresses ran at 09:00Z and 10:00Z with the real bearer, each 200 |

**Authenticated use.** The Director reported that `/heby` loads an existing conversation and still works
after a refresh, and that `/approvals` and `/director/work` open and work. The logs place those visits:
`POST /login` 200 (10:57:28Z) and `POST /login/select-workspace` 200 (10:57:32Z); then protected pages
answering **200** — which they answer only to a session, as the signed-out smoke's 307 shows — `/heby`,
`/approvals`, `/command`, `/governance`, `/knowledge`, `/workforce`, `/director/governance/security`
(10:57–10:58Z) and, at 11:08Z, `/approvals`, `/command`, `/director`, `/director/work`,
`/director/organization`, `/director/reports`, `/agents` and others; and `POST /heby` ×3, 200
(10:58:09–15Z). Signed-out smoke rechecked at 10:54:28Z: unchanged from section 4.

**Server Actions — what is and is not verified.**

- **Sign-in action: VERIFIED by its effect.** The session that made protected pages answer 200 can only be
  created by the sign-in and workspace-selection actions those two POSTs carried.
- **Heby actions: NOT VERIFIED.** `POST /heby` ×3 returned 200 and coincide with the conversation the
  Director saw load, but logs name neither the action nor its outcome, and a POST to an App Router page
  answers 200 without running an action (a scanner's `POST /login` at 09:07:20Z did). Corroborated, not
  proven.
- Not covered by this acceptance: runtime behaviour outside the observed window, any other subsystem's own
  acceptance, and the dependency advisories still open below.

## Closure Contract (v1)

- Phase: SECURITY-HARDENING-1
- Owner: apps/dashboard/package.json and apps/dashboard/package-lock.json (the Next.js framework dependency)
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: a6ba1dae
- Verification level: V3 — a framework upgrade under every server seam (Server Actions, middleware, route handlers, rendering) and a production release; full suite run for that reason
- Verification evidence: clean npm ci; tsc 0; eslint 0 errors / 24 warnings identical to baseline; next build green 175 pages, 156 routes same set; full suite 1067 PASS / 2 FAIL of 1069 (r3w ambient-database-safety BLOCKED as baseline; trh25-observation-trigger bite-proofs race-test flake, rerun 5/5 and 11 bit) — 0 REGRESSION; development continuity PASS; npm audit --omit=dev critical 1 → 0; differential HTTP smoke 21/21 identical; git diff --check clean
- Test environment: worktrees `.claude/worktrees/security-hardening-1` (candidate) and `.claude/worktrees/sh1-baseline-14eaf051` (detached baseline build); macOS (Darwin 25.2.0); Node 24.16.0, npm 11.17.0; PostgreSQL 18 at 127.0.0.1:5432 via HEBUN_TEST_ADMIN_DATABASE_URL (disposable databases); no provider, no model
- Deployment evidence: dpl_E4GpHBnQGWZjSbSd8t5sKnta8iyo at a6ba1dae — GitHub Vercel commit status success 2026-10-22T08:38:17Z and GitHub deployment 7247654518 (Production, success); served on www.hebuntech.com (HTML deployment marker), client chunk version 16.3.8, apex 308 → www, signed-out smoke as section 4; Vercel deployment record read directly — readyState READY, target production, githubCommitSha a6ba1dae, ready 2026-10-22T08:38:16.843Z, aliased to both production domains (section 6)
- Production acceptance evidence: complete production runtime-log window 2026-10-22 08:38:17Z–11:09:24Z for dpl_E4GpHBnQ… (310 records, paged and de-duplicated): HTTP 5xx 0 (also 0 by server-side filter with a working control), fatal 0, 10 error-level records all the pre-existing pg sslmode deprecation warning with 200 responses; the three crons 200 at 09:00Z and 10:00Z; signed-out security smoke unchanged; Director-authenticated observations (Heby conversation load and refresh, Approvals, Director Work) placed in the logs as 200s on protected pages after POST /login and /login/select-workspace 200; sign-in Server Action verified by its effect; Heby Server Action outcomes NOT VERIFIED (section 6)
- Deferred risks: SH1-PROD-ACCEPTANCE-1 (CLOSED); SH1-RUNTIME-LOGS-1 (CLOSED); SH1-APP-SHARP-1 (DEFERRED); SH1-LEGACY-PROJECT-1 (DEFERRED); SH1-BUILD-TOOL-ADVISORIES-1 (DEFERRED); SH1-TRH25-RACE-TEST-1 (DEFERRED); SH1-PG-SSLMODE-1 (DEFERRED)
- Director approvals: isolated local implementation and verification (2026-10-22); one local commit and release preflight (2026-10-22); production release of exactly a6ba1dae over expected baseline 14eaf051 (2026-10-22); documentation-only closure and one local commit (2026-10-22); push of this record NOT approved; no rollback, legacy-project change, migration, provider call or secret access approved at that point; read-only legacy investigation and pre-pause gate (2026-10-22); reversible pause of `hebun-ai` only, no deletion (2026-10-22); documentation of the pause and one local commit (2026-10-22), push NOT approved; legacy deletion, resume and legacy database actions NOT approved; read-only acceptance verification and the Director's own authenticated observations (2026-10-22); Director decision SECURITY-HARDENING-1 PRODUCTION-ACCEPTED, covering the security release only, and documentation-only closure with one local commit (2026-10-22), push NOT approved

### Deferred risk detail

- **SH1-PROD-ACCEPTANCE-1 (CLOSED).** Needed the deployment's runtime logs read clean and one
  Director-authenticated production read through a Server Action surface, with no synthetic data. Closed
  2026-10-22 by section 6: complete log window with 0 5xx and 0 fatal, and the Director's authenticated
  observations placed in the logs. The Heby Server Action outcomes remain NOT VERIFIED and are not claimed.
- **SH1-RUNTIME-LOGS-1 (CLOSED).** At release time the read-only `vercel ls` was denied by the permission
  classifier and the Vercel connector had no access to this team. Later read-only CLI reads (`vercel api`
  GET, `vercel logs`) were permitted; closed 2026-10-22 by the direct deployment record and the complete
  log window in section 6.
- **SH1-PG-SSLMODE-1 (DEFERRED).** Production logs the `pg` warning that SSL modes `prefer`, `require` and
  `verify-ca` are aliases for `verify-full`, so production's connection string does not yet say
  `verify-full`. Today this is full verification (`pg` 8.22.0 overrides no TLS option for these modes);
  `pg` v9 will give `require` libpq semantics, encrypted without certificate verification. The hosted
  infrastructure record (`hebun-hosted-infrastructure-closure.md`, "TLS: `require` normalized to
  `verify-full`") normalized only the ignored local secret file. Closes by normalizing the production
  `DATABASE_URL` to `sslmode=verify-full` — a production environment change and its own Director gate —
  before any `pg` v9 upgrade; the warning disappearing from production logs is the check.
- **SH1-APP-SHARP-1 (DEFERRED).** The app's own `sharp` 0.34.5 carries high advisories inherited from
  libvips, libheif and librsvg. Its input is governed, admitted, signature-checked PNG/JPEG/WebP only, so
  the HEIF and SVG paths are unreachable; generic libvips exposure for those formats is not measured. The
  fix (0.35.5) is semver-major and must prove the JPEG publish derivative stays byte-deterministic.
- **SH1-LEGACY-PROJECT-1 (DEFERRED).** The legacy Vercel project `hebun-ai` (Next.js 16.2.7, next-auth
  beta, Prisma) served a public `/login` and `/register` at `hebun-ai.vercel.app` from a 2026-06-18
  production deployment carrying the same Next.js advisories. **PAUSED 2026-10-22T10:23:56Z** (section 5):
  all three aliases answer 503 `DEPLOYMENT_PAUSED`, nothing deleted, production isolation verified. The
  public exposure is contained; the risk stays DEFERRED because what remains open is not reachable by a
  pause: the legacy database's identity and contents (possibly personal data), provider-side webhook
  registrations, and the Director's later choice between keeping it paused, deleting the project, and
  what happens to its data.
- **SH1-BUILD-TOOL-ADVISORIES-1 (DEFERRED).** `nanoid`, `source-map-js` and `baseline-browser-mapping`
  remain in the production audit as build-time tooling, and the eslint and drizzle-kit chains in the dev
  audit. None runs in a request path. The next routine dependency update.
- **SH1-TRH25-RACE-TEST-1 (DEFERRED).** `tests/trh25-observation-trigger/trigger-postgres.ts` asserts the
  losing concurrent scan reads `refused` or `duplicate-suppressed`; `not-due` (the loser reads after the
  winner commits) is equally correct and fails the test, which surfaced as a bite-proof failure under
  full-suite load. A test-only correction, owned by TRH-25.
