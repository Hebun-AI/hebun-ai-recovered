# Era III — Governed Internal Action · Architecture Discovery

**Era III, third discovery.** Determines whether Hebun needs a legitimate architecture for governed
INTERNAL actions — `intent → prepared action → Governance → authorization → the authoritative owner
performs its OWN mutation → durable result → observation` — without turning the execution layer into
a second writer over Knowledge, Organization, Governance, Agents or any other authority.

**Baseline:** `main` at `83deb52`, equal to `origin/main`. Production migration ledger **40**.
**Status:** discovery only. Nothing implemented, no schema, no migration, no writer, permit,
adapter or vocabulary change.
**Verdict:** **C · DEFER** — the architecture is sound and mostly already built; nothing currently
justifies the complexity.

---

## 1 · What this discovery is, in one sentence

> Hebun already has a governed-internal-action architecture — it is the K4 shape, where the
> authoritative writer resolves Governance itself and commits the decision, the mutation and the
> audit in one transaction — and a permit is needed only when the proposer is not the decider.

---

## 2 · The core principle, restated as it was tested

```
Governance authorizes the act.
Execution proves the act may proceed.
The authoritative owner performs the mutation.
```

The principle held. What the measurement changed is *how much of it already exists*, and *who is
missing from the chain today*.

## 3 · The pins

```
DECISION            != PERMIT
PERMIT              != INVOCATION
INVOCATION          != SUCCESSFUL MUTATION
SUCCESSFUL MUTATION != SUCCESSFUL ORGANIZATIONAL OUTCOME
AUTHORIZED BY HUMAN != EXECUTED BY SYSTEM
AUTHORIZED BY SYSTEM = UNREPRESENTABLE
EXTERNAL AMBIGUITY  != INTERNAL ROLLBACK
GENERIC ENVELOPE    != GENERIC DISPATCHER
```

---

## 4 · The governing finding

Five released writers — **K4** knowledge ratification, **AMA-1** mandate establishment, membership
authorization, enrollment decision, and invitation issuance — all follow ONE shape:

> the authoritative writer resolves Governance authority **itself**, and writes the decision, the
> mutation and the audit inside its **own single transaction**.

No permit. No execution layer. No adapter. K4 states the reason in its own header: *"every table
involved lives in the same control-plane database, so no distributed-transaction machinery was
needed or invented."*

**The permit exists to bridge a durable gap between authorization and mutation.** That gap exists in
exactly two circumstances:

1. the act **leaves the database** — an HTTPS call can be ambiguous, so `provider_response_class`
   carries an `ambiguous` value and reconciliation is possible; or
2. **the proposer is not the decider**, and the act happens later than the authorization.

For a human authorizing their own internal act, neither holds. Both commit together. Routing that
through propose → decide → permit → invoke would add a Governance decision that does not exist
today. **Duplication, not value.**

---

## 5 · Definition — what an internal action is, and is not

| # | Stage | Owner today | Durable |
|---|---|---|---|
| 1 | read | the owning read seam | no |
| 2 | analysis | model / Heby | no |
| 3 | preparation | Work Artifacts, Recipients, Heby prepare-tools | yes |
| 4 | proposal | `heby_action_requests` | yes |
| 5 | Governance decision | `decision_records` | yes |
| 6 | authorization | the human, CHECK-constrained | — |
| 7 | permit | `action_permits` | yes |
| 8 | **internal authoritative mutation** | **the owning authority's own writer** | yes |
| 9 | external provider mutation | Action Execution + one adapter | yes |
| 10 | observation | audit, ledger, Heby grounding | yes |

**REJECTED definition:** *"Action Execution gets SQL access to every authority."* The repository
already rejected the weaker version of this — `adapter-registry.server.ts` declined to activate the
`providers` table because *"activating one to hold a single adapter would create a SECOND AUTHORITY
deciding what Hebun may run."*

**ACCEPTED definition:** *"a governed invocation of an existing authoritative writer."* It is
sufficient, because the mechanism it needs is already released and running in production:

> **Two authorities, one transaction, and the OWNER exports the seam.**

Measured instances, all shipped:

- `integration-credentials/credential-repository.server.ts:283` calls
  `attachCredentialToConnectionWithin` — Integration's seam, inside Credentials' transaction.
- `app/api/integrations/google/callback/route.ts:197` and
  `provider-github/connect-installation.server.ts` call `recordVerifiedConnectionWithin`.
- Four separate authorities call `writeGovernanceDecisionWithin` inside their own transactions.
- Eleven audit writers export a `…Within` seam.

Authority ownership survives because the seam is authored **by** the owner and the caller supplies
only a transaction handle. Nobody gains SQL access to anybody's table.

---

## 6 · The generic / external-specific split

The decisive measurement. Component by component, across the R3A/R3B chain.

| Component | Class | Evidence |
|---|---|---|
| `heby_action_requests` | **GENERIC** | `action_kind`, `tool_id`, `side_effect`, `reversibility`, `owner_workspace`, `canonical_payload` jsonb, `expected_effect`, `consequences`. `target_kind` / `target_ref` / `target_label` are **nullable**. **Zero send-specific NOT NULL columns.** |
| `action_permits` | **GENERIC** | request id, decision id, session id, human authorizer, `bound_payload_digest`, TTL, `consumed_at`, `handoff_id`, revocation. **No provider, adapter, recipient or endpoint anywhere.** |
| `consumeActionPermit` + `onAuthorizedWithin(tx, authorization)` | **GENERIC — a real transaction envelope** | R3B passes `getDb: () => db` and performs all its work inside the callback. Nothing in the envelope knows what a send is. |
| `action_execution_attempts` | **EXTERNAL-SEND-SPECIFIC** | three **NOT NULL** send columns — `recipient_endpoint_digest`, `draft_revision_digest`, `recipient_id` (composite-FK'd to `external_recipients`) — plus `adapter_id` NOT NULL. An internal act has none of these and would have to **fabricate three**, which is exactly the argument `heby_origination_invocations` used when it refused to live in `messages`. |
| `provider_response_class` | **EXTERNAL-SPECIFIC** | `accepted / rejected / unreachable / ambiguous`. **A database transaction is never ambiguous.** |
| `failure_class` | **mostly external** | `recipient-retired`, `artifact-retired`, `artifact-unresolvable`, `digest-mismatch`, `credential-unavailable`, `adapter-unavailable`. Only `authorization-invalid` and `execution-disabled` generalize. |
| `adapter-registry.server.ts` | **EXTERNAL-SPECIFIC** | one frozen descriptor; the validator refuses a second **by name**, not by count. |
| `execute-authorized-action.server.ts` | **EXTERNAL-SPECIFIC** | `EXECUTABLE_ACTION_KIND` is a single constant; resolves recipient and artifact; makes one post-commit HTTPS call. |

**Consequence.** The authorization envelope is reusable with zero change. The dispatcher and the
ledger are external-send-specific **by schema, not by style**, and must not be generalized.

**And an internal act needs neither.** `audit_log` already records the mutation atomically, and a
rolled-back internal transaction leaves no row, spends no permit, and writes no audit — three
consistent absences. `action_execution_attempts` exists only because an external call can leave the
world changed with nothing written locally.

---

## 7 · Writer census — the thirteen questions

| | **retract Knowledge source** (R6D) | **ratify Knowledge version** (K4) | **retire agent identity** |
|---|---|---|---|
| authority owner | Knowledge | Knowledge + Governance | Agent Identity |
| state transition | active nodes → `retired`, `retired_at` stamped | version bound to a ratify decision | `retired_at` + lifecycle |
| who may invoke today | Knowledge authoring band | **the Governance human only** | tenant human |
| already requires human authority | yes (application-level) | yes (`resolveGovernanceAuthority`) | yes (application-level) |
| already creates a Governance decision | **no** | **yes** | no |
| already writes audit | **yes, one per fact, same transaction** | yes, two events, same transaction | yes |
| idempotent | effectively — a second call finds an empty set and refuses | no | no — terminal |
| reversible | **no writer un-retires** | no reversal runtime | **terminal** |
| transaction-joinable seam | **NO** | **NO** | **NO** |
| could accept a prior permit without weakening its authority | **yes, if Knowledge authors the seam** | **no** | yes in principle |
| would create duplicate Governance decisions | **no** — it writes none today | **YES — it already writes one** | no |
| would bypass a human-only CHECK | **no CHECK exists** on `knowledge_nodes` | n/a | no |
| would collapse authorized into executed | no, if the permit is spent in the same transaction | **YES — the ratification IS the decision** | no |

---

## 8 · Strongest candidate — retract a Knowledge source

`knowledge/retract-source.server.ts` (R6D), product-reachable through
`app/(dashboard)/knowledge/actions.ts` and the Knowledge sources card.

| Criterion | Assessment |
|---|---|
| real product value | **high** — undoing a wrong upload otherwise takes up to 40 governed acts, one per fact |
| existing authoritative writer | **yes**, released, production-accepted |
| clear authority ownership | **unambiguous** — Knowledge owns Knowledge state, and R6D is `retired`'s first and only writer |
| blast radius | **narrow** — one source digest, at most 40 facts, one tenant |
| reversibility | irreversible, but **withdrawal not deletion**: statement, version counter, provenance, supersession chain and ratification linkage all survive |
| Governance compatibility | **clean** — writes no decision today, so adding one duplicates nothing; already refuses ratified sources rather than reversing Governance |
| tenant isolation | `TenantContext`, `for update` on tenant-scoped rows |
| auditability | one audit event per fact, in the same transaction |
| testable without provider credentials | **yes, entirely** |
| architectural cleanliness | one transaction, all-or-nothing **including the refusal** |

### Rejected alternatives

**Ratify a Knowledge version (K4)** — rejected because it **already is** a governed internal action.
Routing it through propose → decide → permit → invoke would produce **two Governance decisions for
one act**: the decision the permit consumed, and the decision K4 writes. That is the exact
duplication this discovery exists to prevent.

**Retire a durable agent identity** — rejected on blast radius and value. Terminal and unreopenable
(`retirementIsTerminal`, `retirementDoesNotReopen`), and Tenant Zero holds exactly one agent, so the
real-world effect is "permanently disable the product's only agent." Consequential authority also
becomes ambiguous: retirement writes no Governance decision today, so a permit path would silently
make agent lifecycle Governance-derived — precisely what `agent_mandates` refused when it declined to
live inside Governance.

---

## 9 · The authority chain, arrow by arrow

| Arrow | State owner | Writer | Authorization | Transaction | Durable record | Failure |
|---|---|---|---|---|---|---|
| intent → prepare | none | none | none | none | none | free |
| prepare → proposal | Action Authorization | `record-action-request` | mandate ceiling (agent path) | own | `heby_action_requests` | refusal writes **no row** |
| proposal → decision | Governance | `writeGovernanceDecisionWithin` | **human, CHECK** | one tx with the status update | `decision_records` | refusal leaves `pending` |
| decision → permit | Action Authorization | permit insert | **human, CHECK** | same tx | `action_permits` | none issued on reject |
| permit → invocation | **would be new** | none | permit validity | **the permit's tx, via `onAuthorizedWithin`** | handoff id | expired / revoked / consumed → refuse |
| invocation → mutation | **Knowledge** | **`…Within` seam — DOES NOT EXIST** | Knowledge's own band check | **same tx** | `knowledge_nodes.retired_at` | abort rolls back permit **and** mutation |
| mutation → audit | Governance Audit | `recordKnowledgeMutationWithin` | — | **same tx** | `audit_log`, one per fact | atomic with the mutation |
| result → Heby | derived | none | none | none | none | unavailable ≠ absent |

**The four distinctions, proved by mechanism:**

- **decision ≠ permit** — separate tables; `action_permits_decision_uq` makes the relationship
  one-to-one rather than identical. A rejected request produces a decision and **no** permit.
- **permit ≠ invocation** — a permit can expire (`expires_at` NOT NULL) or be revoked
  (`revocation_decision_id`) with no invocation ever occurring; `consumed_at` stays NULL.
- **invocation ≠ successful mutation** — R6D refuses `source-contains-ratified-knowledge` **after**
  locking the target set. The permit is spent, the transaction aborts, nothing is retired.
- **successful mutation ≠ successful organizational outcome** — retracting a source removes facts
  from force; whether the organization now understands itself correctly is a coverage question
  (1 of 10 taxonomy categories covered in production). The precedent already stands: *accepted is
  not delivery*.

---

## 10 · The human-only boundary — preserved, untouched

Nine human-only constraints exist. **None would need weakening. None was touched.**

| Constraint | Table |
|---|---|
| `bootstrap = false or actor_type = 'human'` | `decision_records` |
| `established_by_actor_type = 'human'` | `agent_mandates` |
| `proposed_by_actor_type = 'human'` | `agent_improvement_hypotheses` |
| `approved_by_actor_type is null or = 'human'` | `heby_action_requests` |
| **`authorized_by_actor_type = 'human'`** | **`action_permits`** |
| `approved_by_actor_type is null or = 'human'` | `identity_enrollment_requests` |
| `authorized_by_actor_type = 'human'` | `membership_authorizations` |
| `declared_by_type = 'human'` | `knowledge_external_references` |
| `withdrawn_by_type is null or = 'human'` | `knowledge_external_references` |

`knowledge_nodes` carries **no** human-only CHECK; R6D hard-codes `updatedByType: "human"` in
application code.

**The real finding of this phase is truthfulness, not authority.** If a system spends a permit and
invokes the writer, writing `"human"` into `knowledge_nodes.updated_by_type` is a **false record** —
the same defect class this lineage has already repaired twice.

The semantics Hebun needs:

```
authorized_by_human   ->  action_permits.authorized_by_actor_*   (CHECK-constrained, already exists)
executed_by_system    ->  the invocation, actor_type = 'system'  (enum value already exists)
authorized_by_system  ->  UNREPRESENTABLE                        (action_permits_human_authorizer_chk)
```

`actor_type` already enumerates `human | agent | system | service`, so no vocabulary is invented.
The gap is that `knowledge_nodes.updated_by_type` is **one field carrying two meanings** — an
**attribution** gap, owned by Knowledge, never by execution.

---

## 11 · Permit model — reuse, not abuse

| Property | State | Internal fit |
|---|---|---|
| action kind binding | via `heby_action_requests.action_kind`, generic `text` | ✓ |
| subject binding | `target_kind` / `target_ref` — **nullable, generic** | ✓ |
| payload digest | bound at issuance, re-verified at consumption against **both** the permit's copy and the request's own | ✓ |
| tenant binding | composite FK `(tenant_id, action_request_id)` | ✓ |
| decision binding | `governance_decision_id` NOT NULL + `action_permits_decision_uq` | ✓ |
| one-shot consumption | `consumed_at` + partial-unique `handoff_id` | ✓ |
| revocation | `revoked_at` + `revocation_decision_id` — a Governance act, not a flipped field | ✓ |
| expiry | `expires_at` NOT NULL; *"`expires_at <= now()` is the entire expiry mechanism and needs no scheduler"* | ✓ |
| replay resistance | one permit per request, one attempt per permit, unique handoff | ✓ |
| execution attempt binding | `handoff_id`, deliberately **not** an FK — *"R3A never invents a row in a table it does not own"* | ✓ — an internal act needs no attempt row |

**Classification: A · reuse of existing generic authority.** Not semantic abuse. Nothing in
`action_permits` mentions a provider, an adapter, a recipient or an endpoint; the external
specificity begins strictly downstream of the permit.

---

## 12 · Failure and transaction model

| | External (R3B, released) | Internal (candidate) |
|---|---|---|
| shape | permit → tx → **post-commit HTTPS call** | permit → **one tx** → commit |
| ambiguity possible | **yes** — `provider_response_class = 'ambiguous'` exists for it | **no** |
| reconciliation needed | yes | **no** |
| ledger required | **yes** — the world can change with nothing written locally | **no** |

**Permit consumed before or after commit? Neither — inside the transaction.**
`consumeActionPermit`'s `onAuthorizedWithin(tx, authorization)` already provides this, and R3B
already uses it.

**No distributed transaction is needed or proposed.** Every table involved lives in one control-plane
database.

- **Process crash** — the transaction rolls back; the permit stays `active` and unspent. Strictly
  safer than the external path, where a crash after the HTTPS call yields `unknown`.
- **Stale target version** — the generic permit carries a *payload* digest, not a *target version*.
  An optimistic precondition is required; the released precedent is K3's `observedKnowledgeVersion`,
  *"a precondition that can only cause a refusal."* It is per-authority and belongs to the owner.
- **Target changed after authorization** — R3B's two-timing doctrine applies unchanged: a condition
  seen in pre-flight refuses cheaply and leaves the permit spendable; the same condition found inside
  the transaction burns it, because *an authorization must not outlive the fact that justified it*.
- **Rollback in the ledger** — not represented, because not needed.

**The genuine gap, stated exactly:** `retractKnowledgeSource` opens its own `db.transaction` and
exports no `Within` variant. It cannot join a permit's transaction today. **That seam must be
authored by Knowledge.**

---

## 13 · Threat model

| Threat | Protection today | Missing for an internal path |
|---|---|---|
| forged permit | resolved by id, tenant-scoped, composite FK; no caller-supplied authorizer | nothing |
| stale permit | `expires_at` NOT NULL, re-checked in-transaction | nothing |
| replay | `consumed_at`, partial-unique `handoff_id`, one permit per request, one attempt per permit | nothing |
| cross-tenant invocation | composite FKs across requests / permits / attempts; `TenantContext` server-resolved with no widening parameter | nothing |
| authority bypass | nine human-only CHECKs; `writeGovernanceDecisionWithin` hard-codes `actorType: "human"` | nothing |
| confused deputy | payload digest bound at issuance, re-verified against both copies | nothing |
| model-generated identifiers | the server builds the choice space; a reference the model invented *"was never in the set"* | **an internal act needs its own server-built candidate set of source digests** |
| privilege escalation | CHECK-constrained authorizers throughout | nothing |
| TOCTOU | R3B's two-timing check; `for update` locking in R6D | **the permit carries no target version** — an optimistic precondition is required |
| partial commit | one database, one transaction | nothing — this risk is external-only |
| audit mismatch | R6D writes audit in the same transaction as the mutation | nothing |
| direct writer invocation | — | **REAL GAP** — nothing prevents a server action from calling the writer directly, bypassing the permit. Today that is correct: it *is* the human path. If both paths exist, the writer must distinguish them, or the permit becomes optional decoration. |

Two genuinely missing protections, both narrow, both owned by Knowledge. Neither is an execution
concern.

---

## 14 · Correction to APF-0

**APF-0 classified `retract-knowledge-source` as class C · MAJOR NEW CAPABILITY**, on the reasoning
that *"the execution chain is bound to one external HTTPS adapter; a local DB write has no execution
model here."*

**Measured properly in this discovery, that was too strong.** The request table, the permit table and
the transaction envelope are all generic and already built; only the attempt ledger and the
dispatcher are send-shaped, and an internal act needs neither.

> **Reclassified: B · NARROW EXTENSION**, gated on Knowledge authoring a `Within` seam.

**APF-0's verdict is unchanged — still C · DEFER**, because no second agent role exists. But APF-0's
line *"no class A or B candidate exists"* is **withdrawn**.

---

## 15 · Relationship to APF

- **Could an internal action become agent-originable?** Yes — and that is its strongest
  justification.
- **Would it create a distinct mandate dimension? YES, materially.** `proposal_scope` could hold
  `["send", "retract-knowledge-source"]`, so two agents could genuinely differ: one may send and not
  retract, another may retract and not send. **This is precisely the discriminator APF-0 found
  missing.**
- **Would it justify agent #2?** It removes the **blocker**. It does not supply the **motive**.
- **Or is it simply another capability of agent #1?** Most likely, initially — yes. The architecture
  must earn its place on that basis alone, and it does: a governed internal action is valuable to a
  Hebun that forever had one durable agent.

---

## 16 · Product experience

> **Director:** "This Knowledge source is obsolete."
>
> **Heby:** "Nine facts in force came from `contract-terms-2025.pdf`, ingested 12 June. None is
> ratified. Withdrawing it retires those nine facts from active Knowledge — the statements, their
> versions and their history stay readable, and nothing is deleted. It cannot be undone: no writer
> returns a retired fact to service."
>
> *(Governance asks for the human decision. The Director authorizes.)*
>
> **Heby:** "Withdrawn. Nine facts retired, nine audit events recorded under the decision. Company
> Understanding now shows eight categories with no coverage, up from seven."

The Director never sees a writer, a permit table, a transaction seam or an adapter. Internally every
distinction survives.

**Note what this experience does not require.** In the flow above the Director *is* the authority.
That path needs **no permit at all** — the K4 shape delivers exactly this today, with one fewer table
in it. The permit earns its place only when an agent proposes and a human authorizes later.

---

## 17 · Verdict

### C · DEFER

The architecture is sound, mostly already built, and correctly bounded. Nothing currently justifies
the complexity.

**Why not A.** The pieces are real, but there is **no caller**. For a human Director the K4 shape
already delivers governed internal mutation across five released writers. Adding a permit path would
add a Governance decision that does not exist today and slow a working feature. The only caller that
genuinely needs a permit is an **agent proposing an internal act**, and APF is deferred.

**Why not B.** The permit model is not the wrong boundary; the authorization half is exactly right
and generic. Only the dispatcher and the ledger are send-shaped, and an internal act needs neither.
Nothing needs redesign — one seam needs authoring, by Knowledge, when a caller exists.

**Why not D.** Nothing here duplicates or bypasses authority. The mechanism required — the owner
exports a `Within` seam, the caller supplies a transaction — is already released and running in
production across three authority pairs.

### Does Hebun need a new "Internal Execution Authority"? **NO.**

1. The generic half already exists and is owned: `heby_action_requests`, `action_permits`,
   `consumeActionPermit`'s `onAuthorizedWithin`.
2. The missing half is **not** an execution authority — it is a `Within` seam on each owning writer,
   authored by that owner. A central registry of internal writers would be a second place deciding
   what Hebun may mutate, which `adapter-registry.server.ts` already refused.
3. For the human path, no invocation layer is needed at all.

### Activation condition

> Governed internal action activates when **an agent needs to propose an act it cannot execute
> itself** — when APF's explicit-selection milestone lands *and* the organization wants an agent to
> propose Knowledge retraction.
>
> The work at that point: one `Within` seam authored by Knowledge, one server-built candidate set of
> retractable source digests, one target-version precondition, and one alias added to
> `AGENT_ORIGINABLE_ACTION_KINDS` with its database CHECK in lockstep.
>
> **Zero new tables. Zero new authorities.**

That is also the sequence in which agent #2 would first be earned, because
`["send"]` versus `["retract-knowledge-source"]` is the first pair of mandates that genuinely differ.

---

## 18 · Discovery verdict

```
Real internal mutation candidates exist:      YES
Strongest candidate:                          retract a Knowledge source (R6D)
Existing authoritative writer reusable:       YES — but it exports no transaction-joinable seam
Existing Governance semantics reusable:       YES
Existing permit semantics reusable:           YES — nothing send-specific in permits or requests
Current Action Execution reusable:            PARTIAL — envelope generic, dispatcher and ledger not
New Internal Execution Authority required:    NO
Human-only boundary preserved:                YES — nine CHECKs, none weakened, none touched
APF activated by this discovery:              NO
Agent #2 created:                             NO
Classification:                               C · DEFER
Implementation started:                       NO
```
