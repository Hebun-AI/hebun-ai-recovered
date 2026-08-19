# Governance Runtime Re-Proof — Closure

**Status:** RELEASED. Runtime proof only — **zero schema, zero migration, zero source change, zero new authority.**
**Suite:** 414 passed, 0 failed. Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean.
**Canonical:** `hebun_r1` byte-identical — 31/31 ledger, 57 tables, all counts unchanged. Zero disposable residue.
**Production:** one ordinary Governance decision executed. **Provider DISARMED. No Knowledge. No membership. No permission.**

G6A established the government. G6B asks whether it governs.

---

## What this gate is

An architecture audit followed by the narrowest real Governance act the existing runtime permits. **Not one file in `src/` or `scripts/` changed.** The repository contribution is this record.

## What the audit found, before anything was executed

Five capabilities were traced to their authoritative writers and classified against production, rather than assumed from the prompt:

| Capability | Verdict |
|---|---|
| Authority resolution | **executable** |
| Audit recording | **executable**, transactional inside every writer |
| Ordinary decision (`ratify` / `reject`) | **UNAVAILABLE — no legitimate subject** |
| Knowledge ratification | **UNAVAILABLE — no legitimate subject** |
| Membership authorization | **BLOCKED — prerequisite, then a real human** |

**Three of the five could not be exercised, and that is the architecture being coherent rather than broken.**

`GOVERNANCE_SUBJECT_TYPES` is a closed vocabulary of exactly one entry, `knowledge_node`, and `subjectExistsInTenant` requires a real row in the caller's tenant. Production holds zero Knowledge. An ordinary decision and a ratification are therefore both unreachable, and seeding a fact to reach them would have manufactured the organizational truth the act was supposed to test.

Membership authorization permits onboarding only into role type `member`; `owner` is explicitly excluded. Tenant Zero's only role was `Owner`, so I1 refused with its own tenant-role-baseline gap — the gap I1.1 was built to close. Past that it needs a real second person's email, which was not invented.

## Authority ownership: one resolver, no exceptions

Every Governance-gated writer in the repository calls `resolveGovernanceAuthority` and nothing else:

decision recording · delegation · revocation · membership authorization · role baseline · invitation issuance · invitation revocation · identity-enrollment decisions · Knowledge ratification · action-request decisions · action-permit revocation.

No second resolver exists. No path authorizes on `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions` or `role_permissions`. Membership authorization *does* read `roles.type` — for the **target band**, never the caller's authority. Conflating those two questions is exactly what would have re-invented a role-based authority model, and the module's own header says so.

## The act

`provisionMemberRole` — the tenant's ordinary member role, performed by the bootstrap authority through `/governance/authority`. Its only input is a human-authored justification; the role's name and type are constants, so "provision an owner role" is unsayable rather than filtered.

One transaction wrote: a governance session, an `approve` decision, the `roles` row, and the audit event.

## What the two decisions prove side by side

This is the finding worth keeping. Production now holds exactly two Governance decisions, and the constitutional chain is visible in their own columns:

| | genesis | member role |
|---|---|---|
| `governance_domain` | `authority-delegation` | `organizational-role` |
| `decision_type` / `subject_type` | `certify` / `tenant` | `approve` / `role` |
| `bootstrap` | **true** | false |
| `risk_class` | `critical` | `medium` |
| **`authority_source_actor_*`** | **NULL** | **the human** |

The genesis names no authority source because there was none to name. The role baseline names one, because by then the genesis had created it. **G6A asserted that in prose; G6B shows it in two rows.**

The same distinction appears in `roles`: `Owner` carries `created_by` NULL — a possession ceremony wrote it — and `Member` carries `created_by` = the human, `created_by_type` `human`. One table, two roots, each truthful about itself.

## Audit continuity

Production's audit history is three rows, in order, each bound to the record it describes:

| action | entity | source | authority_source | result |
|---|---|---|---|---|
| `governance.genesis-nomination.accepted` | the nomination | `governance-genesis` | `membership` | committed |
| `governance.bootstrap.established` | the genesis decision | `governance-authority` | `membership` | committed |
| `governance.role.provisioned` | the role decision | `governance-authority` | `membership` | committed |

All three: `actor_type` human, `actor_id` the bootstrap human, `tenant_id` Tenant Zero, `simulation` false, each carrying its `session_context_id` and its `governanceSessionId`. No audit row was backfilled; each was written inside its own act's transaction.

## Firewalls, counted after the act

`permissions` 0 · `role_permissions` 0 · `memberships` **1, unchanged** · `invitations` 0 · `providers` 0 · `provider_connectivity_controls` 0 · `executions` 0 · `action_permits` 0 · `action_execution_attempts` 0 · `knowledge_nodes` 0 · `knowledge_facts` 0 · `knowledge_edges` 0.

43 of 57 tables remain empty. The delta is exactly `roles` 1→2, `decision_records` 1→2, `governance_sessions` 1→2, `audit_log` 2→3. Nothing else moved.

The authority roster still lists **one** authority. Provisioning a role granted nobody anything — `member` appears in no connected authority set in the repository.

## One-shot, proved without replaying production

The refusal path writes no audit row, so a replay would have been safe — but the invariants were read directly from the production database instead, which is stronger than an attempt:

```
CREATE UNIQUE INDEX roles_one_member_per_tenant_uq
  ON public.roles USING btree (tenant_id) WHERE (type = 'member'::role_type)

CREATE UNIQUE INDEX decision_records_one_bootstrap_per_tenant_uq
  ON public.decision_records USING btree (tenant_id) WHERE bootstrap

CHECK decision_records_bootstrap_human_chk
  CHECK (((bootstrap = false) OR (actor_type = 'human'::actor_type)))
```

## Non-authority refusal, re-proved against production

By calling the released resolver, read-only:

| context | result |
|---|---|
| bootstrap human, Tenant Zero | `authorized: true, via: "bootstrap"` |
| different user id, Tenant Zero | `authorized: false, via: "none"` |
| same human, another tenant | `authorized: false`, no bootstrap found |
| anonymous | `authorized: false` |

## Bite-proofs

Twelve boundaries, every touched file restored byte-identically with sha256 verified.

**BIT (10):** tenant predicate dropped from the role existence read · role baseline stops requiring Governance · ordinary decision accepts an unauthorized caller · membership authorization drops the target-band check (*"owner is not an onboarding-eligible band"*) · role baseline stops writing its audit row · role baseline also inserts a permission · role baseline inserts a provider control row (*"no provider mutation"*) · a Heby surface imports Governance decision authority · ordinary decision marks Knowledge ratified (*"recording a ratify decision must not touch Knowledge — that binding is K4"*) · resolver falls back to the owner role band (*"role band alone cannot govern"*).

**DID NOT BITE (2), and neither is a weakness:**

- **Client-supplied decision actor is UNREPRESENTABLE.** `writeGovernanceDecisionWithin`'s input is `{decisionType, subjectType, subjectId, justification, evidence?}` — there is no actor parameter to mutate. The actor is `tenant.userId` from the session. Expressing the attack would require inventing the parameter, which is the security property itself.
- **Ratification's unratified SQL predicate is one of three layers.** The in-transaction application read refuses `already-ratified` first, and a zero-row check on the predicated update is the race gate. Removing one leaves two.

**Six earlier attempts produced no verdict and were corrected rather than reported.** Four had anchors that did not match the source. Two were ineffective by construction: `eq(...) || true` evaluates to the same truthy SQL object, and widening a TypeScript type changes no runtime behaviour. A mutation that does not alter behaviour is not a passing test — it is no test at all.

## Heby

**NOT CONNECTED.** No Heby module imports `governance-decision`, `bootstrap-authority` or `decision-authority`; no Heby command names a Governance mutation; the G2 mock gate withholds the overview entirely for an authenticated tenant. Heby did not become a Governance authority, cannot make decisions, cannot ratify Knowledge and gained no execution authority. Connection belongs to G6C and was not attempted.

## What still does not exist

No delegated authority. No second human, membership, invitation or authorization. No Knowledge, therefore no ratification and no ordinary `ratify`/`reject` decision. No permission, no role hierarchy. No provider, execution or Computer Use. The `member` role exists and confers nothing.

## The exact G6C entry condition

Two independent things gate Heby seeing Governance: the G2 mock gate withholds the Director overview whenever a real tenant is authenticated, and Heby's source resolver has **no Governance source class at all** — only Operations and Platform are backed, and both read that withheld overview. G6C begins by deciding which authoritative projection Heby may ground on, and connecting exactly that one.
