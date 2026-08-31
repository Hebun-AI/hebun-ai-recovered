# AMA-1 — Agent Mandate Authority Foundation · Closure

**Era III, first program, first milestone.** Selected by Director decision after the read-only
architecture boundary discovery
(`hebun-era3-agent-mandate-authority-boundary-discovery.md`) settled the ownership question.

**Baseline:** `main` at `37a9d76`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger
**39 → 40**.

---

## 1 · What AMA-1 is, in one sentence

> An organization can record what ONE durable agent is FOR, and the maximum surface inside which it
> may propose — under a human Governance decision, in one transaction, with an audit trail — and
> doing so grants nothing.

## 2 · What AMA-1 is NOT, and these must not blur

```
MANDATE RECORDED   != PROPOSAL-ENFORCED
MANDATE RECORDED   != HEBY-GROUNDED
MANDATE RECORDED   != PRODUCTION-ACCEPTED
```

At the close of AMA-1 the Agent Mandate Authority is **DESIGNED · IMPLEMENTED · PERSISTED ·
GOVERNANCE-BOUND · AUDITED**. It is **not** proposal-enforced, **not** Heby-grounded, and **not**
production-accepted. Each of those becomes true only if a later phase independently makes it true.

The absence of enforcement is not asserted, it is **measured**: a census over all of `src/` proves
that exactly three modules outside the feature can see a mandate — the schema barrel, the audit
sibling, and the Governance decision writer — and none of them is a proposal path. `/agents` is
unchanged; no surface renders a mandate yet.

---

## 3 · Authority owner

A **dedicated Agent Mandate Authority** — architecture D of the discovery. The six-owner boundary is
stated as data in `AGENT_MANDATE_AUTHORITY_BOUNDARY` and asserted by test:

```
AGENT IDENTITY      owns  who the agent is             (unchanged: 2 transitions, 2 writers)
AGENT MANDATE       owns  what it is for               (NEW)
CAPABILITY REGISTRY owns  what action kinds exist      (unchanged)
GOVERNANCE          owns  the human authorization      (gained one subject, no state)
ACTION AUTHORIZATION owns whether one act is permitted (unchanged)
EXECUTION           owns  whether it ran               (unchanged)
```

**Governance gained no mandate-state writer**, and that is enforced rather than intended: a firewall
asserts no file under `src/features/governance-decision/` names `agentMandates` or imports the
mandate schema, and a bite-proof adds that import and watches the firewall fail.

---

## 4 · The mandate contract

| Field | Meaning |
|---|---|
| `tenant_id`, `agent_id` | the subject, bound by a **composite** FK onto `agents(tenant_id, id)` |
| `mandate_revision` | the ordinal. Effective = `max(revision)`. Derived on read, stored nowhere |
| `purpose` | prose, addressed to a human. Read by no gate |
| `proposal_scope` | `text[]`, typed `AgentOriginableActionKind[]` — the ceiling |
| `effective_from` | the establishing transaction's clock |
| `governance_decision_id`, `governance_session_id` | NOT NULL provenance, `restrict` |
| `established_by_actor_type/_id` | CHECK-constrained to `human` |
| `supersedes_mandate_id` | NULL exactly on revision 1, enforced in both directions |

**The scope type IS the released origination vocabulary.** `MANDATE_SCOPE_VOCABULARY` is
`AGENT_ORIGINABLE_ACTION_KINDS` itself — the same reference, not a copy — so a superset does not
compile, and the two cannot drift by anyone editing one of them. The table repeats the list once in
SQL (a CHECK cannot import TypeScript) and a test pins the two equal.

**Absent by design:** `status`, `withdrawn`, `is_current`, `superseded_at`, `enforced`, `applied_at`,
`score`, `confidence`, and any permission, permit, provider or credential column. Each would be a
fact AMA-1 cannot prove, or a second copy of one another authority owns.

---

## 5 · Persistence model — and one deliberate divergence from the discovery

The discovery proposed a partial unique index over an effective flag. The released design uses a
**UNIQUE ordinal** — `(tenant_id, agent_id, mandate_revision)` — instead, and the difference is the
point: a partial index would require the writer **to edit the previous row** on every change, and a
historical record a superseding write can edit was never a record.

**Nothing in this table is ever updated.** The effective mandate is the highest ordinal; earlier
revisions stay byte-identical, which the integration test proves by snapshotting revision 1 and
comparing the whole row after revision 2 lands.

That index is also the concurrency guarantee, and it is why AMA-1 needs **no table lock**. The agent
identity ceremony takes one because `agents` carries no unique index; here the index exists, so two
simultaneous establishments produce one commit and one `unique_violation`, reported as
`concurrent-mandate-change` rather than retried at a higher ordinal — retrying would write a
revision on top of one the human never saw.

**Withdrawal is an EMPTY scope, not a boolean.** `NO MANDATE != EMPTY MANDATE`, and the two stay
distinguishable by the presence of a row rather than the value of a nullable flag.

---

## 6 · Governance binding

One transaction, or nothing: agent resolution → effective-revision read → stale-review precondition
→ Governance decision + session → mandate row → Governance audit event → mandate audit event.

- **The subject is the REVISION, not the agent.** A decision bound to the agent would silently mean
  "whatever mandate is current when someone reads this" — the defect K4 found when G2's subject was
  a Knowledge fact rather than a version.
- **The circular reference** is resolved the way I1 and R3A were authorized to resolve it: the
  mandate id is generated in the application so the decision can bind to it before the row exists.
- **The outcome is `agent-mandate-bounded`, not `approved`**, and the subject is checked **before**
  every generic branch in the decision writer. Without that check a mandate decision — which uses
  `approve`, the same type membership authorization uses — would have recorded
  `membership-authorized` in the permanent ledger: a decision about an agent's purpose, filed as a
  human being admitted to the organization.
- **Its own `governance_domain`**, `agent-mandate`. The unused `agent-registration` value was
  refused: registration is an agent coming into existence, which `features/agent-identity` owns and
  a mandate decision never performs. A test asserts `agent-registration` is still claimed by nobody.

---

## 7 · Writer boundary

One writer, `establishAgentMandate`. The caller supplies the agent, the purpose, the scope, a
justification and the revision it was shown. It **cannot** supply the tenant, the acting human, the
decision, the session, the ordinal, the effective instant or the predecessor — all server-derived,
with no parameter to arrive in.

**An agent cannot reach it, for two independent reasons.** There is no agent authentication in
Hebun, so an agent has no session from which a `TenantContext` resolves; and
`agent_mandates_human_establisher_chk` admits only `human`, so a row naming an agent as its own
establisher is rejected by PostgreSQL regardless of any application code. The human-only CHECK
census across the database grew **8 → 9** — strictly, in the tightening direction.

`resolveGovernanceAuthority` is the only authority question asked. A tenant **owner** who is not the
human the bootstrap decision established is refused `not-the-governance-authority`, proved against a
real database with a real owner-band membership.

---

## 8 · Read seam

`readEffectiveAgentMandate` and `readAgentMandateHistory`. Tenant-scoped by predicate with no
unscoped or cross-tenant query anywhere in the module, and read-only in a way that can be proved:
the module contains no `insert`, `update`, `delete` or `transaction` at all.

Three answers, kept separate:

```
known + mandate   this agent's purpose is bounded, and here is the bound
known + null      NO MANDATE — nobody has bounded it
unavailable       Hebun could not look
```

`NO MANDATE != UNBOUNDED` and `UNAVAILABLE != NO MANDATE`. There is no `allowed` and no `permitted`
field: whether any act may occur is answered by three other authorities.

**Heby is not connected to this read, and no surface renders it.** That is AMA-2's decision to take.

---

## 9 · Structural prohibitions, and how each is enforced

| A mandate may never mean | Enforcement |
|---|---|
| authorized to execute / issue permits | no execution, permit, or single-spend module is imported; asserted as unreachable imports |
| authorized to approve | seven pre-existing human-only CHECKs untouched; `resolveGovernanceAuthority` has no mandate parameter |
| authorized to grant permissions | `permissions` / `role_permissions` still have **zero writers** repository-wide, asserted as a census |
| authorized to modify Governance | Governance names no mandate table; the subject vocabulary is closed |
| authorized to widen its own mandate | the human-only CHECK, plus no agent authentication |
| authorized to access a provider | no provider, credential, or model module is imported |
| every technically available capability | the scope type is the released vocabulary; a superset does not compile, and the table's CHECK refuses one by raw SQL |

**`agents.authority_ceiling` is never named** — not in the feature, not in the schema, not in the
audit sibling, not in the migration. It has no writer and **does** have a reader
(`canonical-read/actor-resolution.ts` summarizes it), so filling it would publish a constraint as an
authority through canonical actor resolution with nothing else failing. A bite-proof adds that
reference and watches the firewall fail.

**The only `agents` columns this feature touches are** `id`, `tenantId`, `agentLifecycleStatus`,
`retiredAt`, `deletedAt` — identity and service state. Enumerated, so a future edit that only READS
a configuration column fails.

---

## 10 · Migration truth

**39 → 40.** `20260831110423_ama1_agent_mandate_authority.sql`, generated by drizzle-kit, not
hand-written.

- ONE table created: `agent_mandates`.
- **ZERO existing tables altered** — asserted by parsing the migration; `agents` in particular is
  byte-unchanged by it.
- ONE enum value added: `governance_domain` gains `agent-mandate`. The Governance **subject type**
  needed no migration, because `decision_records.subject_type` is `text`.
- Zero DROP, zero backfill, zero edit to a released migration.

Twenty-six absolute ledger pins across the suite moved 39 → 40, and the human-only CHECK census
moved 8 → 9. **Every one was extended, none was relaxed** — an enumeration was never loosened to
"at least N", which would let a future phase delete a released constraint and still pass.

---

## 11 · Validation

- **Targeted:** `tests/ama1-agent-mandate/` — `mandate-postgres.ts` (real PostgreSQL, disposable),
  `mandate-firewall.ts` (structural), `bite-proofs.ts` (12 mutations, **all 12 bite**, each failing
  for its stated reason and restored byte-for-byte).
- **Regressions:** agent identity, agent proposal 1/2, agent runtime, ceremony disclosure, SIA-3,
  SIA-2.6, R3A, Governance closure and KGA all re-run and green after the pin repairs.
- Typecheck clean. Lint zero errors on owned files.

Two real regressions were found by the suite and fixed, not worked around: the absolute ledger pins,
and the human-only CHECK census.

---

## 12 · Exact remaining scope for AMA-2

AMA-2 is **proposal enforcement**, and only that:

1. `recordAgentOriginatedActionRequest` (and/or `buildOriginationCandidates`) reads the effective
   mandate and refuses an out-of-mandate proposal, **failing closed** — never falling back to the
   released constant when the mandate authority is unreadable.
2. Two distinct refusals: `no-mandate` and `mandate-authority-unavailable`.
   `NO MANDATE != UNLIMITED MANDATE`; `UNAVAILABLE != NO MANDATE`.
3. The human `/send` path stays unconstrained — the mandate bounds the AGENT, not the person.
4. The AMA-1 firewall's enforcement-absence census inverts: the origination path becomes the fourth
   module that may see a mandate, and nothing else does.
5. `MANDATE_CAPABILITY_LADDER`'s second rung moves to `reached: true`; the other three do not.

Explicitly still out of scope after AMA-2: a second agent, agent selection, agent authentication,
mandate templates, mandate policy, automatic mandate derivation, and Heby grounding on a mandate.

```
AMA-1 = IMPLEMENTED / RELEASED
AMA-1 != PROPOSAL-ENFORCED
AMA-1 != HEBY-GROUNDED
AMA-1 != PRODUCTION-ACCEPTED
ERA III = OPEN · AGENT MANDATE AUTHORITY = ACTIVE PROGRAM
```
