# 06 — Hebun Guide

**Priority:** Medium
**Status:** Planned

## Purpose

A public AI assistant. The front door — it explains Hebun AI to visitors and guides them.

## Responsibilities

- Explain Hebun AI
- Explain Organizational Intelligence
- Answer public questions
- Guide visitors

## Limitations

- No consulting.
- No deep architecture.
- No enterprise reasoning.

Escalates to membership or sales when a visitor's need crosses beyond public information.

## Architectural notes

Deliberately shallow. The Guide is a public, low-trust surface — it must not reach into enterprise reasoning, tenant data, or the Director core.

Its knowledge is public-facing documentation, not the organizational graph. The line between "explain the product" and "consult on a customer" is the escalation boundary, and it is hard.

Where a real need appears, the Guide hands off to membership or sales. It routes; it does not solve.

## Dependencies

- [02 — AI Provider Manager](02-ai-provider-manager.md) — model access
- Public knowledge base — its only knowledge source
- Escalation path to sales / membership

## Promotion criteria

- Escalation boundary defined and enforced (no enterprise reasoning leakage).
- Public knowledge source separated from tenant data.
- Trust tier documented — public surface, no privileged access.
- Director approval.
