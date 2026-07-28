# 33 — Governance Threat Model

## Purpose

This catalogue defines minimum threats that Governance Intelligence architecture must fail closed against.

## Threat Catalogue

| Threat | Required Behavior |
|---|---|
| Reasoning package substitution | reject hash, identity, version, or Tenant mismatch |
| Policy poisoning | isolate unqualified or altered policy reference |
| Authority inflation | reject authority inferred from role, ownership, confidence, or urgency |
| Permission laundering | require explicit permission evidence |
| Approval laundering | preserve separate approval requirement |
| Ambiguity suppression | block permissive Outcome when material ambiguity is hidden |
| Classification downgrade | apply stricter valid classification and review conflict |
| Cross-Tenant leakage | deny or withhold without disclosure |
| Redaction bypass | deny when required external redaction is unverified |
| Exception overreach | reject expired, broader, or cross-Scope exception |
| Trace tampering | block release when reconstruction fails |
| Outcome-as-command | preserve non-executable semantics |

## Rules

- **GTHREAT-001:** Every threat requires trigger, affected asset, detection basis, safe Outcome, review need, and residual risk.
- **GTHREAT-002:** Threat handling must preserve input evidence and Trace.
- **GTHREAT-003:** Critical authority, Tenant, privacy, or integrity threat cannot yield `ALLOW`.
- **GTHREAT-004:** Recovery or review must not erase the original threat finding.
- **GTHREAT-005:** Threat coverage must be revalidated when constraints or Outcome semantics change.

## Boundaries

This is architecture validation input, not threat-detection code, incident response, or security operations.
