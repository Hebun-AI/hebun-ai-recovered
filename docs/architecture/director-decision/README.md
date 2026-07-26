# Director Decision — Architecture (Phase 7E)

## Purpose

**Director Decision** is the layer that turns validated plans into a **decision-ready outcome** — the final evaluation before execution. Phase 7A defined *why* the Director reasons; 7B *how* the Director thinks; 7C the mechanisms that realize reasoning; 7D how approved reasoning becomes a structured, validated plan. Phase 7E defines how the Director **evaluates alternatives, prioritizes actions, balances opportunity against risk, aligns with governance, and validates the choice** — producing an outcome the Director can approve, before any execution.

It is **architecture only**. No algorithms, no prompts, no runtime, no execution. It describes *how decision-making is structured*, not the machinery that decides or executes.

## Relationship with Phases 7A–7D

- **Phase 7A — Reasoning Philosophy.** Decision inherits reasoning's principles and its authority boundary: the decision architecture *prepares* a decision-ready outcome; the Director makes the actual decision, and every committing action still requires explicit approval ([Director Authority](../director-reasoning/05-director-authority.md)).
- **Phase 7B — Cognitive Lifecycle.** Reasoning's lifecycle already includes option generation and trade-off analysis ([Phase 7B](../director-reasoning-cognition/README.md)); the decision architecture is where that evaluative work is brought to a head against **validated plans**, not abstract options.
- **Phase 7C — Reasoning Mechanisms.** Decision reuses the mechanism disciplines — evidence-grounded evaluation, honest uncertainty, whole-preserving judgment — applied to choosing among plans.
- **Phase 7D — Planning.** Planning produces validated, execution-ready plans. Decision consumes them: it evaluates the plan (or competing plans) and produces the decision-ready outcome. The seam is clean: planning arranges *how*; decision judges *whether and which*, for the Director's approval.

## Role of Decision inside Director Intelligence

```
Director Reasoning (7A–7C)   → approved recommendation
        ▼
Director Planning (7D)        → validated, execution-ready plan(s)
        ▼
Director Decision (7E)        → decision-ready outcome   ← this phase
        │  Director approval
        ▼
Execution (future phase)      → work carried out         (outside this phase)
```

Decision is the last evaluative layer before execution. It takes validated plans, weighs and prioritizes them against organizational objectives and governance, and hands the Director a clear, defensible, decision-ready outcome. The Director approves; execution — a later phase — follows.

## Why Decision is separate from Reasoning, Planning, and Execution

- **Separate from Reasoning.** Reasoning forms judgment about *what to do*; decision evaluates *validated plans* to reach a final, governance-aligned outcome. Reasoning works with options; decision works with vetted plans and the governance context around committing to them.
- **Separate from Planning.** Planning builds a sound plan; decision judges whether — and which — plan to commit to. A plan being sound is not the same as it being the right thing to do now; decision answers the second question.
- **Separate from Execution.** Decision produces a decision-ready outcome; execution runs the approved plan. Keeping decision execution-free is what makes evaluating freely safe — nothing is committed until the Director approves. If decision could execute, it would hold authority it was never granted.
- **The gates bracket it.** Decision sits between planning's validated output and the Director's execution approval. It prepares the decision; the Director makes it.

## Documents

| Document | Topic |
|---|---|
| [01 — Decision Principles](01-decision-principles.md) | The principles every decision outcome must obey |
| [02 — Option Evaluation](02-option-evaluation.md) | Evaluating validated plan alternatives objectively |
| [03 — Prioritization](03-prioritization.md) | Ranking by organizational objectives |
| [04 — Risk Balancing](04-risk-balancing.md) | Weighing opportunity against risk |
| [05 — Governance Alignment](05-governance-alignment.md) | Conformance to policy, permission, and obligation |
| [06 — Decision Validation](06-decision-validation.md) | Checking the outcome is sound before it is offered |
| [07 — Future Evolution](07-future-evolution.md) | How decision-making deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Decision must always do

- **Consume validated plans** — decisions are made over vetted plans ([Phase 7D](../director-planning/README.md)), never raw ideas.
- **Evaluate alternatives objectively** — fairly, on the evidence, no option pre-favored.
- **Prioritize according to organizational objectives** — the organization's interest, not a local metric.
- **Balance opportunity and risk** — honestly, both sides visible.
- **Preserve Director Authority** — it produces a decision-ready outcome; the Director decides, and committing actions stay gated.
- **Produce decision-ready outcomes** — clear, explainable, defensible.
- **Never execute work** — decision prepares; it does not act.

## Status

Architecture only — the decision architecture, not its implementation. Decision engines, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
