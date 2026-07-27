# 48 — Anti-Patterns and Modeling Mistakes

## Purpose

Record modeling errors that violate Phase 10 invariants. These examples are detection guidance, not new architecture and not a catalog of real enterprise entities.

## 1. Department-as-Capability

- **Yanlış yaklaşım:** Organizational unit is modeled as the ability it owns.
- **Neden yanlış:** Who and what are different architectural identities.
- **Mimari etkisi:** Reorganization mutates the Capability model.
- **Doğru ilke:** Department accountability attaches to an independent Capability.
- **Tespit işareti:** Capability name or definition contains an org unit.

## 2. Process-as-Capability

- **Yanlış yaklaşım:** Procedure or activity sequence is named as a Capability.
- **Neden yanlış:** Process describes how; Capability describes what.
- **Mimari etkisi:** Process optimization becomes false Capability change.
- **Doğru ilke:** Keep ordered work below the realization floor.
- **Tespit işareti:** Definition reads as steps, actions, or workflow.

## 3. Agent-as-Capability

- **Yanlış yaklaşım:** An AI realizer is treated as an enterprise ability.
- **Neden yanlış:** Agent is replaceable; Capability identity is durable.
- **Mimari etkisi:** Agent replacement creates false Capability lifecycle events.
- **Doğru ilke:** Agents realize Capabilities through governed bindings.
- **Tespit işareti:** Capability disappears when an Agent is retired.

## 4. Tool-as-Capability

- **Yanlış yaklaşım:** Product, model, LLM, or tool defines the Capability.
- **Neden yanlış:** Technology is realization detail.
- **Mimari etkisi:** Vendor or tool migration destabilizes business architecture.
- **Doğru ilke:** Capability definitions remain technology-independent.
- **Tespit işareti:** Tool or vendor name appears in Capability identity.

## 5. Runtime-as-Capability

- **Yanlış yaklaşım:** Deployment environment is modeled as the ability.
- **Neden yanlış:** Runtime and Capability have separate identities and lifecycles.
- **Mimari etkisi:** Runtime outage or replacement changes business meaning.
- **Doğru ilke:** Runtime hosts realization; it is not the Capability.
- **Tespit işareti:** Capability lifecycle follows deployment lifecycle.

## 6. Capability Catalog Without Taxonomy

- **Yanlış yaklaşım:** A flat uncontrolled list is created before classification rules and boundaries.
- **Neden yanlış:** Entries lack altitude, single-home placement, and non-overlap guarantees.
- **Mimari etkisi:** Duplicate and ambiguous abilities accumulate.
- **Doğru ilke:** Catalog population must conform to Taxonomy and Meta Model.
- **Tespit işareti:** Capability entries have no Domain, parent, or classification rationale.

## 7. Capability Network as Workflow

- **Yanlış yaklaşım:** Network edges are read as ordered execution steps.
- **Neden yanlış:** Network expresses structural ability reliance.
- **Mimari etkisi:** Business architecture couples to one operational procedure.
- **Doğru ilke:** Network topology and workflow remain separate.
- **Tespit işareti:** Edge labels contain scheduling or temporal order.

## 8. Dependency as Execution Sequence

- **Yanlış yaklaşım:** “A depends on B” is interpreted as “B runs before A.”
- **Neden yanlış:** Structural reliance does not specify runtime order.
- **Mimari etkisi:** Dependency changes with implementation.
- **Doğru ilke:** Execution sequence belongs to Execution Architecture.
- **Tespit işareti:** Dependency graph is used directly as a task graph.

## 9. Health as Single KPI

- **Yanlış yaklaşım:** One metric is declared to be Capability Health.
- **Neden yanlış:** Health is an ability-level, evidence-informed dimension.
- **Mimari etkisi:** Runtime performance becomes incomplete business truth.
- **Doğru ilke:** KPIs may contribute evidence but do not define Health.
- **Tespit işareti:** Health equals one uptime, latency, or output value.

## 10. Maturity as Performance Score

- **Yanlış yaklaşım:** Maturity is reduced to current execution performance.
- **Neden yanlış:** Maturity describes how developed the ability is, not how one run performed.
- **Mimari etkisi:** Health and Maturity collapse into one number.
- **Doğru ilke:** Keep Health, Maturity, and Risk distinct.
- **Tespit işareti:** Maturity changes with each execution result.

## 11. Agent Binding as Authorization

- **Yanlış yaklaşım:** Binding eligibility automatically permits execution.
- **Neden yanlış:** Eligibility and Execution Attachment are separate decisions.
- **Mimari etkisi:** Director authority and least-privilege controls are bypassed.
- **Doğru ilke:** Every active realization requires bounded authorization.
- **Tespit işareti:** Bound Agent can start work without an attachment.

## 12. Director as Runtime Scheduler

- **Yanlış yaklaşım:** Director allocates resources or controls internal Runtime mechanics.
- **Neden yanlış:** Director governs Orchestration, not Runtime operation.
- **Mimari etkisi:** Strategic authority collapses into operational control.
- **Doğru ilke:** Director sets policy, approves binding, and authorizes attachment.
- **Tespit işareti:** Director owns queues, retries, or worker scheduling.

## 13. Capability Identity Coupled to Technology

- **Yanlış yaklaşım:** Identity includes platform, API, provider, or implementation.
- **Neden yanlış:** Capability must survive technology replacement.
- **Mimari etkisi:** Technical migration becomes false semantic redesign.
- **Doğru ilke:** Identity states one durable business ability.
- **Tespit işareti:** Technology swap forces identity rename.

## 14. Capability Change Caused by Agent Replacement

- **Yanlış yaklaşım:** Replacing an Agent changes the Capability definition or lifecycle.
- **Neden yanlış:** Agent replacement changes realization only.
- **Mimari etkisi:** Historical continuity and ownership are lost.
- **Doğru ilke:** Revoke or replace bindings while Capability persists.
- **Tespit işareti:** New Agent creates a new Capability record.

## 15. Unbounded Capability

- **Yanlış yaklaşım:** Capability scope has no clear inclusion/exclusion edge.
- **Neden yanlış:** Classification and dependency become ambiguous.
- **Mimari etkisi:** Overlap, hidden dependencies, and ownership confusion emerge.
- **Doğru ilke:** Every Capability has a singular ability and explicit boundary.
- **Tespit işareti:** Reviewers cannot distinguish it from siblings.

## 16. Duplicate Capability Identity

- **Yanlış yaklaşım:** Two Capabilities in one authoritative model represent the same ability.
- **Neden yanlış:** Singularity and non-overlap are violated.
- **Mimari etkisi:** Ownership, Health, dependencies, and evidence split across competing records.
- **Doğru ilke:** One ability, one Capability identity per authoritative model scope.
- **Tespit işareti:** Duplicate definitions differ only by owner or realizer.

## 17. Hidden Governance Attachment

- **Yanlış yaklaşım:** Capability or binding operates without explicit governance provenance.
- **Neden yanlış:** Authority must be Director-anchored and traceable.
- **Mimari etkisi:** Decisions become unauditable and self-authorized.
- **Doğru ilke:** Governance Attachment and Binding Provenance are mandatory.
- **Tespit işareti:** No owner, authority source, or approval basis can be reconstructed.

## 18. Unsupported Realization Claim

- **Yanlış yaklaşım:** Runtime actor claims to realize a Capability without verified eligibility or evidence.
- **Neden yanlış:** Realization requires governed binding, attachment, and evidence.
- **Mimari etkisi:** Enterprise believes it has an ability that is not operationally supported.
- **Doğru ilke:** Keep Realization Gaps visible and claims evidence-backed.
- **Tespit işareti:** Capability marked realized with no contract, binding, or evidence.

## 19. Observability Without Evidence

- **Yanlış yaklaşım:** Capability assessment is asserted without mapped, provenanced observations.
- **Neden yanlış:** Insight requires evidence and network context.
- **Mimari etkisi:** Health, Maturity, and Risk become opinions.
- **Doğru ilke:** Interpret provenanced evidence through Capability Intelligence.
- **Tespit işareti:** Assessment cannot trace back to an observation surface.

## 20. Visualization as Source of Truth

- **Yanlış yaklaşım:** Diagram, dashboard, or System Map becomes authoritative.
- **Neden yanlış:** Visualization is a projection of canonical models and evidence.
- **Mimari etkisi:** Stale or simplified views overwrite architecture semantics.
- **Doğru ilke:** Visualization remains read-only and non-authoritative.
- **Tespit işareti:** Editing a view directly changes Capability identity or Runtime truth.

## 21. Capability Redundancy

- **Yanlış yaklaşım:** Duplicate Capabilities are created to provide the same ability.
- **Neden yanlış:** Capability singularity and non-overlap are violated.
- **Mimari etkisi:** Identity, ownership, assessment, and dependency truth fragment.
- **Doğru ilke:** Use Realization Redundancy under one Capability identity.
- **Tespit işareti:** Backup Agent, provider, or Runtime is represented as a second Capability.

## Anti-Pattern Result

Twenty-one modeling mistakes are recorded. None is present as an unresolved normative rule in the reviewed Phase 10 corpus.
