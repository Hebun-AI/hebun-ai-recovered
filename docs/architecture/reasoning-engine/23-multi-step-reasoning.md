# 23 — Multi-Step Reasoning

## Purpose

Multi-Step Reasoning composes multiple inspectable Inference Units while preventing hidden premise creation, confidence inflation, Scope drift, and unreconstructable chains.

## Chain Contract

A Reasoning Chain records chain identity, Objective, Scope, ordered logical dependencies, Units, intermediate findings, evidence and assumption paths, branch points, alternatives, contradictions, confidence propagation, validation checkpoints, and terminal Results.

Ordering expresses logical dependency, not Runtime execution.

## Branching and Convergence

Branches preserve competing hypotheses or interpretations. Convergence is permitted only when the combined Result cites every material branch and retains unresolved divergence. A failed Unit invalidates only dependent branches when separability is demonstrated.

## Rules

- **MULTISTEP-001:** Every step must have explicit inputs, transformation, outputs, and Trace position.
- **MULTISTEP-002:** Intermediate findings must remain derived and must not silently become evidence.
- **MULTISTEP-003:** Scope, authority, Tenant, classification, and package identity must remain constant or explicitly narrowed.
- **MULTISTEP-004:** Confidence and limitations must propagate through every dependency.
- **MULTISTEP-005:** Failed branches and contradictions must not be hidden at convergence.
- **MULTISTEP-006:** Every terminal Result must be reconstructable step by step.
- **MULTISTEP-007:** Chain length or complexity must not justify omitted reasoning.

## Enterprise Example

An impact chain follows capability dependency, organizational ownership, and an execution boundary. Each relation is tested independently; uncertainty in ownership limits only dependent impacts and remains visible in the final structured Result.

## Boundaries

No planner, chain-of-thought capture, autonomous loop, workflow engine, task graph, or execution sequence is defined.
