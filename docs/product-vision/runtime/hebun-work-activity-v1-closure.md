# WORK ACTIVITY V1 — CLOSED / PRODUCTION-ACCEPTED

**Release** `2fd7f47` · **Production ledger 45 — unchanged**, digest `b41faf35181a4298f9b90cffb3e59314`
**Production cluster** `7675444875863894887` / `neondb`
**Deployment** `dpl_DB31uvB9B1kSHd7ZnGhy6TwD2gZj`, target `production`, created `2026-09-02T19:49:19.229Z`
**Zero migrations. Zero schema change. Zero rows written.**

---

## What Hebun can now do that it could not

Four released authorities held an unbroken chain of human-declared links and nothing walked it:

    work item  →  declares it concerns  →  Knowledge fact  →  names  →  GitHub repository  →  live read

A Director wanting the answer had to already know the work id, the fact id, the repository id, and
which provider command to type. `/work-activity <work-item/uuid>` walks it from the one thing a
Director actually knows: **the work**.

---

## The production act

    /work-activity work-item/983d1cb2-4720-41bd-b430-0da7a5d7c344

It rendered the DECLARED half from the organization's own record, the OBSERVED half live from
GitHub, and refused to merge them.

---

## Production corroboration — measured after the run

| # | Claim | Verdict | Measured |
|---|---|---|---|
| 1 | Work item unchanged | **CORROBORATED** | `983d1cb2` — `version 1`, `updated_at 14:03:35.963Z`, `declared_state planned`, `created_by_type system` |
| 2 | WEV relationship unchanged | **CORROBORATED** | `3da1d0bb` — one row, `version 1`, `updated_at 19:26:23.722Z`, `withdrawn_at/by/by_type` all `null` |
| 3 | Knowledge fact + standing unchanged | **CORROBORATED** | fact `dc8d3795` `version 1` (updated 2026-08-26); node `143d8eaf` `version 1`, `knowledge_authority provisional`, `knowledge_lifecycle_status draft`, `ratified_at null`, `ratification_decision_id null` |
| 4 | The external reference is the resolver | **CORROBORATED** | `4d3d992b` — fact `dc8d3795` → `github-organization` / `github.repository.activity.read` / `repository` / `1300480452`. Byte-for-byte the evidence ref the surface rendered |
| 5 | Real successful provider read | **CORROBORATED — structurally and independently, NOT logged** | see *What has no observability* |
| 6 | Zero was not derived from unavailable state | **CORROBORATED — structurally** | the OBSERVED block is emitted only on `outcome.ok`; every refusal, fault and timeout path returns `unavailable(...)` with different headings and **no OBSERVED block at all** |
| 7 | No Work write | **CORROBORATED** | window, below |
| 8 | No Knowledge write | **CORROBORATED** | window, below |
| 9 | No provider-derived persistence | **CORROBORATED** | `integration_credentials` 18 rows, newest `updated_at 2026-08-30 21:50:49` — a token refresh would have raised it, as Google's has before |
| 10 | No Governance decision | **CORROBORATED** | `decision_records` 7, `governance_sessions` 7 — newest `14:01:43.190Z` |
| 11 | No action request | **CORROBORATED** | `heby_action_requests` 5 — newest `14:01:43.181Z` |
| 12 | No permit, no execution | **CORROBORATED** | `action_permits` 2, both `consumed`, `version 1`; `action_execution_attempts` 1 (2026-08-31); `executions` 0 |
| 13 | No agent mandate mutation | **CORROBORATED** | 2 revisions — rev 1 `[]`, rev 2 `['send']`, newest `updated_at 2026-08-31 18:19:58` |
| 14 | Migration ledger remains 45 | **CORROBORATED** | 45 applied, digest `b41faf35181a4298f9b90cffb3e59314` — identical to WEV-1's |
| 15 | GIA-1 and WEV-1 remain closed | **CORROBORATED** | GIA-1's work item still `created_by_type = system`, its permit `648597a5` still `consumed`, `version 1`; WEV-1's reference still current, never withdrawn |

### The no-write window

Every base table in `public` was swept — **65 tables, 64 windowed on their own timestamp column,
34 non-empty**:

    Newest row in the ENTIRE database   2026-09-02 19:27:08.418Z   (messages / conversations /
                                                                    heby_answer_source_evidence)
    Deployment carrying the release     2026-09-02 19:49:19.229Z
    Tables with ANY row at or after it  0

The newest row anywhere predates the deployment by 22 minutes, and that row is the WEV-1 acceptance
chat, not this command. The one table without a timestamp column, `heby_answer_evidence_item`
(3 rows), is windowed transitively: its parent `heby_answer_evidence_set` has 7 rows whose newest is
`08:58:48`, so no item could have been added without a set to hold it.

**"No write" here is a window over the whole database, not over a chosen list.**

---

## What has no observability, and is classified as such

**The command stores nothing — so the run itself left no trace, by design.** No provider-call log,
no evidence row, no audit row, not even a session touch (`user_session_contexts` newest is
`19:18:52`, before the deployment). That absence is the acceptance of claims 7–13 and simultaneously
the reason claim 5 cannot be read back from a log. It was not manufactured into one.

Claim 5 is corroborated two other ways instead:

- **Structurally.** `workActivity` reaches its success rendering only through `outcome.ok`. The
  refusal, fault, timeout, unresolvable-reference and no-such-work paths each return `unavailable`
  with their own headline and never emit `Repository:` or `Open pull requests:`. The output the
  Director read is unreachable except from a successful provider answer.
- **Independently.** Through a separate credential, at a separate moment:
  `Hebun-AI/hebun-ai-recovered` **is** repository id `1300480452`, and it has **0 open pull
  requests**. Zero is a true fact about that repository, not an invented one.

This corroborates the FACT the surface reported. It does not, and cannot, replay the Director's
specific call.

**Commit binding is inferred, not read.** The Vercel CLI and the Vercel MCP seam available here
expose no git SHA field for this deployment (the MCP call returns `403` for this scope). The binding
rests on: the production deployment was created **7 seconds** after `2fd7f47` was committed, it
carries the `…-git-main-…` and `www.hebuntech.com` aliases, `origin/main` is `2fd7f47`, and no later
commit exists.

---

## What stays deliberately unavailable

- **No write of any kind.** The module imports no model client, no Knowledge writer, no Governance
  writer, no credential accessor, no action authority and no conversation repository.
- **No model.** The join is SQL equality on GitHub's own immutable numeric repository id. Nothing
  compares names, scores similarity, or decides what relates to what.
- **No addressing.** The only client-supplied value is a `work-item/<uuid>` reference resolved inside
  the tenant. `owner` and `repo` come from GitHub's own installation listing, never from a caller.
- **No content.** `GitHubPullRequestView` has no `patch`, `diff`, `body`, `files`, `commits` or
  `head.sha`. There is no hole in the shape for source code.
- **The declared state is never touched.** Observed activity is not progress, not completion and not
  verification, and the non-inference sentence is rendered on every successful observation —
  including the zero case, which is exactly where a reader is most tempted to conclude otherwise.

**Known and NOT investigated in this phase, by instruction:** both `integrations` rows
(`github-organization`, `google-workspace`) read `status = 'pending'` while their reads succeed.
Pre-existing, untouched, and out of scope here.

---

**WORK ACTIVITY V1 CLOSED / PRODUCTION-ACCEPTED.**
