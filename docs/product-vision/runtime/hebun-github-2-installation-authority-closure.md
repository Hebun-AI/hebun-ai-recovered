# GITHUB-2 — GitHub App Installation Authority, and the First Real Organization Installation

**Status:** engineering/release record. Not runtime state, not an authority.
**Baseline:** `95edd48cda28f3ab0999fe4aa1315af605c87816` (`origin/main`, 0 ahead / 0 behind).
**Runs against:** `docs/product-vision/runtime/hebun-provider-onboarding-standard.md` (Stage T).
**Predecessor:** `docs/product-vision/runtime/hebun-github-1-provider-contract-closure.md`.

---

## 1. Scope

This record closes Stage T for the GitHub App onboarding work: what `111a571` implemented, what the
first real organization installation proved, what `95edd48` repaired, and — at equal length — what
is still **not implemented**.

It carries the evidence for two things the Director tracked as separate phases:

- **GITHUB-2** — the installation authority, released as `111a571`.
- **GITHUB-3** — App registration, production configuration, and the first real installation.

They share one record because **`GITHUB-3` does not exist in this repository.** `git grep "GITHUB-3"`
returns nothing: no doc, no test, no plan, no commit. It was a Director-side label for the operator
work that followed GITHUB-2, and its evidence is meaningless without GITHUB-2's implementation. A
second file would have implied a second phase contract that was never written.

**This phase built no runtime capability.** It documents. No source, schema, migration, provider
authority, permission, or endpoint changed while it was written.

---

## 2. Repository and release identity

| Fact | Value |
|---|---|
| Repository | `Hebun-AI/hebun-ai-recovered` (id `1300480452`, Organization-owned) |
| Branch | `main` |
| HEAD = `origin/main` | `95edd48cda28f3ab0999fe4aa1315af605c87816` |
| Implementation commit | `111a5715f181b8b3d0bd33f6d86c498bbcc957e5` |
| UI truth fix | `95edd48cda28f3ab0999fe4aa1315af605c87816` |
| Tags | none — neither commit is tagged |
| GitHub App | `Hebun AI`, App id `4702369`, slug `hebun-ai`, owned by the `Hebun-AI` organization |

The repository was transferred from the personal account `hebuntech` to the `Hebun-AI` organization
during this work. The repository id survived the transfer; only the owner changed.

---

## 3. GITHUB-2 implementation closure — what `111a571` introduced

34 files, +3390 / −101. Twelve new files, twenty-two modified.

| Concern | Owner | State |
|---|---|---|
| App environment authority | `provider-github/github-environment.server.ts` | five env keys, each parsed and validated; fail-closed on absent/blank/malformed |
| Private-key handling | same file | held only as a `KeyObject`, never a string; never returned, logged, audited, persisted, or sent to a client. `JSON.stringify` of one yields `{}` |
| App JWT signing | `github-app-jwt.server.ts` | RS256, `iss` = App id, `iat = now − 60`, `exp = now + 540` — a 600s span inside GitHub's 10-minute ceiling |
| Install state | `install-state.server.ts` | HMAC-SHA256 signed, domain-separated; carries tenant id, a **digest** of the session reference, and the integration id; 256-bit nonce; 600s TTL |
| Start route | `api/integrations/github/start/route.ts` | accepts **nothing** from the request; tenant from session, slug and setup URL from configuration |
| Setup callback | `api/integrations/github/setup/route.ts` | treats every part of the request as hostile; clears the state cookie on **every** path including failure |
| Installation verification | `verify-installation.server.ts` | `GET /app/installations/{id}` under App JWT; normalises field by field, returns no raw provider object |
| Organization-only acceptance | same file | requires `account.type === target_type === "Organization"`; a personal installation is refused as `identity`, not as a permission failure |
| Selected-repository requirement | `connect-installation.server.ts` | `all` refused as `repository-selection-too-broad` |
| Granted-permission verification | same file | checked against `GITHUB_REQUIRED_GRANTED_PERMISSIONS` (`metadata:read`) from GitHub's **granted** list, never from what Hebun requested |
| Lifecycle write | `integration-authority/integration-repository.server.ts` | a sibling writer for a grant that carries no secret; the released transition table and the credential-framed writer were left untouched |
| Persistence | existing `integrations` table | **no schema, no migration, no new column, no new enum value** |
| Health observation | existing health columns | written from a real provider response only |
| Provider catalog | `provider-catalog/catalog.ts` | `github-organization` entry, `connectivity: "connectable"`, `accountIdentity: "organization"`, `authMethod: "github_app"`, empty write list |
| `/integrations/github` | `app/(dashboard)/integrations/github/page.tsx` + `features/github-connection-surface/model.ts` | pure model over an `IntegrationView`; no default, no placeholder, no invented figure |
| Platform → Integrations | existing `platform-integrations` surface | GitHub appears through the same authority as Google |
| Tests | `tests/github2-installation-authority/` | `installation-authority.ts` (786 lines) + `bite-proofs.ts` (239 lines) |

### 3.1 What GITHUB-2 did **not** implement

Each of these is absent by decision, and each is asserted by a released test:

- **No installation access-token minting.** `POST /app/installations/{id}/access_tokens` appears in
  this repository only inside comments.
- **No repository enumeration.** `GET /installation/repositories` is never called.
- **No repository metadata read runtime.**
- **No pull-request read runtime.**
- **No repository-content read.** No `/contents/{path}`, no `/pulls/{n}/files`, no `/commits`, no
  `/git/blobs`, no `/compare`, no archive endpoint — and no `diff` or `raw` media type.
- **No GitHub write endpoint of any kind.**
- **No GitHub execution authority.**
- **No repository-activity runtime seam.**

The transport issues **exactly one** address: `GET https://api.github.com/app/installations/{id}`.

> `GITHUB_ALLOWED_REQUEST_PATHS` in `provider-github/contracts.ts` lists `/installation/repositories`
> and `/repos/{owner}/{repo}/pulls`. That list is a **declared future boundary written by GITHUB-1**,
> not a record of implemented calls. Neither path is issued anywhere in this repository, and the one
> address the transport does issue is not on that list — it is the App-level verification call. A
> reader must not treat the allow list as evidence that a call exists.
>
> Nor as evidence that anything is enforced: `isAllowedRequestPath` has **zero runtime callers**. The
> list is declared vocabulary asserted by tests, and today's real enforcement is structural — the
> transport hard-codes one URL template. See
> `hebun-github-4-repository-activity-architecture.md` §7.

### 3.2 Vocabulary this record refuses to blur

`connectable` is a property of the **catalog**: Hebun could establish a real connection to this
provider because a verifier exists. `available` is a property of a **tenant's grant**: lifecycle plus
health plus granted scopes cover what a capability declares. **Neither means a seam exists**, and in
GitHub's case none does.

---

## 4. Real organization installation acceptance

The Director performed the installation through Hebun's own surface. Hebun's released verifier was
then re-run against the real GitHub API while writing this record, and returned:

```
installationId       156248772
accountId            320598133
accountLogin         Hebun-AI
accountType          Organization
repositorySelection  selected
grantedPermissions   ["metadata:read","pull_requests:read"]
suspended            false
```

Cross-checked independently: `gh api orgs/Hebun-AI` reports organization id `320598133`, and
`gh api orgs/Hebun-AI/installations` reports two Apps on the organization — `hebun-ai` (`4702369`)
and `vercel` (`8329`), both `repository_selection: selected`.

This is a **real provider round trip**, not a fixture. It proves the connection. It proves nothing
about the repository-activity capability, which has no endpoint to reach.

---

## 5. Persisted connection truth

Read read-only from the production database while writing this record:

| Column | Value |
|---|---|
| `provider_key` | `github-organization` |
| `connection_state` | `connected` |
| `health` | `healthy` |
| `external_account_id` | `156248772` |
| `external_account_label` | `Hebun-AI` |
| `scopes` | `["metadata:read","pull_requests:read"]` |
| `last_verified_at` | `2026-08-24T16:47:15.300Z` |
| `last_error_at` / `failure_reason` / `revoked_at` | `null` |

`external_account_id` holds the **installation id**, and the writer takes it from
`String(identity.installationId)` — the verified response — never from the callback URL. The
organization login is carried in the label.

**`integration_credentials` rows for this connection: 0.** Every credential row in production belongs
to Google. GitHub's grant is an installation held on GitHub's side and referenced by an id; there is
no tenant secret, so none is stored.

---

## 6. Capability truth matrix — `github.repository.activity.read`

Re-measured at `95edd48` by running `tests/provider-onboarding/acceptance-reachability.ts`:

```
google-workspace    / google.drive.metadata.read:      REACHABLE (2 seam)
github-organization / github.repository.activity.read: NOT-IMPLEMENTED (0 seam)
```

| Question | Answer | Evidence |
|---|---|---|
| DECLARED | **YES** | catalog entry `capabilityScopes` |
| PERMISSION-BACKED | **YES** | GitHub granted `metadata:read` + `pull_requests:read` |
| CONNECTION-ELIGIBLE | **YES** | `metadata:read` alone satisfies the connection requirement |
| AVAILABLE per current derivation | **YES** | availability seam: lifecycle + health + granted scopes |
| RUNTIME SEAM COUNT | **0** | reachability gate, measured |
| RUNTIME-REACHABLE | **NO** | `NOT-IMPLEMENTED` |
| EXECUTABLE | **NO** | no repository or pull-request address exists |
| REAL-PROVIDER ACCEPTANCE | **NO** | §6 condition 5 of the standard is unreachable |
| RELEASED AS A WORKING CAPABILITY | **NO** | — |

**The two facts this record exists to keep apart:**

> **The GitHub organization connection is real and verified.**
> **The repository-activity capability is not implemented as an executable runtime capability.**

A permission is not an endpoint. A declaration is not reachability. Availability is not execution.

---

## 7. Selected-repository provenance

**SELECTED REPOSITORY IDENTITY: UNAVAILABLE THROUGH THE RELEASED RUNTIME SEAM.**

What is known: GitHub reports `repository_selection: selected` for installation `156248772`. That is
carried by the installation object and verified.

What is **not** known to Hebun: *which* repositories. `GET /app/installations/{id}` does not name
them. Naming them requires an installation access token (`POST /app/installations/{id}/access_tokens`)
followed by `GET /installation/repositories`, and the released transport does neither.

A human selected `Hebun-AI/hebun-ai-recovered` in GitHub's UI during installation. That observation
is **not** runtime provenance and this record does not promote it to one. It is a memory of a screen,
not a fact Hebun can re-derive, and writing it into a closure document as though the runtime knew it
is exactly the collapse this document exists to prevent.

---

## 8. Security and governance invariants

Each verified against released code and its bite-proofs at `95edd48`:

| Invariant | State |
|---|---|
| Tenant identity from trusted authenticated context | held — `resolveTenantContext()`; no client-supplied tenant path exists |
| App private key server-only | held — `KeyObject`, `assertServerOnly()`, never returned or logged |
| Install-state secret server-only | held — dedicated secret, never the session digest or Google's |
| State signed | held — HMAC-SHA256, domain-separated |
| State tenant-bound | held — bite M3 |
| State session-bound | held — session digest, bite M4 |
| State single-use | held — nonce compared with `timingSafeEqual`; cookie cleared on every path |
| `installation_id` is a claim until verified | held — strict parse, then GitHub's own answer |
| Organization-only | held — bite M8 |
| All-repositories refused | held — bite M9 |
| Selected-repositories required | held — the real installation is `selected` |
| Granted permissions read from the provider response | held — bite M10 |
| No tenant GitHub credential row | held — production count is 0 |
| No installation access token persisted | held — none is ever minted |
| No write capability | held — empty write list; no `:write` granted |
| No GitHub execution authority | held — 0 seam |
| No schema or migration | held — 0 migration files in either commit |
| Google authority unchanged | held — INT-2/INT-3/INT-4 suites pass |

All seven state refusals collapse into one `invalid-request`, so the callback offers no oracle for
which check failed.

Nothing above is claimed beyond what a released test or a measured value supports.

---

## 9. UI truth defect and its release — `95edd48`

**The defect.** Platform → Integrations rendered two Google sentences on the live GitHub card. The
verified `Hebun-AI` organization read as *"Google Account. No verified Google Workspace domain was
recorded for this connection, so none is claimed."*, and its granted capability read *"Read-only file
discovery and metadata. Hebun reads no file content, and holds no permission to change anything in
Drive."*

Neither was a copy nit. Both are claims about **access**, printed as facts about an organization, on
the page whose purpose is that a connection claim is never a guess. Both were reproduced from the
real production row before anything was changed.

**The cause.** Each sentence was written when Google was the only provider, so "the connected
provider" and "Google" were the same thing and nothing had to say which was meant. A second provider
is the only thing that can tell those apart.

**The fix boundary.** Presentation model only — `platform-integrations/model.ts`:

- capability sentences keyed by capability id, with a fallback naming no product, scope, or endpoint;
- account-kind keyed by the catalog's `accountIdentity` (`account` vs `organization`), with Google's
  Workspace sentences keyed by **Google's provider key**, so a future second account-identity
  provider cannot inherit them the way GitHub did;
- one capability label added.

Provider authority, runtime, transport, persistence, permissions, catalog scopes, schema: **all
unchanged**.

**Regression evidence.** The new guard **fails against the pre-fix implementation** in a clean
worktree at `111a571` — that is what makes it a proof rather than a sentence. The corrected model
passes. The INT-3.1 harness reports **14/14 mutations bitten** (M1–M14, of which M11–M14 are new)
with the known-correct model accepted. Google's rendered output is byte-identical to before.

This changed no GitHub runtime capability, and this record does not present it as one.

---

## 10. Validation evidence

Isolated full suite at `111a571` plus only the two changed files, run in a clean worktree so
concurrent working-tree work could not enter the count:

```
Test summary: 466 passed, 1 failed, 467 total.
FAILED tests/int3-google-connection/bite-proofs.ts (exit 1)
```

**The suite is not green, and this record does not say it is.** The single failure is
**pre-existing**: INT-3's M9 mutation fails its own reason-matching assertion. It was reproduced
3/3 on the parent baseline `8c2bfaf` — before any GitHub work existed — and `111a571` does not touch
that file. **Zero failures were introduced.**

| Check | Result |
|---|---|
| GITHUB-1 contract + bite-proofs | PASS — 11 mutations bit, 1 correct change accepted |
| GITHUB-2 installation-authority + bite-proofs | PASS — **12 mutations bit, 1 correct change accepted** |
| Repaired released pins (18 pre-existing suite files) | PASS |
| UI truth guard (INT-3.1) | PASS — 14/14 bitten |
| Acceptance reachability gate | PASS — and reports GitHub `NOT-IMPLEMENTED` |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 — **0 errors**, 14 warnings (unchanged baseline count) |
| `npm run build` | exit 0 — all three GitHub routes build as dynamic functions |

---

## 11. Production and deployment evidence

| State | Evidence |
|---|---|
| **PUSHED** | `111a571..95edd48  main -> main`, fast-forward, no force. `git ls-remote` confirms remote `main` = `95edd48` |
| **DEPLOYMENT-CREATED** | `dpl_PgwZUbjbsvLEPWctixnCdnbcWYeg`, created automatically by the push — not triggered by hand |
| **DEPLOYMENT-READY** | observed `BUILDING` → `READY` |
| **PRODUCTION-SERVING** | the alias `www.hebuntech.com` resolves to `dpl_PgwZUbjbsvLEPWctixnCdnbcWYeg` |

Deployment `githubCommitSha` is `95edd48cda28f3ab0999fe4aa1315af605c87816` — exact — and
`githubOrg` is `Hebun-AI`. That last field is the **first execution proof** that the Vercel project's
Git connection genuinely follows the organization: before this push it was proven only by the stored
`link` object.

Production configuration holds five `HEBUN_GITHUB_*` variables, all Production-scoped and all
`sensitive`. A sensitive Vercel variable **cannot be read back**, so "configured" is evidenced by
supply plus a local run of the released resolver against the same values — which returned
`configured` — and never by reading production's stored values.

**Not proven:** the corrected GitHub card as rendered in production. Every `/integrations*` route is
behind authentication and no authenticated production session was used. A READY deployment carrying
the right SHA is not a visual inspection, and this record does not treat it as one.

---

## 12. Known debt

1. **INT-3 M9** — the mutation fails for the wrong reason; its assertion greps for output that the
   real failure does not produce. Pre-existing, reproduced on `8c2bfaf`, unrelated to GitHub.
2. **No tag** on `111a571` or `95edd48`.
3. **Selected-repository identity** unavailable through the released seam (§7).
4. **The authenticated production GitHub surface has never been visually verified** — true for
   `/integrations/github` and for the corrected Platform → Integrations card.
5. `GITHUB_ALLOWED_REQUEST_PATHS` declares two paths no code issues. Harmless today, misleading to a
   future reader; §3.1 exists to defuse it.

---

## 13. Deferred — the next architectural problem

The next phase would build the first legitimate runtime seam for
`github.repository.activity.read`. **Its architecture is not assumed here**, and nothing in this
record should be read as having designed it. That phase must first decide:

- whether installation access-token minting belongs inside the existing GitHub provider authority or
  needs its own;
- token lifetime and in-memory handling (GitHub's expire after one hour);
- **whether an installation token may ever be persisted** — the current answer everywhere in this
  repository is that no GitHub secret is stored at all, and reversing that is a decision, not a
  detail;
- which authority owns selected-repository enumeration;
- repository identity provenance — how a repository becomes a fact Hebun can re-derive rather than a
  screen somebody remembers;
- the exact semantics of "repository activity";
- the minimum endpoint allow list, and whether pull-request metadata belongs to this capability at
  all;
- how the seam registers for runtime reachability;
- real-provider acceptance criteria against §6's ten conditions;
- tenant isolation for a token scoped to an organization's repositories;
- governance implications, if any read becomes a durable record.

---

## 14. Final truth ledger

| State | Verdict | Evidence |
|---|---|---|
| GITHUB APP DESIGNED | **YES** | GITHUB-1 closure; permissions verified against GitHub's docs |
| GITHUB APP IMPLEMENTED | **YES** | `111a571`, 12 new files |
| GITHUB APP CONFIGURED | **YES** | five Production env vars; released resolver returns `configured` |
| REAL INSTALLATION EXECUTED | **YES** | Director-performed; installation `156248772` |
| CONNECTION ACCEPTED | **YES** | `connection_state = connected` written by the verified writer |
| CONNECTION VERIFIED | **YES** | real `GET /app/installations/156248772` under App JWT |
| CONNECTION HEALTHY | **YES** | `health = healthy`, `last_error_at` null |
| GRANTED PERMISSIONS VERIFIED | **YES** | `metadata:read`, `pull_requests:read` — from GitHub's granted list |
| CAPABILITY DECLARED | **YES** | catalog `capabilityScopes` |
| CAPABILITY AVAILABLE | **YES** | availability seam — and this means grant coverage, nothing more |
| CAPABILITY RUNTIME-REACHABLE | **NO** | `NOT-IMPLEMENTED (0 seam)`, measured |
| CAPABILITY EXECUTABLE | **NO** | no repository or pull-request address exists |
| CAPABILITY REAL-PROVIDER ACCEPTED | **NO** | §6 condition 5 unreachable |
| SELECTED REPOSITORY IDENTITY VERIFIED | **UNAVAILABLE** | released runtime cannot enumerate them |
| PRODUCTION DEPLOYED | **YES** | `dpl_PgwZUbjbsvLEPWctixnCdnbcWYeg`, READY, sha `95edd48` |
| PRODUCTION SERVING | **YES** | `www.hebuntech.com` resolves to that deployment |
| AUTHENTICATED UI VISUALLY VERIFIED | **NO** | never inspected behind login |

Sixteen states, sixteen separate answers. None was promoted because a later-looking one was true.
