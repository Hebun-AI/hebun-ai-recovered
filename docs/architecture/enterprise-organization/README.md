# Enterprise Organization — Architecture (Phase 9A)

## Purpose

**Enterprise Organization** is the highest business structure of Hebun AI — the architecture that defines *how an AI-native enterprise is organized*. Phase 7 completed Director Intelligence (how the system reasons, plans, decides, verifies, and orchestrates). Phase 8 completed Execution (how approved work is performed). Phase 9A begins above both: it defines the **organizational structure** those two layers operate inside — the hierarchy, authority, responsibilities, coordination, and governance of the enterprise as a whole.

It is **architecture only**. It defines no concrete departments, no concrete agents, no workflows, no implementation, no runtime, no prompts, and no algorithms. It describes *how the enterprise is structured*, not what the enterprise contains or how any part of it runs.

## Relationship with Director Intelligence (Phase 7)

Director Intelligence is *how the enterprise thinks*. Enterprise Organization is *the structure that thinking serves*. The organization does not reason — it provides the structural context in which reasoning happens: which part of the enterprise a given decision belongs to, who holds authority over it, and how the Director's authority reaches every level. Reasoning stays entirely in Phase 7; the organization only frames where it occurs and who is accountable for it.

## Relationship with Execution (Phase 8)

Execution is *how the enterprise acts*. Enterprise Organization is *the structure that acting serves*. The organization performs no work — it defines the responsibilities and boundaries within which approved work is carried out: which organizational unit owns an outcome, what authority permits it, and how coordination keeps parallel work coherent. Execution stays entirely in Phase 8; the organization only frames who is responsible for it and under what authority.

## Role of Enterprise Organization

```
Enterprise Organization (Phase 9A)   ← this phase
   hierarchy · authority · responsibilities · coordination · governance
                                          │  structural context
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                             ▼
   Director Intelligence (Phase 7)                Director Execution (Phase 8)
   reasons, plans, decides, verifies              performs approved work
```

Enterprise Organization is the **frame**, not the content. It says *how the enterprise is arranged* — the levels, the lines of authority, the responsibilities, the coordination, the governance — so that Director Intelligence and Execution have a coherent structure to operate within. It thinks about nothing and does nothing itself; it organizes.

## Why organization is separate from execution

- **Different concern.** Organization defines *structure* (who is responsible, under what authority); execution defines *action* (performing approved work). A structure that also executed would blur accountability with activity — you could no longer tell who was responsible from what was done.
- **Structure outlives any single execution.** The organizational hierarchy is stable; executions are transient. Separating them lets the structure persist unchanged across countless executions, and lets executions come and go without reshaping the enterprise.
- **Authority is structural, not operational.** Where authority sits, and how the Director's authority flows through the levels, is a property of the organization — not of any run of work. Keeping it in the organization layer means every execution inherits the same authority model rather than inventing its own.
- **Director Authority must be preserved end to end.** The organization is where Director Authority is anchored at the top of the hierarchy; execution is where it is respected at the point of action. Separating them makes the chain explicit: authority is defined once, structurally, and honored everywhere below.

## Documents

| Document | Topic |
|---|---|
| [01 — Organization Principles](01-organization-principles.md) | The principles the organization obeys |
| [02 — Organizational Model](02-organizational-model.md) | The enterprise hierarchy and its levels |
| [03 — Organizational Boundaries](03-organizational-boundaries.md) | What the organization does not do |
| [04 — Authority Model](04-authority-model.md) | How authority is held and delegated |
| [05 — Organizational Coordination](05-organizational-coordination.md) | How units stay coherent |
| [06 — Enterprise Governance](06-enterprise-governance.md) | How the enterprise is governed and traceable |
| [07 — Future Evolution](07-future-evolution.md) | How the organization deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Enterprise Organization must always do

- **Define the enterprise hierarchy** — the levels of the AI-native enterprise.
- **Define organizational authority** — where authority sits and how it delegates.
- **Define organizational responsibilities** — what each level is accountable for.
- **Preserve Director Authority** — the Director remains the top of the hierarchy; nothing overrides it.
- **Support multiple departments** — the structure admits many departments without naming any.
- **Support future manager agents** and **future specialist agents** — the structure has defined places for them, though it defines none.
- **Support human participation** — humans hold organizational roles alongside future agents.
- **Preserve enterprise governance** — governance applies across the whole organization.
- **Preserve traceability** — organizational authority and responsibility are auditable.
- **Never perform reasoning** — reasoning stays in Director Intelligence.
- **Never execute work** — work stays in Execution.
- **Never redesign plans** — planning stays in Director Intelligence.

## Status

Architecture only — the organizational structure, not its implementation, and not the definition of any concrete department or agent. Departments, manager agents, specialist agents, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
