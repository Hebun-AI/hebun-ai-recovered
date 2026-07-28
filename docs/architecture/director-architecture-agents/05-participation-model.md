# 05 — Agent Participation Model

## Purpose

The Participation Model defines how an Agent may contribute without becoming an authority, owner, decision-maker, or executor.

## Participation Envelope

Every participation instance must declare:

- participating role archetype;
- purpose and bounded Scope;
- Tenant and organizational context;
- admitted canonical references;
- permitted contribution modes;
- prohibited outcomes;
- required provenance and uncertainty;
- escalation recipient;
- human-review condition;
- participation-end condition.

This envelope is an architectural obligation, not a Runtime session, task, workflow, or state record.

## Permitted Contribution Modes

- **Analyze:** expose patterns, implications, alternatives, assumptions, and uncertainty.
- **Advise:** present non-binding considerations within declared Scope.
- **Review:** compare an artifact with canonical criteria.
- **Validate:** report conformance findings without correcting or authorizing.
- **Research:** assemble attributable information without making it canonical.
- **Document:** prepare traceable documentation material without approving publication.
- **Escalate:** transfer an unresolved authority question to the proper human boundary.
- **Conclude participation:** stop when Scope, evidence, authority, or relevance ends.

## Rules

- **P17-PARTICIPATION-001:** Participation must be explicitly scoped and attributable.
- **P17-PARTICIPATION-002:** Contribution must remain distinguishable from recommendation, decision, approval, and authorization.
- **P17-PARTICIPATION-003:** Participation may end without producing a preferred outcome.
- **P17-PARTICIPATION-004:** Missing evidence or ambiguity must remain visible.
- **P17-PARTICIPATION-005:** Participation must not create a task for another Agent.
- **P17-PARTICIPATION-006:** A human or Director response is not part of Agent participation unless separately admitted.
- **P17-PARTICIPATION-007:** Evidence, context, findings, and escalation must remain isolated to the admitted Tenant and organizational boundary.

## Enterprise Example

An Architecture Validator may report that two rules conflict and identify their sources. It cannot choose the winning rule, repair either document, or instruct another participant to act.
