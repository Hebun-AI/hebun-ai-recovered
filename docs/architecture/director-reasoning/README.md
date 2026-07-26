# Director Reasoning — Architecture (Phase 7A)

## Purpose

**Director Reasoning** is the cognitive layer of Hebun AI — the layer that turns organizational *knowledge* into organizational *judgment*. Phase 5 established what exists and how it connects; Phase 6 established what the organization remembers. Phase 7 establishes how the organization **thinks** over all of it.

This phase (7A) defines **only the philosophy** — *why* Director Reasoning exists and the principles every future reasoning component must obey. It defines no algorithms, no implementation, no prompts, and no agents.

## What Director Reasoning consumes and produces

Director Reasoning sits above the certified baseline and reads it as its evidence:

```
Organizational Model    (Phase 5A — what exists)
Relationship Graph      (Phase 5B — how things relate)
Organizational Memory   (Phase 6 — what has happened over time)
        │  consumed by
        ▼
Director Reasoning      (Phase 7 — the cognitive layer)  ← this phase
        │  produces
        ▼
judgments · recommendations · decisions · plans      (never direct action)
```

- **Consumes:** the Organizational Model, the Relationship Graph, and Organizational Memory — the structure, the connections, and the history.
- **Produces:** judgments, recommendations, decisions, and plans.
- **Does not:** execute, publish, spend, deploy, or modify memory. Reasoning *reasons* — the outputs are advisory, and any committing action waits for the Director.

## Documents

| Document | Covers |
|---|---|
| [01 — Reasoning Philosophy](01-reasoning-philosophy.md) | Reasoning as the transform from knowledge to judgment |
| [02 — First Principles](02-first-principles.md) | The principles every reasoning component obeys |
| [03 — Reasoning Boundaries](03-reasoning-boundaries.md) | What reasoning does not do |
| [04 — Decision Principles](04-decision-principles.md) | How reasoning weighs and decides |
| [05 — Director Authority](05-director-authority.md) | Why the Director always holds final authority |
| [06 — Future Evolution](06-future-evolution.md) | Integration with planning, orchestration, autonomy |

## The two principles that govern everything

1. **Reasoning produces judgment, not action.** It reads the organization's knowledge and returns understanding and recommendation. It never executes.
2. **The Director always owns final authority.** Reasoning advises; the Director decides. No recommendation overrides the Director, and no irreversible action proceeds without explicit approval.

Both run through every document here.

## Status

Architecture philosophy only. The reasoning contracts, decision models, and runtime — should Phase 7 proceed — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
