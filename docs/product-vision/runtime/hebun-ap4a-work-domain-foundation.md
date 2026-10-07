# AP-4A — Work Domain Foundation (Release A)

Status: IMPLEMENTED, uncommitted at the time of writing. Nothing in Release A changes runtime behaviour.

## What Release A adds

| Piece | Where | Release A |
|---|---|---|
| Migration 75 `20261007175237_ap4a_work_domain_foundation` | `work_domains`, `agent_mandate_responsibilities`, `work_items.work_scope_kind` + `work_domain_id`, `agent_mandates (tenant_id, id)` unique, composite FKs, CHECKs | additive |
| Work Domain Authority | `src/features/work-domain/{contracts,write-work-domain.server,read-work-domains.server}.ts`, audit sibling `governance-audit/work-domain-audit.server.ts` | inert (scripts + tests only) |
| Mandate authority, one core | `establish-agent-mandate.server.ts`: private `writeMandateRevision`; released `establishAgentMandate` (5 values) delegates with `null` and is byte-compatible; `establishAgentMandateWithResponsibility` | released entry live; new entry inert |
| Responsibility reader | `agent-mandate/read-agent-mandate-responsibility.server.ts` | inert |
| Operator CLIs | `platform:work-domain`, `platform:mandate-responsibility`, `platform:ap4-release-b-preflight` | dry-run by default; `--confirm` + typed phrase |

No live path reads the new tables. The `/agents` mandate card, its action and its 5-value contract are unchanged. No eligibility check exists anywhere in Release A.

## Contract (final)

- A work domain is a typed kind of work in one organization, owned by the Work Domain Authority (one table, three transitions: create, rename-name-only, retire). Gate: the tenant's Governance authority holder; writes audit, no Governance decision.
- Slug: unique per tenant for the table's whole life, immutable, never reused. No delete, no un-retire, no merge.
- Retire touches no other row. Work and responsibility rows that name a retired domain stay as history and admit nothing.
- Responsibility is a dimension of a mandate revision: rows written only by the mandate core, in the same transaction and under the same Governance decision; never updated. `record-work` in scope ⇒ non-empty responsibility; otherwise none. Organization-level is an explicit grant and covers no domain. Zero rows = undeclared.
- `work_items.work_scope_kind` / `work_domain_id`: NULL/NULL legacy or unknown; `organization`/NULL; `domain`/id. Written once at recording (Release B); never by rename/retire.

## Recovery plan — reverse migration is NOT an automatic rollback

1. **Default: forward-only.** Migration 75 is additive. Code built before it (5c338f10) ignores the new tables and nullable columns, and the new unique index on `agent_mandates (tenant_id, id)` can never be violated (`id` is the primary key).
2. **If Release A code must be withdrawn:** roll the deployment back to the previous production deployment (5c338f10, `dpl_6rrgcG3Yyh58FHL3UmV7yvquB65b`). The schema stays. This is the recovery path, and it needs no schema change.
3. **Destructive schema rollback only when production is PROVEN untouched**, read-only, immediately before, all of:
   - `select count(*) from work_domains` = 0
   - `select count(*) from agent_mandate_responsibilities` = 0
   - `select count(*) from work_items where work_scope_kind is not null or work_domain_id is not null` = 0
   - `select count(*) from audit_log where action like 'work-domain.%' or (entity_type = 'agent_mandate' and metadata ? 'responsibility')` = 0
   - `select count(*) from decision_records where evidence ? 'responsibility'` = 0

   If any is non-zero, the destructive path is closed: audit and decisions are append-only and would point at vanished rows. Forward-fix instead (retire a domain; write a later mandate revision).
4. **The reverse SQL (Director-executed, one transaction, after step 3):**

   ```sql
   begin;
   alter table work_items drop constraint work_items_work_scope_chk;
   alter table work_items drop constraint work_items_tenant_work_domain_fk;
   drop index work_items_tenant_work_domain_idx;
   alter table work_items drop column work_domain_id;
   alter table work_items drop column work_scope_kind;
   drop table agent_mandate_responsibilities;
   drop table work_domains;
   drop index agent_mandates_tenant_id_uq;
   delete from drizzle.__drizzle_migrations where hash = '<migration 75 hash, read first>';
   commit;
   ```

   The ledger row is removed by the same production-migration authority that applied it, never by an app path. Verified on a disposable PG18 database: the five checks read 0, the reverse returns the ledger to 74, and migration 75 re-applies cleanly afterwards.

## Production acceptance (read-only)

No mandate revision, work domain or work item is written for acceptance. The released 5-value mandate contract is proven by tests (M1 in `tests/ap4a-work-domain-foundation/foundation-postgres.ts`, the AMA suites in L3), not by a production write.

After the Director's migration ceremony and the deploy, with `default_transaction_read_only = on` and a failing write probe (25006):

1. Deployment SHA = the release commit; aliases point to it.
2. Ledger 75; newest tag `20261007175237_ap4a_work_domain_foundation`; ledger hash recorded.
3. `work_domains` = 0, `agent_mandate_responsibilities` = 0; `work_items` new columns all NULL.
4. `agent_mandates`: same row count and same effective revision per agent as before (hebun Heby rev 3 {send, record-work}, TRH Heby rev 1 {record-work}).
5. `audit_log`: no `work-domain.*` row; no mandate audit row carrying `responsibility`.
6. Routes: `/agents` and `/heby` respond as before (unauthenticated 307; no 5xx).
7. `npm run platform:ap4-release-b-preflight` reports NOT CLEAR (expected: no responsibility declared yet) — informational, it writes nothing.

Release A is then PRODUCTION-VERIFIED. The Governance ceremony (domains + responsibility revisions) and Release B are separate gates.
