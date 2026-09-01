# HLR — Human Legibility Reach · Closure

**Era III, third program, one milestone.** The humans an organization already records become
readable to the humans who already have the right to see them — on the one product surface that
needed it, through the authority that already owns the fact.

**Baseline:** `main` at `856f237`, equal to real `origin/main` by `git ls-remote`.
**Production migration ledger:** **41 → 41.** No migration was authored, applied or needed.
**Released at:** `166bcec`.

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

## 9 · Production acceptance — PARTIAL, and the partition is stated rather than blurred

**No migration ceremony was run and none was needed. The production ledger is 41 before and after.**

| # | Acceptance item | Verified | By what |
|---|---|---|---|
| — | released and pushed | **YES** | `166bcec`, equal to real `origin/main` by `git ls-remote` |
| — | deployed to production | **YES** — `READY`, target `production` | `githubCommitSha` = `166bcec9…` on `main`, read from the Vercel REST API rather than inferred; aliases include `www.hebuntech.com` |
| 1 | the control no longer requires typing a uuid | **YES, by the deployed source** | the free-text field and its `placeholder="member id"` are gone at this SHA, and the regression bites the pre-fix control |
| 2 | the candidate control lists the real human by label | **NOT VERIFIED IN PRODUCTION** | see below |
| 3 | Engineering renders its accountable human readably | **NOT VERIFIED IN PRODUCTION** | see below |
| 4 | the owner identifier is unchanged | **NOT MEASURED** | see below |
| 5 | no department mutation required to prove display | **YES** | nothing in this milestone writes; the reads are read-only, proved structurally and by mutation |
| 6 | no Governance decision, permit, execution or provider action | **YES, structurally** | the module imports no Governance writer, no permit seam and no adapter; asserted, and no production write was attempted |
| 7 | Heby unchanged and identifier-only | **YES** | its grounding does not import this module, the source-class census is unchanged at 17, and its "the owner is an IDENTIFIER" contract is asserted verbatim |

**Why 2, 3 and 4 are not verified here, stated plainly rather than dressed up.**

Two independent limits, and neither was worked around.

*The data-side check was refused.* A read-only script — `SELECT` statements and the released reads,
no write of any kind — was written to run `readSelectableMembers` and `resolveHumanLabels` against
the real control plane and report whether the real human's label resolves and whether the recorded
Engineering owner identifier is unchanged. **The permission layer declined access to the hosted
database URL, and no workaround was attempted.** The script exists and is unrun.

*The rendered check needs the Director's own session.* Items 2 and 3 are statements about what an
authenticated human sees on `/director/organization` in production. That surface is behind the
Director's credentials, which are not mine to hold or to use.

**What the equivalent evidence does say.** The same two reads, the same gate and the same writer were
exercised end to end against a real PostgreSQL database with three tenants and six people, and the
rendered surface was photographed with a real signed-in human: the control was a `<select>` of names,
its option values were identifiers, the Governance authority holder appeared in it, and the owner
line carried the label beside the identifier. That is a full proof of the mechanism and **not** a
measurement of production, and it is recorded as the former.

**So this milestone is RELEASED and DEPLOYED, and its production acceptance is OPEN on three items
that need the Director.** Recorded that way deliberately — OSA-2's §9.4 named declaring closure one
step ahead of the evidence as an ordering error, and this section refuses to repeat it.

## 10 · Limitations — recorded, not implied away

```
one tenant                          one department              one accountable human
no roster surface                   no member list anywhere but the two pickers
no human→department assignment      no agent assignment writer
no teams, no hierarchy              no scoped Governance delegation
Heby still answers with identifiers only
the writer still accepts a revoked member (§7.4)
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
Production acceptance:                     PARTIAL — 4 of 7 items, §9
Bite-proofs:                               9 of 9 bit
Final suite:                               **625 passed, 0 failed, 625 total**
```

Era III remains open. This milestone selects no successor, and selecting one is a Director decision.
