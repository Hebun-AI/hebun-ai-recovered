# HEBUN POST-LOGIN TENANT SWITCHING — CLOSURE REPORT

**Phase:** Post-Login Tenant Switching — Gate A resolved from repository evidence, then implemented in the same task
**Date:** 2026-08-13
**Scope consumed:** one sibling entry point inside the existing Session authority. **Zero schema change, zero migration, zero dependency, no new authority.**
**Predecessors:** I1, I1.1, I1.2, I2, Tenant Selection — all CLOSED, none redesigned.
**Resolves:** the limitation Tenant Selection recorded in its §18 (`POST_LOGIN_SWITCHING.implemented = false`).
**Verdict:** see §40.

---

## 1. Baseline

Re-proven before any modification, remote included.

| Fact | Measured |
|---|---|
| Branch / HEAD / `origin/main` / remote `main` | `main` · `58fb343c35ac163cea97afd71c11f69b666404cc` · all identical |
| Ahead / behind | `0 0` |
| Working tree before | clean |
| Staged before | none |
| P3 tag (local + remote) | `hebun-p3-identity-and-membership-onboarding-runtime-complete` → `3d81066e` → `58fb343c` |
| Migrations / journal | 23 / 23 |

---

## 2. The question this phase answered

> A human holds a session that is authorized in tenant A and also holds an active membership in
> tenant B. By what authoritative transition does that session become tenant B's?

Not a dropdown problem. A **session authority transition** problem.

What it deliberately did **not** answer: may they hold that membership (I1/I2, already durable), who is this human (credential authority, already proven — the session *is* the proof), what may they do inside the tenant (role/Governance, untouched).

---

## 3. The pre-existing firewall, and why it was there

`selectTenantForSession` refused any tenant-bound receipt:

```ts
current.activeTenantId !== null || current.activeMembershipId !== null
```

Classification: a **deliberate runtime firewall** — not a schema limitation, not a type limitation, not merely an unexposed product decision. Three independent artifacts protected it:

- `POST_LOGIN_SWITCHING.implemented = false` in `tenant-selection/contracts.ts`
- `tests/tenant-selection-flow/boundaries-and-firewall.ts` §10 — asserted the constant *and* regex-matched the source line
- `tests/tenant-selection-flow/selection-postgres.ts` — asserted `no-selection-context`, commented "post-login switching is not this"

**The firewall is still there, byte-identical.** It was not removed, widened, or relaxed.

---

## 4. Session authority — the owner

`src/features/auth-runtime/` — `session-service.server.ts` (decisions) over `identity-repository.server.ts` (data access). These two files are the only modules in the repository that write `user_session_contexts`. No second Session authority, no tenant-manager authority, no Governance resolver was created.

---

## 5. Session writer census

| Writer | Call sites | Kind |
|---|---|---|
| `insertSessionContext` | 4 — sign-in, pre-tenant receipt, tenant selection, **switch (new)** | insert |
| `touchSessionActivity` | 1 — `resolveSessionFromReference` | activity touch |
| `revokeSession` (unconditional) | 2 — tenant selection, logout | revoke |
| `revokeSessionIfActive` (**new**, conditional) | 1 — switch | revoke |

Distinct `UPDATE … SET` shapes on `user_session_contexts`: still exactly **two** — `lastActivityAt, inactivityExpiresAt` and `revokedAt, revocationReason`.

**No writer mutates `active_tenant_id`, `active_membership_id` or `membership_version` in place.** Authority is never re-pointed.

---

## 6. Gate A — the ten questions

| | Question | Answer |
|---|---|---|
| Q1 | Authority owner? | The existing Session authority. No new authority. |
| Q2 | Extend the existing selection primitive? | **No.** `selectTenantForSession` is reachable from `/login/select-workspace`, beneath `PUBLIC_PREFIXES = ["/login"]`. Widening it would make a live authorized session re-pointable from a public surface. A **sibling** entry point with the mirror-image precondition is the narrowest legitimate extension. |
| Q3 | In-place mutation, or fresh + revoke? | **Fresh + revoke**, strengthened: the revoke is conditional and inside the same transaction. |
| Q4 | Minimum client selector? | One membership id. Nothing else. |
| Q5 | What is revalidated? | Everything — see §8. |
| Q6 | Audit event? | **No** — see §12. |
| Q7 | Schema sufficient? | **Yes.** Migration delta 0. |
| Q8 | Weakens initial selection? | **No.** `selectTenantForSession` untouched. |
| Q9 | When is the old session revoked? | Inside the transaction, **before** the insert, conditional on still-live. |
| Q10 | Two concurrent switches? | Exactly one wins. |

**Gate A resolved entirely from repository evidence. No Director decision was required.**
**Gate B NOT REQUIRED** — no enum, column, table, index, constraint, or migration touched.

---

## 7. The chosen transition model

```
authorized tenant-bound session
  → resolveSessionFromReference  (must be `authorized`)
  → same-target check            (already-active)
  → findMembershipForUser(userId, membershipId)   id AND user together
  → lifecycle + tenant + version revalidation
  → BEGIN
      revokeSessionIfActive(current)   conditional; zero rows ⇒ raise ⇒ unwind
      insertSessionContext(fresh)
    COMMIT
  → assembleAuthorized → authorized result for the target tenant
```

**Rejected alternatives**

- **In-place mutation of the session row** — destroys provenance; violates the invariant that authority is never silently mutated; a structural test forbids the SET shape.
- **A child/parent session context** — unrepresentable without schema change, i.e. Gate B.
- **Initial selection's exact shape (insert-then-revoke, no transaction)** — correct for a ten-minute picker receipt, wrong here: two concurrent switches would both succeed, leaving a live session nobody holds.

---

## 8. Server-side revalidation

Nothing shown to the client is trusted on the way back.

| Question | How it is answered |
|---|---|
| Is the current session valid? | `resolveSessionFromReference` — the same function every request uses, so "authorized enough to switch" cannot drift from "authorized enough to act" |
| Which human? | From the resolved session, never from input |
| Does the target belong to that human? | `findMembershipForUser(db, session.userId, membershipId)` — id **and** user together |
| Membership active / not revoked / not soft-deleted / has a role? | Re-checked from the row just read |
| Target tenant active / not deleted / auth enabled? | Re-checked at issuance |
| Is `membership_version` current? | Read **now**, written **now** |
| Is the current session stale? | The resolver refuses it → `no-active-session` |

---

## 9. Session clock semantics

A switch proves **no** credential. It must therefore not extend the constitutional lifetime of the original authentication.

| Field | Behaviour |
|---|---|
| `authenticated_at` | **carried over unchanged** |
| `absolute_expires_at` | **carried over unchanged** — never restarted |
| `inactivity_expires_at` | slid forward like any activity, bounded so it can never pass the absolute expiry |
| cookie `max-age` | remaining absolute lifetime, not a fresh eight hours |

This is a deliberate difference from initial selection, which resets the absolute window — harmless there because the pre-tenant receipt lives at most ten minutes, so drift is bounded by ten minutes. A switch can happen seven hours into a session; restarting the window would turn the absolute TTL into an inactivity TTL with extra steps.

---

## 10. Initial selection and switching are separate entry points

| | Initial selection | Post-login switching |
|---|---|---|
| Function | `selectTenantForSession` | `switchTenantForSession` |
| Requires | a **pre-tenant** receipt | a session that resolves **`authorized`** |
| Refuses | a tenant-bound receipt (`no-selection-context`) | anything not authorized, which includes a pre-tenant receipt (`no-active-session`) |
| Surface | `/login/select-workspace` — public prefix | `/foundation` — inside the protected dashboard |
| Clock | fresh absolute window | carried over |

Each refuses the other's input. They **share** the one revalidation reader (`findMembershipForUser`), the one assembly path (`assembleAuthorized`), and the one integrity gate (`createAuthorizedAuthenticationResult`) — so no authority is duplicated. A test proves a refused switch does **not** spend the picker's receipt.

---

## 11. Client input firewall

The client submits `{ membershipId: string }` and nothing else. It cannot supply `tenantId`, `userId`, `actorId`, `actorType`, `authIdentityId`, `roleId`, `roleType`, `membershipVersion`, `sessionContextId`, membership status, or session authority — asserted structurally over the input shape, not merely by convention. Every authority-bearing value is server-derived.

---

## 12. No audit semantics were invented

Session authority has never written an audit row — not for sign-in, not for selection, not for sign-out. Inventing one here purely for symmetry would have been a new durable artifact this phase has no authority to define.

The transition's record is **session-native and already durable**: the spent row keeps its own tenant and gains `revocation_reason = 'tenant-switched'`; the fresh row records the tenant it was issued for and when. A structural test now enforces that no audit sink appears anywhere in `auth-runtime`.

`audit_log` count after the full runtime proof: **0**.

---

## 13. Concurrency and replay

The conditional revoke takes the row lock on the session two switches actually contend for. The loser's update matches zero rows, raises, and its insert unwinds with the transaction.

- Concurrent A→B and A→C: exactly **1** winner, exactly **+1** row, source session dead.
- Concurrent A→B twice: exactly **1** winner, exactly **+1** row.
- The loser's refusal is `no-active-session` **or** `switch-superseded`, depending on interleaving — both mean "nothing was changed", and neither talks about the membership. The test asserts the invariant and accepts either; the single-spend primitive is proven **deterministically** on its own (a second `revokeSessionIfActive` returns `false`).
- Replay: the old reference is dead at commit, because `findSessionByDigest` filters `revoked_at is null`.

---

## 14. Attack matrix

All against a real, disposable PostgreSQL database — `tests/tenant-switching-flow/switch-postgres.ts`.

| Attack | Result |
|---|---|
| Fabricated membership UUID | `membership-unavailable` |
| Another user's real, live membership | `membership-unavailable` — indistinguishable from a guess |
| Revoked membership | not offered, refused |
| Suspended membership | not offered, refused |
| Soft-deleted membership | not offered, refused |
| Suspended tenant | not offered, refused |
| Deleted tenant | not offered, refused |
| Archived tenant | not offered, refused |
| Auth-disabled tenant | not offered, refused |
| Stale **target** version | succeeds carrying the version read now; resolver accepts immediately |
| Stale **current** session (version moved) | `no-active-session` — a forbidden session cannot launder itself into a fresh one |
| Revoked current session | `no-active-session` |
| Expired current session | `no-active-session` |
| Pre-tenant receipt → switching entry point | `no-active-session`, and the receipt is **not** spent |
| Target = current membership | `already-active`, zero new rows, session still live |
| Concurrent A→B and A→C | 1 winner, +1 row |
| Concurrent A→B twice | 1 winner, +1 row |
| Replay of the old reference | `no-active-session` |

**Cross-tenant authority leakage: zero.** Every session row names only a tenant the human actually belongs to.

---

## 15. Absolute non-effects

Proven by table counts after the full runtime proof:

`memberships` 6 · `roles` 6 · `users` 4 · `auth_identities` 4 · `auth_credentials` 4 · `invitations` 0 · `membership_authorizations` 0 · `identity_enrollment_requests` 0 · `decision_records` 0 · `governance_sessions` 0 · `knowledge_nodes` 0 · `executions` 0 · `provider_connectivity_controls` 0 · `audit_log` 0

Every membership still `active` / `active` / `revoked_at IS NULL`. Switching creates no authority; it changes which existing entitlement a browser is currently acting under.

---

## 16. UI surface

`src/app/(dashboard)/foundation/page.tsx` — the existing authenticated session surface that already renders tenant / membership / role / session ids and carries **Sign out**. No new route, no parallel workspace manager; a test asserts exactly one surface offers switching.

**Honesty.** The wording is "Change workspace" and "Current workspace" — never Create, Join, Invite, Manage, Grant, Leave. Non-effects render from frozen contract values. With one membership the card says "nothing to change to" instead of rendering a chooser that can only refuse itself. The current workspace is shown and marked rather than hidden, because "where am I" is the first question such a control has to answer.

**Accessibility.** Real `<fieldset>` with `<legend class="sr-only">`, real radio inputs with real labels, `role="alert"` refusals, `role="status"` pending and current announcements, `aria-hidden` on the decorative icon, state carried by words rather than colour. Every refusal reason has wording.

---

## 17. Record integrity

Tenant Selection's `POST_LOGIN_SWITCHING` said `implemented: false`. It now says `implemented: true`, names the sibling that implements it, and restates the part that had to stay true — this entry point still refuses a tenant-bound receipt.

Two tests in `tests/tenant-selection-flow/boundaries-and-firewall.ts` were updated to assert the new truth rather than freeze the old one:

- §10 — now asserts the constant is `true` and that the selection firewall is still present
- §5 — now compares the **set** of `UPDATE … SET` shapes rather than the list, because a second revoke writer legitimately exists; a third distinct shape would still fail

`docs/product-vision/runtime/hebun-tenant-selection-authority-closure.md` is **unmodified**. Its §18 still records that switching was deferred *at that time* — correct history, not a false claim about the present.

---

## 18. Schema delta

**0.** No enum, column, table, index, constraint, or type touched.

## 19. Migration delta

**0.** 23 `.sql` files, 23 journal entries — unchanged from I1.2's count. No migration created, none edited.

## 20. Dependency delta

**0.** `package.json` and the lockfile are byte-identical to HEAD. Nothing installed.

---

## 21. Focused tests

| Suite | Result |
|---|---|
| `tenant-switching-flow/boundaries-and-firewall.ts` | PASS |
| `tenant-switching-flow/switch-postgres.ts` | PASS |
| `tenant-selection-flow/boundaries-and-firewall.ts` | PASS |
| `tenant-selection-flow/selection-postgres.ts` | PASS |
| `d1-flow` (3), `d1-1-flow` (3) | PASS |
| `i1-flow` (3), `i1-1-flow` (3), `i1-2-flow` (3), `i2-flow` (3) | PASS |
| `authentication-foundation` (6), `authentication-schema` (1) | PASS |

## 22. Full verification

| Check | Result |
|---|---|
| Total tests | **345 passed, 0 failed, 345 total** (343 before; +2 new files) |
| Lint | **0 errors**, 14 warnings — all pre-existing, none in changed files |
| Typecheck | PASS |
| Build | Compiled successfully |
| `git diff --check` | clean |
| `npm run verify` exit | 0 |

---

## 23. Changed-file accounting

**Modified (7)**

- `src/app/(dashboard)/foundation/page.tsx` — mounts the switcher
- `src/app/login/actions.ts` — `switchWorkspaceAction`, beside the other Session-authority actions
- `src/features/auth-runtime/identity-repository.server.ts` — `SessionWriter` type, transaction-capable `insertSessionContext`, `revokeSessionIfActive`
- `src/features/auth-runtime/request-session.server.ts` — the cookie half
- `src/features/auth-runtime/session-service.server.ts` — `switchTenantForSession`, `readSwitchableWorkspaces`
- `src/features/tenant-selection/contracts.ts` — record integrity (§17)
- `tests/tenant-selection-flow/boundaries-and-firewall.ts` — record integrity (§17)

**New (4)**

- `src/features/tenant-switching/contracts.ts` — the phase's vocabulary, pure
- `src/components/auth/workspace-switch-card.tsx` — the control
- `tests/tenant-switching-flow/boundaries-and-firewall.ts` — structural proof
- `tests/tenant-switching-flow/switch-postgres.ts` — runtime proof

**Generated churn, not part of the change:** `next-env.d.ts` flips between `./.next/types/…` and `./.next/dev/types/…` depending on whether `next build` or `next dev` ran last. It is Next-generated ("This file should not be edited"), and the canonical build restores the committed variant on its own.

---

## 24. Git state at closure

No commit, no tag, no push. HEAD remained `58fb343c`, `0 / 0` with `origin/main`, all work uncommitted.

This document is committed by the **separate commit gate** that follows closure, which is the step that also re-proves every gate above from a clean run. Nothing here was published as part of the P3 release.

---

## 25. `hebun_r1` state

Untouched. Still **20** applied migrations — three behind the repository's 23, exactly as before this phase. Read-only `SELECT`s only: no migration, no seed, no ceremony, no fixture, no durable session written.

## 26. Orphan database handling

The three known orphans — `hebun_test_i12_probe_d073c537`, `hebun_test_i12_manual_be58770e`, `hebun_test_hebun_i1_membership_1c8a8356214345b5` — were not used, mutated, dropped, swept, or renamed.

Every disposable database this phase created was created **and** destroyed through its own D1.1 ownership handle. **No new orphan was left behind**, verified by listing the instance after the full run.

---

## 27. Proven vs unproven

**Proven.** The transition, every revalidation, the clock semantics, the concurrency invariant, replay resistance, tenant isolation across the full attack matrix, and the absolute non-effects — all against a real PostgreSQL database. The structural claims — authority ownership, writer census, firewall separation, input firewall, absence of an audit sink, route placement, accessibility — by tests that read the source.

**Unproven.** The populated switcher has never been rendered in a browser. A durable two-membership human exists in `hebun_r1` (`alice@acme.test`, 2 active memberships, 1 active credential), but reaching the switcher requires signing in, which means entering a password — not an action the agent performs — and mutating `hebun_r1` to bypass it was forbidden. The authenticated render is therefore covered by build, typecheck and structural test only.

The public surfaces **were** browser-verified on `http://localhost:4000`: `/` → 307 → `/login`; `/login` → 200, renders; `/foundation` unauthenticated → 307 → `/login`; `/login/select-workspace` without a receipt → 200 with its honest empty state; zero console errors.

---

## 28. Remaining limitations

1. **The populated switcher has not been rendered in a browser.** §27.
2. **Membership–role tenant integrity is not enforced by the database.** `memberships.role_id → roles.id` has no composite constraint tying the role's tenant to the membership's, so a membership in tenant C carrying tenant B's role is representable, and every session path reads the role straight off the membership row. This is **pre-existing** and identical on the sign-in path; a test proves switching is exactly as strict as an ordinary sign-in, never weaker. Not repaired here — it belongs to Membership authority and needs a Gate B schema change.
3. **The concurrency loser's refusal reason is interleaving-dependent** — `no-active-session` or `switch-superseded`. Both mean nothing changed. §13.
4. **One extra session resolve per `/foundation` render**, because `readSwitchableWorkspacesForRequest()` takes no arguments — so it cannot be aimed at another account — and re-resolves internally. Idempotent, best-effort.
5. **One workspace per browser.** A switch replaces the session, so another tab holding the old cookie is signed out at its next request. Stated in `CONCURRENT_WORKSPACES`.
6. **Initial selection still restarts the absolute window** while switching carries it over. Deliberate, bounded, and explained in §9 — not an inconsistency to flatten blindly.

---

## 29. Next frontier

**Membership–Role Tenant Integrity** (Gate B): a composite foreign key `memberships(tenant_id, role_id) → roles(tenant_id, id)`, mirroring the one `user_session_contexts` already carries. It closes limitation 2 at the schema level for every reader at once rather than per-path. Requires its own Gate A/B and must not be started inside another phase.

Alternatives at delta 0: **P3 durable rollout** (`hebun_r1` is three migrations behind) or the **Public Onboarding Entry Surface**.

---

## 30. Final verdict

# POST-LOGIN TENANT SWITCHING CLOSED WITH DOCUMENTED LIMITATION

- **Closed:** the transition is built, proven against real PostgreSQL across the full attack matrix, with zero schema delta, zero migration delta, zero dependency delta, no new authority, no invented audit, and no weakening of initial selection.
- **Documented limitation:** the populated switcher is unproven in a browser, and the pre-existing membership–role tenant integrity gap is reported rather than silently changed.
