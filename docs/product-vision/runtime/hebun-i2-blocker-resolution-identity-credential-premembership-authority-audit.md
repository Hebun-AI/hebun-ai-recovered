# HEBUN I2 BLOCKER RESOLUTION — IDENTITY, CREDENTIAL & PRE-MEMBERSHIP AUTHORITY AUDIT

**Phase:** I2 blocker resolution — audit only
**Date:** 2026-08-12
**Scope:** Read-only repository and database inspection, plus architectural reasoning. No implementation, no schema change, no migration, no commit, no tag, no push.
**Predecessor:** `hebun-i2-gate-a-human-onboarding-authority-audit.md` (verdict: *I2 GATE A BLOCKED — AUTHORITY UNRESOLVED*)
**Verdict:** see §38.

---

## 1. Baseline proof

Re-measured, not recalled.

| Fact | Claimed in continuation state | **Measured now** |
|---|---|---|
| Branch | `main` | `main` ✅ |
| HEAD | `872b753…` | `872b753483b4402e561b242b7a7c85c20da40664` ✅ |
| `origin/main` | `872b753…` | identical ✅ |
| Ahead / behind | 0/0 | `0 0` ✅ |
| Staged | none | none ✅ |
| Changed files | 25 | **27** ⚠️ |
| Migrations on disk | 22 | 22 ✅ |
| Journal entries | 22 | 22 ✅ |
| Dependency diff | unchanged | `git diff HEAD -- package.json package-lock.json` **empty** ✅ |
| Tag | `hebun-p2-verified-human-governance-foundation-complete` | present ✅ |
| Lint | PASS | PASS ✅ |
| Typecheck | PASS | PASS ✅ |
| Tests | 335/335 | **335 PASS / 0 FAIL** ✅ |
| Build | PASS | PASS ✅ |
| `npm run verify` | exit 0 | **exit 0** ✅ |

### ⚠️ CONTRADICTION 1 — changed files is 27, not 25

**REPOSITORY REALITY WINS.** Cause identified, benign, and fully attributable to the previous audit turn:

```
 M learnings.md                                                          ← appended I2 Gate A lesson block
?? docs/product-vision/runtime/hebun-i2-gate-a-human-onboarding-authority-audit.md   ← the Gate A report
```

Both are documentation. No source file, no schema file, no migration, no test changed. The 25 code-bearing entries from the continuation state are byte-for-byte the same set. Continuing from this point is correct.

### Durable database `hebun_r1` — read-only re-probe

| Fact | Claimed | **Measured** |
|---|---|---|
| Applied migrations | 20 | **20** ✅ |
| `membership_authorizations` | absent | **ABSENT** ✅ |
| `roles_one_member_per_tenant_uq` | absent | absent (`roles_pkey`, `roles_tenant_id_id_uq` only) ✅ |
| `roles` | 2, both `owner` | 2, both `owner` ✅ |
| `invitations` | 0 | 0 ✅ |
| `users` / `auth_identities` / `auth_credentials` / `memberships` | 2 / 2 / 2 / 2 | 2 / 2 / 2 / 2 ✅ |
| `user_session_contexts` | *(not previously probed)* | **47** rows, **0** with `active_tenant_id IS NULL` |

I1 and I1.1 migrations remain unapplied. `hebun_r1` was **not** migrated and **not** mutated — every statement in this audit was a `SELECT`.

### Leftover database

`hebun_test_hebun_i1_membership_1c8a8356214345b5` **still exists**, observed while listing databases. Not used, not connected to for tests, not mutated, not dropped, not swept, not renamed. Reported only, per the D1.1 invariant.

---

## 2. Previous I2 blocker validation

The Gate A verdict held that three authority decisions were unresolved. Re-tested against disk:

| Claim | Status after re-audit |
|---|---|
| No product-runtime writer for `users` / `auth_identities` | **CONFIRMED** — zero `insert` into either in `src/` or `scripts/lib/` |
| `insertPasswordCredential` has no product caller | **CONFIRMED** — zero callers anywhere in `src/` |
| Dev credential provisioning is not product capability | **CONFIRMED**, and stronger than stated — see §8 |
| Session issuance requires an active membership | **PARTIALLY CORRECT — and materially overstated.** See §11–§12 |
| The deadlock is a four-step cycle ending in "membership is created after acceptance" | **REFUTED.** See §12 |

### ⚠️ CONTRADICTION 2 — the D-3 deadlock, as described, is not real

The continuation state describes:

```
invitation → needs identity proof / credential → needs authenticated session
           → session requires membership → membership created after acceptance
```

Step three is false. **Credential verification does not require a membership, and never did.** The membership requirement attaches only to *normal tenant session issuance*, three function calls later. §11 traces it line by line. §12 states the corrected deadlock.

---

## 3. Identity authority reality

### What `users` represents

*"A person known to Hebun, globally."* `rootColumns` (not `tenantColumns`) — a user is not owned by a tenant. `users_email_uq` makes the email address the global identity key. Additive S5 attributes (`display_name`, `last_verified_at`, `suspended_at`, `archived_at`) are all nullable and unread by any runtime.

A `users` row is a **person record**. It asserts nothing about proof.

### What `auth_identities` represents

*"A provider-issued claim that a particular external subject is this person."* Also `rootColumns`. Triple `(provider, issuer, subject)` is globally unique. Status enum: `pending | active | suspended | revoked`, **default `pending`**.

### Can a `users` row exist without an `auth_identity`?

**Yes.** No constraint requires one. The FK runs the other way (`auth_identities.user_id → users.id`, RESTRICT).

### Can an `auth_identity` exist without verified proof?

**Yes — this is a designed, first-class state.** `status` defaults to `pending`, and:

```sql
auth_identities_active_chk:
  status <> 'active' OR (verified_at IS NOT NULL AND revoked_at IS NULL AND lifecycle_status = 'active')
```

So `pending` + `verified_at IS NULL` is legal and expected. **The Identity authority already models "claimed but not yet verified".** Nothing in the product ever produces that state.

### Binding invariants

- `auth_identities_provider_issuer_subject_uq` — one identity per external subject, globally
- `auth_identities_primary_user_uq` — partial UNIQUE on `user_id` WHERE `is_primary = true`
- `auth_identities_primary_active_chk` — only an `active` identity may be primary
- `auth_identities_revoked_chk` — revoked requires when + why + `is_primary = false`
- `auth_identities_non_revoked_chk` — a non-revoked row must carry no revocation residue
- `auth_identities_auth_time_chk`, `auth_identities_revoked_time_chk` — temporal ordering

This is a complete, carefully-designed lifecycle. **It is not a stub.**

### Who owns lookup / resolution

`src/features/auth-runtime/identity-repository.server.ts:89` — `findActiveLocalIdentityByEmail`. It filters `provider='local'`, `status='active'`, `lifecycle_status='active'`, `revoked_at IS NULL`, and `users.lifecycle_status='active'`. A `pending` identity is invisible to sign-in.

Secondary readers: `canonical-read/actor-resolution.ts`, `governance-decision/authority-delegation.server.ts`, `platform-core/actor/actor-resolution.ts` (which maps `human → users`).

### The six layers, kept distinct

| Layer | Table / artifact | What it asserts |
|---|---|---|
| person record | `users` | a human is known to Hebun |
| identity claim | `auth_identities` (`status='pending'`) | some provider names this subject as this person |
| verified identity | `auth_identities` (`status='active'`, `verified_at` set) | that claim was accepted |
| credential | `auth_credentials` | what the human proves at sign-in |
| session | `user_session_contexts` | a durable receipt of one proof |
| membership | `memberships` | that human's standing inside one tenant |

None of these collapses into another. `auth_credentials`' own header states it: *"Verifying a credential answers 'which human?', never 'what may they do?'."*

---

## 4. User creation reality

Every writer of `users`, exhaustively:

| Writer | Classification |
|---|---|
| `scripts/r1-seed.mjs:31` | **seed / bootstrap** — `insert … on conflict (email) do update` |
| `tests/helpers/r1-identity-seed.ts:56` | **test-only** |
| per-suite fixtures (d1, g2, g2-1, g3, i1, i1-1, k4, canonical-read, actor-shadow-read) | **test-only** |

**Production runtime writers: zero. Development-only writers: zero. Migration writers: zero. Mock writers: zero.**

Both durable `users` rows (`alice@acme.test`, `bob@globex.test`) came from `scripts/r1-seed.mjs`.

---

## 5. Auth identity creation reality

Every writer of `auth_identities`:

| Writer | Classification |
|---|---|
| `scripts/r1-seed.mjs:40` | **seed / bootstrap** |
| `tests/helpers/r1-identity-seed.ts:62` | **test-only** |

**Production runtime writers: zero.**

### What the seed actually wrote — and why it matters

```sql
insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
values ($1, 'local', 'hebun-local', $2, 'active', true, now())
--                                    ↑ subject = 'local:<email>'
```

Confirmed against the live database:

```
local | hebun-local | local:alice@acme.test | active | verified=2026-08-10 10:29:12.283882+03
local | hebun-local | local:bob@globex.test | active | verified=2026-08-10 10:29:12.330278+03
```

Three consequences, all decisive:

1. **For the `local` provider, `subject` is derived from the email.** `auth_identities_provider_issuer_subject_uq` therefore means *"one local identity per email address, globally"*.
2. **`verified_at` was asserted, not earned.** Both timestamps are the seed's `now()`. No verification event of any kind ever occurred.
3. **Therefore Hebun has never performed local identity verification.** There is no code path that could. The two "verified" identities are verified by fiat, exactly as G2.1's `nomination_source` is a limitation rather than a credential.

### Is this an implementation gap or an undesigned authority?

**An implementation gap inside an already-established Identity authority.** The evidence is unambiguous:

- the tables exist with complete, non-trivial lifecycle invariants
- a `pending` state is designed and CHECK-enforced
- a dedicated resolver module owns lookup
- `AuthenticationProvider` is a provider-neutral contract (`provider`/`issuer`/`subject`) built for more than `local`
- the *canonical actor* mapping (`human → users.id`) is repository-wide

What is missing is a **writer** and the **verification transition** (`pending → active`, which requires setting `verified_at`). Adding a writer inside an authority that already owns the semantics is legitimate — I1.1 did exactly this for `roles`, which had schema and seed rows and no product writer until it gained one.

**But `verified_at` has no honest source.** That is D-2's problem, not D-1's — see §7.

---

## 6. Credential authority reality

`auth_credentials` is the most complete authority in this audit. All of it lives in one module, `src/features/auth-runtime/credential-repository.server.ts`.

| Concern | Owner | Product-reachable? |
|---|---|---|
| hashing | `password-hash.server.ts` — scrypt N=2^15, r=8, p=3, 64-byte key, per-row `algorithm`+`params` | yes (sign-in + dev script both use it) |
| verification | `verifyPasswordCredential:106` — constant-time, timing-equalized, secret-confined | **yes** — `/login` |
| lockout | `recordFailedAttempt:199` — single-statement increment + threshold, durable | **yes** |
| success normalization | `recordSuccessfulVerification:224` | **yes** |
| **creation** | `insertPasswordCredential:247` | **no caller anywhere in `src/`** |
| revocation | `revokeCredential:274` | **no caller anywhere in `src/`** |
| persistence | same module; `salt`/`secret_hash` never leave it (structural test enforces) | — |

`insertPasswordCredential`'s own docstring: *"Provisioning only — there is no product surface that calls this in D1."*

### Why `insertPasswordCredential` exists, and what its lack of a caller means

It exists because **credential creation is Credential authority's responsibility and the module claims that responsibility**. It sits beside verify, lockout and revoke, uses the authority's own `ControlPlaneDatabase` type, and relies on `auth_credentials_active_identity_type_uq` to make a second active credential a database error rather than a race.

Its lack of a runtime caller is **unfinished product wiring, not an architectural exclusion.** The architectural exclusion is elsewhere — see §8.

**Classification: unused helper inside an established authority.** Not dev-only, not a mock, not dead by design.

---

## 7. First credential enrollment reality

### What proof is required today

**None is defined, because enrollment has only ever happened out-of-band.** The only credential enrollment Hebun has performed is an operator with direct local-database access running `auth:dev-credential`. The "proof" was *possession of the machine*.

### The candidate proofs, tested against repository capability

| Candidate proof | Available in repository? |
|---|---|
| invitation possession only | yes — but see the attack below |
| invitation + intended-email match | partially — `invitations.normalized_email` exists; the *matching identity* does not exist yet for a brand-new human, so there is nothing to compare against |
| email verification | **no** — zero mail runtime (§14) |
| external identity provider (OIDC / passkey) | **no** — `AuthenticationProvider` contract exists; no implementation, `auth_credential_type` enum holds `password` only |
| separate enrollment capability | **no** — no table, no artifact |
| existing repository primitive | **partially** — `genesis_nominations` demonstrates a two-key ceremony over exactly this problem shape (§17) |

### The attack the repository cannot answer

> What prevents an intercepted or forwarded invitation from permanently claiming another human's intended Hebun identity?

**Nothing.** Under "invitation possession only":

1. Attacker obtains the token (forwarded, intercepted, shoulder-surfed, or simply the wrong person in a group chat).
2. Attacker submits it and sets a password.
3. `users` row is created for `alice@acme.test`; `auth_identities` gets `subject='local:alice@acme.test'`; a credential is bound to it.
4. `users_email_uq` and `auth_identities_provider_issuer_subject_uq` now make that claim **exclusive and permanent**. The real Alice can never enrol — her email and her local subject are taken.
5. Nothing in the repository can distinguish the two, because nothing ever verified either.

**This is the blocker.** It is not a schema gap and not a missing function. It is a missing *proof channel*, and choosing one is a Director decision — §28.

---

## 8. Development credential quarantine analysis

`scripts/lib/provision-dev-credential.ts`. Four independent guarantees make it development-only:

1. **`assertLocalDatabaseUrl` (`:145`)** — parses `DATABASE_URL` and throws unless the hostname is `127.0.0.1`, `localhost`, or `::1`. Refusing a hosted database is a hard runtime refusal, not a warning.
2. **Location.** It lives under `scripts/`, outside the Next.js application tree. Its header: *"nothing in `src/` may import it, and a test enforces that."*
3. **`tests/d1-1-flow/provisioning-boundary.ts`** asserts the tool never emits `insert into memberships` / `update memberships` and stays inside the credential domain.
4. **Minimum password length 12 and interactive CLI framing** — an operator ceremony, not an API.

### The finding that matters for D-2

**The dev script does NOT use `insertPasswordCredential`.** It shares only `hashPassword` from `password-hash.server.ts` (`:14`) and issues its own raw SQL (`:120`). The two creation paths are entirely independent implementations.

Therefore:

> **The production-safe primitive can be reused without importing, touching, or weakening the development path.** Calling `insertPasswordCredential` from a product surface does not go near `scripts/`, does not relax `assertLocalDatabaseUrl`, and does not violate the boundary test — which only forbids the *reverse* direction.

The quarantine protects a *tool*. It does not quarantine the *capability*.

---

## 9. Current Session authority invariant

Traced through `issueLocalSession`, `resolveSessionFromReference`, `createAuthorizedAuthenticationResult`, `TenantContext`, and the live database constraints.

The exact current invariant, in repository terms:

```
AuthorizedAuthenticationResult
  = active local auth_identity  (status='active', verified_at NOT NULL, revoked_at NULL)
  + active users row            (lifecycle_status='active')
  + a verified password credential proof at issuance time
  + active membership           (status='active', lifecycle_status='active', revoked_at NULL, role_id NOT NULL)
  + active tenant               (companies.lifecycle_status='active', tenant_status='active',
                                 authentication_disabled_at IS NULL)
  + membership_version(session) == membership_version(live)
  + now < inactivity_expires_at AND now < absolute_expires_at
  + assurance_level = 'aal1', mfa_verified = false
```

Enforcement is layered:
- **Runtime, at issuance:** `session-service.server.ts:169-198`
- **Runtime, on every request:** `session-service.server.ts:302-332` (fail-closed on every anomaly)
- **Type, structurally:** `AuthorizedAuthenticationResult` carries a `unique symbol` brand, so it can be constructed **only** by `createAuthorizedAuthenticationResult`, which asserts `assertPositiveVersion(applicationSession.membershipVersion)` — a membership-less authorized result is unconstructible
- **Route gate:** `src/app/(dashboard)/layout.tsx` — `if (result.status !== "authorized") redirect("/login")` — an **allow-list**
- **Edge:** `src/middleware.ts` — cookie presence only, explicitly non-authoritative; `PUBLIC_PREFIXES = ["/login"]`

### The declared-but-unproduced states

`src/features/auth/types/authentication-result.ts` already declares five statuses. Two of them have **zero producers and zero consumers**:

```ts
OnboardingRequiredAuthenticationResult      { status: "onboarding-required", providerAuthentication }
TenantSelectionRequiredAuthenticationResult { status: "tenant-selection-required", canonicalIdentity, eligibleTenantIds }
```

Grep across `src/`, `scripts/`, `tests/`: the only hits are the declaration, the re-export in `types/index.ts`, and `tests/authentication-foundation/contracts.ts:107,114` — which asserts the union membership and nothing else. `AuthenticationServiceRequest.requestedTenantId?` (`authentication-service.ts:4`) is the same story: declared on a contract-only interface with no implementation.

**The authentication contract already anticipated both "authenticated but not yet onboarded" and "authenticated across several tenants". Neither was ever built.**

---

## 10. Why membership is required by session

Decomposed, because the distinction determines everything:

| Purpose | Does it require membership? | Evidence |
|---|---|---|
| authentication itself (who is this human) | **NO** | `findActiveLocalIdentityByEmail` + `verifyPasswordCredential` reference no membership table |
| tenant selection | **YES** | `findPrimaryActiveMembership` *is* the tenant selector |
| authorization | **YES** | `TenantContext.roleId` comes from `memberships.role_id`; every governed act resolves through it |
| `TenantContext` construction | **YES** | `tenantId`, `membershipId`, `membershipVersion`, `roleId` are all non-optional |
| route protection | **INDIRECTLY** | the layout gate demands `status === "authorized"`, which demands a `TenantContext` |
| session persistence shape | **NO** | `active_tenant_id` and `active_membership_id` are **nullable**; see §12 |

**Conclusion: membership is required for tenant selection and authorization. It is not required for authentication.** The current code fuses the two into one function, and that fusion is an implementation choice — the type union's own `onboarding-required` status proves the contract never intended them fused.

---

## 11. Exact authentication / membership dependency graph

Function by function, from the entry point:

```
loginAction                                        app/login/actions.ts:35
│
├─ getAuthEnvironment()                            env gate only — no DB
│
└─ issueLocalSession(db, env, {email,password})    auth-runtime/session-service.server.ts:123
   │
   ├─ [1] findActiveLocalIdentityByEmail(db,email) identity-repository.server.ts:89
   │       reads  users ⋈ auth_identities
   │       needs  users.lifecycle_status='active'
   │              auth_identities.provider='local' AND status='active'
   │                              AND lifecycle_status='active' AND revoked_at IS NULL
   │       MEMBERSHIP REFERENCED: ✗
   │
   ├─ [2] verifyPasswordCredential(db,identityId,pw)  credential-repository.server.ts:106
   │       reads  auth_credentials WHERE auth_identity_id = … AND status='active'
   │       MEMBERSHIP REFERENCED: ✗
   │
   ├─ [3] recordFailedAttempt / recordSuccessfulVerification   :199 / :224
   │       MEMBERSHIP REFERENCED: ✗
   │
   ├─ [4] findPrimaryActiveMembership(db,userId)   identity-repository.server.ts:124
   │       ◀──────────── FIRST MEMBERSHIP DEPENDENCY, line 169 of a 148-line function body
   │
   ├─ [5] tenant lifecycle checks (companies)      session-service.server.ts:178-190
   │
   ├─ [6] generateSessionReference → digestSessionReference → insertSessionContext   :200-226
   │       writes user_session_contexts WITH activeTenantId + activeMembershipId + membershipVersion
   │       (TS type SessionContextInsert declares all three non-nullable — a narrowing, not a constraint)
   │
   └─ [7] assembleAuthorized → createAuthorizedAuthenticationResult   :228 / :465
           asserts membershipVersion > 0; builds TenantContext (membershipId, roleId required)
```

Request-time path:

```
DashboardLayout                                    app/(dashboard)/layout.tsx
└─ resolveRequestAuthentication → resolveSessionFromReference   session-service.server.ts:277
   ├─ digest cookie with current key, then previous key         :287-299
   ├─ expiry window check                                       :302-307
   ├─ if (!activeTenantId || !activeMembershipId) → forbidden("tenant")   :308  ◀── the real gate
   ├─ identity / user / membership / role re-validation         :309-317
   ├─ membership VERSION equality                               :318-324
   ├─ tenant lifecycle                                          :325-332
   └─ assembleAuthorized → integrity gate
```

### Constitutional vs accidental coupling

| Coupling | Verdict |
|---|---|
| Steps [1]–[3] are membership-free | **already correct** — nothing to change |
| Step [4]–[5]: tenant selection needs a membership | **constitutional** — this is what a membership *is* |
| Step [6]: the session row must carry tenant+membership | **ACCIDENTAL** — the schema permits both NULL (§12) |
| Step [7]: `authorized` requires a `TenantContext` | **constitutional, and should stay** |
| `resolveSessionFromReference:308` rejects a null-tenant row | **ACCIDENTAL** for a *new status*; **constitutional** for `authorized` |

---

## 12. Is the deadlock real, or narrower than believed?

**It is narrower, and the part attributed to Session authority does not exist.**

### Proof that `user_session_contexts` can already hold a membership-less session

Read from the **live** `hebun_r1`, not from the schema file:

```
user_session_contexts_tenant_membership_chk
  CHECK ((active_tenant_id IS NULL) = (active_membership_id IS NULL))
        → both NULL evaluates true = true → PASSES

user_session_contexts_membership_version_chk
  CHECK (((active_membership_id IS NULL) AND (membership_version IS NULL))
      OR ((active_membership_id IS NOT NULL) AND (membership_version IS NOT NULL) AND (membership_version > 0)))
        → first branch PASSES with both NULL

user_session_contexts_tenant_membership_fk
  FOREIGN KEY (active_tenant_id, active_membership_id) REFERENCES memberships(tenant_id, id)
        → MATCH SIMPLE (the default): not enforced when any referencing column is NULL
```

NOT NULL columns on the table: `id`, `auth_identity_id`, `user_id`, `provider_session_reference_hash`, `provider_session_reference_digest_version`, `session_version`, `assurance_level`, `mfa_verified`, `authenticated_at`, `issued_at`, `last_activity_at`, `absolute_expires_at`, `inactivity_expires_at`, plus `rootColumns` bookkeeping.

**`active_tenant_id` and `active_membership_id` are nullable. Every NOT NULL column is satisfiable by a human who has an identity and no membership.**

Corroborating: `SessionResolutionRow.activeTenantId` is already typed `string | null` (`identity-repository.server.ts:62`) — the *read* side has always modelled the nullable case. Only `SessionContextInsert` narrows it, and a TypeScript interface is not a constraint.

### The corrected deadlock

The four-step cycle in the continuation state collapses to a two-step one, and it has nothing to do with sessions:

```
brand-new human
  → needs an ACTIVE auth_identity  ← no product writer exists (D-1)
  → needs an auth_credential       ← no product caller, and no proof standard (D-2)
```

Membership never enters it. **D-3 dissolves.** Both forbidden shortcuts become unnecessary:

- **Shortcut A** (membership before authentication) — not needed. Authentication was never blocked by membership.
- **Shortcut B** (relax the normal tenant session) — not needed. `authorized` keeps its full invariant; a *separate* status carries the pre-membership state, and the route gate is an allow-list, so nothing leaks.

### ⚠️ CONTRADICTION 3

The Gate A report stated: *"`user_session_contexts_tenant_membership_chk` makes the membership-less shape unrepresentable at rest."* **That is wrong.** The CHECK permits both NULL. What refuses a membership-less session is the resolver at `session-service.server.ts:308` and the `TenantContext` type — runtime and type layers, not the schema. The correction narrows the blocker and removes Session authority from it entirely.

---

## 13. Invitation possession proof strength

What a Hebun invitation token could honestly establish, at maximum:

> **The bearer possesses a capability that the Governance authority of Tenant T issued for a prospective membership, and which has not yet been spent, revoked, or expired.**

What it **cannot** establish:

| Claim | Can the token prove it? | Why not |
|---|---|---|
| legal identity | **No** | nothing binds a token to a legal person |
| email ownership | **No** | Hebun sends nothing; there is no channel to bind (§14) |
| existing Hebun identity | **No** | for a brand-new human no identity exists to bind to |
| credential ownership | **No** | it precedes any credential |
| authenticated-human status | **No** | a bearer capability is not authentication of a person |

The token is a **capability**, in the object-capability sense: authority in the bearer's hands, unbound to any principal. This is the same shape as `genesis_nominations`' `nomination_source = 'local-operator-ceremony'`, whose comment states the rule for the whole repository:

> *"READ THIS AS A LIMITATION, NOT A CREDENTIAL… Hebun cannot cryptographically identify the human at the terminal; possession of the deployment is the bootstrap trust assumption of this stage."*

An invitation's trust root would be **possession of the channel the Governance authority chose**, which is weaker than possession of the deployment (a channel is forwardable and interceptable; a terminal is not) and of the same kind.

---

## 14. Email ownership reality

Re-verified this turn. Exhaustive search of `src/`, `scripts/`, `package.json`, `.env.local`:

nodemailer · SMTP · Resend · SendGrid · Postmark · Mailgun · AWS SES · aws-sdk · Supabase email · notification providers · mail queues · email templates · delivery workers · mail secrets — **all absent, zero matches.**

Dependencies: `clsx`, `drizzle-orm`, `lucide-react`, `next`, `pg`, `react`, `react-dom`, `tailwind-merge`. Env keys: `HEBUN_AUTH_*`, `DATABASE_URL`, `HEBUN_PERSISTENCE_*`, `ANTHROPIC_API_KEY`, `HEBUN_MODEL_*`. Nothing mail-shaped.

`src/features/providers/communication/` "email" and "invitations" capabilities are a deterministic **mock** — its own text says "without actual delivery" and "rather than real sends".

**Therefore Hebun has no basis whatsoever for claiming email ownership**, and `invitations.last_sent_at` / `send_count` describe an act it cannot perform. Any architecture that assumes "the token reached the intended mailbox" is asserting something false.

---

## 15. Existing-human onboarding architecture

```
existing D1-verified human + valid invitation → membership → tenant access
```

| Question | Answer |
|---|---|
| Is Identity untouched? | **Yes.** `users` and `auth_identities` already exist and are `active`; `users_email_uq` would reject a duplicate anyway. |
| Is Credential untouched? | **Yes.** The human already holds an active credential; nothing is created or rotated. |
| Must the session be replaced or rotated after joining? | **Yes, in effect.** The session row's `active_tenant_id`/`active_membership_id`/`membership_version` are written once at issuance and only re-validated afterwards; nothing updates them. The human must sign out and in again — and even then, see the next row. |
| How does the target tenant get selected? | **It does not.** `findPrimaryActiveMembership` orders by `createdAt ASC, id ASC` and takes `limit 1`. The *oldest* membership always wins. |
| Does the current session model support multiple memberships? | **The schema does; the runtime does not.** One session row names one membership, which is correct — but nothing lets a human choose which. `tenant-selection-required` and `AuthenticationServiceRequest.requestedTenantId` are declared and unproduced (§9). |
| Does `findPrimaryActiveMembership` make the new tenant inaccessible? | **Yes.** Deterministically and permanently, for as long as the older membership stays active. |
| Is tenant switching a prerequisite for *useful* existing-human onboarding? | **Yes.** Without it, I2 produces a durable, correct, and completely unreachable membership. |

**Durable membership existence ≠ usable tenant access.** For a human whose only membership is the new one (an edge case that does not exist in `hebun_r1` today — both users already have one), the new membership *would* be reachable. For anyone who already belongs to a tenant, it would not.

---

## 16. Brand-new-human onboarding requirements

Minimum artifact set, with the owning authority and the current gap:

| # | Artifact | Authority | Writer exists? | Gap |
|---|---|---|---|---|
| 1 | `invitations` row + token digest | Invitation (new) | no | I2 builds it; schema complete |
| 2 | `users` row | Identity | **no** | D-1 |
| 3 | `auth_identities` row | Identity | **no** | D-1 + verification has no honest source |
| 4 | `auth_credentials` row | Credential | primitive yes, caller no | **D-2 — no proof standard** |
| 5 | pre-membership authenticated state | Session | no | **schema-ready today (§12)** |
| 6 | `memberships` row | Membership | **no** | I2 builds it |
| 7 | authorization consumption | Governance artifact | no | I2 writes it; primitive proven by G2 |
| 8 | normal tenant session | Session | yes, unchanged | none |

Six of eight are buildable. **The whole phase hinges on #4 — what proof precedes the first credential.**

---

## 17. Candidate architecture 1 — Two-Key Enrollment (G2.1 pattern)

The invitation is one key; the issuing Governance authority's in-product confirmation is the second. Neither alone establishes an identity.

```
Governance authority (verified human, normal tenant session)
        ↓  [I1 — already built]
Membership Authorization  (membership_authorizations, status='authorized')
        ↓  [KEY 1 — Invitation authority, one transaction]
Invitation  (token minted, digest stored, authorization consumed)
        ↓  raw token handed over OUT OF BAND by the authority — Hebun sends nothing
        ↓  [bearer acts, unauthenticated]
Enrollment submission
   → Identity authority creates:  users (if email unknown) + auth_identities status='pending', verified_at NULL
   → Credential authority creates: auth_credentials bound to that PENDING identity
   → NO session is issued. NO membership. The pending identity cannot sign in
     (findActiveLocalIdentityByEmail requires status='active').
        ↓  [KEY 2 — the issuing Governance authority, under their own verified session]
Enrollment confirmation
   → Identity authority transitions auth_identities: pending → active, verified_at = now
   → Membership authority creates the membership (tenant + role copied from the invitation row)
   → Invitation marked accepted (accepted_by_user_id = the enrolled user)
        ↓
Human signs in through the UNCHANGED /login path
        ↓
Session authority issues a NORMAL tenant session — invariant untouched
```

**Authority ownership.** Governance decides (already done at I1). Invitation issues and accepts. Identity creates and verifies. Credential enrols. Membership admits. Session authenticates. **I2 orchestrates; it owns no canonical truth.**

**Identity proof strength.** Two independent acts by two different humans, the second by someone with a durable verified session and Governance authority. A stolen token yields a `pending` identity that cannot authenticate and that the authority can see, refuse, or revoke.

**Token theft consequence.** An attacker can *submit* an enrollment. They cannot *activate* one. The real Alice is not permanently locked out only if the pending claim can be discarded — and `auth_identities` has no delete, only `revoked` (`auth_identities_revoked_chk` requires `is_primary = false`), so a rejected claim would sit as a revoked row. **A revoked local identity permanently occupies `(local, hebun-local, local:alice@…)` under `auth_identities_provider_issuer_subject_uq`.** That is a real consequence and must be designed for, not glossed.

**Email assumption.** None. Delivery is explicitly out-of-band, labelled as a limitation exactly as `GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR` is.

**Transactions.** (a) issuance + consumption; (b) enrollment submission — user + identity + credential; (c) confirmation — identity activation + membership + acceptance. Three transactions, three moments, three authorities.

**Schema impact.** `pending` identity: legal today. Credential on a pending identity: legal today (`auth_credentials` FKs only to `auth_identities.id`, with no status coupling). What has **no home** is *"who confirmed this identity, and on what basis"* — `auth_identities` has `verified_at` but no `verified_by` and no `verification_source`. G2.1 solved the identical problem with `nomination_source varchar(64)` + a CHECK on declared roots. → **one Gate B column** (§32).

**Tenant isolation.** Unchanged; the identity is global, and the tenant/role pair is copied from the invitation row whose composite FK already validated it.

**Replay.** Conditional `UPDATE … WHERE status='pending' AND expires_at > now()` returning zero rows, plus `memberships_accepted_invitation_uq` as the terminal backstop.

**Concurrency.** All invariants exist (§24).

**Audit.** Every act has a real, authenticated actor except the enrollment submission — see §25.

**UX.** Two-step, asynchronous, requires the authority to come back. Slow. Honest.

**Enterprise suitability.** Moderate. Acceptable at pilot scale; does not scale to hundreds of hires without the authority becoming a bottleneck.

**Future SSO compatibility.** **Good.** `auth_identities` is already `(provider, issuer, subject)`. An OIDC-verified identity would arrive with real proof and simply skip KEY 2.

**Changes an existing authority?** Identity gains a writer and a verification transition — inside its own module. Credential gains a caller for a primitive it already owns. Session: **untouched**. Governance: **untouched**. Membership: gains its first writer.

---

## 18. Candidate architecture 2 — Single-Act Enrollment (token is sufficient)

```
Governance authority → Membership Authorization → Invitation (token, out of band)
        ↓  [bearer acts, unauthenticated, ONE transaction]
users + auth_identities(status='active', verified_at=now) + auth_credentials
      + memberships + invitation accepted + authorization consumed
        ↓
Human signs in through the unchanged /login path → normal tenant session
```

**Authority ownership.** I2 would write into Identity, Credential and Membership in one transaction — a god-service crossing three authorities in a single act.

**Identity proof strength.** **Token possession only.** This is precisely *Shortcut A*: the invitation becomes Identity authority.

**Token theft consequence.** Catastrophic and irreversible. §7 step 4: the attacker's claim on the email and the local subject is made permanent by `users_email_uq` and `auth_identities_provider_issuer_subject_uq`.

**Schema impact.** Zero.
**UX.** Excellent — one click.
**Enterprise suitability.** Unacceptable.

### REJECTED

Explicitly forbidden by the Director's constraint, and independently indefensible: it lets an intercepted message permanently claim another human's Hebun identity, with no verification anywhere in the chain and no recovery path.

---

## 19. Candidate architecture 3 — Existing-Human-Only I2 (+ tenant selection prerequisite)

```
Governance authority → Membership Authorization → Invitation (token, out of band)
        ↓
Human signs in NORMALLY (they already have identity + credential + a membership somewhere)
        ↓  [under a verified TenantContext, one transaction]
Invitation accepted → membership created in the target tenant → authorization consumed
        ↓
Tenant selection lets them enter the new tenant   ← PREREQUISITE, does not exist
```

**Authority ownership.** Identity untouched, Credential untouched, Session untouched. Only Invitation and Membership are new. I2 is a pure orchestrator.

**Identity proof strength.** **Maximum available.** The acceptor is a fully authenticated human under a re-validated session; the invitation adds organizational entitlement on top of a proven identity — the correct layering.

**Token theft consequence.** Bounded. A thief must *also* be an authenticated Hebun human. The worst case is a wrong-but-real human joining a tenant, which is visible, attributable, and revocable — not an identity hijack.

**Email assumption.** None.
**Schema impact.** **Zero**, for the membership path. Tenant selection may need none either — `tenant-selection-required` and `requestedTenantId` are already declared, and `user_session_contexts` already stores one membership per session.
**Enterprise suitability.** Good for multi-tenant consultancies and partner access. Useless for hiring anyone new.
**Future SSO compatibility.** Perfect — it never touches identity establishment.

**The catch (§15):** without tenant selection, the new membership is unreachable. **Tenant selection is a prerequisite, not a nice-to-have.**

---

## 20. Candidate comparison

| Dimension | C1 Two-Key | C2 Single-Act | C3 Existing-Human-Only |
|---|---|---|---|
| Brand-new humans supported | **yes** | yes | **no** |
| Identity proof strength | medium (two humans) | **none** | **high** (full D1 session) |
| Token theft worst case | pending claim + a permanently occupied subject | **permanent identity hijack** | a real human in the wrong tenant |
| Changes Session authority | no | no | no |
| Changes Identity authority | gains writer + verification transition | gains writer, asserts false verification | **untouched** |
| Changes Credential authority | gains a caller | gains a caller | **untouched** |
| Schema change | **1 column (Gate B)** | zero | zero (+ tenant selection TBD) |
| Prerequisite phase | none | none | **tenant selection** |
| Audit actor for every act | one act has no actor (§25) | one act has no actor | **every act has a real actor** |
| Enterprise fit | moderate | unacceptable | good, but narrow |
| SSO forward-compat | good | poor | perfect |
| Director constraint respected | **yes** | **NO** | **yes** |

**C2 is rejected outright.** C1 and C3 are both defensible and they answer different questions: C1 answers the central question; C3 declines it honestly.

---

## 21. Security stress-test results

Tested against actual repository constraints. C1 = Two-Key, C3 = Existing-Human-Only.

### Token attacks

| Attack | C1 | C3 |
|---|---|---|
| stolen invitation | pending claim only; cannot activate | attacker must already be an authenticated Hebun human |
| forwarded invitation | same — the authority sees who submitted | same |
| replayed invitation | conditional `UPDATE … WHERE status='pending' AND expires_at > now()` → 0 rows | same |
| expired invitation | `expires_at` NOT NULL + CHECK, evaluated **in the predicate** (never by reading `status` alone — nothing writes `expired`) | same |
| revoked invitation | `status='revoked'` fails the same predicate | same |
| two simultaneous acceptances | `memberships_accepted_invitation_uq` (UNIQUE on `accepted_invitation_id`) is the terminal backstop | same |
| Tenant A token presented to Tenant B | tenant is **read from the invitation row**, never from the request | same |
| authorization id guessed without a token | lookup is **by digest**, never by row id; `invitations_token_hash_uq` is global; 256-bit entropy | same |

### Identity attacks

| Attack | C1 | C3 |
|---|---|---|
| attacker claims the invited email | **submits** a pending claim; cannot activate. **Residual risk:** a revoked claim permanently occupies `(local, hebun-local, local:<email>)` under the triple-unique index | **impossible** — no identity is created |
| existing user uses an invitation meant for another identity | not prevented today: no rule compares `session.user.email` to `invitations.normalized_email`. Columns exist to add one. **Director decision.** | same |
| two users race for one invitation | exactly one wins (conditional update + `memberships_accepted_invitation_uq`); the loser gets `23505`, mapped to an honest refusal via the repository's `isUniqueViolation(err, constraintName)` pattern | same |
| new identity created twice | `users_email_uq` + `auth_identities_provider_issuer_subject_uq` | n/a |
| one local subject bound to several users | `auth_identities_provider_issuer_subject_uq` | n/a |
| invitation possession treated as authentication | **prevented** — a pending identity is invisible to `findActiveLocalIdentityByEmail` | **prevented** — no path exists |

### Credential attacks

| Attack | C1 | C3 |
|---|---|---|
| password set before identity proof | **occurs by design**, but the credential is bound to a **pending** identity that cannot authenticate. The credential becomes usable only after KEY 2. | n/a |
| duplicate active credentials | `auth_credentials_active_identity_type_uq` (partial UNIQUE WHERE `status='active'`) | n/a |
| credential created for the wrong user | the identity is created in the same transaction from the invitation's email; nothing is looked up by client input | n/a |
| password leaked to logs / audit | `salt`/`secret_hash` never leave `credential-repository.server.ts` (structural test); audit metadata is ids and bands only (G1 doctrine) | n/a |
| dev provisioning path imported into production | forbidden by test; and reusing `insertPasswordCredential` does not touch `scripts/` at all (§8) | n/a |

### Membership attacks

| Attack | Both C1 and C3 |
|---|---|
| membership created before required proof | C1: only after KEY 2. C3: only under a verified `TenantContext`. |
| owner/director substituted for the intended role | `intended_role_id` is fixed at I1 time and `ONBOARDING_ELIGIBLE_ROLE_TYPES` permits `member` only; `owner`, `director`, `operator`, `auditor` are explicitly excluded |
| role changed client-side | the role is copied from the invitation row; the client supplies only the token |
| tenant changed client-side | same |
| one invitation creates two memberships | `memberships_accepted_invitation_uq` |
| one authorization creates several invitations | `consumed_by_invitation_id` is single-valued + `consumed_status_chk` + the conditional-update primitive proven by G2 |

### Session attacks — against C1's pre-membership state

| Attack | Result |
|---|---|
| pre-membership state reaches a protected tenant route | **impossible.** `app/(dashboard)/layout.tsx` is an **allow-list**: `if (result.status !== "authorized") redirect("/login")`. Any new status is refused by construction. |
| pre-membership state resolves a `TenantContext` | **impossible.** `resolveTenantContext` returns non-null only for `status === "authorized"`, and `AuthorizedAuthenticationResult` carries a `unique symbol` brand producible only by `createAuthorizedAuthenticationResult`, which asserts `membershipVersion > 0`. |
| pre-membership state obtains Governance authority | **impossible.** Every governed action takes `TenantContext \| null` and refuses null before doing anything (`governance/authority/actions.ts`, `governance/genesis/actions.ts`). |
| pre-membership state obtains Knowledge authoring | **impossible.** `knowledge/actions.ts` — same guard, six call sites. |
| pre-membership state reaches providers | **impossible.** `platform/actions.ts:27` — `if (!tenant) return { status: "unauthorized" }` before the role-band check. |
| pre-membership state silently becomes a normal session | **impossible without a code change.** `resolveSessionFromReference:308` returns `forbidden("tenant")` for any row with a null tenant. Upgrading would require an explicit, reviewable membership write. |

**In C1 the pre-membership state is inert by construction, not by discipline.** Its safety comes from an allow-list gate plus a branded type, both of which already exist.

---

## 22. Tenant isolation

| Property | Status |
|---|---|
| identity is global, not tenant-scoped | correct by design — `users` and `auth_identities` use `rootColumns` |
| credential is global | correct — `auth_credentials` uses `rootColumns`; its header states it carries no tenant, membership or role |
| invitation is tenant-bound | `invitations.tenant_id` NOT NULL + composite `invitations_tenant_role_fk` |
| authorization is tenant-bound | `membership_authorizations_tenant_role_fk` |
| membership tenant/role pair | **copied from one invitation row** whose composite FK already validated the pair — a database-proven pair, not an application check |
| **`memberships` composite tenant-role FK** | **STILL ABSENT.** Verified again against the live DB: `memberships_role_id_roles_id_fk` is single-column. Both sibling tables have the composite form; `memberships` does not. |
| session is tenant-bound when authorized | `user_session_contexts_tenant_membership_fk`, composite |
| pre-membership session carries no tenant | by definition — both columns NULL |

Pre-existing gap, not one I2 creates. Optional Gate B item (§32, B-1).

---

## 23. Transaction boundaries

**Candidate 1 — three transactions:**

| Tx | Contents | Rollback meaning |
|---|---|---|
| **T1** issuance | `invitations` insert + authorization `consumed` (conditional) + audit | if the invitation fails, the authorization is not spent |
| **T2** enrollment submission | `users` (or find) + `auth_identities` `pending` + `auth_credentials` + audit | a credential without its identity is unrepresentable |
| **T3** confirmation | identity `pending → active` + `verified_at` + `memberships` insert + invitation `accepted` (conditional) + authorization/audit | a membership without an activated identity is unrepresentable |

**Candidate 3 — two transactions:**

| Tx | Contents |
|---|---|
| **T1** issuance | as above |
| **T2** acceptance | invitation `accepted` (conditional) + `memberships` insert + audit |

**Never in one transaction, in either candidate:** the Governance decision (I1, a different moment and authority) and the token mint; and the human's authentication, which is the human's act, not the tenant's write.

---

## 24. Concurrency requirements

Every invariant already has a database-level defense. None requires `SELECT none → INSERT`.

| Race | Defense | Precedent on disk |
|---|---|---|
| two issuances from one authorization | conditional `UPDATE … WHERE status='authorized' AND consumed_at IS NULL RETURNING id`; 0 rows → abort | `bootstrap-authority.server.ts:282-304` (`EntitlementRaceLost`), proven by `tests/g2-flow/governance-concurrency-postgres.ts` |
| two accepts of one invitation | conditional `UPDATE invitations … WHERE status='pending' AND expires_at > now()` **plus** `memberships_accepted_invitation_uq` | — |
| two memberships, same human + tenant | `memberships_tenant_user_uq` | — |
| two enrollments for the same email (C1) | `users_email_uq` + `auth_identities_provider_issuer_subject_uq` | — |
| two credentials for one identity | `auth_credentials_active_identity_type_uq` | — |
| two authorizations, same email + tenant | `membership_authorizations_one_active_per_email_uq` | proven by `tests/i1-flow/authorization-concurrency-postgres.ts` |
| two member-role provisionings | `roles_one_member_per_tenant_uq` | proven by `tests/i1-1-flow/provisioning-concurrency-postgres.ts` |

Race losses are turned into honest refusals with the established `isUniqueViolation(error, constraintName)` helper, which matches **both** SQLSTATE `23505` and the constraint name.

---

## 25. Audit implications

Use the existing `audit_log` sink. `action` and `entity_type` are free text, so a new domain costs **zero schema** — the pattern three sibling writers already follow (G1 Knowledge, G2.1 genesis, G2/G3/I1/I1.1 governance).

| Event | Truthfully recordable? |
|---|---|
| invitation issued | **yes** — actor is the issuing Governance authority |
| enrollment submitted (C1, T2) | **PROBLEM** — the submitter is unauthenticated. `audit_log.actor_type` (enum) and `actor_id` (uuid) are both NOT NULL, and `GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts` is `false` by doctrine. |
| enrollment confirmed (C1, T3) | **yes** — actor is the confirming authority |
| invitation accepted (C3) | **yes** — actor is the accepting human |
| membership created | **yes** |
| acceptance refused, authenticated caller | **yes**, as `rejected` |
| acceptance refused, anonymous caller | **no representable actor** |

**A workable framing for C1's T2:** the enrollment submission's audit row could name the *created user* as the actor — that row exists by the end of the transaction, and the event is genuinely about that person. This is a design point, not a Gate A conclusion, and it must not be decided by convenience.

**Never in audit:** the raw token, the digest, the password, the salt, the hash, or a duplicate of the email. `membership_authorizations.normalized_email` is the single owner of the address (I1 doctrine); the audit row carries ids and bands only.

---

## 26. Future SSO / OIDC compatibility

`auth_identities` was built for this and says so: *"Provider-neutral authentication identities."*

- `(provider, issuer, subject)` is the OIDC tuple verbatim. `hebun-local` / `local:<email>` is one issuer among many.
- `AuthenticationProvider` (`auth/provider/authentication-provider.ts`) is an interface with a cookie-access port and a token-free `ProviderAuthentication` return — and a contract test asserts the provider result contains no `accessToken`, `refreshToken`, `cookie` or `session`.
- `auth_credentials.credential_type` is an enum holding `password` only — adding `passkey` or `totp` is a deliberate schema decision, exactly as its header intends.
- `assurance_level` already accepts `aal1 | aal2 | aal3` and `mfa_verified` is CHECK-coupled to `aal2`/`aal3`. MFA has a home before it has an implementation.
- `onboarding-required` in the result union is the natural landing state for an OIDC human with no membership.

**Candidate 1 is forward-compatible:** an externally-verified identity arrives with real proof and skips KEY 2, leaving the rest of the chain unchanged.
**Candidate 3 is trivially compatible:** it never touches identity establishment.
**Candidate 2 would have to be dismantled** — it hard-codes "the token verified them", which no external IdP would ever agree with.

---

## 27. D-1 decision — who owns creation of `users` and `auth_identities`?

## **EXISTING IDENTITY AUTHORITY.**

Repository evidence supports this and does not support the alternatives:

- The tables carry a complete, non-trivial lifecycle: a `pending` default, a `verified_at`-coupled `active` CHECK, revocation with paired when/why, primary-identity partial uniqueness, temporal ordering CHECKs. **This is a designed authority missing a writer, not an undesigned one.**
- A dedicated resolver module already owns lookup (`identity-repository.server.ts`).
- The provider abstraction is already provider-neutral, which only makes sense if identity establishment was always meant to live here.
- The precedent is one phase old: **I1.1 added the first product writer for `roles`**, a table that had schema, seed rows, and no writer. Nobody invented a "Role authority" to do it.

**Not I2.** I2 must call the Identity authority's writer, never insert into `users` or `auth_identities` itself — the same discipline I1 enforces with its structural firewall test (`tests/i1-flow/boundaries-and-firewall.ts:98` forbids I1 from even *importing* `@/db/schema/user`).

**Not a new authority.** Creating one would fragment a coherent domain.

**Caveat carried forward:** creating an identity is answerable. *Verifying* one is not — §28.

---

## 28. D-2 decision — who owns first credential enrollment?

## **EXISTING CREDENTIAL AUTHORITY owns the mechanism. The PROOF STANDARD is UNRESOLVED and requires a Director decision.**

**Resolved half.** `insertPasswordCredential` lives inside `credential-repository.server.ts` beside verify, lockout and revoke; uses the authority's own types; relies on the authority's own partial unique index. It is an **unused helper inside an established authority**, not dev tooling. Reusing it does not touch `scripts/` (§8) — the dev script never called it and issues its own raw SQL. Adding a product caller is finishing the wiring, not moving an authority.

**Unresolved half — and this is the phase blocker.**

> **What proof must a brand-new human provide before Hebun will hold a credential for them?**

The repository has **no precedent**: the only enrolment ever performed was by an operator with local database access, whose proof was possession of the machine. The candidates differ in security posture, not in convenience:

| Option | Proof | Verdict |
|---|---|---|
| **P1** invitation possession alone | none | **forbidden by the Director, and independently indefensible** (§7 step 4) |
| **P2** two-key: token + Governance-authority confirmation | two humans, one with a verified session | viable; repository-precedented by G2.1; costs one Gate B column |
| **P3** email verification | control of the mailbox | needs a mail runtime — a dependency, a provider, secrets, and a phase of its own |
| **P4** external IdP (OIDC / passkey) | an external verified subject | strongest and most enterprise-suitable; largest scope; `auth_identities` is already shaped for it |
| **P5** none — existing humans only | n/a | honest; abandons the central question |

**Recommendation: P2**, because it is the only option that (a) stays entirely inside existing authorities, (b) has an exact repository precedent, (c) never lets token possession alone establish anything durable and active, and (d) is forward-compatible with P4.

**Residual risk of P2, stated plainly:** a rejected enrollment leaves a revoked `auth_identities` row permanently occupying `(local, hebun-local, local:<email>)` under a global unique index. Whether that is acceptable, and what the recovery path is, is part of the same decision.

---

## 29. D-3 decision — how should authentication exist before membership?

## **SEPARATE PRE-MEMBERSHIP STATE INSIDE SESSION AUTHORITY — and it is far cheaper than believed, because the deadlock it was meant to solve does not exist.**

Evidence:

1. **Authentication is already membership-free.** Steps [1]–[3] of `issueLocalSession` reference no membership table (§11). Only *normal tenant session issuance* requires one.
2. **`user_session_contexts` can already hold a membership-less row.** Both columns are nullable, both CHECKs permit both-NULL, and the composite FK is MATCH SIMPLE (§12). **Zero schema change.**
3. **The contract already declares the state.** `onboarding-required` and `tenant-selection-required` sit in the result union with zero producers (§9).
4. **It cannot leak.** The dashboard gate is an allow-list and `AuthorizedAuthenticationResult` is `unique symbol`-branded, so a pre-membership state reaches nothing (§21, Session attacks).

This is **not Shortcut B.** The normal tenant session invariant is untouched: `authorized` still requires identity + credential + membership + tenant + version equality. A *separate, additional* status is produced for a different situation. Nothing is relaxed.

**However** — and this is why the phase is still blocked — a pre-membership state is only *reachable* by a human who already has an active identity and a credential. Those are D-1 and D-2. **D-3 is resolved and is no longer the blocker.**

---

## 30. I2 authority-vs-orchestrator decision

## **I2 IS AN ORCHESTRATOR. It owns exactly one new canonical truth: the invitation.**

Canonical truth already has owners for everything else:

| Truth | Owner | I2's role |
|---|---|---|
| who may admit a human | Governance (I1) | reads |
| which roles a tenant has | Role (I1.1) | reads |
| **the invitation artifact and its token** | **Invitation — new, and I2 owns it** | **writes** |
| who a person is | Identity | calls |
| what they prove | Credential | calls |
| the session receipt | Session | calls |
| standing inside a tenant | Membership | calls |
| history | shared `audit_log` | appends |

Proposed call/authority graph (Candidate 1):

```
                    ┌──────────────────────────────────────────┐
                    │  Governance authority  (G2 / G3)         │
                    └───────────────┬──────────────────────────┘
                                    │ resolveGovernanceAuthority — ONE resolver, unchanged
                    ┌───────────────▼──────────────────────────┐
                    │  I1 Membership Authorization             │  membership_authorizations
                    └───────────────┬──────────────────────────┘
                                    │ consumed exactly once (G2's conditional-update primitive)
        ╔═══════════════════════════▼══════════════════════════╗
        ║  I2 ORCHESTRATOR                                     ║
        ║   owns: invitations (issue / verify / accept)        ║
        ║   owns NO identity, credential, session or role      ║
        ╚═══╤═══════════════╤═══════════════╤══════════════╤═══╝
            │ calls         │ calls         │ calls        │ appends
   ┌────────▼─────┐ ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
   │  Identity    │ │  Credential  │ │  Membership │ │ audit_log  │
   │  users       │ │ auth_creds   │ │ memberships │ │  (shared)  │
   │ auth_ident.  │ │              │ │             │ │            │
   └──────────────┘ └──────────────┘ └─────────────┘ └────────────┘
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │  Session authority — UNCHANGED           │
                    │  normal tenant session via /login        │
                    └──────────────────────────────────────────┘
```

I1's structural firewall test is the template: **I2 must not import `@/db/schema/user`, `auth-identity`, `auth-credential`, or `membership` directly.** It calls the owning module, and a boundary test enforces it.

---

## 31. Schema sufficiency

| Need | Sufficient today? | Evidence |
|---|---|---|
| invitation issuance + token digest | **yes** | `token_hash char(64)` + `^[0-9a-f]{64}$` + global unique + `token_version`; matches `session-digest.server.ts` exactly |
| one-time authorization consumption | **yes** | single-valued column + two CHECKs + partial unique + G2's proven primitive |
| invitation expiry | **yes** | `expires_at` NOT NULL + CHECK; evaluate in the predicate, never by reading `status` |
| invitation revocation | **yes** | full column set + CHECK, present in the live DB |
| acceptance | **yes** | `accepted_at` + `accepted_by_user_id` + `invitations_accepted_chk` |
| membership creation | **yes** | `memberships_tenant_user_uq` + `accepted_invitation_id` + `memberships_accepted_invitation_uq` |
| **pre-membership session** | **YES — zero change** | both columns nullable, both CHECKs permit both-NULL, FK is MATCH SIMPLE (§12) |
| pending identity | **yes** | `status` default `pending`; `auth_identities_active_chk` couples `active` to `verified_at` |
| credential on a pending identity | **yes** | `auth_credentials` FKs to `auth_identities.id` with no status coupling |
| audit for the whole lifecycle | **yes** | free-text `action`/`entity_type`; zero migrations — except the anonymous-actor case (§25) |
| **"who verified this identity, on what basis"** | **NO** | `auth_identities` has `verified_at` but no `verified_by` and no `verification_source`. G2.1 solved the identical problem with `nomination_source` + CHECK. |
| invitation provenance on the invitation | no | no `membership_authorization_id`; link is one-way |
| forbid an agent inviter | no | no `inviter_type = 'human'` CHECK |
| composite tenant-role FK on `memberships` | no | single-column FK (§22) |

---

## 32. Gate B requirement, if any

**Candidate 3 (existing-human-only): NO GATE B.** Zero migrations.

**Candidate 1 (two-key): ONE Gate B item, and it is authoritative rather than convenient.**

| # | Change | Why it is an authoritative fact with no existing owner |
|---|---|---|
| **B-0** | `auth_identities`: add `verification_source varchar(64)` (nullable) + CHECK restricting it to declared roots, and a CHECK pairing it with `verified_at` | `verified_at` currently records *that* an identity was verified and is silent on *what proof was accepted*. Today's two rows were verified by a seed's `now()` with no proof at all. Without this column, a two-key confirmation and a seed assertion are indistinguishable forever. This is exactly the problem `genesis_nominations.nomination_source` was created to solve, with the same "READ THIS AS A LIMITATION, NOT A CREDENTIAL" framing. |

**Optional, not required, carried forward from Gate A §25:**

| # | Change | Note |
|---|---|---|
| B-1 | `memberships`: composite FK `(tenant_id, role_id) → roles(tenant_id, id)` | closes §22; both sibling tables already have it |
| B-2 | `invitations`: `membership_authorization_id` + composite tenant FK | lets an invitation state its own provenance |
| B-3 | `invitations`: CHECK `inviter_type = 'human'` | mirrors `membership_authorizations_human_authorizer_chk` |

**No migration was generated. No enum was modified. No schema was edited.**

---

## 33. Recommended phase boundary

## **OPTION B — ONE prerequisite phase before I2**, *if* the Director selects P2 (two-key).

D-1 and D-2's mechanism belong to authorities that already exist and are one writer short each. They do **not** justify separate phases — but they do justify **one** phase, because together they constitute a distinct runtime boundary that I2 must be forbidden from crossing.

**Proposed prerequisite — I1.2, Identity & Credential Enrollment Authority**

*Responsibility:* establish a **new human's** person record, provider-neutral identity, and first credential — under a stated, durable verification source.

*Hard boundaries — it must NOT:*
- issue any session, or touch `user_session_contexts`
- create, read, or modify `memberships`, `roles`, or `companies`
- create, read, or modify `invitations` or `membership_authorizations`
- make a Governance decision, or resolve Governance authority for anything but the second key
- import anything from `scripts/`
- send anything, anywhere
- activate an identity without recording `verification_source`

*Why it owns a distinct boundary:* it is the only runtime that turns a human who is **not** in Hebun into one who **is**. That is a different act from admitting an existing human to a tenant (I2), from deciding who may be admitted (I1), and from proving a password (D1). It is exactly the boundary `auth_identities.status='pending'` was designed for and that nothing has ever crossed.

*I2 then becomes a pure orchestrator* (§30), calling I1.2 for a brand-new human and calling nothing for an existing one.

**OPTION D — existing-human-only I2 — remains fully available and needs no prerequisite phase**, but it has its own prerequisite for *usefulness*: **tenant selection** (§15). That is a separate, smaller phase, and `tenant-selection-required` + `requestedTenantId` are already declared for it.

**Option A (solve D-1/D-2 inside I2) is rejected:** it would make I2 an authority over identity and credentials, which §30 shows it must not be.
**Option C (multiple prerequisite phases) is rejected:** identity creation and first credential enrollment happen in one moment for one human under one proof. Splitting them would be organizational neatness, not an authority boundary.

---

## 34. Explicit non-capabilities

Whatever is built next does **not** provide:

- email, SMS, or delivery of any kind, nor any proof a token reached its recipient
- email-address verification
- SSO, OIDC, SAML, passkeys, or MFA
- password recovery, reset, or self-service rotation
- self-service signup
- tenant switching, or any use of a second membership
- membership editing, suspension, or revocation
- role management, editing, deletion, hierarchy, or a permissions runtime
- authorization expiry
- an invitation-expiry sweeper (`status='expired'` stays unwritten)
- identity merging, or recovery of an email claimed by a rejected enrollment
- any change to the `authorized` session invariant
- Governance authority, ratification authority, provider access, or execution / Computer Use / terminal authority

---

## 35. Repository contradictions discovered

**CONTRADICTION 1 — changed-file count.** Continuation state says 25; disk says 27. Cause: `learnings.md` and the Gate A report, both written by the previous audit turn. Documentation only. **Reported, benign, continuing from disk.**

**CONTRADICTION 2 — the D-3 deadlock is not a four-step cycle.** "Needs authenticated session → session requires membership" is false. Credential verification is membership-free and always has been; only normal tenant session issuance requires a membership, three calls later (§11).

**CONTRADICTION 3 — the Gate A report was wrong about the schema.** It claimed `user_session_contexts_tenant_membership_chk` makes a membership-less session "unrepresentable at rest". The CHECK permits both NULL. The refusal lives in the resolver and the type, not in Postgres (§12). **This correction is what dissolves D-3.**

**CONTRADICTION 4 — declared-but-unbuilt authentication states.** `onboarding-required` and `tenant-selection-required` are in the result union, re-exported, and asserted by a contract test, with **zero producers and zero consumers**. `AuthenticationServiceRequest.requestedTenantId` and the whole `AuthenticationService` interface are likewise contract-only. The contract has always described a system larger than the runtime.

**CONTRADICTION 5 — "verified" identities were never verified.** Both live `auth_identities` rows carry `verified_at = 2026-08-10 10:29:12`, written by `scripts/r1-seed.mjs`'s `now()`. No verification event ever occurred, and no code path could perform one. Any future claim that Hebun verifies local identities would be false unless something is built to make it true.

---

## 36. Remaining unresolved questions

1. **What proof must precede a first credential?** (D-2 — §28. The blocker.)
2. **Must an accepting human's identity match `invitations.normalized_email`?** Columns exist; no rule does. A Director decision either way.
3. **If a two-key enrollment is rejected, what happens to the claimed email?** A revoked identity permanently occupies the global `(provider, issuer, subject)` slot. Needs a designed recovery path or an accepted limitation.
4. **Which audit actor represents an unauthenticated enrollment submission?** `audit_log.actor_id` is NOT NULL (§25).
5. **Does the authorization get consumed at issuance or at acceptance?** G2's precedent says issuance; the Gate A report recommended it; still formally the Director's call.
6. **Is tenant selection in scope at all?** It gates whether existing-human onboarding produces anything usable (§15).

---

## 37. Final architecture graph

Recommended end state, assuming P2 and the I1.2 prerequisite:

```
   HUMAN A (Governance authority, verified, normal tenant session)
        │
        │  ① authorize one future onboarding            [I1 — BUILT]
        ▼
   membership_authorizations (authorized)
        │
        │  ② issue invitation, spend the authorization  [I2 · Invitation authority]
        ▼                                                one transaction
   invitations (pending, digest stored, expires_at set)
        │
        │  ③ raw token handed over OUT OF BAND — Hebun sends nothing
        ▼
   HUMAN B (brand new, unauthenticated)
        │
        │  ④ submit enrollment                          [I1.2 · Identity + Credential]
        ▼                                                one transaction
   users + auth_identities(PENDING, verified_at NULL) + auth_credentials
        │                    ↑ cannot sign in: findActiveLocalIdentityByEmail requires 'active'
        │
        │  ⑤ confirm enrollment                         [KEY 2 — HUMAN A, verified session]
        ▼                                                one transaction
   auth_identities → ACTIVE, verified_at set, verification_source recorded   [Gate B B-0]
   memberships created (tenant + role copied from the invitation row)
   invitations → accepted (accepted_by_user_id = HUMAN B)
        │
        │  ⑥ HUMAN B signs in through the UNCHANGED /login
        ▼
   user_session_contexts → NORMAL tenant session
   authorized = identity + credential + membership + tenant + version equality
                          ↑ INVARIANT UNCHANGED THROUGHOUT
```

The pre-membership session state (§29) is available and schema-ready, and in this graph it is **not required** — enrollment and confirmation both happen without one. It remains the correct home for a future OIDC human who authenticates before belonging anywhere.

---

## 38. Final verdict

# I2 BLOCKER UNRESOLVED — DIRECTOR DECISION REQUIRED

Two of the three blockers are resolved from repository evidence:

- **D-1 — RESOLVED.** The existing **Identity authority** owns `users` and `auth_identities`. The tables carry a complete designed lifecycle including a `pending` state; what is missing is a writer, and I1.1 set the precedent one phase ago by adding the first product writer for `roles`. I2 must call it, never write those tables itself.
- **D-3 — RESOLVED, and it was never the blocker.** Authentication is already membership-free; only normal tenant session issuance requires a membership. `user_session_contexts` can hold a membership-less row **today with zero schema change** — both columns are nullable, both CHECKs permit both-NULL, and the FK is MATCH SIMPLE. The result union already declares `onboarding-required`. The dashboard gate is an allow-list and `AuthorizedAuthenticationResult` is `unique symbol`-branded, so such a state reaches nothing. Neither forbidden shortcut is needed.
- **D-2 — UNRESOLVED.** The **Credential authority** owns the mechanism (`insertPasswordCredential` sits inside it and does not touch the quarantined dev script). But **what proof must precede a first credential has no repository answer**, and choosing one changes the security posture of the entire product.

## The decision — one question

> **What proof must a brand-new human provide before Hebun will hold a credential for them?**

| Option | What it means | Cost | Consequence |
|---|---|---|---|
| **P1** invitation possession alone | token → identity + credential in one act | zero | **an intercepted invitation permanently claims another human's Hebun identity.** Forbidden, and indefensible. |
| **P2** two-key enrollment ⭐ | bearer submits a *pending* identity + credential; the issuing Governance authority confirms it under their own verified session | **one Gate B column** (`auth_identities.verification_source`) + one prerequisite phase (I1.2) | token possession alone establishes nothing usable; slow; a rejected claim occupies the email slot |
| **P3** email verification | control of the mailbox | a mail dependency, a provider, secrets, a phase of its own | strongest common standard; largest new surface |
| **P4** external IdP (OIDC / passkey) | an externally verified subject | large; `auth_identities` is already shaped for it | best enterprise fit; furthest out |
| **P5** existing-human-only I2 | brand-new humans stay unsupported | zero schema — but **tenant selection becomes a prerequisite for usefulness** | honest; declines the central question |

## Recommendation

**P2, with I1.2 as a single prerequisite phase** — it is the only option that stays inside existing authorities, has an exact repository precedent (G2.1's two keys, where neither act alone establishes anything), never lets a token alone establish an active identity, and remains forward-compatible with P4.

**If P2 is too heavy for now: P5.** It ships something true immediately and costs nothing architecturally — provided the Director accepts that tenant selection must follow, or the new membership is unreachable.

## Answer to the central question, as far as evidence allows

> *How can a brand-new human be securely onboarded from a Governance-authorized invitation into an authenticated tenant member without letting invitation possession become Identity authority and without weakening the normal tenant-session invariant?*

**The session half is answered and costs nothing:** authentication was never coupled to membership, the session table already permits a membership-less row, and the result union already names the state. The `authorized` invariant does not have to move a millimetre.

**The identity half cannot be answered by this repository.** Hebun has no channel that binds a token to a human. Every brand-new-human architecture must therefore accept *some* substitute proof, and the repository offers exactly one precedent for choosing honestly: G2.1's two keys, where the trust root sits outside the application and is labelled a limitation rather than a credential. Selecting that — or paying for a real proof channel — is the Director's decision, not a fact on disk.

**STOPPING HERE.** No implementation. No new module, route, or UI. No user, identity, credential, invitation, membership, or session created. No authority altered. No enum, table, column, index, or constraint touched. No migration generated or applied. `hebun_r1` read only. Leftover database observed and untouched. No commit, no tag, no push.
