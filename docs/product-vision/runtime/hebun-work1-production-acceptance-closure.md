# WORK-1 — Organizational Work Authority · Production Acceptance

**Era III, third program (Organizational Work), production acceptance.** Hebun holds one real unit
of this organization's work, in production, recorded by the accountable human through the
authoritative surface.

**Release commit:** `ecf91d2`. **Deployed and observed commit:** `ecf91d2` — **identical**, so there
is no runtime delta to measure.
**Production migration ledger:** **41 → 42.**
**Release validation:** 630 passed / 0 failed / 630 total, at `ecf91d2`. **Not rerun here.**

**WORK-1 IS PRODUCTION-ACCEPTED,** with one limitation recorded rather than smoothed over (§7).

---

## 1 · Status, term by term

```
PRODUCTION MIGRATED       YES   ledger 41 -> 42, prefix verdict `converged`, digest 19f0f971…
SCHEMA VERIFIED           YES   independently, by constraint and index, not by command success
AUTHORITATIVE WRITE       YES   one real work item, by the accountable human, through the product
TENANT / REFERENCE        YES   correct tenant, in-service department, eligible human
AUDIT                     YES   one event, atomic, correctly attributed
NON-EFFECTS               YES   the ONLY audit event in the window is this one
PRODUCT SURFACE           YES   /director/work, on the deployed release commit
HUMAN OBSERVATION         YES   Director-observed
HUMAN ELIGIBILITY         PARTIAL — happy path production-proved; refusal path NOT executed (§6)
DECLARED-STATE MUTATION   NOT EXECUTED IN PRODUCTION (§7)
PRODUCTION-ACCEPTED       YES
```

---

## 2 · The migration

Run by the Director at a TTY via the released `platform:migrate`. It refuses piped stdin by design
and no attempt was made to bypass it. The pre-flight `pg_dump` version gate fired again — local
`pg_dump` was 14.20 against a server at 18.6 — and was cleared by putting `postgresql@18` first on
`PATH`, exactly as at OSA-2 and AMA-4. **The gate is now three-for-three at catching this.**

| | before | after |
|---|---|---|
| ledger applied | 41 | **42** |
| prefix verdict | `pending` (1) | **`converged`** |
| digest | `42186bb31b22a719a9b57b528ed42161` | **`19f0f97195c4cdc17fca61e736f0fe44`** |
| target | cluster `7675444875863894887`, database `neondb` | unchanged |
| public base tables | 63 | **64** |

Convergence was **re-verified independently** after the ceremony rather than taken from its report:
the released `verifyCanonicalMigrationPrefix` was run against production and returned `converged`,
42 applied, by per-file sha256 — not by count.

**Exactly one migration was pending, and it was the released one.** The file on disk is
byte-identical to the copy committed at `ecf91d2` (sha256 `81681fd47bdb0f61…`).

**Additive-only, measured rather than asserted.** The migration contains **zero** `DROP`,
`TRUNCATE`, `DELETE`, `INSERT` and `UPDATE` statements; both of its two `ALTER TABLE` statements name
`work_items`, the table it creates. `departments`, `agents` and every other released table were left
untouched, and the base-table count moved by exactly one.

---

## 3 · Production schema truth

Every released WORK-1 constraint verified present **and validated** on the real schema.

| constraint | production |
|---|---|
| `work_items_tenant_id_uq` | UNIQUE `(tenant_id, id)` — the composite anchor |
| `work_items_tenant_department_fk` | `(tenant_id, department_id) → departments(tenant_id, id)`, `ON DELETE RESTRICT` — validated |
| `work_items_tenant_id_companies_id_fk` | `(tenant_id) → companies(id)` — validated |
| `work_items_human_accountable_chk` | `CHECK (accountable_actor_type IS NULL OR = 'human')` — **validated** |
| `work_items_accountable_pair_chk` | `CHECK ((type IS NULL) = (id IS NULL))` — validated |
| `work_items_title_chk` | `CHECK (char_length(btrim(title)) > 0)` — validated |
| `work_items_tenant_created_idx` | `(tenant_id, created_at)` |
| `work_items_tenant_department_idx` | `(tenant_id, department_id)` |

`work_declared_state` exists in production with **exactly** `planned, active, blocked, complete`, in
that order. `work_items` carries 18 columns, which is the released shape.

**The dead work island is still dead in production.** `tasks`, `goals`, `plans`, `missions`,
`workflows`, `commands`, `executions` and `reasoning_traces` all hold **zero rows** after the
migration, as they did before it.

---

## 4 · The real work item

Recorded by the Director through `/director/work` on the deployed release commit. **Real work, not a
fixture** — no artificial item was created to satisfy this ceremony.

```
id                : 978efb64-c85a-4109-b8d6-ca6843fc322a
tenant            : Hebun AI (f625b683-3be5-40eb-93a4-53fc56ab38c9)
title             : "Hebun Era III development"
department        : Engineering (e40866a8-…, lifecycle active)
accountable       : human d5b496df-… — a CURRENTLY ELIGIBLE member, re-derived here
declared_state    : active
lifecycle_status  : active
version           : 1
created_by / type : d5b496df-… / human
updated_by / type : d5b496df-… / human
created_at        : 2026-09-01T14:23:21.224Z
updated_at        : 2026-09-01T14:23:21.224Z   (equal — no mutation after creation)
deleted_at        : null
```

Eligibility was re-derived against production with the full six-condition rule — membership tenant,
status, `revoked_at`, membership lifecycle, identity lifecycle and `deleted_at` — and the accountable
human satisfies all six. **No name and no email was read to establish that**; the query projects a
count.

`version = 1` and `created_at = updated_at` are the evidence that this row was written once, in one
act, and never touched again.

---

## 5 · Audit

```
2026-09-01T14:23:21.222Z | work.recorded | actor human d5b496df-… | result committed
                         | simulation false | authority_source membership | source organizational-work
                         | metadata {"departmentId":"e40866a8-…","declaredState":"active",
                                     "accountableActorId":"d5b496df-…"}
```

**One event, and exactly the one that was performed.** No `work.retitled`, no `work.state-declared`
and no `work.accountable-set` row exists — because none of those acts happened. Accountability and
the department were set at creation and travel in the `work.recorded` metadata, which is the released
shape.

The audit timestamp precedes the row timestamp by 2ms and both sit inside one transaction, which is
what "atomic with the mutation" looks like from outside.

`authority_source = membership` — the administrative-act value OSA-1 and R6D use. **No Governance
decision was written, and that is the design.**

**The audit holds no copy of the title**, as designed: history says THAT a named identity was
recorded, never keeps a second copy of what it said.

---

## 6 · Non-effects — measured by the window, not by a remembered baseline

A before/after delta needs a baseline captured at exactly the right instant. This uses a stronger
method that needs none: **every non-effect table was asked how many rows it gained inside the
acceptance window**, and the whole audit ledger was asked what it recorded in that window.

**Rows created in the window: ZERO, in all twenty tables** — `decision_records`,
`governance_sessions`, `heby_action_requests`, `action_permits`, `action_execution_attempts`,
`knowledge_nodes`, `knowledge_facts`, `knowledge_external_references`, `agent_mandates`, `agents`,
`work_artifacts`, `external_recipients`, `integration_credentials`, `integrations`, `memberships`,
`users`, `companies`, `departments`, `roles`, `role_permissions`.

**The entire `audit_log` in that window contains exactly one row: `work_item / work.recorded`.**

That is the whole non-effect claim, proved in one line: nothing else in Hebun moved. No provider was
called, no external send occurred, and none was required.

---

## 7 · What was NOT proved in production, and why

**Declared-state MUTATION was not exercised.** The acceptance plan suggested moving the item to
`blocked` and back. The Director declined, because "Hebun Era III development" is genuinely active
and is not blocked, and **falsifying organizational truth to complete a ceremony is worse than an
incomplete ceremony**. The item was recorded directly as `active` in one act, so `version` is 1 and
no `work.state-declared` event exists.

What this costs, stated exactly: `setWorkDeclaredState` is proved by the released targeted suite
against real PostgreSQL — every one of the four values, a `complete → planned` transition proving
there is no transition graph, and a refusal of a value outside the vocabulary — and it is proved
**nowhere in production**. It is a gap in production evidence, not a gap in the guarantee.

It closes for free the first time this organization's work legitimately changes state.

**The ineligible-human refusal was NOT executed in production.** Production holds exactly one user,
one membership, and **zero already-ineligible members** of this tenant. There was no safe subject,
and manufacturing one would have meant revoking or soft-deleting the organization's only human
identity to satisfy a test. That was refused.

Recorded instead, precisely:

- production destructive eligibility test **NOT EXECUTED** — no safe subject existed
- writer enforcement **verified by released targeted tests**, which drive all five ways of becoming
  ineligible against a real database and assert the writer refuses each with
  `accountable-not-eligible-member`
- the production **happy path** is verified: the accountable human satisfies all six conditions

`THE UI HIDING SOMEBODY IS NOT ENFORCEMENT` remains proved by mechanism, not by a production
attempt.

---

## 8 · Acceptance classification

```
SCHEMA                        PASS
AUTHORITATIVE WRITE           PASS
TENANT / REFERENCE INTEGRITY  PASS
HUMAN ELIGIBILITY             PARTIAL   happy path proved; refusal path not executed (§7)
AUDIT                         PASS
NON-EFFECTS                   PASS
PRODUCT SURFACE               PASS
HUMAN OBSERVATION             PASS

WORK-1                        PRODUCTION-ACCEPTED
```

`HUMAN ELIGIBILITY` is `PARTIAL` and does not block acceptance: the missing half is a **refusal**
proved by mechanism and by released tests, and executing it in production would have required
damaging real identity state.

---

## 9 · Continuity — unchanged by this ceremony

```
WORK-2 (Heby grounding for work):   NOT STARTED / NOT AUTHORIZED
Pin-debt cleanup:                   NOT STARTED / NOT AUTHORIZED
APF (Agent Plurality Foundation):   DEFERRED
Agent #2:                           NOT JUSTIFIED / NOT CREATED
Governed Internal Action:           DEFERRED
GitHub PR reachability:             STRANDED / not started
ASA:                                BLOCKED / DEFERRED
```

Production ledger now **42**. Checkout and production are **converged** for the first time since the
WORK-1 release.
