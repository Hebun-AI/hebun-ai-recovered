# HEBUN — PUBLIC ONBOARDING ENTRY SURFACE — CLOSURE RECORD

Date: 2026-08-14. Phase: the product surface that makes a C3 onboarding capability spendable.
Baseline: `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` (`main`, `0/0` with `origin/main`).

Gate A for this phase is PART ELEVEN (§77–88) of
`hebun-first-durable-governance-ceremony-execution.md`. It returned **`NO SCHEMA CHANGE REQUIRED`**,
and this phase did not need one.

**Director scope, as given:**

1. `/login/join` — public bearer entry, Act 1 / Act 3 / acceptance UI
2. Governance approval surface inside the existing `/governance/authority`
3. Pending-enrollment read seam under the existing enrollment authority, not a new authority
4. Continuation reference custody — no `localStorage`, no `sessionStorage`, no URL; prefer a
   server-managed httpOnly short-lived receipt **if the repository seam supports it**

---

## 1. Item 4 — the seam verdict

**SUPPORTED.** The repository already keeps every cookie value as an *opaque reference whose keyed
digest is the durable record*, and the continuation reference is already exactly that shape:

| | session cookie | continuation receipt |
|---|---|---|
| Cookie value | opaque reference | opaque reference |
| Durable record | `user_session_contexts` digest | `identity_enrollment_requests.continuation_hash` |
| Digest | HMAC-SHA256 + domain label | HMAC-SHA256 + domain label (`hebun.i1-2.enrollment-continuation.v1`) |
| Options helper | `sessionCookieOptions` | `continuationCookieOptions` |
| Authorizes | a tenant session | **nothing** |

`enrollment-digest.server.ts` states the equivalence itself: the continuation reference is treated
"identical to how `session-digest.server.ts` treats a session reference". So the receipt is not a new
token format, not a new secret, and not a new authority — it is the value the authority already mints,
carried in the safest place available rather than handed to a human to keep.

**What was chosen, and why each alternative is worse:**

| Option | Verdict |
|---|---|
| httpOnly cookie, path `/login/join`, 12h | **chosen** — unreadable by page script, never in a URL, self-expiring, sent to no other route |
| shown to the human | rejected — creates a second permanent copy in a clipboard or notes app |
| `localStorage` | rejected by the Director, and correctly: script-readable, survives indefinitely |
| `sessionStorage` | rejected by the Director, and correctly: script-readable, dies on a tab close mid-ceremony |
| URL / query | rejected — browser history, `Referer`, and every access log in the path |
| a second durable receipt table | rejected — a new durable concept, which would have forced Gate B |

**Why 12 hours is safe to choose.** A receipt that *outlives* its ceremony grants nothing: Act 3
re-reads the invitation and refuses a lapsed one. A receipt that *dies before* its ceremony was the
real hazard — and it is recoverable, because
`identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <> 'rejected'`. A
Governance authority who rejects a stranded ceremony frees the invitation, and the same capability
can be presented again. That recovery path is asserted by test, not assumed, precisely because the
short TTL depends on it.

**The honest cost, recorded rather than hidden:** the receipt binds a ceremony to ONE browser. A
bearer who starts on a laptop and returns on a phone must have the stranded ceremony rejected and
start again. `CONTINUATION_CUSTODY.limitation` says so in the code.

---

## 2. What was built

**New — public surface**

| File | Responsibility |
|---|---|
| `src/app/login/join/page.tsx` | Server component. Beneath the existing public prefix. Takes **no** `searchParams`. Reads only whether a receipt exists. |
| `src/components/auth/onboarding-entry-card.tsx` | Client. Three acts, one form. Holds the capability in memory only. |
| `src/components/auth/onboarding-entry-wording.ts` | Every refusal sentence, `Record<Union, string>` so a new reason breaks the build. |
| `src/app/login/onboarding-actions.ts` | `"use server"`. The request boundary: resolves the environment, carries the cookie, delegates. |

**New — custody and read seam**

| File | Responsibility |
|---|---|
| `src/features/identity-enrollment/continuation-cookie.ts` | Isomorphic cookie contract, mirroring `session-cookie.ts`. No `next/headers`. |
| `src/features/identity-enrollment/read-pending-enrollments.server.ts` | Authority-gated, tenant-scoped, address-free list of waiting ceremonies. |

**New — Governance approval half**

| File | Responsibility |
|---|---|
| `src/components/governance-authority/pending-enrollment-card.tsx` | Client. Approve / reject with a justification. |
| `src/components/governance-authority/pending-enrollment-wording.ts` | Decision refusal sentences. |

**Modified**

| File | Change |
|---|---|
| `src/app/(dashboard)/governance/authority/actions.ts` | `+ decideIdentityEnrollmentAction`, in the existing pattern |
| `src/app/(dashboard)/governance/authority/page.tsx` | reads pending enrollments, renders the card under the same authority guard |

**Tests**

| File | Proves |
|---|---|
| `tests/onboarding-entry-flow/read-seam-postgres.ts` | Real Postgres: authority-gated, tenant-scoped, address-free, decided ceremonies leave the list, the seam writes nothing, and rejection frees the invitation |
| `tests/onboarding-entry-flow/boundaries-and-firewall.ts` | 11 structural boundaries — see §4 |

**Zero migrations. Zero schema changes. Zero new authorities.** The surface calls
`startIdentityEnrollment`, `decideIdentityEnrollment`, `completeIdentityEnrollment` and
`acceptInvitation`, and reproduces none of them.

---

## 3. What the boundary is not allowed to be

`src/app/login/onboarding-actions.ts` contains no `@/db/schema`, no `@/db/client.server`, no
`drizzle-orm`, no `node:crypto`, no digest function, no `.insert(`, and no `process.env`. It cannot
validate a capability, mint a token, or write a row, because it has nothing to do it with. A test
enumerates every mutating call in the file and requires each to be `store.set(` or `store.delete(` —
the cookie store, never a table.

`accept-invitation.server.ts:270` is still the only `.insert(memberships)` in `src`, and a test
asserts that list is exactly one entry long. The entry surface calls the membership writer; it did
not become one.

---

## 4. Boundaries locked by test

1. `PUBLIC_PREFIXES = ["/login"]` unchanged; the page lives beneath it; the page takes no parameter;
   no action puts a capability in a redirect.
2. No `page.tsx` in `src/app` reaches the onboarding feature directly.
3. The continuation reference never appears in an action's return value; no `localStorage`,
   `sessionStorage` or `document.cookie` in the surface's *code*.
4. The receipt cookie is `httpOnly`, `sameSite=lax`, `secure` in production, path-scoped to
   `/login/join`, never negative, distinct from `SESSION_COOKIE_NAME`, and strictly shorter-lived
   than `INVITATION_LIFETIME_HOURS`.
5. The boundary owns no authority (§3).
6. Nothing on the surface logs.
7. No client component names the enrollment authority or imports an onboarding server module.
8. Nothing is disclosed before a proof — no tenant name, no address, no role, on the page or in the
   read seam.
9. No wording claims a delivery or an email verification.
10. The merged `not-acceptable` refusal stays merged, and its sentence hints at no branch.
11. Membership still has exactly one production writer.

---

## 5. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | 0 errors (14 pre-existing warnings, none in new files) |
| `npm run test:run` | **349 passed, 0 failed** (was 347 — the two new files) |
| `npm run build` | clean; `/login/join` registered as a dynamic route |

**Live browser proof** against the running dev server:

- `/login/join` renders **with no session cookie** — the public boundary works.
- The page shows the honest wording, including that Hebun did not send the capability and that
  possession proves nothing else.
- `Submit for approval` is disabled until a capability is entered.
- `/governance/authority` **still redirects to sign-in** when unauthenticated — the dashboard did not
  become public.

**What the browser did NOT prove, stated plainly:** the pane's input automation could not focus the
form (its accessibility bridge reported a 0×0 viewport and clicks never moved `activeElement`), so the
three acts were **not** driven through a real browser. The four authorities are proved end to end
against real Postgres by `tests/i2-flow/onboarding-postgres.ts`, and the read seam by this phase's own
Postgres test; the **cookie set/read/clear wiring is proved structurally, not executed**. That is the
same split the repository already accepts for tenant selection, where `selectTenantForSession` is
tested against Postgres and the cookie half is asserted structurally — but it is a real gap and it is
recorded here rather than glossed.

---

## 6. Ceremony impact

Nothing in the paused ceremony moved. Verified read-only after every step, including after the
browser session:

```
invitations 0 · identity_enrollment_requests 0 · users 2 · memberships 2 · audit_log 5 · decisions 3
97d165f3-9962-4473-95b0-00132b1ebfbe → authorized, consumed_at NULL
```

C3 has still not been executed. The capability now has a legitimate destination, so the model PART
ELEVEN described holds: the Director may perform C3 whenever they choose, and the bearer has a
surface to spend it on.

**Sequence the Director should expect after C3:**

1. Alice clicks *Issue onboarding capability* and hands the string over out of band.
2. The bearer opens `/login/join`, pastes it, submits. A `pending` enrollment row appears; nothing
   global is created.
3. Alice sees it under *Enrollment submissions awaiting your decision* on `/governance/authority`,
   writes a justification, approves. A Governance decision is recorded.
4. The bearer returns **in the same browser**, chooses a password. User, identity and credential are
   created in one transaction.
5. The bearer confirms their email and password. The invitation is accepted and the membership is
   created — Member role, Acme.
6. They sign in at `/login` normally.

---

## 7. What this phase did not do

- No migration, no schema change, no new table, no new enum value.
- No new authority, token format, or authentication mechanism.
- No middleware change; `PUBLIC_PREFIXES` untouched.
- No email delivery and no email-ownership verification — still unsolved, still stated as a
  limitation on the surface itself.
- No rate limiting. There is none anywhere in this repository, and this phase did not invent one;
  capability entropy remains the protection, exactly as PART ELEVEN §85 recorded.
- No revocation runtime for a misdelivered capability — waiting out the 72 hours is still the only
  correction.
- **No commit, no tag, no push.** `hebun_r1` was read and never written.

---

## 8. Open item for the Director

`apps/dashboard/.claude/launch.json` was created to let the browser proof start a dev server. It is
untracked and **not** gitignored, so it would be included in a commit. Keep it or delete it — it is a
local tooling convenience, not part of the phase.
