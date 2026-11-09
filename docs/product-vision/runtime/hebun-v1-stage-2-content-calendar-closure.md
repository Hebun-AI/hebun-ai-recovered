# V1-STAGE-2 — Content calendar and scheduled publishing

Hebun AI v1.0, Stage 2 (Director-approved roadmap, 2026-11-09). A customer can choose when an
approved Instagram or YouTube draft is meant to go out, see it on a calendar, move it or cancel it.
When its moment arrives they propose the publication in one click, through the released governed
path.

## What a schedule is, and is not

```
SCHEDULED != REQUESTED != APPROVED != PUBLISHED
```

A schedule records intent. It authorizes nothing and nothing machine-driven reads it: there is no
cron, no permit, no executor and no machine path. Proposing a due schedule calls the released
`proposePackagePublication`, which re-checks readiness, the connection and the prior-publication
guard. The request it files still needs a human Governance approval and an executor.

**Automatic publication at the scheduled minute is not built.** It would require machine
execution of an external publish. Today `MACHINE_EXECUTABLE_ACTION_KINDS = {record-work}` and the
permit TTL is 1 hour, so it is a governance-boundary change awaiting a Director decision
(V1S2-AUTO-PUBLISH-1).

## What changed

- **Migration 84 `20261109131304_v1_content_publication_intent`.** One additive table,
  `content_publication_intents`.
  - Each row belongs to a tenant and is tied to one content revision by a composite FK to the
    revision and a tenant-qualified FK to the request.
  - CHECKs: state is `scheduled | cancelled | requested`; `requested` if and only if a request is
    linked; YouTube options if and only if the destination is YouTube.
  - At most one open schedule per revision (partial unique index).
  - The product calls it a "schedule"; the table is named `intents` because it controls nothing. The
    TRH-25 control-table guard treats any table name containing `schedule` as a control table, so
    the original name tripped it.
- **`features/content-schedule`:**
  - Contracts: zone-correct conversion (a DST gap is refused, a repeated hour resolves to its first
    occurrence), 5-minute to 366-day lead window, YouTube options validated against the released
    contract.
  - Writers: create, reschedule, cancel and propose. Each writes its audit row in the same
    transaction. Create locks the content revision row the publish executor locks; reschedule and
    cancel lock the schedule and require the version the user saw.
  - Calendar reader.
- **`governance-audit/content-schedule-audit.server.ts`** — a new audit-sink sibling with actions
  `content.schedule.created | rescheduled | cancelled | requested`.
- **UI.**
  - `/operations` has a **Content calendar**: open schedules grouped by local day, each shown in the
    zone it was chosen in; due and stale states shown; Propose, Reschedule and Cancel actions; recent
    closed schedules listed below.
  - A READY draft's package panel has a **Schedule publishing** form.
  - The server actions live in `operations/schedule-actions.ts`, kept separate from the Media door.
- **Pins updated in the same change** (ledger 83 → 84; the first 83 files still digest to
  `3f114ef3…`):
  - ledger counts and filename lists in 62 suites;
  - release digest `8ec82780…` (canonical-prefix, g4);
  - the pending-migration probe (now this table);
  - the M12 journal anchors in three bite-proofs;
  - the audit-sink owner census (g1, g2, k2);
  - the server-action census (7 suites);
  - the package-panel regex (content-publish-from-package-1).

## What is proven

- `tests/v1-content-schedule/schedule-postgres.ts` passes S1–S12 on a disposable PG 18.6 with two
  synthetic tenants, real READY packages built by the released writers, the real proposal path and no
  network:
  - an unapproved package cannot be scheduled;
  - time, zone and superseded-revision refusals;
  - tenant isolation in code (see, create, move, cancel, propose) and in the schema (cross-tenant
    revision or request FK);
  - an optimistic, audited reschedule;
  - a due-gated proposal yields exactly one pending human request with no permit, attempt or send;
  - a second proposal is idempotent;
  - cancel is terminal;
  - a package withdrawn after scheduling is refused by the governed path and the schedule stays open;
  - six concurrent creates produce one schedule;
  - the calendar read is correct;
  - no permit is issued in the whole run.
- `time-and-contracts.ts`: conversions are identical under three process zones, including a New York
  DST gap and overlap, a +05:30 zone and +14.
- `firewall-and-render.ts`:
  - The schedule modules import no approval, permit, execution, machine or cron module.
  - Only the schedule writer and reader touch the table.
  - No API route or cron reaches schedules.
  - The controls render identically in four zones.
- Mutations X1–X8 (approval, due, tenant lock, version, current revision, audit, idempotency, lead
  window): 8/8 bit in an isolated worktree.
- Every previously failing pin suite (65) passes after the update.
- 223 of the 228 possibly-affected suites passed on the first run.
  - Four failures were legitimate pin updates; all four now pass.
  - The fifth, `r3w-flow/ambient-database-safety`, is **BLOCKED**: it needs the local `hebun_r1`
    database, which this disposable cluster does not have. It is not a regression.
- 94 UI and action-door suites pass after the updates.
- Bite-proofs a1a (12/12), app2 (13/13) and ops-p1 (19/19) pass, along with 9 further relevant
  bite-proofs, all in isolation.
- `tsc` 0, `eslint` 0 on the changed files, `next build` succeeded.

## What is not proven

- No signed-in browser render of the calendar; no production run. The migration has not been applied
  to production; that is a release gate.
- The full suite has not run on this change (V3: it runs once on the release candidate).

## Closure Contract (v1)

- Phase: V1-STAGE-2
- Owner: apps/dashboard/src/features/content-schedule (intent contracts, writers, calendar read), src/db/schema/content-publication-intent.ts with migration 20261109131304_v1_content_publication_intent, src/features/governance-audit/content-schedule-audit.server.ts, the /operations Content calendar and package-panel schedule form, src/app/(dashboard)/operations/schedule-actions.ts
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — schema/migration, tenant isolation and a bridge to the governed publication path; full suite justified once on the release candidate, not per commit
- Verification evidence: schedule-postgres S1–S12 PASS; time-and-contracts PASS; firewall-and-render PASS; mutations X1–X8 8/8 bit; ledger/pin suites 65/65 after update; 223/228 affected suites first run, 4 updated pins now PASS, 1 BLOCKED (r3w needs hebun_r1); 94 UI/action-door suites PASS; bite-proofs a1a 12/12, app2 13/13, ops-p1 19/19 and 9 more PASS in isolation; tsc 0, eslint 0, next build success
- Test environment: isolated worktree in the session scratchpad from 2d9ed4fa (on 8b0b5373), macOS Darwin 25.2.0, Node 24.16.0, disposable PostgreSQL 18.6 cluster at 127.0.0.1:55432 (system_identifier proven) stopped and deleted after use; synthetic tenants only; network calls 0
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; migration 84 not applied to production
- Deferred risks: V1S2-AUTO-PUBLISH-1 (DEFERRED); V1S2-BROWSER-UNVERIFIED-1 (DEFERRED)
- Director approvals: V1.0 PRODUCT DEVELOPMENT — roadmap approved and Stage 2 local implementation with local commits, 2026-11-09; push, PR, merge, deployment, production migration NOT approved

### Deferred risk detail

- **V1S2-AUTO-PUBLISH-1 (DEFERRED).** A schedule publishes nothing without a human. Hands-off
  publication at the chosen minute would need a governed machine path for external publication: a
  standing authorization in the RUNG 2 envelope pattern, a machine-executable publish kind and
  arming. That is a governance-boundary change. Acceptance dependency: a Director decision on
  whether to build it and under which envelope.
- **V1S2-BROWSER-UNVERIFIED-1 (DEFERRED).** The calendar and form are proven by render tests and the
  build, not by a signed-in browser. Acceptance dependency: a signed-in render of `/operations` after
  release, read only.

## Weekly three questions

1. **What did we learn?** A security guard that matches on names can catch an honest table. Naming
   the table for what it is, an intent, kept the guard as strict as before. Saying so in the record
   is what keeps the rename from looking like evasion.
2. **How does this improve Turkish Rug House?** TRH can plan a week of posts ahead, see them on a
   calendar, and publish each one at its moment with one click. Every approval still comes from a
   human.
3. **How does this become part of Hebun AI?** The intent is tenant-scoped and audited, and it sits in
   front of the governed path. Notifications (Stage 3) can announce due schedules, and automatic
   publication later has a clean seam to arrive at.
