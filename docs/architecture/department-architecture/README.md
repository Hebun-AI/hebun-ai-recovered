# Department Architecture — Architecture (Phase 9B)

## Purpose

**Department Architecture** defines *what a department is* inside an AI-native enterprise. Phase 9A ([Enterprise Organization](../enterprise-organization/README.md)) defined the enterprise hierarchy and established the *notion* of a department as one of its levels. Phase 9B goes one level deeper: it defines the **architectural model of a department** — its role, ownership, accountability, and authority boundaries — as a permanent organizational unit responsible for a defined business domain.

It is **architecture only**. It defines no concrete department, no manager agents, no specialist agents, no workflows, no implementation, no runtime, no prompts, and no algorithms. It describes *what any department is and how it is structured* — not which departments exist or how any of them runs.

## Relationship with Enterprise Organization (Phase 9A)

Enterprise Organization defined the whole hierarchy and placed the department level within it ([organizational model](../enterprise-organization/02-organizational-model.md)). Department Architecture is the **zoom-in** on that one level. Everything a department is inherits from Phase 9A:

- its **authority** is delegated, downward, bounded, and revocable ([authority model](../enterprise-organization/04-authority-model.md));
- its **coordination** with other units flows through the hierarchy ([organizational coordination](../enterprise-organization/05-organizational-coordination.md));
- its **governance** is the enterprise-wide, Director-anchored regime ([enterprise governance](../enterprise-organization/06-enterprise-governance.md)).

Phase 9B does not restate the enterprise; it specifies what a *single department* is, within the frame Phase 9A set.

## Role of Departments

```
Enterprise Organization (Phase 9A)
   Director → Enterprise → Department → Manager → Specialist
                              │
                              ▼
   Department Architecture (Phase 9B)   ← this phase
   what a department is: a permanent unit owning one business domain
```

A department is the enterprise's unit of **domain ownership**. It is where a defined area of business responsibility lives permanently: the enterprise divides its responsibilities into departments, each owning one domain, each accountable upward to the enterprise level and ultimately the Director. A department holds ownership, accountability, and bounded authority over its domain — and nothing beyond it.

## Why departments are separate from execution and agents

- **A department is structure; execution is action.** The department *owns and is accountable for* a domain; Execution ([Phase 8](../director-execution/README.md)) *performs* the approved work. A department that also executed would fuse ownership with activity — you could no longer separate "who is responsible for this domain" from "what work ran."
- **A department is a seat; an agent is an occupant.** The department defines the domain, its ownership, and its authority boundary. Manager and specialist *agents* are the future occupants that act within it ([organizational model](../enterprise-organization/02-organizational-model.md)). Keeping the department separate from its agents means the domain's structure is stable while its occupants can change.
- **A department is permanent; work and agents are transient.** Departments persist as the enterprise's standing division of responsibility. Executions come and go; agents may be added or replaced. Separating the department from both lets the domain ownership outlast any run of work or any particular agent.
- **Director Authority stays intact.** A department's authority is always delegated and revocable ([authority model](../enterprise-organization/04-authority-model.md)). Because the department is structure — not an executor and not an agent — it can be held to a bounded, governed, traceable standard without ever escaping the Director.

## Documents

| Document | Topic |
|---|---|
| [01 — Department Principles](01-department-principles.md) | The principles a department obeys |
| [02 — Department Model](02-department-model.md) | What a department is, structurally |
| [03 — Department Responsibilities](03-department-responsibilities.md) | Ownership and accountability |
| [04 — Department Boundaries](04-department-boundaries.md) | What a department does not do |
| [05 — Department Coordination](05-department-coordination.md) | How departments collaborate |
| [06 — Department Governance](06-department-governance.md) | How a department is governed and traceable |
| [07 — Future Evolution](07-future-evolution.md) | How departments deepen |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Department Architecture must always do

- **Define the role of a department** — a permanent unit owning one business domain.
- **Define departmental ownership** — what a department owns.
- **Define departmental accountability** — what a department answers for, and to whom.
- **Define departmental authority boundaries** — the limits of a department's delegated authority.
- **Support future manager agents** and **future specialist agents** — defined seats within the department, though none is defined here.
- **Support collaboration with other departments** — through the hierarchy, boundaries preserved.
- **Preserve Director Authority** — a department's authority is always delegated and revocable.
- **Preserve enterprise governance** — the department falls under the enterprise-wide regime.
- **Preserve traceability** — a department's ownership, authority, and accountability are auditable.
- **Never perform reasoning** — reasoning stays in Director Intelligence.
- **Never execute work** — work stays in Execution.
- **Never redesign plans** — planning stays in Director Intelligence.

## Status

Architecture only — the model of what a department is, not any concrete department, not its manager or specialist agents, and not runtime. Concrete departments, manager agents, specialist agents, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
