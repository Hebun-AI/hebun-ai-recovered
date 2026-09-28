# YOUTUBE-WRITE-1 · Authenticated YouTube Channel Identity · Closure

YOUTUBE-WRITE-1 answers one question before any YouTube write is designed: **which YouTube channel
does this organization's Google grant stand for, as YouTube itself answers it.** It adds one read
capability to the existing Google OAuth connection authority and nothing else. It uploads nothing,
publishes nothing, binds nothing and persists nothing.

```
A GOOGLE ACCOUNT  != A YOUTUBE CHANNEL
A CHANNEL SEEN    != A CHANNEL BOUND
IDENTITY READ     != UPLOAD / PUBLISH
```

| Item | Value |
|---|---|
| Implementation | `ba64d4a0` (fast-forward from `515e559e`) |
| Deployment | `dpl_9PMJgzcsg2mXrRsZHELCn3MuHg7S` READY on `www.hebuntech.com` |
| Provider | Google / YouTube Data API v3 (`channels.list?mine=true`, `id` + `snippet.title` only) |
| Capability | `google.youtube.channel.identity.read` (read `[youtube.readonly]`, write `[]`) |
| Scope | `https://www.googleapis.com/auth/youtube.readonly` |
| Authority reused | `google-workspace` connection, capability availability, Google OAuth/token authority, Google transport boundary |
| Reader | `readAuthenticatedYouTubeChannels(tenant)` → `no-channel` / `one-channel` / `multiple-channels`; never chooses |
| Schema | unchanged; **no migration; ledger 67** |
| Production acceptance | 2026-09-28 |

## 1 · Truth semantics

```
YOUTUBE.READONLY GRANTED ON TRH CONNECTION          VERIFIED  (production DB, read-only)
CAPABILITY google.youtube.channel.identity.read     AVAILABLE (derived from production rows by the seam's rule)
REAL PROVIDER IDENTITY READ                         VERIFIED  (Director-executed, one click, production UI)
RESULT                                              one-channel · Hebun Tech · UCqTzRYJBwFsITzxFuqx6YQw
CHANNEL BINDING / PERSISTENCE                       NONE (by construction)
UPLOAD / videos.insert / PUBLISH                    NOT AVAILABLE
PRODUCTION MUTATION BY THE ACCEPTANCE VERIFICATION  NONE
```

**YOUTUBE-WRITE-1: CLOSED.**

## 2 · Production acceptance

**Director-controlled consent (2026-09-28).** The Director added `youtube.readonly` to the Google Auth
Platform Data Access of the existing Hebun Google Cloud project, opened the scope's own opt-in on
`/integrations/google`, selected `hebuntech@gmail.com` (not the Turkish Rug House Gmail account),
accepted Google's unverified-app warning for Hebun's own application, granted the read-only
permission and returned to `/integrations/google?outcome=connected`. The page listed
`youtube.readonly` among the granted scopes.

**Director-executed read.** One click on "Read YouTube channel identity". YouTube returned exactly
one channel:

```
status   one-channel
title    Hebun Tech
id       UCqTzRYJBwFsITzxFuqx6YQw
```

**Authoritative production read (SELECT only, `BEGIN TRANSACTION READ ONLY`, `transaction_read_only =
on`, ROLLBACK; allowlisted metadata columns only, no credential value selected).** Run by the
Director from the primary tree with the ceremony env loaded through `node --env-file`.

| Fact | Production row |
|---|---|
| TRH tenant | `9947c78e-2080-4331-81c6-456cb4be7a96` |
| Integration | `9314f5da-373c-41ca-b903-e047ac505864`, `provider_key = google-workspace` |
| State | `connection_state = connected`, `health = healthy`, `revoked_at = null`, `failure_reason = null` |
| Account | `external_account_label = hebuntech@gmail.com` (`external_account_id 114884615390589849256`) |
| Scopes | `openid`, `userinfo.email`, `userinfo.profile`, **`youtube.readonly`** |
| Consent written | `updated_at = last_verified_at = 2026-09-28T06:55:08.235Z` |
| Live credentials | `oauth_access 9de85e83` (created 06:55:08.431Z, expires 07:55:07Z) · `oauth_refresh 80240dc3` (06:55:08.499Z); the prior pair was revoked at the same instant by the consent |

**Capability availability.** `getCapabilityAvailability` marks a source `readAvailable` when the
connection is `connected`, its health is usable and its granted scopes cover the capability's read
scopes. All three hold for `9314f5da` → `google.youtube.channel.identity.read` is **AVAILABLE** for
TRH. The seam itself was not invoked from outside the application: the result is derived from the
production rows by that rule.

**Not re-executed on purpose.** The provider read was not repeated for this verification: an
expired access token is replaced through `withGoogleAccessToken`, which writes credential rows. The
production rows show no credential created after the consent instant, so the Director's click spent
the fresh consent token and caused no refresh.

**Brand Account / multi-channel ambiguity (WRITE-0 open question).** Resolved **for this
connection**: YouTube returned one channel for `hebuntech@gmail.com`. It is not resolved in general —
another Google account may still return several, and the reader still refuses to choose.

## 3 · A consequence recorded, not fixed

**TRH's `drive.file` grant was replaced by this consent.** Before acceptance the TRH connection held
`openid / email / profile / drive.file`; after it holds `openid / email / profile / youtube.readonly`.
This is the existing, documented connection doctrine, not a WRITE-1 defect: the start route sends
`include_granted_scopes=false` and requests base identity scopes + the ONE capability being upgraded
(`GOOGLE_CAPABILITY_SCOPE_REQUESTS`: "They are never merged"). Consequence: for TRH,
`google.drive.file.content.read` (Picker / MEDIA-SUPPLIED) now reads as a scope gap until `drive.file` is
re-granted, and re-granting it would in turn drop `youtube.readonly`. Holding both at once needs a
separate, explicitly approved change to the upgrade doctrine. Nothing was changed here.

Tenant Zero's connection (`4b509d2a`, same Google account) is untouched and still holds `drive.file`.

## 4 · What this does NOT make available

- `youtube.upload`, `youtube`, `youtube.force-ssl` — not declared, not requested anywhere
- `videos.insert`, resumable upload, video byte transfer, processing observation
- metadata mutation of any video or channel
- persistent channel binding to a tenant
- YouTube publishing, Governance authorization for publishing, external-send execution
- any Heby-originated or autonomous YouTube action

The API-key `youtube` provider (public read, CGO-5 / YT-SOC) is unchanged.

## 5 · Next boundary

**YOUTUBE-WRITE-2 — NOT STARTED.** Planned (WRITE-0) as the publish contract: Content Package video
+ metadata authority + channel inside a digest-bound payload. Not authorized by this record.

Known unrelated regression carried, not fixed: `int5a`, `int5b1`, `int5c` firewall tests red since
HEBY-MEDIA-1 (`3328a7f0`).
