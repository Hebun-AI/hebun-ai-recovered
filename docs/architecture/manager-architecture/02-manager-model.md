# 02 — Manager Model

## Purpose

The Manager Model defines **what a Manager is, structurally** — the anatomy of an organizational authority seat that governs a department. It says what a Manager consists of and what it is not, without naming a concrete manager, department, or specialist.

## Architectural role

This document gives a Manager its shape. Authority ([03](03-manager-authority.md)) defines what the seat may do; delegation ([04](04-delegation-model.md)) defines how it hands authority down; oversight and reporting ([05](05-oversight-and-reporting.md)) and escalation and governance ([06](06-escalation-governance.md)) define how it governs. The model is the anatomy the other topics operate on.

## What a Manager is

A Manager is an **organizational authority seat responsible for governing a department**. Structurally, a Manager is composed of:

- **A governed department** — the one department ([Phase 9B](../department-architecture/README.md)) whose domain the Manager governs. One Manager seat, one department.
- **Carried ownership** — the department's ownership of its domain, held by the Manager in practice ([department responsibilities](../department-architecture/03-department-responsibilities.md)).
- **An accountability line** — the connection upward to the enterprise level and ultimately the Director.
- **A delegated authority** — the bounded, revocable grant the Manager holds ([manager authority](03-manager-authority.md)).
- **Delegation reach** — the specialist seats the Manager may delegate bounded authority to ([delegation model](04-delegation-model.md)).
- **Governance duties** — oversight, reporting, and escalation ([05](05-oversight-and-reporting.md), [06](06-escalation-governance.md)).

## What a Manager provides

A Manager provides six things to its department, and only these:

- **Ownership** — it carries the department's domain ownership.
- **Accountability** — it answers upward for the domain.
- **Delegation** — it hands bounded authority to specialists.
- **Oversight** — it watches the delegated work.
- **Reporting** — it reports status and problems upward.
- **Escalation** — it raises what exceeds its authority.

## What a Manager is not

- **Not a reasoning engine** — it does not think ([Director Intelligence](../director-reasoning/README.md)).
- **Not an execution engine** — it does not perform work ([Execution](../director-execution/README.md)).
- **Not an orchestration engine** — it does not coordinate running work ([execution orchestration](../execution-orchestration/README.md)).
- **Not a workflow** — it is a standing seat, not a sequence of steps.
- **Not a planner** — it produces no plans ([Planning](../director-planning/README.md)).
- **Not a specialist** — it delegates and oversees; it does not do the specialist's work.

A Manager is an **authority seat**, not an engine and not a doer.

## Seats, not occupants

The Manager is itself a seat that a human manager or a future AI manager may fill ([enterprise organizational model](../enterprise-organization/02-organizational-model.md)). The model defines the seat and its duties; it never defines the concrete occupant. That is a later phase behind the Director gate.

## Inputs

- The **manager principles** ([01](01-manager-principles.md)) — the constitution the model must satisfy.
- The **department and enterprise architectures** ([9B](../department-architecture/README.md), [9A](../enterprise-organization/README.md)) — the department governed and the hierarchy it sits in.

## Outputs

- A **defined Manager anatomy** — governed department, carried ownership, accountability line, delegated authority, delegation reach, governance duties — that authority, delegation, oversight, and escalation all build on.

## Boundaries

- Defines **no concrete manager, department, or specialist** — only the anatomy of the seat.
- Defines **no workflow, runtime, or mechanism** — only the structure of a governing seat.
- Performs **no reasoning, work, or orchestration** — it is an anatomy, not an actor.

## Future direction

Future managers — human or AI — instantiate this anatomy: governing a real department, carrying its ownership, delegating to real specialists, overseeing, reporting, escalating. The seat's duties may deepen over time ([future evolution](07-future-evolution.md)), but a Manager stays a governing authority seat, never an engine. Managers populate; the anatomy holds.
