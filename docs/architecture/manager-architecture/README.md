# Manager Architecture — Architecture (Phase 9C)

## Purpose

**Manager Architecture** defines the architectural role of a **Manager** inside an AI-native enterprise. Phase 9A ([Enterprise Organization](../enterprise-organization/README.md)) defined the company; Phase 9B ([Department Architecture](../department-architecture/README.md)) defined the department as a permanent unit owning one business domain. Phase 9C defines the **Manager**: an organizational authority seat responsible for **governing a department**.

A Manager provides **ownership, accountability, delegation, oversight, reporting, and escalation** for a department. A Manager **governs work; it does not perform work.**

It is **architecture only**. It defines no concrete manager, no concrete department, no specialist agents, no workflows, no implementation, no runtime, no prompts, and no algorithms. It describes *what a Manager is and how it is structured* — not which managers exist or how any of them runs.

## Relationship with Enterprise Organization (Phase 9A)

The Manager is the occupant of the **manager seat** the enterprise hierarchy defined ([organizational model](../enterprise-organization/02-organizational-model.md)). Everything a Manager holds descends from Phase 9A: its authority is delegated, bounded, and revocable ([authority model](../enterprise-organization/04-authority-model.md)); its governance is the enterprise-wide, Director-anchored regime ([enterprise governance](../enterprise-organization/06-enterprise-governance.md)). A Manager never originates authority — it receives it.

## Relationship with Departments (Phase 9B)

A Manager **governs a department**. The department ([Phase 9B](../department-architecture/README.md)) is the permanent unit that owns a business domain; the Manager is the authority seat that carries that department's ownership, accountability, and delegated authority in practice. The department defines *what domain is owned*; the Manager is *who governs that ownership* — accountable upward for the department's domain, authoritative within its bounded grant, and nowhere beyond it ([department responsibilities](../department-architecture/03-department-responsibilities.md)).

## Relationship with Specialists

A Manager **delegates to specialists** and **oversees** them; it does not do their work. The specialist seat ([organizational model](../enterprise-organization/02-organizational-model.md)) is where focused responsibility within the department is carried out. The Manager delegates bounded authority to specialists, oversees their contribution, receives their reports, and escalates what exceeds its grant — but a Manager is **not** a specialist and never performs a specialist's work. (Specialist Architecture is a later phase; this phase defines only the Manager's side of the relationship.)

## Why Managers are separate from execution

```
Enterprise Organization (Phase 9A)
   Director → Enterprise → Department → Manager → Specialist
                                          │
                                          ▼
   Manager Architecture (Phase 9C)   ← this phase
   the authority seat that GOVERNS a department (it does not perform work)
```

- **A Manager governs; execution performs.** The Manager owns, delegates, oversees, reports, and escalates. Execution ([Phase 8](../director-execution/README.md)) carries out approved work. A Manager that also executed would fuse governance with activity — you could no longer tell "who is accountable" from "who did the work."
- **A Manager is not a reasoning, execution, or orchestration engine.** It does not think ([Director Intelligence](../director-reasoning/README.md)), does not perform work ([Execution](../director-execution/README.md)), and does not orchestrate running work ([execution orchestration](../execution-orchestration/README.md)). It is an authority seat, not an engine.
- **A Manager is a seat; its occupant is transient.** The Manager seat and its governance responsibilities are stable; a human or an AI may fill it. Separating the seat from its occupant keeps a department's governance constant while its manager can change.
- **Director Authority stays intact.** A Manager's authority is always delegated and revocable ([authority model](../enterprise-organization/04-authority-model.md)). Because a Manager governs rather than executes, it can be held to a bounded, governed, traceable standard without ever escaping the Director.

## Documents

| Document | Topic |
|---|---|
| [01 — Manager Principles](01-manager-principles.md) | The principles a Manager obeys |
| [02 — Manager Model](02-manager-model.md) | What a Manager is, structurally |
| [03 — Manager Authority](03-manager-authority.md) | Delegated authority and its bounds |
| [04 — Delegation Model](04-delegation-model.md) | How a Manager delegates downward |
| [05 — Oversight & Reporting](05-oversight-and-reporting.md) | How a Manager oversees and reports |
| [06 — Escalation & Governance](06-escalation-governance.md) | How a Manager escalates and stays governed |
| [07 — Future Evolution](07-future-evolution.md) | How the Manager seat deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Manager Architecture must always do

- **Define what a Manager is** — an authority seat that governs a department.
- **Define delegated authority** — the bounded, revocable grant a Manager holds.
- **Define accountability** — what a Manager answers for, and to whom.
- **Define ownership** — the department's ownership the Manager carries.
- **Define delegation boundaries** — how far a Manager may delegate, and no further.
- **Define reporting responsibilities** — what a Manager reports upward.
- **Define escalation responsibilities** — what a Manager escalates, and when.
- **Define the relationship with Departments** and **with Specialists**.
- **Preserve Director Authority** — a Manager's authority is always delegated and revocable.
- **Preserve enterprise governance** and **traceability**.
- **Support future human managers** and **future AI managers**.
- **Never** perform reasoning, execute work, orchestrate execution, redesign plans, or originate authority.

## Status

Architecture only — the model of what a Manager is, not any concrete manager, department, or specialist, and not runtime. Concrete managers (human or AI), departments, specialists, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
