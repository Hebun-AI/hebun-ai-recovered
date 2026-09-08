# TRH-24 — Machine-Sourced Manual Single Observation — PRODUCTION-ACCEPTED

Release `c58ab04`. Migration 52. One machine-sourced provider observation exists in production, and
the row does not name a human, because no human performed the read.

Every fact below was measured read-only against the production control plane after the ceremony,
independently of the ceremony's own output.

## Repository and deployment reality

    HEAD                c58ab048bc6d088dbf4def4f2c6892b222d1f5c7
    origin/main         identical · 0 ahead, 0 behind
    deployed SHA        c58ab048bc6d088dbf4def4f2c6892b222d1f5c7
    deployment state    READY, target production, ready at 2026-09-08T08:52:12Z
    production domains  bound to that exact deployment

The release was live eleven minutes before the observation. Deployment was read from the provider's
own deployment metadata, never inferred from a git push.

## Migration 52

    production ledger        51 → 52
    migration                20260908072926_trh24_machine_observation_provenance
    stored hash              801bc52d…  ==  sha256 of the migration file in this checkout
    canonical digest         74c3ac54bf016ac2196765c186b27b8c
    repo canonical digest    74c3ac54bf016ac2196765c186b27b8c

Fifty-two canonical migrations in the journal, fifty-two applied rows, and the md5 over the ordered
hash list computed from each side independently agrees. Convergence by exact prefix, never by count.

This was **schema evolution, not additive DDL**: two NOT NULL constraints were dropped. No backfill —
every pre-existing row is human-sourced and already satisfies the human mode.

## The observation

    observed_at                2026-09-08T09:03:57.382Z
    recorded_at                2026-09-08T09:03:57.443Z
    tenant                     Turkish Rug House
    provider / capability      youtube · youtube.channel.public.read
    subject                    youtube-channel · youtube/channel/UC5Yf5U_YOKR0K38tWF82kjA
    observed_by_actor_type     NULL
    observed_by_actor_id       NULL
    standing_authorization_id  the active TRH-23 authorization
    invocation_id              one uuid, unique, referenced nowhere else
    facts                      the closed twelve-field set · subscribers 0 · views 0 · videos 0

The provenance mode is **authorization + invocation**, and the database enforces that it is exactly
one mode: a CHECK requires precisely one of (human actor pair) or (authorization present), a second
CHECK keeps each pair both-or-neither, a composite `(standing_authorization_id, tenant_id)` foreign
key with `ON DELETE RESTRICT` prevents an observation naming another tenant's authorization, and a
partial unique index on `invocation_id` means one invocation stores at most one sample.

Every scope field on the row equals the authorization's own — tenant, provider, capability, subject
kind, subject reference and connection. None could have been supplied: the composition's only
argument is an authorization id.

The stored facts hash to the stored digest, recomputed here from the row itself. A scan of the
stored bytes for key material, tokens, bearer strings or transport headers found none. The row holds
a typed projection, never a provider payload.

## The exact production delta

**+1 `provider_observations`. Nothing else moved.**

Proved by window rather than by a delta nobody took: across **all sixty-six timestamped tables in
the deployment**, exactly one row carries a timestamp at or after the read. Standing authorizations,
decision records, governance sessions, the audit record, action permits, execution attempts, work
items, work artifacts, work evidence, knowledge nodes, knowledge facts, external references,
integrations, credentials, agents, mandates, users, memberships and session contexts all hold their
latest timestamps from before it.

**The observation authority wrote no audit row.** The audit sink's newest entry is still the TRH-23
authorization decision, two hours earlier. A provider reporting a number is nobody doing anything.

The observation appears in no knowledge node, fact or external reference, in no work item, artifact
or evidence reference, and in no answer-source evidence. It was not promoted to Knowledge and was
not turned into Work — structurally, because the composition imports none of those modules.

**No retry and no second observation.** The table holds two rows in total: the human baseline of
2026-09-07 and this one. Exactly one carries an invocation id, and it is distinct. The composition
contains no loop, no timer, no backoff and no next-run computation, and never calls itself.

## The baseline is unchanged, and could not have been otherwise

The human row still carries its human actor pair, still satisfies the XOR check, and its facts still
hash to the digest stored beside them. The authority has **two INSERTs and no UPDATE or DELETE
anywhere** — one authority, two provenance modes. That the baseline is unchanged is a property of
the code, not an outcome of the run.

Both rows carry the **same facts digest**, because the channel reported the same zeros a day apart.
Two identical readings are still two observations. Dedup on the instant, never on the values.

## Cadence, as a refusal

`interval_minutes` was stored and enforced by nothing until this release. It is now the last
condition of the authoritative pre-transport check, measured over observations made **under a
standing authorization** and never over human ones — a human read never touches the authorization,
and bounding it would let a Governance decision retroactively govern an act performed before it
existed. Before the ceremony the scope had no machine observation and the cadence permitted one.

The released read-only dry run, executed after acceptance, reports:

    last machine read   2026-09-08T09:03:57.382Z
    cadence allows now  NO — 9 of 1440 minutes elapsed

It contacted no provider, opened no credential and wrote nothing — the table still holds two rows.

**A refusal is not a schedule.** Nothing computes a next run and a missed interval is not owed. A
failed provider read stores nothing, so it spends no ceiling and may be retried immediately.

## Security and authority boundaries

- **No human was impersonated.** The actor pair is NULL. The three forced representations considered
  at design time — the Director's id, a service user, an authorization posing as an actor — are all
  absent from the row and from the schema.
- **No service user, membership or session was created.** Users, memberships and agents did not move.
- **The principal remains ephemeral.** There is no principal table and nothing persists one. Only its
  invocation id survives, on the observation row, as correlation — it confers nothing.
- **No human context was widened.** `withDecryptedSecret` is untouched and still requires the branded
  human context. The new `withConnectionScopedSecret` is strictly narrower: it has no credential
  parameter at all, takes a connection and a kind, refuses rather than choosing when a connection
  holds two live credentials of that kind, rebuilds the AAD from the row's own identity, and confines
  the plaintext to one callback frame. Its callers are censused to exactly one.
- **Provider write is structurally unavailable.** The transport hard-codes a single `GET`, and one
  pre-transport refusal is `capability-not-read-only`.
- **The observation was a READ, not an execution.** No permit was spent and no execution attempt was
  recorded, because the composition can reach neither.
- **Governance was consumed as authority, never mutated.** The authorization's `updated_at` still
  equals its `created_at` from two hours before the read; revision 1, state active, unchanged.
- **Provider Observation History remains the only owner of the stored provider fact.**
- **No machine ingress exists.** The composition's only caller in the entire repository is an
  operator terminal ceremony requiring a typed confirmation. No route, no API handler, no cron
  (there is no `vercel.json` at all), no `setInterval` anywhere in the source, no worker, no queue
  and no webhook.

## Limitations, recorded rather than invented

- **There is no dedicated operator kill switch for a provider READ.** Measured, not assumed: the
  operator connectivity control table holds rows for `claude` and `external-send` only — none for
  `youtube` — and no refusal in the pre-transport check consults it. Withdrawing the authorization,
  revoking the credential or disabling the connection are the available stops.
- **The TOCTOU window remains exactly one provider call wide.** A withdrawal committed after the
  last-moment revalidation returns cannot stop that call. The code says so rather than claiming
  otherwise.
- **One released file's prose is now stale.** `observation-principal.server.ts` was written by TRH-23
  and left untouched by TRH-24, so it still states that there is "no provider transport caller in
  this repository" and that this principal "cannot open a secret". Both were true when written and
  are false now — the connection-scoped opener is exactly the seam that changed. The narrowing is
  real and the behaviour is correct; the comment no longer describes the code around it. Recorded
  here rather than repaired, because repairing it is an executable change and this is a closure.

## Validation

No executable source changed after the released green run, so its evidence stands rather than being
re-manufactured: **705/705 on Node v24.16.0** (the same version this acceptance ran on), typecheck
clean, lint 0 errors, build green, 13 bite proofs bit, 2 tolerated controls, 0 void. The working
tree carries no modification under `src/` or `scripts/`.

## Truth classification

    DESIGNED              YES
    IMPLEMENTED           YES
    PERSISTED             YES
    MIGRATED              YES — ledger 52, digest converged
    DEPLOYED              YES — c58ab04 READY
    AUTHORIZED            YES — TRH-23 revision 1, active
    EXECUTABLE            YES, for MANUAL machine observation
    EXECUTED              YES, exactly once
    OBSERVED              YES
    RECORDED              YES
    PRODUCTION-ACCEPTED   YES
    SCHEDULED             NO
    UNATTENDED            NO

**Manual machine observation is now available. Unattended observation is still unavailable. No
scheduler exists. There is no automatic next run.**

## The sentence Hebun can now truthfully say

> A human Governance decision authorized this exact provider read scope, an ephemeral machine
> principal performed exactly one permitted provider READ under it, and Provider Observation History
> stored that provider report with truthful authorization + invocation provenance — without creating
> a scheduler, a fake human, a generic machine identity, an action-execution authority or any
> provider-write capability.

Every clause of it is measured above.
