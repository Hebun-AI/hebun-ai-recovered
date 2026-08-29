# Hebun AI — Master Roadmap

## 1. Purpose and Authority

This document is the **canonical delivery and product-navigation authority** for Hebun AI. It answers four questions and only those four:

1. What is Hebun building?
2. Where does a capability belong?
3. What maturity stage is that capability in?
4. What should be finished next?

**This document is NOT:**

- the Enterprise Constitution
- architecture constitutional authority
- runtime authority
- Governance authority
- schema authority
- security authority
- execution authority

Existing architecture contracts remain authoritative within their legitimate scope. This roadmap coordinates delivery across them. It does not silently rewrite them. Where this document and an architecture contract appear to disagree about a *technical* rule, the architecture contract wins. Where they disagree about *what to build next*, this document wins.

**Repository truth overrides this roadmap.** Every classification below was measured against the repository at the baseline named in §9, and any future reader who measures a different reality should trust the measurement, not this page.

---

## 2. What Hebun Is

Hebun AI is an enterprise system in which an organization's work is carried out by durable, governed agents whose every consequential act is attributable, recorded, and reversible in evidence.

The load-bearing commitment is not automation. It is **truthfulness under authority**: no surface may present a claim it cannot ground, no actor may perform an act it was not authorized to perform, and no absence may be rendered as a zero.

That commitment is why the roadmap is ordered the way it is. Capability is cheap; the authority to exercise it honestly is the scarce thing, and it is built first.

---

## 3. Master Principles

1. **Authority precedes automation.** A capability that acts must first have an owner entitled to act.
2. **Measurement precedes self-optimization.** Nothing optimizes what it cannot yet observe.
3. **Intelligence precedes autonomy.** Nothing acts alone before it can explain what it saw.
4. **Unavailable is not empty.** "Could not look" and "looked and found none" are different claims and must render differently.
5. **Mock, seed and simulated state are never promoted to organizational truth.**
6. **Visualization is not authority.** Showing a fact does not confer ownership of it.
7. **Architecture discovery precedes consequential authority creation.**
8. **Released history is immutable evidence**, not a draft to be tidied.

---

## 4. The Three Eras

These are the stable top-level evolution stages of Hebun. Implementation discovery may add, split, or defer work *beneath* an era. It may not casually create a new top-level era (see §18, rule 12).

### ERA I — HEBUN TRUSTWORTHY FOUNDATION
Hebun can be trusted to describe an organization truthfully. Every surface either grounds its claim in a legitimate authority or says it cannot.

### ERA II — HEBUN INTELLIGENCE
Hebun understands what it observes. Evidence accumulates, agents are evaluated, and intelligence is layered over an organization that is already truthfully represented.

### ERA III — HEBUN AUTONOMOUS ENTERPRISE
The organization runs as a living operational system, observed end to end, with autonomy exercised only where authority was explicitly established.

---

## 5. Product-Line Model

Hebun has **six truth-owning product lines**:

| # | Product line | Owns |
|---|---|---|
| 1 | **Heby** | The conversational intelligence interface. Presentation and grounding. Owns no organizational fact. |
| 2 | **Agents** | Durable agent identity, activity, outcome observation, evaluation, and improvement hypotheses. |
| 3 | **Governance** | Decisions, authority resolution, ratification, and the decision record. |
| 4 | **Knowledge** | Facts, sources, provenance, retraction, and external references. |
| 5 | **Organization** | Organizational structure, departments, people, roles. **Organization identity has an authoritative read seam** since L3 (`0644967`); **internal structure remains unavailable** — departments, teams and reporting lines have no authority (§9). |
| 6 | **Integrations** | External provider contracts, connections, credentials, and provider-sourced reads. |

A new subsystem does **not** automatically become a product line (§18, rule 2).

**There is no seventh product line.** In particular, **Enterprise Security is cross-cutting, not truth-owning** — it constrains all six lines and owns none of their facts. It is defined in §7.

---

## 6. Live Map — Promoted Product Surface

**Live Map is a first-class promoted product surface.** It gets its own roadmap row, its own maturity progression, and its own versioned closure milestones.

**It is NOT a seventh truth-owning product line.**

Pinned permanently:

```
LIVE MAP                != ORGANIZATION AUTHORITY
LIVE MAP VISUALIZATION  != ORGANIZATIONAL TRUTH
UI PRESENCE             != RUNTIME AUTHORITY
OBSERVATION             != AUTHORIZATION
VISUALIZATION           != EXECUTION
```

Live Map reads from the legitimate authoritative owner of every concept it displays. It owns none of their truth merely because it visualizes them.

### 6.1 Product vision — direction, not frozen architecture

Live Map is Hebun's living organizational and operational product surface. Its long-term purpose is to let a person understand the enterprise as a **connected living system** rather than as disconnected dashboards and tables. The organization itself is the conceptual center.

Live Map may eventually let a user explore: organizational structure · departments · people · roles · agents · active work · goals · problems · knowledge · risks · proposals · decisions · Governance · execution · outcomes · learning.

Each of those is read from its legitimate authoritative owner.

### 6.2 Interaction direction — future product direction only

A user may eventually be able to:

- hover or focus an agent and see a compact truthful activity summary
- open an agent workspace from the map
- inspect current work, activity, proposals, Governance state, execution state
- inspect performance/evaluation and improvement history
- navigate departments and organizational relationships
- enable or disable intelligence layers
- filter the map by work, goals, problems, risks, knowledge, or other supported facts
- follow relationships between organizational entities and operational activity

**Deliberately NOT frozen by this roadmap:** exact popup layout · exact navigation pattern · exact graph technology · exact visual hierarchy · exact interaction model · exact realtime transport · exact component architecture.

Those belong to the future Live Map discovery and design phase.

### 6.3 Heby + Live Map direction

Heby may eventually become a natural-language navigation and intelligence interface over the Live Map. Conceptually:

> "Show me what Sales is working on."
> "Show Governance items waiting for review."
> "What changed in Marketing this week?"
> "Show the agents working on this problem."

Heby could focus or highlight the relevant organizational context. However:

```
HEBY QUERY != ORGANIZATIONAL TRUTH
HEBY       != LIVE MAP AUTHORITY
HEBY       != GOVERNANCE AUTHORITY
HEBY       != EXECUTION AUTHORITY
```

Both Heby and Live Map consume legitimate authoritative seams. **This integration is not implemented and is not authorized by this document.**

### 6.4 Live Map maturity across the three eras

**ERA I — LIVE MAP CORE v1.** Goal: truthful representation of the organization from authoritative seams. Potential closure concerns: authoritative organizational structure exists; departments, people, roles and agents are represented only where authoritative; unavailable state is explicit; mock or seeded organizational fiction is never presented as live truth; provenance preserved where required; Live Map itself owns no organizational truth. *The exact implementation contract will be rediscovered before L4 implementation.*

**ERA II — LIVE MAP INTELLIGENCE v1.** Direction: overlay legitimate intelligence onto the organization — goals, problems, knowledge, risks, agent activity, proposals, decisions, performance, historical change, intelligence findings. **Only authorities that actually exist may feed a layer.**

**ERA III — LIVE MAP OPERATIONAL v1.** Direction: the organization observed as a living operational system. Potential mature chain:

```
ORGANIZATION → WORK → AGENT → PROPOSAL → GOVERNANCE → EXECUTION → OUTCOME → LEARNING
```

Live Map observes and correlates this chain. It does not silently become its authority.

---

## 7. Cross-Cutting Program — Enterprise Security & Trust

Security is **not** a product line and **not** a promoted surface. It is a **cross-cutting delivery constraint** that applies to all six product lines, to Live Map as a consumer, and to all three Eras.

It exists in this roadmap so that security requirements are impossible to overlook when a milestone closes — and for no other reason.

### 7.1 What this program is

| Property | Statement |
|---|---|
| Applies to | All six product lines, and Live Map as a **consumer** of access-controlled seams |
| Spans | Era I, Era II and Era III — its requirements genuinely span all three and cannot be collapsed into one |
| Architecture authority | **Program V — Enterprise Security**, `docs/architecture/programs/program-05-enterprise-security/` (Phase 30–36) |
| Its role | Delivery alignment · traceability · Era closure constraints · security requirement placement |

### 7.2 What this program does NOT own

It owns **no truth**. Every fact a security surface renders is owned by an authority that already exists elsewhere.

```
SECURITY PROGRAM   != SECURITY AUTHORITY
SECURITY SURFACE   != SECURITY TRUTH AUTHORITY
ARCHITECTURE CONSTRAINT != RUNTIME OWNER
UI OBSERVATION     != SECURITY FACT CREATION
```

Specifically, this program owns no security truth, no runtime lifecycle, no authorization, no execution, no credentials, no incident truth, no policy truth, and no agent or tool lifecycle.

It creates **no** Security Sentinel, **no** Security Operating System, and **no** central Security runtime authority. None of those exists in Hebun, and this roadmap does not bring one into being.

### 7.3 Existing authority reuse — the governing principle

> **A security requirement is satisfied by extending or referencing the existing authoritative owner — never by creating a central replacement for it.**

Hebun already has legitimate, released owners for most of what Program V gives meaning to. Categories, not implementation detail:

- authentication · session · tenant context
- membership · role
- Governance decision authority
- action authorization
- execution authority
- provider credentials
- encryption and key registry
- provider connectivity controls / kill switch
- audit and evidence
- knowledge access
- Heby and agent action boundaries

**This roadmap is not authoritative over any of them.** It records that they are the owners; their own contracts govern how they work. Adding a second answer to a question one of them already answers — most acutely *"may this actor act?"* — is a regression, not a security improvement.

---

## 8. Cross-Era Maturity Matrix

| Product line / surface | Era I | Era II | Era III |
|---|---|---|---|
| **Heby** | Core v1 — bounded conversational grounding | Heby Intelligence | Heby as operational interface |
| **Agents** | Durable identity + truthful activity | Agent Registry · evidence seam · evaluation | Advanced self-improving agents |
| **Governance** | Decision authority + recorded acts | Governance intelligence overlays | Governed autonomy |
| **Knowledge** | Facts, provenance, retraction | Memory · learning | Organizational learning loop |
| **Organization** | **Organization Authority (L3)** | Organizational intelligence evolution | Living organizational system |
| **Integrations** | Provider contracts + connections | Provider-sourced intelligence | Operational integration |
| **Live Map** *(promoted surface)* | **Live Map Core v1 (L4)** | Live Map Intelligence v1 | Live Map Operational v1 |
| *Enterprise Security & Trust* **(cross-cutting constraint — §7, not a product line)** | Gates on L3, L4 and Era I closure — **all four measured CLOSED** (§11.1), including the carried trust boundary | Provisional security direction (§12) | Constraints for consequential autonomy (§13) |

The final row is a **constraint**, not a truth owner. It appears in this matrix so that no Era can be read as closable without it, and for no other reason.

---

## 9. Current Position — YOU ARE HERE

**Measurement baseline:** commit `047dde807779e21c7d6ed08e449509df8780c415` on `main`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger: **39 entries** (idx 0–38), last `20260828190630_sia3_agent_improvement_hypothesis` — **unchanged across the whole of Era I**: the seven Era I releases carry a measured zero delta against `src/db/migrations` and `src/db/schema`.

Classifications are drawn only from: CLOSED · ACTIVE · PARTIAL · DISCOVERY COMPLETE · DESIGN ONLY · NOT STARTED · DEFERRED · UNAVAILABLE.

**No percentage is used as a status or progress claim anywhere in this document.** A percentage without a defensible denominator is a fabricated measurement.

This section is a **current-position label**, not a release history:

```
ROADMAP NAVIGATION != RELEASE LEDGER
```

Release and closure records live in `docs/product-vision/runtime/`. This page says where the work stands now, not how it got here.

| Capability | Status | Repository evidence |
|---|---|---|
| Mock-surface gating authority | **CLOSED** | `src/features/mock-surface-gating/gate.server.ts` exists and fails closed; permits compiled-in organizational demo data only when the auth environment is explicitly `disabled`. |
| Heby Executive Overview truthfulness | **CLOSED** | `heby-runtime/overview-source.server.ts` reads `getDirectorDashboardUiModel`, which returns `unavailableDashboard()` when demo data is not permitted — `unavailable`, never a fabricated zero. |
| Truth boundary across *all* compiled-in fiction — **L1** | **CLOSED — released** | L1 released at `a6e9db9`. 25 surfaces that rendered organizational fiction with no honest marker now carry a released disclosure notice; the mock-surface gate itself was left untouched at the same two call sites and gained no rival authority. `tests/truth1-organizational-fiction/` executes the inclusion rule rather than asserting a list. Zero schema, zero migration, zero writer, zero route. |
| Organization identity as authoritative truth — **L3** | **CLOSED — released** | L3 released at `0644967`. `src/features/organization-authority/` is one server-only, tenant-scoped, **read-only** seam answering what organization exists, over rows whose lifecycle owners already existed. Provenance comes from `companies.provisioning_source`, a released column with a released CHECK and, until L3, zero readers. Zero schema, zero migration, zero writer, zero authorization. |
| Internal organizational structure (departments, teams, reporting lines) | **UNAVAILABLE** | Re-measured at this baseline and unchanged: `organizations` and `departments` have existed since the foundation baseline (`20260711173046_foundation_baseline.sql`) with **zero writers and zero readers** — no insert, update or value import against either exists anywhere in `src`. L3 deliberately did not invent one; it reports the absence as `no-authority`. A table is not an authority. |
| Heby Core v1 — **L2** | **CLOSED — released** | L2 released at `98fd859`. HMR-1's attributed gap was re-measured from repository evidence and found unreproducible as stated; one real gap was found and repaired — a Heby surface could report that a model request was permitted while the Director's durable kill switch would refuse to dispatch it. Repaired by one composed field in the projection that already resolves both operands, Director first. No new authority, no schema, no migration, no writer, no route. |
| SIA — pre-application loop (OBSERVE → EVALUATE → PREPARE → FILE → GOVERN) | **CLOSED and product-reachable** | `/agents` renders outcome observation, evaluation, and improvement-hypothesis surfaces; writer, reader and Governance decider all exist under `src/features/agent-improvement-hypothesis/`. |
| SIA — application of an accepted hypothesis | **DEFERRED / UNAVAILABLE** | `decide-improvement-hypothesis.server.ts` reads only the hypothesis and decision records and writes only through the Governance decision authority. It never touches the `agents` table. No apply or rollback path exists anywhere. |
| Agent behavioral configuration as a durable runtime mutation surface | **UNAVAILABLE** | Independently measured: no agent behavioral-config, system-prompt, or equivalent mutation surface exists in `src`. This is the same conclusion ASA-0 reached; it is recorded here on its own repository evidence. |
| ASA-0 discovery | **DISCOVERY COMPLETE — read-only** | Confirmed to have left **no repository mutation**: the identifier `ASA` appears nowhere in the repository, in any file or any commit. Its findings live outside the repository and are therefore attributed, never cited as repository evidence. |
| Live Map Core v1 — **L4** | **CLOSED — released** | L4 released at `bad04cf`. `/live-map` projects two node kinds — the organization (through L3) and durable agent identities (through AGENT-ID-0's read seam) — and exactly one edge, `agent belongs-to organization`, carrying `agents.tenant_id` as its basis. Departments and people are stated as having **no authority** rather than omitted. `LiveMapTruth` has one member, so a derived or mock node is unconstructable. Zero schema, zero persistence, zero writer; Live Map owns none of the truth it draws. |
| Enterprise Security architecture (Program V, Phase 30–36) | **DESIGN ONLY** | Complete and published as architecture. Its own constitution records `Implementation authority: None`, and every phase carries an explicit non-implementation rule. It is meaning and constraint, never a delivery backlog (§19). |
| Security Center | **CLOSED as a released UI surface — NOT connected security operations** | `src/features/security-center/` renders a source-class taxonomy, signal/finding vocabularies, structural response options and a four-actor boundary. Every populated collection is empty and nothing is fabricated: `signals.ts` freezes an empty array and `hasConnectedSecurityFeed()` is `false` — re-measured here as a computation over the source map, where **no source carries `state: "connected"`**. SEC-4 (`06e2d7e`) corrected three source claims that delivery had overtaken and extended the firewall to the components and the route; it connected no reader. It owns vocabulary and boundaries, not security truth (§14). |
| Security Event / Finding / Incident authority | **UNAVAILABLE** | Vocabulary exists; no instance, no writer, no reader, no feed. No canonical owner of security-event truth exists anywhere in `src`. |
| Permission authority | **UNAVAILABLE** | Re-measured at this baseline: `permissions` and `role_permissions` still have **zero readers, zero writers and zero value importers** outside `src/db/schema/`, and `governance-decision/authority-read.server.ts` still records that it consults neither. L3 answered the entry gate deliberately (§11.1) and left them exactly as inert as it found them. A table is not an authority. |
| Security policy authority | **UNAVAILABLE** | The `policies` table has **zero importers** of its schema symbol. No policy evaluator is connected; the Heby action governance gate reports `not-connected`, which **blocks** eligibility rather than passing it. |
| Ingested-content trust boundary — **TB-1** | **CLOSED — released** | TB-1 released at `047dde8`. `heby-runtime/trust-boundary.ts` names the boundary and classifies **every** field of a model request as `Record<keyof ModelGenerationRequest, TrustClass>`, so a new path into model context cannot arrive unclassified without failing to compile. It records its own limits as data: `structurallyIsolatedInInferenceRequest: false`, `restsOnModelCompliance: true`, `detectsInjectedInstructions: false`. Zero schema, zero writer. |
| **ERA I — HEBUN TRUSTWORTHY FOUNDATION** | **CLOSED** | Closed at `047dde8` against the §11 contract, measured row by row — see §11.3. L1–L4 released and re-verified; all four §11.1 Security & Trust gates measured CLOSED. |
| Era II | **NOT STARTED** — provisional direction only (§12) | — |
| Era III | **NOT ACTIVE** | — |

---

## 10. Locked Era I Sequence

This order is Director-approved and **locked**. It is not a suggestion and not a provisional ordering.

### L1 — I·FOUNDATION·TRUTH-1 — Retire the Fiction · **CLOSED — released `a6e9db9`**
Extended the existing mock-surface-gating truth boundary so that compiled-in fiction cannot be presented as authoritative organizational reality. The gate itself was left untouched; its **reach** was the work.

### L2 — HEBY CORE v1 · **CLOSED — released `98fd859`**
Closed the remaining bounded Heby Core contract. A Heby surface may no longer report that a model request is permitted while the Director's kill switch would refuse to dispatch it.

### L3 — ORGANIZATION AUTHORITY · **CLOSED — released `0644967`**
Established the legitimate durable owner and read contract for organizational truth. The narrowest legitimate owner turned out to be a **reader**: the substrate, its writers and its provenance column all already existed, and what was missing was one bounded place to ask the question. No organizational writer was created, and internal structure is reported as having no authority rather than as empty.

### L4 — LIVE MAP CORE v1 · **CLOSED — released `bad04cf`**
Built the first truthful Live Map over legitimate authoritative seams. It projects only what other authorities already own, draws one edge and names the durable column that proves it, and states every domain Hebun does not own.

**Why this order:** L1 makes fiction unpresentable; L2 closes the interface that would otherwise speak that fiction; L3 creates the authority that has something true to say; L4 visualizes it. Reversing any pair would produce a surface that renders a claim no authority owns.

**Released milestones are not reopened.** L1, L2, L3 and L4 are immutable evidence (§3, principle 8). Where a security constraint was not resolved inside a released milestone, it is carried honestly to the next legitimate closure or review point — never backdated into closed history. §11.1 records exactly one such carry, and where it was finally closed.

---

## 11. Era I Closure Contract

```
ERA I — HEBUN TRUSTWORTHY FOUNDATION = CLOSED
    if and only if
L1, L2, L3 and L4 are each implemented, verified, and released
    AND
every Security & Trust gate below is satisfied or explicitly Director-deferred.
```

Era I **must not** be called closed before those four contracts are actually implemented, verified and released. Design completion, documentation, or discovery does not close it. A closure claim is a measurement, not a decision.

### 11.1 Security & Trust gates on Era I

These are **gates on existing milestones**. No separate Security milestone is introduced — see §11.2. Each gate is a question that must be answered before the milestone it names may close; none of them authorizes runtime work by appearing here.

| Gate | Attaches to | The question that must be answered | Status |
|---|---|---|---|
| **Ingested-content trust boundary** | **Carried** — see below | Is externally ingested content (provider reads, uploads) explicitly classified as untrusted input everywhere it can reach a model request, or is the boundary's absence explicitly recorded? | **CLOSED** — TB-1 `047dde8` |
| **Roles and permissions** | **L3 — entry gate** | Do organizational roles carry permissions? Answer **before** Organization Authority schema and runtime are designed. | **CLOSED** — answered at L3 `0644967` |
| **Observation surfaces gain no hidden authority** | **L4 — closure gate** | Can Live Map or the Security Center acquire write, authorization or execution authority through a transitive dependency? | **CLOSED** — L4 `bad04cf` + SEC-4 `06e2d7e` |
| **No stale security-source claim** | **Era I — closure gate** | Does any released security surface still assert a source state that repository reality contradicts? | **CLOSED** — SEC-4 `06e2d7e` |

Each gate below keeps the statement that was true when it was opened, and records separately how and where it was closed. A gate is not rewritten as though it had never been open.

**Carried constraint — ingested-content trust boundary. CLOSED at `047dde8`.**

*As measured when the gate was opened (L2 baseline `98fd859`):* the boundary existed in part and was honestly disclaimed where it did not. `heby-actions/result-validator.ts` treated tool output as untrusted; `knowledge/pdf-extract.server.ts` treated extracted text as untrusted; `heby-runtime/prompt-validation.ts` stated plainly that it is *not* prompt-injection defence; `agent-origination/originate-action.server.ts` recorded "containment, not immunity". **No module named a single owning boundary.** It was carried forward rather than backdated into L2.

*How it closed:* TB-1 gave the boundary an owner in `heby-runtime/trust-boundary.ts`. Five trust classes, of which exactly one — `trusted-system-instruction` — may direct behaviour. Every field of a model request is classified as `Record<keyof ModelGenerationRequest, TrustClass>`, so a new path into model context **cannot arrive unclassified without failing to compile**; retrieved material is `untrusted-content`, prior turns are `conversation-data`, and the operator's own question is `human-request` rather than an instruction.

*And it states its limits as data rather than prose:* `structurallyIsolatedInInferenceRequest: false` (the provider API accepts one `system` string, so past the transport the separation is a delimiter the model is asked to respect), `restsOnModelCompliance: true`, `detectsInjectedInstructions: false`, `neutralizesInjectedInstructions: false`. What holds regardless of the model is recorded too: `consequentialEffectsContainedByAuthorization: true` — model output is advisory text that reaches no authorization path.

```
UNTRUSTED CONTENT != INSTRUCTION
MODEL OUTPUT      != AUTHORIZATION
MODEL COMPLIANCE  != MECHANICAL GUARANTEE
```

**Prompt injection is not solved, and TB-1 does not claim it is.**

**L3 entry gate — roles and permissions.** This is an **architectural decision gate, not authorization to implement a permission system.**

```
PERMISSIONS TABLE EXISTS != PERMISSION AUTHORITY EXISTS
```

`permissions` and `role_permissions` have zero readers and zero writers (§9). Authorization today is answered by an existing released owner. L3 must decide the question deliberately, because **a second "may this actor act?" system is a regression, not a security improvement** (§7.3). Nothing here authorizes creating one.

*Answered at `0644967` — **P3, bounded.*** Organizational roles participate in authorization only through an **existing** owner, and the decisive fact was a missing column: **`roles` has no `organization_id`**, so today's role is a tenant membership band and an *organizational* role does not exist in this repository at all. `roles.type` gates the caller in exactly one released place (`knowledge/knowledge-write-authority.server.ts`) and the target role's eligibility in `membership-authority` and `human-onboarding`; Governance, action authorization and identity enrollment each record that they consult none of it. So L3 touched roles at nothing, and its read seam carries no role, no band, no permission and no authority scope — asserted on the serialized value, so a field *added* later is caught too. `permissions` and `role_permissions` were left exactly as inert as they were found, and are re-measured as such at this baseline (§9).

**L4 closure gate — observation surfaces. CLOSED at `bad04cf` (Live Map) and `06e2d7e` (Security Center).**

*As measured when the gate was opened:* `tests/security-center/security-center.ts` ran a released **file-level** token firewall over `src/features/security-center/*.ts`, forbidding persistence, governance/execution/policy/decision imports, network, shell, filesystem and device APIs, plus a fabrication audit on the rendered model. What it did **not** do: walk the transitive import graph, or cover `src/components/security-center/` and the route.

*How it closed.* Both halves are now defended by walking the real **transitive value-import closure** from each surface's entry points rather than scanning a directory:

- **Live Map** (L4) — its firewall reaches the authorities it consumes, then asserts that no lifecycle writer, Governance writer, authorization decider, credential store, provider control or model boundary is reachable, and adds what a name list cannot do: **a behavioural sweep proving nothing reachable performs a durable write**, outside an ambient session floor that is enumerated and disclosed rather than assumed.
- **Security Center** (SEC-4) — the same instrument extended to the 11 component files and the route.

Two measurement defects were found and fixed in the course of closing this gate, and both are worth recording because either would have made the gate green while blind: a walker that follows `import … from` but **not `export … from`** cannot see a barrel re-export, which is precisely the shape the gate exists to catch; and a needle list matching module *names* falsely reported a table definition (`db/schema/provider-connectivity-control.ts`, reachable because the drizzle handle is typed by the schema barrel) as the provider kill switch.

**Era I closure gate — stale security-source claims. CLOSED at `06e2d7e`.**

*As measured when the gate was opened,* three claims in `security-center/source-map.ts` were contradicted by repository reality:

- `integration` — asserts "none connected", while `provider-google/` and `provider-github/` hold released, real connections.
- `provider` — asserts "simulation vocabulary", while live transports exist for Google, GitHub, Claude and Resend.
- `audit` — asserts "No persisted security audit history exists". `audit_log` is append-only with nine governance-audit writers and two released readers. The claim is true only of the Security Center's own *connection* to that sink, and false of the repository.

These were honest statements that delivery had overtaken, not fabrications. Era I is defined as *"every surface either grounds its claim in a legitimate authority or says it cannot"* — a released security surface asserting a state the repository contradicts is exactly the defect Era I closes against.

*How it closed.* SEC-4 rewrote all three to draw the distinction the gate is really about — **the capability exists, and the Security Center is not connected to it** — and each now says so in both directions. `integration`: released tenant-scoped connections exist and are owned by the integration authority; this surface reads none of them, and `canProve` is *"Nothing on this surface"*. `provider`: real transports exist in the runtime; no provider feed is wired here. `audit`: a governed append-only ledger exists with released tenant-scoped readers, and it is not wired to this surface. Re-measured at this baseline: **no source carries `state: "connected"`**, so `hasConnectedSecurityFeed()` is `false` by computation rather than by assertion. No reader was connected and no finding, incident, policy, trust or score was introduced.

```
AUTHORITY / CAPABILITY EXISTS != SECURITY CENTER CONNECTED
SECURITY CENTER               != SECURITY AUTHORITY
```

### 11.2 No separate Security milestone

Recorded as an explicit sequencing decision:

**No pre-L1 and no standalone Era I Security milestone is introduced.** Security requirements are expressed as entry gates, closure gates and cross-cutting release constraints around existing product milestones. This preserves the locked order:

```
L1 → L2 → L3 → L4 → ERA I CLOSED
        subject to the §11.1 Security & Trust gates
```

The rationale is §18 rule 11 — prefer closing coherent product milestones over opening many new programs — and the measurement behind it: Hebun's security foundation is stronger than the architecture assumed, not weaker. The genuine Era I gaps are few and small enough to be gates.

### 11.3 Era I closure record

```
ERA I — HEBUN TRUSTWORTHY FOUNDATION = CLOSED
```

**Closure baseline:** `047dde807779e21c7d6ed08e449509df8780c415` on `main`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger **39**, unchanged throughout.

Measured row by row against the §11 contract. A closure claim is a measurement, not a decision, so the matrix is recorded rather than summarised:

| Closure row | Status | Released at |
|---|---|---|
| L1 — Truth Foundation | **CLOSED** | `a6e9db9` |
| L2 — Heby Core v1 | **CLOSED** | `98fd859` |
| L3 — Organization Authority | **CLOSED** | `0644967` |
| L4 — Live Map Core v1 | **CLOSED** | `bad04cf` |
| Gate — roles and permissions | **CLOSED** | answered at `0644967` |
| Gate — observation surfaces gain no hidden authority | **CLOSED** | `bad04cf` · `06e2d7e` |
| Gate — no stale security-source claim | **CLOSED** | `06e2d7e` |
| Gate — ingested-content trust boundary | **CLOSED** | `047dde8` |
| Release / remote state | **CLOSED** | HEAD = `origin/main` = `047dde8`, 0/0 |
| Migration integrity | **CLOSED** | ledger 39; zero schema and zero migration delta across Era I |
| Concurrent-work integrity | **CLOSED** | tracked tree clean; carry-over untouched |

#### What Era I guarantees

1. **Organizational fiction cannot silently masquerade as authoritative truth.** The mock-surface gate fails closed, and every surface that still renders a compiled-in fixture says so where a reader will see it.
2. **Heby has a bounded, truthful Core.** It cannot report that a model request is permitted while the Director's durable kill switch would refuse to dispatch it.
3. **Organization identity has an authoritative read seam**, tenant-resolved from trusted context, with provenance — and no organizational writer was created to get it.
4. **Live Map projects only admitted truth and owns none of it.** One edge, and it names the durable column that proves it.
5. **Security observation surfaces cannot silently become authorities**, proved by walking the transitive import closure rather than by scanning a directory.
6. **External and ingested content is explicitly non-authoritative data**, classified exhaustively enough that a new path into model context cannot arrive unclassified without failing to compile.
7. **Model output cannot directly become authorization or execution.** The route to a consequential act runs through a human command, a Governance decision, a single-spend permit and an execution boundary — none of which reads model output.
8. **Roles and permission tables are not represented as an active permission authority.** They are inert, and the roadmap says so.

#### What Era I does NOT mean

Closure is a statement about a foundation, not about a finished product. All of the following remain true at this baseline:

- **The Security Command Center is not connected.** No source is `connected`; there is no live audit feed, no live provider feed, and no security finding, incident, policy result or posture score anywhere in `src`.
- **Security Center consumes no authoritative evidence yet.** The capability exists elsewhere; the surface is not wired to it.
- **Internal organizational structure remains unavailable.** Departments, teams and reporting lines have no authority, and Live Map reports that rather than drawing an empty organization.
- **People are counted, never placed.** Hebun holds a member count and no roster, and membership carries no departmental placement.
- **Live Map Intelligence is not implemented.** Neither is Heby Intelligence, Director Intelligence, or a Director Twin.
- **ASA application and agent runtime configuration are not implemented.** No agent behavioural-config or system-prompt mutation surface exists.
- **Prompt injection is not solved.** TB-1 classifies and contains; it does not detect or neutralise, and it says so in its own contract.
- **Era I closure does not imply production deployment.** It is a statement about released repository reality, not about what is running.

```
ERA CLOSED != PRODUCT FINISHED FOREVER
ERA CLOSED != EVERYTHING DEPLOYED
```

---

## 12. Era II — Provisional Direction

**PROVISIONAL. NOT LOCKED. AND NOW STALE AS AN ORDER.**

```
ASA-2 — Windowed Evidence Seam
  → Agent Registry
  → Live Map Intelligence
  → Heby Intelligence
```

**That sequence was authored before L3, L4, SEC-4 and TB-1 existed, and it is retained as a record of direction rather than as a decision.** Era I changed what is available to build on — an organization read seam, a Live Map projection, a hardened observation boundary and a named trust boundary — and a candidate that was merely safe to build first is not thereby the right one. Ordering requires **Era II discovery and prioritization** before anything opens.

Note in particular that a fifth candidate now exists which the sequence above predates: **connecting a security surface to the audit sink that already exists** (§12.1). It is not inserted into the order here, because inserting it would be the same mistake as trusting the order.

Later intelligence work may then include, **according to dependency discovery**: Director Intelligence · Director Twin foundations · Memory · Learning · Advanced Self-Improving Agents · Organizational Intelligence evolution · Evaluation · multi-agent intelligence.

No precise implementation order is fabricated here for systems whose prerequisites have not yet been rediscovered.

*Recorded honestly:* `ASA-2` is a Director-named milestone with **no repository record at this baseline**. Its prerequisites must be rediscovered before it opens.

```
ERA II != AUTOMATIC AUTHORIZATION TO BUILD
```

Pinned:

```
LOCKED ORDER != PROVISIONAL ORDER != FUTURE DIRECTION
```

### 12.1 Era II — Security direction

**FUTURE / PROVISIONAL SECURITY CONSTRAINTS. Not implementation commitments, and no phase order is fabricated here.**

Concerns likely to become load-bearing as intelligence accumulates over authoritative evidence:

- security evidence observation — connecting a security surface to the audit sink that already exists
- a Security Event / Finding / Incident authority, **only if a product requirement justifies one**
- deployment-wide model spend control — today's bound is per-process and honestly says so
- ingested-content trust boundaries, as external sources become reasoning input
- rate limiting and abuse controls beyond the existing credential lockout
- security intelligence layered over authoritative evidence, never over fabricated signal

**None of these is created now.** No Security Event/Finding/Incident authority is established by this section, and no Security Sentinel is created here or anywhere.

---

## 13. Era III — Constraints and Future Direction

Era III is **not active**. It is constrained in advance:

- Autonomy is exercised only where an authority to act was explicitly established and recorded.
- Observation of the operational chain never becomes authority over it.
- No Era III capability may be opened while Era I remains open.

### 13.1 Era III — Security direction

**FUTURE SECURITY CONSTRAINTS for consequential autonomy. None of the following is implemented, and Program V owns none of their runtime.**

- per-tenant containment — today's outbound kill switch is deployment-global, and its own module records that as a limitation rather than hiding it
- backup, restore and disaster recovery — no backup, restore or failover path exists anywhere today
- continuous security governance
- a security policy authority, **only if product requirements justify one**
- trust modelling, **only if real autonomous relationships require it**
- long-running authorization re-validation on material context change
- security exception handling — baseline, authority, residual risk, duration, expiry
- resilience and recovery evidence

Distinguish throughout: an operator ceremony that a human runs is not automated resilience. Credential rotation and bootstrap credential recovery exist today as **ceremonies**; that is what they are, and it is not disaster recovery.

---

## 14. Major Capability Placement

### Director Intelligence → within **Hebun Intelligence** (Era II)

It does **not** get a separate top-level era.

It must **not** be claimed as implemented merely because adjacent Agent Intelligence exists. A naming collision exists in repository history between Director-facing agent intelligence work and Director Intelligence as a capability; that collision is **preserved, not resolved by renaming**. Future activation begins with repository discovery.

```
DIRECTOR INTELLIGENCE != DIRECTOR AUTHORITY
DIRECTOR TWIN         != DIRECTOR
ADVICE                != APPROVAL
MODEL OUTPUT          != GOVERNANCE DECISION
```

### Self-Improving Agents → under the **Agents** product line

Truthful current state: the pre-application loop **OBSERVE → EVALUATE → PREPARE → FILE → GOVERN** is implemented and product-reachable according to released evidence (§9). Advanced application remains **deferred**.

Agent behavioral configuration is not currently a legitimate durable runtime mutation surface. **Nothing in Hebun today implies that an agent can modify itself.**

```
SELF-IMPROVING          != SELF-MODIFYING
GOVERNANCE ACCEPTANCE   != APPLICATION AUTHORIZATION
APPLIED                 != IMPROVED
```

### Security Center → a released surface under the **Enterprise Security & Trust** constraint (§7)

It is **not** a product line and does not become one by being implemented.

Truthful current product classification:

- an implemented and released **UI surface**
- a **read-only observation vocabulary and boundary** surface
- **not** a connected security-operations authority
- **not** an incident authority · **not** a policy authority · **not** an identity authority · **not** an authorization authority · **not** an execution authority

Its own released model says so: it detects, explains, investigates and prepares; a human decides; an authorized runtime executes. Every collection it can render is empty, and nothing is fabricated to fill them.

```
EMPTY HONEST SECURITY UI != SECURITY OPERATIONS
SECURITY CENTER          != INCIDENT AUTHORITY
SECURITY CENTER          != POLICY AUTHORITY
SECURITY CENTER          != IDENTITY AUTHORITY
SECURITY CENTER          != AUTHORIZATION AUTHORITY
SECURITY CENTER          != EXECUTION AUTHORITY
```

**Security Operations is not implemented.** An honest empty surface is a truthful surface, not a capability. Connecting it is future work gated by §11.1 and §12.1, and is not authorized here.

---

## 15. Authority Boundaries

| Boundary | Statement |
|---|---|
| Roadmap vs architecture | This document coordinates delivery. Architecture contracts govern technical rules. |
| Visualization vs truth | A surface that renders a fact does not own it. |
| Observation vs authorization | Seeing an act does not confer the right to perform it. |
| Acceptance vs application | A Governance decision to accept a hypothesis is not authorization to apply it. |
| Advice vs approval | Model output is never a Governance decision. |
| Presence vs authority | A route, a table, or a component is not an authority. Authority is a writer with an owner. |

**This document creates no execution authority and no authorization authority.** It authorizes no phase to begin. Each phase requires separate Director authorization.

---

## 16. Versioned Closure Model

A product version closes **only** against explicit, measurable exit criteria.

- Exit criteria are stated before the work begins, not reconstructed after it.
- "Verified" means a measurement was taken and its result recorded.
- "Released" means the implementation is committed and pushed to `main`.
- "Deployed" and "production-accepted" are separate, later, independently measured states.
- A closure record states which of those states was actually reached and which was not.

---

## 17. Naming Hierarchy

**Every historical identifier is preserved.** `SIA-*`, `ASA-*`, `R2D`, `K4`, `G5A`, `INT-3`, `CMD-*` and every other released or historical identifier keeps its name. Historical work is **never force-renumbered**.

For *future* work, the preferred conceptual hierarchy is:

```
ERA
  → PRODUCT LINE / PROMOTED PRODUCT SURFACE
    → VERSIONED MILESTONE
      → PROGRAM
        → IMPLEMENTATION PHASE
          → SUBPHASE
            → RELEASE
```

Where useful, future roadmap milestones may carry explicit ownership identifiers (as `L1`–`L4` do in §10).

---

## 18. Roadmap Change Control

1. New technical discovery may add implementation work **without** creating a new Master Era.
2. A new subsystem does **not** automatically become a product line.
3. Released historical phases are immutable historical evidence.
4. A product version closes only against explicit measurable exit criteria.
5. **Repository truth overrides roadmap assumptions.**
6. Architecture discovery precedes consequential authority creation.
7. Mock, seed, or simulated state must never be promoted to organizational truth.
8. Authority precedes automation.
9. Measurement precedes self-optimization.
10. Intelligence precedes autonomy.
11. Prefer closing coherent product milestones over opening many new programs.
12. A change to the three top-level eras, or to the major product-line model, **requires explicit Director architectural review.**

---

## 19. Relationship to Architecture Documents

`docs/architecture/` contains **737 Markdown documents** at this baseline. They are historical design authority and **are preserved unmodified**. This roadmap rewrites none of them and mass-edits no status field.

**Critical distinction.** An architecture document marked `COMPLETE`, `CLOSED`, or `PUBLISHED` may represent completed **architectural design**. Those labels MUST NOT be automatically interpreted as:

```
IMPLEMENTED · PRODUCT-REACHABLE · DEPLOYED · PRODUCTION-VERIFIED
```

A design can be complete and closed while the capability it describes has never been built. `docs/architecture/` records what was *designed*. This roadmap interprets delivery status from **released repository reality** — and where the two disagree about delivery, the repository wins.

Release and closure records for implemented work live in `docs/product-vision/runtime/`. Cross-phase engineering lessons live in `learnings.md`.

### 19.1 Program V — Enterprise Security traceability

Program V Phase 30–36 define security **semantics and constraints**. Delivery may satisfy those constraints through existing or future authorities **without phase-name coupling**.

```
NO PHASE-NAMED CODE          != NO IMPLEMENTATION
PHASE COMPLETE/PUBLISHED     != PRODUCT IMPLEMENTED
PROGRAM V                    != IMPLEMENTATION BACKLOG
```

Both directions matter. A capability may fully satisfy a Phase 30 constraint while referring to no phase identifier anywhere — and Hebun's identity, tenant-isolation, credential and execution-boundary work does exactly that. Equally, all seven phases being published closes an architectural design and builds nothing.

**No phase-by-phase mapping table is maintained here.** That would make this navigation document a second security architecture and would rot against both sides. Discovery evidence stays in discovery records and repository history; it is not a second roadmap authority.

### 19.2 Correction carried forward from HMR-0

HMR-0 claimed that Heby's Executive Overview currently presents mock organization as fact. **That claim was withdrawn after HMR-1 re-measurement** and is re-confirmed withdrawn here: the adapter gate returns `unavailable` when organizational demo data is not permitted (§9).

HMR-0's "Foundation ~70%" estimate is **not preserved**. It had no defensible denominator. It is quoted here once, in order to retire it, and no percentage is used as a status or progress claim anywhere in this document.

---

## 20. Next Milestone

**ERA II — HEBUN INTELLIGENCE. Discovery and prioritization first; no milestone is open.**

Era I is **CLOSED** at `047dde8` (§11.3). L1–L4 are released and re-verified, and all four Security & Trust gates are measured closed.

What comes next is **not** decided by this page. §12's candidate sequence predates L3, L4, SEC-4 and TB-1, so it is stale as an order and is retained as direction only. The next legitimate action is an **Era II discovery pass** that re-derives prerequisites against current repository reality and returns a proposed order for Director approval.

Nothing in Era II is authorized by this document. In particular, a candidate being technically safe to build is not a reason for it to be first.
