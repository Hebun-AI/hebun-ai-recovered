# 14 — Permission Engine

**Priority:** High
**Status:** Planned

## Purpose

Role-based authorization. Decides whether a given actor may perform a given action, across every actor class the platform serves.

## Supported actors

- Human Users
- AI Agents
- Departments
- External Users

## Architectural notes

An authorization decision layer. It maps actors to roles and roles to permitted actions, then answers permit/deny for a request. It enforces; it does not act.

Actors resolve through the organizational graph and Agent Registry. The engine is consulted at enforcement points before any privileged action. It depends on no capability; capabilities depend on it.

Composes with [13 — Policy Engine](13-policy-engine.md): permission decides *who may act*, policy decides *whether the action itself is allowed*. Both must pass.

## Dependencies

- Organizational Intelligence — actor, role, and department shapes
- [11 — Agent Registry](11-agent-registry.md) — AI-agent identity and ownership
- Composes with [13 — Policy Engine](13-policy-engine.md)

## Promotion criteria

- Role and permission model defined across all four actor classes.
- Decision interface specified — permit/deny, no side effects.
- Enforcement points identified and shared with the Policy Engine.
- Director approval.
