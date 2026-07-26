# 01 — Planning Principles

## Purpose

The Planning Principles are the constitution of Director Planning — the commitments every plan must obey to be sound and safe. Where the reasoning first principles ([Phase 7A](../director-reasoning/02-first-principles.md)) govern how judgment is formed, these govern how approved judgment is turned into a plan. Any plan that violates one of these is not a valid Director plan.

## Architectural role

These principles sit above the specific planning topics (decomposition, task graph, resources, dependencies, validation) and constrain all of them. Every subsequent planning document inherits these principles first. They are what keep planning faithful to reasoning, safe to build, and subordinate to the Director.

## The principles

### 1. Plans derive from approved reasoning
A plan is built from an **approved recommendation**, never invented on its own. Planning does not decide *what* to do — that is reasoning's output and the Director's decision. Planning arranges *how* to do what was already decided. A plan with no approved recommendation behind it is illegitimate.

### 2. Planning prepares; it never executes
A plan is a description of work, not the work. Producing, refining, and validating a plan changes nothing in the world. Execution is a separate phase under the Director's authority ([README](README.md)). Planning that acted would have crossed out of planning.

### 3. Every committing action stays gated
A plan may contain committing or irreversible actions, but the plan being *built* never triggers them. Each such action, when the plan runs, still requires the Director's explicit approval to execute ([Director Authority](../director-reasoning/05-director-authority.md)). Planning marks these actions; it never pre-authorizes them.

### 4. Plans respect constraints
Every plan honors the constraints reasoning identified — governance, workspace scope, resources, obligations ([constraint analysis](../director-reasoning-cognition/04-constraint-analysis.md)). A plan that ignores a constraint to look tidier is unsound. Constraints bound the plan as they bounded the reasoning.

### 5. Plans preserve the whole
Decomposing a goal into tasks must never let a task be arranged against the organization's interest ([organization before optimization](../director-reasoning/02-first-principles.md)). The plan as a whole must serve the approved goal; the parts serve the whole.

### 6. Plans are explainable
A plan can be accounted for — why these tasks, in this order, with these resources, to serve the approved goal. An unexplainable plan is one the Director cannot own or approve for execution. Explainability carries from reasoning into planning.

### 7. Plans are validated before offered
No plan reaches the Director as execution-ready until it has been checked for soundness ([plan validation](06-plan-validation.md)). Offering an unvalidated plan for approval would ask the Director to authorize work that may be broken.

## Inputs

- The **approved recommendation** from reasoning — the decision the plan realizes.
- The **constraints and context** carried from reasoning.

## Outputs

- A **principled frame** every planning activity operates within — the standard each plan is held to.

## Boundaries

- These principles **define no method** — they state what plans must obey, not how planning is performed.
- They **authorize no action** — a principled plan is still only a plan, awaiting the Director's approval to execute.

## Future direction

Future planning engines may satisfy these principles more thoroughly — building sounder, clearer, better-validated plans. The principles themselves are fixed: derived from approved reasoning, non-executing, gated, constraint-respecting, whole-preserving, explainable, validated. Capability grows; the constitution holds.
