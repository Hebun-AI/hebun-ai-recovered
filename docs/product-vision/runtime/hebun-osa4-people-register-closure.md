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

## 7 · Production acceptance

**Deployed commit is the release commit, byte for byte.** `66a188c3faae8b34377bffef010392cea2d58eaa`,
read from the Vercel REST API's `meta.githubCommitSha` on deployment
`dpl_3LWd21XQuW5WR5iPsUY7iV6RWq2d` — target `production`, state `READY` at **2026-09-01T20:33:38Z**,
aliased to `www.hebuntech.com`. Cluster `7675444875863894887`, database `neondb`.
**Production ledger 43 → 43.** No migration exists in this capability, and production confirms it:
no `people`, `person`, `member_register` or `roster` table exists in the schema.

### What production authoritatively holds

Read directly from `memberships ⋈ users` under the **released eligibility predicate**, before the
Director touched anything:

```
eligible members of "Hebun AI"   exactly 1   d5b496df-588c-49c5-9cc2-17672b82dd10
its membership row               55aa4d45-9f5e-4ff1-9101-c15b440b4dfd
membership recorded at           2026-08-18T22:00:19.335Z
ineligible memberships           none
that person's placement          Engineering, in service
Identity's name columns          display_name NULL, name NULL
```

The last line is the one that made the acceptance worth performing: it **predicted, before the
observation, that the two surfaces must disagree** — the page rendering the product label
`senoltr@gmail.com`, and Heby rendering `name unavailable`.

### The human observation, and its authoritative corroboration

The Director observed `/director/organization`: **exactly one in-force person, labelled
`senoltr@gmail.com`, identifier preserved beside it, "Recorded as working in Engineering", and
"Membership record created 2026-08-18T22:00:19.335Z. Not a hire date."** Heby, asked *"Who is in
this organization?"* in Command, answered using **`name unavailable`, not the address**.

That answer was then corroborated **not from prose but from what production stored** — G6D's durable
answer-source evidence for that very message:

```
source_class   people
record_ref     member/55aa4d45-9f5e-4ff1-9101-c15b440b4dfd
label          name unavailable
authoritative  true
detail         name unavailable (d5b496df-588c-49c5-9cc2-17672b82dd10) is recorded as a member of
               this organization, and Hebun's record of that membership was created
               2026-08-18T22:00:19.335Z — which is not a hire date and not a start date. This is a
               RECORDED membership, not an observation. …
```

Every field matches the authoritative rows exactly: the `record_ref` **is** the membership row's id,
the identifier **is** the user's id, and the timestamp **is** `memberships.created_at`. The answer
cited ten source classes, `people` among them at `authoritative: true`, beside `placement` — the two
kept apart, in one answer, as designed.

**Two renderings of one fact, at one instant, and both correct.** `UI LEGIBILITY != MODEL PROVIDER
DISCLOSURE` is not asserted here; it is the measured difference between `coalesce(display_name, name,
email)` on a server-rendered page and `coalesce(display_name, name)` in a provider request.
**No row this answer stored contains an `@` at all.**

---

## 8 · Non-effects, measured across the whole database

```
59 tables carrying created_at      scanned for rows created since the deploy
57 tables carrying updated_at      scanned for rows updated, excluding created = updated
 6 tables timestamped otherwise    scanned by recorded_at / occurred_at
```

Everything that moved, named and explained — nothing filtered out:

| Table | Change | Why it is not this capability |
|---|---|---|
| `user_session_contexts` | +2 | The Director signing in to perform the acceptance |
| `auth_credentials` | 1 updated | The same sign-in |
| `conversations` / `messages` | +1 / +2 | Asking Heby the question — using the product, not the register |
| `heby_answer_source_evidence` | +45 | G6D's durable evidence for that answer, `people` = 1 of its items |
| `department_placements` | +1 at **19:18:50Z** | OSA-3's acceptance, **75 minutes before this deployment was READY** — measured, not assumed |

And what did **not** move:

```
audit_log                39 before, 39 after   a read writes no audit row
memberships              version 1, created_at = updated_at   never touched
users                    version 1, created_at = updated_at   never touched
department_placements    version 1, created_at = updated_at   untouched by this capability
drizzle ledger           43 -> 43
decision_records         no new bootstrap, no new decision
```

The register enumerates people and **writes nothing**, in production, measured.

**One honest note about the evidence table.** Four rows in `heby_answer_source_evidence` — of its
entire history — contain an `@`: one `integrations` row carrying a connected Google account, and
three `work` rows from 15:27–15:28 the same day, recorded **before** WORK-2's privacy hardening
reached production. **Zero were recorded by this answer.** A permanent record cannot be tidied and
was not; it is stated instead.

---

## 9 · Closure

**CLOSED / PRODUCTION-ACCEPTED.**

```
release commit    66a188c   feat(organization): show who is in this organization
deployed commit   66a188c   identical, READY 2026-09-01T20:33:38Z
production ledger 43        unchanged — zero schema, zero migration
suite             641 / 641 (two runs: one intended, one replacement after pin movement)
```

**Deferred, intentionally and named.** No writer: membership is still created and revoked where it
always was, and this capability gives nobody a second way. No paging: the register is bounded at 200
with no offset and no cursor, and declares truncation rather than hiding it. No role, no reporting
line, no manager, no team, no title, no presence, no activity — ABSENT rather than guarded. No
history: a revoked membership leaves the register, and the register says that absence is not a claim
that somebody was never a member. `workforce` remains an unconnected class, and this capability did
not connect it.

**No successor authorized.** APF and ASA remain deferred with their activation conditions unproven.
Pin-debt cleanup remains backlog.
