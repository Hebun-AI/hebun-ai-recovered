# G3 — Governance Authority Delegation & Revocation

**Status: IMPLEMENTED. Zero migrations.**
Director cleared Gate A on 2026-08-11 with **A1-c / A2-a / A3-a**. Gate B never fired.

The gate analysis that produced those questions is kept at
[g3-governance-delegation-gate.md](g3-governance-delegation-gate.md); this document is what was built.

---

## What changed

Governance authority is no longer locked to one human for the life of a tenant. It moves the only
way `governance.ts` ever permitted — by a durable Governance decision.

```
BEFORE G3   authority(T) = { bootstrap actor }                       permanently
AFTER  G3   authority(T) = { bootstrap actor }                       permanently (A2-a)
                         ∪ { H : ∃ delegate-authority → H,
                                 with no revoke naming that decision }
```

Formally, and this is exactly what the resolver computes:

```
H holds Governance authority in tenant T  ⟺
    H is the actor on T's bootstrap decision
  OR ∃ committed `delegate-authority` decision in T whose subject is H
     AND NOT EXISTS a committed `revoke` decision in T naming that delegation
```

The chain terminates at the bootstrap decision → G2.1's consumed entitlement → deployment
possession. Nothing is inferred from a role, a permission, a membership scope, or a provider setting.

---

## The Director's policy, as code

`AUTHORITY_REVOCATION_POLICY` in `delegation-contracts.ts` holds the Gate A answers as frozen values
a test asserts, so the constitutional choice lives somewhere readable rather than scattered through
conditionals:

| value | meaning |
|---|---|
| `bootstrapMayRevokeAnyDelegation: true` | A1-c — genesis is the tenant's root |
| `delegateMayRevokeOwnGrantsOnly: true` | A1-c — accountability follows the grant |
| `delegateMayRevokePeerGrants: false` | A1-c — peers cannot depose peers |
| `bootstrapAuthorityRevocable: false` | A2-a — genesis is constitutional |
| `bootstrapAuthorityTransferable: false` | A2-a — transfer is a separate phase |
| `zeroAuthorityTenantReachable: false` | A3-a — a consequence of A2-a, not a separate rule |

**A2-a is structural, not a check.** A revocation's subject is a `delegate-authority` decision. The
genesis is a `certify` decision with `bootstrap = true`, so it cannot be named. The
`bootstrap-not-revocable` refusal exists to say so honestly, not to be the thing that prevents it.

---

## Zero migrations, and no second source of truth

| what was needed | how it was already there |
|---|---|
| a delegation decision type | `delegate-authority`, existing enum, previously unwired |
| a revocation decision type | `revoke`, existing enum, previously unwired |
| a domain that owns authority | `authority-delegation`, already used by the genesis session |
| a subject that is a human | `subject_type` is `text`; `'user'` + `users.id` |
| a subject that is a decision | `subject_type` = `'governance_decision'` + the decision id |
| mandatory reasons | `decision_records.justification` is already NOT NULL |
| authority history | the decisions themselves; revocation is a `NOT EXISTS`, not a status column |

**The mutex is a row that already existed.** Every tenant has exactly one bootstrap decision,
guaranteed by G2's `decision_records_one_bootstrap_per_tenant_uq`. Every authority mutation takes
`SELECT … FOR UPDATE` on it, which serializes delegation and revocation per tenant without inventing
an active-authority table that would then need keeping in sync.

Both ceremonies **re-resolve the caller's authority inside that lock**. The pre-flight read informs
the refusal wording; it is never the authority.

---

## Provenance

Every question the brief asked is answered from columns, by `readAuthorityRoster`:

which tenant · which human · which decision granted it · which human granted it · how the grantor
held authority at that moment (`evidence.grantorAuthorityVia`, `authority_source_actor_id`) · since
when · revoked or not · by which decision · by whom · with what stated reason.

Revoked delegations are a join, not a tombstone: the delegation row is never touched, so history
reads as *"delegated at T1 by A, revoked at T2 by A"* forever.

---

## What was built

| artifact | what it is |
|---|---|
| `governance-decision/delegation-contracts.ts` | vocabulary, the Gate A policy as values, consequence text |
| `governance-decision/authority-delegation.server.ts` | both ceremonies, the mutex, the candidate reader |
| `governance-decision/decision-authority.server.ts` | the SAME resolver, extended in place, + the roster reader |
| `governance-decision/contracts.ts` | two audit actions; `POST_BOOTSTRAP_AUTHORITY_MODEL` corrected |
| `governance/authority/actions.ts` | two server actions, each taking a target and a reason |
| `components/governance-authority/authority-roster-card.tsx` | the surface |

**One resolver.** A structural test asserts exactly one `resolveGovernanceAuthority` definition
exists in the whole tree. Because K4 already called it, a delegate could ratify Knowledge with **no
K4 change at all** — proved end to end, including that a revoked delegate cannot.

---

## Proven against a real database

The brief's fifteen mandatory policy cases all pass, plus the attack list. Highlights:

- an **owner-band** peer (the strongest role in the product) can neither delegate nor revoke nor
  ratify — the shortcut this whole chain has refused since G2;
- `C` cannot revoke `A→B`, and cannot revoke any grant it did not make (A1-c);
- **nobody** can revoke the genesis, including the genesis human (A2-a);
- a revoked delegate cannot delegate, revoke, or ratify — but **the ratification they made while
  authorized still stands**, because revocation is not retroactive;
- revocation leaves authentication, membership and role untouched;
- another tenant's authority and history are invisible.

**Concurrency, deterministically.** Four races, each staged with two real connections and a third
watching `pg_stat_activity` until the second transaction is genuinely blocked on the mutex:
double delegation → the loser sees the winner and refuses; delegation-vs-revocation → an actor
revoked while waiting cannot delegate; duplicate revocation → the second refuses. Final state has no
human holding two active delegations, and audit/decision parity holds.

**Browser, on a disposable DB with real D1 logins.** Dave with no authority: no controls, truthful
message. A delegates with a reason → persists with provenance → Dave signs in and **ratifies a
Knowledge version**, attributed to Dave with `authority_source` tracing to Alice → A revokes → Dave
loses the controls, his ratification remains, and the revoked delegation stays visible in the record.
375 / 768 / 1280 all render with zero horizontal overflow.

---

## Limitations

1. **Delegation prevents stranding; it cannot cure it.** If a tenant's bootstrap human becomes
   unavailable *without having delegated first*, nobody can ever delegate — only an authority can
   create one. This is A2-a's accepted cost, and authority transfer is a separate Director phase.
2. **No partial scopes.** A delegated authority holds the same Governance capability as its grantor.
   Hebun implements no approve-only, ratify-only, or domain-scoped Governance permission, and G3
   invented none.
3. **No escalation, suspension, or appeal.** Those remain enum values with no runtime.
4. **aal1**, inherited from the whole chain.
5. **Authority is a query, not a cache.** Correct and race-safe, but every authorization check reads
   `decision_records`. At present scale this is a two-row lookup; a tenant with thousands of
   historical delegations would want an index review before it becomes a hot path.
6. **A revoked delegate keeps their session.** Revocation takes effect on their next request, because
   authority is resolved per request rather than stamped into the session. Nothing they already
   decided is undone.

---

## Firewalls

- **Heby** cannot delegate, revoke, or reach the modules — no command, tool, or voice path.
- **Knowledge** still consumes Governance and never owns it; K4 was not modified.
- **Providers / execution / Computer Use / terminal / Marketplace / R2F** untouched; kill-switch OFF.
- **History** is never mutated or deleted; no G3 file contains an update or delete of a decision.
