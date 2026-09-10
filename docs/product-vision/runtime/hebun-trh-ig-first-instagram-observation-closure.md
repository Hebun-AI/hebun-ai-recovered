# TRH-IG — First Instagram Observation — PRODUCTION-ACCEPTED

At **2026-09-10T08:00:18.986Z** Hebun looked at Turkish Rug House's Instagram account for the first
time. No human was present. No human triggered it. The last human act was the Governance decision
forty-two minutes earlier that said it was allowed to.

    CONNECTED  = yes
    VERIFIED   = yes
    AUTHORIZED = yes
    EXECUTED   = yes
    SUCCESSFUL = yes

All five terms are now true of one account, and each was measured separately. This document records
the last two; the first three are recorded in
`hebun-trh-ig-instagram-standing-observation-authorization-closure.md`.

**No code was written for this phase. COMMIT: none.** The repository stood at `7db16a3` throughout,
equal to `origin/main`. Nothing was released, deployed or migrated to make this happen.

## AUTHORIZED != SCHEDULE CREATED

This is the finding worth keeping.

Authorizing created **no Instagram job, no cron entry, no schedule and no timer**. What happened
instead is that the already-released hourly due-scan — provider-agnostic since `b04624f`, and
written to enumerate active standing authorizations **with no tenant scope and no provider filter** —
discovered a scope it had never seen before and found it due, because a scope with no prior machine
observation has never consumed its ceiling.

A human granted permission. An existing, unmodified scheduler found that permission on its next
pass. Nobody connected the two, and nobody had to.

## The layers, and what each one decided

    human Governance decision   WHETHER the machine may ever observe this scope
    hourly due-scan             WHEN a possibly-due authorization is examined
    pre-transport revalidator   whether execution is STILL permitted at this instant
    provider runtime            performs the read
    observation writer          records derived provider evidence

**None of these becomes Knowledge authority.** The scan cannot widen scope — its only argument is an
authorization id, and every other fact is read off the authorization row. The revalidator, not the
trigger, is the authority: a trigger that decided *whether* would have observed at 07:00, before the
authorization existed.

The same 08:00 tick left YouTube alone, because YouTube's ceiling had not reopened. One tick, two
authorizations, two different correct answers.

## What ran

    hourly cron  →  GET /api/observation/scan
                 →  active standing-authorization enumeration (no tenant, no provider parameter)
                 →  observeOnceUnderAuthorization(authorizationId)
                 →  pre-transport revalidation
                 →  provider dispatch
                 →  Instagram runtime
                 →  authoritative provider observation writer
                 →  provider_observations

    provider      instagram
    capability    instagram.account.public.read
    endpoint      GET https://graph.instagram.com/me
    scope held    instagram_business_basic
    fields        id · username · account_type · followers_count · follows_count · media_count

`/me` carries no account-id placeholder: the account read is the account the token authorizes, so
the runtime cannot be pointed at a different one. The field list is a frozen closed constant —
`fields=` is the one place an Instagram request could quietly widen.

The credential was opened through `withConnectionScopedSecret(connection, "oauth_access")`, the
narrow seam that takes a connection and a kind and resolves the credential itself. There is no
caller-named credential id anywhere in that path, and `withDecryptedSecret` — which still requires a
branded human context — was not used.

## The observation

    id             3486c1c9-8fc3-4be8-99ae-2b0185ad4556
    tenant         Turkish Rug House
    integration    31fcbd7c-8dd7-48eb-adf6-6548981a10ba   (TRH's own connection)
    authorization  316085c2-7f42-407a-bc55-ad043ee84e3a   revision 1, the only revision
    invocation     f7d64c97-c999-40cf-9ddb-6a3925d97495   correlation only, never persisted elsewhere
    subject        instagram-account · instagram/account/28295264780115792
    observed_at    2026-09-10T08:00:18.986Z
    recorded_at    2026-09-10T08:00:18.989Z               (3 ms later)
    actor          NULL / NULL

The human actor pair is NULL and the authorization + invocation pair is set: the XOR provenance
shape TRH-24 built. **No fake human was recorded**, which is the whole reason that shape exists.

## What the provider said — DERIVED PROVIDER OBSERVATION DATA

    username        turkishrughousecom
    accountType     BUSINESS
    followersCount  56
    followsCount    83
    mediaCount      8

Stored with a facts digest. **This is a point-in-time statement by Instagram, not organizational
truth.** It says what one provider reported about one subject at one instant, under one connection,
caused by one authorization. It is **not authoritative organizational Knowledge**, it was not
admitted anywhere, and nothing in this repository treats it as a fact about the business.

**PROVIDER READ != KNOWLEDGE ADMISSION**, and the measurement below is how that is known rather
than claimed.

## Meta was genuinely contacted — proved by the data, not by a log line

The account identifier and all three counts appear **nowhere in the repository**: zero hits across
`src/`, `scripts/` and `tests/`. The only repository occurrence of the username is a test fixture
carrying no counts. These values could not have been produced locally.

The runtime log independently shows `GET /api/observation/scan` firing on the hour.

## Exactly one row moved in the deployment

A sweep across **all 61 tables carrying `created_at`** — `knowledge_facts` among them — found
**NONE** with a row at or after 08:00Z. `provider_observations`, which timestamps with
`observed_at`/`recorded_at`, gained exactly **one**.

    knowledge_facts   7      unchanged      work_items       3   unchanged
    work_artifacts    8      unchanged      action_permits   2   unchanged
    execution_attempts 1     unchanged      audit_log       80   unchanged
    decision_records  13     unchanged      governance_sessions 13  unchanged

The observation authority writes no audit row, as its released behaviour records. Governance was
neither consulted nor mutated at read time — the decision had already been made.

## The ceiling was consumed without mutating the grant

Authorization `316085c2…` is still **revision 1, active, version 1**, with `updated_at` equal to
`created_at` at `07:18:27.256Z`. It was **consumed as authority, not written to**.

Cadence is enforced from observation history, not from a counter on the authorization: the ceiling
is measured over machine observations of the scope, so the next permitted read is
**2026-09-11T08:00:18Z**. There is no `last_run`, no `next_run` and no lease. **A grant that records
its own use would be a grant that can be corrupted by using it.**

No second authorization was created — the deployment still holds exactly two.

## Tenant isolation, under a shared external identity

Two tenants hold independently verified connections to the **same** Instagram account. Only one is
authorized, and only one observed.

    TRH connection      version 3, updated_at 2026-09-10T06:57:02.215Z   unchanged by reading
    TRH credential      version 1, unrevoked                             unchanged by reading
    Hebun connection    version 6, updated_at 2026-09-09T21:36:58.817Z   untouched
    Hebun credential    version 1, unrevoked                             untouched

Zero Hebun-scoped observation or audit rows. Reading through a connection does not write to it.

## YouTube unaffected

Authorization `f9ec5f63…` revision 1, active, `updated_at` still `2026-09-08T06:59:52.217Z`. Its
three observations are unchanged: one human, two machine. Instagram becoming observable took nothing
from the provider that went first.

## Platform

68 tables. Migration ledger 52. No schema change, no migration, no deployment, no code change.

## A manual ceremony was deliberately NOT run

`platform:observe-once` remains unexercised for Instagram. Running it now would contact Meta a second
time and consume tomorrow's ceiling to demonstrate a runtime production has already demonstrated.
**Exercising an operator for its own sake is not evidence; it is a second provider call with a
worse reason.** Recorded as a deliberate omission rather than an oversight.

## The sentence Hebun can now truthfully say

> A human decided this organization's Instagram account could be observed once a day. An hourly scan
> that holds no authority over tenant, provider, capability, subject, connection or credential
> noticed the new permission on its next pass, asked the revalidator whether it still stood, opened
> one credential for one call, and recorded what Instagram said — with no human session, no invented
> actor, and nothing promoted into what Hebun claims to know.

Every clause of it is measured above.
