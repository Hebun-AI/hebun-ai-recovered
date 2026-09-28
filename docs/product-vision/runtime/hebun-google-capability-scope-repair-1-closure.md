# GOOGLE-CAPABILITY-SCOPE-REPAIR-1 · One Google Grant per Capability Family · Closure

Granting one Google capability silently removed another. This phase repaired that inside the
existing Google connection authority: Drive and YouTube now live on separate connections of the same
Integration authority, each with its own grant, credential, observed scopes and availability.

```
ONE CONNECTION       == ONE GOOGLE GRANT
A REQUESTED SCOPE    != A GRANTED SCOPE
A TENANT             != ONE GOOGLE ACCOUNT
```

| Item | Value |
|---|---|
| Commits | `bda53bc9` (same-connection composition, superseded in part) · `940a5370` (separate `google-youtube` connection) |
| Deployment | `940a5370` → `dpl_6ABcUS6A6Rrez9tEKjrcvUb4Jibw` READY |
| Schema | unchanged; **no migration; ledger 67** |
| Production acceptance | 2026-09-28 |

## 1 · The defect

Production, TRH, YOUTUBE-WRITE-1: the TRH `google-workspace` connection held identity + `drive.file`.
Granting `google.youtube.channel.identity.read` recorded identity + `youtube.readonly`, and
`google.drive.file.content.read` went to a scope gap.

**Root cause.** The start route asked Google for identity + the ONE capability being upgraded, with
`include_granted_scopes=false`. Google issued a token for exactly that request, and the callback —
correctly — recorded Google's statement of the grant as the connection's scopes. One connection holds
one grant, so the new grant replaced the old one.

## 2 · The first repair, and the provider refusal

`bda53bc9` composed the request server-side from identity + the connection's last observed
capability scopes + the new capability. The Director's production attempt was refused by Google's
authorization endpoint **before consent**:

```
400 invalid_request — "This request contains scopes that cannot be requested together:
[https://www.googleapis.com/auth/youtube.readonly, https://www.googleapis.com/auth/drive.file]"
```

This is a **provider-enforced scope incompatibility observed in production. Its reason is not
documented** in Google's OAuth, scope or YouTube OAuth documentation. Only the refusal is recorded
here, not an explanation. The refusal was fail-closed: no row, credential or grant changed.

## 3 · The architecture (`940a5370`)

- `google-youtube` — a second connection **definition** under the SAME Integration authority,
  credential authority, OAuth client, start/callback routes and Google verifier. Not a second
  authority. `google.youtube.channel.identity.read` is declared there only; future YouTube
  capabilities (upload included, when a phase builds one) belong to it.
- `google-workspace` keeps the Drive family (`drive.metadata.readonly`, `drive.readonly`,
  `drive.file`).
- `GOOGLE_CAPABILITY_CONNECTION` — a closed map, capability → connection. The client still sends only
  a capability name; no scope is ever read from a request.
- `composeGoogleAuthorizationScopes` — identity ∪ (THAT connection's last observed grant ∩ its own
  family's scopes) ∪ the one capability named. It **throws** on any other family's scope, so no request
  can carry `drive.file` with `youtube.readonly`. Same-family composition from `bda53bc9` stays.
- `include_granted_scopes=false`, unchanged on purpose. Google's combined authorization covers every
  scope a user granted the API project, per Google account; one account (`hebuntech@gmail.com`) is
  connected to two organizations, so that union would carry one tenant's grants into the other's.

**Revocation semantics.** The callback records only Google's answer (`grantedScopes`). Composition
reads the LAST observation only, so a scope revoked or declined and then observed absent is not asked
for again; nothing is unioned with history. Revoking one connection affects only its own
capabilities.

**Tenant model (Director decision).** Isolation is per CONNECTION, not "one Google account per
tenant". A tenant may hold `google-workspace` with account A and `google-youtube` with account B;
the same Google account may appear in several tenants. The unique index
`(tenant_id, provider_key, external_account_id)` permits exactly this.

## 4 · Production acceptance

Director-controlled consents, each requesting identity + one family only (no provider refusal):
TRH Drive re-grant (07:50:27Z), Hebun AI YouTube (08:14:29Z), TRH YouTube (08:34:53Z, completing the
draft `c5e8637d`). One real channel identity read per YouTube connection, Director-executed:

- Hebun AI → `one-channel` · Hebun Tech · `UCqTzRYJBwFsITzxFuqx6YQw`
- Turkish Rug House → `one-channel` · Turkish Rug House · `UC5Yf5U_YOKR0K38tWF82kjA`

Authoritative read-only verification (Director-run, `BEGIN TRANSACTION READ ONLY`,
`transaction_read_only = on`, ROLLBACK, safe-column allowlist, credentials counted by kind only):

| Tenant | Connection | Google account | Observed scopes | Capability | Status |
|---|---|---|---|---|---|
| Hebun AI `f625b683` | `google-workspace` `4b509d2a` | `hebuntech@gmail.com` | identity + `drive.file` | `google.drive.file.content.read` | **AVAILABLE** (unchanged since 2026-08-30) |
| Hebun AI | `google-youtube` `17ae94ea` | `hebuntech@gmail.com` | identity + `youtube.readonly` | `google.youtube.channel.identity.read` | **AVAILABLE** |
| Turkish Rug House `9947c78e` | `google-workspace` `9314f5da` | `hebuntech@gmail.com` (Director: intentional central management) | identity + `drive.file` | `google.drive.file.content.read` | **AVAILABLE** (unchanged since 07:50:27Z) |
| Turkish Rug House | `google-youtube` `c5e8637d` | `turkishrughouseist@gmail.com` | identity + `youtube.readonly` | `google.youtube.channel.identity.read` | **AVAILABLE** |

All four connected + healthy, one live access and one live refresh credential each. No connection
carries both families. TRH's YouTube read matches TRH's independently observed public channel
(`UC5Yf5U_YOKR0K38tWF82kjA`, API-key provider, CGO-5).

```
DRIVE + YOUTUBE ON ONE TENANT, NO SCOPE LOSS        VERIFIED (both tenants)
CROSS-FAMILY AUTHORIZATION REQUEST                  IMPOSSIBLE BY CONSTRUCTION (composer throws)
CROSS-TENANT SCOPE LEAKAGE                          NONE (per-connection composition, include_granted_scopes=false)
CHANNEL BINDING PERSISTENCE / UPLOAD / PUBLISH      NOT AVAILABLE
```

**GOOGLE-CAPABILITY-SCOPE-REPAIR-1: CLOSED.**

## 5 · Known limitations, carried and not fixed

- **Credential before account check.** The callback stores the new credential before the connection
  record refuses an `account-changed` grant. A consent with a different Google account on an
  already-bound connection is refused, but its credential has already replaced the connection's.
  Not reached by this acceptance (both YouTube rows were unbound). Separate task.
- **Concurrent same-family upgrades in two browsers.** The last callback wins. One browser cannot race
  itself (single state cookie). Recovery is another upgrade, which now composes.
- **Draft on start.** Opening a grant link creates a `draft` connection before consent; an abandoned
  consent leaves it, and the next grant reuses it.
- Unrelated: `int5a`, `int5b1`, `int5c` firewall tests red since HEBY-MEDIA-1 (`3328a7f0`).

## 6 · Next boundary

**YOUTUBE-WRITE-2 — NOT STARTED.** It may now target a real, correctly bound YouTube connection per
tenant. Not authorized by this record.
