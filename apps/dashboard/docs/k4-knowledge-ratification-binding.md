# K4 — Knowledge Version Ratification Binding

**Status: IMPLEMENTED. Zero migrations.**

K4 connects the Governance authority G2 established to the Knowledge versions K2/K3 author, without
creating a second Governance system and without letting Knowledge ratify itself.

---

## The complete chain

```
human-authored Knowledge version   knowledge_nodes, draft / provisional      (K2, K3)
        ↓
Governance review                  the human holding G2 authority reads it
        ↓
G2 ratify / reject decision        decision_records, subject = knowledge_node
        ↓
K4 exact-version binding           knowledge_nodes.ratification_decision_id  (HERE)
        ↓
organizational ratification state
```

### RATIFIED ≠ TRUE

Ratified means: **the organization's legitimate Governance authority approved this exact Knowledge
version.** It does not mean the statement is true, verified, accurate, or safe to rely on. It is an
organizational status, not an epistemic one. The surface says so where a reader will see it, and a
test forbids `confidence`, `truthScore`, `certainty`, `qualityScore`, `guaranteed`, `cannot be
wrong`, and `factually correct` from appearing on any K4 surface.

---

## The version is the subject — and that required correcting G2

**This was the phase's blocking finding.** G2 shipped with a subject vocabulary of `knowledge_fact`.
A fact is a *timeless identity* whose active version moves; a decision bound to it would silently
mean "whatever version is current when someone reads this". That cannot express "Governance approved
v2", which is the only thing ratification may mean.

So G2's vocabulary was corrected to **`knowledge_node`** — the version row itself. `knowledge_fact`
was **removed rather than kept alongside**: leaving it would allow a fact-level ratify decision to
exist and later be mistaken for version ratification, which is exactly the approximation the phase
brief forbade. This is reported as an amendment to G2 made under K4, not as new K4 scope.

With that correction, `fact F v2 is ratified, then v3 supersedes v2` cannot leak: v2 and v3 are
different rows with different ids, and the binding names the row.

---

## Zero migration

Every column K4 needed already existed on `knowledge_nodes`, with foreign keys already pointing at
`governance_sessions` and `decision_records`: `ratified_at`, `ratified_by_actor_type`,
`ratified_by_actor_id`, `ratification_decision_id`, `governance_session_id`. The schema anticipated
this phase; K4 connected it.

**Only `knowledge_nodes` is written.** The identical columns on `knowledge_facts` are deliberately
left NULL: the read model already resolves ratification through the ACTIVE NODE, so writing both
would create two sources of truth free to disagree.

---

## One transaction

```
BEGIN
  resolve authenticated human            server-side, durable session
  resolve Governance authority           G2 bootstrap decision — NOT a role band
  resolve the exact version              tenant-scoped, SELECT ... FOR UPDATE
  verify it is the CURRENT version       history is not ratifiable
  verify observed version                K3's precondition, applied to review
  write the G2 ratify decision + session  subject = knowledge_node
  bind decision/session/actor/time        predicated on still being unratified
  append the Governance audit event       a decision happened
  append the Knowledge audit event        Knowledge changed
COMMIT
```

`writeGovernanceDecisionWithin` was extracted from G2 so K4 joins G2's decision write rather than
opening a second transaction. "Committed decision, failed binding", "ratified Knowledge, missing
decision" and "ratified Knowledge, missing audit" are excluded by the transaction — proved by a test
that adds a `NOT VALID` CHECK to `audit_log` mid-run and asserts the binding, the decision and the
session all rolled back.

---

## Decisions this phase made deliberately

**Only the current version is ratifiable.** K3 models correction as supersession, so a superseded
version is history. Ratifying history would bless a statement the organization has already replaced.
A superseded version is refused permanently — it was never ratified while current, and that is now a
historical fact rather than a pending decision.

**Rejection writes nothing to Knowledge.** There is no "rejected" column on `knowledge_nodes`. A
reject decision records that Governance did not approve the version; the version stays exactly as
authored, unratified, fully visible in history. Manufacturing a status mutation because
`knowledge_lifecycle_status` happens to have values would be inventing semantics the repository never
defined. `knowledge.reject` is therefore absent from the Knowledge audit vocabulary: there is no
Knowledge mutation to file.

**Re-ratification is refused.** The original decision linkage is never overwritten, and no competing
decision for the same version can exist. Rejecting an already-ratified version is refused too — that
would be a reversal, and reversal is a Governance decision type with no runtime.

**"Ratified" now requires the decision.** The read was `ratificationDecisionId ?? ratifiedAt`, a
reasonable shortcut while both columns were always NULL and false the moment a ratification runtime
existed: a `ratified_at` with no decision behind it would be a row claiming approval with no decision
to point at. Both readers now require `ratificationDecisionId`. A K1 test proves that clearing the
decision while leaving the timestamp flips `ratified` to false.

**Authoring authority is not Governance authority.** K2 gates authoring on the owner/director role
band. That band grants nothing here — a test signs in an owner-band author and is refused, and the
authority resolver is forbidden from reading `roles`, `permissions`, `authorityRank`, or
`authority_scope`.

---

## Limitations

1. **Self-ratification is permitted.** The Governance authority may ratify a version they authored.
   No separation-of-duties rule exists anywhere in the repository — `governance.ts` forbids an AGENT
   from self-elevating but says nothing about a human — and K4 did not invent one. Enforcing it later
   requires an explicit policy/authority phase.
2. **Authority is non-transferable**, inherited from G2: one human per tenant, no delegation runtime.

   > **Historical phase state — superseded by G3.** This was true at K4 closure. G3 later added
   > delegated Governance authority and revocation, so more than one human per tenant can hold the
   > Governance capability that K4 calls. Bootstrap authority itself remains non-transferable. K4
   > required no change for this: a delegate ratifies through the same authority check, and a revoked
   > delegate cannot. Current runtime truth is defined by
   > [g3-governance-delegation-authority.md](g3-governance-delegation-authority.md).
3. **aal1**, inherited from the whole chain.
4. **No un-ratification.** Reversal is a Governance decision type with no runtime.
5. **Ratification lives only on the version.** The `knowledge_facts` ratification columns stay NULL
   by design; a consumer wanting "is the current version ratified" reads the active node, which is
   what the read model already does.

---

## Firewalls

- **Heby**: read-only. No surface, command, tool, or voice path can ratify or reject.
- **R2E / execution**: untouched and independent. No provider call, no Computer Use, no terminal.
- **No new authority**: no new role semantics, no permission system, no approval engine, no policy
  engine, no second audit sink, no second Knowledge source of truth.
