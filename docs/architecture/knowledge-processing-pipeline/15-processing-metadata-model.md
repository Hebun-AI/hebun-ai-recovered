# 15 — Processing Metadata Model

## Purpose

Processing Metadata makes every artifact and handoff identifiable, traceable, governable, and independently validatable without treating metadata as proof of content truth.

## Mandatory Metadata

| Group | Fields |
|---|---|
| Identity | artifact or handoff identifier, type, version, tenant |
| Source | source identity, source location reference, source version, citation anchors |
| Time | source time when known, registration time, production time, validation time |
| Production | producer identity, processing stage, rule version, transformation history |
| Integrity | content hash, metadata hash or equivalent integrity reference |
| Handling | classification, jurisdiction when applicable, retention class |
| Assurance | confidence dimensions, validation status, limitations |
| Provenance | parent identities, lineage chain, original-source reference |
| Lifecycle | current status, supersession or revocation reference |
| Correlation | Processing Case, Request, stage, handoff, and audit correlation identifiers |

Optional metadata may include language, format, declared subject, quality measures, approved disclosure class, and human-review reference. Optional absence must remain explicit when it affects use.

## Metadata Propagation

Inherited metadata is copied by reference or value with its origin recorded. Derived metadata identifies the producing stage and rule. Conflicting metadata is preserved as competing assertions; poisoned or unsupported metadata is quarantined from authoritative use.

## Validation

Metadata validation covers presence, syntax, identity uniqueness, source consistency, classification compatibility, tenant consistency, temporal coherence, hash integrity, lineage continuity, and supersession validity.

## Rules

- **METADATA-001:** Every artifact and handoff must carry the mandatory metadata applicable to its type.
- **METADATA-002:** Metadata origin must distinguish source-declared, registered, inherited, derived, and validated values.
- **METADATA-003:** Metadata must not establish truth, authority, permission, or identity solely by assertion.
- **METADATA-004:** Tenant and classification metadata must propagate without weakening.
- **METADATA-005:** Transformation history must be append-only for an immutable artifact version.
- **METADATA-006:** Sensitive metadata disclosure must follow minimization and handling constraints.
- **METADATA-007:** A metadata integrity failure must block affected trust-dependent use.

## Boundaries

No physical schema, serialization syntax, header format, database model, or API payload is defined.
