# GIA-1 — The First Governed Internal Act — CLOSED / PRODUCTION-ACCEPTED

**Release** `93c6384` · **Presentation fix** `8dde165` · **Suite** 652/652 on Node v24.16.0
**Production cluster** `7675444875863894887` / `neondb`

---

## What Hebun can now do that it could not

Hebun could authorize a consequential act and execute exactly one kind of it: an external send.
It can now perform a **second, and last, executable kind** — `record-work` — inside the transaction
that spends a human's permit. This is the first act Hebun performs that never leaves the system.

    AGENT PROPOSED != HUMAN AUTHORIZED != PERMIT ISSUED != SYSTEM EXECUTED != MUTATION SUCCESSFUL

---

## The executable set stopped being a cardinality

R3B shipped a name allowlist plus *"at most one tool may declare a connected mutation substrate"*.
Relaxing that to two would have been **strictly weaker** than what it replaced: any second tool
satisfying a generic shape would have passed. It was replaced by a two-way set comparison against
`EXECUTABLE_ACTION_POSTURES` — the tools declaring a connected mutation substrate must be *exactly*
the authorized kinds, no more and no fewer — plus a per-kind posture match.

| kind | class | reversibility | execution |
|---|---|---|---|
| `send-external-communication` | CONSEQUENTIAL_MUTATION | irreversible | external-provider |
| `record-work` | CONSEQUENTIAL_MUTATION | deterministic-inverse | internal-authority |

A third executor now needs a deliberate edit to that table **and** to the firewall pin.

**CONSEQUENTIAL never meant IRREVERSIBLE — it meant "not cheap".** Every consequential tool happened
to be irreversible until `record-work`, whose inverse (`retireWork`) is real and owned by the same
authority. Three places derived the sentence from the *class* and now derive it from the *tool*: the
registry validator, the action boundary verdict, and the consequence a human reads before
authorizing. The send is still described as irreversible; it was not weakened to accommodate a
sibling.

**Reversible is not erasable.** Retirement leaves the record, its audit event and the Governance
decision exactly where they are. No automatic rollback was built.

---

## No second execution ledger

`action_execution_attempts` is external-send specific in schema and in meaning, and an internal
mutation inside the permit's own transaction has no ambiguous phase: it committed or it did not.
**The work row and its audit event are the outcome record.** The feature is one file. There is no
internal execution authority, no dispatcher, and no framework.

`recordWorkWithin` is the one insert path both the human and the governed paths use, differing only
in a closed `human | system` author. `PermitConsumptionTx` was not widened.

---

## Production acceptance — measured, not asserted

A human proposed at `/director/work`, decided at `/approvals`, and clicked Execute.

| Claim | Measured in production |
|---|---|
| Proposal | `e505aa6f` · `record-work` · `heby.work.record-work` · approved |
| Approved payload | exactly two scalars: the title and `department/e40866a8…`. Nothing invented |
| Human authorization | decision `896da815` · `approve` · outcome `action-authorized` · `actor_type = human` |
| Permit | `648597a5` · `consumed` · `handoff_id d0cc10ae` · `revoked_at null` |
| Work row | `983d1cb2` · created 2 ms after the spend, same transaction |
| Attribution | `created_by_type = system`, `updated_by_type = system`, `created_by` = the session human |
| Work audit | one event, `actor_type = system` — WORK-1's earlier item still reads `human` |
| Proposer / authorizer | separate columns, both `human`; the same person proposed and authorized |
| Duplicates | none — two work rows total, one per path |
| Execution attempts for `record-work` | **zero** |
| External provider | none attributable — the sole attempt row predates this act by two days, different permit |
| Replay | closed — a consumed permit with a handoff cannot be matched again |

---

## The one defect acceptance found, and the suite could not

A consumed `record-work` permit rendered **"Authorized, and never executed."** directly above the
surface's own **"Recorded."** confirmation.

The backend was right. The defect was one branch on the decision surface — a stale
external-execution-oriented projection that asked whether an attempt row existed and, finding none,
concluded the act never happened. Sound while the only executable act wrote one; false for an
internal act that writes none by design.

Fixed by asking the question it actually needed — **was this authorization spent** (`consumedAt`,
already on the released view since R3A). No new read, no new field, **no ledger invented**, backend
untouched. Pinned as a pure function exercised across all four states.

> A green suite proves what it asserts. Nothing asserted these two sentences until production put
> them on the same screen.

---

## What is deliberately NOT available

- **Migration 44 — UNAPPLIED.** Production ledger measured at **43** rows, digest `c814d6b3…`; the
  release authors **44**, digest `d180291d…`. Proven by the live constraint:
  `proposal_scope <@ ARRAY['send']`. **CODE DEPLOYED != MIGRATION APPLIED.**
- **Agent-originated `record-work` — UNAVAILABLE in production.** The inlet exists and is
  mandate-enforced, but the production CHECK will not store a mandate *naming* `record-work`, so no
  agent can originate one there. The production-accepted human capability needs none of it.
- **Agent model selection of `record-work` — UNAVAILABLE.** `parseAgentActionSelection` admits
  `send` and the abstain value only. Pinned as a measured fact, not left as a silence.

## Repaired in passing, and worth recording

Two suite failures **pre-dated** this work and surfaced only because a full suite finally ran:
E2-4's and OSA-1's Live Map pins, falsified by LM-1's released `department` / `human` node kinds and
`works-in` edge. Both LM-1 and ORG-1 closed on the fast path with no full suite. Repaired
phase-relative rather than left red.

---

**GIA-1 CLOSED / PRODUCTION-ACCEPTED.**
