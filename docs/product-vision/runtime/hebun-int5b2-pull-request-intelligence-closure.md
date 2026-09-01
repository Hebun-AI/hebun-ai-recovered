# What Is Changing In Our Engineering Repositories — `/pull-requests`

**Era III. One capability, one loop: selected, designed, built, validated, released, deployed,
production-accepted, closed.** The Definition of Done in §1 was written BEFORE any mutation.

**Authority expansion: NONE.** Zero schema, zero migration, zero writer, zero new authority, zero
new command kind, zero new server action, zero new Heby source class, **zero new provider
permission**. One handler, one registry entry, one capability binding, one per-command placeholder.
**Production ledger 43 → 43.**

---

## 1 · Selection, from current repository reality

Six candidates were ranked against what the repository actually holds after OSA-4.

**A · GitHub PR intelligence — SELECTED.** `readRepositoryPullRequests` was built by GITHUB-4
against the real GitHub API and, verified rather than assumed, **still had zero consumers**: no
command, no handler, no surface, no Heby reach. The repository said so itself, in a released pin
that named the phase that would change it:

> *"the pull-request reader still has no production caller. That is the honest state, and this pin
> must be edited deliberately by whichever phase gives it one"*

This is that phase. It is the profile the selection rule prefers above all others — **authoritative
and runtime foundations already released, stranded from the product**.

**B · Department-scoped Knowledge — DEFERRED.** It requires a semantic authority that does not
exist: what it MEANS for Knowledge to belong to a department. Departments existing is not that
semantics, and inventing it inside a join table to make a feature possible is the move the
instruction explicitly forbids.

**C · Unified decision horizon — DEFERRED.** It aggregates authorities that already have surfaces
and unlocks no new fact.

**D · Work evolution — DEFERRED.** The one obvious primitive, a target date, is refused by released
code (`work-item.ts`: "a judgement or a measurement this authority has no mandate to hold"). Nothing
else is justified today.

**E · Derived organizational intelligence — DEFERRED.** OSA-4 already composes people, placement and
department on one surface. A further derivation adds no fact and would risk dressing derived data as
authoritative.

**Enterprise job unlocked:** *"What is changing in our engineering repositories?"*

---

## 2 · Provider reality, measured before it was designed against

The distinction the instruction demands, taken from production rather than from a descriptor:

```
defined                provider-catalog entry, released
configured             5 GitHub App env vars in Vercel production
connected              integrations.connection_state = connected
verified               last_verified_at 2026-08-24T16:47:15Z, last_success_at identical
healthy                health = healthy, last_error_at NULL, failure_reason NULL
installation           external_account_id 156248772
capability-available   scopes: metadata:read, pull_requests:read
authorized             per tenant, at run time, by the capability authority inside the seam
```

**The permission was already granted.** `pull_requests: read` has been one of the two permissions
every minted installation token asks for since GITHUB-4. This capability widens no scope, requests
no consent, and a released assertion pins the permission set to exactly those two.

---

## 3 · The boundaries that chose the shape

**It consumes the seam; it does not re-implement it.** A firewall asserts exactly one consumer of
`readRepositoryPullRequests` in the whole repository, and that the executor names neither the
transport nor the token frame — so the rule that *a repository id is a CLAIM until GitHub's own
installation listing names it* is enforced in one place, not two.

**It takes no arguments — a posture, not a limitation.** The released seam WOULD accept a repository
id and prove it. This command still accepts none, so no repository address crosses the client
boundary and INT-5B1's released statement about that action's payload stays true word for word. The
installation decides what is visible. A test drives the command with hostile arguments and asserts
the seam was called only with ids that came from GitHub's own listing.

**No new command kind, no new action.** `provider-read` already means "a bounded read from one
connected external provider and nothing else", which is exactly this. INT-5C needed a sibling kind
because it also reads Knowledge; this reads nothing Hebun owns. A firewall asserts the module still
has ONE entry point.

**No Heby source class, deliberately.** Grounding classes carry standing organizational truth into
EVERY model answer. Live provider data behind one would make every answer contact GitHub, and would
dress somebody else's records as this organization's own. The census stays at 20, asserted.

**Its own budget, because it spends more.** `/repositories` spends two provider calls. This spends
`2 + 3N`, and the ceiling is DERIVED from the fan-out rather than written next to it, so it cannot
drift from what the command does. The re-listing inside each frame is the seam's security property,
not waste.

---

## 4 · Truth semantics, carried as data

```
A PULL REQUEST   != ORGANIZATIONAL WORK        AN AUTHOR LOGIN != A MEMBER OF THIS ORGANIZATION
OPEN             != ACTIVE, HEALTHY OR AGREED  PROVIDER SILENCE != NOTHING IS HAPPENING
UNAVAILABLE      != EMPTY                      A BOUNDED READ  != ALL ACTIVITY
PROVIDER-DERIVED != ORGANIZATIONAL TRUTH       THE IDENTITY    != THE TITLE
A REPOSITORY THAT COULD NOT BE READ != A REPOSITORY WITH NOTHING OPEN
```

Every one travels in the provenance sentence or in a rendered line, never in prompt prose. The
metadata boundary is structural rather than filtered: the seam's shape has no field for a diff, a
patch, a body, a file or a commit, and a firewall asserts the command surfaces none of them either.

**Six negative states, none of which renders as another:** a refusal (six kinds), a provider fault
(six kinds), the command's own ceiling, an installation covering nothing, a repository that answered
with nothing, and a repository that could not be read — the last of which is NAMED with its own
reason rather than dropped. Truncation is declared at both levels: repositories not looked inside,
and pull requests beyond one page.

---

## 5 · Validation

```
targeted     int5b2-flow/command-and-provenance   PASS
             int5b2-flow/pull-request-firewall    PASS
             int5b2-flow/bite-proofs              10 / 10 mutations bit
regressions  int5b1 (6), int5c (2), int5a (3), github4 (2), hebycap1, s1 — all PASS
typecheck    clean
lint         0 errors
full suite   644 / 644          (2 runs: one intended, one replacement after pin movement)
```

**Pin movement, all stated.** Four released censuses moved together, and one of them had asked in
writing to be moved:

```
provider-read commands 1 -> 2        int5b1/command-contract
module public surface  4 -> 7        int5b1/provider-read-firewall (one entry point, still)
GitHub readers in the graph          int5b1/provider-read-firewall — a NAME ban replaced by an
                                     EXACT two-reader list, which is stricter than what it replaced
pull-request reachability INVERTED   provider-onboarding/acceptance-reachability — the pin that
                                     named this phase
```

**One suite failure was proven unrelated and left alone.** `ama1-agent-mandate/bite-proofs` fails at
clean `HEAD` with every change stashed under Node **v20.20.2**, and passes under Node **v24.16.0**,
the interpreter the previous loop's 641/641 baseline ran under. It is a Node-version-dependent
pre-existing failure in another workstream — measured twice, and not modified.

---

## 6 · Foreseeable defects found and fixed BEFORE release

1. **A clock in a module forbidden to hold one.** The first implementation computed per-repository
   deadlines with `Date.now()`. A released assertion bans that name in this module — a module that
   must mint no identifier has no business holding a clock. Restructured to one ceiling around the
   whole fan-out, which is simpler and removes the clock entirely.
2. **A substring ban that caught the dispatcher.** A firewall of this phase's own banned the word
   `patch` in the executor and tripped on `dispatch`. Replaced with field-shaped patterns.
3. **Two bite-proofs aimed at assertions that no longer fired first.** Both were re-aimed at
   assertions carrying explicit messages, rather than weakened.

---
