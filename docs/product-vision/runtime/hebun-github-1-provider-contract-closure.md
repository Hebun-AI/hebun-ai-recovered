# GITHUB-1 — Real GitHub Provider Contract + Engineering Signals Foundation

**Status:** engineering/release record. Not runtime state, not an authority.
**Baseline:** `658fd79469f07d007c1b0c60e72a46e014893f92` (`origin/main`, 0 ahead / 0 behind).
**Runs against:** `docs/product-vision/runtime/hebun-provider-onboarding-standard.md`.

This phase prepared the **contract** for a real GitHub provider. It registered no GitHub App,
installed nothing, called nothing, requested nothing, and persisted nothing.

---

## 1. Official GitHub documentation verification

Every permission decision below was verified against GitHub's current documentation during this
phase. None was written from memory.

| # | Question | Verified answer | Source |
|---|---|---|---|
| 1 | Repository metadata permission | `Metadata` read covers `GET /repos/{owner}/{repo}`, `GET /orgs/{org}/repos`, `GET /repositories`, `GET /user/repos`, languages, topics, tags, contributors | *Permissions required for GitHub Apps* |
| 2 | Pull-request listing permission | `Pull requests` read covers `GET /repos/{owner}/{repo}/pulls` | *Permissions required for GitHub Apps* |
| 3 | Does commit listing require `Contents`? | **YES.** `GET /repos/{owner}/{repo}/commits` is listed under `Contents` read | *Permissions required for GitHub Apps* |
| 4 | What else does `Contents: read` permit? | `GET /repos/{owner}/{repo}/contents/{path}` — source file contents — under the same permission | *ditto* |
| 5 | Installation access token creation | `POST /app/installations/{id}/access_tokens`, authenticated with a JWT | *Generating an installation access token* |
| 6 | Installation token expiry | "The installation access token will expire after 1 hour." | *ditto* |
| 7 | Token narrowing | `repositories` / `repository_ids` / `permissions` body params may narrow, never widen: "cannot be granted permissions that the app was not granted" | *ditto* |
| 8 | JWT requirements | "must be signed using the `RS256` algorithm"; expiry "no more than 10 minutes into the future"; `iss` is the App client/application id; set `iat` 60s in the past for clock drift | *Generating a JSON web token (JWT)* |
| 9 | Installation read | `GET /app/installations/{id}` requires a **JWT**; returns `account`, `repository_selection`, `permissions`, `events`, `suspended_at` | *REST — Apps* |
| 10 | Selected repositories read | `GET /installation/repositories` requires an **installation token**; returns `repository_selection` + `repositories` | *REST — App installations* |
| 11 | Uninstall / revocation | `DELETE /app/installations/{id}` "Uninstalls a GitHub App on a user, organization, or enterprise account" | *REST — Apps* |
| 12 | Setup URL | receives `installation_id`, and GitHub states: **"Bad actors can hit this URL with a spoofed `installation_id`. Therefore, you should not rely on the validity of the `installation_id` parameter."** | *About the setup URL* |
| 13 | Least privilege | "You should select the minimum permissions required for the app." | *Choosing permissions for a GitHub App* |

**Not verifiable, therefore not coded:** GitHub's docs as fetched do **not** state that `Metadata:
read` is mandatory or automatically granted. So nothing in this repository assumes it. `metadata` is
an explicitly *requested* permission, and `metadata:read` is required as an explicitly *granted*
one — which is true whether or not GitHub also grants it automatically.

### Where this contradicts a prior report

The GITHUB-0 framing that commit metadata might be obtainable separately from source content is
**false against verified provider reality**. GitHub places commit listing and file-content reads
under one permission. Commit metadata is therefore **deferred**, per Director decision 6.

---

## 2. Simulation vs real provider

| | World B (simulation) | World A (real) |
|---|---|---|
| Module | `features/providers/github` | `features/provider-github` |
| Identifier | `GITHUB_PROVIDER_ID = "github"` | `GITHUB_PROVIDER_KEY = "github-organization"` |
| Declares | `simulation: true`, `supportedExecutionModes: ["simulation"]` | the permission/shape contract for a future `ConnectionDefinition` |
| Content | fixtures for repos, commits, issues, workflows, releases | permissions, bounds, normalized shapes |

**No literal is shared.** The keys differ, so a log line names exactly one world and the firewall is
mechanical rather than conventional. Neither world is in the catalog: `findProviderDefinition` returns
`undefined` for `github` and for `github-organization` alike, for two different reasons — the
simulation may never be connectable, and the real provider is not connectable *yet* (§3).

**Firewall added** (`tests/github1-provider-contract/contract.ts`): asserted on **import specifiers**
of comment-stripped source, in both directions. Neither tree may import the other; the simulation
additionally may not import `provider-catalog` or `integration-authority`.

A raw-text version of this ban was written first and **failed on this phase's own honest prose** —
the contract module explains at length why the two worlds are separate. The ban is about
reachability, and only a module specifier creates reachability. Same defect class as G5A and R6D.

---

## 3. Provider catalog contract — DESIGNED, and DELIBERATELY NOT LANDED

```
providerKey      github-organization
label            GitHub
authMethod       github_app          ← new vocabulary member, added this phase
accountIdentity  organization        ← already existed
connectivity     (undecidable today — see below)
minimumScopes    ["metadata:read"]
capabilityScopes github.repository.activity.read
                   read:  ["metadata:read", "pull_requests:read"]
                   write: []
```

**The entry was written, then removed, and that is the phase's most important finding.**

`connectivity: "connectable"` is a **false claim** for GitHub today. The released vocabulary defines
it as requiring *a credential store and a verifier*. GitHub needs **no** credential store — proven in
§8 — but it does need a **verifier**: the JWT-authenticated `GET /app/installations/{id}` read that
turns a spoofable `installation_id` into a fact. That read does not exist.

The catalog's own header already states the rule this phase obeyed rather than amended:

> Through INT-1 and INT-2 this file was EMPTY, and that emptiness was the honest statement: no
> credential store existed, no verifier existed, and listing a vendor would have offered a
> connection no code could complete.

A `connectable` GitHub entry would make `/integrations` offer a GitHub connection and let a tenant
create a `draft` row that could never progress. `connectivity: "fixture"` would behave correctly —
excluded from the availability seam, `createConnection` refusing `provider-not-connectable` — and lie
about why. Widening `ProviderConnectivity` with a third member was considered and rejected as
disproportionate for one provider.

**Director decision: defer the catalog entry to GITHUB-2, landed in the same commit as the
verifier.** Four released pins (`i1-connection-authority` ×2, `int3-google-connection`,
`int4-google-drive-metadata`) assert *"exactly one connectable provider, and only because it is
genuinely implemented"*. They were correct; **none of them was amended, weakened, or touched.**

`tests/github1-provider-contract/contract.ts` now asserts the **absence**: no catalog entry may name
GitHub while nothing can confirm an installation. A later author who adds the definition without the
seam must delete a test that says why.

### `ProviderAuthMethod` was still widened, and it cost nothing

`"oauth2" | "api_key"` → `"oauth2" | "api_key" | "github_app"`.

It is kept even with no entry writing it, on the released precedent that declared
`VerificationOutcome`'s `ok: true` arm one phase before any code could construct it — so the
consumer's handling is written and reviewed before the producer arrives.

This is safe because `authMethod` is **type-only vocabulary**. A test asserts the complete file set
that mentions it is exactly two — the interface that declares it and the catalog that writes it for
Google — that nothing `switch`es on it or compares it, and that **no column in `src/db` carries it**.
Widening changes no stored value and no behaviour.

Calling a GitHub App installation `oauth2` would have been actively wrong: there is no
authorization-code exchange for the connection, no refresh token, and no tenant-held secret. It
would have told every future reader that `integration_credentials` holds a refresh token for it.

---

## 4. Permission normalization — no schema change, proven

GitHub grants a **map**; OAuth grants a **list**.

```
GitHub returns   {"metadata": "read", "pull_requests": "read"}
Hebun stores     ["metadata:read", "pull_requests:read"]
```

Proof that this needs no migration:

1. `integrations.scopes` is `jsonb("scopes").$type<string[]>().notNull().default([])` — an existing
   column of exactly this shape.
2. The availability seam compares by exact membership:
   `required.every((scope) => granted.includes(scope))`.
3. Flattening to `name:level` preserves both halves of the question — **which** permission, at
   **what** level — inside that column.

**Requested ≠ granted is structural.** `GITHUB_REQUESTED_PERMISSIONS` (what the App asks for) and
`GITHUB_REQUIRED_GRANTED_PERMISSIONS` (what must come back) are two different constants, and a test
asserts they are not the same set and that Hebun never requires what it never requests.

`coversRequiredPermissions` is **exact-match, not level subsumption**: `metadata:write` does **not**
satisfy `metadata:read`, even though GitHub would allow the read. This provider never requests a
write, so a grant carrying one must not launder into coverage.

**Minimum-to-connect is not covers-this-capability.** `minimumScopes` is `metadata:read` alone. An
installation granting only metadata is a real connection to a real organization that cannot answer
the capability — the seam reports a **scope gap**, not "not connected".

---

## 5. Source-content decision — Director-approved, and the weaker arrangement

**The finding:** GitHub's `pull_requests:read` is **broader than this product's capability**. It also
grants `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` (whose response carries a `patch`) and a
`diff`/`patch` media type on `/pulls/{pull_number}`. Those are source-code contents.

This is **worse than Google**. `drive.metadata.readonly` *cannot* download a file, so Google enforced
that boundary and a mistake in Hebun's code could not cross it. GitHub offers no permission with that
shape: listing pull requests at all requires a permission that can also read their diffs.

Per Phase 6 of the phase brief this was escalated, and the **Director approved option B**: keep
`metadata:read + pull_requests:read`, and hold the boundary in Hebun.

**Recorded honestly: the released product claims less than the granted provider permission allows,
and only Hebun's own constants stand between them.**

The boundary is expressed as contract, not transport — GITHUB-1 builds no client:

| Mechanism | Value |
|---|---|
| Request-path allow list (deny by default) | `/installation/repositories`, `/repos/{owner}/{repo}/pulls` |
| Forbidden path fragments (redundant, so the allow list is checked against them) | `/actions`, `/checks`, `/commits`, `/compare`, `/contents`, `/deployments`, `/git/`, `/issues`, `/pulls/{pull_number}`, `/statuses`, `/tarball`, `/zipball` |
| Pinned media type | `application/vnd.github+json` |
| Forbidden media types | `vnd.github.diff`, `.patch`, `.raw`, `.v3.diff`, `.patch+json`, `.raw+json` |
| Normalized shape | `GitHubPullRequestView` declares **no** `patch`, `diff`, `body`, `files`, `sha` or `content` field — asserted by a test over the stripped interface body |

**GITHUB-2 must construct every request from that allow list.** Nothing enforces it at runtime today
because no runtime caller exists; the test asserts the list's shape and that no forbidden fragment is
reachable from it. It cannot assert a caller that does not exist. **This is the phase's largest open
risk and it is not hidden.**

---

## 6. Engineering Signals ownership

**No new Intelligence authority was created, and none is needed.**

### What was ruled out, with the reason

The Organizational Intelligence Runtime **cannot host** provider-derived GitHub metadata:

- `awareness-signal` is a **candidate awaiting a Director decision**, and its type requires grounding
  in qualified learning candidates, qualified optimization candidates, and evidence refs
  (`requiresBasis: true`). A pull-request count is none of those.
- `RuntimeDependencyKind` is a **closed three-member union** — `memory-context`,
  `reasoning-understanding`, `organization-assembly` — and **every member is `required: true`**.
  Adding GitHub as a fourth would make every existing well-formed pass ill-formed
  (`reachesRequiredDependencies`).

Forcing GitHub into that vocabulary would widen a frozen contract to say something untrue.

### What owns it instead — the released Knowledge/Drive precedent

`provider-google/discover-drive-sources.server.ts` already establishes the pattern, and its own
header states the rule: the **provider subsystem answers**, the consuming page **composes**, and
neither becomes the other. `/intelligence` is already exactly such a composition point — it resolves
`getIntelligenceWorkspaceModel()` and `observeGovernanceActivity(tenant)` without deriving either
from the other.

```
GitHub → provider-derived repository/PR metadata → provider-github read seam
       → composed by the released /intelligence surface
```

**NOT** GitHub → Knowledge persistence. **NOT** GitHub → authoritative company truth. **NOT**
GitHub → autonomous engineering action.

Nothing under `provider-github` imports `@/db`, `drizzle-orm`, `features/knowledge`,
`features/governance` or `integration-credentials` — asserted structurally, so provider data cannot
become organizational truth by accident rather than by policy.

**No runtime fetching was built.** The first signal view is designed to eventually answer: which
connected repositories exist, how many pull requests are currently open, recent PR activity,
repository visibility and default branch, and provider freshness. That is GITHUB-2's, and until it
exists the capability reports `NOT-IMPLEMENTED` in the reachability gate — which is true.

---

## 7. Installation connection contract (designed, not executed)

| Concern | Decision |
|---|---|
| Setup URL | a Hebun route receiving GitHub's `installation_id` |
| Trust in that parameter | **NONE.** GitHub says so explicitly. It is a claim, not a fact. |
| Tenant context | resolved **server-side** from the authenticated session. Never client-supplied, never carried in the callback. |
| Installation confirmation | `GET /app/installations/{id}` with a **JWT** — the only thing that turns the claim into a fact |
| Organization identity | `installation.account.id` is the identity; `account.login` is a **label** (an org can be renamed) |
| Account type gate | `account.type` must be `Organization`. A `User` installation is refused. |
| Repository selection gate | `repository_selection` must be `selected`. `all` is **nameable so it can be refused** — a union of one could not express the refusal. |
| Granted permissions | `installation.permissions`, normalized and persisted as GitHub returned them |
| Suspension | `suspended_at` non-null ⇒ the installation grants nothing |
| `connected` requires | provider-confirmed installation identity **and** granted permissions covering `minimumScopes`. Installation presence alone is never enough. |
| Revocation / uninstall | `installation` failure class — the **only** class that may end a connection |

`GitHubInstallationIdentity` is **constructible only from a JWT-authenticated installation read**. It
carries no field a query string could supply. That is the type-level statement of GitHub's warning.

---

## 8. Credential lifecycle — **no tenant credential is persisted**

Stated explicitly, as the brief requires:

| Kind | Owner | Storage |
|---|---|---|
| App id, App private key | **deployment** | env — never a tenant row |
| Installation id, organization identity | **tenant** | `integrations.external_account_id` / `external_account_label` — existing columns |
| Installation access token | **ephemeral** | minted per use, 1-hour lifetime, **never persisted** |

**GITHUB-2 needs no `integration_credentials` row.** Inventing `oauth_access` / `oauth_refresh`
records for a model that has neither would be a false statement about what Hebun holds — the same
error R5.2 rejected when it refused to write `updated_by_type` without `updated_by`.

Consequently: no encryption boundary, no key registry entry, and no refresh lifecycle for this
provider. `authMethod: "github_app"` is what records that in the catalog.

---

## 9. Security boundaries pinned by this phase

| Invariant | Enforcement |
|---|---|
| organization installation only | `accountIdentity: "organization"`; `GITHUB_ORGANIZATION_ACCOUNT_TYPE`; test |
| selected repositories only | `GITHUB_ACCEPTED_REPOSITORY_SELECTION = ["selected"]`; `all` nameable and refused; test |
| least privilege | exhaustive allow list of two read permissions + deny list of 16 names; test |
| no source-code content | path allow list, forbidden fragments, pinned media type, no content field in the view; **5 bite-proofs** |
| no write | `isWritePermission` over every declared set; empty catalog write list ⇒ `writeCapable` structurally false; test |
| no Actions / issues / workflow / administration | on the deny list; no allow-list address; test |
| tenant-isolated installation binding | designed: tenant resolved server-side, never from the callback |
| installation tokens + private key server-side only | no module under `provider-github` imports `node:crypto`, `node:fs`, or performs `fetch`; test |
| provider text is untrusted data | `title` / `authorLogin` documented as untrusted; no `body` field |
| no automatic Knowledge admission | no writer, repository, `@/db` or Knowledge module is importable; test |

---

## 10. Provider template — GitHub, as of this phase

```
Provider:                       github-organization
Authentication:                 GitHub App, organization installation (RS256 JWT → installation token)
External console requirements:  App registration; Setup URL; permissions Metadata:read +
                                Pull requests:read; "Request user authorization during install" OFF;
                                webhook OFF
Required env:                   HEBUN_GITHUB_APP_ID, HEBUN_GITHUB_APP_PRIVATE_KEY
                                (deployment-owned; NOT set in this phase)
Base scopes:                    metadata:read
Capability scopes:              github.repository.activity.read
                                  read:  metadata:read, pull_requests:read
                                  write: (none)
Credential types:               NONE persisted per tenant. Installation id is an identifier.
Refresh model:                  none — the installation token is minted per use, 1 hour
Read capabilities:              github.repository.activity.read
Write capabilities:             none
Runtime seam:                   NONE — GITHUB-2
Tenant binding:                 server-resolved session; the callback carries no tenant authority
Governance boundary:            n/a — no write capability exists
Provider data provenance:       ephemeral read; provider-derived, never Knowledge
Catalog entry:                  DEFERRED to GITHUB-2 — `connectable` needs a verifier
Production caller:              NONE
Acceptance test:                bounded /installation/repositories + bounded /pulls, metadata only
External verification burden:   none known — GitHub Apps need no scope-verification review
Known rate limits:              installation token quota; 429 / secondary limits ⇒ transport class,
                                never auth, never a refresh
Known failure classes:          auth, installation, permission, identity, transport, malformed
Release blocker:                no GitHub App registered; no installation; no runtime seam;
                                pull_requests:read is broader than the product capability and only
                                Hebun's constants hold that line
```

---

## 11. Provider Onboarding states — honest, not forced green

| State | Verdict |
|---|---|
| DESIGNED | **VERIFIED** |
| IMPLEMENTED | **PARTIAL** — contract vocabulary only; no catalog entry, no seam, no transport |
| CONFIGURED | **NO** — no env var exists |
| PROVIDER-CONSOLE-ALIGNED | **NO** — no GitHub App is registered |
| DEPLOYED | **NOT APPLICABLE** — no runtime behaviour changed |
| CONNECTION-ACCEPTED | **NO** |
| CAPABILITY-AVAILABLE | **NO** — the capability is not in the catalog, so no tenant is offered it |
| RUNTIME-REACHABLE | **NO** — the reachability gate asks the catalog, which names no GitHub capability |
| REAL-PROVIDER-EXECUTED | **NO** — GitHub was not called |
| ACCEPTANCE-VERIFIED | **NO** |
| RELEASE-READY | **NO** |

---

## 12. Seeded UI truth defect — recommendation, not a fix

Re-proved at this baseline. `src/features/integrations/mock.ts` has exactly **one** production
consumer: `src/config/sidebar.config.ts`. Through it the Integrations sidebar renders:

| Sidebar item | Destination | Route exists? | Badge |
|---|---|---|---|
| Gmail | `/integrations/gmail` | **NO** | `connected` — fabricated |
| GitHub | `/integrations/github` | **NO** | `pending` — fabricated |
| Supabase | `/integrations/supabase` | **NO** | `connected` — fabricated |
| Vercel | `/integrations/vercel` | **NO** | `error` — fabricated |

Only `/integrations` and `/integrations/google` exist. Four dead destinations, four fabricated
statuses. The mock also carries fabricated `scopes`, `lastSync` and `eventsToday`, which the sidebar
does not currently render.

**Recommendation: option A — a tiny separate truth-correction commit, before GITHUB-2.**

Not option B, for two reasons:

1. **The real authority does not replace this seam.** The real GitHub provider lives in the catalog
   and surfaces through `/integrations`; nothing in it touches `sidebar.config.ts`. Left alone, the
   sidebar would keep asserting "GitHub — pending" **next to a real GitHub connection**, which is
   worse than today: a fabricated status beside a real one reads as authoritative.
2. **Three of the four are not GitHub's to fix.** Gmail, Supabase and Vercel would be swept in as
   collateral of a GitHub commit. Bundling them is scope smuggling; separating them is one small
   reviewable change with its own reason.

**Not done in this commit**, per the brief.

---

## 13. Tests and bite-proofs

`tests/github1-provider-contract/contract.ts` — 7 invariant groups (see §2, §3, §4, §5, §6, §9).
`tests/github1-provider-contract/bite-proofs.ts` — **11 mutations bit, 1 correct change accepted.**

| # | Mutation | Guard proved |
|---|---|---|
| M1 | real provider takes the simulation's bare key | World A / World B key separation |
| M2 | simulation imports the connectable catalog | the import firewall, both directions |
| M3 | `contents:read` added to the requested set | the permission deny list |
| M4 | capability declares a write scope | write is structurally unreachable |
| M5 | coverage compares permission names, ignoring level | a granted write cannot launder into a read |
| M6 | `/pulls/{pull_number}/files` added to the allow list | the source-content firewall |
| M7 | `/contents/{path}` added to the allow list | the source-content firewall |
| M8 | pinned media type becomes `vnd.github.diff` | the media-type firewall |
| M9 | `patch` field added to `GitHubPullRequestView` | the shape has no hole for content |
| M10 | unrecognized permission level normalized anyway | hostile provider input |
| M11 | `for...in` walks the prototype chain | inherited permissions stay invisible |

Accepted: `MAX_REPOSITORIES_PER_PAGE = 50` → `5e1` — identical value, and the suite accepts it, so
the assertions test the rule and not the spelling.

### A guard that could not be made to bite was deleted

`normalizeGrantedPermissions` originally re-checked `Object.hasOwn` inside a loop already driven by
`Object.keys`. After `Object.keys` that check **can never be false**, so no mutation could make it
bite. A line whose removal changes nothing is documentation wearing a guard's clothes. It was
removed, and `Object.keys` — the mechanism that actually does the work — is what M11 now attacks.

---

## 14. Blockers and next Director action

**Blockers, in order:**

1. **No GitHub App exists.** Every later state depends on it. This is an external console act and
   belongs to the Director.
2. **`pull_requests:read` is broader than the released capability.** Approved by the Director, and
   recorded as the weakest link in this phase.
3. **No catalog entry and no runtime seam.** Both land in GITHUB-2, together, because
   `connectable` is only truthful once the verifier exists.

**Exact external configuration required before GITHUB-2:**

```
GitHub App name:          (Director's choice)
Homepage URL:             https://www.hebuntech.com
Callback URL:             (none — user authorization is NOT used)
"Request user authorization (OAuth) during installation":  OFF
Setup URL:                <deployment origin>/api/integrations/github/setup
"Redirect on update":     ON
Webhook:                  OFF   (no webhook support in this release)
Repository permissions:   Metadata          → Read-only
                          Pull requests     → Read-only
                          ALL OTHERS        → No access
Organization permissions: none
Account permissions:      none
Where can this App be installed:  Any account  (organizations only in practice)
Private key:              generate; store as HEBUN_GITHUB_APP_PRIVATE_KEY (PEM, deployment env)
App ID:                   store as HEBUN_GITHUB_APP_ID
```

Do **not** enable Contents, Issues, Actions, Workflows, Checks, Statuses, Deployments,
Administration or Members. Each is on the repository's deny list and would fail a test.

**Next Director action, recommended order:**

1. Approve or reject the tiny truth-correction commit for the four seeded sidebar entries (§12).
2. Register the GitHub App with exactly the configuration above, and report the App ID.
3. Then GITHUB-2 builds, in one commit: the setup route, the JWT/installation-token authority,
   the confirmation read, the first runtime seam, **and** the catalog entry — the entry last,
   because it is only truthful once the verifier above it exists.
