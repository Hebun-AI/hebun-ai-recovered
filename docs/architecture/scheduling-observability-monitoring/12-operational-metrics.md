# 12 — Operational Metrics

## Purpose

Define Metric as a bounded operational measurement with provenance and interpretation limits.

## Metric Identity

A Metric represents a measurement of one declared operational property for a bounded subject, method, unit, aggregation, population, and time context.

Metric is not truth, objective, policy, condition, Alert, State, Event, health conclusion, decision, authority, or business outcome.

## Required Context

Every Metric preserves:

- measured subject and property;
- unit and semantic definition;
- measurement and aggregation basis;
- effective time and observation window;
- provenance and source authority;
- quality, completeness, uncertainty, and known bias;
- Tenant, classification, Scope, and version;
- relationships to evidence, conditions, and explanations.

## Operational Evidence

A Metric may contribute to operational evidence when its context is valid. Measurement alone does not explain behavior, establish causality, determine health, create an Alert, or support a decision without appropriate interpretation.

## Rules

- **P23-METRIC-001:** Metric represents measurement but never represents truth.
- **P23-METRIC-002:** Every Metric must preserve unit, method, time, and provenance.
- **P23-METRIC-003:** Aggregation must preserve uncertainty and population boundaries.
- **P23-METRIC-004:** Metric thresholds must not silently become Governance policy.
- **P23-METRIC-005:** Operational evidence must remain distinct from decision.
- **P23-METRIC-006:** Metric meaning must remain independent of collection technology.

## Enterprise Example

A latency Metric measures a declared property during a window. It does not prove poor customer experience or authorize scaling.
