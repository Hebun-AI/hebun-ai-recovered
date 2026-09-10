# TRH-IG — Instagram Standing Observation Authorization — PRODUCTION-ACCEPTED

A human holding Turkish Rug House's Governance authority has approved, by one Governance decision,
recurring observation of the organization's own Instagram professional account. The authorization is
durable, bounded and revocable, and it is the **second** provider scope this authority has ever held.

**Nothing has been observed.** Instagram observations stand at zero, no provider was contacted by
this phase, and no credential was opened. Both halves of that sentence were measured, not asserted.

    CONNECTED  != VERIFIED
    VERIFIED   != AUTHORIZED
    AUTHORIZED != EXECUTED
    EXECUTED   != SUCCESSFUL

## The five terms, answered separately for one account on one day

| Term | State | What proves it |
|---|---|---|
| CONNECTED | **YES** | `connection_state = connected`, `health = healthy` |
| VERIFIED | **YES** | `last_verified_at 2026-09-10T06:57:02.215Z`, written only by the verifier from a real provider answer |
| AUTHORIZED | **YES** | revision 1, `active`, under a Governance decision |
| EXECUTED | **NO** | `provider_observations` holds no Instagram row at all |
| SUCCESSFUL | **N-A** | nothing has run, so nothing can have succeeded |

The connection had been live and provider-verified for twenty-one minutes before any authorization
existed, and would have remained so indefinitely. **Holding a credential is not permission to keep
using it.**

## What one row means

> The human holding tenant T's Governance authority approved, by decision D, recurring observation
> of provider P's capability C against subject S, through connection I, no more often than every
> K minutes.

In production, filled in:

    tenant        Turkish Rug House (turkish-rug-house)
    authorization 316085c2-7f42-407a-bc55-ad043ee84e3a
    revision      1 · active · supersedes nothing · lifecycle_status active
    provider      instagram
    capability    instagram.account.public.read
    subject       instagram-account · instagram/account/28295264780115792
    connection    31fcbd7c-8dd7-48eb-adf6-6548981a10ba — the tenant's own Instagram integration
    cadence       at most once every 1440 minutes
    authorizer    human · the Director's own user id
    authorized_at 2026-09-10T07:18:27.256Z
    decision      9a2e0b78-3af1-4ca2-9642-83a16db9cbd2 — tenant-scoped to turkish-rug-house
    session       2a154246-6d8c-4604-8083-ab59ca1f4680 — tenant-scoped to turkish-rug-house

## Governance owns it; the authority is downstream evidence

`resolveGovernanceAuthority` remains the only answer to who may decide. The authorization row records
that a decision was made; it is not a second Governance authority and no second one was created. No
new decision vocabulary, no new table, no new ceremony and no new authorization mechanism exist as a
result of this phase.

## The operator named one thing, and the released registries named the rest

The ceremony's only scope input was the provider key. Everything else was resolved:

- **capability and subject kind** — read off `OBSERVABLE_CAPABILITIES`, a closed frozen list whose
  Instagram entry was added by a code change with a review, which is the cost that entry should have.
- **subject reference** — read off the connection, because the released provider catalog declares
  this provider's `accountIdentity` to be `account`: the verifier had already written the account the
  provider itself confirmed. The first provider on this authority binds no account and still takes
  its subject from a stored observation.
- **tenant** — resolved server-side from the slug and the Director's own active membership.

Requiring a prior observation for an account-bearing provider would have demanded an observation
*before* the authorization that permits it. The catalog decides the shape; the ceremony follows it.

## Atomicity, proved by the clock rather than asserted

`authorized_at` and **both** audit `occurred_at` values are identical to the microsecond —
`2026-09-10T07:18:27.256Z`. Three rows across three tables at one instant is one transaction.

    governance.decision.recorded      governance_decision                 human actor
    standing-observation.authorized   standing_observation_authorization  human actor

Both audit rows are tenant-scoped to `turkish-rug-house`.

## Exact production delta

Measured against a baseline snapshot taken at `2026-09-10T07:15:37.074Z`, re-measured at
`07:19:36.915Z`:

    +1  standing_observation_authorizations   1 -> 2   (the second row that table has ever held)
    +1  decision_records                     12 -> 13
    +1  governance_sessions                  12 -> 13
    +2  audit_log                            78 -> 80

Nothing else moved.

## What authorizing did not cause — measured, not assumed

    provider_observations         3 rows, all youtube, newest 2026-09-09T10:00:20.919Z.
                                  ZERO Instagram rows — the provider does not appear in the table.
    provider read or contact      none. No Meta endpoint was called by this phase.
    credential decryption         none. No connection-scoped secret was opened.
    TRH Instagram connection      version 3, updated_at 2026-09-10T06:57:02.215Z — the OAuth instant,
                                  unchanged by authorizing.
    TRH Instagram credential      version 1, updated_at == created_at, not revoked, not destroyed.
    Hebun Instagram connection    version 6, updated_at 2026-09-09T21:36:58.817Z — untouched.
    Hebun Instagram credential    version 1, untouched. Zero Hebun-scoped audit rows in the window.
    YouTube standing authorization revision 1, active, interval 1440, same decision and session,
                                  authorized_at still 2026-09-08T06:59:52.217Z — unaffected.
    schema                        68 tables. Migration ledger 52. No migration authored or applied.
    scheduler / cron / worker     none created. The hourly due-scan released by TRH-25 is unchanged.

**An authorization refers to a connection; it does not consume, mutate or lock one.**

## The ephemeral principal, minted and discarded

The ceremony minted an `ObservationPrincipal` from the new authorization and **did not use it**. The
only invocation-shaped table in the deployment gained **zero** rows after the baseline. The principal
is not persisted, holds no credential, and ended with the process.

**Minting a principal is not executing.** Execution begins only when the authorized path decrypts a
connection-scoped secret, reaches the provider and writes an observation. None of that happened.

## Tenant isolation held under a shared external identity

Two tenants hold independently verified connections to the **same** external Instagram account. Only
one of them is authorized to observe it. The uniqueness rule that permits the sharing is keyed on the
tenant, and the authorization names one tenant's connection through a composite foreign key.
**Provider identity is shared; authority is not.**

## Code and release state

No code was written for this phase. **COMMIT for the ceremony itself: none.** The released capability
it exercised is `b04624f` (the second observable provider) and `af74795` (the ceremonies learning to
dispatch by provider). The repository stood at `759852a` throughout, equal to `origin/main`, and the
production deployment was the redeploy of that build, Ready and domain-bound.

## What remains impossible, and what is now newly possible

Impossible: any Instagram observation that has already happened. There is none.

**Newly possible and worth stating plainly:** the automatic due-scan released by TRH-25 enumerates
active standing authorizations with no tenant scope. This authorization is therefore now visible to
it, and its 1440-minute ceiling has never been consumed. The first unattended Instagram read is a
live possibility rather than a hypothetical. That is the intended consequence of authorizing, and it
is the reason the first observation is tracked as a separate Director gate rather than a follow-on.

## Deferred documentation, recorded rather than silently skipped

- **No `07 Providers/Instagram Provider.md` exists in the derived vault**, though every other
  released provider has one. A pre-existing gap this phase widened. Not created here.
- **No closure record exists for the Instagram OAuth admission release itself** (`1bfc7f4` and its
  two fixes). This closure covers the authorization phase only.

## The sentence Hebun can now truthfully say

> A human Governance decision authorized one exact Instagram read scope for one tenant, bounded to at
> most one read per day and revocable by a new revision. Hebun has not looked. It holds a verified
> connection, a live credential and a durable permission — and the provider has never been contacted
> under that permission.

Every clause of it is measured above.
