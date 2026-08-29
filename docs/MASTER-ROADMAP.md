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

**Repository truth overrides this roadmap.** Every classification below was measured against the repository at the baseline named in §8, and any future reader who measures a different reality should trust the measurement, not this page.

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

These are the stable top-level evolution stages of Hebun. Implementation discovery may add, split, or defer work *beneath* an era. It may not casually create a new top-level era (see §17, rule 12).

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
| 5 | **Organization** | Organizational structure, departments, people, roles. **Durable authority not yet established** (§8). |
| 6 | **Integrations** | External provider contracts, connections, credentials, and provider-sourced reads. |

A new subsystem does **not** automatically become a product line (§17, rule 2).

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

## 7. Cross-Era Maturity Matrix

| Product line / surface | Era I | Era II | Era III |
|---|---|---|---|
| **Heby** | Core v1 — bounded conversational grounding | Heby Intelligence | Heby as operational interface |
| **Agents** | Durable identity + truthful activity | Agent Registry · evidence seam · evaluation | Advanced self-improving agents |
| **Governance** | Decision authority + recorded acts | Governance intelligence overlays | Governed autonomy |
| **Knowledge** | Facts, provenance, retraction | Memory · learning | Organizational learning loop |
| **Organization** | **Organization Authority (L3)** | Organizational intelligence evolution | Living organizational system |
| **Integrations** | Provider contracts + connections | Provider-sourced intelligence | Operational integration |
| **Live Map** *(promoted surface)* | **Live Map Core v1 (L4)** | Live Map Intelligence v1 | Live Map Operational v1 |

---

## 8. Current Position — YOU ARE HERE

**Measurement baseline:** commit `413bfde86163eb9d78f7fa1cda24a76d544b8df9` on `main`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger: **39 entries** (idx 0–38), last `20260828190630_sia3_agent_improvement_hypothesis`.

Classifications are drawn only from: CLOSED · ACTIVE · PARTIAL · DISCOVERY COMPLETE · DESIGN ONLY · NOT STARTED · DEFERRED · UNAVAILABLE.

**No percentage is used as a status or progress claim anywhere in this document.** A percentage without a defensible denominator is a fabricated measurement.

| Capability | Status | Repository evidence |
|---|---|---|
| Mock-surface gating authority | **CLOSED** | `src/features/mock-surface-gating/gate.server.ts` exists and fails closed; permits compiled-in organizational demo data only when the auth environment is explicitly `disabled`. |
| Heby Executive Overview truthfulness | **CLOSED** | `heby-runtime/overview-source.server.ts` reads `getDirectorDashboardUiModel`, which returns `unavailableDashboard()` when demo data is not permitted — `unavailable`, never a fabricated zero. |
| Truth boundary across *all* compiled-in fiction | **PARTIAL** | The gate has **two** call sites (`director-dashboard-ui/adapter.server.ts`, `command-goals/workspace-model.ts`). Other surfaces still read compiled-in mocks directly — e.g. `runtime-projection/builders/organization-projection-builder.ts` imports departments from `@/features/agents/mock`. **This gap is L1.** |
| Organizational durable truth authority | **UNAVAILABLE** | `organizations` and `departments` tables have existed in the ledger since the foundation baseline (`20260711173046_foundation_baseline.sql`) and have **zero writers** — no insert or update against either table exists anywhere in `src`. The live organizational projection is seeded from a compiled-in mock. A table is not an authority. |
| Heby Core v1 | **PARTIAL** | One remaining bounded gap, **per HMR-1 Director review**. This roadmap records the attribution rather than asserting an independent measurement; the specific gap is to be restated at L2 entry. |
| SIA — pre-application loop (OBSERVE → EVALUATE → PREPARE → FILE → GOVERN) | **CLOSED and product-reachable** | `/agents` renders outcome observation, evaluation, and improvement-hypothesis surfaces; writer, reader and Governance decider all exist under `src/features/agent-improvement-hypothesis/`. |
| SIA — application of an accepted hypothesis | **DEFERRED / UNAVAILABLE** | `decide-improvement-hypothesis.server.ts` reads only the hypothesis and decision records and writes only through the Governance decision authority. It never touches the `agents` table. No apply or rollback path exists anywhere. |
| Agent behavioral configuration as a durable runtime mutation surface | **UNAVAILABLE** | Independently measured: no agent behavioral-config, system-prompt, or equivalent mutation surface exists in `src`. This is the same conclusion ASA-0 reached; it is recorded here on its own repository evidence. |
| ASA-0 discovery | **DISCOVERY COMPLETE — read-only** | Confirmed to have left **no repository mutation**: the identifier `ASA` appears nowhere in the repository, in any file or any commit. Its findings live outside the repository and are therefore attributed, never cited as repository evidence. |
| Live Map | **NOT STARTED** | The term appears in four G7 product-vision documents and **nowhere in `src`**. It has no route, no module, and no organizational truth authority. |
| Era II | **NOT STARTED** — provisional direction only (§11) | — |
| Era III | **NOT ACTIVE** | — |

---

## 9. Locked Era I Sequence

This order is Director-approved and **locked**. It is not a suggestion and not a provisional ordering.

### L1 — I·FOUNDATION·TRUTH-1 — Retire the Fiction
Extend the existing mock-surface-gating truth boundary so that compiled-in fiction cannot be presented as authoritative organizational reality. The gate already exists and is correct; its **reach** is the work.

### L2 — HEBY CORE v1
Close the remaining bounded Heby Core contract, after truthful surface handling exists beneath it.

### L3 — ORGANIZATION AUTHORITY
Establish the legitimate durable owner and read/write contract for organizational truth. **Its schema is deliberately not pre-designed here.**

### L4 — LIVE MAP CORE v1
Build the first truthful Live Map over legitimate organizational authority.

**Why this order:** L1 makes fiction unpresentable; L2 closes the interface that would otherwise speak that fiction; L3 creates the authority that has something true to say; L4 visualizes it. Reversing any pair would produce a surface that renders a claim no authority owns.

---

## 10. Era I Closure Contract

```
ERA I — HEBUN TRUSTWORTHY FOUNDATION = CLOSED
    if and only if
L1, L2, L3 and L4 are each implemented, verified, and released.
```

Era I **must not** be called closed before those four contracts are actually implemented, verified and released. Design completion, documentation, or discovery does not close it. A closure claim is a measurement, not a decision.

---

## 11. Era II — Provisional Direction

**PROVISIONAL. NOT LOCKED.**

```
ASA-2 — Windowed Evidence Seam
  → Agent Registry
  → Live Map Intelligence
  → Heby Intelligence
```

Later intelligence work may then include, **according to dependency discovery**: Director Intelligence · Director Twin foundations · Memory · Learning · Advanced Self-Improving Agents · Organizational Intelligence evolution · Evaluation · multi-agent intelligence.

No precise implementation order is fabricated here for systems whose prerequisites have not yet been rediscovered.

*Recorded honestly:* `ASA-2` is a Director-named milestone with **no repository record at this baseline**. Its prerequisites must be rediscovered before it opens.

Pinned:

```
LOCKED ORDER != PROVISIONAL ORDER != FUTURE DIRECTION
```

---

## 12. Era III — Constraints and Future Direction

Era III is **not active**. It is constrained in advance:

- Autonomy is exercised only where an authority to act was explicitly established and recorded.
- Observation of the operational chain never becomes authority over it.
- No Era III capability may be opened while Era I remains open.

---

## 13. Major Capability Placement

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

Truthful current state: the pre-application loop **OBSERVE → EVALUATE → PREPARE → FILE → GOVERN** is implemented and product-reachable according to released evidence (§8). Advanced application remains **deferred**.

Agent behavioral configuration is not currently a legitimate durable runtime mutation surface. **Nothing in Hebun today implies that an agent can modify itself.**

```
SELF-IMPROVING          != SELF-MODIFYING
GOVERNANCE ACCEPTANCE   != APPLICATION AUTHORIZATION
APPLIED                 != IMPROVED
```

---

## 14. Authority Boundaries

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

## 15. Versioned Closure Model

A product version closes **only** against explicit, measurable exit criteria.

- Exit criteria are stated before the work begins, not reconstructed after it.
- "Verified" means a measurement was taken and its result recorded.
- "Released" means the implementation is committed and pushed to `main`.
- "Deployed" and "production-accepted" are separate, later, independently measured states.
- A closure record states which of those states was actually reached and which was not.

---

## 16. Naming Hierarchy

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

Where useful, future roadmap milestones may carry explicit ownership identifiers (as `L1`–`L4` do in §9).

---

## 17. Roadmap Change Control

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

## 18. Relationship to Architecture Documents

`docs/architecture/` contains **737 Markdown documents** at this baseline. They are historical design authority and **are preserved unmodified**. This roadmap rewrites none of them and mass-edits no status field.

**Critical distinction.** An architecture document marked `COMPLETE`, `CLOSED`, or `PUBLISHED` may represent completed **architectural design**. Those labels MUST NOT be automatically interpreted as:

```
IMPLEMENTED · PRODUCT-REACHABLE · DEPLOYED · PRODUCTION-VERIFIED
```

A design can be complete and closed while the capability it describes has never been built. `docs/architecture/` records what was *designed*. This roadmap interprets delivery status from **released repository reality** — and where the two disagree about delivery, the repository wins.

Release and closure records for implemented work live in `docs/product-vision/runtime/`. Cross-phase engineering lessons live in `learnings.md`.

### 18.1 Correction carried forward from HMR-0

HMR-0 claimed that Heby's Executive Overview currently presents mock organization as fact. **That claim was withdrawn after HMR-1 re-measurement** and is re-confirmed withdrawn here: the adapter gate returns `unavailable` when organizational demo data is not permitted (§8).

HMR-0's "Foundation ~70%" estimate is **not preserved**. It had no defensible denominator. It is quoted here once, in order to retire it, and no percentage is used as a status or progress claim anywhere in this document.

---

## 19. Next Milestone

**L1 — I·FOUNDATION·TRUTH-1 — Retire the Fiction.**

Extend the mock-surface-gating truth boundary beyond its current two call sites so that compiled-in organizational fiction cannot be presented as authoritative reality on any surface.

L1 has **not** begun. It requires its own discovery pass and explicit Director authorization before any implementation starts.
