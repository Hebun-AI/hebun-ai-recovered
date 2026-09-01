# The Organizational People Register — Who Is In This Organization

**Era III. One capability, one loop: designed, built, validated, released, production-accepted,
closed.** The Definition of Done in §1 was written BEFORE any mutation; everything after it is
measured against it.

**Authority expansion: NONE.** Zero schema, zero migration, zero writer, zero Governance vocabulary.
One read projection over rows two released authorities already own, one grounding projection, one
source class, one panel. **Production ledger 43 → 43, unchanged.**

---

## 1 · Why this capability, and what it unlocks

The repository named this gap itself, in four released modules, as a BOUND rather than an omission:

```
read-work.server.ts        "it cannot enumerate the organization's people"
read-structure.server.ts   the same sentence, about department owners
placement-contracts.ts     "PLACEMENT REGISTER != MEMBER ROSTER", "UNPLACED != NOT A MEMBER"
workspace-registry.ts      "`organization` … keeps ONE item and no roster"
```

Hebun could say what parts an organization has (OSA-1), who owns each of them (HLR), which
department it records each person as working in (OSA-3), and what work it has declared (WORK-1). It
could not say **who is in it**. A human this organization had placed nowhere appeared on no surface
and in no grounding class — they were, to Hebun's product, invisible.

**Enterprise job unlocked:** *"Who is in this organization?"* and its immediate consequence, *"who
have we not placed anywhere yet?"* — the second is what makes the placement capability finishable
rather than open-ended, and it was unanswerable the day placement shipped.

**Rejected candidates, briefly.** A work TARGET DATE was the highest-value shape on first pass and
was **refused by a released design decision**: `work-item.ts` states that a due date is "a judgement
or a measurement this authority has no mandate to hold", and re-opening a reasoned refusal in a
one-pass loop is exactly the move CLOSED MEANS CLOSED forbids. GitHub PR intelligence needs an
external provider permission and carries a PR-diff content boundary. Department-scoped Knowledge
touches Governance ratification. A unified decision horizon aggregates authorities that already have
surfaces and unlocks no new fact.

---

## 2 · The boundary that chose the shape

**It is a READ, and it creates nothing.** Identity owns `users`; the Membership Authority owns
`memberships`. This capability contains no insert, no update, no delete and no transaction anywhere,
and it gives nobody a second way to make somebody a member — membership is still written where it
always was, through invitation and revocation. A firewall asserts the whole transitive import graph
of the grounding projection reaches **no writer at all**.

**It is not `readSelectableMembers` under a second name.** That read fills a PICKER, projects a
product label for a `<select>`, and its own header forbids it from becoming a directory. That
sentence stays true, because this is a different module answering a different question. The two share
the ONE thing that must never diverge — the eligibility rule, owned by `member-eligibility.ts`, whose
header already anticipated this caller in as many words: *"a caller enumerating a tenant's members
adds nothing"*.

**It projects no column of `users`, and that is the privacy design.** `users` is JOINED, because two
of the six eligibility conditions are facts about the identity. Not one of its columns reaches the
result: no name, no display name, and above all no email. **The register cannot leak an address
because it never selects one** — proved against real rows, not asserted.

Legibility is composed by the CALLER, and the two callers deliberately compose different projections
— the split WORK-2's production acceptance forced:

```
the page  ->  resolveHumanLabels   (display_name -> name -> email)   product legibility
Heby      ->  resolveHumanNames    (display_name -> name)            provider-safe
```

**Enumeration is the gated act.** `readPlacementRegister` needs no Governance gate: it enumerates
PLACEMENTS, records this organization wrote about itself. This enumerates PEOPLE, which is precisely
the act the Human Legibility Reach module gates in its own words — *"an unauthorized caller gets an
empty list rather than a directory"*. The same released gate applies, in the same order: **authority
first, before any subject is looked at**, so a refused caller cannot use the outcome as an oracle for
who belongs to a tenant.

---

## 3 · Truth semantics, carried as data

```
MEMBER              != EMPLOYEE            MEMBER REGISTER != PLACEMENT REGISTER
MEMBERSHIP RECORDED != HIRE DATE           LISTED          != AUTHORIZED
ABSENT              != NEVER A MEMBER      UNAVAILABLE     != NONE RECORDED
NOT AUTHORIZED      != NOBODY IS A MEMBER  AN ADDRESS      != A NAME
PRESENT IN A REGISTER != PRESENT AT WORK   TRUNCATED       != COMPLETE
```

Every one travels in the provenance sentence, in `PEOPLE_NON_CLAIMS`, or in a per-item `detail`
string — never in prompt prose, because a model forgets an instruction and cannot forget a field.

**The one inference the product makes is guarded.** "This person is not placed anywhere" is read from
an ABSENCE in the placement register, which is only true when that register both answered AND was not
truncated. When it did not, the surface says placement is unknown rather than saying they are placed
nowhere.

---

## 4 · What was built

| Layer | File | What it is |
|---|---|---|
| Read seam | `auth-runtime/people-register-read.server.ts` | Governance-gated, tenant-scoped, bounded at 200, identifiers + membership timestamp only |
| Grounding | `auth-runtime/heby-people-source.server.ts` | 20th source class `people`, provider-safe names, three states unmerged |
| Class | `heby-integration/contracts.ts` | `people` declared; census 19 → 20 |
| Workspace | `heby-integration/workspace-registry.ts` | Command, and only Command |
| Pure resolver | `heby-runtime/source-resolver.ts` | `case "people"` — explains the seam, never claims an absence |
| Answer flow | `heby-answer/model-answer.server.ts` | `withPeople`, beside `withPlacements`, never merged with it |
| Surface | `components/organization-domain/people-register.tsx` | `/director/organization`, above the disclosure line |

Nothing else moved. No schema module, no migration, no server action, no Governance subject type, no
action kind, no permit, no mandate, no dormant legacy table.

---

## 5 · Validation

```
targeted        osa4-people-register/people-truth      PASS
                osa4-people-register/firewall          PASS
                osa4-people-register/people-postgres   PASS  (real PostgreSQL, 3 tenants)
typecheck       clean
lint            0 errors, 14 pre-existing warnings
full suite      641 / 641          (2 runs: one intended, one replacement after pin movement)
```

**Pin movement, all Type B and all stated.** Nine released test files moved together, and every one
is a census this repository keeps EXACT on purpose:

```
source-class census 19 -> 20        heby-integration/contracts (named list), osa3 x2, work1,
                                    work2-heby, work2-provider, osa-owner-eligibility
grounding projections 2 -> 3        hlr-human-legibility, work2-provider-disclosure
legibility consumers 7 -> 9         hlr-human-legibility  (the panel and the projection)
eligibility consumers 7 -> 8        osa-owner-eligibility (the register enumerates by the rule)
StateBlock consumers 8 -> 9         cmdv3-command-composition
`people` leaves HLR's forbidden-class list — the one line of that file OSA-4 changes, and its
reason is stated there: HLR itself still must not become a directory, and does not.
```

The postgres proof covers what a pure test cannot: a revoked membership, an archived membership and
a soft-deleted identity each **disappear** from the register; another organization's member is
unreachable; an organization holding no Governance authority is **refused rather than answered
empty**; and reading writes nothing — audit rows unchanged, membership versions unchanged, measured
before and after.

---

## 6 · Foreseeable defects found and fixed BEFORE release

1. **A vocabulary firewall would have banned the evidence.** A structural assertion forbidding the
   word `memberships` in the grounding projection tripped on the projection's own honest sentence
   about how many memberships the organization holds. Re-pointed to the SEAM — no schema import, no
   database handle, no query — which is what the check was actually for.
2. **A retired department read as current.** The panel rendered "Recorded as working in Finance" for
   a placement whose department had since been retired. It now says so, using the placement
   authority's own released wording.
3. **A prose mention became a false consumer.** The read seam's header named the legibility module by
   filename, which put it in HLR's exact consumer census as a consumer it is not. Rephrased.

---
