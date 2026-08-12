# HEBUN I1.2 — IDENTITY & CREDENTIAL ENROLLMENT AUTHORITY — GATE B

**Phase:** I1.2 — Gate B, authority + minimal schema design only
**Date:** 2026-08-12
**Director decision in force:** **P2 APPROVED** — two-key enrollment
**Scope:** Read-only inspection and design. No runtime, no route, no UI, no writer, no schema edit, no migration, no commit, no tag, no push.
**Predecessors:** `hebun-i2-gate-a-human-onboarding-authority-audit.md`, `hebun-i2-blocker-resolution-identity-credential-premembership-authority-audit.md`
**Verdict:** see §37.

---

## 1. Baseline proof

Re-measured, not recalled.

| Fact | Measured |
|---|---|
| Branch | `main` |
| HEAD | `872b753483b4402e561b242b7a7c85c20da40664` |
| `origin/main` | identical |
| Ahead / behind | `0 0` |
| Staged | none |
| Working-tree entries | **28** — 25 under `apps/dashboard` (the exact I1 + I1.1 set) + 3 documentation entries |
| Migrations on disk | 22 |
| Journal entries | 22 |
| Dependency state | `git diff HEAD -- package.json package-lock.json` **empty**; `node_modules` present |
| Tag | `hebun-p2-verified-human-governance-foundation-complete` present |
| Lint | PASS |
| Typecheck | PASS |
| Tests | **335 PASS / 0 FAIL** |
| Build | PASS |
| `npm run verify` | **exit 0** |

The three non-code entries:

```
 M learnings.md
?? docs/product-vision/runtime/hebun-i2-gate-a-human-onboarding-authority-audit.md
?? docs/product-vision/runtime/hebun-i2-blocker-resolution-identity-credential-premembership-authority-audit.md
```

**No contradiction.** The continuation state predicted exactly this shape ("25 code files from I1 + I1.1, plus documentation/learnings changes"). 25 + 3 = 28.

### Durable database `hebun_r1` — read-only

| Fact | Measured |
|---|---|
| Applied migrations | 20 |
| `membership_authorizations` | ABSENT |
| `roles_one_member_per_tenant_uq` | absent |
| `roles` | 2, both `owner` |
| `invitations` | 0 |
| `governance_domain` live values | 12 — `membership-authorization` and `organizational-role` are still only in the uncommitted I1/I1.1 migrations |

Not migrated, not mutated. Every statement was a `SELECT`.

`hebun_test_hebun_i1_membership_1c8a8356214345b5` still exists, observed while listing databases. Untouched.

### Classification of every relevant piece

| Piece | Classification |
|---|---|
| `users` | **authoritative schema, seeded rows, NO product writer** |
| `auth_identities` | **authoritative schema, seeded rows, NO product writer** |
| `auth_identity_status` enum (`pending/active/suspended/revoked`) | **implemented** (live) — only `active` has ever been written |
| `auth_identities.verified_at` + `auth_identities_active_chk` | **implemented**, but every existing value was asserted by the seed |
| `auth_credentials` | **connected** — verify / lockout / success are live; `insertPasswordCredential` and `revokeCredential` have no caller |
| `auth_credential_status` enum | **implemented** — `active`, `revoked`. **No `pending` value.** |
| `password-hash.server.ts` (scrypt) | **implemented, authoritative** |
| `credential-repository.server.ts` | **implemented, authoritative** — sole reader of `salt`/`secret_hash` |
| `scripts/lib/provision-dev-credential.ts` | **development-only, quarantined** |
| `decision_records` / `governance_sessions` | **authoritative, connected** |
| `resolveGovernanceAuthority` | **authoritative** — the single authority resolver |
| `writeGovernanceDecisionWithin` | **authoritative** — the single decision writer |
| `governance_domain` enum | **implemented** — closed set, requires migration to extend |
| `governance_decision_type` enum | **implemented** — `approve` and `reject` both present |
| `decision_records.subject_type` | **free text** — no enum, extending it costs nothing |
| `audit_log` + three sibling writers | **authoritative, connected** |
| `membership_authorizations` (I1) | **implemented, uncommitted** |
| `invitations` | **schema-only** — 0 rows, 0 writers, 0 readers |
| `genesis_nominations` (G2.1) | **implemented** — the only existing two-key artifact |
| `approvals` table | **schema-only + mock** — 0 rows, 0 DB writers/readers; `/approvals` renders `@/features/approvals/mock` |
| `user_session_contexts` | **authoritative, connected** — 47 rows, 0 with a null tenant |
| `onboarding-required` / `tenant-selection-required` | **derived contract vocabulary** — declared, zero producers, zero consumers |

---

## 2. P2 Director decision restatement

> Two-key enrollment. Invitation possession alone is **not** sufficient identity proof.
> **Key 1** — possession of the valid onboarding/invitation capability.
> **Key 2** — approval by a currently authenticated human holding legitimate Governance authority for that tenant.
> Goal: prevent a stolen or forwarded invitation from unilaterally establishing a permanent Hebun identity.
> Architectural direction, **not** permission to implement arbitrary schema or runtime.

This report determines the narrowest legitimate design that satisfies it.

---

## 3. Exact Key 1 semantics

**What the bearer proves:** possession of a secret whose keyed digest matches exactly one live `invitations` row.

Derived entirely from existing columns:

| Property | Column / rule | Already exists? |
|---|---|---|
| tenant-bound | `invitations.tenant_id` NOT NULL → `companies` | yes |
| authorization-bound | `membership_authorizations.consumed_by_invitation_id` (partial unique) | yes |
| role-bound | `invitations.intended_role_id` + composite `invitations_tenant_role_fk` | yes |
| target-bound | `invitations.normalized_email` + normalization CHECK identical to I1's | yes |
| expiry-bound | `invitations.expires_at` NOT NULL, CHECK `> issued_at` | yes |
| revocable | `status='revoked'` + `revoked_at` + reason, CHECK-paired | yes |
| unforgeable | `token_hash char(64)` + `^[0-9a-f]{64}$` + **globally unique** | yes |
| secret never stored | HMAC-SHA256 digest only, `token_version` for key rotation — the exact `session-digest.server.ts` pattern | yes |

**What Key 1 does NOT prove** (restated from the blocker-resolution audit, §13): not legal identity, not email ownership (there is no mail runtime — §30), not an existing Hebun identity, not credential ownership, not authenticated-human status.

**Key 1 is a bearer capability.** Its trust root is possession of whatever channel the Governance authority chose to hand it over, and that must be labelled a limitation, exactly as `GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR` labels its own.

---

## 4. Exact Key 2 semantics

**What the approver proves — all four, none optional:**

1. **A D1-authenticated human.** `resolveTenantContext()` returns non-null only for `status === "authorized"`, and `AuthorizedAuthenticationResult` carries a `unique symbol` brand producible solely by `createAuthorizedAuthenticationResult`.
2. **Active Governance authority in the same tenant**, resolved by **`resolveGovernanceAuthority(tenant)` and nothing else** — the same single resolver used by K4, G3, I1 and I1.1. Two ways in and only two: actor on the tenant's bootstrap decision, or an unrevoked delegation.
3. **The enrollment's tenant equals the approver's tenant.** The enrollment is tenant-scoped and the invitation carries `tenant_id`; a foreign enrollment is unreadable.
4. **No role-band shortcut.** `roles.type` is not consulted for authority. An `owner`-band human without Governance authority is refused exactly like a stranger — the doctrine `authorize-membership.server.ts` and `provision-member-role.server.ts` both state and enforce.

**May the approver approve their own enrollment?** Analysed and proven impossible in §21 — not assumed.

---

## 5. Existing Identity authority

Designed, invariant-complete, and writer-less.

```
users            rootColumns + auth_id? + email(NOT NULL) + name + S5 attributes
                 users_email_uq  ←  UNIQUE(email), NOT partial

auth_identities  rootColumns + user_id(NOT NULL, RESTRICT) + provider + issuer + subject
                 + status(default 'pending') + is_primary + verified_at + revoked_at…
                 auth_identities_provider_issuer_subject_uq  ←  UNIQUE(provider,issuer,subject), NOT partial
                 auth_identities_primary_user_uq             ←  partial, WHERE is_primary
                 auth_identities_active_chk:
                   status <> 'active' OR (verified_at IS NOT NULL AND revoked_at IS NULL
                                          AND lifecycle_status = 'active')
```

Index definitions read from the **live** database, not the schema file. Neither uniqueness index has a `WHERE` clause.

Resolver: `identity-repository.server.ts:89 findActiveLocalIdentityByEmail` — filters `provider='local'`, `status='active'`, `lifecycle_status='active'`, `revoked_at IS NULL`. **A `pending` identity is invisible to sign-in.**

---

## 6. Existing Credential authority

`credential-repository.server.ts` owns hashing (via `password-hash.server.ts`), verification, lockout, persistence, creation and revocation. `auth_credentials_active_identity_type_uq` is a partial UNIQUE on `(auth_identity_id, credential_type) WHERE status='active'`.

**The confinement rule that constrains this entire design** — `tests/d1-flow/boundaries-and-firewall.ts:38-51`:

> Only `src/db/schema/auth-credential.ts`, `src/features/auth-runtime/credential-repository.server.ts`, and `src/features/auth-runtime/password-hash.server.ts` may mention `secretHash` or `secret_hash` anywhere in `src/`. A fourth file is a test failure.

**Consequence:** no new table may carry credential secret material. Any design that stores a hashed password outside `auth_credentials` is structurally forbidden. This eliminates an entire family of "hold the credential until approval" designs — see §16.

`auth_credential_status` (live) = `active | revoked`. **There is no `pending` credential state.**

---

## 7. Pending identity semantics

**Yes — `auth_identities.status = 'pending'` already means exactly "an identity claim exists and has not been verified."** The default is `pending`, and `auth_identities_active_chk` makes `verified_at` the thing that distinguishes claimed from verified. It is a designed state that nothing has ever written.

But answering the Director's specific questions:

| Question | Answer |
|---|---|
| Can a pending row be created safely before credential enrollment? | **Structurally yes, but NOT safely** — see §11 |
| `provider` for a local password identity? | `'local'` — the value `findActiveLocalIdentityByEmail` filters on |
| `issuer`? | `'hebun-local'` — the seed's value, and the only local issuer that exists |
| `subject`? | `'local:<normalized email>'` — the seed's format |
| **Is email the subject?** | **Effectively yes, for the local provider.** `subject` is derived from the email, so `auth_identities_provider_issuer_subject_uq` means *one local identity per email address, globally* |
| Is email normalization defined? | **Yes, and shared.** `normalizeTargetEmail` (lower + trim + shape gate, deliberately not stripping dots or plus-addressing) plus identical `normalized_email_chk` CHECKs on `invitations` and `membership_authorizations` |
| Can an attacker occupy an email identity slot indefinitely? | **YES — see §11** |
| Would a rejected pending identity block legitimate enrollment? | **YES — see §11** |

---

## 8. Pending artifact options

| # | Candidate | Owner | Fact represented | Verdict |
|---|---|---|---|---|
| 1 | existing `auth_identities` in `pending` | Identity | "an identity claim exists" | **REJECTED — permanent slot DoS (§11)** |
| 2 | the `invitations` row itself | Invitation | "a capability was issued" | **REJECTED** — would need ≥5 new columns + an enum change to hold submission, continuation, approval, rejection and completion, and would make Invitation authority the owner of an Identity-authority fact. Larger, and wrongly owned. |
| 3 | a Governance decision only | Governance | "an authority decided" | **REJECTED** — a decision needs a `subject_id` and there would be no subject row to name; `decision_records` is immutable and cannot hold a *pending* state at all |
| 4 | the `approvals` table | — | free-text Director queue | **REJECTED** — schema-only + mock (0 rows, no DB writer/reader, `/approvals` renders `@/features/approvals/mock`); no tenant-invitation binding, no decision link, no identity semantics |
| 5 | `genesis_nominations` | Governance-adjacent | "one pre-Governance root per tenant" | **REJECTED** — wrong domain entirely; one row per tenant, about establishing Governance, not about admitting humans |
| 6 | `membership_authorizations` | Governance | "Governance permitted ONE onboarding" | **REJECTED** — it represents a decision already made, not a submission received. I1's own header forbids widening it. |
| 7 | **a new dedicated enrollment-request artifact** | **I1.2** | "a bearer submitted an enrollment against invitation I; approved/rejected/completed" | **CHOSEN — §9** |

Per candidate, on the Director's checklist:

| Property | #1 pending identity | #2 invitations | #7 new artifact |
|---|---|---|---|
| duplicates another truth | no | yes (identity facts on an invitation row) | no |
| tenant-bindable | only indirectly (identity is global) | yes | **yes** (`tenantColumns`) |
| invitation-bindable | no column | trivially | **yes** (FK) |
| approvable exactly once | no invariant available | needs a new one | **yes** (conditional `UPDATE … WHERE status='pending'` + unique `approval_decision_id`) |
| rejection representable | only as `revoked`, which burns the slot | needs a new enum value | **yes**, and discarding it costs nothing |
| replay/concurrency enforceable | no | partly | **yes** (§23) |

---

## 9. Chosen pending artifact

**A new table, `identity_enrollment_requests`, owned by I1.2.**

It earns its existence because it is the only place that can hold *"a bearer submitted an enrollment"* — a fact that (a) has no existing owner, (b) must be **discardable on rejection**, and (c) must not touch the identity tables before approval. Candidates 1–6 each fail on at least one of those, and candidate 1 fails catastrophically (§11).

What it holds and nothing wider:

> *"At time T, a bearer presenting invitation I submitted an enrollment request. Governance approved it by decision D / rejected it for reason R. It was completed by creating identity X."*

It carries **no email** (the invitation owns it), **no role** (the invitation owns it), **no credential material of any kind** (§6 forbids it, §18 proves the design never needs it), and **no membership**.

Exact minimal shape is stated as a Gate B request in §32. **It is not implemented here.**

---

## 10. Local identity subject / email semantics

Read from the live database:

```
local | hebun-local | local:alice@acme.test | active | verified_at = 2026-08-10 10:29:12.283882+03
local | hebun-local | local:bob@globex.test | active | verified_at = 2026-08-10 10:29:12.330278+03
```

Written by `scripts/r1-seed.mjs:40`:

```sql
insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
values ($1, 'local', 'hebun-local', $2, 'active', true, now())
```

Three consequences I1.2 must honour:

1. **For the local provider, the subject *is* the email**, prefixed `local:`. The global triple-unique index therefore enforces one local identity per email address across all tenants.
2. **`users_email_uq` enforces the same thing one layer up.** Two independent global claims on the same address.
3. **`verified_at` was asserted, never earned.** Both timestamps are the seed's `now()`. Hebun has never performed local identity verification and has no code path that could. This is precisely why §13 concludes that verification provenance needs a durable owner.

---

## 11. Identity-slot denial-of-service analysis

**This is the finding that determines the whole design, and it is not hidden.**

Proven against the live database:

```
CREATE UNIQUE INDEX users_email_uq
  ON public.users USING btree (email)                                    ← no WHERE clause

CREATE UNIQUE INDEX auth_identities_provider_issuer_subject_uq
  ON public.auth_identities USING btree (provider, issuer, subject)      ← no WHERE clause
```

Both tables use `rootColumns`, whose deletion is **soft** (`deleted_at`, `deleted_by`, `lifecycle_status`). A soft-deleted row still occupies a unique index. `auth_identities` has no hard-delete path, and its terminal state is `revoked` — which `auth_identities_revoked_chk` explicitly keeps as a row.

### The attack, if the pending artifact were a pending `auth_identity`

1. Attacker obtains an invitation issued for `alice@acme.test` (forwarded, intercepted, wrong group chat).
2. Attacker submits an enrollment. A `users` row for `alice@acme.test` and an `auth_identities` row `('local','hebun-local','local:alice@acme.test')` are created in `pending`.
3. The Governance approver sees the submission and **rejects** it.
4. The rejected identity becomes `revoked`. **The row stays.** The email and the local subject are now permanently occupied.
5. The real Alice can never enrol. Neither can any future OIDC identity claiming that subject. **The invitation's theft is irreversible even though the approval was correctly refused.**

That would make the second key protect the tenant while permanently harming the human it was meant to protect — a strictly worse outcome than P1 in one dimension.

### Mitigations evaluated

| Mitigation | Verdict |
|---|---|
| Make the identity uniqueness partial (`WHERE status <> 'revoked'`) | **REJECTED.** It alters a global invariant of an existing authority to work around a problem this design need not create, and it would let a subject revoked *for compromise* be re-registered. Wrong lever. |
| Hard-delete rejected identities | **REJECTED.** No hard-delete exists anywhere in this schema; `rootColumns` is soft-delete by design and `auth_identities_revoked_chk` presumes the row survives. |
| Reserve a distinct throwaway subject for pending rows | **REJECTED.** It would mean the pending identity is not the identity — i.e. a pending artifact by another name, with the identity tables polluted for nothing. |
| **Create NO identity row before Governance approval** | **CHOSEN.** Rejection then discards only an `identity_enrollment_requests` row, which I1.2 owns and which occupies no global slot. |

**The chosen mitigation is the design itself, not a patch on it.** It also forces the credential ordering — §17.

---

## 12. Verification provenance options

The authoritative fact: **why is this identity considered verified?**

| # | Option | Authoritative owner | Duplication | Queryable | Durable | OIDC-ready | Survives delegation/revocation |
|---|---|---|---|---|---|---|---|
| 1 | `auth_identities.verification_source` | Identity | none | 1 hop | yes | **yes** — a new value per root | **yes** — it states the *kind* of proof, not who held authority |
| 2 | Governance decision, linked by subject | Governance | none | 2 hops (identity → enrollment → decision) | yes | **no** — an OIDC identity has no decision to point at | yes |
| 3 | shared audit only | — | — | by scan | yes | no | yes |
| 4 | new enrollment artifact carries approval provenance | I1.2 | none | 2 hops | yes | **no** — seeded and OIDC identities have no enrollment row | yes |
| 5 | combination, one authoritative + others historical | — | — | — | — | — | — |

Decisive tests:

- **Audit is history, not authority.** Option 3 cannot be the owner. Stated by the repository itself in `governance-decision-audit.server.ts`.
- **A Governance decision is *authority* provenance, not *identity* provenance.** It answers "who permitted this", not "what proof of humanity was accepted". Option 2 alone conflates them.
- **Universality is the discriminator.** Options 2, 3 and 4 can answer only for identities that came through I1.2. The two seeded identities have no decision, no enrollment and no audit row — and a future OIDC identity would have none either. Only Option 1 has a slot for every identity Hebun will ever hold.
- **Can the verification reason change?** Yes — a local identity later linked to an OIDC subject would gain a stronger proof. A column can be updated with a new declared value; a decision cannot be rewritten.

---

## 13. Chosen provenance owner

**Option 5, with `auth_identities.verification_source` authoritative and everything else historical.**

```
auth_identities.verification_source   AUTHORITATIVE — what kind of proof was accepted
decision_records (subject = the enrollment request)   HISTORICAL — who approved, when, why
identity_enrollment_requests.approval_decision_id     HISTORICAL — the join between them
audit_log                                             HISTORICAL — the ledger
```

Exactly the `genesis_nominations.nomination_source` pattern, including its framing:

> *"READ THIS AS A LIMITATION, NOT A CREDENTIAL."*

`verification_source = 'governance-two-key'` would state that a Governance authority vouched for a bearer out of band. It is **not** "verified platform admin", **not** "email verified", and **not** any cryptographic claim.

**Deliberately NOT added:** `auth_identities.verified_by_actor_type` / `verified_by_actor_id`. That fact is already owned by `decision_records.actor_id`, reachable through the enrollment row's `approval_decision_id`. Adding it would create a second, driftable copy of the accountable actor — the exact failure G1 and I1 both refuse.

**Existing rows stay NULL**, which honestly reads "verified by an unrecorded process". Making the column NOT NULL would require inventing a value for two rows whose verification never happened.

---

## 14. Governance vocabulary sufficiency

| Element | Current state | Sufficient for I1.2? |
|---|---|---|
| `governance_decision_type` | `approve … reject …` both present (live) | **YES** — `approve` for the second key, `reject` for refusal. No enum change. |
| `decision_records.subject_type` | **free text**, no enum | **YES** — a new value costs zero schema |
| `decision_records.outcome` | free text | **YES** — but `writeGovernanceDecisionWithin`'s outcome mapping falls through to the membership-authorization branch for `approve`; a new branch is needed. **Code, not schema.** |
| `governance_sessions` / `decision_records` shape | complete | **YES** |
| `resolveGovernanceAuthority` | the single resolver | **YES — unchanged** |
| `audit_log` | free-text `action` / `entity_type` | **YES** — zero schema |
| **`governance_domain`** | a closed enum; live values do not include an identity concept | **NO — this is the one vocabulary gap** |

### Why an existing domain cannot carry it honestly

| Domain | Why not |
|---|---|
| `membership-authorization` (I1) | I1's own header: this domain means *admitting a human into a tenant*. I1.2 admits nobody — after it, the human still has no membership. Reusing it would make the ledger unable to distinguish "we let a person in" from "we agreed this person exists". |
| `organizational-role` (I1.1) | changes what kinds of member can exist. Unrelated. |
| `authority-delegation` (G3) | moves Governance authority. I1.2 grants none. |
| `agent-registration` | false for a human. |
| `knowledge-ratification`, `provider-tool`, `emergency`, `mission`, `goal`, `plan`, `workflow`, `command`, `memory-promotion`, `learning` | unrelated; overloading any of them is explicitly forbidden by the phase brief. |

**A new `governance_domain` value is required. That is Gate B — §32, B-3.**

---

## 15. Governance subject choice

**Subject = the enrollment request. `subject_type = 'identity_enrollment_request'`, `subject_id = identity_enrollment_requests.id`.**

Not the pending `auth_identity` id, because under the chosen design **no identity row exists at approval time** (§11). Naming a row that does not yet exist would be a decision about nothing.

This is also the shape the repository already uses: I1's decision names the `membership_authorization` it is about to create, and I1.1's names the `role`. The id is generated in the application so the decision and the artifact can bind inside one transaction — the pattern `authorize-membership.server.ts:181` documents and `provision-member-role.server.ts:111` repeats. Here the enrollment row already exists (created at Act 1), so even that is simpler: the decision names an existing row.

`subject_type` is free text — **no enum change for this.**

---

## 16. Credential enrollment ordering options

| | Model A | Model B | Model C |
|---|---|---|---|
| shape | pending identity → approval → identity verified → credential created | pending identity → credential submitted but inactive → approval → identity verified + credential activated | credential secret supplied **only after** approval |
| raw secret exposure window | one request | one request | one request |
| durable secret before approval | none | **a hashed credential exists** | none |
| orphan credentials possible | no | **yes** — a rejected enrollment leaves a credential on a revoked identity | no |
| cleanup burden | none | revoke the credential too; the identity slot is burned anyway | none |
| requires `auth_credential_status += 'pending'` | no | **YES** | no |
| requires an identity row before approval | **YES → DoS (§11)** | **YES → DoS (§11)** | **no** |
| stores secret outside `auth_credentials` | no | no (if the enum is extended) — but any *other* holding place breaks the confinement test (§6) | no |
| bearer interactions | 2 (submit, then set password) | 1 | 2 (submit, then set password) |
| attack surface | post-approval token possession completes enrolment | one-shot; largest blast radius on theft | post-approval token possession completes enrolment — **mitigable, §17** |

Model A and Model B both require an identity row to exist before approval, because `auth_credentials.auth_identity_id` is NOT NULL and `auth_identities.user_id` is NOT NULL. **Both therefore inherit the permanent slot DoS.** Model B additionally needs a credential-status enum value and creates orphan credentials.

---

## 17. Chosen ordering

**Model C.** It is not chosen for elegance — it is the only ordering that does not create an identity row before Governance has approved, and §11 makes that non-negotiable.

```
Act 1  bearer presents the invitation token
       → identity_enrollment_requests row (status='pending')
       → a continuation secret is minted, its digest stored, the secret shown ONCE
       → NO users row.  NO auth_identities row.  NO credential.  NO session.

Act 2  Governance authority approves (or rejects) under their own verified session
       → governance session + decision (subject = the enrollment request) + audit
       → the enrollment row moves pending → approved (or → rejected, and is inert forever)
       → STILL no identity, no credential

Act 3  bearer returns with the invitation token AND the continuation secret, and chooses a password
       → Identity authority creates users + auth_identities (status='active',
         verified_at set, verification_source='governance-two-key')
       → Credential authority creates the first credential via insertPasswordCredential
       → the enrollment row moves approved → completed, naming the identity it produced
       → one transaction
```

### The continuation secret, and why it is part of the design

Without it, Act 3 is gated by invitation-token possession alone. A token stolen *after* a legitimate Act 1 would let the thief complete an enrollment that Governance approved believing it was the legitimate submission.

With it, Act 3 requires the same secret that was minted at Act 1 and shown once. The approval then means what it should: *"I approve **this** submission"*, not *"I approve whoever turns up next holding the invitation."*

It is the same primitive as everything else in this repository — `randomBytes(32)` + `createHmac('sha256', serverKey)` + `char(64)` hex + a version column for rotation. **No new cryptography.**

**Residual risk, stated:** a token stolen *before* Act 1 still lets the thief be the submitter, and the approver cannot cryptographically tell. The second key reduces that to a human-in-the-loop check with out-of-band correlation and a veto — which is exactly what G2.1's operator ceremony is, and it must be labelled the same way.

---

## 18. Raw-secret confinement proof

| Requirement | How the design satisfies it |
|---|---|
| The raw password is never persisted | It arrives once, in Act 3, and is passed straight to `hashPassword` inside Credential authority. Nothing between the request and the hash writes it anywhere. |
| No temporary secret storage is invented | Model C means there is no moment when a credential exists without an identity. Nothing needs holding. |
| Secret material stays in three files | `identity_enrollment_requests` carries **no** `secret_hash`, `salt`, `algorithm` or `params`. `tests/d1-flow/boundaries-and-firewall.ts:38-51` continues to pass unchanged. |
| The continuation secret is not credential material | It is a keyed digest of a bearer reference, the same class as `invitations.token_hash` and `user_session_contexts.provider_session_reference_hash` — neither of which the confinement test covers, because neither is a password. |
| Nothing secret reaches audit | The enrollment audit rows carry ids and status only — the G1 doctrine I1 already follows. |
| Nothing secret reaches a client bundle | The enrollment table and its module are server-only; the client-component test at `boundaries-and-firewall.ts:53-71` keeps applying. |

---

## 19. First credential authority

**Credential authority owns the credential. Governance authority owns the permission to verify the identity. They never merge.**

```
Governance authority  →  authorizes identity verification (Act 2)
                         writes: governance_sessions, decision_records, audit_log
                         writes NO credential, NO identity, NO membership

Credential authority  →  hashes and persists the first credential (Act 3)
                         writes: auth_credentials  (via insertPasswordCredential)
                         decides NOTHING about authority
```

**Is `insertPasswordCredential` sufficient?** Yes, as an internal Credential-authority primitive:

- it lives in `credential-repository.server.ts` beside verify, lockout, success and revoke
- it uses the authority's own `ControlPlaneDatabase` type, so it can join a caller's transaction
- it defaults `status='active'`, `failedAttemptCount=0`, `credentialType='password'` and stamps `passwordChangedAt` — no caller can choose those
- `auth_credentials_active_identity_type_uq` makes a second active password credential a database error rather than a race

**What it does not do, and must not be asked to do:** it performs no password-strength check and no identity-state check. Those are the *caller's* obligation. I1.2's Act 3 must (a) enforce a minimum password policy at its own boundary, and (b) create the identity in the same transaction, so a credential can never attach to an identity that does not exist or is not being activated.

**No new invariant is required on `auth_credentials`.** Nothing about first enrollment differs from any other credential creation once the identity exists.

---

## 20. Dev credential quarantine proof

`scripts/lib/provision-dev-credential.ts` stays quarantined and is **not** reused. Four independent guarantees, re-verified:

1. `assertLocalDatabaseUrl` (`:145`) — throws unless the host is `127.0.0.1`, `localhost` or `::1`.
2. It lives outside the application tree; its header states nothing in `src/` may import it.
3. `tests/d1-1-flow/provisioning-boundary.ts` asserts it never touches memberships.
4. Interactive CLI framing with a 12-character minimum.

**And the fact that makes reuse unnecessary:** it never called `insertPasswordCredential`. It imports only `hashPassword` (`:14`) and issues its own raw SQL (`:120`). The two creation paths are independent implementations, so wiring up the production primitive does not approach `scripts/`, does not relax `assertLocalDatabaseUrl`, and does not touch the boundary test — which forbids only the reverse direction.

---

## 21. Self-approval analysis

**Proven, not assumed.**

### Can the prospective human approve their own enrollment?

Trace every step of the Director's five-step hypothesis:

1. *possess invitation* — yes, that is Key 1.
2. *create a pending enrollment* — yes, Act 1 is unauthenticated by necessity.
3. *authenticate somehow* — **IMPOSSIBLE at this point.** No `users` row, no `auth_identities` row, no credential exist yet (Model C, §17). `findActiveLocalIdentityByEmail` returns nothing, and `issueLocalSession` refuses at step 1.
4. *obtain Governance authority* — unreachable; `resolveGovernanceAuthority` takes a `TenantContext`, which requires an `authorized` result.
5. *approve themselves* — unreachable.

**And even after Act 3**, when the identity and credential do exist, the human still has **no membership**. `issueLocalSession:169-177` returns `forbidden("membership")`; no session is issued; `resolveTenantContext()` returns `null`; every governed action refuses a null tenant before doing anything.

> **Self-approval by a brand-new human is structurally impossible, and it is the very session invariant the blocker-resolution audit examined that makes it so.** No new constraint is needed to forbid it.

### The three adjacent cases

| Case | Result |
|---|---|
| **An existing Governance delegate enrolling themselves into another tenant** | Not applicable. They already have a `users` row and an active identity. I1.2 must refuse an enrollment whose invitation email already resolves to an existing user — that human needs I2's existing-human path, not identity bootstrap. This is a **server-side precondition**, and it is also enforced structurally at Act 3 by `users_email_uq`. |
| **Approver and prospective human are the same existing user** | Same as above — the enrollment is refused at Act 1 because the email already has a user. |
| **The bootstrap Governance human approving an enrollment for their own address** | Their address already has a `users` row (they are the bootstrap actor, so they authenticated), so the enrollment could never have been created. |

### Is any invariant needed to prove `actor ≠ subject`?

**Not for correctness** — the lifecycle makes it unreachable, three times over. **A defensive server-side refusal is still recommended**: refuse when the invitation's `normalized_email` equals the approver's own `users.email`. It cannot be a database CHECK (a CHECK cannot reach across to `users.email`), and a trigger is not this repository's style. It belongs in the approval module, with a boundary test.

**Is allowing self-approval ever legitimate?** No. Both keys existing to be held by one person makes it a one-key model, which is precisely what the Director rejected.

---

## 22. Rejection / expiry lifecycle

Only what correctness and cleanup require. No lifecycle management system.

| State | Representation | Terminal? |
|---|---|---|
| enrollment pending | `status='pending'`, `submitted_at` set | no |
| approval granted | `status='approved'`, `approved_at` + `approval_decision_id` + approver actor pair | no |
| approval denied | `status='rejected'`, `rejected_at` + `rejection_reason` | **yes** — inert forever, occupies no global slot |
| invitation expired | **not a state of the enrollment.** Evaluated as `invitations.expires_at > now()` inside the Act-3 predicate | — |
| invitation revoked | **not a state of the enrollment.** `invitations.status='pending'` inside the same predicate | — |
| enrollment abandoned | **no state, and none is needed.** A pending row whose invitation lapses becomes uncompletable by the predicate. No sweeper is written — the same honesty as `invitation_status='expired'`, which nothing writes. |
| duplicate request | prevented — partial unique on `(invitation_id) WHERE status <> 'rejected'` (§23) |
| approved request whose credential creation fails | **unrepresentable.** Act 3 creates identity + credential and flips `approved → completed` in **one transaction**; a failure rolls all three back and the row stays `approved`, retryable. |
| completed | `status='completed'`, `completed_at` + `enrolled_auth_identity_id`, CHECK-paired both ways | **yes** |

**Deliberately absent:** no `expired` enum value on the enrollment (nothing would write it — the same trap `invitations` already contains), and no enrollment-level expiry column (the invitation owns expiry; one fact, one owner).

---

## 23. Concurrency invariants

Every one has a database-level defense. None relies on `SELECT none → INSERT`.

| Race | Invariant | Lives on | Exists today? |
|---|---|---|---|
| two enrollments against one invitation | partial UNIQUE `(invitation_id) WHERE status <> 'rejected'` — the `genesis_nominations_one_active_per_tenant_uq` shape | **enrollment artifact** | **Gate B** |
| two Governance approvals of one enrollment | conditional `UPDATE … WHERE id=$1 AND tenant_id=$2 AND status='pending' RETURNING id`; 0 rows → abort the whole transaction (the G2 `EntitlementRaceLost` pattern, `bootstrap-authority.server.ts:282-304`) | **enrollment artifact** | pattern exists; predicate is code |
| approval racing rejection | same predicate — both target `status='pending'`, exactly one wins | **enrollment artifact** | as above |
| one decision reused for two enrollments | UNIQUE `approval_decision_id` (mirrors `membership_authorizations_decision_uq`) | **enrollment artifact** | **Gate B** |
| two first-credential creations for one identity | `auth_credentials_active_identity_type_uq` | **credential** | **YES — exists** |
| two pending identity requests for the same email, same tenant | `invitations_pending_email_uq` — partial UNIQUE `(tenant_id, normalized_email) WHERE status='pending'` | **invitation** | **YES — exists** |
| two invitations from different tenants targeting the same human | not prevented, and **correctly so** — two tenants may both want to hire Alice. The second Act 3 hits `users_email_uq` / `auth_identities_provider_issuer_subject_uq` → `23505`, which must be mapped to an honest "already enrolled" refusal, not a 500 | **identity** | **YES — exists** |
| credential creation retry after rollback | the `approved → completed` conditional flip plus `auth_credentials_active_identity_type_uq` make a retry either succeed once or refuse | **enrollment + credential** | partly Gate B |
| one enrollment producing two identities | `enrolled_auth_identity_id` is single-valued + the completion CHECK pair (the `membership_authorizations.consumed_*` shape) | **enrollment artifact** | **Gate B** |

Race losses become honest refusals through the established `isUniqueViolation(error, constraintName)` helper, which matches SQLSTATE `23505` **and** the constraint name.

---

## 24. Transaction boundaries

Five acts, four of which are I1.2's or later. They must not collapse.

| Act | Contents | One transaction? | Rollback meaning |
|---|---|---|---|
| **Act 0** — invitation issuance (I2) | `invitations` insert + `membership_authorizations` consumption + audit | yes | a token exists only if the authorization was spent |
| **Act 1** — enrollment submission | `identity_enrollment_requests` insert (`pending`) + continuation digest + audit | yes | nothing global is touched, so nothing global can be left behind |
| **Act 2** — Governance approval | governance session + decision + conditional `pending → approved` + audit | **yes — all four** | "approved but the decision rolled back" and "decided but the enrollment still pending" are both unrepresentable |
| **Act 3** — identity + credential | `users` (or resolve) + `auth_identities` (`active`, `verified_at`, `verification_source`) + `auth_credentials` + conditional `approved → completed` + audit | **yes — all five** | **identity verified but credential missing** and **credential created but approval rolled back** are both unrepresentable |
| **Act 4** — authentication | none of I1.2's business | — | — |
| **Act 5** — membership (I2) | invitation accepted + membership + audit | yes | separate moment, separate authority |

**Never in one transaction:** Act 1 with Act 2 (the whole point of two keys is that they are two moments by two humans); Act 2 with Act 3 (the approver approves; the bearer completes — different actors, different sessions); Act 3 with Act 5 (Identity/Credential vs Membership).

**Retry semantics.** Act 3 is the only one that can be legitimately retried, and it is safe because its first statement is the conditional `WHERE status='approved'` flip: a completed enrollment matches zero rows and the retry refuses rather than duplicating.

---

## 25. Session non-impact analysis

**I1.2 contains no Session code at all.** Proven, not asserted:

| Act | Session touched? | Why not |
|---|---|---|
| Act 1 | no — the bearer is unauthenticated and must stay so | the enrollment carries no session reference |
| Act 2 | **reads only** — `resolveTenantContext()` for the approver, exactly as I1 and I1.1 do | it consumes a session; it does not create, modify or extend one |
| Act 3 | no | the bearer completes the enrollment and is then sent to `/login` |

After Act 3, `/login` behaves correctly and unchanged: `findActiveLocalIdentityByEmail` now finds the human, `verifyPasswordCredential` succeeds, `findPrimaryActiveMembership` returns nothing, and the current code returns `forbidden("membership")`. **That is the honest present behaviour and I1.2 does not change it.**

`user_session_contexts`, `issueLocalSession`, `resolveSessionFromReference`, `createAuthorizedAuthenticationResult` and `TenantContext` are all untouched. The `authorized` invariant does not move.

---

## 26. `onboarding-required` ownership recommendation

`onboarding-required` is declared in the result union with zero producers (`authentication-result.ts:22`). Producing it means: *a human proved their credential and belongs to no tenant yet.*

| Candidate owner | Assessment |
|---|---|
| **I1.2** | **No.** I1.2's job ends when a verified identity with a credential exists. It writes no session code (§25) and must not start. |
| **I2** | **Recommended.** I2 is the phase that needs the enrolled human to get past `/login` in order to accept their invitation and receive a membership. It is I2's blocker, so it is I2's to produce. |
| **D1 extension** | Defensible — it is literally a change to `issueLocalSession`'s return. But framing it as "D1 maintenance" would hide a new product state behind a bug-fix label. |
| **Separate phase** | Not justified. It is one status and one branch, not an authority boundary. |

**Recommendation: I2 owns it, and it is out of scope here.** Note for whoever builds it: the dashboard gate is an allow-list (`if (result.status !== "authorized") redirect("/login")`), so producing the new status leaks nothing — but a surface must then exist that accepts it, or the human loops back to `/login` forever.

---

## 27. I2 integration contract

I1.2 hands I2 **nothing about credentials, and nothing about enrollment.** I2 must never read `identity_enrollment_requests`, `auth_credentials`, `salt`, `secret_hash`, or `verification_source`.

The contract, minimised:

```
GIVEN   an authenticated human            (however Session authority represents them)
AND     an unconsumed, unexpired, unrevoked invitation, proven by token digest
THEN    I2 may create the membership
```

What I2 actually needs, and where each value comes from:

| Value | Source | Why |
|---|---|---|
| `users.id` | the authenticated human's own context — **never client input** | `memberships.user_id` |
| `tenant_id` | **the invitation row** | `memberships.tenant_id`; never from the request |
| `role_id` | **the invitation row** (`intended_role_id`) | `memberships.role_id`; the pair is already validated by `invitations_tenant_role_fk` |
| `invitations.id` | resolved by token digest | `memberships.accepted_invitation_id` |
| `auth_identity_id` | **not needed** | the membership references the user, not the identity |
| `membership_authorization_id` | **not needed** | already consumed at invitation issuance; I2 reads it for nothing |

**Six values reduce to three, and two of the three come from the invitation row rather than the caller.** I2 stays an orchestrator and learns nothing about identity internals.

---

## 28. Tenant isolation

| Property | Enforcement |
|---|---|
| enrollment belongs to one tenant | `tenantColumns` — `tenant_id` NOT NULL → `companies` |
| enrollment cannot cite another tenant's invitation | Gate B: composite FK `(tenant_id, invitation_id) → invitations(tenant_id, id)`. **Requires a companion `invitations_tenant_id_id_uq`** — `invitations` has no `(tenant_id, id)` unique index today (verified live: only `invitations_pkey`, `_token_hash_uq`, `_pending_email_uq` and three plain indexes). `memberships` already carries exactly this companion (`memberships_tenant_id_id_uq`), so the pattern is established. |
| approver cannot approve another tenant's enrollment | the read is tenant-scoped by predicate, and `resolveGovernanceAuthority` is tenant-scoped; a foreign row is indistinguishable from one that never existed |
| enrollment identifiers are not guessable | lookup is by **continuation digest**, never by row id — the same rule as invitations |
| identity is global, not tenant-scoped | correct and unchanged — `users` / `auth_identities` use `rootColumns` |
| credential is global | correct and unchanged — `auth_credentials` uses `rootColumns` and its header states it carries no tenant, membership or role |
| a decision cannot name a foreign subject | the decision is written by `writeGovernanceDecisionWithin` with the tenant from `TenantContext`, and the enrollment row is tenant-matched before the call |

---

## 29. Audit model

Existing `audit_log` sink, no new sink, **zero schema**. `action` and `entity_type` are free text — the pattern three sibling writers already follow.

| Event | Actor | Recordable truthfully? |
|---|---|---|
| enrollment submitted (Act 1) | **the bearer is unauthenticated** | **PROBLEM.** `audit_log.actor_type` (enum) and `actor_id` (uuid) are both NOT NULL, and `GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts` is `false` by doctrine. |
| enrollment approved (Act 2) | the Governance approver | **yes** |
| enrollment rejected (Act 2) | the Governance approver | **yes**, as `rejected` |
| identity + credential created (Act 3) | **the enrolled human** — their `users.id` exists by the end of that transaction, and the event is genuinely about them | **yes** |

**Act 1 is the one open design point.** Two honest options: (a) do not audit Act 1 at all, and let the approval row carry `submitted_at` as the durable record — consistent with the doctrine that an unauthenticated caller must never append to a tenant's ledger; (b) create a distinct audit boundary that names the *tenant* as the entity and a system actor. Option (a) is simpler and loses nothing, because the enrollment row itself is durable evidence. **Not decided here** — it is an implementation decision for the build phase, and it must not be settled by convenience.

**Never in audit:** the invitation token, the continuation secret, either digest, the password, the salt, the hash, or a duplicate of the email (`invitations.normalized_email` is its single owner). Ids, status and band only.

---

## 30. Future OIDC / passkey compatibility

The design does **not** hardcode password enrollment as the constitutional identity model.

| Element | Provider-neutral? |
|---|---|
| `auth_identities (provider, issuer, subject)` | **yes** — the OIDC tuple verbatim; `hebun-local` is one issuer among many |
| `identity_enrollment_requests` | **yes** — it carries no credential columns, no password reference and no provider assumption. It records *a submission against an invitation*, which is equally true for an OIDC bearer. |
| `verification_source` | **yes, and this is its main forward value** — `'oidc'` or `'passkey'` becomes a new declared value; the column is the one place that will distinguish them |
| Act 3 | **the only password-specific step.** An OIDC flow replaces "choose a password → `insertPasswordCredential`" with "bind the verified external subject", creating no credential at all |
| `auth_credential_type` enum | `password` only — adding `passkey`/`totp` stays a deliberate schema decision, exactly as its header intends |
| second key | **optional for a strong provider.** An OIDC-verified identity arrives with real proof and could skip Key 2 entirely; the enrollment row would move `pending → completed` with `verification_source='oidc'` and no Governance decision |

**Stated limitation:** the *credential* half of Act 3 is local-password-specific today, and necessarily so — `auth_credential_type` holds one value. The *enrollment and verification* halves are not.

---

## 31. Existing schema sufficiency

| Need | Sufficient today? |
|---|---|
| invitation as Key 1 (tenant, role, email, expiry, revocation, unforgeable digest) | **YES** |
| Governance authority resolution for Key 2 | **YES** — `resolveGovernanceAuthority`, unchanged |
| a Governance decision for the approval | **YES** for `approve`/`reject` and for `subject_type` (free text) |
| **a `governance_domain` value for identity enrollment** | **NO** |
| **a durable pending-enrollment artifact** | **NO** |
| identity creation columns | **YES** — `users` and `auth_identities` are complete |
| **a durable record of why an identity is verified** | **NO** |
| credential creation | **YES** — `insertPasswordCredential` + `auth_credentials_active_identity_type_uq` |
| pending credential state | **NOT NEEDED** — Model C never creates one |
| one-active-credential invariant | **YES** |
| no-duplicate-identity invariant | **YES** — `users_email_uq` + `auth_identities_provider_issuer_subject_uq` |
| audit for the whole lifecycle | **YES** (except the anonymous Act-1 actor, §29) |
| session behaviour | **YES — untouched** |
| **composite tenant FK from the enrollment to its invitation** | **NO** — `invitations` has no `(tenant_id, id)` unique index to reference |

---

## 32. Exact Gate B schema request

Five changes. Each answers the Director's five questions. **None is implemented, and no migration was generated.**

### B-1 — new enum `identity_enrollment_status`

```
'pending' | 'approved' | 'rejected' | 'completed'
```

- **Authoritative fact:** where one enrollment stands in the two-key ceremony.
- **Owner:** I1.2.
- **Why existing schema cannot represent it:** `approval_state` (`not-required/pending/approved/rejected`) belongs to the mock, writer-less `approvals` table, lacks `completed`, and borrowing it would tie a constitutional artifact to a mock's vocabulary. `invitation_status` describes a capability, not a submission. `membership_authorization_status` describes a Governance permission.
- **Why minimal:** four values, each reachable and each meaning something different. `completed` is separate from `approved` for the same reason `membership_authorizations` has `consumed` separate from `authorized` — "approved but not yet enrolled" and "approved and enrolled" are different facts. No `expired` value, because nothing would write it.
- **Invariant enforced:** with the CHECKs in B-2, it makes "rejected but completed" and "completed with no identity" unrepresentable.

### B-2 — new table `identity_enrollment_requests`

```
tenantColumns
invitation_id            uuid NOT NULL  → invitations(id) RESTRICT
continuation_hash        char(64) NOT NULL   CHECK ~ '^[0-9a-f]{64}$'
continuation_version     integer  NOT NULL DEFAULT 1   CHECK > 0
status                   identity_enrollment_status NOT NULL DEFAULT 'pending'
submitted_at             timestamptz NOT NULL DEFAULT now()

approved_at              timestamptz
approval_decision_id     uuid → decision_records(id) RESTRICT
approved_by_actor_type   actor_type
approved_by_actor_id     uuid

rejected_at              timestamptz
rejection_reason         varchar(128)

completed_at             timestamptz
enrolled_auth_identity_id uuid → auth_identities(id) RESTRICT

UNIQUE INDEX  identity_enrollment_requests_continuation_uq  (continuation_hash)
UNIQUE INDEX  identity_enrollment_requests_one_live_per_invitation_uq
              (invitation_id) WHERE status <> 'rejected'
UNIQUE INDEX  identity_enrollment_requests_decision_uq
              (approval_decision_id) WHERE approval_decision_id IS NOT NULL
UNIQUE INDEX  identity_enrollment_requests_identity_uq
              (enrolled_auth_identity_id) WHERE enrolled_auth_identity_id IS NOT NULL
FOREIGN KEY   (tenant_id, invitation_id) → invitations(tenant_id, id) RESTRICT   ← needs B-5
INDEX         (tenant_id, status)

CHECK approved:  (status IN ('approved','completed'))
                 = (approved_at IS NOT NULL AND approval_decision_id IS NOT NULL
                    AND approved_by_actor_type IS NOT NULL AND approved_by_actor_id IS NOT NULL)
CHECK rejected:  (status = 'rejected')
                 = (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL
                    AND char_length(btrim(rejection_reason)) > 0)
CHECK completed: (status = 'completed')
                 = (completed_at IS NOT NULL AND enrolled_auth_identity_id IS NOT NULL)
CHECK human:     approved_by_actor_type IS NULL OR approved_by_actor_type = 'human'
```

- **Authoritative fact:** "a bearer submitted an enrollment against invitation I; Governance approved/rejected it; it produced identity X."
- **Owner:** I1.2.
- **Why existing schema cannot represent it:** §8 rejects all six alternatives. The decisive one is §11 — a pending `auth_identity` permanently burns a global email and subject slot on rejection.
- **Why minimal:** it carries no email, no role, no tenant-selection, no expiry, and **no credential material of any kind** — every one of those has an existing owner. Every column is either the artifact's own identity, one of three terminal-state evidence groups, or a required invariant.
- **Invariants enforced:** one live enrollment per invitation; one decision per enrollment; one identity per enrollment; a globally unique continuation digest; a human approver; all-or-nothing state evidence in both directions.

### B-3 — `governance_domain` += `'identity-enrollment'`

- **Authoritative fact:** which constitutional concern a decision belongs to.
- **Owner:** Governance.
- **Why existing schema cannot represent it:** §14 — every one of the fourteen existing values is false here. `membership-authorization` would assert that verifying an identity *is* admitting a human, which is the exact conflation I1 refused when it declined to reuse `authority-delegation`.
- **Why minimal:** one value. `governance_decision_type` needs nothing (`approve` and `reject` exist); `subject_type` needs nothing (free text).
- **Invariant enforced:** the ledger stays queryable by domain — "which decisions changed who may exist in Hebun" remains a single, honest query.

### B-4 — `auth_identities.verification_source varchar(64)` NULL

```
CHECK  verification_source IS NULL
       OR verification_source IN ('governance-two-key')
CHECK  verification_source IS NULL OR verified_at IS NOT NULL
```

- **Authoritative fact:** what proof of humanity was accepted for this identity.
- **Owner:** Identity authority — it is the owner of "is this identity verified".
- **Why existing schema cannot represent it:** `verified_at` records *that* it happened and is silent on *what was accepted*. Today's two rows carry `verified_at` from a seed's `now()` with no proof at all, so a seeded identity and a two-key-verified one are already indistinguishable. §12 shows the Governance decision, the enrollment row and the audit ledger can each answer only for identities that came through I1.2 — none of them can answer for the seeded rows or for a future OIDC identity.
- **Why minimal:** one nullable column and no companion actor columns. `verified_by_*` is deliberately omitted because `decision_records.actor_id` already owns the accountable actor. The value set starts at exactly one entry; widening it is a deliberate schema decision, the same rule `genesis_nominations_source_chk` states.
- **Invariant enforced:** a declared value cannot be invented at the application layer, and a source can never be claimed without a verification timestamp. Existing rows stay NULL, honestly reading "verified by an unrecorded process".

### B-5 — `invitations`: add UNIQUE `(tenant_id, id)`

- **Authoritative fact:** none new — it is the companion index that makes structural tenant binding *possible* for anything referencing an invitation.
- **Owner:** Invitation authority.
- **Why existing schema cannot represent it:** verified live — `invitations` has only `invitations_pkey`, `invitations_token_hash_uq` and `invitations_pending_email_uq`. Without `(tenant_id, id)` there is no target for B-2's composite FK, and "a Tenant A enrollment citing a Tenant B invitation" would be prevented only by an application check.
- **Why minimal:** one unique index, no column. `memberships_tenant_id_id_uq` and `roles_tenant_id_id_uq` are the same pattern already in the database.
- **Invariant enforced:** cross-tenant enrollment becomes a database error rather than a check somebody can forget.

**Total: one enum, one table, one enum value, one nullable column, one unique index.**

---

## 33. Rejected schema alternatives

| Alternative | Why rejected |
|---|---|
| pending `auth_identities` row as the artifact (no new table) | permanently burns `users_email_uq` and `auth_identities_provider_issuer_subject_uq` on rejection (§11) |
| make `auth_identities_provider_issuer_subject_uq` partial (`WHERE status <> 'revoked'`) to fix the above | alters a global invariant of an existing authority to solve a problem the chosen design never creates; would also let a subject revoked *for compromise* be re-registered |
| make `users_email_uq` partial | same objection, on the more fundamental of the two indexes |
| hard-delete rejected identities | no hard-delete exists anywhere; `rootColumns` is soft-delete by design |
| `auth_credential_status += 'pending'` | needed only by Model B, which §16 eliminates on the DoS ground before the enum is even reached |
| a second table holding `secret_hash` until approval | **breaks `tests/d1-flow/boundaries-and-firewall.ts:38-51` outright** — only three files in `src/` may name the stored secret |
| new columns on `invitations` instead of a new table | ≥5 columns plus an enum change, and it makes Invitation authority the owner of Identity-authority facts |
| reuse the `approvals` table / `approval_state` enum | schema-only + mock (0 rows, 0 DB writers, `/approvals` renders a mock); no `completed` state; free-text columns with no tenant/invitation/decision binding |
| `auth_identities.verified_by_actor_type` / `_actor_id` | duplicates `decision_records.actor_id`, reachable via `approval_decision_id`. Two copies of the accountable actor can drift. |
| a new `governance_decision_type` value | unnecessary — `approve` and `reject` both exist in the live enum |
| a `decision_records.subject_type` enum | unnecessary — the column is free text by design |
| an `expired` value on `identity_enrollment_status` | nothing would write it; the same trap `invitation_status='expired'` already is |
| an `expires_at` on the enrollment | the invitation already owns expiry; one fact, one owner |
| storing `normalized_email` on the enrollment | the invitation owns it; a copy could drift, and it would make the artifact provider-specific |

---

## 34. Explicit non-capabilities

I1.2, as designed, does **not** provide:

- membership creation of any kind (that is I2)
- session issuance, session mutation, or any change to `issueLocalSession`, `resolveSessionFromReference` or the `authorized` invariant
- a producer for `onboarding-required` (recommended to I2 — §26)
- tenant switching or tenant selection
- email, SMS, or any delivery; no proof a token reached anyone
- email-address verification
- SSO, OIDC, SAML, passkeys, MFA
- password recovery, reset, or self-service rotation
- self-service signup
- identity administration: no rename, no merge, no re-verification, no suspension, no revocation runtime
- credential rotation or revocation surfaces
- recovery of an email address burned by an earlier claim
- role management, permissions runtime, provider access, execution / Computer Use / terminal authority
- any Governance authority — an enrolled human has none, and holds no membership either

---

## 35. Remaining limitations

1. **A token stolen before Act 1 still lets the thief be the submitter.** The second key reduces this to a human-in-the-loop check with out-of-band correlation and a veto. It does not eliminate it, and it must be labelled a limitation, not a credential — exactly as `GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR` is.
2. **Hebun still cannot verify an email address.** No mail runtime exists (re-verified: zero dependencies, zero code, zero env keys). `invitations.last_sent_at` and `send_count` remain columns describing an act Hebun cannot perform, and must stay NULL/0.
3. **Act 1 has no representable audit actor.** §29 — the enrollment row is durable evidence, but the shared ledger cannot name an unauthenticated submitter.
4. **The enrolled human still cannot log in usefully.** After Act 3 they have an identity and a credential and no membership, so `/login` returns `forbidden("membership")` until I2 and the `onboarding-required` producer exist.
5. **A rejected enrollment blocks the invitation.** The partial unique means a new attempt needs a new invitation. That is intentional (a rejection should not be retryable by the same bearer), but it makes invitation re-issuance a required part of I2's surface.
6. **Two tenants inviting the same brand-new human is a race.** Whoever completes Act 3 first owns the identity; the second gets a `23505` that must surface as an honest "already enrolled", after which that human's second tenant is I2's existing-human path.
7. **The credential half of Act 3 is local-password-specific.** `auth_credential_type` holds one value, and widening it stays a deliberate schema decision.

---

## 36. Final authority graph

```
   HUMAN A — Governance authority, D1-verified, normal tenant session
        │
        │ ① authorize one future onboarding                        [I1 — BUILT]
        ▼
   membership_authorizations (authorized)
        │
        │ ② issue invitation + spend the authorization             [I2 · Invitation authority]
        ▼                                                            one transaction
   invitations (pending · digest stored · expires_at set)
        │
        │ ③ raw token handed over OUT OF BAND — Hebun sends nothing
        ▼
   HUMAN B — brand new, unauthenticated
        │
        │ ④ KEY 1 — submit enrollment                              [I1.2 · Act 1]
        ▼                                                            one transaction
   identity_enrollment_requests (pending · continuation digest)
        │       ↑ NO users row · NO auth_identities row · NO credential · NO session
        │
        │ ⑤ KEY 2 — approve, under HUMAN A's own verified session  [I1.2 · Act 2]
        │    resolveGovernanceAuthority — the single resolver, unchanged
        ▼                                                            one transaction
   governance_sessions + decision_records(domain='identity-enrollment',
                                          subject='identity_enrollment_request')
   enrollment → approved                     [rejected → inert forever, no slot burned]
        │
        │ ⑥ HUMAN B returns: invitation token + continuation secret + password
        ▼                                                            one transaction
   Identity authority   → users + auth_identities(active, verified_at,
                                                  verification_source='governance-two-key')
   Credential authority → auth_credentials via insertPasswordCredential
   enrollment           → completed, naming the identity it produced
        │
        │ ⑦ HUMAN B signs in through the UNCHANGED /login
        ▼
   identity ✓  credential ✓  membership ✗   →  forbidden("membership") today
        │
        │ ⑧ membership                                             [I2 — NOT BUILT]
        ▼
   normal tenant session — the `authorized` invariant never moved
```

**Authorities crossed: five. Authorities merged: zero.**
Governance decides. Invitation issues the capability. I1.2 orchestrates and owns only the enrollment request. Identity creates and verifies. Credential enrols. Session is untouched. Membership is I2's.

---

## 37. Final verdict

# I1.2 GATE B REQUIRED — MINIMAL SCHEMA CHANGE DEFINED

The Director-approved two-key model **can** be represented safely, and the design above does so without merging a single authority. It cannot be represented with the current schema.

**Why no-schema-change is impossible:** the pending state has no honest home. The one candidate that needed no new table — a `pending` `auth_identities` row — was measured against the live database and found to permanently burn a global email address and local subject on rejection (§11), because `users_email_uq` and `auth_identities_provider_issuer_subject_uq` are both non-partial and neither table has a hard delete. That would let a stolen invitation inflict irreversible harm on the very human the second key exists to protect — a worse outcome than the model the Director rejected.

**The five changes, in one place:**

| # | Change | The fact it stores | Owner |
|---|---|---|---|
| **B-1** | new enum `identity_enrollment_status` = `pending / approved / rejected / completed` | where one enrollment stands in the ceremony | I1.2 |
| **B-2** | new table `identity_enrollment_requests` | "a bearer submitted an enrollment against invitation I; Governance approved/rejected it; it produced identity X" | I1.2 |
| **B-3** | `governance_domain` += `identity-enrollment` | which constitutional concern the approval belongs to | Governance |
| **B-4** | `auth_identities.verification_source varchar(64)` NULL + value CHECK + `verified_at` pairing CHECK | what proof of humanity was accepted | Identity |
| **B-5** | `invitations`: UNIQUE `(tenant_id, id)` | none new — the companion index that makes B-2's composite tenant FK possible | Invitation |

**What needs nothing:** `governance_decision_type` (`approve` and `reject` both exist), `decision_records.subject_type` (free text), `auth_credential_status` (Model C never creates a pending credential), `auth_credentials` (its creation primitive and its one-active invariant are already correct), `memberships`, `roles`, `user_session_contexts`, and every Session, Membership, Role and Governance-resolver behaviour.

**STOPPING HERE.** No runtime, no route, no UI, no API handler. No identity, credential, invitation, membership or session created. No writer wired. No enum, table, column, index or constraint edited. No migration generated or applied. `hebun_r1` read only and unmigrated. The leftover database was observed while listing databases and otherwise untouched. No dependency added. No commit, no tag, no push.

**Schema changes are not authorized. This is a request, awaiting the Director.**

---
---

# B-4 Verification Source Necessity Proof

**Added:** 2026-08-12, after Director disposition on Gate B.
**Scope:** one question only. B-1, B-2, B-3 and B-5 are approved in principle and are **not** reopened. P2 is settled and is **not** reopened.
**Question:** once `identity_enrollment_requests`, its Governance approval decision, and the resulting `auth_identity` are durably linked, does `auth_identities.verification_source` store an **independent authoritative Identity fact** that cannot be honestly derived from those artifacts?

---

## B4.1 Baseline confirmation

Re-proven only far enough to confirm nothing material moved.

| Fact | Measured |
|---|---|
| HEAD | `872b753483b4402e561b242b7a7c85c20da40664` |
| `origin/main` | identical |
| Ahead / behind | `0 0` |
| Staged | none |
| Migrations on disk / journal | 22 / 22 |
| Dependency diff | empty |
| Working-tree entries | **29** — 25 code (the unchanged I1 + I1.1 set) + 4 documentation entries |

The four documentation entries are `learnings.md` plus the three audit reports written in this recovery sequence, the newest being this file. **No material change; no contradiction.** Full `verify` was green at 335/335 when this file was created and no source file has been touched since.

`hebun_r1`: not connected to for this proof beyond nothing — no query was needed. The leftover database was not touched.

---

## B4.2 Current `auth_identities` truth

Read from the schema and confirmed earlier against the live database:

```
provider      varchar(64)   NOT NULL   — which authentication root issued the claim
issuer        varchar(2048) NOT NULL   — which instance of that root
subject       varchar(512)  NOT NULL   — the root's identifier for this human
status        enum          NOT NULL   — pending | active | suspended | revoked
verified_at   timestamptz   NULL
is_primary    boolean       NOT NULL

auth_identities_provider_issuer_subject_uq   UNIQUE (provider, issuer, subject)
auth_identities_active_chk
  status <> 'active' OR (verified_at IS NOT NULL AND revoked_at IS NULL AND lifecycle_status = 'active')
```

Header, verbatim: *"Provider-neutral authentication identities."*

**The triple is the verification method.** `(provider, issuer)` names *what root of trust vouched for this subject*. `('local','hebun-local')` says an internal root did; `('oidc','https://…')` would say a named external IdP did. That is not incidental — it is the entire purpose of a provider-neutral tuple, and it is already NOT NULL.

---

## B4.3 `verified_at` semantics

**Measured fact, and it is decisive: `verified_at` is read by exactly one thing in the entire repository — the CHECK constraint `auth_identities_active_chk`.**

```
grep -rn "verifiedAt|verified_at" src scripts
  src/db/schema/auth-identity.ts:33     — the column declaration
  src/db/schema/auth-identity.ts:64     — inside auth_identities_active_chk
  (auth-credential.ts / user.ts hits are different columns: last_verified_at)
```

No TypeScript selects it, filters on it, returns it, or branches on it. `findActiveLocalIdentityByEmail` filters on `provider`, `status`, `lifecycleStatus` and `revokedAt` — never on `verifiedAt`.

So:

```
verified_at          = WHETHER and WHEN this identity became verified.
                       Its only job is to make status='active' impossible without a
                       verification timestamp. It is a gate, not a description.

verification provenance = WHY, BY WHAT AUTHORITY, BY WHICH METHOD it became verified.
                       No column represents this today, and no runtime asks for it.
```

The distinction is real. What follows is whether the second one needs a new home on `auth_identities`.

---

## B4.4 B-2 → Governance decision → identity provenance graph

Assuming approved B-2, with `enrolled_auth_identity_id` and `approval_decision_id` as designed (§32 B-2), all FKs `RESTRICT` and both columns partially unique:

```
auth_identities (X)
      ▲
      │ enrolled_auth_identity_id      UNIQUE WHERE NOT NULL    (one enrollment → one identity)
      │
identity_enrollment_requests (Y)   ── invitation_id ──▶ invitations (I)
      │                                                    └─ tenant_id, intended_role_id,
      │                                                       normalized_email, expires_at
      │ approval_decision_id           UNIQUE WHERE NOT NULL    (one decision → one enrollment)
      ▼
decision_records (Z)   domain = 'identity-enrollment'
      │                subject_type = 'identity_enrollment_request'
      │                subject_id   = Y
      ├─ actor_type / actor_id                 the approving human
      ├─ authority_source_actor_type / _id     the authority they acted under
      ├─ decided_at                            when approval occurred
      ├─ justification (NOT NULL, never rewritten)
      └─ session_id ──▶ governance_sessions
```

Every question the Director listed, answered from authoritative artifacts alone:

| Question | Answered by | Hops |
|---|---|---|
| which enrollment produced identity X | `identity_enrollment_requests.enrolled_auth_identity_id = X` | 1 |
| which tenant ceremony authorized it | `identity_enrollment_requests.tenant_id` (and B-5's composite FK binds the invitation to the same tenant) | 1 |
| which Governance decision approved it | `identity_enrollment_requests.approval_decision_id` | 1 |
| which Governance human approved it | `decision_records.actor_id` | 2 |
| when approval occurred | `decision_records.decided_at`, and `identity_enrollment_requests.approved_at` | 1–2 |
| when identity became verified | **`auth_identities.verified_at`** — already exists | 0 |
| which invitation initiated the ceremony | `identity_enrollment_requests.invitation_id` | 1 |

**Not one of the seven requires B-4.** Six are answered by B-2 and the decision; the seventh is already `verified_at`.

And B-2 can legitimately carry `enrolled_auth_identity_id`: the FK direction is ceremony → identity, so Identity authority does not depend on I1.2. The `completed` CHECK pair (`(status='completed') = (completed_at IS NOT NULL AND enrolled_auth_identity_id IS NOT NULL)`) makes "completed but we do not know which identity" unrepresentable, exactly as `membership_authorizations_consumed_chk` does for its own artifact.

### The precedent correction

The earlier §12/§13 argument invoked `genesis_nominations.nomination_source` as the precedent for B-4. **Re-read on disk, that precedent argues the other way.**

```
genesis_nominations
  nomination_source            varchar(64) NOT NULL   ← on the CEREMONY artifact
  nominated_auth_identity_id   uuid → auth_identities(id) RESTRICT
```

G2.1 faced the identical need — record what root of trust produced a vouching act — and put the column on **its own ceremony table**, pointing at the identity. **It added nothing to `auth_identities`.** The structurally faithful analogue of `nomination_source` is a column on `identity_enrollment_requests`, not on `auth_identities`.

And even that is unnecessary here: B-2 has exactly one ceremony kind by construction, so a `source` column on it would be a constant. **No such column is requested; B-2's approved scope is not widened.**

---

## B4.5 Authoritative provenance without audit

The test is deliberately run with **`audit_log` ignored entirely.**

| Layer | Role |
|---|---|
| `identity_enrollment_requests.enrolled_auth_identity_id` (unique FK, RESTRICT) | **authority** — a durable, non-deletable structural relationship |
| `identity_enrollment_requests.approval_decision_id` (unique FK, RESTRICT) | **authority** — the decision cannot be deleted while referenced |
| `decision_records` actor / authority-source / `decided_at` / `justification` (NOT NULL, never rewritten) | **authority** — the constitutional record |
| `audit_log` rows | **historical observation only** |

Delete every audit row and the entire graph in B4.4 still resolves, because it is made of foreign keys and NOT NULL columns rather than log entries. **Removing B-4 does not make audit the only provenance source** — the condition the Director set for B-4 possibly still being necessary is not met.

---

## B4.6 Future provider compatibility

The collision test the Director specified, run against a concrete row:

```
provider            = 'oidc'
issuer              = 'https://accounts.google.com'
subject             = '1078…'
verification_source = 'governance-two-key'      ← what does this row assert?
```

| Candidate meaning | Real owner |
|---|---|
| who authenticated the identity | `provider` + `issuer` |
| how the external identity was verified | `provider` + `issuer` — that IS the IdP's assertion |
| why Hebun trusts the subject | `provider` + `issuer`, plus tenant policy about which issuers are acceptable |
| who approved organizational enrollment | `decision_records.actor_id` via `identity_enrollment_requests` |
| who authorized tenant membership | `membership_authorizations` (I1) and the membership itself (I2) |

Five distinct facts, five distinct existing owners, and `verification_source` would be a single varchar sitting across all of them.

Worse, the OIDC-plus-second-key case has **two simultaneously true values** — the subject was verified by Google *and* the enrollment was approved by a Governance human. One varchar must either pick one and be misleading, or become a set and start growing schema. Under the Director's own instruction, *"if one varchar field would collapse these concepts, treat that as evidence AGAINST B-4."* It does, and this is the strongest single piece of evidence in this proof.

### The self-refutation of the original universality argument

The earlier §12 rejected the alternatives on the ground that *"the two seeded identities have no decision, no enrollment and no audit row — and a future OIDC identity would have none either."* Then §13 stated *"Existing rows stay NULL."*

Both cannot be load-bearing. **B-4 would be NULL for exactly the rows it was justified by**, so it answers nothing for them. And for a future OIDC identity, `provider='oidc'` already answers, so `verification_source='oidc'` would be a verbatim copy of an existing NOT NULL column.

What the seeded rows actually say, without any new column: `provider='local'`, `issuer='hebun-local'`, `verified_at` set, **and no `identity_enrollment_requests` row referencing them**. That combination *is* the honest answer — "a local identity marked verified with no enrollment ceremony behind it, i.e. asserted outside the product". Absence of an enrollment row is an answer, not a gap. The earlier argument treated it as a gap. That was the error.

---

## B4.7 Source-of-truth ownership table

| Fact | Exactly one authoritative owner |
|---|---|
| identity exists | the `auth_identities` row |
| identity provider | `auth_identities.provider` |
| identity issuer | `auth_identities.issuer` |
| identity subject | `auth_identities.subject` |
| identity verified status | `auth_identities.status` + `auth_identities_active_chk` |
| identity verification timestamp | `auth_identities.verified_at` |
| enrollment request | `identity_enrollment_requests` (B-2) |
| invitation that initiated enrollment | `identity_enrollment_requests.invitation_id` → `invitations` |
| Governance approval | `decision_records` via `approval_decision_id` |
| approving actor | `decision_records.actor_type` / `actor_id` |
| resulting identity | `identity_enrollment_requests.enrolled_auth_identity_id` |
| credential existence | `auth_credentials` (+ `auth_credentials_active_identity_type_uq`) |
| **verification method / root of trust** | **`auth_identities.provider` + `issuer`** — already NOT NULL |
| **whether a Governance ceremony vouched for this identity** | **the existence of an `identity_enrollment_requests` row naming it** — a unique FK, so the answer is exact |

**What unique fact remains for `verification_source`? None.**

Every candidate reduces to one of the rows above. The nearest thing to a residual — *"the kind of proof accepted"* — is `(provider, issuer)` for the external half and enrollment-row existence for the internal half, and both are already structural, NOT NULL or unique, and non-deletable.

---

## B4.8 Query-convenience test

The only practical advantage of B-4 is:

```sql
-- with B-4
select verification_source from auth_identities where id = $1;

-- without B-4, from authoritative artifacts
select d.actor_id, d.decided_at, e.invitation_id, e.tenant_id
  from identity_enrollment_requests e
  join decision_records d on d.id = e.approval_decision_id
 where e.enrolled_auth_identity_id = $1;
-- zero rows  ⇒  no Governance enrollment ceremony; read (provider, issuer) instead
```

Two hops, both across unique indexes, both across FKs that cannot be deleted. The second query also returns *strictly more* — the actor, the moment, the invitation and the tenant — where the varchar returns a category label.

Per the Director's rule: **the sole advantage is query shape, therefore REJECT.** A derived read model may be added later if operations justify it; none is designed here.

---

## B4.9 Drift / mutability analysis

| Question | If B-4 existed |
|---|---|
| Can it change? | An identity later linked to an external IdP creates a **second** `auth_identities` row (different `provider`/`subject`), not a mutation — so per-row it looks stable. But the OIDC-plus-second-key row has two true values from the moment it is written, so it is born ambiguous rather than drifting into ambiguity. |
| Who may change it? | Nobody is designed to. A column no writer may update is a constant — and a constant that restates a relationship is a copy of that relationship. |
| If it disagrees with B-2? | B-2 is a unique FK from the ceremony to the identity. A varchar saying `'governance-two-key'` with no enrollment row referencing that identity would be a claim with no ceremony behind it. |
| If it disagrees with the Governance decision? | Same class of contradiction, one hop further. |
| Which wins? | The FK chain must win — it is structural and non-deletable. **Which means the varchar is, by construction, never the authority.** |
| Can future OIDC linking change the value? | Only by rewriting a historical claim, which the repository's lifecycle conventions forbid everywhere else. |
| Can an identity have more than one verification event/method? | `auth_identities` is one row per `(provider, issuer, subject)`, so one row is one root — but the two-key ceremony is an *additional* verification event over that same row, which is exactly the double-truth case above. |

Every one of these answers requires a synchronization rule between B-4 and the artifacts that would already be authoritative. **Per the Director's own criterion, that is strong evidence of duplicate truth.**

---

## B4.10 Security-invariant analysis

Does B-4 enforce anything? Tested against the seven protections the Director listed:

| Would its absence permit… | Prevented instead by |
|---|---|
| token-only identity activation | Act 3's predicate requires an `identity_enrollment_requests` row in `status='approved'`; a `pending` or `rejected` row matches zero rows |
| bypass of the Governance second key | the same predicate + the `approved` CHECK pair, which makes `approved` impossible without `approval_decision_id` and the approver actor pair |
| credential creation before approval | Model C ordering + Act 3's single transaction; `auth_credentials.auth_identity_id` is NOT NULL and the identity does not exist before approval |
| identity activation without enrollment | Act 3 is the only writer, and it starts from an approved enrollment row |
| cross-tenant approval | tenant-scoped reads + `resolveGovernanceAuthority` + B-5's composite FK `(tenant_id, invitation_id)` |
| replay | `identity_enrollment_requests_continuation_uq` + conditional `UPDATE … WHERE status='approved' RETURNING id` |
| double enrollment | `identity_enrollment_requests_one_live_per_invitation_uq` (partial) + `…_identity_uq` (partial) |

**B-4 enforces none of them.** Its only proposed constraint is a value-set CHECK on itself, which constrains nothing but its own spelling. It is forensic labelling, not enforcement — and the Director's instruction is explicit that forensic convenience must not be confused with enforcement.

---

## B4.11 Shape A vs Shape B

| | **Shape A** — B-1, B-2, B-3, **B-4**, B-5 | **Shape B** — B-1, B-2, B-3, B-5 |
|---|---|---|
| authoritative facts representable | identical | **identical** |
| security invariants | status machine, conditional updates, 4 unique indexes, 3 CHECK pairs, composite tenant FK | **the same set, unchanged** |
| provenance reconstructable without audit | yes, via the FK chain — B-4 adds a label the FK chain already implies | **yes, via the same FK chain** |
| future-provider ambiguity | **collapses ≥5 distinct facts into one varchar; the OIDC-plus-second-key row is born with two true values** | **none** — `provider`/`issuer` answer the external half, enrollment-row existence the internal half |
| duplicate truth | **yes** — a varchar restating a unique FK relationship, with a synchronisation rule required and no writer allowed to maintain it | **none** |
| functionality impossible | — | **nothing** |

**Shape B loses no authoritative capability.** Per the Director's rule in PROOF 10, Shape B is chosen.

---

## B4.12 Exact B-4 verdict

**B-4 is REJECTED.**

`verification_source` would store no independent authoritative Identity fact. Every meaning it could carry is already owned:

- *"what root of trust vouched for this subject"* → `auth_identities.provider` + `issuer`, both NOT NULL and both part of the global unique triple.
- *"whether a Governance ceremony vouched for this identity"* → the existence of an `identity_enrollment_requests` row naming it, via a partial-unique, RESTRICT foreign key.
- *"who approved, when, and under what authority"* → `decision_records`, reachable in one further hop, with `justification` NOT NULL and never rewritten.
- *"whether and when the identity became verified"* → `auth_identities.status` + `verified_at`, which already exist and which `auth_identities_active_chk` already welds together.

It enforces no invariant, it is never the authority in any disagreement, it collapses at least five distinct facts into one varchar the moment a non-local provider appears, and the rows that originally justified it would carry NULL.

**The Identity-ownership steelman fails on repository evidence.** No Identity code path reads `verified_at`, let alone a reason for it — the only consumer of `verified_at` in the entire repository is a CHECK constraint. There is no Identity invariant that requires answering "why" without traversal, so the traversal is not an inversion; and the FK runs ceremony → identity, so Identity authority does not depend on I1.2 either way. The question `verification_source` actually answers is *"why was this prospective human allowed through this organizational enrollment ceremony?"* — which is I1.2's and Governance's question, not Identity's, and it is already answered by B-2 and the decision.

**Correcting the earlier reasoning in §12–§13 of this document:** the universality argument was internally inconsistent (the column would be NULL for exactly the rows it was justified by), and the `genesis_nominations.nomination_source` precedent it invoked in fact places such a column on the **ceremony artifact**, never on `auth_identities` — which is what B-2 already is.

---

## B4.13 Revised exact Gate B request

**This supersedes §32 and §37 of this document.** Four changes, not five.

| # | Change | Authoritative fact | Owner |
|---|---|---|---|
| **B-1** | new enum `identity_enrollment_status` = `pending / approved / rejected / completed` | where one enrollment stands in the two-key ceremony | I1.2 |
| **B-2** | new table `identity_enrollment_requests` (shape as specified in §32 B-2, **unchanged**) | "a bearer submitted an enrollment against invitation I; Governance approved/rejected it; it produced identity X" | I1.2 |
| **B-3** | `governance_domain` += `'identity-enrollment'` | which constitutional concern the approval belongs to | Governance |
| **B-5** | `invitations`: UNIQUE `(tenant_id, id)` | no new fact — the companion index that makes B-2's composite tenant FK possible | Invitation |

**~~B-4~~ `auth_identities.verification_source` — WITHDRAWN.** `auth_identities` is **not** modified by I1.2 in any way: no column, no index, no constraint, no enum value.

Everything else stated in §31–§34 stands unchanged. Nothing in B-1, B-2, B-3 or B-5 depends on B-4 — B-2's `enrolled_auth_identity_id` was always the structural link, and it does all the work.

---

## B4.14 Final verdict

# B-4 REJECTED — REDUNDANT DERIVED PROVENANCE

B-2 plus the Governance decision plus the existing `auth_identities` fields preserve every authoritative truth. B-4 would add only duplicate, derived, query-convenience metadata, and would additionally introduce a provider-ambiguity that does not exist today.

**Revised Gate B scope, exactly:**

- **B-1** `identity_enrollment_status`
- **B-2** `identity_enrollment_requests`
- **B-3** `governance_domain += 'identity-enrollment'`
- **B-5** `invitations` UNIQUE `(tenant_id, id)`

**No B-4.**

**STOPPING HERE.** No implementation. No schema, enum, column, table, index or constraint edited. No migration generated or applied. `hebun_r1` unmodified; no disposable database created; the leftover database untouched. No dependency added. No Identity, Credential, Session, Governance, Membership or Role authority modified. No commit, no tag, no push.
