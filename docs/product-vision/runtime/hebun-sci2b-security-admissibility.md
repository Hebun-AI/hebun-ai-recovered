# SCI-2B — Provenance-Derived Security Admissibility

**Status: CLOSED / PRODUCTION-VERIFIED (2026-10-06). INERT.** IMPLEMENTED `d8fe7406` (parent
`b09b6b56`) · MIGRATED through `platform:migrate` (ledger 72 → 73) · pushed to `main` by fast-forward
· DEPLOYED `dpl_EU16vSmwiP7ydkxCNb1FnYd3yDB1` (READY, SHA `d8fe7406`) · PRODUCTION-VERIFIED read-only
before and after deploy. Migration `20261006175909_sci2b_knowledge_integrity_at_insert`. Prior phases: SCI-0, SCI-1,
[SCI-2A](hebun-sci2a-knowledge-version-immutability.md).

WF-3 = BLOCKED-BY-SCI · WF-4 = CLOSED / PRODUCTION-ACCEPTED · Agent #2 = STOPPED.

## The question, and only this one

> Given what Hebun can prove about this content, may it take part in this reasoning path?

Not: is it true, harmless, human-written, disclosable to an AI provider (EAI), proposable (Agent
Mandate), authorized or executable. ELIGIBLE content is still untrusted model data.

## Director policy (2026-10-06)

**STRICT-FORWARD.** For B-level Agent `record-work` grounding, Hebun does not rely on a Knowledge
version whose integrity from creation it cannot establish. ACCEPT-BASELINE rejected. No
production-specific record ids in source.

## The persisted fact — `knowledge_nodes.integrity_protected_at_insert`

| Value | Meaning |
|---|---|
| `TRUE` | Inserted while all three SCI-2A guard triggers were present and enabled: protected since creation |
| `NULL` | Not established: every row older than the column, or inserted while protection was off. **Not** "compromised" |

- **Database-owned.** A separate `BEFORE INSERT` trigger, `knowledge_nodes_stamp_integrity_at_insert`,
  overwrites whatever the INSERT supplies (omitted, NULL, FALSE or TRUE) and writes TRUE only after
  counting the three SCI-2A guards in `pg_trigger` (`tgenabled <> 'D'`); otherwise NULL. No default,
  no backfill. A self-asserted TRUE is never believed.
- **Separate from SCI-2A, on purpose.** Insert is a different lifecycle moment from mutation; the
  SCI-2A guard function, its triggers and its production acceptance are unchanged. Coupling is by
  catalog check, so the stamp cannot outlive the protection it attests.
- **Frozen by SCI-2A.** The column is not in the post-creation allowlist, so the deny-by-default
  UPDATE rule refuses NULL → TRUE and TRUE → NULL. A legacy row can never become "protected".
- Ceiling: a superuser who drops or disables the stamp trigger (or runs `session_replication_role
  = replica`) can insert a self-asserted value — the same DDL-tampering class SCI-2A states.

Production today: all 8 existing versions will be NULL → INELIGIBLE / `integrity-unestablished`
for B-level reasoning only. Human viewing, Knowledge truth, assistance and Governance history are
unchanged.

## Verified ratification

`ratified` in Knowledge reads `ratification_decision_id is not null` — a claim in a column SCI-2A
leaves writable for K4. SCI-2B counts it only when Governance agrees:

- `governance-decision/knowledge-ratification-read.server.ts` (Governance-owned, sibling of the
  KT-1 rejection read): the `ratify` decision ids for exactly that `knowledge_node` subject in the
  trusted tenant.
- The claim is verified iff the row's decision id is one of them. A reject decision, another
  version's decision, another tenant's decision or no decision → not ratified. Reader failure →
  UNAVAILABLE, never "not ratified".

## The primitive

```
evaluateAdmissibility(trustedTenantId, purpose, factsRead) →
  ELIGIBLE | INELIGIBLE(reason) | UNAVAILABLE(authoritative-facts-unavailable)
```

Facts (exactly six): `contentClass`, `versionId`, `ownerTenantId`, `activeAndInForce`,
`ratified` (verified), `integrityFromCreation`. Reasons, in evaluation order: `policy-not-permitted`
(only `agent-record-work-grounding`), `unsupported-content-class` (only `knowledge`; provider
observations are architecturally compatible but not admitted, no adapter), `tenant-mismatch`,
`inactive-version`, `ratification-required`, `integrity-unestablished`.

Text origin, ingestion path, source type, source digest and Drive references are not inputs: no
release policy depends on them. Manual/pasted Knowledge (text origin UNKNOWN) is eligible when the
six facts hold; a Drive reference grants nothing.

| Module | Owns |
|---|---|
| `secure-content-admissibility/evaluate.ts` | contract + pure evaluator (imports nothing) |
| `secure-content-admissibility/knowledge-facts.server.ts` | composition of the two readers; owns no truth |
| `knowledge/version-standing.server.ts` | Knowledge's tenant-bound read of one version: active + in force (KR3 rule), claimed decision id, integrity stamp |
| `governance-decision/knowledge-ratification-read.server.ts` | Governance's `ratify` decisions for one version |

Tenant comes only from server context; the Knowledge read is tenant-predicated, so another
tenant's version (or none) reads as not-owned → `tenant-mismatch`, never an existence oracle.

**Inert.** Nothing in `src/` imports the primitive; it is not wired into origination, retrieval,
EAI or any model path (pinned by a test). Prompt injection is not detected here; SCI-1 separation,
closed output contracts, reference membership, PENDING and Governance remain the containment.

## Evidence (local, disposable PostgreSQL 14)

- `tests/sci2b-flow/integrity-and-ratification-postgres.ts` — release writers: new insert stamped;
  INSERT supplying NULL/FALSE/TRUE stamped by the DB; invalid value refused; protection-off insert
  NULL even when it claims TRUE; NULL→TRUE and TRUE→NULL refused; content UPDATE, DELETE,
  TRUNCATE still refused; same-text supersede creates a stamped version; real ratification ⇒
  ELIGIBLE; superseded, retracted, unratified, other-tenant, reject-claimed, wrong-subject,
  cross-tenant-decision and legacy-ratified cases each with their reason; four reader failures ⇒
  UNAVAILABLE; schema bites (stamp trigger dropped; marker allowlisted); zero network calls.
- `tests/sci2b-flow/evaluator.ts` — case table, six-fact descriptor, provenance extras ignored, no
  trust vocabulary, import firewall, inert (no `src/` consumer).
- `tests/sci2b-flow/bite-proofs.ts` — 8 defects caught (ratification, tenant, active, integrity,
  class, purpose, UNAVAILABLE→ELIGIBLE, ratification matching).
- `tests/sci2b-flow/migration-shape.ts` — 3 statements, no default/backfill/data statement, SCI-2A
  guard untouched, snapshot moved by exactly one column.

## Production acceptance (2026-10-06, read-only)

Target: cluster `7675444875863894887`, database `neondb`, PostgreSQL 18.6. Order kept because a
Drizzle insert names every schema column (`… "integrity_protected_at_insert" … default`) and a push
to `main` deploys to production: migrate → accept → push → deploy → accept again.

- **Preflight (18:32:35Z):** ledger 72, tail `cd511647…` (SCI-2A); SCI-2B, column, stamp function and
  trigger absent; three SCI-2A guards enabled, guard definition md5 `47496bbb…` (= SCI-2A acceptance);
  migration lock free; migration file SHA-256 `e6f729ce…` as authorized.
- **Ceremony:** one run; backup `hebun_production_pre_migration_20261006-183253.dump` (750 267 bytes,
  806 entries, `pg_restore -l` OK); final digest `86c098e1bed9c9ece50a810a39f085fc`; the Director
  confirmed at the visible TTY prompt; SUCCESS 72 → 73; the ceremony's organizational comparison:
  unchanged.

| Check | Before | After migration | After deploy |
|---|---|---|---|
| Ledger | 72 | 73, tail hash `e6f729cebc91e35793eb0d616b8874717870d6182ef8e90acb1cb6be45091371` | same |
| `integrity_protected_at_insert` | absent | boolean, nullable, no default | same |
| Legacy versions stamped | — | 0 of 8 (all NULL) | same |
| Stamp function / trigger | absent | body identical to shipped SQL; `BEFORE INSERT … FOR EACH ROW`, enabled | same |
| SCI-2A guards (update/delete/truncate) | enabled, md5 `47496bbb…` | unchanged | unchanged |
| Knowledge nodes / facts by tenant | hebun 2 · TRH 6 / hebun 2 · TRH 5 | identical | identical |
| Node digest excluding the new column / fact digest | `b090fe87…` / `dda76ece…` | identical | identical |
| 13 organizational counts | recorded | identical | identical |

No production Knowledge row was inserted, updated, superseded or ratified; no provider or model
call; EAI unchanged; nothing consumes the primitive. The 8 existing versions are
INELIGIBLE / `integrity-unestablished` for B-level reasoning until a separately authorized reissue.

## Rollback

```sql
DROP TRIGGER "knowledge_nodes_stamp_integrity_at_insert" ON "public"."knowledge_nodes";
DROP FUNCTION "public"."knowledge_nodes_stamp_integrity_at_insert"();
ALTER TABLE "knowledge_nodes" DROP COLUMN "integrity_protected_at_insert";
```

The `DROP COLUMN` does not fire row triggers but discards every stamp; versions inserted after
installation would lose their only proof. Forward-fix is preferred; rollback is its own gate.
Application code that names the column must not be deployed before the migration (Drizzle inserts
list every schema column).

## Legacy reissue (future Director ceremony, not this phase)

Hebun's one ratified version first: supersede with identical text (allowed) → the database stamps
the successor → Governance ratifies that exact successor → ELIGIBLE. The successor's provenance is
`human-authored` (true: a human resubmitted it); the fact-level Drive reference keeps its KR-EXT1
meaning ("this fact concerns that document"), never "this text came from it". TRH's five versions
stay untouched until an agent need exists.

## Remaining WF-3 gates

Legacy reissue for the grounding facts actually needed; EAI
platform cell and Hebun tenant authorization for agent-origination × knowledge; bounded
deterministic Knowledge selection using this primitive; Knowledge reference membership in the
origination contract. Unchanged: output stays PENDING, Governance decides, no execution authority.
