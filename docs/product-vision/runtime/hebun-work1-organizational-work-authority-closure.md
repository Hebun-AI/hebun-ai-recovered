# WORK-1 — Organizational Work Authority · Continuity Record

**Era III, third program (Organizational Work), first milestone.** The organization can record that
a unit of its work exists, what it is called, which part of itself it belongs to, which human is
accountable for it, and what state that human has declared.

**Baseline:** `main` at `cbdfe9e`, equal to real `origin/main` by `git ls-remote`.
**Local migration ledger:** 41 → **42**. **Production ledger: 41, unchanged.**
**Suite:** **630 passed, 0 failed, 630 total** — the replacement final run, on a stable tree.

**WORK-1 IS RELEASED.** It was subsequently **PRODUCTION-ACCEPTED** — production ledger 41 → 42,
one real work item recorded by the accountable human through `/director/work`. See
`hebun-work1-production-acceptance-closure.md`. The status table below is the state **at release**
and is left as it was written.

---

## 1 · Status, term by term

```
DESIGNED                 YES   WORK-0 architecture gate, decision C
IMPLEMENTED              YES   one authority, one writer, one read seam, one audit sibling
MIGRATED LOCALLY         YES   ledger 42, applied to disposable databases by every DB test
PRODUCTION MIGRATED      NO    production stands at 41
AUTHORITATIVE            YES   work identity, title, lifecycle, declared state, accountability
PRODUCT-REACHABLE        YES   /director/work
HEBY-GROUNDED            NO    deliberately — no source class, no workspace change
LIVE-MAP IMPACT          NONE  one falsified code comment repaired; no node, no domain, no edge
AGENT AUTHORITY ADDED    NONE  and an agent as accountable party is refused by PostgreSQL
PRODUCTION-ACCEPTED      NO
```

---

## 2 · The pins

```
WORK ITEM   != WORK ARTIFACT            WORK EXISTS != WORK DESCRIPTION
WORK STATE  != BUSINESS OUTCOME         ACCOUNTABILITY != PERMISSION
WORK RECORD != TASK EXECUTION           WORK        != KNOWLEDGE
DEPARTMENT RELATION != DEPARTMENT OWNERSHIP
DECLARED != OBSERVED != VERIFIED != SUCCESSFUL != COMPLETED != OUTCOME-ACHIEVED
UNAVAILABLE != EMPTY                    RECORDED    != AUTHORIZED
RETIRED     != DELETED                  THE UI IS NOT THE SECURITY CONTROL
```

---

## 3 · What was built

| Surface | What it owns |
|---|---|
| `db/schema/work-item.ts` | the table — 6 own columns, 3 CHECKs, 1 composite anchor, 1 composite FK, 2 indexes |
| `db/schema/_enums.ts` | `work_declared_state` — four values, additive |
| `organizational-work/work-contracts.ts` | vocabulary, bounds, refusals, non-claims, boundary model — PURE |
| `organizational-work/read-work.server.ts` | the read — no insert, update, delete or transaction |
| `organizational-work/write-work.server.ts` | **the authority** — record, retitle, declare state, set accountable, retire |
| `governance-audit/organizational-work-audit.server.ts` | the **twelfth** audit sibling, append-only |
| `app/(dashboard)/director/work/actions.ts` | server actions holding no authority |
| `app/(dashboard)/director/work/page.tsx` | the route — three authorities composed, never merged |
| `components/organizational-work/work-register.tsx` | the product surface |
| `config/sidebar.config.ts` | one nav entry, one static route |
| `tests/work1-organizational-work/` | Postgres truth + firewall |

**Migration `20260901122013_work1_organizational_work_authority`** — one `CREATE TYPE`, one
`CREATE TABLE`, two foreign keys, three indexes. **No `DROP`, no `ALTER` of any existing table, no
data migration, no `INSERT`.** A firewall test asserts each of those absences and asserts that the
only table any `ALTER` names is the one the migration creates.

---

## 4 · The schema decision, and why it is not a second source of truth

WORK-0 chose **C — a new narrow table**. The reasoning is recorded there; what the implementation
adds is the *proof*, taken against PostgreSQL rather than against an import list:

- `work_items` holds exactly **two** foreign keys, to `companies` and `departments`, and the test
  asserts that list is exhaustive. Not one points at `tasks`, `goals`, `plans`, `missions`,
  `workflows`, `commands`, `executions` or `reasoning_traces`.
- After the whole suite runs, every one of those eight tables still holds **zero rows**.
- No authoritative seam in `src/features` inserts, updates or deletes any of them — asserted by
  walking every file that imports `@/db/schema` and matching the drizzle write chain.

Activating `tasks` would have made `executions.task_id` meaningful and given Hebun a **second
execution ledger** beside `action_execution_attempts`. That, not tidiness, is what the gate refused.

---

## 5 · Why there is no Governance decision

Quoted from the audit sibling, which states it where a reader will find it:

> Recording that work exists moves no authority and leaves the database no more than it entered it.
> The released precedents are OSA-1 and R6D.

The permit chain exists for consequential **irreversible** acts in the world. A work record grants
nothing, reaches nothing outside Hebun, and is reversible by the same authority. The Postgres suite
asserts the consequence directly: after every mutation this milestone can perform,
`decision_records` holds exactly the two genesis bootstraps the test itself established, and
`heby_action_requests`, `action_permits`, `action_execution_attempts`, `knowledge_nodes`,
`agent_mandates` and `role_permissions` are all empty.

`GOVERNANCE_SUBJECT_TYPES` is asserted to still be exactly `["knowledge_node"]`.

---

## 6 · What the implementation found that the gate did not

**A `governance_domain` substring ban trips on somebody else's vocabulary.** The first firewall
asserted no domain value matches `/work/i`. The enum has carried `workflow` since the foundation
baseline, so the assertion failed against code this milestone never touched. Replaced with an
exact-value ban on the four names WORK-1 could plausibly have added. *A test that trips on a
released value proves nothing about the new one.*

**A membership cannot be moved between tenants, and the fixture that tried was testing the wrong
thing.** The eligibility section first re-pointed a seeded membership at Acme; `memberships` carries
a composite `(tenant_id, role_id)` FK and PostgreSQL refused it. The fix was to seed a genuinely
second member of Acme — which is what the section needed anyway, because the point is that an
**eligible** member is accepted before each of the five ways of becoming ineligible is applied.

**Five ineligibility cases need five separate statements, and one of them was two statements in one
prepared query.** `pg` refuses multiple commands in a prepared statement. Splitting them also made
each case independent — every case now undoes the previous one and asserts alone, which is the discipline
HLR and the eligibility hardening both had to learn the hard way: *defence in depth makes each layer
untestable unless a fixture isolates it.*

**An `|| true` was written into a firewall assertion and deleted.** The first attempt at "the
accountable actor type is a literal" carried an escape hatch that made it unfailable. It was
replaced with an enumeration of every assignment to that field, and then **bite-proofed**: rewiring
the writer to take the type from input made the assertion fail with the offending expression quoted,
and restoring the file made it pass. *An assertion that cannot fail is not a test.*

**A source regex cannot see across a string concatenation.** The surface's declaration notice is
split over two lines by the formatter, so `/did not observe it, did not verify it/` failed against
correct code. The claim is now asserted against the **exported constant** as well, so a reflowed line
cannot lose it.

**WORK-1 falsified one released statement, and it was repaired rather than left.**
`live-map/contracts.ts` listed `agent -> work/goal   no authority` as a reason an edge is absent.
An Organizational Work Authority now exists, so that reason is false. The repair states the case that
survives and is **stronger**: the edge is still absent because `work_items_human_accountable_chk`
makes an agent unrepresentable as the accountable party. Comment-only; no import, no behaviour.

**A stale sibling line was found and deliberately NOT repaired.** The line above it —
`agent -> department   no department authority exists (L3)` — has been false since OSA-1. It is
recorded here as a standing observation rather than fixed, because repairing another milestone's
residue is not this one's to do. Same discipline HLR used when it found the owner-eligibility gap.

**ADDING ONE AUTHORITY COST 49 TEST FILES, AND THAT IS THE REAL FINDING OF THIS MILESTONE.**
The first complete suite came back **596 passed, 34 failed, 630 total**. Not one failure was a WORK-1
defect. Every one was a released pin that states its claim as an ABSOLUTE number, an absolute
position, or an exact census — and WORK-1 legitimately grew each of them:

| Class | What WORK-1 added | Repair |
|---|---|---|
| absolute ledger pins | migration 42 | 41 → 42; the claim ("MY phase authored none") untouched |
| migration allowlists ending at OSA-1 | one new tag | appended with a naming comment; the lists stay EXACT |
| "the newest migration is X" | a new tail | now names WORK-1 |
| journal bite-proof `find` anchors | a new journal tail | re-anchored, so each mutation still applies |
| **audit-sink owner census** | the 12th audit sibling | grew in `g1`, `g2`, `k2` — nothing widened |
| **human-only CHECK census** | `work_items_human_accountable_chk` | ten → **eleven**, in three files |
| **server-action boundary census** | `/director/work/actions.ts` | grew in seven files |
| **route census** | `/director/work` | 130 → 131 dashboard routes |
| **`StateBlock` consumer census** | the work register component | six → seven declared additions |
| **consumer censuses** | a third `readOrganizationAuthority` caller, a second legibility pair | `l3`, `hlr` — both still exact lists |
| release digest / ledger identity | a new ledger fingerprint | `42186bb3…` → `19f0f971…`; ledger digest `f735610e…` → `ad42a0d9…` |
| pending-migration probe | a table again | re-pointed from OSA-1's CHECK to `work_items` |

**NOT ONE OF THESE WAS WEAKENED.** Every count still asserts "this phase added nothing"; every
allowlist is still exact, so an undeclared migration still fails; every census is still a `deepEqual`
against an exact list rather than a `>=` check, so a consumer appearing without a deliberate edit
still fails. The eligibility rule now has five declared consumers instead of three — because WORK-1
MUST consult it rather than re-type it, which is the entire reason that rule exists.

**Two were genuine repairs rather than updates, and both were latent bugs WORK-1 merely exposed:**

- `CANONICAL[40]` → `CANONICAL.at(-1)`. It said "the last of them" and meant an index, so it has
  needed two numbers moved in lockstep at every migration since it was written.
- `k1-flow` guarded against a migration "named for K1" with a bare `/k1/` regex — which matches
  **wor·k1**`_organizational_work_authority`. Now delimited by the underscore convention every
  migration name uses. **A bare token is a substring of somebody else's name.**

One stale sentence was corrected in passing, inside an edit that had to be made anyway: `g4-flow`
still said production stood at 40 with digest `2a9522bb…`. OSA-2 moved it to 41 (`42186bb3…`), which
is what production carries today.

G6D made fifteen ledger pins phase-relative for exactly this reason. **The class regenerated, and the
honest note is that this repository now pays roughly fifty test-file edits for every new authority
that authors a migration.** That is not a WORK-1 problem and WORK-1 did not fix it; it is recorded
here so the next milestone budgets for it.

**The release digest moved, and production did not.** `42186bb31b22a719a9b57b528ed42161` was the
digest at 41 and is what **production still carries**. The checkout is now
`19f0f97195c4cdc17fca61e736f0fe44` at 42. The two are deliberately one migration apart until a
production ceremony is authorized, and the prefix verifier is what reconciles them — the same
posture OSA-1 held before OSA-2.

**The first final suite was killed, not reported.** A comment repair landed in the tree while the
run was in flight. A suite that ran against a moving tree is not a measurement, so it was discarded
and a clean one was run instead.

---

## 7 · What WORK-1 deliberately does NOT do

- no progress, health, priority, urgency, risk, due date, dependency, effort or estimate
- no business outcome, no verification, no success judgement, no automatic or inferred state
- no state-transition graph — any declared state may follow any other, because a graph would encode
  a process the organization never told Hebun about
- no sub-work, hierarchy, projects, initiatives, boards, filters, search or paging
- no agent read, reference, proposal, creation, state change or accountability
- no Governance decision, permit, execution, adapter or provider call
- no Heby source class, no workspace change, no Live Map node
- no Knowledge link, no work-artifact FK, no GitHub link
- no activation of the dead work island
- no human→department assignment, no teams, no reporting lines, no roster
- no un-retire

---

## 7b · Known limitations, recorded rather than smoothed over

**The department is set at creation and cannot be changed afterwards.** The approved mutation list
is five, and "re-file this work under a different department" is not one of them. That is a real
limitation of WORK-1, not an oversight: adding a sixth mutation because it looked convenient is the
scope creep the gate existed to prevent. A human who files work under the wrong department must
retire it and record it again, and the record of both survives.

**A retired work item cannot be revived.** WORK-1 ships no un-retire. Reviving work is a different
act with a different meaning and inventing it here would have been unauthorized scope.

**The register is bounded, not paged.** At most 200 items come back and the read SAYS SO through
`truncated` and in its own detail sentence. A list that quietly stops is a list that lies about what
the organization holds; a list that says it stopped is honest and small.

**Heby cannot answer a question about work.** Deliberate. The released rule is one authority, one
source class — the AMA-3 precedent — so grounding is WORK-2's, with a new `work` class added to the
`command` workspace and only `command`. Until then, work is reachable at its route and nowhere else.

---

## 8 · Production acceptance — designed, not performed

Not begun, and it requires its own Director authorization. The shape WORK-0 specified:

1. record one **real** work item in Tenant Zero
2. reference the one real department
3. set the existing eligible accountable human
4. declare state at least once, through `blocked` and back
5. read it back; the accountable human appears **by label**
6. one `audit_log` row per act, correct actor, `authority_source = 'membership'`, `committed`
7. an ineligible human refused **by the writer**
8. zero delta in `decision_records`, permits, action requests, execution attempts, provider calls
9. retire is **not** required — real work is not disposable

---

## 9 · Continuity — unchanged by this milestone

```
APF (Agent Plurality Foundation):   VALID DIRECTION / DEFERRED
Agent #2:                           NOT JUSTIFIED / NOT CREATED
Governed Internal Action:           VALID ARCHITECTURE / DEFERRED
GitHub PR reachability:             STRANDED / not started
ASA:                                BLOCKED / DEFERRED
Heby grounding for work:            WORK-2, not started
```
