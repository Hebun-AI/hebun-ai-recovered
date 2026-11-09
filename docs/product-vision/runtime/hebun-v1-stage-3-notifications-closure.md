# V1-STAGE-3 — In-app Notifications

Hebun AI v1.0, Stage 3 (Director authorization, 2026-11-09). The top-bar bell, a disabled
"coming soon" placeholder until now, links to a new page, `/notifications`.

## What it shows

For the organization's **Governance authority** (the released resolver), recomputed on every request:

- **Requests waiting for your decision** — `heby_action_requests` pending, from the released E2-4
  aggregate (count and oldest filed instant; unbounded, in the database).
- **Publication attempts that did not go out** — Instagram/YouTube `action_execution_attempts`
  ending `failed` or `refused` in the last 7 days.
- **Publication attempts with an unknown outcome** — `unknown`, or `pending` past the declared
  execution window (`EXECUTION_IN_FLIGHT_WINDOW_MS`), whatever their age.
- **Other actions that failed / have an unknown outcome** — the same split for every other kind.

Each item carries a kind, a count, one instant and a link to `/approvals`, which already holds the
detail (decision workspace and execution ledger). Every other member is told notifications go to the
Governance authority. An empty list reads "Nothing needs your attention".

## What it is not

- **Stateless.** No table, no migration, no read/unread state. A notification disappears when its
  source fact does (decided, reconciled, or older than the 7-day failure window). Read/unread
  persistence was not built: it would need a new table and nothing yet requires it.
- **Not delivered anywhere.** No email, no Resend, no webhook, no worker, timer or polling.
- **Not a second source of truth.** One aggregate statement over `action_execution_attempts`
  (tenant predicate, grouped by publication/other × failed/unknown) plus the released E2-4 reader.
- **No sensitive content.** No title, payload, target, recipient, provider message id, failure
  class or attempt id is selected or returned.
- **No mock data.** The page and module import no mock.

## What is proven

- `tests/v1-notifications/notifications-postgres.ts` N1–N5 on a disposable PG 18 cluster:
  - the authority sees exactly 2 pending requests, 2 failed publications (an 8-day-old failure and
    an accepted attempt excluded), 1 unknown publication (30 days old), 1 failed action and 1 stale
    pending action (a 10-second-old pending excluded);
  - the read carries no title, payload, provider id, tenant/user id, failure class or action kind;
  - a member, a tenant without Governance and an absent session are not addressed;
  - once Globex establishes Governance it sees only its own figures; a context mixing Acme's
    authority with Globex's tenant is not addressed;
  - reads write nothing.
- `tests/v1-notifications/firewall.ts`: no write, channel, mock, timer or worker; imports only the
  released readers and constants; tenant predicate and authority gate present; no identifying column
  selected; the page takes nothing from the URL; the bell is a link and the placeholder is gone.
- Mutations X1–X5, all killed: attempts without tenant predicate, failure window removed, in-flight
  pending counted, no authority gate, publication split lost.
- 284 possibly-affected suites (every suite reading the top bar, the E2-4 aggregate, the publish or
  execution contracts, the Governance resolver, or walking `src`/routes): 284 PASS. Route count
  135 → 136.
- `tsc` 0, `eslint` 0, `next build` succeeds with `/notifications`.

## What is not proven

- No signed-in browser render; nothing deployed.
- No unread badge on the bell: the count would need a read in the shared layout on every page.

## Closure Contract (v1)

- Phase: V1-STAGE-3
- Owner: apps/dashboard/src/features/notifications, /notifications page, the top-bar bell link in src/components/layout/topbar.tsx
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — read-only projection across the action-request and execution-attempt seams with an authority gate and tenant isolation proven in Postgres; no write, no schema; full suite deferred to the release candidate
- Verification evidence: notifications-postgres N1–N5 PASS; firewall PASS; mutations 5/5 killed; 284/284 affected suites PASS; tsc 0, eslint 0, next build success
- Test environment: worktree feat/v1-content-calendar in the session scratchpad on 307e8e93, macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18 at 127.0.0.1:55442 created by this session (system_identifier proven); synthetic identities only
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: V1S3-BROWSER-UNVERIFIED-1 (DEFERRED)
- Director approvals: V1.0 DEVELOPMENT CONTINUATION — Stage 3 local implementation with local commits, 2026-11-09; push, PR, merge, deployment NOT approved

### Deferred risk detail

- **V1S3-BROWSER-UNVERIFIED-1 (DEFERRED).** `/notifications` is proven by Postgres and firewall
  tests, not by a signed-in browser. Acceptance dependency: a signed-in read-only render by the
  Governance authority and by a plain member after release.

## Weekly three questions

1. **What did we learn?** A stateless notification needs two clocks: terminal failures expire after
   a window, but an unreconciled act must stay visible whatever its age.
2. **How does this improve Turkish Rug House?** TRH's owner sees in one place that a request is
   waiting or that an Instagram or YouTube publication did not go out, and is sent to where to act.
3. **How does this become part of Hebun AI?** Every tenant gets an attention center derived from
   the authoritative ledgers; email delivery can later read the same projection without changing it.
