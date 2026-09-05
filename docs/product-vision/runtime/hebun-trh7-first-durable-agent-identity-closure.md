# TRH-7 — Turkish Rug House First Durable Agent Identity — CLOSED / PRODUCTION-ACCEPTED

**One durable agent identity established through the released in-product ceremony** · **ZERO schema** ·
**ZERO source change** · **Production migration ledger 47, unchanged** · **Production cluster**
`7675444875863894887` / `neondb` · **Predecessor** [TRH-4](hebun-trh4-first-knowledge-ratification-closure.md)
at `27b4b6f`

**Both halves are accepted, and they were accepted by different means.** The rendered half was
accepted by the **Director**, performing the irreversible one-shot ceremony on the real
authenticated production `/agents` surface inside the Turkish Rug House tenant. The machine half was
measured afterwards, read-only, through transaction-scoped `BEGIN READ ONLY`. **No browser
automation ran, this record claims none, and no part of this acceptance invoked the writer.**

---

## What Hebun can now do that it could not

    Before:  Turkish Rug House had Knowledge and Governance, and no agent that could author anything
    After:   the same organization has one durable, human-owned agent identity
             — which holds no credential, no session, no permission and no runtime

**The second clause is the phase.** An identity was created so that future Work artifacts can
truthfully record *who wrote the bytes* while the human remains the authorization authority. It
bought exactly one thing: its own existence.

---

## Director-rendered evidence

Active workspace **Turkish Rug House**; name **Heby**; the page reported **IN SERVICE** and **YOU
OWN THIS**; the creation ceremony is now closed; and the surface stated:

> Durable identity established: Heby. It holds no credential, no session, no permission and no
> runtime.

Agent mandate showed **EMPTY / no mandate recorded**. The Director recorded no mandate, created no
Work, prepared no artifact, connected no provider, and authorized no external action.

**That screen is Director-rendered evidence and is not by itself durable production acceptance.**
Every claim above is corroborated below by a column.

---

## Machine-verified durable state

### The identity

| | |
|---|---|
| id | `67f4460c-0d44-4ae7-a3ed-729c705e2609` |
| tenant | Turkish Rug House |
| `name` | **`Heby`** — byte-exact, length 4 |
| `human_owner_type` / `human_owner_id` | `human` / **the Director** |
| `created_by` / `created_by_type` | **the Director** / `human` |
| `created_at` == `updated_at` | `2026-09-05T18:26:18.541Z` |
| `retired_at` · `replaced_by_agent_id` · `deleted_at` · `suspended_at` | **all NULL** |
| `version` | 1 |

### What the writer did NOT invent

Six columns carry a value. **Every one of the other forty-five is NULL or a schema default**, and
that is the phase's point — a missing fact stays missing rather than being invented:

    department_id            NULL      role                   NULL
    manager_actor_type/_id   NULL      agent_lifecycle_status NULL
    agent_health             NULL      agent_type             NULL
    risk_level               NULL      authority_ceiling      NULL
    execution_posture        NULL      execution_defaults     NULL
    tool_profile             NULL      provider_profile       NULL
    preferred_providers      NULL      preferred_models       NULL
    allowed_tools            NULL      required_capabilities  NULL
    working_memory_profile   NULL      long_term_memory_profile NULL
    knowledge_profile        NULL      reasoning_profile      NULL
    learning_profile         NULL      cost_limits            NULL
    performance_targets      NULL      telemetry_profile      NULL
    …and every remaining runtime/cognitive column

`lifecycle_status = active`, `config_version = 1`, `agent_profile_version = 1` are the schema's own
defaults on the shared root columns, not values this ceremony chose.

**No department, no manager, no role, no authority ceiling, no health, no risk, no posture, and none
of the fifteen cognitive/runtime profiles.** This agent has no manager, no cognition and no runtime,
and the record says so by staying silent.

### IN SERVICE — the UI agrees with the authoritative derivation

`inService` is **derived, never stored**: the absence of retirement.

    retired_at IS NULL                          true
    agent_lifecycle_status <> 'retired'         true  (it is NULL)
    ──────────────────────────────────────────────────
    in_service                                  TRUE

The rendered **IN SERVICE** badge and the authoritative rule return the same answer for the same
reason. Nothing was inferred from the screenshot.

---

## Genesis is now spent

TRH `agents` **0 → 1**. The released predicate is **existence itself**, not name collision:

```
lock table agents in share row exclusive mode   -- serialize FIRST
select count(*) from agents where tenant_id = … -- then count
count > 0  ->  refused: agent-identity-already-exists
```

The order is the guarantee, because `agents` carries no unique index and an unlocked pre-check would
let two callers both read zero. Proven under real concurrency by
`agent-id-0/identity-postgres` — *"one-shot held under concurrency."*

**Retirement would not reopen it.** Soft-deleted and retired rows still count: *"A tenant that once
had a durable agent identity is not a tenant that never had one, and this ceremony must not be
re-openable by a delete."* Proven by `agent-id-0-1/retirement-postgres` — *"genesis still spent."*
There is no reinstatement, no successor, **and no rename authority**: the name Turkish Rug House
typed is the name this identity keeps.

**No second creation was attempted to demonstrate the refusal.** The predicate, the lock and the
tests establish it without spending anything.

---

## Tenant isolation — `SAME NAME != SAME IDENTITY`

Two rows named `Heby` exist in production. They are unrelated:

| | Hebun AI | Turkish Rug House |
|---|---|---|
| id | `4ffeeb83-022c-44c9-b98a-6cf13bc1b78d` | `67f4460c-0d44-4ae7-a3ed-729c705e2609` |
| tenant | `f625b683…` | `9947c78e…` |
| created | 2026-08-27 | 2026-09-05 |
| `replaced_by_agent_id` | NULL | NULL |
| `department_id` / `manager_actor_id` | NULL / NULL | NULL / NULL |

**Different row ids, different tenants, independent ownership, and no column on either points at the
other.** The Hebun AI row was not reused, not modified and not referenced: its tenant still holds
exactly 1 agent, its newest agent timestamp is still `2026-08-27T13:53:14.981Z`, and its
`audit_log` is still 50. No credential, provider, mandate or authorization is shared, because the
new identity holds none of those to share.

Isolation is structural rather than enforced: the writer takes **no tenant parameter and no owner
parameter**, so naming another organization's agent is unrepresentable.

---

## Non-effects, measured

TRH after the ceremony:

    agent_mandates              0      work_items                 0
    work_artifacts              0      integrations               0
    integration_credentials     0      heby_action_requests       0
    action_permits              0      action_execution_attempts  0
    role_permissions            0      decision_records           2  (unchanged)
    governance_sessions         2  (unchanged)
    knowledge_facts / _nodes    5 / 5  (unchanged)

**Knowledge impact: none.** **Governance impact: none** — no decision was created and none consumed;
the ratified `trh-product-offering` v1 is untouched. **Provider impact: none** — no integration, no
credential; the two deployment-wide provider controls are unchanged at `version 1` with August
timestamps. **Execution impact: none** — no request, no permit, no attempt, no external send.

**Google Drive is NOT connected. Higgsfield does not exist in this repository at any level.**
Neither was touched, and this record claims neither.

Each ladder rung proved separately:

| Claim | Evidence |
|---|---|
| `IDENTITY CREATED != AUTHENTICATED` | no credential and no session row exists for it; the surface says so, and there is no agent authentication anywhere in Hebun |
| `IDENTITY CREATED != AUTHORIZED` | `role_permissions` 0, no membership, no Governance decision; the seven human-only CHECK constraints are untouched |
| `IDENTITY CREATED != RUNTIME AVAILABLE` | every runtime and cognitive profile column is NULL |
| `IDENTITY CREATED != EXECUTABLE` | `action_permits` 0 and `action_execution_attempts` 0; execution requires a permit this identity cannot obtain |

---

## Mandate — absent, and NOT required by the next workflow

Production agrees with the surface: **TRH holds zero agent mandates.** None was created.

**A mandate is a ceiling, not an authorization**, and it is enforced on the **action-request /
origination** path — `agent-origination/originate-action.server.ts` and
`action-authorization/record-action-request.server.ts`. Work-artifact preparation consults it
**nowhere**: a search of the whole `work-artifacts` feature for any mandate reference returns
nothing.

So the next intended workflow —

    TRH Knowledge -> internal Work -> Heby-authored content-draft -> human review -> STOP

— **requires no mandate**, because it originates no action request. The `/agents` surface exposes a
mandate form; that the form exists is not a reason to fill it in, and offering `send` or
`record-work` in that form grants neither. **No mandate is recommended by this closure.**

---

## Audit — the ledger event is absent, and this is recorded rather than repaired

    GENESIS ROW        = DURABLE / SELF-ATTRIBUTING
    AUDIT LEDGER EVENT = ABSENT

TRH `audit_log` is **9 before and 9 after**. The genesis writer contains zero audit references.

The act is **not unrecorded**: the `agents` row carries `created_by`, `created_by_type` and
`created_at`, so who established it and when are durable facts on the row itself. What is missing is
the **ledger entry**.

**Classification: B — known architectural debt.** The evidence for that reading is inside the same
subsystem: the only agent-related audit rows in production are Hebun AI's
`agent-mandate.established` and `agent-mandate.revised` from 2026-08-31. The *adjacent* agent
authority audits; genesis does not. That asymmetry is more consistent with debt than with a
deliberate semantic choice — but it is a claim about intent, and intent is not in the repository, so
it is recorded as a reading rather than as a finding.

**No audit event was fabricated, none was retrofitted into historical production, and the writer was
not modified to make this closure look tidier.** Repair requires its own architectural decision.

---

## What this does NOT prove

**It does not prove Heby can do anything.** It can be recorded as an author; it cannot authenticate,
decide, connect, spend or execute. Authorship is not authority, and the human `TenantContext` remains
the authorization context for every request.

**It does not prove artifact preparation end to end for TRH.** No artifact was prepared, because
manufacturing organizational work to demonstrate a capability would be inventing evidence. That
`resolveAgentAuthorship` now has an in-service identity to resolve is proven by the derivation above
plus `agent-runtime-0/attribution-postgres`, not by a production artifact.

**It opens no provider, no publication path and no TRH-8.**

---

## Verification

Eight released suites re-run at `27b4b6f`, **all passing**:

    agent-id-0/identity-postgres                one-shot held under concurrency
    agent-id-0/boundaries-and-firewall          one transition, one table, no second authority
    agent-id-0-1/retirement-postgres            withdrawn from service, genesis still spent
    agent-id-ceremony-disclosure/…completeness  nine facts before the click, byte-identical
    agent-runtime-0/attribution-postgres        durable agent attribution
    agent-runtime-0/boundaries-and-firewall     authorship is not authority
    ama1-agent-mandate/mandate-firewall         mandate is a ceiling
    cgo3-agent-content-preparation              agent content preparation boundary

A grep across all of `src` finds **exactly one `insert(agents)`** — one genesis authority, no second
one.

**Residual limitation: route-level `/agents` rendered acceptance remains UNPROVEN by test.** The card
is mounted behind a `genesisSpent` predicate and the disclosure is asserted from its source, but no
test renders the route for an eligible user. Source-text and component evidence are **not**
route-level acceptance, and this record does not call them that. The Director's rendered observation
remains the only evidence that the ceremony paints.

---

## The ladder, exact

    IDENTITY EXISTS != AUTHENTICATED != AUTHORIZED != RUNTIME AVAILABLE != EXECUTABLE

    Turkish Rug House / Heby, 67f4460c…:
      EXISTS            YES   — one durable row, human-owned, in service
      AUTHENTICATED     NO    — no credential, no session; none can be issued
      AUTHORIZED        NO    — no permission, role, mandate or Governance authority
      RUNTIME AVAILABLE NO    — every runtime and cognitive profile column NULL
      EXECUTABLE        NO    — no permit, no execution attempt, no provider

    DIRECTOR-RENDERED   the ceremony screen, IN SERVICE, YOU OWN THIS, the closing sentence
    MACHINE-VERIFIED    every column, count, isolation check and non-effect above
