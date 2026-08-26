# INT-5C — Cross-Source Provider Evidence × Knowledge Grounding: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `dc39ee9efe0ef48fce4bca16be0309b0b2aeab0c`, authored 2026-08-26 16:46:11 +0300.
**Parent:** `0c67a23fc580fc9ca5fe8a9df9b67b603931365c`.
**Baseline of this record:** `dc39ee9…` (`origin/main`, 0 ahead / 0 behind).
**Tag:** none — convention **measured**, not assumed. See §11.
**Production deployment:** `dpl_Ui6TgfHmw2feGj2H819D7aBjnJNo` — production, **Ready**, aliased at
`www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` and the `git-main` alias.
`meta.githubCommitSha` = `dc39ee9efe0ef48fce4bca16be0309b0b2aeab0c`.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessors:** `hebun-int-5b1-github-provider-record-read-closure.md`;
`hebun-kr-ext1-knowledge-external-reference-closure.md`.

> **Record provenance, stated so it cannot drift.**
> · Repository, validation and staging facts — **independently measured** by this process.
> · Deployment status and deployed SHA — **independently measured** by this process via the Vercel
>   CLI and REST API.
> · The `/repository-knowledge` production invocation — **Director-observed**. The rendered text was
>   returned verbatim and then reconstructed character-for-character from released source (§8).
> · The production database census — script authored by this process, **executed by the Director**,
>   output returned verbatim.

---

## 1. What this closes

Two sources already existed and had never been asked one question together. GitHub knows which
repositories an installation covers (INT-5B1). The organization's own records know which external
records a human declared a Knowledge relationship for (KR-EXT1). Neither could answer *"which of
the repositories we actually have has anybody written knowledge about?"*

`/repository-knowledge` asks both and reports the answers side by side **without merging their
standing**.

## 2. Why a sibling kind, not a wider `provider-read`

INT-5B1's firewall proves no Knowledge module of any kind is reachable from the provider-read root.
This command needs a Knowledge read. Adding it there would have **deleted that guarantee from
`/repositories`**, which never needed a Knowledge read.

So the command got its own kind — `cross-source-read` — its own server module, its own server
action and its own firewall root. INT-5B1's root and firewall are untouched.

**The third time this repository has made that move:** `propose` (R3A.1) so a read could not become
a write by changing one field; `provider-read` (INT-5B1) so a read could not become a provider call
by changing one; here, so a provider read cannot acquire a Knowledge read by changing one.

## 3. What shipped

18 files, +2,774 / −166. Zero schema, zero migration, zero provider scope, zero Governance change.

| File | Role |
|---|---|
| `src/features/heby-commands/cross-source-commands.server.ts` | **new** — the executor (389) |
| `src/features/knowledge/external-reference-read.server.ts` | **new** — writer-free Knowledge read (277) |
| `src/features/heby-commands/provider-read-vocabulary.ts` | **new** — shared provider wording (122) |
| `src/features/heby-commands/registry.ts` | the command + extended reach biconditional |
| `src/features/heby-commands/contracts.ts` · `dispatch.ts` | the new kind and its plan |
| `src/app/(dashboard)/heby/actions.ts` | the sixth server action |
| `src/components/layout/heby/use-heby-conversation.ts` | the client branch |
| `src/features/knowledge/external-reference-authority.server.ts` | reverse lookup **re-exported**, not forked |
| `tests/int5c-flow/{bite-proofs,command-and-provenance,cross-source-firewall,join-postgres}.ts` | proof (1,709) |

## 4. A writer-free read side for KR-EXT1

`findKnowledgeFactForExternalRecord` **moved** to `external-reference-read.server.ts` and is
**re-exported** from the authority module. There is still exactly **one** implementation in this
repository — a security-relevant predicate that exists twice will eventually disagree with itself.

The point of the move: a consumer that only wants to *ask whether a declaration exists* no longer
imports the module that can also **create and withdraw** one. This is the same repair INT-5B1 made
on the GitHub side with `integration-read.server.ts`.

## 5. `UNAVAILABLE` ≠ `EMPTY` ≠ `NO DECLARATION`

The seam this replaces returned `string | null` and swallowed its own errors, so *"no human ever
declared this"* and *"the database did not answer"* were the **same value**. Tolerable while nothing
read it. False the moment a surface tells an operator that a repository has no recorded Knowledge.

The batched read now returns an explicit outcome:

- `resolved` — carries the declarations found, and **licenses an absence claim** about every id
  asked for;
- `unavailable` — carries a reason, and **licenses no claim** about any of them.

A failed provider read never renders as an empty list. A failed Knowledge lookup never renders as
*"no declaration recorded"*.

## 6. Bounded in both directions

One provider page (the released INT-5B1 budget, unchanged: ceiling 50, one page, never a second) and
**exactly one** batched database round trip — never one query per repository, which would make the
cost of answering scale with a number GitHub chooses.

Over the ceiling the lookup **refuses** rather than truncating, because truncation turns *"we did
not ask about it"* into *"no declaration exists for it"*.

**The tenant predicate is asserted twice** — on the declarations and on the facts. Bite-proof M1
measures that removing **either alone** still leaves the query tenant-scoped, and only removing
**both** makes it cross-tenant. Defence in depth, not duplication.

**The fact join reads identity, never content:** `fact_key`, `domain_key`, and whether an active
node is set. No node is read, so no Knowledge wording crosses the seam. K3 immutability untouched —
this is a `select`.

## 7. Validation evidence

All re-run fresh at `dc39ee9`; the prior measurement was **not** cited.

| Check | Result |
|---|---|
| Full suite `npm run test:run` | **495 passed, 0 failed, 495 total** |
| `tests/int5c-flow/bite-proofs.ts` | **20 / 20 mutations bit** |
| `tests/int5c-flow/command-and-provenance.ts` | PASS |
| `tests/int5c-flow/cross-source-firewall.ts` | PASS |
| `tests/int5c-flow/join-postgres.ts` | PASS |
| `tests/int5b1-flow/*`, `tests/kr-ext1-flow/*`, `tests/hw1-flow/*` | PASS |
| typecheck | clean |
| lint | **0 errors**, 14 pre-existing warnings |

**Zero mutation residue**, proved twice: the source-tree digest `8c21eb46505a15a3da480e0f9622cead6be48afec50e8310747bef5d75c5bb07` was byte-identical before and after both the bite-proof run and the full suite, and `git status` was unchanged.

The 20 bites: cross-tenant join · name-based join identity · model-inferred link · provider
persistence · Knowledge writer reachable · Governance writer reachable · credential accessor ·
lifecycle writer · action authority · model transport · read kind gaining provider dispatch ·
model root gaining GitHub transport · unavailable collapsed into absent · partial page as complete ·
unbounded fan-out · authoritative joined view · truncating lookup · swallowed query failure ·
withdrawn declaration still answering · undeclared reach.

## 8. Production acceptance

**Invoked once, through the Heby workspace, on the released deployment.** Director-observed.

```
/repository-knowledge
```

**Title:** `Repository knowledge coverage`

```
[integrations/github-organization/github.repository.activity.read/repository/1300480452]
Hebun-AI/hebun-ai-recovered — DECLARATION RECORDED: engineering / hebun-repository
(the fact has an active Knowledge node).

1 of 1 repository on this page has a recorded Knowledge relationship; 0 do not.
A repository with no declaration means nobody recorded one — it does not mean Hebun looked
inside the repository and found nothing.

Showing 1 repository — one page, at most 50. This command never asks for a second page.
GitHub reports 1 in total for this installation, which this page covers.
```

**Result class: A — DECLARATION RECORDED.** Not converted from or into B or C.

### Why the released code demonstrably produced it

Every rendered line was **reconstructed character-for-character** from the released source
constants and diffed:

| Element | Result |
|---|---|
| Record ref from `githubRepositoryRecordRef` + `GITHUB_PROVIDER_KEY` + `GITHUB_REPOSITORY_ACTIVITY_CAPABILITY` | MATCH |
| `— DECLARATION RECORDED: <domainKey> / <factKey> (<node>).` | MATCH |
| Both summary sentences, including the singular/plural branches | MATCH |
| Bound line carrying `maxRecords` **50** | MATCH |
| `GitHub reports 1 in total…` — the **third** of three mutually exclusive pagination sentences, reachable only when the provider reports a covering total | MATCH |
| Disclosure tail | MATCH |
| `CROSS_SOURCE_PROVENANCE`, **694 characters** | MATCH |

It rendered the **`resolved`** branch in `info` tone. Had the Knowledge lookup failed it would have
said `KNOWLEDGE LOOKUP UNAVAILABLE` in `unavailable` tone. **A was therefore not a disguised C.**

### Independently corroborated by the database

The census returned, without reading any Knowledge wording:

```
github-organization/github.repository.activity.read/repository/1300480452
   fact dc8d3795-c506-444f-8acf-20f457934af3
   declared 2026-08-26T10:54:00.265Z by human | withdrawn no

engineering / hebun-repository | version 1 | node 143d8eaf-dd7d-4f6f-85c5-4d109dbf008d
   created 2026-08-26T10:40:11.890Z | updated 2026-08-26T10:40:11.890Z
```

The rendered `domainKey / factKey` and the *"has an active Knowledge node"* branch match the stored
row exactly. The join resolved the **numeric record id**, not the name.

## 9. Non-mutation — measured, and structurally impossible

### Static: the 75-module transitive closure

Walked from the cross-source root, following `import`/`export … from` in comment-stripped code:

| Probe | Result |
|---|---|
| `db.insert(` | **0** |
| `db.delete(` | **0** |
| `db.update(` | 1 — `createSign("RSA-SHA256").update(...)` in `github-app-jwt.server.ts`, a crypto call; that file imports **no DB handle** |
| `audit_log` named | **1** module — its table definition. **Zero writers.** |
| `integration_credentials` named | **1** module — its table definition. **Zero writers.** |

**The entire closure has no database write capability.** That covers provider-record persistence,
Knowledge creation, Knowledge mutation, Governance records, action permits, executions and
conversation persistence in one result.

### Production counts

| Table | Count | Against baseline |
|---|---|---|
| `knowledge_facts` · `knowledge_nodes` · `knowledge_external_references` | 1 · 1 · 1 | unchanged |
| `knowledge_edges` | 0 | unchanged |
| `decision_records` · `governance_sessions` | 2 · 2 | unchanged |
| `action_permits` · `action_execution_attempts` · `executions` · `heby_action_requests` | 0 | unchanged |
| `event_log` | 0 | unchanged |
| `users` · `companies` · `memberships` · `roles` | 1 · 1 · 1 · 2 | unchanged |
| Ledger | 36, digest `1b67f950a863b1d86b072dee14c6edb3` | **identical** |

Knowledge fact and node both remain at **version 1** with `created_at == updated_at`. No content or
version mutation.

`integrations.updated_at` for `github-organization` is **2026-08-24T16:47:15.300Z** — nothing on
08-26. The live GitHub read wrote **nothing** to the integration record.

## 10. The two deltas, attributed rather than dismissed

`integration_credentials` 7 → 8 and `audit_log` 13 → 14. Both resolve to **one event**:

```
audit_log  #14  2026-08-26T11:53:12.085Z  integration.credential.replaced
                entity integration_credential | actor human | src integration-credentials | committed

credential #8   created 2026-08-26T11:53:12.085Z | google-workspace | oauth_access
                expires 2026-08-26T12:53:11.085Z | revoked no
credential #7   revoked 2026-08-26T11:53:12.085Z   ← same instant: the replace pair
```

- **Provider is `google-workspace`, not `github-organization`.** INT-5C touches only GitHub.
- Credential #7 expired at `11:36:26`; the refresh at `11:53:12` is the next use. The chain matches
  five earlier refreshes on the same integration.
- Credentials are versioned by **INSERT**, so one refresh raises the count by one and writes exactly
  one audit row — which is why both deltas are `+1`.
- **Decisive:** the event occurred at `11:53:12.085Z`. The INT-5C deployment was created at
  `13:47:25.657Z` — **114.2 minutes later**. The released code did not exist in production when the
  delta occurred.

**INT-5C durable mutation footprint: NONE.**

## 11. Release mechanics

Staged by **explicit pathspec**, 18 files, never `git add .`/`-A`/`commit -a`. The **75** unrelated
pre-existing untracked items were preserved untouched and verified so before and after.

Pre-push continuity: live `origin/main` re-measured immediately before push and still `0c67a23`; the
new commit's parent proved to be exactly `0c67a23`. Push `0c67a23..dc39ee9`, **no force, no history
rewrite**. Post-push convergence: local HEAD == `origin/main` == live remote == `dc39ee9`, 0/0.

**Tag decision: none, measured.** 267 tags exist in older history, but the last 8 commits — including
KR-EXT1 `afbb472`, the migration authority `b29d281` and INT-5B1 `c1b8d70` — carry **zero**. The
convention in force is untagged.

## 12. Final truth ledger

| | |
|---|---|
| RELEASED | **YES** — `dc39ee9`, remote converged 0/0 |
| DEPLOYED | **YES** — SHA-matched, Ready, production, independently observed |
| PRODUCTION-ACCEPTED | **YES** |
| Result class | **A — DECLARATION RECORDED** |
| Schema · migration · provider scope · Governance | **ZERO** — ledger 36, digest identical |
| Knowledge created / mutated | **NONE** — counts and versions unchanged |
| Governance / action / execution | **NONE** — all unchanged or 0 |
| Provider record persisted | **NONE** — `integrations` untouched since 08-24 |
| Deltas observed | 2, **both attributed** to a pre-deployment Google OAuth refresh |
| Production mutation caused by acceptance | **NONE** |
| Unrelated work touched | **NONE** — 75 untracked items preserved |

## 13. Remaining limitations

- **Provider call volume is not runtime-instrumented.** The budget is proved by construction and by
  the rendered bound lines, not by a counter. Call-level observability does not exist.
- **One installation, one repository.** Completeness was proved for *this* observed response
  (`shown = 1`, `provider total = 1`). A bound is not a total; the `PARTIAL, NOT COMPLETE` path
  exists for when they differ and has not been exercised in production.
- ~~The `github-organization` integration reads `status = pending` while serving a successful read,
  worth a look because a status nobody advances is a status nobody trusts.~~
  **WITHDRAWN — this was a measurement error in the census, not a finding.** `integrations.status`
  is declared `LEGACY, INERT. Superseded by connectionState. Never read, never written by I1.`
  (`src/db/schema/integration.ts`), and the table header records it as *"recorded debt, not
  design"*. The lifecycle field the capability authority actually reads is `connection_state`, with
  `health` as a second dimension; the census selected the legacy column and the concern was drawn
  from a value nothing consults. Re-confirmed against the schema during HEBY-CAP1: every `status`
  occurrence in `integration-authority/` is a TypeScript result discriminant, never the column.
  Nothing here needs fixing, and no integration lifecycle question is open.
- **Tenant isolation is proved structurally, not empirically.** Production has one tenant, so the
  cross-tenant path cannot be exercised there; bite-proof M1 carries that claim.

## 14. Closure boundary

This record documents a completed phase and does not reopen it, nor the three it depends on.
