# 05 — Canonical Collaboration Matrix

## Purpose

The Collaboration Matrix describes constitutional eligibility, contribution, visibility, prohibition, and isolation across the nine domains. It is descriptive only and grants no access, authority, ownership, communication, task, or execution right.

## Matrix Legend

- **C** — may contribute attributable intelligence to analysis involving the row domain.
- **I** — row domain may consume the source domain's intelligence when separately authorized.
- **D** — material use must remain visible to the Director.
- **G** — material use must remain visible to Governance.
- **X** — relationship is isolated unless separately governed conditions are satisfied.
- **P** — command, override, assignment, redefinition, authority transfer, unauthorized access, and execution are prohibited in every cell.

Multiple markers may apply. `C/I` describes analytical relevance, not a transfer mechanism.

## Domain-to-Domain Matrix

| Consumer / Contributor | Executive | Finance | HR | Sales | Marketing | Legal & Compliance | Operations | Customer Success | Platform & Technology |
|---|---|---|---|---|---|---|---|---|---|
| Executive | C/I/D/P | C/I/D/P | C/I/D/G/X/P | C/I/D/P | C/I/D/P | C/I/D/G/X/P | C/I/D/P | C/I/D/G/X/P | C/I/D/G/X/P |
| Finance | C/I/D/P | C/I/P | C/I/G/X/P | C/I/P | C/I/P | C/I/G/X/P | C/I/P | C/I/G/X/P | C/I/G/X/P |
| Human Resources | C/I/D/P | C/I/G/X/P | C/I/G/X/P | X/P | X/P | C/I/G/X/P | C/I/G/X/P | X/P | C/I/G/X/P |
| Sales | C/I/D/P | C/I/P | X/P | C/I/P | C/I/G/X/P | C/I/G/X/P | C/I/P | C/I/G/X/P | C/I/G/X/P |
| Marketing | C/I/D/P | C/I/P | X/P | C/I/G/X/P | C/I/P | C/I/G/X/P | C/I/P | C/I/G/X/P | C/I/G/X/P |
| Legal & Compliance | C/I/D/G/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P |
| Operations | C/I/D/P | C/I/P | C/I/G/X/P | C/I/P | C/I/P | C/I/G/X/P | C/I/P | C/I/G/X/P | C/I/G/X/P |
| Customer Success | C/I/D/P | C/I/P | X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/P | C/I/G/X/P | C/I/G/X/P |
| Platform & Technology | C/I/D/G/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/X/P | C/I/G/P |

## Interpretation

- Same-domain cells preserve the domain's own Phase 18 constitution; they do not create self-approval.
- `X` marks information that is commonly sensitive, purpose-limited, privileged, personal, security-relevant, or Tenant-bound. It does not mean access is available.
- Executive relationships are generally Director-visible because enterprise synthesis can affect strategy, priority, or ownership interpretation.
- Legal & Compliance and Platform relationships are generally Governance-visible because legal, privacy, classification, security, permission, or architecture restrictions may apply.
- Every cell includes `P`: no domain relationship permits command, override, assignment, redefinition, authority transfer, execution, or unauthorized access.

## Relationship Isolation Register

The following remain isolated by default:

- individual workforce and protected HR information;
- privileged, confidential, or jurisdiction-restricted legal information;
- personal customer and audience information beyond authorized purpose;
- credentials, security-sensitive platform context, and restricted architecture information;
- cross-Tenant information;
- information prohibited by classification, consent, contract, policy, or Governance Outcome.

## Rules

- **P19-MATRIX-001:** Matrix markers describe constitutional eligibility, not transport or access.
- **P19-MATRIX-002:** `C` and `I` require separate purpose, Scope, source, permission, classification, Tenant, and Governance validation.
- **P19-MATRIX-003:** `D` and `G` require visibility, not approval.
- **P19-MATRIX-004:** `X` defaults to isolation and must never be interpreted as conditional automatic access.
- **P19-MATRIX-005:** `P` applies universally and cannot be overridden by another marker.
- **P19-MATRIX-006:** Matrix composition must preserve every Phase 18 domain prohibition.

## Implementation Exclusion

The matrix defines no message transport, API, event, queue, schema, workflow transition, storage, access-control implementation, routing, orchestration, or Runtime behavior.
