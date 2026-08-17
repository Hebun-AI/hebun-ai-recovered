# R4B — Tenant suspension (implementation closure record)

**Date:** 2026-08-17
**Predecessor:** `hebun-r4a-tenant-bootstrap-ceremony-closure.md` (released `ab82b27`, tag
`hebun-tenant-bootstrap-ceremony-complete`, canonical migrated 29 → 30).

**What this phase did:** completed tenant-status enforcement in the three flows that bypassed it, and
added a local-operator ceremony for `active ↔ suspended`.
**What it did not do:** everything else about tenant lifecycle. No deletion, no retention, no UI, no
production operator, no session revocation, no schema change.

---

## 1. The two gaps this closed

The R4B audit found two separable things, and the narrowed scope covers both:

1. **A missing writer.** `companies.tenant_status` is read at four session gates and was writable by
   nobody. After R4A the only writes to `companies` anywhere were birth-time.
2. **A correctness defect.** Suspension was already enforced for every authenticated path and
   silently bypassed by three others. That defect existed whether or not a writer was ever built,
   which is why the audit's verdict was "implement a narrower slice" rather than "defer".

## 2. The enforcement gap, precisely

`accept-invitation`, `start-enrollment` and `complete-enrollment` resolve their tenant from the
**invitation row**, never from a session, so none of the four session gates ever ran for them.
Proved mechanically: none of the three imported `@/db/schema/company` at all. A bearer holding a live
invitation into a suspended tenant could therefore create a user, an identity, a credential and a
**membership**. They could not then sign in — issuance blocks — so the damage was bounded to durable
rows rather than access, but the rows were real.

## 3. One read seam, not three copies

`isTenantOnboardingEligible(db, tenantId)` lives in `auth-runtime/identity-repository.server.ts` —
the module that **already performs every other `companies` read**, and which all three flows already
imported. It owns no state, writes nothing, decides no transition, and takes a tenant id its caller
read from a durable row. It is one more read in the existing owner, not a second tenant authority.

**The eligibility vocabulary now has one definition.** `ACTIVE_TENANT_STATUSES` was a private
constant inside `session-service.server.ts`, correct while that file was the only asker. R4B gave the
question a second asker, and two copies of "which statuses count as usable" is exactly how one
enforcement point comes to disagree with the other. The set moved to the repository (the lower layer
— `session-service` already imports from it, so no cycle) and the session service imports it. The set
is unchanged, `{"active"}`, and a test asserts all four session gates survive in number.

Deliberately **not** consulted: `authentication_disabled_at`, which is authentication *policy* —
collapsing it into lifecycle would make "suspended" and "authentication disabled" indistinguishable
forever. `lifecycle_status` **is** consulted, because it is the generic soft-delete flag the session
gate already checks in the same breath.

## 4. Refusal vocabulary — reused, and that is a security choice

All three flows refuse with their existing `capability-not-usable`. No public contract widened.

This is not only economy. These acts are **unauthenticated**, and a distinguishable "the tenant is
suspended" would tell an unknown bearer something true about an organization they have not proved any
relationship to. Each module already collapses expired, revoked and already-accepted into one answer
for exactly that reason, and `accept-invitation` goes further: every pre-authentication refusal calls
`spendEquivalentCredentialWork(password)` so a refusal cannot be identified by timing. **The R4B check
spends that work too** — skipping it would have made a suspended tenant measurably faster to refuse
than a wrong password, re-opening the oracle the module spends real work to deny.

## 5. Authority

**Deployment possession / local operator ceremony** — the same root as R4A, G2.1 and D1.1.

Not tenant Governance, and the audit proved why rather than preferring it: suspension makes every
tenant-scoped authority unreachable. `resolveSessionFromReference` re-reads company state on **every**
request, so a suspended tenant's owner cannot sign in, the dashboard layout redirects to `/login`,
and every Governance writer refuses a null `TenantContext`. An in-tenant suspension writer would
destroy the authority needed to reverse it and strand the entire organization — the stranded
enrollment lesson at tenant scale. Deployment possession never depended on the tenant being active,
so it moves the tenant in **both** directions.

## 6. What was built

| File | Role |
|---|---|
| `auth-runtime/identity-repository.server.ts` | `isTenantOnboardingEligible` + `ACTIVE_TENANT_STATUSES` (now exported) |
| `auth-runtime/session-service.server.ts` | imports the set instead of keeping a second copy |
| `human-onboarding/accept-invitation.server.ts` | tenant check, before authentication, with equivalent work |
| `identity-enrollment/start-enrollment.server.ts` | tenant check, before the enrollment row |
| `identity-enrollment/complete-enrollment.server.ts` | tenant check, before the transaction |
| `scripts/lib/tenant-lifecycle.ts` | *(new)* `suspendTenant` / `reactivateTenant` |
| `scripts/tenant-lifecycle.ts` | *(new)* the CLI |
| `package.json` | `tenant:lifecycle` |

**One CLI with a closed two-value verb**, not two files. Repository precedent is one file per
ceremony and two files would have matched it — but suspend and reactivate are one capability seen
from both ends, and splitting them meant two copies of the same guards, prompt and output. The closed
verb is the narrower shape: a third transition has no argument that could express it, so `deleting`
and `deleted` stay out of R4B **structurally**.

## 7. The transitions

| | Suspend | Reactivate |
|---|---|---|
| Predicate | `where id = $ and tenant_status = 'active'` | `… = 'suspended'` |
| `tenant_status` | `suspended` | `active` |
| `tenant_status_changed_at` | `now()` | `now()` |
| `suspended_at` | `now()` | `NULL` |
| `suspension_reason` | operator text, ≤128 chars | `NULL` |
| `version` | `+1` | `+1` |

The predicate is part of the UPDATE, not a read-then-write, so concurrency is decided by the database
— the same shape `retireExternalRecipient` uses. Reactivation clears the suspension evidence because
the row records the **current** state; a stale "suspended because X" beside an active tenant would be
a lie, and keeping the history would need a ledger R4B deliberately does not build.

Reactivation restores **eligibility only**. It creates no membership, role, session or permission.

## 8. Sessions — refused live, never revoked

The most important proof in the suite, and one only a real resolver can give:

1. a session is issued while the tenant is active;
2. the tenant is suspended;
3. the **same** session reference is resolved again → refused;
4. its `user_session_contexts` row is compared field by field and is **unchanged** — `revoked_at`
   still `NULL`, and zero sessions anywhere are revoked;
5. the tenant is reactivated;
6. the **same** reference resolves `authorized` again, with nobody signing in.

No revocation machinery was added, and none was needed. Two already exist (`revoked_at`, and the
membership-version equality check) and R4B uses neither.

## 9. Audit — zero rows, and the assertion had to be precise

R4B writes no `audit_log` row: `actor_type` and `actor_id` are both NOT NULL and a terminal operator
has neither, exactly as for R4A and G2.1. The row itself carries the resulting state, the timestamp,
the reason and the version.

The first version of this test asserted `audit_log = 0` and failed at 10 — because the *fixtures*
audit. The honest claim is narrower and stronger: a suspend and a reactivate together write **zero**
rows, measured across one pair; no audit action anywhere matches `suspend|reactivat|lifecycle|
tenant_status`; and every audit row that does exist names a real actor. A global zero would only have
proved no fixture ran.

## 10. Fixtures built by the real chain

An approved enrollment carries `identity_enrollment_requests_decision_fk` → `decision_records`, so a
fabricated approval is not merely dishonest — it is **unrepresentable**. The suite therefore runs the
genuine chain on an R4A-born tenant: Genesis nomination → acceptance → G2 → member baseline →
membership authorization → invitation issuance → enrollment start → enrollment approval. Only then
does it suspend, so every refusal is provably about the **tenant** and not about missing state. The
reactivation proof is the sharpest form available: the **identical** `completeIdentityEnrollment`
call that was refused while suspended succeeds once the tenant is active.

## 11. Firewalls held

| Firewall | Result |
|---|---|
| Schema | **NO CHANGE, NO MIGRATION** — 30 files = 30 journal = 30 applied; every field R4B writes already existed |
| Canonical | `acme` and `globex` both `active`, `v1`, `suspended_at` NULL — **zero tenants suspended**, `audit_log` 17 unchanged |
| R4A | birth untouched and re-proved green; `provisioning` remains R4A's transient state and has no representation in R4B |
| R5 | `deleting_at` never written and NULL everywhere; `deleting`/`deleted` have no representation — asserted as string literals absent from both modules |
| R3B | `external-send` row absent, `claude=false v30` untouched, attempts 0, permits 0, no Resend call |
| Heby / agents | asserted: no `heby-*`, `agent-runtime` or `action-execution` file references the lifecycle writer |
| Application runtime | zero `src/` importers; no `@/` import in either module; no route, action or component |
| Secrets | no credential-shaped identifier; the CLI warns the operator not to put one in a reason |
| Sessions | zero revoked, zero rows mutated |
| Dependencies | none added |

## 12. Tests

**392 passed, 0 failed** (390 baseline + 2 new files). Lint 0 errors / 14 pre-existing warnings,
typecheck clean, build clean, `git diff --check` clean, zero disposable residue.

- `tests/r4b-flow/lifecycle-boundary.ts` — write set is `companies` only, extracted from real SQL
  statements; exactly two UPDATEs, each assigning exactly the six contracted columns and no others;
  predicate-guarded; `provisioning`/`deleting`/`deleted` absent as literals; the shared seam consumed
  by all three flows and reimplemented by none; one definition of the status vocabulary with the four
  session gates intact; no audit, no session, no actor; every guard; no `src/` importer; no migration.
- `tests/r4b-flow/lifecycle-postgres.ts` — the exact field moves either way, the untouched columns
  compared before and after, the session proof of §8, the three enforcement refusals with row counts
  on both sides, the identical-call reactivation proof, duplicate-transition refusals, both
  concurrency races (one winner, one version increment), tenant isolation, and the R5/R3B firewalls.

**No inherited test was changed.** Nothing R4B built falsified an existing guard — including the four
session gates, which behave identically before and after the constant moved.

## 13. Limitations (deliberate, recorded)

1. **`active ↔ suspended` only.** Deletion, retention, erasure, crypto-shredding and audit redaction
   remain **R5**, unstarted. An enum value is not authorization.
2. **`provisioning` remains R4A's**, transient and in-transaction. R4B cannot reach it.
3. **Local and development-only.** `NODE_ENV=production` and non-local databases are refused.
   **No production lifecycle operator exists.**
4. **No UI.** `/governance/authority` was rejected as the owner because it is provably unreachable
   once a tenant is suspended — placing the control there is the stranded-tenant bug in surface form.
5. **No audit actor is fabricated**, so lifecycle transitions leave no ledger entry beyond the row.
6. **No suspension history.** The row records the current state; a prior reason is cleared on return.
7. **Existing sessions are refused, not revoked.** A suspension is reversible with nobody re-signing in.
8. **The provider/external-send control remains global across tenants** — R5 debt, untouched. Per-tenant
   dispatch is nonetheless blocked while suspended, because execution resolves a `TenantContext` first.
9. **Canonical tenants were never suspended.** Every transition in this phase ran on disposable databases.

## 14. Correction to the R4A closure

R4A's §18 said `tenant_status` "is enforced at session issuance and still has no writer". The first
half understated it — enforcement is at **four** gates including the per-request resolver, which is
what makes suspension immediate — and the second half is what this phase closed. That text was true
when recorded and is left as written; this record supersedes it.

## 15. Next gate

**R4C — file ingestion** (upload and parse into the already-connected chunker; the `documents` table
still has zero consumers), then reopening **R2F — provider operations depth** (usage aggregation and
a budget cap at the dispatch seam, deferred since before H1 and unblocked). R3B's three gates —
Resend configuration, arming, first send ceremony — remain open and untouched. R5 owns deletion,
retention, RLS, the vault, and the per-tenant provider control.
