# Director Interface

## What this is

**Director Interface** is the executive interaction layer of Hebun AI — the primary surface through which the Director collaborates with Hebun. It is where the Director sees, asks, decides, and approves; where Hebun surfaces, summarizes, warns, and recommends.

It is **not** a chatbot, **not** an agent, **not** reasoning, **not** memory. It is the **interface** — the executive operating layer that presents everything Hebun's deeper systems produce and carries the Director's intent and approvals back into them.

This directory documents **only the product vision and capability boundaries** of a future capability. No implementation, APIs, runtime, or architecture changes.

## Where it sits

Director Interface is the topmost layer — the one the Director actually touches — sitting above everything Hebun does:

```
Organizational Memory       (Phase 6 — what has happened)
Director Reasoning          (Phase 7 — how the organization thinks)
Multi-Agent Orchestration   (execution of approved work)
        │  surfaced through
        ▼
Director Interface          ← this capability (the executive surface)
        ▲  Director sees, decides, approves
        │
     Director
```

Everything below produces knowledge, judgment, and action; the Director Interface is how the Director *experiences* and *directs* all of it. It consumes those systems; it replaces none of them.

## Documents

| Document | Covers |
|---|---|
| [01 — Purpose](01-purpose.md) | The executive operating layer |
| [02 — Interaction Model](02-interaction-model.md) | How the Director and Hebun collaborate |
| [03 — Multimodal Interface](03-multimodal-interface.md) | Voice, text, dashboard, mobile, wearable, beyond |
| [04 — Proactive Assistance](04-proactive-assistance.md) | How Hebun reaches out without acting |
| [05 — Boundaries](05-boundaries.md) | Consumes the deeper systems; replaces none |
| [06 — Future Evolution](06-future-evolution.md) | Toward a Jarvis-like interface, authority preserved |

## The rule that governs it

The Director Interface makes Hebun **accessible and proactive** — but it holds no authority of its own. It presents recommendations and requests approvals; it never decides or commits on the Director's behalf. Every irreversible action still passes through the Director's explicit approval ([05 — Boundaries](05-boundaries.md), [Director Authority](../../director-reasoning/05-director-authority.md)). This principle runs through every document here.

## Status

Future product capability — a roadmap extension. Vision and boundaries only. Its architecture, contracts, and runtime — should it be built — follow the [Capability Lifecycle](../../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
