# HEBUN TENANT SELECTION AUTHORITY — CLOSURE REPORT

**Phase:** Tenant Selection Authority — Gate A resolved, then implemented in the same task
**Date:** 2026-08-12
**Scope consumed:** orchestration between Session and Membership authority. **Zero schema change, zero migration, zero dependency, no new authority.**
**Predecessors:** I1, I1.1, I1.2, I2 — all CLOSED, none redesigned.
**Verdict:** see §44.

---

## 1. Baseline

Re-proven before any modification.

| Fact | Measured |
|---|---|
| Branch / HEAD / `origin/main` | `main` · `872b753483b4402e561b242b7a7c85c20da40664` · identical |
| Ahead / behind | `0 0` |
| Staged | none |
| Working tree before | 45 entries |
| Migrations / journal before | 23 / 23 |
| Dependency diff before | empty |
| `git diff --check` | clean |
| Tests before | **341 / 341** |
| I2 code intact | yes — `human-onboarding/` and `tests/i2-flow/` unchanged at start |
| Tenant selection already present? | **no** — the only match for `tenant-selection-required` was the type declaration |
| Known orphan databases | present and untouched |

> **One reporting note, repeated from the I2 closure because I repeated the mistake.** The pre-phase `verify` was launched and then ran *while* the first edits were being written, so its **build** stage failed on a half-saved file. Its **test** stage completed cleanly at **341/341**, which is the number that matters, and the authoritative post-phase run is §32. Launching a baseline verify concurrently with editing produces a contaminated log; it should be run to completion first or not at all.

---

## 2. I2 limitation revalidation

I2 closed with this, proven:

```
findPrimaryActiveMembership  →  ORDER BY created_at ASC, id ASC  →  LIMIT 1
```

Re-read on disk and still exactly true. A human with two active memberships signed in and always landed in the older tenant; the second membership was durable, correct and unreachable.

**This phase resolves it at sign-in.** The proof is inverted in `tests/i2-flow/onboarding-postgres.ts`: the block that asserted "the human cannot enter tenant B" now asserts that sign-in returns `tenant-selection-required` offering **both** tenants, and that choosing tenant B yields a `TenantContext` for tenant B with tenant B's own member role.

`findPrimaryActiveMembership` itself is **unchanged** — it still returns the oldest, and that is still what an unqualified sign-in resolves. What changed is that sign-in no longer asks it when there is more than one answer.

---

## 3. Current Session authority

Audited, then extended without weakening.

| Question | Answer from disk |
|---|---|
| What fact does Session authority own? | `user_session_contexts` — the durable receipt of one proven authentication |
| What determines the active tenant? | `active_tenant_id` |
| What determines the active membership? | `active_membership_id` + `membership_version` |
| When validated? | at issuance (`issueLocalSession`) |
| When revalidated? | **on every request** (`resolveSessionFromReference`) — identity, user, membership, version equality, tenant lifecycle |
| Can tenant/membership change after issuance? | **No.** The only writers on the table are an activity touch (`lastActivityAt`, `inactivityExpiresAt`) and a revocation (`revokedAt`, `revocationReason`) |
| Does such a writer exist? | **No, and none was added.** A test extracts every `.update(userSessionContexts).set({…})` and asserts the set is exactly those two |
| Mutate or issue new? | **Issue new.** A session is an immutable authentication receipt; rewriting which tenant a receipt was for would destroy provenance and invite confused-deputy behaviour |

---

## 4. Membership reader authority

`findPrimaryActiveMembership` was the only membership reader in the auth path, and it is `LIMIT 1` by construction. Three readers were added **inside the module that already owns every membership read** — no new Membership authority, no writer:

| Reader | Answers |
|---|---|
| `findActiveMemberships(db, userId)` | which memberships exist at all — the **sibling** of the primary reader |
| `findTenantCandidates(db, userId)` | the picker's display rows |
| `findMembershipForUser(db, userId, membershipId)` | **the revalidation seam** — one membership, by id AND by human |

`findActiveMemberships` shares the primary reader's **exact predicate and exact ordering**, asserted term by term, so the first row of the list *is* what an unqualified sign-in resolves — a property, not a coincidence.

---

## 5. Zero / one / many semantics

```
credential verified
  → findActiveMemberships(user)

  0   → pre-tenant receipt + `onboarding-required`
  1   → findPrimaryActiveMembership → tenant-bound session + `authorized`   ← UNCHANGED
  2+  → pre-tenant receipt + `tenant-selection-required`
```

The one-membership path deliberately still calls `findPrimaryActiveMembership`, so the behaviour every existing test asserts is produced by the same function it always was. Proven: a sole-membership human signs straight in, gets an 8-hour session, and lands in the right tenant with the right role.

---

## 6. `onboarding-required` producer

`issueLocalSession`, when a verified credential resolves to **zero** active memberships. Previously this returned `forbidden("membership")`.

It carries `providerAuthentication`, which requires a real session-reference digest — so producing it honestly meant issuing the pre-tenant receipt rather than fabricating a hash. The receipt authorizes nothing (§10) and expires in ten minutes.

**This is a narrow completion of D1's own contract**, not a new state: the union member has existed since the authentication foundation with no producer.

---

## 7. `tenant-selection-required` producer

Two producers, both in Session authority:

1. **`issueLocalSession`** — at sign-in, when the human holds 2+ memberships.
2. **`resolveSessionFromReference`** — for any pre-tenant receipt presented on a later request, with candidates **re-derived from live rows** so a membership revoked while the picker sits open disappears from it immediately.

Its declared payload was audited before use: `{ canonicalIdentity, eligibleTenantIds }`. It **returns** tenant ids; it never **accepts** one. That is safe, and it was not redesigned. It is thin for a UI, so display rows come from a separate server read rather than by widening the contract.

`issueLocalSession` was extended, not replaced. It already did credential verification → membership resolution → session issuance; adding the branch is one more question at the point membership was already being resolved. **No second orchestrator, and credential verification is not duplicated anywhere.**

---

## 8. Candidate read model

```ts
interface TenantCandidate {
  membershipId; tenantId; tenantName; roleName;
}
```

Four fields, asserted exhaustively by test. **No `roleId`, no `membershipVersion`, no `authorityScope`, no governance provenance** — a picker needs to tell workspaces apart, not to carry authority.

Derived entirely server-side from the authenticated human's own active memberships, and filtered to tenants whose authentication is actually enabled: **offering a workspace that would refuse the session at issuance would be a picker that lies.** Proven — disabling a tenant removes it from the list *and* refuses it at selection.

---

## 9. Selection input

**`membershipId`, and nothing else.**

Chosen over `tenantId` because it directly identifies *the entitlement being selected*, so revalidation is a single lookup keyed by the thing that must be true. A tenant id would have required resolving "which membership of theirs is in that tenant?" first — one more inference between the human's intent and the check.

Asserted absent from every input shape: `tenantId`, `userId`, `actorId`, `actorType`, `roleId`, `membershipVersion`, `status`, `authIdentityId`, `sessionContextId`.

---

## 10. Authenticated selection context

**Model 1 — a short-lived pre-tenant receipt**, and it needed no schema change.

`user_session_contexts_tenant_membership_chk` is `(active_tenant_id IS NULL) = (active_membership_id IS NULL)`, so both-NULL has always been a legal row; the composite FK is MATCH SIMPLE and is not enforced when a column is NULL. **Nothing had ever written one.** A test asserts the CHECK keeps that shape legal, so a future tightening fails there rather than in production.

What the receipt proves and grants:

| | |
|---|---|
| proves | this human's credential was verified in this browser, recently |
| grants | **nothing** — no tenant, no membership, no role, no authority |
| reaches | only the workspace picker |
| lives for | **10 minutes** (vs 8 hours for a working session) |
| dies when | a workspace is chosen, or it expires |

It is inert by construction, not by discipline: `assembleAuthorized` is unreachable from it, so no `TenantContext` exists, `resolveTenantContext()` returns null, the dashboard gate refuses anything that is not `authorized`, and every governed action refuses a null tenant.

**The alternatives were considered and rejected:** re-submitting the password (works, but asks a human to prove themselves twice inside one sign-in, and stores a secret in browser memory across a step); a new continuation artifact (a persistent table — Gate B, for a state the session table already models).

---

## 11. Server-side membership revalidation

**Selection is not authorization. Revalidation is.**

```
1  the human is re-resolved from the durable pre-tenant row      never from input
2  the membership is re-read BY ID *AND* by that human's user_id  foreign → nothing
3  status / lifecycle / revocation / role re-checked from that row
4  the tenant's lifecycle and authentication posture re-checked
5  membership_version taken from the row read NOW
```

Nothing from the candidate list is trusted on the way back. A membership belonging to another human resolves to `undefined` — indistinguishable from one that never existed, so a guessed uuid learns nothing. Proven with a *real, live* membership belonging to a different human: refused identically to a fabricated uuid.

---

## 12. Session issuance semantics

A **fresh** `user_session_contexts` row, bound to exactly what was just revalidated, with a **fresh** opaque reference and a full 8-hour lifetime. `authenticated_at` is carried over from the receipt — the credential was proven then, and claiming otherwise would falsify the record.

---

## 13. Session rotation / freshness

The pre-tenant receipt is **revoked** (`revocation_reason = 'tenant-selected'`), never rewritten — proven on the durable rows: two rows survive, the first still saying it had no tenant.

Revocation happens **after** the new row exists, so a failure at insert time leaves the human holding a still-usable picker rather than nothing at all.

Proven: the old reference resolves `unauthenticated` immediately; the new one resolves `authorized` for the chosen tenant.

---

## 14. TOCTOU analysis

| Between the list and the click | Result |
|---|---|
| membership revoked | **refused** `membership-unavailable` — proven by revoking *after* reading the list |
| membership version changed | **selection succeeds with the CURRENT version** — proven: version bumped to 2, session carries 2, and the resolver's equality check passes immediately |
| tenant disabled | **refused**, and it also vanishes from a freshly-read list |
| membership belongs to another user | **refused** |
| membership id guessed | **refused**, identically |
| receipt expired | **refused** `no-selection-context` |
| receipt already tenant-bound | **refused** — an authorized session is not a selection context |
| receipt already spent | **refused** — replay cannot mint a second tenant context |

---

## 15. Concurrency

Two simultaneous selections against one receipt, choosing *different* tenants:

- at least one succeeds;
- **exactly one new row exists per successful selection** — none reused, none re-pointed;
- every resulting live session points at a tenant the human really belongs to.

The property that matters is that authority is **never mutated in place**: each success writes its own receipt, so no session can ever claim a tenant it was not issued for.

---

## 16. Replay resistance

The receipt is revoked at the moment of selection, so a copied cookie is already dead. Proven: after a successful selection, replaying the same reference with a *different* membership id is refused `no-selection-context`.

The reference itself is 256 bits of `randomBytes`, stored only as an HMAC digest — the existing session-digest primitive, unchanged. No new token system, no new secret, and no capability in a URL or a query string.

---

## 17. Initial login selection

Implemented and proven end to end. `/login` → credential verified → 2+ memberships → pre-tenant cookie → `/login/select-workspace` → choose → fresh session → `/foundation`.

---

## 18. Post-login switching decision

**Deferred, deliberately, and stated as a value** (`POST_LOGIN_SWITCHING.implemented = false`).

It is a *different entry point*: the human is already authorized somewhere, so the act starts from a tenant-bound receipt rather than a pre-tenant one. The same revalidation and the same fresh issuance would serve it and **no new authority decision is required** — but exposing it is a product decision this phase did not take, and `selectTenantForSession` explicitly refuses a tenant-bound receipt so it cannot be reached by accident.

Reachable today: sign out and sign in again — a human with several memberships is asked every time.

---

## 19. Route / middleware boundary

**`middleware.ts` is unchanged**, and a test asserts `PUBLIC_PREFIXES = ["/login"]` stays exactly that.

The picker lives at `/login/select-workspace`. The prefix rule is `pathname === prefix || pathname.startsWith(prefix + "/")`, so it is already past the edge gate exactly as the sign-in form is — **and the dashboard is as protected as it was.**

Being past the edge gate grants nothing there: the page reads its candidates from the durable receipt in the cookie, takes **no `searchParams` and no route params**, and redirects an already-authorized visitor to `/foundation`. A visitor without a receipt sees an empty list and a link back to sign-in.

---

## 20. UI

One page and one card, both narrow.

- **"Choose workspace"** — a real `<fieldset>` with an `sr-only` `<legend>`, real radio inputs with real `<label>`s, one per server-derived candidate showing the tenant name and the human's role in it.
- **Zero-membership state** — an honest "No workspace yet" panel explaining that someone with Governance authority has to admit them, `role="status"`. Not a fake error.
- Refusals in `role="alert"`; the pending transition in `role="status"`; state carried by words, never by colour.
- Non-effects rendered from frozen values, so the wording cannot drift from the code.

Asserted absent from the rendered copy: *create workspace*, *new organization*, *invite*, *manage*, *leave*, *settings*, *switch*, *add member*. No other surface in `src/app` offers workspace switching — asserted by walking every page.

---

## 21. Tenant isolation

The chosen tenant comes from the revalidated membership row, never from input. A membership in another tenant is only selectable if the human actually holds it, and the tenant's own posture is re-checked at issuance. Proven with two tenants: the multi-membership human's two memberships carry two different member roles, and selecting each yields the correct tenant/role pair.

---

## 22. Attack matrix

All 35 required cases. Real PostgreSQL unless marked *structural*.

| # | Attack | Result |
|---|---|---|
| 1 | zero memberships → `onboarding-required` | ✅ |
| 2 | one membership → `authorized` | ✅ unchanged, 8-hour session, correct tenant/role |
| 3 | two memberships → `tenant-selection-required` | ✅ both tenants offered |
| 4 | arbitrary tenantId authorizes | ✗ *structural* — no input field accepts one |
| 5 | guessed membershipId authorizes | ✗ `membership-unavailable` |
| 6 | another user's membership authorizes | ✗ same reason, using a **real live** membership |
| 7 | revoked membership authorizes | ✗ |
| 8 | inactive tenant authorizes | ✗ and it is not offered |
| 9 | stale membership version authorizes | ✗ — the session carries the version read at issuance (proven: 2, not 1) |
| 10 | cross-tenant role mismatch | ✗ — the role comes from the revalidated membership |
| 11–15 | forged roleId / userId / actor / role / version | ✗ *structural* — none exists as an input |
| 16 | candidate list contains a foreign membership | ✗ — exactly this human's two, and only four thin fields |
| 17 | membership revoked after list, before click | ✗ `membership-unavailable` |
| 18 | concurrent selections corrupt session state | ✗ one new row per success, none re-pointed |
| 19 | replay creates unauthorized context | ✗ `no-selection-context` |
| 20 | successful selection → correct `TenantContext` | ✅ tenant B, role B, user |
| 21 | correct membership version | ✅ |
| 22–27 | selection creates membership / role / credential / identity / Governance / Knowledge | ✗ counts unchanged, `decision_records` = 0 |
| 28 | provider / execution mutation | ✗ |
| 29 | Computer Use | ✗ *structural* |
| 30 | arbitrary client tenant trust | ✗ |
| 31 | single-membership login regression | ✗ — identical behaviour, same function |
| 32 | I2 PATH A regression | ✗ — the brand-new human still signs straight in |
| 33 | I2 PATH B reaches the selected tenant | ✅ **the I2 limitation is resolved at sign-in** |
| 34 | resolver revalidates on the next request | ✅ |
| 35 | revoked selected membership invalidates access | ✅ `forbidden("membership")` on the very next resolve |

**Additional cases proven:** an already-authorized session is refused as a selection context and offers no picker; an expired receipt is refused and resolves `unauthenticated`; `findMembershipForUser` and `findTenantCandidates` refuse a foreign human directly.

---

## 23. Firewall proof

`tests/tenant-selection-flow/boundaries-and-firewall.ts`, 12 sections. Beyond §22:

- **no writer** for memberships, roles, credentials, identities, users, invitations, decisions — 12 forbidden tokens across the whole surface.
- **no Governance resolver duplication** — `resolveGovernanceAuthority` and `writeGovernanceDecisionWithin` appear nowhere; selection is not a Governance act.
- **no permissions runtime, no Knowledge, no provider, no execution.**
- **no mail, OIDC, SAML, passkey, TOTP, password recovery, Computer Use, terminal, child process.**
- **`authorized` is unchanged** — five resolver invariants asserted verbatim, plus that the pre-tenant branch can never reach `assembleAuthorized`.
- **only two session writers** — the update-set extraction described in §3.
- **contracts.ts is pure** — no drizzle, no `@/db/`, no `node:crypto`, no `process.env`, no `async function`. That is why the client card may import it.
- **no server module in a client bundle** — every `"use client"` file checked against the three auth-runtime server modules.

---

## 24. Real PostgreSQL proof

Two test files on a disposable database created **and destroyed through the ownership handle**:

| File | Lines | Proves |
|---|---|---|
| `tests/tenant-selection-flow/selection-postgres.ts` | 552 | zero/one/many · selection · rotation · TOCTOU · concurrency · replay |
| `tests/tenant-selection-flow/boundaries-and-firewall.ts` | 383 | structural claims · zero migration · surface wording |

Plus the updated `tests/i2-flow/onboarding-postgres.ts`, which now proves the I2 limitation is gone.

---

## 25. Session revocation / revalidation proof

After a successful selection, revoking the **selected** membership makes the very next `resolveSessionFromReference` return `forbidden("membership")`. The session is not retroactively valid; revalidation happens on every request and it noticed immediately.

---

## 26. I2 PATH A regression

Green. `tests/i2-flow/onboarding-postgres.ts` still proves the brand-new human onboards through I1.2, accepts, and **signs straight in** — one membership, so no picker, no change.

---

## 27. I2 PATH B reachability

**Resolved.** The existing human who gained a second membership through I2 now signs in, is offered both workspaces, chooses tenant B, and receives a `TenantContext` for tenant B with tenant B's own member role.

---

## 28. Schema delta

**Zero.** The pre-tenant row uses a shape the schema has always permitted:

```sql
user_session_contexts_tenant_membership_chk
  CHECK ((active_tenant_id IS NULL) = (active_membership_id IS NULL))   -- both-NULL passes
user_session_contexts_membership_version_chk
  CHECK ((active_membership_id IS NULL AND membership_version IS NULL) OR (…))
```

No enum, column, table, index, constraint or foreign key was added or altered.

---

## 29. Migration count

23 before, **23 after**. Journal 23. Applied to `hebun_r1`: **20, unchanged**.

## 30. Dependency delta

**None.**

---

## 31. Focused tests

```
PASS tests/tenant-selection-flow/selection-postgres.ts
PASS tests/tenant-selection-flow/boundaries-and-firewall.ts
```

Re-run green individually: `d1-flow/authentication-postgres`, `d1-flow/boundaries-and-firewall`, `r1-foundation/session-and-tenant`, `i2-flow/*`.

## 32. Total tests

```
Test summary: 343 passed, 0 failed, 343 total.
```

341 before → **343**, +2 exactly matching the two new files.

## 33. Typecheck

`npx tsc --noEmit` → **PASS**.

## 34. Lint

`npx eslint src` → **0 errors.** 12 warnings, all pre-existing `_context`-style unused-parameter notices in untouched modules; none in any file this phase created or modified.

## 35. Build

`next build` → **PASS**. *(The `middleware`-to-`proxy` deprecation notice is a pre-existing Next 16 warning.)*

## 36. `git diff --check`

Clean.

---

## 37. Changed-file accounting

**52 working-tree entries.**

| Group | Count |
|---|---|
| I1 / I1.1 / I1.2 / I2 (untouched by this phase) | 38 |
| Documentation (`learnings.md` + 6 reports, including this one) | 7 |
| **New source** | **3** — `tenant-selection/contracts.ts`, the card, the page |
| **New tests** | **1 directory** (`tests/tenant-selection-flow/`, 2 files) |
| **Modified source** | **4** — `identity-repository.server.ts`, `session-service.server.ts`, `request-session.server.ts`, `login/actions.ts` |
| **Modified for the resolved limitation** | **3** — I2's `contracts.ts`, `accept-invitation.server.ts` doc, and two I2 test files |

## 38. Git state

HEAD `872b753…` unchanged · ahead/behind `0 0` · index clean · **no commit, no tag, no push**.

## 39. `hebun_r1` state

Read-only throughout. **Not migrated, not seeded, no mutation test run against it.**

```
applied migrations = 20   (unchanged)
user_session_contexts: 47 rows, 0 with a null tenant
```

## 40. Orphan database handling

The three known orphans were **not used, not mutated, not dropped, not swept, not renamed**:

```
hebun_test_hebun_i1_membership_1c8a8356214345b5
hebun_test_i12_probe_d073c537
hebun_test_i12_manual_be58770e
```

Every disposable database in this phase was created and destroyed through `createDisposablePostgresHarness`.

---

## 41. Proven vs unproven

**Proven, on real PostgreSQL:** all three sign-in outcomes · a pre-tenant receipt that authorizes nothing · candidates derived server-side and thin · revalidation refusing guessed, foreign, revoked, stale-tenant and disabled-tenant selections · the correct tenant, role and membership version on success · rotation with revocation of the receipt · replay refusal · concurrency without in-place mutation · next-request revalidation after revocation · the I2 limitation resolved · single-membership sign-in unchanged.

**Not exercised in a browser** — §42.

## 42. Remaining limitations

1. **No post-login switching.** §18. Sign out and in again.
2. **No browser verification.** The picker needs a durable human with two active memberships in two active tenants; `hebun_r1` holds two humans with one membership each and is read-only for this phase. Creating that state would mean migrating and seeding the durable database. The surface is proven structurally instead — wording, accessibility attributes, refusal coverage — and that is stated as a limitation rather than dressed up as visual proof.
3. **The zero-membership state has nowhere to go.** `onboarding-required` is now real and honest, but there is no self-service path out of it: a Governance authority must admit the human.
4. **A pre-tenant receipt is a cookie.** Short-lived and inert, but it exists; a stolen one lets a thief see which workspaces that human belongs to, and choose one. It is bounded by the ten-minute lifetime and by revocation on first use.
5. **No audit event.** §43.

## 43. Audit

**None added, deliberately.** Choosing a workspace is not a Governance decision, not a mutation of any authority, and creates no artifact — it selects among entitlements the human already holds. The durable record already exists in `user_session_contexts`: the revoked receipt, its `revocation_reason = 'tenant-selected'`, and the fresh row naming the chosen tenant.

Authentication-event telemetry (sign-in success, session issuance) remains unowned repository-wide. **This phase does not claim audit coverage it did not build**, and it did not broaden any existing audit domain to pretend otherwise.

## 44. Next frontier

**Post-login workspace switching** — the same revalidation and issuance, a different entry point and a product decision about where the control lives.

Then: a durable-environment path so surfaces like this can be verified in a browser at all; and an authentication-telemetry owner, which is now the only part of the sign-in path with no history.

---

## 45. Final verdict

# TENANT SELECTION CLOSED — INITIAL SELECTION READY, POST-LOGIN SWITCHING DEFERRED

Multi-membership sign-in selects a workspace, safely and provably, with **zero schema change, zero migration, zero dependency and no new authority**.

- **All three declared outcomes are real.** `onboarding-required` and `tenant-selection-required` had been in the `AuthenticationResult` contract since the authentication foundation with no producer. They have one now, and `authorized` is byte-for-byte the same invariant it was.
- **The client chooses among candidates; it never manufactures one.** One membership id in, re-read by id *and* by the authenticated human, lifecycle re-checked from that row, tenant re-checked, version taken fresh.
- **Authority is never mutated in place.** Selection issues a new receipt and revokes the old one, so a session can never claim a tenant it was not issued for.
- **The I2 limitation is resolved at sign-in**, and the I2 fixtures that asserted it were updated to the new truth rather than the invariant relaxed to keep them passing.
- **Deferred and stated:** switching workspace from inside an already-authorized session. `selectTenantForSession` explicitly refuses a tenant-bound receipt, so it cannot be reached by accident.

`npm run verify`: lint ✅ · typecheck ✅ · **343/343** ✅ · build ✅ · `git diff --check` clean.
23 migrations, 20 still applied to `hebun_r1`, read-only throughout. Three known orphan databases untouched. **No commit, no tag, no push.**
