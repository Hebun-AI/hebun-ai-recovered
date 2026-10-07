# AP-1 — Plurality Foundation

**Status: IMPLEMENTED, NOT COMMITTED (awaiting Director commit gate, 2026-10-07).**
Branch `feat/ap-1-plurality-foundation` off `bccaeec1` (Phase 0 doc, itself off `c3bfc04a`). One
migration (ledger 73 → 74). No production migration, deploy or mutation. Agent #2 is NOT created.
Selected in the Agent Platform Phase 0 design gate
(`hebun-agent-platform-phase0-design-gate.md`).

**Multi-identity is not "unlimited agents".** AP-1 builds the plurality PRIMITIVE only: every
identity costs one recorded Governance decision. No product policy about how many agents an
organization should have is implied.

## What AP-1 changes

| Area | Before | After |
|---|---|---|
| Genesis | one identity per tenant, ever (`count(*)` incl. retired, table lock) | each registration is a Governance decision: domain `agent-registration` (reserved since the baseline, unused), type `approve`, subject `agent` = the new agents.id, outcome `agent-registered`; `governance.decision.recorded` audit in the same transaction; a reason is required |
| Name | exact string, app-only rules | DB: `agents_tenant_name_in_service_uq` on `(tenant_id, lower(normalize(name, NFC) COLLATE "pg_c_utf8"))` WHERE in service; `agents_name_visible_chk` (non-blank, no control/format/zero-width/bidi/BOM). App refuses the same set first; collision → `agent-name-in-use` |
| Proposer / authorship | `resolveAgentProposer(tenant)` / `resolveAgentAuthorship(tenant)` — singleton or refuse | optional `{ agentId? }` LOOKUP KEY, verified against the tenant's own read: foreign/unknown/malformed → `selected-agent-unresolvable`, retired → `selected-agent-retired`. Omitted → unchanged behaviour |
| Origination | client sends `{ goal }` | `{ goal, agentId? }`; the agentId is sent only when a human chose among candidates |
| Availability | single answer, `multiple-agents` = dead end | per-agent (`agent.agentId` in the answer); `multiple-agents` carries the IN-SERVICE candidates; `/agents` shows one capability card per in-service agent |
| Heby | no selection | the offer lists candidates; choosing one re-checks availability for that agent |
| B1 | media authorship ambiguity reported as `no-durable-agent` (false) | `ambiguous-durable-agent` |
| B2 | hypothesis `supersedes` checked tenant-only | predecessor must be about the SAME agent (`supersedes-other-agent`); the writer is the table's only writer (insert-only) |
| B3 | Heby agent citation `recordRef` = agent name | `agent/<agentId>` (names repeat over time) |
| Disclosure / UI | "ONCE", "ceremony closed", "one per organization" | governed registration, in-service name rule, retirement never reinstates; registration asks for a reason |

Unchanged on purpose: retire authority (owner + Governance, terminal, no decision), the origination
prompt (bytes identical, sha `494cec71…` of `ORIGINATION_INSTRUCTION_LINES`), mandate vocabulary,
EAI, providers, department, suspend/succession, spend cap, operations-surface selection.

## The name invariant

Canonical key = NFC, then simple Unicode lower-case under the builtin `pg_c_utf8` collation
(provider-stable; production DB is builtin C.UTF-8). `Heby`/`heby`, NFC/NFD `Ayşe`, `ŞAHİN`/`şahin`
collide. **Known ceiling:** Turkish dotted/dotless I is not folded — `IŞIK` and `Işık` are different
names; no locale-specific folding is added. Partial on the read seam's in-service predicate
(`retired_at IS NULL AND agent_lifecycle_status IS DISTINCT FROM 'retired'` — production rows carry a
NULL lifecycle, which `<>` would have excluded). A retired name may be registered again as a NEW
identity; history is always distinguished by agentId.

## Evidence (local only)

- Production read-only preflight (2026-10-07, read-only session + transaction, rollback): PG 18.6,
  builtin C.UTF-8, `pg_c_utf8` present, `lower`/`normalize` IMMUTABLE, two agents both `Heby` in
  different tenants, no would-be duplicates, 0 hypotheses, ledger 73 digest `86c098e1…`.
- Hebun PG 18.6 test instance (`~/Developer/hebun-data/postgresql18`, `127.0.0.1:55433`, builtin
  C.UTF-8) — parity probes identical to production. The 73-migration chain digest equals production.
- Contract proved via the real migrator: apply 74, all collision/visibility probes, concurrent race,
  reverse migration 75 (data intact), dirty-state failures roll back the whole transaction (ledger
  stays 73, neither index nor CHECK).
- Tests: `tests/ap1-plurality-foundation/` (plurality-postgres + 9/9 bites); inverted/widened pins by
  name in agent-id-0 (16/16 bites), agent-id-0-1 (12/12), agent-id-ceremony-disclosure (12/12),
  agent-proposal-2 (5/5), wf1 (9/9), e25, wf2, sia31; 39 migration-count pins 73 → 74.

## Doctrine change (Director decision, 2026-10-07)

E2-5 released "no agent id travels, ever" in Heby grounding and cited agents by name. The Director
accepted B3: the `agentId` is the authoritative agent reference and `recordRef = agent/<agentId>`.
An agent's name is not an authoritative identity — a retired name can be reused — so the name +
establishedAt alternative is refused.

E2-5 now reads: the agentId may appear only in an internal provenance/reference field (`recordRef`).
It must never enter model grounding content, a label or detail line, or any explanation shown to a
user. The model's existing withheld behaviour is unchanged: the `agents` class reaches the model as
one fixed withheld line, which carries no id (asserted in `tests/e25-agent-grounding`, section 5).

## Rollout order and rollback

Migration first (schema is compatible with the released code: the old code cannot create a second
identity and both production tenants already hold one), then code. Rollback = a forward reverse
migration (75) plus code revert; no data loss.

## Three questions

1. **What did we learn?** The platform was singular at exactly one genesis count and two resolver
   refusals; everything downstream already keyed by the stored agentId. Names need a canonical,
   collation-pinned key, and test infrastructure must match production's PostgreSQL major.
2. **How does this improve Turkish Rug House?** Not yet in behaviour (TRH has no EAI authorization);
   it lets a later TRH department agent exist beside Heby without a parallel system.
3. **How does this become part of Hebun AI?** As the governed plurality primitive every later agent
   phase (AP-2 department ceiling, AP-4 Agent #2, AP-5 acceptance) builds on.
