# 24 — Escalation Model

## Purpose

The Escalation Model classifies required external review without initiating notifications, workflows, decisions, or actions.

## Review States

- `REVIEW_REQUIRED` — general reserved governance judgment.
- `COMPLIANCE_REVIEW` — specialized compliance basis or interpretation.
- `LEGAL_REVIEW` — legal authority, jurisdiction, or interpretation.
- `EXECUTIVE_REVIEW` — executive-reserved organizational judgment.
- `INSUFFICIENT_AUTHORITY` — authority evidence must be supplied or resolved externally.
- `INSUFFICIENT_POLICY` — policy basis must be supplied or resolved externally.
- `DEFERRED` — an explicit dependency must change before re-evaluation.

## Escalation Record

The record contains trigger, Scope, declared use, constraints, findings, evidence references, risks, uncertainty, prohibited actions, exact review question, required authority class, and Trace. It proposes no preferred answer.

## Rules

- **GESC-001:** Every review state must have a traceable trigger and exact unresolved question.
- **GESC-002:** Escalation does not create authority or start a review workflow.
- **GESC-003:** Urgency, confidence, or user pressure cannot reduce required review.
- **GESC-004:** Specialized reviews must remain distinct.
- **GESC-005:** Review-state changes require new qualified basis and preserved history.
- **GESC-006:** Escalation must not recommend, decide, notify, enforce, or execute.

## Boundaries

No alert, queue, notification, SLA, workflow, case management, or incident response is defined.
