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

### ERA I — HEBUN TRUSTWORTHY FOUNDATION · **CLOSED** (§11.3)
Hebun can be trusted to describe an organization truthfully. Every surface either grounds its claim in a legitimate authority or says it cannot.

### ERA II — HEBUN INTELLIGENCE · **OPEN** (§12)
Hebun understands what it observes. Evidence accumulates, agents are evaluated, and intelligence is layered over an organization that is already truthfully represented.

### ERA III — HEBUN AUTONOMOUS ENTERPRISE · **FUTURE — NOT ACTIVE** (§13)
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
| **Heby** | Core v1 — bounded conversational grounding | Heby Intelligence — **E2-1 CLOSED**, organization *identity* admitted as evidence (§12) | Heby as operational interface |
| **Agents** | Durable identity + truthful activity | Evidence seam · evaluation. **Agent Registry rejected as previously conceived** (§12) | Advanced self-improving agents |
| **Governance** | Decision authority + recorded acts | Governance intelligence overlays | Governed autonomy |
| **Knowledge** | Facts, provenance, retraction | Memory · learning | Organizational learning loop |
| **Organization** | **Organization Authority (L3)** | Organizational intelligence evolution | Living organizational system |
| **Integrations** | Provider contracts + connections | Provider-sourced intelligence | Operational integration |
| **Live Map** *(promoted surface — a projection, never a truth owner)* | **Live Map Core v1 (L4)** | Live Map Intelligence v1 — **E2-3 CLOSED · PRODUCTION-ACCEPTED** (derived cumulative Agent Outcome observation, id-keyed) · **LMX-1 CLOSED · PRODUCTION-ACCEPTED** — the visual organization-centred map, the agent inspector, and the Live Map Live / Security Live awareness band (§12, §12.3) · **E2-4 CLOSED** — a factual elapsed annotation on the existing agent node, no node or edge kind added (§12.4) | Live Map Operational v1 |
| *Enterprise Security & Trust* **(cross-cutting constraint — §7, not a product line)** | Gates on L3, L4 and Era I closure — **all four measured CLOSED** (§11.1), including the carried trust boundary | Security direction (§12.1); its first bounded slice **E2-2 is CLOSED** — one derived observation connected, no security authority created (§12) | Constraints for consequential autonomy (§13) |

The final row is a **constraint**, not a truth owner. It appears in this matrix so that no Era can be read as closable without it, and for no other reason.

---

## 9. Current Position — YOU ARE HERE

**Measurement baseline:** commit `0005f72f1014852a478e557b42344c1ddb52000d` on `main`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger: **39 entries** (idx 0–38), last `20260828190630_sia3_agent_improvement_hypothesis` — this is the **authored** ledger, a property of the repository. The **production** ledger is a separate measurement taken against the deployment, and it reached 39 only after the repair recorded in §12.3.

The **Era I** rows below were measured at `047dde807779e21c7d6ed08e449509df8780c415`, the Era I closure baseline (§11.3), and are re-confirmed here without re-measurement for one stated reason: `0005f72` is **docs-only over `047dde8`** and carries a measured zero delta against `src` and `tests`. The **Era II** rows were measured at `0005f72` directly (§12). The ledger is **unchanged across the whole of Era I**: the seven Era I releases carry a measured zero delta against `src/db/migrations` and `src/db/schema`.

Classifications are drawn only from: CLOSED · OPEN / ACTIVE · OPEN · ACTIVE · PLANNED · PARTIAL · DISCOVERY COMPLETE · DESIGN ONLY · NOT STARTED · NOT CONNECTED · AVAILABLE · BLOCKED · DEFERRED · UNAVAILABLE.

Five of those are defined here so they cannot drift: **OPEN / ACTIVE** is an era with at least one milestone open; **OPEN** is an era that has not closed and has **no milestone currently active** — a distinct state from OPEN / ACTIVE, and the one Era II entered when E2-3 closed with nothing selected to follow it; **PLANNED** is a recorded direction that has run no discovery and is authorized for nothing; **NOT CONNECTED** is a capability that exists and that the named surface does not read; **BLOCKED** is work whose prerequisite is measured absent, which is a stronger claim than deferred.

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
| Windowed or comparable agent evidence | **UNAVAILABLE** — this is what blocks **ASA-2** (§12) | Measured at this baseline: no time-window predicate exists anywhere in `agent-outcome-observation/`, `agent-evaluation/` or `agent-improvement-hypothesis/`. Agent evidence is unbounded `count(*) filter (…)` over every row that exists — correct for a total and unable to express a before-and-after. The one `now` parameter classifies permit expiry, not a window. |
| Agent behavioral configuration as a durable runtime mutation surface | **UNAVAILABLE** | Independently measured: no agent behavioral-config, system-prompt, or equivalent mutation surface exists in `src`. This is the same conclusion ASA-0 reached; it is recorded here on its own repository evidence. |
| ASA-0 discovery | **DISCOVERY COMPLETE — read-only** | Confirmed to have left **no repository mutation**: the identifier `ASA` appears nowhere in the repository, in any file or any commit. Its findings live outside the repository and are therefore attributed, never cited as repository evidence. |
| Live Map Core v1 — **L4** | **CLOSED — released** | L4 released at `bad04cf`. `/live-map` projects two node kinds — the organization (through L3) and durable agent identities (through AGENT-ID-0's read seam) — and exactly one edge, `agent belongs-to organization`, carrying `agents.tenant_id` as its basis. Departments and people are stated as having **no authority** rather than omitted. `LiveMapTruth` has one member, so a derived or mock node is unconstructable. Zero schema, zero persistence, zero writer; Live Map owns none of the truth it draws. |
| Heby consumption of the Organization Authority (L3) seam | **CONNECTED — E2-1 released at `dfa7624`** (§12) | Re-measured at `dfa7624`: Heby resolves an `organization` source class through `organization-authority/heby-organization-source.server.ts` — a read projection that lives **inside** the authority, so Heby holds neither `readOrganizationAuthority`, nor `companies`, nor a database handle. The projection's only value import is the authority's own read seam; it performs no durable write. Heby's answer-flow closure grew 503 → 506, all three files inside L3. |
| Heby consumption of the Live Map (L4) projection | **NOT CONNECTED — and not scheduled to be** (§12) | Re-measured at `dfa7624`: no file under `src/features/heby-*` names `features/live-map`, `LiveMapProjection`, `LiveMapDomain` or `LiveMapNode`, and **no Live Map module is reachable from the Heby answer flow at any depth** — asserted by a firewall that walks the real value-import closure (>100 modules). E2-1 decided this from two type declarations, not from preference: `SourceResolution.authoritative` is one boolean per source class, and `LiveMapProjection.domains` is an array a future E2-3 layer would grow elsewhere. **A future Live Map layer does not become Heby evidence.** |
| Enterprise Security architecture (Program V, Phase 30–36) | **DESIGN ONLY** | Complete and published as architecture. Its own constitution records `Implementation authority: None`, and every phase carries an explicit non-implementation rule. It is meaning and constraint, never a delivery backlog (§19). |
| Security Center | **ONE CONNECTED DERIVED OBSERVATION — still NOT security operations** | Re-measured at `e5dd1bc`: of ten source classes, **exactly one carries `state: "connected"` — `audit`** — and `hasConnectedSecurityFeed()` computes `true` from the map rather than asserting it. E2-2 wired that class to the released `governance-activity` seam through a projection the Security Center does not own; the surface still holds no database handle, no writer and no `features/governance` import. Every other populated collection is still empty: `signals.ts` freezes an empty array, `incidents` is typed `readonly never[]`, and `isBreachConfirmable()` is `false`. It owns vocabulary, boundaries and now one derived read — never security truth (§14). |
| Tenant-scoped audit observation seam — **E2-2 / S-B, CLOSED** (§12) | **CONNECTED — read-only, tenant-scoped, derived** | E2-2 connected **`act-history-read.server.ts`** — the bounded page — through `governance-activity/security-observation-source.server.ts`, which the Security route composes with a tenant resolved from the session. The unbounded aggregate reader was deliberately **left unconnected**: four `LIMIT`-free tenant scans per request is not a bound anybody chose for a page. **No file in `src/features/security-center/` imports either seam**; the projection lives beside the readers, so the released token firewall forbidding `features/governance` in that directory passes unweakened. Both seams still declare **`isAuthoritative: false`** — they are derived views over `audit_log`, which remains the sole authority for recorded acts, written by nine `governance-audit` writers and by nothing else. |
| Security Event / Finding / Incident authority | **UNAVAILABLE** | Vocabulary exists; no instance, no writer, no reader, no feed. No canonical owner of security-event truth exists anywhere in `src`. |
| Permission authority | **UNAVAILABLE** | Re-measured at this baseline: `permissions` and `role_permissions` still have **zero readers, zero writers and zero value importers** outside `src/db/schema/`, and `governance-decision/authority-read.server.ts` still records that it consults neither. L3 answered the entry gate deliberately (§11.1) and left them exactly as inert as it found them. A table is not an authority. |
| Security policy authority | **UNAVAILABLE** | The `policies` table has **zero importers** of its schema symbol. No policy evaluator is connected; the Heby action governance gate reports `not-connected`, which **blocks** eligibility rather than passing it. |
| Ingested-content trust boundary — **TB-1** | **CLOSED — released** | TB-1 released at `047dde8`. `heby-runtime/trust-boundary.ts` names the boundary and classifies **every** field of a model request as `Record<keyof ModelGenerationRequest, TrustClass>`, so a new path into model context cannot arrive unclassified without failing to compile. It records its own limits as data: `structurallyIsolatedInInferenceRequest: false`, `restsOnModelCompliance: true`, `detectsInjectedInstructions: false`. Zero schema, zero writer. |
| **ERA I — HEBUN TRUSTWORTHY FOUNDATION** | **CLOSED** | Closed at `047dde8` against the §11 contract, measured row by row — see §11.3. L1–L4 released and re-verified; all four §11.1 Security & Trust gates measured CLOSED. |
| **ERA II — HEBUN INTELLIGENCE** | **OPEN** — bounded direction recorded (§12) | Era II opened when Era I closed. A read-only discovery pass ran and **every finding was reproduced against the repository at this baseline before it was recorded** (§12). **E2-1, E2-2 and E2-3 are all CLOSED**, and the product-experience milestone **LMX-1** that followed E2-3 is closed too — implemented, released and pushed at `dfa7624`, `7b30893`, `00eda19` and `8fb299e`. E2-3 and LMX-1 are **DEPLOYED and PRODUCTION-ACCEPTED** — server-side and authenticated UI acceptance both PASS, after a production migration repair carried the deployment's database from ledger 37 to 39 (§12.3); E2-1 and E2-2 have **no measured deployment** (§12.2). **E2-4 — Organizational Attention Observation — is CLOSED too**, activated by Director decision after a read-only discovery pass and released with zero schema, zero migration and zero writer (§12.4). **No Era II milestone is currently active**, and closing five milestones closes no era: the next must be selected from measured repository and product reality, never from numbering. |
| Era III | **NOT ACTIVE** (§13) | — |

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

## 12. Era II — Bounded Delivery Direction

```
ERA II — HEBUN INTELLIGENCE = OPEN (no milestone active)
```

Era II opened when Era I closed at `047dde8` (§11.3). A read-only Era II discovery and prioritization pass then ran, and **every finding it returned was reproduced against the repository at `0005f72` before it was recorded here** — because a discovery result is not repository truth (§18, rule 5). The reproduction is summarised below and its measurements are the evidence column of §9.

**Exactly one milestone is active, and it is active for discovery and design — not for implementation.**

| # | Milestone | Status |
|---|---|---|
| **E2-1** | **Heby Organizational Intelligence Foundation** | **CLOSED** — implemented · released · pushed at `dfa7624` · **deployment not measured** (§12.2) |
| **E2-2** | **Security Observation Connection over authoritative records (S-B)** | **CLOSED** — implemented · released · pushed at `7b30893` · **deployment not measured** (§12.2) |
| **E2-3** | **Live Map Intelligence — authoritative layers** | **CLOSED** — implemented · released · pushed at `00eda19` · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.3) |
| **LMX-1** | **Live Map Product Experience v1 — visual map + global awareness** | **CLOSED** — implemented · released · pushed at `8fb299e` · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.3) |
| **E2-4** | **Organizational Attention Observation — elapsed time over authoritative records** | **CLOSED** — implemented · released · pushed · **deployment not measured · not production-accepted** (§12.4) |

**No closure authorized its successor by succession.** E2-2's entry conditions were re-measured from code before it opened, and E2-3's activation was a Director decision recorded here — not an inference from E2-2 closing. **Era II itself remains OPEN**; three milestones closing close no era. **E2-3 was the last item in the bounded order, and no E2-4 exists.** A fourth milestone is not created by the fact that numbering can continue — the next Era II milestone must be selected from measured repository and product reality, by a Director decision recorded here. *(That last sentence is how **E2-4** was in fact chosen — from a read-only discovery pass, by Director decision, recorded in §12.4. The rule held; only the "no E2-4 exists" state is superseded.)*

```
E2-1 CLOSED  != HEBY INTELLIGENCE COMPLETE
E2-2 CLOSED  != SECURITY COMPLETE
E2-2 CLOSED  != SECURITY COMMAND CENTER COMPLETE
E2-3 CLOSED  != LIVE MAP COMPLETE
E2-3 CLOSED  != LIVE MAP INTELLIGENCE COMPLETE
ERA II OPEN  != ERA II WORK REMAINING IS DEFINED
NUMBERING    != A MILESTONE
RELEASED     != DEPLOYED
```

Anything after E2-3 remains provisional pending repository reality, and **nothing after it is currently scheduled**. **This is not a long fixed Era II roadmap and must not become one.** E2-3 is now closed; its closure opens nothing. **No E2-4 is invented or activated here**, and no Live Map layer beyond the one E2-3 released is implemented, connected, or authorized by appearing anywhere in this document. *(E2-4 was activated later, by a separate Director decision after its own discovery — see §12.4. Nothing in this paragraph authorized it.)*

```
ERA II ACTIVE != ALL ERA II WORK AUTHORIZED
PLANNED       != IMPLEMENTED
IMPLEMENTED   != CONNECTED
CONNECTED     != AVAILABLE
AVAILABLE     != AUTHORIZED
AUTHORIZED    != EXECUTED
SAFE TO BUILD != SHOULD BUILD FIRST
```

### The superseded provisional sequence — preserved, not rewritten

The sequence below was Era II's direction of record before discovery ran. It is **superseded as an order** and kept verbatim, because a provisional sequence that was honestly held is historical evidence, not a draft to be tidied (§3, principle 8).

```
ASA-2 — Windowed Evidence Seam
  → Agent Registry
  → Live Map Intelligence
  → Heby Intelligence
```

*Why it was retired, as recorded when it was retired:* it was authored before L3, L4, SEC-4 and TB-1 existed. Era I changed what is available to build on — an organization read seam, a Live Map projection, a hardened observation boundary and a named trust boundary — and a candidate that was merely safe to build first is not thereby the right one.

Repository discovery superseded it in four specific places, each recorded below rather than silently dropped:

- **ASA-2 cannot lead**, because the comparable evidence it needs does not exist in the repository in a comparable form.
- **Agent Registry is rejected as previously conceived** — the identity authority it would duplicate already exists.
- **The fifth candidate the sequence predated** — connecting a security surface to the audit sink that already exists — is now **E2-2**.
- **Heby Intelligence moved from last to first**, because Era I created authoritative organizational context *after* Heby Core had already closed, leaving a gap that nothing else in the list closes.

Later intelligence work may still include, **according to dependency discovery**: Director Intelligence · Director Twin foundations · Memory · Learning · Advanced Self-Improving Agents · Organizational Intelligence evolution · Evaluation · multi-agent intelligence. No precise implementation order is fabricated here for systems whose prerequisites have not yet been rediscovered.

```
LOCKED ORDER != PROVISIONAL ORDER != FUTURE DIRECTION
```

### What repository discovery reproduced

Measured at `0005f72`, which is docs-only over the Era I closure baseline `047dde8` — so every `src` measurement in §9 holds unchanged here.

| # | Finding | Measurement |
|---|---|---|
| A | **Heby consumes neither the L3 Organization Authority seam nor the L4 Live Map projection.** | No file under `src/features/heby-*` imports `organization-authority` or `features/live-map`. The importers of L3 are `/director/organization`, its component, and L4's own reader; the importers of L4 are `/live-map` and its canvas. Heby is in neither set. |
| B | **Both seams remain read-only and legitimate to consume.** | Zero `insert`, `update`, `delete` or `transaction` in either `src/features/organization-authority/` or `src/features/live-map/`. L4 already consumes L3, so the composition direction is not hypothetical. |
| C | **Consuming them requires no new authority.** | Both are `async function read…(tenant: TenantContext \| null, deps)` — the tenant is the only parameter, and Heby already carries `TenantContext` in thirteen modules. Heby already consumes a governance read seam of exactly this shape (`heby-commands/read-commands.server.ts` → `governance-activity/observe.server.ts`), so the pattern is released, not invented. |
| D | **S-B has an existing tenant-scoped read-only observation seam that Security Center does not read.** | `governance-activity/read.server.ts` and `act-history-read.server.ts` are tenant-scoped aggregate and paged readers over `audit_log` with zero write verbs. No file in `src/features/security-center/` imports either. Re-measured: **no source carries `state: "connected"`**. |
| E | **S-B has no hard dependency into E2-1.** | *Re-measured at `dfa7624`, and the original wording is corrected here rather than restated:* neither directory references `organization-authority` or `features/live-map` — zero hits in both. `governance-activity/` references Heby not at all. `security-center/contracts.ts` does carry **type-only** imports of `@/features/heby-integration` and `@/features/heby-actions` — true at `0005f72` as well, so this is a wording defect in the finding, not a change E2-1 caused. Neither is the Heby answer flow E2-1 touched, and a type import creates no dependency on E2-1's capability. The substantive claim stands: **the dependency runs in neither direction.** |
| F | **Live Map Intelligence has ready-now authoritative layers, and none of them must precede E2-1.** | Tenant-scoped read-only seams already exist for Knowledge (`knowledge/knowledge-read.server.ts`), proposals (`action-authorization/read-action-authorizations.server.ts`), integrations capability (`integration-authority/integration-read.server.ts`) and Governance activity (`governance-activity/read.server.ts`). Candidacy is not admission (see E2-3). |
| G | **ASA-2 still lacks comparable, windowed evidence.** | No time-window predicate exists anywhere in `agent-outcome-observation/`, `agent-evaluation/` or `agent-improvement-hypothesis/`. The counts are unbounded `count(*) filter (…)` over every row that exists; the one `now` parameter classifies permit expiry, not a window. Cumulative totals cannot express before-and-after. |
| H | **Agent identity authority already exists.** | `src/features/agent-identity/` holds create, read and retire. They are also the **only two writers of the `agents` table** in `src`, and both write identity and lifecycle. |
| I | **A generic Agent Registry would duplicate that authority or create a new one.** | `agents` carries **21 behavioural `jsonb` columns** — `reasoning_profile`, `tool_profile`, `allowed_tools`, `execution_defaults`, `cost_limits`, `performance_targets` and the rest. Measured two ways: **no `agents.<column>` accessor for any of the 21 appears anywhere in `src` or `tests`**, and the two writers set none of them. Their only references outside `src/db/schema/` are optional type declarations in `platform-core/agent/types.ts` — a type is not a reader. The genesis ceremony writes none of them and says why: *"writing a plausible value would be the first lie in the record."* |
| J | **Internal organization structure remains unavailable.** | `db/schema/organization` and `db/schema/department` have **zero importers outside `src/db/schema/`**. The sole reference anywhere else is `tests/l3-organization-authority/firewall.ts`, which names them as *forbidden*. Unchanged from §9. |

One finding was **understated** by discovery rather than contradicted, and the stronger reading is recorded here: **S-B is already a named concept in released repository evidence.** `tests/sec4-security-boundary/firewall.ts` carries a section titled *"THIS GATE ADMITS S-B"* which names `S_B_READ_SEAMS` as exactly those two readers and asserts, at SEC-4 time, that the Security Center firewall would not refuse them. E2-2 therefore begins against a gate that was written to admit it.

No finding was contradicted by the repository.

### E2-1 — Heby Organizational Intelligence Foundation · **CLOSED**

```
E2-1 = CLOSED
IMPLEMENTED · RELEASED · PUSHED · NOT DEPLOYED
```

Released at `dfa76248c38bad2c994e1494ac41896296b09067`, on `main`, and pushed — `git ls-remote` reports the same SHA at `refs/heads/main`, 0 ahead / 0 behind. **It is not deployed.** No repository evidence records a deployment of this commit, and until one exists the released capability is not running for any customer.

```
RELEASED != DEPLOYED
```

#### What E2-1 actually delivers

One thing, stated narrowly:

```
HEBY
  ↓ consumes, as ordinary evidence
ORGANIZATION AUTHORITY (L3)
```

Heby can now ground an answer in **the organization this tenant IS** — read from the released Organization Authority through a normal Heby evidence source. Re-measured at `dfa7624`, the essential properties are:

| Property | Measured state |
|---|---|
| Source class | **`organization`** — admitted through the closed `HebySourceClass` vocabulary and the pure resolver's exhaustive `switch`, not around them |
| Evidence standing | **Authoritative** (`authoritative: true`) — `companies` IS the organization record and L3 is its released read authority |
| Truth owner | **Organization Authority remains the owner.** Heby is a consumer and holds neither `readOrganizationAuthority`, nor `companies`, nor a database handle |
| Projection location | Inside the authority — `organization-authority/heby-organization-source.server.ts`. Its **only** value import is `./read-organization.server`; everything else is a type |
| Live Map | **Not on the dependency path**, at any depth (see §9) |
| Internal structure | **Unavailable**, and carried as the authority's own refusal sentence **verbatim** |
| Agents | **Not admitted.** Durable agent identity belongs to the Agents product line and would need its own class and its own admission |
| Persistence | Zero new persistence. Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · writer delta 0 · dependency delta 0 |
| UI | **Zero UI architecture change** — no file under `src/app/` or `src/components/` was touched |
| New authority | **None.** No lifecycle, authorization, execution, organization, Live Map, agent, Governance or provider authority was created |
| TB-1 | **Unchanged.** No new trust class and no new model-request field; the evidence reaches the model as `untrusted-content` like every other piece of grounding |

What travels under the class: the organization's name, slug, lifecycle status, tenant status, origin ceremony, a **count** of live human members, and the authority's statement that internal structure has no owner. The citation reference is the **slug**, never the tenant id.

```
ORGANIZATION IDENTITY  != ORGANIZATION STRUCTURE
HUMAN MEMBER COUNT     != MEMBER ROSTER
AUTHORITATIVE EVIDENCE != INSTRUCTION
HEBY                   != ORGANIZATION AUTHORITY
```

#### What E2-1 does NOT mean

Recorded because a closure that omits its own limits is not a truthful closure:

- **Internal organization structure is still unavailable.** No department, team, reporting line, roster, individual member, role, band or permission is readable — not filtered out, but **absent from the contract**: L3 measured that `roles` has no `organization_id`, and `organizations`/`departments` have no writer and no reader. There is no field to read.
- **Agent intelligence is not part of E2-1.** No agent fact travels under this class.
- **Live Map is not a Heby domain seam**, and **a future Live Map layer does not automatically become Heby evidence.** E2-3 adding a domain to `LiveMapProjection.domains` cannot reach model context, because Heby is not downstream of that array at any depth.
- **No new execution authority exists.** No new Governance authority exists. No provider mutation authority exists.
- **Prompt injection is not solved.** TB-1's recorded limits are unchanged: `structurallyIsolatedInInferenceRequest: false`, `restsOnModelCompliance: true`, `detectsInjectedInstructions: false`.
- **E2-1 is not deployed.**
- **Heby Intelligence is not complete.** E2-1 is one bounded foundation milestone — the organization admitted as one source class — and nothing wider.

```
E2-1 CLOSED         != HEBY INTELLIGENCE COMPLETE
STRUCTURE UNAVAILABLE != STRUCTURE EMPTY
FUTURE LIVE MAP LAYER != AUTOMATIC HEBY EVIDENCE
```

#### One product-intent line the implementation contradicted

This section previously recorded, as product intent, that Heby would *"reason over the admitted Live Map projection"* and *"reference Live Map context where legitimate."* **E2-1 Discovery & Design rejected that**, and the released firewall now asserts its absence. The intent is corrected here rather than deleted: it was honestly held before the two type declarations that decided it were read, and §3 principle 8 keeps superseded positions visible.

#### Validation as released

`568/568` suites pass at the release commit. Re-run at `dfa7624` for this alignment, narrowly: the three E2-1 suites (`organization-grounding`, `grounding-firewall`, `bite-proofs` — **9 mutations, all bit**), the two suites E2-1 repaired (`heby-integration/contracts`, `int5a-flow/bite-proofs`), and `l3-organization-authority/firewall`. All six pass.

### E2-2 — Security Observation Connection over authoritative records (S-B) · **CLOSED**

```
E2-2 = CLOSED
IMPLEMENTED · RELEASED · PUSHED · NOT DEPLOYED
```

Released at `7b30893`, learnings at `e5dd1bc`, both on `main` and pushed. **It is not deployed.** No repository evidence records a deployment, and until one exists the released capability is not running for any customer.

```
RELEASED != DEPLOYED
```

#### What E2-2 actually delivers

One thing, stated narrowly:

```
SECURITY ROUTE
  ↓ resolves the session tenant, then composes
GOVERNANCE-ACTIVITY SECURITY OBSERVATION PROJECTION
  ↓ observeRecordedActHistory
BOUNDED READER  →  audit_log
```

The Security Center can now observe **the governed acts Hebun itself recorded for this tenant**. Re-measured at `e5dd1bc`:

| Property | Measured state |
|---|---|
| Connected source classes | **Exactly one — `audit`.** The other nine keep their released states; `hasConnectedSecurityFeed()` computes `true` from the map |
| Connected domains | **Exactly one — `data-access`**, the row bound to that source class. Its detail denies data classification, DLP and exfiltration detection |
| Evidence standing | **Derived.** `authoritative` is the literal `false`, so claiming otherwise is a compile error as well as a test failure |
| Truth owner | **`audit_log` remains the authority**, written by nine `governance-audit` writers and by nothing else |
| Projection location | Beside the readers — `governance-activity/security-observation-source.server.ts`. Its only value imports are `./contracts` and `./observe.server` |
| Security Center holdings | **No database handle, no writer, no query, no tenant predicate, and no `features/governance` import.** The released token firewall and SEC-4's handle ban both pass unweakened |
| Tenant flow | `resolveTenantContext()` → the seam's own SQL predicate, verbatim. **No tenant-id parameter exists**, so a cross-tenant read is unrepresentable |
| Admitted fields | Eight recorded-act facts, named one by one — plus the independent total, truncation, read time, provenance and limits |
| Withheld | All ten `WITHHELD_AUDIT_COLUMNS` — no actor id, no entity id, no jsonb payload, no principal hash |
| Bounds | The released page limit of 20, with the total counted **independently** so truncation is visible rather than capped |
| Freshness | **A read taken for the request.** Not a stream, not continuous monitoring, and the surface says so |
| Persistence | Zero. Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · writer delta 0 · dependency delta 0 |
| New authority | **None** |

Three outcomes are kept apart, because collapsing any two is the defect the slice exists to prevent: `recorded`, `known-empty` (the ledger was read and holds nothing — a fact about the organization), and `unavailable` with three distinct reasons that never merge.

```
AUTHORITATIVE RECORD != AUTHORITATIVE OBSERVATION
DERIVED OBSERVATION  != AUTHORITATIVE SECURITY TRUTH
KNOWN EMPTY          != UNAVAILABLE
REQUEST-TIME READ    != REAL-TIME STREAM
ZERO RECORDED ACTS   != SECURE
```

#### What E2-2 does NOT mean

- **No Security Finding authority.** None existed and none was created; `isBreachConfirmable()` is still `false`.
- **No Security Incident authority.** `incidents` is typed `readonly never[]` — an incident is unconstructable, which is stronger than empty.
- **No policy authority and no trust authority.** Both still measure UNAVAILABLE (§9).
- **No security score**, and none is derivable from activity: more recorded acts do not mean less secure, and fewer do not mean more.
- **No forensic completeness.** `audit_log` records what authorized actors did; it evidences no intrusion.
- **No real-time stream, no live feed, no incident or threat detection, no autonomous response**, and no Security execution or authorization authority.
- **E2-2 is not deployed.**
- **Security is not complete, and the Security Command Center is not complete.** One derived observation is connected; nine source classes are not.

#### The bounded prerequisite, and what it turned out to be

SEC-4 retired three false Security denials and guarded **one file**, so two went on being served from `domains.ts` and a third from `pipeline.ts`. All three are repaired and SEC-4's truth scan now covers every entry point.

Two further defects were found by **running** rather than reading, and both are recorded because neither was visible to design review:

- The full suite failed on `s1-flow`. Heby's `/security` command reads the same source map from outside every Security Center guard, and would have announced *"A live security feed is connected"* while listing that same class under *"Not connected"*. Repaired and pinned.
- An E2-2 bite-proof **survived**: no test anywhere asserted that the reader's tenant expression references `audit_log.tenant_id` — the released guard counts the expression and its two uses, all of which still pass when it is gutted. E2-2 inherits that predicate for its tenant isolation, so it now asserts its content.

SEC-4's transitive floor moved from `[]` to the exact thirteen-file session/handle enumeration, as SEC-4 itself instructed, plus a second assertion that the **read path contributes zero writers** — every writer in that floor arrives through `resolveTenantContext`, not through the evidence.

#### Validation as released

`572/572` suites pass. **18 E2-2 mutations bite, 13 SEC-4 mutations bite, zero residue.** Typecheck clean, lint 14 pre-existing warnings and zero new, build compiles.

### 12.2 Deployment truth — a correction to how it was being decided

Every Era II closure above recorded **NOT DEPLOYED**, justified by the sentence *"no repository
evidence records a deployment."* That reasoning was wrong, and the wrongness is worth keeping rather
than quietly overwriting: **a deployment does not leave repository evidence.** It lives in the
hosting platform, and nobody had looked there.

Measured directly at the platform: `www.hebuntech.com` is aliased to the `hebun-ai-recovered`
project, which **deploys to production automatically on every push to `main`**. The two pushes that
released E2-3 produced two production deployments, the second created six seconds after the
`3eb99af` commit; LMX-1's push produced another, `dpl_C8uP8jbspvnz13Mw7Pno3JgsBBNA`, which the
production alias now resolves to.

So the correct distinction is not deployed-versus-not. It is:

```
DEPLOYED != PRODUCTION-ACCEPTED
```

**E2-3 and LMX-1 are DEPLOYED**, measured. Neither is production-accepted: nobody has verified the
authenticated rendering in production, which needs a real session this work does not create.
*(That last sentence was true when written and is now **superseded by §12.3** — the session was
created, and both are production-accepted. It is kept because the state it records is evidence.)*

**E2-1 and E2-2 are recorded as `deployment not measured` rather than re-labelled deployed.** The
same automatic mechanism was almost certainly in force at their commits, but *almost certainly* is
not a measurement, and the defect being corrected here is precisely the habit of inferring a
deployment fact from something that cannot carry it.

What production acceptance would require, stated so it is not mistaken for done: an authenticated
session on `www.hebuntech.com` opening `/command`, `/live-map` and the Security Center and
confirming the rendered surfaces against this document. Until then:

```
DEPLOYED · AUTHENTICATED PRODUCT ACCEPTANCE UNAVAILABLE
```

**The paragraph and the block above are SUPERSEDED for E2-3 and LMX-1 by §12.3**, and kept verbatim
because a state that was honestly held is historical evidence rather than a draft to be tidied (§3,
principle 8). They still stand for every other milestone: E2-1 and E2-2 remain
`deployment not measured`, and the Security Center has had no authenticated production acceptance.

### 12.3 Production acceptance — E2-3 and LMX-1 · **PRODUCTION-ACCEPTED**

```
E2-3   = PRODUCTION-ACCEPTED
LMX-1  = PRODUCTION-ACCEPTED
```

Deployment was never the thing standing between these two milestones and production acceptance. The
code had been running since the pushes recorded in §12.2. What stood in the way was that the
**production database was behind the release**: its applied migration ledger was at **37** while the
repository authored **39**. Migration 38 adds `heby_origination_invocations.agent_id`, and two of the
eight released Agent Outcome readers name that column — so on production both statements failed,
`readAgentOutcomeCore` returned `unavailable`, and every agent node on the authenticated Live Map
rendered `Outcome observation unread`. Nothing was broken in the deployed code, and nothing there
needed fixing.

**Production migration repair 37 → 39 — SUCCESSFUL.** The authorized `platform:migrate` ceremony was
run by the Director against the production target and applied exactly two migrations:
`20260828173456_sia26_origination_agent_attribution` and
`20260828190630_sia3_agent_improvement_hypothesis`. It reported schema converged, its backup
validated, and its organizational fingerprint unchanged across every counted table.

**Independently verified, read-only, against the production target.** The ceremony's own report is
not the measurement; a separate read-only pass was taken afterwards and is what this section records.

| Measured | Result |
|---|---|
| Target | Bound by `pg_control_system().system_identifier` and `current_database()` before any number was trusted, because a schema fingerprint cannot identify a deployment (G4). PostgreSQL **18.6**. **Both pin values stay out of band and are deliberately not recorded here** — that is G4's design, and this repository is public |
| Ledger | **39 applied, converged**, digest `bbc1d66cdcfddea3292b46361a6a4856` equal to the canonical digest of this checkout |
| Strength of that claim | **exact canonical hash prefix, in order — not a matching count.** A count cannot tell a target missing migration 12 from one missing 34, nor one whose migration 20 was applied from a file later edited |
| Migration 38 structures | `agents_tenant_id_uq`; `heby_origination_invocations.agent_id` `uuid` **nullable**; FK `heby_origination_invocations_tenant_agent_fk` on `(tenant_id, agent_id)` `ON DELETE RESTRICT`; index `heby_origination_invocations_tenant_agent_idx` |
| Migration 39 structures | `agent_improvement_hypotheses` present with its five CHECK constraints, three foreign keys and three indexes |
| Historical integrity | attribution conflicts **0** · FK orphans **0** · `agent_improvement_hypotheses` rows **0** · organizational fingerprint unchanged |
| Attribution | **no backfill was invented.** The one historical invocation predates attribution and remains `agent_id NULL` |

**`__drizzle_migrations.created_at` is the authored journal timestamp, not the moment a migration was
applied to production.** Drizzle stores the journal's `when`, so those values are properties of the
repository's files. Reading them as an application time would be the easiest wrong sentence to write
about this repair, and no measurement here rests on them.

**Server-side production acceptance — PASS.** All eight released Agent Outcome readers return
`status: "read"` against production, where two of them previously could not run at all. Measured
production truth for the one durable agent:

| | |
|---|---|
| Proposals filed | **2** — both awaiting a decision, 0 withdrawn |
| Governance | approved **0** · rejected **0** · permits issued **0** · approved-never-executed **0** |
| Execution | attempts **0**, and all five outcome classes 0 |
| Model | linked invocations **1** |
| Selection | attributed **0** |
| Provenance | historically unattributed **1** · attribution conflicts **0** |

**The zero selection attribution is correct, not missing data.** The single recorded invocation was
written before attribution existed; it stays `agent_id NULL` for ever, and the reader counts it at
the tenant level as historically unattributed rather than assigning it to the only agent present.
Inventing that link would have been the one edit that made every number on the surface look better
and one of them false.

Boundaries were re-measured on the same pass: a null tenant returns `no-authorized-tenant-context`; a
foreign tenant returns a successful read holding **no Tenant Zero data**; an absent `DATABASE_URL`
returns `unavailable` rather than a fabricated zero; a remote control-plane target without the
explicit flag is refused; and the server-only seams refuse a browser runtime.

**Authenticated production UI acceptance — PASS.** The Director authenticated to
`www.hebuntech.com` and inspected the Live Map agent inspector directly. It rendered Heby *in
service* with 2 filed, 0 approved and 0 never executed, and the full derived block — three activity
counts, eight governance counts and six execution counts — agreeing with the independently measured
server-side truth. `AUTHORITATIVE · DURABLE AGENT IDENTITY` rendered as a block visibly separate
from `DERIVED · AGENT OUTCOME OBSERVATION`; the four execution non-claims were visible; and the
`belongs-to` edge still stated `agents.tenant_id` as its basis while claiming no departmental
placement, ownership or assignment. The `Outcome observation unread` state is gone.

**Two independent measurements, and they agree.** That agreement is the whole content of the
acceptance: the server-side pass could not see what a rendered surface says, and the authenticated
pass could not prove what the database holds.

```
MIGRATION APPLIED      != APPLICATION ACCEPTED
SERVER-SIDE PASS       != UI ACCEPTED
UI RENDERED            != EXECUTED
APPROVED               != EXECUTED
PROVIDER ACCEPTED      != DELIVERED
DERIVED OBSERVATION    != AUTHORITATIVE ORGANIZATIONAL TRUTH
HISTORICALLY UNATTRIBUTED STAYS HISTORICALLY UNATTRIBUTED
```

**What this acceptance does not open.** It closes no era, selects no milestone and creates no E2-4.
Era II remains **OPEN with no active milestone** (§20). E2-1, E2-2 and the Security Center are
untouched by it and remain without authenticated production acceptance.

**One non-blocking follow-up candidate, recorded and NOT scheduled.** Every one of the eight readers
ends in a bare `catch { return { status: "unavailable", reason: "read-failed" } }`. That is what the
behind-by-two production database actually looked like from the outside: a surface saying the
observation was unread, naming no cause, with the missing column never mentioned. The refusal was
honest and fail-closed — it invented nothing — but it cost the incident its diagnosis. This
repository has recorded the same shape once before, as *"a swallowed `persistence-unavailable` …
exactly the failure mode a catch-all refusal is worst at explaining"* (learnings, G-series). It is a
**candidate**, not a milestone: nothing here schedules it, and it does not become the next Era II
item by being written down.

### 12.4 E2-4 — Organizational Attention Observation · **CLOSED**

```
E2-4 = CLOSED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYMENT NOT MEASURED · NOT PRODUCTION-ACCEPTED

AGE     != IMPORTANCE
WAITING != LATE
NO THRESHOLD IS A POLICY
```

**Activated by Director decision, not by numbering.** Era II's bounded order ended at E2-3 and LMX-1
followed it as a product-experience milestone. This is the first Era II milestone selected from a
read-only discovery pass over measured repository reality, which is exactly how §12 said the next
one had to be chosen. **The sentences above saying "no E2-4 exists" recorded a true state and are
superseded by this section**; they are kept because a state honestly held is evidence (§3,
principle 8).

#### The finding it was chosen for

Every durable authority in this repository writes a timestamp, and **nothing read one.** Measured at
activation: `created_at` NOT NULL on `heby_action_requests`, `action_permits`,
`action_execution_attempts`, `heby_origination_invocations`, `agents`, `decision_records`,
`knowledge_facts` and `work_artifacts`; `occurred_at` NOT NULL on `audit_log`. And **zero** elapsed,
age, waiting-since or oldest computation anywhere in `action-authorization/`,
`agent-outcome-observation/`, `governance-activity/`, `live-map/` or `command-overview/`. The
released queue reader had been projecting `proposedAt`, `issuedAt`, `expiresAt`, `consumedAt` and
`revokedAt` as ISO strings since R3A, and every consumer dropped them.

So Hebun could say how many proposals were waiting and not how long. E2-4 reads what was already
there.

#### What it delivers

| | |
|---|---|
| Five authoritative bases | `action-request.created_at` · `action-request.approved_at` · `action-permit.issued_at` · `action-permit.expires_at` · `audit-log.occurred_at` — a CLOSED union, each naming one column on one table owned by one released authority |
| Four observations | awaiting a decision (count + oldest filed) · approved with no attempt recorded (count + oldest approved) · authorized and unspent (soonest expiry, longest held) · most recent recorded act |
| Heby | the `operations` source class gains a connected reader for the first time, **appended to** what the Executive Overview already contributed rather than replacing it |
| Command | each waiting item carries its own age; the oldest and the awaiting count come from an unbounded aggregate |
| Decisions | the same duration as ordinary metadata beside each proposal |
| Live Map | a factual elapsed annotation on the agent node that already exists, in its own field under its own authority |
| Persistence | **NONE.** Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · authoritative writer delta 0 · node-kind delta 0 · edge-kind delta 0 |

#### The hazard that required one new statement

`readPendingActionRequests` is `orderBy desc(created_at) limit 50`. **Newest first, bounded.** So the
oldest pending proposal is the first row that reader drops — silently, and precisely when a tenant
has enough waiting work for the answer to matter. Deriving "oldest awaiting" from it would produce a
figure that is correct on small tenants, wrong on large ones, and indistinguishable between the two.

That is R6B's finding restated for time, with a sharper edge: the ordering actively selects against
the answer. The remedy is the same one — an aggregate that needs no bound at all.
`awaiting-decision-aggregate.server.ts` contains no `.limit(`, `.offset(` or `fetch first` anywhere,
kept in its own file for R7.1.1's reason so both properties stay checkable. A postgres test builds a
tenant with sixty pending proposals, measures that the released list reader **cannot** see the
oldest, and measures that the aggregate can.

#### Two boundaries E2-4 did not cross, and one claim it had to correct

**The execution ledger was dropped, not argued for.** An earlier draft derived "how long has the
longest attempt been awaiting an outcome" from `readExecutionLedger`. GE-1 pins that read to exactly
one caller — the `/approvals` route — so the durable record of irreversible acts is read at one
place and no second surface can render a divergent execution history. The observation was removed
and a firewall now asserts that no E2-4 module reads it. `approvedUnexecuted` survives because it is
different in kind: it counts proposals with **no attempt at all**, through a `not exists` inside
action-authorization's own aggregate, and reads no execution history.

**`operations` was not an empty class, and the first draft deleted evidence.** The discovery pass
recorded it as declared-but-unconnected; the pure resolver in fact fills it from the Executive
Overview's operational sections. Substituting a fresh resolution — which is correct for Knowledge,
Governance, Integrations and Organization, whose pure defaults carry nothing — silently removed
them. R2C's released prompt-injection test caught it, because the poisoned section it tracks lives
in exactly that class.

```
A CONNECTED READER MAY ADD EVIDENCE. IT MAY NOT DELETE ANOTHER SOURCE'S.
```

#### What E2-4 is NOT, and structurally cannot become

`ElapsedObservation` carries a duration, its basis, its evaluation instant and a direction. It has
**no severity, no priority, no level, no band, no colour and no flag**, and the suite asserts that
key list by equality — a representation that cannot express a judgement cannot leak one, the same
mechanism SIA-2 used when it refused to divide. There is no urgency, threshold, target, SLA,
escalation, notification, scheduler or ranking, and none is one edit away.

A future timestamp returns **nothing**, never a negative and never a clamp to zero: a proposal filed
in the future is inconsistent data, not an age. Nothing awaiting is a count of zero and **no oldest
at all**.

The released `ExecutionLedgerEntry.requiresAttention` predicate stays **status-derived**: a firewall
asserts no elapsed input reaches it, because age leaking into that predicate is the single edit that
would turn this milestone into a policy authority.

```
AGE                  != IMPORTANCE
WAITING              != LATE
OLD                  != URGENT
NO THRESHOLD IS A POLICY
OBSERVATION          != DECISION
OBSERVATION          != AUTHORIZATION
OBSERVATION          != EXECUTION
UNAVAILABLE          != ZERO DURATION
ANNOTATION           != CLASSIFICATION
```

A future policy authority may one day decide what a duration means. **E2-4 does not**, and creating
one requires its own discovery and its own Director authorization (§18, rules 6 and 8).

#### Validation as released

`587/587` suites pass. Typecheck clean, lint 14 pre-existing warnings and zero new, build compiles.
Three released proofs were repaired rather than weakened: CMD-B1's enumerated import pin grew 4 → 5,
APP-1's permitted-reader list gained its first feature module **and** a direct assertion that the
composition holds no statement of its own, and E2-1's M9 bite-proof anchor was re-pointed after a
variable rename — the harness reported *"the mutation would prove nothing"* rather than passing,
which is the behaviour that makes another phase's proof recoverable instead of silently retired.

**Deployment is NOT measured and production acceptance has NOT occurred.** The push may trigger a
production deployment automatically (§12.2); that is a separate, later, independently measured state
(§16), and nothing here asserts it.

### E2-3 — Live Map Intelligence, authoritative layers · **CLOSED**

```
E2-3 = CLOSED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYED · PRODUCTION-ACCEPTED
```

Released at `00eda19`, learnings at `2aff237`, both on `main` and pushed. **It is deployed** — the
push triggered a production deployment automatically (§12.2) — and it is now **production-accepted**
(§12.3): a production migration repair carried the deployment's database from ledger 37 to 39, after
which an independent read-only pass and an authenticated session on `www.hebuntech.com` measured the
same truth and agreed.

```
RELEASED != DEPLOYED
```

#### What E2-3 actually delivers

One thing, stated narrowly — **existing authoritative Agent nodes enriched with a derived cumulative Agent Outcome observation, joined by durable agent id**:

```
LIVE MAP ROUTE
  ↓ resolveTenantContext()
readLiveMapProjection(tenant)
  ↓ third authority, awaited independently
agent-outcome-observation/live-map-agent-outcome.server.ts
  ↓ readAgentOutcomeObservationIndexed
readAgentOutcomeCore  →  8 grouped aggregate statements + 1 identity read
```

Re-measured at `2aff237`:

| Property | Measured state |
|---|---|
| Node delta | **Zero.** Two node kinds — `organization`, `agent` — unchanged. No proposal, Governance, permit, execution, activity, human or department node exists |
| Edge delta | **Zero.** One relation, `belongs-to`, carrying `agents.tenant_id`. Node and edge counts are identical with and without evidence |
| `LiveMapTruth` | **Unwidened — still one member, `"authoritative"`** |
| Truth classes | **Two, in two separate fields, each a single-value union.** The node keeps `truth: "authoritative"`; the attachment carries `truthClass: "derived"`. Neither value is representable in the other's field |
| Join | **`identity.agentId` only** — the same value that builds the node's `nodeId`. Never name, never array position, never timestamp, never similarity. Two fixture identities share a name and the numbers follow the id |
| Authority ownership | The seam lives **inside** the owning authority, `src/features/agent-outcome-observation/`. Live Map restates no join, names no proposal/permit/execution/invocation table, and consumes no `/agents` page or presentation model |
| Back-import | **None.** No file under `agent-outcome-observation/` references `features/live-map` |
| Raw identifier on the surface | **None.** The observation still carries no agent id; the key lives outside it. Asserted by uuid *shape*, not by the fixture's value |
| Attached measures | 17 counts in three groups — proposals filed / awaiting a decision / withdrawn · approved · rejected · permits issued, active, expired, consumed, revoked · **approved-never-executed** · attempts, awaiting an answer, accepted, refused, failed, unknown |
| Derived claims | **None.** No rate, ratio, percentage, score, ranking, grade or comparison between agents. Every measure is a whole non-negative count |
| Freshness | **Cumulative since each agent identity was established, stated in words.** The released statements carry no date predicate, so the surface refuses *real-time*, *today*, *last 24 hours*, *recent activity* and *currently* — banned in the model and again in the rendered page |
| Unavailable semantics | **Three outcomes, three sentences**: the evidence could not be read · the evidence was read and holds no entry for this identity · the evidence was read and these are the counts. An unread observation carries **no `groups` property at all**, so a zeroed row is unconstructable |
| Completeness | `unresolvedAgentProposals` is reported at projection level, present even when it is zero, and **absent** when the evidence was never read — a total over nothing is not a total. No agent is invented to hold unplaced proposals |
| Tenant flow | `resolveTenantContext()` → the seam → the released fact readers' own predicates. **No tenant, organization, slug, scope or agent parameter exists** at either seam, and Live Map owns no filter of its own |
| Tenant predicate | Pinned by **content and by exact count** — `"<table>"."tenant_id" = ${resolved.tenantId}` on all four tables, **13 bindings exactly**. A floor pin (`>= 11`) passes when one statement's predicate is deleted; the exact pin does not |
| Query shape | **9 statements — one identity read plus eight grouped aggregates — measured constant from 1 to 60 agents** with a counting handle. Live Map issues the outcome read **once** for 40 nodes |
| Writer firewall | The closure grew by **4 files** (the seam, the indexed read, the fact readers, and `governance-decision/{contracts,persistence}`). **Zero durable writers** outside the ambient session floor, and fifteen reachability bans — origination, decision, permit, revocation, execution, identity, model, credential, kill switch, Knowledge, agent CRUD — all empty |
| Mock firewall | Zero fixtures reachable. No department is inferred from a title; Organization Structure is **still unavailable and still stated** |
| UI delta | One disclosure block per agent card (`details`/`summary`), one completeness line. **No redesign, no control** — `button`, `form`, `input`, `select`, `onClick`, `onSubmit`, `useState` all absent from the rendered markup |
| Persistence | Zero. Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · new table 0 · writer delta 0 · authority delta 0 |

```
AUTHORITATIVE AGENT IDENTITY != AUTHORITATIVE OUTCOME
AGENT NAME                   != AGENT IDENTITY
DERIVED OBSERVATION          != AUTHORITATIVE OUTCOME AUTHORITY
UNAVAILABLE                  != ZERO ACTIVITY
CUMULATIVE                   != CURRENT
REQUEST-TIME READ            != REAL-TIME STREAM
APPROVED                     != EXECUTED
EXECUTED                     != SUCCESSFUL
COUNT                        != SCORE, RATE OR RANKING
UNKNOWN AGENT ID             != PERMISSION TO INVENT AN AGENT
```

#### What E2-3 does NOT mean

- **No new node type.** Proposals, Governance decisions, permits, executions, activity, humans and departments are **not** entities on the map.
- **No new edge type.** `agent → proposal`, `proposal → Governance` and `Governance → execution` were not created. They may become legitimate later; they were not needed for this slice.
- **No real-time stream.** The map is a request-time read and the evidence is cumulative. Nothing polls, subscribes or refreshes.
- **No score, rate, ranking or comparison between agents**, and none is derivable from these counts: the strongest positive value available is `accepted`, and accepted is not delivered.
- **No Organization Structure.** Departments, teams, reporting lines and a human roster remain unavailable, and the map still says so rather than omitting them.
- **No Knowledge layer, no Security layer, no Integration layer.** All three stay deferred; E2-2's derived observation was not projected onto the map.
- **No execution authority, no Governance authority, no agent authority.** Live Map cannot file, approve, reject, permit, revoke, execute or retry anything, and nothing that can is reachable from it.
- **No new truth authority.** The observation is derived; `audit_log`, `heby_action_requests`, `action_permits`, `action_execution_attempts` and the agent identity authority remain the owners of every fact drawn.
- **E2-3 is deployed and production-accepted** (§12.3). Acceptance came after a production migration repair 37 → 39: two of the eight readers name `heby_origination_invocations.agent_id`, which the deployment's database did not yet have, so the authenticated surface rendered `Outcome observation unread`. Server-side and authenticated UI acceptance now both PASS and agree. **Production-accepted is not Live Map complete.**
- **Live Map is not complete, and Live Map Intelligence is not complete.** One derived layer is attached to one node kind.

#### Two guards that only measurement could have written

Both are recorded because neither was visible to design review, and both are now released proofs:

- **A floor pin cannot tell a removed predicate from a statement that never had one.** E2-2 established that a tenant guard must read predicate *content*. E2-3 found the next layer: with thirteen `${resolved.tenantId}` bindings, deleting one statement's `where` leaves twelve, and every substring check still passes. Only an **exact** count bit.
- **An N+1 is invisible to every assertion about values** — each rendered number stays correct. The detector is a counting handle asserting that 1 agent and 60 agents cost the same. The mutation that inserts a genuine per-agent loop moves the count from 9 to 549.

One stale pin was repaired in another phase's suite as a direct consequence: splitting the outcome read into a private core left `readAgentOutcomeObservation`'s **signature byte-identical**, so every signature pin passed, while SIA-1's "durable write" bite-proof anchored on the return block that had moved. The harness reported *"the mutation would prove nothing"* rather than passing — the behaviour that makes another phase's proof recoverable instead of silently retired.

#### Product acceptance

Proved on the **released component rendering the released projection** (`renderToStaticMarkup`), not on a harness of its own:

- **BEFORE** — an agent node could say the agent exists, is in service, when it was established, and that it belongs to the organization.
- **AFTER** — the same node, opened, answers *what has this agent proposed, and what became of it*: 17 counts under three headings, each carrying the sentence that keeps it from being read as more than it is, labelled `derived · Agent Outcome Observation` beside the node's own `authoritative · Durable Agent Identity`.
- With the evidence unreadable the node renders the unread sentence and **no counts at all** — proved by asserting the three group headings are absent from the page.

#### Validation as released

`577/577` suites pass. **14 E2-3 mutations bite, zero residue.** Typecheck clean, lint 14 pre-existing warnings and zero new, build compiles.

One **pre-existing** rendering semantic, reported rather than repaired: `/live-map` is emitted as a statically prerendered route (`○`), as are every other authenticated dashboard route in this repository. That is L4-era behaviour, unchanged by E2-3 and out of its authorized scope.

---

#### The activation contract, preserved

E2-3 opened for **discovery and design only**, and the contract below is kept as it stood rather than rewritten to match what shipped (§3 principle 8). Its opening line — *not implemented, not connected, not released, not available, not deployed* — is **superseded by the closure above** on the first four; **not deployed still holds**.

#### It is not a visual-polish phase

Recorded first, because it is the most likely misreading of a milestone whose deliverable is a map:

> **E2-3 IS NOT A VISUAL-POLISH PHASE.** It is not graph styling, node animation, colour, visual redesign, decorative metrics or dashboard cosmetics.

The purpose is to determine which **existing, legitimate** organizational intelligence can be projected into Live Map **without creating or bypassing authority**. A visually sparse map backed by real authority is worth more than a rich one filled with invented organizational state.

```
INTELLIGENCE BEFORE VISUAL POLISH
TRUTH BEFORE GRAPH COMPLETENESS
```

Live Map remains a **projection and read surface**. It owns none of the truth it draws.

```
LIVE MAP != ORGANIZATION AUTHORITY
LIVE MAP != AGENT AUTHORITY
LIVE MAP != KNOWLEDGE AUTHORITY
LIVE MAP != GOVERNANCE AUTHORITY
LIVE MAP != SECURITY AUTHORITY
LIVE MAP != EXECUTION AUTHORITY
VISUALIZATION != ORGANIZATIONAL TRUTH
GRAPH NODE    != AUTHORITATIVE ENTITY
GRAPH EDGE    != AUTHORITATIVE RELATIONSHIP
```

#### The central discovery question

> Which currently implemented **authoritative or legitimately derived** Hebun facts can Live Map compose into a richer organizational intelligence projection, while preserving each subsystem's **authority, provenance, tenant isolation and truth semantics**?

Discovery answers it **from repository reality**. No implementation architecture is frozen here.

#### It does not start from an empty map

L4 is released (§9). Live Map Core v1 already composes the **Organization Authority** and **durable Agent Identity** through a read-only projection, projects two node kinds and exactly one edge — `agent belongs-to organization`, carrying `agents.tenant_id` as its basis — and states departments and people as having **no authority** rather than omitting them. `LiveMapTruth` has one member, so a derived or mock node is unconstructable. E2-3 extends that foundation; it does not replace it, and L4's history is not rewritten.

#### Candidate intelligence — candidates, not scope

Discovery **may investigate** legitimate existing read seams for: Knowledge sources · agent activity · action requests and proposals · Governance decisions · recorded governed activity · integration capability state · execution observations.

**None is approved by appearing here.** For each candidate layer, discovery must prove — from code — its authority owner, its read seam, its tenant boundary, its provenance, its truth class, its connection semantics, its bounds and performance, and its suitability for visualization. Candidacy is not admission, exactly as L4 held.

```
SOURCE EXISTS != LIVE MAP LAYER CONNECTED
```

#### What may not be invented

A map makes absence look like a gap, and a gap is the strongest possible invitation to fabricate. So: Live Map may **not** manufacture departments · teams · reporting lines · a human roster · goals · problems · tasks · work items · workflows · outcomes · risks — unless E2-3 discovery proves a legitimate **current** authority and read seam for each.

Where no authority exists, Live Map **says unavailable or omits the layer**. It never draws a plausible one.

```
ABSENCE OF AUTHORITY != EMPTY ORGANIZATION
UNAVAILABLE          != ABSENT
KNOWN EMPTY          != UNAVAILABLE
EDGE                 != INFERENCE
SHARED TENANT        != AUTOMATIC RELATIONSHIP
DERIVED              != AUTHORITATIVE
```

Edges are not created from naming similarity, and relationships are not inferred from titles unless an authority explicitly owns that inference.

#### What E2-3 activation does NOT open

- **Organization Structure Authority** remains unavailable and is **not** scheduled by this activation. Live Map may consume structure only after a legitimate authority exists — never to make the map richer.
- **A generic Agent Registry** stays rejected as previously conceived. Live Map may **observe** existing Agent Identity facts; observation grants no configuration authority, and no second identity authority or behavioural-configuration authority is opened. `AGENT IDENTITY != AGENT CONFIGURATION`.
- **ASA-2 / windowed comparable agent evidence** stays BLOCKED / DEFERRED. No time-window evidence infrastructure is built for Live Map visuals.
- **Director Intelligence / Director Twin** stays outside the active sequence. Live Map does not become a Director Twin, does not infer Director intent, and gains no advisory authority.
- **Security overlays.** E2-2's derived observation may become a Live Map input **only if** E2-3 discovery proves the projection semantically appropriate. No Security Live, Security Live Map, risk overlay, incident overlay or security-score overlay is opened here.

#### "Live" is a product name, not a guarantee

Live Map's freshness semantics are whatever the repository actually supports — a request-time read, a reload-time projection, polling, streaming or event-driven updates. **Discovery determines which.** No "live", "real-time" or "continuous" claim may be made until the query semantics prove it, the same rule E2-2 held for the audit read.

```
LIVE MAP NAME     != REAL-TIME GUARANTEE
REQUEST-TIME READ != REAL-TIME STREAM
```

#### The long-term direction, held as direction

The mature Live Map should help a Director understand the organization as a connected operational system — conceptually `Organization → Work → Agents → Knowledge → Proposals → Governance → Execution → Outcomes → Learning`. **Each layer must come from its actual authority or read seam.** The map visualizes relationships; it does not create them because they would be useful to draw.

#### Heby and Live Map stay distinct

Heby is the natural-language intelligence and navigation layer; Live Map is the visual organizational projection. Heby does not become the centre of Live Map authority, and Live Map does not become Heby's source of organizational truth where a more direct authoritative seam exists — which is exactly what E2-1 decided, from two type declarations rather than preference.

```
PRESENTATION PROJECTION != HEBY GROUNDING AUTHORITY
```

### E2-3 Discovery & Design — entry contract · **ANSWERED**

Kept as it stood. These thirty questions were the authorized action when E2-3 opened, and they were answered **from code** before implementation began — the answers are the measured table in the closure above, not this list. It is preserved rather than deleted because a contract that disappears once it is met leaves no record of what the implementation was held to.

1. What does Live Map Core v1 actually read today?
2. What facts does it currently project?
3. Which of them are authoritative facts?
4. Which are derived or presentation facts?
5. Which candidate intelligence seams already exist?
6. Who owns each candidate fact?
7. Which seams are tenant-scoped?
8. Which are bounded?
9. Which are cumulative or unbounded?
10. Which carry provenance?
11. Which expose withheld or sensitive fields?
12. Which are safe for visualization?
13. Which candidate layers would duplicate an existing authority?
14. Which would create a second source of truth?
15. Which concepts remain unavailable?
16. What does **connected** mean for a Live Map layer?
17. What does **unavailable** mean?
18. What does **known empty** mean?
19. What does **derived** mean?
20. Should Live Map compose existing projections, or consume the underlying read seams directly?
21. Where should composition ownership live?
22. How should node and edge provenance be represented?
23. Which relationships are factual, and which are presentation layout?
24. What time and freshness semantics are actually supportable?
25. Is any "live" claim supportable at all?
26. Which layers are safe to activate in the first E2-3 slice?
27. Which must remain deferred?
28. What is the narrowest useful Live Map Intelligence release?
29. What acceptance tests would prove **truth** rather than appearance?
30. Does E2-3 require schema or persistence? **Default expectation: no**, unless repository evidence proves otherwise.

### LMX-1 — Live Map Product Experience v1 · **CLOSED**

```
LMX-1 = CLOSED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYED · PRODUCTION-ACCEPTED
```

Released at `8fb299e`, learnings at `1b9f88a`, both on `main` and pushed, and deployed
automatically (§12.2). **It is production-accepted** (§12.3): the Director authenticated to
`www.hebuntech.com` and read the agent inspector, which rendered the same counts an independent
read-only production pass had measured — with authoritative identity and derived observation in
visibly separate blocks and the execution non-claims present.

**It is not E2-4.** Era II's bounded order ended at E2-3, and this is a **product-experience
milestone** authorized by a Director decision — the continuation that makes E2-3's intelligence
understandable, not the next intelligence layer. Numbering was deliberately not continued:

```
INTELLIGENCE BEFORE VISUAL POLISH
NOW THAT INTELLIGENCE EXISTS: PRODUCT EXPERIENCE MUST MAKE IT UNDERSTANDABLE
```

#### What LMX-1 actually delivers

| Property | Measured state |
|---|---|
| `/live-map` | A **visual organizational map**. Organization at the centre, agents hanging from a drawn spine, the released edge expressed as geometry **and** still printing `agents.tenant_id` as its basis |
| Organization node | Name leads; `authoritative · Organization Authority` beneath it; identifier, lifecycle, tenant status, member count and provenance one disclosure away, so technical provenance is secondary detail rather than the centre of the map |
| Agent node | Name, lifecycle word (`In service` / `Retired` — a **word and** a colour, never colour alone), and a three-count glance line: filed · approved · **never executed** |
| Selection | Native `<details name="live-map-agent">`. Exactly one agent selected is a **platform guarantee**; the open node spans the row and becomes its own inspector |
| Inspector | `authoritative · Durable Agent Identity` and `derived · Agent Outcome Observation` printed as **two separate blocks under two separately named truth classes**, carrying all 17 E2-3 counts with the sentence that keeps each from being read as more |
| Node delta · edge delta | **Zero and zero.** Two node kinds, one relation. No proposal, Governance, permit, execution, department, team or person node exists |
| Interaction | Disclosure and navigation only. `onClick`, `useState`, `<button>`, `<form>` remain **banned** in the map's directory, unweakened — the ban is what chose the interaction model |
| Live Map Live | A **pure summary** over the projection the landing route already resolved. Organization name, durable agent count, and whether the derived observation could be read |
| Security Live | A **pure summary** over E2-2's released observation. A count of **recorded governed acts**, in the word "acts", with the ledger's own limits sentence beside it |
| Both panels | No read, no clock, no tenant, no handle — asserted. They cannot disagree with the surfaces they open, because there is nowhere in either file for a second read to go |
| Three states | `recorded` / `known-empty` / `unavailable` and `counted` / `known-empty` / `unavailable` are carried **unflattened**. An unread ledger never becomes zero; a measured zero never becomes "secure" |
| "Live" | A product label. Both panels carry a freshness sentence; the word claims no runtime |
| Global search | Reduced from a `max-w-sm` field spanning the centre of every authenticated page to a compact affordance. It was **disabled with exactly two references in the repository** — its own label and its own input |
| Rendering invariant | **Executable.** With auth configured the tenant resolver must reach `cookies()`; the test runs it under both environments and asserts the configured one throws from the request-bound API |
| Persistence | Zero. Schema delta 0 · migration delta 0 · **ledger 39** · writer delta 0 · authority delta 0 |

```
ORGANIZATION IS THE MAP CENTRE      HEBY != ORGANIZATION CENTRE
LIVE MAP LIVE != A SECOND LIVE MAP  SECURITY LIVE != A SECURITY AUTHORITY
AUTHORITATIVE IDENTITY != DERIVED INTELLIGENCE
AUDIT ACT != INCIDENT               ZERO RECORDED ACTS != SECURE
UNAVAILABLE != ZERO                 LIVE LABEL != REAL-TIME GUARANTEE
VISUAL INTERACTION != WRITE AUTHORITY
```

#### What LMX-1 does NOT mean

- **No Organization Structure.** Departments, teams and reporting lines are still unavailable, and the map still states that rather than drawing them.
- **No human roster.** People remain counted on the organization, never placed.
- **No Knowledge graph, no Security incident graph, no Integration graph.** None was added to the map.
- **No real-time stream.** Both panels and the map are request-time reads and say so.
- **No score, no rate, no ranking, no comparison between agents.** Counts only.
- **No write or execution authority.** The map discloses; it cannot create, retire, approve, permit or execute anything.
- **No new truth authority.** Every fact drawn belongs to the subsystem that already owned it.
- **Production-accepted is not Live Map complete** (§12.3). One authenticated reading of one agent inspector against one organization's real records is what was accepted; nothing broader.
- **Live Map is not complete.** One organization node kind, one agent node kind, one edge.

#### Validation as released

`582/582` suites pass. **16 LMX-1 mutations bite, zero residue.** Typecheck clean, lint 14
pre-existing warnings and zero new, build compiles. Screenshot acceptance was taken against the
released components rendered with the **production build's own compiled stylesheet** and
deterministic fixtures — disclosed as such, because an authenticated production screenshot needs a
real session this work does not create.

One released pin was repaired as a direct consequence: CMD-B1 enumerated Command's exact two server
imports, and composing two more released read seams grew it to four. The enumeration stayed exact.

### Agent Registry — **REJECTED AS PREVIOUSLY CONCEIVED**

The roadmap no longer implies that a generic Agent Registry is an automatically required Era II milestone. Recorded precisely, because the rejection is narrow:

```
AGENT IDENTITY          != AGENT CONFIGURATION
DORMANT COLUMN          != CONFIGURATION AUTHORITY
GENERIC AGENT REGISTRY  != AUTOMATIC REQUIREMENT
```

**What already exists:** agent identity and lifecycle authority — create, read, retire — and the only two writers of the `agents` table (finding H).

**What the previously conceived registry would have been:** either a second identity registry duplicating that authority, or, by activating the dormant behavioural columns, a **new behavioural configuration authority** — a durable runtime mutation surface for agents. §9 records that no such surface exists in `src`, and §14 records that nothing in Hebun today implies an agent can modify itself.

So: **no second identity registry**, and **dormant columns are not activated merely because they exist.**

This rejects the generic, duplicate, ambiguous registry as conceived. It does **not** permanently forbid all future registry concepts. If a runtime configuration authority later becomes necessary, it requires **its own discovery and its own Director authorization** — the same rule that governs any consequential authority creation (§18, rules 6 and 8).

### ASA-2 — **BLOCKED / DEFERRED**, and its prerequisite candidate

**ASA-2 is not schedulable as immediately executable.** It remains blocked pending comparable, windowed evidence: today's agent metrics are unbounded cumulative counts with no time window and no before/after comparison anywhere (finding G), and cumulative totals cannot prove controlled improvement across a change.

A prerequisite therefore exists as a **REQUIRED PREREQUISITE CANDIDATE**:

```
WINDOWED AGENT EVIDENCE
```

It is **not** created as a milestone here, and no `E2-0` is opened. The reason is deliberate: the prerequisite has not itself received bounded discovery, design or implementation authorization, and manufacturing a milestone number for it would be the same error as trusting a superseded order.

```
SIA                  != ASA
WINDOWED EVIDENCE    != IMPROVEMENT AUTHORITY
SELF-IMPROVEMENT     != SELF-MODIFYING CODE
```

`ASA-2` remains a Director-named milestone with **no repository record at this baseline** — the identifier `ASA` appears nowhere in `src` or `tests` (§9). **ASA-2 must not become self-modifying code.**

### Organization Structure Authority — a recorded dependency, not a scheduled milestone

The L3 truth is preserved exactly:

```
ORGANIZATION IDENTITY           = AUTHORITATIVE
INTERNAL ORGANIZATION STRUCTURE = UNAVAILABLE
```

Recorded dependency:

> **Organization Structure Authority → required for organization-structure-shaped intelligence.**

It is **not** added to the active sequence merely because future Live Map or Heby features could use it. Repository verification confirmed it was not required for E2-1's bounded foundation, and the **released** result is stronger than the prediction: E2-1 consumes what **L3** already admits — it consumes L4 not at all — and where structure is unavailable it carries the authority's own refusal sentence verbatim rather than supplying one (finding J).
### 12.1 Era II — Security direction

**FUTURE / PROVISIONAL SECURITY CONSTRAINTS. Not implementation commitments, and no phase order is fabricated here.**

Concerns likely to become load-bearing as intelligence accumulates over authoritative evidence:

- security evidence observation — connecting a security surface to the audit sink that already exists. **This is the one item that has since been placed in the bounded order, as E2-2, and it is now ACTIVE for discovery and design (§12).** It is still not implemented and not connected.
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

It does **not** get a separate top-level era, and it is **not** in the E2-1 → E2-3 sequence (§12), which is now closed and exhausted. It remains future work, and nothing selects it. It may later benefit from organizational evidence, decision history, agent evidence, outcomes, Knowledge and Governance evidence — none of which activates it.

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

Where useful, future roadmap milestones may carry explicit ownership identifiers — as `L1`–`L4` do in §10, and as `E2-1`–`E2-3` do in §12. An identifier is a delivery label, not an authority: `E2-1`, `E2-2` and `E2-3`, all now closed, each name **one bounded released capability**, never the whole product line or cross-cutting program it sits in. `E2-3` names one derived observation attached to one node kind — not Live Map, and not Live Map Intelligence.

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

**NONE SELECTED.** Era II is **OPEN** with **no active milestone**. E2-4 closed; **no E2-5 is opened, and ASA-2 is not scheduled by it.**

```
NEXT MILESTONE = NOT YET SELECTED
```

Era I is **CLOSED** at `047dde8` (§11.3). Era II is **OPEN** (§12) and remains open — five milestones closing close no era. The bounded order E2-1 → E2-2 → E2-3 was exhausted; LMX-1 followed E2-3 as a **product-experience** milestone by Director decision, and **E2-4 followed it as an Era II milestone by Director decision after a read-only discovery pass** — which is exactly how the next one must also be chosen, from measured repository and product reality, never from numbering.

**E2-1 is CLOSED.** Released and pushed at `dfa76248c38bad2c994e1494ac41896296b09067`, **not deployed**. Heby grounds on the Organization Authority as one ordinary evidence source; it does not consume Live Map, internal organization structure remains unavailable, no agent fact is admitted, and no new authority was created. **E2-1 closed is not Heby Intelligence complete.**

**E2-2 is CLOSED.** Released and pushed at `7b30893b5231e8a891602964c67842bccf042c87`, **not deployed**, and every closure claim was re-measured from the repository before this status was recorded (§12). The Security Center holds exactly one connected source class — `audit` — read tenant-scoped and bounded through a projection it does not own, and reported as **derived** over authoritative records. It gained no finding authority, no incident authority, no policy authority, no trust authority, no score, and no write, authorization or execution authority. **E2-2 closed is not Security complete, and not a Security Command Center.**

**E2-3 is CLOSED and PRODUCTION-ACCEPTED.** Released and pushed at `00eda193948c6f86b422e84d198ef03363adf761`, learnings at `2aff2376ee72a6229c6a4ab5af15673e04a6408a`, **deployed and production-accepted** (§12.3) — server-side and authenticated UI acceptance both PASS, after a production migration repair 37 → 39. Existing authoritative Live Map agent nodes are enriched with a derived cumulative Agent Outcome observation through an id-keyed read-only projection owned by the outcome authority. It created **no node type, no edge type, no writer, no schema, no migration and no authority**; `LiveMapTruth` is unwidened, the ledger is unchanged at 39, and the enriched import closure contains no durable writer at any depth. **E2-3 closed is not Live Map complete, and not Live Map Intelligence complete.**

**LMX-1 is CLOSED and PRODUCTION-ACCEPTED.** Released and pushed at `8fb299e1aaac36d5f1db295d05877395de91b1e2`, learnings at `1b9f88a007ee40fda2c4cc239b87554f67e2f680`, **deployed and production-accepted** (§12.3).

**E2-4 is CLOSED.** Organizational Attention Observation — released and pushed, **deployment not measured and not production-accepted** (§12.4). Hebun now reads the timestamps its authorities were already writing: how long a proposal has awaited a decision, how long the oldest has waited, how long something approved has gone without an attempt, how long an unspent authorization has left, and how long since the last recorded governed act. It created **no schema, no migration, no writer, no node type, no edge type and no authority**; the ledger is unchanged at 39. **It is not a policy authority: AGE != IMPORTANCE, WAITING != LATE, NO THRESHOLD IS A POLICY.** Deciding what a duration means would need its own discovery and its own authorization. `/live-map` is now an organization-centred visual map whose agents open into an inspector separating authoritative identity from derived cumulative outcome, and the authenticated landing carries a Live Map Live / Security Live awareness band built from released seams. It created **no node type, no edge type, no writer, no schema, no migration and no authority**, and it added an executable guard that the authenticated dashboard cannot regress into reusable static HTML. **It is a product-experience milestone, not E2-4** — see §12.

**No next milestone is selected.** Organization Structure Authority stays unavailable, the generic Agent Registry stays rejected, **ASA-2 stays blocked** — re-measured at E2-4's activation: no time-window predicate exists in `agent-outcome-observation/`, `agent-evaluation/` or `agent-improvement-hypothesis/`, and E2-4 built none (elapsed time is not a window) — Director Intelligence stays outside the sequence, and the Knowledge, Security and Integration Live Map layers stay deferred — none of them is opened by E2-3 or E2-4 closing. Selecting what follows requires reading the repository again, not continuing a number.

Nothing in Era II is authorized by this document. In particular, a candidate being technically safe to build is not a reason for it to be next, and a closed milestone authorizes nothing that follows it.

```
ERA I CLOSED     != PRODUCT FINISHED
ERA II OPEN      != ALL ERA II WORK AUTHORIZED
E2-2 CLOSED      != SECURITY COMPLETE
E2-3 CLOSED      != LIVE MAP COMPLETE
LMX-1 CLOSED     != LIVE MAP COMPLETE
DEPLOYED         != PRODUCTION-ACCEPTED
PRODUCTION-ACCEPTED != LIVE MAP COMPLETE
MIGRATION APPLIED   != APPLICATION ACCEPTED
SERVER-SIDE PASS    != UI ACCEPTED
AGE                 != IMPORTANCE
WAITING             != LATE
NO THRESHOLD IS A POLICY
ELAPSED TIME        != A WINDOW
E2-4 CLOSED         != ASA-2 UNBLOCKED
FOUR CLOSED      != ERA II CLOSED
NUMBERING        != A MILESTONE
LIVE MAP         != TRUTH AUTHORITY
TRUTH BEFORE GRAPH COMPLETENESS
RELEASED         != DEPLOYED
ROADMAP          != ARCHITECTURE AUTHORITY
DISCOVERY RESULT != REPOSITORY TRUTH
```
