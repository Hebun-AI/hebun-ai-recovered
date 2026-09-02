# SUBJECT ACT HISTORY V1 — CLOSED / PRODUCTION-ACCEPTED

**Release** `f9a3152` · **Production ledger 45 — unchanged**, digest `b41faf35181a4298f9b90cffb3e59314`
**Production cluster** `7675444875863894887` / `neondb`
**Deployment** `dpl_EdkpSXzPVRquuJdVmx7vfnLC2aDm`, target `production`, created `2026-09-02T20:50:33Z`, aliased `www.hebuntech.com`
**Zero migrations. Zero schema change. Zero new truth. Zero rows written.**

---

## What Hebun can now do that it could not

`audit_log` has carried `entity_type` + `entity_id` on every act since R1, written by the
authorities that performed them. Nothing could read acts **by subject**.

    readRecordedActPage(tenantId)     tenant-wide only — no entity filter
    heby-recorded-act-source          drops `entityId` by design
    readKnowledgeMutationHistory      the one subject-scoped reader — zero product consumers

So a person looking at one work item had to scroll a chronological feed of everything and eyeball
which rows concerned it, and Heby could not help at all.

    "What has this organization actually done to this specific thing?"

is now answerable, from the record that already held the answer.

## Three faces of one subject, never merged

    DECLARED   the organization's own statement about its work     WORK-1 / WEV-1
    OBSERVED   a provider's answer about the outside world         WORK-ACTIVITY-1
    RECORDED   what Hebun did, under whose authority, and when     this phase

    RECORDED ACT != WORLD EVENT != WORK PROGRESS != COMPLETION != VERIFICATION

Every rendered line says what **Hebun recorded**, never what happened. "Hebun recorded a
`work.reference-declared` act by a human" is provable from a row; "the human changed X" is a
stronger sentence only that authority's own semantics could license, and this reader holds none.

## EMPTY HISTORY != NOTHING HAPPENED

Zero acts renders as *"Hebun has no recorded acts for this subject in this record"* and never as
inactivity. A fourth outcome, `unrecognized-subject`, keeps a typo from manufacturing that claim: an
unaddressable reference **refuses** and never falls through to the tenant-wide ledger.

---

## The design decisions

**A fourth reader file, for a fourth reason.** `read.server.ts` forbids `.limit(` anywhere;
`act-history-read.server.ts` carries one **unconditional** tenant scope. An optional subject filter
there would have made both of its statements conditional, narrowing a released guarantee from *"the
tenant scope is one expression"* to *"one expression on whichever branch was taken"*. Its own file
keeps both absolute.

**`entity_id` is a filter, not a disclosure.** It is the one withheld column this phase had a reason
to want, and it appears **only in the `WHERE` clause**. The caller supplied it; echoing it off the
row would turn a predicate into a disclosure the moment a caller passed a subject it had not already
resolved. The firewall therefore pins the **position**, not the absence — banning the column outright
would have forbidden the predicate the phase is.

**One withheld list, not two.** The select list is R7.1.1's eight columns unchanged, asserted against
the released `WITHHELD_AUDIT_COLUMNS`. Two lists is how two readers come to withhold different things
while each looks correct alone.

**An argument, not a new command.** `/audit <ref>` is the same ledger, authority, projection and
outcomes with one more equality. `/audit` alone is byte-for-byte R7.1.1's command.

**Two reference kinds, not an ontology.** `work-item` and `department` — both spellings already
released, both with acts in the production ledger. The read underneath is generic; the map governs
only what a reference *string* may name.

---

## Production acceptance — measured

Run through the released reader and observer against production, corroborated by direct SQL.

| Claim | Measured |
|---|---|
| Correct tenant | `f625b683…` — resolved server-side, never a parameter |
| Correct subject | `work_item` / `983d1cb2-4720-41bd-b430-0da7a5d7c344` |
| Acts belong to that subject | **2**, byte-identical to independent SQL over the same predicate |
| Actor type preserved | `work.reference-declared` — **human**; `work.recorded` — **system** |
| Timestamps preserved | `2026-09-02T19:26:23.720Z`, `2026-09-02T14:03:35.982Z` — newest first |
| Authority preserved | `membership` / `organizational-work` on both, verbatim |
| Safe projection only | eight fields per act; no `metadata`, `previous_state`, `next_state` or actor identifier |
| No generic metadata exposure | the serialized answer carries no withheld column on any act |
| Entity id not echoed | absent from every act; present only on the envelope, where the **caller** supplied it |
| Tenant isolation | the same subject id read as another tenant → **0 acts** |
| Wrong-subject isolation | the same id under `knowledge_fact` → **0 acts** |
| Unaddressable subject | `unavailable` / `unrecognized-subject` — never `empty` |
| Migration ledger | **45**, digest `b41faf35…` — unchanged |
| No mutation | `audit_log` newest row still `19:26:23.722Z`, hours before this release |

### The zero-history subject, and why it is the strongest evidence here

Agent `4ffeeb83` — a real production row — reads **empty**. That agent demonstrably *did things*:
five recorded model invocations and two mandate revisions. Its acts are recorded under
`agent_mandate`, not under `agent`, so its own subject history is genuinely zero.

    agent 4ffeeb83          -> empty     (and yet: 5 invocations, 2 mandate revisions exist)
    work_artifact a45229f8  -> empty
    agent_mandate 3b3887c5  -> recorded  agent-mandate.revised / human
    department e40866a8     -> recorded  organization.department.owner-set, .created / human

A surface that rendered the first line as inactivity would be inventing an organizational fact out
of its own coverage. That is the sentence this phase exists to refuse, and production supplied the
case that proves it.

**Non-effects.** No Governance decision, no permit, no execution, no provider call, no write of any
kind. Two rows moved in production during the window — `user_session_contexts` and `auth_credentials`
at `20:37` — and both are the Director's own login, unrelated to this capability. `audit_log` is
unchanged.

---

## Validation

Four new suites plus targeted regressions. No full suite, no migration.

| Suite | Proves |
|---|---|
| `subject-truth` | reference resolution, "Hebun recorded" wording, truncation stated, empty semantics, refusal ≠ empty, `/audit` alone unchanged |
| `subject-postgres` | tenant isolation, wrong-subject isolation against **three near misses newer than every real act**, the bound, total ordering, stable pages, empty vs unavailable, poisoned `metadata`/`previous_state`/`next_state` never surfacing |
| `subject-firewall` | select-list boundary, `entity_id` in `WHERE` only, one shared scope expression, no writer, no model, three vocabularies agree |
| `subject-bite-proofs` | **8 mutations, all bit** — including the two the Director named, structurally and at runtime |

Regressions green: R7.1.1 (12 bites), R7.1, G1, E2-6, E2-7, WEV-1, GIA-1, WORK-1, S1. Typecheck,
lint and build clean.

**Two released pins re-anchored, both directly affected.** R7.1.1's M10 find-string — the `/audit`
description gained `", or for one subject."`; the pin itself (no label on this ledger may promise
intrusion coverage) is unchanged. G1's audit-sink reader allowlist — a fourth declared reader, named
explicitly rather than relaxed into a directory prefix.

---

## What stays deliberately unavailable

- **No new truth, no second record.** No table, no materialization, no cache, no history authority.
  `audit_log` remains the sole authority; the `governance-audit` writers remain its only writers.
- **No write anywhere in the graph**, proved by walking the real import closure.
- **No model.** Nothing is summarized, classified or explained. An act is reported verbatim or not
  at all.
- **No actor identity.** A KIND of actor (`human` / `system` / `agent`), never which person.
- **No search.** A subject is identified by the two values its writer stamped, or not at all.
- **No global audit UI.** Reach is the existing `/audit` command and one section on the work item.
- **Not a security log.** `audit_log` records what authorized actors did; refused and
  unauthenticated attempts are never written to it.

**Known and NOT investigated, by instruction:** `integrations.status = 'pending'` on both rows.
Classified in discovery as **A — harmless legacy/display debt**: the column is documented INERT and
UNREAD, with zero readers and zero writers in `src/`. Untouched.

**GIA-1, WEV-1 and WORK ACTIVITY V1 remain CLOSED / PRODUCTION-ACCEPTED.**

---

**SUBJECT ACT HISTORY V1 CLOSED / PRODUCTION-ACCEPTED.**
