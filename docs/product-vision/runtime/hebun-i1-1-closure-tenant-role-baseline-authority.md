# HEBUN I1.1 CLOSURE REPORT — TENANT ROLE BASELINE AUTHORITY

**Phase:** I1.1 — implementation and closure
**Phase date:** 2026-08-12
**Record written:** 2026-08-12, at the P3 commit gate — see §1.
**Scope consumed:** one `governance_domain` value, one partial unique index. **No new table, no new enum, no new column.**
**Predecessors:** G2 / G3 (governance authority, reused unchanged), I1 (membership authority, **not modified**).
**Verdict:** see §22.

---

## 1. Why this record exists, and why it is dated twice

Like I1, I1.1 was built, proven and closed on 2026-08-12 and then **never given a closure document**.
The P3 commit gate found the omission while auditing whether the record about to be published matched
the implementation.

Everything below is derived from the repository: `contracts.ts`, `provision-member-role.server.ts`,
`src/db/schema/role.ts`, the migration, and the three test files under `tests/i1-1-flow/`. Nothing is
reconstructed from recollection.

The gate also found a second, larger problem that I1.1 itself caused and did not clean up — see §19.

---

## 2. Why this phase exists at all

I1 built a correct membership-authorization authority and then **refused every real tenant.** A
tenant's only role was the seeded `owner`, and I1 permits onboarding into `member` alone.

The gap was never in I1. It was that **nothing in the repository had ever created a role.** I1.1 is
the narrowest thing that closes it.

The alternative — letting I1 create a `member` role to satisfy its own precondition — was rejected
because it would have hidden a real product absence behind a convenience, and every test fixture that
silently added a role would have hidden it again.

---

## 3. The question I1.1 answers, and the ones it refuses

| | |
|---|---|
| **ANSWERED** | Who may establish this tenant's ordinary, onboarding-eligible `member` role? |
| **REFUSED** | Role editing, deletion, suspension, renaming, hierarchy, permissions, arbitrary role creation, and any role of a privileged band. |

---

## 4. Why this is not `membership-authorization`

Admitting a human and changing the tenant's role structure are different organizational acts.

- **I1** *names* an existing role.
- **I1.1** *creates* the one that makes naming possible.

Filing both under one domain would leave the ledger unable to distinguish "we let a person in" from
"we changed what kinds of people exist here". So `governance_domain` gained
`'organizational-role'` — a new domain, over an **existing** decision type.

---

## 5. Why this is not role administration

Exactly one role type may be provisioned, exactly once per tenant, and the database enforces the once.

There is **no name parameter, no type parameter, no scope parameter, no update path and no delete
path.** The type is a constant and the name is a constant:

```ts
export const BASELINE_ROLE_TYPE = "member" as const;
export const BASELINE_ROLE_NAME = "Member" as const;
```

"Provision an owner role" has no representation to arrive in. It is not filtered out — it is
**unsayable**. `tests/i1-1-flow/boundaries-and-firewall.ts` §3 and §12 assert this structurally, and
§12 additionally asserts no generic role writer is exposed anywhere in the repository.

The client supplies **one** thing: a human-authored justification.

---

## 6. Where the authority comes from

`resolveGovernanceAuthority(tenant)` — the same single G2/G3 resolver. No second resolver.

`roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions` and
`role_permissions` are consulted for **nothing**. Creating a role changes the organization's authority
structure, so only Governance may do it: an owner-band human with no Governance authority is refused
exactly like a stranger.

---

## 7. Schema delta — the whole of it

Migration `20260812105312_i1_1_tenant_role_baseline.sql`, two statements:

```sql
ALTER TYPE "public"."governance_domain" ADD VALUE 'organizational-role';
CREATE UNIQUE INDEX "roles_one_member_per_tenant_uq" ON "roles" USING btree ("tenant_id")
  WHERE "roles"."type" = 'member';
```

| Item | Kind |
|---|---|
| `governance_domain` += `'organizational-role'` | new enum value |
| `roles_one_member_per_tenant_uq` | new partial unique index |

**No new table. No new enum. No new column. `roles` gained no columns** — provenance is decision-side,
asserted by `tests/i1-1-flow/boundaries-and-firewall.ts` §10. No new `governance_decision_type`: I1.1
uses the existing `approve`, as I1 does, and the *domain* distinguishes them.

---

## 8. The uniqueness invariant, and why it is partial

```
roles_one_member_per_tenant_uq   UNIQUE (tenant_id) WHERE type = 'member'
```

**Partial**, so the privileged bands (`owner`, `director`, `operator`, `auditor`) stay entirely
unconstrained. A tenant may hold as many of those as its history produced, and **no seeded role is
disturbed** — attack 20 asserts the seeded owner role is byte-for-byte unchanged after provisioning.

**Why the database and not the server.** Provisioning reads "does a member role exist?" and then writes
one. Two concurrent ceremonies both read "no" and both write. The read is a courtesy; the index is the
invariant. It is also what makes I1's role choice unambiguous: "the tenant's member role" names
exactly one row, or none.

**No lifecycle predicate, deliberately.** `WHERE type = 'member'` alone, because I1.1 implements no
role deletion, suspension or revocation — nothing can move a role out of `active`. Adding
`AND lifecycle_status = 'active'` would describe a state no runtime can reach and would quietly weaken
the invariant to "one *active* member role", which is not what was authorized.

**The honest edge this phase does not solve**, stated in `BASELINE_UNIQUENESS` rather than omitted: if
a member role ever became non-active, it would still occupy the slot while I1's active-only read
stopped seeing it. No runtime can reach that state today.

---

## 9. Why no separate mutex

G3 serializes authority mutations on the tenant's bootstrap decision row, because authority is a query
over decisions with no row of its own to lock.

**That is not this invariant.** The thing that must be unique here is a `roles` row, and
`roles_one_member_per_tenant_uq` locks exactly it. Borrowing G3's lock would couple two unrelated
invariants and would still leave the index as the real defense.

---

## 10. What commits together

One transaction:

```
governance session  →  `approve` decision  →  roles row  →  audit row
```

A role with no authorizing decision, and a decision naming a role that does not exist, are both
unrepresentable. Proven by `tests/i1-1-flow/provisioning-concurrency-postgres.ts`: after a race between
two legitimate callers, exactly one role, one decision, one session, one audit row.

---

## 11. What the provisioned role means — audited, not assumed

`BASELINE_ROLE_SEMANTICS`, frozen and asserted by test:

| Grant | Value |
|---|---|
| Governance authority | `false` |
| Knowledge authoring | `false` |
| Provider control | `false` |
| Execution | `false` |
| Platform administration | `false` |
| Membership authority | `false` |
| Role administration | `false` |
| Uses permission tables | `false` |
| Uses authority rank | `false` |
| Uses policy refs | `false` |

This is not an assertion of intent. `member` appears in **no connected authority set in the
repository** — `KNOWLEDGE_AUTHOR_ROLE_TYPES` and `PROVIDER_CONTROL_ROLE_TYPES` are the only role-band
grants that exist, and both are `{owner, director}`. A test asserts that, so if a later phase ever
grants something to `member`, **this claim fails the build instead of silently becoming false.**

Attack 26 proves it at runtime: the provisioned role grants no Governance authority.

Every unused authority column on the new row stays untouched — `system_role` false because this is an
ordinary tenant role rather than a built-in; `authority_rank` and `policy_refs` left NULL because no
runtime reads them and populating them would invent an authority.

---

## 12. Refusal vocabulary

`unauthenticated` · `no-governance-authority` · `not-the-governance-authority` ·
`justification-required` · `already-provisioned` · `persistence-unavailable`

`already-provisioned` is **not an error and not a reason to make a second role.** The existing role,
however it got there, stays exactly as it is. The pre-flight read matches on `type` **without** a
lifecycle predicate, so it asks exactly the question the unique index answers — and reporting
"already provisioned" for a role I1.1 did not create is the truthful answer. A seeded role is still the
tenant's member role, and I1.1 does not rewrite history to claim otherwise.

The race loser also receives `already-provisioned`, matched on the Postgres unique-violation code
**and** the constraint name, so an unrelated conflict cannot borrow that refusal.

---

## 13. Audit behaviour

New action `governance.role.provisioned`, filed under `governance-audit/` with the other declared sink
owners. Separate from the generic decision action because this is the only decision that changes **what
kinds of member can exist** in the tenant, and it grants nothing.

Metadata carries identity and band only — no justification duplicate. The decision owns the sentence.

---

## 14. Structural firewall

`tests/i1-1-flow/boundaries-and-firewall.ts`, twelve sections:

- **§1** one authority resolver, and it is G2/G3's
- **§2** the caller's authority never comes from a role band
- **§3** this is not role administration
- **§4** no provider, execution, Computer Use, terminal or network reach
- **§5** Heby / Voice / Knowledge / **I1** cannot provision a role
- **§6** one new domain, no new decision type
- **§7** the provisioned band grants nothing, and that is audited against the real authority sets
- **§8** the surface may not claim what I1.1 does not do
- **§9** uniqueness is the database's, and it is partial
- **§10** provenance is decision-side; `roles` gained no columns
- **§11** the migration is exactly the authorized Gate B scope
- **§12** no generic role writer is exposed anywhere

**§5 includes I1 itself.** `src/features/membership-authority/**` may not contain I1.1's runtime
identifiers in code at all, so I1 cannot reach the provisioning path even by accident. This rule fired
during the P3 gate repair and shaped how I1 names its successor — see §19.

---

## 15. Real PostgreSQL proof

`tests/i1-1-flow/role-baseline-postgres.ts`. The seed is deliberate: **nobody gets a `member` role.**

| Attack | Result |
|---|---|
| 1-3 — who may NOT provision | refused |
| 4 — bootstrap authority | **provisions** |
| 5 — active delegate | **provisions** |
| 6 — revoked delegate | refused |
| 8-12 — forged fields (type, name, tenant, actor, id) | never reach anything |
| 18 — provisioning twice | refused, and mutates nothing |
| 20 — the seeded owner role | byte-for-byte unchanged |
| 21-30 — nothing else in the world changed | proven by delta counts |
| 26 — the provisioned role grants Governance authority | **no** |
| — Tenant A's I1 targeting Globex's role | refused |

---

## 16. The I1 handoff — the supersession, proven

This is the section that makes I1's recorded limitation historical rather than current.

The same test file drives **I1** across the boundary:

| Moment | `authorizeMembership` result |
|---|---|
| before provisioning | `refused` / `no-eligible-role-in-tenant` |
| after provisioning | `authorized` |

Test assertion, verbatim: *"I1 must now succeed against the provisioned role"*.

**No I1 code changed.** I1 discovers the new role through its ordinary eligible-role read. The gap
closed because a role now exists, not because I1 was taught anything.

---

## 17. Reads are authority-gated too

`readRoleBaselineState` resolves Governance authority before returning anything. A non-authority learns
nothing about the tenant's role structure from this surface — it receives
`viewerIsGovernanceAuthority: false` and a null role id.

The Governance Authority page renders the provisioning card **only** when the viewer is the authority.

---

## 18. Explicit non-effects, as values

`ROLE_BASELINE_NON_EFFECTS`, frozen, rendered by the surface and asserted by test:

does not add a human · does not create a membership · does not create an invitation · does not create a
credential, user, or identity · does not grant Governance authority · does not grant Knowledge
authoring authority · does not grant provider access or change the model kill-switch · does not grant
execution, Computer Use, or terminal authority · does not change the owner role, or any existing role ·
does not create permissions or a role hierarchy

---

## 19. What I1.1 did not do, and the P3 gate had to finish

**I1.1 closed I1's documented limitation and did not update I1's record of it.**

`TENANT_ROLE_BASELINE_GAP`, in `src/features/membership-authority/contracts.ts`, continued to state:

- `owner: "none — no runtime provisions a tenant's roles"` — **false** the moment I1.1 shipped
- a consequence claiming product onboarding was "NOT reachable end to end until a tenant role baseline
  phase exists" — **superseded** by this very phase

Both were **rendered on the Governance Authority page**, in the card sitting directly below the Member
Role Provisioning control that closes the gap. And `tests/i1-flow/boundaries-and-firewall.ts` asserted
the stale strings were still present, so the full suite stayed green *because* the stale claim was
intact.

This is the inverse of capability inflation — understating what Hebun can do — and it is equally a
false record.

The repository's own doctrine, already recorded in `learnings.md` under Tenant Selection, says what
should have happened:

> *"When a phase resolves an earlier phase's documented limitation, invert the fixture and say so."*

Tenant Selection did that for I2. **I1.1 did not do it for I1.** The P3 commit gate did, and the
corrected constant now separates the capability (`capabilityPresent: true`, owned by I1.1) from the
deployment fact (`provisionedInDurableTenants: false`), preserving the I1-era claim verbatim under
`historicalLimitation`.

---

## 20. Capability versus deployment — the distinction this phase must keep

| Fact | Value |
|---|---|
| Can Hebun provision a tenant's role baseline? | **yes**, since I1.1 |
| Have the durable `hebun_r1` tenants run the ceremony? | **no** |
| Has `hebun_r1` been migrated for P3? | **no** — 20 applied migrations, unchanged |
| Therefore both durable tenants still hold only `Owner` | **yes** |

A tenant that has not run the ceremony still gets `no-eligible-role-in-tenant` from I1. That is an
**unexercised ceremony, not a missing capability**, and the two must never be reported as one thing.

---

## 21. Migration and dependency accounting

| Fact | Value |
|---|---|
| Migrations added by I1.1 | 1 |
| Statements in it | 2 |
| New tables / enums / columns | **0 / 0 / 0** |
| New enum values on existing types | 1 (`governance_domain`) |
| New `governance_decision_type` | 0 |
| Existing rows modified | **0** |
| Dependencies added | **0** |
| `hebun_r1` migrated | **no** |

**Proven.** Authority resolution and refusal for every actor class. Constant-only role shape.
Uniqueness under concurrency. Forged-field rejection. Seeded-role immutability. Transaction atomicity.
The I1 handoff across the boundary. All against real PostgreSQL.

**Not proven.** No browser click-through against the durable database — `hebun_r1` was never migrated
for P3, so the ceremony has not been run there (§20).

---

## 22. Final verdict

I1.1 is the narrowest capability that closes I1's recorded gap: one governance domain, one partial
unique index, one constant-shaped role, no new table, and no change to I1. Its one failure was
bookkeeping rather than authority — it left I1's superseded limitation standing as current truth, on a
live Governance surface, and the P3 commit gate corrected it.

# I1.1 CLOSED — TENANT ROLE BASELINE READY; CAPABILITY PROVEN, DURABLE CEREMONY NOT RUN
