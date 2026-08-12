# HEBUN I2 GATE A — HUMAN ONBOARDING AUTHORITY AUDIT

**Phase:** I2 (Human Onboarding Runtime) — Gate A, audit only
**Date:** 2026-08-12
**Scope:** Read-only. No implementation, no migration, no schema change, no commit, no tag, no push.
**Verdict:** see §26.

---

## 1. Repository baseline proof

Every value below was measured, not recalled.

| Fact | Measured value |
|---|---|
| Branch | `main` |
| HEAD | `872b753483b4402e561b242b7a7c85c20da40664` |
| `origin/main` | `872b753483b4402e561b242b7a7c85c20da40664` |
| Ahead / behind | `0 / 0` |
| Working tree | dirty — 14 modified, 11 untracked |
| Changed-file count | 25 |
| Staged | nothing (`git diff --cached --name-only` empty) |
| Migration files on disk | 22 |
| `_journal.json` entries | 22 (idx 0–21) |
| Dependencies | `node_modules` present, Node v24.16.0 |
| Lint | PASS |
| Typecheck | PASS |
| Tests | **335 PASS / 0 FAIL** (345 test files, 335 executed suites) |
| Build | PASS |
| `npm run verify` exit | **0** |

I1 files present: `src/features/membership-authority/{authorize-membership.server.ts, contracts.ts, read-membership-authorizations.server.ts}`, `src/db/schema/membership-authorization.ts`, `src/components/governance-authority/membership-authorization-card.tsx`, `tests/i1-flow/{boundaries-and-firewall,membership-authorization-postgres,authorization-concurrency-postgres}.ts`.

I1.1 files present: `src/features/tenant-role-baseline/{provision-member-role.server.ts, contracts.ts}`, `src/components/governance-authority/member-role-provisioning-card.tsx`, `tests/i1-1-flow/{boundaries-and-firewall,role-baseline-postgres,provisioning-concurrency-postgres}.ts`.

I1 migration: `20260812090301_i1_membership_authorization.sql` — present, untracked.
I1.1 migration: `20260812105312_i1_1_tenant_role_baseline.sql` — present, untracked.

### Durable database `hebun_r1` (read-only probe, nothing mutated)

| Fact | Measured value |
|---|---|
| Applied migrations (`drizzle.__drizzle_migrations`) | **20** |
| `membership_authorizations` table | **absent** (`to_regclass` → null) |
| `roles_one_member_per_tenant_uq` | **absent** (indexes: `roles_pkey`, `roles_tenant_id_id_uq`) |
| `roles` rows | 2 — both `type = 'owner'`, one per tenant |
| `users` / `auth_identities` / `auth_credentials` | 2 / 2 / 2 |
| `memberships` | 2 |
| `invitations` | **0** |
| `companies` | 2 |

**No contradiction with the continuation state.** Disk reality and database reality both match what was stated: 22 migrations on disk, 20 applied, I1/I1.1 uncommitted and unapplied.

### Leftover database — reported, not touched

`hebun_test_hebun_i1_membership_1c8a8356214345b5` **exists** on `127.0.0.1:55432`. It was not used, mutated, dropped, or swept. Ownership was not inferred from its name. Reported only, per the D1.1 invariant.

---

## 2. Existing invitation authority

**There is none.** `invitations` is schema-only with zero rows and zero production code.

| Reference | Kind |
|---|---|
| `src/db/schema/invitation.ts` | the table definition itself |
| `src/db/schema/membership.ts:47` | FK target — `memberships.accepted_invitation_id` |
| `src/db/schema/membership-authorization.ts:127` | FK target — `consumed_by_invitation_id` |
| `tests/authentication-schema/migration.ts` | raw-SQL constraint proofs |
| `tests/i1-flow/*`, `tests/i1-1-flow/*` | assert the count stays **0** |

**Zero writers. Zero readers. No repository, no service, no server action, no surface.** Nothing in `src/` or `scripts/` selects from or inserts into `invitations`.

**Not the invitation authority:** `src/features/providers/communication/` exposes a capability literal `"invitations"`. It is a deterministic simulation of *calendar meeting invites* — its own description says "rather than real sends". It has no relation to the `invitations` table, no delivery, and no persistence. Classification: **mock**.

**Authority transition — is `membership_authorization → invitation` legitimate?**
Yes, and it is the transition the repository was built to expect. `membership-authorization.ts` states the stage list explicitly in its header: *Governance authority → approve decision → membership authorization → invitation (I2) → membership (I2)*. `consumed_by_invitation_id` exists and is documented "Written by I2, never by I1."

**Does invitation creation need its own Governance decision?**
No. `membership_authorizations` already carries a NOT NULL `governance_decision_id` + `governance_session_id`, and `membership_authorizations_decision_uq` makes one decision authorize at most one onboarding. Minting an invitation from a live authorization is a *mechanical* act under an already-recorded constitutional decision. A second decision per invitation would produce redundant Governance history for a step that decides nothing — the exact pattern Q16 warns against.

---

## 3. Existing membership authority

**There is none in product code.** `memberships` is read by three modules and written by zero.

Readers (production):
- `src/features/auth-runtime/identity-repository.server.ts:124` — `findPrimaryActiveMembership` (sign-in) and the session-resolution join
- `src/features/canonical-read/actor-resolution.ts:175`
- `src/features/governance-decision/authority-delegation.server.ts:159,444`

Writers: **`scripts/r1-seed.mjs:63` and test helpers only** (`tests/helpers/r1-identity-seed.ts:79`, and per-suite fixtures). Both durable memberships in `hebun_r1` were planted by the seed script.

Duplicate prevention: `memberships_tenant_user_uq` — UNIQUE `(tenant_id, user_id)`. Real, database-enforced.

Role resolution is **version-bound**: `user_session_contexts.membership_version` is captured at issuance and re-compared against `memberships.version` on every resolve (`session-service.server.ts:318-324`); a mismatch is `forbidden("membership")`.

Tenant isolation on memberships is **partially structural** — see §16 for the gap.

---

## 4. Existing identity authority

`users` + `auth_identities`.

**Zero writers in `src/`. Zero writers in `scripts/lib/`.** The only writer anywhere is `scripts/r1-seed.mjs:31,40` (development seed) and `tests/helpers/r1-identity-seed.ts:56,62`.

Readers: `identity-repository.server.ts:89` (`findActiveLocalIdentityByEmail`), `canonical-read/actor-resolution.ts`, `authority-delegation.server.ts`, `scripts/lib/provision-dev-credential.ts:44` (read-only lookup — the file's own header says "this tool never creates people").

`users.email` carries `users_email_uq` — one global user per email address. `auth_identities` carries `auth_identities_provider_issuer_subject_uq` and a partial `auth_identities_primary_user_uq`.

**Classification: schema present, lifecycle constraints complete, runtime writer absent.** Identity creation is not a product capability today.

---

## 5. Existing credential authority

`auth_credentials` (D1). Structurally the most complete authority in the chain.

| Operation | Location | Reachable from product? |
|---|---|---|
| verify | `credential-repository.server.ts:106` | yes — sign-in |
| record failure / lockout | `:199` | yes |
| record success | `:224` | yes |
| **insert** | `:247 insertPasswordCredential` | **no caller in `src/`** |
| revoke | `:274` | **no caller in `src/`** |

The only credential *creation* that actually runs is `scripts/lib/provision-dev-credential.ts:120` — raw SQL, transactional rotate-then-insert, and it **refuses any non-local database** (`assertLocalDatabaseUrl`, `:145`). Its header states: "This lives under `scripts/` on purpose… nothing in `src/` may import it, and a test enforces that."

**There is no legitimate product path to create a first credential for a new human.** `insertPasswordCredential` is dead code with respect to the running product; `auth:dev-credential` is development-only by explicit construction and enforced boundary.

Primitives available and already trusted: `scrypt` (N=2^15, r=8, p=3, 64-byte key), `randomBytes(32)`, `timingSafeEqual`, per-row `algorithm` + `params` for agility.

---

## 6. Existing session authority

`user_session_contexts` — the only authority in this audit with a complete, reachable write path.

- Writer: `identity-repository.server.ts:164 insertSessionContext`, called from `session-service.server.ts:211`.
- Reference model: opaque `randomBytes(32).toString("base64url")` in an httpOnly cookie; the DB stores only `HMAC-SHA256(server-secret, reference)` as `char(64)` hex, with a `digest_version` for key rotation. **The bearer value is never persisted.**
- Expiry: `inactivity_expires_at` (30 min, slid forward) and `absolute_expires_at` (8 h), both NOT NULL and CHECK-ordered.
- Revocation: `revoked_at` + `revocation_reason`, paired by CHECK.
- Assurance: `aal1` only today.

**THE CONSTRAINT THAT DOMINATES THIS ENTIRE AUDIT:**

`issueLocalSession` refuses to mint a session for a human with no active membership:

```
session-service.server.ts:169-198
  const membership = await findPrimaryActiveMembership(db, identity.userId);
  if (!membership)      → forbidden("membership"), diagnostic "no-membership"
  if (tenant inactive)  → forbidden("tenant")
  if (!membership.roleId) → forbidden("membership")
```

and `resolveSessionFromReference` re-checks it on every request (`:308-324`). The schema agrees: `user_session_contexts_tenant_membership_chk` binds `active_tenant_id` and `active_membership_id` to be both-null-or-both-set, and the resolver rejects both-null with `forbidden("tenant")`.

**A membership-less authenticated session does not exist in Hebun and cannot be represented.**

---

## 7. `membership_authorizations` consumption semantics

Consumption is **declared, constrained, and unimplemented**. I1 writes only `status = 'authorized'`.

Columns: `consumed_at`, `consumed_by_invitation_id` (FK → `invitations.id` ON DELETE RESTRICT).

Invariants that already exist in the migration on disk:

| Constraint | What it actually enforces |
|---|---|
| `membership_authorizations_consumed_chk` | `(consumed_at is null) = (consumed_by_invitation_id is null)` — "consumed but we don't know by which invitation" is unrepresentable |
| `membership_authorizations_consumed_status_chk` | `(status = 'consumed') = (consumed_at is not null)` — status and evidence move together in **both** directions |
| `membership_authorizations_consumed_invitation_uq` | **PARTIAL UNIQUE on `consumed_by_invitation_id` WHERE not null** |
| `membership_authorizations_one_active_per_email_uq` | PARTIAL UNIQUE `(tenant_id, normalized_email)` WHERE `status = 'authorized'` |
| `membership_authorizations_decision_uq` | UNIQUE `governance_decision_id` — one decision, one onboarding |

**`membership_authorizations_consumed_invitation_uq` — actual semantics, not the name's implication.**
It enforces: *one invitation may be named by at most one authorization.* It does **not** by itself enforce "an authorization is consumed once" — that comes from the column being **single-valued**: one authorization row can physically name only one invitation, and `consumed_status_chk` welds that to the status.

**Does it reference an invitation?** Yes, and only in that direction. `invitations` has **no** `membership_authorization_id` column. The link is one-way: authorization → invitation.

**Is consumption one-time?** Yes at write time, via the conditional-update primitive already proven in G2 (`bootstrap-authority.server.ts:282-304`):

```
UPDATE … SET consumed_at = now, consumed_by_invitation_id = $inv
 WHERE id = $auth AND tenant_id = $t
   AND status = 'authorized' AND consumed_at IS NULL
RETURNING id
→ 0 rows means somebody else spent it → abort the whole transaction
```

G2 does exactly this against `genesis_nominations` and proves it with a real concurrency test (`tests/g2-flow/governance-concurrency-postgres.ts`, PASS).

**Concurrency:** under READ COMMITTED, the second `UPDATE` blocks on the row lock, re-evaluates its `WHERE` after the first commits, and matches zero rows. Deterministic, no advisory lock needed.

**Can a failed downstream transaction leave the authorization wrongly consumed?** Only if consumption and the invitation insert are in **different** transactions. In one transaction, rollback takes both. This is a transaction-boundary decision, not a schema gap — see §13.

**Not enforced:** nothing prevents an `UPDATE` that flips `consumed` back to `authorized`. There is no trigger and no immutability rule on this table. Consumption is one-time by *discipline plus the conditional predicate*, not by an irreversibility constraint. Same is true of `genesis_nominations`, so this is the established repository posture, not a new weakness.

---

## 8. Invitation schema capabilities

`invitations` is unusually complete for a table with no code.

**Present and usable:**
- `tenant_id` NOT NULL → `companies`
- `normalized_email` varchar(320), CHECK `= lower(btrim(…)) and length > 0` — **identical rule to `membership_authorizations`**, so the two tables cannot disagree about "the same human"
- `intended_role_id` NOT NULL, with `invitations_tenant_role_fk` — **composite** `(tenant_id, intended_role_id) → roles(tenant_id, id)`
- `organization_id` nullable, with a composite tenant FK
- `inviter_type` / `inviter_id` — canonical actor pair
- `token_hash` `char(64)`, CHECK `~ '^[0-9a-f]{64}$'`, **globally UNIQUE** (`invitations_token_hash_uq`)
- `token_version` integer default 1, CHECK `> 0`
- `status` enum `pending | accepted | expired | revoked`, default `pending`
- `issued_at`, `expires_at` NOT NULL, CHECK `expires_at > issued_at`
- `accepted_at`, `accepted_by_user_id` → `users`
- `revoked_at`, `revoked_by_type/id`, `revocation_reason`
- `last_sent_at`, `send_count` (CHECK `>= 0`)
- `invitations_pending_email_uq` — PARTIAL UNIQUE `(tenant_id, normalized_email)` WHERE `status = 'pending'`
- `invitations_accepted_chk` — accepted requires **both** `accepted_at` and `accepted_by_user_id`
- `invitations_revoked_chk` — revoked requires `revoked_at` and a non-empty reason

**Absent:**
- no `membership_authorization_id` — an invitation cannot state its own provenance
- no CHECK constraining `inviter_type = 'human'` (contrast `membership_authorizations_human_authorizer_chk`)
- no `expired` transition mechanism — the status value exists, nothing writes it; expiry is a timestamp comparison only
- no attempt/rate-limit counter for acceptance

All of the above was verified against the **live durable database**, not only the schema file.

---

## 9. Invitation token / security model evidence

The repository already contains a proven token model and I2 should reuse it rather than invent one.

**Existing pattern — session references (`session-digest.server.ts`):**
1. mint: `randomBytes(32).toString("base64url")` — 256 bits
2. store: `createHmac("sha256", serverSecret).update(reference).digest("hex")` — exactly 64 lowercase hex chars
3. compare: `timingSafeEqual` on the decoded digests
4. the raw reference is **never** persisted; a leaked DB row cannot be replayed, and a stolen cookie cannot be forged into a digest without the server secret
5. the digest is **versioned** (`digest_version`) so the key can rotate with a two-key resolve window

`invitations.token_hash` is `char(64)` with `^[0-9a-f]{64}$` and `token_version integer` — **the identical shape**. The schema was designed for this exact primitive.

Answers:

| Question | Answer, with evidence |
|---|---|
| Is an invitation token secret material? | **Yes.** Possession is the only thing distinguishing a legitimate acceptor from anyone else. |
| Should the raw token ever be persisted? | **No.** The column is a `_hash` and the repository already refuses to persist bearer values. |
| Who mints it? | The server, inside the issuance transaction. Never the client, never the browser. |
| Who verifies it? | A server-only module holding the HMAC key — the same confinement `session-digest.server.ts` uses (`assertServerRuntime`). |
| Digest only in the DB? | **Yes**, and `invitations_token_hash_uq` makes the digest globally unique, so a collision is a database error. |
| Trusted entropy source? | `node:crypto` `randomBytes(32)` — already used for both session references and credential salts. |
| What does expiry bind to? | `expires_at` NOT NULL, CHECK'd `> issued_at`. It binds to the **invitation row**, not to the token. |
| What prevents replay? | Nothing today. The DB primitive that would: a conditional `UPDATE … WHERE status='pending' AND expires_at > now()` returning 0 rows, plus `memberships_accepted_invitation_uq` as the terminal backstop (§13). |
| After successful acceptance? | `status = 'accepted'`, `accepted_at` + `accepted_by_user_id` set (CHECK requires both). The row is not deleted. |
| After expiration? | The `expired` status exists but **nothing writes it**. There is no sweeper. Expiry must be evaluated as `expires_at > now()` in the predicate; treating `status = 'pending'` alone as "usable" would be wrong. |

**No new cryptography is required.** HMAC-SHA256 with a versioned server key over a 256-bit random reference is already the house pattern.

---

## 10. Existing-user onboarding path

Definition: a human who already has a `users` row, an active `local` `auth_identity`, an active `auth_credential`, and at least one active membership somewhere — being admitted to a **second** tenant.

**What must be created:** `memberships` only. Plus the invitation artifact and the authorization consumption.
**What must NOT be created:** no user, no identity, no credential. Creating any of them would be duplicate identity for a human who already exists, and `users_email_uq` would reject it anyway.

**This path is fully derivable from repository evidence and needs no new authority:**
- the human authenticates through the existing D1 path (they have a membership already, so `issueLocalSession` succeeds)
- acceptance runs under a resolved `TenantContext` — the same authority shape every governed act already uses
- `memberships_tenant_user_uq` prevents a duplicate membership in the target tenant
- `memberships.role_id` and `memberships.tenant_id` are both copied from **one** invitation row whose `invitations_tenant_role_fk` has already proven the pair is tenant-consistent

**But it produces a membership the product cannot use.** `findPrimaryActiveMembership` (`identity-repository.server.ts:124`) selects the **oldest** active membership and its own comment says: *"R1 pilot: exactly one active membership is expected… Tenant-selection across multiple memberships is out of R1 scope."* There is no tenant switcher anywhere in `src/app`. A human with two memberships will always resolve into the first one.

So the second membership would be **real, correct, durable — and unreachable**. That is an honest limitation to state, not a fabrication, but it means "join a second tenant and work in it" is **not** a capability I2 alone can deliver.

---

## 11. Brand-new-human onboarding path

Definition: no `users` row, no `auth_identity`, no `auth_credential`, no session.

Required artifacts, and who owns each today:

| Artifact | Owning authority | Product writer today |
|---|---|---|
| `users` | Identity | **none** (seed script only) |
| `auth_identities` | Identity | **none** (seed script only) |
| `auth_credentials` | Credential | **none in `src/`** — dev script, local-only, import-forbidden |
| `user_session_contexts` | Session | yes — but requires a membership to already exist |
| `memberships` | Membership | **none** (seed script only) |

**The ordering problem, stated exactly:**

- The human cannot authenticate before a membership exists (§6).
- If the membership is created **before** authentication, then the only thing that authorized creating it is **possession of the invitation token**. That makes the token sufficient to create a `users` row and an `auth_identity` — i.e. the invitation becomes Identity authority. The Director's Q5 forbids exactly this, and the distinction is correct: an invitation proves *"this bearer may attempt to join Tenant T"*; it cannot prove *"this bearer is Human X"*, because there is no delivery channel to bind the token to the address (§12).
- If the membership is created **after** authentication, the human must authenticate with no membership — which the session authority cannot represent and which no I2-scoped change may alter, because Session authority is not I2's to change.

**There is no third option derivable from the repository.** Every remaining shape requires a Director decision about which authority moves. See §21 and §26.

---

## 12. Email / delivery reality

Exhaustive search of `src/`, `scripts/`, `package.json`, and `.env.local`:

| Provider / mechanism | Finding |
|---|---|
| nodemailer, SMTP | **absent** — zero matches |
| Resend | **absent** |
| SendGrid | **absent** |
| Postmark | **absent** |
| Mailgun | **absent** |
| AWS SES / aws-sdk | **absent** |
| Supabase email | **absent** |
| notification providers | **absent** |
| mail queues / delivery workers | **absent** |
| email templates | **absent** |
| provider secrets for mail | **absent** — env keys are `HEBUN_AUTH_*`, `DATABASE_URL`, `HEBUN_PERSISTENCE_*`, `ANTHROPIC_API_KEY`, `HEBUN_MODEL_*`. Nothing mail-shaped. |
| `providers/communication` "email"/"invitations" capabilities | **mock** — deterministic simulation, explicitly "without actual delivery" / "rather than real sends" |

Full dependency list: `clsx`, `drizzle-orm`, `lucide-react`, `next`, `pg`, `react`, `react-dom`, `tailwind-merge`. **No mail library exists in this project.**

**Consequence that must not be glossed:** `invitations.last_sent_at` and `send_count` are columns describing an act Hebun cannot perform. If I2 writes them it would be claiming a delivery that did not happen. They must stay NULL/0.

**Consequence for security:** possession of a token sent to `alice@example.com` proves **nothing about control of that mailbox**, because Hebun never sent anything there. Any claim that acceptance verifies the email would be false.

The narrowest honest shape this permits is: *invitation artifact + server-minted token + an explicit out-of-band delivery boundary* — the token is returned once to the Governance authority who issued it, and how it reaches the human is outside the system, exactly as G2.1's operator ceremony is outside the system. **This is a recommendation, not a Gate A conclusion** — it still requires a Director decision because it changes who the invitation is trusted from.

---

## 13. Transaction boundary map

Six stages. They do **not** belong in one transaction.

| Stage | Authority | Transaction | Rollback semantics |
|---|---|---|---|
| **A** Governance membership authorization | Governance | **DONE (I1)** — session + decision + authorization + audit commit together | already proven |
| **B** Invitation issuance | Invitation (new) | **one transaction** with A's consumption | if the invitation insert fails, the authorization must not be consumed |
| **C** Human identity proof / authentication | Identity + Credential + Session | **separate — a different moment entirely** | a human authenticating is not part of the tenant's write |
| **D** Invitation acceptance | Invitation | **one transaction** with E and F | — |
| **E** Membership creation | Membership | with D | if membership insert fails, acceptance must not stand |
| **F** Authorization → `consumed` | Governance artifact | with B (see below) | — |

**Where F belongs — the one genuinely arguable boundary.**

Two readings:

1. **F with B** (consume at issuance). Matches G2 exactly: `genesis_nominations.consumed_at` is set when the *decision* is written, not when the human later acts. The authorization is spent the moment it produces an invitation; a revoked or expired invitation does **not** un-spend it, and a re-invite requires a new Governance decision. Constitutionally strict.
2. **F with D/E** (consume at acceptance). Lets one authorization survive a lapsed invitation. But it means the authorization sits `authorized` while an invitation exists, and `membership_authorizations_one_active_per_email_uq` would then block re-issuance anyway — so the benefit is small and the window where "an invitation exists whose authorization is not consumed" is a state with no owner.

**Reading 1 is the one the repository already demonstrates** (G2's `EntitlementRaceLost` abort). It is a Director decision, but the precedent is unambiguous.

**What must never be one transaction:** A with B (a Governance decision and a token mint are different moments and different authorities — I1's header says so explicitly), and C with anything (authentication is the human's act, not the tenant's).

---

## 14. Concurrency invariant analysis

| Race | DB-level invariant today | Verdict |
|---|---|---|
| Two invitation issuances from one authorization | `consumed_by_invitation_id` is single-valued + `consumed_status_chk` + conditional `UPDATE … WHERE status='authorized' AND consumed_at IS NULL RETURNING id` (G2 precedent, `bootstrap-authority.server.ts:282`) | **PREVENTED** |
| Two simultaneous accepts of one invitation | No index on `invitations` does this. **But** `memberships_accepted_invitation_uq` — UNIQUE on `memberships.accepted_invitation_id` — makes two memberships citing one invitation a `23505`. Plus conditional `UPDATE invitations … WHERE status='pending' AND expires_at > now()` returning 0 rows. | **PREVENTED**, by the membership table rather than the invitation table |
| Two simultaneous memberships, same human + tenant | `memberships_tenant_user_uq` | **PREVENTED** |
| Acceptance racing expiry | `expires_at > now()` inside the same conditional `UPDATE` predicate — evaluated atomically at row-lock time | **PREVENTED** (if written that way) |
| Acceptance racing revocation | `status = 'pending'` inside the same predicate — a revoked row is `revoked` | **PREVENTED** (if written that way) |
| Acceptance after the authorization was consumed | Consumption happens at issuance under reading 1, so this cannot arise; the invitation's own existence is the evidence | **PREVENTED** under reading 1 |
| One authorization producing multiple memberships | Transitive: 1 authorization → ≤1 invitation (single-valued column) → ≤1 membership (`memberships_accepted_invitation_uq`) | **PREVENTED** |
| Two concurrent authorizations, same email + tenant | `membership_authorizations_one_active_per_email_uq` | **PREVENTED** (proven, `tests/i1-flow/authorization-concurrency-postgres.ts` PASS) |

**No stage requires `SELECT none → INSERT`.** Every invariant has a real database constraint or a conditional-update predicate behind it. The repository's own pattern (`isUniqueViolation(error, constraintName)` matching **both** SQLSTATE `23505` and the constraint name) is available for turning each race loss into an honest refusal.

---

## 15. Expiry / revocation model

| Lifecycle state | Schema support | Runtime |
|---|---|---|
| Authorization revocation | `status='revoked'` + `revoked_at` + `revocation_reason`, CHECK-paired | **none** — declared and deliberately unwritten in I1 |
| Authorization expiry | **NOT SUPPORTED** — no `expires_at` column | n/a |
| Invitation revocation | `status='revoked'` + `revoked_at` + `revoked_by_type/id` + `revocation_reason`, CHECK-paired | none |
| Invitation expiry | `expires_at` NOT NULL + CHECK, `status='expired'` value exists | **none** — no sweeper, no writer of `expired` |
| Membership revocation | `status='revoked'` + `revoked_at` + `revoked_by_*` + `revocation_reason`; re-checked on every session resolve | **none** — tests set it by raw `UPDATE` |

**Invitation revocation is fully representable.** Every column and CHECK it needs already exists in the durable database. **No Gate B is required for it.**

**Authorization expiry is not representable** and I2 must not pretend otherwise. If the Director wants authorizations to lapse, that is a schema change and therefore a Gate B — but the repository shows no need for it: an unconsumed authorization is inert.

`status='expired'` on invitations is the one honest trap: it exists, nothing writes it, and treating a row as usable because `status='pending'` without also checking `expires_at > now()` would be a real defect.

---

## 16. Tenant-isolation analysis

| Attack | Prevented by | Structural? |
|---|---|---|
| Tenant A authorization issuing a Tenant B invitation | `invitations.tenant_id` must be copied from `membership_authorizations.tenant_id`; both rows carry `tenant_id` and both have composite tenant-role FKs | Yes, **if** I2 copies rather than accepts input |
| Tenant A invitation producing a Tenant B membership | `memberships.tenant_id` copied from the invitation row | Application-level — see gap below |
| Tenant A role used by Tenant B | `invitations_tenant_role_fk` and `membership_authorizations_tenant_role_fk` are **composite** `(tenant_id, role_id) → roles(tenant_id, id)` | Yes, at both upstream tables |
| Guessing another tenant's invitation identifier | Token is 256-bit random, digest is globally unique, and lookup is **by digest**, never by row id | Yes |
| Authorization lookup without tenant binding | I1's reads are already `and(eq(tenantId), …)` throughout; `readMembershipAuthority` is tenant-scoped by predicate and authority-gated | Yes, in existing code |

### The gap — measured against the live database

```
memberships constraints:
  memberships_role_id_roles_id_fk              role_id → roles(id)          ← SINGLE COLUMN
  memberships_accepted_invitation_id_invitations_id_fk                       ← SINGLE COLUMN
  memberships_tenant_id_companies_id_fk
  memberships_user_id_users_id_fk
  memberships_tenant_id_id_uq, memberships_tenant_user_uq
```

**`memberships` has no composite `(tenant_id, role_id) → roles(tenant_id, id)` foreign key**, and no composite tenant FK on `accepted_invitation_id`. Both `invitations` and `membership_authorizations` have the composite role FK. `memberships` — the table I2 would actually write — does not.

At the database level, a Tenant A membership may name a Tenant B role.

**Mitigating fact:** if I2 copies `tenant_id` **and** `role_id` from the *same* invitation row, the pair was already validated by `invitations_tenant_role_fk`. That is materially stronger than an application check on client input — it is a copy of a database-proven pair. It is still not an invariant *on* `memberships`.

This is a pre-existing gap, not one I2 creates. Closing it is optional for I2's honesty and would be a Gate B item.

---

## 17. Audit ownership

**Do not create a new sink.** `audit_log` is the shared append-only sink, already written by three sibling writers (`knowledge-mutation-audit` G1, `genesis-nomination-audit` G2.1, `governance-decision-audit` G2/G3/I1/I1.1). `action` and `entity_type` are free text, so a new domain costs **zero schema**.

Existing vocabulary (`governance-decision/contracts.ts:42`):
`governance.bootstrap.established`, `governance.decision.recorded`, `governance.authority.delegated`, `governance.authority.revoked`, `governance.membership.authorized`, `governance.role.provisioned`.

Outcomes are the `audit_result` enum, currently used as `committed | rejected`. `entity_type` for governance is `governance_decision`.

**Can current semantics carry I2's events truthfully?**

| Event | Truthful today? |
|---|---|
| invitation issued | Yes — it *is* a governance-adjacent act (it spends a Governance authorization). Needs its own `action`, its own `entity_type` (`invitation`), and probably its own sibling writer module, not an extension of `governance-decision-audit`. |
| invitation acceptance attempted | Yes as `rejected` — but note `GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts: false`. An acceptance attempt by an unauthenticated bearer has no tenant-authorized actor, and `audit_log.actor_id` is NOT NULL with `actor_type` an enum. **Recording an anonymous attempt has no representable actor.** This is a real constraint on Q7's answer. |
| invitation accepted | Yes — actor is the accepting human's `users.id` |
| invitation refused | Same problem as "attempted" when the caller is anonymous |
| membership created | Yes |

**Never in audit metadata:** the token, the digest, the password, the credential, or a duplicate of the email (I1 already established that `membership_authorizations.normalized_email` is the single owner of the address, and the audit row carries ids and bands only).

**No vocabulary is added at Gate A.** The above is the finding, not a change.

---

## 18. Governance decision ownership

**I2 requires no new Governance decision vocabulary.**

- `governance_domain` already has `membership-authorization` (I1) and `organizational-role` (I1.1).
- `governance_decision_type` already has `approve`, used by I1 for exactly this.
- `membership_authorizations` **already embodies the authoritative Governance decision**: it carries `governance_decision_id` and `governance_session_id`, both NOT NULL, both RESTRICT, with `membership_authorizations_decision_uq` guaranteeing one decision per onboarding.

Issuing an invitation and accepting it are **mechanical lifecycle steps** under a decision that was already made and already recorded. Producing a Governance decision per step would inflate the constitutional ledger with rows that decide nothing — and would break I1's own claim that one decision authorizes one onboarding.

**No enum value is added. No enum value is needed.**

---

## 19. Existing schema sufficiency

| I2 need | Schema sufficient? | Notes |
|---|---|---|
| Issue an invitation from an authorization | **Yes** | every column exists; `token_hash`/`token_version` match the HMAC pattern exactly |
| Store only a token digest | **Yes** | `char(64)` + `^[0-9a-f]{64}$` + globally unique |
| Bind invitation to tenant + role + email | **Yes** | composite `invitations_tenant_role_fk`, normalized-email CHECK identical to I1's |
| Consume the authorization once | **Yes** | single-valued column + two CHECKs + partial unique + G2's proven conditional-update |
| Expire an invitation | **Yes** | `expires_at` NOT NULL, CHECK'd; evaluate in-predicate |
| Revoke an invitation | **Yes** | full column set + CHECK already in the durable DB |
| Accept an invitation | **Yes** | `accepted_at` + `accepted_by_user_id` + `invitations_accepted_chk` |
| Create the membership | **Yes** | `memberships_tenant_user_uq` + `accepted_invitation_id` + `memberships_accepted_invitation_uq` |
| Prevent double-accept | **Yes** | via `memberships_accepted_invitation_uq` |
| Record invitation provenance *on the invitation* | **No** | no `membership_authorization_id` column — link is one-way only |
| Forbid an agent inviter | **No** | no `inviter_type = 'human'` CHECK |
| Structural tenant-role binding *on memberships* | **No** | single-column role FK (§16) |
| Audit the whole lifecycle | **Yes** | `audit_log` free-text `action`/`entity_type`, zero migrations — except anonymous attempts (§17) |
| Create a first credential for a new human | **N/A — not a schema question** | no product authority exists (§5) |
| Authenticate a membership-less human | **No, and not fixable in schema** | `user_session_contexts_tenant_membership_chk` + resolver both refuse it (§6) |

---

## 20. Mock / seed / schema-only / runtime classification

| Component | Classification |
|---|---|
| `invitations` table | **schema-only** — 0 rows, 0 writers, 0 readers, complete constraints |
| `memberships` table | **schema + seed** — read by 3 production modules, written only by `scripts/r1-seed.mjs` and tests |
| `users`, `auth_identities` | **schema + seed** — read by production, written only by seed |
| `auth_credentials` | **partially connected** — verify/lockout/success are live; insert/revoke have no product caller; creation is dev-script-only |
| `user_session_contexts` | **runtime / authoritative** — full write + read + revoke path, reachable from `/login` |
| `membership_authorizations` | **runtime (uncommitted)** — I1 writes it; `consumed_*` columns are schema-only |
| `roles` | **schema + seed + runtime (uncommitted)** — I1.1 is the first and only product writer |
| `decision_records`, `governance_sessions` | **runtime / authoritative** |
| `audit_log` | **runtime / authoritative** — 3 sibling writers |
| `role_permissions`, `permissions` | **schema-only** — 0 rows, 0 readers (per I1 contracts) |
| `providers/communication` `"email"` / `"invitations"` | **mock** — deterministic simulation, explicitly no delivery |
| `scripts/auth-dev-credential.ts` | **development tooling** — local-DB-only, import-forbidden from `src/`, test-enforced |
| `scripts/genesis-nominate.ts` | **operator ceremony** — out-of-band by design (G2.1) |
| mail runtime | **absent** — no dependency, no code, no config, no secret |

---

## 21. Exact architectural contradictions found

**C1 — Session authority requires membership; a brand-new human has none.**
`issueLocalSession` (`session-service.server.ts:169-198`) and `resolveSessionFromReference` (`:308-324`) both refuse a session without an active membership carrying a `role_id`. `user_session_contexts_tenant_membership_chk` makes the membership-less shape unrepresentable at rest. Therefore a brand-new human cannot authenticate *before* the membership exists, and the membership cannot honestly be created *before* the human is proven, because the only thing proving them would be the token — and no delivery channel binds the token to the address (C2). **This is the blocking contradiction.**

**C2 — The invitation model presumes delivery; Hebun has none.**
`invitations.last_sent_at` and `send_count` describe an act with no implementation, no dependency, and no configuration. Possession of a token addressed to `alice@example.com` proves nothing about Alice, because nothing was sent to Alice.

**C3 — No product authority creates `users` or `auth_identities`. Anywhere.**
Zero writers in `src/`, zero in `scripts/lib/`. Both durable humans were planted by `scripts/r1-seed.mjs`. There is no precedent for I2 to follow — only a decision for the Director to make.

**C4 — Credential creation exists but is structurally quarantined.**
`insertPasswordCredential` has no caller in `src/`. The running implementation is `scripts/lib/provision-dev-credential.ts`, which refuses non-local databases and which a test forbids `src/` from importing. `auth:dev-credential` is development tooling, not product capability, and the repository says so explicitly.

**C5 — `memberships` lacks the composite tenant-role FK its two sibling tables both have.**
Verified against the live database. Tenant A membership → Tenant B role is a DB-legal state.

**C6 — Even the existing-human path yields an unreachable membership.**
`findPrimaryActiveMembership` deterministically selects the oldest active membership; there is no tenant switcher in `src/app`. A second membership is durable, correct, and unusable.

**C7 — `audit_log` cannot represent an anonymous acceptance attempt.**
`actor_type` (enum) and `actor_id` (uuid) are both NOT NULL, and `GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts` is `false` by doctrine. An unauthenticated bearer's failed attempt has no representable actor.

**C8 — `invitations` cannot state its own provenance.**
No `membership_authorization_id`. Nothing at the database level forces an invitation to descend from a Governance authorization; the link exists only on the authorization side and only once consumption is written.

---

## 22. Gate A answers Q1–Q18

**Q1 — Invitation authority.** None exists. `invitations` is schema-only: 0 rows, 0 writers, 0 readers. The `providers/communication` `"invitations"` capability is an unrelated calendar-invite mock. `membership_authorization → invitation` is a legitimate authority transition and is the one `membership-authorization.ts` documents. Invitation creation needs **no** separate Governance decision — `membership_authorizations` already carries a NOT NULL, uniquely-bound decision.

**Q2 — Authorization consumption.** Schema-only; I1 writes only `authorized`. Consumption = set `consumed_at` + `consumed_by_invitation_id`, welded to `status='consumed'` by `consumed_status_chk` and to each other by `consumed_chk`. It references an invitation, one-way. One-time via the single-valued column plus a conditional `UPDATE … WHERE status='authorized' AND consumed_at IS NULL RETURNING id` — G2's exact, concurrency-tested pattern. `membership_authorizations_consumed_invitation_uq` is a **partial unique on `consumed_by_invitation_id` WHERE not null**: it enforces "one invitation is named by at most one authorization", *not* "an authorization is consumed once" — that comes from the column being single-valued. A failed downstream transaction cannot leave it wrongly consumed **only if** consumption and the invitation insert share one transaction.

**Q3 — Token model.** Reuse `session-digest.server.ts`. Token is secret material; raw token never persisted; server mints via `randomBytes(32)`; a server-only module verifies via `createHmac("sha256", key)`; DB stores the 64-hex digest only, globally unique; `token_version` mirrors the existing digest-key rotation. Entropy: `node:crypto`. Expiry binds to the invitation row via `expires_at` (NOT NULL, CHECK'd). Replay is prevented by the conditional update plus `memberships_accepted_invitation_uq`. After acceptance the row becomes `accepted` with both evidence columns set. After expiry — nothing happens today; there is no writer of `expired` and no sweeper, so expiry must be a predicate, never a status read. **No new cryptography.**

**Q4 — Existing user vs brand-new human.** Fully distinct and must not be collapsed. Existing verified human: create **`memberships` only** — no user, no identity, no credential (and `users_email_uq` would reject a duplicate anyway). Derivable, no new authority — but the resulting membership is unreachable (C6). Brand-new human: needs `users` + `auth_identities` + `auth_credentials` + `memberships`, of which the first three have **no product writer** and the fourth cannot precede authentication without making the token Identity authority (C1).

**Q5 — Identity bootstrap authority.** Nothing in the product creates `users` or `auth_identities` — only `scripts/r1-seed.mjs`. **The Director's framing is correct and repository-supported:** an invitation proves *"this bearer may attempt to join Tenant T"*. It cannot prove *"this bearer is Human X"*, because C2 means the token was never delivered to a verified address. Letting the invitation create the identity would silently make it Identity authority. **Unresolved — it is a Director decision, not a repository fact.**

**Q6 — Credential bootstrap.** The production runtime has **no** legitimate path to create a first credential. `insertPasswordCredential` is uncalled; `auth:dev-credential` is development-only by explicit construction, refuses non-local databases, and is import-forbidden from `src/` with a test enforcing it. Whether I2 may create `auth_credentials` is **not derivable** — it requires either promoting quarantined tooling into product (a Credential-authority act) or a separate phase. **Per the Director's instruction: unresolved → stop at Gate A.**

**Q7 — Acceptance authentication level.** Three candidate shapes, and the repository eliminates two of them:
- *Unauthenticated bearer token alone* — would make the token Identity authority (C1/C2). Also cannot be audited: `audit_log.actor_id` is NOT NULL (C7).
- *D1-authenticated human* — works **only** for the existing-human path, because a brand-new human cannot hold a session (C1).
- *Staged* — the honest shape for the existing-human path (authenticate first, then present the token under a resolved `TenantContext`), and structurally impossible for the brand-new path without moving an authority.

On the email question: **no.** Possession of a token "sent to `alice@example.com`" does not prove control of Alice's mailbox, because Hebun sends nothing. Only an out-of-band handoff by the issuing Governance authority is a claim the repository can back.

**Q8 — Email / delivery runtime.** **Absent** in every category: SMTP, Resend, SendGrid, Postmark, SES, Supabase email, notification providers, queues, templates, secrets, workers. Zero dependencies, zero code, zero env keys. The only "email"/"invitations" strings are the communication provider's mock. Narrowest honest scope is *invitation artifact + server-minted token + explicit out-of-band delivery boundary*, with `last_sent_at`/`send_count` left untouched — **but this is a recommendation and still needs Director authorization**, because it changes who the invitation is trusted from.

**Q9 — Membership authority.** Every writer: `scripts/r1-seed.mjs:63`, `tests/helpers/r1-identity-seed.ts:79`, and per-suite fixtures. **Zero production writers.** No Membership service exists, so I2 would not be a second one — it would be the first. Invitation acceptance is a valid Membership-authority act *provided* the tenant, role, and human all come from the invitation row rather than from the request. Role resolution is version-bound (`membership_version` re-checked every resolve). Tenant isolation is enforced by `memberships_tenant_user_uq` and by copying the tenant/role pair from an invitation whose composite FK already validated it — but **not** by a composite FK on `memberships` itself (C5). Duplicates are prevented by `memberships_tenant_user_uq`.

**Q10 — Membership role binding.** The invitation and the final membership must stay bound to: **tenant** (`invitations.tenant_id` → `memberships.tenant_id`), **intended role** (`invitations.intended_role_id` → `memberships.role_id`), and the **authorization artifact** (transitively, via `membership_authorizations.consumed_by_invitation_id`). The intended *human* is bound only by `normalized_email` — an intention, not an identity (I1's own header says so). Substitution of another tenant, role, or band is prevented **provided** every one of those values is copied server-side from the invitation row. **No client input may influence role selection**, and the architecture does not require it to: `intended_role_id` is fixed at authorization time by the Governance authority, and I1 already restricts the eligible band to `member` alone (`ONBOARDING_ELIGIBLE_ROLE_TYPES`), explicitly excluding `owner`, `director`, `operator`, `auditor`.

**Q11 — Recipient binding.** An authorization identifies the recipient by **email only** — `normalized_email`. No user, no actor, no identity, no FK (there is nothing to reference at I1 time). Canonicalization rules **already exist and are shared**: lower + trim, enforced identically by `normalizeTargetEmail` (`authorize-membership.server.ts:73`) and by both tables' `normalized_email_chk`. Deliberately conservative — plus-addressing and dots are **not** stripped, so two different people stay two people (test-proven).
- *Authorization intended for an email an existing user already owns* → that human's `users` row is found by `users_email_uq`; the existing-human path applies and only a membership is created.
- *Recipient changes email* → the authorization and invitation still name the old address. Nothing reconciles it. There is no runtime for this.
- *Invitation forwarded* → **nothing prevents the forwardee from using it.** The token is the only credential and there is no delivery binding (C2).
- *Two users try the same token* → the conditional update plus `memberships_accepted_invitation_uq` mean exactly one wins; the loser gets a `23505` that must be mapped to an honest refusal.
- *Authenticated user's identity ≠ intended recipient* → **no rule enforces this today.** It is a Director decision whether acceptance requires `session.user.email == invitations.normalized_email`. The columns to check it exist.

**Q12 — Transaction boundaries.** Six stages, three transactions: **A** is already one transaction (I1, done). **B+F** together — invitation insert and authorization consumption commit or fail as one, following G2's `EntitlementRaceLost` precedent. **C** is entirely separate — a human authenticating is not part of the tenant's write. **D+E** together — acceptance and membership creation commit as one. Rollback: if the membership insert fails, the invitation must not read `accepted`; if the invitation insert fails, the authorization must not read `consumed`. **Do not put A with B** (different moments, different authorities), and **do not put C with anything**.

**Q13 — Concurrency.** All eight required invariants have a real database-level defense — see §14. No stage needs `SELECT none → INSERT`. Note the non-obvious one: double-accept of a single invitation is prevented by `memberships_accepted_invitation_uq` on the **memberships** table, not by anything on `invitations`.

**Q14 — Revocation / expiry.** Supported by schema, unimplemented: authorization revocation, invitation revocation, invitation expiry, membership revocation. **Not supported at all: authorization expiry** (no `expires_at` column). Invitation revocation needs **no Gate B** — every column and CHECK is already in the durable database. Authorization expiry would need a Gate B, and the repository shows no need for it.

**Q15 — Audit.** Use the existing `audit_log` sink; add no second sink and no migration (`action`/`entity_type` are free text). Truthfully supportable: *invitation issued*, *invitation accepted*, *membership created*, and *acceptance refused when the caller is an authenticated human*. **Not truthfully supportable: any attempt by an unauthenticated caller** — `actor_type`/`actor_id` are NOT NULL and `GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts` is `false` (C7). Never write the token, the digest, a credential, or a duplicate of the email into audit. **No vocabulary added at Gate A.**

**Q16 — Governance decision vocabulary.** **None required.** `membership-authorization` domain and `approve` decision type already exist and are already used for exactly this. `membership_authorizations` already embodies the authoritative decision (NOT NULL `governance_decision_id` + `governance_session_id`, `decision_uq`). Invitation issuance and acceptance are mechanical steps under a decision already made; producing a decision per step would inflate the ledger and contradict I1's one-decision-one-onboarding claim.

**Q17 — Tenant isolation.** Four of five attacks are structurally impossible (§16). The fifth — Tenant A invitation producing a Tenant B membership — is prevented by copying `tenant_id` and `role_id` from one invitation row whose composite FK already proved them consistent, but there is **no composite FK on `memberships` itself** (C5). Invitation identifiers are not guessable: lookup is by 256-bit-derived globally-unique digest, never by row id.

**Q18 — Current schema sufficiency.** For the artifact chain: **yes** — invitation issuance, digest storage, one-time consumption, expiry, revocation, acceptance, membership creation, and audit are all representable with **zero migrations**. For the brand-new-human path: the blocker is **not schema** — it is that no authority owns identity or credential creation and that the session authority cannot represent a membership-less human. That cannot be fixed by adding a column.

---

## 23. Recommended I2 architecture

*Recommendation only. Not authorized, not implemented.*

**Stage B — invitation issuance** (Governance authority, in-product, one transaction)
Inputs from the client: the `membership_authorizations.id` and a justification. Nothing else — not the tenant, not the role, not the email, not the expiry, not the token.
Server resolves the authorization by `(id, tenant_id, status='authorized')`, re-resolves Governance authority via `resolveGovernanceAuthority` (the single resolver, as I1/I1.1 do), mints `randomBytes(32)`, computes the HMAC digest, and in one transaction: inserts `invitations` (tenant, email, role, expiry, digest, `token_version`, `inviter_type='human'`, `inviter_id` from the session), conditionally consumes the authorization (`WHERE status='authorized' AND consumed_at IS NULL RETURNING id`; 0 rows → abort), and appends one audit row. The raw token is returned **once** to the issuing authority and never stored, never logged, never redirected, never audited.

**Stage C — authentication** — unchanged. Existing D1 path.

**Stage D+E — acceptance** (authenticated human, one transaction)
Caller presents the raw token under a resolved `TenantContext`. Server digests it, looks the invitation up **by digest**, and in one transaction: conditionally marks it accepted (`WHERE status='pending' AND expires_at > now()` → 0 rows means expired, revoked, or already accepted, all indistinguishable to the caller), inserts the membership with `tenant_id`/`role_id` copied from that same invitation row, sets `accepted_invitation_id`, and appends one audit row. `memberships_tenant_user_uq` and `memberships_accepted_invitation_uq` are the two backstops.

**Scope that follows from the evidence:** I2 covers **the existing-verified-human path only**, and states C6 (the membership is durable but unreachable without tenant selection) as a named non-capability rather than hiding it. The brand-new-human path is a separate phase that requires the Director decisions in §26.

---

## 24. Explicit non-capabilities

Whatever I2 becomes, it does **not** provide:

- email, SMS, or any delivery of any kind
- proof that a token reached its intended recipient
- creation of `users` or `auth_identities`
- creation of `auth_credentials`, or any password-setting surface
- password recovery, reset, or rotation
- SSO, MFA, or any assurance level above `aal1`
- tenant switching, or any use of a second membership
- membership editing, suspension, or revocation
- role management, editing, deletion, hierarchy, or a permissions runtime
- authorization expiry
- an invitation-expiry sweeper (`status='expired'` stays unwritten)
- self-service signup of any kind
- Governance authority, ratification authority, provider access, or execution/Computer Use/terminal authority

---

## 25. Gate B requirement, if any

**Not required for the recommended scope.** Invitation issuance, consumption, expiry-by-predicate, revocation, acceptance, membership creation, and audit are all representable with **zero migrations**.

If the Director wants any of the following, each is a separate minimal Gate B item. None is recommended as necessary:

| # | Change | Why it would be authoritative, not convenience |
|---|---|---|
| B-1 | `memberships`: add composite FK `(tenant_id, role_id) → roles(tenant_id, id)` | Both sibling tables already have it; `memberships` is the odd one out. Makes C5 structurally impossible instead of by-construction. |
| B-2 | `invitations`: add `membership_authorization_id` (nullable, FK, + composite tenant FK) | Lets an invitation state its own provenance. Today the link is one-way and only appears once consumption is written (C8). |
| B-3 | `invitations`: add CHECK `inviter_type = 'human'` | Mirrors `membership_authorizations_human_authorizer_chk`. An agent must not invite a human. |
| B-4 | `membership_authorizations`: add `expires_at` | Only if the Director wants authorizations to lapse. No repository evidence requires it. |

**No speculative redesign. No convenience columns.**

---

## 26. Final verdict

# I2 GATE A BLOCKED — AUTHORITY UNRESOLVED

The artifact chain is sound and needs no schema change. What is unresolved is **ownership**, and the Director's own Q6 instruction is explicit: *"If unresolved, stop at Gate A."*

Three decisions are required, and none of them is derivable from repository evidence:

**D-1 — Identity bootstrap.**
Nothing in the product has ever created a `users` row or an `auth_identity`; both durable humans were planted by `scripts/r1-seed.mjs`. Does I2 gain Identity-creation authority, or does identity bootstrap become its own phase?
*If I2 gains it:* an invitation token becomes sufficient to create a human record, which is the collapse Q5 forbids — because C2 means the token was never delivered to a verified address.

**D-2 — Credential bootstrap.**
`insertPasswordCredential` exists and has no caller. The only running credential creation is `scripts/lib/provision-dev-credential.ts` — local-database-only, import-forbidden from `src/`, test-enforced. Does I2 gain Credential-creation authority, or does credential registration become its own phase?

**D-3 — Ordering, forced by the session authority.**
`issueLocalSession` and `resolveSessionFromReference` both refuse a session without an active membership, and `user_session_contexts_tenant_membership_chk` makes the membership-less shape unrepresentable at rest. So for a brand-new human, exactly one of these must give:
- **(a)** the membership is created before authentication → the token alone authorized creating a human → the invitation becomes Identity authority (forbidden by Q5), **or**
- **(b)** the session authority is changed to permit a membership-less session → a change to Session authority, which is not I2's to make.

There is no third option in the repository.

**What is NOT blocked, and can proceed the moment the Director chooses:**

Scoping I2 to the **existing-verified-human path** answers all three questions with "none of the above" — that path creates only `invitations` and `memberships`, touches no Identity, Credential, or Session authority, needs zero migrations, and every concurrency invariant it depends on already exists in the durable database. Its honest cost is C6: the resulting membership is real and correct but unreachable, because Hebun has no tenant selection.

**Stopping here. Nothing was implemented. No migration was written. No schema was modified. `hebun_r1` was read only and not migrated. The leftover database `hebun_test_hebun_i1_membership_1c8a8356214345b5` exists and was not touched. No commit, no tag, no push.**
