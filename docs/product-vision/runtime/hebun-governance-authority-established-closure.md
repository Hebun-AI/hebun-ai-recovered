# Governance Authority Established — Closure

**Status:** RELEASED. Execution of the released G2 authority — **zero schema, zero migration, zero new authority, zero canonical write.**
**Suite:** 414 passed, 0 failed. Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean.
**Canonical:** `hebun_r1` byte-identical — 31/31 ledger, 57 tables, all counts unchanged.
**Production:** Tenant Zero has a government. **Provider DISARMED. No Knowledge ratified. No role, permission or grant created.**

G5B left Tenant Zero with an organization and an **unspent** genesis entitlement. G6A spends it.

---

## What this gate is

One act, performed by one authenticated human, through one released server action. **No file in `src/` or `scripts/` changed to make it possible.** The only repository change is a regression test closing a coverage gap this gate's own bite-proofs exposed.

**It invents no authority.** `establishGovernanceAuthority` has existed since G2. G3 connected delegation. G6A is the first time either has run against a real organization.

## The act, and everything it wrote

The client supplies exactly one value — the justification. Tenant, actor, identity, session, bootstrap flag, decision type, domain, subject, outcome, authority source and every timestamp are resolved server-side, so a forged one has no parameter to arrive in.

In ONE transaction:

| Step | Row |
|---|---|
| 5 | `governance_sessions` — domain `authority-delegation`, `certify`, subject = the tenant, proposer human, `risk_class` critical, lifecycle `recorded`, **`authority_source_actor_*` NULL**, `voting_mode` NULL |
| 6 | `decision_records` — `bootstrap: true`, `certify`, subject = the tenant, `actor_type` human, outcome `authority-established`, evidence = identity references only |
| 7 | `genesis_nominations` — `consumed_at`, `consumed_by_decision_id`, predicated on `status='accepted' AND consumed_at IS NULL` |
| 8 | `audit_log` — `governance.bootstrap.established`, `source` `governance-authority`, `authority_source` `membership`, `result` committed |

`authority_source_actor_*` being NULL is not an omission. It is the genesis stating the truth about itself: **there was no prior authority to decide under.** Every later decision names one.

## What it did NOT do — measured, not asserted

`providers`, `provider_connectivity_controls`, `executions`, `action_permits`, `action_execution_attempts`, `permissions`, `role_permissions`, `membership_authorizations`, `invitations`, `knowledge_nodes`, `knowledge_facts`, `knowledge_edges` — **all still zero**. `roles` still 1, `memberships` still 1, both untouched.

The surface states eight non-effects and every one of them held.

## Authority exists because Governance says so — not because of a role

This is the distinction the whole gate is for, and it is settled by running the released resolver against production rather than by reading it:

| Context | Result |
|---|---|
| the bootstrap human, Tenant Zero | `authorized: true, via: "bootstrap"` |
| a different user id, Tenant Zero | `authorized: false, via: "none"` |
| the same human, another tenant | `authorized: false`, no bootstrap found |
| anonymous | `authorized: false` |

`resolveGovernanceAuthority` reads `decision_records` where `bootstrap = true`. It consults **neither** `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions`, nor `role_permissions` — none of them was ever established by a Governance decision, so none of them can grant Governance authority.

**Before G6A the human held Owner and had no Governance. After G6A they hold both, and only one of them is why.**

## One-shot, three ways

Proved without replaying production — a replay by an authorized human writes a governed refusal to `audit_log`, and production's history is not a test fixture.

1. the application read of an existing bootstrap decision;
2. the spend predicated on `consumed_at IS NULL`, whose zero-row result aborts the whole transaction;
3. `decision_records_one_bootstrap_per_tenant_uq`, with `decision_records_bootstrap_human_chk` forcing a human actor.

Both the application predicate and the database's unique violation land in the same catch and mean the same thing.

## Bite-proofs

Every mutation applied (verified by sha256 change), every file restored byte-identically (verified by sha256 equality).

**BIT:** already-consumed refusal removed · tenant predicate dropped from the entitlement read · entitled-human binding removed · audit write removed · provider schema imported · a Heby surface importing Governance decision authority · a real `roles` insert inside the transaction.

**DID NOT BITE — and each non-bite is a result:**

- **`isNull(consumedAt)` removed from the spend.** The earlier application refusal still catches it. Defence in depth: removing one layer leaves the other.
- **The `already-bootstrapped` guard removed.** The unique index raises 23505 and the catch maps it to the *same* refusal the test asserts. The database is the final defence and its answer is indistinguishable.
- **The audit write moved from `tx` to `db`.** A20 induces the audit failure with a CHECK constraint, which rejects the write on either connection, so both paths refuse identically. The atomicity claim is thinner than it looks; the implementation is correct and was not "fixed" to make a test bite.

Two earlier non-bites were **my mutation being wrong, not the system**: the Heby firewall asserts Heby → Governance, and I had first mutated Governance → Heby; and an inert import proves nothing about a write. Corrected, both produced verdicts.

## The gap this gate found and closed

A **real `roles` insert inside the establishment transaction passed every released assertion.** The surface promises the genesis "does not change your application role" and "does not create permissions", and nothing tested it — the promise rested on the absence of an import, which any future edit could add back.

The fix counts `roles`, `permissions` and `role_permissions` on both sides of the act and asserts they are unchanged. It bites:

> establishing Governance must create no role, permission or grant — the surface promises this

The lesson generalises: **a claim enforced only by what a file does not import is enforced by inspection, not by mechanism.** Count the thing the promise is about.

## The justification, recorded as it stands

The permanent justification on the bootstrap decision begins `"ebun AI'ı …"`. The leading `H` of "Hebun" was dropped while typing it into the browser.

It is recorded here because there is no legitimate way to change it and a future reader deserves the explanation rather than a guess. `src/` contains no `update(decisionRecords)` and no `delete(decisionRecords)`; `supersedes_decision_id` is a schema column with **zero writers**; the action file states there is deliberately no update, delete, supersede, escalate or appeal action; and `bootstrapAuthorityRevocable` is `false`. Repairing it would have required raw SQL against production or a new writer — either of which is manufacturing constitutional history, which is worse than a dropped letter.

The Director's decision was to leave the record exactly as decided and record the fact.

## Record integrity

Audited, and **nothing required repair**. `genesis-acceptance-card.tsx` renders "No Governance decision exists yet." only under a local `useState` flag set in the transition immediately after acceptance — it cannot render on a page load, so it appears only where it is true. The persistent notice, "This tenant's genesis nomination has been accepted. Acceptance happens once.", remains accurate. The three `contracts.ts` comments describing "the tenant has no bootstrap decision" document refusal *reasons* and are per-tenant conditions, not claims about Tenant Zero.

The G5B closure record is historical and was true when committed; it is not rewritten.

## Also true of production, and not caused by this gate

Between the G5B commit and this gate, the first human used Heby: `conversations` 1, `messages` 2, `heby_answer_evidence_set` 1, created `2026-08-18T22:28:32Z`.

Two things worth keeping from those rows. The assistant message is `origin=deterministic` with `provider`, `model` and `transport` all NULL and zero tokens — **the provider firewall held under real use.** And `created_by` is populated while `created_by_type` is NULL on both tables, which is the known R5.2 both-or-neither gap now holding real production rows for the first time. Neither is G6A's to change.

`pg_trgm` is absent from production *and* from canonical (`plpgsql` only on each), so Heby's degraded-retrieval notice is honest and uniform rather than production drift.

## Schema verdict

**ZERO.** No table, column, constraint, enum or migration. The existing Governance model carried the authority, which was the hypothesis this gate tested.

## What still does not exist

No delegated authority. No member role baseline. No membership authorization, invitation or second human. No Knowledge, and none ratified. No provider, execution or Computer Use. Heby cannot see Governance authority at all — the G2 gate withholds the overview, and no Governance source class is connected to Heby's resolver in the first place.

## The exact G6B entry condition

Governance authority resolves for the bootstrap human through the canonical seam. G6B proves that authority actually *works* through the released Governance runtime for real tenant operations — decision creation, membership authorization, Knowledge ratification authority, refusal under non-authority, audit continuity — **without expanding it.**
