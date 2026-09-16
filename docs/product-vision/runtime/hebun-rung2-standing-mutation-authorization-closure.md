# RUNG 2 — Standing Mutation Authorization — PRODUCTION-ACCEPTED · ENVELOPE AUTHORITY CLOSED

Release `c416d654` · `7e6a2cbf` · `f6644632` · `657288c2` · `cf403393`.
Acceptance and closure measured at `cf40339344c488343ffde17ba6e6e4bba61948d1`, which is also the
deployed SHA (`dpl_6AHJ1168eZub5ktf59dPk4Zo6fL7`, READY, `meta.githubCommitSha` read from the Vercel
REST API — designed, deployed and measured are the same commit).

A human decided, in advance and in bounds, that one named agent's evidenced work records need not be
decided one at a time. That envelope was authorized, it issued exactly one permit, that permit was
executed once in production, and the envelope has since been withdrawn. Its quota was never widened
and no second envelope was ever created.

Every fact below was measured read-only against the production control plane (`neondb`, sysid
`7675444875863894887`, migration ledger **55**) and the deployment's own runtime logs. No value of
any secret was read, printed or materialized at any point.

## The states, kept apart

| State | Answer | What established it |
|---|---|---|
| **DESIGNED** | YES | `standing_mutation_authorizations`, migration `20260915100638`. |
| **IMPLEMENTED** | YES | One writer, one issuer, one reader, one trigger, one surface. |
| **CONFIGURED** | YES | `HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET` present in the production environment as `sensitive`, alongside the observation and delivery secrets and `CRON_SECRET`. No value appears in the repository, this document, or any log. |
| **DEPLOYED** | YES | `cf40339344c488343ffde17ba6e6e4bba61948d1`, READY since `2026-09-15T18:55:29Z`. |
| **AUTHORIZED** | YES, then WITHDRAWN | Lineage revisions 1–4 below. |
| **EXECUTED** | YES — **once** | Permit `b9afaebf…`, consumed `2026-09-16T01:36:39.427Z`. |
| **PRODUCTION-ACCEPTED** | YES | The chain below, with its qualification stated rather than smoothed. |

## The envelope's whole life

One lineage, `(tenant 9947c78e…, agent 67f4460c… “Heby”, kind record-work)`. Four revisions, all
`version = 1`, all `created_at == updated_at`, all `deleted_at = null`. **Nothing was ever updated
in place.**

| Rev | State | Authorized at | Supersedes | Decision |
|---|---|---|---|---|
| 1 | `active` | 2026-09-15T19:13:20.291Z | — | `8e3b555c…` approve / `standing-mutation-authorized` |
| 2 | `withdrawn` | 2026-09-16T00:50:10.947Z | rev 1 | `79b4cb5b…` revoke / `standing-mutation-withdrawn` |
| 3 | `active` | 2026-09-16T00:54:06.702Z | rev 2 | `321d8451…` approve / `standing-mutation-authorized` |
| 4 | **`withdrawn`** | **2026-09-16T06:48:47.318Z** | rev 3 | `6b6fefaf…` revoke / `standing-mutation-withdrawn` |

Revision 3 was the envelope that acted: window `00:36Z → 12:36Z`, `max_acts = 1`,
`min_interval_minutes = 1`. It issued one permit and was therefore **1/1 exhausted** while still
inside its own window.

**Revision 4 closes the authority.** Its window, quota and cadence are revision 3's own values,
re-read server-side by the released action rather than restated by the browser — so the Governance
record says what was actually withdrawn. The withdrawal appended `+1` authorization row, `+1`
decision, `+1` session and `+1` audit row, and changed nothing else: permits, requests, work items,
tenant enrolment, the arming control and the migration ledger were all byte-identical across it.
Atomicity is visible in the timestamps — revision `created_at`, decision `decided_at` and audit
`occurred_at` are all `06:48:47.318Z`.

Withdrawing did **not** revoke the permit the envelope had already issued, and that is deliberate:
an issued permit is an ordinary single-use permit with its own expiry and its own revocation
control.

## The one production act

| # | Link | Evidence |
|---|---|---|
| 1 | The agent proposed | Request `f36a4b8a…`, `proposed_by_actor_type = 'agent'`, created `00:37:33.646Z`. |
| 2 | The **real scheduler** issued | Permit `b9afaebf…` minted `2026-09-16T01:00:43.617Z`. The standing-issuance cron's measured offset is `:00:43` — the `07:00Z` tick fired at `07:00:43.685`, matching to a fraction of a second. |
| 3 | The permit was ordinary | `ttl_seconds = 3600`, expiring `02:00:43.617Z`. Single-use, one digest, one expiry. |
| 4 | It was executed once | `consumed_at 01:36:39.427Z`, `status = consumed`, `revoked_at` null. |
| 5 | Through the **machine-delivery ingress** | Work item `54539ac0…` carries `created_by = NULL`, `created_by_type = 'system'` — the signature of `recordWorkWithinAsMachine`, which writes `createdBy: null`. The human executor writes the acting human's id there, as the 2026-09-02 work item (`created_by = d5b496df…`) shows. |
| 6 | The quota held | One act authorized, one permit issued, one act executed. |

**THE QUALIFICATION, STATED PLAINLY.** Standing issuance was triggered by the real scheduler.
**Delivery was not.** The machine-delivery ingress was invoked **manually**, after the deployment
was armed. This acceptance therefore does **not** demonstrate natural cron delivery of this permit.

> **`updated_by` ON A PERMIT IS NOT A DELIVERY-PATH SIGNAL.** Permit `b9afaebf…` carries
> `updated_by_type = 'human'`, and that is written at **issuance** by the standing issuer, which
> names the envelope's authorizing human. The spend statement never sets `updated_by` at all. Read
> as a door, it is simply wrong. The discriminator is the work item's `created_by`.

## PHASE B — THE SCHEDULER/TTL PHASE-LOCK HYPOTHESIS IS FALSIFIED

An earlier reading of this acceptance held that a released scheduler/TTL phase-lock made natural
delivery **structurally impossible**. **Production measurement refutes that, and it is not retained
anywhere as fact.**

At the `2026-09-16T07:00Z` tick, captured from production runtime logs:

| Cron | Fired | Status |
|---|---|---|
| `/api/observation/scan` | `07:00:19.013` | 200 |
| `/api/standing-issuance/scan` | `07:00:43.685` | 200 |
| `/api/machine-delivery/scan` | `07:00:47.499` | 200 |

All three ingresses authenticate. **Machine delivery runs ≈3.8 seconds AFTER standing issuance, in
the same hourly tick.** Against a 3600-second TTL that is roughly nine hundred times the margin
required. The offsets are stable, not lucky: fourteen `provider_observations` rows all land in a
`:00:19`–`:00:24` band.

So the RUNG 2 permit, minted `01:00:43.617` and expiring `02:00:43.617`, had **approximately 59
minutes of TTL remaining** when the natural delivery scan ran at ≈`01:00:47`.

**The natural delivery scan did not execute that permit.**

**THE HISTORICAL REASON IS UNKNOWN AND MUST REMAIN SO.** The scan writes nothing on a refusal and
the route logs no body, so no durable evidence of that tick's outcome exists. It was not
reconstructed and was not manufactured.

**An inference, recorded as an inference and not as history:** the first gate in
`execute-record-work-as-machine.server.ts` is the arming read, checked before a principal is minted
or a permit is touched, returning `machine-execution-disarmed`. The
`machine-internal-execution` control is `director_enabled = false` at **version 8**, last written
`2026-09-16T01:40:30Z`. A disarmed deployment at `01:00:47` is consistent with every measurement
taken here. **It is not proof, and no measurement in this closure establishes it.**

**Natural cron delivery is separately proven, and that is a different claim.** Permit `a735df37…`
was consumed at `2026-09-14T23:00:47.494Z` — the delivery cron's exact offset, matching the
`07:00:47.499` tick measured here — writing work item `5bee4e4e…` with `created_by = NULL`. The
capability works unattended. **That is not natural delivery of this RUNG 2 acceptance permit, and
the two are not interchangeable.**

**Verdict: NO SCHEDULER/TTL PHASE-LOCK DEFECT.** No scheduler timing was changed, no permit TTL was
changed, and nothing was re-armed, re-authorized or re-issued to reach this finding.

## Final production posture

| Fact | Value |
|---|---|
| Standing authorization | revision 4, **WITHDRAWN** — envelope authority closed |
| Active standing envelopes | **0** |
| Deliverable permits (active + unexpired) | **0** |
| `machine-internal-execution` | **DISARMED, version 8** |
| Tenant `record-work` enrolment | revision 1 `active` (untouched) |
| Migration ledger | 55 |
| Production acts executed under a standing envelope | **1** |

## Deferred — real, and deliberately not fixed here

| Finding | State | Why it is deferred |
|---|---|---|
| **A permit that expires undelivered strands its request permanently and burns quota irreversibly** | **DEFERRED** | `listStandingIssuableRequests` excludes any request holding *any* permit row (`isNull(actionPermits.id)`), and `action_permits_request_uq` makes that one-way. So a lapsed delivery consumes one act of the envelope quota and the request can never be re-issued. Discovered during Phase B diagnosis; **not part of this acceptance**. Nothing triggers it today — the delivery margin is ~900×. Fixing it silently inside a closure would change authorization semantics under cover of documentation. It needs its own phase and its own Director gate. |
| **The arming control has no audit trail** | **DEFERRED** | `provider_connectivity_controls` carries only current state and a `version`; arming changes are written by the possession ceremony and leave no durable history. This is exactly why the `01:00:47` refusal reason is unrecoverable above. Recording arming transitions would have made that question answerable. Real, bounded, and not blocking anything measured today. |

## Lessons — recorded here because `learnings.md` is not ours to touch

`learnings.md` carries **46 uncommitted insertions belonging to a concurrent workstream**. Under the
primary-tree single-writer rule this session does not own that file, and no legitimate narrow path
existed to append to it without risking foreign work. The lessons are therefore recorded in this
closure, which this session does own. **This is a stated limitation, not a substitution** — if the
owning session lands its changes, these belong in `learnings.md` too.

- **A closure's own qualification can be wrong. Re-measure it before repeating it.** The
  phase-lock claim survived into a closure prompt as settled fact and was falsified by one capture
  of one cron tick. Timing claims cost seconds to verify and mislead for months if they are not.
- **Read the writer before reading a column as a signal.** `updated_by_type = 'human'` on a permit
  is issuance attribution, not the door it was spent through; the spend statement never touches it.
  A column's meaning is whatever the code that writes it decided, never what its name suggests.
- **Never let a secret reach the transcript to find out whether it is set.** Env *names* and the
  200 a cron actually received answer "is this configured and authorized" completely. Values were
  loaded inside the process by the released `loadQuietEnv`, which prints nothing, and a shell
  command that would have materialized one was refused and not worked around.
- **A scan that writes nothing on refusal cannot be audited after the fact.** The RUNG 1.5 delivery
  scan returns its refusal vocabulary in a response body nobody stores, so a tick's outcome is
  unknowable an hour later. Silence is not evidence of the reason for silence.
- **A green count is not a non-effect.** Every non-effect here was proved by re-reading rows for an
  `updated_at` later than a recorded baseline instant, not by comparing totals — a delete plus an
  insert leaves a total unchanged.
