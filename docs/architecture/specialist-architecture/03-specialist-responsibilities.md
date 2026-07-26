# 03 — Specialist Responsibilities

## Purpose

Specialist Responsibilities defines **responsibility ownership and business capability ownership** — what a Specialist owns, what it answers for, and how that ownership relates to Execution performing the work. It is where the model's "capability" and "accountable execution ownership" become explicit: a Specialist is the accountable owner of one business capability within a department's domain.

## Architectural role

Where the model ([02](02-specialist-model.md)) defines the anatomy, this document defines what that anatomy is *responsible for*. Authority boundaries ([04](04-specialist-authority-boundaries.md)) then fence the responsibility; reporting and governance ([06](06-reporting-and-governance.md)) hold it accountable. Capability ownership is the substance the rest of the specialist architecture protects.

## The model

### Business capability ownership
A Specialist owns one **business capability** — a defined, focused part of its department's domain ([department responsibilities](../department-architecture/03-department-responsibilities.md)). Every outcome of that capability has this Specialist as its accountable owner. The capability is the Specialist's slice of what the department owns; the department owns the domain, the Specialist owns a capability inside it.

### Ownership is exclusive within the department
A Specialist owns its capability and only its capability. It does not own another Specialist's capability, and its capability is not co-owned. Exclusive capability ownership is what makes accountability unambiguous within a department ([authority boundaries](04-specialist-authority-boundaries.md)).

### Accountable execution ownership
A Specialist holds *accountable execution ownership*: it answers for the outcomes of its capability, which **Execution performs** ([execution](../director-execution/README.md)). The Specialist does not carry out the work; it owns the result. Ownership and performance are paired but distinct — the Specialist is accountable, Execution is the engine.

### Ownership does not mean doing, reasoning, or planning
A Specialist *owns* its capability's outcomes; it does not perform the work (Execution does), reason for the enterprise ([Director Intelligence](../director-reasoning/README.md)), or produce plans ([Planning](../director-planning/README.md)). It provides expertise within its capability and answers for the outcome — the thinking, planning, and doing sit in their own domains.

### Ownership preserves higher ownership and accountability
A Specialist's capability ownership sits *inside* the department's domain ownership ([department responsibilities](../department-architecture/03-department-responsibilities.md)) and *under* the Manager's accountability for the department ([manager principles](../manager-architecture/01-manager-principles.md)). The Specialist owning a capability never displaces the department's ownership of the domain or the Manager's accountability for it — it nests within both.

### Ownership and authority are paired
A Specialist's ownership is matched by its delegated authority ([manager delegation model](../manager-architecture/04-delegation-model.md)): authorized to the extent it is accountable for its capability, accountable to the extent it is authorized. Neither exceeds the other.

### Responsibility is traceable
What capability a Specialist owns, and the line by which it reports and is accountable, can always be reconstructed and audited ([reporting & governance](06-reporting-and-governance.md)). Responsibility is a structural fact, not a runtime claim.

## Inputs

- The **specialist model** ([02](02-specialist-model.md)) — the anatomy that carries capability ownership.
- The **delegated authority** and **department domain** ([9C delegation](../manager-architecture/04-delegation-model.md), [9B responsibilities](../department-architecture/03-department-responsibilities.md)) — the grant and domain ownership nests inside.

## Outputs

- A **defined capability-ownership structure** — what each Specialist owns, exclusively, and answers for — that authority boundaries and governance rely on.

## Boundaries

- Assigns ownership to **specialist seats, not concrete specialists** — it names none.
- Defines **no work, reasoning, or plan** — a Specialist owns outcomes; it does not produce them.
- Preserves **department ownership and Manager accountability** — it nests within, never displaces.
- Describes **no runtime or mechanism** — only the structure of capability ownership.

## Future direction

As concrete specialists are defined, each takes exclusive ownership of a real business capability and a real line of accountability to its Manager. Human or AI, the rule holds: own the capability, answer for outcomes Execution performs, nest within department and Manager. More specialists, same unambiguous ownership. The enterprise grows; capability ownership stays clear.
