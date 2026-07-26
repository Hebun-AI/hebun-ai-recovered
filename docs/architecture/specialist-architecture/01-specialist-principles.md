# 01 — Specialist Principles

## Purpose

The Specialist Principles are the constitution of a Specialist — the commitments any Specialist must obey. A Specialist is the responsibility seat that owns a business capability; these principles are what keep that ownership bounded, accountable, and always subordinate to its Manager, its department, the enterprise, and the Director. Any Specialist that violates one of these is not doing Specialist Architecture.

## Architectural role

These principles constrain all the Specialist topics that follow (model, responsibilities, authority boundaries, collaboration, reporting, governance). Every subsequent document inherits them first. They keep a Specialist an accountable owner — not a manager, not an engine — bounded, authority-preserving, governed, and traceable.

## The principles

### 1. A Specialist owns a capability; it does not perform the work itself
A Specialist owns and is accountable for one business capability within a department's domain. Execution performs the approved work ([Execution](../director-execution/README.md)); the Specialist holds the *accountable execution ownership* of the outcome. Owning and performing are different concerns; the Specialist holds the first.

### 2. A Specialist's authority is delegated and revocable
A Specialist holds only the authority delegated to it by its Manager, and that delegation is always revocable ([manager delegation model](../manager-architecture/04-delegation-model.md), [enterprise authority model](../enterprise-organization/04-authority-model.md)). A Specialist never originates authority and never exceeds its grant. Director Authority sits above every Specialist.

### 3. A Specialist owns one capability, bounded by its department
A Specialist's capability is a focused part of one department's domain ([department responsibilities](../department-architecture/03-department-responsibilities.md)). Its ownership does not spill outside that domain or into another Specialist's capability. One Specialist seat, one bounded capability.

### 4. A Specialist reports to its Manager and escalates upward
A Specialist reports status and problems to its Manager honestly, and escalates anything beyond its delegated authority to its Manager ([reporting & governance](06-reporting-and-governance.md)). It does not overreach, and it does not hide.

### 5. A Specialist collaborates with peers through the structure
A Specialist works with peer Specialists within its department's collaboration structure, each retaining its own capability ownership ([collaboration model](05-collaboration-model.md)). Collaboration never becomes a side-channel that bypasses the Manager's authority or another Specialist's ownership.

### 6. A Specialist does not manage or govern
A Specialist does not manage the department, does not govern its Manager, and holds no enterprise authority ([authority boundaries](04-specialist-authority-boundaries.md)). It is the lowest accountability seat — an owner of a capability, not a governor of anything.

### 7. A Specialist does not reason for, plan for, or decide for the enterprise
A Specialist provides domain expertise within its capability, but it does not replace Director Intelligence: it produces no enterprise plan, alters none, and makes no enterprise decision ([specialist model](02-specialist-model.md)). When reasoning, planning, or a decision is needed, it routes upward.

### 8. A Specialist is governed and traceable
Every Specialist falls under the enterprise-wide governance regime, and its capability ownership, delegated authority, reports, escalations, and collaborations can be reconstructed and audited ([reporting & governance](06-reporting-and-governance.md)). No Specialist is outside governance; none is exempt from traceability.

## Inputs

- The **Enterprise, Department, and Manager architectures** ([9A](../enterprise-organization/README.md), [9B](../department-architecture/README.md), [9C](../manager-architecture/README.md)) — the hierarchy, department, and delegating Manager a Specialist works within.
- **Delegated authority** — the bounded, revocable grant from its Manager.

## Outputs

- A **principled frame** every Specialist topic operates within — the standard any Specialist is held to.

## Boundaries

- These principles **define no concrete specialist, department, or capability** — they state what a Specialist must obey, not who fills the seat.
- They **describe no runtime or mechanism** — specialist machinery is a later phase behind the Director gate.

## Future direction

Future concrete specialists — human or AI — will still obey these principles: own a capability not perform it, delegated authority, one bounded capability, report and escalate to the Manager, collaborate through structure, never manage or govern, never replace Director Intelligence, governed and traceable. Specialists become real; the constitution holds.
