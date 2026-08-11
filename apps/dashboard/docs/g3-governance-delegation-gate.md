# G3 — Governance Authority Delegation & Revocation

**Status: BLOCKED — DIRECTOR GATE A. Nothing implemented.**
**Gate B does NOT fire: the whole phase is achievable with zero migrations.**

---

## 1. Repository reality (re-proved, not assumed)

| check | value |
|---|---|
| path / branch | `~/Developer/Hebun AI`, `main` |
| HEAD = origin/main | `0113af5`, 0/0 ahead/behind, tag `hebun-runtime-p1-product-foundation-complete` |
| working tree | 60 entries (D1, D1.1, G2.1, G2, K4 — all unpublished) |
| migrations / journal | 20 / 20, consistent |
| dependencies | unchanged: `clsx, drizzle-orm, lucide-react, next, pg, react, react-dom, tailwind-merge` |
| tests | **326/326 passing** |
| whitespace | `git diff --check` clean |

### Authority artifacts, classified honestly

| artifact | classification | note |
|---|---|---|
| `decision_records` (+ `bootstrap`, one-per-tenant unique, human CHECK) | **CONNECTED, AUTHORITATIVE** | G2 |
| `governance_sessions` | **CONNECTED** | one session per decision |
| `resolveGovernanceAuthority()` | **CONNECTED, AUTHORITATIVE** | reads the bootstrap decision only |
| `writeGovernanceDecisionWithin()` | **CONNECTED** | joins a caller's transaction (K4 uses it) |
| `governance-decision-audit.server.ts` | **CONNECTED** | the Governance audit sibling |
| `genesis_nominations` (+ consumption) | **CONNECTED, AUTHORITATIVE** | G2.1 |
| `governance_domain: authority-delegation` | **CONNECTED** | already the bootstrap session's domain |
| `decision_type: delegate-authority` | **SCHEMA-ONLY** | zero readers, zero writers |
| `decision_type: revoke` | **SCHEMA-ONLY** | zero readers, zero writers |
| `decision_type: escalate-authority`, `suspend`, `appeal`, `promote`, `approve` | **SCHEMA-ONLY** | out of G3 scope |
| `decision_records.authority_source_actor_*` | **CONNECTED** | G2 writes it on ordinary decisions, NULL on genesis |
| `decision_records.supersedes_decision_id` | **SCHEMA-ONLY** | no reader, no writer |
| `roles.authority_rank`, `roles.system_role`, `roles.policy_refs` | **DESIGNED, unset, unread** | excluded as authority |
| `memberships.authority_scope`, `delegated_by_*` | **DESIGNED, unset, unread** | excluded as authority |
| `permissions` / `role_permissions` | **SCHEMA-ONLY**, 0 rows, 0 readers | no permission runtime exists |
| `runtime-projection` `authorityRank`, `runtime-observability` `authorityScope` | **DERIVED / MOCK** | dashboard projections, not authority |

---

## 2. What IS derivable — the design is settled

None of the following needs a Director decision. Recording it so the implementation turn starts from a design rather than a debate.

**Vocabulary already exists and is correct.** `delegate-authority` and `revoke`, both in domain
`authority-delegation`. G2's own contracts already name them as the reason authority is currently
non-transferable: *"authority moves ONLY by a Governance decision — and that runtime is deliberately
not built."* G3 is that runtime. No new decision type is invented.

**Who may delegate is derivable and non-circular.** A currently-authorized Governance human. Base
case: the bootstrap decision's actor (G2). Inductive case: the holder of an unrevoked delegation.
The chain terminates at the bootstrap decision, which terminates at G2.1's entitlement, which
terminates outside the application at deployment possession.

**Authority is derivable from the decision log alone — no second source of truth.**

```
H holds Governance authority in tenant T  ⟺
    H is the actor on T's bootstrap decision
  OR ∃ committed decision D: tenant=T, type='delegate-authority', subject = H
     AND ¬∃ committed decision R: tenant=T, type='revoke', subject = D
```

Every provenance question Step 2 asks is answerable from those rows: which tenant, which human,
which decision granted it, which human granted it, what authorized the grantor (`authority_source_actor_*`,
walked recursively to the genesis), when, revoked or not, by which decision, by whom, and why
(`justification`, NOT NULL).

**Concurrency is solvable without a new table.** Every tenant has exactly one bootstrap decision row,
guaranteed by G2's partial unique index. That row is a natural per-tenant Governance mutex:
`SELECT … FOR UPDATE` on it at the start of any delegation or revocation serializes all authority
mutations in that tenant. Delegation-vs-revocation overlap, duplicate delegation, and
"revoked actor delegates concurrently" then all resolve by real database serialization — the K3/G2
technique, against a row that already exists.

**Zero migrations.** `subject_type` is `text NOT NULL`, so binding a decision to a human
(`subject_type='user'`) or to a prior decision (`subject_type='governance_decision'`) is a TypeScript
contract change, not a schema change. `justification` is already NOT NULL. The audit sink already
takes free-text actions.

**Therefore Gate B does not fire.** No table, enum, column, index, foreign key, CHECK, or migration
is required. If the Director's answers below force an active-authority projection table, that would
be a new Gate B — but on the current design it is not needed.

---

## 3. GATE A — three constitutional questions the repository cannot answer

These are the Director's own listed Gate A examples, and the audit confirms each one is genuinely
underivable. They are linked: the answer to one changes what the others mean.

### A1 — May a delegate revoke a peer's delegation, or only the grantor?

**Repository evidence:** `governance.ts` says Governance is "the ONLY authority that may … suspend /
revoke / delegate / escalate authority." That establishes revocation belongs to Governance. It says
nothing about *which holder* may revoke *which grant*. `authority_source_actor_*` records what a
decision was made under, not whose grants you may end.

**Why it cannot be guessed:** the two answers fail in opposite directions.

| option | consequence |
|---|---|
| **A1-a — any active Governance authority may revoke any delegation** | Removes stranding: a surviving delegate can clean up. But a delegate can revoke the peers of the human who granted them, and — depending on A2 — attack upward. |
| **A1-b — only the grantor may revoke their own grants** | Contains blast radius. But if the grantor is the unavailable human, their delegates can never be removed — re-creating the stranding G3 exists to fix, in a new place. |
| **A1-c — bootstrap human may revoke anything; delegates may revoke only their own grants** | Hierarchical: matches "genesis is the root". Costs nothing extra to implement. Still strands if the bootstrap human is the one who is gone. |

**Recommendation: A1-c.** It is the narrowest rule that keeps a chain of accountability (every
revocation is either by the grantor or by the constitutional root) without letting peers depose each
other. It is also the only one of the three that needs no extra concept — it falls straight out of
the provenance already recorded.

### A2 — May bootstrap authority be revoked or transferred?

**Repository evidence:** `governance.ts` calls the bootstrap decision "the first authority in a
tenant". G2 enforces exactly one per tenant, with no reversal runtime, and G2.1's entitlement is
consumed permanently — so a second genesis is impossible by construction.

**The finding that matters, and it undercuts the phase's premise:** delegation alone does **not**
remove the stranding limitation. If the bootstrap human becomes unavailable *before* delegating,
nobody can ever delegate, because only they held authority. G3 as scoped fixes stranding only for
tenants that delegated *in advance*.

| option | consequence |
|---|---|
| **A2-a — genesis is permanently constitutional (not revocable, not transferable)** | Honest and simple. Stranding remains possible for tenants that never delegated. G3 becomes "delegation prevents future stranding", not "delegation cures it". |
| **A2-b — an active delegate may revoke the bootstrap human** | Cures stranding fully. But a human the genesis human trusted can depose the genesis human, and the bootstrap decision then no longer means what `governance.ts` says it means. |
| **A2-c — separate `transfer` ceremony, out of G3 scope** | Keeps genesis intact and treats "the root is gone" as its own phase, most likely re-using the G2.1 operator root (deployment possession) rather than in-app authority. |

**Recommendation: A2-a for G3, with A2-c named as the successor phase.** Revoking genesis is a
different constitutional act from delegating, and burying it in this phase is exactly what Step 6
forbids. The limitation gets documented honestly instead of half-solved.

### A3 — Is a zero-Governance-authority tenant legal?

**Repository evidence:** none either way.

Under A2-a the bootstrap human always remains an authority, so a tenant can never reach zero — the
question dissolves. Under A2-b it becomes live: revoke the last authority and the tenant is
permanently ungovernable, since no second genesis is possible.

| option | consequence |
|---|---|
| **A3-a — zero is unreachable** (implied by A2-a) | Nothing to enforce. |
| **A3-b — zero is legal, and permanent** | Requires the UI to say so before the last revocation. |
| **A3-c — refuse the revocation that would empty the tenant** | Needs a "last authority" check inside the mutex — cheap, but it is a rule the repository never stated. |

**Recommendation: A3-a**, as a consequence of A2-a rather than as a separate rule.

---

## 4. What I will build the moment the gate clears

Assuming the recommended answers (A1-c, A2-a, A3-a) — restated so approval is one word:

- **Delegation** — `delegate-authority` in `authority-delegation`, subject = the receiving human
  (`users.id`, tenant-membership-validated), mandatory justification, `authority_source_actor_*` =
  the grantor. Refuses: self-delegation, duplicate active delegation, non-member, other tenant,
  unauthenticated, and every non-authority caller including an owner-band peer.
- **Revocation** — `revoke` in `authority-delegation`, subject = the delegation decision being ended.
  Never deletes or rewrites it. Refuses: duplicate revocation, cross-tenant, revoked-actor-as-revoker,
  and (under A1-c) a delegate revoking a grant they did not make.
- **Resolver** — the existing `resolveGovernanceAuthority` extended in place. No parallel resolver.
  Returns the provenance chain, fail-closed, tenant-scoped, role-band-blind.
- **Concurrency** — per-tenant mutex on the bootstrap decision row; four deterministic races proved
  with real connections and a third observing `pg_stat_activity`.
- **Transaction** — reuses `writeGovernanceDecisionWithin`; decision + audit commit together;
  rollback proved by an injected audit failure.
- **Audit** — `governance.authority.delegated` / `governance.authority.revoked` through the existing
  Governance sibling. `KNOWLEDGE_AUDIT_BOUNDARY` untouched.
- **K4 proof** — B ratifies under delegated authority, provenance traces to A's delegation, then
  revocation stops B. Knowledge's authority model is not touched; it keeps consuming the resolver.
- **UI** — the existing Governance workspace: *Delegate Governance Authority*, *Revoke Governance
  Authority*, *Active Governance Authorities*, *Authority Provenance*, with the explicit
  does-NOT-change list.
- **Zero migrations.**

---

## 5. What is NOT being asked for

No new authority class, no permission scopes, no policy language, no approve-only/ratify-only grants,
no thresholds, no ACLs, no escalation, no appeals, no voting, no quorum. Step 3's narrowest scope:
a delegated authority means exactly the Governance decision capability G2 and K4 actually implement,
within one tenant.
