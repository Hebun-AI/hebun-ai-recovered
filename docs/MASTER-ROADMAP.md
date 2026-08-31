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

### ERA II — HEBUN INTELLIGENCE · **CLOSED** (§12.9)
Hebun understands what it observes. Evidence accumulates, agents are evaluated, and intelligence is layered over an organization that is already truthfully represented.

**Closed at `6b4a72b` against this outcome, measured clause by clause (§12.9).** The three clauses above are Era II's only stated exit criteria — they were written before the era's work began and are not reconstructed here. Era II closure means the intended intelligence foundation is complete. **It does not mean Hebun is finished**, and it activates nothing.

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
| **Heby** | Core v1 — bounded conversational grounding | Heby Intelligence — **E2-1 CLOSED**, organization *identity* admitted as evidence · **E2-5 CLOSED · PRODUCTION-ACCEPTED**, the tenant's durable agents and their proposal outcomes admitted as evidence under their own class · **E2-6 CLOSED · PRODUCTION-ACCEPTED**, the bounded recorded-act history admitted as evidence under its own class · **E2-7 CLOSED · PRODUCTION-ACCEPTED**, windowed period counts over that same ledger · **E2-8 CLOSED · PRODUCTION-ACCEPTED**, which declared knowledge areas the organization holds evidence in, and which hold none — from the Knowledge workspace only (§12, §12.5, §12.6, §12.7, §12.8) | Heby as operational interface |
| **Agents** | Durable identity + truthful activity | Evidence seam · evaluation. **Agent Registry rejected as previously conceived** (§12) · **E2-5 CLOSED · PRODUCTION-ACCEPTED** — E2-3's derived outcome observation reaches Heby as evidence beside authoritative durable-agent identity; no agent authority, writer or lifecycle act added (§12.5) | Advanced self-improving agents |
| **Governance** | Decision authority + recorded acts | Governance intelligence overlays — **CONNECTED**: the `governance` class carries this tenant's own decision record to Heby through a read-only boundary (G6C `5299fdb`), and **E2-6 / E2-7 CLOSED · PRODUCTION-ACCEPTED** add the recorded-act history and its windowed period counts over `audit_log`. No governance authority, writer or policy evaluator was created (§12.6, §12.7) | Governed autonomy |
| **Knowledge** | Facts, provenance, retraction | Memory · learning — **NEITHER DELIVERED**; the `memory` class is declared and honestly unconnected, because `readCompanyMemory` resolves to an in-memory, process-local store and grounding Heby on it would be the impostor K1 forbids. What Era II delivered here is coverage: **E2-8 CLOSED · PRODUCTION-ACCEPTED** — the declared-area coverage aggregate R6B built for `/knowledge` is admitted to Heby as evidence under its own class, so Heby can name an area the organization holds nothing in; no knowledge quality, score or readiness authority added (§12.8) | Organizational learning loop |
| **Organization** | **Organization Authority (L3)** | Organizational intelligence evolution — **E2-1 CLOSED**, organization *identity* admitted to Heby through L3's own projection, carrying the authority's refusal verbatim where structure is unavailable · **E2-4 CLOSED · PRODUCTION-ACCEPTED**, elapsed time over authoritative timestamps. **Internal structure remains UNAVAILABLE** — the Organization Structure Authority stays a recorded dependency, not a scheduled milestone (§12) | Living organizational system |
| **Integrations** | Provider contracts + connections | Provider-sourced intelligence — **INT-5A CONNECTED**: the `integrations` class carries per-provider *capability state* to Heby, read tenant-scoped from the control plane. It reports what CAN be read from a connected system, **never what is inside one**; provider content as reasoning input remains future work for the `integrations` class itself — **KID-1 RELEASED** after Era II closed adds a SECOND capability, `google.drive.content.read`, behind its own restricted scope and its own consent: it returns document text to a server-side caller and reaches no Knowledge module at any depth (§12A.1), and **KID-2 RELEASED** carries that content across into the EXISTING Knowledge authority when a permitted human admits one document, with provider provenance and no new authority (§12A.2). The **production permission model was then adapted** to Google Picker + the non-sensitive `drive.file` scope — a third capability, never a remapping of the two released ones — and that path is now **PRODUCTION-ACCEPTED**: a real document was admitted in production while Hebun held no restricted Drive scope, and Heby answered from it (§12B) | Operational integration |
| **Live Map** *(promoted surface — a projection, never a truth owner)* | **Live Map Core v1 (L4)** | Live Map Intelligence v1 — **E2-3 CLOSED · PRODUCTION-ACCEPTED** (derived cumulative Agent Outcome observation, id-keyed) · **LMX-1 CLOSED · PRODUCTION-ACCEPTED** — the visual organization-centred map, the agent inspector, and the Live Map Live / Security Live awareness band (§12, §12.3) · **E2-4 CLOSED · PRODUCTION-ACCEPTED** — a factual elapsed annotation on the existing agent node, no node or edge kind added (§12.4) | Live Map Operational v1 |
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
| **ERA II — HEBUN INTELLIGENCE** | **CLOSED** at `6b4a72b` against the §4 outcome, measured clause by clause (§12.9) | Era II opened when Era I closed. A read-only discovery pass ran and **every finding was reproduced against the repository at this baseline before it was recorded** (§12). **E2-1, E2-2 and E2-3 are all CLOSED**, and the product-experience milestone **LMX-1** that followed E2-3 is closed too — implemented, released and pushed at `dfa7624`, `7b30893`, `00eda19` and `8fb299e`. E2-3 and LMX-1 are **DEPLOYED and PRODUCTION-ACCEPTED** — server-side and authenticated UI acceptance both PASS, after a production migration repair carried the deployment's database from ledger 37 to 39 (§12.3); E2-1 and E2-2 have **no measured deployment** (§12.2). **E2-4 — Organizational Attention Observation — is CLOSED too**, activated by Director decision after a read-only discovery pass and released with zero schema, zero migration and zero writer (§12.4); it is **DEPLOYED with commit-binding VERIFIED and PRODUCTION-ACCEPTED** — server-side and authenticated UI acceptance both PASS, with no production defect found and no source, schema or migration change required by the acceptance (§12.4). **E2-5 — Heby Agent Grounding — is CLOSED too**, released with zero schema, zero migration and zero writer, and it is **DEPLOYED with commit-binding VERIFIED and PRODUCTION-ACCEPTED** — server-side and authenticated Heby acceptance both PASS, after one real production defect was found at the acceptance gate and fixed in the response validator (§12.5). **E2-6 — Heby Recorded Act Grounding — is CLOSED too**, released with zero schema, zero migration and zero writer, and it is **DEPLOYED with commit-binding VERIFIED and PRODUCTION-ACCEPTED** — server-side and authenticated Heby acceptance both PASS, after one real truth-semantics defect was found at the acceptance gate and fixed in this milestone's own grounding wording (§12.6). **E2-7 — Heby Windowed Recorded-Act Intelligence — is CLOSED too**, released with zero schema, zero migration and zero writer, and it is **DEPLOYED with commit-binding VERIFIED and PRODUCTION-ACCEPTED** — server-side, Heby grounding and authenticated Heby acceptance all PASS, with no production defect found and no source, test, schema or migration change required by the acceptance (§12.7). **E2-8 — Heby Knowledge Coverage Grounding — is CLOSED too**, selected from a bounded discovery pass by Director decision and released with zero schema, zero migration and zero writer, and it is **DEPLOYED with commit-binding VERIFIED and PRODUCTION-ACCEPTED** — Knowledge authority, Heby grounding and authenticated Heby acceptance all PASS, with no production defect found and no source, test, schema or migration change required by the acceptance; the first human attempt was a truth-safe refusal caused by testing from the wrong workspace, not a runtime defect (§12.8). **No Era II milestone is active, and none remains required.** Closing nine milestones closed no era — the era closed because the §4 outcome was **measured** satisfied (§12.9), which is the only thing that ever closes one here. The same rule now governs what follows: **Era III is not started**, and the next program or era must be selected from measured repository and product reality by a separate Director decision, never from numbering. |
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
ERA II — HEBUN INTELLIGENCE = CLOSED (§12.9)
NO MILESTONE ACTIVE · NO NEXT MILESTONE SELECTED · ERA III NOT STARTED
```

**Era II closed at `6b4a72b` against the §4 outcome, by Director ruling after a read-only closure audit — see §12.9.** Nine milestones closed beneath it (E2-1…E2-8 and LMX-1); **no E2-9 exists and none is created by this closure.** Everything below is preserved as the record of how it was delivered.

Era II opened when Era I closed at `047dde8` (§11.3). A read-only Era II discovery and prioritization pass then ran, and **every finding it returned was reproduced against the repository at `0005f72` before it was recorded here** — because a discovery result is not repository truth (§18, rule 5). The reproduction is summarised below and its measurements are the evidence column of §9.

**Exactly one milestone is active, and it is active for discovery and design — not for implementation.**

| # | Milestone | Status |
|---|---|---|
| **E2-1** | **Heby Organizational Intelligence Foundation** | **CLOSED** — implemented · released · pushed at `dfa7624` · **deployment not measured** (§12.2) |
| **E2-2** | **Security Observation Connection over authoritative records (S-B)** | **CLOSED** — implemented · released · pushed at `7b30893` · **deployment not measured** (§12.2) |
| **E2-3** | **Live Map Intelligence — authoritative layers** | **CLOSED** — implemented · released · pushed at `00eda19` · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.3) |
| **LMX-1** | **Live Map Product Experience v1 — visual map + global awareness** | **CLOSED** — implemented · released · pushed at `8fb299e` · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.3) |
| **E2-4** | **Organizational Attention Observation — elapsed time over authoritative records** | **CLOSED** — implemented · released · pushed · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.4) |
| **E2-5** | **Heby Agent Grounding — the durable agents this organization has, and what became of what they proposed** | **CLOSED** — implemented · released · pushed · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.5) |
| **E2-6** | **Heby Recorded Act Grounding — what this organization actually did, as Hebun recorded it** | **CLOSED** — implemented · released · pushed · **DEPLOYED · PRODUCTION-ACCEPTED** (§12.6) |
| **E2-7** | **Heby Windowed Recorded-Act Intelligence — how much happened inside an explicit period** | **CLOSED · PRODUCTION-ACCEPTED** — implemented · released · pushed · **deployment commit-binding VERIFIED · production-accepted** (§12.7) |
| **E2-8** | **Heby Knowledge Coverage Grounding — which declared knowledge areas this organization holds evidence in, and which hold none** | **CLOSED · PRODUCTION-ACCEPTED** — implemented · released · pushed · **deployment commit-binding VERIFIED · production-accepted** (§12.8) |

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

### 12.4 E2-4 — Organizational Attention Observation · **CLOSED · PRODUCTION-ACCEPTED**

```
E2-4 = CLOSED · PRODUCTION-ACCEPTED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYED (COMMIT-BINDING VERIFIED) · PRODUCTION-ACCEPTED

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

#### Production acceptance · **PRODUCTION-ACCEPTED**

```
DEPLOYMENT COMMIT-BINDING  = VERIFIED
SERVER-SIDE ACCEPTANCE     = PASS
AUTHENTICATED UI ACCEPTANCE = PASS
E2-4                       = PRODUCTION-ACCEPTED
```

**Deployment commit-binding VERIFIED, not inferred.** The production deployment serving the
authenticated application reports `target: production`, state `READY`, and a `gitSource.sha` **equal
to the released commit**. That is the platform's own attestation of which commit produced the running
build — distinct from a matching build time, a matching alias or a matching page. §16 requires a
closure record to state which of its separate states was actually reached; all three are reached
here, and the deployment one is recorded **at the strength it was measured** — commit-binding
**VERIFIED**, not **INFERRED**, which is the weaker verdict this pass would have had to record had
the platform been unable to attest a commit. The production runtime carries both `DATABASE_URL` and the explicit
remote control-plane flag, so all four observation blocks resolve their reads from environment
exactly as the released code intends.

**Server-side production acceptance — PASS.** The released `readAttentionObservation` was run against
the production target read-only, under **one pinned evaluation instant**, and every figure it
returned was then re-measured by independent SQL. The two agree. As with §12.3's repair, **the target
was bound by `pg_control_system().system_identifier` and `current_database()` before any number was
trusted, and both pin values stay out of band** — that is G4's design and this repository is public.

| Observation | Measured production truth |
|---|---|
| Awaiting a decision | **3** awaiting · oldest filed **3d 2h** before the pinned instant, from the unbounded aggregate |
| Approved with no attempt recorded | **0**, and **no oldest at all** — `null`, never a zero duration |
| Authorized and unspent | **0 active** · soonest expiry `null` · longest held `null`. **0 permit rows exist**, so the 50-row bound on the permit reader cannot bite and the zero is exact |
| Most recent recorded governed act | **18** recorded acts · **18h 22m** since the most recent |
| Ledger | **39, unchanged.** No migration was run, no production row was written, no source was changed |

**Every zero was measured, and the distinction held.** `approvedWithoutAttempt: 0` arrives with
`oldestApproved: null`, and `active: 0` with both durations `null` — the surfaces render a count and
**no age of nothing**. No block returned `unavailable`, so no zero on this pass is standing in for a
failed read.

**Authenticated production UI acceptance — PASS.** The Director authenticated and inspected the
production surfaces directly. `/approvals` rendered the production decision queue with elapsed time
as neutral metadata; `/command` rendered the waiting items with the same figures in its own
subordinate treatment; and the `/live-map` Heby inspector rendered **`DERIVED · ORGANIZATIONAL
ATTENTION OBSERVATION`** with *Oldest proposal awaiting a decision: 2d 11h* and its basis stated as
`action-request.created_at`. **`AGENT OUTCOME` remained a visibly separate block** — E2-3's derived
observation and E2-4's are not merged into one. The non-claims were preserved on the surface, and
**no priority, urgency, SLA, overdue, severity or risk classification appeared anywhere.**

**The Live Map figure differs from the queue's oldest, and that is the annotation being correct.**
`/approvals` reports the oldest of **all** pending proposals; the Live Map annotation is
**agent-scoped** and reports the oldest proposal filed **by that agent**. The oldest proposal overall
was filed by a human, so the two numbers must not match. A single figure on both surfaces would have
meant the agent node was rendering a tenant-wide total under an agent's name.

**Two independent measurements, and they agree.** As in §12.3, that agreement is the whole content of
the acceptance: the server-side pass cannot see what a rendered surface says, and the authenticated
pass cannot prove what the database holds.

```
COMMIT-BINDING VERIFIED != COMMIT-BINDING INFERRED
SERVER-SIDE PASS        != UI ACCEPTED
MEASURED ZERO           != UNAVAILABLE
AGENT-SCOPED OLDEST     != TENANT-WIDE OLDEST
RENDERED DURATION       != A JUDGEMENT
```

**What this acceptance does not open.** It closes no era, selects no milestone and **creates no
E2-5.** Era II remains **OPEN with no active milestone** (§20). **ASA-2 stays blocked** — elapsed time
is not a window — and Director Intelligence stays outside the sequence. E2-1, E2-2 and the Security
Center are untouched by it and remain without authenticated production acceptance.

**No production defect was found, and nothing was changed to obtain this acceptance.** Source delta
0, schema delta 0, migration delta 0, production row delta 0.

### 12.5 E2-5 — Heby Agent Grounding · **CLOSED · PRODUCTION-ACCEPTED**

```
E2-5 = CLOSED · PRODUCTION-ACCEPTED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYED (COMMIT-BINDING VERIFIED) · PRODUCTION-ACCEPTED

RUNTIME AGENT != WORKFORCE IDENTITY
OUTCOME       != MANDATE
APPROVED      != EXECUTED
```

**Selected from measured repository reality, by Director decision, exactly as §12 requires.** The
measurement that chose it is one line: **no `heby-*` module imports `agent-identity` or
`agent-outcome-observation` at any depth.** E2-3 released the Agent Outcome Observation and had it
production-accepted; `/agents` and `/live-map` consume it; Heby does not. So after E2-4 gave Heby
counts and durations, Heby still could not name a single agent — **including itself**, since Tenant
Zero's one durable agent is Heby.

#### Why this is a new class and not the one that already looked right

`workforce` was the obvious home and it is the wrong one. Its released registry profile states the
boundary in the words a Director's answer is composed from:

> "Organizational workforce identity — not a runtime agent."

That class is chartered for the humans an organization is made of, and Hebun holds no authority for
them — L3 measured that `roles` carries no `organization_id`, that `organizations`/`departments`
have no writer and no reader, and that the organization record carries a member COUNT and no roster.
Routing a runtime agent through it would make an agent indistinguishable from an employee **and**
connect a class whose actual subject Hebun still cannot see.

So `agents` is its own class, for the reason `work-artifacts`, `external-recipients`, `integrations`
and `organization` are their own classes: **a different authority owner.** Adding a class widens a
contract over an authority that was already released and production-accepted; it creates none.

#### Why E2-1's "admits no agent" is not contradicted

E2-1's released firewall says: *"E2-1 ADMITS NO AGENT. Live Map projects a durable agent beside the
organization. **This class** does not, and must not start to merely because the map already does."*

The scope is the sentence's own subject. E2-1's point was that an agent must not arrive as a
property of the **organization record**, smuggled in because a rendering put the two side by side.
That rule is untouched and now checked twice over — E2-5's firewall walks the organization
projection's import closure and asserts it reaches nothing in the observation authority.

#### What it delivers

| | |
|---|---|
| Source | E2-3's `agent-outcome-projection.server.ts`, the **owner-side** seam — never `live-map-agent-outcome.server.ts`, which sits in the same directory |
| Items | One per durable agent: name, in service or retired, established, proposals filed, awaiting a decision, withdrawn, governance approvals and rejections, permits issued, approvals with no execution attempt, execution attempts, provider acceptances and refusals, execution failures, outcome unknown |
| Standing | **DERIVED — `authoritative: false`.** E2-3 released the observation as derived and the authenticated map labels it so; importing it may not upgrade it in transit |
| Declared by | **Command only**, on E2-1's precedent. `workforce` deliberately does not gain it |
| Persistence | **NONE.** Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · authoritative writer delta 0 · node-kind delta 0 · edge-kind delta 0 |

#### The defect the release found, in its own code

The first draft's evidence line read `approved 4 · rejected 0`. `detail` flows into Heby's **own**
deterministic prose, and the released `validateResponse` scans that prose for
`FORBIDDEN_ACTION_CLAIMS` — `approved`, `rejected`, `authorized`, `executed` — by bare substring. So
the validator withheld the **entire response**: every answer that cited an agent would have rendered
as *"Response withheld"*, and the milestone's whole product value would have been invisible.

The guard was right to fire on a crude reading, and **the wording is what changed, not the guard** —
the precedent this repository has already set twice, in E2-1's ordinary fixture name and CMD-B1's
renamed field. The counts became count nouns (`governance approvals`, `governance rejections`,
`approvals with no execution attempt`), which is also more accurate: `governance.approved` is a
count of records Governance produced, not an assertion by the sentence's author that anything was
approved. The numbers are identical and nothing is hidden. A test now pins the detail line against
every forbidden claim, so a later readability edit cannot silently reintroduce a withheld answer.

```
A RELEASED GUARD FIRING ON HONEST PROSE IS A WORDING PROBLEM, NOT A GUARD PROBLEM.
```

#### What E2-5 is NOT, and structurally cannot become

No agent id travels — `AgentOutcomeObservation` carries none, because E2-3 put the id on the
**outside** as a join key. No capability, permission, owner, mandate, instruction, prompt or model
output travels, because the observation holds no field for any of them: they are **absent, not
filtered**. Heby gained no agent authority, no lifecycle act and no writer — the projection's whole
import closure is asserted write-free, and the walker follows `export … from` because
`@/features/agent-identity` re-exports two lifecycle writers.

A tenant with no agents is `resolved` with one item saying so; a read that could not run is
`unavailable`. Those must never merge, for E2-3's own stated reason — collapsing them would let a
broken read render as a clean, empty workforce.

```
RUNTIME AGENT      != WORKFORCE IDENTITY
OUTCOME            != MANDATE
APPROVED           != EXECUTED
ACCEPTED           != DELIVERED
NO ATTEMPT         != A FAILED ATTEMPT
UNAVAILABLE        != NO AGENTS
DERIVED OBSERVATION != AUTHORITATIVE ORGANIZATIONAL TRUTH
NEW SOURCE CLASS   != NEW AUTHORITY
```

#### Validation as released

`588/589` suites pass, typecheck clean, lint **0 errors and 14 pre-existing warnings — zero new**,
build compiles.

**The one failure is NOT green and is not restated as one.** `k2-flow/create-and-read-postgres`
failed its own concurrency assertion — *"exactly one creation won"*, `['created','unavailable']`
where it expected `['created','duplicate']`. K2 imports `answerHebyModelRequest`, which this phase
edits, so it could not be dismissed as unrelated by inspection. It was measured instead: **8 runs
with the change gave 7 pass / 1 fail, and 8 runs in a clean worktree at the released baseline
`7ffa328` gave 7 pass / 1 fail with the identical assertion and identical values.** A pre-existing
contention flake in Knowledge creation, unchanged by E2-5 and not repaired by it. **Two released proofs were repaired rather than weakened.** E2-1's agent ban scanned the
WHOLE grounding for `[agent`, an exact proxy for its claim only while no agent class existed; it is
now scoped to E2-1's own grounding line **and** to the organization resolution itself, which is
strictly stronger — the old regex would have passed an organization line carrying an agent name
without that literal token. And `heby-integration`'s enumerated source-class list grew 12 → 13,
which is that pin working exactly as its comment says: *"a new source class cannot appear without
somebody stating it here."*

#### The production defect found at the acceptance gate, and fixed

E2-5 was deployed with commit-binding VERIFIED and its server-side smoke passed. The Director's
first acceptance question — *"What durable agents does this organization have?"* — was answered
correctly. The second — *"What has Heby proposed, and what became of those proposals?"* — was
**WITHHELD**: *"Heby could not produce a response that passed validation."*

Nothing had claimed an action. `validateResponse` scanned the answer for `FORBIDDEN_ACTION_CLAIMS`
by **bare substring**, and the honest answer to that question is unsayable without the word
"approved". Both paths failed for the same reason: Heby's deterministic composition carried E2-4's
evidence labels *"Approved with no execution attempt recorded"* and *"Authorized and not yet used"*,
and the model's own prose said *"Neither has been approved or rejected"*.

The owner is `heby-runtime/response-validator.ts`, not either grounding source — rewording E2-4's
labels would have fixed the deterministic path and left the model path broken, and a model cannot be
reworded. The rule was narrowed to the guarantee it always carried, **by semantics rather than by
vocabulary**: no verb was added or removed, and a consequential act is still refused unless it is
negated with the negation attached to the verb, or attributed to a named non-Heby actor.
Self-attribution — `I`, `we`, `Heby` — is refused ahead of both, so `I approved it` fails while
`The proposal was approved by governance` does not. Judged per sentence, so `No issues at all, I
executed it` is still refused.

```
OBSERVATION                    != ACTION CLAIM
PAST RECORDED GOVERNANCE STATE != HEBY EXERCISING GOVERNANCE AUTHORITY
A WORD BAN                     != A SEMANTIC RULE
```

Every released negative is re-proved verbatim in the new regression, including
`heby-runtime`'s *"The deploy was executed."* and `r2c-flow`'s four fabricated claims.

#### Production acceptance · **PRODUCTION-ACCEPTED**

```
RELEASE                     = a9815fb
PRODUCTION VALIDATOR FIX    = 33cd99f
DEPLOYMENT COMMIT-BINDING   = VERIFIED, bound to 33cd99f
SERVER-SIDE SMOKE           = PASS
AUTHENTICATED HEBY ACCEPTANCE = PASS
E2-5                        = PRODUCTION-ACCEPTED
```

**The acceptance surface for E2-5 is Heby itself**, not a rendered dashboard — the milestone's whole
claim is that Heby can answer a question it previously could not. So the gate was two questions put
to the authenticated production assistant, and the second one is the one that mattered.

**Question 1 — *"What durable agents does this organization have?"* — PASS.** Heby named exactly one
durable agent, **Heby, in service**. No second agent, no department, no team, no mandate.

**Question 2 — *"What has Heby proposed, and what became of those proposals?"* — PASS after the fix.**
It was WITHHELD on the first attempt, which is the defect recorded above. Retried unchanged against
the fixed deployment, Heby returned production truth:

| | |
|---|---|
| Durable agents observed | **1 — Heby, in service** |
| Proposals filed | **2** |
| Awaiting a human decision | **2** |
| Withdrawn · governance approvals · governance rejections | **0 · 0 · 0** |
| Permits issued · approvals with no execution attempt | **0 · 0** |
| Execution attempts | **0** |
| Provider acceptances · refusals · execution failures · outcome unknown | **0 · 0 · 0 · 0** |

**Heby stated that both proposals remain awaiting a human decision**, and made **no unsupported
execution, delivery or success claim** — the distinction E2-5 was built to keep.

**The strongest single result is a refusal.** Asked what the proposals were, Heby stated that the
grounding **does not carry the proposal content, subject or details, and did not invent them.**
`AgentOutcomeObservation` holds what became of a proposal and nothing about what it says, so the
honest answer to "what are they?" is that this evidence cannot answer it. A surface that had
supplied a plausible subject would have failed the acceptance while looking more useful.

```
UNAVAILABLE CONTENT != PERMISSION TO DESCRIBE IT
OUTCOME             != SUBJECT
```

**What the capability actually is.** Heby can now ground answers about the organization's durable
runtime agents on **authoritative durable-agent identity** together with the **existing DERIVED Agent
Outcome Observation** — two standings, kept apart. The observation is derived and is never reported
as authoritative identity; the identity record is authoritative and carries no outcome.

**What this acceptance does not open.** It closes no era, selects no milestone and **creates no
E2-6.** Era II remains **OPEN with no active milestone** (§20). ASA-2 stays blocked and Director
Intelligence stays outside the sequence.

### 12.6 E2-6 — Heby Recorded Act Grounding · **CLOSED · PRODUCTION-ACCEPTED**

```
E2-6 = CLOSED · PRODUCTION-ACCEPTED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYED (COMMIT-BINDING VERIFIED) · PRODUCTION-ACCEPTED

A COUNT OF ACTS != A HISTORY OF ACTS
CONSTITUTION    != HISTORY
RECORDED ACT    != ALL ORGANIZATIONAL ACTIVITY
RECENT          != IMPORTANT
CHANGE          != CAUSATION
```

**Selected from a measured gap, by Director decision, as §12 requires.** The measurement is one
line: **no module under `heby-answer/` reads `governance-activity/`'s act history.** R7.1.1 released
`readRecordedActPage` — tenant-scoped, bounded, ordered, fail-closed, counting its own total
independently — and only the Command surface reader consumes it.

So after E2-4, Heby could say *"18 recorded acts, most recent 21h ago"* and could not name a single
one of them. A Director asking **"what changed in this organization?"** got a count and a timestamp.

#### Why it is a new class and not part of `governance`

`governance` is connected (G6C) and carries the **constitution**: the governance authority record,
the genesis session, delegated authority, the member role baseline. Four items about *who holds
authority*, and every one of them **complete**.

This is the opposite kind of fact — *what happened* — and it is **bounded**. Folding a truncated
page in beside complete items would put "is this all of it?" beyond answering under a single
provenance line, which is R6B's defect precisely. So it is its own class, for the reason
`work-artifacts`, `external-recipients`, `integrations`, `organization` and `agents` are: a
different authority owner, here with its own bound and its own outcomes.

#### What it delivers

| | |
|---|---|
| Source | R7.1.1's `observeRecordedActHistory` → `readRecordedActPage`, the released owner-side reader |
| Items | One **coverage** item stating *n of N acts carried, newest first*, then one item per act: entity kind, actor kind, outcome, recording subsystem, authority source, simulation flag, instant |
| Standing | **DERIVED — `authoritative: false`**, because the released `RECORDED_ACT_HISTORY_BOUNDARY` declares `isAuthoritative: false` and a consumer may not disagree with its own authority |
| Declared by | **Command only.** `governance` deliberately does not gain it |
| Persistence | **NONE.** Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · writer delta 0 · authority delta 0 |

#### The validator collision, seen coming and routed around

`audit_result` is a closed enum containing **`rejected`**, and `action` is the writer's own free verb
— `knowledge.create` today, with nothing preventing a future `governance.decision.approved` or
`knowledge.node.deleted`. Both are consequential-act tokens, and `detail` flows into Heby's own
prose, where the E2-5 fix still refuses an unattributed, un-negated claim. Left alone, this class
would have re-armed the exact defect that withheld E2-5's first production answer.

**The guard is right, and this time neither the guard nor the wording moved — the field did.**
`ResolvedSourceItem.content` is documented as verbatim source text that reaches the model's grounding
context and never Heby's own sentences, added for exactly this hazard. So the writer's verb and the
raw outcome enum travel in `content`, **unreinterpreted and unsanitised**, and `detail` carries only
closed-vocabulary fields Heby composes itself. The verb therefore *cannot* reach Heby's prose — not
because it is filtered, but because it is never placed there. **No validator change was made.**

The three outcomes stay distinct rather than merging: `committed`, `not committed` (a rejected
transaction is precisely one that did not commit), and `rolled back`. A test drives all three
through adversarial verbs and asserts no forbidden claim reaches a detail line.

#### What E2-6 is NOT, and structurally cannot become

It is not an organizational history authority. `audit_log` remains the sole authority and its
writers remain its only writers — the grounding closure is asserted write-free against the real
audit writers, which exist and are importable, so the ban is not vacuous. It carries **no payload,
no entity identifier and no actor identity**: `WITHHELD_AUDIT_COLUMNS` names ten fields the released
reader never selects, and a firewall asserts this module names none of them. The record reference is
an **ordinal on the page**, never a record id.

A tenant whose ledger is empty gets `resolved` with one item saying so; a ledger that could not be
read gets `unavailable`. Those never merge — a read failure rendered as an empty history would be
Hebun asserting an organizational fact it never established.

```
A COUNT OF ACTS != A HISTORY OF ACTS
CONSTITUTION    != HISTORY
RECORDED ACT    != ALL ORGANIZATIONAL ACTIVITY
RECENT          != IMPORTANT
CHANGE          != CAUSATION
FREQUENCY       != RISK
UNAVAILABLE     != EMPTY
ORDINAL         != IDENTIFIER
```

#### Validation as released

`592/592` suites pass — **a fully green run, with zero failures**, which also means the K2
concurrency flake that failed the last two releases did not reproduce here. It is a flake and this
run does not repair it; the number is recorded as measured, not as evidence that it is gone.
Typecheck clean and the build compiles. The affected released suites were run first and separately —
`heby-integration`, `heby-runtime`, `heby-core`, `r2c-flow`, `r7-1-flow`, `r7-1-1-flow`, `e2-4`,
`e21`, `e22`, `e25`, `g6c`, `g6d`, `int5a`, `l2`, `hebycap1`, `command-l2`, `cmdb1`, `ge1`. One released proof
was **extended, not weakened**: `heby-integration`'s enumerated source-class list grew 13 → 14, which
is that pin working exactly as its comment says — *"a new source class cannot appear without somebody
stating it here."*

#### The completeness defect found at the acceptance gate, and fixed

The Director's first acceptance question — *"What has this organization recently done, that Hebun
recorded?"* — passed. The second — *"How complete is the recorded activity you can see?"* — was a
**PARTIAL FAIL**, and neither half was a hallucination.

Heby reported 18 acts, 18 of 18 carried, newest first, and that Hebun does not record all
organizational activity. Then it added that *"18 of 18 … tells me whether I'm seeing everything
available in that retrieval window, but not whether older acts exist beyond it."* **That is false
for this reader** — `totalRecordedActs` is a `count(*)` over the tenant's entire ledger, unbounded
and independent of the page, so carried == total means no further Hebun-recorded act exists beyond
the result at that instant. The released contract says exactly that, **in a doc comment no model
reads**, while the grounding called this a bounded PAGE and named only "the total they were drawn
from". Heby reasoned correctly from what it was given.

It also said *"the individual act records themselves are authoritative, but the coverage summary is
derived."* Nothing supports that split: the class declares `authoritative: false` for all of it —
but each item carried a field named `authority source`, and one flag was left to carry the whole
argument against its connotation.

**The owner is this milestone's own grounding wording.** No schema, no persistence, no authority, no
writer, and **no validator change** — the E2-5 guard was not involved and was not touched.

| | |
|---|---|
| Retrieval coverage | Stated explicitly and labelled in **both** branches. Complete: *"every act Hebun has recorded is carried here, and no further Hebun-recorded act exists beyond this result at the instant it was read — the total is counted over the whole ledger, not over this page."* Partial: the remainder is stated **as a number** — *"5 further acts … exist outside this result"* — never as "more" |
| Real-world coverage | Carried in the same item, in every branch: *"Hebun does not record every act this organization performs, so this is not a complete history of its activity"* |
| Authority | The provenance now states that **every item including the individual acts is derived**, that none is authoritative evidence, and that an act's `authority source` names a field recorded on that act, never the standing of this evidence. The detail line renders it as `recorded authority-source field` |

```
RETRIEVAL COVERAGE != REAL-WORLD COVERAGE
COMPLETE RETRIEVAL != COMPLETE HISTORY
DERIVED            != AUTHORITATIVE
A DOC COMMENT      != EVIDENCE THE ANSWER CAN USE
```

#### Production acceptance · **PRODUCTION-ACCEPTED**

```
RELEASE                       = f0afc2d
PRODUCTION TRUTH-SEMANTICS FIX = 46d9caf
DEPLOYMENT COMMIT-BINDING     = VERIFIED, bound to 46d9caf
SERVER-SIDE SMOKE             = PASS
AUTHENTICATED HEBY ACCEPTANCE = PASS
E2-6                          = PRODUCTION-ACCEPTED
```

**The acceptance surface is Heby**, as it was for E2-5 — the milestone's claim is that Heby can
answer a question it previously could not.

**Question 1 — *"What has this organization recently done, that Hebun recorded?"* — PASS.** Heby
described the current recorded acts from production evidence, including recent integration
credential activity, knowledge activity and governance activity, and invented **no** actor identity,
organizational structure, incident, threat, risk, causation, execution, delivery or success.

**Question 2 — *"How complete is the recorded activity you can see?"* — PASS after the fix.** It was
a partial fail on the first attempt, which is the defect recorded above. Retried **unchanged**
against the fixed deployment, Heby held the two dimensions apart:

| Measured at the acceptance instant | |
|---|---|
| Total recorded acts | **18** |
| Carried | **18** · truncated **no** · newest-first |
| Retrieval coverage | **every Hebun-recorded act is represented**, and no additional one exists outside the result at the instant it was read |
| Real-world coverage | Hebun **does not claim** to record every activity the organization performs |
| Standing | **DERIVED, `authoritative: false`** — including the individual act items |

**Heby preserved the source limitations** and inferred no unsupported incident, threat or execution
history.

**The distinction the acceptance turned on**, and the reason the retry was worth running verbatim:

```
ALL HEBUN-RECORDED ACTS != ALL REAL ORGANIZATIONAL ACTIVITY
```

**What the capability is.** Heby can ground answers about the recent acts Hebun recorded for this
organization, through the released Recorded Act History read authority. The grounding is **derived
and non-authoritative**, carries no payload, entity identifier or actor identity, and states its own
retrieval coverage every time it answers.

**What this acceptance does not open.** It closes no era, selects no milestone and **creates no
E2-7.** Era II remains **OPEN with no active milestone** (§20). ASA-2 stays blocked and Director
Intelligence stays outside the sequence.

```
RECORDED ACT != ALL ORGANIZATIONAL ACTIVITY
RECENT       != IMPORTANT
CHANGE       != CAUSATION
DERIVED      != AUTHORITATIVE
UNAVAILABLE  != EMPTY
```

### 12.7 E2-7 — Heby Windowed Recorded-Act Intelligence · **CLOSED · PRODUCTION-ACCEPTED**

```
E2-7 = CLOSED · PRODUCTION-ACCEPTED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYMENT COMMIT-BINDING VERIFIED · PRODUCTION-ACCEPTED

TIME WINDOW != TREND        CHANGE != CAUSATION
MORE        != BETTER       LESS   != WORSE
RECENT      != IMPORTANT    A STATED BOUNDARY != A DEFINITION OF RECENT
```

**Selected from a measured gap, by Director decision.** The measurement: **`gte`, `lte` and
`between` appear ZERO times in the entire `src/features` tree.** No released read in this repository
accepts a time window. E2-4 carries one elapsed instant, E2-6 a bounded newest-first page — so Heby
could say what happened lately and how long ago the last act was, and could not count what happened
*between two instants*. Once a tenant's ledger exceeds E2-6's page bound, an older period becomes
invisible entirely.

    A RECENT PAGE != A PERIOD COUNT

#### The first step from "what happened" to "what changed"

| | |
|---|---|
| Source | `audit_log.occurred_at`, through a new **owner-side** windowed read in the recorded-act authority — the same owner as E2-6, so no authority was created |
| Items | Three, always: the current period, the period immediately before it, and a comparison item carrying **both** numbers |
| Window | `[since, until)` — **half-open**, `gte`/`lt`, never `lte` |
| Bound | **NONE.** A count over a closed interval has a finite answer, so bounding it would replace a fact with a page length |
| Standing | **DERIVED, `authoritative: false`** |
| Declared by | **Command only** |
| Persistence | **NONE.** Schema delta 0 · migration delta 0 · **ledger 39, unchanged** · writer delta 0 · authority delta 0 |

#### Why the interval is half-open, and why that is not a detail

Adjacent windows built as `[since, until)` **partition** time: an act at exactly the boundary belongs
to one period and to no other. Closed-closed intervals double-count every boundary instant, so two
period counts become incomparable while both still look correct. The postgres proof seeds acts
**exactly on** both boundaries and one millisecond either side, so `gte`/`lt` silently becoming
`gt`/`lte` — the most plausible future edit — changes a count and fails loudly.

Both windows are derived from **one pinned instant**. Reading the clock twice would let the periods
drift apart by the duration of the first query, leaving a gap in which acts are counted in neither.

#### A third file in the authority, and why

The split already in `governance-activity/` is load-bearing: `read.server.ts` carries **no** `.limit(`
anywhere, `act-history-read.server.ts` carries **exactly one**. Putting windowed counts in either
would have forced its released assertion to be narrowed from *this file* to *this function* — a
strictly weaker guarantee bought for a smaller diff. The windowed read earns its own file and its
own property: no bound either, for a different reason.

#### What E2-7 is NOT, and structurally cannot become

**It computes no delta, no direction, no rate, no percentage, no projection and no trend.** There is
no field that could hold one — the reason `ElapsedObservation` carries no severity: a representation
that cannot express a judgement cannot leak one. Subtracting two counts is arithmetic; saying what
the difference *means* is a judgement no authority in Hebun owns.

The comparison item states both numbers **and** refuses them in the same breath, because a model
handed two counts will otherwise compute the difference and narrate it. The refusal is a named
constant, pinned by equality.

**Hebun holds no definition of "recent".** Seven days is a stated observation boundary chosen so an
answer exists, never a policy about what is current. Every window is reported with its exact
instants, so an answer names its period instead of calling it recent.

```
TIME WINDOW       != TREND
MORE              != BETTER
LESS              != WORSE
CHANGE            != CAUSATION
FREQUENCY         != RISK
A STATED BOUNDARY != A DEFINITION OF RECENT
UNAVAILABLE       != A QUIET PERIOD
```

#### Validation as released

`595/595` suites pass — a fully green run, zero failures. Typecheck clean and the build compiles.
The half-open boundary is proved against **real postgres**, with acts seeded exactly on both
boundaries and one millisecond either side.

**Four released proofs were extended, not weakened.** `heby-integration`'s enumerated source-class
list grew 14 → 15, and the `audit_log` importer ALLOWLIST — asserted independently in `g1-flow`,
`g2-flow` **and** `k2-flow` — gained its third declared reader in each. All four say in their own
comments that a new name is a deliberate, reviewable act rather than a directory prefix, and all
four failed on this milestone before they were justified. That is the census working.

#### ASA-2 is still blocked, and this did not change that

ASA-2's recorded prerequisite is a windowed comparison of **agent** evidence.
`agent-outcome-observation/`, `agent-evaluation/` and `agent-improvement-hypothesis/` still contain
**no** time-window predicate. E2-7 built the repository's first windowed read, over `audit_log` in a
different authority — it is a precedent for the shape, not a prerequisite that has been met, and it
authorizes nothing. **ASA-2 STAYS BLOCKED.**

#### Production acceptance · **PRODUCTION-ACCEPTED**

```
RELEASE                       = c275d12
DEPLOYMENT COMMIT-BINDING     = VERIFIED, bound to c275d12
SERVER-SIDE SMOKE             = PASS
HEBY GROUNDING SMOKE          = PASS
AUTHENTICATED HEBY ACCEPTANCE = PASS
E2-7                          = PRODUCTION-ACCEPTED
```

**No production defect was found, and no source, test, schema, migration or production row was
changed to obtain this acceptance.** E2-5 and E2-6 each needed a fix at this gate; this one did not.

**The deployment binding was read, not inferred.** The production deployment's own git metadata
names the release commit — a push having happened is not evidence that it is what production runs.

**Server-side smoke — PASS.** The released windowed read was run read-only against production from
one pinned observation instant, and every property the milestone claims was measured rather than
assumed:

| Measured against production | |
|---|---|
| Window semantics | `[since, until)` — `since` inclusive, `until` exclusive |
| Adjacency | `previous.until` equals `current.since` **exactly** |
| One pinned instant | both windows derived from a single instant; `current.until` **is** that instant |
| Window length | each period exactly 7 days |
| Counts are exact | independent SQL counts matched the reader; the grouped breakdown summed to the independently-counted total |
| Not a page length | the read carries no bound at all — no truncation semantics exist to report |
| No judgement field | the result carries `since`, `until`, `acts`, `byEntityKind` and nothing that could hold a delta, direction, rate or projection |
| Tenant scope | preserved — an unauthorized context is `unavailable`, never an empty period |
| Standing | **DERIVED, `authoritative: false`** |

**The partition held on real data.** The two adjacent windows summed to exactly the count of the
single half-open window spanning both — which is what "no overlap and no gap" means when it is
measured rather than argued. Production held **no** act sitting exactly on a boundary instant at the
acceptance instant, so that probe alone neither confirms nor refutes double-counting; the half-open
guarantee rests on the released `gte`/`lt` predicate, the partition identity above, and the postgres
boundary proof in the suite.

**Heby grounding smoke — PASS, with no billable model call.** The released answer path assembled all
three windowed items and cited each as evidence. The refusal and the provenance were pinned by
equality and the vocabulary scan run over only what the source **claims** — the fourth-collision
remedy, exercised against production evidence — and it found nothing unsupported.

**Authenticated human acceptance — PASS.** Asked *"How many acts did Hebun record in the last 7 days,
and how many in the 7 days before?"*, Heby gave **both** counts, identified the two periods clearly
enough to tell them apart, and treated them as **Hebun-recorded acts** rather than as all
organizational activity. It did **not** call the difference a trend, did not say activity had
improved or worsened, inferred no cause, importance, risk or performance, and implied no
organizational policy about what counts as recent.

**The measurement at the acceptance instant**, recorded as a measurement and not as durable state:

| Period | Boundaries | Recorded acts |
|---|---|---|
| Current | `2026-08-23T16:20:04.747Z` (inclusive) → `2026-08-30T16:20:04.747Z` (exclusive) | **15** |
| Previous | `2026-08-16T16:20:04.747Z` (inclusive) → `2026-08-23T16:20:04.747Z` (exclusive) | **3** |

Current by kind: `integration_credential` 12, `integration` 2, `knowledge_fact` 1. Previous by kind:
`governance_decision` 2, `genesis_nomination` 1. **These are production acceptance measurements at
one pinned instant, not durable current organizational state.** Both numbers were measured; neither
this document nor Hebun interprets them, and no difference between them is computed here.

**What the capability is.** Heby can answer how many acts Hebun recorded inside explicit adjacent
time windows, through the released owner-side governance-activity windowed read. It compares
measured counts and nothing else. It does **not** own trend, causation, quality, risk, importance or
performance semantics, and Hebun still holds no definition of "recent" — the 7-day periods are
stated observation windows, never an organizational policy.

**What this acceptance does not open.** It closes no era, selects no milestone and **creates no
E2-8.** Era II remains **OPEN with no active milestone** (§20). ASA-2 stays **blocked** — E2-7
introduced a windowed read over `audit_log`, not windowed agent-outcome evidence, so it authorizes
no agent self-improvement, no automatic hypothesis application, no configuration mutation, no
autonomous execution and no self-modifying code. Director Intelligence stays outside the sequence.

```
TIME WINDOW        != TREND
COUNT DIFFERENCE   != TREND
CHANGE             != CAUSATION
MORE               != BETTER
LESS               != WORSE
RECENT             != IMPORTANT
FREQUENCY          != RISK
HEBUN-RECORDED ACTIVITY != ALL ORGANIZATIONAL ACTIVITY
DERIVED            != AUTHORITATIVE
UNAVAILABLE        != QUIET PERIOD
A STATED BOUNDARY  != A DEFINITION OF RECENT
```

### 12.8 E2-8 — Heby Knowledge Coverage Grounding · **CLOSED · PRODUCTION-ACCEPTED**

```
E2-8 = CLOSED · PRODUCTION-ACCEPTED
IMPLEMENTED · RELEASED · PUSHED · DEPLOYMENT COMMIT-BINDING VERIFIED · PRODUCTION-ACCEPTED

A RETRIEVAL RESULT != AN INVENTORY     COVERAGE != CORRECTNESS
COVERAGE != RATIFICATION               COVERAGE != UNDERSTANDING
MISSING  != THE ORGANIZATION LACKS IT  UNAVAILABLE != NOTHING IS COVERED
```

**Selected from a measured gap, by Director decision, and it was not E2-8 by numbering.** A bounded
discovery pass asked one question — which released evidence does Hebun already own that Heby still
cannot use — and read the answer out of the repository rather than the roadmap. Nine of the fifteen
source classes are connected to a real read; six are not. Of the released reads that exist,
`readCompanyUnderstanding` — R6B's per-domain Knowledge aggregate — had exactly one consumer in the
entire tree: the `/knowledge` page. **Heby had never seen it.**

#### What Heby's existing Knowledge class structurally cannot answer

K1/KR3's `knowledge` class is QUERY-SCOPED RETRIEVAL. It ranks the facts that match the question
asked and returns those, which is the right shape for *"what do we know about X"* and the wrong
shape for *"what do we know at all"*:

```
A RETRIEVAL RESULT != AN INVENTORY
```

A retrieval that found nothing looks exactly like an organization that recorded nothing. A retrieval
that returned five facts says nothing about whether five or five hundred exist. And most
importantly, **retrieval can never name an area the organization holds nothing in** — a query
returns what matched, and it cannot return the absence of a category nobody asked about. That
absence is precisely the most useful thing a new organization can be told, and R6B already computes
it for every declared area whether or not anything was found there.

#### Why it is its own class, though the owner is the same

The same argument E2-7 made against merging with E2-6, in the same direction. `knowledge` is a
BOUNDED, ranked, question-shaped subset; this is an UNBOUNDED aggregate that is complete by
construction — `CompanyUnderstandingView.truncated` is the literal `false`, because the per-domain
aggregate has no pagination. Under one provenance line *"is this all of it?"* would have two answers
and one sentence.

#### It is a shaper, and it re-derives nothing

The new module calls the released read seam and renders what it returns. It opens no database, holds
no tenant of its own, computes no count, applies no taxonomy and stores nothing — a test asserts it
imports neither `projectCompanyUnderstanding` nor the taxonomy, so it **cannot disagree with
Knowledge**, because it never recomputes anything Knowledge computed. Zero schema, zero migration,
zero writer, zero authority; the ledger is unchanged at 39.

#### The semantic firewall is the SHAPE, not the wording

R6B's view already refuses to hold a judgement, and E2-8 adds nothing that could. A category carries
counts, a two-valued `state` of `covered` or `missing`, its matched area keys and its label — and a
released test pins that field list by equality, so a score, percentage, confidence, health,
readiness or priority cannot be added without the assertion failing. What coverage is not travels
WITH the numbers rather than being left for a surface to remember:

- **Coverage is not correctness.** Hebun holds what it was given and verifies none of it.
- **Coverage is not ratification.** An area held up entirely by unapproved drafts is covered, and a
  test proves it — the qualities R6B keeps beside coverage (approved, unapproved, past its declared
  review date) are reported next to it and never folded into the word.
- **Coverage is not understanding.** It counts records, and a count is not comprehension.
- **`missing` is a statement about HEBUN's records.** It never means the organization lacks it, and
  that sentence ships on every empty area rather than once in the provenance.

`staleCount` is rendered as *"past its declared review date"* — what the column measures. Calling it
out of date would be a verdict on content nobody wrote.

#### Two orderings that would have been defects

**Empty areas are not omitted**, which is the whole point of the class. **And they are not sorted to
the end**: a test pins the item order to taxonomy order, because pushing empty areas out of sight is
the same defect as dropping them, arrived at more politely. The load-bearing branch R6B wrote for
itself is preserved too — an area key no declared category claims is reported, never discarded, with
the raw operator-authored key travelling in `content` where Heby's own validated prose never reaches
it (E2-6's channel rule).

#### It goes to the Knowledge workspace, and ONLY there

The three Heby milestones before it each went to Command, because Command is where a Director asks
what requires attention and what changed. This one does not. *"What do we know, and where do we hold
nothing"* is the question the `/knowledge` route already exists to answer, and its surface already
shows an operator the very card these counts come from. **Command gains no knowledge inventory**, and
the Knowledge workspace gains no attention, activity, agent or act class. Tests assert both
directions.

#### Validation as released

`596/596` suites pass. Typecheck clean and the build compiles. The new suite is eighteen proofs
covering class declaration and workspace confinement, the pure resolver's honest default, complete
taxonomy reporting, ordering, the unclaimed-key branch, the summary's completeness statement,
coverage-versus-ratification, the empty tenant, all three unavailable reasons, the shape's inability
to express a verdict, writer unreachability, tenant scoping, response validation, and the released
answer path.

**Two proofs are worth naming.** The evidence-removal check — E2-4's rule that a new class must
remove nothing — is proved by **comparison against the same request with this class suppressed**,
not by asserting some sibling class is present. The first draft did the latter and failed, correctly:
with no database configured the Knowledge retrieval legitimately contributes nothing, so that
assertion was testing whether a database happened to be reachable. And the **fifth prose-guard
collision was avoided by construction** rather than after a red suite: the refusal and the provenance
name the judgements they forbid, so both are pinned by equality and the vocabulary ban runs over only
what the source CLAIMS — the settled E2-4/E2-5/E2-6/E2-7 remedy, applied from the start.

#### ASA-2 is still blocked, and this did not change that

ASA-2's recorded prerequisite is a windowed comparison of **agent** evidence. This milestone reads
Knowledge, not agent evidence, and adds no time window at all. **ASA-2 STAYS BLOCKED**, and E2-8
authorizes no agent self-improvement, no automatic hypothesis application, no configuration
mutation, no autonomous execution and no self-modifying code.

#### What E2-8 is NOT

It is not a knowledge quality authority, not a documentation-readiness score, not a gap analysis and
not a recommendation. It reports the presence and count of evidence per declared area. What that
coverage ought to be, whether an area matters, and what anyone should do about an empty one are
judgements no authority in Hebun owns.

```
COVERAGE           != CORRECTNESS
COVERAGE           != RATIFICATION
COVERAGE           != UNDERSTANDING
MISSING            != THE ORGANIZATION LACKS IT
A RETRIEVAL RESULT != AN INVENTORY
MORE RECORDS       != BETTER
UNAVAILABLE        != NOTHING IS COVERED
OBSERVATION        != RECOMMENDATION
DERIVED            != AUTHORITATIVE
```

#### Production acceptance · **PRODUCTION-ACCEPTED**

```
RELEASE                       = 08bd22a
DEPLOYMENT COMMIT-BINDING     = VERIFIED, bound to 08bd22a
KNOWLEDGE AUTHORITY SMOKE     = PASS
HEBY GROUNDING SMOKE          = PASS
AUTHENTICATED HEBY ACCEPTANCE = PASS (from the Knowledge workspace)
E2-8                          = PRODUCTION-ACCEPTED
```

**No production defect was found, and no source, test, schema, migration or production row was
changed to obtain this acceptance.** The deployment binding was read from the production
deployment's own git metadata rather than inferred from a push.

**Knowledge authority smoke — PASS.** The released `readCompanyUnderstanding` →
`projectCompanyUnderstanding` → `countFactsByDomain` path was run read-only against production, and
every property the milestone claims was measured rather than assumed:

| Measured against production | |
|---|---|
| Completeness | `truncated` is the literal `false`; the read seam contains no `.limit(`, does not use `listFacts`, and uses `countFactsByDomain` — an aggregate, not a bounded retrieval page |
| Every declared area reported | all ten, whether or not anything was found in them |
| No judgement field | a category carries `describes, expiredCount, key, label, matchedDomainKeys, notYetEffectiveCount, provisionalCount, ratifiedCount, recordCount, staleCount, state, withdrawnCount` — no score, percentage, confidence, readiness, priority, rank, health or quality |
| `state` | two-valued: `covered` or `missing` |
| Tenant scope | preserved; an unknown tenant returns its own legitimately-empty view and leaks nothing |
| Unavailable ≠ missing | `no-authorized-tenant-context` and `persistence-not-configured` each return `unavailable` carrying **no categories at all**, so a failed read cannot be mistaken for ten empty areas |
| Standing | **DERIVED, `authoritative: false`** |

**Heby grounding smoke — PASS, with no billable model call and nothing persisted.** The released
answer path consulted the coverage seam exactly once and assembled all twelve items as evidence. A
thrown read degraded honestly: it fabricated no area item and never stated the organization holds no
Knowledge.

**The measurement at the acceptance instant**, recorded as a measurement and not as durable state:

| | |
|---|---|
| Declared areas | **10** |
| Covered | **0** |
| Missing (no evidence in force) | **10** — `identity`, `offerings`, `customers`, `markets`, `organization`, `operations`, `policies`, `goals`, `systems`, `partners` |
| Outside the declared taxonomy | `engineering` — **1** fact in force |

**These are acceptance-time production measurements, not durable current organizational facts.** The
unclaimed key is the more interesting half: R6B's load-bearing branch fired on real data, so the
tenant's single Knowledge record stayed visible under an area key no declared category claims,
instead of being silently dropped while every declared area reported empty.

#### The first human test failed, and it was the PROCEDURE that was wrong

The first attempt was made from `/heby`. That route resolves — **explicitly, by released design** —
to the **Command** workspace: `panel-model.ts` states that the Heby Workspace's own route carries no
workspace of its own, resolves to the organization-wide Command read models, and *"never claims
visibility into systems Command does not already read"*. Command does not declare
`knowledge-coverage`, so the class never entered the resolution set and the coverage seam was never
consulted. Heby answered that it could not answer from the grounding it had been given, said what
was absent, and asked for a knowledge inventory.

**That refusal was correct behaviour, and it was the design working rather than failing.** Reproduced
against production through the released resolvers, with no model call:

| route | workspace | coverage seam consulted | `knowledge-coverage` evidence |
|---|---|---|---|
| `/heby` | `command` | **0 times** | **0** |
| `/knowledge` | `knowledge` | once | **12** |

Nothing downstream removed the evidence — **the evidence was never requested**. This was an
**ACCEPTANCE-PROCEDURE DEFECT**, not a runtime defect, not a routing defect and not a Knowledge
authority defect. No source change was required, and **Command was deliberately not widened**:
widening a workspace because a test hit the wrong surface is how a workspace boundary dies.

The capability was never unreachable. `HebyQuickPanelClient` is mounted inside `HebunShell`, which
wraps every dashboard route including `/knowledge`, and it resolves the workspace from the live
pathname — so standing on `/knowledge` and opening Heby there sends that route and reaches all
twelve items.

```
WORKSPACE AVAILABILITY != GLOBAL HEBY AVAILABILITY
A TRUTHFUL REFUSAL     != A DEFECT
```

#### Authenticated human acceptance · **PASS**

Retried from the Knowledge workspace, on `/knowledge`, with the Heby panel opened while remaining on
that route. Asked *"Which declared areas do we hold knowledge in, and which hold nothing?"*, Heby
reported that all ten declared areas held no Knowledge in force, and that `engineering` held one fact
in force outside the declared taxonomy. It stated that absence in Hebun's records does not mean the
organization lacks that knowledge — only that nothing is currently recorded in force for those
declared areas.

It made **no** score, percentage, confidence, readiness, priority, correctness, ratification or
organizational-ignorance claim.

**What the capability is.** Heby, **from the Knowledge workspace**, can ground answers on this
organization's declared Knowledge-area coverage through the released Knowledge authority. It can
distinguish declared areas with evidence in force, declared areas with none, and evidence keys
outside the declared taxonomy — without turning any of those observations into a claim about
correctness, understanding, ratification, readiness or organizational ignorance.

**What this acceptance does not open.** It closes no era, selects no milestone and **creates no
E2-9.** Era II remains **OPEN with no active milestone** (§20). ASA-2 stays **blocked** — E2-8 adds
Knowledge coverage grounding and no windowed agent evidence, no agent improvement authority, no
configuration authority, no automatic hypothesis approval, no autonomous execution and no
self-modifying code. Director Intelligence stays outside the sequence.

```
COVERAGE               != CORRECTNESS
COVERAGE               != RATIFICATION
COVERAGE               != UNDERSTANDING
MISSING EVIDENCE       != ORGANIZATIONAL IGNORANCE
UNAVAILABLE            != MISSING
DERIVED                != AUTHORITATIVE
WORKSPACE AVAILABILITY != GLOBAL HEBY AVAILABILITY
```

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
### 12.9 Era II Closure Contract · **CLOSED**

```
ERA II — HEBUN INTELLIGENCE = CLOSED at 6b4a72b
    if and only if
the §4 outcome is satisfied — evidence accumulates, agents are evaluated, and
intelligence is layered over an organization that is already truthfully represented
    AND
no closure firewall below is violated.

REMAINING REQUIRED ERA II MILESTONES = 0
```

**Era II had no closure contract, and this does not invent one.** Era I closed against §11, whose
criteria were stated before its work began. §12 was deliberately *"not a long fixed Era II roadmap"*
and stated no exit criteria — so the only criterion written in advance is **§4's outcome sentence**,
authored before any Era II milestone existed. §16 forbids reconstructing exit criteria after the
fact, and this record therefore measures §4 and adds nothing to it. **No retrospective product
target was created.**

#### The outcome, measured clause by clause

| # | §4 clause | Result | Measurement |
|---|---|---|---|
| 1 | **Evidence accumulates** | **PASS** | **11 of 16** Heby source classes are connected to real reads — `knowledge`, `operations`, `governance`, `platform`, `work-artifacts`, `integrations`, `organization`, `agents`, `recorded-acts`, `recorded-act-windows`, `knowledge-coverage` — through **eight** released owner-side grounding modules. Every one exists and is read-only. |
| 2 | **Agents are evaluated** | **PASS** | `agent-evaluation/agent-evaluation-projection.server.ts` and the five-file `agent-improvement-hypothesis/` (including `decide-improvement-hypothesis.server.ts`) are released and **product-reachable from both `/agents` and `/governance/authority`**. This is the pre-application loop §14 records; it is **not** ASA, self-modification or automatic application. |
| 3 | **Intelligence layered over a truthfully represented organization** | **PASS** | Era I CLOSED at `047dde8` (§11.3). Over it: E2-1 `dfa7624`, E2-2 `7b30893`, E2-3 `00eda19`, LMX-1 `8fb299e`, E2-4 `9a9caee`, E2-5 `a9815fb`, E2-6 `f0afc2d`, E2-7 `c275d12`, E2-8 `08bd22a` — every commit verified to exist and to carry the subject its milestone claims. |

**`UNCONNECTED CLASS != CLOSURE FAILURE`.** The five unconnected classes are each *correctly*
unconnected, and connecting any of them would be a fabrication rather than a completion:

| Class | Why it stays unconnected |
|---|---|
| `memory` | `readCompanyMemory` resolves to a module-level **in-memory, process-local** store. Grounding Heby on it would be the seeded impostor K1 forbids. Blocked on a durable Memory authority — future work. |
| `intelligence` | `features/intelligence/` is `mock.ts` only (scores, trends, forecasts) and `organizational-intelligence/` has **zero** `.server.ts` files and zero product consumers. Its engines compute score, health, risk and performance — the exact semantics Hebun refuses to own. Its refusal is **correct behaviour**. |
| `workforce` | Blocked by the Organization Structure Authority, a **recorded dependency and not a scheduled milestone**. |
| `decision-records` | Decision-*preparation* retrieval. The Governance decision record already reaches Heby through the `governance` class. |
| `external-recipients` | R3R released and declared by **no** workspace — an unused capability, not an unfinished one. |

#### Product-line targets

| Product line | Era II target | Result |
|---|---|---|
| **Heby** | Heby Intelligence | **MET** — E2-1, E2-4, E2-5, E2-6, E2-7, E2-8 |
| **Agents** | Evidence seam · evaluation | **MET** — E2-5 plus the released evaluation and hypothesis path |
| **Governance** | Governance intelligence overlays | **MET** — G6C `5299fdb`, extended by E2-6 and E2-7 |
| **Knowledge** | Memory · learning | **MET as delivered, not as originally worded** — E2-8 delivered declared-area coverage; **Memory and learning were NOT delivered** and the §8 cell now says so |
| **Organization** | Organizational intelligence evolution | **MET for identity** — E2-1 and E2-4; internal structure stays UNAVAILABLE by recorded dependency |
| **Integrations** | Provider-sourced intelligence | **MET as capability state** — INT-5A; provider *content* as reasoning input remains future |
| *Security (cross-cutting)* | §12.1's one bounded item | **MET** — E2-2; everything else in §12.1 was explicitly *"not created now"* |

#### Closure firewalls — every row measured, none broadened to pass

| Firewall | Result | Measurement |
|---|---|---|
| Heby grounding owns no organizational fact | **PASS** | **Zero** writes and **zero** transactions across all eight grounding modules |
| No second source of truth | **PASS** | Every grounding module reads through its authority's own released seam; E2-8's shaper imports neither the projection nor the taxonomy it renders |
| No lifecycle, authorization or execution authority | **PASS** | The answer path reaches no execution or permit writer, and the released validator still enforces `FORBIDDEN_ACTION_CLAIMS` |
| Tenant identity is trusted-context derived | **PASS** | The one server action resolves the tenant server-side; **no** grounding module takes a raw tenant id from a caller; the client supplies only `{prompt, route, conversationId?}` |
| Tenant isolation intact | **PASS** | Every connected reader carries its authority's own tenant predicate |
| Workspace scoping intact | **PASS** | Command holds no knowledge inventory; Knowledge holds no act or agent class; every class is declared by a workspace except the known R3R orphan |
| `unavailable != empty/zero/missing` | **PASS** | All **16** pure resolutions carry a stated reason and fabricate **zero** items |
| `derived != authoritative` | **PASS** | All **16** classes report `authoritative: false` |
| Production acceptance recorded | **PASS** | E2-3, LMX-1, E2-4, E2-5, E2-6, E2-7 and E2-8 each carry a production-acceptance record with verified deployment commit-binding (§12.3–§12.8); E2-1 and E2-2 have **no measured deployment** and this record does not claim one |
| Roadmap truthful | **PASS** | §8's empty Era II cells for Governance, Organization and Integrations were repaired to the connected reality, and the Knowledge cell no longer implies Memory or learning was delivered |

#### What Era II closure does NOT mean

```
ERA II CLOSED != HEBUN IS FINISHED
ERA II CLOSED != HEBY MAY ACT
ERA II CLOSED != HEBY MAY AUTHORIZE CONSEQUENTIAL WORK
ERA II CLOSED != DIRECTOR INTELLIGENCE IMPLEMENTED
ERA II CLOSED != DIRECTOR TWIN IMPLEMENTED
ERA II CLOSED != ASA ACTIVE
ERA II CLOSED != AGENTS SELF-MODIFY
ERA II CLOSED != PROACTIVE HEBY
ERA II CLOSED != DURABLE MEMORY AUTHORITY EXISTS
ERA II CLOSED != ORGANIZATION STRUCTURE AUTHORITY EXISTS
ERA II CLOSED != SECURITY OPERATIONS EXISTS
ERA II CLOSED != EVERY PROVIDER CAPABILITY EXISTS
ERA II CLOSED != ERA III STARTED
```

It means one thing: **the intended Hebun Intelligence foundation is complete.**

#### The Director ruling that permitted this closure

Director Intelligence is **FUTURE WORK and NOT an Era II closure blocker.** §14 places it beneath
Era II so that it never becomes a new top-level era; it also records that *"it remains future work,
and nothing selects it."* The ruling: **an era closes against its established outcome, not against
every future program positioned beneath it** — the same reading under which Era I closed while the
Organization Structure Authority stayed a recorded dependency.

§4's outcome reaches OBSERVE → DESCRIBE → HISTORY → COMPARE → SYNTHESIZE. Director Intelligence
introduces a later semantic level:

```
SYNTHESIZED EVIDENCE → ADVISORY INTELLIGENCE → DIRECTOR CALIBRATION

OBSERVATION    != RECOMMENDATION
ADVICE         != APPROVAL
CONFIDENCE     != AUTHORITY
RECOMMENDATION != EXECUTION
```

**ASA remains BLOCKED / DEFERRED**, re-measured at this closure: `agent-outcome-observation/`,
`agent-evaluation/` and `agent-improvement-hypothesis/` contain **zero** time-window predicates, and
the identifier `ASA` appears in **zero** files under `src` or `tests`. E2-7's window is over
`audit_log` in the recorded-act authority — **not** over agent evidence — so its prerequisite is
untouched and unauthorized.

**Era III is NOT started.** No era, program or milestone is activated by this closure. **The next one
requires a separate Director decision**, taken from measured repository and product reality rather
than from numbering.

```
ERA CLOSED          != NEXT ERA OPEN
CLOSURE             != ACTIVATION
0 MILESTONES REMAIN != NOTHING REMAINS TO BUILD
```

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

## 12A. Knowledge Ingestion Depth (KID) — a post-Era-II program

```
KID = IMPLEMENTATION COMPLETE (KID-1 + KID-2 RELEASED)
KID PRODUCTION ACCEPTANCE = PASS — the whole path ran once, in production, on a real document
NOT AN ERA · NOT ERA III · NOT AN ERA II MILESTONE · NO KID-3

The production permission model was CHANGED after KID-2 by Director decision: the admission path
is Google Picker + the NON-SENSITIVE `drive.file` scope, so restricted-scope verification and CASA
are not on the accepted path (§12B). KID-1's `drive.readonly` decision remains true as of KID-1 and
is not rewritten.
```

**Selected by Director decision after the Post-Era-II Strategic Product Gate**, from measured
product reality rather than from numbering. Era II closed with Hebun able to describe an
organization truthfully — and production held **one** Knowledge fact against ten declared areas, so
the most honest answer Heby could give about the organization was that it knew almost nothing about
it. KID exists to close that, and only that.

**Program outcome:** a permitted human can intentionally admit real organizational content from an
external provider into Hebun's EXISTING Knowledge authority, with explicit provenance, and Heby can
later answer from what was admitted.

**The program is finite: two milestones.** KID-1 reads; KID-2 admits. **Both are released, so the
program's implementation is complete and no third milestone exists or will be created.** The
release gate that remained has now been run: a human granted the per-file permission, chose one
real Google Doc in Google's own chooser, admitted it, and Heby answered from it in production
(§12B). *Implementation complete* and *production-accepted* were recorded here as different states
because they are — and both are now true.

```
PROVIDER READ        != KNOWLEDGE
DISCOVERED DOCUMENT  != INGESTED DOCUMENT
INGESTED CONTENT     != AUTHORITATIVE ORGANIZATIONAL FACT
EXTERNAL CONTENT     != AUTOMATICALLY TRUSTED CONTENT
AUTHORIZED READ      != KNOWLEDGE ADMISSION
CONTENT              != INSTRUCTION
```

### 12A.0 KID-0 — discovery and architecture gate · **PASS**

A read-only pass established that **no new Knowledge subsystem is needed**, and it found the seam
that made the program small: `ingestKnowledgeFile` does not take a browser `File`. It narrows
`file: unknown` to a structural surface — `{ name, size, type, arrayBuffer() }` — so a provider
adapter producing that shape reuses the whole released gate chain unchanged. The admission authority
already exists (the Knowledge write authority, which `attachExternalReference` already consults),
and the provenance model already exists and is **live in production**: `knowledge_external_references`
carries a real row today, linking the tenant's one fact to a GitHub repository.

**Recorded blockers:** Google restricted-scope verification and CASA, and the extensionless Google
Doc. KID-1 answers the second and inherits the first.

### 12A.1 KID-1 — Provider Content Read · **RELEASED**

```
KID-1 = RELEASED
IMPLEMENTED · DEPLOYMENT NOT MEASURED · NOT PRODUCTION-ACCEPTED
REAL GOOGLE ACCEPTANCE = NOT YET VERIFIED (blocked on Google verification + CASA)

PROVIDER READ != KNOWLEDGE        METADATA READ != CONTENT READ
CONTENT != INSTRUCTION            AUTHORIZED READ != PERSISTENCE
```

**KID-1 stops at the provider boundary.** It ends with real provider content bytes returned to a
server-side caller, and nothing else: no ingestion, no Knowledge write, no external reference, no UI,
no route, no schema and no migration.

#### The scope decision, verified against Google rather than assumed

| Scope | What Google says | Verdict |
|---|---|---|
| `drive.metadata.readonly` | INT-4's grant. `files.list` / `files.get` for metadata; **cannot download** | Unchanged, and still the metadata capability's only scope |
| `drive.file` | **Non-sensitive**, per-file, granted through the **Google Picker** or the app's own picker. Accepted by both `files.get?alt=media` and `files.export` | **Not usable yet** — Hebun has no Picker, and this repository discovers documents with `files.list` against the user's Drive. Under `drive.file` that call returns only already-granted files, so a fresh connection would report the capability available and read an empty Drive |
| `drive.readonly` | **Restricted** — "view and download all your Drive files". Accepted by `files.get?alt=media` and `files.export` | **CHOSEN**, because it is the only scope that works with the architecture that exists |

**The cost is recorded, not softened.** `drive.readonly` is a restricted scope: production use
requires Google verification and a CASA security assessment, the same debt INT-4 recorded for the
metadata scope and did not work around. **The least-privilege path is sequenced, not closed** — the
capability→scope map is keyed by CAPABILITY, so a later Picker-based capability can request
`drive.file` without touching or reinterpreting this entry.

#### A second capability, never a wider first one

`google.drive.content.read` is separate from `google.drive.metadata.read` at every layer: its own
catalog entry, its own scope, its own consent, and its own availability answer. A tenant holding only
the metadata grant is refused content **before any credential is spent**, and their metadata reads
keep working. **Both capabilities declare an empty write set**, so no grant makes this connection
write-capable.

#### The extensionless Google Doc, answered

A native Doc has no filename extension and cannot be downloaded with `alt=media` at all. KID-1
returns a **closed normalized `contentKind`** — `google-doc-text`, `plain-text`, `markdown` — so a
later boundary maps *that* through an allowlist instead of trusting a provider-declared MIME string.
The readable-type map is closed and consulted, never supplied: Sheets, Slides, PDF, DOCX, images and
everything else are refused rather than falling through to a generic download.

Supported: native Google Docs (via `files.export` to `text/plain`), `text/plain`, `text/markdown`.
**PDF is deliberately absent** — the parser exists and is bounded, but pointing it at untrusted
external bytes is a separate security surface that does not ride along with a scope expansion.

#### Bounds, and why each is checked where it is

The export MIME type is a frozen constant. Shared drives stay unclaimed. The file id is the only
caller input and is pattern-refused before use, so it cannot steer the request path. **Size is
bounded twice**: Drive's declared `size` gates the request *before any body is transferred*, and the
received byte count gates the result — because a declared size is a claim, a byte count is a
measurement, and a Workspace document declares no size at all. Bytes that are not UTF-8 are refused
rather than replaced.

#### Validation as released

`597/598` suites pass — **not a fully green run, and it is not reported as one.** Typecheck clean
and the build compiles. The suite total moved 596 → 598 because KID-1 adds two: the capability and
seam, and a boundary walker.

The single failure is `tests/k2-flow/create-and-read-postgres.ts`, the **known pre-existing K2
concurrency flake**. It was characterized rather than assumed: it passes on 3 of 4 isolated re-runs,
and it references **none** of the modules this milestone touched. It is still a flake and this
release does not record it as fixed.

**The firewall walks the real import graph** and proves **zero** Knowledge feature modules are
reachable from the content seam at any depth. Three Knowledge *schema* files are in the closure and
always will be — the availability seam needs a database handle, and `db/client.server.ts` imports the
schema barrel — so the assertion is about **capability, not vocabulary**: a Drizzle table declaration
is a description, not permission. The route by which they arrive is pinned, and the seam is proved to
name no schema module itself. KID-1's reach into governance, action, agent and Knowledge features is
asserted **equal to the released INT-4 seam's**, so this milestone added a capability and not a
wider reach.

**Six released pins were repaired, and all six stricter.** INT-4's directory-wide "no module reaches
file content" was **relocated** rather than deleted — it now asserts INT-4's own modules and the
metadata half of the transport, which is the sentence INT-4 actually owns. INT-3's Drive-scope pin
became a two-entry **allowlist**. Three capability censuses gained the new name. And PUB-1's Drive
write bite-proof **split into one per capability** — which is how a real gap was found.

#### A public claim that had quietly become a promise this repository could not keep

KID-1's own new bite-proof **did not bite**: a write scope added to the content capability left the
site still publishing that nothing in Drive is written, because the released guard checked only the
metadata capability's write set. The guard now covers **every** Google capability.

The published limit also read *"No file content is read"* — a blanket denial about Hebun. It is now
*"This capability reads no file content"*, scoped to the capability it was ever entitled to speak
for. **The content capability is deliberately not published at all**, under this file's own standing
rule that a capability which cannot be used is absent from the site.

#### Provider acceptance — the states, kept apart

```
IMPLEMENTED          = YES
CONFIGURED           = NOT MEASURED (no deployment configuration was changed)
AUTHORIZED           = NO  (no human has granted the content scope)
CONNECTED            = NO
VERIFIED             = NO  (no real Google content read has occurred)
PRODUCTION-AVAILABLE = NO  (blocked on Google verification + CASA)
```

**No mock proves provider acceptance, and none is claimed here.** Every test above uses a fake
transport and proves Hebun's own contract. The acceptance procedure is: a human authorizes
`google.drive.content.read` through the existing capability-upgrade route — which needed **no
change**, because the closed map resolves the new capability already — Google reports the content
scope actually granted, one supported document is selected, and the seam returns its real text with
**no Knowledge write of any kind**.

#### What KID-1 is NOT

It is not ingestion, not admission, not a Knowledge capability and not a product loop. It reads one
document a caller names and returns it. KID-2 was not authorized by that release; it was authorized
separately by the Director and is recorded at 12A.2 below.

---

### 12A.2 KID-2 — Provider Content Admission · **RELEASED**

```
KID-2 = RELEASED
IMPLEMENTED · DEPLOYMENT NOT MEASURED · NOT PRODUCTION-ACCEPTED
REAL GOOGLE ACCEPTANCE = NOT YET VERIFIED (blocked on Google verification + CASA)

PROVIDER READ != KNOWLEDGE        READ CONTENT != ADMITTED CONTENT
ADMISSION != RATIFICATION         PROVISIONAL != AUTHORITATIVE
INGESTED != CORRECT               CONTENT != INSTRUCTION
```

**KID-2 completes the bridge KID-0 found and adds no Knowledge system.** A permitted human selects
ONE discovered document, supplies the classification the existing authority already requires, and the
document's content travels the released path unchanged:

```
KID-1 content read → provider-content adapter → ingestKnowledgeFile → ingestKnowledgeSource
                   → the ONE Knowledge writer → attachExternalReference (KR-EXT1)
```

**No new authority, no new writer, no new table, no schema and no migration.** The ledger is
unmoved at 39, and a suite asserts that count. The bridge contains no `insert`, `update`, `delete`,
`transaction` or database handle, and names no `@/db` module at all — every act it causes belongs to
a released module it calls by name.

#### What it reuses, and what that leaves it owning

| Decision | Owner | KID-2's part |
|---|---|---|
| Who may admit | `resolveKnowledgeWriteAuthority` (K2's band) | Resolves it FIRST, before any credential is spent |
| May this be read | KID-1's capability gate | Calls the released seam; adds no second interpretation |
| Which types are readable | `GOOGLE_DRIVE_READABLE_TYPES` | Unchanged |
| What the content becomes | **KID-2's closed map**, keyed by content KIND | The one thing this milestone owns |
| Bounds, decoding, chunking, digest, duplicate rule, transaction, audit, standing | R4C.1 + the ingestion path | Unchanged, and proved unchanged |
| What it is about | `attachExternalReference` (KR-EXT1) | Composes the reference from released constants |

#### The extensionless Google Doc, closed

The adapter is keyed by `contentKind` — Hebun's own normalized answer from its own transport — and
**never** by `providerMimeType`. A native Doc exported as `text/plain` becomes `<sanitized name>.txt`
with type `text/plain`; plain text becomes `.txt`; Markdown becomes `.md`. The released
`SUPPORTED_FILE_EXTENSIONS` table then derives the source type from the extension **Hebun appended**,
so a Drive document named `report.pdf` that the transport classified as text becomes `report.pdf.txt`
and is read as text. **A provider-declared MIME type cannot select a parser**, and there is no
generic MIME parser, no sniffing and no fallback branch.

The allowlist is keyed by kind and not by MIME type for a reason that is the fail-closed direction:
**adding a readable type to the provider transport does not silently make it admissible into
Knowledge.** That is a second decision, taken in the adapter, and a test asserts the two maps agree
so a fourth kind added on one side alone fails visibly.

The document's name is untrusted text: control characters and both path separators are removed, the
stem is bounded by the released title bound in code points, and Hebun's extension is appended LAST so
`extensionOf` — which reads the last dot — can only resolve to the one Hebun chose. A name with
nothing usable left is **refused**, not replaced with an invented one.

#### Two authorizations, and neither grants the other

```
PROVIDER READ AUTHORIZED   AND   KNOWLEDGE ADMISSION AUTHORIZED
```

The Knowledge band is resolved **before** the provider is asked anything. That is R4C.1's gate order
and its reason — an unauthorized caller must not be able to use the refusals as an oracle — and here
it buys something further: a person who may not author Knowledge never causes a Google credential to
be spent and never learns what this organization connected or what is inside it. The file boundary
re-checks the band for itself, deliberately, exactly as it does for an upload.

Tenant identity comes only from the resolved server context. There is no parameter for a tenant id,
an integration id or a credential id, so naming another organization's connection is not refused —
it is **unrepresentable**.

#### Partial failure: the honest answer to a question with no clean one

**Admission and provenance cannot commit together, and that is a fact about the released seams, not
a preference.** `ingestKnowledgeSource` opens and owns its own transaction and takes no outer one;
`attachExternalReference` accepts no transaction parameter at all. Inventing a shared one would give
one authority a handle into the other's write — the cross-authority ownership this repository
refuses — and simulating a rollback by deleting admitted Knowledge is worse: nothing here holds
retraction authority, and Knowledge is never deleted.

So the truth is reported rather than smoothed over, and the operation is made **idempotent** instead:

| State | What is true | What the surface says |
|---|---|---|
| `admitted`, provenance complete | Every fact carries the declaration | Admitted as N provisional records; all N record which document they came from |
| `admitted`, provenance incomplete | The Knowledge is real, provisional and readable; some declarations are ABSENT | **"The provenance is incomplete"**, with the count and the reason, and how to finish it |
| `already-admitted` | The existing duplicate rule refused a second write | Nothing was written; the declarations were completed |

**Repeating the same admission is the recovery path**, and it is proved against a real database: a
run whose reference authority is unreachable admits the Knowledge and reports `declared 0`; the same
call again is refused as a duplicate — nothing written twice — and completes every missing
declaration. The fact identities on that path are derived with the ingestion path's **own exported**
identity function from the digest it just reported, and one that does not resolve to a row is
counted as unresolved rather than attached to something else.

A declaration is attached to **every** fact the source produced, not to the first: a chunk of the
document is still the document, and a reference on one alone would leave a provenance trace that
dead-ends on every other record the same import created.

#### The trust boundary, proved rather than detected

Provider content is DATA. There is no prompt-injection "detector" here and there deliberately is
none — **the architectural protection is that content is not instruction**. A hostile document that
declares its own domain, scope, standing and a tool call is admitted against a real database and
comes back out as the same characters, filed where the HUMAN filed it, `draft`/`provisional`, with
zero action permits in existence.

#### What it deliberately does not do

No multi-select, no folders, no crawl, no sync, no scheduler, no automatic admission, no automatic
ratification, no PDF, no DOCX, no Sheets, no Slides, no vector search. **Deleting the document at
the provider does not retract admitted Knowledge** — the released retraction authority remains the
only way, and the surface says so before the act.

#### Validation as released

Typecheck clean, **lint clean with zero errors**, and the build compiles; `/knowledge` prerenders
with the new section, and the section was rendered and read in a browser rather than assumed. The
suite total moved 598 → 602 because KID-2 adds four suites and no released suite was deleted.

**The first full run was 601/602, and the one failure was REAL — caused by this milestone.**
`tests/cmdv3-command-composition/composition.ts` holds a *named* census of every `StateBlock`
consumer, and the new admission control legitimately joins it: it must keep `restricted` (no session
or a role that may not author), `unavailable` (no persistence) and `empty` (nothing discovered to
admit) apart, and hand-rolling a tenth treatment would have been the regression. The census was
extended with that justification, re-verified green, and **one replacement full suite** was run:
**602/602, fully green**. A named census failing on a legitimate addition is the census doing its job.

**The known pre-existing K2 concurrency flake did NOT reproduce in either run.** It is not recorded
as fixed and no claim is made about it here — it simply did not fire.

**Nine bite-proofs were watched to bite**, each mutating real source and required to fail for the
intended reason: the provider's MIME choosing the representation, a kind added to the allowlist with
no reader behind it, the provider read moved ahead of the authorization gate, the domain inferred
from the document, the transport gaining an edge into ingestion, an unnamed door in the bridge, the
bridge opening a transaction, and two ways the surface could stop naming an outcome.

**Four released censuses were extended precisely, and none relaxed.** The two Knowledge-action
lists (K2, K3) gained the one new action with its justification. KID-1's "no route, action or UI
names the content seam" now *also* names the exact set of `src/` consumers, which is stricter than
the window it sits beside. And the discovery section's provenance assertion, which read a fixed
900-character window forward, now measures the section's exact extent — necessary because the
admission section sits immediately after it and is correctly `authoritative`.

#### Provider acceptance — the states, kept apart

```
IMPLEMENTED          = YES
CONFIGURED           = NOT MEASURED (no deployment configuration was changed)
AUTHORIZED           = NO  (no human has granted the content scope)
CONNECTED            = NO
VERIFIED             = NO  (no real Google content read or admission has occurred)
PRODUCTION-AVAILABLE = NO  (blocked on Google verification + CASA)
```

**No mock proves provider acceptance, and none is claimed here.** Every provider answer in every
KID-2 test is fabricated; what is real is every Hebun authority downstream of the provider boundary,
proved against a disposable PostgreSQL database. The acceptance procedure, when the scope becomes
grantable, is: one real Google Doc selected in `/knowledge`, real content read, the existing
Knowledge authority admits it, standing is `draft`/`provisional`, the external reference persists,
Knowledge coverage changes truthfully, Heby answers one question from `/knowledge` grounded in the
admitted content, and the provenance trace reaches the real provider document.

#### What KID-2 is NOT

It is not synchronization, not a second Knowledge system, not ratification, and not a claim that any
admitted content is correct. **The KID program's IMPLEMENTATION is complete, and its PRODUCTION
ACCEPTANCE is now PASS** — under the Picker + `drive.file` path of §12B, not under this milestone's
own `drive.readonly` capability, which remains unaccepted and still carries Google's verification and
CASA debt. Those are different states and are still recorded as different states. **No KID-3 exists
and none was created** — the acceptance above was run as a release gate, exactly as the procedure in
this section specified, and it was not an engineering milestone.

---

## 12B. Google least-privilege adaptation — Picker + `drive.file` · **PRODUCTION-ACCEPTED**

```
GOOGLE LEAST-PRIVILEGE ADAPTATION = RELEASED + PRODUCTION-ACCEPTED
NOT A KID MILESTONE · NOT KID-3 · NOT AN ERA · NOT ERA III

USER-SELECTED FILE != ALL DRIVE FILES        SELECTION != ADMISSION
```

**A permission decision, not a capability.** It adds no Knowledge capability, no schema, no
migration, no authority and no format. It changes which Google permission the production admission
path asks for, and the surface that selection happens on. The KID program's implementation was
already complete; this is what its production acceptance was blocked behind.

### Why the Director chose it

A **Post-KID enablement gate** measured Google's current policy rather than remembering it, and
found the blocker larger than recorded: **`drive.metadata.readonly` is classified RESTRICTED too.**
Hebun had held two restricted scopes since INT-4, so dropping only KID-1's `drive.readonly` would
not have cleared restricted-scope verification or CASA. That reframed the choice.

| | Keep `drive.readonly` | **Picker + `drive.file`** |
|---|---|---|
| Google classification | RESTRICTED ×2 | **NON-SENSITIVE** |
| Restricted-scope verification | required | **not required** |
| CASA security assessment | required, **annually**, paid | **not required** |
| Consent sentence | "View and download **all** your Drive files" | only the document the user picks |
| Blast radius of a stolen token | the customer's entire Drive | files already handed to Hebun |
| Engineering | none | bounded, and it touched no Knowledge authority |

Google's own Drive scope guide names `drive.file` the recommended scope and recommends the Picker
over an app's own file picker. Two further facts decided it: the permitted use cases for restricted
Drive scopes are narrow enough that Hebun's fit was **arguable**, and the Limited Use policy — which
by its own wording applies to data from **Sensitive and Restricted** scopes — carries a clause
restricting use of the data with machine-learning models. A non-sensitive scope is outside that
clause. **Least privilege was not the tie-breaker; it was cheaper, faster, more saleable and less
legally exposed at the same time.**

### KID-1's decision is not rewritten

**KID-1 chose `drive.readonly` correctly, given the architecture that existed.** Without a Picker,
`drive.file` grants access to nothing, so a connection would have reported available and read an
empty Drive. KID-1's own record says so and stands unaltered. **The Picker changed the architecture,
not the history** — which is exactly why KID-1's capability→scope map was keyed by CAPABILITY, with
its header recording that a later Picker-based capability could arrive "without touching this entry".
This is that capability.

### A third capability, never a remapping

`google.drive.file.content.read` → `https://www.googleapis.com/auth/drive.file`.

The two released capabilities keep their scopes **because production records name them**: KID-2
writes the capability key into `knowledge_external_references`, so a reference declared under
`google.drive.content.read` means "this fact arrived under a Drive-wide grant". Silently repointing
that key would rewrite the meaning of rows already written, and no reader could tell which
permission a document actually arrived under. A real-database test asserts both spellings land on
the same table from the two paths.

The choice of permission is fixed by **which function is called** — `admitPickedProviderDocument`
versus `admitProviderDocument` — never by a field, because the server actions build their input from
a form and a client that could name the capability could ask for a Drive-wide read recorded as
though it were per-file.

### The one boundary this deliberately widens

INT-4 and KID-1 proved a tenant's Google access token never leaves the server. **Google's Picker
cannot work that way**: it renders in the browser and requires an OAuth token through
`setOAuthToken`. So the adaptation makes a **conscious, bounded exception**, and says so in the
module rather than around it.

- **Exposed:** one Google *access* token, short-lived by Google's design.
- **Not exposed:** the refresh token, the client secret, the state secret, any credential or
  integration identifier, any vault material.
- **Gated:** the signed-in human must hold the Knowledge authoring band *and* the organization must
  hold the **per-file** capability. A tenant holding only the Drive-wide grant is **refused a token**
   — releasing one on that grant would put a key to the whole Drive in a web page, which is the
  thing this adaptation exists to prevent.
- **Bounded:** a firewall asserts **exactly one module** in the repository hands a token to a
  caller. A second is a decision somebody has to record there.

The browser-side alternative — Google Identity Services minting its own token — was considered and
**rejected**: it would create a second Google authorization path the connection authority does not
own and cannot see, which is the two-interpreters defect this codebase refuses everywhere else.

Two new configuration values are classified honestly rather than defensively: the Picker **API key**
is a browser key, and the **app id** is the Cloud project number. Both are browser-safe
configuration, both reach the browser by design, and neither is a secret. Treating them as secrets
would be a false claim in the other direction.

**The referrer restriction this section once claimed is NOT in force.** Production acceptance below
records what the deployment actually holds: the key's Application restriction is **None**, and its
API restriction is Google Picker API. A sentence describing a protection that was later removed is
the kind of false claim this repository refuses in the other direction too.

### What the surface does now

Connect Google → **Choose from Google Drive** → Google's own chooser, filtered to the admissible
types → one document → classify it → Admit. The chooser enables no multi-select feature and excludes
folders explicitly. The admission card no longer consumes the Drive-wide discovery listing at all,
which is what makes "the production path needs no restricted scope" structural rather than stated.
The discovery section above it is untouched and still admits nothing.

**Closing the chooser is not a failure.** It is a named outcome and is reported as a decision the
human made, alongside: Google not connected, per-file permission not granted, chooser not
configured, unsupported document, content read failed, Knowledge authorization refused, validation
refused, duplicate, admitted-with-incomplete-provenance, and fully admitted.

### Validation as released

Suite **605/605, fully green** (602 + 3 new suites). Typecheck clean, lint clean with zero errors, build compiles, `/knowledge`
renders. Three suites added; no released suite deleted.

**Eight bite-proofs were watched to bite**, each mutating real source and required to fail for the
intended reason — including the single change that would undo the whole adaptation while leaving
every name in place: repointing the per-file capability at `drive.readonly`.

**One bite-proof did NOT bite, and it found a real gap.** Dropping the capability argument at the
bridge's call site left the provenance test passing, because that test asserted the *helper* rather
than what an admission actually produced. The assertion now reads the bridge's own output. A second
weakness surfaced the same way: the suite's list of "restricted scopes" was derived from the
constants under test, so repointing one would have silently redefined what restricted meant. It is
now written as literals, with a pin tying Hebun's names to Google's classification.

**Seven released censuses were extended precisely, none relaxed** — three Google capability lists,
the scope-upgrade census, the Drive-scope allowlist, and the two Knowledge-action lists.

**Two released assertions were REPLACED rather than weakened, and both replacements are stronger.**

- KID-2 proved single-selection with a radio group. Selection now happens in Google's chooser, so
  the proof is that Google's multi-select feature is never enabled, folders are excluded explicitly,
  and exactly one identifier reaches exactly one call site.
- INT-3 banned the string `auth/drive.file` outright as "write-capable", and **its reason was real
  and is not dismissed**: `drive.file` does permit writing files the app itself created. A string
  ban can only prove a scope was not named. What replaces it proves no write can happen — every
  non-GET request in the Google transport goes through one helper whose call sites are pinned to the
  OAuth token and revocation endpoints, no Drive URL is ever posted, patched, put or deleted, and
  every Google capability declares an empty write set. **The concern outlived the mechanism that
  expressed it, so the mechanism was upgraded rather than the concern discarded.**

### Production acceptance — RUN, on a real document · **PASS**

```
IMPLEMENTED          = YES
CONFIGURED           = YES  (Picker API key + app id present in production)
AUTHORIZED           = YES  (a human granted the per-file scope; recorded grant carries drive.file)
EXECUTED             = YES  (real Picker, real Google Doc, real provider read, real admission)
VERIFIED             = YES  (measured in production against the released read seams)
RESTRICTED SCOPE REQUIRED BY THE ACCEPTED PATH = NO
CASA REQUIRED BY THE ACCEPTED PATH             = NO
```

The Director revoked Hebun's existing Google access first, re-authorized for identity +
`drive.file` only, opened Google's chooser, cancelled once, reopened, selected exactly one Google
Doc, classified it `policies` / company-wide, and admitted it. Heby then answered from it in the
`/knowledge` workspace, citing the record and its standing.

**Measured in production afterwards, not inferred from the screen:**

| Claim | How it was measured | Result |
|---|---|---|
| Grant carries `drive.file` | `integrations.scopes` | `openid`, `userinfo.profile`, `userinfo.email`, `drive.file` |
| No restricted Drive scope held | same row | `drive.readonly` absent, `drive.metadata.readonly` absent |
| The read ran under the per-file grant | connection last written 21:50:49Z; reference declared 22:15:48Z, connection unwritten since | **the whole path ran while Hebun held no restricted scope** |
| Provenance names the per-file capability | `knowledge_external_references` | `google-workspace` · `google.drive.file.content.read` · `document` · declared by a **human** |
| Provenance does NOT name the Drive-wide capability | same table | `google.drive.content.read` absent |
| One record, from the selected document | fact ↔ node ↔ reference join | exactly **1**, `chunkCount: 1` |
| Classification | `knowledge_facts` | `domain_key = policies`, `knowledge_scope = company-wide` |
| Standing | `knowledge_nodes` | `provisional` · `draft` · `ratification_decision_id` NULL · `ratified_at` NULL |
| Real provider content landed | node `statement` | 38 chars, contains the acceptance fact |
| Schema untouched | production migration ledger | **39**, equal to the repository journal |

**Coverage moved truthfully: 0/10 → 1/10.** `policies` now holds one fact in force and reports
**covered**. The released projection is explicit that this is correct — *"Coverage is not
RATIFICATION. A category covered entirely by unapproved drafts is covered."* The pre-existing
`engineering` fact still folds to no declared area and still contributes to nothing.

**Standing was NOT promoted.** The admitted record is provisional, draft, unratified. Nothing in
this acceptance ratified anything, and admission is not ratification.

### The Picker incident, classified honestly

The Picker first failed in production with Google's own `The API developer key is invalid.` The
API-key/app-id wiring was traced end to end — env resolver → session authorization → `setDeveloperKey`
/ `setAppId` — and every hop passes named fields with no possible swap. **No source defect was
found, and no source was changed.**

The Director then changed the key's **Application restriction from Websites/referrer to None**,
leaving the API restriction as Google Picker API, and after propagation the Picker opened and
worked. **That is a correlation with a fix, not a proven cause.** No Google-side evidence was
obtained; the key's value is write-only in the deployment system and this repository has no Google
Cloud read seam. The stronger claim is not made.

**The remaining implication is recorded rather than resolved:** the production Picker API key is
**not website-restricted**. It remains API-restricted to Google Picker API *per the Director's
Google Cloud configuration* — human-observed, not verified from here. This is a deployment security
tradeoff that may deserve hardening investigation later. **It does not invalidate the functional
acceptance, and this closure does not solve it.**

### One observation that is not a defect

Heby's answer rendered a parenthetical English gloss that translated *Mavi* as "Brown". The stored
Knowledge was checked: the node's statement contains the original fact and does **not** contain that
word. So the source, the provider read and the admitted record are all intact, and the gloss is a
presentation artifact of the model's own answer rendering. **Retrieval of the source fact
succeeded.** Nothing here is repaired, because nothing in the ingestion path is wrong.

### What this acceptance does NOT authorize

**Workspace availability is not global Heby availability.** This ran in `/knowledge` and is evidence
about `/knowledge`. It is **not** justification to widen Command grounding, and it opens no
milestone. `drive.file` is not widened. No second Knowledge or provenance authority exists.

---

## 13. Era III — Constraints and Future Direction

Era III is **not active**, and **Era II closing did not start it** (§12.9). It is constrained in advance:

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

It does **not** get a separate top-level era, and it is **not** in the E2-1 → E2-3 sequence (§12), which is now closed and exhausted. It remains future work, and nothing selects it. **Director ruling recorded at Era II closure (§12.9): it is NOT an Era II closure blocker.** An era closes against its established outcome, not against every future program positioned beneath it — and §4's outcome reaches synthesis, while Director Intelligence introduces the later level `SYNTHESIZED EVIDENCE → ADVISORY INTELLIGENCE → DIRECTOR CALIBRATION`. Being placed under Era II is where it would land **if** activated; it is not a debt Era II owed. It may later benefit from organizational evidence, decision history, agent evidence, outcomes, Knowledge and Governance evidence — none of which activates it.

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

**NONE SELECTED.** **Era II is CLOSED** at `6b4a72b` against the §4 outcome (§12.9), with **no active milestone** and **zero remaining required Era II milestones**. E2-4, E2-5, E2-6, E2-7 and E2-8 are all **PRODUCTION-ACCEPTED**; **no E2-9 is opened, no era is activated, and no closure schedules ASA-2.**

**An era closing selects nothing.** Era III is **NOT started** (§13) and is not opened by Era II closing, exactly as Era II was not opened by numbering. The next program or era is a **separate Director decision**, taken from measured repository and product reality.

**That decision was taken, and it did not open an era.** After a Post-Era-II Strategic Product Gate measured production — 40 Heby messages and 275 grounding-evidence rows against **one** Knowledge fact, zero permits and zero execution attempts — the Director selected **Knowledge Ingestion Depth (KID)**, a finite two-milestone program (§12A). **KID-1 and KID-2 are both RELEASED, and the program's PRODUCTION ACCEPTANCE is now PASS.** Those were different states and both are now true; no KID-3 exists — waiting for a provider was a release gate, not a milestone. **What it was blocked ON changed twice**: an enablement gate found that Hebun held TWO restricted Google scopes, not one, so the Director adapted the permission model rather than pay for restricted-scope verification and an annual CASA assessment; the production admission path became Google Picker + the non-sensitive `drive.file` scope (§12B), which left acceptance blocked on configuration and one human grant. Both were then supplied, and the whole path — Picker, real Google Doc, real provider read, human admission, provenance, coverage 0/10 → 1/10, Heby answering in `/knowledge` — ran in production while Hebun held **no restricted Drive scope**. A program is not an era: Era II stays **CLOSED**, Era III stays **NOT STARTED**, and no Era II milestone is reopened.

**A release gate followed it, and it was run: Knowledge ratification is PRODUCTION-ACCEPTED.** KID
left production holding two Knowledge facts and **zero** ratified ones, while K4's ratification
runtime had been released and wired to `/knowledge` for milestones without ever being exercised —
because `GOVERNANCE_SUBJECT_TYPES` is closed at `knowledge_node` and, until KID, no such row existed.
KID created the first ratifiable subject. The Director then reviewed version 1 of the admitted
`policies` record in the released review card and ratified it. **This opened no milestone and wrote
no code** — running an existing released capability in production is a gate, the same rule KID's own
closure applied to itself.

Measured afterwards through the released seams, against a baseline captured before the click:

| | before | after |
|---|---|---|
| Knowledge facts / nodes | 2 / 2 | **2 / 2** — no duplicate, no v2, no superseding node |
| Ratified versions | 0 | **1** |
| Governance decisions | 2 | **3** — `ratify` · subject `knowledge_node` · outcome `ratified` · human actor · human authority source |
| Governance sessions | 2 | **3** |
| Audit rows | 25 | **27** — `governance.decision.recorded` and `knowledge.ratify`, both `committed`, at the identical instant |
| Declared-area coverage | 1/10 | **1/10 — unchanged** |
| Permits · execution attempts | 0 · 0 | **0 · 0** |

The decision is bound to that exact version and nothing else: the decision's subject id is the
version's row id, the version points back at that decision, the session matches, the actor is the
same human, and both timestamps are the same instant — one transaction, as K4 specifies.

**RATIFICATION DID NOT PROMOTE THE AUTHORITY FIELD, and that is the released design.** The record
still reads `provisional` / `draft` after ratification, because the writer sets exactly eight columns
— the decision, the session, the ratifying actor pair, `ratified_at`, and the `updated_*` trio — and
`knowledge_authority` is not among them. The Company Understanding tallies are therefore
**overlapping buckets, not a partition**: `policies` now reports *1 fact in force · 1 carrying a
bound Governance decision · 1 not marked authoritative*, and all three describe the same record.
A reader who takes the third line as "ratification failed" has misread it.

```
ADMITTED     != RATIFIED
PROVISIONAL  != RATIFIED
RATIFIED     != TRUE
RATIFIED     != EXTERNALLY VERIFIED
RATIFIED     != PERMANENTLY FRESH
RATIFIED     != AUTHORITATIVE (the authority field is untouched)
```

Ratification applies to **this exact version only**; a future version requires its own Governance
decision, and the card says so before the act. The gate proves the released authority can perform
the transition in production. **It creates no ratification policy, no automatic ratification, and no
permit or execution authority** — all three execution tables remain empty.

**Knowledge Governance Attention (KGA) — released, not numbered.** A bounded discovery after the
ratification gate found a blind spot: E2-4's attention observation could surface proposals, permits
and recorded acts, and could not see a Knowledge version waiting on a Governance decision. The
Director had to open `/knowledge` and look. **It is an extension of a released authority, not a new
milestone** — no E2-x number, for the reason §12B carries none: numbering is not how work is
selected here.

**The predicate is the whole design, and the obvious one is WRONG.** "Unratified" and "undecided"
are different populations, because K4 writes **nothing** to Knowledge for a REJECT — recorded in
three places, including the audit vocabulary, where `knowledge.reject` is absent since "a rejection
records a Governance decision and changes NOTHING in Knowledge". So in Knowledge's own tables a
rejected version is indistinguishable from an unseen one, and an observation built on
`ratification_decision_id is null` would tell a Director that a decision they already took is still
outstanding. That is not a smaller truth; it is a false statement about who owes an answer.

    UNDECIDED != UNRATIFIED        UNDECIDED != UNREAD        DECIDED != APPROVED

**Two owners, one subtraction, no join.** Neither side can answer alone: Knowledge cannot see a
rejection, and Governance does not know which versions exist. So each answers only about its own
tables and the composition subtracts.

| Question | Owner | Seam |
|---|---|---|
| Which versions currently exist? | Knowledge | a new uncapped repository read returning **identities and one timestamp** — no statement, label, domain or provenance |
| Which of them has Governance decided? | Governance | a new read over `decision_records`, `subject_type = 'knowledge_node'`, returning **identities only** |
| Which are still waiting, and for how long? | the E2-4 composition | subtracts one set from the other; holds no handle to either table and constructs no statement |

`ratify` and `reject` are deliberately **not** distinguished by the Governance read. Both answer
"nobody still owes an answer", and a caller that could tell them apart could rank one above the
other — a judgement no subsystem outside Governance may hold. A firewall asserts the read filters on
neither `decision_type` nor `outcome`.

**Both availabilities stay separate, and the block fails closed.** A readable Knowledge list with an
unreadable decision set would make every current version look undecided, so the block reports
unavailable and names which half failed. `UNAVAILABLE != NOTHING AWAITING REVIEW`.

**What reaches Command: a count, a duration, a basis and a route.** No statement, title, domain,
scope, node id or tenant id — E2-8's boundary holds because the observation carries no field that
could hold any of them. The sixth timestamp basis, `knowledge-node.created_at`, states exactly one
thing: this version has had no Governance decision naming it for this long. Its `doesNotMean`
explicitly rejects urgent, important, priority, overdue, late, stalled, critical, risky, SLA breach,
should-approve, should-reject, unread and unreviewed. Heby observes and routes to `/knowledge`;
**K4 and G2 remain the authorities for the act.**

**Validation.** Suite **607/607** (605 + 2 new suites), typecheck clean, lint zero errors. The
rejection case is proved against a **real** PostgreSQL database, because it is the one case a fake
would have to be told about — the seed reproduces K4's asymmetry exactly, writing a decision and no
Knowledge mark. **Two bite-proofs were watched to bite:** ignoring the decided set failed on the
ratified assertion, and narrowing the Governance read to `ratify` failed on the rejected one. Three
released E2-4 censuses were **extended, never relaxed** — the basis union 5 → 6 with the new entry
named in its closed `deepEqual`, basis usage 5 → 6, and the item count 4 → 5.

**Zero schema, zero migration, zero writer, zero new authority** — ledger unchanged at 39. No
execution or authorization path became reachable, asserted structurally and against the database.

**PRODUCTION-ACCEPTED.** Released `dce8a76`, deployed with commit binding VERIFIED and aliased to
the production domain. The Director asked Heby, in Command, what Knowledge is waiting for a
Governance decision, and Heby answered from the released grounding: one version awaiting a decision,
oldest authored 4 days 22 hours ago, basis `knowledge-node.created_at`, no ratify or reject decision,
decided in the Knowledge workspace. It stated plainly that the content, identifier and subject matter
were **not carried in grounding**, invented nothing to fill the gap, and used no urgency, priority,
overdue, risk, SLA or ranking language.

Corroborated afterwards against production through the released predicate, and against a baseline
captured before the query:

| Claim | Measured |
|---|---|
| Versions awaiting a Governance decision | **1** |
| The undecided version is included | `engineering` — human-authored, current, in force, named by no decision |
| The decided version is suppressed | `policies` — carries a decision, correctly absent |
| Elapsed basis | `knowledge-node.created_at`, and 4 days 22 hours matches the row exactly |
| Production mutation | **NONE** — facts 2, nodes 2, decisions 3, sessions 3, audit 27, permits 0, attempts 0, all unchanged |

No test record was created, and the already-ratified version was not touched.

### One product behaviour observed, recorded, and deliberately NOT solved

The first acceptance attempt asked the broader question — *what needs my decision?* — and Heby's prose
named only the action-request category, though three pending proposals made that answer correct as far
as it went. **The released runtime was measured against the production database and every hop was
right**: the Knowledge read returned, the Governance read returned, the observation reported one
version awaiting a decision, the grounding source emitted five items, and `groundingLines` carries
every item with no cap, so the fifth line reached the model verbatim. `assembleEvidence` had already
put it in the response's evidence set, unfiltered by the prose.

    DETERMINISTIC EVIDENCE COVERAGE != GUARANTEED PROSE COVERAGE

An item can be in context, in evidence, and absent from the sentence a human reads, because the prose
is a summary and the model chose one of two candidates. **This is not a KGA runtime defect and it is
not repaired here.** Whether Hebun wants a coverage guarantee over Heby's prose is a Heby-wide
question touching every workspace and every source class; forcing enumeration to fix one summary would
trade a model's judgement for a rigid output shape across the product. It is recorded so the property
is written down somewhere, and it is deferred.

```
IMPLEMENTED          = YES
DEPLOYED             = YES  (commit binding verified, aliased)
VERIFIED             = YES  (runtime measured against the production database)
PRODUCTION-ACCEPTED  = YES  (authenticated Heby answer, corroborated by rows)
```

**A Step A finding is recorded and deliberately NOT solved.** `knowledge_authority` supports
`authoritative | provisional`; **two writers exist and both hard-code `provisional`**, so nothing in
the repository can produce `authoritative`. Heby's Knowledge source computes `authoritative:` as
"every record is authoritative", which is therefore a **constant, not a measurement** — truthful, and
structurally unable to become anything else. No architecture document, roadmap entry, test or writer
defines a `provisional → authoritative` transition. Ratification is not it: K4's frozen non-effects
say it "does not grant anyone new authority", K1 records that Knowledge "cannot promote its own
authority", and `knowledge_lifecycle_status` already has a `ratified` value that K4 deliberately
refuses to write rather than "fabricating semantics the repository never defined". **The open
architecture decision is what Hebun means by authoritative Knowledge and which authority may confer
it.** It is a Director decision and nothing here presumes it.

```
NEXT MILESTONE = NOT YET SELECTED
```

Era I is **CLOSED** at `047dde8` (§11.3). **Era II is CLOSED** at `6b4a72b` (§12.9) — and it did not close because nine milestones closed beneath it; it closed because the §4 outcome was **measured** satisfied, clause by clause, which is the only thing that ever closes an era here. *(The per-milestone closure records in §12.3–§12.8 each say "Era II remains OPEN". Every one was true when written and is preserved unrewritten under §3 principle 8; §12.9 supersedes them as current state.)* The bounded order E2-1 → E2-2 → E2-3 was exhausted; LMX-1 followed E2-3 as a **product-experience** milestone by Director decision, and **E2-4 followed it as an Era II milestone by Director decision after a read-only discovery pass** — which is exactly how the next one must also be chosen, from measured repository and product reality, never from numbering.

**E2-1 is CLOSED.** Released and pushed at `dfa76248c38bad2c994e1494ac41896296b09067`, **not deployed**. Heby grounds on the Organization Authority as one ordinary evidence source; it does not consume Live Map, internal organization structure remains unavailable, no agent fact is admitted, and no new authority was created. **E2-1 closed is not Heby Intelligence complete.**

**E2-2 is CLOSED.** Released and pushed at `7b30893b5231e8a891602964c67842bccf042c87`, **not deployed**, and every closure claim was re-measured from the repository before this status was recorded (§12). The Security Center holds exactly one connected source class — `audit` — read tenant-scoped and bounded through a projection it does not own, and reported as **derived** over authoritative records. It gained no finding authority, no incident authority, no policy authority, no trust authority, no score, and no write, authorization or execution authority. **E2-2 closed is not Security complete, and not a Security Command Center.**

**E2-3 is CLOSED and PRODUCTION-ACCEPTED.** Released and pushed at `00eda193948c6f86b422e84d198ef03363adf761`, learnings at `2aff2376ee72a6229c6a4ab5af15673e04a6408a`, **deployed and production-accepted** (§12.3) — server-side and authenticated UI acceptance both PASS, after a production migration repair 37 → 39. Existing authoritative Live Map agent nodes are enriched with a derived cumulative Agent Outcome observation through an id-keyed read-only projection owned by the outcome authority. It created **no node type, no edge type, no writer, no schema, no migration and no authority**; `LiveMapTruth` is unwidened, the ledger is unchanged at 39, and the enriched import closure contains no durable writer at any depth. **E2-3 closed is not Live Map complete, and not Live Map Intelligence complete.**

**LMX-1 is CLOSED and PRODUCTION-ACCEPTED.** Released and pushed at `8fb299e1aaac36d5f1db295d05877395de91b1e2`, learnings at `1b9f88a007ee40fda2c4cc239b87554f67e2f680`, **deployed and production-accepted** (§12.3).

**E2-4 is CLOSED and PRODUCTION-ACCEPTED.** Organizational Attention Observation — released and pushed, **deployed with commit-binding VERIFIED, and production-accepted** (§12.4) — server-side and authenticated UI acceptance both PASS, with no production defect found and no source, schema, migration or production row changed to obtain it. Hebun now reads the timestamps its authorities were already writing: how long a proposal has awaited a decision, how long the oldest has waited, how long something approved has gone without an attempt, how long an unspent authorization has left, and how long since the last recorded governed act. It created **no schema, no migration, no writer, no node type, no edge type and no authority**; the ledger is unchanged at 39. **It is not a policy authority: AGE != IMPORTANCE, WAITING != LATE, NO THRESHOLD IS A POLICY.** Deciding what a duration means would need its own discovery and its own authorization. `/live-map` is now an organization-centred visual map whose agents open into an inspector separating authoritative identity from derived cumulative outcome, and the authenticated landing carries a Live Map Live / Security Live awareness band built from released seams. It created **no node type, no edge type, no writer, no schema, no migration and no authority**, and it added an executable guard that the authenticated dashboard cannot regress into reusable static HTML. **It is a product-experience milestone, not E2-4** — see §12.

**E2-5 is CLOSED and PRODUCTION-ACCEPTED.** Heby Agent Grounding — released and pushed at `a9815fb`, its production validator defect fixed at `33cd99f`, **deployed with commit-binding VERIFIED and production-accepted** (§12.5) — server-side and authenticated Heby acceptance both PASS. Heby can now answer which durable agents this organization established and what became of what each proposed, grounded in E2-3's production-accepted outcome observation under a source class of its own — including about itself, since Tenant Zero's one durable agent is Heby. It created **no schema, no migration, no writer, no agent authority, no lifecycle act, no node type and no edge type**; the ledger is unchanged at 39. **It is not a mandate authority: OUTCOME != MANDATE, APPROVED != EXECUTED, RUNTIME AGENT != WORKFORCE IDENTITY.** What an agent is FOR still has no owner, and `workforce` deliberately did not gain the class.

**E2-6 is CLOSED and PRODUCTION-ACCEPTED.** Heby Recorded Act Grounding — released and pushed at `f0afc2d`, its production truth-semantics defect fixed at `46d9caf`, **deployed with commit-binding VERIFIED and production-accepted** (§12.6) — server-side and authenticated Heby acceptance both PASS. Heby can now answer what this organization has recently done, from the acts Hebun's own writers durably recorded, instead of only how many there were. It created **no schema, no migration, no writer, no authority, no node type and no edge type**; the ledger is unchanged at 39. **It is not a history authority: RECORDED ACT != ALL ORGANIZATIONAL ACTIVITY, RECENT != IMPORTANT, CHANGE != CAUSATION.** Hebun records some acts and not others, and the class states the total behind its bounded page every time it answers.

**E2-7 is CLOSED and PRODUCTION-ACCEPTED.** Heby Windowed Recorded-Act Intelligence — released and pushed at `c275d12`, **deployed with commit-binding VERIFIED and production-accepted** (§12.7) — server-side, Heby grounding and authenticated Heby acceptance all PASS, with no production defect found. Heby can now count how many acts Hebun recorded inside an explicit half-open period and report two adjacent equal-length periods side by side, instead of only a bounded recent page. It created **no schema, no migration, no writer and no authority**; the ledger is unchanged at 39. **It is not a trend authority: TIME WINDOW != TREND, MORE != BETTER, LESS != WORSE, CHANGE != CAUSATION.** It computes no delta, direction, rate or projection, and Hebun still holds **no definition of "recent"** — every window is reported with its exact instants.

**E2-8 is CLOSED and PRODUCTION-ACCEPTED.** Heby Knowledge Coverage Grounding — released and pushed at `08bd22a`, **deployed with commit-binding VERIFIED and production-accepted** (§12.8) — Knowledge authority, Heby grounding and authenticated Heby acceptance all PASS, with no production defect found; the first human attempt was a truth-safe refusal caused by asking from `/heby`, which resolves to Command by design, and Command was deliberately not widened. Heby can now answer which declared knowledge areas this organization holds facts in force in, and — the part retrieval structurally could never reach — which declared areas it holds nothing in. It created **no schema, no migration, no writer and no authority**; the ledger is unchanged at 39. **It is not a knowledge quality authority: A RETRIEVAL RESULT != AN INVENTORY, COVERAGE != CORRECTNESS, COVERAGE != RATIFICATION, MISSING != THE ORGANIZATION LACKS IT.** It computes no score, percentage, confidence, readiness or priority, and it reaches the Knowledge workspace ONLY — Command gains no knowledge inventory.

**No next milestone is selected.** Organization Structure Authority stays unavailable, the generic Agent Registry stays rejected, **ASA-2 stays blocked** — unchanged by E2-8, which reads Knowledge rather than agent evidence and adds no time window at all, and re-measured at E2-7: still no time-window predicate exists in `agent-outcome-observation/`, `agent-evaluation/` or `agent-improvement-hypothesis/`. E2-7 built the repository's first windowed read, but over `audit_log` in the recorded-act authority, **not** over agent evidence, so ASA-2's prerequisite is untouched and unauthorized — Director Intelligence stays outside the sequence, and the Knowledge, Security and Integration Live Map layers stay deferred — none of them is opened by E2-3 or E2-4 closing. Selecting what follows requires reading the repository again, not continuing a number.

Nothing in Era II is authorized by this document. In particular, a candidate being technically safe to build is not a reason for it to be next, and a closed milestone authorizes nothing that follows it.

```
ERA I CLOSED     != PRODUCT FINISHED
ERA II CLOSED    != ALL ERA II WORK AUTHORIZED
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
E2-4 PRODUCTION-ACCEPTED != NEXT MILESTONE SELECTED
COMMIT-BINDING VERIFIED  != COMMIT-BINDING INFERRED
E2-5 PRODUCTION-ACCEPTED != HEBY INTELLIGENCE COMPLETE
E2-6 PRODUCTION-ACCEPTED != ORGANIZATIONAL HISTORY AUTHORITY
E2-7 PRODUCTION-ACCEPTED != TREND AUTHORITY
E2-8 PRODUCTION-ACCEPTED != KNOWLEDGE QUALITY AUTHORITY
WORKSPACE AVAILABILITY   != GLOBAL HEBY AVAILABILITY
A TRUTHFUL REFUSAL       != A DEFECT
MISSING EVIDENCE         != ORGANIZATIONAL IGNORANCE
UNAVAILABLE              != MISSING
A RETRIEVAL RESULT  != AN INVENTORY
COVERAGE            != CORRECTNESS
COVERAGE            != RATIFICATION
MISSING             != THE ORGANIZATION LACKS IT
TIME WINDOW         != TREND
MORE                != BETTER
LESS                != WORSE
A STATED BOUNDARY   != A DEFINITION OF RECENT
RETRIEVAL COVERAGE  != REAL-WORLD COVERAGE
COMPLETE RETRIEVAL  != COMPLETE HISTORY
DERIVED             != AUTHORITATIVE
A COUNT OF ACTS     != A HISTORY OF ACTS
CONSTITUTION        != HISTORY
RECORDED ACT        != ALL ORGANIZATIONAL ACTIVITY
CHANGE              != CAUSATION
UNAVAILABLE CONTENT != PERMISSION TO DESCRIBE IT
OUTCOME             != SUBJECT
OBSERVATION         != ACTION CLAIM
RUNTIME AGENT       != WORKFORCE IDENTITY
OUTCOME             != MANDATE
NEW SOURCE CLASS    != NEW AUTHORITY
SIX CLOSED          != ERA II CLOSED
FOUR CLOSED      != ERA II CLOSED
NUMBERING        != A MILESTONE
LIVE MAP         != TRUTH AUTHORITY
TRUTH BEFORE GRAPH COMPLETENESS
RELEASED         != DEPLOYED
ROADMAP          != ARCHITECTURE AUTHORITY
DISCOVERY RESULT != REPOSITORY TRUTH
```
