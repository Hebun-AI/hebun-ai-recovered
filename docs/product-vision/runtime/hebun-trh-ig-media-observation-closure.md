# TRH-IG — Instagram Media Observation — PRODUCTION-ACCEPTED

Hebun has read what Turkish Rug House posted. A second, separately governed Instagram capability was
declared, released, deployed, authorized by a human under Governance, and executed by the released
scheduler twenty-two seconds later — storing one bounded window of the account's recent media as
provider evidence.

**The permission question is now answered by a provider, not by documentation.** Meta's reference
said `instagram_business_basic` covers the media node under Instagram Login. It does. That sentence
was expected before this phase and is *verified* after it, and the difference between those two words
is the whole point of a production acceptance.

    PROVIDER PERMISSION   != HEBUN CAPABILITY
    HEBUN CAPABILITY      != GOVERNANCE AUTHORIZATION
    GOVERNANCE AUTHORIZED != EXECUTED
    EXECUTED              != SUCCESSFUL

## The five terms, answered separately for one capability on one day

| Term | State | What proves it |
|---|---|---|
| DECLARED | **YES** | `instagram.media.public.read` in the catalog, the observable list and the dispatch, at `66a71ad` |
| DEPLOYED | **YES** | production deployment READY, `githubCommitSha = 4d22c0b`, both production domains aliased to it |
| CONNECTED | **YES** | the tenant's existing Instagram connection, `connected` / `healthy`, untouched by this phase |
| VERIFIED | **YES** | the provider answered a real media read under the already-held scope |
| AUTHORIZED | **YES** | revision 1, `active`, every 1440 minutes, under its own Governance decision |
| EXECUTED | **YES** | one observation, machine-sourced, at `2026-09-10T14:00:19.320Z` |
| SUCCESSFUL | **YES** | eight real media, with captions and counts no local fixture could produce |

## Two commits, kept apart on purpose

    670934f
      → 66a71ad  feat(instagram): add separate media observation capability      (15 files)
        → 4d22c0b  feat(ceremony): require explicit observable scope when ambiguous  (3 files)

The split is architectural, not cosmetic. The first is a **provider runtime capability**; the second
is **human authorization ceremony support**. Squashing them would have hidden the fact that adding a
capability broke an operator seam, and that the break was correct.

## Why a second capability rather than a wider first one

`instagram.account.public.read` was already authorized in production, by a human who was told it
meant five account facts. Teaching that key to also mean *"and every recent post, its caption and its
engagement counts"* would have expanded an **already-granted** permission retroactively, with nobody
deciding to.

So the two capabilities are separate keys under the **same single OAuth scope**. That combination is
the load-bearing idea of this phase: one provider permission, two Hebun capabilities, two Governance
decisions, two cadences, two revocations. **No tenant was asked to grant anything new**, and the
existing authorization gained nothing — proved at the ceremony itself, which reported
`effective revision: none — this scope has never been authorized` for the media scope while the
account scope stood at revision 1 active.

## The ceremony consequence, discovered rather than designed

Declaring a second capability immediately broke `--provider=instagram`: the operator seam resolves
one scope per provider and now had two. **It refused, which was correct** — a ceremony silently
choosing between those two would let list order decide what a human was asked to approve.

`4d22c0b` added `--capability=`, and refuses without it when a provider offers more than one, listing
the candidates in the refusal itself. A single-capability provider still needs no flag: there is no
ambiguity to resolve, and YouTube's behaviour is unchanged.

## The human act

The Director ran the released ceremony with the capability named explicitly, and typed the
confirmation phrase in person. The ceremony reported what it always reports and what remained true:
no provider contacted, no credential decrypted, no schedule created, no observation recorded, and an
ephemeral principal minted and discarded unused.

    authorization  a27cadfd-1c7b-469a-a915-8cd1497ed391
    revision       1 · active · supersedes nothing
    capability     instagram.media.public.read
    subject        instagram-account · instagram/account/28295264780115792
    connection     31fcbd7c-8dd7-48eb-adf6-6548981a10ba
    cadence        at most once every 1440 minutes
    authorized_at  2026-09-10T13:59:57.009Z
    decision       recorded · session recorded

## First execution was the scheduler's, and that is attributed rather than assumed

    authorized   13:59:57.009Z   (human, Governance)
    observed     14:00:19.320Z   (machine, standing authorization)
    recorded     14:00:19.323Z

Twenty-two seconds. **The released hourly due-scan owned the first execution**, exactly as it did for
the first account observation — a fresh authorization has no prior observation for its scope, so it
is immediately due.

The attribution rests on **persisted provenance, not on the clock**: `observed_by_actor_type` and
`observed_by_actor_id` are both `null`, and `standing_authorization_id` and `invocation_id` are both
present. That is the machine-sourced shape TRH-24 defined; a human-caused read carries the opposite
pair. Nobody ran `platform:observe-once`, and no second provider call was spent to prove a thing
production had already proved.

## What was stored, exactly

Top-level keys — **exactly four**, matching the released contract:

    accountId          28295264780115792
    recentMediaCount   8
    moreMediaExist     false
    recentMedia        [8 items]

Each item carries **exactly seven** keys and no others: `mediaId`, `mediaType`, `caption`,
`permalink`, `publishedAt`, `likeCount`, `commentCount`.

- **Bounded**: 8 items against a hard limit of 10. The account has eight posts, so the window is the
  whole account — and `moreMediaExist: false` says so honestly rather than by omission.
- **One page**: no cursor was followed. `recentMediaCount` is the size of *this window*, never the
  account's total media count.
- **Absences measured, not assumed**: no `media_url`, no `thumbnail_url`, no token or credential
  material, and no `trend` / `delta` / `rate` / `score` / `growth` / `recommend` key anywhere in the
  stored JSON.
- Every `mediaType` is `IMAGE`; like counts ran 3–5; **every comment count is a real `0`** and is
  stored as `0`, not as `null`.
- Captions are strings and permalinks are `instagram.com` URLs — carried as data. **A caption is
  untrusted external text**: it was stored verbatim, never parsed, never interpreted, and never given
  to a model.

Recorded honestly: this account does not hide its like counts, so the `null`-preserving path — the
one that matters when an owner hides likes — was **not exercised in production**. It is covered by
test only, and that distinction is not smoothed over here.

## Exact production delta

| Measure | BEFORE (13:51Z) | AFTER (14:02Z) |
|---|---|---|
| TRH Instagram **media** observations | **0** | **1** |
| Media observations, all tenants | 0 | 1 |
| Hebun tenant media observations | 0 | **0** |
| TRH Instagram account observations | 1 | 1 (unchanged) |
| Instagram standing authorizations | 1 (account) | 2 (account + media) |
| Account authorization | rev 1 · active | rev 1 · active, `authorized_at` unchanged |
| Governance decisions | 13 | 14 |
| `audit_log` | 80 | 82 |
| Integration | connected · healthy · v3 | identical, `updated_at` unchanged |
| Credential | `oauth_access` v1 | identical |
| Tables | 68 | 68 |

The two new audit rows are `governance.decision.recorded` and `standing-observation.authorized`,
both at the authorization instant. **The observation itself wrote no audit row** — consistent with
the released design, where an observation is evidence rather than a governed act.

One number is not this phase's: total observations across all tenants read **5** at BEFORE, not the 4
measured earlier in the day. That earlier increment was unrelated scheduler activity between sessions.
Within the acceptance window itself the total moved 5 → 6, which is exactly the one media row.

## Tenant isolation under a shared external identity

The same Instagram account is connected independently under two tenants. The media authorization
belongs to **one**.

    Turkish Rug House   1 media observation
    the other tenant    0
    all tenants         1

Nothing was joined by external account id, and no second authorization was created to manufacture a
comparison.

## What this did NOT create

No schema and no migration — 68 tables before and after, migration ledger untouched. No scheduler and
no cron entry; the existing hourly scan found the new scope on its own pass, exactly as designed. No
new authority: execution went through the released dispatch, the released revalidator, the released
connection-scoped credential seam and the released observation writer. No new credential kind, no new
OAuth scope, no re-consent.

And nothing downstream: **no Knowledge admission, no Heby consumption, no agent access, no analytics,
and no dashboard consumer.** Storing engagement counts creates the *possibility* of analytics and
none of the authority for it.

## Known limits

1. **`null` like counts are untested in production**, as above.
2. **`moreMediaExist: true` is untested in production** — this account fits inside the window. The
   truncation path is covered by test only.
3. **No per-capability pause exists.** A fresh authorization is immediately due, so the scheduler will
   own the first execution of any future scope. The only stop is the global
   `provider-observation-read` kill switch, which pauses every tenant and every provider.
4. **Nobody can see this yet.** The observation is stored and unread by any product surface.

## Next legitimate phase

A dashboard consumer, reading stored history through `readProviderObservations` with
`capabilityKey = instagram.media.public.read` — the same shape the account consumer already uses, and
under the same truth semantics: what Instagram reported at an instant, with no trend and no verdict.

## The sentence Hebun can now truthfully say

> A human holding this tenant's Governance authority approved a second, narrower Instagram scope; the
> released scheduler exercised it once under that authorization with no human present and no invented
> actor; Instagram answered with eight real posts under the scope the tenant had already granted; and
> Hebun stored a bounded, truncation-disclosing window of what the provider said — without a new
> permission, a new schedule, a new authority, a new table, or any claim that those numbers are still
> true.

## Related

- `hebun-provider-observation-consumption-discovery.md` — why observations do not become Knowledge.
- `hebun-trh-ig-instagram-standing-observation-authorization-closure.md` — the account authorization
  this one deliberately did not widen.
- `hebun-trh-ig-stored-observation-dashboard-consumption-closure.md` — the consumer shape the media
  surface should follow.
