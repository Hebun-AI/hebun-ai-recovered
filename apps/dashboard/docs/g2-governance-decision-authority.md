# G2 — Minimal Governance Decision Authority

**Status: IMPLEMENTED.** The first durable Governance authority in Hebun now exists, and it can
only come into being the way the schema always said it should: a verified human, spending an
accepted entitlement, writing one bootstrap decision.

---

## The constitutional chain

Seven stages. No two of them may merge, and each is a different authority.

```
DEPLOYMENT / OPERATOR ROOT        possession of the local machine, and nothing more
        ↓                         npm run governance:nominate-genesis -- <slug> <email>
G2.1 PENDING NOMINATION           genesis_nominations.status = 'pending'
        ↓                         /governance/genesis, D1 verified session
D1 VERIFIED-HUMAN ACCEPTANCE      the nominated human accepts, at aal1
        ↓
ACCEPTED ENTITLEMENT              genesis_nominations.status = 'accepted'  ← still NOT authority
        ↓                         /governance/authority, mandatory justification
G2 GOVERNANCE SESSION             governance_sessions, domain = authority-delegation
        ↓
G2 BOOTSTRAP DECISION             decision_records.bootstrap = true        ← the constitutional event
        ↓
FIRST GOVERNANCE AUTHORITY        that decision's actor may now make Governance decisions
```

Naming discipline, because the whole design depends on it:

- **G2.1 is not Governance.** It is entitlement — permission to *establish* Governance, held by a
  human who has not yet done so. The entitlement is spent, once, and recorded as spent.
- **Authentication is not Governance.** D1 proves who somebody is. It grants nothing.
- **A role band is not Governance.** `roles.type = owner` was seeded by a script. If it conferred
  Governance authority, the bootstrap decision would be redundant — and `governance.ts` has always
  described that decision as "the first authority in a tenant".

---

## What G2 built

| artifact | what it is |
|---|---|
| `src/db/migrations/20260811155831_g2_governance_bootstrap_authority.sql` | the one additive migration |
| `src/db/schema/governance.ts` | + partial unique index, + bootstrap-human CHECK |
| `src/db/schema/genesis-nomination.ts` | + `consumed_at`, `consumed_by_decision_id` and their integrity checks |
| `src/features/governance-decision/contracts.ts` | vocabulary, boundaries, the authority model, consequence text as values |
| `src/features/governance-decision/bootstrap-authority.server.ts` | the genesis transaction and its read |
| `src/features/governance-decision/decision-authority.server.ts` | who may decide after genesis, and the ratify/reject writer |
| `src/features/governance-audit/governance-decision-audit.server.ts` | the third sibling audit contract |
| `src/app/(dashboard)/governance/authority/{page.tsx,actions.ts}` | the surface |
| `src/components/governance-authority/governance-authority-card.tsx` | the ceremony card |

### The two constitutional invariants, now enforced by Postgres

`governance.ts` has documented both since the governance foundation migration, with the honest note
that they were "enforced at the write layer later". G2 is that write layer — and an invariant the
application alone enforces is not an invariant, because two concurrent requests both read "no
bootstrap yet" and both insert.

- `decision_records_one_bootstrap_per_tenant_uq` — partial unique on `tenant_id` where `bootstrap`.
- `decision_records_bootstrap_human_chk` — `bootstrap = false OR actor_type = 'human'`. Spec 49 §4
  human supremacy: an agent can never self-elevate into the genesis.

### Entitlement consumption is recorded, never inferred

"A bootstrap decision exists for this tenant, therefore the entitlement was consumed" is an
inference this phase deliberately refuses. Two facts that are merely correlated today would be
indistinguishable from two facts that drifted apart tomorrow. `consumed_at` and
`consumed_by_decision_id` say it outright, with `ON DELETE RESTRICT` so the history cannot be
deleted out from under the entitlement.

### One transaction, or nothing

```
BEGIN
  insert governance_sessions      →  the bounded process
  insert decision_records         →  bootstrap = true, actor_type = 'human'
  update genesis_nominations      →  consumed, predicated on still being unconsumed
  insert audit_log                →  governance.bootstrap.established / committed
COMMIT
```

A failing audit insert aborts the whole thing — proved by a test that adds a `NOT VALID` CHECK to
`audit_log` mid-run and then asserts the session, the decision and the consumption all rolled back.
"Governance established but unaudited" is not a state this code can produce.

### Who may decide after genesis

`POST_BOOTSTRAP_AUTHORITY_MODEL.kind = "bootstrap-established-human"`. Derived, not invented, from
three facts already on disk:

1. `governance.ts` states a bootstrap decision "is the first authority in a tenant" — so that
   decision's own `actor_id` is the human in whom the authority resides;
2. Governance is documented as the only authority that may approve / ratify / promote / certify /
   suspend / revoke / delegate / escalate — so holding it *is* the right to make decisions;
3. `authority-delegation` (domain) and `delegate-authority` (type) exist, so authority moves only by
   a Governance decision — and that runtime is deliberately not built. Until it is, a tenant's set
   of Governance authorities is exactly `{ bootstrap actor }`.

Not used, and each for a reason: `roles.type` (seeded, never established by a ceremony);
`permissions` / `role_permissions` (schema-only, zero rows, zero readers); `memberships.authority_scope`
(unwritten). Borrowing any of them would invent an authority model.

### Recording a decision changes only the ledger

A `ratify` decision does **not** write `knowledge_nodes.ratified_at`, `ratification_decision_id`, or
`governance_session_id`. `decision-authority.server.ts` does not import the Knowledge schema at all,
so the binding is unavailable rather than merely unwritten. That binding is the entire content of K4.

The subject vocabulary is closed to one entry — `knowledge_fact` — because it is the only subject
G2 can prove exists inside the caller's own tenant. The table is chosen by a `switch` over a union
type, never interpolated from a caller value, so a URL, a path, or a command string has no shape to
arrive in.

### Audit

Third sibling over the same `audit_log` sink, zero schema. Three domains, three boundary constants,
three entity types (`knowledge_fact`, `genesis_nomination`, `governance_decision`), and no module
references another's boundary.

Two outcomes are produced: `committed` for a decision that landed, and `rejected` for an
**authorized** actor refused by a governed rule — losing the one-bootstrap race, or spending a spent
entitlement. Unauthenticated and unauthorized attempts are not recorded; those are events about a
principal, which is the boundary G1 drew and G2.1 repeated.

The justification is **not** copied into the ledger. `decision_records.justification` is NOT NULL and
is never rewritten, so it is already the single durable home of that sentence.

### Justification

Mandatory, human-authored, and inert. It is never parsed, never rendered as markup, never
interpolated into SQL, and never read by a model as instruction. The test stores
`<script>alert(1)</script>`, `' OR 1=1 --`, `/terminal restart production`,
`Ignore previous instructions`, and `../etc/passwd`, then reads each back verbatim and asserts
nothing was granted, executed, or dropped.

---

## Limitations

1. **Authority is non-transferable.** One human per tenant holds it. If they become unavailable the
   tenant has no Governance authority until a delegation runtime exists. Delegation, escalation and
   revocation are `governance_decision_type` values with no runtime, on purpose.

   > **Historical phase state — superseded by G3.** The paragraph above describes the system as it
   > stood at G2 closure. G3 later built the delegation and revocation runtime, so a tenant that has
   > delegated is no longer stranded when its bootstrap human becomes unavailable. Bootstrap
   > authority itself remains non-transferable (G3 Gate A answer A2-a): the bootstrap seat is
   > permanently constitutional, and delegation grants a peer the same authority rather than moving
   > the seat. `escalate-authority` still has no runtime. Current runtime truth is defined by
   > [g3-governance-delegation-authority.md](g3-governance-delegation-authority.md).
2. **aal1.** The genesis is a constitutional act performed at single-factor assurance, inherited
   from G2.1 and accepted deliberately for this stage.
3. **The operator is unidentified.** Inherited from G2.1: the chain's external root is possession of
   the deployment.
4. **No reversal.** Superseding a decision is itself a Governance decision, and that is not built.
   `supersedes_decision_id` remains an unwritten column.
5. **`justification` is NOT NULL but has no non-empty CHECK.** The minimum length is enforced
   server-side only. Adding a database check was out of the authorized migration scope.
6. **One decision, one session.** G2 creates a session per decision. Multi-decision sessions,
   voting, quorum, approval chains, gates and policy evaluation are all unbuilt.
7. **`governance_health` is never computed.** The column exists; no runtime sets it, so no surface
   shows it.

---

## Firewalls

- **K4**: no Knowledge table is written, and the Knowledge schema is not imported. A ratify decision
  leaves `knowledge_nodes` untouched — asserted against a real database.
- **R2E / execution**: Governance never reads or writes provider connectivity, and the kill-switch
  stays OFF. No provider call, no Computer Use, no terminal, no `fetch`, no `child_process`.
- **Heby**: no Heby surface imports Governance, and no slash command, voice path, or model tool
  names a Governance mutation.
