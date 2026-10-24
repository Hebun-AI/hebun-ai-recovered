# TENANT-ACTIVATION-1 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope of the acceptance, stated first.** This record is accepted against production *deployment
reality* and one signed-in, read-only view of an organization whose genesis is already accepted
(Mulify): the deployed commit, its production deployment and aliases, and Mulify's render of
`/governance/genesis`, `/governance/authority` and `/director/organization`. **The new pending-review
state was not observed on a real pending production tenant**, and **the operator `--pending` listing
was not run against production**. Both are proven only by local tests. §16.1 keeps the state one of six
and puts the qualifier in the evidence text; nothing below widens it.

## 1 · Problem

A self-service organization is created at sign-up with an owner membership and no Governance. Its
first Governance holder must be nominated by an operator ceremony (key 1) before the owner can accept
(key 2), establish Governance and decide AI assistance in the app. Two frictions sat around that one
operator step:

- the customer saw "This tenant has no genesis nomination. One is created out-of-band by a local
  operator ceremony", which names no next step and no reason for the wait;
- the operator had no way to find organizations waiting for review except hand-written SQL against
  production.

The design gate (TENANT-ACTIVATION-UX-1, 2026-10-23) confirmed that genesis nomination is the only
operator step between sign-up and a first useful Heby answer, that no in-product platform operator
identity exists, and that removing the terminal step would need a new authority. The Director chose the
interim slice: keep the two-key genesis and its terminal root, remove the surrounding friction.

## 2 · What was released

| Commit | Content |
|---|---|
| `4ffff37e` | `feat(onboarding): improve tenant activation visibility and operator discovery`. 12 files, +655 / −13: `governance-genesis/contracts.ts` (`isAwaitingPlatformReview`, frozen `GENESIS_ACTIVATION_STEPS`), `genesis-acceptance.server.ts` (`readGenesisActivationOrigin`, one tenant-scoped column), the genesis `page.tsx` and `genesis-acceptance-card.tsx` (`awaiting-platform-review` block, no control), `organization-readiness.ts` and `read-organization-readiness.server.ts` (Governance row wording), `scripts/genesis-nominate.ts` and `scripts/lib/nominate-genesis-human.ts` (`--pending`), the r4a provisioning census, two new tests under `tests/tenant-activation-1/`, and one `learnings.md` line |

On `main`: fast-forward `fbd5660b → 4ffff37e` (GitHub `fbd5660b..4ffff37e -> main`), remote HEAD
re-read immediately before the push and its parent proven to be the release commit's parent.

**Derived, never stored.** A tenant is "awaiting platform review" exactly when
`companies.provisioning_source = 'self-service-signup'` and its genesis nomination read returns no row.
Both reads must succeed; an unreadable half keeps the released wording. No activation table, status or
request row exists.

**Customer.** The genesis page shows "Awaiting platform review", the four remaining steps in order and
who takes each, and that Hebun sends no notification. Organization Readiness words the Governance row
the same way and keeps the actor `platform-operator`. Neither offers a control.

**Operator.** `npm run governance:nominate-genesis -- --pending` goes through the same posture and
target preflight as a nomination, runs one query inside `begin transaction read only` that is always
rolled back, lists slug, name, creation time and eligible member emails (eligibility identical to
`resolveNominationTarget`), nominates nobody and prompts for nothing. Its output warns that sign-up does
not verify email ownership. Nothing under `src/` can reach the listing.

**Unchanged:** schema and migrations, the genesis nomination writer and its CHECK vocabulary, genesis
acceptance, Governance establishment, EAI writer and readers, R2E, Heby, environment, credentials. No
authority, persistence or execution path was added; no automatic nomination exists.

## 3 · Verification (V3)

V3: the change touches Governance genesis surfaces and a production-capable operator ceremony, and an
unexpected provisioning-census failure showed that source-scanning suites pin these files, so the full
suite was justified before it ran.

| Item | Measured |
|---|---|
| Baseline before change (worktree at `fbd5660b`) | 15 focused files PASS: g2-1 (firewall, genesis, concurrency), g4 (firewall, production ceremony), OR-1, OR-2 (both), ap4a, EAI-1A, prodmig, provenance-vocabulary, r4a provisioning, self-service signup (both) |
| New tests | `tests/tenant-activation-1/boundaries.ts` PASS; `tests/tenant-activation-1/activation-postgres.ts` PASS — self-service vs seeded vs operator-born origin, fail-closed reads, listing exact (suspended, seeded, operator-born and nominated tenants absent), listing fingerprint of nine tables unchanged and transaction closed, nomination ends the wait for its own tenant only, readiness wording per session tenant |
| Census, extended with a reason | `tests/r4a-flow/provisioning-boundary.ts` names the genesis read as a vocabulary-only reader and asserts it cannot reach the provisioning authority |
| Bite-proofs (scratch copies) | 4/4 caught: listing not read-only, origin ignored, origin not tenant-scoped, nominated tenants listed |
| CLI smoke (session-owned database) | listing printed one self-service tenant, 0 nomination rows after; extra argument, malformed production signal, production posture against loopback and `NODE_ENV=production` all refused |
| Full suite (once, copy of the change) | 1031 PASS / 47 FAIL / 1078. All 47 re-run in git worktrees of the change and of `fbd5660b`: 42 PASS in both (copy outside the repository); 4 PRE-EXISTING with identical first assertion (`heby-product-ux-1/production-ux-fixes.ts`, `hlr-human-legibility/bite-proofs.ts`, `hlr-human-legibility/legibility-postgres.ts`, `work2-provider-disclosure/bite-proofs.ts`); 1 BLOCKED (`r3w-flow/ambient-database-safety.ts`, canonical `hebun_r1` unreachable — OR2-R3W-AMBIENT-DB-BLOCKED-1), not counted as a pass. 0 REGRESSION |
| Release candidate at `4ffff37e` | `tsc --noEmit` exit 0; `eslint` on changed files exit 0; `git diff --check` clean; `npm run build` exit 0; committed diff byte-identical to the validated patch (sha1 of `git diff fbd5660b` `2f6651f8`) |

## 4 · Production release and acceptance

| Gate | Time | Measured |
|---|---|---|
| Release | 2026-10-24 ~09:06Z | `origin/main` = `4ffff37e995f94e00b4fe02f5550692c09549e39`, parent `fbd5660b` (`git ls-remote`, re-read after push) |
| Deploy | created 2026-10-24 09:07:08Z | `dpl_8Q3aoPjF5KAdsSGQkFXq9vNVJbzM`, target production, Ready, build 35 s (`vercel inspect`); GitHub commit status for `4ffff37e`: `Vercel success` pointing at the same deployment; served `/login` HTML carries the `dpl_8Q3aoPjF…` marker |
| Aliases | 2026-10-24 | `www.hebuntech.com`, `hebuntech.com` on `dpl_8Q3a…` (`vercel inspect`); apex 308 → www |
| Runtime logs | release to ~09:20Z | `vercel logs --level error`: on `dpl_8Q3a…` only the known pg sslmode deprecation warning at sign-in; the one other record is the same warning on the previous deployment. No error, fatal or 5xx observed (sampled) |
| Signed-in read-only view | 2026-10-24 | Built-in browser, a Mulify session the Director signed in themselves (no credential entered by this session). Page reloaded so skew protection could not pin the old deployment; the reloaded HTML carried the `dpl_8Q3a…` marker |
| Director scoped acceptance | 2026-10-24 | PRODUCTION-ACCEPTED — scoped, on exactly the evidence in this record |

**What the signed-in view showed (read from page text).**

- *Tenant:* `/director/organization` shows organization "Mulify", slug `mulify`.
- *Genesis:* `/governance/genesis` renders "This tenant's genesis nomination has been accepted.
  Acceptance happens once." and the operator-root limitation. "Awaiting platform review" is absent.
- *Governance:* `/governance/authority` shows Governance established 2026-10-23 12:04:21 UTC, decision
  `bf16f398-13d4-4a95-87b7-2e1f6698fcf9`, "Governance authority exists for this tenant, and it resides
  in you."
- *AI assistance:* "Decision: Authorized (revision 1)", processor review revision 1, models
  `claude-haiku-4-5-20251001`, "attested by the platform operator, not independently verified".
- *Organization readiness:* five rows; Governance Ready ("Established. You hold it."), AI processing
  Ready ("Authorized for: assistance. The platform model is available."), Connected providers Ready,
  Executing approved sends and posts Not ready, Work domains Not ready. No pending-review wording.
- Browser console: no error messages on either Governance page. Nothing was clicked or submitted.

Governance and AI authorization **pre-date this release** and are unchanged by it; this session wrote
nothing to production.

**Evidence provenance, kept apart.**

| Evidence | Source | Measured by this session |
|---|---|---|
| Remote SHA, deployment, aliases, commit status, served marker, logs | git, Vercel CLI, GitHub API, HTTP; read-only | Yes |
| Signed-in render, console | Built-in browser in a Director-opened Mulify session; read-only | Yes |
| Local test results | Implementation worktree, git worktrees of change and baseline, scratch copies; session-owned PostgreSQL 18 | Yes |

## 5 · Not verified

- **Pending-review UI on a real pending production tenant.** No session of a self-service organization
  without a nomination was available and none was created; the positive path is proven only by local
  Postgres and boundary tests (TA1-PROD-PENDING-UI-1).
- **Production operator `--pending` execution.** Not run against production; its read-only behaviour
  and target verification are proven only locally (TA1-PROD-PENDING-CLI-1).
- **Mulify's origin.** `/director/organization` reports no recorded origin; the organization authority
  maps self-service provenance to "unrecorded", so whether Mulify was born through sign-up was not
  established. Either way an accepted nomination correctly suppresses the new wording.

**Recorded during the phase, not changed by it.**

- **Sign-up records unverified email as verified (SIGNUP-EMAIL-UNVERIFIED-1).**
  `create-account.server.ts` writes `verified_at = now` while no email ownership is proven, and
  `auth_identities_active_chk` makes that column mean "verified". A sign-up with someone else's address
  blocks the real owner's own sign-up (`email-already-registered`) and invitation
  (`already-enrolled`), and genesis can be nominated to an unproven address. No reader trusts
  `verified_at` today. Correction needs a mail runtime (new integration gate) and possibly a provenance
  column for existing rows (schema gate); not implemented here by Director instruction.
- **Revoked nomination read (GENESIS-REVOKED-READ-1).** `readGenesisNomination` returns a revoked row
  (`limit 1`, no status filter) while the ceremony treats revoked as a free slot. Harmless only because
  no released writer produces `revoked`; pinned in `activation-postgres.ts`.
- Remaining onboarding limits, unchanged: key 1 is still a terminal ceremony rooted in deployment
  possession; no notification; no self-service account recovery.

## Closure Contract (v1)

- Phase: TENANT-ACTIVATION-1
- Owner: apps/dashboard/src/features/governance-genesis (derived awaiting-platform-review state and its genesis surface) with organization-readiness wording and the scripts/genesis-nominate.ts --pending operator listing; the genesis nomination writer, genesis acceptance, Governance establishment, tenant provisioning, EXTERNAL-AI-DATA-USE and R2E unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 4ffff37e995f94e00b4fe02f5550692c09549e39 — released on `main` (fast-forward from fbd5660b)
- Verification level: V3 — Governance genesis surfaces and a production-capable operator ceremony; full suite justified before it ran after an unexpected census failure
- Verification evidence: on the change committed byte-identically as 4ffff37e, 2026-10-23, 15/15 baseline focused files PASS before change; tests/tenant-activation-1/boundaries.ts and activation-postgres.ts exit 0 PASS; bite-proofs 4/4 caught; tsc exit 0, eslint exit 0, git diff --check clean, npm run build exit 0; full suite 1031 PASS / 47 FAIL / 1078 with all 47 re-run in git worktrees of change and baseline — 42 PASS, 4 PRE-EXISTING (identical first assertion), 1 BLOCKED r3w-flow/ambient-database-safety.ts (not a pass), 0 REGRESSION
- Test environment: worktree `.claude/worktrees/tenant-activation-1` at fbd5660b then 4ffff37e; detached git worktrees of change and baseline and scratch copies for full suite and bite-proofs; macOS (Darwin 25.2.0); Node 24 with tsx; session-owned PostgreSQL 18.6 at 127.0.0.1:55439 (own initdb, system_identifier 7699872559348285105, UTF8, disposable databases dropped) via HEBUN_TEST_ADMIN_DATABASE_URL; no production database, no provider, no model
- Deployment evidence: dpl_8Q3aoPjF5KAdsSGQkFXq9vNVJbzM READY production, created 2026-10-24T09:07:08Z by the git integration, GitHub commit status for 4ffff37e names it, aliases www.hebuntech.com and hebuntech.com
- Production acceptance evidence: SCOPED — (a) measured read-only: remote main 4ffff37e, deployment Ready and aliased, served dpl marker on /login and on the reloaded signed-in page, apex 308, error-level logs show only the known pg sslmode warning (sampled); (b) signed-in read-only render as Mulify (slug mulify): /governance/genesis accepted state without pending-review wording, /governance/authority Governance established (decision bf16f398) and assistance Authorized revision 1, Organization readiness five rows without pending-review wording, no console errors, nothing submitted; (c) Director-authorized scoped acceptance 2026-10-24. Pending-review UI on a real pending tenant and production --pending UNVERIFIED (section 5)
- Deferred risks: TA1-PROD-PENDING-UI-1 (DEFERRED); TA1-PROD-PENDING-CLI-1 (DEFERRED); SIGNUP-EMAIL-UNVERIFIED-1 (DEFERRED); GENESIS-REVOKED-READ-1 (DEFERRED)
- Director approvals: read-only design gate TENANT-ACTIVATION-UX-1 2026-10-23; implementation of the approved scope 2026-10-23; local commit 2026-10-24; fast-forward push of 4ffff37e with its automatic production deployment, read-only deployment verification and read-only Mulify acceptance 2026-10-24 (push executed by this session); PRODUCTION-ACCEPTED — scoped and this closure documentation with one local documentation-only commit 2026-10-24; push of this documentation NOT approved

### Deferred risk detail

- **TA1-PROD-PENDING-UI-1 (DEFERRED).** The awaiting-platform-review genesis block and readiness row
  were not observed in production. Acceptance dependency: a signed-in read-only render by the owner of
  an existing legitimate self-service organization that has no nomination.
- **TA1-PROD-PENDING-CLI-1 (DEFERRED).** `--pending` was not run against production. Acceptance
  dependency: a Director-authorized production operator ceremony run of the read-only listing.
- **SIGNUP-EMAIL-UNVERIFIED-1 (DEFERRED).** Self-service sign-up writes `verified_at` without proving
  email ownership (section 5). Acceptance dependency: a Director decision on email-ownership proof (mail
  runtime integration gate) and on the representation of existing self-service identities (schema
  gate).
- **GENESIS-REVOKED-READ-1 (DEFERRED).** The genesis read can return a revoked row while the slot is
  free. Acceptance dependency: must be resolved before any phase introduces a writer of `revoked`.

**Behaviour change, intended.** A self-service organization without a nomination now sees why it is
waiting and what follows; operators can list such organizations read-only. Organizations with a
nomination, and operator-born or seeded organizations, see the released wording.

**Weekly three.** *Learned:* a state two authoritative records already imply is derived at read time
and fails closed, and a provisioning census that counts "who mentions this module" must name a
vocabulary reader explicitly. *Turkish Rug House:* activating a new organization no longer starts with
an operator searching production by hand. *Hebun AI:* a self-service customer sees the path to Heby
honestly, and the one remaining operator step is a single read-only listing plus the existing
ceremony.
