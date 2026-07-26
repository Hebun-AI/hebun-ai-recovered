# Cross-Organization Collaboration — Architecture (Phase 9E)

## Purpose

**Cross-Organization Collaboration** defines *how organizational units collaborate* while preserving ownership, accountability, and authority. Phases 9A–9D defined the hierarchy: the enterprise ([9A](../enterprise-organization/README.md)), departments ([9B](../department-architecture/README.md)), managers ([9C](../manager-architecture/README.md)), and specialists ([9D](../specialist-architecture/README.md)). Each of those defined a *unit* and its own coordination outward. Phase 9E defines the **structural collaboration** *between* units — the rules by which departments, managers, and specialists work together without any unit losing its ownership, shedding its accountability, or exceeding its authority.

This is **structural collaboration** — the standing organizational relationships between units. It is **not** execution orchestration, workflows, task scheduling, runtime communication, or implementation. It coordinates *organizational relationships*, not running work.

It is **architecture only**. It defines no concrete department, manager, or specialist, no workflows, no implementation, no runtime, no prompts, and no algorithms.

## Relationship with Enterprise Organization (Phase 9A)

The enterprise defined the whole hierarchy and its coordination structure ([organizational coordination](../enterprise-organization/05-organizational-coordination.md)) and authority model ([authority model](../enterprise-organization/04-authority-model.md)). Phase 9E is the **detailed rulebook** for collaboration across that hierarchy — the interaction, ownership-transfer, coordination, escalation, and governance rules that make cross-unit collaboration safe. It restates no enterprise structure; it specifies how units within it collaborate.

## Relationship with Departments (Phase 9B)

Departments own domains ([department responsibilities](../department-architecture/03-department-responsibilities.md)) and collaborate through the hierarchy ([department coordination](../department-architecture/05-department-coordination.md)). Phase 9E defines **cross-department collaboration** in detail: how two departments align on a shared outcome while each keeps exclusive ownership of its own domain, and how ownership moves between them when it must — never by a department reaching into another's domain.

## Relationship with Managers (Phase 9C)

Managers govern departments and hold delegated authority ([manager authority](../manager-architecture/03-manager-authority.md)). Phase 9E defines **collaboration between managers**: how managers coordinate across departments under their bounded authority, and how matters that exceed a manager's grant escalate ([escalation model](05-escalation-model.md)) rather than crossing authority lines.

## Relationship with Specialists (Phase 9D)

Specialists own capabilities and collaborate with peers ([specialist collaboration](../specialist-architecture/05-collaboration-model.md)). Phase 9E frames **collaboration between specialists** across capability and department lines: peers align on shared outcomes, each keeps its capability ownership, and cross-department specialist work flows through the managers — never bypassing organizational authority.

## Difference between organizational collaboration and execution orchestration

```
Cross-Organization Collaboration (Phase 9E)   ← this phase
   structural: standing relationships between units,
   preserving ownership, accountability, authority
                        │  frames
                        ▼
Execution Orchestration (Phase 8)
   operational: distributing and synchronizing running work
```

- **Structural vs operational.** Organizational collaboration is the *standing structure* of how units relate — who may collaborate with whom, under what authority, with ownership preserved. Execution orchestration ([Phase 8](../execution-orchestration/README.md)) is the *operational* coordination of running work — distribution, synchronization, scheduling.
- **Relationships vs tasks.** This phase coordinates *organizational relationships*; execution coordinates *tasks*. This phase never schedules, routes, or synchronizes work.
- **Stable vs transient.** Organizational collaboration persists; executions come and go. The organizational structure is the frame execution's coordination runs inside.

## Documents

| Document | Topic |
|---|---|
| [01 — Collaboration Principles](01-collaboration-principles.md) | The principles collaboration obeys |
| [02 — Organizational Interaction Model](02-organizational-interaction-model.md) | How units interact structurally |
| [03 — Ownership Transfer](03-ownership-transfer.md) | How ownership moves, safely |
| [04 — Cross-Department Coordination](04-cross-department-coordination.md) | How departments align across domains |
| [05 — Escalation Model](05-escalation-model.md) | How beyond-authority matters rise |
| [06 — Collaboration Governance](06-collaboration-governance.md) | How collaboration stays governed and traceable |
| [07 — Future Evolution](07-future-evolution.md) | How collaboration deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Cross-Organization Collaboration must always do

- **Define collaboration between departments, managers, and specialists.**
- **Define ownership preservation** and **ownership transfer rules**.
- **Define escalation paths** and **structural coordination**.
- **Preserve Director Authority, Department ownership, Manager accountability, Specialist responsibility, enterprise governance, and traceability.**
- **Support future human participants** and **future AI participants**.
- **Never** perform reasoning, execute work, orchestrate execution, redesign plans, or bypass organizational authority.

## Status

Architecture only — the structure of cross-unit collaboration, not any concrete unit, and not runtime. Concrete departments, managers, specialists, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
