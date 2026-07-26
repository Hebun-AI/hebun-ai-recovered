# 02 — Problem Decomposition

## Purpose

Problem Decomposition is the mechanism by which reasoning **breaks a large or complex problem into tractable parts**. Some situations are too big to reason about whole; decomposition splits them into sub-problems that can each be reasoned through and then recombined into a coherent judgment. It is how reasoning makes the intractable tractable without losing sight of the whole.

## Architectural role

Decomposition serves the lifecycle's understanding, goal, and option stages ([Phase 7B](../director-reasoning-cognition/README.md)). A complex Observation is decomposed into parts that can each be understood; a compound goal into sub-goals; a broad option space into manageable regions. Critically, decomposition is paired with **recomposition** — the parts are reasoned separately but the recommendation reflects the whole, honoring the Phase 7A principle **organization before optimization** ([first principles](../director-reasoning/02-first-principles.md)). Decomposing must never let a part be optimized against the whole.

It is a **structuring mechanism**: it organizes the problem so other mechanisms (hypothesis, evidence, trade-off) can operate on pieces of a size they can handle.

## Inputs

- The **problem** as understood and contextualized — the whole to be broken down.
- The **goal**, so decomposition splits along lines that serve the objective, not arbitrary ones.
- The **relationship graph**, so the parts and their interdependencies are seen ([relationship graph](../relationship-graph/README.md)).

## Outputs

- A **set of sub-problems** — tractable parts, with their interdependencies noted.
- A **recomposition frame** — how the parts' conclusions combine back into a judgment about the whole.

## Boundaries

- Decomposition **must preserve the whole** — parts are a working convenience, never a licence to lose the organizational view. Recomposition is mandatory, not optional.
- It **defines no method** — this document establishes that decomposition exists and its role, not any algorithm for splitting a problem.
- It **produces no action** — structuring a problem is reasoning, fully advisory.

## Future direction

Future engines may decompose more skilfully — finding better seams, tracking interdependencies more precisely, recombining more faithfully. The mechanism's obligation is fixed: break down to make tractable, recompose to preserve the whole. Sophistication grows; the whole-preserving obligation does not relax.
