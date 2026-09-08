# TRH-23 — Standing Observation Authorization — PRODUCTION-ACCEPTED

A human holding Turkish Rug House's Governance authority has approved, by one Governance decision,
recurring observation of one exact provider read scope. The authorization is durable, bounded and
revocable.

**Nothing will run unattended, because nothing exists that could.** There is no scheduler, no cron
configuration, no worker, no webhook, no machine ingress and no runtime invocation anywhere in this
repository. Both halves of that sentence were measured, not asserted.

    AUTHORIZED != OBSERVED
    AUTHORIZED != EXECUTED
    AUTHORIZED != SCHEDULED

## What one row means

> The human holding tenant T's Governance authority approved, by decision D, recurring observation
> of provider P's capability C against subject S, through connection I, no more often than every
> K minutes.

In production, filled in:

    tenant        Turkish Rug House
    revision      1 · active · supersedes nothing
    provider      youtube
    capability    youtube.channel.public.read
    subject       youtube-channel · youtube/channel/UC5Yf5U_YOKR0K38tWF82kjA
    connection    the tenant's own YouTube integration, same tenant by composite foreign key
    cadence       at most once every 1440 minutes
    authorizer    human, by user id, joined to `users` to confirm it
    decision      approve → outcome `standing-observation-authorized`
    session       governance domain `standing-observation`

## Append-only is the security property, not a storage preference

The lineage is `(tenant, provider, capability, subject_ref)` and the effective authorization is
`max(authorization_revision)` — derived on read in all three places that need it and stored nowhere.
There is no `revoked_at`, no `superseded_at`, no `is_current` and no `expires_at`.

Withdrawal is a **new revision** under a Governance `revoke` decision; the predecessor stays
byte-identical. Re-authorizing after a withdrawal is another new active revision under another new
decision. A withdrawn revision is never reactivated, and there is no column through which it could
be.

The Director's requirement was that widening must not be an ordinary lifecycle operation. The
delivery is stronger: **`UPDATE … SET capability_key = <broader>` is not an operation at all.** The
authority exposes no update writer, and a firewall proves no `.update(` against that table exists
anywhere in `src/`. Widening costs a new Governance decision, exactly as narrowing and withdrawal do.

## Governance owns it; the authority is downstream evidence

`resolveGovernanceAuthority` reading `decision_records.bootstrap` remains the only answer to who may
decide — no role band, no permission row, no membership scope is consulted. The authorization row is
downstream evidence of that answer, the doctrine `membership_authorizations` states in its own
header. No second Governance authority was created.

No new decision vocabulary was needed: `approve` and `revoke` already existed. Both are matched on
the **subject first**, and that ordering is load-bearing. `approve` is also the membership and
mandate decision type, so an authorization would otherwise have been recorded as *"a human was
admitted"*. `revoke` is how a Governance **delegation** is ended, so a withdrawal would otherwise
have been recorded as *"Governance authority was revoked"* — taking nobody's authority away and
saying it did. Production's first row proves the branch works: the outcome is
`standing-observation-authorized`.

## The ephemeral principal

`ObservationPrincipal` — runtime-branded, never persisted, one minter, and **no tenant parameter**.
Its only argument is the authorization's own id, because a caller that could name a tenant could
choose one. Every field is read off the active row.

It is deliberately **not** a `TenantContext` and not a subtype of one. PRINCIPAL-FW-1 made the human
context nominal precisely so a machine principal would be a different type and therefore structurally
unable to reach the writers that stamp `actor_type = 'human'`. This is that different type.

Verified in production through the released minter alone: all nine fields derive from the
authorization row, the tenant-scope projection carries the single key `tenantId`, an unknown
authorization id is refused `authorization-unknown`, and **minting changed no row in any of thirteen
watched tables**.

## Three read seams narrowed; the credential opener deliberately not

`getCapabilityAvailability`, `listConnections` and `listCredentialMetadata` now take
`Pick<TenantContext, "tenantId">`. Each already read `tenant.tenantId` and nothing else, so behaviour
is unchanged; what changed is that a machine principal can ask those questions without any human-only
writer becoming reachable.

**`withDecryptedSecret` was not narrowed** and still requires the branded human context. That is the
single most important line in the firewall: narrowing it would let an observation principal open a
tenant's provider secret while every other rule still passed. A bite proof makes that one-line change
fail.

The connection check goes through the released `readConnection` seam rather than querying
`integrations`, because a released firewall pins that table to two modules and a second `where` would
be a second answer to "does this tenant own this connection".

## Revocation, answered by execution

*Revoke at 12:00:00, trigger fired at 11:59:59 — can the provider call still happen?* **No.** A
principal minted before the withdrawal is refused at the pre-transport revalidator, and the refusal
says `authorization-withdrawn` rather than merely `superseded`, because what a human needs to read is
that the permission was taken away.

TOCTOU is bounded to the width of one provider call. That window cannot be closed without a
provider-side cancel Hebun does not have, and saying so is better than implying a guarantee that does
not exist.

## Production acceptance — independently measured

The ceremony's own report was treated as supplied evidence and re-verified read-only through the
released seams.

| | |
|---|---|
| ledger | **51**, canonical prefix **converged**, digest `960f7d53c126d67fdaf9cda30cc3c405` matching the authored ledger |
| constraints | 7 CHECKs, 5 foreign keys including the composite tenant/connection key, 4 indexes plus the primary key |
| authorization rows | exactly 1 — revision 1, `active`, all bindings as above |
| decisions scoped to this subject type | exactly 1 |
| sessions in the `standing-observation` domain | exactly 1 |
| audit rows | exactly 2 — `governance.decision.recorded` and `standing-observation.authorized`, the latter carrying `collected: false` |

**Atomicity proved by the clock:** `authorized_at`, `decided_at` and both audit `occurred_at` values
are identical to the millisecond. Four rows across four tables at one instant is one transaction.

### What authorizing did not cause

    provider_observations       still 1 row, recorded sixteen hours BEFORE the authorization —
                                TRH-21's baseline. Zero recorded at or after it.
    action_permits              0 issued at or after the authorization
    action_execution_attempts   1 total, dated eight days earlier — ESA's, not this phase's
    Knowledge, Work, credentials, agents, mandates, users, memberships, sessions
                                unchanged
    provider read or write      none — no provider was contacted by this phase at all
    scheduler / cron / worker   none created, and none exists

Every audit row at or after the authorization instant is one of the two this authority wrote.

## The forensic detour, and what it proved

The first dry run failed with `persistence-not-configured`. The cause was configuration in the
invocation, not code: `getControlPlaneDb()` refuses a non-localhost target unless
`HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true` is set explicitly, and the hand-off command sourced only the
env file that lacks it. Reproduced both ways before anything was changed; no source was touched.

The fence stayed. A ceremony that set the flag for the operator would remove the one thing that makes
pointing released code at a remote database a deliberate act.

Worth recording: the writer and the minter share that same gate, so `--confirm` would have stopped at
the identical point. The dry run cost nothing and proved that.

## Validation

**702/702** on Node v24.16.0 · typecheck clean · lint 0 errors · `next build` green · **16 bite
proofs bit, 2 tolerated controls accepted, 0 void**. No executable source changed after that run —
zero diff across `src/`, `tests/`, `scripts/` and `package.json` between the release and closure.

## The one limitation, recorded rather than invented

**There is no operator kill switch for provider READS.** `provider_connectivity_controls` governs
model-generation connectivity, is global rather than tenant-scoped, and its released semantics are
different. It was not reused and no substitute was invented. The pre-transport revalidator does not
consult a switch that does not exist.

## What remains impossible

Any unattended observation. No trigger, no runtime invocation, no machine-caused provider read, no
cadence enforcement, no second sample of anything. The next phase would be the runtime that invokes
the principal — and it would force the honest observation-provenance change TRH-21's schema currently
cannot express: `observed_by_actor_type` and `observed_by_actor_id` are both NOT NULL, and an
ephemeral principal has no durable actor id to put there.

## The sentence Hebun can now truthfully say

> The Director has granted a durable, bounded, revocable Governance authorization for one exact
> provider observation scope — and nothing will run unattended, because no machine runtime, trigger
> or scheduler exists to act under it.
