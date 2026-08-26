# INT-5B1 — GitHub Provider Record Read: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `c1b8d7070bf456c99b6fef2daca91640d67db269`.
**Parent:** `024308ea1f0910680eaff33f2572664b34971226`.
**Baseline of this record:** `c1b8d7070bf456c99b6fef2daca91640d67db269` (`origin/main`, 0 ahead / 0 behind).
**Production deployment:** `dpl_Uyfb3zpnFCAX18LLtCfM8ykKQfzu` — production, Ready, aliased at
`www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` and the `git-main` alias.
**Predecessors:** `hebun-int-5a-connection-grounding-closure.md`;
`hebun-github-4-repository-activity-closure.md`.
**Consumes:** the I1 capability-availability read seam and the GITHUB-4 discovery seam, both unchanged.
**Architecture gate:** the INT-5B discovery gate selected architecture **C — hybrid / bounded
read-through**, scoped to an explicit command. The Director then selected **option A** for its
command class: a sibling kind, never a widened `read`.

---

## 1. What INT-5A left open, and what this closes

INT-5A ended with Heby able to say *"Drive metadata can currently be read"* and *"repository
activity can currently be read"*, and structurally unable to say what was there. Its own closure
recorded the gap in one sentence: *"It is a capability state, never a provider record … `here is a
Drive file` is INT-5B and does not exist."*

INT-5B1 closes exactly one half of that, for one provider, through one command.

**Heby can now execute an explicit, bounded, tenant-scoped, read-only GitHub provider read and
return real repository metadata to the Director.**

It reads repository **coverage**, not repository **content**. That distinction is structural and is
restated in §13 so it cannot drift.

---

## 2. Why a new command kind, and not a wider `read`

The obvious implementation was a `kind: "read"` command served by `read-commands.server.ts`. It was
attempted at the gate and **refused before any code was written**, because three released artifacts
forbid it — two of them enforced by currently-passing tests:

| # | Artifact | What it says |
|---|---|---|
| C1 | `heby-commands/contracts.ts` | `read` is *"ZERO provider dispatch, ZERO execution"*, and the kinds *"do not mix"* so that a command reaching a provider is **unrepresentable** |
| C2 | `tests/s1-flow/firewall-and-surfaces.ts` §33 | `read-commands.server.ts` may not import anything matching `"features/integration"` — which is the capability authority the read requires |
| C3 | `tests/int5a-flow/grounding-firewall.ts` §2, §3 | pins `read-commands.server.ts` as a Heby root with zero non-Anthropic network reach and zero provider-record readers |

Widening `read` would have deleted a guarantee from **ten existing commands that never needed it**.

So `provider-read` joined the closed command vocabulary as a **sibling**. This is the R3A.1
arrangement applied to a second axis: there, `propose` became its own kind with its own server module
so *"a read can never become a write by changing one field"*; here, so a read can never become a
**provider call** by changing one field.

`read-commands.server.ts` is **byte-unchanged** by this phase, and S1 §33 over it is preserved
exactly.

---

## 3. Scope

**17 files, +2425 / −23.** Eight new, nine modified.

| File | What it is |
|---|---|
| `heby-commands/provider-read-commands.server.ts` | **new** — the sibling executor, the budget, the identity builder, the provenance |
| `heby-commands/contracts.ts` | `provider-read` joins `HebyCommandKind`; `reachesProvider` declared |
| `heby-commands/registry.ts` | the `/repositories` descriptor and two new invariants |
| `heby-commands/dispatch.ts` | the plan branch, placed **before** the handler switch |
| `app/(dashboard)/heby/actions.ts` | the fifth server action |
| `layout/heby/use-heby-conversation.ts` | the `provider-read` client branch |
| `provider-github/github-authorized-call.server.ts` | **the narrowing** — one import (§6) |
| `tests/helpers/durable-write-detector.ts` | **new** — one shared definition of "durable write" (§11) |
| `tests/int5b1-flow/*.ts` (6) | **new** — this phase's own suites |
| `tests/hw1-flow/navigation-and-firewall.ts` | released-pin repair — Heby server actions four → five |
| `tests/int5a-flow/grounding-firewall.ts` | detector repaired and shared; roots and pins unchanged |
| `tests/provider-onboarding/acceptance-reachability.ts` | per-seam verdicts; the PR reader pinned unreachable |

**No schema. No migration. No persistence. No cache. No synchronization.**

---

## 4. The command contract

| | |
|---|---|
| slash | `/repositories` · id `repositories` · handler `repositories` |
| kind | `provider-read` · category `platform` · availability `available` |
| arguments | **none** |
| client-crossing input | `{ commandId, args }` and nothing else |
| output | `HebyCommandResult` — the existing shape, unchanged |
| model involvement | **none** |

**It takes no arguments deliberately.** The installation decides what is visible, and the released
seam accepts no address — no tenant, no integration, no installation, no account, no owner, no
repository name. There is no parameter through which a caller could point the read anywhere else.

**Availability is a statement about the BUILD, never about a tenant.** An organization that has
connected no GitHub installation receives a truthful refusal from the capability authority at run
time, which is a different sentence from *"Hebun cannot do this."*

**The model is not involved, by decision and by structure.** The executor imports no model client and
reaches no model transport. Model output is prose; a `/`-prefixed input is classified by the parser
and can never be returned as a prompt. The model neither selects this command, addresses it, nor
contributes any part of its result.

---

## 5. Provider capability and read authorization

| | |
|---|---|
| provider | `github-organization` |
| capability | `github.repository.activity.read` |
| granted permissions | `metadata:read`, `pull_requests:read` |
| write permissions | **frozen empty list** |

**No Governance permit was introduced, and none is required.** The released seam already draws the
line: `CapabilitySource` carries `readAvailable` and `writeCapable` and deliberately has **no**
`writeAuthorized`. Write *capability* is what the granted scopes cover; write *authorization* is a
single-spend permit, and `action-authorization` is built entirely around consequential mutation.
Requiring a permit for an ordinary read would have duplicated an authority that already exists.

**The capability gate is not re-implemented here.** `withGitHubInstallationToken` consults
`getCapabilityAvailability` **before** signing an App assertion and **before** minting an
installation token, and refuses `capability-not-available` on its own terms. A second interpretation
in the command module would be the two-interpreters defect one layer down. The ordering is asserted
against the **function body**, not the module, because a module-wide search would match the import
line and could then never fail.

---

## 6. The narrowing — a security boundary, not cleanup

`github-authorized-call.server.ts` read connections through `integration-repository.server.ts`, which
also exports **seven** connection lifecycle writers. Exactly **one import edge** in the whole graph
carried them. INT-5A had already relocated the reads to a writer-free module for precisely this
shape; this phase moved that one import.

Measured, before and after:

```
BEFORE  GitHub read graph 69 modules → integration-repository.server.ts  (7 lifecycle writers)
                                     → governance-audit/integration-lifecycle-audit.server.ts
AFTER   GitHub read graph 67 modules → CLEAN: 0 lifecycle writers, 0 credential modules,
                                       0 audit writers, 1 network module (github-transport)
```

The signatures are identical and the reads were not forked — there is still **one**
`listConnections` in this repository. This is what makes *"a failed GitHub read cannot end a
tenant's grant"* structural rather than promised.

---

## 7. Three roots, independently firewalled

Measured by walking the real import graph on the released tree, and re-measured at closure:

| Root | Modules | Network-capable modules |
|---|---|---|
| `heby-answer/model-answer.server.ts` | 601 | `claude-http-transport.server.ts` **only** |
| `heby-commands/read-commands.server.ts` | 603 | `claude-http-transport.server.ts` **only** · `provider-github` reach **0** |
| `heby-commands/provider-read-commands.server.ts` | 70 | `github-transport.server.ts` **only** |

INT-5A pinned the first two together and reserved the third for this phase. **The pin was split, not
relaxed:** the two existing roots keep every guarantee they had, and the new root is asserted
separately. Neither ordinary root can reach the GitHub transport, the Google transport, a provider
record reader, or the provider-read executor. The provider-read root cannot reach the model
transport.

From the provider-read root there is **no** reachable: Google transport or behaviour, Knowledge
writer, action authorization, action execution, integration lifecycle writer, credential accessor, or
provider write seam. Asserted by path **and** by symbol, and reported all at once rather than
first-crossing-only — a diagnostic weakness found during this phase, where one import silently
dragged three subsystems behind it.

**The pull-request reader remains unreachable**, from this command and from any production root.
INT-5B1 ships no pull-request fan-out.

---

## 8. The provider-read budget

Owned by the command boundary. It is **not** the Anthropic budget: `live-spend-budget.server.ts`
bounds live model calls per process and defines no provider authority, and reusing it would let a
model ceiling silently govern an organization's own GitHub quota.

```
maxProviders 1 · maxProviderCalls 2 · maxPages 1 · maxRecords 50
providerTimeoutMs 10 000 (passed explicitly, never left to a default)
totalTimeoutMs 20 000 · concurrency 1
```

**The record ceiling is enforced at the command boundary, not merely declared.** A seam returning 120
rows renders 50. That is what makes the command's promise independent of a constant defined two
features away.

---

## 9. Evidence identity and provenance semantics

```
integrations/github-organization/github.repository.activity.read/repository/<numericRepoId>
```

Composed from `GITHUB_PROVIDER_KEY` and `GITHUB_REPOSITORY_ACTIVITY_CAPABILITY` — **INT-5B1 mints no
identifier of its own**, and the module contains no `randomUUID`, `createHash`, `crypto` or
`Date.now(`.

**The identity is never `full_name`.** A repository's full name changes on a rename and again on a
transfer; the numeric id is never reassigned. A test renames a repository and asserts the identity
does not move, and that the name appears nowhere inside it.

Every result carries one provenance line stating: read live just now, for the connected installation,
tenant-scoped, `authoritative: false`, provider-derived observation, **not** organizational truth,
nothing stored/indexed/admitted, asking again re-reads it, and GitHub can change coverage without
telling Hebun. The line is asserted to contain those clauses **and** asserted not to contain
`authoritative: true`, `Knowledge`, `settled` or `endorsed`.

---

## 10. Honest failure semantics

```
UNAVAILABLE      IS NOT   EMPTY
PROVIDER_FAILED  IS NOT   EMPTY
PARTIAL          IS NOT   COMPLETE
```

Sixteen conditions, each rendered distinctly: six refusals, six provider fault classes, a
total-budget timeout, and three separate pagination statements. The **only** informational-tone
non-result is an empty page, and only when GitHub actually answered — every other path returns an
`unavailable` tone whose provenance says explicitly that this is not an empty result.

A rate limit is `transport` and says *"NOTHING IS KNOWN about your installation from this"*. An
`auth` fault names **Hebun's own** credential and says explicitly that nothing about the
organization's installation is implicated.

**No failure path writes anything.** GitHub's `installation` class is documented in released
contracts as the only class that may end a connection; INT-5B1 does **not** perform that transition,
because no lifecycle writer is reachable from this path. The lifecycle owner keeps it.

---

## 11. The durable-write detector repair

INT-5A's detector was `\.insert\(|\.update\(|\.delete\(`. It read
`createSign("RSA-SHA256").update(signingInput)` — a **crypto** call in released source — as a
database UPDATE. Measured across `src/`: the bare pattern flagged **78** files where **36** write;
the other 42 are `Set.delete`, `Map.delete`, `cipher.update`, and in-memory repository abstractions
that import no database at all.

That direction of error is the dangerous one over time: a firewall that cries wolf is one somebody
eventually relaxes, and this one would have blocked the provider-read subgraph over a signature.

Repaired to *drizzle builder chain* **or** *db/tx handle*, in **one shared definition** consumed by
both firewalls — a security predicate that exists twice will eventually disagree with itself.
Measured after: **36 flagged, 0 newly accused.** It narrows only. Proved in both directions by
`tests/int5b1-flow/write-detector.ts`, which also pins that the superseded pattern *did* falsely
accuse the JWT minter and that the repaired one still finds every real writer.

---

## 12. Production acceptance

**Operator-observed, through the Heby workspace, on the released deployment. One command, sent once.**

```
/repositories
```

**Title:** `Repositories in your GitHub installation`

**The repository record returned:**

```
[integrations/github-organization/github.repository.activity.read/repository/1300480452]
Hebun-AI/hebun-ai-recovered — public · default main · updated 2026-08-25T21:39:32Z
```

| Field | Value |
|---|---|
| provider | `github-organization` |
| capability | `github.repository.activity.read` |
| repository id | `1300480452` |
| display identity | `Hebun-AI/hebun-ai-recovered` |
| visibility | public |
| default branch | `main` |
| provider-reported update | `2026-08-25T21:39:32Z` |

**Bound, as rendered:**

```
Showing 1 repository — one page, at most 50. This command never asks for a second page.
GitHub reports 1 in total for this installation, which this page covers.
```

**Disclosure, as rendered:** *"These are repository names and their coverage, and nothing inside
them. This command reads no file, no source line, no commit content and no message body."*

**Provenance, as rendered:** the full non-authoritative statement of §9, including `authoritative:
false` and *"nothing was stored, indexed or admitted anywhere"*.

**Visual inspection found no** installation token, `Bearer` token, App private key, patch, diff, PR
body, credential-bearing clone URL, or raw provider response blob.

**Why this is strong evidence the released code produced it.** The evidence identity matches the
released constants character for character — `GITHUB_PROVIDER_KEY = "github-organization"`,
`GITHUB_REPOSITORY_ACTIVITY_CAPABILITY = "github.repository.activity.read"` — in the exact order and
separators `githubRepositoryRecordRef` composes. The bound line matches `boundaryLines` including the
`maxRecords` value 50 read from `MAX_REPOSITORIES_PER_PAGE`, and it selected the *third* of three
mutually exclusive pagination sentences, the one reachable only when the provider reports a total
that the page covers. The repository id is a positive safe integer that survived `posInt`, and
`repositoryFrom` drops any entry lacking one.

**Completeness, at exactly the strength proved.** `records shown = 1`, `provider total = 1`, page
ceiling 50, second page **not** requested. This run was **complete for this observed installation
response**. It is not a guarantee that future reads are complete — a bound is not a total, and the
`PARTIAL, NOT COMPLETE` path exists precisely for when they differ.

**A coincidence worth naming so nobody misreads it.** The single repository the installation covers
is `hebun-ai-recovered` — this repository, the one the production deployment is built from. That is a
fact about which repositories the organization selected for the GitHub App installation. It carries
no special meaning, and nothing in the read treats it differently from any other repository.

---

## 13. What this does NOT prove, stated so it cannot drift

- **Repository metadata is not repository content.** `GitHubPullRequestView` and
  `GitHubRepositoryView` have no `patch`, `diff`, `body`, `files`, `commits` or `head.sha`, and the
  transport pins the JSON media type because the same endpoint at identical permission returns a
  unified diff under a different `Accept` header. Heby did **not** read files, source code, commits,
  pull-request content, or arbitrary GitHub data.
- **`CAPABILITY_AVAILABLE = YES` holds at the strength of one successful read**, at one moment, for
  one tenant. It is a derived, per-request state and never a standing provider-health guarantee.
- **No pull request was read.** The PR seam exists, is released, and remains unreachable.
- **Nothing was persisted.** No repository, no page, no cursor, no cache row.

---

## 14. Knowledge and Governance boundary

**Nothing entered Knowledge, and nothing could have.** No Knowledge module is reachable from the
provider-read root, asserted by path over `knowledge/`, `knowledge-crud/` and
`knowledge-ratification/` and by symbol. The I1 firewall independently forbids any file under
`src/features/knowledge` from referencing the integration authority, the provider catalog or the
integrations schema — a placement that was attempted in an earlier phase, failed that suite, and was
left intact.

`drive.metadata.readonly` cannot download a file and this GitHub capability returns no content, so a
provider→Knowledge shortcut is not merely forbidden — at the granted scopes it is **unobtainable**.

**No permit was minted or consumed and no action executed.** Neither surface is reachable.

**A provider-derived observation is not organizational Knowledge.** It is observed live, stored
nowhere, `authoritative: false` always, identified by the provider's id rather than by content
digest, revocable by the provider without telling Hebun, and created by no Governance act. A future
admission path would run through the released R4C1/R4C2 human upload boundary under Governance
authority — designed nowhere in this phase, and not opened by this record.

**Non-mutation is supported by the released structural boundary and the operator-visible runtime
disclosure; it was not independently confirmed by production DB before/after counts.** See §16.

---

## 15. The earlier blocked acceptance attempt — preserved, not erased

A first production acceptance run was executed and **stopped before the command was sent**.

`GET https://www.hebuntech.com/heby` returned **307 → `/login`**: the command surface is behind
authentication, correctly. The automation environment did not hold the Director's authenticated
production session, and acquiring one would have meant entering credentials, which is not done.

**That was a procedural stop, not a runtime failure.** No provider read was attempted, so nothing
about the released capability failed. Every structural precondition of that gate passed. The gate was
recorded FAILED only because its verdict required the command to have executed.

The Director subsequently performed the authenticated action manually, and §12 is its result. The
history is kept because a closure that hides a blocked attempt teaches the wrong lesson about why it
was blocked.

---

## 16. Validation evidence

Re-run at closure, against a working tree proved byte-identical to `c1b8d70`:

| Check | Result |
|---|---|
| `tests/int5b1-flow/command-contract.ts` | PASS |
| `tests/int5b1-flow/authorization-and-failure.ts` | PASS |
| `tests/int5b1-flow/evidence-and-security.ts` | PASS |
| `tests/int5b1-flow/provider-read-firewall.ts` | PASS |
| `tests/int5b1-flow/write-detector.ts` | PASS |
| `tests/int5b1-flow/bite-proofs.ts` | **17 mutations bit, 0 survivors** |
| `tests/int5a-flow/{grounding-firewall, connection-grounding}.ts` | PASS |
| `tests/provider-onboarding/acceptance-reachability.ts` | PASS |
| `tests/s1-flow/*` (3) | PASS |
| `tests/hw1-flow/*` (3) | PASS |
| `npm run typecheck` | clean |

**The full suite was measured at release, not re-executed for this documentation-only closure:**
**483 passed / 1 failed / 484 total** at `c1b8d70`. The sole failure is **INT-3 M9** (`an identity
without \`sub\` is accepted`) — pre-existing, unrelated, proved non-overlapping, and **not repaired**.

Two released pins were repaired rather than weakened, each stating what arrived:

1. `tests/hw1-flow/navigation-and-firewall.ts` — Heby server actions **four → five**, with all five
   enumerated and their reasons stated, plus a new assertion that exactly one of them may reach a
   provider. The property is unchanged and still exact.
2. `tests/provider-onboarding/acceptance-reachability.ts` — the gate now prints a verdict **per
   seam**, because one capability key is spent by two seams and a verdict on the key alone would let
   a reader conclude Hebun can show pull requests. It pins that the pull-request reader still has no
   production caller.

**Three bite-proofs initially failed for the wrong reason** and each exposed a real weakness in this
phase's own firewall rather than in the code under test: the firewall reported only the first
boundary crossing, so one forbidden import that dragged three subsystems behind it was
indistinguishable from three separate defects. The firewall now accumulates every violation and
reports them together. A guard that cannot say *what* was crossed is a guard somebody will misread.

---

## 17. Final truth ledger

| State | Value |
|---|---|
| DESIGNED | **YES** |
| IMPLEMENTED | **YES** — `c1b8d70` |
| RELEASED | **YES** — `origin/main == c1b8d70` |
| DEPLOYED | **YES** — `dpl_Uyfb3z…`, Ready, aliased to `www.hebuntech.com`; deployed commit SHA **inferred, not observed** |
| CAPABILITY_AVAILABLE | **YES**, at the strength of one successful production read — never a standing provider-health guarantee |
| PROVIDER_READ_REACHABLE | **YES** |
| PROVIDER_READ_ATTEMPTED | **YES** |
| PROVIDER_READ_EXECUTED | **YES** |
| PROVIDER_READ_SUCCEEDED | **YES** |
| PROVIDER_RECORD_RECEIVED | **YES** — repository `1300480452` |
| PROVIDER_RECORD_GROUNDED | **YES** — rendered with its released identity and provenance |
| USER_VISIBLE | **YES** |
| PROVIDER_RECORD_PERSISTED | **NO** |
| KNOWLEDGE_MUTATED | **NO** |
| ACTION_EXECUTED | **NO** |
| PRODUCTION_ACCEPTANCE | **PASSED** |
| CLOSED | **YES** |

Kept explicit, and not collapsed:

```
REACHABLE          ≠  EXECUTED
EXECUTED           ≠  SUCCESSFUL
SUCCESSFUL         ≠  AUTHORITATIVE
PROVIDER-DERIVED   ≠  KNOWLEDGE
VISIBLE            ≠  PERSISTED
```

---

## 18. Remaining limitations

1. **Production DB before/after counts were unavailable.** No connection string exists outside a
   credential read, and every production script is a writer rather than a read seam. Non-mutation
   rests on the structural boundary and the operator-visible disclosure — **not** on a DB count.
2. **The deployed commit SHA was never read from Vercel.** `vercel inspect` exposes no commit field
   for this project scope. Correspondence rests on the `git-main` alias plus timing (deployment
   created ~19 s after the push) — inference, labelled as such. This is the same limitation INT-5A
   recorded and it has not changed.
3. **No GitHub kill-switch.** `resolveDirectorEnabled(providerKey)` is generic and fail-closed, but
   only `claude` has a resolver and a production row. `/repositories` is **not** gated by the
   Director's model-connectivity control. Adding a row would be a new authority plus a production
   write, and was deliberately left out of scope.
4. **Google's read path still carries a credential writer.** `withGoogleAccessToken` replaces
   credential rows on refresh. Unchanged and unreachable from here, but the Google half of INT-5B
   cannot reuse this graph shape unmodified.
5. **Pull-request fan-out is unbuilt** and pinned unreachable. The `2 + N` call shape does not fit
   this budget and needs its own gate.
6. **Capability state can be stale between reads.** This command reads live, so its own answer is
   fresh; nothing here keeps it fresh afterwards.
7. **INT-3 M9** — unrelated pre-existing debt in a Google suite, untouched.

---

## 19. Closure boundary

**INT-5B1 is COMPLETE for its declared meaning: Heby can execute an explicit, bounded, tenant-scoped,
read-only GitHub provider read and return real repository metadata to the Director.**

The accepted production run returned repository id `1300480452`, `Hebun-AI/hebun-ai-recovered`. The
evidence remained provider-derived and non-authoritative. It was not persisted, indexed, admitted
into Knowledge, or converted into organizational truth. No action was executed.

**This does NOT mean Heby can read what is inside a repository.** INT-5B1 proves repository metadata
coverage, not repository content access. Files, source lines, commits and pull-request content are
outside this closure and outside this phase's declared meaning.

**No further phase is opened by this record.** Google provider-record grounding remains separate and
must not be smuggled in here. Agents remain downstream.

---

## 20. Next architectural gate

**CROSS-SOURCE PROVIDER EVIDENCE × KNOWLEDGE × GOVERNANCE REASONING.**

Its objective: determine how ephemeral, non-authoritative provider evidence can participate in Heby's
reasoning alongside authoritative and derived Hebun evidence, without persistence, authority
promotion, a second source of truth, provider data silently becoming Knowledge, model-selected
provider execution, or agent runtime activation.

The INT-5B discovery gate ranked it first for a reason worth restating: four of the ten product
queries that motivated INT-5B are **joins** — *"which repositories have activity but no corresponding
Knowledge update?"*, *"which engineering activity conflicts with a ratified decision?"* — and the
value is in the join, not in a repository list a page can already render. It needs no new provider
capability, no new authority and no schema, which makes it the cheapest of the candidates and the
one that converts provider evidence into reasoning no surface can do today.

It is **not started**, and this record does not open it.
