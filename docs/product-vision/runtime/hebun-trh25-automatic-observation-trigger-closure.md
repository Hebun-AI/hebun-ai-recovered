# TRH-25 — Automatic Due-Observation Trigger — PRODUCTION-ACCEPTED

Release `c72d0c0` (the door), `1680ad2` (the hour hand). Acceptance measured at `8fe919f`.

At **2026-09-09T10:00:20.919Z** a scheduler nobody was watching asked Hebun whether anything was
due, an ephemeral machine principal performed one permitted YouTube READ, and Provider Observation
History stored what the provider reported. No human session existed at any point in that chain.

Every fact below was measured read-only against the production control plane and the deployment's
own runtime logs, after the fact, and never from the trigger's own output.

## The four states, kept apart

They are different claims and each was established separately.

| State | Answer | What established it |
|---|---|---|
| **CONFIGURED** | **YES** | `vercel.json` carries exactly one cron; `HEBUN_OBSERVATION_TRIGGER_SECRET` and `CRON_SECRET` both exist in the production environment as `sensitive`. Neither value is in the repository, this document, or any log. |
| **DEPLOYED** | **YES** | `8fe919f` READY since 2026-09-08T22:05:31Z. The cron is REGISTERED, not merely written: `vercel crons ls` returns one job and the project's `crons.definitions` is non-empty with `disabledAt: null`. |
| **PRODUCTION-ACCEPTED** | **YES** | The unattended chain below, end to end, with the delta and the non-effects measured. |
| **COMPLETE** | **not a state this repository has** | Fourteen closure documents end at `PRODUCTION-ACCEPTED` and fifteen at `CLOSED`. The single occurrence of the word `COMPLETE` in the closure corpus qualifies a *revision* in TRH-8, never a phase. Inventing a terminal state to satisfy a question would be the one thing this program does not do, so the honest answer is that TRH-25 reaches the terminal state the convention actually defines, and no further one exists to claim. |

## The unattended chain, gate by gate

| # | Gate | Evidence |
|---|---|---|
| 1 | The scheduler fired on its own | Runtime logs show an unbroken hourly chain — 03:00, 04:00, 05:00, 06:00, 07:00, 08:00, 09:00, 10:00 — each at `:00:18`. `vercel crons run` was never invoked. |
| 2 | It called the right endpoint | `GET /api/observation/scan`, the deployment's only machine ingress. |
| 3 | Authentication succeeded | The route reached the database and wrote a row. A failed bearer returns 401 before any read, so neither could have happened. |
| 4 | The operator's stop permitted it | `provider-observation-read` enabled, `control_source = production-operator-ceremony`, `updated_at 2026-09-08T12:30:43Z` — armed BEFORE the read — and still `version 1` afterwards: the observation did not touch the switch. |
| 5 | The provider runtime actually ran | Cron at `10:00:18.229Z`, `observed_at` at `10:00:20.919Z` — 2.7 seconds later. |
| 6 | A real provider interaction occurred | `quotaUnitsSpent: 2` — two real YouTube API calls — carrying the live channel's own report. |
| 7 | The authoritative owner recorded it | One row in `provider_observations`; its `facts_digest` was recomputed here from the stored facts and matches, as do both older rows. |
| 8 | Provenance ties the row to a scheduled run | `standing_authorization_id = f9ec5f63…` (TRH-23, revision 1) and a NEW `invocation_id = ef5d496b…`, with `observed_by_actor_type` and `observed_by_actor_id` both NULL. |
| 9 | It succeeded | The row exists, its digest is consistent, and the composition reported `recorded`. |
| 10 | **No human triggered it** | The hourly pattern is not something a person produces. The only human actions in the window were read-only queries and one released dry run that writes nothing — proved by the row count staying at three across it. |

## The strongest single proof

**The 09:00 tick wrote nothing. The 10:00 tick wrote an observation.**

The authorization was last observed at `2026-09-08T09:03:57.382Z` under a 1440-minute ceiling, so it
came due at `2026-09-09T09:03:57Z`. The scheduler arrived at 09:00:18 — three minutes and thirty-nine
seconds early — found `not-due`, contacted no provider and stored nothing. It came back an hour later
and read.

That is the whole design in one pair of ticks: **the cron frequency is not the cadence.** Hourly is
how often Hebun ASKS; `interval_minutes` is what Governance ALLOWS. A trigger that decided WHETHER
would have observed at 09:00.

## The exact production delta

**+1 `provider_observations`. Nothing else, anywhere.**

Measured by window rather than by a delta nobody took: across **all 66 timestamped tables in the
deployment**, exactly one row carries a timestamp at or after 09:30Z. Governance decisions and
sessions, the audit record, action permits, execution attempts, Work, Knowledge, connections,
credentials, agents, mandates, users and memberships all hold earlier timestamps.

The migration ledger is **52**, unchanged: this phase authored no schema and no migration.

## What the trigger did not gain

- **No scope.** The route reads exactly one thing from the request — the `authorization` header — so
  there is no syntax in which a caller could name a tenant, provider, capability, subject,
  connection, credential or authorization. The scan it starts takes no arguments.
- **No authority over Governance.** The authorization's `updated_at` still equals its `created_at`
  from `2026-09-08T06:59:52Z`; revision 1, state `active`, version 1. The grant was consumed as
  authority and not mutated, and exactly one authorization exists in the deployment.
- **No second provenance mode.** Zero rows in the deployment carry both a human actor and a standing
  authorization; the database's XOR check has nothing to forgive.
- **No identity.** Users and memberships did not move. No service user, no machine membership, no
  session. The principal remains ephemeral; only its invocation id survives, on the row, as
  correlation.
- **No write half.** The transport issues a single `GET`, and one pre-transport condition refuses a
  capability that is not read-only.
- **No secret exposure.** A scan of the stored facts for key material, tokens, bearer strings and
  transport headers found none; the row holds twelve typed fields.

## Cadence after acceptance

The released read-only dry run, executed after the observation, reports:

    last machine read   2026-09-09T10:00:20.919Z
    cadence allows now  NO — 10 of 1440 minutes elapsed

It contacted no provider, opened no credential and left the table at three rows. The 11:00 and later
ticks will find the same refusal. The next genuine observation cannot occur before
`2026-09-10T10:00:20Z`.

## The deployment did not move under the acceptance

`8fe919f` has been the READY production deployment since `2026-09-08T22:05:31Z`, before the window
opened and still afterwards. No push, no redeploy and no configuration change happened between the
scheduler being armed and this measurement — which is why the tick can be attributed to a known
build rather than to a moving target.

## Limitations, recorded rather than invented

- **Duplicate provider CALLS remain possible under true distributed concurrency.** Duplicate
  RECORDING does not: the authorization row lock and the symmetric cadence window make a second row
  unstorable, and the loser is reported as refused or suppressed, never as a second success. Vercel's
  own documentation states cron delivery is best-effort and may invoke a scheduled run more than
  once, which is precisely why that guarantee was built before the schedule was.
- **The kill switch is global.** One switch, every tenant, every provider, every observable
  capability. Coherent for generation one and wrong for a customer product; pausing one tenant's
  observation pauses everyone's. The per-authorization stop is Governance's: withdrawal.
- **Only one observable capability exists.** `OBSERVABLE_CAPABILITIES` is a closed list with a single
  entry. Meta/Instagram exists in this codebase only as a content-DESTINATION string on work
  artifacts — no provider, no catalog entry, no capability, no transport, no credential kind.
- **Cron delivery is best-effort.** A missed tick is not owed and is not retried; the next tick
  reconciles from stored observations, because due is derived and never scheduled.
- **`docs/MASTER-ROADMAP.md` does not know this program exists.** It declares itself the delivery
  sequencing authority, and its last measurement is `0005f72` at ledger 39 with zero occurrences of
  `TRH-`. It is thirteen migrations behind. That is recorded here as a separate debt and deliberately
  not touched by this closure.

## Validation

711/711 on Node v24.16.0 at the release, typecheck clean, lint 0 errors, build green with the route
compiled as a dynamic function. One full-suite failure during the schedule work was investigated and
attributed: the shell had fallen back to Node v20.20.2, whose `assert` message format differs, so an
unrelated agent-mandate bite proof failed on wording; it passes on v24.16.0 and the files it reads
were byte-identical to HEAD.

Four released censuses were re-aimed and none loosened. They asserted that `vercel.json` DID NOT
EXIST — a cheap way to say "nothing runs on its own", and it worked: it failed on the run that
introduced the schedule. Each now pins the schedule by value instead: exactly one cron, aimed at the
machine ingress, hourly, with nothing else in the config.

## Truth classification

    DESIGNED                 YES
    IMPLEMENTED              YES
    CONFIGURED               YES — one cron, two secrets, none in the repository
    DEPLOYED                 YES — 8fe919f READY, cron REGISTERED and enabled
    SCHEDULED                YES — hourly, and the schedule is not the cadence
    AUTHORIZED               YES — TRH-23 revision 1, active and unmutated
    EXECUTED (unattended)    YES — 2026-09-09T10:00:20.919Z
    OBSERVED                 YES — quotaUnitsSpent 2, live channel report
    RECORDED                 YES — one row, digest verified
    PRODUCTION-ACCEPTED      YES
    UNATTENDED               YES
    COMPLETE                 not a state this convention defines

**Unattended observation is now available.** It is bounded by a Governance ceiling, stoppable by an
operator switch, and incapable of choosing what it looks at.

## The sentence Hebun can now truthfully say

> A human Governance decision authorized this exact provider read scope. An hourly scheduler that
> holds no authority over tenant, provider, capability, subject, connection, credential or Governance
> asked only whether anything was due. An ephemeral machine principal performed exactly one permitted
> provider READ, and Provider Observation History stored that provider's report with truthful
> authorization + invocation provenance — with no human session, no fake actor, no scheduler state,
> no permit, no execution and no provider-write capability.

Every clause of it is measured above.
