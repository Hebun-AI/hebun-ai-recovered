# 04 — Resource Planning

## Purpose

Resource Planning is where planning **matches tasks to the resources they need**. A task graph describes *what* work must happen and in what order; resource planning determines *what it takes* to do each task — which actors, capabilities, tools, and budget — and whether those resources are available. It grounds an abstract plan in the organization's real capacity.

## Architectural role

Resource Planning annotates the [Task Graph](03-task-graph.md) with the resource requirements of each task, drawing on the organizational model to know what actors, roles, and capabilities exist ([Phase 5](../relationship-graph/README.md)). It surfaces resource conflicts and shortfalls so [Plan Validation](06-plan-validation.md) can judge whether the plan is feasible. It reasons about resources declaratively — it identifies and reserves *in the plan*, it does not acquire or spend anything in the world.

## Inputs

- The **task graph** — the tasks needing resources.
- The **organizational model and graph** — available actors, capabilities, and their allocations.
- The **constraints** — budget limits, capacity, availability, and the committing-action boundary (spending is gated).

## Outputs

- **Resource-annotated tasks** — each task with the actors, capabilities, tools, and budget it requires.
- A **feasibility read** — whether the required resources are available, and where they conflict or fall short.
- Explicit flags where a task requires **committing resource actions** (spending, acquiring) that will need Director approval to execute ([planning principles](01-planning-principles.md)).

## Boundaries

- Resource Planning **plans resources; it does not acquire them**. Reserving a resource *in a plan* is not spending, hiring, or purchasing — those are committing actions gated to the Director.
- It **respects constraints absolutely** — a plan may not assume resources beyond what governance and budget allow.
- It **produces no action** and **defines no method** — this document establishes that resource planning exists and its role, not any allocation algorithm.

## Future direction

Future planning engines may plan resources more precisely — better estimating needs, resolving conflicts, optimizing allocation within constraints. The boundary is fixed: plan and reserve within the plan, never acquire or spend without the Director. Precision grows; the gate on committing resource actions holds.
