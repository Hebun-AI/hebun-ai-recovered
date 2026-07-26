# 07 — Future Evolution

How Director Planning is expected to evolve — **at the architecture level only**. No algorithms, no prompts, no implementation, no runtime, no execution. The planning topics defined here are the stable frame; evolution deepens *how well each is performed*, never *whether the boundaries hold*.

Each direction below is future work, behind its own Director gate, following the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md).

## Deeper planning, same architecture

Future planning engines will perform each topic more capably — sharper goal decomposition, richer task graphs, more precise resource planning, subtler dependency management, more thorough validation. But they will still follow the **same architecture**: derive from approved reasoning, structure into a validated task graph, and produce an execution-ready plan that never executes and never bypasses Director Authority. A planning engine that executed, or skipped validation, would not be more advanced — it would be broken. The architecture and its boundaries are the invariant every future engine inherits.

## Toward the Execution phase

The natural next phase is **Execution** — how an approved plan is actually carried out. This phase deliberately stops at the execution-ready plan; execution is a separate concern, under the Director's authority, behind its own gate. The seam is clean: planning produces a validated plan and *marks* its committing actions; execution runs the plan only after the Director approves it, honoring every mark. Planning hands off a plan; it never runs one.

## Integration with reasoning and orchestration

As reasoning ([Phases 7A–7C](../director-reasoning/README.md)) deepens, the recommendations planning receives grow richer, and plans improve accordingly. As Multi-Agent Orchestration matures, planning's task graphs become the structure orchestration coordinates against — but planning still only *produces* the plan; orchestration and execution *run* it, under the Director's authority. Planning consumes better reasoning and feeds better execution; its own boundaries do not move.

## The invariant across all evolution

Through every future version of Director Planning:

- Planning **derives from approved reasoning** — no plan without an approved recommendation.
- Planning **produces execution-ready plans** but **never executes** — preparation only.
- Planning **never bypasses Director Authority** — every committing action stays gated to the Director at execution.
- Capability may grow without limit; the **two-gate structure** (approval before planning, approval before execution) does not change.

Director Planning can become far more capable. It cannot execute work, invent goals, or authorize committing actions on its own. That fixed foundation is what every future planning engine is built around.
