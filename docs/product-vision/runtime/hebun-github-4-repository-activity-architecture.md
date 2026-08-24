# GITHUB-4 — Repository Activity Runtime: Architecture

**Status:** approved architecture record. Not an implementation, not runtime state, not an authority.
**Baseline:** `2a7c4b552db2d097b23f2d60f1ba8dea32ec7d0a` (`origin/main`, 0 ahead / 0 behind).
**Runs against:** `docs/product-vision/runtime/hebun-provider-onboarding-standard.md`.
**Predecessors:** `hebun-github-1-provider-contract-closure.md`,
`hebun-github-2-installation-authority-closure.md`.

Nothing described here is built. This document is the decision that must exist before the code does.

---

## 1. Problem statement

Connection acceptance is complete and real: a verified GitHub organization installation exists,
persisted through the integration authority as `connected` / `healthy`. That work is closed.

The next problem is different in kind. Hebun holds a real grant it cannot spend:

| `github.repository.activity.read` | State |
|---|---|
| DECLARED | **YES** |
| PERMISSION-BACKED | **YES** |
| AVAILABLE per current derivation | **YES** |
| RUNTIME SEAMS | **0** |
| RUNTIME-REACHABLE | **NO** |
| EXECUTABLE | **NO** |
| REAL-PROVIDER ACCEPTED | **NO** |

A permission is not an endpoint, a declaration is not reachability, and availability is not
execution. GITHUB-4 exists to close exactly that gap — **once**, at the narrowest boundary that is
still a real capability.

---

## 2. Authority model

The new runtime must pass **through** the existing authorities rather than become one.

| Authority | Owns | May decide | May execute |
|---|---|---|---|
| **Integration authority** | connection lifecycle, persisted connection, installation identity, granted permissions, health | whether a connection exists and what it is | no provider call |
| **Capability availability** | lifecycle + health + granted scopes → a per-tenant verdict | **whether the seam may execute at all** | nothing |
| **GitHub provider runtime** (the seams + the authorized-call module) | orchestration, ephemeral token acquisition, normalization | which approved operation to run, for this tenant | **yes — and only through the transport** |
| **GitHub transport** | one outbound HTTP boundary and its firewall | **nothing** | yes, but only an approved operation |
| **GitHub App configuration** | App id, private key, slug, setup URL, state secret | nothing | signs an App JWT |
| **Provider observation** | the normalized result of one read | nothing | nothing — it is data, not truth |
| **UI consumers** | rendering | nothing | nothing |

Two rules follow, and the implementation must be readable as obeying them:

- **The seam asks; it does not decide.** There is no scope comparison inside a seam. The availability
  authority owns the mapping, exactly as `read-drive-metadata.server.ts` already does for Drive.
- **The transport spends; it does not authorize.** It is the thing spent, not the thing that decides
  to spend. It gains a firewall in GITHUB-4 (§7) — a refusal boundary, never a permission boundary.

---

## 3. Installation-token architecture

```
authenticated request
  → TenantContext resolved SERVER-SIDE            (no tenant id is ever an argument)
  → authoritative connection                       (integration authority)
  → capability availability verdict                (lifecycle + health + granted scopes)
  → installation identity                          (integrations.external_account_id)
  → App-authenticated token mint                   (App JWT → POST …/access_tokens)
  → callback-scoped installation token             (never returned upward)
  → installation-authenticated provider call       (approved operation only)
  → normalized, provider-derived result
  → token discarded with the callback frame
```

The mint-and-discard module is the structural mirror of `provider-google/google-authorized-call.server.ts`,
which exists so that one dangerous rule is stated once instead of copied. GitHub's rule is different
— mint and discard, where Google refreshes and replaces — but the shape is the released one: the
secret is handed to a callback and what comes back out is the callback's own result. **A caller
cannot ask this module for a token, because it never returns one.**

| Installation access token | Decision |
|---|---|
| PERSISTED | **NO** |
| CACHED | **NO in v1** |
| RETURNED TO CALLER | **NO** |
| LOGGED | **NO** |
| AUDITED AS SECRET | **NO** |

### Why not the credential authority

`integration-credentials` exists to store, encrypt, rotate and revoke a **tenant-held** secret.
A GitHub installation token is **derived**, not held: re-mintable at any moment from the App key plus
an installation id Hebun already stores, expiring in one hour, with no rotation semantics. Three
consequences settle it:

1. `integration_credential_kind` is closed at `oauth_access | oauth_refresh | api_key`. Storing a
   token needs a **new enum value — a migration**, for a value nothing needs to keep.
2. GITHUB-2's released contract states `integration_credentials` gains no row and no new kind, and a
   test asserts production holds zero.
3. A stored credential is how every other Hebun surface recognises *"this tenant gave us a secret."*
   GitHub's tenant did not. Persisting one would make a false claim in a column.

Storage buys nothing a second HTTP call does not already provide, and **a short-lived provider token
must not become a durable Hebun credential merely because storing it is convenient.**

---

## 4. Selected repository provenance

Repository selection is **fetched live from GitHub on every read**. Hebun holds no repository list.

- **Identity is the immutable numeric `repositoryId`.** It is already the first field of the declared
  `GitHubRepositoryView`.
- `owner`, `name` and `full_name` are **mutable, provider-derived display and addressing fields**. A
  rename changes them and not the id; a surface that treated `full_name` as identity would silently
  follow a renamed repository, and a caller that supplied one would be asserting authority it has not
  got.
- **No repository table. No cache table. No Knowledge admission. No durable repository claim.**

A provider observation is not an organizational fact. Knowledge admission has its own authority and
GITHUB-4 does not touch it.

Consequences accepted deliberately: a transfer out of the organization removes the repository from
the installation; a suspended installation fails every call closed; a changed selection is invisible
until the next read. Each is an argument **for** live reads, not against them — a cache would keep
claiming a repository the installation no longer covers.

---

## 5. Exact capability semantics

The capability key is unchanged: **`github.repository.activity.read`**. Its meaning was already
written by GITHUB-1 — *repository identity **and** pull-request activity* — and requires both
`metadata:read` and `pull_requests:read`. Renaming it would touch the catalog, the availability seam,
a released pin and a UI label map in order to fix a documentation problem. The semantics are pinned
here and by contract instead.

**IN THE FIRST RELEASE**

- selected repository discovery
- repository id
- repository full name
- privacy and archive metadata, where already present in the provider response
- updated timestamp
- default branch **name** (a string on the repository object — no ref, no tree, no commit)
- bounded **open** pull-request metadata: number, title, state, draft status, author login,
  timestamps — exactly the fields of the approved normalized shape

**DEFER**

- commit metadata — GitHub places `GET /repos/{owner}/{repo}/commits` under the **same `Contents`
  permission** as `GET /repos/{owner}/{repo}/contents/{path}`, so commit metadata cannot be bought
  without buying source-file access. It is deferred rather than taken.

**FORBID UNDER THIS CAPABILITY**

repository contents · source code · blobs · trees · commit contents · PR files · diffs · patches ·
raw media types · **writes of every kind**.

`GitHubPullRequestView` has no field for any of it, and that is structural rather than editorial: a
shape with a hole for content invites somebody to fill it, so the hole does not exist. `title` and
`authorLogin` are untrusted provider text on every surface that renders them — data, never an
instruction, never markup.

---

## 6. Runtime operations

Two composable seams, not one. Discovery answers *what may we look at*; the read answers *what is
happening there*. Fusing them would make every read re-enumerate, and would let a caller name a
repository the installation never covered.

### `discoverInstallationRepositories(tenant, deps)`

| | |
|---|---|
| INPUT | resolved `TenantContext`, injectable deps |
| OUTPUT | bounded `GitHubRepositoryView[]`, or a classified refusal |
| AUTHORITATIVE DEPS | capability availability; integration authority (installation identity) |
| PROVIDER DEPS | mint token → `GET /installation/repositories` |
| SIDE EFFECTS | **none** — no lifecycle write, no persistence, no Knowledge write |
| PROVENANCE | provider-derived, live, per-request |
| SECRET BOUNDARY | the token exists only inside the callback frame |

### `readRepositoryPullRequests(tenant, repositoryId, deps)`

Same authority chain, plus one rule that is the point of the operation:

> **The requested `repositoryId` MUST be proven present in the live installation listing before the
> pull-request request is constructed.** The `owner` and `repo` path segments are taken from that
> verified listing entry — never from the caller.

A caller-supplied owner or name may never establish repository authority. A caller-supplied id is a
**claim**, checked against the provider's own answer, in the same way an `installation_id` from a
redirect is a claim until `GET /app/installations/{id}` answers.

Bounded by the already-declared `MAX_REPOSITORIES_PER_PAGE` and `MAX_PULL_REQUESTS_PER_PAGE` (50
each, deliberately below GitHub's 100). Open pull requests only.

**Explicitly rejected: a generic `githubRequest(path)` proxy.** It would move the capability boundary
out of the architecture and into each caller's argument list.

---

## 7. Transport firewall — mandatory, and load-bearing

**A test-only allowlist is not a security boundary. Runtime enforcement is required.**

GITHUB-4's discovery established a fact this section exists to correct: `isAllowedRequestPath` has
**zero runtime callers**, and `GITHUB_ALLOWED_REQUEST_PATHS` names two paths nothing issues while
omitting the one path the transport actually issues. Today's real enforcement is incidental — the
transport hard-codes a single URL template — and incidental enforcement stops being enforcement the
moment a second call is added. GITHUB-4 adds three.

So the transport gains a policy it must consult **before issuing any request**, keyed on four
dimensions together:

| METHOD | PATH TEMPLATE | AUTH CLASS | ACCEPT |
|---|---|---|---|
| `GET` | `/app/installations/{installation_id}` | **APP** | `application/vnd.github+json` |
| `POST` | `/app/installations/{installation_id}/access_tokens` | **APP** | `application/vnd.github+json` |
| `GET` | `/installation/repositories` | **INSTALLATION** | `application/vnd.github+json` |
| `GET` | `/repos/{verified_owner}/{verified_repo}/pulls` | **INSTALLATION** | `application/vnd.github+json` |

Rules:

- **Any** method / path / auth-class / media-type combination not in this table is **refused before
  the request is issued**. Deny by default.
- **The authentication class is part of the identity of an operation.** Presenting an App JWT where
  an installation token belongs — or the reverse — is a distinct refusal, not a detail. Splitting the
  table this way is what makes "the App may read an installation, but may not read a repository" a
  mechanism rather than a habit.
- `{verified_owner}` and `{verified_repo}` are named that way on purpose: they may only be filled
  from an entry of the live installation listing.
- **No arbitrary path input crosses this boundary.** No caller-assembled URL, no path parameter that
  has not been through the table.
- **The existing installation-verification request is represented truthfully** — it appears in the
  table as the App-authenticated operation it is, rather than remaining an undeclared exception that
  the declared list never covered.
- The forbidden vocabulary GITHUB-1 already declared (`GITHUB_FORBIDDEN_PATH_FRAGMENTS`,
  `GITHUB_FORBIDDEN_ACCEPT_MEDIA_TYPES`) stays as the independent second reading: the allow table is
  what the transport consults, and the deny list is what a test consults to prove the allow table did
  not quietly grow a member that reaches a file. If the two ever disagree, the test fails.

The media type is pinned for a specific reason, not for tidiness: `GET /repos/{owner}/{repo}/pulls`
returns JSON metadata under `application/vnd.github+json` and a unified **diff** under
`application/vnd.github.diff`. The permission is identical; only the header differs. A metadata
capability that let the header vary would be a source-content capability wearing a metadata name.

---

## 8. Token narrowing

**Intended posture:** when minting, request only what this capability needs —
`metadata: read` and `pull_requests: read` — and, where it can be done without trusting caller input,
narrow the token to the repositories of the installation. GitHub's documented body parameters
(`repositories`, `repository_ids`, `permissions`) may **narrow but never widen**: a token cannot be
granted permissions the App was not granted.

The intent is that a leaked token is bounded by the *capability*, not by the *installation*.

**This behaviour is NOT verified. REQUIRES REAL-PROVIDER ACCEPTANCE.** How this App's grant actually
responds to a narrowing request — and what it returns when a narrowing request is over-narrow — is
unknown until the real call is made. Nothing in this document may be read as evidence that narrowing
works.

**Repository narrowing must never rely on caller-provided repository names.** If narrowing is done by
repository, the ids come from the verified installation listing, which is the same rule as §6.

---

## 9. Tenant, authorization and governance

- **Server-resolved `TenantContext` only.** No seam accepts a tenant id, so a caller cannot smuggle
  another tenant's connection into a read.
- **Capability availability decides provider eligibility** — lifecycle, health and granted scopes,
  per tenant, per source.
- **No new governance in GITHUB-4** unless implementation discovery proves an existing authorization
  boundary requires it. Every released provider read follows exactly this shape; Governance guards
  decisions and writes, and the capability's empty write list already makes a GitHub write *a phase
  away, not a permission away*. Inventing a permit for a read would create governance the repository
  does not have.

**Known architectural limitation, recorded rather than solved:** role-level authorization for
provider reads is **not currently modelled separately**. Any member of the tenant who reaches the
surface reaches the data — which is the released posture for Google Drive, inherited here rather than
silently changed. GITHUB-4 must not quietly solve a platform-wide authorization question inside one
provider; if the Director wants that boundary, it is its own phase.

---

## 10. Persistence decision

**NO schema. NO migration. NO new credential kind. NO GitHub credential row. NO installation-token
persistence. NO repository persistence. NO pull-request persistence. No cache table.**

Every fact the first release needs already has a home: the connection in `integrations`, the
installation identity in `external_account_id`, the granted permissions in `scopes`, health in its
own columns, and the capability verdict derived by the availability seam. The capability's *output*
is a live read with per-request provenance and needs no home at all.

---

## 11. Failure model

Fail closed, with a classified reason, for at least:

no trusted tenant · no connection · wrong tenant · disconnected connection · unhealthy or unusable
connection · missing required permission · invalid installation identity · token mint refusal ·
provider authentication failure · repository outside the installation · provider timeout · rate
limiting · malformed provider response · forbidden endpoint · forbidden media type.

Rules that hold across all of them:

- **A read may never write the connection lifecycle.** A 429 or a 503 is a classified failure and the
  tenant's grant is untouched — a read must not be able to end a connection.
- **No provider response body escapes the provider boundary.** Callers receive a classified reason,
  never GitHub's payload.
- Secrets never enter UI, generic integration models, logs, audit metadata, client bundles, or error
  payloads.
- Refusal reasons must distinguish *operator problems* from *tenant problems* from *provider
  outages*, because they send a human to three different places.

---

## 12. Acceptance contract

Fifteen conditions, each independently provable. All fifteen, or the capability is not accepted:

1. authoritative tenant resolved server-side
2. authoritative GitHub connection resolved
3. connection verified usable (lifecycle + health)
4. required granted permissions present
5. installation token minted through the legitimate authority
6. token never persisted and never leaked
7. real selected repositories obtained from GitHub
8. the requested repository proven part of the installation
9. a real permitted repository endpoint reached
10. response normalized to the declared shape
11. provenance retained as provider-derived
12. no forbidden content fetched
13. no write endpoint reachable
14. the reachability gate reports **REACHABLE**
15. the production runtime exercised against the real `Hebun-AI` installation

States that must never collapse into one another: **IMPLEMENTED · CONFIGURED · AUTHORIZED ·
RUNTIME-REACHABLE · EXECUTED · SUCCESSFUL · REAL-PROVIDER-ACCEPTED · RELEASED.**

**Mocks cannot close real-provider acceptance.** A mock returns the error shape somebody imagined;
INT-4 learned this when the real Google returned `accessNotConfigured` and the code fell through to a
refresh it did not need.

---

## 13. Test and bite-proof contract

| Concern | Level |
|---|---|
| tenant isolation; a second tenant's connection is unreachable | integration (Postgres) + bite |
| disconnected connection; unhealthy connection; missing permission | unit + bite |
| invalid installation identity; token mint refusal | unit + bite |
| **the module cannot return a token** — structural, not behavioural | unit + bite |
| **no token is persisted** — credential count unchanged across a read | integration + bite |
| repository outside the installation is refused | unit + bite |
| repository rename: id stable, `full_name` changed, identity unaffected | unit |
| pagination and bounds | unit |
| provider timeout / 401 / 403 / 404 / 429 / malformed body | unit, injected `fetchImpl` |
| forbidden endpoint, forbidden write, forbidden media type, forbidden content fragment | bite + firewall over real source |
| **transport refuses an unapproved method/path/auth/media combination** | unit + bite |
| capability reachability flips to REACHABLE | the existing gate |
| **real-provider acceptance** | **real GitHub, once, against installation `156248772`** |

Every guard must be watched to fail. An assertion nobody has seen fail is a sentence, not a guard.

---

## 14. Architecture decision — Q1 over Q2

Both were evaluated. The rejected alternative is kept here on purpose: a decision whose alternative
has been erased cannot be re-examined when its assumptions change.

| | **Q1 — provider-owned ephemeral (CHOSEN)** | **Q2 — credential-authority-owned token** |
|---|---|---|
| Authority coherence | high — mirrors the released Google module split | low — stores a derived value in a held-secret store |
| Security | high — no durable secret exists | lower — a new encrypted secret at rest |
| Least privilege | high — token narrowed per call | comparable |
| Tenant isolation | equal | equal |
| Complexity | one new module | new kind + migration + rotation + revocation semantics |
| Persistence cost | **zero** | table growth, encryption, key rotation |
| Runtime cost | one extra mint per read | fewer mints, more state |
| Testability | high — injectable `fetchImpl` | needs database fixtures |
| Future extensibility | adequate | higher, and not needed |
| Reversibility | **high — delete one module** | low — a migration is a one-way door |

**Q1 wins on the criterion that matters here: it is the smallest architecture that correctly delivers
the first real capability, and the only one requiring no schema.** Q2 was not rejected for being
wrong in general — it is the right shape for a tenant-held secret. GitHub simply does not have one.

---

## 15. Non-goals

No second credential authority · no second connection authority · no generic GitHub request proxy ·
no persistence of any kind · no hidden execution authority · no organizational-truth claim derived
from a provider observation · no broader provider permission · no write capability · no webhooks ·
no commits, contents, diffs, patches or PR files · no capability rename · no platform-wide
provider-read authorization model · no INT-3 M9 fix.

---

## 16. Rollback

There is no migration and no durable token state, so rollback is **code-only**: remove the runtime
seams and the production consumer's import, and the reachability gate returns to
`NOT-IMPLEMENTED (0 seam)` on its next run.

**No data rollback is required or possible**, because nothing was written. That property is not an
accident of the first release — it is a consequence of §3 and §10, and any future change that
introduces persistence also destroys it, which is a fact that phase must state out loud.
