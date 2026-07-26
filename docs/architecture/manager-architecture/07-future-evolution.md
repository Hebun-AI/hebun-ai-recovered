# 07 — Future Evolution

## Purpose

Future Evolution describes **how Manager Architecture deepens over time** without violating anything Phase 9C established. It marks the seams where later phases attach — concrete human managers, concrete AI managers, the specialists they delegate to — and states what must never change as they do.

## Architectural role

This document is the bridge from the Manager architecture to everything built on it. It does not design those things; it defines the invariants they must respect and the seat they will fill.

## Where manager architecture deepens

### Human managers
The Manager is a seat a human may fill ([manager model](02-manager-model.md)). Later phases define concrete human-manager roles. The seat's authority, delegation, oversight, reporting, escalation, and governance already cover them — a human manager governs exactly as the seat defines, under bounded, revocable, delegated authority.

### AI managers
The same seat may be filled by a future AI manager, behind the Director gate ([Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md)). An AI manager governs a department under the identical rules: it delegates, oversees, reports, and escalates — and it still does not reason, execute, orchestrate, plan, decide, or originate authority. The occupant changes; the seat's constitution does not.

### Specialists beneath the Manager
A Manager delegates to specialist seats ([delegation model](04-delegation-model.md)). Specialist Architecture is a later phase; when it lands, the specialists it defines fill the seats a Manager already delegates to. The Manager's side of the relationship — bounded delegation, retained ownership, oversight, escalation — is already fixed here.

### Richer oversight, reporting, and escalation
A Manager's governance duties may gain more structure as the enterprise grows ([oversight & reporting](05-oversight-and-reporting.md), [escalation & governance](06-escalation-governance.md)). They deepen within the same rules; they never acquire the right to reason, execute, orchestrate, plan, decide, or originate authority.

## Invariants — what never changes

No matter how Manager architecture evolves:

- **A Manager governs; it never performs work.** No reasoning, execution, or orchestration ([manager principles](01-manager-principles.md)).
- **A Manager's authority stays delegated, bounded, and revocable.** It never originates authority or exceeds its grant ([manager authority](03-manager-authority.md)).
- **A Manager carries ownership and stays accountable upward.** Delegation extends reach but never sheds responsibility ([delegation model](04-delegation-model.md)).
- **A Manager escalates at its limit.** Beyond-grant and committing matters go up, never around ([escalation & governance](06-escalation-governance.md)).
- **A Manager governs one department.** Its authority never crosses into another.
- **Governance stays enterprise-wide and traceable.** Every occupant falls under it on taking the seat.
- **Committing actions stay behind the Director's approval.** No Manager grant substitutes for it.

## Inputs

- The **whole Phase 9C architecture** ([01](01-manager-principles.md)–[06](06-escalation-governance.md)) — the Manager seat future work extends.

## Outputs

- A **map of the seams** — where later phases attach — and the **invariants** they must preserve.

## Boundaries

- Defines **no concrete manager, department, specialist, runtime, or mechanism** — it points to where they attach, and never builds them.
- Introduces **no new authority, reasoning, execution, or orchestration** into the Manager seat.

## Future direction

Phase 9C is the model of a Manager. What follows fills it — human managers, AI managers, the specialists beneath them — each behind the Director gate, each governing a real department, each under the invariants above. Managers become real by filling the seat, not by redesigning it. The seat holds; the enterprise's managers grow inside it.
