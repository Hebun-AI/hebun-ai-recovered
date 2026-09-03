# CGO-5 — YouTube Public Channel Observation — CLOSED / PRODUCTION-ACCEPTED

**Release** `f6aba0e1bf4f47600a0757fd9e4e9f028bb2f614` (registry extension) over
`466c4e0` (the observation capability) · **ZERO schema** · **Production ledger 47, unchanged** ·
**Deployment** `dpl_sufqvFU9jVMJjb1Q3kwdJwuWeVT7`, running `f6aba0e` on `main`

---

## What Hebun can now do that it could not

Hebun observes a YouTube channel it does not own, does not connect to, and cannot write to.

    Before:  no YouTube reach of any kind
    After:   /youtube-channel @handle  →  live, provider-derived public observation in Heby

The connection is **credential-only**: an API key, no OAuth, no account. Its
`external_account_id` is `null` and its label says so in words — *"YouTube Data API v3 — public
read (no account)"*. `scopes` is the empty array, because an API key grants none. A channel named
as an argument is an **observation target**, never a connected or owned account of this
organization, and nothing about it is stored.

---

## Three decisions worth keeping

**The registry was extended by a second VARIABLE, never a second authority.**
`HEBUN_INTEGRATION_ENCRYPTION_KEYS_ADDITIONAL` feeds the same map through the same parser, because
a hosting provider's sensitive variable cannot be read back and the deployment's primary key could
therefore never be held by an operator. It cannot stand alone, a duplicate id refuses, a malformed
or set-but-empty value refuses, and the active key is still chosen only by
`HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID`.

**Write reach is refused at the URL, not merely unlisted.** `YOUTUBE_FORBIDDEN_FRAGMENTS` bans
`/upload`, `insert`, `update`, `delete`, `/rate`, `/comment`, `/subscriptions`, `/captions`,
`/liveBroadcasts`, `/thumbnails`, `oauth` and `mine=true`. Absence of a write capability is a
configuration fact; a banned fragment is a mechanism. Both hold.

**Key equality that cannot be proved is stated, gated, and deferred to the deployed runtime.** The
admission ceremony opens an existing live credential whose key id is locally held and refuses to
store anything if it will not open. With only `k2` locally and every existing row sealed under
`k1`, no such row existed, so the ceremony refused until the Director supplied
`--accept-unproven-keys` on the command line — and the proof moved to production acceptance, where
the deployed runtime had to decrypt what the ceremony wrote.

---

## Production acceptance

The Director executed `/youtube-channel @Candamlalari` in the deployed Heby workspace against
`dpl_sufqvFU9jVMJjb1Q3kwdJwuWeVT7`. Production returned a live observation of the public channel
**Can Damlaları (@candamlalari)**: canonical channel identity, creation timestamp, public view /
video / subscriber counts, recent uploads with per-video public views, likes and comments where
YouTube exposes them, and YouTube's own video provenance identifiers.

| Proof | Result |
|---|---|
| Live YouTube connections | exactly **1** |
| Live `api_key` credentials on it | exactly **1** — and exactly one credential row in total |
| Credential seal | `key_id` **k2**, `aes-256-gcm`, no expiry |
| Connection lifecycle | `connected` / `healthy`, `last_error_at` null, verified = succeeded |
| Account identity | `external_account_id` **null**, `scopes` **[]** |
| Capability | `youtube.channel.public.read` = **available**, `writeCapable` **false** |
| Deployed decryption | the deployed runtime opened the **k2**-sealed credential — so production's ADDITIONAL `k2` material matches what was admitted |

**What the acceptance settled that no local run could.** A local verification decrypts with the
operator's own registry and proves nothing about the deployment. Only the deployed runtime opening
the k2 row proves the two registries hold the same material under the same id.

---

## Non-effects, measured

| Claim | How it was proved |
|---|---|
| Zero YouTube write / publish / schedule | Only capability registered is `youtube.channel.public.read`, `writeCapable` false; write verbs banned as URL fragments |
| Zero OAuth | The only credential kind present for this provider is `api_key`; `oauth` is a forbidden fragment |
| Zero Knowledge admission | `knowledge_nodes` total **2**, created in the last 12 h: **0** |
| Zero schema | Production migration ledger **47**, unchanged |
| No Google credential touched | `google-workspace` version **9**, `updated_at 2026-08-30T21:50:49Z` — byte-identical to the pre-admission snapshot; credential census unchanged at 18 rows / 2 live / newest 2026-08-30 |
| No GitHub credential touched | `github-organization` version **3**, `updated_at 2026-08-24T16:47:15Z` — unchanged |
| No encryption key rotated | No rotation ceremony run; every pre-existing row still names `k1` |
| Nothing else written | Exactly **two** audit rows for the whole admission: `integration.connection.created`, `integration.credential.stored`. No action requests, no execution attempts |

---

## Truth, stated separately

| Level | Status |
|---|---|
| **Implemented** | YES — provider contract, verifier, API-key call seam, `/youtube-channel` command, capability projection, additional-key registry variable |
| **Configured** | YES — production holds the Picker-independent YouTube key and the extended encryption registry |
| **Connected** | YES — one credential-only connection, no account, no OAuth |
| **Verified** | YES — one real YouTube verification at admission; connection recorded `connected` / `healthy` |
| **Available** | YES — `youtube.channel.public.read` available, read-only |
| **Production-accepted** | YES — human-executed `/youtube-channel @Candamlalari` in the deployed UI returned a real provider observation |

---

## Carried forward as debt, NOT repaired here

**The Google Picker session cannot mint a fresh token.** `authorizePickerSession` hands the browser
whatever `oauth_access` row is live, and `live` consults only `revoked_at` / `destroyed_at` —
never `expires_at`. Its callback into `withGoogleAccessToken` returns the token instead of spending
it, so the refresh-on-`auth`-failure path every other Google caller relies on can never fire. Any
time the last refresh is more than an hour old, the Picker opens with an expired bearer token and
Google renders its own 403 page.

Found while diagnosing an unrelated CGO-5 symptom and confirmed in production on 2026-09-03: the
live access token had expired ~92 hours earlier and the Picker attempt wrote no new credential row,
so the first decrypt succeeded on a stale token. **This is a separate defect. Repair belongs to
whichever phase owns Drive admission next, and was deliberately not folded into CGO-5.**

The same diagnosis closed the k1 question positively: the earlier Hebun-side refusal —
*"Google did not authorize a document chooser for this connection right now."* — was the ADDITIONAL
variable making the registry fail closed, exactly as designed. Once corrected, the deployed runtime
opened a `k1` row on its first attempt.

---

## What is NOT open

CGO-6 has not been selected, scoped, or started.
