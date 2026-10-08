# AP-1 — Plurality Foundation

**Status: CLOSED / PRODUCTION-ACCEPTED (2026-10-07) — Agent #1 compatibility.** IMPLEMENTED
`4d5d509b` (parent `bccaeec1`, the Phase 0 doc, itself off `c3bfc04a`) · MIGRATED through
`platform:migrate` (ledger 73 → 74), production-verified read-only · pushed to `main` by fast-forward
`c3bfc04a..4d5d509b` · DEPLOYED `dpl_4Ek8ZSEw7y2fPZ2WsbT67pWvTW7r` (READY, SHA `4d5d509b`) ·
Agent #1 compatibility PRODUCTION-ACCEPTED read-only (data + UI). **Plurality itself is NOT
production-exercised:** no second production agent exists; that is AP-5. Selected in the Agent
Platform Phase 0 design gate (`hebun-agent-platform-phase0-design-gate.md`).

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
prompt (the `ORIGINATION_INSTRUCTION_LINES` block is byte-identical between `c3bfc04a` and the
deployed `4d5d509b`; AP-1 only adds the selection argument in that file), mandate vocabulary,
EAI, providers, department, suspend/succession, spend cap, operations-surface selection.

> **Revised by AP-5A (Director gate G1, 2026-10-08).** The byte-identity above was a statement about
> AP-1, not a standing invariant, and AP-5A deliberately changes exactly one line of the block: the
> first, `"You are Heby, a durable organizational agent inside the Hebun runtime."`, becomes
> `"You are a durable organizational agent inside the Hebun runtime."`. It told every selected agent
> it was Agent #1. An agent's name is tenant data, so SCI-1 keeps it out of the instruction channel;
> the line names no agent, the proposer stays the server-resolved one, and the model's words carry no
> identity. Every other line, both Knowledge-mode variants' additions, the mint census and the E2-5
> rule (no agent id model-facing) are unchanged. AP-5A also adds the operations-surface selection
> listed above as unchanged here.

## The name invariant

Canonical key = NFC, then simple Unicode lower-case under the builtin `pg_c_utf8` collation
(provider-stable; production DB is builtin C.UTF-8). `Heby`/`heby`, NFC/NFD `Ayşe`, `ŞAHİN`/`şahin`
collide. **Known ceiling:** Turkish dotted/dotless I is not folded — `IŞIK` and `Işık` are different
names; no locale-specific folding is added. Partial on the read seam's in-service predicate
(`retired_at IS NULL AND agent_lifecycle_status IS DISTINCT FROM 'retired'` — production rows carry a
NULL lifecycle, which `<>` would have excluded). A retired name may be registered again as a NEW
identity; history is always distinguished by agentId.

## Evidence (local, before release)

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

## Production release and acceptance (2026-10-07)

Every production read below ran on a connection with `default_transaction_read_only=on`; a write
probe through the application's own pool was refused `25006`. Nothing was created, proposed or
decided.

**1 · Preflight (read-only).** Cluster `7675444875863894887` / `neondb`, PG 18.6, builtin C.UTF-8,
`pg_c_utf8` v1. Ledger 73, every position equal to the canonical files by hash and timestamp, digest
`86c098e1…`; AP-1 hash absent; index and CHECK names free; 0 canonical-name collisions, 0
visible-name violations, 0 non-NFC names. Snapshot: two agents, one per tenant, both `Heby`, in
service — Hebun AI `4ffeeb83…` (row sha256 `c020e208f960432b`, 3 mandates) and Turkish Rug House
`67f4460c…` (`def7a6c9414d478c`, 1 mandate); 0 `agent-registration` sessions or decisions.

**2 · Migration 74.** `platform:migrate` from this worktree; CAS re-measured immediately before
(ledger 73, `86c098e1…`); the ceremony listed exactly one pending migration
(`20261007064348_ap1_agent_name_in_service_uniqueness`) and the Director typed the confirmation.
Backup `hebun_production_pre_migration_20261007-084005.dump` (756,126 bytes, `pg_restore -l` OK).
Result SUCCESS, 73 → 74, organizational data unchanged across every counted table.

**3 · Post-migration (read-only).** Ledger 74, all positions canonical, digest
`639a3c28349c85d107146ce0c63810e0`. `agents_tenant_name_in_service_uq` unique, valid, ready:
`(tenant_id, lower((NORMALIZE(name, NFC) COLLATE pg_c_utf8))) WHERE ((retired_at IS NULL) AND
(agent_lifecycle_status IS DISTINCT FROM 'retired'))`. `agents_name_visible_chk` validated, definition
identical to the migration. Both agent row hashes unchanged; registration 0/0; collisions 0;
visible-name violations 0.

**4 · Release.** Remote `main` re-read as `c3bfc04a`; two single-parent commits, fast-forward push
`c3bfc04a..4d5d509b` (no force). Vercel `dpl_4Ek8ZSEw7y2fPZ2WsbT67pWvTW7r` READY, target production;
`meta.githubCommitSha` and `gitSource.sha` both `4d5d509b…`; aliases `www.hebuntech.com` and
`hebuntech.com` resolve to that deployment.

**5 · Agent #1 compatibility (read-only).** Deployed SHA and ledger 74 re-confirmed; agent row hashes
unchanged before and after; still 2 agents (1 per tenant, none created on 2026-10-07), mandates
unchanged, registration 0/0. On the Hebun tenant, with no selection: `resolveAgentProposer` and
`resolveAgentAuthorship` both resolve Agent #1. Heby grounding: `recordRef = agent/<Agent #1 id>`,
label `Heby`, no UUID in label, detail or model detail, no tenant id anywhere. Model-facing
projection: exactly `[agents] withheld — not disclosed to the external model`, no UUID.
Origination instruction block byte-identical to pre-AP-1 (see above). The availability /
capability answer depends on the deployed runtime's model environment and could not be read
locally; it was accepted through the production UI.

**6 · UI (Director, manual, read-only, hard reload).** `/agents`: Hebun shows the one in-service
Heby identity and Agent #1's Effective Capability card; registration copy carries the plurality /
Governance semantics; no singleton or one-shot wording. `/heby`: the existing affordance needs no
agent selection in the single-agent case. No agentId or UUID visible on Heby's user surface.

## What is and is not proven

| Part | Implemented | Deployed | Production-verified |
|---|---|---|---|
| Migration 74 (name uniqueness + visibility CHECK) | yes | yes | yes — schema, ledger, digest, existing data |
| Selection-free resolution, one agent per tenant | yes | yes | yes — Hebun Agent #1 |
| B3 `recordRef = agent/<agentId>` + model withholding | yes | yes | yes — Hebun grounding |
| `/agents` per-agent card, registration copy, Heby affordance | yes | yes | yes — single-agent case, UI |
| Registration as a Governance decision | yes | yes | no — never exercised in production (0 decisions) |
| B1 ambiguity refusal, B2 same-agent lineage, explicit selection, Heby candidates | yes | yes | no — need two in-service agents; proven by tests only |

**Limitation.** No second real Hebun agent was created. Agent plurality has not been exercised with
two production agents; that proof belongs to AP-5.

**Known separate debt (not AP-1).** `tests/supplied-media-account-provenance-1/provenance-postgres.ts`
fails deterministically on PostgreSQL 18: PG18 reports `ON DELETE RESTRICT` as SQLSTATE 23001
("violates RESTRICT setting of foreign key constraint"), not 23503, so the alternation
`/media_assets_supplied_source_integration_fk|violates foreign key/` misses — and the constraint that
fires is `integration_credentials_tenant_integration_fk`, so the test never proved the
`media_assets` FK even on PG14. It is the only PG14 → PG18 baseline difference (PG18 baseline
895/68/963 at `bccaeec1`; AP-1 897/68/965, same 68 first errors).

## Rollout order and rollback

Migration first (schema is compatible with the released code: the old code cannot create a second
identity and both production tenants already hold one), then code — executed in that order on
2026-10-07. Rollback = a forward reverse migration (75) plus code revert; no data loss.

## Three questions

1. **What did we learn?** The platform was singular at exactly one genesis count and two resolver
   refusals; everything downstream already keyed by the stored agentId. Names need a canonical,
   collation-pinned key, and test infrastructure must match production's PostgreSQL major.
2. **How does this improve Turkish Rug House?** Not yet in behaviour (TRH has no EAI authorization);
   it lets a later TRH department agent exist beside Heby without a parallel system.
3. **How does this become part of Hebun AI?** As the governed plurality primitive every later agent
   phase (AP-2 department ceiling, AP-4 Agent #2, AP-5 acceptance) builds on.
