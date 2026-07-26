# 07 — Future Evolution

## Purpose

Future Evolution describes **how Department Architecture deepens over time** without violating anything Phase 9B established. It marks the seams where later phases attach — concrete departments, manager agents, specialist agents, human roles — and states what must never change as they do.

## Architectural role

This document is the bridge from the department architecture to everything built on it. It does not design those things; it defines the invariants they must respect and the seats they will fill.

## Where department architecture deepens

### Concrete departments
The model defines *what a department is*; it names none ([department model](02-department-model.md)). Later phases define concrete departments — each owning a real business domain, each entering the department level of the enterprise hierarchy, each under bounded delegated authority and accountable upward. The model does not change to admit them.

### Manager and specialist agents
The department model defines manager and specialist *seats* but no concrete agent. Later phases, behind the Director gate, may define manager agents and specialist agents to fill those seats ([Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md)). Each agent acts within the department's domain and delegated authority; none reshapes the department or its ownership.

### Human participation
Humans may hold any seat within a department, alongside or instead of agents. Later phases define concrete human roles. The department's authority, ownership, and governance already cover them — a human occupant is authorized, owns, and is governed exactly as any occupant of that seat.

### Richer internal structure and collaboration
A department's internal structure and its collaboration with other departments may gain more detail as the enterprise grows ([department coordination](05-department-coordination.md)). They deepen within the same rules; they never acquire the right to reason, execute, plan, decide, or cross domain boundaries.

## Invariants — what never changes

No matter how department architecture evolves:

- **A department owns exactly one domain, exclusively.** No orphan and no co-owned outcomes ([department responsibilities](03-department-responsibilities.md)).
- **A department's authority stays delegated, bounded, and revocable.** No occupant originates authority or exceeds the grant ([department boundaries](04-department-boundaries.md)).
- **Accountability stays upward, to the Director.** Ownership without upward accountability is never permitted.
- **A department never reasons, executes, plans, or decides.** Those stay in Director Intelligence and Execution.
- **Governance stays enterprise-wide and traceable.** Every new occupant falls under it on taking a seat ([department governance](06-department-governance.md)).
- **Committing actions stay behind the Director's approval.** No delegation manufactures the right to commit.

## Inputs

- The **whole Phase 9B architecture** ([01](01-department-principles.md)–[06](06-department-governance.md)) — the department model future work extends.

## Outputs

- A **map of the seams** — where later phases attach — and the **invariants** they must preserve.

## Boundaries

- Defines **no concrete department, agent, human role, runtime, or mechanism** — it points to where they attach, and never builds them.
- Introduces **no new authority, reasoning, or execution** into the department layer.

## Future direction

Phase 9B is the model of a department. What follows fills it — concrete departments, manager and specialist agents, human roles — each behind the Director gate, each owning a real domain, each under the invariants above. Departments become real by population, not by redesign. The model holds; the enterprise's departments grow inside it.
