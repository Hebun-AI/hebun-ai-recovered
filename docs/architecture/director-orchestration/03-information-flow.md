# 03 — Information Flow

## Purpose

Information Flow is where orchestration **passes each component's output to the next**, intact and complete. A workflow is only as good as the information moving through it: planning needs reasoning's approved recommendation; decision needs planning's validated plans; verification needs the whole chain. Information flow is the discipline of routing these outputs faithfully, so each component receives exactly what it needs to do its job.

## Architectural role

Information Flow is the connective tissue between the components that [Phase Coordination](02-phase-coordination.md) sequences. It defines *what* moves between components and ensures it moves **without distortion**. It carries the provenance discipline of the whole platform ([Phase 6](../memory/README.md)) into the workflow: what one component concluded is what the next receives, traceably, with nothing altered in transit.

## Inputs

- The **output of each completed component** — recommendation, plan, decision outcome, verification findings.
- The **input requirements of the next component** — what it needs to proceed.

## Outputs

- **Delivered inputs** — each component receives the upstream outputs it requires, intact.
- A **flow record** — what was passed, from which component to which, when — for end-to-end traceability.
- Preserved **provenance and markers** — committing-action flags, confidence signals, and evidence links carried forward unaltered.

## Boundaries

- Information flows **faithfully** — orchestration routes outputs; it never alters, filters to mislead, summarizes away, or fabricates them ([orchestration principles](01-orchestration-principles.md)). What a component produced is what the next receives.
- It **carries; it does not interpret** — orchestration does not form its own view of the information it moves. Interpretation is each component's job.
- It **preserves markers** — committing-action and gate markers travel with the information, never stripped, so governance can be enforced downstream.
- It **produces no action** and **defines no method** — this document establishes that information flow exists and its role, not any transport mechanism.

## Future direction

Future orchestration engines may manage information flow more richly — carrying more context, tracking finer provenance, routing to parallel components. The discipline is fixed: faithful, unaltered, traceable transport that carries markers intact. Richness grows; the fidelity holds.
