# P4 · operator MFA (TOTP) · TECHNICAL DESIGN GATE — DECIDED, NOT IMPLEMENTED

**Not a closure record, and not an authorization.** This is the MFA prerequisite package required by
the P4 operator principal design gate (`hebun-p4-operator-principal-design-gate.md`, D2: MFA is
mandatory for Platform Admin). D1–D7 there are settled and not reopened here. Nothing below is built;
no migration is written or run.

**Director decisions (2026-11-10):** O1 accepted (60-minute admin MFA window), O2 accepted (separate
MFA key set), **O3 fixed — the recommendation was rejected: every grant, revoke and MFA management
act is audited, CLI included**, O4 accepted (no backup codes in v1). See "Final decisions".

## Measured at `01745bfe`

Paths are under `apps/dashboard/`.

1. **Session creation.** `issueLocalSession` (`src/features/auth-runtime/session-service.server.ts:153`)
   generates a 256-bit reference (`session-digest.server.ts:27`) and inserts a `user_session_contexts`
   row with `assuranceLevel: SESSION_ASSURANCE_LEVEL` (`"aal1"`, `session-service.server.ts:60`) and
   `mfaVerified: false` (`:269`). Every session row carries `activeTenantId` / `activeMembershipId`.
2. **Where it lives.** The browser holds only the opaque reference (`hebun_session_ref`). The row stores
   an HMAC-SHA256 digest of it under a versioned key, with current and previous digest keys
   (`session-digest.server.ts:33`, `session-service.server.ts:425`). Schema:
   `src/db/schema/user-session-context.ts:27–56`.
3. **Validation, every request.** `resolveSessionFromReference` (`session-service.server.ts:414`) finds
   the row by digest with `revoked_at IS NULL` (`identity-repository.server.ts:578`), refuses on
   inactivity or absolute expiry, identity/user/membership/tenant status, and a membership-version
   mismatch, then slides the inactivity window. Nothing is cached between requests.
4. **aal1 and `mfaVerified`.** The schema already admits MFA: `assurance_level in ('aal1','aal2','aal3')`
   and `mfa_verified = false or assurance_level in ('aal2','aal3')`
   (migration `20260719124600_auth_identity_schema_foundation.sql:116–117`). Nothing ever writes
   `aal2` or `true`. An unused, already-constrained `recent_auth_at` column exists
   (`user-session-context.ts:54, :108`).
5. **Expiry, logout, rotation.** Inactivity 30 min, absolute 8 h (`session-service.server.ts:58–59`).
   Logout revokes the row (`revokeSessionByReference`, `:1008`; called from `src/app/login/actions.ts:126`).
   Tenant switch **rotates** the session — new reference, old row revoked in the same transaction
   (`:911`, `:922`) — and **copies `mfaVerified` forward** (`:939`, `:964`).
6. **Cookie.** `httpOnly`, `sameSite: "lax"`, `secure` in production, `path: "/"`
   (`src/features/auth-runtime/session-cookie.ts`). `src/middleware.ts` sends a session-less request to
   `/login` and drops the query.
7. **Credentials are hash-only.** `auth_credentials` stores `salt` + `secret_hash` (NOT NULL) and the
   type enum is `["password"]` (`src/db/schema/auth-credential.ts`, `src/db/schema/_enums.ts:302`).
   A TOTP secret must be recoverable to verify a code, so it does not fit this table.
8. **Lockout precedent.** Durable, DB-held lockout: 5 failures → 15 min, incremented atomically in one
   statement (`credential-repository.server.ts:25–33`, `recordFailedAttempt`). No general rate limiter
   exists in `src/middleware.ts` or `src/features`.
9. **Encryption is already built.** AES-256-GCM `sealSecret` / `openSecret` with a fresh random IV per
   seal, AAD binding and a per-row `key_id` (`src/features/secret-encryption/authenticated-encryption.server.ts:57–64, :119, :169`);
   a fail-closed multi-key registry, today wired to `HEBUN_INTEGRATION_ENCRYPTION_*`
   (`key-registry.server.ts:54–69, :164`).
10. **Migrations.** Authored SQL under `src/db/migrations/` (85 files); production applies them only
    through the `npm run platform:migrate` ceremony (`scripts/platform-migrate.ts`).
11. **CLI ceremonies.** `tenant-lifecycle.ts`, `tenant-provision.ts`, `auth-dev-credential.ts` share
    `scripts/lib/ceremony-preflight` and `production-possession`; root of trust is deployment
    possession; they write **no** `audit_log` row — "a terminal has no actor to name"
    (`scripts/tenant-lifecycle.ts:31, :187`).

## Design

### Three questions, three records — never merged

| Question | Answered by | Grants |
|---|---|---|
| Who is this? | the existing session (fact 3) | nothing beyond today |
| Did they prove a second factor, in this session? | session assurance (below) | nothing on its own |
| May they administer the platform? | an active operator grant (P4 D1) | nothing without the row above |

Enrolling MFA never creates a grant. A grant never implies MFA. `/admin` and every admin read require
**both**, checked on the server on every request.

### TOTP

- RFC 6238, HMAC-SHA1, 6 digits, 30 s step — the parameters every standard authenticator app accepts.
  Implemented with `node:crypto` (HMAC + a small base32 encoder); **no new dependency**.
- Secret: 160 bits from `crypto.randomBytes(20)`, generated on the server only.
- Storage: sealed with the existing `sealSecret`, AAD = `"hebun-mfa-totp:v1:" + mfa_credential_id`, so
  a sealed secret cannot be moved to another row. Plaintext exists only in memory during enrollment and
  verification; never logged, never returned to a client after enrollment.
- Verification: accept the current step and **one step either side** (±30 s clock skew); compare in
  constant time.
- **Replay:** the credential stores `last_accepted_step`. A code is accepted only by one atomic
  `UPDATE … SET last_accepted_step = $step WHERE id = $id AND status = 'active' AND last_accepted_step < $step`.
  Zero rows updated ⇒ refused. The same code (or an older one) can never be accepted twice, across
  processes.
- **Failed attempts:** the password precedent (fact 8) on the MFA credential — 5 consecutive failures
  ⇒ locked 15 min, incremented atomically; a success resets the counter. A locked credential refuses
  even a correct code.

### Enrollment — through a ceremony, not the app

A stolen password must not be enough to enroll an attacker's authenticator on an operator's account.
So enrollment is **not** a product surface:

`npm run operator:mfa -- enroll <email>` (deployment possession, `ceremony-preflight`, explicit
confirmation): generates the secret, prints the `otpauth://` URI as text, asks for the first code from
the authenticator, and activates the credential **only after that code verifies**. One active TOTP
credential per identity. Re-enrolling replaces the active one (= rotation). The command grants nothing.

### Audited management acts (O3)

Applies to `operator:grant` / `operator:revoke` (P4 D3) and `operator:mfa enroll` / `revoke`
(including recovery, O4). Deployment possession alone is **not** an actor.

- **Actor verification.** Every ceremony first verifies the person at the terminal as a Hebun
  identity: email + password checked with the existing production verifier and lockout
  (`credential-repository.server.ts`). When at least one active operator exists, the actor must also
  be an active operator and enter a valid TOTP code from their own active MFA credential (same replay
  and lockout rules as in-app). **Bootstrap** — the first enrollment and first grant while no active
  operator exists — accepts a password-verified actor and is recorded as `bootstrap` in the audit row.
  If the actor cannot be verified, the act is refused.
- **Reason is mandatory.** A non-empty free-text reason is required; without it the act is refused.
- **Audit row, same transaction.** The state change and one `audit_log` row are written in **one
  database transaction**; if the audit insert fails, the transaction rolls back and nothing is
  granted, revoked, enrolled or changed. Row: `actor_type = 'human'`, `actor_id` = the verified actor's
  user id, `entity_type` / `entity_id` = the target grant or MFA credential (target identity in
  `metadata`), `action` (e.g. `platform.operator.grant`, `auth.mfa.enroll`, `auth.mfa.revoke`),
  `occurred_at`, `result`, `authority_source = 'platform-admin'` (or `'system'` for bootstrap),
  `tenant_id = null`, `metadata.reason`, and non-secret `previous_state` / `next_state` (status and
  timestamps only).
- **Never in audit:** the TOTP secret, any code, the `otpauth://` URI, or the actor's password.
- **Reuse.** `audit_log` already has every column needed (fact 11's ceremonies simply never wrote to
  it). The package adds only the minimum CLI integration: a ceremony-side writer that inserts this row
  inside the act's transaction. No new audit table or system.

### Session assurance and step-up

- `/admin/*` is guarded server-side. A session that is not an operator-elevated session is sent to a
  challenge page (`/admin/verify`); a session without an active grant is refused outright (no hint that
  admin exists beyond the standard refusal).
- The challenge verifies a TOTP code against the user's active credential. On success the session is
  **rotated** on the existing tenant-switch pattern (fact 5): new reference, old row revoked in the same
  transaction, new row with `assurance_level = 'aal2'`, `mfa_verified = true`, `mfa_verified_at = now`,
  `mfa_credential_id = <credential>`. Rotation on privilege elevation closes session fixation.
- **Admin requires `aal2`** with all of, on every request:
  `mfa_verified` · `mfa_verified_at` within the admin MFA window (decision O1) · the bound MFA credential
  still `active` and not re-enrolled after `mfa_verified_at` · an active operator grant.
- MFA state is read **only** from the session row the server resolved from the cookie digest. No
  header, cookie, query, body or client flag is consulted.
- **Not portable:** it lives on one session row. Logout revokes that row (fact 5), so MFA ends with it.
  Expiry of the session ends it.
- **Rotation changes:** tenant switch currently copies `mfaVerified` forward (fact 5). The package
  changes that rotation to **drop** MFA (write `aal1`, `false`, nulls). Today every session is `aal1`, so
  no customer or Director behaviour changes.
- Customer and Director sign-in are unchanged: no MFA prompt, `aal1` sessions, same landing routes.

### Recovery and removal

- No self-service recovery and no recovery codes in v1 (O4). A lost authenticator is recovered by the
  ceremony: `operator:mfa -- revoke <email>` (marks the credential `revoked`; every elevated session
  bound to it fails its next request) and a new `enroll` — both audited under O3.
- Removal = the same `revoke`. Revocation needs no session sweep: the per-request check of the bound
  credential's status cuts access on the next request.
- Grant removal (P4 D3) likewise cuts access on the next request even with valid MFA.

### Minimum database change (one migration)

1. **New table `auth_mfa_credentials`:** `id`, `auth_identity_id` (FK), `method` (`'totp'`),
   `status` (`pending` · `active` · `revoked`), sealed secret (`algorithm`, `key_id`, `ciphertext`,
   `iv`, `auth_tag` — the `SealedSecret` shape), `last_accepted_step` (bigint), `failed_attempt_count`,
   `locked_until`, `activated_at`, `revoked_at`, `revocation_reason`, `created_at`, `updated_at`.
   Partial unique index: one `active` row per `auth_identity_id`. CHECKs on status/time coherence, on the
   same pattern as `auth_credentials`.
2. **`user_session_contexts`, two nullable columns:** `mfa_verified_at` and `mfa_credential_id`
   (FK → `auth_mfa_credentials`), with CHECK `mfa_verified = (mfa_verified_at is not null)` and
   `mfa_verified = (mfa_credential_id is not null)`. `assurance_level` and `mfa_verified` already exist
   (fact 4); `recent_auth_at` is left for password re-authentication, not reused.
3. **No new audit table.** In-app MFA events have an actor (the session's user) and go to `audit_log`:
   `auth.mfa.verify.succeeded` / `.failed` / `.locked`, no code, no secret. Ceremony acts write an
   `audit_log` row in the same transaction as the change (O3); the credential row also keeps its own
   `activated_at` / `revoked_at` / `revocation_reason`.
4. Encryption keys: a separate MFA key set (O2). No key material in the database.

Applied locally first; production only via `platform:migrate` behind its own Director gate.

## Security acceptance criteria (the implementation must prove each)

1. `/admin` and every admin read refuse a session without `aal2` + valid MFA — even with an active grant.
2. A wrong TOTP code is refused.
3. A code outside the ±1-step window is refused.
4. An already-accepted code (same or earlier step) is refused, including under concurrent submission.
5. Five failures lock the credential for 15 min; a locked credential refuses a correct code.
6. MFA verified in one session does not open admin in another; tenant switch drops it; logout ends it.
7. A forged `mfaVerified` / assurance value in any header, cookie, query or body has no effect.
8. Revoking or re-enrolling the MFA credential cuts admin on the next request.
9. Revoking the operator grant cuts admin on the next request, with MFA still valid.
10. Customer and Director sign-in, sessions and landing routes are unchanged (existing suites green).
11. The TOTP secret, codes and the `otpauth://` URI never appear in logs, diagnostics, error messages,
    audit rows or client payloads (asserted by test, including on failure paths).
12. Every admin read checks both the grant and MFA, server-side, and fails closed if either is unreadable.
13. An admin request more than 60 minutes after `mfa_verified_at` is refused until re-verified, and an
    earlier session expiry ends admin first (O1).
14. MFA secrets are sealed only with the MFA key set; an integration key cannot open them, and a missing
    or invalid MFA key set refuses enrollment and verification (O2).
15. Every grant, revoke, enroll and MFA revoke/recovery writes one audit row with verified actor, target,
    action, time, reason and result; an unverified actor, a missing reason or a failed audit insert
    leaves the state unchanged (O3).
16. No audit row, log line or ceremony output after enrollment contains a secret, a code or the
    `otpauth://` URI (O3).

## Implementation order (one package)

The proposed order holds, with two adjustments to fit the architecture: the grant table travels in the
same migration as the MFA table (one schema gate instead of two), and the guard is written before any
admin page so nothing can render unguarded.

1. One migration: `auth_mfa_credentials` + the two session columns + P4 D7's operator grant table.
2. TOTP core (generate, seal with the MFA key set, verify, replay, lockout) with unit tests.
3. Ceremony actor verification (password; TOTP once an operator exists; bootstrap rule) and the
   ceremony-side audit writer (one transaction with the change).
4. `operator:mfa` ceremony (enroll / revoke) and the P4 D3 `operator:grant` ceremony, both through
   step 3.
5. Session step-up: `/admin/verify`, rotation to `aal2`, tenant-switch drop.
6. Admin access guard (grant AND MFA within 60 min) as a layout check plus a per-read check.
7. The 16 proofs above, then local acceptance.
8. Director gates: production MFA key set; production migration; first production enrollment and grant.

## Final decisions (Director, 2026-11-10)

- **O1 · ACCEPTED — admin MFA window 60 minutes** from `mfa_verified_at`, checked server-side on every
  admin request. An earlier session expiry (30-min inactivity, 8-h absolute) ends admin first. After 60
  minutes, re-verification is required. The verification stays bound to its session.
- **O2 · ACCEPTED — separate MFA key set** (`HEBUN_MFA_ENCRYPTION_KEYS` / `…_ACTIVE_KEY_ID`) through the
  existing registry and `sealSecret` code. Never shared with integration credential keys. Secrets never
  reach logs or clients. Creating and configuring the production key set is a separate Director gate;
  existing production keys are neither changed nor rotated.
- **O3 · FIXED — the earlier recommendation is REJECTED.** It proposed keeping the "a terminal has no
  actor" doctrine and recording ceremony acts only as row state. Decided instead: every grant, revoke and
  MFA management act is audited with verified actor, target, action, time, reason and result; CLI
  execution does not lift the requirement; an unverifiable actor, a missing reason or a failed audit
  write refuses the act; no secret, code or recovery data in audit; reuse `audit_log` and add only the
  minimum ceremony integration (see "Audited management acts"). No new audit system.
- **O4 · ACCEPTED — no backup codes in v1.** Lost authenticator ⇒ audited ceremony revoke and
  re-enrollment. Revoking the MFA credential cuts admin on the next request.

No open decisions remain in this gate. Production key creation, production migration and the first
production grant remain separate Director gates by design, not open questions.

## Out of scope

MFA for customers or Directors, SMS / e-mail OTP / external providers, WebAuthn, an in-app enrollment
page, any admin dashboard view, any production change.
