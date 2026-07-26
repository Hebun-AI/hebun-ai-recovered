# 05 — Collaboration Model

## Purpose

The Collaboration Model defines **how Specialists work with peers** while each stays the bounded owner of its own capability. It is the structural answer to a department with many specialist seats: peers whose capabilities touch must stay aligned without any Specialist reaching into another's capability or bypassing the Manager's authority.

## Architectural role

Where the specialist model ([02](02-specialist-model.md)) defines a single seat and authority boundaries ([04](04-specialist-authority-boundaries.md)) fence it, collaboration defines *how two or more Specialists relate*. It is the specialist-level view of the enterprise's coordination structure ([enterprise organizational coordination](../enterprise-organization/05-organizational-coordination.md)) and the department's collaboration ([department coordination](../department-architecture/05-department-coordination.md)) — collaboration among capability owners, not among running work.

## The model

### Peers collaborate under the Manager's authority
Specialists within a department collaborate within the structure their Manager governs ([manager architecture](../manager-architecture/README.md)). Collaboration never opens a side-channel that bypasses the Manager's authority or the delegation each Specialist holds. What exceeds the peers' delegated authority escalates to the Manager ([reporting & governance](06-reporting-and-governance.md)).

### Capability boundaries are preserved in collaboration
When two Specialists collaborate on an outcome that spans their capabilities, each retains exclusive ownership of its own capability's part ([specialist responsibilities](03-specialist-responsibilities.md)). Collaboration aligns the owners; it does not merge capabilities or transfer ownership. No Specialist absorbs another through collaboration.

### One outcome, one owning Specialist
Where a cross-capability outcome must have a single owner, one Specialist owns it and the others contribute within their own capabilities. Collaboration assigns contribution; it never dissolves ownership into a committee ([authority boundaries](04-specialist-authority-boundaries.md)).

### Collaboration is structural, not operational
Specialist collaboration arranges *which peers work together, under whose authority, with ownership preserved*. It does not schedule tasks, route messages, or synchronize running work — that is Execution's concern ([execution orchestration](../execution-orchestration/README.md)). The specialist layer defines the collaboration *structure*; execution operates within it.

### Cross-department collaboration goes through Managers
When a Specialist must work with a Specialist in another department, the collaboration flows through the Managers and the department collaboration structure ([department coordination](../department-architecture/05-department-coordination.md)) — not directly across departments in a way that bypasses either Manager's authority. Department boundaries are preserved.

## Inputs

- The **specialist model and responsibilities** ([02](02-specialist-model.md), [03](03-specialist-responsibilities.md)) — the seats and capability ownership being collaborated across.
- The **department and enterprise coordination structures** ([9B](../department-architecture/05-department-coordination.md), [9A](../enterprise-organization/05-organizational-coordination.md)) — the rules collaboration follows.

## Outputs

- A **collaboration structure** — how peers relate, under whose authority, with capability ownership preserved — that keeps a multi-specialist department coherent.

## Boundaries

- Collaborates across **specialist seats, not concrete specialists** — it names none.
- Performs **no scheduling, routing, or task synchronization** — that is Execution.
- Reasons about **no work** and produces **no plan** — collaboration arranges structure, nothing more.
- Bypasses **no Manager authority and no capability ownership**.

## Future direction

As concrete specialists — human or AI — fill the seats within a department, collaboration scales with them: more peer relationships, same rules — under the Manager's authority, capability boundaries preserved, single ownership per outcome, cross-department work through Managers. The department fills with specialists; they stay distinct while working as one department.
