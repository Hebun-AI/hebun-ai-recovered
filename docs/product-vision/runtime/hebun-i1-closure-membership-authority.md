# HEBUN I1 CLOSURE REPORT — MEMBERSHIP AUTHORITY

**Phase:** I1 — implementation and closure
**Phase date:** 2026-08-12
**Record written:** 2026-08-12, at the P3 commit gate — see §1.
**Scope consumed:** one enum, one table, one `governance_domain` value. No new decision type.
**Predecessors:** G2 (governance authority), G3 (delegation & revocation) — reused unchanged, neither redesigned.
**Verdict:** see §24.

---

## 1. Why this record exists, and why it is dated twice

I1 was built, proven and closed on 2026-08-12, and then **no closure document was written for it**. The
gap was found by the P3 commit gate, which audits whether the record about to be published matches the
implementation. It did not: I1.2, I2 and Tenant Selection each had a closure report; I1 and I1.1 had
none.

This document is that missing record, and it is derived from the repository rather than from memory —
contracts, runtime, schema, migration and the three test files are the sources for every claim below.
Nothing here is reconstructed from recollection, and nothing is claimed that a file does not show.

The honest consequence of writing it late: **this is a record of I1, not a snapshot taken at I1's
closing minute.** Where later phases changed what is true, §23 says so explicitly instead of quietly
presenting today's state as though it had always held.

---

## 2. The question I1 answers, and the ones it refuses

| | |
|---|---|
| **ANSWERED** | Who may permit a specific future human to be admitted to this tenant, in a named role? |
| **REFUSED** | Creating the human. Creating the invitation. Creating the token. Creating the credential. Creating the membership. Creating or changing any role. Granting any authority. |

I1 produces exactly one artifact: a durable statement that Governance has authorized **one** future
onboarding. It is a permission slip, and it is nothing else.

---

## 3. Where the authority comes from

`resolveGovernanceAuthority(tenant)` — the same G2/G3 resolver that already answers authority for
ratification, delegation and revocation. Verified repository-wide: **one definition**, in
`src/features/governance-decision/decision-authority.server.ts`. I1 consumes it and defines nothing.

What is **not** consulted for the caller's authority:

- `roles.type`
- `roles.authority_rank`
- `memberships.authority_scope`
- `permissions`, `role_permissions`
- provider state
- anything the client supplied

A tenant owner without Governance authority is refused exactly like a stranger. A revoked delegate is
refused exactly like someone who was never delegated — the resolver's `not exists` over the revocation
already says so, so I1 needed no revocation logic of its own.

**`roles.type` IS read here, but never for the caller.** It is read to decide whether the *target*
band may be onboarded into. Conflating those two questions is precisely how a role-based authority
model gets re-invented by accident, so the two reads are kept structurally apart and a test asserts it.

---

## 4. Eligible bands

```ts
export type OnboardingEligibleRoleType = "member";
export const ELIGIBLE_ROLE_TYPE_LIST = Object.freeze(["member"]);
export const ONBOARDING_EXCLUDED_ROLE_TYPES = Object.freeze(["owner", "director", "operator", ...]);
```

One band. `owner` and `director` are excluded because connected authorities already grant on them
(`KNOWLEDGE_AUTHOR_ROLE_TYPES`, `PROVIDER_CONTROL_ROLE_TYPES` are both `{owner, director}`), so
authorizing a stranger directly into either would hand out capability through the back door.
`operator` and `auditor` are excluded because no runtime defines them at all.

Widening this set is stated in the contracts as a Governance decision, not a convenience.

---

## 5. Schema delta

One migration: `20260812090301_i1_membership_authorization.sql`.

| Item | Kind |
|---|---|
| `membership_authorization_status` = `authorized / consumed / revoked` | new enum |
| `membership_authorizations` | new table |
| `governance_domain` += `'membership-authorization'` | new enum value |

**No new `governance_decision_type`.** I1 uses the existing `approve`. The domain is what
distinguishes a membership authorization from every other approval — one decision type, several
domains, and the domain carries the constitutional concern.

`roles`, `memberships`, `invitations`, `users`, `auth_identities` and `auth_credentials` are **not
altered**. A test asserts the migration's `ALTER TABLE` set contains only the new table.

---

## 6. The artifact's invariants, as database constraints

Not hopes — constraints. Each is asserted present in both the schema module and the migration by
`tests/i1-flow/boundaries-and-firewall.ts` §10.

| Constraint | What becomes unrepresentable |
|---|---|
| `membership_authorizations_one_active_per_email_uq` | two live authorizations for the same human in the same tenant (partial: `WHERE status = 'authorized'`) |
| `membership_authorizations_decision_uq` | one Governance decision producing two authorizations |
| `membership_authorizations_consumed_invitation_uq` | one invitation consuming two authorizations |
| `membership_authorizations_human_authorizer_chk` | an agent as the authorizing actor |
| `membership_authorizations_consumed_chk` | "consumed, but by nothing" and "consumed by something, but not consumed" |
| `membership_authorizations_consumed_status_chk` | status and timestamp disagreeing about consumption |
| `membership_authorizations_revoked_chk` | revocation with no time and no reason |
| `membership_authorizations_normalized_email_chk` | a stored address that is not already lower-trimmed |
| `membership_authorizations_tenant_role_fk` → `roles(tenant_id, id)` | citing another tenant's role |

The composite `(tenant_id, intended_role_id)` foreign key is the structural version of the tenant
check. The application read that precedes it exists to produce an honest refusal reason rather than a
raw constraint violation — it is not the defense.

---

## 7. The circular-reference problem, and the authorized solution

The decision must name the authorization as its subject; the authorization must name the decision as
its provenance. Both columns are `NOT NULL`. Neither row can be written first.

**Director-authorized resolution:** generate the authorization's UUID in the application
(`crypto.randomUUID`), so the decision can bind to an id before the row exists, and write both in one
transaction.

The alternative that was rejected: create an `invitations` row to obtain an id. That would have minted
token material inside an authority phase — I1 does not create tokens, and buying an identifier with
one would have made that claim false.

Nothing is fabricated. The id is a v4 UUID and the row it names commits in the same transaction or
not at all.

---

## 8. What commits together

One transaction:

```
governance session  →  `approve` decision  →  membership_authorizations row  →  audit row
```

"Decision committed but no authorization" and "authorization committed but unaudited" are
unrepresentable, not merely unlikely.

---

## 9. Refusal vocabulary

Ten members, each distinguishable, because an authority that must debug by guessing is not usable:

`unauthenticated` · `no-governance-authority` · `not-the-governance-authority` ·
`invalid-target-email` · `justification-required` · `role-unresolvable` · `role-not-eligible` ·
`no-eligible-role-in-tenant` · `already-authorized` · `persistence-unavailable`

`role-unresolvable` and `role-not-eligible` are deliberately separate: refusing to say "that role
exists but is too privileged" would make a legitimate authority guess.

`no-eligible-role-in-tenant` is separate from both, and §12 is why.

---

## 10. Email normalization is conservative on purpose

Lower + trim, then a shape gate. **No** dot-stripping, **no** plus-address folding — over-clever
canonicalization silently merges two different people, and this is a target address, not an identity.

The same normalization is enforced by `membership_authorizations_normalized_email_chk`, so the
application and the storage layer cannot disagree about what "the same human" means.

---

## 11. Concurrency

`tests/i1-flow/authorization-concurrency-postgres.ts` races two callers who are both the same
legitimate authority, against real PostgreSQL.

Result: exactly one artifact, exactly one decision behind it. The loser receives `already-authorized`,
matched on the Postgres unique-violation code **and** the constraint name — so an unrelated conflict
cannot borrow that refusal.

The pre-flight existence read is a courtesy that produces a clear message. The partial unique index is
the invariant.

---

## 12. THE ROLE-BASELINE GAP — recorded at I1, not solved by it

**This was a real, open limitation at I1's closure, and it is not erased by the fact that it is no
longer open.**

I1 refuses when a tenant holds no onboarding-eligible role. At I1's closure, both durable development
tenants held exactly one role each — `Owner`, of type `owner` — and **nothing in the repository had
ever created a role**. So I1's authority was complete and provable, and no real tenant could be
onboarded into.

The refusal is reported as its own reason, `no-eligible-role-in-tenant`, rather than folded into
`role-unresolvable`, because presenting a product absence as a user's bad input hides it.

**Creating a `member` role inside I1 would have closed the gap and hidden it.** Every fixture that
silently added one would have hidden it again in the tests. I1 refused instead, and still does:
`insert(roles)` appears nowhere in its runtime, and a test asserts it never will.

The I1-era statement is preserved verbatim in
`TENANT_ROLE_BASELINE_GAP.historicalLimitation`:

> `owner`: "none — no runtime provisions a tenant's roles"
>
> `consequence`: "I1 authority is complete and provable. Product onboarding is NOT reachable end to end until a tenant role baseline phase exists, and I2 cannot close that gap by itself."

§23 records what changed.

---

## 13. Audit behaviour

New action `governance.membership.authorized`, filed under `governance-audit/` with the other declared
sink owners. Not the generic `governance.decision.recorded` — this is the only decision that changes
**who may exist** in the tenant, and filing it generically would make the admission history
unqueryable.

Metadata carries identity and versions only, per the G1 doctrine: no email, no token, no credential,
no duplicated justification. The authorization row owns the address; the decision owns the sentence.

`decision_records.evidence` likewise carries the *shape* of what was authorized — authority source,
delegation id, intended role id and band — never the human's contact details.

---

## 14. Structural firewall — what I1 cannot reach

`tests/i1-flow/boundaries-and-firewall.ts`, twelve sections. Proven by source inspection, not by
behaviour:

- **§1** one authority resolver, and it is G2/G3's
- **§2** the caller's authority never comes from a role band or permissions
- **§3** I1 creates nothing belonging to I2 — no user, identity, credential, invitation, token, membership, role
- **§4** no provider, execution, Computer Use or terminal reach
- **§5** Heby / Voice / Knowledge cannot authorize a membership
- **§6** one new domain, no new decision type
- **§7** eligible bands derived from the real connected-authority sets, not from a literal list
- **§8** the surface may not claim what I1 does not do; contracts may not contain `guaranteed`, `fully secure`, `enterprise-grade`, `production-ready`, `seamless`
- **§11** the migration is additive and touches no protected table
- **§12** email normalization is conservative

Section 5's rule is symmetric and matters later: **I1's own module tree is also forbidden from naming
I1.1's provisioning identifiers**, so I1 cannot reach the role runtime even by accident (`tests/i1-1-flow`
§5). §23 records how this shaped the way I1 names its own successor.

---

## 15. Real PostgreSQL proof

`tests/i1-flow/membership-authorization-postgres.ts` — 27 numbered attacks against a real database.

| Attack | Result |
|---|---|
| 1 — unauthenticated actor | refused |
| 2 — ordinary member | refused |
| 3 — OWNER band without Governance authority | refused |
| 4 — bootstrap authority | **accepted** |
| 5 — active delegate | **accepted** |
| 6 — revoked delegate | refused |
| 7 — Globex's authority using Acme's role | refused |
| 8 — a foreign tenant's role | `role-unresolvable`, not "forbidden" |
| 9/10/11 — target band and existence | refused per band |
| 12 — tenant with no eligible role | `no-eligible-role-in-tenant` |
| 13-17 — forged fields (tenant, actor, status, decision id, time) | never reach the row |
| 18 — duplicate live authorization | refused |
| 19-27 — nothing else in the world changed | proven by delta counts |

Attack 8 is the tenant-isolation shape that matters: another tenant's role is **unresolvable**, not
"forbidden". A distinguishable "forbidden" would turn the role field into a cross-tenant probe.

The agent-authorizer prohibition is proven by Postgres directly, not by application code.

---

## 16. Delta counting, not absolute totals

The postgres suite snapshots row counts immediately before the act under test and asserts what *that
act* changed. Absolute totals break the moment a fixture is added earlier in the file, and a broken
assertion that gets "fixed" by updating the total is how a real regression gets absorbed.

---

## 17. Explicit non-effects, as values

`MEMBERSHIP_AUTHORIZATION_NON_EFFECTS` is a frozen list, rendered by the surface and asserted by test,
so the UI cannot drift from the truth:

does not create the account now · does not send an invitation · does not create an invitation token ·
does not create a credential · does not create a user or identity · does not create the membership ·
does not create or change any role · does not grant Governance authority · does not grant Knowledge
ratification authority · does not grant provider access or change the model kill-switch · does not
grant execution, Computer Use, or terminal authority

**There is no mail runtime in Hebun.** "Does not send an invitation" is literal.

---

## 18. Consumption is defined here and executed elsewhere

`consumed_by_invitation_id` is a foreign key to the **invitation**, so consumption happens at
issuance, not at acceptance. I1 defines the invariant and writes none of it; I2 spends it.

The column name settled a design argument that prose could not — this is recorded as a lesson in
`learnings.md` under I2.

---

## 19. UI

`src/components/governance-authority/membership-authorization-card.tsx`, on the Governance Authority
page. Renders the effect and the frozen non-effects list, the ten refusal reasons in the operator's
words, and — when the tenant has no eligible role — the role-baseline state. §23 records how that last
message changed.

The card is a client component and imports no `.server` module.

---

## 20. Session authority non-impact

I1 changed nothing about authentication or sessions. It reads `TenantContext` and refuses when there
is none. No session is issued, revoked, extended or re-pointed anywhere in the phase.

---

## 21. Migration and dependency accounting

| Fact | Value |
|---|---|
| Migrations added by I1 | 1 |
| New tables | 1 |
| New enums | 1 |
| New enum values on existing types | 1 (`governance_domain`) |
| Altered existing tables | 0 |
| New `governance_decision_type` | 0 |
| Dependencies added | **0** |
| `hebun_r1` migrated | **no** |

---

## 22. Proven vs unproven

**Proven.** Authority resolution and refusal for every actor class. Target band eligibility. Tenant
isolation. Duplicate refusal. Concurrency. Forged-field rejection. Transaction atomicity. Audit
content. Structural absence of every capability listed in §17. All against real PostgreSQL.

**Not proven.** No browser session exercised the card against the durable database, because at I1's
closure no durable tenant had an eligible role to authorize into (§12). The card's rendering is covered
by structural tests, not by a live click-through.

---

## 23. What later phases changed about this record

Recorded here rather than edited into the sections above, so the sequence stays legible.

**I1.1 Tenant Role Baseline Authority closed the §12 gap.** It provisions exactly the missing role —
one `type = 'member'` role per tenant, under a Governance decision, enforced by the partial unique
index `roles_one_member_per_tenant_uq`. **No I1 code changed, and none needed to:** I1 discovers the
new role through its ordinary eligible-role read. `tests/i1-1-flow/role-baseline-postgres.ts` proves
the handoff directly — the same call refused with `no-eligible-role-in-tenant` before provisioning and
returned `authorized` after it.

**`TENANT_ROLE_BASELINE_GAP` was corrected at the P3 commit gate.** It had continued to state
`owner: "none — no runtime provisions a tenant's roles"` and a consequence claiming onboarding was not
reachable end to end — both false after I1.1, and both **rendered on the Governance Authority page**,
directly below the control that closes the gap. The constant now separates two different facts:

| Field | Meaning |
|---|---|
| `capabilityPresent: true` | the repository *can* provision a role baseline — since I1.1 |
| `provisionedInDurableTenants: false` | the ceremony has *not been run* in `hebun_r1` |

An unexercised ceremony is not a missing capability, and the two must never be reported as one thing.
The I1-era claim is preserved verbatim under `historicalLimitation`, with `supersededBy` naming I1.1.

**I1 still refuses rather than solving it.** That invariant did not change and the test still asserts
it: I1 discovers a role, it never creates one.

**Naming constraint discovered during the correction.** `tests/i1-1-flow` §5 forbids
`src/features/membership-authority/**` from containing I1.1's runtime identifiers in code, so that I1
cannot reach the provisioning path. Naming the gap's owner therefore had to be done as an authority and
a surface — "I1.1 Tenant Role Baseline Authority — the Member Role Provisioning control" — never as an
importable symbol. The firewall was reworded around, not widened.

---

## 24. Final verdict

I1's authority was complete and provable on the day it closed, and it is unchanged today. Its one
recorded limitation was real, was reported honestly rather than papered over, and was closed by the
phase built for it.

# I1 CLOSED — MEMBERSHIP AUTHORITY READY; ROLE-BASELINE GAP RECORDED AT I1, CLOSED BY I1.1
