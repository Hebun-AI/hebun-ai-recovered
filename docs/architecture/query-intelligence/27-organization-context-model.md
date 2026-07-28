# 27 — Organization Context Model

## Purpose

The Organization Context Model identifies the minimum accountable enterprise framing needed to qualify a Query without assigning authority, ownership, or work.

## Organization Context

| Element | Meaning | Boundary |
|---|---|---|
| Organization Identity | canonical enterprise reference | not Tenant by implication |
| Organizational Unit | department, team, or governed unit reference | label does not prove ownership |
| Accountable Seat Reference | canonical accountability reference when applicable | Query Intelligence does not exercise it |
| Domain Relationship | organization-to-domain or capability reference | does not route work |
| Jurisdiction | applicable organizational/legal location reference | no legal interpretation |
| Lifecycle and Version | applicable organization-model state | current is not automatically governing |
| Tenant | isolation and ownership boundary | mandatory and distinct |

## Qualification

Every reference records source, provenance, Scope, Tenant, lifecycle, version, ambiguity, authority limitation, and compatibility with the Processing Output Package. Conflicting organization references remain explicit.

## Rules

- **ORGCTX-001:** Organization Context must derive from explicit or canonical references.
- **ORGCTX-002:** Organization, domain, capability, Tenant, and accountable seat must remain distinct.
- **ORGCTX-003:** Organizational ownership must not be inferred from Query wording or labels.
- **ORGCTX-004:** Missing or conflicting organization Context must constrain qualification.
- **ORGCTX-005:** Accountable-seat reference does not grant authority or assign work.
- **ORGCTX-006:** Organization Context must not become evidence, governance, routing, or execution.

## Enterprise Example

A Query names “Operations” but the canonical organization contains two units with that label across Tenants. Organization Context remains Ambiguous and cannot select one by recency.

## Boundaries

No org chart implementation, identity system, directory integration, authorization, or task routing is defined.
