# HLR — Human Legibility Reach · Closure

**Era III, third program, one milestone.** The humans an organization already records become
readable to the humans who already have the right to see them — on the one product surface that
needed it, through the authority that already owns the fact.

**Baseline:** `main` at `856f237`, equal to real `origin/main` by `git ls-remote`.
**Production migration ledger:** **41 → 41.** No migration was authored, applied or needed.
**Released at:** `166bcec`. **Production accepted:** YES. **Milestone CLOSED.**

---

## 1 · What HLR is, in one sentence

> A Director choosing who is accountable for a department now picks a person from a list of names
> instead of typing a UUID, and the department says who its owner is by name — while the record
> still holds the identifier and nothing anywhere gained an authority.

## 2 · The pins

```
A LABEL              != AN IDENTITY KEY        READABLE  != AUTHORIZED
UNRESOLVED           != NOBODY                 RESOLVED  != AUTHORIZED
OWNERSHIP CANDIDATE  != DELEGATION CANDIDATE
PRODUCT LEGIBILITY   != MODEL GROUNDING
A FIELD THAT IS POPULATED != A FIELD THAT IS RENDERED
```

The last one is OSA-2's, reused deliberately: this milestone's own firewall fell to it once (§7.2).

## 3 · The measured problem

OSA-2 recorded a real department with a real accountable human and every surface answered
`d5b496df-…`. The control that set that owner was a free-text field asking a Director to type a uuid.

The discovery that preceded this milestone first concluded *"Hebun cannot name a human."* **That was
wrong, and the correction is what made the milestone small.** A `from(users)` grep missed raw-SQL
readers. `readDelegationCandidates` — released, tenant-scoped, gated on Governance authority — has
enumerated active members by `coalesce(display_name, name, email)` since the delegation surface
shipped.

So the authority question was already answered and shipped. What did not exist was **reach**: one
seam, one consumer, and a raw uuid everywhere else.

## 4 · What was built

**One module.** `features/auth-runtime/human-label-read.server.ts` — beside
`identity-repository.server.ts`, which is the module that reads `users`. Two functions, no table, no
writer, no transaction. It is the projection pattern G6C set and E2-1, E2-5 and AMA-3 followed: the
projection belongs to the authority that owns the facts, and the consumer imports it.

| | `readSelectableMembers` | `resolveHumanLabels` |
|---|---|---|
| answers | who may be made accountable | who is this identifier |
| membership predicate | **active** — status, lifecycle, not revoked | **any** — tenant scope only |
| bound | 50, ordered by label | 100 ids, refused whole if exceeded |
| gate | `resolveGovernanceAuthority` | `resolveGovernanceAuthority` |
| unauthorized | `{unavailable, not-authorized}` | empty map |

**Two predicates on purpose.** A department keeps naming its owner after their membership ends —
OSA-1's rule, *"erasing them would destroy the record that anyone ever was"*. A label read that
dropped former members would put a bare uuid on exactly the row whose history matters most.

**The difference from delegation, which is the whole design risk.** `readDelegationCandidates`
excludes the caller (`u.id <> authorityActorId`) because self-delegation is invalid. Ownership is
the opposite: OSA-2 recorded the tenant's only human as owner of Engineering. Inheriting that
exclusion would have returned an **empty picker for the one organization that exists** — a wrong
answer that looks exactly like a broken feature. Both sides are pinned, and a bite-proof introduces
the exclusion to prove the guard catches it.

**Two surfaces changed, and they compose rather than merge.** The page performs both reads and hands
the panel two independent answers. `DepartmentView` gained no label field, no label is persisted, and
OSA's reader still names `users` nowhere.

## 5 · The product change

| | before | after |
|---|---|---|
| owner control | free-text field, `placeholder="member id"` | `<select>` of people |
| what it submits | a typed string | `member.userId` — unchanged |
| owner line | `Accountable: d5b496df-…` | `Accountable: **Ada Engineer** 4e9f61f0-…` |
| unresolved owner | — | the identifier plus *"name unavailable"* |
| owner no longer selectable | would silently fall to the first option | a disabled option, still shown |

**The identifier is never erased.** It travels to the writer and stays on the surface beside the
label, because a label is a rendering and the identifier is what the record holds.

## 6 · What was NOT done

```
no schema                    no migration            ledger 41 → 41
no roster authority          no people authority     no directory, no search, no paging
no human→department assign   no agent→department     no teams, no hierarchy
no Heby source class         no workspace change     no grounding widening
no Governance domain         no decision record      no permit, no execution
no provider scope change     no agent #2             no APF / ASA / GDR / GIA activation
```

**Heby is deliberately untouched.** OSA-2 production-accepted Heby answering with an identifier and
declining to resolve it. That contract is preserved verbatim and asserted: no Heby feature imports
this module, and the census stays at 17 source classes.

## 7 · What the gate found

### 7.1 · A released pin broke on a change that preserved its meaning

`l3-organization-authority/firewall.ts` asserted the literal
`readOrganizationAuthority(await resolveTenantContext())`. The page now binds the tenant to a name to
share it across three reads, so the literal died while the property — *the tenant comes from the
session and nothing else* — held.

**Repaired stricter, not weakened**, on R6D's precedent. The pin now asserts that `resolveTenantContext`
is never handed an argument and that **every** named read on the page receives `tenant`. A page that
resolved correctly for the authority read and handed something else to a legibility read would have
satisfied the old assertion. Bite-proof `O9b` injects exactly that and is caught.

### 7.2 · A firewall assertion that a declaration satisfied

The "no invented name" guard asserted `code.includes("LABEL_UNAVAILABLE")`. A **declaration**
satisfies that. Bite-proof `H8` replaced the rendered constant with `{"Unknown"}` and the suite
**passed** — a guard that looked proved and was not.

Repaired to assert the rendering position, not the constant's existence. The banned-literal check is
scoped to the owner line rather than the file, because a word-ban across a surface trips on the
product's own honest prose — the failure INT-3 recorded.

### 7.3 · A defence-in-depth predicate that no fixture could test

`H4` removes `isNull(memberships.revokedAt)` and **survived**: every revoked fixture also carried
`status = 'revoked'`, so the sibling predicate caught the mutation. The proof needed a row whose two
revocation facts **disagree** — `status = 'active'`, `revoked_at` set. Added, and the predicate is
now independently load-bearing rather than decoration.

### 7.4 · The writer is looser than the picker, and that was measured here

`setDepartmentOwner`'s check is `memberships.lifecycle_status = 'active'` and nothing else. It
consults neither `status`, nor `revoked_at`, nor `users.deleted_at` — so **the released writer accepts
a revoked member and a soft-deleted identity as accountable**, and did so before this milestone
existed.

An assertion here expected a refusal and got `recorded`. The test was wrong, not the code.

**Not repaired, deliberately.** Widening or narrowing another authority's rule is not this
milestone's to do. What this milestone owes is the **direction**, and only one direction is safe:

```
THE PICKER OFFERS FEWER PEOPLE THAN THE WRITER ACCEPTS. NEVER MORE.
```

Asserted by running the released writer against every offered candidate. The two rows where they
differ are pinned as a real difference rather than smoothed into a claim that they agree.
**Recorded as a standing OSA observation for a future Director decision.**

### 7.5 · A probe that measured the wrong thing

`owner_actor_id::text ~ '[A-Za-z ]'` was meant to prove no label reached the column. A uuid's hex
digits are letters, so it failed against correct code. Replaced with a whole-row scan for every label
the fixture invents — which also catches a label persisted into a column a later milestone adds.

## 8 · Evidence

| | |
|---|---|
| `tests/hlr-human-legibility/legibility-postgres.ts` | three tenants, six people, real writer, real gate |
| `tests/hlr-human-legibility/legibility-firewall.ts` | read-only, no schema, no roster, Heby untouched, dormant adapter still dormant |
| `tests/hlr-human-legibility/bite-proofs.ts` | **9 mutations, 9 bit** |
| `tests/l3-organization-authority/*` | repaired, and `O9`/`O9b` bite |
| local render | signed-in Director, `<select>` of two names, owner line carrying label **and** identifier |
| final suite | **625 passed, 0 failed, 625 total** |

**The dormant assignment path was re-asked and is still dormant.** `supabase-postgres-adapter.ts`
holds a real `insert into agents (… department_id …)` that resolves a department **by name**. Before
OSA it always threw because `departments` was empty; a real department now exists, so the question
had a new answer. Measured: `memory` is the active provider, Agent CRUD reaches its in-memory adapter
and never this file, and the adapter's two consumers are a health probe and a `registries`
repository. **Neither activated nor normalized — the file is byte-identical.**

## 9 · Production acceptance — PASS

**No migration ceremony was run and none was needed.** This milestone authored **zero** migrations;
the released SHA carries 41 migration files, the same 41 the OSA-2 baseline carried. **The ledger
cannot have moved by this milestone**, and that is stated as what it is — a proof from the absence of
any migration, not a fresh reading of the production ledger, which was not accessible here.

| # | Acceptance item | Verdict | Evidence |
|---|---|---|---|
| — | released and pushed | **PASS** | `166bcec`, equal to real `origin/main` by `git ls-remote` |
| — | deployed to production | **PASS** | `githubCommitSha` on `www.hebuntech.com` read from the Vercel REST API, not inferred. It now serves `63fb170`, which differs from `166bcec` **only** in this document and `learnings.md` — **zero** files under `src/`, so the deployed product code IS the released code |
| 1 | the control no longer requires typing a uuid | **PASS — human-observed** | the Director opened `/director/organization` in production: *"`Accountable member` is now a selection control rather than a free-text UUID field"* |
| 2 | the candidate control lists the real human by label | **PASS — human-observed** | the control shows `senoltr@gmail.com`; the current accountable human appears in it by readable label |
| 3 | Engineering renders its accountable human readably | **PASS — human-observed** | *"Accountable: **senoltr@gmail.com** `d5b496df-588c-49c5-9cc2-17672b82dd10`"* |
| 4 | the owner identifier is unchanged | **PASS** | the observed `d5b496df-588c-…` matches the owner OSA-2 recorded as `d5b496df-…`, and it is rendered **beside** the label rather than replaced by it. No mutation occurred (item 5), and no path in this milestone writes |
| 5 | no department mutation required to prove display | **PASS** | the existing record was sufficient; the Director explicitly did not mutate the department, and this milestone ships no writer |
| 6 | no Governance decision, permit, execution or provider action | **PASS** | the module imports no Governance writer, no permit seam and no adapter — asserted structurally — and the only production interaction was a page render |
| 7 | Heby unchanged and identifier-only | **PASS — by byte-identity** | see below |

**Item 7 was proved by byte-identity rather than by a probe, and that is the stronger evidence.**
Every file in Heby's Organization grounding path is **identical** at `856f237` (the OSA-2 baseline) and
at the released `166bcec`, by sha256 of the blob:

```
heby-organization-source.server.ts   read-structure.server.ts    read-organization.server.ts
organization-authority/contracts.ts  structure-contracts.ts      heby-integration/contracts.ts
workspace-registry.ts                model-answer.server.ts      heby-runtime/source-resolver.ts
```

HLR changed **eight** files in total — two surfaces, one new module, five test files — and **not one of
them is a Heby file**. A production probe would have sampled one question; byte-identity covers every
question Heby can be asked. Heby still answers with the identifier and still declines to resolve it,
because the code that decides that is the same code OSA-2 accepted.

**The label is an email, and that is the design working rather than a shortfall.** The precedence is
`display_name → name → email`, and production's `users` row for this human carries neither of the
first two — so Hebun rendered the only name-ish thing it actually holds. Nothing was invented to fill
the gap. If a display name is ever set, the same surface will show it with no code change.

**What was NOT verified, recorded rather than implied away.** No production database read was
performed: the read-only script that would have re-measured the ledger and the owner column from the
control plane was declined by the permission layer, and **no workaround was attempted**. It exists and
is unrun. Item 4's verdict therefore rests on the rendered identifier, OSA-2's recorded value, and the
absence of any writer in this milestone — which is sufficient for the claim being made, and is stated
as that rather than as a column reading.

## 10 · Limitations — recorded, not implied away

```
one tenant                          one department              one accountable human
no roster surface                   no member list anywhere but the two pickers
no human→department assignment      no agent assignment writer
no teams, no hierarchy              no scoped Governance delegation
Heby still answers with identifiers only
the writer still accepts a revoked member (§7.4)
no human in this tenant carries a display name, so the label renders as an email address
no production database read was performed; the read-only script exists and is unrun (§9)
```

None of these exists. Nothing here should be read as implying any of them does.

## 11 · Verdict

```
Existing Identity authority reused:        YES
New identity authority created:            NO
Authorized human label resolution:         YES
Department owner picker:                   YES
Current authority holder selectable:       YES   the delegation difference, pinned
Underlying owner identifier preserved:     YES   submitted, stored and rendered
Cross-tenant isolation verified:           YES   both reads, both directions, real database
Human roster created:                      NO
Human-to-department assignment created:    NO
Heby grounding widened:                    NO
Schema migration:                          NO    ledger 41 → 41
Production acceptance:                     PASS   7 of 7, three human-observed, §9
Production ledger:                         41     zero migrations authored
Milestone:                                 CLOSED
Bite-proofs:                               9 of 9 bit
Final suite:                               **625 passed, 0 failed, 625 total**
```

**Human Legibility Reach is CLOSED.**

Era III remains open. This milestone selects no successor, and selecting one is a Director decision.
