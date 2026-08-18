# R5.1 — Global Provider Control Authority Correction (Closure)

**Released at:** `3eed914` → this commit
**Tag:** `hebun-global-provider-control-authority-complete`
**Schema:** ZERO changes. Canonical stays 30 / 30 / 30.
**Tests:** 400 / 400 (398 baseline − 1 removed + 3 added).

---

## The invariant

> No tenant-scoped role may mutate a root-scoped provider connectivity control.

That is the whole phase. One contradiction, closed.

---

## What was wrong

`provider_connectivity_controls` spreads `rootColumns`. It has **no `tenant_id`**, and
`provider_connectivity_controls_provider_key_uq` makes exactly one row exist per provider key for
the entire deployment. One row governs every tenant.

Its only writer was a server action gated by `resolveProviderControlAuthority`, which resolved the
acting role with:

```
.where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)))
```

That predicate is deliberately tenant-confining — it exists so a client cannot claim a role in
another tenant — and `roles.tenant_id` is `NOT NULL`, so the authority it produces is tenant-scoped
by construction. **A tenant-confined authority was gating an unconfined write.**

Canonical carried the evidence, not merely the hypothesis: the live row's `updated_by` belonged to
`bob@globex.test`, whose only membership is in Globex, and the row he had moved 29 times governs
Acme too. The same gate covered `external-send`, so one tenant's owner could also arm or disarm
outbound sending for every tenant.

---

## Why the global scope stayed

The scope was never the defect. One deployment holds one provider account, one credential, one
model configuration and one runtime — so there is exactly one thing to turn off. Making the control
tenant-scoped would have modelled a per-tenant fact over a substrate with no per-tenant dimension,
and would have left the account-level emergency OFF with no home at all.

What was wrong was **who may write it**.

---

## What replaced it

The write moved to a deployment-possession ceremony, matching R4A / R4B / G2.1 / D1.1 exactly:

```bash
npm run provider:connectivity -- <provider-key> enable|disable
```

- `scripts/lib/provider-connectivity.ts` — semantics over a raw `pg.Client`, provable against a
  disposable database without driving a prompt.
- `scripts/provider-connectivity.ts` — the CLI, with four guards: `NODE_ENV !== production`,
  `assertLocalDatabaseUrl`, interactive TTY, and a retyped provider key.

The vocabulary is **closed and imported, never re-declared**: `CLAUDE_PROVIDER_KEY` and
`EXTERNAL_SEND_PROVIDER_KEY` are the only two provider-key constants the repository defines, so a
third key has no constant to come from.

---

## Why the capability was removed, not merely uncalled

Deleting the caller would have left the seam for the next caller to find. Instead the write
capability itself is gone from `src/`:

- `setClaudeDirectorEnabled` — removed
- `setExternalSendDirectorEnabled` — removed
- `ProviderConnectivityControlRepository.setDirectorEnabled` — removed; the repository is read-only
- `src/app/(dashboard)/platform/actions.ts` — deleted (both actions)
- `src/features/heby-provider-ops/provider-authority.server.ts` — deleted (no other consumer)

This makes the firewall assertion mechanical rather than a caller census: **no file under `src/`
performs an INSERT, UPDATE or DELETE against `provider_connectivity_controls`.** A caller census is
only true until the next file is added; this is true of the codebase.

---

## What did NOT change

- **Reads.** `resolveClaudeDirectorEnabled`, `resolveExternalSendEnabled` and both dispatch gates are
  untouched — still global, still tenant-blind, still fail-closed, still read in the same position
  (external-send still reads twice per attempt).
- **R3B's configuration refusal.** It moved *with* the write rather than being dropped: enabling
  `external-send` is refused unless credential, sender and subject are all present, using this
  feature's own `isExternalSendConfigured` — not a second copy that could disagree. Disarming stays
  unconditional, because a kill switch that could not be turned off under a degraded configuration
  would be the wrong failure direction.
- **R2F.1.** Untouched. Usage aggregation keeps its `tenant_id` SQL predicate, stays read-only, and
  still filters on the `live` transport.
- **Schema.** No column, constraint, table, enum or migration. The only edit to a schema file is
  comment text.
- **Security workspace.** Still observation-only — zero server actions.
- **Impersonation.** Still none.

---

## The UI says so instead of hiding the control

Both cards are read-only, and neither renders a disabled button. A hidden or greyed control implies
the viewer merely lacks a permission somebody else holds. **Nobody holds this one in-product** — the
write left the application entirely. A disabled button would be the lie; the sentence naming the
ceremony is the truth.

---

## Deployment possession — its limits, stated

It is **not** a platform admin, **not** a platform operator, **not** a Governance authority, **not** a
tenant owner or director, and **not** an authenticated Hebun principal. Hebun cannot
cryptographically identify the human at the terminal and does not pretend to.

That is exactly why `updated_by` is written as **NULL**. The column is nullable and there is no
verified actor to name; recording a session user would be a claim no human made. `updated_by_type`
is likewise left untouched.

---

## Why production has no write path, and why that is correct

All three sibling ceremonies refuse `NODE_ENV=production`, refuse a non-local database, and refuse a
non-TTY stdin. This one does too. So **production currently has no way to change global provider
connectivity at all.**

That is the fail-closed direction: `director_enabled` defaults to `false`, and every reader treats an
absent row, an unconfigured database and a read error as disabled. The absence of an authority can
never accidentally *enable* a provider.

It is also a deliberate forcing function. When production arrives, the platform-operator decision has
to be made explicitly, rather than being smuggled in by leaving a tenant-scoped role in charge of a
global switch.

---

## Recovery — the load-bearing proof

R4B suspension makes every tenant-scoped authority unreachable: a suspended tenant's session cannot
resolve, so an in-app control would be unusable in exactly the situation an operator most needs it.

`tests/r5-1-flow/ceremony-postgres.ts` seeds two tenants, suspends **both**, asserts zero active
tenants remain, and then flips the global control in both directions. The ceremony depends on no
`TenantContext`, no membership, no role, and no healthy provider runtime.

---

## What R5.1 deliberately did NOT solve

- **No audit row** for the transition. A terminal has no actor to attribute, and inventing one would
  put a claim in the ledger that no human made. Asserted as *no delta across one transition*, not as
  `= 0`.
- **No actor-type provenance.** `updated_by_type` is still never written, so a human-only CHECK on
  this table remains impossible today.
- **No platform operator, no `platform-admin`.** That value stays exactly what it was: a CHECK
  allowance and a TypeScript union with zero writers. All 17 canonical audit rows remain
  `authority_source = membership`.

Both of the first two belong to **R5.2 — Global Provider Control Audit Hardening**, in that order:
populate `updated_by_type` first, then constrain it, because the constraint would otherwise reject
every write.

---

## Remaining limitations

1. Production cannot change provider connectivity (above — intentional, fail-closed).
2. The global control still produces no audit trail (R5.2).
3. A human-only DB constraint on this table is still impossible (R5.2).
4. Per-tenant provider entitlement does not exist and was not built — there is no per-tenant
   credential underneath it, and no consumer for it (both tenants are `plan=free`, no billing).
5. Platform-imposed resource ceilings remain blocked on an authority that does not exist.
6. Production tenant lifecycle and provisioning remain deployment-possession, local-only.

---

## Three questions

**What did we learn?** An authority and the thing it authorizes must have the same scope, and the
join predicate is where that is visible: `and(eq(roles.id, …), eq(roles.tenantId, …))` was doing its
job correctly — confining the role to one tenant — while the row it protected was confined to none.
When those disagree, widening the authority is the tempting fix and the wrong one; moving the write
out is the smaller and more honest change.

**How does this improve Turkish Rug House?** When the business runs on Hebun, one shop's owner can no
longer stop every other shop's AI — and the switch that stops a runaway provider bill still works
when every tenant is locked out.

**How does this become part of Hebun AI?** The ceremony pattern now covers three constitutional acts
(tenant birth, tenant lifecycle, provider connectivity) with identical guards. Anything root-scoped
that a tenant role should not own has an established place to go.
