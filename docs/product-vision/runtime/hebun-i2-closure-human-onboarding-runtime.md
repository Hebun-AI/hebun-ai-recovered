# HEBUN I2 CLOSURE REPORT — HUMAN ONBOARDING RUNTIME

**Phase:** I2 — implementation and closure
**Date:** 2026-08-12
**Scope consumed:** orchestration only. Zero schema change, zero migration, zero dependency.
**Predecessors:** I1 (membership authority), I1.1 (tenant role baseline), I1.2 (identity & credential enrollment) — all CLOSED and none redesigned.
**Verdict:** see §52.

---

## 1. Baseline proof

Re-proven before any modification.

| Fact | Measured |
|---|---|
| Branch | `main` |
| HEAD | `872b753483b4402e561b242b7a7c85c20da40664` |
| `origin/main` | identical |
| Ahead / behind | `0 0` |
| Staged | none |
| Working tree before | 41 entries |
| Migrations / journal before | 23 / 23 |
| Dependency diff before | empty |
| `git diff --check` | clean |
| I2 runtime already present? | **no** — zero matches for `human-onboarding`, `acceptInvitation`, `issueInvitation` |
| Known orphan databases | present and untouched |

No contradiction with the continuation state.

> **One reporting correction.** The pre-I2 `npm run verify` was launched and then ran *while* the first I2 files were being written, so it picked up the new audit module and reported 337/338. That run is contaminated and is not evidence of a pre-existing regression — the true pre-I2 baseline was measured green at **338/338, exit 0** at the close of I1.2 and is unchanged on disk. The final post-I2 run in §38 is the authoritative one.

---

## 2. I1 / I1.1 / I1.2 prerequisite validation

All three are present, unmodified in semantics, and exercised end to end by the I2 tests rather than assumed:

| Phase | Used by I2 as | Proven in `onboarding-postgres.ts` |
|---|---|---|
| **I1** | `authorizeMembership` produces the authorization I2 spends | every scenario begins with a real I1 call |
| **I1.1** | `provisionMemberRole` produces the tenant's ordinary `member` role | both tenants provision it; neither fixture assumes it |
| **I1.2** | `startIdentityEnrollment` → `decideIdentityEnrollment` → `completeIdentityEnrollment` brings the brand-new human into existence | PATH A runs the whole two-key ceremony before acceptance |

**Nothing was redesigned.** Role eligibility is still I1's `ELIGIBLE_ROLE_TYPE_LIST` — asserted equal to I2's single permitted band rather than restated. The member-role invariant, the two-key ceremony and the enrollment artifact are untouched.

---

## 3. Current schema sufficiency

Re-proven against the 23-migration schema by reading the **migration SQL**, not the names:

| Invariant | Actual semantics | Sufficient? |
|---|---|---|
| `membership_authorizations_consumed_chk` | `(consumed_at IS NULL) = (consumed_by_invitation_id IS NULL)` | ✅ |
| `membership_authorizations_consumed_status_chk` | `(status='consumed') = (consumed_at IS NOT NULL)` | ✅ |
| `membership_authorizations_consumed_invitation_uq` | partial UNIQUE on `consumed_by_invitation_id` WHERE NOT NULL — **one invitation is named by at most one authorization** | ✅ |
| `invitations_token_hash_uq` | global UNIQUE — a digest names at most one invitation | ✅ |
| `invitations_pending_email_uq` | partial UNIQUE `(tenant_id, normalized_email)` WHERE `status='pending'` | ✅ |
| `invitations_accepted_chk` | `status <> 'accepted' OR (accepted_at ∧ accepted_by_user_id)` | ✅ |
| `invitations_expiry_chk` | `expires_at > issued_at` | ✅ |
| `invitations_tenant_role_fk` | **composite** `(tenant_id, intended_role_id) → roles(tenant_id, id)` | ✅ |
| `memberships_tenant_user_uq` | UNIQUE `(tenant_id, user_id)` | ✅ |
| `memberships_accepted_invitation_uq` | UNIQUE `(accepted_invitation_id)` — **one membership per invitation** | ✅ |
| `invitations` revocation columns | `status='revoked'` + `revoked_at` + reason, CHECK-paired | ✅ |

**I2 required no enum, column, table, index, unique constraint, foreign key, CHECK or migration.**

---

## 4. Migration delta

**Zero.** 23 before, 23 after. `tests/i2-flow/boundaries-and-firewall.ts` §13 asserts the count and that no I2-named migration exists, and that no I2 module calls `pgTable(`.

---

## 5. I2 authority ownership

One owner per canonical fact. I2 owns exactly one.

| Fact | Owner | I2's role |
|---|---|---|
| membership intention | **I1** `membership_authorizations` | reads, and spends |
| intended tenant | **I1** authorization row | copies |
| intended role | **I1** authorization row | copies |
| **the invitation** | **I2** `invitations` | **writes — the only new canonical truth** |
| invitation token/digest | **I2**, reusing I1.2's digest primitive | mints once, stores the digest |
| invitation expiry | **I2** `invitations.expires_at` | writes, from a constant |
| invitation status | **I2** `invitations.status` | writes |
| human identity | **Identity authority** | reads through `findActiveLocalIdentityByEmail` |
| credential | **Credential authority** | verifies through `verifyPasswordCredential` |
| authenticated human | **Credential authority** | derives; never accepts a user identifier |
| **the membership** | **Membership authority** — I2 is its first product writer | writes |
| active tenant session | **Session authority** | **untouched** |

I2 is an orchestrator that owns the invitation and creates the membership. It duplicates no authoritative data: the address, the role and the tenant are read from the authorization at issuance and from the invitation at acceptance.

---

## 6. Invitation authority

`invitations` was schema-only: 0 rows, 0 writers, 0 readers. **I2 is its first legitimate product-runtime writer.**

The invitation is strictly downstream of a live `membership_authorization`. The client supplies **one** value — which authorization — and the server reads everything else from that row.

---

## 7. Invitation issuance contract

```
issueInvitation(tenant, { membershipAuthorizationId }, { digestKey })
  1  resolveGovernanceAuthority(tenant)          ← the ONE resolver, unchanged
  2  resolve the authorization by (id, tenant_id) joined to roles
  3  refuse unless status='authorized' and the role band is still `member`
  4  mint randomBytes(32); digest it
  5  ONE transaction:
       insert invitations   (tenant, email, role, digest, expiry — all copied or generated)
       UPDATE membership_authorizations … WHERE status='authorized'   ← 0 rows ⇒ abort
       audit
  6  return the capability ONCE
```

**Why issuance needs authority at all**, given I1 already decided: the decision authorized an onboarding; it did not authorize handing a bearer capability to whoever asks. Minting the token is the moment the tenant loses control of who may attempt to join. It is **not** a second Governance decision — `decision_records` is not written, and a test asserts I2 never imports the decision writer.

Proven refusals: an arbitrary id (`authorization-unresolvable`), another tenant's authorization (`authorization-unresolvable` — indistinguishable), an `owner`-band human without Governance authority (`not-the-governance-authority`).

---

## 8. Token / digest model

**No new token system.** `digestInvitationToken` — already written for I1.2 and already used by its enrollment flow — is reused verbatim:

```
capability = randomBytes(32).toString("base64url")              256 bits
token_hash = HMAC-SHA256(serverKey, "hebun.invitation-token.v1:" + capability)   64 hex
token_version = digestKey.version                               rotation-ready
```

Domain-separated from the session reference and the enrollment continuation, so no digest from one purpose can be replayed as another. Lookup is **by digest**, never by row id, plus a constant-time confirmation.

---

## 9. Plaintext capability confinement

| Requirement | Proof |
|---|---|
| never persisted | asserted against the exact `.values({…})` argument (non-greedy capture) — it stores `tokenHash`, and the word `capability` does not appear |
| never in audit | real-DB assertion over the audit row for the invitation |
| never in a Governance decision | I2 writes none |
| never in a log | no logging call exists in either module |
| never in a URL | surface test asserts the capability never becomes an `href` or a query string |
| returned exactly where needed | once, to the issuing authority, who delivers it out of band |

---

## 10. Membership authorization consumption

**Consumption happens at ISSUANCE, and the schema is what says so** — `consumed_by_invitation_id` is a foreign key to the *invitation*, not to a membership. I2 preserves that meaning rather than redefining it.

- `CONSUMPTION_SEMANTICS.consumedAt = "invitation issuance"`, stated as a frozen value and asserted.
- A lapsed or refused invitation does **not** un-spend its authorization. Re-inviting requires a new Governance decision.
- Acceptance **reads** provenance (`WHERE consumed_by_invitation_id = invitation.id`) and never writes the authorization. Asserted twice: no `.update(membershipAuthorizations)` in the acceptance module, and no assignment of either consumption column.

Real-DB proof: immediately after issuance the authorization reads `status='consumed'`, `consumed_at` set, `consumed_by_invitation_id` = the new invitation. A second issuance is refused `authorization-not-live`.

---

## 11. Invitation lifecycle

Only what onboarding correctness requires. Repository vocabulary, no invented states.

| State | Written by | Proven |
|---|---|---|
| `pending` | I2 issuance | ✅ |
| `accepted` | I2 acceptance, with `accepted_at` + `accepted_by_user_id` | ✅ |
| `revoked` | **no I2 writer** — invitation administration is not in scope | the *effect* is proven: a revoked row cannot be accepted |
| `expired` | **nothing writes it, in the whole repository** | expiry is evaluated as a predicate against the clock, never as a status read |

Proven: expired ✗, revoked ✗, already-accepted ✗, wrong token ✗, Tenant A token cannot produce a Tenant B membership.

---

## 12. Brand-new-human path (PATH A)

```
Governance authority
  → I1 authorizeMembership                    membership_authorizations (authorized)
  → I2 issueInvitation                        invitation + authorization consumed
  → out-of-band handover                      Hebun sends nothing
  → I1.2 start / approve / complete           users + auth_identities + auth_credentials
  → I2 acceptInvitation                       membership
  → UNCHANGED /login                          normal tenant session, correct tenant
```

I2 **consumes** I1.2's result and recreates none of it. Proven at each step: after I1.2 the human has an identity and a credential and **zero memberships**, and the invitation is still `pending` — the exact handoff state I1.2's closure predicted.

---

## 13. Existing-human path (PATH B)

```
existing verified human (already a member of tenant A)
  → I1 authorization in tenant B
  → I2 issuance in tenant B
  → I2 acceptance                             second membership, tenant B's own member role
```

Proven: **no second user, no second identity, no second credential, no enrollment ceremony.** The `users.id` on both memberships is the same human, and each membership carries its own tenant's `member` role — `memberRoleA ≠ memberRoleB`, asserted.

---

## 14. Identity binding

**The security boundary of this phase.** A valid capability plus an arbitrary authenticated human is refused.

Acceptance requires **both**:
1. possession of the capability — what the bearer holds;
2. proof of the credential belonging to the **invited** identity — who the bearer is.

The comparison is `lower(users.email) = invitations.normalized_email`, using the normalization Identity authority already defines. **No second normalization was implemented** — asserted.

**Why credential and not session.** A brand-new human who has just completed I1.2 has an identity, a credential and no membership, so `issueLocalSession` refuses them and no session can exist. Requiring a session would make PATH A unreachable and would force a change to Session authority, which is not I2's to make. `verifyPasswordCredential` is the primitive that answers "which human?" — D1's own words — and it answers it without minting anything. An already-authenticated human re-proves their password, which for *join another organization* is a defensible re-authentication and makes both paths one code path.

**Ordering matters and is asserted:** the binding is checked **after** the password, so a mismatch costs exactly what a wrong password costs. Unknown email, no credential, wrong password, locked credential and *right password, wrong human* all return the same `not-acceptable`, and every branch spends the same scrypt work. Otherwise a capability holder could learn which address it was issued for.

Proven: `root@acme.test` proving their real password against the newcomer's capability is refused, and gains no second membership.

---

## 15. Membership creation

```
tenant  ← invitation.tenant_id            role ← invitation.intended_role_id
user    ← the verified credential          accepted_invitation ← invitation.id
```

The client chooses none of them. `invitations_tenant_role_fk` already proved the tenant/role pair, so the pair written into `memberships` is a **database-verified pair**, not an application guess.

---

## 16. Role / tenant provenance

Proven on the durable row, not on the return value:

```sql
select m.tenant_id, m.user_id, m.role_id, m.status, m.accepted_invitation_id, r.type
  from memberships m join roles r on r.id = m.role_id
```

→ tenant A, the enrolled human, `memberRoleA`, `active`, the exact invitation, and `r.type = 'member'`.

**Attacks 12–15** (owner / director / operator / auditor) are closed by construction: the role is copied from an authorization that I1 already restricted to `member`, re-checked at issuance *and* again at acceptance, and the runtime never names another band — asserted with a regex over the executable surface.

---

## 17. Atomic acceptance transaction

```
validate capability (digest, constant-time)          ← outside the transaction
validate usability (status + expiry predicate)        ← outside
authenticate credential + bind identity               ← outside
check existing membership                             ← outside
read authorization provenance                         ← outside

ONE TRANSACTION:
  UPDATE invitations … WHERE status='pending' AND expires_at > now   ← 0 rows ⇒ abort
  INSERT memberships (tenant, user, role, accepted_invitation)
  audit
```

The conditional update is **first**, so the row lock is taken on the invitation — the thing two acceptances actually contend for.

**Required property, proven:** no invitation may read `accepted` without the membership it produced. The concurrency test asserts that directly with a `NOT EXISTS` query.

---

## 18. Concurrency proof

Real PostgreSQL, disposable database, `Promise.all` races.

| Race | Invariant | Result |
|---|---|---|
| two issuances from one authorization | conditional `UPDATE … WHERE status='authorized'` + `invitations_pending_email_uq` | **1 invitation**, 1 consumption, and the authorization names the survivor |
| the losing issuance | one transaction | **no orphan invitation, exactly 1 audit row** |
| two acceptances, same human | conditional `UPDATE invitations … WHERE status='pending'` + `memberships_accepted_invitation_uq` | **1 membership** |
| **two DIFFERENT humans race one invitation** | the identity binding | **only the bound human wins**; the racer gets `not-acceptable` and zero memberships |
| the losing acceptance | one transaction | **no accepted-but-memberless invitation, exactly 1 audit row** |
| legitimate retry after a refusal | the invitation stays `pending` after a wrong password | **retry succeeds** |

**No `SELECT none → INSERT` reasoning anywhere.**

---

## 19. Exactly-once semantics

```
membership_authorization A  →  invitation I  →  membership M
```

unambiguous in both directions and enforced by three database objects plus two conditional writes:

- one authorization names at most one invitation (single-valued column + `consumed_status_chk`)
- one invitation is named by at most one authorization (`membership_authorizations_consumed_invitation_uq`)
- one invitation produces at most one membership (`memberships_accepted_invitation_uq`)
- one human holds at most one membership per tenant (`memberships_tenant_user_uq`)

---

## 20. Tenant isolation

| Attack | Enforcement |
|---|---|
| Tenant A authorization → Tenant B invitation | the tenant is copied from the authorization; the read is `(id, tenant_id)`-scoped |
| Tenant A invitation → Tenant B membership | the tenant is copied from the invitation row |
| Tenant A role in a Tenant B membership | `invitations_tenant_role_fk` validated the pair before it was copied; proven with two tenants and two distinct member roles |
| foreign Governance authority issues | `authorization-unresolvable` — indistinguishable from nonexistent |
| identifier guessing | lookup is by 256-bit-derived globally-unique digest |

---

## 21. Session authority non-impact

**I2 contains no Session code.** Asserted structurally: it never references `userSessionContexts`, `insertSessionContext`, `issueLocalSession`, `setSessionCookie`, `SESSION_COOKIE_NAME` or any session module.

Proven behaviourally at the end of the main test: a human with an identity and an active credential and **no membership** still gets `forbidden("membership")` from `issueLocalSession`. The `authorized` invariant is exactly what it was.

---

## 22. `onboarding-required` analysis

Still declared with **zero producers**. I2 does **not** make it reachable, and that is a decision rather than an omission:

- I2 does not need it. Acceptance authenticates by credential and issues nothing, so the brand-new human never needs a pre-membership session.
- Producing it would change what `issueLocalSession` returns for the zero-membership case — a Session-authority change, and the phase brief says not to expand scope quietly.
- Its payload (`providerAuthentication` only) implies a surface that consumes it, which does not exist.

**Recommendation unchanged from the I1.2 closure: it belongs to whichever phase builds a pre-membership surface.** Reported, not built.

---

## 23. `tenant-selection-required` analysis

Also declared with zero producers, and **directly relevant** — it is the natural result for the multi-membership human. Making it real would change how `findPrimaryActiveMembership` feeds session issuance, i.e. tenant **selection** semantics. The phase brief says to stop and report in exactly that case.

**Reported as the next architectural frontier (§51). Not implemented.**

---

## 24. Multi-membership limitation

**Proven, not assumed**, by `describeTenantReachability` plus a real `issueLocalSession` call:

| Human | Memberships | Reachable? |
|---|---|---|
| brand-new (PATH A) | 1 | **yes** — signs in, lands in tenant A with `memberRoleA` |
| existing (PATH B) | 2 | **no** — sign-in resolves the OLDEST membership; tenant B is unreachable |

`findPrimaryActiveMembership` orders by `created_at ASC, id ASC LIMIT 1` and there is no tenant switcher. The second membership is **real, correct and durable** — and the human cannot enter that tenant.

`TENANT_ACCESS_REALITY` states this as frozen values, `ONBOARDING_NON_EFFECTS` includes *"does not let a human with several memberships choose which tenant to enter"*, and the firewall test asserts no tenant switcher was smuggled in.

---

## 25. Audit behavior

**No new sink.** A **fifth** declared owner under `governance-audit/`: `human-onboarding-audit.server.ts`, with its own `ONBOARDING_AUDIT_BOUNDARY`, its own entity type (`invitation`), its own two actions, and no reference to any other domain's boundary.

| Event | Recorded | Actor |
|---|---|---|
| invitation issued | yes | the issuing Governance authority |
| membership created | yes | **the human who joined** |
| failed acceptance | **no**, stated as a boundary value | *(unauthenticated — and recording attempts would turn the ledger into a probe log)* |
| Governance decision | **no** — I1 already made it | — |

The issuance row carries `delivered: false` in its metadata, so history can never be read as *"we emailed them"*. Never audited: the capability, any digest, the password, the salt, the credential hash, or the invited address. Asserted against real rows.

---

## 26. Client-input firewall

Exhaustively what a client may send:

```
issueInvitation   { membershipAuthorizationId }
acceptInvitation  { capability, email, password }
```

Asserted absent from every input shape: `tenantId`, `roleId`, `membershipId`, `userId`, `authIdentityId`, `actorId`, `actorType`, `status`, `acceptedAt`, `consumedAt`, `expiresAt`. The invitation lifetime is a constant, not a parameter.

`email` is a **lookup key whose password must then be proven** — it is not a trusted user identifier. A caller cannot select a user without holding that user's credential, and every failure is one indistinguishable refusal.

---

## 27. Attack matrix

All 45 required cases. Real PostgreSQL unless marked *structural*.

| # | Attack | Result |
|---|---|---|
| 1 | arbitrary authorization id issues | ✗ `authorization-unresolvable`, 0 invitations |
| 2 | another tenant's authorization | ✗ `authorization-unresolvable` |
| 3 | actor without Governance authority (owner band) | ✗ `not-the-governance-authority`, 0 invitations |
| 4 | already-consumed authorization issues again | ✗ `authorization-not-live`, still 1 invitation |
| 5 | concurrent issuance | ✓ exactly 1 invitation (§18) |
| 6 | plaintext token persists | ✗ only a 64-hex digest is stored |
| 7 | plaintext token in audit | ✗ (and the address is not duplicated either) |
| 8 | wrong token | ✗ `capability-unrecognized` |
| 9 | expired invitation | ✗ `capability-not-usable` |
| 10 | revoked invitation | ✗ `capability-not-usable` |
| 11 | accepted invitation reused | ✗ still exactly one membership |
| 12–15 | owner / director / operator / auditor membership | ✗ the durable row's `roles.type` is `member` |
| 16–19 | forged roleId / tenantId / userId / authIdentityId | ✗ *structural* — no such input field exists; the durable row's values came from the authorization and the credential |
| 20 | unauthenticated bearer completes acceptance | ✗ `not-acceptable` |
| 21 | token alone creates a membership | ✗ — proven *before* the human existed |
| 22 | authenticated wrong human steals the invitation | ✗ `not-acceptable`, no second membership |
| 23 | Tenant A invitation → Tenant B membership | ✗ tenant copied from the invitation |
| 24 | Tenant A role substituted | ✗ two tenants, two distinct member roles, each membership correct |
| 25 | I1.2 **rejected** enrollment reaches acceptance | ✗ no identity was ever created, so `not-acceptable` |
| 26 | I1.2 **pending** enrollment reaches acceptance | ✗ same |
| 27 | completed I1.2 identity reaches legitimate acceptance | ✓ |
| 28 | existing legitimate human path | ✓ second membership, no second identity |
| 29 | acceptance race | ✓ one membership |
| 30 | losing acceptance leaves orphan audit | ✗ exactly 1 audit row |
| 31 | losing acceptance leaves partial accepted state | ✗ `NOT EXISTS` proof |
| 32 | authorization provenance drifts | ✗ exact, asserted on the durable rows |
| 33 | invitation provenance drifts | ✗ exact |
| 34 | membership role is not the intended one | ✗ exact |
| 35 | user created during acceptance | ✗ count unchanged |
| 36 | auth identity created during acceptance | ✗ |
| 37 | credential created during acceptance | ✗ |
| 38 | Governance grant created | ✗ `decision_records` count unchanged; the new member appears as actor on none |
| 39 | role created or mutated | ✗ |
| 40 | Knowledge mutation | ✗ |
| 41 | provider / execution mutation | ✗ |
| 42 | Computer Use | ✗ *structural* |
| 43 | mail send | ✗ *structural* — no provider name appears anywhere |
| 44 | dev credential path | ✗ *structural* — `scripts/` is never referenced |
| 45 | normal authorized session invariant changed | ✗ a memberless human still gets `forbidden("membership")` |

**Additional attacks proven** beyond the list: a wrong password for the *right* human is indistinguishable from a wrong human; a refused attempt does not consume the invitation; a legitimate retry afterwards still succeeds.

---

## 28. Structural firewall

`tests/i2-flow/boundaries-and-firewall.ts`, 19 sections. Highlights beyond §27:

- **one Governance resolver** — no `activeDelegationsSql`, no `bootstrap = true`, no `decisionRecords`; and acceptance never resolves Governance at all, because joining is not a Governance act.
- **exactly three tables written** — asserted by extracting every `.insert(X)` / `.update(X)` from both modules: `invitations`, `memberships`, `membershipAuthorizations`. Nothing else.
- **no Identity / Credential / Session writes** — 14 forbidden tokens plus an import-level assertion.
- **no mail, SSO, MFA, passkey, recovery, Computer Use, terminal, Knowledge, provider, execution, permissions** — 25 module/API names over the executable surface.
- **contracts.ts is pure** — no drizzle, no `@/db/`, no `node:crypto`, no `process.env`, no `async function`. That is why the client surface may import it.
- **no new token system** — acceptance contains no `createHmac`, no JWT.
- **conditional writes, not read-then-insert** — both acts assert their predicate and their abort.

> The capability scan runs against the **executable** modules, not `contracts.ts`, whose `ONBOARDING_NON_EFFECTS` list names Computer Use and terminal precisely to state that they do not happen. The reasoning is on disk beside the constant.

---

## 29. Real PostgreSQL proof

Three test files, each on a disposable database created **and destroyed through the ownership handle**:

| File | Lines | Proves |
|---|---|---|
| `tests/i2-flow/onboarding-postgres.ts` | 680 | both paths end to end · attack matrix · tenant-access reality |
| `tests/i2-flow/onboarding-concurrency-postgres.ts` | 345 | six races + two rollback proofs |
| `tests/i2-flow/boundaries-and-firewall.ts` | 528 | structural claims · zero migration · surface wording |

**No mock stands in for any of it.** The final sign-in is performed by the real `issueLocalSession` against the real database.

---

## 30. Brand-new-human end-to-end proof

```
membership_authorizations   1  (authorized → consumed)
invitations                 1  (pending → accepted)
identity_enrollment_requests 1 (pending → approved → completed)
users                      +1
auth_identities            +1  (active, verified, is_primary)
auth_credentials           +1  (verifies through the production login path)
memberships                +1  (tenant A, memberRoleA, active, accepted_invitation set)
user_session_contexts       0 created by I2
```

Then: `issueLocalSession(newcomer)` → `diagnostic: "ok"`, `status: "authorized"`, `tenantContext.tenantId = A`, `roleId = memberRoleA`. **Tenant access is real for this human.**

---

## 31. Existing-human end-to-end proof

```
users                       +0    ← the SAME human
auth_identities             +0
auth_credentials            +0
identity_enrollment_requests +0   ← no ceremony was needed
memberships                 +1    (tenant B, memberRoleB)
```

Then: `findPrimaryActiveMembership` → **tenant A**, and `issueLocalSession` → `tenantContext.tenantId = A`. The tenant-B membership exists and is unreachable. §24.

---

## 32. Durable row-count / non-effect proof

Counted immediately before acceptance and compared after, so the assertions measure what **acceptance** did rather than what accumulated fixtures did:

```
users +0 · auth_identities +0 · auth_credentials +0 · roles +0
user_session_contexts +0 · decision_records +0
knowledge_nodes +0 · executions +0 · provider_connectivity_controls +0
memberships +1
```

---

## 33. UI implementation

**One control, on the surface that already owns the ceremony.** No second onboarding product was invented.

`MembershipAuthorizationCard` — the existing I1 card on `/governance/authority` — gained an `InvitationIssuance` block that appears **only** on an authorization that is still live. It calls `issueInvitationAction`, which resolves the tenant and the digest key server-side.

Wording rules, asserted by test:

| Rendered | Never rendered |
|---|---|
| "Issue onboarding capability" | "Invite", "Send invite", "Email" |
| "Capability (shown once)" | "Email sent", "Invitation sent", "Check your inbox" |
| "Hebun sends nothing." | "Sending…" |
| "Not delivered by Hebun — no mail runtime and sends nothing" | any delivery claim |
| the operator's obligation to hand it over themselves | "now a member of", "switch to" |

The capability lands in a **labelled readonly input**, not a bare code block, so it is reachable and copyable by keyboard. `aria-describedby` ties the one-shot warning to it. Refusals are `role="alert"`; the successful transition is `role="status"`; state is carried by words, and no raw colour utility conveys meaning. Every one of the nine issuance refusals has operator wording, asserted.

**No acceptance surface was built.** A prospective human's acceptance route would be an unauthenticated public page, and `middleware.ts` currently treats `/login` as the only public prefix — adding another is a route-protection decision, not an I2 orchestration detail. Reported as a frontier (§51) rather than taken.

---

## 34. Browser verification

**Not performed, and not claimed.** Reaching the new control requires a durable tenant that holds Governance authority, a provisioned member role and a live authorization. `hebun_r1` is at 20 applied migrations and is read-only for this phase by explicit instruction, so no such state exists in any environment the browser could reach. Creating one would mean migrating and seeding the durable database, which is outside this phase.

The surface is proven structurally instead — wording, accessibility attributes and refusal coverage are asserted against the source — and that is stated as a limitation rather than dressed up as visual proof.

---

## 35. Explicit non-capabilities

`ONBOARDING_NON_EFFECTS`, asserted by test:

does not create a user · does not create an auth identity · does not create a credential · does not create or change any role · does not issue any session · does not change what a normal tenant session requires · does not grant Governance authority · does not grant Knowledge ratification or authoring authority · does not grant provider access or change the model kill-switch · does not grant execution, Computer Use, or terminal authority · **does not send the invitation anywhere** · **does not verify that the invited human controls the invited email address** · **does not let a human with several memberships choose which tenant to enter**

Also absent: invitation revocation, invitation resend, invitation listing as a product surface, membership editing or revocation, tenant switching, a public acceptance route.

---

## 36. Regression changes

Three fixtures, each modelling a fact that genuinely changed. **No constitutional test was weakened.**

| File | Change | Why |
|---|---|---|
| `tests/g1-flow/audit-authority-boundaries.ts` | `AUDIT_SINK_OWNERS` +1 | a fifth declared sibling owner exists; the test's own comment describes this as the intended way to add one |
| `tests/g2-flow/boundaries-and-firewall.ts` | owners +1 | same |
| `tests/k2-flow/governance-hardening.ts` | owners +1 | same, from Knowledge's side |

One structural refactor was forced and is an improvement: the first draft of `accept-invitation.server.ts` wrote `auditLog` directly and tripped all three lists at once. The writer moved into the declared-owner directory instead.

One firewall assertion of my own was **corrected rather than removed**: it forbade any client component from naming `human-onboarding`, which would have banned importing pure types. It now forbids the `.server` modules specifically, and separately asserts that `contracts.ts` contains no I/O — the rule that actually protects the bundle.

---

## 37. Focused test result

```
PASS tests/i2-flow/onboarding-postgres.ts
PASS tests/i2-flow/onboarding-concurrency-postgres.ts
PASS tests/i2-flow/boundaries-and-firewall.ts
```

Re-run green individually and inside the full suite: `d1-flow/*`, `d1-1-flow/*`, `g1-flow/*`, `g2-flow/*`, `g3-flow/*`, `k2-flow/*`, `i1-flow/*`, `i1-1-flow/*`, `i1-2-flow/*`, `authentication-schema/migration`.

---

## 38. Full test count / result

```
Test summary: 341 passed, 0 failed, 341 total.
```

338 before → **341**, +3 exactly matching the three new I2 files.

---

## 39. Typecheck

`npx tsc --noEmit` → **PASS**, exit 0.

## 40. Lint

`npx eslint` → **PASS**, exit 0, zero warnings.

## 41. Build

`next build` → **PASS**.
*(The `middleware`-to-`proxy` deprecation notice is a pre-existing Next 16 warning, unchanged by this phase.)*

## 42. `git diff --check`

Clean.

---

## 43. Migration count

| | Before | After |
|---|---|---|
| `.sql` files on disk | 23 | **23 — unchanged** |
| `_journal.json` entries | 23 | **23 — unchanged** |
| Applied to `hebun_r1` | 20 | **20 — unchanged** |

**I2's migration delta is zero, as expected.**

---

## 44. Dependency delta

**None.** `git diff HEAD -- package.json package-lock.json` is empty.

---

## 45. Changed-file accounting

**45 working-tree entries.**

| Group | Count |
|---|---|
| I1 + I1.1 + I1.2 (untouched by this phase) | 32 |
| Documentation (`learnings.md` + 5 reports, including this one) | 6 |
| **I2 new source** | **4** — 3 feature modules + 1 audit writer |
| **I2 new tests** | **1 directory** (`tests/i2-flow/`, 3 files) |
| **I2 modified source** | **2** — the governance action file, the authorization card |
| **I2 modified tests** | **3** — the three audit-owner lists |

---

## 46. Git state

| Fact | Value |
|---|---|
| Branch | `main` |
| HEAD | `872b753483b4402e561b242b7a7c85c20da40664` — **unchanged** |
| `origin/main` | identical · ahead/behind `0 0` |
| Staged | none |
| Commits / tags / pushes | **none** |

---

## 47. `hebun_r1` state

Read-only throughout. **Not migrated, not mutated, not seeded, no onboarding ceremony run against it.**

```
applied migrations = 20   (unchanged)
invitations = 0 · memberships = 2 · users = 2   (unchanged)
```

---

## 48. Known orphan database handling

The three known orphans were **not used, not connected to, not mutated, not dropped, not reused, not renamed**:

```
hebun_test_hebun_i1_membership_1c8a8356214345b5
hebun_test_i12_probe_d073c537
hebun_test_i12_manual_be58770e
```

Every I2 disposable database was created **and destroyed** through `createDisposablePostgresHarness`. No ad-hoc `psql` database was created during this phase.

---

## 49. Proven vs unproven

**Proven, on real PostgreSQL:** the complete chain for both human paths · authorization spent exactly once at issuance · invitation accepted exactly once · exact tenant/role/human/authorization/invitation provenance · the identity binding, including a real human with a real password being refused · six concurrency races with two rollback proofs · tenant isolation across two tenants · the digest-only capability · that the newly onboarded human can actually sign in and land in the right tenant · that the multi-membership human cannot · that the normal session invariant is unchanged.

**Not proven, because it does not exist:** that any capability reached its intended human (no delivery) · that the invited address is controlled by whoever presented the capability · tenant access for a human with more than one membership.

**Not exercised in a browser** — §34.

---

## 50. Remaining limitations

1. **Multi-membership humans cannot enter the new tenant.** Proven and bounded in §24. The membership is real; the access is not.
2. **No delivery.** The capability is handed to the issuing authority. A capability stolen before handover lets the thief attempt to join — but the identity binding means they must also hold the invited human's password, so the worst case is a refused attempt, not a stolen membership.
3. **No acceptance surface.** The runtime is complete; a public route is a middleware decision.
4. **No invitation administration.** No revocation writer, no resend, no listing. Revocation's *effect* is proven; its *writer* is out of scope.
5. **Acceptance re-authenticates.** An already-signed-in human types their password again. Deliberate — it makes one code path serve both human paths and needs no session.
6. **`expired` is never written.** Expiry is a predicate everywhere; no sweeper exists, and none was invented.
7. **`onboarding-required` and `tenant-selection-required` remain unproduced.** §22, §23.

---

## 51. Next architectural frontier

**Tenant selection.** It is now the single thing standing between a correct membership and a usable one, and the contract already names it: `tenant-selection-required` sits in the `AuthenticationResult` union with zero producers, and `AuthenticationServiceRequest.requestedTenantId` exists on a contract-only interface. Making it real means deciding how `findPrimaryActiveMembership` feeds session issuance — a Session-authority decision, and the reason this phase stopped at the boundary instead of crossing it.

Secondary frontiers: a public acceptance route (middleware public-prefix decision), an invitation-administration surface, and a delivery channel.

---

## 52. Final verdict

# I2 CLOSED WITH DOCUMENTED TENANT-SELECTION LIMITATION

The complete authorized onboarding transition is implemented and proven on real PostgreSQL, with **zero schema change, zero migration and zero new dependency**, without violating a single established authority.

- **Governance-authorized intention → durable membership**, with exact tenant, human, member role, authorization provenance and invitation provenance — all proven on the durable rows, none client-controlled.
- **The authorization is spent exactly once**, at issuance, preserving the meaning the schema already carried.
- **The invitation is accepted exactly once**, and only by the human it names — a real human proving a real password is still refused if they are not that human.
- **I2 stayed an orchestrator.** It writes three tables, owns one canonical truth, calls Identity and Credential authority without touching their schemas, and contains no Session code at all.
- **Both human paths work.** A brand-new human onboards through I1.2 and reaches real tenant access. An existing human gains a correct second membership.

**The bounded limitation:** a human with more than one membership cannot yet enter the newly joined tenant. `findPrimaryActiveMembership` resolves the oldest membership and no tenant switcher exists. This is proven, stated as frozen values on the contract, surfaced in the non-effects list, and asserted by test — it is not claimed to be solved.

`npm run verify`: lint ✅ · typecheck ✅ · **341/341 tests** ✅ · build ✅ · `git diff --check` clean.
23 migrations on disk, 20 still applied to `hebun_r1`, which was read-only throughout. Three known orphan databases untouched. No dependency added. **No commit, no tag, no push. The next phase has not begun.**
