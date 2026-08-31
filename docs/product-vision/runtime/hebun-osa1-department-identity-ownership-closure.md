# OSA-1 — Department Identity and Ownership · Continuity Record

**Era III, second program (Organization Structure Authority), first milestone.** The organization
can record that a part of itself exists, what it is called, whether it is in service, and which
human is accountable for it.

**Baseline:** `main` at `8b22f5f`, equal to `origin/main`.
**Local migration ledger:** 40 → **41**. **Production ledger: 40, unchanged.**
**Suite:** **622 passed, 0 failed, 622 total** — one final run, after the last repair.

**OSA IS NOT CLOSED.** OSA-2 is production acceptance and has not begun.

---

## 1 · Status, term by term

```
DESIGNED                 YES   OSA-0 architecture gate, decision B
IMPLEMENTED              YES   one authority, one writer, one read seam, one audit sibling
MIGRATED LOCALLY         YES   ledger 41, applied to disposable databases by every DB test
PRODUCTION MIGRATED      NO    production stands at 40; the ceremony is OSA-2's
AUTHORITATIVE            YES   department identity, lifecycle and ownership
PRODUCT-REACHABLE        YES   /director/organization, above the mock disclosure line
HEBY-GROUNDED            YES   inherited through the existing `organization` source class
LIVE-MAP IMPACT          NARROW  the structure domain stopped claiming no authority exists;
                                 department NODES remain deferred
PRODUCTION-ACCEPTED      NO
```

---

## 2 · The pins

```
DEPARTMENT OWNER != GOVERNANCE AUTHORITY   DEPARTMENT OWNER != APPROVER
DEPARTMENT OWNER != PERMIT HOLDER          DEPARTMENT OWNER != TENANT MEMBERSHIP
DEPARTMENT       != ROLE                   DEPARTMENT       != TEAM
STRUCTURE        != PERMISSION             RECORDED         != AUTHORIZED
UNAVAILABLE      != EMPTY                  COUNTED          != DRAWN
ATTRIBUTION      != AUTHORITY              RETIRED          != DELETED
```

---

## 3 · What was built

| Surface | Lines | What it owns |
|---|---|---|
| `db/schema/department.ts` | 176 | the hardened table |
| `organization-authority/structure-contracts.ts` | 174 | vocabulary, bounds, refusals, boundary model |
| `organization-authority/read-structure.server.ts` | 190 | the structural read — no insert, update, delete or transaction |
| `organization-authority/write-structure.server.ts` | 532 | **the authority** — create, rename, retire, set owner |
| `governance-audit/organization-structure-audit.server.ts` | 94 | the eleventh audit sibling, append-only |
| `app/(dashboard)/director/organization/actions.ts` | 61 | server actions holding no authority |
| `components/organization-domain/department-structure.tsx` | 289 | the product surface |
| `tests/osa1-organization-structure/` | 1102 | Postgres truth + firewall |

**Migration `20260831212454_osa1_department_structure_authority`** — nine statements, all additive:
two unique indexes, five CHECKs, one FK dropped and one added. **No `CREATE TABLE`, no `DROP TABLE`,
no `DROP COLUMN`, no `INSERT`, no data migration.** A firewall test asserts each of those absences.

---

## 4 · The four defects the original table carried, and their repairs

1. **No tenant anchor.** `departments_tenant_id_uq` on `(tenant_id, id)` — the pattern six tables
   already carried.
2. **No uniqueness at all.** `departments_tenant_slug_active_uq`, PARTIAL on `active`, so a retired
   department does not reserve its name forever.
3. **A second parent hierarchy.** `organization_id` is made UNREPRESENTABLE by
   `departments_no_second_parent_chk`. `organizations` is untouched, unpopulated and still dead —
   the database now refuses to let it come alive through this table.
4. **An unconstrained owner type.** `departments_human_owner_chk` — an agent cannot be recorded as
   accountable for part of a human organization, and PostgreSQL refuses it. This is the **tenth**
   human-only CHECK in the schema; the census that names them all grew and was re-declared.

`manager_actor_*` was left exactly as found: unwritten, unexposed, unconstrained.

---

## 5 · The strongest architectural risk, closed

OSA-0 named it: `agents.department_id` was a **single-column FK** to `departments.id`, inert only
because the table was empty. The moment departments existed, an agent could have been pointed at
another tenant's department with PostgreSQL raising nothing — the defect R3B repaired on
`action_permits`.

It is now `agents_tenant_department_fk` on `(tenant_id, department_id)`. Proved by a test that
attempts the cross-tenant write against a real database and requires PostgreSQL to refuse it. NULL
`department_id` stays valid under MATCH SIMPLE, so every existing agent is unaffected.

**No agent-assignment writer shipped.** The fact lives on `agents`, so its writer must be Agent
Identity — which states it holds "TWO authorities, TWO transitions, and no third". The hazard is
closed; the capability is deferred.

---

## 6 · No Governance decision, and why

Measured against the released bar at OSA-0: every Governance decision Hebun writes either MOVES
AUTHORITY or carries IRREVERSIBLE OR EXTERNAL CONSEQUENCE. Recording a department does neither.

The released precedent is R6D — Knowledge source retraction — which mutates under its own band and
writes audit alone. OSA follows it exactly:

- **No `decision_records` row** is written by any path. Proved by counting the table after a full
  exercise: exactly the two genesis rows, and not one more.
- **No `governance_domain` value added.** `organizational-role` was considered and REFUSED: it is
  already owned by `tenant-role-baseline`, and reusing it would make "a department was created"
  indistinguishable from "a role was provisioned" in the one place the ledger is queried by domain.
- **The gate** is the tenant's existing Governance authority holder, consumed through
  `resolveGovernanceAuthority` as permission to write structure, never as a decision.

---

## 7 · Three truth states, never two

```
unavailable             the authority could not be read       — NOT "no departments"
available, empty        looked, found none                    — a real answer
available, departments  the recorded structure
```

`readOrganizationAuthority` — the ONE Organization read seam since L3 — now derives structure
through OSA and carries all three. Its own comment promised exactly this: *"when a legitimate
structural authority exists, this becomes available HERE and every consumer inherits it unchanged."*

A census proves no second read system exists: only the L3 seam and the writer reach
`read-structure.server.ts`. Heby, Live Map, the Agents surface and the Organization surface all
inherit.

**Heby gained no source class.** `heby-organization-source.server.ts` reads no department table and
does not call the structure read; it renders whichever state the L3 seam handed it. Heby may say
"Finance is owned by <id>" only because OSA recorded exactly that, and says nothing at all about a
department OSA has not recorded.

---

## 8 · Live Map — a narrow repair, not the deferred milestone

Live Map's structure domain was a hard-coded `no-authority` with the sentence *"Hebun has no
authority for internal organizational structure."* OSA-1 made that sentence FALSE, and a false
statement on the surface a Director trusts most is a defect, not a feature gap.

The repair is the narrowest one that restores truth: the structure Live Map **already receives** —
it has read `readOrganizationAuthority` since L4 — is reported as a COUNT with the honest three
states. **No department node is drawn, no edge is invented, and no new seam is called.** Drawing
departments remains its own product milestone, and a test asserts the structure domain never reports
`available`, so the map cannot imply nodes that are not there.

`people` is untouched and still `no-authority`: OSA-1 shipped no roster, so that sentence is still
exactly true.

---

## 9 · Two real defects found during implementation

**The migration did not apply.** `drizzle-kit` emitted the composite FK BEFORE the unique index it
references, and PostgreSQL refused it — silently, through a spinner. The statements were reordered
by hand and a firewall test now pins that the anchor precedes the FK, so the same generation order
cannot ship again.

**Every duplicate slug was reported as an outage.** Drizzle WRAPS the driver error and the wrapper
carries no `code`; the SQLSTATE lives on `cause`. Checking only the outer object classified
`unique_violation` as `authority-unavailable` — the wrong refusal, and an untrue one: the authority
was reached and answered. Both positions are read now.

---

## 10 · Released pins repaired — stricter, never weakened

| Pin | Before | After |
|---|---|---|
| L3 "no file in this directory writes" | directory sweep | **exactly ONE writer, pinned BY NAME** — a second one fails |
| L3 file census | 3 files | 6, enumerated |
| L3 "must not reference `departments`" | a name ban | **the L3 read holds no department query — it delegates** |
| L3 `structuralAuthorityExists` | `false` | `true`; `writerCreated` and `schemaChanged` unchanged and asserted first |
| Human-only CHECK census | nine | **ten**, `departments_human_owner_chk` declared |
| Audit sibling census | ten | eleven, declared in k2, g1 and g2 |
| Server-action census | ten | eleven, declared in seven files |
| `agent.ts` forward reconstruction | two known additions | four, plus "exactly ONE foreign key in the block" |
| Live Map structure sentence | "no authority exists" | "could not read … unknown — not absent" |
| Canonical release digest | `2a9522bb…` | `42186bb3…`, with production's `2a9522bb…` recorded in place |
| ~25 absolute ledger counts | `40` | phase-relative, derived, or `41` with the reason stated |
| 5 bite-proof anchors | stale strings | re-anchored; every one still bites |

Six `prodmig` scenarios now derive their numbers from `CANONICAL.length` instead of restating the
ledger length, and the pending-migration probe follows OSA-1's actual shape — a CONSTRAINT, because
this migration creates no table and a table probe would have been satisfied before migrating.

---

## 11 · What OSA-1 did NOT do

No teams. No reporting hierarchy. No job titles or positions. No human roster. No
human-to-department assignment. No agent-to-department assignment writer. No manager. No scoped
Governance delegation. No Agent Mandate change. No provider scope. No seeded department promoted.
No agent #2. **APF remains DEFERRED. Governed Internal Action remains DEFERRED.**

---

## 12 · What OSA-2 must prove

In production, by a human: one real department created; its owner set to the real existing human;
`structure.status` becomes `available` through the L3 seam; Heby answers "who owns X" from the
authoritative record and says it does not know for an unrecorded one; a cross-tenant department
reference is refused by the database; a duplicate active slug is refused; every refusal leaves zero
rows.

Recorded honestly in advance: Tenant Zero holds one human member, so the acceptance will be **real
but small** — one department, one owner, one tenant.

The production migration ceremony (`platform:migrate`, ledger 40 → 41) is part of OSA-2 and was not
run here.

---

## 13 · Verdict

```
OSA authority implemented:            YES
Existing departments table activated: YES, with additive hardening
Composite tenant anchor added:        YES
Agent department FK repaired:         YES
Department identity authoritative:    YES
Department lifecycle authoritative:   YES
Department ownership authoritative:   YES
Governance decision created by OSA:   NO
New Governance domain created:        NO
Human roster added:                   NO
Agent assignment writer added:        NO
Agent #2 created:                     NO
Heby new source class added:          NO
Product reachable:                    YES
Final full suite:                     622 passed, 0 failed, 622 total
Production migrated:                  NO
Production accepted:                  NO
OSA closed:                           NO — OSA-2 is production acceptance
```
