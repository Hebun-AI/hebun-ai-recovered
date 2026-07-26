# 02 — Department Model

## Purpose

The Department Model defines **what a department is, structurally** — the anatomy of a permanent organizational unit that owns one business domain. It says what a department consists of and how it is arranged internally, without naming a single concrete department or defining any concrete agent.

## Architectural role

This document gives a department its shape. Responsibilities ([03](03-department-responsibilities.md)) attach ownership to this shape; boundaries ([04](04-department-boundaries.md)) fence it; coordination ([05](05-department-coordination.md)) relates it to other departments; governance ([06](06-department-governance.md)) holds it accountable. The model is the anatomy the other topics operate on.

## What a department is

A department is a **permanent organizational unit responsible for a defined business domain**. Structurally, a department is composed of:

- **A domain** — the defined area of business responsibility the department owns. One department, one domain ([department principles](01-department-principles.md)).
- **Ownership** — the department's standing responsibility for that domain's outcomes ([department responsibilities](03-department-responsibilities.md)).
- **A delegated authority** — the bounded, revocable grant that lets the department be responsible for its domain ([enterprise authority model](../enterprise-organization/04-authority-model.md)).
- **An accountability line** — the connection upward to the enterprise level and ultimately the Director.
- **Internal seats** — defined places within the department for its future occupants.

## Internal structure (seats, not occupants)

Within a department, the model defines *seats* that mirror the enterprise levels below "department":

- **Manager seat** — a place that coordinates responsibility inside the department. A defined seat for a future manager agent or a human manager; no concrete manager is defined here.
- **Specialist seat** — a place that carries out focused responsibility within the department's domain. A defined seat for a future specialist agent or a human specialist; no concrete specialist is defined here.

The department defines these seats and their place in its structure; it never defines who fills them. That is a later phase behind the Director gate.

## Departments within the enterprise

A department is one unit at the department level of the enterprise hierarchy ([enterprise organizational model](../enterprise-organization/02-organizational-model.md)). The enterprise supports **many** departments; each is a distinct domain owner. The department model defines the *unit*; the enterprise model defines how many such units there are and how they sit together.

## Inputs

- The **department principles** ([01](01-department-principles.md)) — the constitution the model must satisfy.
- The **enterprise hierarchy** ([Phase 9A](../enterprise-organization/02-organizational-model.md)) — the level a department occupies.

## Outputs

- A **defined department anatomy** — domain, ownership, delegated authority, accountability line, internal seats — that responsibilities, boundaries, coordination, and governance all build on.

## Boundaries

- Defines **no concrete department** — only the anatomy any department has.
- Defines **no concrete agent** — only the internal seats agents may later fill.
- Defines **no workflow, runtime, or mechanism** — only the structure of a domain-owning unit.
- Performs **no reasoning and no work** — it is an anatomy, not an actor.

## Future direction

Future concrete departments instantiate this anatomy — a real domain, real ownership, manager and specialist agents and humans filling the internal seats — without reshaping the model. A department's internal structure may deepen over time ([future evolution](07-future-evolution.md)), but every occupant remains bounded by delegated authority and accountable upward. Departments populate; the anatomy holds.
