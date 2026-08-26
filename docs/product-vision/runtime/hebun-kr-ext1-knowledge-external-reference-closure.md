# KR-EXT1 — Knowledge External Reference: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `afbb4725a7266527f1e41dcadf51ae33a99dcd06`, authored 2026-08-26 10:44:49 +0300.
**Parent:** `19d3e428bc62e33ead9dd89ba0beb46b31b597d5`.
**Tag:** none. The release convention in force across this series is untagged.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessor:** `hebun-int-5b1-github-provider-record-read-closure.md`.
**First reader:** `hebun-int-5c-cross-source-grounding-closure.md`.

> **Record provenance.** This closure was written after the fact, during the INT-5C release ceremony.
> Every commit, file, schema and test statement below was measured from the repository in that
> session. The production statements were measured through a read-only census authored in that
> session and **executed by the Director**, whose output was returned verbatim. The original
> KR-EXT1 acceptance run itself was Director-observed and is marked as such where it is cited.

---

## 1. What this closes

A Knowledge fact could say what the organization knows. It could not say **which external system
that knowledge is about**. KR-EXT1 adds one durable, human-authored statement: *this Knowledge fact
concerns that record, in that provider, under that capability.*

It is deliberately a **reference**, not an import. No provider content is copied into Knowledge, and
no Knowledge wording is sent to a provider. The row records a relationship a human declared.

## 2. What shipped

35 files, +19,743 / −19. The source surface:

| File | Role |
|---|---|
| `src/db/migrations/20260826064423_kr_ext1_knowledge_external_references.sql` | **migration 36** — the new table |
| `src/db/schema/knowledge-external-reference.ts` | table, indexes, CHECK constraints |
| `src/db/schema/knowledge-fact.ts` | fact-side wiring |
| `src/db/schema/index.ts` | registration |
| `src/features/knowledge/external-reference-contracts.ts` | identity validation, refusal vocabulary |
| `src/features/knowledge/external-reference-authority.server.ts` | declare / withdraw / list / reverse lookup |
| `src/app/(dashboard)/knowledge/actions.ts` | server actions |
| `src/components/knowledge-workspace/knowledge-external-references.tsx` | the declaring surface |
| `src/components/knowledge-workspace/knowledge-records.tsx` | records surface integration |

## 3. Identity is a four-part tuple, and it is the provider's own

`(provider_key, capability, record_type, record_id)`. `record_id` is the provider's immutable
identifier — for GitHub, the numeric repository id, never the full name. A rename must not break a
declaration, and a name must never be able to make one.

Two indexes carry the two directions:

- `knowledge_external_references_live_uidx` — one live declaration per tuple per fact
- `knowledge_external_references_record_fact_uidx` — `(tenant_id, provider_key, capability,
  record_type, record_id, knowledge_fact_id) WHERE withdrawn_at IS NULL`, the **reverse** direction:
  *which fact concerns this record?* KR-EXT1 authored it; **INT-5C is its first reader.**

## 4. Human-only, by database constraint

`knowledge_external_references_human_declarer_chk` and `..._human_withdrawer_chk` make the declarer
and the withdrawer human at the schema level. This is not a UI rule and not a code convention — a
model or a service cannot declare a relationship even if a future writer tried, because the row is
rejected. `..._withdrawal_pair_chk` enforces both-or-neither on the withdrawal actor pair, matching
the invariant already carried by five other tables.

Withdrawal is `withdrawn_at`, never `DELETE`. A declaration that existed keeps having existed.

## 5. Tenant scoping

`tenant_id` participates in the composite foreign key to `knowledge_facts` and in both unique
indexes. Two organizations may declare against the **same** external record without either seeing
the other's declaration.

## 6. Validation evidence

Re-run in full during the INT-5C ceremony, at `dc39ee9`:

| Suite | Result |
|---|---|
| `tests/kr-ext1-flow/bite-proofs.ts` | **16 mutations bit** |
| `tests/kr-ext1-flow/boundaries-and-firewall.ts` | PASS |
| `tests/kr-ext1-flow/external-reference-postgres.ts` | PASS |
| Full suite | **495 / 495** |

KR-EXT1 also amended assertions in 16 other released suites (`k2`, `k3`, `kr3`, `kr4`, `kr5`, `g3`,
`g4`, `g5a`, `g5a1`, `r7-1`, provenance vocabulary and others) — repairs to pins made stricter, not
weakened.

## 7. Production

Measured 2026-08-26 by read-only census against cluster `7675444875863894887` / `neondb`,
PostgreSQL 18.6:

- **Migration 36 is applied.** Ledger `applied 36`, digest `1b67f950a863b1d86b072dee14c6edb3`,
  converged with the 36 authored migrations in `_journal.json`.
- The declaration exists and is live:

```
github-organization/github.repository.activity.read/repository/1300480452
   fact dc8d3795-c506-444f-8acf-20f457934af3
   declared 2026-08-26T10:54:00.265Z by human | withdrawn no
```

- The fact it concerns: `engineering / hebun-repository`, **version 1**, active node
  `143d8eaf-dd7d-4f6f-85c5-4d109dbf008d`, `created_at == updated_at == 2026-08-26T10:40:11.890Z` —
  created 13.8 minutes before the declaration and **never mutated since**.
- `knowledge_external_references` count **1**.

**PRODUCTION_ACCEPTANCE = PASS.** *Provenance: the acceptance run was Director-observed. The
database facts above were independently measured during the INT-5C ceremony and corroborate it.*

## 8. The lesson this phase paid for

`integration_credentials` moved 6 → 7 during acceptance and the verifier correctly failed. Forensics
proved it an unrelated `google-workspace` OAuth refresh. **Credentials are versioned by INSERT, not
UPDATE**, so any token refresh raises the row count. A count fingerprint on that table alarms on
ordinary lifecycle. Design fingerprints knowing which tables grow by themselves — and attribute a
delta before calling it unrelated. INT-5C hit the same table again and resolved it the same way.

## 9. Final truth ledger

| | |
|---|---|
| Schema | **+1 table, migration 36** |
| Applied to production | **YES** — ledger 36, digest converged |
| Human-only declarer | enforced by CHECK, not by convention |
| Provider content copied into Knowledge | **NONE** |
| Reverse-lookup index | authored here, **unused until INT-5C** |
| Production declarations | **1**, live, human-declared |

## 10. Closure boundary

This record documents a completed phase. It does not reopen it. The reverse-lookup function was
later **moved** (not forked) to a writer-free module by INT-5C; there is still exactly one
implementation. See `hebun-int-5c-cross-source-grounding-closure.md` §4.
