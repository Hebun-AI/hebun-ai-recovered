# Human Organization — Architecture (Phase 9F)

## Purpose

**Human Organization** defines *how humans participate inside the same enterprise architecture* the previous phases built. Phases 9A–9E defined an AI-native organizational structure: the enterprise ([9A](../enterprise-organization/README.md)), departments ([9B](../department-architecture/README.md)), managers ([9C](../manager-architecture/README.md)), specialists ([9D](../specialist-architecture/README.md)), and cross-organization collaboration ([9E](../cross-organization-collaboration/README.md)). Phase 9F establishes one thing clearly: **humans are organizational participants, not exceptions.** They occupy the same organizational seats, under the same governance model, as any other participant.

The central claim of this phase: **the organization has one structure, not two.** There is no separate "human organization" running alongside the AI one. Humans and AI participants fill the *same* seats — department, manager, specialist — under the *same* authority, accountability, governance, and traceability. The seat is defined independently of who occupies it.

This phase does **not** define authentication, permissions, UI, workflows, execution, or runtime behavior. It is **architecture only** — no implementation, no runtime, no prompts, no algorithms, no concrete job titles, no concrete departments.

## Relationship with Enterprise Organization (Phase 9A)

The enterprise hierarchy defined seats and stated from the start that humans may hold any of them ([organizational model](../enterprise-organization/02-organizational-model.md)). Phase 9F makes that explicit and complete: it confirms the seat is occupant-agnostic and that a human occupant inherits the seat's authority ([authority model](../enterprise-organization/04-authority-model.md)) and governance ([enterprise governance](../enterprise-organization/06-enterprise-governance.md)) unchanged. It adds no new structure — it clarifies how humans fit the existing one.

## Relationship with Managers (Phase 9C)

The manager seat ([Manager Architecture](../manager-architecture/README.md)) may be held by a human or an AI. A human manager governs a department under the identical rules: delegated, bounded, revocable authority; oversight and honest reporting; escalation at the limit. Phase 9F defines nothing new about the manager seat — it confirms a human fills it exactly as the seat prescribes.

## Relationship with Specialists (Phase 9D)

The specialist seat ([Specialist Architecture](../specialist-architecture/README.md)) may be held by a human or an AI. A human specialist owns a business capability under the identical rules: delegated authority, accountable ownership, reporting to its manager, collaboration with peers. Again, no new specialist rules — a human occupies the seat as defined.

## Relationship with AI participants

Humans and AI participants are **peers in the same structure**. Neither is the default and neither is the exception. A human manager may govern a department of AI specialists; an AI manager may govern a department of humans; a mixed department is ordinary. What holds them together is the seat — its authority, accountability, and governance — not the nature of the occupant. Collaboration between human and AI participants follows the cross-organization collaboration rules ([9E](../cross-organization-collaboration/README.md)) without special cases.

## Why humans are first-class organizational participants

```
One organization, one set of seats:
   Director → Enterprise → Department → Manager → Specialist
                                          ▲           ▲
                              a seat may be held by  a seat may be held by
                              a human OR an AI       a human OR an AI
```

- **Seats are defined by responsibility, not occupant.** A seat's authority, ownership, accountability, and governance are properties of the seat. A human filling it is bound by exactly those properties — no more, no less.
- **No exceptions, no parallel org.** Treating humans as exceptions would fork governance into two regimes and destroy the single line of accountability to the Director. One structure keeps accountability whole.
- **Equal, not identical.** Humans and AI participants are equal *as occupants of seats* — held to the same seat rules. They differ in their nature and capabilities; the architecture governs the seat, not the nature.
- **Director Authority stays intact.** A human occupant's authority is delegated and revocable exactly like any occupant's ([authority model](../enterprise-organization/04-authority-model.md)). Humans participate under the Director, not above or outside the structure.

## Documents

| Document | Topic |
|---|---|
| [01 — Human Participation Principles](01-human-participation-principles.md) | The principles human participation obeys |
| [02 — Human Role Model](02-human-role-model.md) | Humans as occupants of occupant-agnostic seats |
| [03 — Human Authority](03-human-authority.md) | A human occupant's delegated authority |
| [04 — Human–AI Collaboration](04-human-ai-collaboration.md) | How humans and AI collaborate as peers |
| [05 — Accountability Model](05-accountability-model.md) | How a human occupant stays accountable |
| [06 — Human Governance](06-human-governance.md) | How humans fall under one governance regime |
| [07 — Future Evolution](07-future-evolution.md) | How human participation deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Human Organization must always do

- **Define humans as organizational participants** — first-class, not exceptions.
- **Define organizational seats independent of occupant type** — the seat is the same whoever holds it.
- **Support human and AI occupants equally** — one structure, no parallel org.
- **Preserve Director Authority, enterprise governance, organizational hierarchy, accountability, ownership, and traceability.**
- **Support future hybrid organizations** — any mix of human and AI occupants.
- **Never** perform reasoning, execute work, redefine governance, bypass authority, or create a separate human organization.

## Status

Architecture only — how humans fit the existing organizational structure, not any concrete human role, and not runtime. Concrete roles, authentication, permissions, UI, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
