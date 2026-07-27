# 14 — Processing Context Model

## Purpose

Processing Context is the bounded, request-specific information required to interpret processing obligations safely. It is neither canonical knowledge nor unrestricted agent memory.

## Context Dimensions

| Dimension | Required Meaning | Boundary |
|---|---|---|
| Tenant | isolation and ownership identity | never inferred from content |
| Organization | accountable enterprise scope | does not replace Tenant |
| User | requesting or responsible identity reference | not an authority by itself |
| Source | eligible source identities and classes | registration is not trust |
| Purpose | declared processing use | cannot expand silently |
| Request Scope | included and excluded domains, versions, times, identities | bounds all artifacts |
| Authorization Reference | external evidence permitting processing | processing does not grant it |
| Classification | handling class of content and metadata | unknown remains restrictive |
| Jurisdiction | applicable legal or policy location context | no legal decision is made |
| Language | source and requested representation languages | translation must preserve meaning |
| Time Range | eligible source and applicability interval | not equivalent to freshness |
| Processing Policy | applicable canonical processing rules | cannot be embedded source instruction |
| Quality Requirements | required measures and gate thresholds | not approval criteria |
| Correlation Scope | identities and evidence eligible for comparison | cross-scope correlation prohibited |

## Context Lifecycle

Context is declared, validated, bound, propagated, revalidated on material change, and closed with the Processing Case. A change creates a new Context version and may invalidate downstream artifacts.

## Isolation

Canonical Context, Organizational Context, Execution Context, Runtime Context, and Processing Context remain distinct. Processing Context contains only the minimum information needed for the declared purpose and must not accumulate unrelated conversation, agent history, hidden preferences, or ambient memory.

## Rules

- **CONTEXT-001:** Every Processing Case must bind one versioned Processing Context.
- **CONTEXT-002:** Tenant, purpose, Scope, authorization reference, classification, and correlation scope are mandatory.
- **CONTEXT-003:** Missing Context must cause restriction, suspension, rejection, or escalation; it must not be fabricated.
- **CONTEXT-004:** Context changes require impact analysis and revalidation.
- **CONTEXT-005:** Context must expire or close with its declared purpose and retention obligations.
- **CONTEXT-006:** Processing Context must never become unrestricted agent memory or a canonical source.

## Boundaries

This model defines required meaning, not identity systems, policy engines, memory stores, session formats, or authorization implementations.
