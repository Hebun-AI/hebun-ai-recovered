# V1-STAGE-5 — Customer Ops: Support Tickets

Hebun AI v1.0, Stage 5 (Director authorization, 2026-11-09). `/tickets` (sidebar "Ticket Center")
was a legacy mock (UI Phase 25C). It now holds real, tenant-scoped support tickets:

- **Any member** of an organization files a ticket by hand (title, description) and sees every ticket
  of their own organization, newest first, with status and filed/updated times (UTC).
- **The organization's Governance authority** changes a ticket's status: Open, In progress, Waiting on
  customer, Resolved, Closed. Others are told status is changed by the Governance authority.
- **Every state change is audited**: one `audit_log` row per creation and per status change, in the
  same transaction, carrying status and version (from → to) and never the title or description.

## Scope boundaries held

- No email ingestion, no Instagram DM ingestion, no external automation. The ticket module imports no
  mail, DM, webhook, provider or action-inlet code (firewall).
- No new authorization system: the status gate is the released `resolveGovernanceAuthority`; filing
  and reading require the session's authenticated tenant context.
- `features/tickets/mock.ts` is retained (Phase 25D pins it); the page no longer reads it.

## What it adds

- **Migration 85** `20261109142723_v1_support_tickets`: `support_tickets` (tenant FK, title 1–200,
  description 1–5000, status CHECK over the five values, version ≥ 1, created/updated by and at,
  index on tenant + created_at). Additive; no backfill.
- `features/support-tickets` (contracts, read and two writers), the audit sibling
  `governance-audit/support-ticket-audit.server.ts` (shared sink), `tickets/actions.ts` (two server
  actions; tenant and actor from the session only), client forms, the rewritten page.
- Status change: row lock (`FOR UPDATE`) on `tenant_id + id`, optimistic on the version the human saw,
  `unchanged` refused without an audit row.

## What is proven

- `tests/v1-support-tickets/tickets-postgres.ts` T1–T5 on a disposable PG 18 cluster:
  - a plain member files for their own tenant; one audit row with no ticket text; seven invalid
    inputs refused;
  - each tenant reads only its own tickets; the authority flag is true only for the Governance
    authority;
  - status: a member and an organization without Governance are refused; stale version, unchanged
    and unknown status refused; every change and only those are audited from → to;
  - a forged context mixing Acme's authority with Globex's tenant reads only Globex rows, and Acme's
    authority cannot change Globex's ticket (`not-found`, row untouched);
  - the schema refuses an unknown status and an empty title from any writer.
- `tests/v1-support-tickets/firewall-and-render.ts`: writes only its own table and the shared audit
  sink; no ticket text in the audit sibling; the session tenant in read, lock, update and insert;
  Governance-gated status; no channel imports; two actions taking no tenant or user; input rules;
  forms render identically in three zones.
- Mutations Z1–Z7, all killed: read without tenant predicate (T2), lock without tenant predicate (T4),
  no authority check, authority always true, status change unaudited, no version check, unchanged
  audited (T3).
- Migration pin sweep: ledger 84 → 85 in the count pins, the new tag appended to every later-phase
  list, the three bite-proof journal tails, the newest-line pins (where the old tag was the EXPECTED
  value: trh19, canonical-prefix, content-intake), release digest 8ec82780… → 7630db74… (the first 84
  files still digest to 8ec82780…), the canonical-prefix probe follows `support_tickets`, server-action
  census (7 suites), audit-owner census (g1, g2, k2), and Phase 25C/25D now assert `/tickets` reads real
  tickets instead of carrying the legacy notice.
- 221 possibly-affected suites (every changed test plus every suite that reads the migration ledger, journal, schema index, server-action modules or walks `src`): 219 passed on the first run. Two failed: `truth1-organizational-fiction` still required the legacy notice on `/tickets` — updated to require the real seam and forbid the mock, now PASS; `r3w-flow/ambient-database-safety` is BLOCKED by environment (it needs the canonical `hebun_r1` at :55432, which this session did not run) and fails identically on the unchanged tree.
- `tsc` 0, `eslint` 0 on changed files. `next build` succeeds with `/tickets` and `/account/plan`.

## What is not proven

- No signed-in browser render; nothing deployed; migration 85 not applied to production.
- No assignment, comments, attachments, customer contact fields or SLA. Not asked for in the approved
  scope; the old mock's columns were illustrative.
- The list shows the newest 200 tickets; paging is not built.

## Closure Contract (v1)

- Phase: V1-STAGE-5
- Owner: apps/dashboard/src/features/support-tickets, src/features/governance-audit/support-ticket-audit.server.ts, src/db/schema/support-ticket.ts and migration 20261109142723_v1_support_tickets, /tickets page and src/app/(dashboard)/tickets/actions.ts, src/components/support-tickets
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — new schema/migration, tenant isolation and an authorization gate; full suite justified once on the release candidate, not per commit
- Verification evidence: tickets-postgres T1–T5 PASS; firewall-and-render PASS; mutations 7/7 killed; 221 affected suites: 219 first run, truth1 pin updated and PASS, r3w ambient-database-safety BLOCKED by environment (same on unchanged tree); next build success; tsc 0, eslint 0
- Test environment: worktree feat/v1-content-calendar in the session scratchpad on 9dc49b50, macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18 at 127.0.0.1:55442 created by this session (system_identifier proven); synthetic identities only
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; migration 85 not applied in production
- Deferred risks: V1S5-BROWSER-UNVERIFIED-1 (DEFERRED); V1S5-PROD-MIGRATION-85-1 (DEFERRED)
- Director approvals: V1.0 CONTINUOUS DEVELOPMENT — Stage 6 + Stage 5 local implementation with local commits, 2026-11-09; push, PR, merge, deployment, production migration NOT approved

### Deferred risk detail

- **V1S5-BROWSER-UNVERIFIED-1 (DEFERRED).** `/tickets` is proven by Postgres and render tests, not by a
  signed-in browser. Acceptance dependency: after release, a member files a ticket and the Governance
  authority changes its status, both signed in.
- **V1S5-PROD-MIGRATION-85-1 (DEFERRED).** `support_tickets` exists only after migration 85 runs
  through the production migration ceremony. Until then a deployed `/tickets` reads `unavailable`.
  Acceptance dependency: Director-gated production migration, ledger 85 verified.

## Weekly three questions

1. **What did we learn?** A migration's pin sweep is mechanical except where the old tag is an
   expected value; a script that appends to lists will silently turn those into extra arguments.
2. **How does this improve Turkish Rug House?** TRH staff can record a customer problem (a late rug, a
   damaged delivery) in one shared place and the owner can move it to resolved, with a history of who
   changed what.
3. **How does this become part of Hebun AI?** Every tenant gets a governed support ticket register on
   the released audit sink and Governance gate. Email and DM ingestion can later write into the same
   table through their own gated seams.
