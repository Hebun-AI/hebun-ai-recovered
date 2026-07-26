# 02 — Specialist Model

## Purpose

The Specialist Model defines **what a Specialist is, structurally** — the anatomy of an organizational responsibility seat that owns a business capability. It says what a Specialist consists of and what it is not, without naming a concrete specialist, department, or capability.

## Architectural role

This document gives a Specialist its shape. Responsibilities ([03](03-specialist-responsibilities.md)) attach capability ownership to this shape; authority boundaries ([04](04-specialist-authority-boundaries.md)) fence it; collaboration ([05](05-collaboration-model.md)) relates it to peers; reporting and governance ([06](06-reporting-and-governance.md)) hold it accountable. The model is the anatomy the other topics operate on.

## What a Specialist is

A Specialist is an **organizational responsibility seat responsible for a defined business capability**. Structurally, a Specialist is composed of:

- **A business capability** — the defined, focused part of a department's domain the Specialist owns ([specialist responsibilities](03-specialist-responsibilities.md)). One Specialist seat, one capability.
- **Domain expertise** — the specialized competence the seat represents within that capability.
- **Accountable execution ownership** — ownership of the capability's outcomes, which Execution performs ([execution](../director-execution/README.md)) and the Specialist answers for.
- **A delegated authority** — the bounded, revocable grant received from its Manager ([manager delegation model](../manager-architecture/04-delegation-model.md)).
- **A reporting line** — the connection upward to its Manager ([reporting & governance](06-reporting-and-governance.md)).
- **Peer collaboration links** — its structured relationships with peer Specialists ([collaboration model](05-collaboration-model.md)).

## What a Specialist provides

A Specialist provides five things, and only these:

- **Domain expertise** — specialized competence in its capability.
- **Ownership of assigned responsibilities** — it owns what it is given within its capability.
- **Accountable execution ownership** — it answers for the outcomes Execution performs.
- **Reporting to its Manager** — it keeps its Manager honestly informed.
- **Collaboration with peers** — it works with peer Specialists through the structure.

## What a Specialist is not

- **Not Director Intelligence** — it does not reason, plan, or decide for the enterprise ([Director Intelligence](../director-reasoning/README.md)).
- **Not a Manager** — it does not govern a department or delegate as a Manager does ([Manager Architecture](../manager-architecture/README.md)).
- **Not an orchestration engine** — it does not coordinate running work ([execution orchestration](../execution-orchestration/README.md)).
- **Not an enterprise authority** — it holds no authority beyond its delegated capability grant.
- **Not a workflow** — it is a standing seat, not a sequence of steps.
- **Not a planner** — it produces no plans ([Planning](../director-planning/README.md)).

A Specialist is an **accountable owner of a capability** — not a governor, not an engine, not a planner.

## Seats, not occupants

The Specialist is a seat that a human specialist or a future AI specialist may fill ([enterprise organizational model](../enterprise-organization/02-organizational-model.md)). The model defines the seat and its responsibilities; it never defines the concrete occupant. That is a later phase behind the Director gate.

## Inputs

- The **specialist principles** ([01](01-specialist-principles.md)) — the constitution the model must satisfy.
- The **department, manager, and enterprise architectures** ([9B](../department-architecture/README.md), [9C](../manager-architecture/README.md), [9A](../enterprise-organization/README.md)) — the domain, delegating Manager, and hierarchy the seat sits in.

## Outputs

- A **defined Specialist anatomy** — capability, domain expertise, accountable execution ownership, delegated authority, reporting line, peer links — that responsibilities, boundaries, collaboration, and governance all build on.

## Boundaries

- Defines **no concrete specialist, department, or capability** — only the anatomy of the seat.
- Defines **no workflow, runtime, or mechanism** — only the structure of an owning seat.
- Performs **no work, reasoning, or orchestration** — it is an anatomy, not an actor.

## Future direction

Future specialists — human or AI — instantiate this anatomy: owning a real capability, contributing real expertise, answering for outcomes Execution performs, reporting to a real Manager, collaborating with real peers. The seat's responsibilities may deepen over time ([future evolution](07-future-evolution.md)), but a Specialist stays an accountable owner of a capability, never a governor or an engine. Specialists populate; the anatomy holds.
