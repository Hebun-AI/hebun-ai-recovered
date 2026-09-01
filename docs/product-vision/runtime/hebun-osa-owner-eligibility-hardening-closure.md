# OSA Owner Eligibility Hardening · Closure

**A narrow integrity fix, not a milestone.** The Organization Structure Authority's owner writer now
refuses a human the authoritative Identity and membership state says is no longer eligible — on its
own, with no surface in the way.

**Baseline:** `main` at `933b7ce`, equal to real `origin/main` by `git ls-remote`.
**Production migration ledger:** **41 → 41.** No migration was authored, applied or needed.
**Released at:** `0b46154`, deployed to production and serving `www.hebuntech.com`.

---

## 1 · The reported issue, confirmed

**CONFIRMED at the source, and it was already proved empirically.** `setDepartmentOwner`'s check was:

```ts
eq(memberships.tenantId, tenantId),
eq(memberships.userId, userId),
eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
```

Three conditions. A membership ends in four ways and an identity in two, so the writer accepted:

| ineligible human | old writer |
|---|---|
| membership `status = 'revoked'` | **ACCEPTED** |
| membership `revoked_at` set | **ACCEPTED** |
| identity soft-deleted (`users.deleted_at`) | **ACCEPTED** |
| identity archived (`users.lifecycle_status`) | **ACCEPTED** |

It was measured at the Human Legibility Reach gate — an assertion expecting a refusal got `recorded`
— and recorded there as a standing observation rather than repaired, because widening or narrowing
another authority's rule was not that milestone's to do. This is that repair.

**The picker was already strict.** So the product looked correct while the authority was not: a
caller with a session could set any uuid it liked, and only the UI stood between it and the record.

```
THE UI HIDING SOMEBODY IS NOT ENFORCEMENT.
```

## 2 · The semantics were borrowed, not invented

The brief required reusing existing definitions. They existed, in the one place that matters most:
**`identity-repository.server.ts`**, which decides whether a human may hold a session in a tenant at
all, applies the same three membership conditions at `findPrimaryActiveMembership`,
`findActiveMemberships` and `findTenantCandidates`. The identity half is what
`findActiveLocalIdentityByEmail` applies to `users`, plus the soft-delete column
`create-durable-agent-identity.server.ts` already checks when it verifies an agent's human owner.

Nothing new was defined. `features/auth-runtime/member-eligibility.ts` states them once:

```
memberships.tenant_id        they belong to a DIFFERENT organization
memberships.status           the membership was revoked
memberships.revoked_at       the membership was revoked, recorded on the other column
memberships.lifecycle_status the membership row was archived or deleted
users.lifecycle_status       the identity was archived or deleted
users.deleted_at             the identity was soft-deleted
```

**It is a predicate, not an authority.** No database handle, no query, no writer, no tenant context,
no Governance resolver. It returns drizzle conditions, so a caller must already hold its own
authorized transaction and add its own scoping.

**And deliberately not a `.server` module.** OSA's released firewall pins the writer's reachable
`.server.ts` modules to an exact list; a rule shipped as a server module would have forced that list
open. A pure one does not appear in it, and that assertion still passes untouched.

## 3 · Three consumers, one definition

| consumer | takes | why |
|---|---|---|
| `write-structure.server.ts` | the **whole** rule, for one named id | it is the authority; it must fail closed |
| `human-label-read.server.ts` | the **whole** rule, unscoped | the picker cannot offer what the writer refuses |
| `read-structure.server.ts` | the **membership half** | a released firewall forbids it from naming `users` at all |

**The picker and the writer are now exactly aligned** rather than merely subset-related. Before, the
picker was stricter than the authority — the safe direction, and still a mismatch that produced
refusals no human could explain if reached any other way.

**The reader's flag was tightened too, and that was not scope creep.** `currentlyActiveMember` used
the same permissive predicate, so a revoked owner read `currentlyActiveMember: true` while the
hardened writer refused that same human — one change shipping two contradictory answers to one
question. It now takes the shared rule's membership half.

**Its bound is stated rather than implied:** it may not read `users`, so an owner whose *identity* was
soft-deleted while their membership stayed active still reads `currentlyActiveMember: true`. That is a
known limit of a flag derived from `memberships`, not a claim the identity is live. The released
firewall forbidding that read is worth more than the one dimension it costs.

## 4 · Historical records are not rewritten

The principle the brief preferred is the one the repository already implies, and it is now proved:

```
ENFORCED AT ASSIGNMENT.        NOT REWRITTEN LATER.
```

A department whose owner's membership is revoked **after** ownership was recorded keeps naming them,
stays in service, and changes exactly one thing — the derived flag. Re-assigning that same human is
then refused. No automatic retirement, no ownership erasure and no lifecycle transition was added
to make it so — the flag is derived on read, and nothing writes it.

## 5 · Evidence

| | |
|---|---|
| `tests/osa-owner-eligibility/eligibility-postgres.ts` | two tenants, eight humans, one per way of being ineligible |
| `tests/osa-owner-eligibility/eligibility-firewall.ts` | predicate-not-authority, borrowed semantics, three consumers, nothing added |
| `tests/osa-owner-eligibility/bite-proofs.ts` | **7 mutations, 7 bit** |
| repaired | `osa1-organization-structure/structure-firewall.ts`, `hlr-human-legibility/legibility-firewall.ts`, `hlr-human-legibility/legibility-postgres.ts` |
| final suite | ****628 passed, 0 failed, 628 total**** |

**Every refusal was produced by calling the released writer directly**, with no page, no server
action and no picker in between — which is the whole point of the fix.

**The refusals apply at CREATE as well as at set-owner.** `recordDepartment` takes an optional
`ownerUserId` and runs the same check; a test covers it, because a hardening that only guarded one of
two entry points would be a hardening in name.

## 6 · What the gate found

### 6.1 · A bite-proof that survived because a sibling condition covered it — again

`E2` removes the `memberships.status` condition and **survived**: every revoked fixture also carried
`revoked_at`, so the sibling caught the case and the suite went on passing. This is the *same* failure
mode the previous milestone hit from the other side, and the previous fix — a row revoked by timestamp
alone — did not prevent it, because the mirror case was still missing.

The rule this makes explicit: **two conditions checked separately need two fixtures, each isolating
one.** Both now exist, and both proofs bite.

### 6.2 · A mutation that failed to compile is not a mutation that bit

`E6` re-wires the writer to the membership-only subset. The first version called
`activeMembershipOnlyConditions`, which the writer does not import — a `ReferenceError`, so the suite
died at its first assertion and the proof "bit" for a reason unrelated to eligibility. Inlined so it
compiles. **A mutation that does not compile is testing the module loader.**

### 6.3 · Two released literal pins broke on a change that preserved their claim

`.from(memberships)` was asserted in two firewalls. The owner check now reads
`.from(users).innerJoin(memberships, …)`, so the literal died while the claim — membership is READ
here, never written — held.

Both repaired stricter rather than relaxed: they now assert the join, the shared rule by name, that
no `insert`/`update`/`delete` reaches `memberships` **or** `users`, and that the writer selects no
`name`, `email` or `display_name`. **Hardening the check bought this authority no ability to describe
anybody**, and that is now pinned rather than assumed.

### 6.4 · Moving a condition breaks every proof anchored to where it used to live

The first final suite came back **627 passed, 1 failed** — `hlr-human-legibility/bite-proofs.ts`. Not
a behaviour regression: four of that milestone's nine mutations targeted where-clause conditions that
were typed inside the picker and are now stated once in the shared rule, so their find-strings were
absent and the harness correctly refused to run them.

That refusal is the design working. `withMutation` asserts the find-string is present *before*
mutating, precisely because **a mutation that cannot be applied looks exactly like one that failed to
bite** — without that check the suite would have reported four guards as proved while testing
nothing.

Three were re-anchored onto the shared rule and one onto the picker's new one-line `where`. They were
kept rather than deleted as duplicates of `E1`–`E5`: those defend the ELIGIBILITY suite, while these
show that weakening the same shared rule is still caught by the LEGIBILITY suite, which is a
different consumer with different fixtures. All nine bite again.

**One stale comment was corrected rather than deleted.** `H4` explained itself with "the writer would
ACCEPT them, so nothing downstream catches this" — true when written, false as of this hardening. The
sentence is the record of why that proof existed before there was a second line of defence.

## 6A · Production acceptance — NON-MUTATING, by design

**Nothing was written to production to accept this.** No department was created or changed, no
revoked or deleted user was manufactured to demonstrate a refusal, and no production database read
was performed. Every negative case is proved in controlled tests against a disposable database, which
is what the brief asked for.

| item | verdict | evidence |
|---|---|---|
| hardened release deployed | **PASS** | `githubCommitSha` `0b46154…` on `main`, `READY`, target `production`, serving `www.hebuntech.com` — read from the Vercel REST API, not inferred |
| no schema migration occurred | **PASS** | zero files changed under `db/schema` and `db/migrations` between `933b7ce` and `0b46154`; 41 migration files at both |
| no department mutation for acceptance | **PASS** | the four source files changed are one pure predicate and three consumers; the acceptance itself issued no write |
| Heby remains unchanged | **PASS** | its Organization grounding path is byte-identical at `933b7ce` and `0b46154` by sha256, and no Heby file is in the diff |
| no Governance decision / permit / execution / provider action | **PASS** | no Governance table is named by any changed file, no adapter is reached, and no production act was performed |
| existing Engineering readable, label intact, picker still contains the human | **PASS — by monotonicity, not by a fresh render** | see below |

**Why the last row is safe without re-observing it, and what that argument does not cover.**

The hardening is **monotonic**: it only ADDS conditions to a predicate. So a human it removes must be
one who fails a condition that did not exist before. The Director's production evidence for Human
Legibility Reach was gathered through an authenticated session — and signing in requires
`memberships.status = 'active'`, `memberships.lifecycle_status = 'active'`,
`memberships.revoked_at is null` and `users.lifecycle_status = 'active'`, which is five of the six
conditions including every one this change added on the membership side.

The sixth, `users.deleted_at is null`, is not provable from outside. A row carrying an active
lifecycle and a deletion timestamp at once would be a contradiction this system has no writer for,
and such a human could not hold Governance authority — so the risk is named rather than dismissed,
and it is smaller than the defect being repaired.

**What was NOT done: nobody has opened the page since the hardening deployed.** The render is
structurally guaranteed and has not been freshly observed. A ten-second look at
`/director/organization` would close it outright, and it is recorded as open rather than folded into
the row above.

## 7 · Limitations — recorded, not implied away

```
the structure read's owner flag cannot see identity soft-deletion (§3)
eligibility is enforced at assignment; nothing re-evaluates existing owners
no roster, no human→department assignment, no agent assignment, no teams, no hierarchy
Heby unchanged — it still answers with identifiers only
```

## 8 · Verdict

```
Identity authority:                 UNCHANGED
Membership authority:               UNCHANGED
OSA authority:                      UNCHANGED — it verifies eligibility, it does not own it
Owner eligibility enforcement:      HARDENED
Picker / writer alignment:          EXACT, one shared definition
Historical ownership:               NOT mutated, NOT retired, NOT erased
New authority:                      NONE
Schema / migration:                 NONE — ledger 41
New Organization capability:        NONE
Heby grounding:                     NOT widened
Dormant adapter:                    still unreachable, byte-identical
Production acceptance:              PASS, non-mutating — one render unobserved (§6A)
Bite-proofs:                        7 of 7 bit, plus 9 of 9 re-anchored legibility proofs
Final suite:                        **628 passed, 0 failed, 628 total**
```
