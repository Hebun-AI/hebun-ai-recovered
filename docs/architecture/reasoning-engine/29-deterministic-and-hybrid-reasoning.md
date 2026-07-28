# 29 — Deterministic and Hybrid Reasoning

## Purpose

This document distinguishes deterministic reasoning from hybrid reasoning while preserving one evidence, Trace, confidence, validation, and boundary contract.

## Deterministic Reasoning

Deterministic reasoning applies explicit premises and versioned rules such that materially equivalent governed inputs produce materially equivalent findings. It is required where canonical constraints, exact relationships, identity, cardinality, lifecycle, or formal applicability determine the outcome.

## Hybrid Reasoning

Hybrid reasoning composes deterministic Units with explicitly uncertainty-bearing Units such as induction, abduction, analogy, or causal assessment. Every Unit retains its class; uncertain output cannot be laundered through a deterministic downstream Unit into certainty.

## Composition Boundary

A Hybrid Chain declares:

- deterministic and uncertainty-bearing Unit identities;
- transition conditions between them;
- premise and Result types;
- confidence and limitation propagation;
- validation controls for each Unit;
- final status no stronger than its critical dependencies.

## Rules

- **HYBRID-001:** Deterministic and uncertainty-bearing Units must remain explicitly typed.
- **HYBRID-002:** Equivalent deterministic inputs and rule versions should yield materially equivalent findings.
- **HYBRID-003:** A deterministic Unit must not erase upstream uncertainty.
- **HYBRID-004:** Hybrid composition must preserve evidence, Assumptions, alternatives, and confidence per Unit.
- **HYBRID-005:** Non-deterministic variation must be bounded, visible, and independently validated.
- **HYBRID-006:** Hybrid reasoning must not imply model, LLM, tool, agent, or implementation selection.
- **HYBRID-007:** A hybrid Result remains structured reasoning, not recommendation or decision.

## Enterprise Example

Abduction produces two possible explanations; a deterministic constraint test then rejects one as incompatible with an applicable rule. The remaining explanation is still a Hypothesis, not proven truth.

## Boundaries

No model routing, ensemble, rules engine, solver, orchestration, prompt, or Runtime architecture is selected.
