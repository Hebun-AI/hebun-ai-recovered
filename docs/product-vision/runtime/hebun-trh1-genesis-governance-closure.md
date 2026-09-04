# TRH-1 — Turkish Rug House Genesis & Governance — CLOSED / PRODUCTION-ACCEPTED

**Ceremonies** G2.1 genesis nomination under the G4 production posture, then two authenticated
in-product acts · **ZERO schema** · **ZERO source change** · **Production migration ledger 47,
unchanged** · **Production cluster** `7675444875863894887` / `neondb`

**Both halves are accepted, and they were accepted by different means.** The data half was measured
read-only from an operator shell. The rendered half was accepted by the **Director**, inspecting the
real authenticated production Governance surfaces. Neither half is an automated browser test, and
this record claims none.

---

## What Hebun can now do that it could not

Turkish Rug House existed and could decide nothing. Every consequential act inside it was refused,
because `decideActionRequest` asks only `resolveGovernanceAuthority(tenant)` and a tenant owner
without Governance authority is refused exactly like a stranger.

    Before:  a second organization with a root, one role, one membership, and NO authority
    After:   a second organization whose first Governance authority exists and resides in a named human

**The bootstrap is per tenant, and this is the measurement that proves it.** It was performed once
for Tenant Zero on 2026-08-19 and once for Turkish Rug House on 2026-09-04, against the same
released code, with no schema change between them. What was previously a claim read off two partial
unique indexes is now a repeated act.

---

## Three acts, three authorities, and the six minutes between two of them

| # | Act | Authority | Root | Wrote |
|---|---|---|---|---|
| 1 | Genesis nomination | G2.1 ceremony | **deployment possession** | `genesis_nominations` 1 row, `pending` |
| 2 | Genesis acceptance | `governance-genesis`, in-product | **the authenticated human** | `pending → accepted` + 1 audit row |
| 3 | Governance establishment | `governance-decision`, in-product | **the authenticated human** | `governance_sessions` 1, `decision_records` 1, entitlement consumed, + 1 audit row |

**Acts 2 and 3 are separated by six minutes and seventeen seconds in the production audit log.** That
is not inferred from counts; it is two rows with different actions, different entity types and
different timestamps.

---

## Genesis — final state, measured

| | |
|---|---|
| Nomination | `adafcb1b-b71a-4f4c-8502-3340babca3da` — exactly one for this tenant |
| `status` | `accepted` |
| `nomination_source` | `production-operator-ceremony` |
| `nominated_user_id` | `d5b496df-588c-49c5-9cc2-17672b82dd10` |
| `accepted_at` | populated |
| `accepted_session_context_id` | populated |
| `accepted_assurance_level` | `aal1` |
| `updated_by_type` | `human` |
| `consumed_at` | populated |
| `consumed_by_decision_id` | `7303974e-6e67-4fe9-b0f9-a111b622bb5c` |
| `created_by` | **NULL** |

`created_by` is NULL on a row a human later accepted, and that is the whole constitutional chain in
two columns: **possession is a SOURCE and never an ACTOR**, so the terminal that nominated named no
person, while `updated_by_type = 'human'` records the person who accepted.

The consumed decision id is **the TRH bootstrap decision id**, matched below. The entitlement was not
merely marked spent; it names what spent it.

## Governance — final state, measured

| | |
|---|---|
| Governance session | `9fd71f57-c257-4991-bc83-3db3db3b893e` — TRH `governance_sessions` **0 → 1** |
| `governance_domain` | `authority-delegation` |
| Bootstrap decision | `7303974e-6e67-4fe9-b0f9-a111b622bb5c` — TRH `decision_records` **0 → 1** |
| `bootstrap` | **true**, and it is the only one |
| `decision_type` | `certify` |
| `subject_type` / `subject_id` | `tenant` / `9947c78e-2080-4331-81c6-456cb4be7a96` |
| `actor_type` / `actor_id` | `human` / `d5b496df-588c-49c5-9cc2-17672b82dd10` |
| `outcome` | `authority-established` |
| `authority_source_actor_type` / `_id` | **NULL** |
| `decided_at` | `2026-09-04 18:35:37.277+00` |

All four stored values match the released contract constants exactly, so the row is the vocabulary
and not a coincidence:

    BOOTSTRAP_GOVERNANCE_DOMAIN = "authority-delegation"   → session.governance_domain
    BOOTSTRAP_DECISION_TYPE     = "certify"                → decision_type
    BOOTSTRAP_SUBJECT_TYPE      = "tenant"                 → subject_type
    BOOTSTRAP_OUTCOME           = "authority-established"  → outcome

**`authority_source_actor_*` is NULL and that is correct, not missing.** A genesis decision is the
first authority in a tenant, so there was no prior authority to decide under. The same two columns
are NULL on Tenant Zero's genesis for the same reason.

**A precision note on the rendered label.** The Director's surface reads *"certify · genesis"*. The
stored governance domain is `authority-delegation`; `genesis` is the product's word for a bootstrap
decision, not a value in any column. Recorded so a later reader does not go looking for a stored
`genesis` domain.

### The justification, stored verbatim

> Establish the first Governance authority for Turkish Rug House so consequential organizational
> decisions have an explicit human authority and governed decision boundary.

Byte-identical to what the Director typed. It is the ONLY client-supplied input in the entire act —
tenant, actor, identity, session, bootstrap flag, decision type, domain, subject, timestamps and
authority source are all resolved or fixed server-side.

## `resolveGovernanceAuthority(TRH)` — what it now returns, and how that is known

The released resolver reads exactly one thing:

```sql
SELECT id, actor_type, actor_id FROM decision_records
WHERE tenant_id = <session tenant> AND bootstrap = true LIMIT 1
```

and returns `authorized: true, via: "bootstrap"` when `actor_type = 'human'` and
`actor_id = tenant.userId`. The measured row satisfies both for the Director's TRH session.

**That is a derivation from the released code path plus a measured row — the function was not
invoked against production from this shell.** The runtime confirmation is the Director's own: the
Governance surface rendered *"Governance authority exists for this tenant, and it resides in you"*
and listed the current human under Active Governance Authorities. Derivation and observation agree;
they are recorded as two different kinds of evidence rather than merged into one claim.

## Audit — two governed records, not one

| Action | Actor | Entity | Authority source | Result | Simulation | Occurred |
|---|---|---|---|---|---|---|
| `governance.genesis-nomination.accepted` | `human` `d5b496df` | `genesis_nomination` `adafcb1b` | `membership` | `committed` | false | `18:29:20.596+00` |
| `governance.bootstrap.established` | `human` `d5b496df` | `governance_decision` `7303974e` | `membership` | `committed` | false | `18:35:37.277+00` |

TRH `audit_log` **0 → 2**. The nomination ceremony wrote none, and could not: `actor_id` and
`actor_type` are NOT NULL there and possession has no honest actor to name. So the ledger contains
exactly the two acts a person performed, and neither the act a terminal performed.

---

## Cross-tenant non-effects, measured

| Claim | Measured |
|---|---|
| Hebun AI genesis nomination | unchanged — `accepted`, consumed by its own decision `8e290360` |
| Hebun AI bootstrap decision | unchanged — `8e290360`, decided `2026-08-19 07:38:48+00` |
| Hebun AI Governance state | `decision_records` **7**, `governance_sessions` **7**, bootstrap **1** — all unchanged |
| Hebun AI `audit_log` | **50**, unchanged |
| Both `companies` rows | `version 1`; TRH `updated_at` still `17:04:18` — its birth, **before** either governed act |
| `provider_connectivity_controls` | `claude` and `external-send`, both `version 1`, timestamps 2026-08-25 / 2026-08-31 — **untouched** |
| `users` / `auth_identities` / `auth_credentials` | **1 / 1 / 1** — no human, identity or credential created |
| `memberships` | `hebun` 1, `turkish-rug-house` 1 — unchanged |
| `roles` | `hebun` Member + Owner, `turkish-rug-house` **Owner only** |
| `permissions` / `role_permissions` | **0 / 0** |
| Ratified knowledge facts | **0** |
| TRH Work / Artifacts / Knowledge / integrations / credentials / recipients / agents / departments / placements / invitations / membership authorizations | **0**, every one |
| Migration ledger | **47**, unchanged |

The strongest of these is the `companies` row: TRH's `version` is still 1 and its `updated_at` is
still its 17:04 birth, while the two governed acts happened at 18:29 and 18:35. Governance was
established **around** the tenant row without writing to it.

---

## What TRH Governance now means, and what it does not

**It means** one named human may make Governance decisions inside Turkish Rug House, and that
`resolveGovernanceAuthority` will say so. That is the gate every consequential act in this tenant
asks about, so acts that were structurally refused are now *reachable* — not performed, not
authorized in advance, and not queued.

**It does not mean, and none of it was created:**

- **No member role.** `roles` for TRH is Owner alone. Provision Member Role remains a separate,
  explicit Governance act and was not performed.
- **No onboarding capability.** With no ordinary member role, Authorize New Member cannot yet
  authorize anything. `invitations` and `membership_authorizations` are both 0.
- **No delegation.** Delegating Governance is a separate capability on the same surface and was not
  used; a delegation would be a second decision record, and TRH holds exactly one.
- **No permissions.** `permissions` and `role_permissions` are 0 platform-wide.
- **No Knowledge ratified.** Zero facts carry a ratification decision.
- **No provider access, no Computer Use, no shell, no browser, no terminal, no execution authority.**
  None of these are granted by a decision record, and `establishGovernanceAuthority` imports no
  module that could grant them.
- **No department, agent, Work item, artifact, integration, credential, recipient, invitation or
  new human.**

    EXISTS != CONFIGURED != CONNECTED != AVAILABLE != AUTHORIZED != EXECUTED != SUCCESSFUL

TRH has moved exactly one rung: from EXISTS to **AUTHORIZED for governance decisions**. It is still
not CONFIGURED and still not CONNECTED, and no act has been EXECUTED under the new authority.

**The deployment-wide switches are unchanged and are still a ceiling.** `external-send` and `claude`
carry no tenant and were already enabled. TRH now having Governance does not turn either into a TRH
capability: a send there would still require a permit bound to a TRH artifact revision and a TRH
recipient, and TRH has neither.

---

## Production acceptance — DATA HALF, ACCEPTED

Counts through the released `npm run platform:preflight` seam, which reads no row content and writes
nothing in any posture. Row content through read-only SQL — **a separate verification path, not a
sanctioned product seam**, and named as such because the preflight structurally cannot answer which
tenant holds a nomination or what a justification says.

Every claim above was measured. Nothing was written by any part of this acceptance.

## Production acceptance — RENDERED HALF, ACCEPTED BY THE DIRECTOR

**Director UI acceptance: PASS.** The real authenticated production surfaces were inspected by a
person. No browser automation ran, no screenshot was produced by this session, and none is claimed.

| Surface | Observed |
|---|---|
| `/governance/genesis` (TRH) | The nomination was visibly present for the signed-in human, and was reviewed and accepted |
| after acceptance | *"This tenant's genesis nomination has been accepted. Acceptance happens once."* and *"Accepted. You are recorded as the human eligible to establish this tenant's first Governance authority. **No Governance decision exists yet.**"* |
| Governance Authority surface | Showed the accepted entitlement and **required a separate justification** before establishment |
| after establishment | *"Governance authority exists for this tenant, and it resides in you."* · ESTABLISHED `2026-09-04 18:35:37 UTC` · DECISION `certify · genesis` · the justification above · *"No Knowledge was ratified and no permission was created."* · Active Governance Authorities lists the current human as the genesis authority |
| same surface, not used | Delegate Governance Authority · Provision Member Role · Authorize New Member — all present as separate capabilities, none clicked. Enrollment submissions and improvement hypotheses awaiting decision: both empty |

**The rendered half proved the one thing data alone could not:** the product itself said *"No
Governance decision exists yet"* between the two acts. Acceptance and establishment are separate not
because two rows have different timestamps, but because the surface refused to conflate them while a
human was standing in front of it.

Every rendered claim is corroborated by a measured row. The establishment timestamp the UI displayed
matches `decided_at` to the second, and the justification matches byte for byte.

---

## Remaining limitations

1. **`provider_connectivity_controls` remain deployment-wide.** Two tenants cannot hold different
   provider postures, and both switches were already open.
2. **Per-tenant model-spend attribution is UNKNOWN.** Not measured, not claimed.
3. **No Meta/Instagram provider exists**, in either tenant.
4. **Genesis has no withdrawal, expiry or cancellation.** The `revoked` status exists in the enum and
   is read, but no code path writes it — the accepted, consumed nomination is permanent.
5. **The bootstrap decision is one per tenant, forever**, by `decision_records_one_bootstrap_per_tenant_uq`.
6. **Hard delete is still unavailable**; suspension is the only tenant recovery, and the slug stays claimed.
7. **`resolveGovernanceAuthority(TRH)` was derived, not invoked** from this shell — see the section above.
8. **The full test suite was not run.** This phase changed no source file; the repository effect is
   this document alone.

---

## Repository effects

    docs only, zero schema, zero migration, zero source change

**CLOSED / PRODUCTION-ACCEPTED.**

Next, and only on a separate Director decision: whether Turkish Rug House needs an ordinary member
role, a department, or anything else. Nothing in this record authorizes any of them, and nothing in
it was created toward them.
