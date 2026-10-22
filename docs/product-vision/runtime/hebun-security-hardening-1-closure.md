# SECURITY-HARDENING-1 · Next.js security release · closure record · DEPLOYED

Next.js moved from 16.2.10 to 16.3.8 in production. The release changes two package files and nothing
else. Deployment identity is corroborated from GitHub and from the served page; direct Vercel inspection
and runtime logs were not available to this session, so this record stops at `DEPLOYED` and does not
claim `PRODUCTION-ACCEPTED`.

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
| Not measured | direct Vercel inspection of the deployment's READY state (the read-only `vercel ls` was denied by the session's permission classifier; the Vercel connector returned 403 for this team scope) and the deployment's runtime / error / 5xx logs — **UNAVAILABLE**, never counted as a pass |

**What the identity chain proves, and what it does not.** The GitHub deployment status ties `a6ba1dae`
to `E4GpHBnQ…`, and the served HTML names the same deployment, so the release SHA is serving production
traffic. It is corroboration from two independent surfaces, not a reading of Vercel's own deployment
record, and it says nothing about runtime errors.

Rollback: promote `dpl_9nzYSvvxHwXXtgVYgWMbHvUHwwer` (`14eaf051`). No migration is involved;
RELEASE-ROLLBACK-FLOOR-1 (`a27e5ad4`) and the PSI1 floor are older and unaffected. No rollback was made.

## Closure Contract (v1)

- Phase: SECURITY-HARDENING-1
- Owner: apps/dashboard/package.json and apps/dashboard/package-lock.json (the Next.js framework dependency)
- Reached state: DEPLOYED
- Implementation commit: a6ba1dae
- Verification level: V3 — a framework upgrade under every server seam (Server Actions, middleware, route handlers, rendering) and a production release; full suite run for that reason
- Verification evidence: clean npm ci; tsc 0; eslint 0 errors / 24 warnings identical to baseline; next build green 175 pages, 156 routes same set; full suite 1067 PASS / 2 FAIL of 1069 (r3w ambient-database-safety BLOCKED as baseline; trh25-observation-trigger bite-proofs race-test flake, rerun 5/5 and 11 bit) — 0 REGRESSION; development continuity PASS; npm audit --omit=dev critical 1 → 0; differential HTTP smoke 21/21 identical; git diff --check clean
- Test environment: worktrees `.claude/worktrees/security-hardening-1` (candidate) and `.claude/worktrees/sh1-baseline-14eaf051` (detached baseline build); macOS (Darwin 25.2.0); Node 24.16.0, npm 11.17.0; PostgreSQL 18 at 127.0.0.1:5432 via HEBUN_TEST_ADMIN_DATABASE_URL (disposable databases); no provider, no model
- Deployment evidence: dpl_E4GpHBnQGWZjSbSd8t5sKnta8iyo at a6ba1dae — GitHub Vercel commit status success 2026-10-22T08:38:17Z and GitHub deployment 7247654518 (Production, success); served on www.hebuntech.com (HTML deployment marker), client chunk version 16.3.8, apex 308 → www, signed-out smoke as section 4; direct Vercel READY inspection and runtime logs UNAVAILABLE
- Production acceptance evidence: N/A — PENDING: deployment and runtime logs not inspected and no signed-in production read of a Server Action surface; see SH1-PROD-ACCEPTANCE-1
- Deferred risks: SH1-PROD-ACCEPTANCE-1 (DEFERRED); SH1-RUNTIME-LOGS-1 (DEFERRED); SH1-APP-SHARP-1 (DEFERRED); SH1-LEGACY-PROJECT-1 (DEFERRED); SH1-BUILD-TOOL-ADVISORIES-1 (DEFERRED); SH1-TRH25-RACE-TEST-1 (DEFERRED)
- Director approvals: isolated local implementation and verification (2026-10-22); one local commit and release preflight (2026-10-22); production release of exactly a6ba1dae over expected baseline 14eaf051 (2026-10-22); documentation-only closure and one local commit (2026-10-22); push of this record NOT approved; no rollback, legacy-project change, migration, provider call or secret access approved

### Deferred risk detail

- **SH1-PROD-ACCEPTANCE-1 (DEFERRED).** `PRODUCTION-ACCEPTED` needs the deployment's runtime logs read
  clean (no error, fatal or 5xx since 08:38Z attributable to the release) and one Director-authenticated
  production read through a Server Action surface (for example `/heby` loading a conversation). No
  synthetic data.
- **SH1-RUNTIME-LOGS-1 (DEFERRED).** This session could not read Vercel: the read-only CLI call was denied
  by the permission classifier and the connector has no access to team `hebuntechs-projects`. Closes when
  the Director reads the logs in the Vercel dashboard, or grants a scoped read-only rule or connector
  access and the logs are read.
- **SH1-APP-SHARP-1 (DEFERRED).** The app's own `sharp` 0.34.5 carries high advisories inherited from
  libvips, libheif and librsvg. Its input is governed, admitted, signature-checked PNG/JPEG/WebP only, so
  the HEIF and SVG paths are unreachable; generic libvips exposure for those formats is not measured. The
  fix (0.35.5) is semver-major and must prove the JPEG publish derivative stays byte-deterministic.
- **SH1-LEGACY-PROJECT-1 (DEFERRED).** The legacy Vercel project `hebun-ai` (Next.js 16.2.7, next-auth
  beta, Prisma) still serves a public `/login` at `hebun-ai.vercel.app` from a 2026-06-18 production
  deployment and carries the same Next.js advisories. A Director decision: inventory its environment by
  name, then pause (reversible) or remove.
- **SH1-BUILD-TOOL-ADVISORIES-1 (DEFERRED).** `nanoid`, `source-map-js` and `baseline-browser-mapping`
  remain in the production audit as build-time tooling, and the eslint and drizzle-kit chains in the dev
  audit. None runs in a request path. The next routine dependency update.
- **SH1-TRH25-RACE-TEST-1 (DEFERRED).** `tests/trh25-observation-trigger/trigger-postgres.ts` asserts the
  losing concurrent scan reads `refused` or `duplicate-suppressed`; `not-due` (the loser reads after the
  winner commits) is equally correct and fails the test, which surfaced as a bite-proof failure under
  full-suite load. A test-only correction, owned by TRH-25.
