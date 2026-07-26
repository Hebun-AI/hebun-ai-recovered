# 03 — Execution Boundaries

## Purpose

Execution Boundaries define **what execution does not do**. Execution is the layer that acts in the world, which makes its boundaries the most consequential in the architecture: everything execution is *not* allowed to do is what keeps the acting layer from exceeding what was approved. This document draws those lines explicitly.

## Architectural role

Execution Boundaries make the [execution principles](01-execution-principles.md) concrete as prohibitions. They define the wall between execution and the Phase 7 domains — reasoning, planning, decision, verification, governance — so that execution performs without ever reaching back into their responsibilities. The boundaries are what let execution be trusted with real action.

## Execution does NOT

### Reason
Execution forms no judgment. When the world differs from what the plan assumed, execution does not reason about what that means — it reports. Reasoning is the [reasoning domain's](../director-reasoning/README.md) job.

### Plan
Execution designs nothing. It carries out the task graph the plan gave it; it does not add, reorder, or invent tasks. Planning is the [planning domain's](../director-planning/README.md) job.

### Redesign the plan
Even when a plan proves flawed or infeasible in execution, execution does not fix it. It reports the problem and stops or defers; re-planning happens on a new pass through the planning domain, under the Director's authority.

### Decide
Execution chooses nothing. Where the plan leaves a choice, execution does not resolve it with its own judgment — it reports the gap. Deciding is the [decision domain's](../director-decision/README.md) job.

### Verify
Execution does not judge whether the plan was sound — verification already did that upstream ([Phase 7F](../director-verification/README.md)). Execution assumes a verified plan and performs it; it does not re-check the reasoning.

### Govern
Execution makes no governance judgment. It honors the committing-action markers and the Director's approval, but it does not evaluate policy or permission itself — governance was aligned and enforced upstream ([decision](../director-decision/05-governance-alignment.md), [orchestration](../director-orchestration/05-governance-control.md)).

### Bypass Director Authority
Execution never manufactures a committing action the Director did not approve, and never proceeds past the Director's control ([Director Authority](../director-reasoning/05-director-authority.md)). It acts only within the approval it was handed.

## What execution does with the unexpected

The defining question for the acting layer: *what does execution do when the plan does not fit reality?* The answer is the boundary in action — **execution reports and defers; it never improvises across a domain boundary.**

- A missing detail → report a gap, do not invent it (that would be planning).
- An unforeseen choice → report it, do not resolve it (that would be deciding).
- A flawed plan → report it and halt, do not fix it (that would be re-planning).
- A new committing action → refuse it, do not perform it (that would bypass authority).

Execution's response to the unexpected is always to surface it to the domains and the Director that own that kind of judgment — never to cross the boundary and judge for itself.

## Boundaries of this document

- It **defines prohibitions, not methods** — what execution must not do, not how execution is performed.
- It **describes no runtime or agent** — execution machinery is a later phase.

## Future direction

Future execution engines will act more capably within these boundaries — handling more of the world's variability by *reporting* it richly, never by *deciding* it. The boundaries are fixed: execution performs, reports, and defers; it never reasons, plans, decides, verifies, governs, or bypasses authority. Capability grows within the wall; the wall does not move.
