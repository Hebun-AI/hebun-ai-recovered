# Departmental Placement — Who Works Where

**Era III. One capability, one loop: designed, built, validated, released, production-accepted,
closed.** The Definition of Done in §1 was written BEFORE any mutation; everything after it is
measured against it.

**Authority expansion:** one additive table and its writer, inside an EXISTING authority's feature.
No new Governance domain, no decision type, no action kind, no permit, no mandate, no execution
authority, no provider capability, no workspace. **Production ledger 42 → 43.**

---

## 1 · Why this capability, and what it unlocks

The repository named this gap itself, in five released modules, as a MEASUREMENT rather than an
omission:

```
live-map/contracts.ts        "membership carries no departmental placement"
live-map/contracts.ts        "human -> department   `roles` carries no `organization_id` at all"
live-map/read-live-map…      the same, twice, as the reason no human node is drawn
heby-work-source.server.ts   "DEPARTMENT REF != THE HUMAN BELONGS TO THAT DEPARTMENT"
```

That last sentence exists ONLY because this table did not. WORK-1 gave a work item a department and
an accountable human, and the grounding then had to say out loud that the two facts are not one
fact. They are still not — and now the missing one can be **recorded instead of disclaimed**.

**Enterprise job unlocked:** *"Who works in Engineering?"* and *"Which department does this person
work in?"* — unanswerable anywhere in Hebun before this.

**Rejected candidates, briefly.** GitHub PR intelligence needs an external provider permission and
carries a PR-diff content boundary — not one-pass safe. A unified decision horizon aggregates
authorities that already have surfaces and unlocks no new fact. Department-scoped Knowledge
presupposes placement and touches Governance ratification. WORK-3 was not authorized.

---

## 2 · The boundary that chose the shape

A `memberships.department_id` column was the obvious design. It was **refused on security grounds**,
and the refusal came from a released firewall rather than from taste:

> `write-structure.server.ts` states, and a firewall asserts over its real import graph, that the
> Organization Structure Authority **"never writes … `memberships`"** — the row a session reads to
> build a `TenantContext`.

Putting placement on that row would have forced the structural authority to hold a write handle on
the session's own record. So the fact moved to its own table with its own blast radius, and
**`write-structure.server.ts` is byte-untouched by this capability** — asserted.

```
UNPLACED  ->  PLACED                     place
PLACED    ->  PLACED IN A DIFFERENT ONE  place   (same row, department changes, version++)
PLACED    ->  UNPLACED                   withdraw (lifecycle -> archived, never a delete)
```

No delete, no restore, no merge, no multi-department, no nesting, no manager, no reporting line —
ABSENT rather than guarded.

**Tenant safety is structural, not checked.** `(tenant_id, department_id)` references
`departments (tenant_id, id)` — which is exactly why `departments_tenant_id_uq` exists, as its own
header says. Proved by asking PostgreSQL to accept the cross-tenant row the writer refuses: it
answers `23503`, a foreign-key violation. The guarantee does not rest on the writer being correct.

---

## 3 · Truth semantics, carried as data

```
PLACEMENT != ROLE            PLACEMENT != AUTHORITY       PLACEMENT != PERMISSION
PLACEMENT != REPORTING LINE  PLACEMENT != MANAGER         PLACEMENT != TEAM
PLACEMENT != WORK ASSIGNMENT PLACED    != ACTIVE MEMBER   PLACED    != OBSERVED
UNPLACED  != NOT A MEMBER    NO PLACEMENTS != NOBODY WORKS HERE
PLACEMENT REGISTER != MEMBER ROSTER      UNAVAILABLE != NONE RECORDED
```

Every one travels in a provenance sentence or a per-item `detail` string, never in prompt prose —
because a model forgets an instruction and cannot forget a field.

---

## 4 · Provider disclosure, decided before code

The projection consumes `resolveHumanNames` (`display_name → name`) and **can never reach**
`resolveHumanLabels`, whose released floor is the person's email address. That boundary was
established one milestone earlier by WORK-2's production acceptance; here it was applied at **design
time** rather than discovered at acceptance — which is the whole point of writing the Definition of
Done first.

Unnamed → exactly `name unavailable`, identifier beside it. No local-part, no initials, no guess.
The list is bounded and says so.

---

## 5 · Product reachability

```
UI     /director/organization  ·  "Who works where" panel + placement control
Heby   `placement` — the 19th source class, Command workspace ONLY
```

A new class rather than folding into `organization`, because that class is chartered "EXACTLY ONE
ITEM, ALWAYS", its provenance says "no member roster is carried", and its owner is deliberately an
IDENTIFIER. Folding placements in would falsify all three. That is WORK-2's own rejection argument
applied unchanged: *a work item names a department and is not one; a placement names a department
and a human and is neither.* `heby-organization-source.server.ts` is untouched.

---

## 6 · What the pre-closure review caught, before the suite

Two real defects, both fixed inside this capability rather than deferred:

1. **The read hand-wrote the six eligibility conditions as raw SQL.** Correct on the day, and the
   exact shape the shared rule exists to prevent. Replaced with an import of
   `eligibleTenantMemberConditions`, correlated to the placement's own `user_id` — so the derived
   standing flag agrees with the writer *exactly* rather than being a strict subset of it. The
   eligibility consumer census legitimately grew 5 → 7.
2. **A structural probe was measuring the wrong constraint.** Written against a human who already
   had an active placement, so the partial unique index fired before the foreign key. One defence
   firing first hides the one being tested.

A third was found by a bite-proof afterwards: that same probe still borrowed a human another section
had placed, so mutating withdrawal changed which constraint fired. It now uses a fixture this test
never places. **A probe that depends on another section's outcome is not a probe.**

---

## 7 · Validation

```
targeted     osa3-departmental-placement/placement-truth      PASS
             osa3-departmental-placement/firewall             PASS
             osa3-departmental-placement/placement-postgres    PASS  (real database)
             osa3-departmental-placement/bite-proofs          PASS  (8 mutations, 8 bites)
typecheck    tsc --noEmit                                     clean
lint         eslint                                           0 errors
final suite  see §9
```

Eight mutations, eight bites: the Governance gate, the eligible-member check, the read's tenant
predicate, withdrawal-as-soft-delete, the address-floored label, an invented name, an outage
reported as an absence, and the identifier dropped from grounding.

Two expectations had to be corrected because **the assertion that actually fires is not always the
one that reads best** — P4's soft-delete is invisible from the register and shows only in the
lifecycle column, and P6's alias keeps the local name.

---

## 8 · Released claims repaired in this loop, not deferred

| Claim | Repair |
|---|---|
| `ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment: false` | `true`, with the owning module named |
| `live-map/contracts.ts` `human -> department` | authority now exists; the edge is still absent, for a weaker and stated reason |
| `LIVE_MAP_PEOPLE_ABSENT` | placement IS recorded; a register is not a roster, so people are still counted |
| `read-live-map.server.ts` ×2 | the same, at both sites |
| L3 durable-write census | 1 → 2 writers, both by name, plus a per-table reach pin on the new one |
| L3 directory census | 6 → 10 files, enumerated |
| E2-1 / L3 Heby-import census | 1 → 2 projections, plus an explicit ban on seams |
| HLR grounding-consumer census | 1 → 2, **both required provider-safe** |
| HLR consumer census | 5 → 7 |
| Heby source-class census | 18 → 19 |
| audit-sink owner census | +1 |
| migration allowlists, ledger pins, digests | 42 → 43, `c814d6b3…` |
| prodmig pending-migration probe | moved to `department_placements` — "pending" moves every release |

Every one is an EXACT list or an exact count. Nothing was loosened into a range.

---

## 9 · Validation totals and release

```
final suite   638 passed / 0 failed / 638 total     exit 0
full-suite runs  TWO — one that exposed the pin wave, one replacement after repairing it
typecheck     clean          lint  0 errors (14 pre-existing warnings)
```

The first final suite came back **602 / 36 / 638**. Every one of the 36 was legitimate absolute pin
movement caused by authoring a migration and adding modules — the class WORK-1 measured and budgeted
at roughly fifty test edits. They are enumerated in §8. **No architectural test was weakened to make
the suite green**, and no general pin-debt cleanup was begun.

## 10 · Production acceptance · **PASS**

**Release commit:** `eea0fa3`. **Deployed and observed commit:** `eea0fa3` — **identical**, read from
the Vercel REST API's `meta.githubCommitSha` (deployment `dpl_sYVLwosv7CH7hexVckbdZzLy7fx9`, state
`READY`). **Production migration ledger: 42 → 43.** Cluster identified by
`pg_control_system().system_identifier` **7675444875863894887**, database `neondb`.

The migration ceremony and the placement itself were performed **by the Director**, the first
because `platform:migrate` is TTY-only by design, the second because doing it through the product
proves the surface works for a real human as well as producing the row.

### The schema landed as authored

All twelve constraints `convalidated`, including both tenant-safe foreign keys, and the partial
unique index is present with its `WHERE lifecycle_status = 'active'` predicate intact.

### The row, corroborated column by column

```
tenant            the caller's own organization
user              the production human            department   Engineering [engineering] active
version           1                               created_at = updated_at   TRUE
lifecycle         active                          attributed to             the production human (human)
```

`version = 1` and `created_at = updated_at` together are the proof that nothing touched the row
after it was written — two columns the base contract gives every table for free.

### Exactly one audit event, and it names no person

```
organization.placement.set   result=committed   authority_source=membership
subject IS the placement (not the department)   no name and no address in metadata
```

### The two disclosure policies, both live, on the same row

This is the finding worth recording. The Director's own screen showed:

> **senoltr@gmail.com works in Engineering**

…and the provider-bound model context for the same row showed:

> `name unavailable (d5b496df-…-17672b82dd10) is recorded as working in Engineering [engineering]`

Same human, same placement, same instant. The product label still floors at the address because that
is a true and useful answer for the organization's own authorized human; the model context does not,
because that value would leave the process. **UI LEGIBILITY != MODEL PROVIDER DISCLOSURE**, proved in
production rather than asserted.

```
placement class reaches the model   YES     provenance reaches the model       YES
department named                    YES     authoritative identifier present   YES
label reads `name unavailable`      YES
EMAIL ADDRESS present               NO      any `@` present                    NO
email local-part present            NO
```

Measured over the **whole serialized `ModelGenerationRequest`**, not only its evidence field, with
the `generate` seam captured — **zero provider calls, zero billable inference, zero rows written**.

### Non-effects — measured by the window over a catalogue-derived table list

```
tables scanned                       59
tables that grew                     department_placements = 1   (the act itself)
                                     user_session_contexts = 1   (the Director's own sign-in)
audit_log events in the window       EXACTLY ONE: department_placement / organization.placement.set
decision_records created             0
work_items / memberships / departments mutated   0 / 0 / 0
ledger before / after                43 / 43
```

`user_session_contexts` is named rather than waved through: it is the session the Director created by
signing in to perform the acceptance, and it is not attributable to this capability. **`memberships`
was not written** — the boundary that chose a table over a column, confirmed against the real row.

No Governance decision, no action request, no permit, no execution attempt, no Knowledge mutation, no
mandate mutation, and no external provider call of any kind.

### Not executed, and recorded rather than blurred

The destructive negative cases — placing a revoked member, a soft-deleted identity, another
organization's human, and placing into a retired department — are proved by the **released database
suite** against real rows, and were deliberately NOT attempted in production. Production holds one
human and one department; exercising them would have meant damaging real organizational state to
reach a PASS. Classified as **proved against a real database, not against production**.

---

## 11 · Status

```
released                 eea0fa3, origin/main parity verified
production acceptance    PASS
DEPARTMENTAL PLACEMENT   CLOSED / PRODUCTION-ACCEPTED
```

**No successor is authorized.** WORK-3 is not authorized, APF and ASA remain deferred with their
activation conditions unproven, and pin-debt cleanup remains backlog rather than a milestone.

### Known intentional limitations

- **One placement per human.** Multi-department placement is unrepresentable, not refused. If the
  organization ever needs it, the partial unique index is the one thing that must change.
- **No manager, no reporting line, no team, no title.** Absent rather than guarded — Hebun holds no
  authority for any of them, and the class says so in the sentence a model reads.
- **The read is tenant-scoped, not Governance-gated**, matching its released sibling
  `readOrganizationStructure`. Changing a placement requires Governance authority; reading your own
  organization's arrangement does not. A member without that authority sees the register with
  identifiers and `name unavailable`, because the legibility reads are gated — the placement is
  visible, the name is not, and it fails in the safe direction.
- **An agent is not placed here.** `agents.department_id` is Agent Identity's, and this authority
  makes the agent case unrepresentable rather than refused.
- **Production proved the happy path and the disclosure boundary.** The refusals are proved where
  they can be proved without damaging real state.
