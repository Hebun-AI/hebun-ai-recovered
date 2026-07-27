# 19 — Contradiction and Conflict Handling

## Purpose

This document defines how Phase 13 detects, represents, preserves, classifies, escalates, and packages conflicting evidence without deciding which source is true.

## Conflict Record

A Conflict Record contains conflict identity, affected claims and artifacts, source identities, citation anchors, applicable Scope and time, authority classes, conflict type, severity, detection basis, deterministic rule when applicable, validation status, limitations, escalation status, and package impact.

## Conflict Classes

- **Direct Contradiction** — mutually incompatible claims in the same applicable context.
- **Temporal Conflict** — claims differ because applicable times or versions differ.
- **Scope Conflict** — claims apply to overlapping or ambiguously bounded scopes.
- **Authority Conflict** — applicable sources disagree at the same or unresolved authority level.
- **Definition Conflict** — the same term carries materially different definitions.
- **Metadata Conflict** — source or processing metadata disagree.
- **Apparent Conflict** — initial disagreement is explainable by explicit scope, time, or terminology evidence.
- **Unresolved Conflict** — evidence does not permit deterministic classification or resolution.

## Handling

Detection creates a Conflict Record and preserves every source independently. Classification may explain a conflict but must not suppress it. A deterministic canonical rule may establish precedence only within its explicit scope; the losing evidence remains visible with the rule and rationale. Reserved or ambiguous judgments are escalated.

## Packaging

The Processing Output Package includes open and deterministically handled conflicts, affected artifacts, impact on quality, limitations on downstream use, and required escalation. “No conflict detected” is a bounded finding, not proof of consistency.

## Rules

- **CONFLICT-001:** Contradictory evidence must never be silently merged, discarded, averaged, or normalized away.
- **CONFLICT-002:** A Conflict Record must retain all competing evidence and citation anchors.
- **CONFLICT-003:** Processing must not decide truth unless an explicit deterministic canonical rule applies.
- **CONFLICT-004:** Authority level alone must not resolve conflicts outside declared precedence rules.
- **CONFLICT-005:** Conflict status and downstream impact must propagate to every affected artifact and package.
- **CONFLICT-006:** Unresolved conflict must cause limitation, quarantine, rejection, or escalation according to quality policy.

## Boundaries

Conflict handling supplies evidence and limitations to future consumers. It does not reason, recommend, approve, adjudicate, or execute remediation.
