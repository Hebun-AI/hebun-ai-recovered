# Director Reasoning Orchestration — Architecture (Phase 7G)

## Purpose

**Director Orchestration** is the layer that makes all the reasoning components collaborate as a **single Director Intelligence workflow**. Phases 7A–7F defined the components: philosophy, cognition, mechanisms, planning, decision, and verification. Each is a self-contained layer. Phase 7G defines how they **work together in order** — how the workflow progresses from reasoning to a verified, decision-ready outcome, how information flows between the components, how verification's findings feed back to earlier components, and how the whole is governed and kept traceable.

It is **architecture only**. No algorithms, no prompts, no runtime, no execution. It describes *how the components are coordinated*, not the machinery that coordinates or executes.

## Relationship with Phases 7A–7F

Orchestration is the connective layer over the six component layers:

- **Phase 7A — Philosophy.** Orchestration serves and enforces reasoning's principles across the whole workflow — every component it coordinates stays advisory, honest, and subordinate to the Director.
- **Phase 7B — Cognition.** The cognitive lifecycle is an ordered progression *within* reasoning; orchestration is the ordered progression *across* all six components.
- **Phase 7C — Mechanisms.** Orchestration coordinates when the mechanisms are brought to bear, but never performs them.
- **Phase 7D — Planning / 7E — Decision / 7F — Verification.** Orchestration sequences these — planning after approved reasoning, decision over validated plans, verification over the decision — and routes verification's feedback back when issues are found.

Orchestration does none of these components' work. It **coordinates** them.

## Role of Orchestration inside Director Intelligence

```
        ┌─────────────────── Director Orchestration (7G) ───────────────────┐
        │  (coordinates order, information flow, feedback, governance,        │
        │   traceability — does no component's work, executes nothing)       │
        │                                                                    │
        ▼        ▼            ▼            ▼            ▼            ▼
  Reasoning → Planning → Decision → Verification → readiness verdict          │
   (7A–7C)     (7D)       (7E)        (7F)                                     │
        └──────────── feedback loops on verification findings ───────────────┘
                                    │  Director approval
                                    ▼
                          Execution (future, outside this phase)
```

Orchestration is the workflow spine. It ensures the components run in the right order, receive the right inputs, and — when verification finds a flaw — loop back to the responsible component rather than pushing a flawed outcome forward. The Director approves at the gates; orchestration coordinates the flow between them.

## Why Orchestration is separate from reasoning, planning, decision, verification, and execution

- **Separate from the component layers.** Reasoning, planning, decision, and verification each *do a job*. Orchestration *coordinates* their jobs. Folding coordination into any one component would give that component authority over the others and blur the clean separation the whole architecture depends on.
- **A coordinator, not a doer.** Orchestration holds no reasoning, plan, decision, or verdict of its own. It moves information and enforces order; it never forms judgment, builds plans, decides, or verifies. It has no opinion on the outcome — only on the *process*.
- **Separate from Execution.** Orchestration coordinates the reasoning workflow up to a readiness verdict and the Director's approval; execution runs approved work. Keeping orchestration execution-free is what makes coordinating freely safe — moving information between advisory layers commits nothing. If orchestration could execute, it would hold authority it was never granted.
- **It never modifies responsibilities.** Orchestration sequences and connects the components; it never changes what each is responsible for. The layers keep their jobs; orchestration keeps them in order.

## Documents

| Document | Topic |
|---|---|
| [01 — Orchestration Principles](01-orchestration-principles.md) | The principles orchestration obeys |
| [02 — Phase Coordination](02-phase-coordination.md) | Ordered progression across the components |
| [03 — Information Flow](03-information-flow.md) | How outputs pass between components |
| [04 — Feedback Loops](04-feedback-loops.md) | Returning to earlier components on verification findings |
| [05 — Governance Control](05-governance-control.md) | Enforcing gates and authority across the workflow |
| [06 — Orchestration Validation](06-orchestration-validation.md) | Checking the workflow itself is sound |
| [07 — Future Evolution](07-future-evolution.md) | How orchestration deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Orchestration must always do

- **Coordinate all reasoning phases** — reasoning, planning, decision, verification as one workflow.
- **Preserve ordered phase progression** — the components run in their proper order, none skipped.
- **Manage information flow between phases** — each component receives the outputs it needs.
- **Support feedback to earlier phases** — when verification finds an issue, route it back to the responsible component.
- **Preserve Director Authority** — it coordinates a workflow that ends in the Director's decision; committing actions stay gated.
- **Maintain complete traceability** — the whole workflow is auditable end to end.
- **Never modify architectural responsibilities** — it coordinates the components; it does not change their jobs.
- **Never execute work** — orchestration coordinates; it does not act.

## Status

Architecture only — the orchestration architecture, not its implementation. Orchestration engines, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
