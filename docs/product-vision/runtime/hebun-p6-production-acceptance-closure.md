# P6 — Production acceptance: first sourced 08:00 research report

P6's done-criterion (`docs/HEBUN-AI-MASTER-PLAN-V2.md` P6 §7): research runs every morning at 08:00 for
an authorized tenant and files a sourced report. This record is the production read-back of the
2026-11-20 08:00 Europe/Istanbul run, the first one after the PR #19 fix.

## What failed before, and the fix

The 2026-11-19 run filed a report that ran zero searches and declined the research. Cause, proven:
the sourced research brief was appended to the grounding-only base instruction ("using only the
GROUNDING CONTEXT") while a scheduled run supplies no grounding, so the model declined instead of
searching; the composer then filed the sourceless reply as sourced.

Fix `8b4c316e` (PR #19, merged `d829ce80`):

- a sourced research brief carries `base: "web-research"` and starts from
  `HEBY_WEB_RESEARCH_SYSTEM_INSTRUCTIONS` — search before writing, a missing grounding context is not a
  reason to decline;
- the composer refuses a reply that cites no search result (`no-sources`), mapped to
  `sourced-no-sources` in the run ledger and the run-now surface. A sourceless reply is never filed as
  sourced.

## Production read-back (2026-11-20)

- **Cron ingress.** `vercel logs --environment production` 04:55–05:20 UTC: `GET /api/standing-research/scan`
  200 on `dpl_Ea4gk3g9nBEEzDnrQQxMnQGyMdTf` (branch `main`).
- **Report.** `/operations` → newest research-report "Instagram tanıtımı — mesaj açıları", revision 1,
  written by the organization's durable agent, governance review "Awaiting review". Body:
  `RESEARCH DATE: 2026-11-20 (UTC)`, `SOURCING: SOURCED WEB RESEARCH DRAFT`, `SEARCH QUERIES (3 searches)`,
  `SOURCES` [1]–[6] (agbi.com, unitistanbul.com, fortuneturkey.com, yenisafak.com, dev.to,
  bigpara.hurriyet.com.tr), 15 `[n]` citation marks in the text, uncited results and 6 unverified
  passages disclosed as such.
- **Audit.** `/home` recent activity: `work-artifact.research-report.scheduled-filed` and
  `external-ai.disclosure.authorized` (external-ai-disclosure-decision), both committed at the run time.
- **Not read directly.** The `scheduled_research_runs` row was not queried; its `filed` status is
  inferred from the scheduled-filed audit row and the filed report.

## Closure Contract (v1)

- Phase: P6-PRODUCTION-ACCEPTANCE
- Owner: apps/dashboard/src/features/standing-research-authority/scheduled-research.server.ts (scheduled run), apps/dashboard/src/features/agent-work/sourced-research-report.ts (sourced composer), apps/dashboard/src/features/heby-answer/model-answer.server.ts (web-research base instruction), docs/HEBUN-AI-MASTER-PLAN-V2.md P6 (done-criterion)
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 8b4c316e96678dbe6df90c51c5956428db5fba4a (released on main by merge d829ce80f219675a2ed319efe10af917499e4b78)
- Verification level: V3 — model provider and execution boundary (instruction channel, composer refusal, run ledger reason); full suite ran on the pull request for that reason
- Verification evidence: PR #19 checks on 8b4c316e — quick (3m35s), targeted (54s) and full-suite (59m32s, disposable PostgreSQL) pass; locally 72 affected suites: 62 PASS, 9 BLOCKED (no local PostgreSQL), sci1 pin updated and PASS; tsc, eslint (changed files) and git diff --check exit 0
- Test environment: GitHub Actions with disposable PostgreSQL for the required checks; local worktree for the affected suites
- Deployment evidence: Vercel dpl_Ea4gk3g9nBEEzDnrQQxMnQGyMdTf, production, Ready, GitHub deployment sha d829ce80, aliased to www.hebuntech.com and hebuntech.com, www 200
- Production acceptance evidence: 2026-11-20 05:00 UTC scheduled run — scan 200 on dpl_Ea4gk3g9; research report dated 2026-11-20 filed with 3 web searches and 6 cited sources ([1]–[6], 15 citation marks); audit rows work-artifact.research-report.scheduled-filed and external-ai.disclosure.authorized committed; read back in the signed-in production UI (/operations, /home)
- Deferred risks: P6-4-LIVE-RUN-UNEXERCISED-1 (CLOSED); P6-3-LIVE-SEARCH-UNEXERCISED-1 (CLOSED)
- Director approvals: PR #19 fix and pull request, 2026-11-19; PR #19 merge and production deploy, 2026-11-19; the 2026-11-20 read-back, 2026-11-19; this closure record commit and pull request, 2026-11-20; its merge NOT approved

### Deferred risk detail

- **P6-4-LIVE-RUN-UNEXERCISED-1 (CLOSED).** A scheduled 08:00 run happened in production and filed its
  report, filing audit row and disclosure decision (read-back above). The ledger row itself was not
  queried directly.
- **P6-3-LIVE-SEARCH-UNEXERCISED-1 (CLOSED).** A real web search ran in production on the tenant's own
  key under its grant: 3 searches, 6 cited sources in the filed report, disclosure decision committed.

## Weekly three questions

1. **What did we learn?** An instruction channel can silently contradict a brief: a "grounding only"
   base plus a "go research" brief makes the model decline. The composer must refuse what it cannot
   source rather than label it.
2. **How does this improve Turkish Rug House?** TRH can receive one sourced research report every
   morning on its own key, and a reply without sources is refused instead of filed as research.
3. **How does this become part of Hebun AI?** Every tenant's scheduled research uses the same
   web-research base and the same no-sources refusal; P6's done-criterion is met in production.
