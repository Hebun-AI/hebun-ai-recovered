# Tenant Zero Production Bootstrap — Closure

**Status:** RELEASED. Execution of already-released ceremonies — **zero schema, zero migration, zero new authority, zero canonical write.**
**Suite:** 414 passed, 0 failed. Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean.
**Canonical:** `hebun_r1` byte-identical — 31/31 ledger, 57 tables, all 20 non-zero counts unchanged.
**Production:** the first real Hebun organization exists. **Provider DISARMED. No Governance decision.**

Fifth gate of the Platform Operator Foundation, and the first that changes the world rather than the code. G1 gave production a provenance vocabulary; G2 stopped the fiction reaching a real tenant; G3 stood the infrastructure up; G4 bound the ceremonies to the production target; G5A gave an empty deployment its first person; G5A.1 gave that person one escape hatch. G5B spends all of it.

---

## What this gate is

The controlled execution of six already-released seams, in dependency order, against the production Neon target. **No file in `src/` or `scripts/` changed to make it possible.** The only repository change is an unrelated copy defect this gate happened to be the first to see.

**It invents no authority.** Identity still owns `users` and `auth_identities`. Credential still owns the password. R4A still owns tenant provisioning. G2.1 still owns nomination and acceptance. Session still owns login. Nothing here is a second writer of anything.

**Prepared is not executed, and executed is not successful.** G4's correct result was *ready, and nothing provisioned*. G5B's correct result is *provisioned, and provably nothing more*.

## The chain, and who owned each write

| # | Act | Authority | Root | Rows |
|---|---|---|---|---|
| 1 | First human | Identity + Credential, orchestrated by G5A | deployment possession | `users` 1, `auth_identities` 1, `auth_credentials` 1 |
| 2 | Credential proof | the real `/login` | the human's own password | `user_session_contexts` 1 (pre-tenant) |
| 3 | Tenant Zero | R4A tenant provisioning | deployment possession | `companies` 1, `roles` 1, `memberships` 1 |
| 4 | Genesis nomination | G2.1 nomination ceremony | deployment possession | `genesis_nominations` 1 (`pending`) |
| 5 | Workspace selection | Session authority | the human | 1 revoked + 1 tenant-bound session |
| 6 | Genesis acceptance | G2.1 in-product acceptance | **the authenticated human** | `genesis_nominations` → `accepted`, `audit_log` 1 |

Nine tables hold rows. **Forty-eight of fifty-seven are still zero.**

## The one thing that had to happen in the right order

**Tenant Zero permanently retires G5A.1.** The recovery window is `users = 1 AND companies = 0`; the moment a company row exists the released guard returns `bootstrap-window-closed` on every future run, with no flag that reopens it. So the bootstrap credential had to be proved *known-good before* the tenant existed, not after.

It was proved through the real product, which is the strongest available form and cost nothing extra: signing in before the tenant existed reaches `onboarding-required` — a page only reachable *after* scrypt verification succeeded — and simultaneously demonstrated the honest pre-tenant state. Had it failed, the credential was still rotatable. It did not fail.

Measured on both sides of the boundary, by calling the released `resolveRecoveryEligibility` and never the rotation:

```
before tenant  {"eligible":true, "reason":null,                   "humanCount":1,"companyCount":0}
after  tenant  {"eligible":false,"reason":"bootstrap-window-closed","humanCount":1,"companyCount":1}
```

## Possession is a SOURCE; the human is an ACTOR — visible in one row

`genesis_nominations` is the only production row written by both roots, and it records the difference in its own columns:

- `created_by` / `created_by_type` — **NULL**. A terminal nominated; a terminal is not a person.
- `updated_by` / `updated_by_type` — **the human / `human`**. A person accepted.
- `nomination_source` — `production-operator-ceremony`, the G1 vocabulary, naming the root rather than the operator.

Every possession-written row in production carries NULL actor columns: `users`, `auth_identities`, `auth_credentials`, `companies`, `roles`, `memberships`. `companies.provisioning_source` is `production-operator-ceremony`.

**Production's entire audit history is one row**, and it is the acceptance — `governance.genesis-nomination.accepted`, `actor_type=human`, `authority_source=membership`, `result=committed`, `simulation=false`, its `session_context_id` equal to the nomination's `accepted_session_context_id`. Four ceremonies ran before it and wrote nothing, exactly as each one's header promises.

## Accepted Genesis is an entitlement, not authority

This is the claim most easily overstated, so it is pinned by state rather than by prose.

`consumed_at` and `consumed_by_decision_id` are **NULL**. `governance_sessions` = 0. `decision_records` = 0. Reading `bootstrap-authority.server.ts`, Governance authority is established by a *separate* in-product act — `establishGovernanceAuthority` — which spends the accepted entitlement in one transaction against a human-authored justification, guarded by `decision_records_one_bootstrap_per_tenant_uq` and `decision_records_bootstrap_human_chk`.

So Tenant Zero today has: a human, a tenant, an owner role, a membership, a working session, and an **unspent** genesis entitlement. It does not have Governance. The product says so itself.

## What Heby can ground from Tenant Zero: nothing, correctly

Heby's Executive Overview grounding reads the Director dashboard adapter, which is seeded from compiled-in mocks. Production auth resolves `configured`, so `resolveMockSurfaceGate` withholds with reason `real-tenant-reachable` and every section arrives `unavailable`, count zero.

That is G2 working, not a defect: Heby has **no organizational state to reason over for Tenant Zero**, which is the truth, and it says so rather than treating the withheld zeroes as a measured empty organization. No path connects `companies`, `memberships` or `genesis_nominations` to Heby's source resolver. Connecting one is a capability, not a repair, and belongs to a later gate.

## Bite-proofs

All executed against production **without mutating it** — each refuses before its prompt, and counts were identical before and after.

| | Boundary | Result |
|---|---|---|
| A | second first human | REFUSED with a **different** email — the one-shot guard, not email uniqueness |
| B | G5A.1 after Tenant Zero | `bootstrap-window-closed`, permanently |
| C | duplicate tenant slug | REFUSED — "it never renames, re-points, or otherwise modifies an existing one" |
| C2 | tenant for an unknown human | REFUSED — provisioning does not create people |
| D | wrong cluster pin / wrong database pin | REFUSED, nothing read from any application table |
| E | leading-space signal / unpinned target / production signal + loopback | REFUSED, never downgraded to local |
| F | provider | `provider_connectivity_controls` = 0, no arming path exercised |
| G | anonymous Genesis | `/governance/genesis` → 307 `/login`; the action takes **no arguments** |
| I | mock leak | gate withheld, `real-tenant-reachable` |

**Honest limitation, not a proof:** tenant provisioning is **not one-shot**. Its contract is slug uniqueness, not "exactly one tenant" — a different slug with this same human would create a second tenant. That was not tested, because testing it would mean creating one.

## The repository change

One live user-facing sentence was false, and the first human ever to sign in to production is the one who saw it.

`PRE_TENANT_RECEIPT.grants` is the noun phrase `"nothing — no tenant, no membership, no role, no authority of any kind"` and `diesWhen` is the clause `"a workspace is chosen, or it expires"`. The single call site interpolated both **without their verbs**, rendering:

> This sign-in step nothing — no tenant… It a workspace is chosen, or it expires.

Classification **A — implementation defect inside an existing authority.** The fix adds two words at the seam.

The existing test asserted `PRE_TENANT_RECEIPT.grants` matches `/nothing/` and passed throughout, because **both values were correct and the sentence was not**. A vocabulary test cannot catch a composition defect. The added assertions pin the verbs at the seam where fragments become prose, and were proved to bite by reverting the source line and watching them fail.

## Accounting

**Production tables mutated, by act:**

| Act | Tables |
|---|---|
| first human | `users`, `auth_identities`, `auth_credentials` |
| login (pre-tenant) | `user_session_contexts` |
| tenant provisioning | `companies`, `roles`, `memberships` |
| genesis nomination | `genesis_nominations` |
| workspace selection | `user_session_contexts` |
| genesis acceptance | `genesis_nominations`, `audit_log` |

No table outside that list changed. No provider, execution, permission, Knowledge, artifact, recipient, or Computer Use row exists.

**Canonical:** `hebun_r1` byte-identical before and after — cluster `7674184383128933041`, ledger 31 / digest `212559d177d44b3f15aeaa0df78e6799`, 57 tables, every count unchanged. No disposable database residue.

## What G5B did not do

No schema. No migration. No new route, server action, script, or environment variable. No second authority. No Governance decision. No provider arming. No Heby connection. No G6.

## The exact G6 entry condition

Tenant Zero holds an **accepted, unspent** genesis entitlement. G6 begins when the authenticated first human spends it through `establishGovernanceAuthority` at `/governance/authority`, creating the tenant's first governance session and its one bootstrap decision, and setting `consumed_at` / `consumed_by_decision_id` on the nomination.

Until then production has an organization and no government.
