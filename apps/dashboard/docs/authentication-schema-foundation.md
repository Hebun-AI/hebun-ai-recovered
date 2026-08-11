# Authentication Schema Foundation (Phase 3D.2B.2)

S12 is an additive, provider-neutral database foundation. It stores canonical
identity links, invitation digests, server-side session context, coarse role
permissions, and authentication audit lookup fields. Supabase Auth is not
configured and authentication remains disabled.

## Security boundary

- Provider tokens, raw JWTs, cookies, raw provider-session identifiers, and
  plaintext invitation tokens have no schema columns.
- Invitation and provider-session references are represented by versioned HMAC
  digests at the application boundary. Session contexts persist the positive key
  version used for each digest so controlled current/previous-key rotation does
  not require retaining an unbounded secret history.
- Security-history relationships use restrictive deletion; audit session lookup
  intentionally has no FK so retained audit events cannot be deleted transitively.
- Existing tenant and membership state remains non-authoritative until inventory,
  deterministic backfill, and restrictive constraint validation are complete.

## Rollback boundary

Before production authentication writes, S12 may remain inert while the old
application continues unchanged. After a canonical identity or session context is
used to grant production access, destructive rollback is forbidden; disable the
future authentication gate and ship a forward-fix instead.

## Retained blockers

No canonical identity resolver, server session resolver, TenantContext, route
protection, permission seed, RLS, tenant provisioning, runtime hydration, provider
activation, or PostgreSQL cutover is included. Memory remains active and
authoritative; PostgreSQL remains passive.

> The paragraph above describes phase 3D.2B.2 and is retained as history. R1 built
> the identity/session/tenant resolvers and route protection; D1 added credential
> verification. The current state is below.

---

# Authentication: current state (D1)

**Six authorities, deliberately not collapsed.** Each answers a different question,
and conflating any two of them is how an authentication boundary becomes decorative.

| Authority | Owns | Question it answers | State |
|---|---|---|---|
| **Identity** | `users`, `auth_identities` | *Who is this human?* | IMPLEMENTED · CONNECTED · AUTHORITATIVE. Provider-neutral: unique on `(provider, issuer, subject)`; an `active` identity requires `verified_at`. |
| **Credential** | `auth_credentials` | *What did they prove?* | IMPLEMENTED · CONNECTED · AUTHORITATIVE (D1). scrypt, per-credential salt, per-row parameters. |
| **Session** | `user_session_contexts` | *Is this request still that human?* | IMPLEMENTED · CONNECTED · AUTHORITATIVE. Opaque reference, stored only as a keyed HMAC digest. |
| **Tenant** | `TenantContext`, `companies` | *Which organization are they acting in?* | IMPLEMENTED · CONNECTED · AUTHORITATIVE. Resolved server-side, revalidated per request. |
| **Membership** | `memberships` | *Do they belong to it?* | IMPLEMENTED · CONNECTED · AUTHORITATIVE. Version-pinned; revocation after issue is caught on the next request. |
| **Role** | `roles` | *What band of authority do they hold?* | IMPLEMENTED · CONNECTED. Coarse `roles.type` band only — not a fine-grained grant. |

**Authentication is not authorization.** Verifying a credential answers only "which
human?". Signing in creates no membership, chooses no role, and upgrades no role;
`auth_credentials` carries no tenant, membership, role, or permission column, and a
test asserts it never will.

## Credential verification (D1)

- **Primitive:** scrypt from `node:crypto` (RFC 7914, OpenSSL-backed). No dependency
  was added and no cryptography was written here.
- **Parameters:** N=2^15, r=8, p=3, 64-byte key — an OWASP-listed configuration
  (~32 MB, ~230 ms). Stored **per credential**, not in config, so the cost can be
  raised later without invalidating existing rows.
- **Algorithm agility:** verification dispatches on the *stored* algorithm, and
  `needsRehash` reports rows below current policy. Moving to Argon2id is a
  credential rewrite on next sign-in, not a migration and not a redesign.
- **Secret confinement:** `salt` and `secret_hash` are read in exactly one module
  (`credential-repository.server.ts`), which returns only a verdict. No other file
  — including the session service — ever holds credential material.
- **Ordering is the security property:** no session reference is generated until
  after verification. Proved by test, not by convention.

## Enumeration and lockout

Unknown email, wrong password, revoked credential, locked credential and missing
membership return **one** client-visible refusal. Each also spends the same scrypt
work, so the causes are indistinguishable by timing as well as by message. The
server keeps the real cause in a diagnostic that never reaches the browser.

Lockout is durable (`failed_attempt_count`, `locked_until` in Postgres — the only
state every server process shares), bounded, and temporary: 5 failures lock for 15
minutes at a stated instant. A locked credential refuses even the correct password
and is never destroyed.

## What D1 does NOT provide

Stated plainly so nothing here reads as stronger than it is:

- **MFA — not implemented.** Every session is `aal1`, `mfaVerified=false`.
- **Password recovery — not implemented.** There is no reset flow and no email
  infrastructure. A forgotten password requires operator intervention.
- **SSO / OIDC — not implemented.** `provider: "supabase"` is a marker interface
  with no SDK and no sign-in flow.
- **Passkeys / WebAuthn — not implemented.**
- **Fine-grained permission runtime — not implemented.** `permissions` /
  `role_permissions` remain schema-only with zero consumers.
- **Distributed brute-force protection — not implemented.** Lockout is
  per-credential. There is no IP reputation, CAPTCHA, or shared rate limiter, and
  none is claimed.
- **Authentication security telemetry — ownership unresolved.** `audit_log` is the
  cross-domain sink, but G1's `KNOWLEDGE_AUDIT_BOUNDARY` scopes it to Knowledge
  mutations and states that authentication failures "belong to security telemetry,
  which is a separate authority and is not connected". D1 did not broaden Knowledge
  audit semantics and did not invent a second sink; sign-in events are therefore
  **not** currently recorded. This is a documented gap, not a solved problem.

---

# Local development (D1.1)

## Setting or rotating your development password

D1 removed "type an email and become that person", so a development identity needs
a real credential before it can sign in. There is **one** supported procedure:

```
npm run auth:dev-credential -- alice@acme.test
```

It prompts twice for a new password (hidden, minimum 12 characters), hashes it with
the same production hasher the login path verifies with, and writes an active
credential. Then sign in normally at `/login`.

Running it again for the same identity **rotates**: the old credential is revoked
and the new one inserted in one transaction, so there is never an instant with two
active credentials and never an outcome where the old one is gone and the new one
failed to land.

What it deliberately cannot do: mint a session, create or change a membership, role
or tenant, authenticate anybody, run with `NODE_ENV=production`, run against a
non-local database, or take a password from a file, an argument, or the
environment. There is no `HEBUN_DEV_PASSWORD` — a password in config is a password
that eventually gets committed. It lives under `scripts/`, and a test asserts
nothing in `src/` may import it.

## Disposable test databases: only destroy what you created

**The invariant:** a test helper may destroy only a database it can prove it
created. A prefix is not proof. A naming convention is not proof. A regex is not
proof. "Looks disposable" is not proof.

**Prefix and glob deletion of databases is forbidden.** No helper may
`list databases → match a pattern → drop the matches`. `tests/helpers/disposable-postgres.ts`
has no API that accepts a name, a pattern, or a list: `dropDatabase()` takes no
arguments and can only reach the one randomized name that handle minted, captured
in a closure so a tampered handle cannot redirect it. A drop is refused outright
unless `create database` actually succeeded for that handle in this process.
Protected names (`postgres`, the templates, `hebun_r1`, and whatever `DATABASE_URL`
currently points at) are a backstop behind that gate, not the protection itself.

Disposable databases are created on the Hebun-dedicated local instance
(`127.0.0.1:55432`), never the general-purpose local Postgres on `:5432`, which on
a developer machine also holds unrelated projects. Override with
`HEBUN_TEST_ADMIN_DATABASE_URL`; a non-local target is refused.

**Why this is written down.** During D1 a database that was not disposable was
destroyed by an ad-hoc `list → match prefix → drop each match` command, run as a
single step so the list was never inspected before it was acted on. Nothing in the
repository did this — it was a one-off shell command — which is exactly why the
rule now lives in code and in tests rather than in someone's memory. If a
"clean up the stale test databases" utility is ever wanted, it is a separate
operator tool with its own confirmation boundary, not a helper function.
