# GITHUB-4 — Repository Activity Runtime: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `4ff1ac2e48a7686cd4789c6ab0d9dd0c8225a051`.
**Baseline of this record:** `4ff1ac2e48a7686cd4789c6ab0d9dd0c8225a051` (`origin/main`, 0 ahead / 0 behind).
**Runs against:** `docs/product-vision/runtime/hebun-provider-onboarding-standard.md` (Stage T).
**Designed by:** `docs/product-vision/runtime/hebun-github-4-repository-activity-architecture.md`.
**Predecessors:** `hebun-github-1-provider-contract-closure.md`,
`hebun-github-2-installation-authority-closure.md`.

---

## 1. Released implementation identity

`github.repository.activity.read` had been DECLARED, PERMISSION-BACKED and AVAILABLE for two phases
while the acceptance reachability gate measured **zero** runtime seams. `4ff1ac2` closes that gap.

**Scope: 11 files, +2131 / −46.** Five new modules and files, six modified.

| File | What it is |
|---|---|
| `provider-github/github-transport.server.ts` | the runtime firewall plus three new typed operations |
| `provider-github/github-authorized-call.server.ts` | **new** — ephemeral installation authorization |
| `provider-github/discover-installation-repositories.server.ts` | **new** — the live repository seam |
| `provider-github/read-repository-pull-requests.server.ts` | **new** — the bounded pull-request seam |
| `provider-github/contracts.ts` | comment correction only — the declared path list is the installation-authenticated half of the runtime table |
| `app/(dashboard)/integrations/github/page.tsx` | the production consumer that makes the seam reachable |
| `tests/github4-repository-activity/{capability, bite-proofs}.ts` | **new** — the phase's own suites |
| `tests/github1-provider-contract/contract.ts` | released-pin repair (§9) |
| `tests/github2-installation-authority/{installation-authority, bite-proofs}.ts` | released-pin repairs (§9) |

**Relationship to the architecture record.** That record was written and released *before* any of
this existed, and it decided the shape: Q1 provider-owned ephemeral authorization, no persistence,
a runtime-enforced firewall, two composable seams, and the ten questions a future phase must answer.
The implementation follows it without redesign. This closure carries what only execution could
produce — the acceptance evidence, the released commit, the deployment SHA, the repaired pins, and
the resolution of a limitation the previous closure recorded as unavailable.

---

## 2. Authority boundaries

Nothing in this phase became an authority. The new runtime passes **through** the existing ones.

| Authority | Owns | May decide | May execute |
|---|---|---|---|
| **Integration authority** | connection truth: lifecycle, persisted connection, installation identity, granted permissions, health | whether a connection exists and what it is | no provider call |
| **Capability availability** | lifecycle + health + granted scopes → a per-tenant verdict | **whether execution may proceed at all** | nothing |
| **GitHub provider runtime** | orchestration, ephemeral token acquisition, normalization | which approved operation to run for this tenant | yes, and only through the transport |
| **GitHub transport** | one outbound boundary and its operation firewall | **nothing** | an approved operation, or refuses |
| **UI consumer** | rendering | nothing | nothing |

- The seams contain **no scope comparison**. They read the authority's verdict and honour it.
- The transport **refuses operations; it does not authorize tenants.** It answers "may this operation
  exist?", never "may this tenant spend the capability?".
- **No second connection authority and no second credential authority exists.** The provider modules
  are forbidden the database handle outright, and a released test asserts none of them names
  `integration-credentials`.
- A provider read **writes no lifecycle**: a 429, a timeout or a refused mint leaves the tenant's
  connection exactly as it was.

---

## 3. Runtime firewall

Before this phase, the declared allow list had **zero runtime callers**; the only thing preventing a
second address was that no second address existed. Incidental enforcement stops being enforcement at
the second call, and this phase adds three.

`GITHUB_TRANSPORT_OPERATIONS` is now consulted before every request, keyed on four dimensions
together, **deny by default**:

| METHOD | PATH TEMPLATE | AUTH CLASS | ACCEPT |
|---|---|---|---|
| `GET` | `/app/installations/{installation_id}` | **APP** | `application/vnd.github+json` |
| `POST` | `/app/installations/{installation_id}/access_tokens` | **APP** | `application/vnd.github+json` |
| `GET` | `/installation/repositories` | **INSTALLATION** | `application/vnd.github+json` |
| `GET` | `/repos/{owner}/{repo}/pulls` | **INSTALLATION** | `application/vnd.github+json` |

Verified by executing the released module at this commit:

```
operation_count 4
deny_contents_path   false      deny_pr_files_path false
deny_wrong_auth      false      deny_write_method  false
deny_diff_media      false      allow_verification true
```

- **No generic proxy.** There is no `githubRequest(path)` and no URL parameter in the public API;
  every exported function names one operation, and all of them funnel through one private issuer.
- **No write endpoint.** The only non-GET is the token mint, which creates a credential on GitHub's
  side and changes nothing an organization owns.
- **No source, content, diff or PR-files endpoint.** Neither an address nor a media type for one
  exists: `pull_requests:read` would permit `/pulls/{n}/files` and a `diff` Accept header, and the
  firewall refuses both — the media type is part of the key precisely because the permission is
  identical and only the header differs.
- **The authentication class is part of an operation's identity.** Presenting an App JWT where an
  installation token belongs is its own refusal. That split is what makes "the App may read an
  installation, but may not read a repository" a mechanism rather than a habit.
- The **existing installation verification** now passes through this same table instead of remaining
  an undeclared exception.

---

## 4. Installation-token lifecycle

```
TenantContext (server-resolved)
  → capability availability verdict
  → authoritative connection
  → installation identity from that connection
  → App-authenticated mint, narrowed
  → callback-scoped installation token
  → installation-authenticated read
  → token discarded with the frame
```

| Property | State | How it is held |
|---|---|---|
| Minted server-side | YES | server-only module, `assertServerOnly()` |
| Only after authoritative approval | YES | availability resolved at line 150, mint at line 189 |
| Narrowed | `metadata: read`, `pull_requests: read` | requested in the mint body |
| Callback-scoped | YES | a local binding of one frame |
| **Persisted** | **NO** | no writer, no credential kind that could hold one |
| **Cached** | **NO** | comment-stripped source contains no `cache`, `memo` or `globalThis` |
| **Returned** | **NO** | the function is generic over the callback's own result — a caller cannot ask it for a token |
| **Logged** | **NO** | no `console.*` anywhere in the token path |
| Discarded after use | YES | unreachable once the callback settles |

A failed mint returns a classified reason and **never** the response body, because that body is where
the token lives.

---

## 5. Persistence truth

Read from production after the real reads:

| Check | Value |
|---|---|
| GitHub credential rows | **0** |
| All credential rows | 6, every one Google's |
| Public tables | **59** — unchanged |
| Schema / migration files in `4ff1ac2` | **0** |
| Repository persistence | none |
| Pull-request persistence | none |
| Token persistence | none |
| Connection row after real reads | `connected` / `healthy` / `version 3` / `updated_at 2026-08-24T16:47:15.300Z` — **byte-identical to before** |

**Provider reads do not mutate the connection lifecycle.** The seams hold no connection writer, and
a released test asserts they name none.

---

## 6. Repository provenance

- **Selected repositories are fetched live from GitHub on every read.** No repository table, no cache
  row, no durable list. An installation's selection changes on GitHub's side without telling Hebun,
  so a stored list would keep claiming a repository the organization had removed.
- **`repositoryId` — GitHub's immutable numeric id — is the authoritative provider identity for the
  read.**
- **`owner`, `name` and `full_name` are addressing and display values.** They change on a rename and
  again on a transfer. A released test proves a renamed repository keeps its identity and changes
  only its address.
- **A caller-supplied repository id remains a CLAIM** until it is matched against the live
  installation listing. The owner and name used to address the pull-request request come from that
  matched entry — never from the caller, for which no parameter exists.
- **Provider observations are not promoted into organizational Knowledge.** Nothing this seam returns
  passes through an admission authority, because nothing is admitted.

---

## 7. Real-provider acceptance

Executed through the released seams against installation `156248772`. No `curl`, no `gh api`, no
ad-hoc reimplementation of provider behaviour.

| # | Condition | Evidence |
|---|---|---|
| 1 | authoritative tenant resolved | Tenant Zero `f625b683-3be5-40eb-93a4-53fc56ab38c9` |
| 2 | authoritative GitHub connection resolved | via the integration authority listing |
| 3 | connection verified usable | `connected` / `healthy` |
| 4 | required granted permissions present | availability permitted the spend |
| 5 | token minted through the legitimate authority | `withGitHubInstallationToken` |
| 6 | token not persisted or leaked | credential rows still 0; never returned upward |
| 7 | real `/installation/repositories` reached | installation-authenticated |
| 8 | selected repositories obtained | one repository, `total_count: 1` |
| 9 | repository identity from the provider response | `repositoryId 1300480452` |
| 10 | requested repository proven inside the installation | matched on the numeric id |
| 11 | real permitted PR endpoint reached | `/repos/Hebun-AI/hebun-ai-recovered/pulls` |
| 12 | response normalized | declared shapes only |
| 13 | provenance retained | provider-derived, live, unstored |
| 14 | no forbidden content endpoint reached | only the four approved operations issued |
| 15 | no write endpoint reachable | none exists |

### The previously unavailable identity is RESOLVED THROUGH THE RELEASED RUNTIME

`hebun-github-2-installation-authority-closure.md` §7 recorded
`SELECTED REPOSITORY IDENTITY: UNAVAILABLE THROUGH THE RELEASED RUNTIME SEAM`. That was true of the
runtime as it stood. It is no longer:

```json
{ "repositoryId": 1300480452,
  "fullName": "Hebun-AI/hebun-ai-recovered",
  "defaultBranch": "main",
  "isPrivate": false, "isArchived": false,
  "updatedAt": "2026-08-24T18:15:03Z" }
```

The live provider result reported **one** selected repository. Hebun did not remember this from a
screen; it asked GitHub and GitHub answered. The provider-derived id was compared to the id known
from GitHub's own API **only after the live result existed**, and they match.

**Open pull requests: `[]`.**

That empty list is a **successful real provider read that returned zero open pull requests.** It is
not an unavailable read, not a failed read, and not a refusal. A failure would have returned a
classified reason instead — and a repository outside the installation did exactly that, refusing
`repository-outside-installation` without issuing a pull-request request at all.

---

## 8. Permission narrowing acceptance

| Stage | State |
|---|---|
| DESIGNED | **YES** — the architecture record's intended posture, explicitly marked unverified |
| IMPLEMENTED | **YES** — requested in the mint body |
| REQUESTED | `{ metadata: "read", pull_requests: "read" }` |
| **PROVIDER-ACCEPTED** | **YES** — GitHub returned exactly `{ metadata: "read", pull_requests: "read" }` |

No broader permission was requested, and none was accepted. A leaked token is therefore bounded by
the capability rather than by the whole installation. No fallback to a wider token exists — the
architecture record required the phase to stop and report rather than silently widen, and it never
came to that.

---

## 9. Released-pin repairs

Two pins from earlier phases were falsified by this one. Both were repaired to preserve their
original security invariant, and both ended up **stricter** than the sentence they replaced.

### GITHUB-1 — "only the orchestrator composes the connection lifecycle"

**Was:** every non-orchestrator provider module was forbidden to import `@/db`, `drizzle-orm` *or*
`integration-authority`.

**Why it broke:** GITHUB-4's seams must **ask** the capability authority whether a tenant may spend
the capability. Refusing them the import would not have stopped them deciding — it would have forced
them to decide for themselves, which is the two-interpreters bug the authority exists to prevent.

**Now:** the question is no longer *who may import the authority* but *who may **write** through it*.
Five writer symbols (`createConnection`, `recordVerifiedInstallation`, `recordVerificationFailure`,
`disconnectConnection`, `markConnection`) are forbidden in every module but the orchestrator, and
`@/db` and `drizzle-orm` remain forbidden outright — so a reader still cannot reach past the seam.
The invariant is unchanged: one writer, and it writes through the authority.

> A type-only `import type { ControlPlaneDatabase } from "@/db/client.server"` also tripped this pin,
> because the check reads text. Rather than relax it, the authorized-call module borrows
> `CapabilityAvailabilityDeps["getDb"]` from the authority that owns the handle — a provider module
> has no business naming the database type.

### GITHUB-2 — "the installation transport has no data address" and "the transport only reads"

**Was:** the transport could name no `/pulls` and no `access_tokens`, and no verb but `GET`.

**Why it broke:** that was the truth of a phase that connected and read nothing. GITHUB-4 gives the
capability a runtime, so both now exist — deliberately, behind the firewall in §3.

**Now:** everything else on that list stays forbidden and is the part that matters — `/contents`,
`/commits`, `/compare`, `/git/`, `/issues`, `/actions`, archives, and every diff/patch/raw media
type. `/pulls/{pull_number}` is forbidden explicitly, so the single-pull-request address that carries
a diff cannot be spelled. The verb rule became **at most one POST, and it must be the token mint** —
`PUT`, `PATCH` and `DELETE` remain absent. The invariant is unchanged: no source content, and nothing
that mutates an organization's repositories.

The `access_tokens` name also left the "this provider stores no tenant secret" list, and that claim is
untouched: the four remaining names (`integration-credentials`, `secret-encryption`, `oauth_access`,
`oauth_refresh`) are what enforce it, and production still holds zero GitHub credential rows.

---

## 10. Validation evidence

| Check | Result |
|---|---|
| `github4-repository-activity/capability` | **PASS** |
| `github4-repository-activity/bite-proofs` | **17 mutations bit, 1 correct change accepted** |
| `github1-provider-contract/contract` + bite-proofs | **PASS** — 11 bit, 1 accepted |
| `github2-installation-authority` + bite-proofs | **PASS** — 12 bit, 1 accepted |
| `provider-onboarding/acceptance-reachability` | **REACHABLE (3 seam)** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 — **0 errors**, 14 warnings (unchanged baseline) |
| `npm run build` | exit 0 |

Isolated full suite, run in a clean worktree at the previous baseline plus only this phase's files:

```
Test summary: 468 passed, 1 failed, 469 total.
FAILED tests/int3-google-connection/bite-proofs.ts (exit 1)
```

**The full suite is not green, and this record does not say it is.** The single failure is the known
**pre-existing INT-3 M9** reason-matching defect, reproduced 3/3 on parent `8c2bfaf` before any
GitHub work existed and untouched by this phase. **Zero failures were introduced.** The total rose
467 → 469 because this phase adds two test files.

The reachability gate was **not modified**. It flipped because the import graph changed.

---

## 11. Production release evidence

| State | Evidence |
|---|---|
| **PUSH ACCEPTED** | `c9bb8af..4ff1ac2  main -> main`, fast-forward, no force; `git ls-remote` confirms remote `main` = `4ff1ac2e…`; the remote commit carries exactly 11 files, +2131 / −46 |
| **DEPLOYMENT CREATED** | `dpl_A6LuVWkEGkHaZnb5UHLqmQmQt2Cq`, created automatically by the push, `githubOrg: Hebun-AI` |
| **DEPLOYMENT READY** | observed `BUILDING` → **READY** |
| **PRODUCTION ALIAS SERVING** | `www.hebuntech.com` resolves to `dpl_A6LuVWkEGkHaZnb5UHLqmQmQt2Cq`, whose `githubCommitSha` is `4ff1ac2e48a7686cd4789c6ab0d9dd0c8225a051` |

Live probes: `/` → 200; `/integrations`, `/integrations/github` and `/api/integrations/github/start`
→ 307 → `/login`. The authentication boundary was probed, never bypassed.

**The authenticated repository panel was NOT visually verified.** Every integration surface sits
behind login and no authenticated production session was used. What is proven is that the seams
executed against real GitHub locally, and that the deployment serving production carries this exact
commit. A READY deployment is not a screenshot, and this record does not treat it as one.

---

## 12. Final capability truth ledger

| State | Verdict | Evidence |
|---|---|---|
| DESIGNED | **YES** | `hebun-github-4-repository-activity-architecture.md` |
| IMPLEMENTED | **YES** | `4ff1ac2`, 11 files |
| CONFIGURED | **YES** | five production variables, unchanged by this phase |
| AUTHORIZED | **YES** | availability permits; eight refusal paths proved, each minting nothing |
| RUNTIME-REACHABLE | **YES** | `REACHABLE (3 seam)`, measured, gate unmodified |
| EXECUTED | **YES** | real GitHub, through the released seams |
| SUCCESSFUL | **YES** | normalized, bounded, no forbidden access |
| REAL-PROVIDER-ACCEPTED | **YES** | all fifteen conditions, §7 |
| RELEASED | **YES** | commit exists, remote main contains it, deployment READY, alias serves it |
| AUTHENTICATED UI VISUALLY VERIFIED | **NO** | never inspected behind login |

---

## 13. Remaining debt

Separate from capability completeness. Each is a known limitation of what shipped, not a missing
feature.

1. **The firewall keys on the path TEMPLATE, not the concrete URL.** Segments are built inside the
   transport from constants and validated values, so no caller input crosses the boundary — but a
   source-level edit that changed a concrete path while keeping the descriptor would pass the
   firewall. GITHUB-2's M11 catches that behaviourally by asserting the observed URL, which is why
   that mutation was repaired rather than dropped.
2. **One bounded page only.** 50 repositories and 50 open pull requests, below GitHub's own maximum.
   A second page is a decision about how much of an organization Hebun holds in memory, and this
   release does not make it. Truncation is stated, never hidden.
3. **The authenticated production surface has never been visually verified** — true for
   `/integrations/github` and for the Platform → Integrations card.
4. **INT-3 M9** — unrelated pre-existing debt, in a Google suite, untouched by every GitHub phase.

---

## 14. Closure boundary

**The released read-only GitHub integration is COMPLETE for its declared
`github.repository.activity.read` capability.** An organization installs, Hebun verifies the
installation, names the repositories that installation actually covers, and reads bounded open
pull-request metadata — with zero persistence, zero stored secrets, zero write authority and no path
to source content.

**This does NOT mean GitHub development is universally finished.** Issues, Actions, webhooks, commit
metadata, source contents and every write capability are **optional future product capabilities**,
outside this closure and outside this capability's declared meaning. They are not debt; nothing
promised them.

**No GITHUB-5 is opened by this record.**

---

## 15. Correction to the GITHUB-2 closure

`hebun-github-2-installation-authority-closure.md` §7 states that selected-repository identity is
unavailable. That was true when written and is the historical record of that phase, so it is not
rewritten — a scoped note now distinguishes what was true **at GITHUB-2 closure** from what the
released runtime can do **after GITHUB-4**, and points here. No other claim in that document is
altered.
