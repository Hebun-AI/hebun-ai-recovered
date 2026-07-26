# 05 — Dependency Management

## Purpose

Dependency Management is where planning **establishes the ordering and constraints between tasks** — which tasks must precede others, which can run together, and what conditions gate progress. It is what turns a set of tasks into an executable *sequence*: without dependencies, a plan is a list; with them, it is an ordered plan of work.

## Architectural role

Dependency Management defines the **edges** of the [Task Graph](03-task-graph.md) — the directed relationships that impose order. It works with [Resource Planning](04-resource-planning.md) (a shared resource can create an implicit dependency) and feeds [Plan Validation](06-plan-validation.md), which checks the dependency structure is sound (notably, acyclic). It reuses the acyclicity discipline of the organizational graph ([design principles](../relationship-graph/06-design-principles.md)): ordering dependencies must not form cycles, or the plan can never start.

## Inputs

- The **tasks** from decomposition and their place in the task graph.
- The **logical requirements** — which task's output another needs.
- The **resource and constraint context** — shared resources and rules that impose ordering.

## Outputs

- A **dependency structure** — the ordering relationships between tasks: sequential, parallel, and conditional.
- Identified **critical paths and blocking relationships** — where the plan's timing is determined.
- A **soundness signal** — whether the dependencies are acyclic and consistent, for validation to confirm.

## Boundaries

- Dependencies are **acyclic in ordering** — a task cannot, directly or transitively, depend on its own completion. A dependency cycle is an invalid plan.
- Dependency Management **orders work; it does not run it**. Defining that A precedes B executes neither A nor B.
- It **produces no action** and **defines no method** — this document establishes that dependency management exists and its role, not any scheduling algorithm.

## Future direction

Future planning engines may manage dependencies more richly — expressing conditional and probabilistic orderings, optimizing critical paths, detecting subtle implicit dependencies. The discipline is fixed: ordering is acyclic and consistent, and defining order never executes work. Richness grows; the acyclicity and non-execution hold.
