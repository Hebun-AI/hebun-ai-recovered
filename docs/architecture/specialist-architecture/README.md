# Specialist Architecture — Architecture (Phase 9D)

## Purpose

**Specialist Architecture** defines the architectural role of a **Specialist** inside an AI-native enterprise. Phase 9A ([Enterprise Organization](../enterprise-organization/README.md)) defined the company; Phase 9B ([Department Architecture](../department-architecture/README.md)) defined the department; Phase 9C ([Manager Architecture](../manager-architecture/README.md)) defined the authority seat that governs a department. Phase 9D defines the **Specialist**: an organizational **responsibility seat** responsible for a defined business capability.

A Specialist provides **domain expertise, ownership of assigned responsibilities, accountable execution ownership, reporting to its Manager, and collaboration with peers**. A Specialist **owns** the work of its capability; Execution ([Phase 8](../director-execution/README.md)) **performs** it. The Specialist is the organizational role that *owns* work — not the engine that *does* it.

It is **architecture only**. It defines no concrete specialist, no concrete department, no business domain, no workflows, no implementation, no runtime, no prompts, and no algorithms. It describes *what a Specialist is and how it is structured* — not which specialists exist or how any of them runs.

## Relationship with Enterprise Organization (Phase 9A)

The Specialist is the occupant of the **specialist seat** the enterprise hierarchy defined ([organizational model](../enterprise-organization/02-organizational-model.md)) — the lowest level of accountability, beneath the Manager. Everything a Specialist holds descends from Phase 9A: its authority is delegated, bounded, and revocable ([authority model](../enterprise-organization/04-authority-model.md)); its governance is the enterprise-wide, Director-anchored regime ([enterprise governance](../enterprise-organization/06-enterprise-governance.md)). A Specialist never originates authority — it receives it.

## Relationship with Departments (Phase 9B)

A Specialist works **within one department** and its single business domain ([department architecture](../department-architecture/README.md)). It owns a defined **business capability** inside that department's domain — a focused part of what the department owns. The department owns the domain; the Specialist owns a capability within it. A Specialist never owns the department, and its capability never spills outside the department's domain ([department responsibilities](../department-architecture/03-department-responsibilities.md)).

## Relationship with Managers (Phase 9C)

A Specialist **receives delegated authority from its Manager, reports to its Manager, and escalates to its Manager**. The Manager ([Phase 9C](../manager-architecture/README.md)) governs the department and delegates bounded authority to the specialist seats beneath it ([delegation model](../manager-architecture/04-delegation-model.md)). The Specialist acts within that delegation, reports status honestly upward, and raises to the Manager anything beyond its grant. A Specialist never governs its Manager and never manages the department.

## Relationship with Execution Architecture (Phase 8)

A Specialist **owns** work; Execution **performs** it. The Specialist is the accountable owner of its capability's outcomes — it holds "**accountable execution ownership**" — while the actual carrying-out of approved work is Execution's job ([execution](../director-execution/README.md)). The Specialist answers for the outcome; Execution produces it. The two are paired but distinct: ownership in the organization, performance in Execution.

## Why Specialists are separate from execution

```
Enterprise Organization (Phase 9A)
   Director → Enterprise → Department → Manager → Specialist
                                                     │
                                                     ▼
   Specialist Architecture (Phase 9D)   ← this phase
   the responsibility seat that OWNS a business capability
   (Execution performs the work; the Specialist owns it)
```

- **A Specialist owns; execution performs.** Ownership (who answers for the capability) and performance (what carries out the work) are different concerns. A Specialist that also executed would fuse the accountable role with the engine — you could no longer separate "who owns this" from "what did it."
- **A Specialist is a seat; its occupant is transient.** The specialist seat and its responsibilities are stable; a human or an AI may fill it. Separating the seat from its occupant keeps a capability's ownership constant while its specialist can change.
- **A Specialist is not a Manager, not Director Intelligence, not an engine.** It does not govern the department, does not reason for the enterprise, and does not orchestrate work. It owns a capability and answers for it.
- **Director Authority stays intact.** A Specialist's authority is always delegated (via its Manager) and revocable ([authority model](../enterprise-organization/04-authority-model.md)). Because a Specialist owns rather than executes, it can be held to a bounded, governed, traceable standard without ever escaping the Director.

## Documents

| Document | Topic |
|---|---|
| [01 — Specialist Principles](01-specialist-principles.md) | The principles a Specialist obeys |
| [02 — Specialist Model](02-specialist-model.md) | What a Specialist is, structurally |
| [03 — Specialist Responsibilities](03-specialist-responsibilities.md) | Capability and responsibility ownership |
| [04 — Authority Boundaries](04-specialist-authority-boundaries.md) | The limits of a Specialist's authority |
| [05 — Collaboration Model](05-collaboration-model.md) | How Specialists work with peers |
| [06 — Reporting & Governance](06-reporting-and-governance.md) | How a Specialist reports and stays governed |
| [07 — Future Evolution](07-future-evolution.md) | How the Specialist seat deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Specialist Architecture must always do

- **Define what a Specialist is** — a responsibility seat owning a business capability.
- **Define responsibility ownership** and **business capability ownership**.
- **Define the reporting relationship to Managers** and **collaboration with Specialists**.
- **Define authority boundaries** — the limits of a Specialist's delegated authority.
- **Preserve Department ownership**, **Manager accountability**, **Director Authority**, **enterprise governance**, and **traceability**.
- **Support future human specialists** and **future AI specialists**.
- **Never** originate authority, manage departments, govern Managers, redesign plans, or replace Director Intelligence.

## Status

Architecture only — the model of what a Specialist is, not any concrete specialist, department, or business domain, and not runtime. Concrete specialists (human or AI), departments, capabilities, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
