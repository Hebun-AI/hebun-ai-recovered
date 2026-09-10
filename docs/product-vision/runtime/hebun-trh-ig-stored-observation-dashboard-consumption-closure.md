# TRH-IG — Instagram Stored Observation Dashboard Consumption — PRODUCTION-ACCEPTED

A human holding a Turkish Rug House session can now **see** what Instagram reported. The tenant's
existing `/integrations/instagram` page renders the latest stored provider observation, read through
the authority that already owned that read, and rendering it contacted nobody.

**Nothing was observed to produce this page.** Instagram was not contacted, no credential was
opened, no authorization was spent and no row was written. Both halves of that sentence were
measured against production before and after the render, not asserted.

    CONNECTED != OBSERVED
    OBSERVED  != KNOWLEDGE
    STORED    != CONSUMED
    READ      != OBSERVE

The fourth pin is the one this phase exists to establish. Until now every path that could show a
provider value could also *cause* one. A page load is a read of stored history, and it must never
become a reason to reach a provider.

## The problem being closed

`provider_observations` had been production-accepted since TRH-21, extended by TRH-24 with machine
provenance and by TRH-25 with an automatic trigger. Rows were being written on a real cadence.

**Nobody could read them.** The subsystem had a released writer, a released read seam, a Governance
authorization and a running trigger — and zero product consumers. A tenant's own Instagram account
had been observed, and the tenant's own Instagram page said nothing about it.

## The read seam already existed — and that decided the whole shape

The discovery that preceded this release is recorded separately in
`hebun-provider-observation-consumption-discovery.md`. Its operative finding: **the authoritative
read seam was already built**, in `provider-observation-history/read-provider-observations.server.ts`,
server-only, tenant-predicated from `TenantContext`, bounded, ordered newest-first, with discriminated
read/unavailable results, no provider contact, no mutation and no credential dependency.

So this release created **no read authority**. It added a consumer, and the consumer is small
precisely because the authority was already right. That the implementation is a twenty-line
projection is the evidence, not an accident.

    Provider execution authority  → writes the observation
    Observation history authority → stores it, and reads it back tenant-scoped
    This consumer                 → narrows it for one surface
    Knowledge authority           → remains untouched, and separate

## The narrow implementation

One query, from one call site:

    readProviderObservations(tenant, { providerKey: INSTAGRAM_PROVIDER_KEY, limit: 1 })

`subjectRef` was deliberately **not** added. The stored facts name the account Instagram itself
reported, so the row is self-describing; adding a second predicate would have required the page to
derive a subject from the connection, which is the inference the seam's design refuses.

The projection carries exactly six fields — the observed instant plus the five facts Instagram
reported. Every provenance identifier the stored row holds (`observationId`, `integrationId`,
`standingAuthorizationId`, `invocationId`, `capabilityKey`, `subjectKind`, `recordedAt`) stops at the
projection boundary. They are how Hebun accounts for a read internally; they are not what Instagram
said.

Every fact is treated as untrusted external data: text is accepted only when it *is* text, a count
only when it is a finite number. Anything else becomes "Instagram did not report this". A component
is therefore only ever handed a string, and no shape a provider chose can decide how the page
renders. `null` stays "not reported" and `0` stays `0`, all the way to the screen.

## Release state

    commit    5d1d0c4603fd8d623e8c2e647c0a1d4e3c86ab67
    parent    99d0edb49c35b1b15e2115969729ebb82210e5cf
    files     4 changed · 755 insertions · 0 deletions
    schema    none · migration ledger unchanged at 52 entries

    src/app/(dashboard)/integrations/instagram/page.tsx        modified
    src/features/instagram-connection-surface/latest-observation.ts   new
    tests/instagram-observation-surface/projection-behaviour.ts       new
    tests/instagram-observation-surface/surface-firewall.ts           new

## Validation, stated with its gap

- `typecheck` — pass.
- `lint` — 0 errors. Eighteen pre-existing warnings repo-wide, none in a changed file.
- Focused tests — both new files pass.
- Adjacent suites — `instagram-oauth-admission` (4), `instagram-account-observation` (3),
  `trh21-provider-observation-history` truth+firewall and bite-proofs, `trh24-machine-observation`
  authority-firewall and bite-proofs: all pass.
- `build` — pass, 176/176 static pages.
- **The full suite was NOT completed.** It was stopped by Director instruction at 505 passed / 2
  failed of 722 files. The two failures are `agent-id-0/bite-proofs.ts` and
  `ama1-agent-mandate/bite-proofs.ts`; neither file references Instagram, `latest-observation` or
  `provider-observation` in any form. They were not re-run in isolation, so they are recorded here as
  **unattributed and outside this phase's surface** — not as pre-existing, which would be a claim
  nobody measured.

The structural firewall test is the durable half. It pins the exact query, forbids the consumer from
naming `providerObservations`, `@/db/schema`, `drizzle-orm` or any provider transport, forbids
`fetch(`, every Meta host and `revalidate`, forbids every credential symbol, forbids all time
arithmetic, bans fifteen words of trend and freshness vocabulary from the section, and asserts the
pre-existing connection block still renders line by line.

## Deployment

The project is Git-connected, so the push itself was the release trigger; no second deployment path
was created and no environment variable was touched. `vercel inspect` returns an empty `meta`, so the
commit binding came from the REST API: the READY production deployment carries
`githubCommitSha = 5d1d0c4603fd8d623e8c2e647c0a1d4e3c86ab67`, ref `main`, and both production domains
alias it. Independently, every asset the accepted page loaded carried that deployment's own id as its
`dpl=` parameter.

Unauthenticated `/integrations/instagram` returns `307 → /login`.

## Authenticated production acceptance

Performed under a real Turkish Rug House session (Owner), against the production domain.

The page returned 200 and rendered, below the untouched connection block, a subordinate section
reading:

> Latest provider observation
> This is what Instagram reported at the instant below, kept exactly as it was said. It is a record
> of one provider answer, not a statement of what this organization holds now, and Hebun derives
> nothing from it.
> Hebun observed Instagram at 2026-09-10T08:00:18.986Z

    Account Instagram named            turkishrughousecom
    Account type Instagram reported    BUSINESS
    Followers Instagram reported       56
    Following Instagram reported       83
    Media Instagram reported           8

**The rendered instant is byte-identical to the stored `observed_at`.** That equality is what proves
the source was the stored row and not a fresh call — a live read would have produced a new instant.

## What rendering did not cause — measured, not assumed

| Measure | BEFORE | AFTER |
|---|---|---|
| `provider_observations`, all tenants | 4 | 4 |
| Instagram observations, this tenant | 1 | 1 |
| Latest observation id | unchanged | unchanged |
| `observed_at` / `recorded_at` | unchanged | unchanged |
| Standing authorization | revision 1 · active | revision 1 · active |
| Integration | connected · healthy | connected · healthy |
| Credential | `oauth_access` · version 1 | `oauth_access` · version 1 |
| `audit_log` | 80 | 80 |

No audit row appeared after the BEFORE mark at all. Browser-side, all 47 requests were same-origin;
none reached `graph.instagram.com`, `api.instagram.com` or `graph.facebook.com`.

**Cadence corroborates the attribution rather than leaving it to argument.** The standing
authorization's interval is 1440 minutes and the last machine observation was at `08:00:18Z`, so the
generic hourly due-scan could not become due during the acceptance window. There was no ambiguity to
resolve between "the page did it" and "the scanner did it", because the scanner could not have.

## Tenant isolation under a shared external identity

Both tenants hold a connected Instagram integration bound to the **same external account**. Instagram
observations stand at one for Turkish Rug House and **zero** for the other tenant, and the page
rendered the one row its own tenant owns. The read is predicated on the session's tenant and joins
nothing by external account identity.

Recorded honestly: only the positive direction was exercised. The negative — that the other tenant's
session must not see this row — was not tested, because reaching it requires a workspace switch,
which issues a new session and revokes the current one. That is a production write, and this phase
was not authorized to make one.

## Security properties

- **No credential authority is reachable from the consumer.** The read seam imports drizzle, the db
  client, the observation schema, a `TenantContext` type and its own contracts. Nothing else.
- **Credential decryption during the page read is NOT directly observable**, and this document
  refuses to claim otherwise. No decrypt telemetry seam exists in this repository: the credential
  audit vocabulary is `stored / replaced / revoked / destroyed`, all lifecycle writes, never a read.
  Nothing was decrypted in order to prove that nothing was decrypted. The support for the negative is
  structural — the import graph has no path to a credential — plus the credential row's version and
  timestamps being unchanged.
- **No internal identifier reached the browser.** Zero UUIDs in the entire rendered HTML, and the
  provider's own numeric account id is absent too.
- **No trend vocabulary.** The only substring match in the rendered text was `rate` inside the word
  *separate*, in a sentence that predates this phase.

## Known limits

1. Credential-decrypt observability, above.
2. The negative direction of tenant isolation, above.
3. The full suite was not completed, above.
4. **Freshness has no owner.** The page shows an instant and refuses to judge it. Nothing says
   whether an observation is recent enough to rely on, because no authority defines that.
5. **One row, one surface.** There is no history list, no second consumer, and no get-by-id.

## What remains impossible, and what is newly possible

Newly possible: a human can read stored provider history through the product.

Still not implemented, and not made possible by this release — **Heby does not consume stored
observations**, no Heby source class was added, no evidence or grounding class was added, agents have
no access to observation history, and no observation was promoted into organizational evidence or
Knowledge. Observation → Knowledge admission remains unbuilt and, per the architecture record, would
require deliberate human ratification if ever built.

## The sentence Hebun can now truthfully say

> A human holding this tenant's session opened the tenant's own Instagram page, and Hebun showed what
> Instagram had reported at a stated past instant — read from stored history through the authority
> that already owned that read, without contacting the provider, without opening a credential,
> without spending an authorization, without writing a row, and without claiming the numbers are
> still true.

## Related

- `hebun-provider-observation-consumption-discovery.md` — the two read-only discoveries that decided
  this shape, and why observations do not become Knowledge.
- `hebun-trh21-provider-observation-history-closure.md` — the authority this consumer reuses.
- `hebun-trh-ig-instagram-standing-observation-authorization-closure.md` — the authorization whose
  exercise produced the row this page renders.
