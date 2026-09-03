# GOOGLE-PICKER-1 — Expired Access Token Refresh Repair — RELEASED / ACCEPTANCE PENDING

**Release** `c36863ff02a766a1bf4f27432078742f7a014cfd` · **ZERO schema** · **Production ledger 47,
unchanged** · **Deployment** `dpl_A7kLb5H68gfxphNMqXdmGiVt1Um6`, running `c36863f` on `main`,
aliased to `www.hebuntech.com`

**This is not a closure.** One of the three truths below is still pending, and it is the one the
repair exists for.

---

## Three truths, kept apart

| | Claim | Status |
|---|---|---|
| **A** | The Google Picker capability works in production | **OPERATIONAL — proven in Chrome** |
| **B** | Safari can open the Picker | **LIMITED — browser-specific session-cookie behaviour, NOT a provider failure** |
| **C** | An EXPIRED access token is refreshed before the Picker receives it | **IMPLEMENTED + DEPLOYED + TESTED — production acceptance PENDING** |

A does not prove C. The Chrome run happened while the access credential was still fresh, so the
repaired branch was never entered. What Chrome proved is that everything the repair sits on top of
is sound.

---

## A · Chrome production evidence

The Director opened **Hebun → Knowledge → Choose from Google Drive** in Chrome, signed into
`hebuntech@gmail.com` — the same account that granted the connection
(`external_account_label` = `hebuntech@gmail.com`).

Google's Picker opened and listed eligible Drive documents. The chooser browsed normally. **No
document was admitted into Knowledge**, deliberately: opening a usable chooser is the acceptance for
this repair, and admitting one would be a separate act under a separate authority.

Server state at that moment, read read-only:

| Proof | Result |
|---|---|
| Live `oauth_access` | one, `key_id` **k2**, issued `19:30:37Z`, expiring `20:30:36Z` — ~54 minutes of life remaining |
| Refresh during the attempt | **none** — Google credential rows stayed at 19, no new `integration.credential.replaced` |
| Connection | `connected` / `healthy`, `last_error_at` null |
| Scopes | four, unchanged: `openid`, `drive.file`, `userinfo.profile`, `userinfo.email` |
| Knowledge nodes | 2, unchanged |

**The absence of a refresh is itself the evidence.** A fresh credential must not be exchanged, and
production did not exchange it — case 1 of the released test suite, observed in production.

---

## B · Safari — a browser compatibility limitation, recorded as debt

Same production surface, same Director, same Google account, Safari renders Google's own frame text:

> Can't access your Google Account. We can't access this content right now. Try signing into your
> Google account or allowing cookie access to proceed.

**This is not a broken Google integration, and must never be represented as one.** The same
credential, the same configuration and the same server path succeed in Chrome minutes apart.

What the repository can prove about the cause:

- The Picker renders as a Google-origin frame inside `www.hebuntech.com`, so Google's session
  cookies are read in a third-party context. Safari blocks that by default.
- Hebun sends **no** `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`,
  `Content-Security-Policy` or `X-Frame-Options` — verified in `next.config.ts`, in the source, and
  against the live response headers. Nothing Hebun sends can break a cross-origin frame.
- The Picker client is the plain `setOAuthToken` / `setDeveloperKey` / `setAppId` build, with no
  `setOrigin` — correct, because Knowledge is a top-level page and not itself framed.
- The account was checked, because a mismatch produces this same message: the granting account and
  the browser's account are the same.

**Not repaired, and deliberately not.** No cookie workaround, no iframe adaptation, no scope change,
no Google Console change, no new credential behaviour. Every one of those would weaken a browser's
own privacy control or widen Hebun's reach to make a third-party frame work, and the defect is not
Hebun's to fix.

**Supported-browser claim:** Chrome is verified. Safari is **not** verified and must not be
described as supported.

### UX debt, recorded and NOT implemented

When the Picker cannot establish its Google session in a browser, Hebun's surface should eventually
say so truthfully — a browser compatibility message — rather than leaving a person to conclude that
the Google connection is broken. Today the browser-side failure is rendered by Google inside its own
frame, where Hebun has no visibility, so there is no seam to hang an honest message on without
inventing detection Hebun cannot perform. **UX debt only.** It becomes work when repository reality
shows a narrow, safe way to observe the condition.

---

## C · What still has to happen, and what will prove it

The repaired branch runs only when the deployed runtime finds an access credential Google has
already declared over. That requires a Picker attempt at or after
`expires_at − ACCESS_TOKEN_EXPIRY_SKEW_MS` (60 s).

Current credential: `expires_at` **`2026-09-03T20:30:36Z`** → probative from
**`2026-09-03T20:29:36Z` UTC = 23:29:36 Europe/Istanbul**, and it stays probative afterwards for as
long as nothing else refreshes the token first.

Observable evidence that will prove GOOGLE-PICKER-1, all read-only:

1. A **new** live `oauth_access` row, a different credential id, with a **later** `expires_at` —
   Google's own stated expiry, recorded.
2. Google credential rows **19 → 20**, and the previous access row revoked, so exactly **one** live
   access credential remains.
3. Exactly **one** new audit row, `integration.credential.replaced`, with metadata `origin` =
   `provider-refresh` — the released authority, not a second path.
4. The live `oauth_refresh` credential **unchanged**: same id, same `created_at`, still `k1`. Google
   usually returns no rotated refresh token, and an absent one must never overwrite the tenant's
   only way back.
5. Connection still `connected` / `healthy`, scopes still the same four, `last_error_at` null.
6. The chooser itself opens and lists documents in Chrome.

If the chooser opens and **no** new credential row appears, the token was refreshed by something
else beforehand and the run proves nothing — it is repeatable, not a failure.

---

## Non-effects, measured

No YouTube lifecycle change (`connected`/`healthy`, version 3). No GitHub lifecycle change (version
3). No Knowledge admission — `knowledge_nodes` still 2. No Governance decision, no execution permit,
no agent mandate change. No Google scope change. No encryption-key rotation. No schema: production
migration ledger **47**, unchanged.

---

## Repository parity

`HEAD` = `origin/main` = `c36863f…`. The deployment serving `www.hebuntech.com` runs that exact
commit on `main`. Working tree carries no uncommitted source.
