# AP-2 — Agent Placement (Organization Authority)

**Status: CLOSED / PRODUCTION-VERIFIED (2026-10-07).**

| Claim | State |
|---|---|
| Implemented | yes — `db970ef8` (parent `b318aa4c`), 31 files, no schema, no migration |
| Released / deployed | yes — fast-forward `b318aa4c..db970ef8`; `dpl_G3NsCv3BBDEJv18q5nfw6GbKmNWa` READY / PROMOTED, SHA `db970ef8`; `www.hebuntech.com` and `hebuntech.com` alias it |
| Read-only production-verified | yes — see §4 |
| Manual production UI acceptance | PASS (Director, `/agents`) |
| Placement writer | test-verified (disposable PostgreSQL, forced races, bite-proofs) and production-AVAILABLE |
| Placement writer production-executed | **NO.** Zero `organization.agent-placement.*` audit rows in production |
| Heby / Agent #1 (`4ffeeb83`) | **authoritatively Unplaced** (Director decision) |

AP-2 is **not** production-accepted as an executed write, and the writer is **not** reported as
successful in production: it has never run there. The first real production placement happens when a
genuinely department-specific agent is created (AP-4 / AP-5 territory). Placing Heby in Engineering
to exercise the writer was refused: Heby is the organization-wide coordination layer, and a test
placement would misstate organizational truth.

## 1. Decision (Director, AP-2 design gate)

- The **Organization Authority** owns where an agent sits. Agent Identity does not; placement is not
  an identity lifecycle transition, and Agent Identity keeps exactly two (register, retire).
- Storage is the pre-existing `agents.department_id` (option B). No new table, no migration.
- The Organization Authority gets a **column-scoped** write: `department_id` plus the provenance
  every governed write advances (`updated_at`, `updated_by`, `updated_by_type`, `version`). Nothing
  else on the agent row.
- **Placement grants nothing**: no mandate, capability, authorization, proposer selection or
  execution authority reads it.

Rejected: A (Agent Identity third transition), C (actor-generalized placement table — schema).

## 2. What was proven before building (read-only discovery)

- `agents.department_id` was a dormant, writerless slot: the only writer was the legacy generic
  adapter, which has zero agent write callers. Three released comments claimed "Agent Identity
  owns" it while Agent Identity's own firewall forbids writing it — the claim was unbacked.
- The composite FK `agents_tenant_department_fk` (OSA-1) proves same-tenant, existence and
  delete-restrict. It does **not** refuse a retired department or a retired agent, and the KEY SHARE
  lock the FK check takes does **not** block a department retirement (a non-key UPDATE) — measured on
  a PG18 replica. The writer closes both in the transaction, without schema.

## 3. Contract (T1–T10) and implementation

Writer `organization-authority/write-agent-placement.server.ts` — `setAgentPlacement`,
`withdrawAgentPlacement`. Gate: `resolveGovernanceAuthority` (bootstrap or delegate), human
`TenantContext` only — an agent cannot place itself; no permit, Heby or origination path. One
transaction: agent row `FOR UPDATE` → retired agent refused → compare-and-swap on the placement the
human was shown → no-op refused with no write/version/audit → target department `FOR SHARE` →
UPDATE re-stating the retired and CAS predicates → audit row (`entity_type agent`, metadata
`{previousDepartmentId, departmentId}`), no Governance decision.

| | Transition | Outcome |
|---|---|---|
| T1 | unplaced → placed | `recorded` |
| T2 | placed → other in-service department | `recorded` |
| T3 | placed → unplaced, or out of a retired department (move or withdraw) | `withdrawn` / `recorded` |
| T4 | same placement / withdraw when unplaced | `already-placed` / `not-placed`, nothing written |
| T5 | retired agent | `agent-retired`, frozen |
| T6 | into a retired department | `department-retired` |
| T7 | department retired while agents are placed | allowed, no cascade; read says the department is retired |
| T8 | agent retired while placed | column preserved; read reports **historical** attribution, never a current placement |
| T9 | stale expectation | `placement-changed`, never overwritten |
| T10 | races with department / agent retirement | no placement commits into a retired target |
| — | foreign / absent / malformed agent or department id | `agent-unresolved` / `department-unresolved`, indistinguishable |

Read `read-agent-placement.server.ts`: four derived states — `unplaced`, `placed`,
`placed-in-retired-department`, `historical`. `/agents` shows one "Department placement" card with a
minimal place / move / withdraw control for in-service agents; the department list comes through
L3's seam (`readOrganizationAuthority`).

Doctrine corrected: `agent.ts`, `department-placement.ts`, live-map basis, `placement-contracts`,
`structure-contracts`, and the registration disclosure ("Registration places it in no department").

## 4. Verification

- `tests/ap2-agent-placement/placement-postgres.ts` (PG18): T1–T10; full-row diff = exactly the
  writable columns; no-op leaves the row byte-identical and writes no audit; five FORCED races
  (`pg_stat_activity` proves the waiter): placement holds department → retirement waits; retirement
  first → waiting placement `department-retired`; agent retirement first → `agent-retired`;
  placement first → retirement waits, result `historical`; CAS → one winner, one audit row.
  Placement changes neither proposer resolution nor the effective mandate, and writes no decision,
  permit, mandate, request or human placement.
- `firewall.ts`: column scope; `.update(agents)` only in retirement and this writer; legacy adapter
  quarantined; placement modules reachable only from `/agents`; `agents.departmentId` read only by
  the placement reader/writer.
- `bite-proofs.ts`: 9/9 mutations bite (department lock, CAS both layers, no-op, retired both layers,
  gate, tenant scoping, column widening, historical read, proposer reach).
- Risk-scoped suite on PG18: all 657 DB-free suites, 59 agent-related PostgreSQL suites, 13
  bite-proofs anchored on changed files. Every remaining failure is pre-existing at `b318aa4c`
  (45 static, 4 PostgreSQL, osa3 bite-proofs; first errors identical where extractable). 13 census
  pins extended deliberately (agents writers 2 → 3, audit sink, L3/OSA enumerations, `/agents`
  actions 4 → 6). `tsc` and `eslint` clean.
- Local UI on a disposable PG18 database: all four states render; move out of a retired department
  works; a stale view's withdraw is refused `placement-changed`; mobile width has no horizontal scroll.

**Production, read-only** (every connection `default_transaction_read_only`, write probe → `25006`),
pre-push and post-deploy snapshots byte-identical: ledger 74 (last hash `55734abd…`); agents
`4ffeeb83` (hebun) and `67f4460c` (TRH) both `department_id` NULL, version 1, state `unplaced`;
1 department (engineering, active), 1 active human placement; 0 agent-placement audit rows;
mandates 4 (content hash unchanged), decisions 61, permits 9, requests 17, attempts 4, standing 4,
EAI authorizations 3; `resolveAgentProposer` → Agent #1 with and without selection.

## 5. Open

- **Department ceiling enforcement** (Phase 0 sequence: "placement authority proven first, then
  mandate enforcement") is NOT built and is now in tension with the invariant "placement grants
  nothing". Any use of placement to bound an agent needs its own Director decision and gate.
- First production placement: with the first department-specific agent.
- Debt: the simulated `/director/registries/agents` route still shows fictional departments
  ungated (separate task). Legacy adapter agent writer quarantined by firewall, not deleted.

## Three questions

1. **What did we learn?** The organization's structure authority already had the right shape for
   agent placement; what was missing was a writer, and the database invariant was weaker than it
   looked — a composite FK proves tenant and existence but not lifecycle, and its lock does not
   serialize with retirement. Lifecycle had to be held in the transaction.
2. **How does this improve Turkish Rug House?** Not yet directly: TRH has no department and no EAI
   authorization. It gains an honest place to record where a future TRH-specific agent sits, without
   that record granting it anything.
3. **How does this become part of Hebun AI?** Every agent now has an authoritative, audited,
   Governance-gated organizational position — or an explicit "unplaced" — owned by the same authority
   that owns departments and human placement. It is the structural prerequisite for department-
   specific agents (AP-4/AP-5).
