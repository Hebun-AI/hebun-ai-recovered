# V1-STAGE-6 — Plan & Usage

Hebun AI v1.0, Stage 6 (Director authorization, 2026-11-09). A new read-only page, `/account/plan`,
reached from the account menu ("Plan & usage"). Every member of an organization sees:

- **Plan.** The organization's `companies.plan`, as recorded. No price, invoice, amount due, payment,
  subscription or plan change exists in Hebun, so none is shown or offered.
- **Today's AI limits.** For each AP-3 dispatch class (model requests; image and video generations):
  admissions used today and the daily limit. "Used today" is **measured**: counted from durable rows
  by the cap's own counter (`admittedInWindow`), the same count that refuses the next dispatch. The
  period (one UTC day, start and end) is printed. A limit of 0 reads "turned off".
- **Recorded AI usage.** The released R2F.1 card: provider-reported tokens, a stated lower bound,
  half-reported calls counted apart, all history plus the recent UTC days.
- **Freshness.** The page prints the instant it was read (UTC). It is server-rendered per request.

There are no estimates on the page. Every figure is either measured (dispatch admissions) or a
stated lower bound (recorded tokens).

## What it adds

- `readAiDispatchUsageToday` in the AP-3 cap module: today's admitted count and resolved cap per
  class, read only — no advisory lock, no transaction, no charge. A snapshot that may be one
  admission behind a concurrent dispatch.
- `features/plan-usage/plan-usage.server.ts`: reads the plan through the session's own membership
  (membership id, tenant and user all in the WHERE), then the two usage reads.
- The page and one account-menu link. **No migration, no server action, no write.**
- AP-3 firewall: the module census now names the plan-usage reader, and a new assertion keeps
  `admitAiDispatch` named only by the generator and the two media writers.

## What is proven

- `tests/v1-plan-usage/plan-usage-postgres.ts` U1–U4 on a disposable PG 18 cluster:
  - own plan; today's model admissions (yesterday's row and the other tenant's rows excluded); the
    deployment cap as resolved; recorded tokens from live rows only, half-reported row apart;
  - the other tenant sees only its own figures;
  - a forged context mixing tenants, an absent session and absent storage read nothing;
  - the read writes nothing (row counts unchanged).
- `tests/v1-plan-usage/firewall.ts`: no write, action or form; no money or plan-change vocabulary;
  the plan read is session-keyed; the page takes nothing from the URL; the reader uses the cap's
  own counter and takes no lock.
- Mutations, all killed: plan read without the tenant predicate (U3), window widened by one second
  (U1), cap ignoring the deployment setting (U1), media counted as model (U1).
- AP-3 suites (firewall, bite-proofs, config, cap-postgres) and the route-count census (134 → 135)
  pass. 230 of 231 static censuses that read `src/app`, the account menu or the usage seams passed;
  the one failure, `instagram-oauth-admission/ceremony-firewall`, was red before this change (a
  Stage 2 migration missing from its census) and was fixed in its own commit, 7ec25298.
- `tsc` 0, `eslint` 0 on changed files.

## What is not proven

- No signed-in browser render; nothing deployed.
- `companies.plan` is free text with default `free`; the page shows it verbatim. Plan names and what
  each plan includes are a product decision not made here.

## Closure Contract (v1)

- Phase: V1-STAGE-6
- Owner: apps/dashboard/src/features/plan-usage, readAiDispatchUsageToday in src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts, /account/plan page, account-menu link
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — read-only seam across the AP-3 cap and R2F.1 usage, tenant isolation proven in Postgres; no write, no schema; full suite deferred to the release candidate
- Verification evidence: plan-usage-postgres U1–U4 PASS; firewall PASS; mutations 4/4 killed; AP-3 suites PASS; 230/231 static censuses, 1 pre-existing red fixed in 7ec25298; tsc 0, eslint 0
- Test environment: worktree feat/v1-content-calendar in the session scratchpad on 7ec25298, macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18 at 127.0.0.1:55442 created by this session (system_identifier proven); synthetic identities only
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: V1S6-BROWSER-UNVERIFIED-1 (DEFERRED)
- Director approvals: V1.0 CONTINUOUS DEVELOPMENT — Stage 6 + Stage 5 local implementation with local commits, 2026-11-09; push, PR, merge, deployment NOT approved

### Deferred risk detail

- **V1S6-BROWSER-UNVERIFIED-1 (DEFERRED).** `/account/plan` is proven by Postgres and firewall tests,
  not by a signed-in browser. Acceptance dependency: a signed-in read-only render after release.

## Weekly three questions

1. **What did we learn?** A usage page can be honest without a billing system: show the count the
   limit actually enforces, from the enforcer's own counter, and label the token total as a floor.
2. **How does this improve Turkish Rug House?** TRH can see how close it is to today's AI limits
   before Heby or media generation refuses, and what AI usage has been recorded.
3. **How does this become part of Hebun AI?** Every tenant gets a plan and usage page on released
   seams; when pricing exists, it attaches to these measured figures rather than inventing new ones.
