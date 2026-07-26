# 04 — Authority Boundaries

## Purpose

Authority Boundaries define **the limits of a Specialist's authority** and **what a Specialist does not do**. A Specialist is the lowest accountability seat: it holds a bounded delegated authority over one capability and refuses everything outside it. This document draws those lines so a Specialist never manages a department, governs a Manager, originates authority, or crosses into another capability.

## Architectural role

Where the principles ([01](01-specialist-principles.md)) state what a Specialist must obey and responsibilities ([03](03-specialist-responsibilities.md)) state what it owns, the boundaries state what it must refuse. Together they fence a Specialist into its single capability and its delegated authority.

## Authority boundaries

### A Specialist's authority is delegated by its Manager
A Specialist holds only the authority its Manager delegated to it, itself a subset of the Manager's grant, itself delegated from above ([manager delegation model](../manager-architecture/04-delegation-model.md), [enterprise authority model](../enterprise-organization/04-authority-model.md)). A Specialist never originates authority. Its authority is always traceable up through the Manager to the Director.

### A Specialist's authority is bounded by its capability
A Specialist's authority extends over its own capability and no further. It holds no authority over another Specialist's capability, over the department, or over the enterprise. Capability and authority share a boundary — a Specialist is authoritative exactly where it is accountable.

### A Specialist's authority is revocable
Any delegation to a Specialist can be withdrawn by its Manager, or from higher up ([manager delegation model](../manager-architecture/04-delegation-model.md)). No Specialist holds authority its Manager or the Director cannot reclaim.

### Committing actions stay behind Director approval
A Specialist's delegated authority may make it *accountable* for work that includes committing or irreversible actions, but the commitment itself rests on the Director's approval ([enterprise authority model](../enterprise-organization/04-authority-model.md)). A Specialist never manufactures committing authority.

## What a Specialist does not do

### It does not originate authority
A Specialist creates no authority; it only receives delegation. What it holds is exactly what was granted ([manager delegation model](../manager-architecture/04-delegation-model.md)).

### It does not manage the department
A Specialist does not govern the department, does not delegate as a Manager, and does not carry the department's domain ownership. That is the Manager's role ([Manager Architecture](../manager-architecture/README.md)).

### It does not govern its Manager
A Specialist reports to and escalates to its Manager; it never governs, directs, or overrides the Manager. Accountability runs upward, not the reverse ([reporting & governance](06-reporting-and-governance.md)).

### It does not replace Director Intelligence
A Specialist provides expertise within its capability, but it produces no enterprise plan, alters none, and makes no enterprise decision ([Director Intelligence](../director-reasoning/README.md), [Planning](../director-planning/README.md), [Decision](../director-decision/README.md)). Reasoning, planning, and deciding stay upstream.

### It does not perform or orchestrate the work
A Specialist owns its capability's outcomes; Execution performs the work ([execution](../director-execution/README.md)) and no Specialist orchestrates running work ([execution orchestration](../execution-orchestration/README.md)). Ownership is the Specialist's; performance and orchestration are not.

### It does not cross into another capability
A Specialist never owns, acts in, or claims authority over another Specialist's capability. Cross-capability work happens through collaboration ([collaboration model](05-collaboration-model.md)), each Specialist's ownership preserved.

## Inputs

- The **specialist principles, model, and responsibilities** ([01](01-specialist-principles.md)–[03](03-specialist-responsibilities.md)) — the frame these boundaries protect.
- The **Manager's delegation** ([9C](../manager-architecture/04-delegation-model.md)) — the source and ceiling of the Specialist's authority.

## Outputs

- A **clear authority limit and negative space** — how far a Specialist's authority reaches and what it refuses — that keeps capabilities, the Manager, and Director Intelligence sovereign.

## Boundaries

- This document **adds no capability** — it removes ambiguity about how far a Specialist may reach.
- It **describes no runtime or mechanism** — only the limits of a Specialist.

## Future direction

As concrete specialists — human or AI — fill the seat, these boundaries hold unchanged. Occupants gain the ability to act *within* their capability and delegated authority — never the right to originate authority, manage a department, govern a Manager, replace Director Intelligence, perform or orchestrate work, or cross capabilities. A Specialist stays a bounded capability owner, forever.
