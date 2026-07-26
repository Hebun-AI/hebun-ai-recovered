# 03 — Task Graph

## Purpose

The Task Graph is where planning **structures the tasks into a coherent whole** — arranging the pieces from decomposition into an ordered, connected shape that shows how the work fits together. Where decomposition produced *what* tasks are needed, the task graph expresses *how they relate*: which come first, which depend on which, which can proceed in parallel.

## Architectural role

The Task Graph is the central structure of a plan — the backbone the other planning topics attach to. [Dependency Management](05-dependency-management.md) defines the edges; [Resource Planning](04-resource-planning.md) annotates the nodes; [Plan Validation](06-plan-validation.md) checks the graph is sound. It is the planning analogue of the organizational relationship graph ([Phase 5B](../relationship-graph/README.md)): a set of nodes (tasks) and directed edges (dependencies) that together describe a body of work. It is a **description**, not a running process.

## Inputs

- The **task set** from Goal Decomposition.
- The **dependencies** between tasks ([dependency management](05-dependency-management.md)).
- The **constraints** that shape valid orderings.

## Outputs

- A **task graph** — tasks as nodes, their orderings and dependencies as directed edges, expressing the full shape of the planned work.
- Explicit **structure** — sequences, parallel branches, and convergence points — so the plan's execution order is legible.
- Preserved **committing-action markers** on the relevant task nodes, carried from decomposition.

## Boundaries

- The task graph is **inert** — it describes work; it does not run it. Building the graph executes nothing.
- It is **acyclic where order requires it** — a task cannot depend on its own completion ([dependency management](05-dependency-management.md)); cycles in ordering are invalid.
- It **defines no method** and **triggers no action** — this document establishes that the task graph exists and its role, not any construction algorithm.

## Future direction

Future planning engines may build richer task graphs — expressing conditional branches, alternative paths, and finer structure. The graph's nature is fixed: an inert, legible description of planned work, acyclic in its ordering, with committing actions marked. Expressiveness grows; the graph never becomes an executor.
