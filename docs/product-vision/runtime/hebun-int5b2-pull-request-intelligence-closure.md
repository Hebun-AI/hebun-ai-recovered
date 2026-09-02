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

## 7 · Production acceptance

**Deployed commit is the release commit, byte for byte.** `44bd77c92d1e865acbb5b852faf540a0e3a832ae`,
read from the Vercel REST API's `meta.githubCommitSha` on deployment
`dpl_B6TAwt81TGCjWcNeFiBTU9ARJif7` — target `production`, `READY` at **2026-09-01T22:12:26Z**,
aliased to `www.hebuntech.com`. Cluster `7675444875863894887`, database `neondb`.
**Production ledger 43 → 43**, and production confirms no table exists that could hold a pull
request, a repository, a provider record or a provider cache.

### The acceptance landed on the case this capability exists to get right

Before the Director ran anything, the answer was established from **two independent sides**:

```
Hebun's own connection state    connected · healthy · verified 2026-08-24T16:47:15Z
                                installation 156248772 · scopes metadata:read, pull_requests:read
GitHub, read independently      zero open pull requests in Hebun-AI/hebun-ai-recovered
  (gh CLI, a DIFFERENT          exactly ONE repository in the Hebun-AI organization
   credential from the
   installation token)
```

So GitHub's true answer was **zero**. That is the hardest case to render honestly, because a broken
implementation that conflates *the provider did not answer* with *the provider answered nothing*
looks identical to a correct one — unless the two paths are different code with different tones,
which is exactly what this command's `ok` and `unavailable` paths are.

### What the Director observed, on production

```
Title       No open pull requests in what was read
Line 1      Hebun-AI/hebun-ai-recovered — GitHub answered, and no pull request is open.
Line 2      Looked inside 1 repository — at most 3 per command, and at most 50 open pull
            requests in each.
Line 3      These are pull-request titles, numbers, authors and timestamps, and nothing inside
            them. This command reads no diff, no patch, no file, no commit and no comment — the
            shape it returns has no field for any of them.
Line 4      An open pull request is GitHub's record of a proposed change. It is NOT this
            organization's recorded work, and an author login is a GitHub identity, not a member
            of your organization.
Provenance  … (authoritative: false) … Provider-derived observation, not organizational truth …
```

**Every string was verified against the released commit rather than accepted as prose.** Each line
is present in `44bd77c` at the exact site that produces it — the title at the `totalOpen === 0`
branch, line 1 at the `entry.open === 0` branch, line 2 built from
`maxRepositoriesExamined = 3` and `maxRecordsPerRepository = 50`. The provenance is
`GITHUB_PULL_REQUEST_READ_PROVENANCE`, which **only the `ok` path attaches** — the `unavailable`
path carries a different sentence entirely. The observation therefore proves the informational
branch ran, not merely that something rendered. (One character differs from the source in the
transcription — a semicolon where the shipped string has a colon — which is a transcription
artifact of reporting, not a difference in what was served.)

### Provider corroboration

| Claim in the answer | Independently measured | Verdict |
|---|---|---|
| `Hebun-AI/hebun-ai-recovered` | `gh repo view` — exact full name | matches |
| "no pull request is open" | `gh pr list --state open` → `[]` | matches |
| "Looked inside 1 repository" | `gh api /orgs/Hebun-AI/repos` → `1` | matches, and the ceiling of 3 correctly did not bite |
| no truncation lines rendered | 1 repository, 0 pull requests — nothing to truncate | correct by absence |

**UNAVAILABLE != EMPTY, demonstrated in production rather than asserted.** GitHub answered with
nothing, and Hebun said so as an informational fact naming the provider as the source of the answer
— never as an outage, and never as silence.

---

## 8 · Non-effects, measured across the acceptance window

Counts taken **before** the Director acted (`2026-09-01T22:14:06Z`) and **after**
(`2026-09-02T02:01:06Z`):

```
drizzle ledger                    43  ->  43     no migration exists in this capability
audit_log                         39  ->  39     a provider read writes no audit row
                                                 (and the 40-minute window is EMPTY)
integration_credentials           18  ->  18     NO TOKEN WAS PERSISTED OR REFRESHED — the
                                                 installation token is minted and discarded inside
                                                 the seam's own callback frame
conversations                     29  ->  29     a slash command is not a conversation
heby_answer_source_evidence      757  -> 757     NOTHING ENTERED THE MODEL'S EVIDENCE STORE
```

That last line is the production proof of the design decision in §3: this capability declares **no
Heby source class**, so provider data never becomes standing grounding material. It is not asserted
here — it is a count that did not move while a live provider read happened.

**The connection lifecycle was not touched by the read**, which is the guarantee that matters most
for a provider seam:

```
integrations (github-organization)
  version             3           unchanged
  updated_at          2026-08-24T16:47:15.300Z   unchanged, and equal to last_verified_at
  connection_state    connected   unchanged      health   healthy   unchanged
  last_error_at       NULL        failure_reason NULL
  scopes              metadata:read, pull_requests:read   UNCHANGED — no permission was widened
```

A provider failure could not have ended this tenant's grant, and a provider success did not
re-verify it either: reading is not verifying, and the timestamps say so.

---

## 9 · Closure

**CLOSED / PRODUCTION-ACCEPTED.**

```
release commit    44bd77c   feat(integrations): read what is open in this organization's repositories
deployed commit   44bd77c   identical, READY 2026-09-01T22:12:26Z
production ledger 43        unchanged — zero schema, zero migration
provider scope    unchanged — metadata:read, pull_requests:read, granted 2026-08-24
suite             644 / 644 (2 runs: one intended, one replacement after pin movement)
bite-proofs       10 / 10 mutations bit
```

**Deferred, intentionally and named.** No argument, so no repository can be addressed — the
installation decides what is visible. No closed, merged, draft-only or per-author filter. No review
state, no check status, no mergeability, no age and no "stale" judgement — Hebun holds no authority
for any of them. No persistence, no cache and no synchronization: asking again re-reads. No Heby
source class, so a model is never grounded on provider data. No second provider. And no link
between a pull request and a WORK-1 work item: that relationship would be a Knowledge declaration,
which is INT-5C's shape and nobody has declared one.

**No successor authorized.** APF, ASA, Governed Internal Action and Director Intelligence remain
deferred with their activation conditions unproven. Pin-debt cleanup remains backlog.

**One measurement to carry forward, not a defect.** `ama1-agent-mandate/bite-proofs` fails at clean
`HEAD` under Node **v20.20.2** and passes under **v24.16.0**, the interpreter this repository's
baselines have been established on. It was proved unrelated twice and left untouched. Whichever
phase next touches that workstream should pin the interpreter or re-aim the bite's expectation.
