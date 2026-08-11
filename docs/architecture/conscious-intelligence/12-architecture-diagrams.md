# 12 — Architecture Diagrams

## Logical Context Architecture

```mermaid
flowchart TD
    H["Human / Authorized Organization"] --> C["Consent and Control"]
    C --> M["Governed Memory"]
    M --> T["Timeline and Continuity"]
    T --> R["Reflection Domains"]
    R --> I["Bounded Intelligence"]
    I --> O["Explainable Observations and Options"]
    O --> H
    K["Heby Constitution — canonical dependency pending"] -. governs .-> C
    S["Security Sentinel — canonical dependency pending"] -. constrains .-> M
```

The return to the human represents review and judgment, not autonomous feedback optimization.

## Domain Architecture

```mermaid
flowchart LR
    MI["Memory Integrity"] --> LT["Life Timeline"]
    MI --> CE["Continuity Engine"]
    LT --> DI["Decision Intelligence"]
    CE --> VA["Value Alignment"]
    CE --> PG["Personal Growth"]
    CE --> PE["Purpose Engine"]
    CE --> RI["Relationship Intelligence"]
    CE --> LI["Legacy Intelligence"]
    VA --> HF["Human Flourishing"]
    PG --> HF
    PE --> HF
    DI --> HF
```

Arrows mean governed evidence supply or analytical dependency, not execution control.

## Trust Boundary

```mermaid
flowchart TD
    SRC["Source and Evidence"] --> IG["Memory Integrity Gate"]
    UA["User Approval"] --> IG
    PR["Privacy Rules"] --> IG
    SEC["Security Rules"] --> IG
    IG -->|Pass| PM["Eligible Governed Memory"]
    IG -->|Fail| Q["Quarantine / Rejection / Review"]
    PM --> CP["Continuity Package"]
    CP --> BA["Bounded Analysis"]
    BA --> HR["Human Review"]
```

## Decision Authority

```mermaid
flowchart LR
    E["Evidence"] --> A["Analysis"]
    A --> REC["Recommendation"]
    REC --> HD["Human Decision"]
    HD --> ACT["Authorized Action"]
    A -. cannot bypass .-> ACT
```

## Diagram Invariants

- Memory remains distinct from Runtime state.
- Analysis cannot directly reach action.
- Constitution and security controls govern admission and use.
- User approval is required for personal permanent memory.
- Diagrams are logical architecture, not deployment topology or workflow implementation.

