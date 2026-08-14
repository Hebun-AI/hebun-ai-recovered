# HEBUN — FIRST DURABLE GOVERNANCE CEREMONY — EXECUTION RECORD

**Phase:** First durable Governance ceremony — pre-ceremony backup + GATE C0.1 (Genesis nomination)
**Date:** 2026-08-13
**Director authorization consumed:** (1) fresh pre-ceremony backup creation, (2) GATE C0.1 Genesis nomination
**Scope:** backup + C0.1 only. **No nomination acceptance, no Governance bootstrap, no member-role provisioning, no membership authorization, no invitation, no enrollment, no onboarding, no credential mutation, no tenant-selection or switching mutation, no migration, no seed, no restore, no orphan cleanup, no commit, no tag, no push.**
**Outcome:** C0.1, C0.2 and **C0.3 all COMPLETED BY THE DIRECTOR IN PERSON**, each verified read-only (§11, §15, §30). Acme now holds durable Governance authority. Three backups created and validated. C1 member-role provisioning audited and handed off — **not executed** (§33–§37).
**Verdict:** see the closing verdict after §37.

> **Revision notes.** This record accumulates in passes; earlier facts are never rewritten.
> - **Sections 1–10** — first pass: pre-ceremony backup created and validated, C0.1 stopped at the TTY consent boundary.
> - **Sections 11–13** — second pass: C0.1 completed by the Director and verified; C0.2 prepared.
> - **Sections 14–20** — third pass: C0.2 completed by the Director and verified; C0.3 audited and prepared.
> - **Sections 22–28** — fourth pass: PRE-C0.3 backup created and validated, pre-bootstrap baseline captured, Director handoff.
> - **Sections 29–37** — fifth pass: C0.3 completed by the Director and verified; Governance authority proven to exist; C1 audited and prepared.
> - **Sections 38–44** — sixth pass: PRE-C1 backup created and content-proven, pre-provisioning baseline captured, C1 handed off.
> - **Sections 45–51** — seventh pass: C1 completed by the Director and verified; C2 membership authorization audited from current source.
> - **Sections 52–59** — eighth pass: PRE-C2 backup created and content-proven, pre-authorization baseline captured, C2 handed off.
> - **Sections 60–68** — ninth pass: C2 completed by the Director and verified; C3 onboarding-capability issuance audited from current source.
> - **Sections 69–76** — tenth pass: PRE-C3 backup created and content-proven; **C3 BLOCKED** — no product surface can consume the capability.
>
> Each pass's verdict is superseded by the next and is retained in quoted form.

---

## 1. Baseline (STEP 0)

### 1.1 Repository

| Fact | Value |
| --- | --- |
| Root | `/Users/senolsevim/Developer/Hebun AI` |
| Branch | `main` |
| HEAD | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| `origin/main` (local ref) | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| **Real remote `refs/heads/main`** (`git ls-remote origin main`) | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| Ahead / behind | `0 / 0` |
| Staged changes | none |
| Migration SQL files | 24 |
| Migration journal entries | 24 |
| Dependency delta | none |

### 1.2 Working-tree classification — nothing discarded, nothing overwritten

| Path | Class | Disposition |
| --- | --- | --- |
| `apps/dashboard/next-env.d.ts` (modified) | Generated Next 16 dev churn (`./.next/types/…` → `./.next/dev/types/…`) | left as-is; **not** cleaned — cleaning generated churn is not authorized here |
| `docs/…/hebun-p3-durable-rollout-gate-a.md` (untracked) | Prior authorized rollout preflight | left untracked |
| `docs/…/hebun-p3-durable-rollout-execution.md` (untracked) | Prior authorized rollout execution report | left untracked |
| `docs/…/hebun-p3-first-durable-ceremony-gate-a.md` (untracked) | The Gate A preflight this ceremony derives from | left untracked |

This task adds a fifth untracked path: **this document**.

### 1.3 Durable database

DATABASE_URL resolved from `apps/dashboard/.env.local`. **No credential, hash, salt, session secret, bearer token, or connection password appears anywhere in this record.** Every verification query ran under `PGOPTIONS='-c default_transaction_read_only=on'`, proven live (`show default_transaction_read_only` → `on`).

| Fact | Value |
| --- | --- |
| Target | `hebun_r1 @ 127.0.0.1:55432` |
| Applied migrations | **24** |
| Server version | PostgreSQL 14.20 (Homebrew) |

All expected pre-ceremony counts held: `genesis_nominations` 0, `decision_records` 0, `governance_sessions` 0, `membership_authorizations` 0, `identity_enrollment_requests` 0, `invitations` 0, `type='member'` roles 0.

**No mismatch with the authorization prompt. No stop condition triggered at STEP 0.**

### 1.4 Acme / Alice — discovered from the database, never guessed

Resolved by querying the exact predicate set `resolveNominationTarget` uses. No UUID was hard-coded.

| Field | Value |
| --- | --- |
| Tenant id | `d2203db7-6bfb-4074-8399-03c225a27110` |
| Tenant slug / name | `acme` / `Acme` |
| Tenant lifecycle / status | `active` / `active` |
| `authentication_disabled_at` | NULL |
| User id | `d3535a0d-caa1-43c1-ac35-820af0797f14` |
| User email | `alice@acme.test` |
| User lifecycle | `active` |
| Auth identity id | `88a813cb-fc68-43f5-bdcc-49214d54e485` |
| Identity status / lifecycle / revoked | `active` / `active` / NULL |
| Membership id | `3ae59ccd-6a84-436d-b16c-f0a2ced637e7` |
| Membership status / lifecycle / revoked | `active` / `active` / NULL |
| Current role | `9fc63bb2-8bc4-4829-a725-57ffc9ad62cb` — `Owner` / type `owner` |
| Credential | **existence only:** 1 active password credential, 1 revoked. No hash, salt, or password read. |

**Alice/Acme satisfies every eligibility predicate the canonical CLI enforces.**

---

## 2. Canonical Genesis mechanism (STEP 1)

Audited from the repository before any command was chosen.

| Property | Finding |
| --- | --- |
| **Authoritative entry point** | `npm run governance:nominate-genesis -- <tenant-slug> <identity-email>` → `node --import tsx scripts/genesis-nominate.ts` |
| **Owning subsystem** | operator tooling. Logic in `scripts/lib/nominate-genesis-human.ts`; guards + prompt in `scripts/genesis-nominate.ts` |
| **Exact arguments** | `argv[2]` = tenant slug, `argv[3]` = identity email; both lowercased and trimmed |
| **Interactive confirmation** | **REQUIRED.** `promptVisible` rejects outright when `process.stdin.isTTY` is false: *"this ceremony can only be confirmed interactively — run it in a terminal, never piped"*. The operator must then **retype the tenant slug**; any mismatch fails with *"the tenant slug did not match. Nothing was changed."* |
| **Tables written** | `genesis_nominations` — **one row, `status='pending'`, `nomination_source='local-operator-ceremony'`**. Nothing else. |
| **Audit effects** | **NONE.** No `audit_log` row. The submitter is an unauthenticated local operator and `audit_log.actor_type`/`actor_id` are both `NOT NULL`; inventing a system actor would place a claim in a tenant's ledger that no human made. The row's own `nominated_at` + `nomination_source` is the durable evidence. |
| **Transaction boundary** | a single `INSERT`. No multi-statement transaction is needed because exactly one row is written. |
| **Duplicate / idempotency** | `findExistingNomination` pre-reads and refuses on any non-revoked nomination; a race that slips past it is caught by `genesis_nominations_one_active_per_tenant_uq` and a 23505 is translated to `already-nominated`, not thrown. |
| **Eligibility checks** | active company (`lifecycle_status='active'`, `tenant_status` null-or-`active`, `authentication_disabled_at IS NULL`), active user, active non-revoked identity, **active non-revoked membership joining them** |
| **Tenant/user/membership requirement** | the nominee must **already belong** to the tenant — the CLI "does not create people, memberships, or tenants" |
| **`status` parameter** | **does not exist.** The function has no expressible way to write `accepted` or `revoked`. |

### 2.1 Why this is the intended entry point, not a convenience

- **No `src/` module imports it.** Verified: `grep -rn "nominate-genesis-human\|scripts/genesis-nominate" src/` returns nothing.
- **A test enforces that isolation.** `tests/g2-1-flow/boundaries-and-firewall.ts:94` asserts no file under the product tree imports `scripts/(lib/)?(nominate-genesis-human|genesis-nominate)`.
- It is a CLI **on purpose**: no authenticated user may nominate anybody, including themselves, so self-nomination has no representation in the product at all.
- **Root of trust, stated honestly by the script itself:** possession of the local deployment. Not a verified platform admin, not a certified operator, not a Governance authority. The row records which ROOT produced it, never who operated the terminal.

### 2.2 Database backstops (read from the catalog)

| Constraint | Definition |
| --- | --- |
| `genesis_nominations_one_active_per_tenant_uq` | `UNIQUE (tenant_id) WHERE status <> 'revoked'` — one root per tenant |
| `genesis_nominations_tenant_member_fk` | `FOREIGN KEY (tenant_id, nominated_user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE RESTRICT` — cross-tenant nomination is a constraint violation |
| `genesis_nominations_source_chk` | `nomination_source = 'local-operator-ceremony'` |
| `genesis_nominations_accepted_chk` | `accepted` requires `accepted_at` **and** `accepted_session_context_id` **and** `accepted_assurance_level` — so the CLI, which holds no session, is structurally incapable of writing `accepted` |
| `genesis_nominations_consumed_requires_accepted_chk` | consumption implies `accepted` |

### 2.3 What nomination does NOT authorize

Quoted from the script's own contract and confirmed against the source:

- it does **not** accept the nomination — only the nominated human can, in-product, under a verified session
- it does **not** create a Governance decision or governance session, and does **not** set `bootstrap` anywhere
- it does **not** mint a session, cookie, or credential
- it does **not** create or change a tenant, membership, role, or permission
- it does **not** touch Knowledge, providers, or execution
- it refuses `NODE_ENV=production` and any non-local `DATABASE_URL` (`assertLocalDatabaseUrl` allows only `127.0.0.1`, `localhost`, `::1`)
- there is deliberately **no** `HEBUN_GENESIS_HUMAN` environment variable — "a genesis human that config can name is a genesis human that a deployment mistake can name"

**No contradiction with the Gate A model was found. No manual SQL was used or considered.**

---

## 3. Fresh pre-ceremony backup (STEP 2) — AUTHORIZED, PERFORMED, VALIDATED

Created with `pg_dump -Fc`, client 14.20 against server 14.20 (exact version match).

| Property | Value |
| --- | --- |
| **Path** | `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_ceremony_c01_20260813_203954.dump` |
| **Size** | 279,056 bytes |
| **SHA-256** | `36172997454f482a1cf20c4160d58339f2d065d4319761fd2762003515e2cebb` |
| Format | CUSTOM, dump version 1.14-0 |
| Archive created | 2026-08-13 20:39:54 +03 |
| Source database | `hebun_r1` (recorded in the archive header) |
| Location | outside the repository ✔ |
| Timestamped filename | ✔ |

### 3.1 Validation

| Check | Result |
| --- | --- |
| File exists | ✔ |
| Non-zero size | ✔ 279,056 bytes |
| `pg_restore -l` succeeds | ✔ |
| TOC entries | 505 (501 numbered) |
| `TABLE DATA` entries | 50 |
| **Migration journal included** | ✔ `TABLE drizzle __drizzle_migrations` + `TABLE DATA drizzle __drizzle_migrations` + sequence + pkey |
| **Governance tables represented** | ✔ `audit_log`, `decision_records`, `governance_sessions`, `genesis_nominations` |
| **P3 tables represented** | ✔ `membership_authorizations`, `identity_enrollment_requests`, `invitations`, `roles`, `memberships` |
| Restored? | **NO.** `pg_restore -l` lists only; nothing was restored. |

### 3.2 The migration-20 backup was not overwritten

| Property | Value |
| --- | --- |
| Path | `~/Developer/hebun-backups/hebun_r1_pre_p3_rollout_20260813_195032.dump` |
| Size | 260,835 bytes (unchanged) |
| mtime | Aug 13 19:50 (unchanged) |
| SHA-256 | `543b4ee9f6ebbeeea231a11d0971cc10e901563a35cdcfe13560bcb5f865098f` |

Both backups now coexist. The older one remains the **migration-20 rollback point**; the new one is the **migration-24 pre-ceremony rollback point**. The TOC growth (476 → 505 entries, 48 → 50 table-data) is consistent with migrations 21–24 having added `membership_authorizations` and `identity_enrollment_requests`.

**No stop condition triggered at STEP 2.**

---

## 4. Final pre-nomination snapshot (STEP 3)

| Table | Count |
| --- | ---: |
| `genesis_nominations` | **0** |
| `decision_records` | **0** |
| `governance_sessions` | **0** |
| `audit_log` | 1 |
| `roles` | 2 |
| `roles` where `type='member'` | **0** |
| `memberships` | 2 |
| `invitations` | **0** |
| `membership_authorizations` | **0** |
| `identity_enrollment_requests` | **0** |
| `companies` | 2 |
| `users` | 2 |
| `auth_identities` | 2 |
| `auth_credentials` | 2 |
| `user_session_contexts` | 48 |
| applied migrations | 24 |

Targeted duplicate checks, scoped to the discovered Acme id:

| Check | Result |
| --- | ---: |
| Non-revoked genesis nomination for Acme | **0** |
| Genesis nominations anywhere | **0** |
| Bootstrap decision (`bootstrap = true`) for Acme | **0** |
| Governance session for Acme | **0** |

**No pre-existing nomination or bootstrap. No duplication risk. Clear to proceed to the C0.1 boundary.**

---

## 5. GATE C0.1 execution (STEP 4) — STOPPED AT THE CONSENT BOUNDARY

### 5.1 The exact command

```bash
npm run governance:nominate-genesis -- acme alice@acme.test
```

Run from `apps/dashboard/`, with `DATABASE_URL` exported from `.env.local`, and — as defence in depth — with `PGOPTIONS='-c default_transaction_read_only=on'`, so that even a misread of the code path could not have written.

### 5.2 What happened

The canonical CLI connected, resolved the target through its own query, printed the ceremony summary, and then **refused**:

```
  GENESIS NOMINATION — KEY 1 OF 2

  tenant    : Acme (acme)
  human     : alice@acme.test
  identity  : 88a813cb-fc68-43f5-bdcc-49214d54e485

  This nominates the human eligible to accept this tenant's genesis entitlement.
  It does NOT establish Governance authority. It does NOT create a Governance
  decision. It does NOT grant a role, a permission, or any execution authority.

  The nomination takes effect only when THAT human accepts it while signed in.

  ✖ this ceremony can only be confirmed interactively — run it in a terminal, never piped
```

Two things this proves:

1. **The canonical mechanism independently resolved the same Acme/Alice/identity triple** this record discovered by query — so the eligibility proof in §1.4 is confirmed by the tool that will perform the act, not only by a hand-written mirror of its predicates.
2. **The consent gate is what stopped it.** The `INSERT` in `nominateGenesisHuman` executes strictly *after* the slug-retype comparison, so the refusal occurred before any write was reachable.

### 5.3 Why execution could not be completed

The agent shell is non-interactive (`[ -t 0 ]` → false). `promptVisible` rejects non-TTY stdin by design. **This gate cannot be completed by an agent, and that is the intended architecture, not an obstacle to route around.**

**The consent was not faked, piped, simulated, or bypassed. No manual SQL `INSERT` was substituted.** A constitutional act should be impossible to perform by autocomplete — and equally impossible to perform by automation.

### 5.4 What the confirmation means

When the Director runs this command in a real terminal, the CLI will print the summary above and then ask:

```
  Retype the tenant slug to nominate (acme):
```

Typing `acme` and pressing Enter **is the consent**. It attests:

- the Director has read the summary and confirms the tenant and human are correct
- the Director accepts that the root of trust for this act is **possession of this local deployment** — Hebun cannot cryptographically identify who is at the terminal, and the row will record which root produced the nomination, never who operated it
- the Director understands this nominates **eligibility only** — it grants no authority (see §7)

Anything other than exactly `acme` aborts with *"the tenant slug did not match. Nothing was changed."*

---

## 6. Post-attempt verification (STEP 5)

Because C0.1 did not execute, the expected `0 → 1` transition **did not occur**. What was verified instead is that the attempt left the database bit-for-bit unchanged.

| Table | Pre | Post | Δ |
| --- | ---: | ---: | --- |
| `genesis_nominations` | 0 | **0** | none |
| `decision_records` | 0 | **0** | none |
| `governance_sessions` | 0 | **0** | none |
| `audit_log` | 1 | **1** | none |
| `roles` | 2 | **2** | none |
| `roles` type `member` | 0 | **0** | none |
| `memberships` | 2 | **2** | none |
| `invitations` | 0 | **0** | none |
| `membership_authorizations` | 0 | **0** | none |
| `identity_enrollment_requests` | 0 | **0** | none |
| `companies` | 2 | **2** | none |
| `users` | 2 | **2** | none |
| `auth_identities` | 2 | **2** | none |
| `auth_credentials` | 2 | **2** | none |
| `user_session_contexts` | 48 | **48** | none |
| applied migrations | 24 | **24** | none |

**Expected audit effect, per the repository contract:** none. Nomination writes no `audit_log` row even on success (§2). `audit_log` is still 1 — the pre-existing Globex `knowledge.create` row from K2, untouched.

**Unrelated records proven unchanged:**

- Alice's credential state: `active=1 revoked=1 failed_attempts=0 locked=0` — identical to the pre-state. No creation, rotation, revocation, or failed-attempt increment. No hash, salt, or password was read or printed.
- Alice's membership: still `3ae59ccd-…` / role `Owner` / `status=active`.
- Globex, Bob, Bob's identity: untouched.
- Knowledge, providers, executions, conversations, messages: untouched.
- `user_session_contexts` unchanged at 48 — **no session was minted**, because no sign-in occurred.

---

## 7. Authority truth (STEP 6)

**Nomination is not Governance authority — and in this ceremony not even a nomination exists yet.**

Proven read-only and from source, **without attempting any P3 mutation**:

| Assertion | Proof |
| --- | --- |
| No bootstrap decision exists | `select count(*) from decision_records where bootstrap = true` → **0** (and `decision_records` is empty entirely) |
| No Governance session exists | `governance_sessions` → **0** |
| `resolveGovernanceAuthority` still refuses Acme | Source: `decision-authority.server.ts:154-168` selects the tenant's `bootstrap = true` row and, finding none, returns `NO_AUTHORITY` — *"No genesis means no Governance in this tenant at all — a delegation could not exist either, because only an authority can grant one."* With `decision_records` empty, that branch is the only reachable one. |
| P3 administrative mutations remain unauthorized | `provisionMemberRole`, `authorizeMembership` and `decideIdentityEnrollment` each begin with `if (!authority.bootstrapDecisionId) return refused("no-governance-authority")`. No mutation was invoked to demonstrate this — the refusal is proven by the source and by the empty `decision_records` table it reads. |
| The CLI could not have changed this even on success | It never touches `governance_sessions` or `decision_records`, does not import their schema, and has no `bootstrap` parameter. `genesis_nominations_accepted_chk` additionally makes an `accepted` row unwritable without a session context the CLI does not hold. |

Even after a successful C0.1, `resolveGovernanceAuthority` would still refuse Acme. **Nomination confers eligibility to accept, nothing more.** Authority begins only at C0.3.

---

## 8. Repository and database safety (STEP 7)

| Assertion | Result |
| --- | --- |
| No migration ran | ✔ applied migrations still **24**; migration SQL files still 24 |
| No schema change | ✔ 0 invalid indexes, 0 `NOT VALID` constraints |
| No dependency change | ✔ `git status` on `package.json` / lockfiles is empty |
| No commit | ✔ HEAD still `9cc0c4d…` |
| No tag | ✔ tag count still **204** |
| No push | ✔ ahead/behind `0 / 0`; real remote main still `9cc0c4d…` |
| Known orphan test DBs untouched | ✔ `hebun_test_hebun_i1_membership_1c8a8356214345b5`, `hebun_test_i12_manual_be58770e`, `hebun_test_i12_probe_d073c537` — all still present, none dropped, none written |
| No new database created | ✔ server holds exactly `hebun_r1`, the three orphans above, and `postgres` |
| Dirty repository files not overwritten | ✔ `next-env.d.ts` still shows its single-line generated diff; all three prior untracked docs intact |
| Generated churn cleaned? | **NO** — not authorized, deliberately left alone |

---

## 9. Non-effects

Nothing in this task mutated: any company, user, identity, credential, membership, role, invitation, authorization, enrollment request, decision, governance session, audit row, or session context. No Knowledge, no permissions, no providers, no executions, no Computer Use, no mail delivery (Hebun has no mail runtime), no external integrations, no unrelated tenant.

The **only** durable artifacts created by this task are two files on disk, both outside the database: the new backup (§3) and this record.

---

## 10. Next required Director gate

**GATE C0.1 must be completed by the Director personally, in a real terminal.**

```bash
cd "/Users/senolsevim/Developer/Hebun AI/apps/dashboard" && npm run governance:nominate-genesis -- acme alice@acme.test
```

Then, at the prompt `Retype the tenant slug to nominate (acme):`, type `acme` and press Enter.

**Expected on success:**

```
  ✔ pending genesis nomination created for alice@acme.test
    nomination : <uuid>
    status     : pending
```

**Expected durable delta:** `genesis_nominations` 0 → 1 (`status='pending'`, tenant Acme, nominee Alice, source `local-operator-ceremony`). Everything else unchanged — `decision_records` still 0, `governance_sessions` still 0, `audit_log` still 1, `roles` still 2, `memberships` still 2.

**Stop condition:** any output other than the success block above; any change to a table other than `genesis_nominations`.

### After C0.1

**C0.1 does not authorize C0.2.** Once the nomination exists, the next gate — acceptance at `/governance/genesis` — requires two things this authorization does not grant:

1. a fresh Director authorization for GATE C0.2, and
2. the Director signing in as `alice@acme.test` at `http://localhost:4000/login`, entering the password personally. **That password is unknown to this record and was never sought, derived, read, or reset.** If it is lost, a credential rotation is a separate decision.

---

## 10. Verdict of the first pass (superseded — see §13)

> **GENESIS C0.1 STOPPED — HUMAN TTY CONFIRMATION REQUIRED**
>
> The pre-ceremony backup was created and fully validated. Baseline re-proved on every axis. Acme/Alice eligibility discovered from the database — no guessed UUIDs — and then independently confirmed by the canonical CLI itself, which resolved the same tenant, human and identity before refusing.
>
> C0.1 was not completed, and could not be, by an agent. `scripts/genesis-nominate.ts` rejects non-TTY stdin by design, and the `INSERT` sits strictly behind the slug-retype confirmation.
>
> *(As of the first pass: no durable mutation had been performed.)*

---

# PART TWO — C0.1 VERIFIED, C0.2 PREPARED

**Date:** 2026-08-13, second pass. Read-only throughout (`PGOPTIONS='-c default_transaction_read_only=on'`, guard proven live). The Director completed the canonical Genesis nomination ceremony manually in a terminal between the two passes.

---

## 11. C0.1 durable verification (READ-ONLY)

### 11.1 The nomination row — exactly one, exactly as intended

`genesis_nominations` moved **0 → 1**. Full row, read from `hebun_r1`:

| Column | Value |
| --- | --- |
| `id` | `0b7154c0-dc73-4a28-aaf4-ec31960b4685` |
| `tenant_id` | `d2203db7-6bfb-4074-8399-03c225a27110` (Acme, slug `acme`) ✔ matches §1.4 |
| `nominated_user_id` | `d3535a0d-caa1-43c1-ac35-820af0797f14` (`alice@acme.test`) ✔ matches §1.4 |
| `nominated_auth_identity_id` | `88a813cb-fc68-43f5-bdcc-49214d54e485` ✔ matches §1.4 |
| **`status`** | **`pending`** ✔ |
| `nomination_source` | `local-operator-ceremony` ✔ (the only value the CHECK permits) |
| `nominated_at` | `2026-08-13 20:45:46.653569+03` |
| `accepted_at` | NULL |
| `accepted_session_context_id` | NULL |
| `accepted_assurance_level` | NULL |
| `consumed_at` | NULL |
| `consumed_by_decision_id` | NULL |
| `revoked_at` / `revocation_reason` | NULL / NULL |
| `lifecycle_status` | `active` |
| `created_by` / `created_by_type` | NULL / NULL — correct: the operator CLI has no authenticated actor to name |
| `version` | 1 |

The Director's terminal report is confirmed on every point: tenant Acme, human `alice@acme.test`, status `pending`, no Governance decision, no authority.

### 11.2 Uniqueness

| Check | Result |
| --- | ---: |
| Total nominations in the database | **1** |
| Non-revoked nominations for Acme | **1** |
| Nominations with `status='pending'` | **1** |
| Nominations for any other tenant | **0** |

Exactly one pending nomination, on the intended Acme/Alice path, and nowhere else.

### 11.3 Required non-effects — all confirmed

| Assertion | Expected | Actual |
| --- | ---: | ---: |
| Applied migrations | 24 | **24** ✔ |
| `decision_records` | 0 | **0** ✔ |
| `governance_sessions` | 0 | **0** ✔ |
| `roles` where `type='member'` | 0 | **0** ✔ |
| `membership_authorizations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `invitations` | 0 | **0** ✔ |
| `audit_log` | 1 | **1** ✔ |
| `roles` | 2 | **2** ✔ |
| `memberships` | 2 | **2** ✔ |
| `companies` / `users` / `auth_identities` / `auth_credentials` | 2 / 2 / 2 / 2 | **2 / 2 / 2 / 2** ✔ |
| `user_session_contexts` | 48 | **48** ✔ — no session minted, nobody signed in |

**Alice's credential was not changed by C0.1:** `active=1 revoked=1 failed_attempts=0 locked=0`, `password_changed_at = 2026-08-11 17:21:32` — all identical to the pre-C0.1 reading. No creation, rotation, revocation, or counter movement. No hash, salt, or password was read, printed, recovered, or modified at any point.

**Audit effect matches the contract exactly:** `audit_log` still holds one row — the pre-existing Globex `knowledge.create` from K2, 2026-08-11. **Nomination writes no audit row**, by design (§2): the local operator is unauthenticated and `audit_log.actor_type`/`actor_id` are both `NOT NULL`.

**No unrelated mutation.** Every company, user, membership and identity still shows `version = 1` and `updated_at` at the original 2026-08-10 seed timestamps:

- Acme, Globex — `v1`, `updated_at 2026-08-10 10:29:12`
- Alice, Bob — `v1`, `updated_at 2026-08-10 10:29:12`
- Both memberships — `v1`, role `Owner/owner`, `status=active`
- Both auth identities — `v1`, `status=active`

Schema health: **0 invalid indexes, 0 `NOT VALID` constraints.**

### 11.4 The backup is a valid pre-C0.1 rollback point

Archive created **20:39:54**; nomination written **20:45:46**. The backup predates the mutation, so `hebun_r1_pre_ceremony_c01_20260813_203954.dump` (SHA-256 `36172997…`) restores to the state *before* the nomination existed. Both backups remain on disk, unmodified.

**No material difference from the expected result. No contradiction. No stop condition triggered.**

---

## 12. C0.2 acceptance path — audited from the current implementation

Read fresh from source; nothing below is carried over from an earlier report.

### 12.1 Surface

| Layer | File |
| --- | --- |
| Route | `app/(dashboard)/governance/genesis/page.tsx` → URL **`/governance/genesis`** |
| Server action | `app/(dashboard)/governance/genesis/actions.ts` → `acceptGenesisNominationAction()` |
| Component | `components/governance-genesis/genesis-acceptance-card.tsx` |
| Runtime | `features/governance-genesis/genesis-acceptance.server.ts:120` → `acceptGenesisNomination(tenant)` |

### 12.2 Authentication requirement

- `app/(dashboard)/layout.tsx` **redirects to `/login`** when the session does not resolve. Fails closed.
- The page and the action both call `resolveTenantContext()`, which returns a context **only** when `resolveRequestAuthentication` yields `authorized` — a live, non-revoked, non-expired, **tenant-bound** session. A pre-tenant receipt does not qualify.
- `acceptGenesisNomination` re-checks independently: `if (!tenant?.tenantId || !tenant.userId || !tenant.authIdentityId) return refused("unauthenticated")`.

### 12.3 Tenant / session requirement

The nomination is read by `eq(genesisNominations.tenantId, tenant.tenantId)` — tenant-scoped by predicate, so a session in another tenant cannot see or act on Acme's row. The session also supplies `sessionContextId` and `assuranceLevel`, both of which are **written into the row from the session, never claimed by the client**.

### 12.4 Nomination ownership requirement

**Both halves must match the session:**

```
row.nominatedAuthIdentityId !== tenant.authIdentityId ||
row.nominatedUserId        !== tenant.userId
   → refused("not-the-nominated-human")
```

Checking both is what makes a mismatched row (identity and user belonging to different people) unacceptable rather than exploitable — no session can satisfy both halves of it.

### 12.5 The action takes no arguments

`acceptGenesisNominationAction()` has **no parameters**. A forged `tenantId`, `userId`, `authIdentityId`, `membershipId`, `roleId`, `authorityRank`, `status`, `acceptedAt`, `bootstrap` or `decisionId` has nowhere to arrive. There is no nomination action anywhere a client can reach, so a signed-in human of any role band cannot nominate anybody, including themselves. Heby's server actions do not import this module.

### 12.6 Exact durable writes acceptance would perform

**Two writes, both inside one transaction:**

1. `UPDATE genesis_nominations` — `status` → `accepted`, `accepted_at` = now, `accepted_session_context_id` = the session's, `accepted_assurance_level` = the session's (**`aal1`** today), `updated_at`, `updated_by` = Alice, `updated_by_type` = `human`.
2. `INSERT audit_log` — one row: `action = 'governance.genesis-nomination.accepted'`, `entity_type` = genesis nomination, `entity_id` = `0b7154c0-…`, `actor_type = 'human'`, `actor_id` = Alice, `result = 'committed'`, `simulation = false`, `source = 'governance-genesis'`, `authority_source = 'membership'`, metadata carrying the nominated user, identity, nomination source, assurance level and `mfaVerified: false`.

**Nothing else.** The module never touches `governance_sessions` or `decision_records` and does not import their schema.

Expected deltas: `genesis_nominations` stays **1** (updated in place); `audit_log` **1 → 2**. Everything else unchanged.

### 12.7 Transaction boundary

`db.transaction(...)` wraps the UPDATE and the audit INSERT together. The audit writer receives the open transaction (`recordGenesisNominationWithin(tx, …)`), so "entitlement accepted but no history" and "history claims an acceptance that rolled back" are both excluded by the transaction rather than hoped against.

### 12.8 Audit effect

Exactly one row, as above. **Refusals are deliberately not audited** — a wrong human, a wrong tenant or a replay is an event about a principal, not a change to the tenant's entitlement; recording it would let an unauthorized caller append to a tenant's ledger at will.

### 12.9 Replay / idempotency

The pre-read informs the refusal wording; **the database predicate is the authority.** The UPDATE carries `status = 'pending'` in its `WHERE` clause alongside id, tenant, identity and user. A replay, a double-submit, or two concurrent acceptances all resolve in Postgres: exactly one UPDATE affects a row, every other affects zero — and a zero-row update writes **no audit row** and returns `already-accepted`. Safe to retry; impossible to double-accept.

### 12.10 Does acceptance create Governance authority?

**No.** It changes Genesis eligibility state only.

Proven three ways:

1. The module writes only `genesis_nominations` and `audit_log`. `decision_records` and `governance_sessions` are never touched and their schemas are not imported.
2. `resolveGovernanceAuthority` (`decision-authority.server.ts:154-168`) resolves authority **solely** from a `decision_records` row with `bootstrap = true`. `decision_records` is empty and acceptance does not write to it — so immediately after C0.2, Acme still has **no** Governance authority.
3. The product surface says so in its own contract values, rendered on the page: acceptance *"records that you are the human eligible to establish this tenant's first Governance authority"*, and the success notice reads *"No Governance decision exists yet."*

### 12.11 What C0.2 explicitly does NOT authorize

From `GENESIS_ACCEPTANCE_NON_EFFECTS` — a frozen value the UI renders and a test asserts, so the wording cannot drift from the truth:

- does not create a Governance decision
- does not ratify Knowledge
- does not approve company policy
- does not grant execution authority
- does not enable Computer Use
- does not enable providers
- does not change your application role
- does not create permissions

Additionally: no membership, no role, no invitation, no credential, no P3 mutation of any kind.

**Assurance limitation, stated honestly by the code and shown on the page:** the ceremony is performed at `aal1` with `mfaVerified = false`. There is no MFA, SSO, passkey or step-up anywhere in the system. The Director explicitly accepted `aal1` for this development-stage bootstrap.

---

## 13. C0.2 — the exact human procedure (NOT EXECUTED)

The dev server is running: `next-server (v16.2.10)` on **port 4000** (port 3000 free).

| Step | Action |
| --- | --- |
| **1. Open** | `http://localhost:4000/login` |
| **2. Sign in as** | **`alice@acme.test`** — the nominated human, and the only human in `hebun_r1` who holds a credential. **The Director enters the password personally.** It was never requested, inspected, printed, recovered, rotated, or modified by this session. |
| **3. Expect after sign-in** | Redirect to **`/foundation`**. Alice holds exactly one active membership, so no workspace picker appears. |
| **4. Navigate to** | `http://localhost:4000/governance/genesis` |
| **5. Expect on the page** | A card titled **"Genesis Nomination"**, subtitle *"The pre-Governance root of trust for this tenant. Not Governance authority."*, the line *"You were nominated as the human eligible to establish this tenant's first Governance authority"*, and a single outline button: **"Review genesis nomination"**. No block notice should appear. |
| **6. Click** | **"Review genesis nomination"** — this only reveals the consequence panel. **It writes nothing.** |
| **7. Read** | The panel lists what accepting does, the eight things it does **not** do (§12.11), and the `aal1` assurance limitation. |
| **8. The acceptance action** | The primary button labelled exactly **"Accept Genesis Nomination"** (never Save, Continue, or Confirm). *"Not now"* dismisses without writing. |

**Durable consequence of clicking "Accept Genesis Nomination":** one transaction — the nomination row moves `pending` → `accepted` with `accepted_at`, `accepted_session_context_id` and `accepted_assurance_level = 'aal1'` recorded from the session, plus one `audit_log` row `governance.genesis-nomination.accepted`. `audit_log` goes 1 → 2. **No Governance decision, no governance session, no authority, no role, no membership.** After it, `resolveGovernanceAuthority` still refuses Acme.

**The acceptance button was not clicked by this session. C0.2 was not executed.**

**C0.2 does not authorize C0.3.** Establishing Governance authority — the act that actually creates the bootstrap decision — requires a fresh Director authorization.

---

## Verdict of the second pass (superseded — see §21)

> **C0.1 VERIFIED — C0.2 HUMAN ACCEPTANCE READY**

> `genesis_nominations` moved 0 → 1. Exactly one row, `status = pending`, on the intended Acme/Alice path. Every required non-effect held. The C0.2 path was audited and ready.
>
> *(As of the second pass: acceptance had not yet happened.)*

---

# PART THREE — C0.2 VERIFIED, C0.3 PREPARED

**Date:** 2026-08-13, third pass. Read-only with respect to durable product state (`PGOPTIONS='-c default_transaction_read_only=on'`, guard proven live). The Director completed the C0.2 acceptance in the browser between the second and third passes.

---

## 14. Baseline re-proved (STEP 0)

| Fact | Value |
| --- | --- |
| Root | `/Users/senolsevim/Developer/Hebun AI` |
| Branch | `main` |
| HEAD | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| `origin/main` (local ref) | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| **Real remote `refs/heads/main`** | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| Ahead / behind | `0 / 0` |
| Staged | none |
| Migration SQL / journal | 24 / 24 |
| `hebun_r1` applied migrations | **24** |
| Tags | 204 |
| `hebun-membership-role-tenant-integrity-complete` | resolves to `9cc0c4d…` locally; annotated object `79e8fa07…` present on the remote ✔ |

Working tree — five paths, all classified, none cleaned or discarded:

| Path | Class |
| --- | --- |
| `apps/dashboard/next-env.d.ts` (M) | generated Next 16 dev churn — **left alone** |
| `docs/…/hebun-p3-durable-rollout-gate-a.md` (??) | prior authorized rollout preflight |
| `docs/…/hebun-p3-durable-rollout-execution.md` (??) | prior authorized rollout execution report |
| `docs/…/hebun-p3-first-durable-ceremony-gate-a.md` (??) | ceremony Gate A preflight |
| `docs/…/hebun-first-durable-governance-ceremony-execution.md` (??) | **this record** |

Databases on the server: `hebun_r1`, `hebun_test_hebun_i1_membership_1c8a8356214345b5`, `hebun_test_i12_manual_be58770e`, `hebun_test_i12_probe_d073c537`, `postgres` — unchanged from the previous pass. No orphan created, dropped, or written.

---

## 15. C0.2 durable verification (STEP 1)

### 15.1 The nomination row after acceptance

| Column | Value |
| --- | --- |
| `id` | `0b7154c0-dc73-4a28-aaf4-ec31960b4685` (same row as C0.1) |
| `tenant_id` | `d2203db7-6bfb-4074-8399-03c225a27110` (`acme`) |
| `nominated_user_id` | `d3535a0d-caa1-43c1-ac35-820af0797f14` (`alice@acme.test`) |
| `nominated_auth_identity_id` | `88a813cb-fc68-43f5-bdcc-49214d54e485` |
| **`status`** | **`accepted`** ✔ |
| **`accepted_at`** | **`2026-08-13 20:53:51.911+03`** ✔ populated |
| **`accepted_session_context_id`** | **`e0b17a28-2468-477e-b317-eee271f56a3d`** ✔ populated |
| **`accepted_assurance_level`** | **`aal1`** ✔ |
| `consumed_at` | **NULL** ✔ |
| `consumed_by_decision_id` | **NULL** ✔ |
| `revoked_at` / `revocation_reason` | NULL / NULL ✔ |
| `nomination_source` | `local-operator-ceremony` (unchanged) |
| `nominated_at` / `created_at` | `2026-08-13 20:45:46.653569+03` (unchanged) |
| `updated_at` | `2026-08-13 20:53:51.911+03` |
| **`updated_by`** | **`d3535a0d-…` (Alice)** |
| **`updated_by_type`** | **`human`** |
| `version` | 1 |
| `lifecycle_status` | `active` |

### 15.2 Two requested fields do not exist — correction of record

The authorization asked to prove `accepted_by_user_id` and `accepted_auth_identity_id`. **Neither column exists in `genesis_nominations`.** The full column list is:

```
id, created_at, created_by, created_by_type, updated_at, updated_by, updated_by_type,
version, lifecycle_status, deleted_at, deleted_by, deleted_by_type,
tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
nominated_at, accepted_at, accepted_session_context_id, accepted_assurance_level,
revoked_at, revocation_reason, consumed_at, consumed_by_decision_id
```

The schema has no separate "accepted by" pair, and it does not need one. **The accepting human is provably Alice by three independent facts:**

1. `updated_by = d3535a0d-…` with `updated_by_type = 'human'` — written from `tenant.userId`, never from input.
2. The UPDATE's `WHERE` clause required `nominatedUserId = tenant.userId` **and** `nominatedAuthIdentityId = tenant.authIdentityId`. A row could not have transitioned unless the session was both.
3. `accepted_session_context_id = e0b17a28-…` resolves (§15.3) to a session owned by Alice, on identity `88a813cb-…`, in Acme.

The design is deliberate: the acceptor cannot be anyone other than the nominee, so a second pair of "who accepted" columns would be redundant state that could drift from the identity gate.

`version` remaining `1` is also consistent with the source contract — `acceptGenesisNomination`'s `.set()` clause writes `status`, `acceptedAt`, `acceptedSessionContextId`, `acceptedAssuranceLevel`, `updatedAt`, `updatedBy`, `updatedByType` and **does not increment `version`**.

### 15.3 The accepting session

| Field | Value |
| --- | --- |
| `id` | `e0b17a28-2468-477e-b317-eee271f56a3d` — exactly the id stored on the nomination |
| user | `alice@acme.test` |
| `auth_identity_id` | `88a813cb-fc68-43f5-bdcc-49214d54e485` — the nominated identity |
| `active_tenant_id` | `d2203db7-…` (`acme`) |
| `active_membership_id` | `3ae59ccd-…` — Alice's Acme membership |
| `assurance_level` / `mfa_verified` | `aal1` / `false` |
| `authenticated_at` | `2026-08-13 20:52:38.025+03` |
| `absolute_expires_at` | `2026-08-14 04:52:38.025+03` |
| `revoked_at` | NULL — session is **live** |

Sign-in at 20:52:38, acceptance at 20:53:51 — 73 seconds later, one session, one human.

### 15.4 Uniqueness / no duplicate acceptance

| Check | Result |
| --- | ---: |
| Total genesis nominations | **1** |
| Accepted, non-revoked, for Acme | **1** |
| Still `pending` | **0** |
| `audit_log` rows with `action='governance.genesis-nomination.accepted'` | **1** |

A replayed acceptance would have matched zero rows on the `status = 'pending'` predicate and written no audit row. Exactly one audit row exists, so exactly one acceptance committed.

### 15.5 The new audit row

`audit_log` moved **1 → 2**. Exactly the delta the canonical acceptance path specifies (one row, inside the same transaction as the status transition).

| Column | Value |
| --- | --- |
| `id` | `735e5fe5-9040-4775-b475-00d20755131c` |
| `tenant_id` | `d2203db7-…` (Acme) ✔ correct tenant |
| `actor_type` / `actor_id` | `human` / `d3535a0d-…` (Alice) ✔ correct actor |
| `action` | `governance.genesis-nomination.accepted` ✔ |
| `entity_type` / `entity_id` | `genesis_nomination` / `0b7154c0-…` ✔ points at the nomination |
| `result` | `committed` |
| `simulation` | `false` |
| `source` | `governance-genesis` |
| `authority_source` | `membership` |
| `session_context_id` | `e0b17a28-…` ✔ same session as the row |
| `occurred_at` | `2026-08-13 20:53:51.911+03` — **identical to `accepted_at`**, one `now` in one transaction |
| `recorded_at` | `2026-08-13 20:53:51.914299+03` |
| `metadata` | `{"mfaVerified": false, "assuranceLevel": "aal1", "nominatedUserId": "d3535a0d-…", "nominationSource": "local-operator-ceremony", "nominatedAuthIdentityId": "88a813cb-…"}` |

The pre-existing K2 row (`knowledge.create`, Globex, Bob, 2026-08-11) is untouched.

### 15.6 Required non-effects — all confirmed

| Assertion | Expected | Actual |
| --- | ---: | ---: |
| Applied migrations | 24 | **24** ✔ |
| `decision_records` | 0 | **0** ✔ |
| `governance_sessions` | 0 | **0** ✔ |
| `roles` where `type='member'` | 0 | **0** ✔ |
| `membership_authorizations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `invitations` | 0 | **0** ✔ |
| `roles` / `memberships` | 2 / 2 | **2 / 2** ✔ |
| `companies` / `users` / `auth_identities` / `auth_credentials` | 2 / 2 / 2 / 2 | **2 / 2 / 2 / 2** ✔ |
| `permissions` / `role_permissions` | 0 / 0 | **0 / 0** ✔ |
| `audit_log` | 1 → 2 | **2** ✔ exactly +1 |
| `user_session_contexts` | 48 → 49 | **49** — the sign-in session; expected provenance, not a business mutation |

**No membership, identity, user or tenant mutation.** All still `version = 1` with their original 2026-08-10 seed `updated_at`. Both `auth_identities` still show `last_authenticated_at = NULL`.

**Alice's credential — counters and lock state unchanged:** `active=1 revoked=1 failed_attempts=0 locked=0 version=1`, `password_changed_at = 2026-08-11 17:21:32` (unchanged). The single field that moved is `last_verified_at = 2026-08-13 20:52:38`, written by the **login path** recording a successful verification — not by the acceptance ceremony, and not a change to any secret. No hash, salt, or plaintext was read at any point.

Schema health: **0 invalid indexes, 0 `NOT VALID` constraints.**

**C0.2 verified. No material difference from the design. No contradiction.**

---

## 16. C0.3 path re-audited from current source (STEP 2)

Re-read from the repository as it stands; nothing carried over.

### 16.1 End-to-end trace

```
/governance/authority                                   (route)
  app/(dashboard)/governance/authority/page.tsx         server component, resolves block reason
  components/governance-authority/governance-authority-card.tsx   the control
    → establishGovernanceAuthorityAction({ justification })       server action
        app/(dashboard)/governance/authority/actions.ts:84
      → resolveTenantContext()                          server-side session resolution
      → establishGovernanceAuthority(tenant, { justification })
          features/governance-decision/bootstrap-authority.server.ts:164
        → db.transaction(...)                           ONE transaction
            insert governance_sessions
            insert decision_records   (bootstrap = true)
            update genesis_nominations (predicated consumption)
            recordGovernanceEventWithin(tx, ...)  → insert audit_log
```

### 16.2 Requirements

| Requirement | How it is enforced |
| --- | --- |
| **Route** | `/governance/authority` |
| **Human action** | reveal button **"Review what this establishes"**, then a mandatory justification textarea, then **"Establish Governance Authority"** |
| **Session state** | `(dashboard)/layout.tsx` redirects to `/login` when unresolved; `resolveTenantContext()` returns a context only on an `authorized` (live, non-revoked, non-expired, tenant-bound) session; the service re-checks `tenantId && userId && authIdentityId` |
| **Tenant context** | the nomination and the existing-bootstrap probe are both read `where tenantId = tenant.tenantId` |
| **Genesis nomination state** | must exist (`no-entitlement`), must be `accepted` (`pending` → `entitlement-not-accepted`, `revoked` → `entitlement-revoked`), must be unconsumed (`consumedAt !== null` → `entitlement-already-consumed`) |
| **Identity/user ownership** | **both** `nominatedAuthIdentityId === tenant.authIdentityId` **and** `nominatedUserId === tenant.userId`; checked **before** status, so a wrong human learns nothing about the entitlement's lifecycle |
| **Assurance level** | **not gated.** No minimum is enforced. The accepted level (`aal1`) is copied into the decision's `evidence` as `acceptanceAssuranceLevel`, so the record states honestly what it was performed at. |
| **Justification** | mandatory, human-authored, **24–2000 characters** (`JUSTIFICATION_LIMITS`); the button stays `disabled` below the minimum, and the server re-validates (`justification-required`) |
| **Client-supplied input** | **exactly one field: the justification.** Tenant, actor, identity, session, `bootstrap`, decision type, domain, subject, outcome, evidence and timestamps are all server-resolved or constant. |

### 16.3 Exact writes and expected row delta

Four statements, **one transaction**, in this order:

| # | Table | Operation | Delta |
| --- | --- | --- | --- |
| 1 | `governance_sessions` | INSERT — domain `authority-delegation`, decisionType `certify`, subjectType `tenant`, subjectId = the tenant, proposer `human`/Alice, `riskClass = 'critical'`, `governanceLifecycleStatus = 'recorded'`, **`authoritySourceActor*` left NULL** (the genesis stating there was no prior authority) | **0 → 1** |
| 2 | `decision_records` | INSERT — `sessionId` = row 1, decisionType `certify`, subjectType `tenant`, subjectId = the tenant, `actorType='human'`, `actorId` = Alice, **`bootstrap = true`**, outcome `authority-established`, the justification, and `evidence = { genesisNominationId, nominatedAuthIdentityId, entitlementAcceptedAt, acceptanceAssuranceLevel, nominationSource }` | **0 → 1** |
| 3 | `genesis_nominations` | UPDATE — `consumed_at = now`, `consumed_by_decision_id` = row 2, `updated_at/by/by_type`; predicated on `status='accepted' AND consumed_at IS NULL` | count stays **1**, row consumed |
| 4 | `audit_log` | INSERT — `governance.bootstrap.established`, outcome `committed`, `entityId` = the decision id, metadata `{ governanceSessionId, decisionType, subjectType, subjectId, bootstrap: true, genesisNominationId }` | **2 → 3** |

**Evidence carries identity references and standing only — never credential or bearer material.**

Everything else unchanged: `roles` 2, `memberships` 2, `invitations` 0, `membership_authorizations` 0, `identity_enrollment_requests` 0, `permissions` 0, `role_permissions` 0, migrations 24.

### 16.4 Transaction boundary

All four statements are inside a single `db.transaction`. If the audit insert fails, the session, the decision and the consumption all unwind — "Governance established but unaudited" is excluded by the transaction. If the consumption matches zero rows, the code throws `EntitlementRaceLost` **inside** the transaction, aborting the session and decision with it.

### 16.5 Resulting authority semantics

After commit, `resolveGovernanceAuthority(tenant)` finds the `bootstrap = true` row, sees `actorType === 'human' && actorId === tenant.userId`, and returns `authorized: true, via: 'bootstrap'`. Alice becomes Acme's Governance authority — **derivable from the decision row, not stored as a flag or a role.**

---

## 17. Authority boundary (STEP 3)

| Does C0.3 create… | Answer |
| --- | --- |
| one Governance decision | **YES** — exactly one, `bootstrap = true` |
| one Governance session | **YES** — exactly one |
| bootstrap=true authority | **YES** — this is the act that creates it |
| any role | **NO** — `roles` is not imported by this module |
| any permission | **NO** — `permissions` / `role_permissions` untouched |
| any membership authorization | **NO** |
| any invitation | **NO** |
| any identity enrollment | **NO** |
| any execution authority | **NO** |
| any Computer Use authority | **NO** |
| any provider authority | **NO** — the model kill-switch is not read or written |
| any Knowledge approval | **NO** |

Stated on the surface itself, from `BOOTSTRAP_NON_EFFECTS` (a frozen value the card renders and a test asserts, so the wording cannot drift):

- does not ratify any Knowledge
- does not grant administrative rights
- does not grant Knowledge write access
- does not enable providers or the model kill-switch
- does not grant execution, Computer Use, or terminal authority
- does not change your application role
- does not create permissions
- does not delegate authority to anyone else

And `BOOTSTRAP_EFFECT`, the one thing it does: *"records that Governance authority for this tenant now exists, and that it resides in you."*

### The four-level distinction

| Level | State | Held today by |
| --- | --- | --- |
| **Accepted genesis eligibility** | `genesis_nominations.status='accepted'`, unconsumed | **Alice, now** (C0.2) |
| **Governance authority** | a `decision_records` row with `bootstrap=true` | **nobody** — created by C0.3 |
| **Role authority** | `roles` / `memberships.role_id` | Alice holds `Owner`, which grants **zero** Governance authority — `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions` and `role_permissions` are consulted for nothing by `resolveGovernanceAuthority` |
| **Execution authority** | providers, executions, Computer Use | **nobody**; unaffected by any gate in this ceremony |

Eligibility ≠ Governance authority ≠ role authority ≠ execution authority. C0.2 moved only the first. C0.3 creates only the second.

---

## 18. Failure and replay analysis (STEP 4)

| Scenario | Result | Enforced by |
| --- | --- | --- |
| Unauthenticated caller | layout redirects to `/login`; the service returns `unauthenticated` | **runtime** (layout + `resolveTenantContext` + null-check) |
| Wrong tenant | the nomination read is `where tenantId = tenant.tenantId`, so another tenant's row is invisible → `no-entitlement` | **runtime** (tenant-scoped predicate) |
| Wrong user | `nominatedUserId !== tenant.userId` → `not-the-entitled-human` | **runtime**, and repeated in the UPDATE predicate |
| Wrong auth identity | `nominatedAuthIdentityId !== tenant.authIdentityId` → `not-the-entitled-human` | **runtime** — checked before status, so lifecycle is not leaked |
| Nomination still pending | `entitlement-not-accepted` | **runtime**; the page also blocks the card with `entitlement-not-accepted` |
| Nomination revoked | `entitlement-revoked` | **runtime** |
| Already bootstrapped | pre-read → `already-bootstrapped`, **and an audit row is written** (`recordAuthorizedRefusal`) | **runtime** pre-read **+ PostgreSQL** `decision_records_one_bootstrap_per_tenant_uq` (`UNIQUE (tenant_id) WHERE bootstrap`) catching a 23505 |
| Entitlement already consumed | `entitlement-already-consumed`, **audited** | **runtime** + the `isNull(consumedAt)` UPDATE predicate |
| Stale / revoked / expired session | `resolveRequestAuthentication` does not return `authorized`, so `resolveTenantContext` returns null → `unauthenticated` | **runtime** (session service) |
| Duplicate click | the button is `disabled` while `pending`; a second request hits the pre-read or the unique index and returns `already-bootstrapped` | **runtime** + **PostgreSQL** |
| Concurrent bootstrap attempts | both pass the pre-read; one consumes the entitlement, the other's UPDATE matches zero rows → `EntitlementRaceLost` thrown inside the transaction → full abort → `already-bootstrapped`. Independently, the unique index refuses the second decision with 23505, which lands in the same refusal. | **PostgreSQL is the final defense** — the application predicate and the index both arrive at one governed refusal |
| Non-human actor | impossible via this path (`actorType` is the constant `'human'`), and `decision_records_bootstrap_human_chk` (`bootstrap = false OR actor_type = 'human'`) refuses it at the database anyway | **PostgreSQL backstop** |

**Refusal-audit boundary — different from C0.2.** Genesis acceptance never audits refusals. Bootstrap audits **exactly two**: `already-bootstrapped` and `entitlement-already-consumed` — both cases where an *authorized, entitled* human was refused by a governed rule. Those go through `recordGovernanceRefusal`, which writes **outside any transaction** (a refusal has no transaction to join) with `outcome = 'rejected'`. Unauthenticated and unauthorized attempts are still never recorded, so a stranger cannot append to a tenant's ledger.

**Note for verification after C0.3:** if the Director's first attempt is refused for one of those two reasons, `audit_log` will grow by a `rejected` row without any decision existing. That is correct behaviour, not a partial bootstrap.

---

## 19. Backup fitness (STEP 5)

| Property | Value |
| --- | --- |
| Path | `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_ceremony_c01_20260813_203954.dump` |
| Present | ✔ |
| Size | 279,056 bytes (unchanged) |
| SHA-256 | `36172997454f482a1cf20c4160d58339f2d065d4319761fd2762003515e2cebb` (unchanged) |
| Readable | ✔ `pg_restore -l` parses cleanly, 505 TOC entries |
| Archive created | 2026-08-13 20:39:54 |

### What this backup actually is

**It is a PRE-C0.1 snapshot.** It was taken at 20:39:54; the nomination was written at 20:45:46 and accepted at 20:53:51. **Restoring it would erase BOTH C0.1 and C0.2** — the nomination row would vanish entirely, along with the acceptance audit row. It is not a C0.3 rollback point.

The older `hebun_r1_pre_p3_rollout_20260813_195032.dump` (260,835 bytes, SHA-256 `543b4ee9…`) is older still — a **migration-20** snapshot. Restoring it would additionally undo migrations 21–24.

### Recommendation

**A fresh PRE-C0.3 backup is RECOMMENDED, as a separate Director authorization, before the bootstrap click.**

Reasons:

1. Neither existing dump can roll back C0.3 without also destroying C0.1 and C0.2 — a full day of ceremony would have to be re-run, including a nomination that cannot be re-created while non-revoked.
2. **C0.3 is a permanent one-way door.** `decision_records_one_bootstrap_per_tenant_uq` allows exactly one bootstrap per tenant, ever, and the entitlement is consumed in the same transaction. There is no revoke path for bootstrap authority anywhere in the repository.
3. This is the first Governance decision `hebun_r1` will ever hold. A snapshot taken immediately before it is the only way back to "accepted but not yet constitutional".

**Not created in this task.**

---

## 20. C0.3 human procedure — NOT EXECUTED (STEP 6)

Dev server running: `next-server (v16.2.10)` on **port 4000**.

| Step | Action |
| --- | --- |
| **1. Session** | Alice's session `e0b17a28-…` is **live until 2026-08-14 04:52:38**. If it is still valid, no new sign-in is needed. Otherwise sign in again at `http://localhost:4000/login` as **`alice@acme.test`** — password entered by the Director personally; never requested, read, or rotated by any session here. |
| **2. Open** | `http://localhost:4000/governance/authority` |
| **3. Expect** | A card titled **"Governance Authority"**, subtitle *"The tenant's constitutional authority. Established once, by a human."*, the line *"You hold this tenant's accepted genesis entitlement"*, and **no block notice**. Below it: no roster card, no member-role card, no membership-authorization card — those render only once Governance authority exists. |
| **4. Review action** | Click **"Review what this establishes"**. Reveals the consequence panel and the justification field. **Writes nothing.** |
| **5. Read** | The panel states `BOOTSTRAP_EFFECT` and the eight `BOOTSTRAP_NON_EFFECTS` (§17), plus the `aal1` assurance limitation. |
| **6. Justification** | Type a real reason into **"Why are you establishing Governance authority?"** — **minimum 24 characters**, maximum 2000. It is stored permanently on the decision record and shown back verbatim. The button stays disabled below 24 characters. |
| **7. Final action** | The primary button labelled exactly **"Establish Governance Authority"** (never Enable, Approve, or Confirm). *"Not now"* dismisses without writing. |

**Durable authority that click creates:** one `governance_sessions` row + one `decision_records` row with `bootstrap = true`, `actor_id` = Alice, outcome `authority-established` — after which `resolveGovernanceAuthority` returns `authorized: true, via: 'bootstrap'` for Alice in Acme. The entitlement is consumed in the same transaction, and one `audit_log` row `governance.bootstrap.established` is appended. Expected counts after: `governance_sessions` 1, `decision_records` 1, `audit_log` 3, nomination consumed, everything else unchanged.

**What it explicitly does NOT authorize:** no role, no permission, no membership authorization, no invitation, no enrollment, no execution, no Computer Use, no provider, no Knowledge approval — and no P3 mutation. It only makes the *next* gate (C1, member-role provisioning) reachable, which needs its own Director authorization.

**The button was not clicked by this session. C0.3 was not executed. C0.2 does not authorize C0.3.**

---

## Verdict of the third pass (superseded — see §28)

> **C0.2 VERIFIED — C0.3 GOVERNANCE BOOTSTRAP READY FOR DIRECTOR AUTHORIZATION**
>
> *(As of the third pass: no pre-C0.3 backup existed yet; the only available dump was the PRE-C0.1 one.)*

---

# PART FOUR — PRE-C0.3 BACKUP, PRE-BOOTSTRAP BASELINE, DIRECTOR HANDOFF

**Date:** 2026-08-13, fourth pass. Authorized: one new PRE-C0.3 backup, read-only verification, dev-server reuse, record append. **Not authorized and not performed: any bootstrap, Governance decision, Governance session, entitlement consumption, or any other durable mutation.**

---

## 22. Baseline re-proved (STEP 0)

| Fact | Value |
| --- | --- |
| Root | `/Users/senolsevim/Developer/Hebun AI` |
| Branch | `main` |
| HEAD | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| `origin/main` (local ref) | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| **Real remote `refs/heads/main`** | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| Ahead / behind | `0 / 0` |
| Staged | none |
| Tags | 204 |
| Migration SQL / journal | 24 / 24 |
| `hebun_r1` applied migrations | **24** |

Working tree — five paths, all classified, **nothing cleaned, discarded, reset, stashed, or overwritten**:

| Path | Class |
| --- | --- |
| `apps/dashboard/next-env.d.ts` (M) | generated Next 16 dev churn |
| `docs/…/hebun-p3-durable-rollout-gate-a.md` (??) | prior rollout preflight |
| `docs/…/hebun-p3-durable-rollout-execution.md` (??) | prior rollout execution report |
| `docs/…/hebun-p3-first-durable-ceremony-gate-a.md` (??) | ceremony Gate A preflight |
| `docs/…/hebun-first-durable-governance-ceremony-execution.md` (??) | **this record** |

### 22.1 C0 preconditions — every one held

| Precondition | Required | Actual |
| --- | --- | --- |
| Genesis nominations, total | 1 | **1** ✔ |
| Nomination id | `0b7154c0-dc73-4a28-aaf4-ec31960b4685` | **matches** ✔ |
| `status` | `accepted` | **`accepted`** ✔ |
| `consumed_at` | NULL | **NULL** ✔ |
| `consumed_by_decision_id` | NULL | **NULL** ✔ |
| `revoked_at` | NULL | **NULL** ✔ |
| Bootstrap decisions for Acme | 0 | **0** ✔ |
| `decision_records` | 0 | **0** ✔ |
| `governance_sessions` | 0 | **0** ✔ |
| `audit_log` | 2 | **2** ✔ (no unexplained event) |
| `roles` where `type='member'` | 0 | **0** ✔ |
| `membership_authorizations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `invitations` | 0 | **0** ✔ |

### 22.2 Eligibility re-proved

The nomination's tenant, nominee and identity were re-read from the database (only the id was asserted):

- tenant `d2203db7-…` (`acme`), nominee `alice@acme.test` (`d3535a0d-…`), identity `88a813cb-…`
- `accepted_at 2026-08-13 20:53:51.911+03`, `accepted_assurance_level aal1`, `accepted_session_context_id e0b17a28-…`

**Exactly one live session exists in the whole database** — `e0b17a28-2468-477e-b317-eee271f56a3d`: user `alice@acme.test`, identity `88a813cb-…`, tenant `acme`, `aal1`, not revoked, **absolute expiry `2026-08-14 04:52:38+03`**. Its user id and auth identity id both equal the nomination's, so the C0.3 ownership gate (`nominatedAuthIdentityId === tenant.authIdentityId && nominatedUserId === tenant.userId`) will pass for this session.

**No stop condition triggered.**

---

## 23. PRE-C0.3 backup (STEP 1) — AUTHORIZED, CREATED

Target proven before execution: `db=hebun_r1 host=127.0.0.1 port=55432`. Client and server both **PostgreSQL 14.20 (Homebrew)** — exact match. No credential printed.

| Property | Value |
| --- | --- |
| **Absolute path** | `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c03_bootstrap_20260813_215522.dump` |
| **Archive created** | **2026-08-13 21:55:22 +03** |
| **Byte size** | **279,706** |
| **SHA-256** | **`6b500c5ebcef348ad2a900a0f0f87ef98edddf0dd6621374330697c0c109e07e`** |
| Format | CUSTOM (`pg_dump -Fc`), dump version 1.14-0 |
| Source | `hebun_r1`, dumped from 14.20 by pg_dump 14.20 |
| Location | outside the repository ✔ |

The target path was checked for prior existence and would have refused rather than overwrite. Both older backups survive untouched, hashes re-verified:

| Backup | Size | SHA-256 |
| --- | ---: | --- |
| `hebun_r1_pre_p3_rollout_20260813_195032.dump` | 260,835 | `543b4ee9f6ebbeeea231a11d0971cc10e901563a35cdcfe13560bcb5f865098f` |
| `hebun_r1_pre_ceremony_c01_20260813_203954.dump` | 279,056 | `36172997454f482a1cf20c4160d58339f2d065d4319761fd2762003515e2cebb` |

---

## 24. Backup validation (STEP 2) — NOT RESTORED

`pg_restore -l` parses cleanly: **505 TOC entries (501 numbered), 50 `TABLE DATA` entries.**

Every required table is represented with its data section:

| Table | In dump |
| --- | --- |
| `drizzle.__drizzle_migrations` (journal) | ✔ TABLE + TABLE DATA + sequence + pkey |
| `genesis_nominations` | ✔ |
| `decision_records` | ✔ |
| `governance_sessions` | ✔ |
| `audit_log` | ✔ |
| `companies` | ✔ |
| `users` | ✔ |
| `auth_identities` | ✔ |
| `auth_credentials` | ✔ |
| `memberships` | ✔ |
| `roles` | ✔ |
| `user_session_contexts` | ✔ |
| `membership_authorizations` | ✔ |
| `identity_enrollment_requests` | ✔ |
| `invitations` | ✔ |

### 24.1 Content proof — read out of the archive to stdout, never into a database

`pg_restore --data-only -t <table> -f -` was used to print the archive's own COPY blocks. No `-d` flag was ever passed, so no connection to any database was possible.

| Table | Rows inside the dump |
| --- | ---: |
| `genesis_nominations` | **1** — `0b7154c0-…`, `created_at 20:45:46.653569` (**C0.1**), `updated_at 20:53:51.911` by `d3535a0d-…`/`human` (**C0.2**), tenant `d2203db7-…` |
| `decision_records` | **0** |
| `governance_sessions` | **0** |
| `audit_log` | **2** |

### 24.2 Timeline fitness

| Event | Time |
| --- | --- |
| C0.1 nomination written | 20:45:46 |
| C0.2 acceptance | 20:53:51 |
| **This backup created** | **21:55:22** |

The dump was created **61 minutes after C0.2 acceptance**.

> **This backup represents:**
> **C0.1 = present** (the nomination row exists)
> **C0.2 = present** (that row is `accepted`, updated by Alice)
> **C0.3 = absent** (`decision_records` and `governance_sessions` are both empty inside the archive)

It is therefore a true PRE-C0.3 recovery point: restoring it would undo a bootstrap **without** destroying C0.1 or C0.2. **It was not restored.**

---

## 25. PRE-C0.3 durable baseline (STEP 3)

Re-read after backup creation. **Backup creation caused zero database mutation** — every count is identical to §22.1, and the nomination's `updated_at` is still `2026-08-13 20:53:51.911+03`, unchanged since C0.2.

This is the comparison baseline for verifying C0.3 afterwards.

| Table / measure | PRE-C0.3 value |
| --- | ---: |
| applied migrations | **24** |
| `genesis_nominations` | **1** |
| — accepted **and** unconsumed | **1** |
| — `consumed_at` / `consumed_by_decision_id` | **NULL / NULL** |
| `decision_records` | **0** |
| — bootstrap decisions for Acme | **0** |
| `governance_sessions` | **0** |
| `audit_log` | **2** |
| `roles` | **2** |
| — `type='member'` | **0** |
| `memberships` | **2** |
| `membership_authorizations` | **0** |
| `identity_enrollment_requests` | **0** |
| `invitations` | **0** |
| `permissions` / `role_permissions` | **0 / 0** |
| `companies` / `users` / `auth_identities` / `auth_credentials` | **2 / 2 / 2 / 2** |
| `user_session_contexts` | **49** |
| Alice credential | `active=1 revoked=1 failed_attempts=0 locked=0 version=1`, `password_changed_at 2026-08-11 17:21:32` |
| Invalid indexes | **0** |
| Unvalidated constraints | **0** |

---

## 26. C0.3 execution contract re-proved (STEP 4)

Re-read from the current working tree (`HEAD 9cc0c4d`, no source file dirty).

```
/governance/authority                                                 (route)
  → establishGovernanceAuthorityAction({ justification })             actions.ts:84
  → resolveTenantContext()                                            server-side session
  → establishGovernanceAuthority(tenant, { justification })            bootstrap-authority.server.ts:164
  → db.transaction(...)                                               line 225 — ONE transaction
       insert governanceSessions                                      line 231
       insert decisionRecords   (bootstrap: true)                     line 252 / 261
       update genesisNominations (predicated consumption)             line 283
       recordGovernanceEventWithin(tx, ...)  → insert audit_log       line 307
```

### 26.1 Expected successful delta — confirmed unchanged

| # | Table | Before | After |
| --- | --- | ---: | --- |
| 1 | `governance_sessions` | 0 | **1** — domain `authority-delegation`, decisionType `certify`, subjectType `tenant`, `riskClass='critical'`, `governanceLifecycleStatus='recorded'`, `authoritySourceActor*` **NULL** (the genesis stating there was no prior authority) |
| 2 | `decision_records` | 0 | **1** — `bootstrap = true`, `outcome = 'authority-established'`, `actorType='human'`, `actorId` = Alice, `sessionId` = row 1, evidence `{ genesisNominationId, nominatedAuthIdentityId, entitlementAcceptedAt, acceptanceAssuranceLevel, nominationSource }` |
| 3 | `genesis_nominations` | accepted / unconsumed | **accepted / consumed** — `consumed_at` populated, `consumed_by_decision_id` = row 2's id. Count stays 1. |
| 4 | `audit_log` | 2 | **3** — `action = 'governance.bootstrap.established'`, outcome `committed`, `entityId` = the decision id |

### 26.2 Justification

- **the only client-controlled bootstrap input** — the action's single field; tenant, actor, identity, session, `bootstrap`, decision type, domain, subject, outcome, evidence and timestamps are all server-resolved or constant
- **minimum 24 characters, maximum 2000** (`JUSTIFICATION_LIMITS`), enforced twice: the button is `disabled` below the minimum, and `validateJustification` re-checks server-side (`justification-required`)
- **stored durably** on `decision_records.justification`, permanently, and shown back verbatim

### 26.3 Database backstops — re-read from the catalog

| Backstop | Definition | Protects |
| --- | --- | --- |
| `decision_records_one_bootstrap_per_tenant_uq` | `UNIQUE (tenant_id) WHERE bootstrap` | one genesis per tenant, forever |
| `decision_records_bootstrap_human_chk` | `CHECK (bootstrap = false OR actor_type = 'human')` | a genesis actor is always human |
| consumption predicate | `WHERE id = … AND tenant_id = … AND status = 'accepted' AND consumed_at IS NULL` | the entitlement can be spent exactly once |

**Concurrency / replay:** two simultaneous attempts both pass the pre-read; one consumes the entitlement, the other's UPDATE returns zero rows and throws `EntitlementRaceLost` **inside** the transaction, unwinding its session and decision. Independently, the unique index refuses the second decision with 23505. Both paths land on the same governed refusal, `already-bootstrapped`. The button is also `disabled` while `pending`, so a double-click cannot fire twice from one page.

**Refusal auditing:** `already-bootstrapped` and `entitlement-already-consumed` are recorded via `recordGovernanceRefusal` (outside any transaction, `outcome='rejected'`). A refused attempt can therefore grow `audit_log` **without** creating a decision — correct behaviour, not a partial bootstrap. Unauthenticated and unauthorized attempts are never recorded.

---

## 27. Authority boundary (STEP 5)

**Successful C0.3 WILL create:**

- Governance authority for Acme — derivable from the decision row, resolved as `authorized: true, via: 'bootstrap'` for Alice
- one bootstrap Governance decision (`bootstrap = true`)
- one Governance session
- a consumed Genesis entitlement
- one bootstrap audit record

**Successful C0.3 WILL NOT create:**

member role · permission · role permission · membership authorization · invitation · identity enrollment · new user · new membership · execution authority · Computer Use authority · provider authority · Knowledge approval

Rendered on the surface itself from `BOOTSTRAP_NON_EFFECTS`: does not ratify any Knowledge · does not grant administrative rights · does not grant Knowledge write access · does not enable providers or the model kill-switch · does not grant execution, Computer Use, or terminal authority · does not change your application role · does not create permissions · does not delegate authority to anyone else.

**Alice's `Owner` application role is not Governance authority and never has been.** `resolveGovernanceAuthority` consults `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions` and `role_permissions` for **nothing**. Before C0.3 Alice is an Owner with zero Governance authority; after C0.3 she is an Owner *and* the Governance authority, and the second fact comes only from the decision row.

---

## 28. Director handoff (STEP 6–7)

### 28.1 Server health

The existing dev server was reused — no process killed, no duplicate started, no configuration changed.

| Check | Result |
| --- | --- |
| `next-server (v16.2.10)` PID 5010 | LISTENING on port 4000 |
| `GET /login` (no cookie) | **HTTP 200** |
| `GET /governance/authority` (no cookie) | **HTTP 307 → `http://localhost:4000/login`** — the layout's fail-closed gate working |
| Database side effects of the probe | **none** — `decision_records` 0, `governance_sessions` 0, `audit_log` 2, sessions 49, all unchanged |

**Honest limit of that probe:** it carried no cookie and no credential, so it proves the route is live and correctly gated. It does **not** prove the bootstrap card renders — that requires Alice's authenticated session, which only the Director may use. The card's block resolution was instead proven from source (§16.2, §26): with an accepted, unconsumed nomination owned by the signed-in human and no existing bootstrap, the page's block chain yields `undefined`, so the card renders in its actionable state.

Alice's session `e0b17a28-…` is **still live until 2026-08-14 04:52:38+03** and was preserved untouched. If the Director's browser still holds it, no new sign-in is needed.

### 28.2 The procedure

1. **Open** `http://localhost:4000/governance/authority`
   *(If redirected to `/login`, the session lapsed: sign in as **`alice@acme.test`**. The Director enters the password personally — it has never been inspected, retrieved, logged, echoed, reset, rotated, or inferred by any pass of this ceremony.)*
2. **Review the Governance Authority card** — titled "Governance Authority", subtitle *"The tenant's constitutional authority. Established once, by a human."*, stating *"You hold this tenant's accepted genesis entitlement."* No block notice should appear.
3. **Click** `Review what this establishes` — reveals the consequence panel and the justification field. **Writes nothing.**
4. **Read the authority / non-authority boundary** — the one effect and the eight non-effects (§27), plus the `aal1` assurance limitation.
5. **In** `Why are you establishing Governance authority?` **enter a genuine justification of 24–2000 characters.** It becomes permanent Governance evidence on the decision record and is shown back verbatim. Write the real reason this tenant's Governance is being constituted now — no filler.
6. **Final action:** `Establish Governance Authority`

### 28.3 What that final click is

> **THIS FINAL CLICK IS C0.3.**
>
> It creates the tenant's first durable Governance authority and consumes the accepted Genesis entitlement, in one transaction. It is a permanent one-way door: `decision_records_one_bootstrap_per_tenant_uq` allows exactly one bootstrap per tenant forever, and there is no revoke path for bootstrap authority anywhere in the repository.
>
> **It is intentionally not performed by Claude.** No pass of this ceremony has entered the justification, submitted the form, clicked the button, or invoked the action through curl, devtools, tests, or scripts.

**C0.3 does not authorize C1.** Member-role provisioning requires a fresh Director authorization.

---

## Verdict of the fourth pass (superseded — see §36)

> **PRE-C0.3 BACKUP VERIFIED — C0.3 HUMAN BOOTSTRAP READY**

**Backup:** `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c03_bootstrap_20260813_215522.dump`
**SHA-256:** `6b500c5ebcef348ad2a900a0f0f87ef98edddf0dd6621374330697c0c109e07e`
**Size:** 279,706 bytes · created 2026-08-13 21:55:22 · C0.1 present, C0.2 present, C0.3 absent · not restored

**Nomination `0b7154c0-…` remains `accepted` and unconsumed** (`consumed_at` NULL, `consumed_by_decision_id` NULL). **Bootstrap decisions = 0. Governance sessions = 0.**

Expected post-click delta: `governance_sessions` 0 → 1 · `decision_records` 0 → 1 (`bootstrap = true`, outcome `authority-established`) · nomination accepted/unconsumed → accepted/consumed · `audit_log` 2 → 3 (`governance.bootstrap.established`). Nothing else changes.

**URL:** `http://localhost:4000/governance/authority`
**Final button:** `Establish Governance Authority`

*(As of the fourth pass: the bootstrap had not yet been performed.)*

---

# PART FIVE — C0.3 VERIFIED, C1 MEMBER ROLE PROVISIONING PREPARED

**Date:** 2026-08-13, fifth pass. Read-only with respect to durable state (`PGOPTIONS='-c default_transaction_read_only=on'`, guard proven live). The Director performed the C0.3 bootstrap in the browser between the fourth and fifth passes.

---

## 29. Baseline re-proved (STEP 0)

| Fact | Value |
| --- | --- |
| Root | `/Users/senolsevim/Developer/Hebun AI` |
| Branch | `main` |
| HEAD | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| `origin/main` (local ref) | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| **Real remote `refs/heads/main`** | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| Ahead / behind | `0 / 0` |
| Staged | none |
| Tags | 204 |
| Migration SQL / journal | 24 / 24 |
| `hebun_r1` applied migrations | **24** |
| Dev server | `next-server (v16.2.10)` PID 5010, LISTENING on port 4000 |

Working tree — five paths, all classified, nothing discarded: `apps/dashboard/next-env.d.ts` (generated Next 16 dev churn), and four untracked docs (two prior rollout documents, the ceremony Gate A preflight, and this record).

---

## 30. C0.3 durable verification (STEP 1)

### 30.1 The bootstrap decision

| Column | Value |
| --- | --- |
| `id` | **`ea49e5b8-3df7-4712-b6bb-104a1f1ccc08`** |
| `session_id` | `aec128ed-048f-45cc-aee7-07b41fa9ce56` |
| `tenant_id` | `d2203db7-…` (**Acme**) ✔ |
| `decision_type` | **`certify`** ✔ matches `BOOTSTRAP_DECISION_TYPE` |
| `subject_type` | **`tenant`** ✔ matches `BOOTSTRAP_SUBJECT_TYPE` |
| `subject_id` | `d2203db7-…` — the tenant itself ✔ |
| `actor_type` / `actor_id` | **`human`** / `d3535a0d-…` (**alice@acme.test**) ✔ |
| `authority_source_actor_type` / `_id` | **NULL / NULL** ✔ — the genesis stating there was no prior authority |
| **`bootstrap`** | **`true`** ✔ |
| `outcome` | **`authority-established`** ✔ matches `BOOTSTRAP_OUTCOME` |
| `decided_at` | `2026-08-13 22:48:48.654+03` |
| `decision_version` | 1 · `supersedes_decision_id` NULL · `version` 1 · `lifecycle_status` active |
| `created_by` / `created_by_type` | `d3535a0d-…` / `human` |
| `evidence` | `{"nominationSource":"local-operator-ceremony","genesisNominationId":"0b7154c0-…","entitlementAcceptedAt":"2026-08-13T17:53:51.911Z","nominatedAuthIdentityId":"88a813cb-…","acceptanceAssuranceLevel":"aal1"}` — identity references and standing only, **no credential or bearer material** |
| `justification` | **154 characters**, stored **exactly once**, verbatim: *"Establishing Acme's first Governance authority to create a durable human-controlled constitutional authority for future governed organizational decisions."* |

Within `JUSTIFICATION_LIMITS` (24–2000). Genuine content, not filler.

### 30.2 The Governance session

| Column | Value |
| --- | --- |
| `id` | `aec128ed-048f-45cc-aee7-07b41fa9ce56` — exactly the decision's `session_id` ✔ |
| `tenant` | `acme` |
| `governance_domain` | **`authority-delegation`** ✔ matches `BOOTSTRAP_GOVERNANCE_DOMAIN` |
| `decision_type` / `subject_type` / `subject_id` | `certify` / `tenant` / the tenant ✔ |
| `proposer_actor_type` / `_id` | `human` / Alice ✔ |
| `risk_class` | **`critical`** ✔ |
| `voting_mode` | **NULL** ✔ — no voting runtime exists, and claiming one would be a lie |
| `authority_source_actor_type` / `_id` | **NULL / NULL** ✔ |
| `governance_lifecycle_status` | `recorded` ✔ |
| `created_at` | `2026-08-13 22:48:48.657031+03` |

### 30.3 The consumed entitlement

| Column | Value |
| --- | --- |
| `id` | `0b7154c0-dc73-4a28-aaf4-ec31960b4685` — the same row from C0.1/C0.2 |
| `status` | `accepted` (unchanged — consumption is not a status) |
| `accepted_at` | `2026-08-13 20:53:51.911+03` (unchanged from C0.2) |
| **`consumed_at`** | **`2026-08-13 22:48:48.654+03`** ✔ |
| **`consumed_by_decision_id`** | **`ea49e5b8-…`** ✔ — **proven equal to the bootstrap decision id** |
| `updated_by` / `updated_by_type` | `d3535a0d-…` / `human` |
| `revoked_at` | NULL |

### 30.4 The audit row

`audit_log` **2 → 3**. Exactly one new row:

| Column | Value |
| --- | --- |
| `id` | `7088ab55-1c42-4e5c-871b-73b9114dca7c` |
| `tenant` | `acme` ✔ |
| `actor_type` / actor | `human` / `alice@acme.test` ✔ |
| **`action`** | **`governance.bootstrap.established`** ✔ |
| `entity_type` / `entity_id` | `governance_decision` / **`ea49e5b8-…`** ✔ points at the decision |
| `result` | `committed` |
| `source` | `governance-authority` |
| `authority_source` | `membership` |
| `session_context_id` | `aac13d67-e5fc-4e1d-92f4-051b3577c2c8` |
| `occurred_at` | `2026-08-13 22:48:48.654+03` — **identical to `decided_at` and `consumed_at`**: one `now`, one transaction |
| `metadata` | `{"bootstrap":true,"subjectId":"d2203db7-…","subjectType":"tenant","decisionType":"certify","genesisNominationId":"0b7154c0-…","governanceSessionId":"aec128ed-…"}` |

The acting session `aac13d67-…` resolves to `alice@acme.test`, identity `88a813cb-…`, tenant `acme`, membership `3ae59ccd-…`, `aal1`, authenticated `22:47:07`, still live. It is a **new** session — the C0.2 session `e0b17a28-…` had been used earlier; the Director signed in again (`user_session_contexts` 49 → 50). Expected provenance, not a business mutation.

### 30.5 No duplicates

| Check | Result |
| --- | ---: |
| Bootstrap decisions (whole database) | **1** |
| Bootstrap decisions for Acme | **1** |
| `governance_sessions` | **1** |
| `governance.bootstrap.established` audit rows | **1** |
| `audit_log` rows with `result = 'rejected'` | **0** — the bootstrap succeeded first try; no governed refusal was recorded |

### 30.6 Backstops still valid

| Backstop | State |
| --- | --- |
| `decision_records_one_bootstrap_per_tenant_uq` | `UNIQUE (tenant_id) WHERE bootstrap` — present, now holding exactly one row |
| `decision_records_bootstrap_human_chk` | `CHECK (bootstrap = false OR actor_type = 'human')` — present, **`convalidated = true`** |
| `roles_one_member_per_tenant_uq` | `UNIQUE (tenant_id) WHERE type = 'member'` — present, currently unoccupied |
| Invalid indexes | **0** |
| Unvalidated constraints | **0** |

**C0.3 verified. Every field matches the source contract. No contradiction.**

---

## 31. Governance authority now exists (STEP 2)

The resolver's own queries were replayed read-only against `hebun_r1` (`decision-authority.server.ts:154-198`):

| Resolver step | Query result |
| --- | --- |
| Q1 — bootstrap row for Acme (line 154-164) | `id=ea49e5b8-…`, `actor_type=human`, `actor_id=d3535a0d-…` — **found** |
| Q2 — `actorType === 'human' && actorId === tenant.userId` (line 175) | **true** for Alice |
| Q3 — active unrevoked delegations (`activeDelegationsSql`) | **0** |
| Q4 — Globex bootstrap rows | **0** |

> **`resolveGovernanceAuthority(Alice, Acme)` now returns `authorized: true, via: 'bootstrap'`, `bootstrapDecisionId = ea49e5b8-…`, `authorityActorId = d3535a0d-…`, `delegationDecisionId: null`.**

### 31.1 What grants it, and what does not

- **Governance authority exists because of the bootstrap decision row.** It is *derived*, not stored: there is no authority flag, no authority column, no authority role.
- **Alice's `owner` role is not what grants it.** Her membership still carries role `Owner` / type `owner`, `authority_rank` NULL — and `resolveGovernanceAuthority` reads `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions` and `role_permissions` for **nothing**. Before 22:48:48 she was an Owner with zero Governance authority; the only thing that changed is the decision row.
- **No delegation exists yet** — zero `delegate-authority` decisions.
- **No second Governance authority exists** — one bootstrap row in the entire database, and the partial unique index makes a second one impossible for Acme forever.
- **Globex is unaffected** and still has no Governance authority at all.

---

## 32. C0.3 non-effects (STEP 3)

| Did C0.3 create… | Count now | Verdict |
| --- | ---: | --- |
| member role | `roles` where `type='member'` = **0** | **NO** |
| permission | `permissions` = **0** | **NO** |
| role_permission | `role_permissions` = **0** | **NO** |
| membership authorization | `membership_authorizations` = **0** | **NO** |
| invitation | `invitations` = **0** | **NO** |
| enrollment | `identity_enrollment_requests` = **0** | **NO** |
| user | `users` = **2** | **NO** |
| auth identity | `auth_identities` = **2** | **NO** |
| credential | `auth_credentials` = **2** | **NO** |
| membership | `memberships` = **2** | **NO** |
| execution authority | `executions` = 0, unaffected | **NO** |
| Computer Use authority | not touched | **NO** |
| provider authority | kill-switch not read or written | **NO** |
| Knowledge approval | Knowledge untouched | **NO** |

Every unrelated row is byte-stable — still `version = 1` at its original 2026-08-10 seed `updated_at`:

- tenants `acme` / `globex` — v1, `10:29:12`
- users Alice / Bob — v1, `10:29:12`
- **roles `acme` Owner/owner and `globex` Owner/owner — v1, `system_role=false`, `authority_rank` NULL, `policy_refs` NULL, `10:29:12`**
- memberships (both) — v1, `active`, `10:29:12`
- identities (both) — v1, `10:29:12`

Alice's credential: `active=1 revoked=1 failed=0 locked=0 version=1`, `password_changed_at 2026-08-11 17:21:32` — unchanged.

---

## 33. C1 path audited from current source (STEP 4)

```
/governance/authority                                              (route — same page as C0.3)
  components/governance-authority/member-role-provisioning-card.tsx
    → provisionMemberRoleAction({ justification })                 actions.ts:154
    → resolveTenantContext()
    → provisionMemberRole(tenant, { justification })               provision-member-role.server.ts:74
      → resolveGovernanceAuthority(tenant)                         the SAME G2/G3 resolver
      → db.transaction(...)
          writeGovernanceDecisionWithin(tx, …)                     decision-authority.server.ts:372
             insert governanceSessions                             line 438  ← NEW session
             insert decisionRecords  (bootstrap: false)            line 459
          insert roles                                             provision-member-role.server.ts:133
          recordGovernanceEventWithin(tx, …) → insert audit_log    line 148
```

### 33.1 Surface

| Property | Value |
| --- | --- |
| Route | **`/governance/authority`** — the same page as C0.3; the card renders only when `readRoleBaselineState` returns `viewerIsGovernanceAuthority: true`, which is now true for Alice |
| Card title | **"Provision Member Role"** |
| Card description | *"This establishes the organization's ordinary onboarding role."* |
| Effect panel | always visible (**no reveal step, unlike C0.3**): `ROLE_BASELINE_EFFECT` plus ten `ROLE_BASELINE_NON_EFFECTS` |
| Input fields | **exactly one** — a textarea labelled **"Reason"**, 3 rows |
| Button | **"Provision Member Role"** (never Add Role, Create Role, or Manage Roles) |
| Button disabled when | **`pending` only.** Unlike the bootstrap card there is no client-side length gate — a short reason is refused by the server with `justification-required` and shown as an error. |

### 33.2 Input and authority

- **The client supplies ONE thing: the justification.** There is no name parameter, no type parameter, no scope, no id, no update and no delete — *"provision an owner role" has no representation to arrive in*.
- Justification limits: the shared `JUSTIFICATION_LIMITS` — **minimum 24, maximum 2000** characters, validated by `validateJustification`.
- Required authority, in order: `unauthenticated` → `persistence-unavailable` → `justification-required` → **`no-governance-authority`** (no bootstrap row) → **`not-the-governance-authority`** (bootstrap exists but is not yours and you hold no unrevoked delegation) → `already-provisioned`.
- **Both authority gates now pass for Alice** (§31).

### 33.3 Transaction boundary

One `db.transaction`. Governance session + decision + the `roles` insert + the audit row commit together, or none do. *"A role with no authorizing decision, and a decision claiming a role that does not exist, are both unrepresentable rather than unlikely."*

### 33.4 Decision vocabulary

| Field | Value | Source |
| --- | --- | --- |
| `governance_domain` | **`organizational-role`** | `ORGANIZATIONAL_ROLE_DOMAIN`, selected in `writeGovernanceDecisionWithin` because `subjectType === 'role'` |
| `decision_type` | **`approve`** | `ORGANIZATIONAL_ROLE_DECISION_TYPE` — an existing enum member; no new decision type was added |
| `subject_type` | **`role`** | `ORGANIZATIONAL_ROLE_SUBJECT_TYPE` |
| `subject_id` | the new role's UUID, generated with `crypto.randomUUID()` **before** the decision so the two can bind | |
| `outcome` | **`organizational-role-provisioned`** | `ORGANIZATIONAL_ROLE_OUTCOME`, reached via the `approve` + `subjectType === 'role'` branch |
| `bootstrap` | **`false`** | constant in `writeGovernanceDecisionWithin` |
| `evidence` | `{ authorityFromBootstrapDecisionId: ea49e5b8-…, authorityVia: 'bootstrap', authorityDelegationDecisionId: null, roleType: 'member' }` | |
| Audit action | **`governance.role.provisioned`** | `ORGANIZATIONAL_ROLE_AUDIT_ACTION` |

### 33.5 The role row shape

| Column | Value | Why |
| --- | --- | --- |
| `name` | **`Member`** | `BASELINE_ROLE_NAME` — a constant, because a name parameter is the first step toward arbitrary role creation |
| `type` | **`member`** | `BASELINE_ROLE_TYPE` — a constant; `owner`/`director` excluded because connected authorities already grant on them, `operator`/`auditor` excluded because no runtime defines them |
| `system_role` | **`false`** | an ordinary tenant role, not a built-in |
| `authority_rank` | **NULL** | left untouched — no runtime reads it, and populating it would invent an authority |
| `policy_refs` | **NULL** | same reason |
| `tenant_id` | Acme | from the session |
| `created_by` / `created_by_type` | Alice / `human` | |

### 33.6 Uniqueness, replay, concurrency

- **Backstop:** `roles_one_member_per_tenant_uq` — `UNIQUE (tenant_id) WHERE type = 'member'`. Present and currently unoccupied for both tenants.
- **Pre-flight read:** matched **without** a lifecycle predicate, so it asks exactly the question the index answers; an existing member role — however it got there — returns `already-provisioned` and is left exactly as it is.
- **Replay:** a second click after success returns `already-provisioned` and writes nothing. The card also hides the form entirely once `memberRoleId !== null`, because *"a disabled button inviting a refused click is not an honest surface."*
- **Concurrency:** two simultaneous attempts both read "no member role"; the partial unique index stops the second, and a 23505 matched on **both** the code and the exact constraint name is translated to `already-provisioned` — a governed refusal, not an outage. An unrelated conflict cannot borrow that translation.
- **No separate mutex.** G3 serialises authority mutations on the bootstrap row because authority is a query over decisions with no row to lock. That is not this invariant: the thing that must be unique is a `roles` row, and the index locks exactly it.

---

## 34. Expected C1 durable delta (STEP 5)

### 34.1 A new Governance session is written — the bootstrap session is NOT reused

**Proven from source, not guessed.** `writeGovernanceDecisionWithin` opens with `tx.insert(governanceSessions)` at `decision-authority.server.ts:438` and passes the returned id into the decision. Nothing in `provisionMemberRole` reads, references, or reuses `authority.bootstrapDecisionId`'s session — the bootstrap decision id appears only inside the new decision's `evidence`, as `authorityFromBootstrapDecisionId`.

The two sessions also differ materially:

| | Bootstrap session (C0.3) | C1 session |
| --- | --- | --- |
| `governance_domain` | `authority-delegation` | **`organizational-role`** |
| `risk_class` | `critical` | **`medium`** |
| `authority_source_actor_type` / `_id` | **NULL / NULL** | **`human` / `d3535a0d-…`** (the bootstrap authority actor) |

### 34.2 Expected delta

| Table | Before | After | Detail |
| --- | ---: | ---: | --- |
| `governance_sessions` | **1** | **2** | +1 NEW, domain `organizational-role`, `risk_class='medium'`, `authoritySourceActor*` = human / Alice |
| `decision_records` | **1** | **2** | +1, `approve` / `role`, `bootstrap = false`, outcome `organizational-role-provisioned`, evidence naming `ea49e5b8-…` |
| `roles` | **2** | **3** | +1 Acme `Member` / `member`, `system_role=false`, `authority_rank` NULL, `policy_refs` NULL |
| `audit_log` | **3** | **4** | +1 `governance.role.provisioned`, entity = the decision id, metadata carrying `provisionedRoleId` |

### 34.3 What must remain unchanged

| Subject | Required after C1 |
| --- | --- |
| **Existing Owner roles** (both tenants) | byte-for-byte identical — `v1`, `system_role=false`, `authority_rank` NULL, `policy_refs` NULL, `updated_at 2026-08-10 10:29:12`. `provisionMemberRole` has **no update path**. |
| `memberships` | **2**, both v1, unchanged — nobody is reassigned to the new role |
| `users` | **2** |
| `auth_identities` | **2** |
| `auth_credentials` | **2**, counters and lock state unchanged |
| `invitations` | **0** |
| `membership_authorizations` | **0** |
| `identity_enrollment_requests` | **0** |
| `permissions` / `role_permissions` | **0 / 0** |
| `genesis_nominations` | **1**, already consumed — untouched |
| Bootstrap decision `ea49e5b8-…` | untouched; still the only `bootstrap = true` row |
| Applied migrations | **24** |

---

## 35. Same-tenant uniqueness proof (STEP 6)

| Assertion | Result |
| --- | ---: |
| Acme member roles (`type='member'`) | **0** |
| Member roles anywhere in the database | **0** |
| `roles_one_member_per_tenant_uq` exists | ✔ `UNIQUE (tenant_id) WHERE (type = 'member')` |
| Acme's only role today | `Owner` / `owner` (`9fc63bb2-…`) |
| Globex's only role today | `Owner` / `owner` (`1f3d2a97-…`) — independent, unaffected, and its own member slot stays free |
| Would provisioning Acme's member role violate current data? | **No.** The partial index is scoped to `tenant_id` where `type='member'`; Acme's slot is empty, so the insert is legal. Globex's slot is a different key and is not touched. |

**No test data was inserted into `hebun_r1`.** Every statement above is a read.

---

## 36. Backup decision (STEP 7)

**A fresh PRE-C1 backup is RECOMMENDED — as a separate Director authorization. None was created in this task.**

Current backups:

| Backup | Represents | Restoring it would… |
| --- | --- | --- |
| `hebun_r1_pre_p3_rollout_20260813_195032.dump` | migration 20 | undo migrations 21–24 as well |
| `hebun_r1_pre_ceremony_c01_20260813_203954.dump` | PRE-C0.1 | erase C0.1, C0.2 **and** C0.3 |
| `hebun_r1_pre_c03_bootstrap_20260813_215522.dump` | C0.1 ✔ C0.2 ✔ C0.3 ✘ | **erase C0.3** |

**The argument is not that C1 is dangerous — it is that there is currently no restore point that preserves the bootstrap.** Every existing dump predates `ea49e5b8-…`. If C1 lands and anything about it needs undoing, the only available rollback would also destroy the tenant's constitutional authority — which cannot be recreated: the genesis nomination is consumed, `decision_records_one_bootstrap_per_tenant_uq` permits exactly one bootstrap per tenant forever, and there is no revoke path for bootstrap authority anywhere in the repository.

C1 itself is also effectively one-way, though far milder: `provisionMemberRole` implements no role deletion, suspension or revocation; `roles_one_member_per_tenant_uq` has no lifecycle predicate, so once the slot is occupied it stays occupied; and `memberships_tenant_role_fk` is `ON DELETE RESTRICT`.

A PRE-C1 dump would be the first backup in the ceremony that captures a constitutionally-established Acme.

---

## 37. C1 Director procedure — NOT EXECUTED (STEP 8)

Dev server running on port 4000. Alice's session `aac13d67-…` was live at time of verification.

| Step | Action |
| --- | --- |
| **1. Open** | `http://localhost:4000/governance/authority` — *(if redirected to `/login`, sign in as **`alice@acme.test`**; the Director enters the password personally — it has never been inspected, retrieved, logged, echoed, reset, rotated, or inferred by any pass of this ceremony)* |
| **2. Expect** | The **Governance Authority** card now shows Governance as established. Below it, two new cards appear because Alice holds the authority: the **Authority Roster** card, and **"Provision Member Role"**. |
| **3. The card** | Title **"Provision Member Role"**, description *"This establishes the organization's ordinary onboarding role."* The effect and the ten non-effects are shown immediately — **there is no "review" step on this card.** |
| **4. Reason** | Type a genuine reason into the field labelled **"Reason"** — **24–2000 characters**. It is stored permanently on the decision record. A shorter reason is refused by the server, not blocked by the button. |
| **5. Recommended content** | Why this organization needs its ordinary onboarding role now — e.g. that no role exists into which a non-owner human could be admitted, and that membership authorization and invitation cannot proceed without one. State the operational reason, not filler. |
| **6. Final action** | The button labelled exactly **"Provision Member Role"**. |

**Durable effect of that click:** one transaction — a new Governance session (`organizational-role`, `risk_class='medium'`, authority source = Alice), a decision (`approve` / `role`, `bootstrap=false`, outcome `organizational-role-provisioned`), the `roles` row (`Member` / `member`, `system_role=false`, `authority_rank` and `policy_refs` NULL), and one `governance.role.provisioned` audit row. Counts after: `governance_sessions` 2, `decision_records` 2, `roles` 3, `audit_log` 4.

**Explicit non-effects**, from `ROLE_BASELINE_NON_EFFECTS` as rendered on the card: does not add a human · does not create a membership · does not create an invitation · does not create a credential, user, or identity · does not grant Governance authority · does not grant Knowledge authoring authority · does not grant provider access or change the model kill-switch · does not grant execution, Computer Use, or terminal authority · **does not change the owner role, or any existing role** · does not create permissions or a role hierarchy.

**The button was not clicked and the form was not submitted by this session. C1 was not executed.** C1 does not authorize C2 (membership authorization).

---

## Verdict of the fifth pass (superseded — see §44)

> **C0.3 VERIFIED — C1 MEMBER ROLE PROVISIONING READY FOR DIRECTOR AUTHORIZATION**

Acme now holds exactly one bootstrap Governance decision — `ea49e5b8-3df7-4712-b6bb-104a1f1ccc08`, `bootstrap = true`, `certify` / `tenant`, outcome `authority-established`, actor human `alice@acme.test`, `authority_source_actor_*` NULL, justification 154 characters stored once. Its session `aec128ed-…` carries domain `authority-delegation`, `risk_class='critical'`, no voting mode. The genesis entitlement `0b7154c0-…` is consumed at the same instant and points back at that decision. One audit row, `governance.bootstrap.established`, entity `governance_decision`/`ea49e5b8-…`, same timestamp — one `now`, one transaction.

`resolveGovernanceAuthority(Alice, Acme)` now resolves **`authorized: true, via: 'bootstrap'`**, proven by replaying the resolver's own queries read-only. Zero delegations, one bootstrap in the whole database, Globex still with none. Alice's `owner` role had nothing to do with it and still grants no Governance authority.

C0.3 created no role, permission, membership, invitation, enrollment, identity, credential, or any execution/provider/Knowledge authority. Every unrelated row is still `version = 1` at its original seed timestamp.

*(As of the fifth pass: no PRE-C1 backup existed yet.)*

---

# PART SIX — PRE-C1 BACKUP, PRE-PROVISIONING BASELINE, C1 HANDOFF

**Date:** 2026-08-13, sixth pass. Authorized: one PRE-C1 backup, read-only verification, dev-server reuse, record append. **Not authorized and not performed: role provisioning, Governance decision or session, audit write, or any other durable mutation.**

---

## 38. Baseline re-proved (STEP 0)

| Fact | Value |
| --- | --- |
| Root | `/Users/senolsevim/Developer/Hebun AI` |
| Branch | `main` |
| HEAD = `origin/main` = **real remote main** | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| Ahead / behind | `0 / 0` |
| Staged | none |
| Tags | 204 |
| Migration SQL / journal | 24 / 24 |
| `hebun_r1` applied migrations | **24** |

Working tree — five paths, all classified, nothing discarded: `next-env.d.ts` (generated Next 16 dev churn) plus four untracked docs including this record.

### 38.1 Expected durable state — every value matched

| Expectation | Required | Actual |
| --- | ---: | ---: |
| Acme bootstrap decisions | 1 | **1** ✔ |
| `decision_records` | 1 | **1** ✔ |
| `governance_sessions` | 1 | **1** ✔ |
| Consumed Genesis nominations | 1 | **1** ✔ |
| `audit_log` | 3 | **3** ✔ |
| `roles` | 2 | **2** ✔ |
| Acme member roles | 0 | **0** ✔ |
| `memberships` | 2 | **2** ✔ |
| `membership_authorizations` | 0 | **0** ✔ |
| `invitations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `permissions` / `role_permissions` | 0 / 0 | **0 / 0** ✔ |

### 38.2 Alice still resolves as the Governance authority

Resolver queries replayed read-only: bootstrap row `ea49e5b8-3df7-4712-b6bb-104a1f1ccc08` found for Acme, `actor_type='human'`, `actor_id` = Alice → **`authorized = true, via = bootstrap`**. Active unrevoked delegations: **0**.

**No material mismatch. No stop condition.**

---

## 39. PRE-C1 backup (STEP 1) — AUTHORIZED, CREATED

Target proven before execution: `db=hebun_r1 host=127.0.0.1 port=55432`. Client and server both **PostgreSQL 14.20 (Homebrew)**. No credential printed.

| Property | Value |
| --- | --- |
| **Absolute path** | `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c1_member_role_20260813_231452.dump` |
| **Archive created** | **2026-08-13 23:14:52 +03** |
| **Byte size** | **280,746** |
| **SHA-256** | **`a997841a95ab71f779a58da0281ee2ad9f3009d38707b116313e7bfe413cef2c`** |
| Format | CUSTOM (`pg_dump -Fc`), dump version 1.14-0 |
| Location | outside the repository ✔ |

The target path was checked for prior existence and would have refused rather than overwrite. All three earlier backups survive, hashes re-verified before the dump:

| Backup | Size | SHA-256 |
| --- | ---: | --- |
| `hebun_r1_pre_p3_rollout_20260813_195032.dump` | 260,835 | `543b4ee9…` |
| `hebun_r1_pre_ceremony_c01_20260813_203954.dump` | 279,056 | `36172997…` |
| `hebun_r1_pre_c03_bootstrap_20260813_215522.dump` | 279,706 | `6b500c5e…` |

---

## 40. Backup validation (STEP 2) — NOT RESTORED

`pg_restore -l` parses cleanly: **505 TOC entries (501 numbered), 50 `TABLE DATA` entries.**

All required tables present with their data sections: `drizzle.__drizzle_migrations` (TABLE + TABLE DATA + sequence + pkey), `genesis_nominations`, `decision_records`, `governance_sessions`, `audit_log`, `roles`, `memberships`, `users`, `auth_identities`, `auth_credentials`, `invitations`, `membership_authorizations`, `identity_enrollment_requests`.

### 40.1 Archive content — read to stdout, never into a database

`pg_restore --data-only -t <table> -f -` was used. **No `-d` flag was ever passed**, so no connection to any database was possible.

| Table | Rows inside the dump |
| --- | ---: |
| `genesis_nominations` | **1** |
| `decision_records` | **1** |
| `governance_sessions` | **1** |
| `roles` | **2** |
| `audit_log` | **3** |

Field-level evidence extracted from the archive's own COPY blocks:

- **Nomination row** `0b7154c0-dc73-4a28-aaf4-ec31960b4685` carries `2026-08-13 20:45:46.653569` (**C0.1**), `2026-08-13 20:53:51.911` (**C0.2 acceptance**), and `2026-08-13 22:48:48.654` + `ea49e5b8-3df7-4712-b6bb-104a1f1ccc08` (**C0.3 consumption**), status `accepted`, updated by `d3535a0d-…`.
- **Decision row** carries `ea49e5b8-…`, session `aec128ed-048f-45cc-aee7-07b41fa9ce56`, `certify`, `tenant`, bootstrap `t`, outcome `authority-established` (**C0.3**).
- **Roles**: exactly two rows, both `Owner` / `owner`. **No `Member` / `member` row anywhere in the archive.**

> **This backup represents:**
> **C0.1 = present** · **C0.2 = present** · **C0.3 = present** · **C1 = absent**
>
> Specifically: one consumed Genesis nomination, one bootstrap decision, one bootstrap Governance session, `roles` = 2, Acme member roles = **0**.

**It was not restored.** This is the first backup in the ceremony that captures a constitutionally-established Acme — restoring it preserves the bootstrap and undoes only C1.

---

## 41. PRE-C1 durable baseline (STEP 3)

Re-read after backup creation. **Backup creation caused zero database mutation** — every count identical to §38.1.

| Table / measure | PRE-C1 value |
| --- | ---: |
| applied migrations | **24** |
| `decision_records` | **1** |
| `governance_sessions` | **1** |
| `audit_log` | **3** |
| `roles` | **2** |
| — Acme member roles | **0** (total Acme roles: 1) |
| — Globex member roles | **0** (total Globex roles: 1) |
| `memberships` | **2** |
| `invitations` | **0** |
| `membership_authorizations` | **0** |
| `identity_enrollment_requests` | **0** |
| `permissions` / `role_permissions` | **0 / 0** |
| `genesis_nominations` | **1** (consumed) |
| `users` / `auth_identities` / `auth_credentials` | **2 / 2 / 2** |
| `user_session_contexts` | **50** |
| Alice credential | `active=1 revoked=1 failed=0 locked=0 version=1`, `password_changed_at 2026-08-11 17:21:32` |
| Invalid indexes | **0** |
| Unvalidated constraints | **0** |

---

## 42. C1 contract re-proved (STEP 4)

Re-read from the current working tree (HEAD `9cc0c4d`, no source file dirty).

```
/governance/authority
  → provisionMemberRoleAction({ justification })          actions.ts:154
  → resolveTenantContext()
  → provisionMemberRole(tenant, { justification })        provision-member-role.server.ts:74
    → resolveGovernanceAuthority(tenant)                  the SAME G2/G3 resolver
    → db.transaction(...)
        writeGovernanceDecisionWithin(tx, …)              decision-authority.server.ts:372
           insert governanceSessions                      line 438  ← its OWN session
           insert decisionRecords (bootstrap: false)      line 459
        insert roles                                      line 133
        recordGovernanceEventWithin(tx, …) → audit_log    line 148
```

### 42.1 Expected successful delta — unchanged

| Table | Before | After | Detail |
| --- | ---: | ---: | --- |
| `governance_sessions` | **1** | **2** | +1 NEW — the bootstrap session is **not** reused (`writeGovernanceDecisionWithin` inserts its own at line 438). Domain `organizational-role`, `risk_class='medium'`, `authoritySourceActor*` = `human` / Alice. |
| `decision_records` | **1** | **2** | +1 — domain `organizational-role`, `decision_type` **`approve`**, `subject_type` **`role`**, `subject_id` = the new role's pre-generated UUID, **`bootstrap = false`**, outcome **`organizational-role-provisioned`**, evidence `{ authorityFromBootstrapDecisionId: ea49e5b8-…, authorityVia: 'bootstrap', authorityDelegationDecisionId: null, roleType: 'member' }` |
| `roles` | **2** | **3** | +1 for **Acme** — `name` = **`Member`** (`BASELINE_ROLE_NAME`), `type` = **`member`** (`BASELINE_ROLE_TYPE`), **`system_role = false`**, **`authority_rank` NULL**, **`policy_refs` NULL**, `created_by` Alice / `human` |
| `audit_log` | **3** | **4** | +1 — action **`governance.role.provisioned`**, entity = the decision id, metadata carrying `provisionedRoleId` and `provisionedRoleType` |

The role's UUID is generated with `crypto.randomUUID()` **before** the decision, so the decision can name a subject the same transaction then creates.

### 42.2 The existing Owner role is not mutated

`provisionMemberRole` contains **no update path** — it inserts a new `roles` row and nothing else. Both Owner rows must remain byte-identical:

| Tenant | Role | Current state that must not change |
| --- | --- | --- |
| acme | `9fc63bb2-…` `Owner`/`owner` | `lifecycle=active`, `system_role=false`, `authority_rank` NULL, `policy_refs` NULL, `v1` |
| globex | `1f3d2a97-…` `Owner`/`owner` | `lifecycle=active`, `system_role=false`, `authority_rank` NULL, `policy_refs` NULL, `v1` |

### 42.3 The member role grants nothing — audited, not assumed

Every connected role-type authority set in the repository was enumerated and inspected:

| Authority set | Members | Contains `member`? |
| --- | --- | ---: |
| `PROVIDER_CONTROL_ROLE_TYPES` (`heby-provider-ops/provider-authority.server.ts:21`) | `owner`, `director` | **NO** |
| `KNOWLEDGE_AUTHOR_ROLE_TYPES` (`knowledge/knowledge-write-authority.server.ts:46`) | owner/director band | **NO** |
| `ONBOARDING_EXCLUDED_ROLE_TYPES` (`membership-authority/contracts.ts:77`) | `owner`, `director`, `operator`, `auditor` | n/a — this is the exclusion list |
| `PARTY_ROLE_TYPES` (`organizational-intelligence/canonical/party-role.ts:20`) | organizational-graph vocabulary, not an authority gate | **NO** |

`member` appears in exactly one set — `ELIGIBLE_ROLE_TYPE_LIST` in `membership-authority/contracts.ts`, which is the list of bands a human may be **onboarded into**, not a privilege grant.

Therefore the provisioned role:

- **grants no connected privilege** — no authority check anywhere reads it
- **does not create permissions** — `permissions` and `role_permissions` are not imported by this module and stay at 0 / 0
- **does not create a membership** — `memberships` is not written; nobody is assigned to it
- **does not grant Governance authority** — `resolveGovernanceAuthority` reads only `decision_records`

---

## 43. Uniqueness and concurrency (STEP 5)

| Assertion | Result |
| --- | --- |
| `roles_one_member_per_tenant_uq` exists | ✔ `CREATE UNIQUE INDEX … ON public.roles USING btree (tenant_id) WHERE (type = 'member'::role_type)` |
| Index predicate, read from `pg_get_expr(indpred)` | **`(type = 'member'::role_type)`** — **no lifecycle predicate**, confirmed directly from the catalog |
| Acme member roles | **0** — slot free |
| Globex member roles | **0** — independent key, untouched by C1 |
| Would C1 violate current data? | **No** — `acme_member_slot_free = true` |

**C1 is create-once for Acme under the current schema.** The index has no lifecycle predicate, and `provisionMemberRole` implements no deletion, suspension or revocation — so once Acme's member slot is occupied it stays occupied. The phase documents this as a known, deliberate edge: inventing lifecycle handling for a state no runtime can reach would be building the role administration this phase refuses.

**Concurrency:** two simultaneous attempts both read "no member role" and both proceed. PostgreSQL's partial unique index refuses the second; the loser's transaction rolls back entirely — its Governance session, its decision, its role insert and its audit row all unwind together, because they share one transaction. The 23505 is matched on **both** the SQLSTATE and the exact constraint name `roles_one_member_per_tenant_uq` (including through drizzle's `cause` wrapper), so an unrelated unique conflict cannot borrow the `already-provisioned` translation. There is no separate application mutex — the index is the lock.

**No test rows were generated in `hebun_r1`.** Every statement above is a read.

---

## 44. C1 Director handoff (STEP 6)

### 44.1 Dev server — a prerequisite the Director must perform

**The dev server that was running in the previous passes has exited.** Measured, not assumed:

| Check | Result |
| --- | --- |
| Port 4000 | **nothing listening** |
| PID 5010 (the previous `next-server`) | **gone** |
| Any `next-server` / `next dev` process | **none** |
| Port 3000 | free — **not touched** |

This task authorizes *reuse* of an existing dev server, and STEP 6 conditions it on the server being healthy. It is not. **No server was started and no background process was spawned** — that would outlive this turn and was not authorized here. The port was `4000` only because a runtime `-p 4000` flag was passed when it was originally launched; `next dev` alone defaults to 3000, and there is no `.claude/launch.json` or repo config pinning 4000.

The Director should start it themselves before step 1 below:

```bash
cd "/Users/senolsevim/Developer/Hebun AI/apps/dashboard" && npm run dev -- -p 4000
```

**This is a transient local process, not a C1 blocker.** Every durable precondition for C1 is satisfied.

### 44.2 The procedure

1. **Open** `http://localhost:4000/governance/authority` — *(if redirected to `/login`, sign in as **`alice@acme.test`**; the Director enters the password personally. It has never been inspected, retrieved, logged, echoed, reset, rotated, or inferred by any pass of this ceremony.)*
2. **Locate the `Provision Member Role` card** — title "Provision Member Role", description *"This establishes the organization's ordinary onboarding role."* It renders because `readRoleBaselineState` now returns `viewerIsGovernanceAuthority: true` for Alice.
3. **Read the visible effect and non-effects** — both are shown immediately; **this card has no "review" reveal step.** The effect: *"establishes this organization's ordinary member role, the least-authority role a new person can hold."*
4. **Enter a genuine Reason** in the field labelled **`Reason`** — **24–2000 characters**, stored permanently on the decision record. A shorter reason is refused by the server (`justification-required`), not blocked by the button.
   *Direction, not text to copy:* say why Acme needs the ordinary onboarding role now — that no role exists into which a non-owner human could be admitted, that membership authorization and invitation cannot proceed without one, and that the existing Owner role is untouched.
5. **Final action:** the button labelled exactly **`Provision Member Role`**.

**Durable effect of that click:** one transaction — a new Governance session (`organizational-role`, `risk_class='medium'`, authority source Alice), a decision (`approve` / `role`, `bootstrap=false`, outcome `organizational-role-provisioned`), the `roles` row (`Member` / `member`, `system_role=false`, `authority_rank` and `policy_refs` NULL), and one `governance.role.provisioned` audit row. Counts after: `governance_sessions` 2, `decision_records` 2, `roles` 3, `audit_log` 4.

**Explicit non-effects**, from `ROLE_BASELINE_NON_EFFECTS` as rendered on the card: does not add a human · does not create a membership · does not create an invitation · does not create a credential, user, or identity · does not grant Governance authority · does not grant Knowledge authoring authority · does not grant provider access or change the model kill-switch · does not grant execution, Computer Use, or terminal authority · **does not change the owner role, or any existing role** · does not create permissions or a role hierarchy.

**The Reason was not entered and the button was not clicked by this session. C1 was not executed.** C1 does not authorize C2 (membership authorization).

---

## Verdict of the sixth pass (superseded — see §52)

> **PRE-C1 BACKUP VERIFIED — C1 MEMBER ROLE PROVISIONING READY**

**Backup:** `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c1_member_role_20260813_231452.dump`
**SHA-256:** `a997841a95ab71f779a58da0281ee2ad9f3009d38707b116313e7bfe413cef2c`
**Size:** 280,746 bytes · created 2026-08-13 23:14:52 · **C0.1 ✔ C0.2 ✔ C0.3 ✔ C1 ✘** · not restored

Acme's bootstrap authority is intact — one bootstrap decision `ea49e5b8-…`, one Governance session `aec128ed-…`, one consumed nomination, and Alice still resolves `authorized: true, via: 'bootstrap'` with zero delegations. Acme's member-role slot is free, the partial unique index carries no lifecycle predicate, and Globex is independent and unaffected.

Expected post-click delta: `governance_sessions` 1 → 2 · `decision_records` 1 → 2 (`approve` / `role`, `bootstrap = false`, `organizational-role-provisioned`) · `roles` 2 → 3 (Acme `Member` / `member`) · `audit_log` 3 → 4 (`governance.role.provisioned`). Both Owner roles untouched.

**One prerequisite the Director must do first:** the dev server has exited; start it with `npm run dev -- -p 4000` from `apps/dashboard`. No server was started by this task.

**URL:** `http://localhost:4000/governance/authority`
**Final button:** `Provision Member Role`

*(As of the sixth pass: the member role had not yet been provisioned.)*

---

# PART SEVEN — C1 VERIFIED, C2 MEMBERSHIP AUTHORIZATION AUDITED

**Date:** 2026-08-13, seventh pass. **Read-only throughout** (`PGOPTIONS='-c default_transaction_read_only=on'`, guard proven live). The Director performed C1 in the browser between the sixth and seventh passes. UI evidence was treated as evidence only — every claim below is proven from PostgreSQL and current source.

---

## 45. Baseline (STEP 0)

| Fact | Expected | Actual |
| --- | --- | --- |
| Root | `/Users/senolsevim/Developer/Hebun AI` | ✔ |
| Branch | `main` | ✔ |
| HEAD = `origin/main` = **real remote main** | `9cc0c4d…` | **`9cc0c4db4c29dfb34c51f65e6f8456e6e198b912`** ✔ |
| Ahead / behind | 0 / 0 | **0 / 0** ✔ |
| Tags | 204 | **204** ✔ |
| Staged | none | none ✔ |
| Migration SQL / journal | 24 / 24 | **24 / 24** ✔ |
| DB target | `hebun_r1` | `db=hebun_r1 host=127.0.0.1 port=55432` ✔ |
| Applied migrations | 24 | **24** ✔ |

Working tree unchanged: `next-env.d.ts` (generated churn, **not cleaned**) plus four untracked docs including this record.

---

## 46. C1 durable delta — proven from PostgreSQL (STEP 1)

| Table | Before | After | Δ |
| --- | ---: | ---: | ---: |
| `governance_sessions` | 1 | **2** | +1 ✔ |
| `decision_records` | 1 | **2** | +1 ✔ |
| `roles` | 2 | **3** | +1 ✔ |
| `audit_log` | 3 | **4** | +1 ✔ |

### 46.1 The new Governance session

| Column | Value |
| --- | --- |
| `id` | **`66217bbe-7ee4-43a5-9d72-5f1e9f9ec8ed`** |
| `tenant` | `acme` (`d2203db7-…`) ✔ |
| **`governance_domain`** | **`organizational-role`** ✔ |
| `decision_type` / `subject_type` | `approve` / `role` ✔ |
| `subject_id` | `a1288fe9-0739-4217-a36e-ac9744778237` — the new role |
| `proposer_actor_type` / `_id` | `human` / `d3535a0d-…` (Alice) ✔ |
| **`risk_class`** | **`medium`** ✔ — set explicitly in `writeGovernanceDecisionWithin:448`, and also the column default |
| `authority_source_actor_type` / `_id` | **`human` / `d3535a0d-…`** (Alice) ✔ — unlike the genesis session, which left both NULL |
| `governance_lifecycle_status` | `recorded` |
| `governance_health` | `unknown` — **the schema default** (`default 'unknown'::governance_health`); the bootstrap session carries the same value. Not invented state. |
| `voting_mode` / `gates` / `approval_chain` | **NULL / NULL / NULL** ✔ — no voting or approval-chain runtime exists and none was claimed |
| **Distinct from bootstrap session `aec128ed-…`** | **true** ✔ |

### 46.2 The C1 decision

| Column | Value |
| --- | --- |
| `id` | **`6d3ca5da-ddb4-414e-833a-36b1552cdfb8`** |
| `session_id` | **`66217bbe-…`** ✔ points at the new organizational-role session |
| `tenant` | `acme` ✔ |
| **`bootstrap`** | **`false`** ✔ |
| **`decision_type`** | **`approve`** ✔ |
| **`subject_type`** | **`role`** ✔ |
| `subject_id` | `a1288fe9-…` — **proven equal to the new role's id** ✔ |
| `actor_type` / actor | `human` / `alice@acme.test` ✔ |
| `authority_source_actor_type` / `_id` | `human` / `d3535a0d-…` (Alice) ✔ |
| **`outcome`** | **`organizational-role-provisioned`** ✔ |
| `decided_at` | `2026-08-13 23:34:39.302+03` |
| `decision_version` / `supersedes` / `version` / `lifecycle` | 1 / NULL / 1 / active |
| `gate_results` / `chain_results` | NULL / NULL — no invented gate or chain state |
| **`evidence`** | `{"roleType":"member","authorityVia":"bootstrap","authorityDelegationDecisionId":null,"authorityFromBootstrapDecisionId":"ea49e5b8-3df7-4712-b6bb-104a1f1ccc08"}` |
| `justification` | **167 characters**, stored once: *"Provisioning Acme's ordinary member role so future non-owner humans can be onboarded through Governance-authorized membership without altering the existing Owner role."* |

**Authority provenance is correct and explicit:** the evidence names `authorityFromBootstrapDecisionId = ea49e5b8-…`, the C0.3 bootstrap decision, with `authorityVia: "bootstrap"` and no delegation. The decision derives its authority from the existing bootstrap Governance authority, exactly as `writeGovernanceDecisionWithin:476` writes it.

The stated reason is exactly the Director-entered text — it matches the direction offered in §44.2 and is the Director's own wording, not filler.

### 46.3 The new role

| Column | Value |
| --- | --- |
| `id` | **`a1288fe9-0739-4217-a36e-ac9744778237`** |
| `tenant` | `acme` ✔ |
| **`name`** | **`Member`** ✔ |
| **`type`** | **`member`** ✔ |
| **`system_role`** | **`false`** ✔ |
| **`authority_rank`** | **NULL** ✔ |
| **`policy_refs`** | **NULL** ✔ |
| `lifecycle_status` | `active` |
| `version` | 1 |
| `created_at` / `updated_at` | `2026-08-13 23:34:39.304913+03` (identical — never updated) |
| `created_by` / `created_by_type` | `d3535a0d-…` (Alice) / `human` |
| `updated_by` | NULL |

**A genuinely new row** — created 2026-08-13, three days after the seed. Its id equals the decision's `subject_id`, so role and decision are bound.

**Neither Owner role was modified:**

| Tenant | Role | created_at | updated_at | version | created_by |
| --- | --- | --- | --- | ---: | --- |
| acme | `9fc63bb2-…` Owner/owner | 2026-08-10 10:29:12.314532 | **identical** | 1 | NULL |
| globex | `1f3d2a97-…` Owner/owner | 2026-08-10 10:29:12.334043 | **identical** | 1 | NULL |

Both still `system_role=false`, `authority_rank` NULL, `policy_refs` NULL, `lifecycle=active`, `updated_at == created_at` at the original seed instant. Untouched.

**Uniqueness holds:** Acme member roles = **1**, Globex member roles = **0**, and `roles_one_member_per_tenant_uq` (`UNIQUE (tenant_id) WHERE type = 'member'`) is intact. Globex's slot remains free and independent. Schema health: 0 invalid indexes, 0 unvalidated constraints.

### 46.4 The new audit event

| Column | Value |
| --- | --- |
| `id` | **`1e174abe-a75e-4c54-bdc7-a1f18fbbbb86`** |
| **`action`** | **`governance.role.provisioned`** ✔ |
| `tenant` | `acme` ✔ |
| `actor_type` / actor | `human` / `alice@acme.test` ✔ |
| **`entity_type` / `entity_id`** | **`governance_decision` / `6d3ca5da-…`** — the audit anchors to the **decision**, not the role. The role id travels in metadata. This matches the source: `entityId: decisionId`. |
| `result` / `simulation` | `committed` / `false` |
| `source` | `governance-authority` |
| **`authority_source`** | **`membership`** ✔ |
| `session_context_id` | `1ff88978-d24b-4eeb-9e17-cc361f3c85b7` |
| `request_id` | `d208d930-…` |
| `metadata` | `{"bootstrap":false,"subjectId":"a1288fe9-…","subjectType":"role","decisionType":"approve","provisionedRoleId":"a1288fe9-…","governanceSessionId":"66217bbe-…","provisionedRoleType":"member"}` |

Session provenance verified: `1ff88978-…` resolves to `alice@acme.test`, identity `88a813cb-…`, tenant `acme`, membership `3ae59ccd-…`, `aal1`, authenticated `23:31:20`, not revoked. It is a **third** session — distinct from the C0.2 (`e0b17a28`) and C0.3 (`aac13d67`) ones; `user_session_contexts` moved 50 → 51.

### 46.5 Timestamps — NOT all identical, and that is correct

The authorization asked not to assume identity. Measured:

| Value | Timestamp | Source |
| --- | --- | --- |
| `decision.decided_at` | `23:34:39.302` | application `now`, captured once at function entry |
| `audit.occurred_at` | `23:34:39.302` | the same application `now` |
| `session.created_at` | `23:34:39.304913` | PostgreSQL `now()` default |
| `decision.created_at` | `23:34:39.304913` | PostgreSQL `now()` default |
| `role.created_at` | `23:34:39.304913` | PostgreSQL `now()` default |
| `audit.recorded_at` | `23:34:39.304913` | PostgreSQL `now()` default |

Two clocks, ~2.9 ms apart, **each internally identical**. Column defaults confirm the split: `decided_at`, `created_at` and `recorded_at` all default to `now()`, while `decided_at` and `occurred_at` are explicitly passed the application's captured `now`.

**The database-side identity is the stronger proof of a single transaction:** PostgreSQL's `now()` returns the *transaction start time*, so four rows across four tables sharing `23:34:39.304913` to the microsecond could only have been inserted inside one transaction.

---

## 47. C1 non-effects (STEP 2)

| Subject | Expected | Actual |
| --- | ---: | ---: |
| `memberships` | 2 | **2** ✔ |
| `users` | 2 | **2** ✔ |
| `auth_identities` | 2 | **2** ✔ |
| `auth_credentials` | 2 | **2** ✔ |
| `membership_authorizations` | 0 | **0** ✔ |
| `invitations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `permissions` | 0 | **0** ✔ |
| `role_permissions` | 0 | **0** ✔ |
| applied migrations | 24 | **24** ✔ |

Row-level non-effect proof — every unrelated row still `version = 1` with `updated_at` at its original 2026-08-10 seed instant:

- tenants `acme` / `globex`
- users `alice@acme.test` / `bob@globex.test`
- **memberships: both still `role = Owner/owner`, `status = active`** — nobody was reassigned to the new Member role
- identities: both `status = active`, `v1`
- **genesis nomination**: still `accepted`, `consumed_by = ea49e5b8-…`, `v1`, `updated_at 22:48:48` — untouched by C1

**Alice's credential:** `active=1 revoked=1 failed=0 locked=0 version=1`, `password_changed_at 2026-08-11 17:21:32` — unchanged.

**Governance authority intact:** bootstrap `ea49e5b8-…` still the only `bootstrap = true` row in the database (total = 1), Alice still resolves `authorized = true, via = bootstrap`, **active delegations = 0** — no delegation was created. Bob/Globex untouched.

**No refusal artefact:** `audit_log` rows with `result = 'rejected'` = **0**. The successful C1 produced no accidental refusal event.

**The Member role grants nothing** (re-audited in §42.3 and unchanged): `member` appears in no connected authority set — not `PROVIDER_CONTROL_ROLE_TYPES` (`owner`, `director`), not `KNOWLEDGE_AUTHOR_ROLE_TYPES`, not `PARTY_ROLE_TYPES`. It appears only in `ELIGIBLE_ROLE_TYPE_LIST`, which is the list of bands a human may be onboarded *into* — not a privilege grant. No Governance, provider, Knowledge, execution, Computer Use, terminal, or administrative privilege attaches to it.

**The full audit ledger is four rows, all `committed`:**

```
2026-08-11 14:40:31.998  knowledge.create                        knowledge_fact
2026-08-13 20:53:51.911  governance.genesis-nomination.accepted  genesis_nomination
2026-08-13 22:48:48.654  governance.bootstrap.established        governance_decision
2026-08-13 23:34:39.302  governance.role.provisioned             governance_decision
```

---

## 48. PRE-C1 backup integrity (STEP 3)

| Check | Result |
| --- | --- |
| File exists | ✔ `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c1_member_role_20260813_231452.dump` |
| Size | 280,746 bytes (unchanged) |
| **SHA-256** | **`a997841a95ab71f779a58da0281ee2ad9f3009d38707b116313e7bfe413cef2c`** — **matches expected exactly** ✔ |
| `pg_restore -l` | valid, 505 TOC entries |
| `roles` rows inside the archive | **2** |
| `Member` string inside the archive's roles data | **0 occurrences** |

Semantic meaning **unchanged and confirmed**: **C0.1 present · C0.2 present · C0.3 present · C1 absent.** **Not restored.**

---

## 49. C2 contract, re-audited from current source (STEP 4)

### 49.1 Surface and inputs

| Property | Value |
| --- | --- |
| Route | `/governance/authority` (same page) |
| Component | `components/governance-authority/membership-authorization-card.tsx` |
| Card title | **"Authorize New Member"** |
| Card description | *"This authorizes one future onboarding for the specified person and role."* |
| Server action | `authorizeMembershipAction({ targetEmail, intendedRoleId, justification })` — `actions.ts:129` |
| Authoritative function | `authorizeMembership(tenant, input)` — `authorize-membership.server.ts:89` |
| **Client inputs — exactly three** | `Intended person's email` (`<input type="email">`), `Intended role` (`<select>`), `Reason` (`<textarea>`) |
| Button | **"Authorize New Member"**, disabled while `pending` or when no role is selected |

**Email validation** (`normalizeTargetEmail`): lower + trim only, then length ≤ **320** (`NORMALIZED_EMAIL_MAX_LENGTH`) and a shape gate `/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/`. Deliberately conservative — no dot-stripping or plus-address canonicalization, because over-clever normalization would silently merge two different people. The same lower+trim rule the database CHECK enforces, so application and storage cannot disagree about "the same human". Failure → `invalid-target-email`.

**Reason validation**: the shared `validateJustification` — **24–2000 characters** after trim. Failure → `justification-required`.

**Intended role resolution**: the `<select>` is populated from `readMembershipAuthority`, which returns roles in the caller's tenant with `lifecycle_status='active'` and `type IN ELIGIBLE_ROLE_TYPE_LIST`. `ELIGIBLE_ROLE_TYPE_LIST = ['member']`.

> **Only the newly provisioned Member role is selectable.** Verified against the live database: the eligible set for Acme is exactly one row — `a1288fe9-0739-4217-a36e-ac9744778237`, `Member` / `member`. `ONBOARDING_EXCLUDED_ROLE_TYPES` = `owner`, `director`, `operator`, `auditor`. The server re-resolves the role by **id AND tenant AND active lifecycle** and independently re-checks `ONBOARDING_ELIGIBLE_ROLE_TYPES` — so a tampered `intendedRoleId` naming an owner role is refused `role-not-eligible`, and one from another tenant is indistinguishable from one that never existed (`role-unresolvable`).

**Governance authority**: `resolveGovernanceAuthority(tenant)` — the same single resolver. `no-governance-authority` if no bootstrap row; `not-the-governance-authority` if the caller holds neither bootstrap nor an unrevoked delegation. Alice passes both today.

### 49.2 Transaction, writes, and expected delta

One `db.transaction` containing three writes:

| # | Table | Operation |
| --- | --- | --- |
| 1 | `governance_sessions` | INSERT via `writeGovernanceDecisionWithin` — its **own new session**, domain **`membership-authorization`**, `risk_class='medium'`, `authoritySourceActor*` = human / Alice |
| 2 | `decision_records` | INSERT — `approve` / `membership_authorization`, `bootstrap=false`, outcome **`membership-authorized`**, subject = the authorization's pre-generated UUID, evidence `{ authorityVia, authorityDelegationDecisionId, intendedRoleId, intendedRoleType, membershipAuthorizationId, authorityFromBootstrapDecisionId }` |
| 3 | `membership_authorizations` | INSERT — `status='authorized'`, `normalizedEmail`, `intendedRoleId`, `governanceDecisionId`, `governanceSessionId`, `authorizedByActorType='human'`, `authorizedByActorId` = Alice, `authorizedAt` |
| 4 | `audit_log` | INSERT — action **`governance.membership.authorized`**, `entityId` = the decision id, metadata carrying `membershipAuthorizationId`, `intendedRoleId`, `intendedRoleType` — **no email, no token, no justification duplicate** (G1 doctrine: the authorization row owns the address, the decision owns the sentence) |

**Expected durable delta:**

| Table | Before | After |
| --- | ---: | ---: |
| `governance_sessions` | 2 | **3** |
| `decision_records` | 2 | **3** |
| `membership_authorizations` | 0 | **1** |
| `audit_log` | 4 | **5** |
| `roles` / `memberships` / `users` / `auth_identities` / `auth_credentials` / `invitations` / `identity_enrollment_requests` / `permissions` / `role_permissions` | 3 / 2 / 2 / 2 / 2 / 0 / 0 / 0 / 0 | **unchanged** |

The circular-reference between decision and authorization is resolved by generating the authorization's UUID in the application *before* the decision, so the decision can bind to a row the same transaction then writes. The Director authorized that specific solution at I1; the alternative — creating an `invitations` row to obtain an id — would have minted token material inside an authority phase.

### 49.3 What C2 is, and what it is not

`MEMBERSHIP_AUTHORIZATION_EFFECT`: *"records that Governance has authorized ONE future onboarding of this human into this tenant with this role."*

`MEMBERSHIP_AUTHORIZATION_NON_EFFECTS` — rendered on the card, frozen values a test asserts:

does not create the account now · does not send an invitation · does not create an invitation token · does not create a credential · does not create a user or identity · does not create the membership · does not create or change any role · does not grant Governance authority · does not grant Knowledge ratification authority · does not grant provider access or change the model kill-switch · does not grant execution, Computer Use, or terminal authority

**Proven structurally, not just asserted.** `authorize-membership.server.ts` imports exactly: `randomUUID`, drizzle operators, `membershipAuthorizations`, `roles`, `TenantContext`, the governance audit writer, and the governance resolver/decision writer. It does **not** import `users`, `auth_identities`, `auth_credentials`, `memberships`, `invitations`, or `isEmailClaimed`. Those tables have no code path to be written from here.

> **authorization ≠ invitation** — no `invitations` row, no token
> **authorization ≠ identity enrollment** — `identity_enrollment_requests` untouched
> **authorization ≠ account** — no user, no identity, no credential
> **authorization ≠ membership** — `memberships` untouched
> **authorization ≠ role grant** — `roles` untouched; the role is *named*, not granted
> **authorization ≠ Governance authority** — `resolveGovernanceAuthority` reads only `decision_records` with `bootstrap = true`

### 49.4 The email is an unverified identifier at this stage

`authorizeMembership` performs **no lookup of any existing user, identity, or membership** for the target address — the modules are not imported. Therefore:

- **An existing account for that email does not change behaviour.** Authorizing an address that already belongs to a Hebun user produces exactly the same row as authorizing a stranger's.
- Possession of the address is never proved here. Hebun has no mail runtime and sends nothing at this step.
- The address is a *target*, not an identity. Identity binding happens later, at I2 acceptance, by verifying a credential — not by trusting this string.

### 49.5 Lifecycle: expiry, single-use, revocation, consumption

Read from the catalog, not assumed. `membership_authorizations` columns:

```
id, created_at, created_by, created_by_type, updated_at, updated_by, updated_by_type,
version, lifecycle_status, deleted_at, deleted_by, deleted_by_type,
tenant_id, normalized_email, intended_role_id, governance_decision_id, governance_session_id,
authorized_by_actor_type, authorized_by_actor_id, status, authorized_at,
consumed_at, consumed_by_invitation_id, revoked_at, revocation_reason
```

| Question | Answer |
| --- | --- |
| **Does it expire?** | **NO.** There is no `expires_at` column and no lapse logic. An authorization is **durable indefinitely** until consumed. (Contrast: `invitations` *does* carry `expires_at`, 72 hours.) |
| **Is it single-use?** | **YES.** `membership_authorizations_consumed_invitation_uq` (partial unique on `consumed_by_invitation_id`) plus `membership_authorizations_one_active_per_email_uq` (`UNIQUE (tenant_id, normalized_email) WHERE status='authorized'`) allow at most one live authorization per address per tenant, and it can be spent exactly once. |
| **Can it be revoked?** | **The schema supports it — the product does not.** `status` includes `revoked`, and `revoked_at` / `revocation_reason` exist with a CHECK. But **no runtime writes them.** Exhaustive search of non-test writers of `membershipAuthorizations` returns exactly two files: `authorize-membership.server.ts` (insert) and `issue-invitation.server.ts` (consume). **There is no revocation path on any surface today.** |
| **What consumes it?** | **C3 — `issueInvitation`** (`human-onboarding/issue-invitation.server.ts`), which mints the bearer capability and sets `consumed_at` + `consumed_by_invitation_id` in the same transaction. Consumption means *issuance*, not acceptance: a lapsed invitation does not un-spend the authorization, and re-inviting requires a **new Governance decision**. |

### 49.6 Idempotency, duplicates, races

- **Pre-flight read:** an existing `status='authorized'` row for the same tenant + normalized email returns `already-authorized` and writes nothing.
- **Real defence:** `membership_authorizations_one_active_per_email_uq`. A 23505 matched on **both** the SQLSTATE and the exact constraint name (through drizzle's `cause` wrapper) is translated to `already-authorized` — a governed refusal, not an outage. An unrelated unique conflict cannot borrow that translation.
- **Concurrency:** two simultaneous authorizations for the same person both pass the read; the index stops the second, and its whole transaction — session, decision, authorization, audit — rolls back together.
- **Different addresses do not collide.** The index is keyed on `(tenant_id, normalized_email)`, so authorizing several different people is legal and creates several rows.

### 49.7 Contradiction with prior expectations — none, but one hazard to flag

Nothing in current source contradicts the earlier Gate A model. One operational hazard is worth stating plainly:

> **The C3 control lives on the same card.** Once an authorization exists, the "Authorized onboardings" list beneath the form renders a per-row button labelled **"Issue onboarding capability"**, with the note *"Creates the capability and shows it to you once. Hebun sends nothing."* That button is **C3**, a separate gate that mints a live 72-hour bearer capability. It will appear immediately after C2 succeeds. **Do not click it as part of C2.**

---

## 50. Next safe gate and backup assessment (STEP 5)

**A fresh PRE-C2 backup is RECOMMENDED — as a separate Director authorization. None was created in this task.**

Two independent reasons:

1. **The PRE-C1 backup is now stale as a rollback point.** It contains `roles` = 2 with no Member row (§48). Restoring it today would erase C1 — the member role, its decision, its session and its audit row — and there is no other dump capturing the provisioned role.
2. **C2 is effectively irreversible through the product.** The schema models revocation, but **no runtime implements it** (§49.5). Once an authorization exists it can only be *consumed* by C3 or sit forever; it also occupies the `one_active_per_email_uq` slot for that address until then. If the wrong email is entered, there is no product path to undo it — the only correction available is a database-level intervention, which is exactly what a backup exists to avoid needing.

C2's blast radius is small (one row plus its decision/session/audit, no account, no token), so this is a weaker case than PRE-C0.3 — but the combination of "no revocation runtime" and "no backup captures C1" makes it the prudent gate.

**Not created in this task.**

---

## 51. Exact next human action — NOT PERFORMED

**C2 IS NOT AUTHORIZED BY THIS PASS.** No email was entered, no reason was entered, no role was selected, and the action was not invoked by UI, curl, script, test, devtools, or direct function call.

When the Director chooses to authorize C2 (after deciding on the PRE-C2 backup):

1. Ensure the dev server is running — it exits between sessions: `cd "/Users/senolsevim/Developer/Hebun AI/apps/dashboard" && npm run dev -- -p 4000`
2. Open `http://localhost:4000/governance/authority`, signed in as `alice@acme.test`.
3. Find the **"Authorize New Member"** card — *"This authorizes one future onboarding for the specified person and role."*
4. **`Intended person's email`** — the real address of the human to be onboarded. It is stored permanently, is never verified at this step, and cannot be revoked afterwards. Enter it carefully.
5. **`Intended role`** — resolves to **`Member`** (`a1288fe9-…`); it is the only eligible option.
6. **`Reason`** — 24–2000 characters, the Director's own words, stored permanently on the decision record.
7. Final button: **`Authorize New Member`**.
8. **STOP THERE.** The "Issue onboarding capability" button that then appears is C3, a different gate.

---

## Verdict of the seventh pass (superseded — see §59)

> **C1 VERIFIED — C2 READY FOR DIRECTOR AUTHORIZATION**

**C1 durable rows:** session `66217bbe-7ee4-43a5-9d72-5f1e9f9ec8ed` (`organizational-role`, medium, authority source Alice) · decision `6d3ca5da-ddb4-414e-833a-36b1552cdfb8` (`approve`/`role`, `bootstrap=false`, `organizational-role-provisioned`, evidence naming bootstrap `ea49e5b8-…`) · role `a1288fe9-0739-4217-a36e-ac9744778237` (`Member`/`member`, Acme, `system_role=false`, rank NULL, policy_refs NULL) · audit `1e174abe-a75e-4c54-bdc7-a1f18fbbbb86` (`governance.role.provisioned`).

**Counts:** `governance_sessions` 1→2 · `decision_records` 1→2 · `roles` 2→3 · `audit_log` 3→4. Everything else unchanged; both Owner roles byte-identical; 0 rejected audit rows; Alice still `authorized: true, via: bootstrap` with 0 delegations.

**PRE-C1 backup integrity confirmed** — SHA-256 matches, archive still holds 2 roles and no Member row.

**C2 is authorization only:** no invitation, no token, no account, no identity, no credential, no membership, no role change, no authority grant. It never expires, is single-use, has **no revocation runtime**, and is consumed later by C3's invitation issuance. The email is an unverified target identifier and an existing account for it changes nothing.

**PRE-C2 backup recommended.** C2 was not executed.

*(As of the seventh pass: no PRE-C2 backup existed yet.)*

---

# PART EIGHT — PRE-C2 BACKUP, PRE-AUTHORIZATION BASELINE, C2 HANDOFF

**Date:** 2026-08-14, eighth pass. Authorized: one PRE-C2 backup, read-only verification, starting the local dev server on port 4000, record append. **Not authorized and not performed: any membership authorization, Governance decision or session, invitation, token, account, or any other durable mutation.**

---

## 52. Baseline (STEP 0)

| Fact | Expected | Actual |
| --- | --- | --- |
| Branch | `main` | ✔ |
| HEAD = `origin/main` = **real remote main** | — | **`9cc0c4db4c29dfb34c51f65e6f8456e6e198b912`** ✔ |
| Ahead / behind | 0 / 0 | **0 / 0** ✔ |
| Tags | — | 204 |
| Staged | none | none ✔ |
| Migration SQL / journal | 24 / 24 | **24 / 24** ✔ |
| `hebun_r1` applied | 24 | **24** ✔ |
| DB target | `127.0.0.1:55432/hebun_r1` | `db=hebun_r1 host=127.0.0.1 port=55432` ✔ |

Working tree unchanged: `next-env.d.ts` (generated churn, not cleaned) plus four untracked docs including this record.

### 52.1 Durable state — every expectation matched

| Expectation | Required | Actual |
| --- | ---: | ---: |
| bootstrap decisions | 1 | **1** ✔ |
| `governance_sessions` | 2 | **2** ✔ |
| `decision_records` | 2 | **2** ✔ |
| `audit_log` | 4 | **4** ✔ |
| `roles` | 3 | **3** ✔ |
| Acme member roles | 1 | **1** ✔ |
| `memberships` | 2 | **2** ✔ |
| `membership_authorizations` | 0 | **0** ✔ |
| `invitations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `permissions` / `role_permissions` | 0 / 0 | **0 / 0** ✔ |

**Governance authority intact:** bootstrap `ea49e5b8-3df7-4712-b6bb-104a1f1ccc08`, Alice resolves `authorized = true, via = bootstrap`.
**Member role intact:** `a1288fe9-0739-4217-a36e-ac9744778237`, `Member`/`member`, `system_role=false`, `authority_rank` NULL, `policy_refs` NULL.

### 52.2 Server state — a change worth recording

| Port | State |
| --- | --- |
| **4000** | **not listening** at pass start — the Hebun dev server had exited again |
| **3000** | **occupied by an unrelated project** — `next-server (v16.1.6)`, PID 37770, cwd `/Users/senolsevim/woolmount-antique` |

Port 3000 is **not** Hebun. It was identified read-only (`ps`, `lsof`) and **left completely untouched**, as instructed. Nothing was killed, signalled, or reconfigured.

---

## 53. PRE-C2 backup (STEP 1) — AUTHORIZED, CREATED

Client and server both **PostgreSQL 14.20 (Homebrew)**. No credential printed.

| Property | Value |
| --- | --- |
| **Absolute path** | `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c2_membership_authorization_20260814_000950.dump` |
| **Archive created** | **2026-08-14 00:09:50 +03** |
| **Byte size** | **281,518** |
| **SHA-256** | **`8cebe629d2d47b1548cc65cbebe9693846bed5f88c43228e5eb5ec2c2f441370`** |
| Format | CUSTOM (`pg_dump -Fc`), dump version 1.14-0 |
| Location | outside the repository ✔ |

Target path was checked for prior existence and would have refused rather than overwrite. **All four earlier backups preserved:**

| Backup | Size | Represents |
| --- | ---: | --- |
| `hebun_r1_pre_p3_rollout_20260813_195032.dump` | 260,835 | migration 20 |
| `hebun_r1_pre_ceremony_c01_20260813_203954.dump` | 279,056 | PRE-C0.1 |
| `hebun_r1_pre_c03_bootstrap_20260813_215522.dump` | 279,706 | C0.1–C0.2, PRE-C0.3 |
| `hebun_r1_pre_c1_member_role_20260813_231452.dump` | 280,746 | C0.1–C0.3, PRE-C1 |
| **`hebun_r1_pre_c2_membership_authorization_20260814_000950.dump`** | **281,518** | **C0.1–C1, PRE-C2** |

---

## 54. Backup validation (STEP 2) — NOT RESTORED

`pg_restore -l` parses cleanly: **505 TOC entries (501 numbered), 50 `TABLE DATA` entries.**

All required tables present with data sections: `drizzle.__drizzle_migrations`, `genesis_nominations`, `decision_records`, `governance_sessions`, `audit_log`, `roles`, `memberships`, `membership_authorizations`, `invitations`, `users`, `auth_identities`, `auth_credentials`.

### 54.1 Archive content — read to stdout, never into a database

`pg_restore --data-only -t <table> -f -`. **No `-d` flag was ever passed.**

| Table | Rows inside the dump |
| --- | ---: |
| `genesis_nominations` | **1** |
| `decision_records` | **2** |
| `governance_sessions` | **2** |
| `roles` | **3** |
| `audit_log` | **4** |
| `memberships` | **2** |
| **`membership_authorizations`** | **0** |
| **`invitations`** | **0** |

Field-level evidence from the archive's own COPY blocks:

- **Roles** — `9fc63bb2-…` `Owner`/`owner`, `1f3d2a97-…` `Owner`/`owner`, and **`a1288fe9-0739-4217-a36e-ac9744778237` `Member`/`member`**. **C1 is present.**
- **Decisions** — `ea49e5b8-…` `certify` / `authority-established` (**C0.3**) and `6d3ca5da-…` `approve` / `organizational-role-provisioned` (**C1**), the second carrying `ea49e5b8-…` in its evidence as its authority provenance.
- **Nomination** — one row, carrying the C0.1 / C0.2 / C0.3 lifecycle.

> **This backup represents:**
> **C0.1 ✔ · C0.2 ✔ · C0.3 ✔ · C1 ✔ · C2 ✘**
>
> Specifically: one bootstrap decision, one Acme Member role, **zero membership authorizations**.

**Not restored.** This is the first backup that preserves both the bootstrap authority and the member role.

---

## 55. PRE-C2 durable baseline (STEP 3)

Re-read after backup creation. **Backup creation caused zero database mutation** — every count identical to §52.1.

| Table / measure | PRE-C2 value |
| --- | ---: |
| applied migrations | **24** |
| `governance_sessions` | **2** |
| `decision_records` | **2** |
| `audit_log` | **4** |
| `roles` | **3** |
| — Acme member roles | **1** |
| `memberships` | **2** |
| **`membership_authorizations`** | **0** |
| `invitations` | **0** |
| `identity_enrollment_requests` | **0** |
| `auth_identities` / `auth_credentials` | **2 / 2** |
| `permissions` / `role_permissions` | **0 / 0** |
| Invalid indexes | **0** |
| Unvalidated constraints | **0** |

**All three roles show `updated_at == created_at`** — none has ever been modified:

| Tenant | Role | created_at == updated_at | version |
| --- | --- | --- | ---: |
| acme | `Owner`/`owner` | `2026-08-10 10:29:12.314532` ✔ | 1 |
| globex | `Owner`/`owner` | `2026-08-10 10:29:12.334043` ✔ | 1 |
| acme | `Member`/`member` | `2026-08-13 23:34:39.304913` ✔ | 1 |

---

## 56. C2 contract re-proved from current source (STEP 4)

```
/governance/authority
  → authorizeMembershipAction({ targetEmail, intendedRoleId, justification })   actions.ts:129
  → resolveTenantContext()
  → authorizeMembership(tenant, input)                    authorize-membership.server.ts:89
    → resolveGovernanceAuthority(tenant)                  the single G2/G3 resolver
    → db.transaction(...)
        writeGovernanceDecisionWithin(tx, …)              decision-authority.server.ts:372
           insert governanceSessions                      line 438
           insert decisionRecords (bootstrap: false)      line 459
        insert membershipAuthorizations                   authorize-membership.server.ts:210
        recordGovernanceEventWithin(tx, …) → audit_log    line 225
```

### 56.1 Expected successful delta — values read from source, not from the prompt

| Table | Before | After | Source-proven values |
| --- | ---: | ---: | --- |
| `governance_sessions` | **2** | **3** | domain **`membership-authorization`** (`contracts.ts:25`, selected at `decision-authority.server.ts:402`); **`riskClass: "medium"`** — set explicitly at `decision-authority.server.ts:448`; `authoritySourceActorType: "human"`, `authoritySourceActorId` = the bootstrap authority actor (Alice); `proposerActorType: "human"`; `governanceLifecycleStatus: "recorded"` |
| `decision_records` | **2** | **3** | `decision_type` **`approve`** (`contracts.ts:34`), `subject_type` **`membership_authorization`** (`:37`), outcome **`membership-authorized`** (`:40`), **`bootstrap: false`**, `subject_id` = the authorization's pre-generated UUID, evidence `{ authorityVia, authorityDelegationDecisionId, intendedRoleId, intendedRoleType, membershipAuthorizationId, authorityFromBootstrapDecisionId }` |
| `membership_authorizations` | **0** | **1** | `tenantId` = Acme, `normalizedEmail` = the Director-entered value after lower+trim, `intendedRoleId` = **`a1288fe9-…`** (Acme Member), `governanceDecisionId`, `governanceSessionId`, `authorizedByActorType: "human"`, `authorizedByActorId` = Alice, **`status: "authorized"`**, `authorizedAt`, `createdBy`/`createdByType` = Alice/human |
| `audit_log` | **4** | **5** | action **`governance.membership.authorized`** (`contracts.ts:43`), `entityId` = the decision id, metadata carrying `membershipAuthorizationId`, `intendedRoleId`, `intendedRoleType` — **no email, no token, no justification duplicate** |

**`consumed_at` and `consumed_by_invitation_id` are absent from the insert entirely** (`authorize-membership.server.ts:210-223`), so both default to **NULL**. There is no code path in C2 that can set them.

**No discrepancy** between the authorization prompt's expected shape and current source. Every value above was read from the files, not assumed.

---

## 57. C2 non-effects (STEP 5)

A successful C2 creates **none** of the following:

invitation · bearer token · account · user · auth identity · credential · membership · role · permission · Governance delegation · execution authority · Computer Use · provider authority · Knowledge approval

**Proven structurally.** `authorize-membership.server.ts` imports exactly: `randomUUID`, drizzle operators, `membershipAuthorizations`, `roles`, `TenantContext`, the governance audit writer, and the governance resolver/decision writer. It does **not** import `users`, `auth_identities`, `auth_credentials`, `memberships`, `invitations`, or `isEmailClaimed`. Those tables have no reachable write path from this module.

`roles` **is** imported — but read-only, to resolve and band-check the target role. There is no `insert(roles)` or `update(roles)` anywhere in the module, so **both Owner roles and the Member role remain unchanged** (all three currently `updated_at == created_at`, §55).

---

## 58. Duplicate, race, and lifecycle (STEP 6)

Re-proved from the catalog and source; **no test data was created in `hebun_r1`.**

| Property | Proof |
| --- | --- |
| **One active authorization per tenant + email** | `membership_authorizations_one_active_per_email_uq` — `UNIQUE (tenant_id, normalized_email) WHERE status = 'authorized'` |
| **Duplicate handling** | A pre-flight read returns `already-authorized` for a live row with the same tenant + normalized email. The index is the real defence; a 23505 matched on **both** the SQLSTATE and the exact constraint name (through drizzle's `cause` wrapper) is translated to `already-authorized`, so an unrelated conflict cannot borrow it. |
| **Concurrency loser rollback** | Both racers pass the read; the index refuses the second, and its entire transaction — session, decision, authorization, audit — rolls back together. |
| **No expiry** | `membership_authorizations` has **no `expires_at` column**. Confirmed against the full column list. An authorization is durable indefinitely until consumed. (By contrast `invitations` carries `expires_at`, 72 hours.) |
| **Single-use** | `membership_authorizations_consumed_invitation_uq` (partial unique on `consumed_by_invitation_id`) plus the one-active-per-email index. Spendable exactly once. |
| **C3 consumes it** | `issueInvitation` (`human-onboarding/issue-invitation.server.ts`) sets `consumed_at` + `consumed_by_invitation_id` in the same transaction that mints the invitation. Consumption means *issuance*, not acceptance. |
| **No product revocation path** | The schema models it (`status='revoked'`, `revoked_at`, `revocation_reason`, with a CHECK), but **no runtime writes it.** Exhaustive search of non-test writers of `membershipAuthorizations` returns exactly two files: `authorize-membership.server.ts` (insert) and `issue-invitation.server.ts` (consume). **An authorization cannot be revoked through any surface today.** |

---

## 59. Director handoff (STEP 7)

### 59.1 Dev server — started, proven reachable, then it exited

The Hebun dev server had exited before this pass. It was restarted with the authorized command:

```bash
cd "/Users/senolsevim/Developer/Hebun AI/apps/dashboard" && npm run dev -- -p 4000
```

It booted and served requests:

| Check | Result |
| --- | --- |
| Boot | `▲ Next.js 16.2.10 (Turbopack)` · `✓ Ready in 316ms` · env `.env.local` · PID 41048 on port 4000 |
| `GET /login` (no cookie) | **HTTP 200** |
| `GET /governance/authority` (no cookie) | **HTTP 307 → `http://localhost:4000/login`** — the fail-closed layout gate working |
| Database side effects of the probe | **none** — sessions 2, decisions 2, authorizations 0, audit 4, roles 3, all unchanged |
| **Port 3000** | **PID 37770 (`woolmount-antique`) still listening — untouched** |

**Then the process exited, cleanly (exit code 0), as soon as this pass's foreground work finished.** Verified afterwards: port 4000 not listening, PID 41048 gone. The server log ends with the `GET /login 200` it served for the probe.

> **A dev server started from an agent pass does not survive that pass in this environment.** This is why the server has been absent at the start of the sixth, eighth and every subsequent pass. The earlier note that "a background server outlives the turn" was wrong in exactly the opposite direction — it does not.

**Consequence for the handoff:** the reachability proof above is valid — it was measured while the server was alive — but **the server is not running now.** The Director must start it in their own terminal, where it will persist, before step 1 below.

A benign startup notice appeared in the log: *"The 'middleware' file convention is deprecated. Please use 'proxy' instead."* — a Next 16 deprecation warning, unrelated to the ceremony and not acted on.

### 59.2 The procedure

0. **Start the dev server in your own terminal** (it is not running — see §59.1), and leave that terminal open:
   ```bash
   cd "/Users/senolsevim/Developer/Hebun AI/apps/dashboard" && npm run dev -- -p 4000
   ```
1. **Open** `http://localhost:4000/governance/authority` — sign in as **`alice@acme.test`** if redirected to `/login`. The Director enters the password personally; it has never been inspected, retrieved, logged, echoed, reset, rotated, or inferred by any pass of this ceremony.
2. **Find the `Authorize New Member` card** — *"This authorizes one future onboarding for the specified person and role."* The effect and eleven non-effects are shown immediately.
3. **`Intended person's email`** — the real address of the human to onboard. Stored permanently, **never verified at this step**, and **cannot be revoked afterwards** (§58). Enter it carefully.
4. **Confirm `Intended role` reads `Member`** — it resolves to `a1288fe9-0739-4217-a36e-ac9744778237` and is the only eligible option; owner/director/operator/auditor bands are excluded.
5. **`Reason`** — a genuine 24–2000 character explanation, stored permanently on the decision record.
6. **Final button:** **`Authorize New Member`**.

### 59.3 Warning — stop immediately after

> After a successful C2, the **"Authorized onboardings"** list beneath the form will render a per-row button labelled **`Issue onboarding capability`**, with the note *"Creates the capability and shows it to you once. Hebun sends nothing."*
>
> **That is C3. DO NOT CLICK IT.** It mints a live 72-hour bearer capability and consumes the authorization. It is a separate gate requiring its own Director authorization.

**No value was entered and no button was clicked by this session. C2 was not executed.**

---

## Verdict of the eighth pass (superseded — see §68)

> **PRE-C2 BACKUP VERIFIED — C2 MEMBERSHIP AUTHORIZATION READY**

**Backup:** `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c2_membership_authorization_20260814_000950.dump`
**SHA-256:** `8cebe629d2d47b1548cc65cbebe9693846bed5f88c43228e5eb5ec2c2f441370`
**Size:** 281,518 bytes · created 2026-08-14 00:09:50 · **C0.1 ✔ C0.2 ✔ C0.3 ✔ C1 ✔ C2 ✘** · not restored

Acme still holds Governance authority via bootstrap `ea49e5b8-…` (Alice, `via = bootstrap`), exactly one ordinary Member role `a1288fe9-…`, and **zero membership authorizations**. All three roles show `updated_at == created_at`. Schema clean.

Expected post-click delta: `governance_sessions` 2 → 3 (`membership-authorization`, medium) · `decision_records` 2 → 3 (`approve` / `membership_authorization`, `membership-authorized`, `bootstrap = false`) · `membership_authorizations` 0 → 1 (`status='authorized'`, `consumed_at` NULL, `consumed_by_invitation_id` NULL) · `audit_log` 4 → 5 (`governance.membership.authorized`). Nothing else changes.

The dev server was started, proven reachable (`/login` 200, `/governance/authority` 307 → `/login`), and **then exited when this pass ended** — a server started from an agent pass does not persist here. **The Director must start it in their own terminal first:** `cd apps/dashboard && npm run dev -- -p 4000`. Port 3000 belongs to an unrelated project (`woolmount-antique`) and was left untouched.

**URL:** `http://localhost:4000/governance/authority`
**Final button:** `Authorize New Member` — **then stop; the `Issue onboarding capability` button that appears is C3.**

**No membership authorization was created. No Governance decision, no session, no invitation, no token, no account, no commit, no tag, no push.**

*(As of the eighth pass: C2 had not yet been performed.)*

---

# PART NINE — C2 VERIFIED, C3 ONBOARDING CAPABILITY AUDITED

**Date:** 2026-08-14, ninth pass. **Read-only throughout** (`PGOPTIONS='-c default_transaction_read_only=on'`, guard proven live). The Director performed C2 in the browser between the eighth and ninth passes. UI evidence was treated as evidence only; every claim below comes from PostgreSQL and current source.

---

## 60. Baseline (STEP 0)

| Fact | Value |
| --- | --- |
| Root / branch | `/Users/senolsevim/Developer/Hebun AI` / `main` |
| HEAD = `origin/main` = **real remote main** | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` ✔ |
| Ahead / behind | **0 / 0** ✔ |
| Staged | none |
| Tags | 204 |
| Migration SQL / journal | **24 / 24** ✔ |
| `hebun_r1` applied migrations | **24** ✔ |
| DB target | `db=hebun_r1 host=127.0.0.1 port=55432` ✔ |

Working tree — five paths, all classified, nothing discarded: `apps/dashboard/next-env.d.ts` (generated Next 16 dev churn) plus four untracked docs including this record.

**Ports:** the Hebun dev server is **running on 4000** (PID 43235) — started by the Director, persisting because it lives in their terminal. Port 3000 remains the unrelated `woolmount-antique` project (PID 44351, self-restarted under its own tooling); untouched.

---

## 61. C2 durable delta — proven from PostgreSQL (STEP 1)

| Table | Before | After | Δ |
| --- | ---: | ---: | ---: |
| `governance_sessions` | 2 | **3** | +1 ✔ |
| `decision_records` | 2 | **3** | +1 ✔ |
| `membership_authorizations` | 0 | **1** | +1 ✔ |
| `audit_log` | 4 | **5** | +1 ✔ |

### 61.1 The new Governance session

| Column | Value |
| --- | --- |
| `id` | **`dae5736f-3cc4-40bf-9196-316c51cfe553`** |
| `tenant` | `acme` ✔ |
| **`governance_domain`** | **`membership-authorization`** ✔ |
| `decision_type` / `subject_type` | `approve` / `membership_authorization` ✔ |
| `subject_id` | `97d165f3-…` — the authorization |
| `proposer` | `human` / `d3535a0d-…` (Alice) |
| **`risk_class`** | **`medium`** ✔ — matches `decision-authority.server.ts:448` |
| **`authority_source_actor_type` / `_id`** | **`human` / `d3535a0d-…` (Alice)** ✔ |
| `voting_mode` / `gates` / `approval_chain` | NULL / NULL / NULL — no invented runtime state |
| `governance_lifecycle_status` | `recorded` |

**Distinct from both earlier sessions**, and the three form a coherent ledger:

```
aec128ed-…  authority-delegation      critical   2026-08-13 22:48:48.657031   (C0.3 bootstrap)
66217bbe-…  organizational-role       medium     2026-08-13 23:34:39.304913   (C1 member role)
dae5736f-…  membership-authorization  medium     2026-08-14 00:28:49.175396   (C2)
```

### 61.2 The C2 decision

| Column | Value |
| --- | --- |
| `id` | **`257be29e-5b58-4022-ae9c-db12129966e5`** |
| `session_id` | **`dae5736f-…`** ✔ points at the new membership-authorization session |
| `tenant` / `actor` | `acme` / `human` `alice@acme.test` ✔ |
| **`bootstrap`** | **`false`** ✔ |
| **`decision_type`** | **`approve`** ✔ |
| **`subject_type`** | **`membership_authorization`** ✔ |
| `subject_id` | `97d165f3-…` — **proven equal to the authorization row's id** ✔ |
| **`outcome`** | **`membership-authorized`** ✔ |
| `authority_source_actor_type` / `_id` | `human` / `d3535a0d-…` (Alice) ✔ |
| `decided_at` | `2026-08-14 00:28:49.156+03` |
| `version` / `lifecycle` / `gate_results` / `chain_results` | 1 / active / NULL / NULL |
| **`evidence`** | `{"authorityVia":"bootstrap","intendedRoleId":"a1288fe9-…","intendedRoleType":"member","membershipAuthorizationId":"97d165f3-…","authorityDelegationDecisionId":null,"authorityFromBootstrapDecisionId":"ea49e5b8-…"}` |
| `justification` | **140 characters**, the Director's own wording: *"Authorizing senoltr@gmail.com for one future onboarding into Acme as an ordinary Member, without granting Governance or execution authority."* |

**Authority provenance is explicit and correct:** `authorityFromBootstrapDecisionId = ea49e5b8-…` — the C0.3 bootstrap decision — with `authorityVia: "bootstrap"` and no delegation. The evidence shape matches `writeGovernanceDecisionWithin:476` plus the caller's own fields exactly.

### 61.3 The membership authorization row

| Column | Value |
| --- | --- |
| **`id`** | **`97d165f3-9962-4473-95b0-00132b1ebfbe`** |
| `tenant` | `acme` (`d2203db7-…`) ✔ |
| **`normalized_email`** | **`senoltr@gmail.com`** ✔ |
| **`intended_role_id`** | **`a1288fe9-0739-4217-a36e-ac9744778237`** — proven to be the Acme `Member`/`member` role ✔ |
| `governance_decision_id` | `257be29e-…` ✔ |
| `governance_session_id` | `dae5736f-…` ✔ |
| `authorized_by` | `human` / `alice@acme.test` ✔ |
| **`status`** | **`authorized`** ✔ |
| `authorized_at` | `2026-08-14 00:28:49.156+03` |
| **`consumed_at`** | **NULL** ✔ |
| **`consumed_by_invitation_id`** | **NULL** ✔ |
| `revoked_at` / `revocation_reason` | **NULL / NULL** ✔ — no revocation applied |
| `lifecycle_status` / `version` | `active` / 1 |
| `created_by` / `created_by_type` | `d3535a0d-…` / `human` |

**No expiry column exists** on this table — confirmed against the full column list in §63. The authorization does not lapse.

### 61.4 The new audit row

| Column | Value |
| --- | --- |
| `id` | **`cad74974-b4b5-4d3a-97ea-a9ab25e3fe43`** |
| **`action`** | **`governance.membership.authorized`** ✔ |
| `tenant` / `actor` | `acme` / `human` `alice@acme.test` ✔ |
| **`entity_type` / `entity_id`** | **`governance_decision` / `257be29e-…`** — proven to be the decision ✔ |
| `result` / `simulation` / `source` | `committed` / `false` / `governance-authority` |
| `authority_source` | `membership` ✔ |
| `session_context_id` | `44fd1254-aea0-4e8f-834d-d326a2b04c06` |
| `metadata` | `{"bootstrap":false,"subjectId":"97d165f3-…","subjectType":"membership_authorization","decisionType":"approve","intendedRoleId":"a1288fe9-…","intendedRoleType":"member","governanceSessionId":"dae5736f-…","membershipAuthorizationId":"97d165f3-…"}` |

**Email containment, measured rather than assumed:**

| Location | Contains the address? |
| --- | --- |
| `audit_log.metadata` | **false** ✔ — the G1 doctrine holds: identity and versions only |
| `decision_records.evidence` | **false** ✔ |
| `decision_records.justification` | **true** — *because the Director wrote it there* |

The system never copies the address into audit metadata or decision evidence; the authorization row owns it. The one occurrence outside that row is in the human-authored sentence, which is the Director's own choice of wording, not a system leak. Worth knowing: the justification is permanent and is shown back verbatim.

### 61.5 Timestamps — two clocks, each internally identical

| Value | Timestamp | Source |
| --- | --- | --- |
| `decision.decided_at` | `00:28:49.156` | application `now`, captured once at function entry |
| `authorization.authorized_at` | `00:28:49.156` | the same `now` |
| `audit.occurred_at` | `00:28:49.156` | the same `now` |
| `session.created_at` | `00:28:49.175396` | PostgreSQL `now()` default |
| `authorization.created_at` | `00:28:49.175396` | PostgreSQL `now()` default |
| `audit.recorded_at` | `00:28:49.175396` | PostgreSQL `now()` default |

The same pattern as C0.3 and C1, and not assumed: three rows share the application clock, three share the database clock. PostgreSQL's `now()` returns the **transaction start time**, so rows across three tables sharing `00:28:49.175396` to the microsecond prove a single transaction.

---

## 62. C2 non-effects (STEP 2)

| Table | Expected | Actual |
| --- | ---: | ---: |
| `invitations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |
| `users` | 2 | **2** ✔ |
| `auth_identities` | 2 | **2** ✔ |
| `auth_credentials` | 2 | **2** ✔ |
| `memberships` | 2 | **2** ✔ |
| `roles` | 3 | **3** ✔ |
| `permissions` / `role_permissions` | 0 / 0 | **0 / 0** ✔ |
| applied migrations | 24 | **24** ✔ |

**All three roles untouched** — every one still shows `updated_at == created_at`:

| Tenant | Role | created_at == updated_at | version |
| --- | --- | --- | ---: |
| acme | `Owner`/`owner` | `2026-08-10 10:29:12.314532` ✔ | 1 |
| globex | `Owner`/`owner` | `2026-08-10 10:29:12.334043` ✔ | 1 |
| acme | **`Member`/`member`** | `2026-08-13 23:34:39.304913` ✔ | 1 |

Memberships, users and identities all still `version = 1` at their original 2026-08-10 seed `updated_at`; both memberships still `role = Owner`. Alice's credential: `active=1 revoked=1 failed=0 locked=0 v1`.

**Governance authority unchanged:** bootstrap `ea49e5b8-…` still the sole `bootstrap = true` row; Alice resolves **`authorized = true, via = bootstrap`**; **`delegate-authority` decisions = 0**. No execution, provider, or Knowledge state was touched. `audit_log` rows with `result = 'rejected'` = **0**. Schema health: 0 invalid indexes, 0 unvalidated constraints.

---

## 63. Authorization lifecycle (STEP 3)

Proven from the catalog and source. **No duplicate rows were created in `hebun_r1` to test any of this.**

| Question | Answer |
| --- | --- |
| **Does it expire?** | **No.** The full column list contains no `expires_at` and no lapse logic: `id, created_at, created_by, created_by_type, updated_at, updated_by, updated_by_type, version, lifecycle_status, deleted_at, deleted_by, deleted_by_type, tenant_id, normalized_email, intended_role_id, governance_decision_id, governance_session_id, authorized_by_actor_type, authorized_by_actor_id, status, authorized_at, consumed_at, consumed_by_invitation_id, revoked_at, revocation_reason`. It stays live indefinitely until consumed. |
| **Is it single-use?** | **Yes.** |
| **Which constraints enforce it** | `membership_authorizations_one_active_per_email_uq` — `UNIQUE (tenant_id, normalized_email) WHERE status = 'authorized'` (one live authorization per address per tenant); `membership_authorizations_consumed_invitation_uq` — partial unique on `consumed_by_invitation_id` (one authorization per invitation); `membership_authorizations_decision_uq` — unique on `governance_decision_id`. |
| **Would a duplicate C2 for the same email refuse?** | **Yes.** A pre-flight read returns `already-authorized`; the partial unique index is the real defence, and a 23505 matched on **both** SQLSTATE and the exact constraint name is translated to the same governed refusal. |
| **Is concurrency DB-backed?** | **Yes.** The index refuses the second writer and its whole transaction — session, decision, authorization, audit — rolls back together. |
| **Does product revocation exist?** | **No.** The schema models it (`status='revoked'`, `revoked_at`, `revocation_reason` with a CHECK) but **no runtime writes it.** Exhaustive search of non-test writers of `membershipAuthorizations` returns exactly two files: `authorize-membership.server.ts` (insert) and `issue-invitation.server.ts` (consume). |
| **What consumes it?** | **C3 — `issueInvitation`.** |
| **What happens to `status` on consumption?** | It is set to **`consumed`**, with `consumed_at = now` and `consumed_by_invitation_id` = the new invitation, inside the same transaction (`issue-invitation.server.ts:168-185`). |
| **Is the email still only an unverified identifier?** | **Yes.** `authorizeMembership` imports no identity, user, membership or mailbox module; nothing has proved that anyone controls `senoltr@gmail.com`. Identity binding happens only at acceptance, by verifying a credential. |

---

## 64. PRE-C2 backup integrity (STEP 4)

| Check | Result |
| --- | --- |
| File exists | ✔ `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c2_membership_authorization_20260814_000950.dump` |
| Size | 281,518 bytes (unchanged) |
| **SHA-256** | **`8cebe629d2d47b1548cc65cbebe9693846bed5f88c43228e5eb5ec2c2f441370`** — **matches expected exactly** ✔ |
| `pg_restore -l` | succeeds, 505 TOC entries |

Archive content re-read to stdout (never `-d`): `roles` **3**, `decision_records` **2**, `governance_sessions` **2**, `audit_log` **4**, **`membership_authorizations` 0**, `invitations` 0.

Semantic point **unchanged and confirmed**: **C0.1 ✔ · C0.2 ✔ · C0.3 ✔ · C1 ✔ · C2 ✘.** **Not restored.**

---

## 65. C3 contract, audited from current source (STEP 5)

```
/governance/authority
  components/governance-authority/membership-authorization-card.tsx
    → "Authorized onboardings" list → per-row button "Issue onboarding capability"
    → issueInvitationAction({ membershipAuthorizationId })          actions.ts:181
    → resolveTenantContext(); getAuthEnvironment()
    → issueInvitation(tenant, input, { digestKey })                 issue-invitation.server.ts:76
      → resolveGovernanceAuthority(tenant)
      → authorization lookup (by id AND tenant, joined to roles)
      → randomBytes(32).toString("base64url")   ← capability minted in memory
      → digestInvitationToken(capability, key)  ← HMAC-SHA256, hex
      → db.transaction(...)
          insert invitations
          update membershipAuthorizations  (predicated consumption)
          recordInvitationIssuedWithin(tx, …) → insert audit_log
```

| # | Question | Answer from source |
| ---: | --- | --- |
| 1 | **Client input accepted?** | **Exactly one field: `membershipAuthorizationId`.** Validated against a UUID regex; anything else → `authorization-unresolvable`. |
| 2 | **Does the Director re-choose email/role?** | **No.** Both are read from the authorization row (`normalizedEmail`, `intendedRoleId`) — there is no parameter for either, so "invite this other person into that other role" has nowhere to arrive. |
| 3 | **Requires Governance authority?** | **Yes.** `resolveGovernanceAuthority` → `no-governance-authority` / `not-the-governance-authority`. Minting a bearer capability is the moment the tenant loses control of who can attempt to join, so the act belongs to the same authority that decided it. |
| 4 | **Creates a `governance_sessions` row?** | **No.** |
| 5 | **Creates a `decision_records` row?** | **No.** |
| 6 | Session domain / risk class | **N/A** — `writeGovernanceDecisionWithin`, `decisionRecords` and `governanceSessions` are **never referenced** in the module. Nothing is *decided* here; C2 already decided it. |
| 7 | **Invitation fields written** | `tenantId`, `normalizedEmail`, `intendedRoleId` (all three copied from the authorization), `inviterType: "human"`, `inviterId` = the session's user, `tokenHash`, `tokenVersion`, `status: "pending"`, `issuedAt`, `expiresAt`, `createdBy`/`createdByType`. **`last_sent_at` and `send_count` are deliberately left untouched** (defaults NULL / 0) — *"they describe a delivery Hebun cannot perform, and writing them would be a claim that it did."* |
| 8 | **Token lifetime** | **72 hours** — `INVITATION_LIFETIME_HOURS = 72`, `expiresAt = now + 72h`. |
| 9 | **Token version** | `deps.digestKey.version` — the current session-digest key version (`HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION`), stored as `token_version`. |
| 10 | **Is plaintext stored anywhere?** | **No.** Only `tokenHash` reaches the database. The plaintext exists in server memory and in the action's return value. |
| 11 | **Digest primitive** | `digestInvitationToken` — **HMAC-SHA256** over `"hebun.invitation-token.v1:" + token`, keyed by the auth digest secret, hex-encoded to 64 chars. Domain-separated from the enrollment-continuation digest, which uses its own label. `invitations.token_hash` is `char(64)` with a `^[0-9a-f]{64}$` CHECK. |
| 12 | **Shown exactly once?** | **Yes.** Returned once in `InvitationIssuanceResult.capability` and rendered into a labelled read-only field in the card's React state. |
| 13 | **Can it be re-read later?** | **No.** Nothing persists it, and no read seam exposes it — `tokenHash` appears nowhere in `features/membership-authority/` or `components/governance-authority/`. Once the component unmounts or the page reloads, it is gone. The card says so: *"it cannot be shown again."* |
| 14 | **Does Hebun send mail?** | **No.** `DELIVERY_REALITY.delivered = false`, `deliveryOwner = "none — Hebun has no mail runtime and sends nothing"`. |
| 15 | **Consumes the authorization in the same transaction?** | **Yes.** The `invitations` insert, the authorization consumption and the audit row are one `db.transaction`. |
| 16 | **What prevents double issuance?** | Three layers: the consumption `UPDATE` is predicated on `status = 'authorized'`, and zero rows throws `AuthorizationRaceLost` **inside** the transaction, unwinding the invitation with it; `membership_authorizations_consumed_invitation_uq`; and `invitations_pending_email_uq` (`UNIQUE (tenant_id, normalized_email) WHERE status = 'pending'`) → `invitation-already-pending`. |
| 17 | **Under concurrency?** | One writer wins; the loser's transaction aborts entirely and returns `authorization-already-consumed`. *"One authorization, one invitation" is true under concurrency rather than by hope.* |
| 18 | **Audit row** | **One** — action **`onboarding.invitation.issued`**, `entity_type` **`invitation`**, `entity_id` = the invitation id, `result: "committed"`, `source: "human-onboarding"`, `authority_source: "membership"`, metadata naming the authorization and the intended role. **No token, no digest, no email in the audit row.** |
| 19 | **If already consumed or revoked?** | The pre-read returns `authorization-not-live` for any status other than `authorized`; a race that slips past resolves as `authorization-already-consumed`. Nothing is written. |
| 20 | **Creates account / user / identity / credential / membership?** | **No.** The module imports only `invitations`, `membershipAuthorizations`, `roles`, the digest key type, `TenantContext`, the onboarding audit writer and the governance resolver. `users`, `auth_identities`, `auth_credentials` and `memberships` are not imported. |
| 21 | **Verifies mailbox ownership?** | **No.** Nothing in the path contacts, challenges, or validates the address. |
| 22 | **Does token possession prove identity?** | **No, and the architecture says so explicitly.** *"Possession of the capability proves possession of the capability."* Acceptance (I2) additionally requires the bearer to prove the **credential of the invited identity** — capability plus credential, never capability alone. |

**Role band is re-checked at issuance.** The lookup joins `roles` and refuses unless `roleType === 'member'` (`role-not-eligible`) — because the authorization was written at a different moment and the band is the one fact that must still hold when a capability is minted.

---

## 66. C3 security boundary (STEP 6)

> **membership authorization ≠ invitation ≠ bearer capability ≠ identity proof ≠ credential ≠ user ≠ membership**

| Level | What exists after C3 |
| --- | --- |
| **Membership authorization** | exists since C2; becomes `consumed` |
| **Invitation** | **created** — a durable `invitations` row, `status='pending'`, 72h expiry, holding only the token's HMAC digest |
| **Bearer capability** | **minted and shown once** — 32 random bytes, base64url; never stored |
| **Identity proof** | **NOT created.** Possession proves possession, nothing more |
| **Credential** | **NOT created** |
| **User / auth identity** | **NOT created** |
| **Membership** | **NOT created** |

C3 creates **only** the onboarding capability and its invitation artifact. Identity, account and membership creation remain in later, separately-gated steps (I1.2 enrollment and I2 acceptance — neither of which has a product surface today, per the Gate A record). C3 **sends nothing externally**, **does not verify email ownership**, and grants **no** Governance, execution, Computer Use, provider, or Knowledge authority.

**Who must hold the capability afterwards:** the Director. From `DELIVERY_REALITY.operatorObligation` — *"You must hand this capability to the intended human yourself, through a channel you trust. Anyone who holds it can attempt to join, and it cannot be shown again."* Issuing is not delivering.

---

## 67. PRE-C3 backup decision (STEP 7)

**A fresh PRE-C3 backup is RECOMMENDED — as a separate Director authorization. None was created in this task.**

What the two backups would mean:

| Restoring… | Erases | Preserves |
| --- | --- | --- |
| **PRE-C2** (`8cebe629…`, the newest today) | **C2 entirely** — the authorization `97d165f3-…`, its decision `257be29e-…`, its session `dae5736f-…` and its audit row — **plus anything C3 wrote** | C0.1, C0.2, C0.3, C1 |
| **A PRE-C3 backup** (does not exist yet) | only C3 | C0.1 → C2 inclusive, including the authorization in its **live `authorized`, unconsumed** state |

**C3 is a stronger one-way boundary than C2**, for three reasons:

1. **The capability is shown once and is unrecoverable.** It is never stored — only its HMAC digest is. If it is lost between issuance and delivery, no backup and no query can recover it; the only path forward would be a new authorization, which needs a new Governance decision.
2. **Consumption is irreversible through the product.** `status` moves `authorized → consumed` and there is no runtime that moves it back — the same absence of a revocation path documented in §63. A lapsed invitation does not un-spend the authorization.
3. **It occupies `invitations_pending_email_uq`.** While the invitation is `pending`, no second invitation can be issued to that address in that tenant.

Without a PRE-C3 backup, the only rollback available after issuance destroys C2 as well — and re-doing C2 means the Director re-typing the address and reason, with a new decision in the ledger. A PRE-C3 dump is the first snapshot that would preserve a live, unconsumed authorization.

---

## 68. Director handoff (STEP 8) — NOT PERFORMED

The dev server is already running on port 4000 (PID 43235, the Director's own terminal).

| Step | Action |
| --- | --- |
| **1. Open** | `http://localhost:4000/governance/authority`, signed in as **`alice@acme.test`** |
| **2. Find** | the **"Authorize New Member"** card, then the **"Authorized onboardings"** list beneath the form |
| **3. Locate the row** | for **`senoltr@gmail.com`** — intended role **Member**, status **authorized**, authorization id `97d165f3-9962-4473-95b0-00132b1ebfbe` |
| **4. Final action** | the button labelled exactly **`Issue onboarding capability`** |

**Durable consequence of that click** — one transaction:

- `invitations` **0 → 1** — `status='pending'`, `normalized_email` and `intended_role_id` copied from the authorization, `inviter` = Alice, `token_hash` (HMAC-SHA256 digest only), `token_version`, `issued_at`, **`expires_at` = issuance + 72 hours**, `send_count` 0 and `last_sent_at` NULL
- `membership_authorizations` — `97d165f3-…` moves `authorized` → **`consumed`**, with `consumed_at` and `consumed_by_invitation_id` set
- `audit_log` **5 → 6** — `onboarding.invitation.issued`, `entity_type='invitation'`
- `governance_sessions` **stays 3**, `decision_records` **stays 3** — C3 makes no Governance decision
- `roles`, `memberships`, `users`, `auth_identities`, `auth_credentials`, `identity_enrollment_requests`, `permissions`, `role_permissions` — **all unchanged**

### Capability handling — read before clicking

> **A capability string appears exactly once, immediately after the click**, in a read-only field on that card.
>
> - **Treat it as a secret.** Anyone holding it can attempt to join Acme as a Member.
> - **It cannot be shown again.** Only its HMAC digest is stored; no query, no page reload and no backup can recover the plaintext.
> - **Hebun sends nothing.** There is no mail runtime. The Director must hand it to the intended human personally, through a trusted channel.
> - **Do not paste it into chat, a log, a ticket, a commit, or this record.** Copy it straight to where it needs to go.
> - It expires **72 hours** after issuance.

**No capability was generated or revealed by this session. C3 was not executed, and no button was clicked.**

---

## Verdict of the ninth pass (superseded — see §77)

> **C2 VERIFIED — C3 ONBOARDING CAPABILITY READY FOR DIRECTOR AUTHORIZATION**
>
> *This verdict was issued before the consumption-surface check that the tenth pass performed. It is superseded: C3 is blocked.*

**Authorization row id:** **`97d165f3-9962-4473-95b0-00132b1ebfbe`**
**`status` = `authorized`** · **`consumed_at` = NULL** · **`consumed_by_invitation_id` = NULL** · `revoked_at` = NULL
Tenant Acme · `normalized_email` = `senoltr@gmail.com` · intended role = the Acme `Member` role `a1288fe9-…` · authorized by Alice, decision `257be29e-…`, session `dae5736f-…`

**Counts:** `governance_sessions` 2→3 · `decision_records` 2→3 · `membership_authorizations` 0→1 · `audit_log` 4→5. Everything else unchanged; all three roles still `updated_at == created_at`; 0 rejected audit rows; Alice still `authorized: true, via: bootstrap` with 0 delegations. PRE-C2 backup hash matches exactly and still proves C2 absent.

**Expected C3 delta:** `invitations` 0 → 1 (`pending`, 72h expiry, HMAC digest only) · authorization → `consumed` · `audit_log` 5 → 6 (`onboarding.invitation.issued`) · **no Governance decision, no session, no account, no identity, no credential, no membership.**

**PRE-C3 backup: RECOMMENDED** — the capability is unrecoverable once shown, consumption cannot be undone through the product, and today's newest backup would erase C2 along with C3.

**Human action:** `http://localhost:4000/governance/authority` → "Authorized onboardings" → the `senoltr@gmail.com` row → **`Issue onboarding capability`**.

**⚠ The capability appears once and is a secret.** Hebun sends nothing; hand it over yourself through a trusted channel; never paste it into chat, logs, or any file.

**No invitation was created. No token was minted or revealed. The authorization was not consumed. No commit, no tag, no push.**

---

# PART TEN — PRE-C3 BACKUP CREATED, C3 BLOCKED ON A MISSING CONSUMPTION SURFACE

**Date:** 2026-08-14, tenth pass. Authorized: one PRE-C3 backup, read-only verification, dev-server reuse, record append. **C3 was not executed — and must not be, for the reason in §75.**

---

## 69. Baseline (STEP 0)

| Fact | Expected | Actual |
| --- | --- | --- |
| Branch | `main` | ✔ |
| HEAD = `origin/main` = **real remote main** | — | **`9cc0c4db4c29dfb34c51f65e6f8456e6e198b912`** ✔ |
| Ahead / behind | 0 / 0 | **0 / 0** ✔ |
| Tags | — | 204 |
| Staged | none | none ✔ |
| Migration SQL / journal | 24 / 24 | **24 / 24** ✔ |
| `hebun_r1` applied | 24 | **24** ✔ |
| `governance_sessions` | 3 | **3** ✔ |
| `decision_records` | 3 | **3** ✔ |
| `audit_log` | 5 | **5** ✔ |
| `roles` | 3 | **3** ✔ |
| `memberships` | 2 | **2** ✔ |
| `membership_authorizations` | 1 | **1** ✔ |
| `invitations` | 0 | **0** ✔ |
| `identity_enrollment_requests` | 0 | **0** ✔ |

**Authorization re-proved** — id matches the expected value exactly:

| Field | Value |
| --- | --- |
| `id` | **`97d165f3-9962-4473-95b0-00132b1ebfbe`** ✔ |
| `normalized_email` | `senoltr@gmail.com` ✔ |
| intended role | Acme **`Member`/`member`** ✔ |
| `status` | **`authorized`** ✔ |
| `consumed_at` | **NULL** ✔ |
| `consumed_by_invitation_id` | **NULL** ✔ |
| `revoked_at` | NULL ✔ |

**Ports:** Hebun dev server **running on 4000** (PID 43235, the Director's terminal). Port 3000 free this pass — the unrelated `woolmount-antique` project was not running and was **never touched** by any pass.

---

## 70. PRE-C3 backup (STEP 1) — AUTHORIZED, CREATED

Client and server both **PostgreSQL 14.20 (Homebrew)**. Target proven `db=hebun_r1 host=127.0.0.1 port=55432`. No credential printed.

| Property | Value |
| --- | --- |
| **Absolute path** | `/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c3_onboarding_capability_20260814_004124.dump` |
| **Archive created** | **2026-08-14 00:41:24 +03** |
| **Byte size** | **282,396** |
| **SHA-256** | **`63e29bb24829db45efb9f5e0d46316fed2bc7f81d3464a0fcfd1bed8e669ca85`** |
| Format | CUSTOM (`pg_dump -Fc`), dump version 1.14-0 |

Target checked for prior existence; would have refused rather than overwrite. **All five earlier backups preserved** — six now on disk.

---

## 71. Backup validation (STEP 2) — NOT RESTORED

`pg_restore -l`: **505 TOC entries (501 numbered), 50 `TABLE DATA`**. Migration journal present, plus every required table: `genesis_nominations`, `decision_records`, `governance_sessions`, `audit_log`, `roles`, `memberships`, `membership_authorizations`, `invitations`, `users`, `auth_identities`, `auth_credentials`, `identity_enrollment_requests`.

### 71.1 Archive content — stdout only, never `-d`

| Table | Rows inside |
| --- | ---: |
| `genesis_nominations` | **1** |
| `decision_records` | **3** |
| `governance_sessions` | **3** |
| `roles` | **3** |
| `audit_log` | **5** |
| **`membership_authorizations`** | **1** |
| **`invitations`** | **0** |
| `identity_enrollment_requests` | **0** |
| `memberships` | 2 |

Field-level evidence pulled from the archive's own COPY blocks:

- **Decision outcomes present:** `authority-established` (C0.3) ×1, `organizational-role-provisioned` (C1) ×1, `membership-authorized` (C2) ×1 — one bootstrap decision.
- **Roles:** one `Member` row alongside the Owner rows — the Acme Member role is in the archive.
- **Authorization row:** `senoltr@gmail.com`, **`authorized`**, and the `consumed_at` / `consumed_by_invitation_id` / `revoked_at` / `revocation_reason` positions are all `\N` (**NULL**).

> **This backup represents:**
> **C0.1 ✔ · C0.2 ✔ · C0.3 ✔ · C1 ✔ · C2 ✔ · C3 ✘**
>
> It is the recovery point that **preserves C2 in its live, unconsumed state** while excluding C3. **Not restored.**

---

## 72. PRE-C3 snapshot (STEP 3)

Re-read after backup creation. **Backup creation caused zero database mutation** — identical to §69.

| Measure | Value |
| --- | ---: |
| `governance_sessions` / `decision_records` / `audit_log` | **3 / 3 / 5** |
| `roles` / `memberships` | **3 / 2** |
| `membership_authorizations` | **1** |
| — authorized **and** unconsumed | **1** |
| `invitations` / `identity_enrollment_requests` | **0 / 0** |
| `users` / `auth_identities` / `auth_credentials` | **2 / 2 / 2** |
| `permissions` / `role_permissions` | **0 / 0** |
| applied migrations | **24** |
| Invalid indexes / unvalidated constraints | **0 / 0** |

Authorization id re-confirmed as **`97d165f3-9962-4473-95b0-00132b1ebfbe`** — matches the expected value; no divergence to report.

---

## 73. C3 contract re-proved (STEP 4)

Re-read from the current working tree; every point below was confirmed again, not carried over.

| Assertion | Confirmed |
| --- | --- |
| Only client input is `membershipAuthorizationId` | ✔ UUID-validated; anything else → `authorization-unresolvable` |
| Email and Member role come from the C2 row, not the client | ✔ read from `normalizedEmail` / `intendedRoleId`; no parameter exists for either |
| Governance authority required | ✔ `resolveGovernanceAuthority` → `no-governance-authority` / `not-the-governance-authority` |
| **No new `decision_records` row** | ✔ `decisionRecords` never referenced in the module |
| **No new `governance_sessions` row** | ✔ `governanceSessions` and `writeGovernanceDecisionWithin` never referenced |
| Invitation starts `pending` | ✔ `status: "pending"` (column default also `pending`) |
| Expiry = 72 hours | ✔ `INVITATION_LIFETIME_HOURS = 72`, `expiresAt = now + 72h` |
| Secure randomness | ✔ `randomBytes(32).toString("base64url")` |
| Plaintext never persisted | ✔ only `tokenHash` is written |
| Only the digest persists | ✔ `digestInvitationToken` = HMAC-SHA256 over `"hebun.invitation-token.v1:" + token`, hex → `token_hash char(64)` |
| Capability returned/displayed once | ✔ returned in the result, held in React state |
| No read seam recovers plaintext | ✔ `tokenHash` appears nowhere in the read seam or the card |
| Hebun sends no email | ✔ `DELIVERY_REALITY.delivered = false`; `send_count` / `last_sent_at` deliberately untouched |
| Does not verify mailbox ownership | ✔ nothing in the path contacts or challenges the address |

**Expected durable delta, unchanged:** `invitations` 0 → 1 · authorization `authorized`/unconsumed → **`consumed`** with `consumed_at` and `consumed_by_invitation_id` set · `audit_log` 5 → 6 (`onboarding.invitation.issued`) · `governance_sessions` stays **3** · `decision_records` stays **3** · users / identities / credentials / memberships unchanged.

---

## 74. Single-spend and concurrency (STEP 5)

Re-proved from schema and source. **No test rows were created in `hebun_r1`.**

| Property | Enforcement |
| --- | --- |
| One authorization cannot issue two invitations | The consumption `UPDATE` is predicated on `status = 'authorized'`; zero rows throws `AuthorizationRaceLost` **inside** the transaction, unwinding the invitation and the audit row with it. Plus `membership_authorizations_consumed_invitation_uq`. |
| Conditional consumption is DB-backed | ✔ the predicate lives in the `WHERE` clause, not in an earlier read |
| A consumed authorization cannot be re-issued | ✔ the pre-read returns `authorization-not-live` for any status other than `authorized` |
| Pending-invitation uniqueness | ✔ `invitations_pending_email_uq` — `UNIQUE (tenant_id, normalized_email) WHERE status = 'pending'` → `invitation-already-pending` |
| Token-hash uniqueness | ✔ `invitations_token_hash_uq` |
| Concurrency loser fully rolls back | ✔ one transaction; the loser returns `authorization-already-consumed` and writes nothing |
| Expiry enforced | `expires_at` is stored and `invitations_expiry_chk` requires `expires_at > issued_at`; enforcement at redemption lives in the acceptance path |
| Plaintext unrecoverable after issuance | ✔ never stored; only the HMAC digest exists |

---

## 75. Next-phase boundary (STEP 7) — **THE BLOCKER**

The mission asked this precisely so that a bearer capability is not minted with nowhere legitimate to use it. **Re-verified from current source this pass, not from earlier reports — and the answer is that no such place exists.**

### 75.1 The four functions that would consume a capability have no product surface

Exhaustive search across `src/` and `tests/`:

```
startIdentityEnrollment      src/features/identity-enrollment/start-enrollment.server.ts
                             tests/i1-2-flow/enrollment-postgres.ts
                             tests/i1-2-flow/enrollment-concurrency-postgres.ts
                             tests/i2-flow/onboarding-postgres.ts
decideIdentityEnrollment     (same file + the same three test files)
completeIdentityEnrollment   (same file + the same three test files)
acceptInvitation             src/features/human-onboarding/accept-invitation.server.ts
                             tests/i2-flow/onboarding-postgres.ts
                             tests/i2-flow/onboarding-concurrency-postgres.ts
```

**Every caller outside the defining file is a test.** No route, no server action, no component.

### 75.2 The only app code importing these features is the issuance half

```
src/app/(dashboard)/governance/authority/actions.ts        → issueInvitationAction only
src/components/governance-authority/membership-authorization-card.tsx
```

Both import the **minting** side. Nothing imports the redeeming side.

### 75.3 There is no public route that could accept a capability

- Route scan for `invit|onboard|enroll|accept|join|redeem|claim` under `src/app` returns exactly one directory: **`(dashboard)/hr/onboarding`** — which is a **mock HR dashboard page**. It imports `@/features/hr/mock` and renders fake employees, access requests and equipment status. It contains no reference to invitations, capabilities, tokens or enrollment. It is not a redemption surface.
- **Public pages are exactly two:** `app/page.tsx` and `app/login/page.tsx`.
- `middleware.ts` declares `PUBLIC_PREFIXES = ["/login"]` and its matcher covers everything else — any other path redirects to `/login`.

### 75.4 Why this makes C3 unusable rather than merely incomplete

The invited human, `senoltr@gmail.com`, **has no Hebun account**: no user row, no auth identity, no credential. So they cannot sign in, cannot pass the middleware, and cannot reach any `(dashboard)` route. And there is no public route that takes a capability.

A capability issued today could therefore be redeemed **only** by invoking `startIdentityEnrollment` / `completeIdentityEnrollment` / `acceptInvitation` directly from a test harness or a script. That is not a legitimate consumption surface — it would prove the tests pass, not that the product works, and it would mean hand-driving account creation outside any product gate.

### 75.5 What clicking C3 anyway would cost

Irreversible, through the product:

1. The **authorization `97d165f3-…` becomes `consumed`** — and §63 established there is **no revocation runtime**; nothing can move it back. Re-authorizing requires a **new Governance decision** in the ledger.
2. A **live 72-hour bearer capability** would exist in the world with nowhere to be spent — a secret whose only correct handling is to be destroyed.
3. A `pending` invitation would occupy `invitations_pending_email_uq` for that address until it expires, blocking a second issuance to the same person.

The ceremony would gain an invitation row and lose a live authorization, in exchange for nothing that can be carried forward.

**This is the same gap the Gate A preflight recorded before the ceremony began** (I1.2 enrollment and I2 acceptance: IMPLEMENTED, NOT CONNECTED). The ceremony has now walked forward to exactly the point where that gap becomes load-bearing.

---

## 76. What the Director's options are

Stated plainly, without recommending a scope change beyond the ask:

- **Hold.** The authorization is durable, never expires, and is safely preserved in the PRE-C3 backup. Nothing decays by waiting. This is the state the ceremony can rest in indefinitely.
- **Build the missing surface first**, then C3. That is a development phase (a public enrollment/acceptance route plus its server actions), not a ceremony gate — and it is what would make the capability spendable through the product.
- **Proceed anyway, knowingly**, accepting §75.5. If the Director explicitly authorizes that after reading this, it becomes their call — but this pass will not perform it, and nothing here should be read as an endorsement.

---

## FINAL VERDICT

# STOP — C3 BLOCKED: NO LEGITIMATE CAPABILITY CONSUMPTION SURFACE

The PRE-C3 backup was created and fully validated:
**`/Users/senolsevim/Developer/hebun-backups/hebun_r1_pre_c3_onboarding_capability_20260814_004124.dump`**
**SHA-256 `63e29bb24829db45efb9f5e0d46316fed2bc7f81d3464a0fcfd1bed8e669ca85`** · 282,396 bytes · created 2026-08-14 00:41:24 · **C0.1 ✔ C0.2 ✔ C0.3 ✔ C1 ✔ C2 ✔ C3 ✘** · not restored.

Everything else verifies. Authorization **`97d165f3-9962-4473-95b0-00132b1ebfbe`** is still `authorized`, `consumed_at` NULL, `consumed_by_invitation_id` NULL, for `senoltr@gmail.com` into the Acme `Member` role. Counts: sessions 3, decisions 3, audit_log 5, roles 3, memberships 2, invitations 0, enrollments 0, migrations 24. Schema clean. The C3 contract re-proved exactly as documented.

**But the capability would have nowhere to go.** `startIdentityEnrollment`, `decideIdentityEnrollment`, `completeIdentityEnrollment` and `acceptInvitation` have **zero non-test callers**; the only app code importing these features imports the *issuance* half; the sole `onboarding` route is a mock HR page; and the only public prefixes are `/` and `/login`. The invited human has no account, so nothing behind the auth gate is reachable by them either.

Issuing now would consume a live authorization that **cannot be un-consumed** and mint a 72-hour secret with no legitimate destination.

**No invitation was created. No capability was generated or revealed. The authorization was not consumed. No commit, no tag, no push.**

---

# PART ELEVEN — PUBLIC ONBOARDING ENTRY SURFACE — GATE A (DISCOVERY, READ-ONLY)

Date: 2026-08-14. Scope: **discovery and architecture only.** No implementation, no migration, no C3,
no invitation, no capability, no enrollment, no commit. The ceremony remains paused before C3 and is
in exactly the state PART TEN left it in.

This pass answers the question PART TEN raised and could not answer: **what is the smallest
architecturally correct product path that lets the intended human spend a C3 capability?**

---

## 77. Baseline re-proved (STEP 0)

Read-only, from the repository and the durable database — not from the previous pass's summary.

| Fact | Value |
|---|---|
| Repository | `/Users/senolsevim/Developer/Hebun AI` |
| Branch | `main` |
| HEAD | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| `origin/main` (from `git ls-remote`) | `9cc0c4db4c29dfb34c51f65e6f8456e6e198b912` |
| Ahead / behind | `0 / 0` |
| Working tree | 1 modified (`apps/dashboard/next-env.d.ts`), 4 untracked docs — unchanged from PART TEN |
| Migration files | 24 |
| Applied (`drizzle.__drizzle_migrations`) | 24 |
| Invalid indexes | 0 |
| Unvalidated constraints | 0 |
| `tsc --noEmit` | clean |

Durable counts: `governance_sessions` 3 · `decision_records` 3 · `roles` 3 · `memberships` 2 ·
`membership_authorizations` 1 · **`invitations` 0** · **`identity_enrollment_requests` 0** ·
`users` 2 · `auth_identities` 2 · `auth_credentials` 2 · `audit_log` 5 · `genesis_nominations` 1.

The authorization, read in full and joined to its tenant and role:

```
id                        97d165f3-9962-4473-95b0-00132b1ebfbe
tenant_id / name          d2203db7-6bfb-4074-8399-03c225a27110 / Acme
normalized_email          senoltr@gmail.com
intended_role_id / name   a1288fe9-0739-4217-a36e-ac9744778237 / Member
status                    authorized
consumed_at               NULL
consumed_by_invitation_id NULL
revoked_at                NULL
lifecycle_status          active
```

**C3 has not happened.** `invitations` is empty, so no invitation exists for that authorization or
that address, and the authorization is unconsumed and unrevoked.

Auth environment: `HEBUN_AUTH_ENABLED=true`, `HEBUN_AUTH_PROVIDER=local`, digest key version 1
configured. The edge gate is live.

---

## 78. The existing onboarding authority graph (STEP 1)

Read from source in full, not from signatures. **Five functions, five files, one graph.**

```
membership_authorization  (I1 — already durable, id 97d165f3-…)
        │
        │  issueInvitation()                    src/features/human-onboarding/issue-invitation.server.ts
        │  ├─ requires  Governance authority (resolveGovernanceAuthority) + tenant session
        │  ├─ writes    invitations (pending, token_hash, expires_at = +72h)
        │  ├─ writes    membership_authorizations → consumed, consumed_by_invitation_id
        │  ├─ writes    audit_log  onboarding.invitation.issued
        │  └─ returns   the capability plaintext ONCE
        ▼
   invitation (pending)
        │
        │  startIdentityEnrollment()            src/features/identity-enrollment/start-enrollment.server.ts
        │  ├─ requires  the capability, and NOTHING else. Unauthenticated.
        │  ├─ refuses   if isEmailClaimed(invitation.normalized_email)
        │  ├─ writes    identity_enrollment_requests (pending, continuation_hash)
        │  ├─ writes    NO audit row — no honest actor exists to name
        │  └─ returns   enrollmentId + continuationReference ONCE
        ▼
   enrollment (pending)
        │
        │  decideIdentityEnrollment()           src/features/identity-enrollment/decide-enrollment.server.ts
        │  ├─ requires  Governance authority + tenant session + justification ≥ 24 chars
        │  ├─ writes    governance_sessions + decision_records (domain identity-enrollment)
        │  ├─ writes    identity_enrollment_requests → approved | rejected
        │  ├─ writes    audit_log  governance.identity.enrollment.approved | .rejected
        │  └─ creates   NO user, identity, credential, membership or session
        ▼
   enrollment (approved)
        │
        │  completeIdentityEnrollment()         src/features/identity-enrollment/complete-enrollment.server.ts
        │  ├─ requires  capability + continuationReference + password (≥ 12 chars). Unauthenticated.
        │  ├─ writes    users              (via insertLocalIdentity — Identity authority)
        │  ├─ writes    auth_identities    (provider local, issuer hebun-local, subject local:<email>)
        │  ├─ writes    auth_credentials   (via establishFirstPasswordCredential — Credential authority)
        │  ├─ writes    identity_enrollment_requests → completed
        │  ├─ writes    audit_log  identity.enrollment.completed
        │  ├─ leaves    the invitation STILL pending — it does not accept it
        │  └─ creates   NO membership and NO session
        ▼
   identity + credential, belonging nowhere
        │
        │  acceptInvitation()                   src/features/human-onboarding/accept-invitation.server.ts
        │  ├─ requires  capability + email + password. Unauthenticated — by credential, not session.
        │  ├─ writes    invitations → accepted, accepted_by_user_id
        │  ├─ writes    memberships (tenant, role and user all derived, never supplied)
        │  ├─ writes    audit_log  onboarding.membership.created
        │  └─ reads     the authorization for provenance; re-consumes NOTHING
        ▼
   membership (active, Member role, Acme)
```

Per-function detail that the surface design depends on:

| | `issueInvitation` | `startIdentityEnrollment` | `decideIdentityEnrollment` | `completeIdentityEnrollment` | `acceptInvitation` |
|---|---|---|---|---|---|
| Caller today | `governance/authority/actions.ts` | **none (tests only)** | **none (tests only)** | **none (tests only)** | **none (tests only)** |
| Actor requirement | Governance authority | none | Governance authority | none | credential proof |
| Client may supply | authorization id | capability | enrollment id, decision, justification | capability, continuation, password | capability, email, password |
| Transaction | invitation + consumption + audit | single insert | session + decision + transition + audit | user + identity + credential + transition + audit | invitation + membership + audit |
| Race control | conditional consumption (`AuthorizationRaceLost`) | partial unique `…_one_live_per_invitation_uq` | conditional transition (`EnrollmentRaceLost`) | conditional completion (`CompletionRaceLost`) | conditional acceptance (`AcceptanceRaceLost`) |
| Failure audited | no | no | rejection is (as a decision) | no | no |

**The ordering is not the obvious one.** Enrollment sits *between* issuance and acceptance, and
`completeIdentityEnrollment` deliberately leaves the invitation `pending` so that `acceptInvitation`
— the single authoritative membership writer — is still the act that consumes it. Proved by
`tests/i2-flow/onboarding-postgres.ts:333–402`, which runs exactly this sequence and asserts at
line 368–372 that after completion the human has **0 memberships** and the invitation is still
`pending`.

---

## 79. What the C3 capability actually authorizes (STEP 2)

| Question | Answer, from source |
|---|---|
| What possession proves | Possession. Nothing else. `TWO_KEY_INVARIANT.key1ProvesNot` lists it: not email ownership, not legal identity, not an authenticated identity, not credential ownership, not membership, not authority. |
| What it authorizes | To *start* an enrollment ceremony, and — combined with the continuation reference and a password — to complete one; and, combined with a credential proof, to accept the invitation. |
| Binds to tenant | Yes — `invitations.tenant_id`, copied from the authorization. |
| Binds to normalized email | Yes — `invitations.normalized_email`, CHECK-enforced lower/trim. |
| Binds to intended role | Yes — `invitations.intended_role_id`, with composite FK `invitations_tenant_role_fk`. |
| Binds to the authorization | Yes, in reverse: `membership_authorizations.consumed_by_invitation_id` → invitation. |
| Binds to an identity | **No.** Deliberately. The identity does not exist when the capability is minted. |
| Single-use | For *acceptance*, yes (conditional update on `status = 'pending'`). For *enrollment start*, one live ceremony per invitation (`identity_enrollment_requests_one_live_per_invitation_uq`). |
| Consumed when | The **authorization** is consumed at issuance. The **invitation** is consumed at acceptance. Two different events; `CONSUMPTION_SEMANTICS` states this explicitly. |
| Replay prevention | Conditional `UPDATE … WHERE status='pending' AND expires_at > now` inside the transaction; zero rows aborts everything. |
| Cross-tenant | Structurally impossible — tenant is read from the invitation row, never from input. |
| Role substitution | Impossible — role is read from the invitation row; band re-checked at acceptance against `ONBOARDING_MEMBERSHIP_ROLE_TYPE`. |
| Email substitution | The client supplies an email at acceptance, but it must match `invitations.normalized_email` after the password is proved; a mismatch returns the same `not-acceptable` as every other failure. |
| After 72 hours | `expires_at` is compared to the clock on **every** path — a predicate, never a status read, because `invitation_status='expired'` is written by nothing. |
| Expiry checked transactionally | Yes — repeated inside the conditional update at acceptance and completion. |
| Comparison | `timingSafeEqualHex` on 64-char hex, after an indexed digest lookup. |
| Only the digest persisted | Yes — `invitations.token_hash char(64)`, HMAC-SHA256 under label `hebun.invitation-token.v1`. |
| Plaintext recoverable | No. Returned once, never stored. |
| Appears in audit | No — `tests/i2-flow/onboarding-postgres.ts:302` asserts the plaintext is absent from the audit row. |
| Appears in logs | Nothing logs it today. A new surface must keep that true. |
| Appears in a URL | **Only if a new surface puts it there.** Nothing forces that, and nothing should. |

---

## 80. The pre-authentication boundary (STEP 3)

The edge gate, `src/middleware.ts`:

```ts
const PUBLIC_PREFIXES = ["/login"];
```

Everything not beneath `/login` redirects to `/login` when no session cookie is present. `/` itself
redirects to `/command`, which the gate then bounces to `/login`.

**That literal is locked by two structural tests**, which assert the exact source line:

- `tests/tenant-selection-flow/boundaries-and-firewall.ts:283–292`
- `tests/tenant-switching-flow/boundaries-and-firewall.ts:311–314`

with the message *"the public prefix list must be UNCHANGED — the picker lives under /login on
purpose"*. Widening `PUBLIC_PREFIXES` is therefore not a free edit; it is a deliberate boundary with
a test guarding it.

**The precedent already exists.** `/login/select-workspace` is a pre-authentication page that needed
no middleware change, and its own header says why:

> *"`middleware.ts` treats `/login` and everything beneath it as public, so this page needs NO change
> to route protection… Putting the picker anywhere else would have meant widening a global rule for
> one page."*

Where the unknown bearer becomes what:

| | Transition | Performed by | Exists today |
|---|---|---|---|
| A | enrollment claimant | `startIdentityEnrollment` | runtime ✔ · surface ✘ |
| B | identified human | — | **never**. Nothing verifies email ownership or legal identity. `IDENTITY_ENROLLMENT_NON_EFFECTS` says so in as many words. The Governance approval is a human-in-the-loop check, not a verification. |
| C | user (`users` row) | `completeIdentityEnrollment` → `insertLocalIdentity` | runtime ✔ · surface ✘ |
| D | auth identity | same transaction | runtime ✔ · surface ✘ |
| E | credential holder | same transaction → `establishFirstPasswordCredential` | runtime ✔ · surface ✘ |
| F | authenticated principal | `loginAction` → `issueLocalSession` | **runtime ✔ · surface ✔** — already works |
| G | tenant member | `acceptInvitation` | runtime ✔ · surface ✘ |

B is not a missing seam; it is a **stated limitation of the design**. It must not be described as
solved, and no surface may imply an address was verified.

Between E and G the human can already sign in: 0 memberships resolves to `onboarding-required`,
which lands on `/login/select-workspace` and renders *"No workspace yet"*. That state is coherent and
honest today.

---

## 81. The authoritative write map (STEP 6)

Every production writer, from an exhaustive search of `src`, `scripts` and `tests`:

| Table | Production writer | Other writers |
|---|---|---|
| `memberships` | **`accept-invitation.server.ts:270`** — the only one | `scripts/r1-seed.mjs:63` (dev seed); test fixtures |
| `users` | **`identity-repository.server.ts:216`** (`insertLocalIdentity`) | seed; test fixtures |
| `auth_identities` | **`identity-repository.server.ts:225`** (same function) | seed; test fixtures |
| `auth_credentials` | **`credential-repository.server.ts:272`** (via `establishFirstPasswordCredential`) | `scripts/auth-dev-credential.ts` (dev, quarantined) |
| `invitations` | **`issue-invitation.server.ts:139`** (insert) / `accept-invitation.server.ts:241` (accept) | test fixtures |
| `identity_enrollment_requests` | **`start-enrollment.server.ts:122`** (insert) / `decide` + `complete` (transitions) | none |

`src/features/human-onboarding/accept-invitation.server.ts` is the **only** file in `src` that
imports `@/db/schema/membership`. There is exactly one authoritative membership creation path for
new-human onboarding, and a public surface must call it rather than reproduce it.

---

## 82. The missing seams — three surfaces, not one (STEP 9)

| Capability | Designed | Implemented | Connected | Product-executable | Authoritative |
|---|---|---|---|---|---|
| membership authorization (I1) | ✔ | ✔ | ✔ | ✔ | ✔ |
| invitation issuance (C3) | ✔ | ✔ | ✔ | ✔ | ✔ |
| capability validation | ✔ | ✔ | ✔ (inside the four acts) | ✘ | ✔ |
| identity enrollment start | ✔ | ✔ | ✘ | ✘ | ✔ |
| identity enrollment decision | ✔ | ✔ | ✘ | ✘ | ✔ |
| identity enrollment completion | ✔ | ✔ | ✘ | ✘ | ✔ |
| credential creation | ✔ | ✔ | ✔ (called by completion) | ✘ | ✔ |
| invitation acceptance | ✔ | ✔ | ✘ | ✘ | ✔ |
| membership creation | ✔ | ✔ | ✔ (called by acceptance) | ✘ | ✔ |

**Nothing in the authority layer is missing.** What is missing is product:

1. **A public bearer surface** under `/login` — Acts 1 and 3 plus acceptance.
2. **A Governance-authority surface** inside `(dashboard)` for Act 2. Without it the approver has no
   way to approve, and the flow dead-ends after Act 1. PART TEN did not surface this.
3. **A list read seam.** `readPendingEnrollment(db, tenantId, enrollmentId)` exists but requires the
   approver to already know the id, and it has no caller. There is no "pending enrollments for my
   tenant" read. This is additive read-model code with an exact existing pattern to copy
   (`read-membership-authorizations.server.ts`), not a new authority.

A fourth item is a real design problem rather than a missing function: **the continuation reference
has no server-side retrieval path.** It is returned once by Act 1 and required by Act 3, and Act 2
happens in between, asynchronously, in another human's browser. The bearer must therefore hold two
secrets across an arbitrary wait. This needs a deliberate answer in the surface design; it does not
need schema.

---

## 83. Schema verdict (STEP 8)

# NO SCHEMA CHANGE REQUIRED

Every durable state the flow needs already has a table, a status, a uniqueness rule and a foreign
key: `invitations`, `identity_enrollment_requests` (statuses `pending → approved | rejected →
completed`), `users`, `auth_identities`, `auth_credentials`, `memberships`, `decision_records`,
`governance_sessions`, `audit_log`. Every transition already has an implemented, transactional,
race-controlled authority. The gap is entirely at the product boundary.

---

## 84. Proposed minimal public surface (STEP 7)

**Route: `/login/join`** — beneath the existing public prefix, exactly as `/login/select-workspace`
is. **No middleware change. No `PUBLIC_PREFIXES` edit. No locked test touched.**

Three steps on one route, driven by server-resolved state, never by a client-declared step:

```
/login/join                       POST capability            → startIdentityEnrollment
   ↓  (waits for Governance approval, out of band)
/login/join  (capability + continuation + password)          → completeIdentityEnrollment
   ↓
/login/join  (capability + email + password)                 → acceptInvitation
   ↓
/login       ordinary sign-in — now resolves to `authorized`
```

Transport decisions, and why:

| Concern | Decision |
|---|---|
| Capability transport | **POST only, in a form body.** Never a query string, never a path segment. A GET would put a live bearer secret into browser history, the `Referer` header, and any server access log. |
| Server boundary | A `"use server"` action file at `src/app/login/onboarding-actions.ts`, beside the existing `src/app/login/actions.ts`. Next.js server actions are POST-only and origin-checked. |
| Digest key | `getAuthEnvironment().sessionDigestCurrentKey`, resolved in the action exactly as `issueInvitationAction` does. Configuration is a request concern; the feature never reads `process.env`. |
| Browser state | The continuation reference is displayed once with an explicit instruction to keep it, and re-typed at Act 3 — the same contract the capability itself has. Persisting either in `localStorage` would create a third durable copy of a bearer secret on an untrusted device; nothing about this flow justifies that. |
| Refresh | Every act is idempotent-by-refusal: a second start hits the partial unique index, a second completion matches zero rows, a second acceptance matches zero rows. No act needs to be replayed to be safe. |
| Tenant / role / email | Never accepted from the client except the email at acceptance, which must match the invitation after the password is proved. |
| Error disclosure | Reuse the refusal reasons verbatim. `capability-unrecognized`, `capability-not-usable` and `not-acceptable` are already collapsed deliberately; a surface must not split them apart to be helpful. |
| PII before validation | **None.** The surface must never display the invited address, the tenant name, or the role before a proof — that would turn a stolen capability into a disclosure. |

The Governance-authority half: **extend `/governance/authority`** with a pending-enrollment card,
beside `MembershipAuthorizationCard`. It must not become a second onboarding surface — the same rule
`tests/i2-flow/boundaries-and-firewall.ts:482–486` already enforces for issuance.

---

## 85. Security threat model (STEP 10)

| Threat | Status |
|---|---|
| Stolen capability | **Intentionally not eliminated.** `TWO_KEY_INVARIANT.deliveryLimitation` states it: a token stolen before Act 1 lets the thief be the submitter. The Governance second key reduces it to a human-in-the-loop check with a veto. Must be repeated on the surface, not hidden. |
| Capability in URL / history / referrer | **Requires surface-level mitigation.** POST-only transport is the whole mitigation, and it is a design rule, not a runtime guarantee. |
| Capability in logs | Already prevented in the runtime; **the surface must not reintroduce it** (no `console.log`, no error message echoing input). |
| Capability in audit | Already prevented — asserted by test. |
| Replay | **Prevented by runtime** — conditional updates on `pending` + unexpired, in-transaction. |
| Brute force of the capability | 256-bit random, HMAC digest, indexed lookup, constant-time confirm. Guessing is infeasible. **But there is no rate limiting anywhere in this repository** — `grep` for `rateLimit`/`throttle` returns only provider config. Unbounded attempts are possible and cheap; the entropy is what protects it, not a limiter. State this rather than claim a limiter exists. |
| Account enumeration | **Prevented by runtime** — every authentication-shaped failure returns `not-acceptable` and spends equal scrypt work via `spendEquivalentCredentialWork`. The surface must not add a distinguishing message. |
| Credential stuffing | Per-credential durable lockout: 5 failed attempts → 15 minutes (`CREDENTIAL_FAILED_ATTEMPT_THRESHOLD`, `CREDENTIAL_LOCKOUT_SECONDS`). No distributed protection — already documented as a `local`-mode limitation. |
| Cross-tenant substitution | **Structurally prevented** — tenant never leaves the invitation row. |
| Role substitution | **Structurally prevented** — role read from the row, band re-checked at acceptance. |
| Email substitution | **Prevented** — compared after the password proof, same refusal either way. |
| CSRF | Server actions are POST-only with Next.js origin checking. No session exists to fix or ride at Acts 1 and 3, so there is nothing to elevate. |
| Session fixation | Not applicable — no session is issued by any of the four acts. Sign-in happens afterwards through the existing path. |
| Duplicate enrollment | **Prevented** — `identity_enrollment_requests_one_live_per_invitation_uq`, plus `isEmailClaimed` at Act 1 and `users_email_uq` at Act 3. |
| Concurrent acceptance | **Prevented** — conditional acceptance takes the invitation row lock first; loser gets `capability-not-usable`. |
| Expired capability | **Prevented** — predicate, not status read, on every path. |
| Consumed capability | **Prevented** — same conditional update. |
| Compromised authorized email | **Out of scope by design.** Hebun never verifies address control and never sends anything. |
| Operator sends it to the wrong person | **Intentionally unsupported.** There is no revocation runtime for a membership authorization (§63), and an invitation revocation path exists in the schema (`revoked_at`, `revocation_reason`) with **no runtime writer**. Correcting a misdelivery today means waiting 72 hours for expiry. |

---

## 86. Product flow, end to end (STEP 11)

| # | Who | What proves their authority | Durable mutation | Which runtime |
|---|---|---|---|---|
| 1 | Alice | tenant session + Governance authority | invitation; authorization → consumed; audit | `issueInvitation` (C3) |
| 2 | Alice | — | none | capability shown once; handed over out of band |
| 3 | Bearer | possession of the capability | `identity_enrollment_requests` (pending) | `startIdentityEnrollment` — **surface MISSING** |
| 4 | Bearer | — | none | continuation reference shown once; bearer keeps it |
| 5 | Alice | tenant session + Governance authority | governance session + decision + status → approved + audit | `decideIdentityEnrollment` — **surface MISSING** |
| 6 | Bearer | capability + continuation + a chosen password | `users` + `auth_identities` + `auth_credentials` + status → completed + audit | `completeIdentityEnrollment` — **surface MISSING** |
| 7 | Bearer | capability + email + password | invitation → accepted; `memberships` (active, Member, Acme); audit | `acceptInvitation` — **surface MISSING** |
| 8 | New member | email + password | session row | `loginAction` → `issueLocalSession` → `authorized` — **exists today** |

Step 8 resolves to `authorized` because the human then holds exactly one active membership. Between
6 and 7 they can already sign in and will correctly see *"No workspace yet"*.

---

## 87. Implementation plan (STEP 12) — NOT IMPLEMENTED

**A. Public route / UI**

| Path | Action | Responsibility |
|---|---|---|
| `src/app/login/join/page.tsx` | create | Server component. Renders the bearer card. Takes **no** `searchParams`. Must not contain the string `human-onboarding` — `tests/i2-flow/boundaries-and-firewall.ts:482` asserts no `page.tsx` does. |
| `src/components/auth/onboarding-entry-card.tsx` | create | `"use client"`. Three-step form. May **not** contain the string `identity-enrollment` (`tests/i1-2-flow/boundaries-and-firewall.ts:491–495`) nor import the onboarding `.server` modules (`tests/i2-flow/…:452–463`). Wording sourced from frozen contract values passed in as props. |

**B. Server boundary**

| Path | Action | Responsibility |
|---|---|---|
| `src/app/login/onboarding-actions.ts` | create | `"use server"`. Four thin actions resolving `getAuthEnvironment()` and delegating to the existing authorities. No validation of its own beyond presence. |
| `src/app/(dashboard)/governance/authority/actions.ts` | modify | Add `decideIdentityEnrollmentAction`, matching the existing pattern exactly (`resolveTenantContext` → feature → `revalidatePath`). |

**C. Existing runtime reuse — called, never reimplemented**

`startIdentityEnrollment`, `decideIdentityEnrollment`, `completeIdentityEnrollment`,
`acceptInvitation`, `getAuthEnvironment`. Plus **one new read seam**:
`src/features/identity-enrollment/read-pending-enrollments.server.ts`, modelled on
`read-membership-authorizations.server.ts` — authority-gated, tenant-scoped, returning identity and
timing only, never the invited address and never the continuation digest (the constraint
`readPendingEnrollment`'s own header already states).

**D. Governance surface**

`src/components/governance-authority/pending-enrollment-card.tsx` — create, rendered from
`/governance/authority/page.tsx` under the same `viewerIsGovernanceAuthority` guard the other cards
use.

**E. Tests** — a new `tests/onboarding-entry-flow/` with a postgres flow test driving all four acts
through the actions, plus a boundaries-and-firewall test asserting: `PUBLIC_PREFIXES` unchanged; the
page lives under `src/app/login/`; the page takes no `searchParams`; no capability in any redirect,
log or audit; no delivery claim; no PII before proof.

**F. Documentation** — a closure record in `docs/product-vision/runtime/`. No new architecture
document is warranted; this section is the architecture record.

---

## 88. Ceremony impact (STEP 13)

The repository supports the intended model exactly:

```
C0.1 ✔  C0.2 ✔  C0.3 ✔  C1 ✔  C2 ✔  C3 PAUSED
        ↓  build + prove the surfaces (no C3, no schema, no ceremony state touched)
        ↓  durable state returns unchanged — the phase writes nothing to hebun_r1
        ↓  Director performs C3
        ↓  the capability now has a legitimate destination
```

The build phase touches **no ceremony table**. `invitations` and `identity_enrollment_requests` stay
at 0 in `hebun_r1`; flow tests run against their own throwaway databases, as every prior phase's did.
The authorization never expires, so the pause costs nothing. The PRE-C3 backup remains the rollback
point and was **not** restored.

One correction to PART TEN's framing: the missing work is **three surfaces plus one read seam**, not
"a public enrollment/acceptance route". The Governance-side approval surface for Act 2 is equally
load-bearing — a public route alone would let a bearer start a ceremony that nobody can approve.

---

## FINAL VERDICT OF THE ELEVENTH PASS

# GATE A PASS — PUBLIC ONBOARDING SURFACE IMPLEMENTATION READY

No schema change is required. No authority is missing. No new token format, authentication mechanism
or membership writer is needed. The four consumption authorities are implemented, transactional,
race-controlled and proven end to end by `tests/i2-flow/onboarding-postgres.ts`; what they lack is a
product surface, and one can be added beneath the existing `/login` public prefix without touching
`PUBLIC_PREFIXES`, middleware, or any locked structural test.

**A Gate A pass does not authorize implementation.** Nothing was built in this pass.

**No C3. No invitation. No capability. No enrollment. No user, identity, credential or membership.
No migration. No commit, tag or push.** `hebun_r1` was read and never written.
