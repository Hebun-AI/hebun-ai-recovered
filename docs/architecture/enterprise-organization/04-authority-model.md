# 04 — Authority Model

## Purpose

The Authority Model defines **how authority is held and delegated** across the enterprise. It is the spine of Enterprise Organization: it says that all authority originates with the Director, flows downward as bounded delegation, and remains revocable at every level. It is how the structure stays powerful without ever escaping the Director.

## Architectural role

This document governs the relationships the organizational model ([02](02-organizational-model.md)) laid out. Where the model defines the levels, the authority model defines *what each level may do* and *by whose grant*. Coordination ([05](05-organizational-coordination.md)) and governance ([06](06-enterprise-governance.md)) both assume this model.

## The model

### Authority originates with the Director
There is one source of authority in the enterprise: the Director ([Director Authority](../director-reasoning/05-director-authority.md)). Every unit's authority is a grant traceable back to the Director. No authority arises anywhere else.

### Authority delegates downward, bounded
The Director delegates authority to the enterprise level, which delegates to departments, which delegate to managers, which delegate to specialists. Each delegation is **bounded** — a unit receives a defined scope of authority and may never exceed it. Delegation narrows as it descends; it never widens on its own.

### Authority is always revocable
Any delegation can be withdrawn by the Director, or by an intermediate level acting within its own delegated authority. No unit holds authority the Director cannot reclaim. Revocability is what keeps delegation safe.

### Committing authority stays with the Director
Committing and irreversible actions require the Director's approval. Delegated authority lets a unit be *responsible* for such an outcome, but the commitment itself is authorized by the Director ([Director Authority](../director-reasoning/05-director-authority.md), consistent with how Execution treats committing actions in [execution principles](../director-execution/01-execution-principles.md)). The organization never delegates away the Director's approval gate.

### Authority and responsibility are paired
A unit's authority matches its responsibility: it is authorized to the extent it is accountable, and accountable to the extent it is authorized. There is no authority without responsibility, and no responsibility without matching authority.

## Preserving Director Authority

- The Director is the **apex** — above the enterprise level, above every department, manager, and specialist.
- Every delegation is **downward, bounded, and revocable** — so authority can always be traced up to the Director and reclaimed.
- Every **committing action** rests on Director approval — no delegation manufactures the right to commit.

This is how the organization "preserves Director Authority": structurally, at every level, by construction.

## Inputs

- The **organizational model** ([02](02-organizational-model.md)) — the levels authority flows through.
- **Director Authority** — the single origin of all delegation.

## Outputs

- A **delegation structure** — who may do what, by whose grant, within what bound, revocable when — that coordination and governance rely on.

## Boundaries

- Delegates authority to **seats, not concrete participants** — it does not name any department, agent, or human.
- Defines **no decision and no plan** — it grants the authority under which Director Intelligence decides and plans, never the decision or plan itself.
- Describes **no runtime or mechanism** — only the structure of authority.

## Future direction

As manager and specialist agents and human roles fill the hierarchy, each receives a bounded, revocable delegation into its seat. The authority model does not change to admit them — it already defines how any occupant is authorized. More participants, same spine: all authority from the Director, downward, bounded, revocable.
