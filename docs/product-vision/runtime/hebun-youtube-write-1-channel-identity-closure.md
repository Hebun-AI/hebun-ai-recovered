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

> **AMENDED 2026-09-28 — read §6 before §1–§3.** The acceptance below is a real provider acceptance
> of the READER: OAuth, the capability gate and a real `channels.list?mine=true` all worked. It was
> performed while the active Hebun tenant was **Turkish Rug House**, with Hebun's own account
> (`hebuntech@gmail.com`), and returned **Hebun's** channel. It therefore never proved a correct
> tenant→channel binding. The historical facts in §1–§3 are left exactly as recorded; §6 states what
> they prove, what they do not, and the final organizational acceptance.

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

## 6 · Organizational correction (amended 2026-09-28)

**What the original acceptance proves — unchanged, and real.** The OAuth grant, the capability gate,
the credential spend and a real YouTube `channels.list?mine=true` worked in production; YouTube
returned `one-channel` · Hebun Tech · `UCqTzRYJBwFsITzxFuqx6YQw` for `hebuntech@gmail.com`. That is a
**real provider identity observation**. It is not retracted and was not fake or failed.

**What it does not prove.** The read ran while the active Hebun tenant was Turkish Rug House, on
TRH's `google-workspace` connection (`9314f5da`), with Hebun's own central account. Hebun Tech is
Hebun's channel, not TRH's: TRH's own public YouTube observation (API-key provider, CGO-5) names a
different channel, `UC5Yf5U_YOKR0K38tWF82kjA` "Turkish Rug House" `@turkishrughouse`. So §2's
observation is **a real provider read performed under the wrong organizational context**, and the
sentences "YouTube names one channel … for TRH's grant" and "Brand Account ambiguity resolved for
this connection" describe the reader, not TRH's channel. Nothing was persisted or bound, so no stored
binding was ever wrong.

**What changed underneath it.** Google refused `drive.file` and `youtube.readonly` in one
authorization request (production, `400 invalid_request`, "scopes that cannot be requested together";
the reason is not documented by Google). GOOGLE-CAPABILITY-SCOPE-REPAIR-1 therefore moved this
capability to its own `google-youtube` connection under the same authorities (`940a5370`). The
`youtube.readonly` grant recorded in §2 on TRH's `google-workspace` connection no longer exists: that
connection was re-granted `drive.file` at 07:50:27Z and holds the Drive family only.

**Final organizational acceptance (2026-09-28).** Director-controlled consent on each tenant's own
`google-youtube` connection, one real identity read each, then an authoritative read-only DB
verification (`BEGIN TRANSACTION READ ONLY`, safe-column allowlist, no credential value):

| Tenant | Connection | Google account | Scopes | Capability | Provider read |
|---|---|---|---|---|---|
| Hebun AI `f625b683` | `google-youtube` `17ae94ea` | `hebuntech@gmail.com` (`114884615390589849256`) | identity + `youtube.readonly` | AVAILABLE | `one-channel` · Hebun Tech · `UCqTzRYJBwFsITzxFuqx6YQw` |
| Turkish Rug House `9947c78e` | `google-youtube` `c5e8637d` | `turkishrughouseist@gmail.com` (`117622225072141590877`) | identity + `youtube.readonly` | AVAILABLE | `one-channel` · Turkish Rug House · `UC5Yf5U_YOKR0K38tWF82kjA` |

The TRH read matches TRH's independently observed public channel id. Each tenant's YouTube
capability resolves through its own connection only; neither derives from the other or from a Drive
connection.

```
PROVIDER READER ACCEPTED                     YES  (§2, 2026-09-28, TRH context, hebuntech → Hebun Tech)
HISTORICAL TRH → HEBUN TECH OBSERVATION      REAL, WRONG ORGANIZATIONAL CONTEXT, NEVER BOUND
HEBUN AI → HEBUN TECH                        ACCEPTED (google-youtube 17ae94ea)
TURKISH RUG HOUSE → TURKISH RUG HOUSE        ACCEPTED (google-youtube c5e8637d)
CHANNEL BINDING PERSISTENCE                  STILL NONE — a channel seen is still not a channel bound
UPLOAD / videos.insert / PUBLISH             STILL NOT AVAILABLE
```

**YOUTUBE-WRITE-1 stays CLOSED**, now with the correct tenant→channel acceptance recorded. See
`hebun-google-capability-scope-repair-1-closure.md`.
