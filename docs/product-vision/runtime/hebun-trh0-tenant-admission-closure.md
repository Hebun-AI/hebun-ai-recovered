# TRH-0 — Turkish Rug House Tenant Admission — PROVISIONED / DATA-ACCEPTED / UI-ACCEPTANCE-PENDING

**Ceremony** R4A tenant provisioning under the G4 production posture · **DOC-1 prerequisite**
`79bee6b` · **ZERO schema** · **Production migration ledger 47, unchanged** · **Production cluster**
`7675444875863894887` / `neondb` · **Deployment** `dpl` alias `hebun-ai-recovered-njnnaykeo`,
running `79bee6b` on `main`, production, Ready

**This is not a closure.** The data half is accepted and measured below. The rendered half — the
Director inspecting the real authenticated production UI — has **not happened**, and this record
claims none of it.

---

## What changed in the world

Hebun held one organization. It now holds two, and the second one is **empty**.

    Before:  companies 1 — Hebun AI
    After:   companies 2 — Hebun AI, Turkish Rug House

Turkish Rug House is a separate real business the Director operates. TRH-0's own admission gate
established that recording TRH's work inside the Hebun AI tenant would mix organizational truth, and
that the repository's recorded intent was always a separate tenant. This is that tenant coming into
existence, and **nothing else**.

---

## The tenant

| | |
|---|---|
| `id` | `9947c78e-2080-4331-81c6-456cb4be7a96` |
| `name` | `Turkish Rug House` |
| `slug` | `turkish-rug-house` |
| `tenant_status` | `active` |
| `provisioning_source` | `production-operator-ceremony` |
| `version` | `1` |
| `created_by` | **NULL** |
| `created_at` | `2026-09-04 17:04:18.208389+00` |

`created_by` is NULL and that is the truthful value, not a gap: **possession is a SOURCE and never an
ACTOR**. Hebun cannot cryptographically identify the human at the terminal, so the row records WHICH
ROOT produced it and never WHO ran it. For the same reason no `audit_log` event exists —
`actor_id` and `actor_type` are both NOT NULL there and no enum value means "no verified actor".
`provisioning_source` is the only evidence this ceremony leaves, which is why it had to be right.

---

## The exact footprint, measured

The ceremony writes three tables in one transaction and then flips the status inside that same
transaction. Measured against the pre-ceremony baseline taken through `npm run platform:preflight`
in the same session:

| Surface | Before | After | Delta |
|---|---|---|---|
| `companies` | 1 | **2** | **+1** |
| `roles` | 2 | **3** | **+1** |
| `memberships` | 1 | **2** | **+1** |
| `users` | 1 | **1** | **0** |
| `auth_identities` | 1 | **1** | **0** |
| `auth_credentials` | 1 | **1** | **0** |
| `genesis_nominations` | 1 | **1** | **0** |
| `provider_connectivity_controls` | 2 | **2** | **0** |
| `agents` | 1 | **1** | **0** |
| `audit_log` | 50 | **50** | **0** |
| migration ledger | 47 applied | **47 applied** | **0** |

Three rows and one in-transaction status update. Nothing else moved.

## The Owner role and the membership

```
slug                | name  | type  | system_role | created_by
hebun               | Member| member| f           | not null      (baseline, product authority)
hebun               | Owner | owner | f           | NULL          (R4A bootstrap)
turkish-rug-house   | Owner | owner | f           | NULL          (R4A bootstrap)
```

TRH holds **exactly one role**. The `member` baseline role does not exist there and was not created —
it is provisioned by a Governance-gated product authority that TRH does not yet have.

```
slug                | user_id                              | status | role  | invitation | created_by
hebun               | d5b496df-588c-49c5-9cc2-17672b82dd10 | active | Owner | NULL       | NULL
turkish-rug-house   | d5b496df-588c-49c5-9cc2-17672b82dd10 | active | Owner | NULL       | NULL
```

**The user id is the same on both rows.** That is the proof that the existing global human was
reused rather than duplicated, and it is stronger than the unchanged `users` count: a count of 1
would also be satisfied by a membership pointing at nobody, and identity of the id is not.

`accepted_invitation_id` is NULL on both, truthfully — no invitation exists.
`memberships_accepted_invitation_uq` is a plain UNIQUE and PostgreSQL treats NULLs as distinct, so
bootstrap memberships coexist without fabricating an invitation id.

`users` uses `rootColumns` and carries a GLOBAL unique on email, so one address names at most one
human installation-wide. One human, two tenants, through memberships — which is the model the
repository has always described.

---

## What provisioning did NOT create — measured, per tenant

Every tenant-scoped surface, counted for both tenants in one read:

| Surface | `hebun` | `turkish-rug-house` |
|---|---|---|
| `governance_sessions` | 7 | **0** |
| `decision_records` | 7 | **0** |
| `genesis_nominations` | 1 | **0** |
| `departments` | 1 | **0** |
| `department_placements` | 1 | **0** |
| `agents` | 1 | **0** |
| `work_items` | 2 | **0** |
| `work_artifacts` | 7 | **0** |
| `work_artifact_revisions` | 7 | **0** |
| `work_evidence_references` | 2 | **0** |
| `knowledge_nodes` | 2 | **0** |
| `knowledge_facts` | 2 | **0** |
| `integrations` | 3 | **0** |
| `integration_credentials` | 21 | **0** |
| `external_recipients` | 1 | **0** |
| `heby_action_requests` | 5 | **0** |
| `action_permits` | 2 | **0** |
| `action_execution_attempts` | 1 | **0** |
| `audit_log` | 50 | **0** |

**Nineteen surfaces, nineteen zeroes.** No governance authority, no session, no decision, no genesis
nomination, no department, no agent, no Work, no Artifact, no Knowledge, no integration, no
credential, no recipient, no capability, no audit event.

Provider capability follows connection state, and TRH holds zero `integrations` rows — so every
provider capability in TRH resolves `unavailable`, by the same released reader that answers for
Hebun AI. **No provider connection was inherited**, because inheritance has no representation:
`integrations` is scoped to `tenant_id` and its own header states that two tenants may hold live
connections to the same account without sharing one.

---

## Tenant Zero non-effects — measured, not inferred

Isolation is not claimed from TRH's zeroes. It is measured on Hebun AI's own row.

| Proof | Measured |
|---|---|
| Hebun AI `companies.version` | **1** |
| Hebun AI `companies.updated_at` | **2026-08-18 22:00:19+00** — its own birth, **seventeen days before** TRH |
| Hebun AI `tenant_status_changed_at` | **2026-08-18 22:00:19+00**, identical |
| Newest `audit_log` row, whole database | **2026-09-03 20:30:13+00** — a full day **before** TRH's birth |
| Hebun AI counts, all nineteen surfaces | unchanged, listed above |

A row whose `version` is still 1 and whose `updated_at` is still its creation timestamp was not
written to. That is a stronger statement than "the counts match", because a count can be restored by
a delete and a version cannot be un-advanced.

The audit log's newest entry predating the ceremony proves the same thing from the other side: no act
of any kind was recorded in the window, by any actor, in either tenant.

## Deployment-wide provider controls — unchanged, and one of them is ARMED

```
provider_key   | director_enabled | version | updated_at                     | control_source
claude         | t                | 1       | 2026-08-25 10:15:32.841721+00  | production-operator-ceremony
external-send  | t                | 1       | 2026-08-31 10:02:30.691024+00  | production-operator-ceremony
```

Both rows are at `version 1` with timestamps predating TRH by days. **TRH admission armed nothing and
disarmed nothing**, exactly as the admission contract required.

**Stated plainly because it is the live limitation, not a hypothetical one:** these rows use
`rootColumns` and carry no tenant. There is exactly one row per provider for the whole deployment and
every tenant reads it. `external-send` is currently `director_enabled = true` and has been since
2026-08-31. So the send switch is **already open for TRH**, and it became open for TRH the moment the
tenant existed, without anybody deciding that.

That is a ceiling and not an authority. TRH cannot execute a send today because a send additionally
requires TRH Governance authority, a TRH permit, a TRH recipient and a TRH artifact revision, and TRH
has none of them. But the switch itself is not per-tenant and cannot be made per-tenant without a
capability nobody has built.

---

## What this admission does NOT establish

    TENANT EXISTS  !=  CONFIGURED  !=  CONNECTED  !=  CAPABILITY AVAILABLE
                   !=  AUTHORIZED  !=  EXECUTED   !=  SUCCESSFUL

Turkish Rug House is an **empty production organization**. It has a root, one role and one
membership. It has no governance, so every consequential act inside it is refused — `decideActionRequest`
asks only `resolveGovernanceAuthority(tenant)`, and a tenant owner without Governance authority is
refused exactly like a stranger.

**Governance was deliberately deferred.** Genesis nomination and acceptance are a separate Director
decision, and this record does not perform, schedule or recommend them. The tenant's existence and
its isolation are what is being accepted here.

**No Meta/Instagram provider exists**, in either tenant. A content draft's `intended_destination` is a
declaration and never a connection: no social provider is connectable in Hebun, no account is named
or linked by declaring a destination, nothing is scheduled and nothing is published. TRH inherits
that limitation because it is the platform's, not the tenant's.

---

## Production acceptance — DATA HALF, ACCEPTED

Read-only, through the released `npm run platform:preflight` seam for the counts and through
read-only SQL for the row content the preflight deliberately does not read. Both halves of the read
were taken against the pinned production target, verified by system identifier and database name
before either ran. **Nothing was written by any part of this acceptance.**

Twenty-seven checks were required by the acceptance contract. Twenty-seven pass.

## Production acceptance — RENDERED HALF, PENDING

**Not performed, not simulated, not claimed.** The Director must inspect the real authenticated
production surface and confirm, in this order:

1. `/foundation` lists **Turkish Rug House** as an available workspace.
2. Switching into it succeeds.
3. In TRH: `/director/work` is empty; Hebun AI's two work items do not appear; `/operations` shows
   none of Hebun AI's seven artifacts; Knowledge shows no Hebun AI record; integrations show no
   inherited connection or credential.
4. Switching back to Hebun AI succeeds.
5. Hebun AI's work items and artifacts reappear.

What a person confirms they saw is different in kind from what a query asserts, and this record does
not collapse the two. No browser automation ran against the authenticated surface at any point in
this phase, no screenshot was produced, and none is claimed.

---

## Repository effects

    DOC-1 prerequisite   79bee6b   four ceremony headers corrected, comments only, zero executable delta
    this record          docs only, zero schema, zero migration, zero source change

DOC-1 landed before the ceremony because three of the four corrected comments described this exact
ceremony as development-only and unable to reach a non-local database. An operator reading them
before pointing a ceremony at production is the failure that repair existed to prevent.

**PROVISIONED / DATA-ACCEPTED / UI-ACCEPTANCE-PENDING.**

Next, and only on a separate Director decision: TRH genesis nomination and Governance establishment.
Nothing in this record authorizes them.
