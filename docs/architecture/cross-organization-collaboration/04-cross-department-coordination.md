# 04 — Cross-Department Coordination

## Purpose

Cross-Department Coordination defines **how departments align across domain lines** — how two or more departments, and the managers and specialists within them, collaborate on a shared outcome while each keeps exclusive ownership of its own domain. It is the detailed rulebook for the hardest collaboration case: work that spans domains.

## Architectural role

Where the interaction model ([02](02-organizational-interaction-model.md)) defines the shapes of interaction, this document specifies the cross-parent shape in full: collaboration between units in *different* departments. It builds on the department-level coordination Phase 9B established ([department coordination](../department-architecture/05-department-coordination.md)) and the specialist collaboration Phase 9D framed ([specialist collaboration](../specialist-architecture/05-collaboration-model.md)), tying them into one cross-department model.

## The model

### Cross-department collaboration flows through managers
When units in different departments collaborate, the collaboration flows through the managers of both departments ([manager architecture](../manager-architecture/README.md)). Specialists do not reach directly across department lines on their own authority; their managers hold the authority that spans the departments' boundary ([collaboration principles](01-collaboration-principles.md)).

### Domain boundaries are preserved
Each department keeps exclusive ownership of its own domain throughout the collaboration ([department responsibilities](../department-architecture/03-department-responsibilities.md)). Coordination aligns the departments; it does not merge domains or let one department claim another's. No department absorbs another through coordination.

### One outcome, one owning department
A cross-department outcome has a single owning department; the others contribute within their own domains ([department coordination](../department-architecture/05-department-coordination.md)). Where the outcome's ownership must move between departments, it moves only by the ownership-transfer rules ([ownership transfer](03-ownership-transfer.md)). Coordination assigns contribution; it never dissolves ownership into a committee.

### Coordination stays within delegated authority
Managers coordinate across departments within their delegated authority ([manager authority](../manager-architecture/03-manager-authority.md)). What exceeds both managers' authority — a committing action, a matter needing enterprise reasoning or a decision — escalates upward toward the enterprise level and the Director ([escalation model](05-escalation-model.md)), rather than being resolved beyond the managers' grants.

### Coordination is structural, not operational
Cross-department coordination arranges *which departments collaborate, through which managers, with ownership preserved*. It does not schedule tasks, route messages, or synchronize running work — that is Execution's concern ([execution orchestration](../execution-orchestration/README.md)). The organizational layer defines the coordination *structure*; execution operates within it.

### Coordination preserves all accountability
Throughout cross-department collaboration, each manager stays accountable for its department and each specialist for its capability ([manager principles](../manager-architecture/01-manager-principles.md), [specialist principles](../specialist-architecture/01-specialist-principles.md)). Coordinating across departments never lets a unit shed its own accountability.

## Inputs

- The **department and specialist collaboration structures** ([9B](../department-architecture/05-department-coordination.md), [9D](../specialist-architecture/05-collaboration-model.md)) — the units being coordinated.
- The **manager authority model** ([9C](../manager-architecture/03-manager-authority.md)) — the authority that spans department boundaries.

## Outputs

- A **cross-department coordination structure** — how departments align through managers, with ownership and accountability preserved — that keeps a multi-department enterprise coherent across domains.

## Boundaries

- Coordinates **departments and seats, not concrete units** — it names none.
- Performs **no scheduling, routing, or task synchronization** — that is Execution.
- Bypasses **no manager authority and no domain ownership**.
- Describes **no runtime or mechanism** — only the structure of cross-department coordination.

## Future direction

As concrete departments multiply and fill with managers and specialists — human and AI — cross-department collaboration scales with them: more spanning relationships, same rules — through managers, domain boundaries preserved, single ownership per outcome, escalation at the limit. The enterprise widens; departments stay distinct while collaborating as one enterprise.
