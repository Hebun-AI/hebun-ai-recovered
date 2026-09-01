# OSA-2 — Organization Structure Authority Production Acceptance · Closure

**Era III, second program, second and final milestone.** The Organization Structure Authority is
exercised end to end against the real control plane, by a human, in production.

**Baseline:** `main` at `9e67d9d`, equal to real `origin/main` by `git ls-remote`.
**Production migration ledger:** **40 → 41**.
**Released at:** `8624f62` — one truth repair the acceptance itself forced.

---

## 1 · What OSA-2 is, in one sentence

> A real organization recorded that a part of itself exists, named the human accountable for it, and
> every surface that speaks about structure — the Organization page, Heby, Live Map — said the same
> true thing about it afterwards.

This is an **acceptance milestone**. No authority was created, no schema was authored beyond
applying the released migration, and the structural gate sits exactly where OSA-1 put it.

## 2 · The pins

```
DEPARTMENT OWNER != GOVERNANCE AUTHORITY   DEPARTMENT OWNER != APPROVER
DEPARTMENT       != TEAM                   RECORDED         != AUTHORIZED
STRUCTURE        != PERMISSION             COUNTED          != DRAWN
UNAVAILABLE      != EMPTY                  DEPLOYED         != MIGRATED
CARRIED          != DENIED                 WORKSPACE AVAILABILITY != HEBY AVAILABILITY
```

The last two are new here. Both were learned the hard way at this gate — see §9.

## 3 · Production migration

Run by the Director at a TTY via the released `platform:migrate`. It refuses piped stdin by design
and no attempt was made to bypass it.

| | before | after |
|---|---|---|
| ledger applied | 40 | **41** |
| prefix verdict | `pending` (1) | **`converged`** |
| digest | `2a9522bb36ca3d8406efc4abc0ef3088` | **`42186bb31b22a719a9b57b528ed42161`** |
| target | cluster `7675444875863894887`, database `neondb` | unchanged |

Convergence was **re-verified independently** after the ceremony rather than taken from its report:
the released `verifyCanonicalMigrationPrefix` was run against production and returned `converged`,
41 applied, by per-file sha256 — not by count.

**The migration was additive-only, and that is measured rather than asserted.** `departments`
carried 20 columns before and 20 after; the public base-table count was 63 before and 63 after; no
`CREATE TABLE`, no `DROP`, no `INSERT`. Nine statements: two unique indexes, five CHECKs, one FK
replaced.

**A pre-flight catch, repeated from AMA-4.** Local `pg_dump` was 14.20 against a server at 18.6,
which `createValidatedBackup` refuses as `pg_dump-too-old` before the confirmation prompt.
`postgresql@18` was installed and simply not first on `PATH`. The gate fired correctly.

## 4 · Production schema truth

Every released OSA constraint verified present **and validated** on the real schema.

| constraint | production |
|---|---|
| `departments_tenant_id_uq` | UNIQUE `(tenant_id, id)` — valid, live |
| `departments_tenant_slug_active_uq` | UNIQUE `(tenant_id, slug)` **WHERE `lifecycle_status = 'active'`** |
| `departments_no_second_parent_chk` | `CHECK (organization_id IS NULL)` — validated |
| `departments_human_owner_chk` | `CHECK (owner_actor_type IS NULL OR = 'human')` — validated |
| `departments_owner_pair_chk` | validated |
| `departments_name_chk` / `_slug_chk` | validated |
| `agents_tenant_department_fk` | `(tenant_id, department_id) → departments(tenant_id, id)`, `ON DELETE RESTRICT` |
| old `agents_department_id_departments_id_fk` | **absent** — 0 rows in `pg_constraint` |

**The anchor is load-bearing, not decorative.** `agents_tenant_department_fk` resolves through
`pg_constraint.conindid` to **`departments_tenant_id_uq`**. The cross-tenant guard OSA-0 named as its
strongest risk physically depends on the tenant anchor, and that dependency was read out of the
production catalog rather than inferred from the migration file.

**No negative was proved by corrupting production.** Enforcement is proved by the repository's
integration tests; production acceptance proves the constraints EXIST on the real schema. No
violating write was attempted, in a transaction or otherwise.

## 5 · The real department

Created by the Director through `/director/organization`, on the released `DepartmentStructurePanel`
above the mock disclosure line. Two human acts: record, then set accountable.

```
id                 e40866a8-deb1-416e-a3fd-47b4dcce809f
tenant             f625b683-…  (Tenant Zero, "Hebun AI")
name / slug        Engineering / engineering
lifecycle_status   active
organization_id    NULL
owner_actor_type   human
owner_actor_id     d5b496df-…  (the real existing human, active member)
manager_actor_*    NULL / NULL
version            2   (recorded at 1, owner-set to 2)
```

Two audit rows, both `result: committed`, `simulation: false`, `source: organization-domain`,
`authority_source: membership`: `organization.department.created` and
`organization.department.owner-set`.

**No Governance decision was written.** `decision_records` stood at 6 before and 6 after, which is
OSA-1's design followed through: recording structure is gated on the tenant's existing Governance
authority and audited in the same transaction, and writes no decision row.

## 6 · Product truth acceptance

| probe | result |
|---|---|
| Organization surface | the department renders as authoritative, above the mock line |
| Heby (Command) — *"Who owns Engineering?"* | **answered from the authoritative record**, naming the owner as the identifier `d5b496df-…` and explicitly declining to resolve it to a human name |
| Heby (Command) — *"Who owns Marketing?"* | **not present in the available Organization data**; Engineering correctly reported as the only recorded department |

The refusal for the unrecorded department reached for nothing: no seeded agent, no mock department,
no role, no Knowledge document, no email address.

**The three states stayed three.** `available + one department`, `available + zero departments` and
`authority unavailable` each carry a distinct released sentence, and the empty state was measured
against production *before* the department was created, so the distinction is a delta and not a
claim.

## 7 · Live Map

Verified against the released OSA-1 contract only. No rendering was added.

| domain | before | after |
|---|---|---|
| `structure` | `known-empty` — "recorded no departments" | `known-empty` — "recorded **1 department in service** … drawing them as map nodes is a later milestone" |
| `structure` nodes | 0 | **0** |
| edges | 1 | **1**, identical |
| `people` | `no-authority` | `no-authority` — **unchanged** |

No structural `no-authority` claim, no invented department node, no invented edge, no implied human
roster. The one edge is the pre-existing `agent belongs-to organization`, whose own basis text
disclaims departmental placement.

## 8 · Durable delta

| surface | pre | post | delta |
|---|---|---|---|
| migration ledger | 40 | 41 | **+1** intended |
| departments | 0 | 1 | **+1** intended |
| audit_log | 35 | 37 | **+2** intended |
| agents | 1 | 1 | 0 |
| agents `department_id` non-null | 0 | 0 | **0** |
| decision_records | 6 | 6 | **0** |
| governance_sessions | 6 | 6 | **0** |
| action_permits | 1 | 1 | **0** |
| action_execution_attempts | 1 | 1 | **0** |
| executions | 0 | 0 | **0** |
| companies / users / memberships | 1/1/1 | 1/1/1 | **0** |

Only **two** audit rows exist in the entire log after `2026-09-01T00:00:00Z`, and both are the
department acts. The single permit (`2026-08-31T10:11:52`) and execution attempt
(`2026-08-31T10:13:36`) predate the migration by roughly twenty hours and belong to the First
Governed Execution acceptance. No external provider action occurred.

Recorded honestly: `integration_credentials` was **not baselined** before the migration, so it is
reported as unmeasured rather than as zero delta. It versions by INSERT on Google token refresh,
which moves independently of anything here.

## 9 · What the gate found

### 9.1 · The provenance sentence — a released truth defect

OSA-1 taught `structureClause` to carry departments and left `ORGANIZATION_GROUNDING_PROVENANCE`
saying:

> *"…no department, team, reporting line or member roster is carried, because no authority for any
> of them exists."*

Both travel on **one line**: `groundingLines` joins them with `" | provenance: "`, and
`assembleProvenance` renders the same sentence to the Director beside an answer naming the very
department it denies carrying. The model resolved the contradiction in favour of the evidence —
Probe A passed — so the defect was **behaviourally inert and still a defect**.

**It was judged against OSA-1's own released standard**, stated in §8 of its closure when it
repaired the sibling sentence on Live Map:

> *A false statement on the surface a Director trusts most is a defect, not a feature gap.*

Two hard-coded denials of structural authority were falsified by one milestone. OSA-1 repaired one
of them. OSA-2 repaired the other. Nothing else changed: no source class, no workspace re-scoped, no
field added, no authority moved, no schema.

**Why 622 stayed green over a false sentence.** The only assertion that reads this constant
(`organization-grounding.ts` §4) **strips** it before banning structural words — deliberately,
because the sentence is a denial and a bare word ban trips on the product's own honest refusal, the
failure INT-3 recorded. That block runs solely on the structure-**unavailable** branch. Nothing
exercised the constant against a resolved structure carrying departments.

The regression added here does, and it is a **pairing** rather than a word ban:

```
A SENTENCE MAY NAME A DEPARTMENT, OR DENY DEPARTMENTS. NEVER BOTH.
```

Judged per sentence by negation with `\b` anchors — E2-5's technique — plus the reverse direction:
everything the provenance says it withholds is asserted absent from what the items actually carry.
**It was proved to bite**: restored against the pre-fix string it fails with the exact sentence
quoted back.

### 9.2 · A wrong workspace is not a broken product

The first Heby probe was run in the **Knowledge** workspace and refused. It was briefly recorded as
a production grounding defect. It was not one.

`organization` is declared by **Command only** — 1 of 8 workspaces, exactly as E2-1 scoped it.
`withOrganization` early-returns when no resolution carries the class, so
`readOrganizationGroundingSource` is never called and the department never enters the context. Heby's
system instruction is *"If the context is insufficient, say so plainly."* The refusal was **correct
behaviour**, and treating "Engineering" as a possible Knowledge area is precisely what the
`knowledge-coverage` class is for.

```
WORKSPACE AVAILABILITY != GLOBAL HEBY AVAILABILITY
```

This is E2-8's lesson repeating verbatim. The remedy was to ask in the right workspace — never to add
the class to Knowledge, which would have been forbidden scope AND contrary to E2-1's deliberate
Command-only admission. **A fix was very nearly released against a failure that was not a defect**;
the diagnosis that stopped it was reading which workspaces declare the class, not arguing about the
answer.

## 10 · Limitations — recorded, not implied away

```
one tenant acceptance                     one human owner
one department                            no human roster surface
no human-to-department assignment         no agent assignment writer
no department nodes on Live Map           no teams
no reporting hierarchy                    no scoped Governance delegation
no agent #2
```

None of these exist. Nothing in this document should be read as implying any of them do.

## 11 · Verdict

```
Production migration applied:         YES   ledger 40 → 41
Additive-only:                        YES   measured, not asserted
Real department created:              YES   one, by a human, through the product
Real human owner recorded:            YES   as an identifier, never a name
Governance decision for the mutation: NO
Permit / execution / provider action: NO
Agent assignment created:             NO
Agent #2 created:                     NO
Heby ownership grounding accepted:    YES   Command workspace
Unknown department truth preserved:   YES
Live Map truth accepted:              YES   counted, not drawn
Security acceptance:                  YES   schema-level, no production write
Truth defect found at the gate:       YES   repaired, regression added
Final full suite:                     622 passed, 0 failed, 622 total
Production accepted:                  YES
OSA program closed:                   YES
```

**OSA-0 architecture gate: COMPLETE. OSA-1 implementation: RELEASED. OSA-2 production acceptance:
PASSED. The Organization Structure Authority program is CLOSED.**

Era III remains open. No successor milestone is selected, and selecting one is a Director decision.
