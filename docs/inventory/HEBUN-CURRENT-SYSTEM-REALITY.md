# HEBUN — CURRENT SYSTEM REALITY
## Repository-Derived Capability & Program Inventory

> ### SNAPSHOT NOTICE
>
> **This is a repository-derived snapshot, not an authority.** The authoritative sources remain the
> repository documents and runtime evidence referenced throughout; where this page and one of them
> disagree, that source is right and this page is stale.
>
> **Inventory baseline: `5c30a9380c96ba45feba6b23865b0addb39a6a8c`.**
>
> Nothing regenerates this document. After any major release, new program, phase closure or authority
> change beyond that baseline, it must be **re-derived** — not read as current truth, and not patched
> by hand.

---

## What this document is, and what it is not

This is a **derived catalog**. It was assembled by reading the repository and measuring production
read-only. It answers one question: **what does Hebun actually have today?**

**It is not an authority.** It is not a roadmap, an architecture authority, a program authority, a
constitution, or a second source of truth. Every claim below points at a document or a path that
already owns it. Where this catalog and an authority disagree, **the authority wins and this page is
wrong** — that is the same rule `MASTER-ROADMAP.md` applies to itself.

**Derivation baseline:** `5c30a9380c96ba45feba6b23865b0addb39a6a8c` on `main`, equal to
`origin/main`, 0 ahead / 0 behind. Generated **2026-09-11**.

A companion document, `HEBUN-FUTURE-PROGRAMS-AND-SYSTEM-EVOLUTION.md`, covers what is designed,
planned or deferred. Nothing in *that* document is available today.

---

## 1. The one distinction that explains everything

Hebun's documentation is unusually large — **950 markdown files** — and most of it describes
architecture that has no running code. This is not a gap or a failure. It is the deliberate shape of
the system, and reading the repository any other way produces a wildly inflated picture of what
exists.

There are **two independent axes**, and a program can be finished on one while untouched on the
other:

| Axis | Owned by | "Complete" means |
|---|---|---|
| **Architecture / constitutional** | `docs/architecture/` — Constitution + Programs I–IX, Phases 1–51 | The *document* is published and governs future work |
| **Delivery / runtime** | `docs/MASTER-ROADMAP.md` + `docs/product-vision/runtime/` | Code exists, is released, and often production-accepted |

The clearest example: **Program V — Enterprise Security** is marked `COMPLETE / PUBLISHED` in the
architecture roadmap, with all seven phases (30–36) published. The same repository's delivery
authority marks it **`DESIGN ONLY`**. Both are true. The architecture is finished; the runtime does
not exist.

Throughout this document, a program is described by its **runtime** state. Where its architecture is
published but unbuilt, that is stated explicitly.

### Vocabulary held apart

These are not synonyms, and collapsing them is the most common way a system inventory becomes
fiction:

```
contract        != connection
credential      != verified connection
connected       != capability available
available       != authorized
authorized      != executed
executed        != successful
derived         != authoritative
published       != implemented
implemented     != production-accepted
```

---

## 2. Hebun in one paragraph

Hebun is an enterprise system in which an organization's work is carried out by durable, governed
agents whose every consequential act is attributable, recorded and reversible in evidence. Its
load-bearing commitment is not automation but **truthfulness under authority**: no surface may
present a claim it cannot ground, no actor may perform an act it was not authorized to perform, and
no absence may be rendered as a zero.

*Source: `docs/MASTER-ROADMAP.md` §2.*

---

## 3. Where the system stands

### The three eras

| Era | State | What it means |
|---|---|---|
| **I — Trustworthy Foundation** | **CLOSED** | Hebun can describe an organization truthfully. Every surface grounds its claim or says it cannot. |
| **II — Hebun Intelligence** | **CLOSED** | Evidence accumulates; intelligence layers over an organization already truthfully represented. |
| **III — Autonomous Enterprise** | **OPEN** | One program closed inside it (Agent Mandate Authority). **No program is active and none is selected.** |

A closed program is not a closed era. Nothing about Era III's outcome has been measured.

### Measured size of the running system

| Measure | Count |
|---|---|
| Feature modules (`src/features/`) | 214 |
| Product page routes | 144 |
| API routes | 7 |
| Test files | 759 |
| Database tables | 66 |
| Applied migrations | 52 |
| Connectable providers | 4 |

**These are size, not capability.** A feature module may be a read-only projection over rows another
module owns. The sections below say which are authorities and which are views.

---

## 4. The product model — seven workspaces and one ambient layer

The product surface is exactly **seven top-level workspaces**, and it does not grow. This is
enforced by test, not convention. **Heby is not a workspace** — it is an ambient layer reachable from
every surface.

*Source: `apps/dashboard/src/config/workspace-nav.ts`.*

---

### COMMAND — *the executive operating surface*

The Director's landing surface: situational overview, and the human decision.

**Released and reachable:** Overview · Decisions (`/approvals`) · Director Intent · **Live Map**.

**Live Map (L4)** is the organization as Hebun can vouch for it — a read-only projection over the
Organization Authority and durable agent identity. Domains it cannot source, it names as unsourced
rather than leaving blank.

**Notable non-connection:** Heby does **not** consume the Live Map projection, and is not scheduled
to. Live Map is a visualization; it owns no fact.

---

### INTELLIGENCE — *making sense of what the organization is learning*

Seven Level-2 surfaces: Overview · Signals & Assessments · Candidates · Insights · Readiness &
Pathways · Recommendations · **Social Intelligence**.

**Social Intelligence is the most recently released capability in the system** and the only one
reading live external providers. It is covered in §6.

The other six surfaces render the intelligence lifecycle. Their evidential depth varies by surface
and is owned by each surface's own closure record.

---

### KNOWLEDGE — *the settled truth*

**Released:** Company Memory (read-only inspection of governed durable memory) · Knowledge Graph ·
Registries · a knowledge ratification gate · knowledge source retraction · external references ·
**provider content ingestion**.

**Knowledge Ingestion Depth (KID)** is released end to end: `KID-1` reads provider content,
`KID-2` admits it. The Google least-privilege adaptation — Picker plus `drive.file` — is
**production-accepted** against a real document.

**Important boundary:** ratifying knowledge does **not** promote it into a knowledge authority.
Coverage and ratification are separate tallies that overlap rather than partition.

---

### OPERATIONS — *running and watching live work*

**Released:** Overview · Execution (read-only: what has run, what capability is available) · Runtime
& Signals · Execution Substrate (the execution stack and what is missing).

**The honest characterization:** Operations is largely an **observation** surface. Nine execution-
related modules exist (`action-authorization`, `action-execution`, `execution-engine`,
`execution-queue`, `execution-readiness`, and others), and a **governed external send has been
executed once** in production under permit. That proves the chain works; it does not make Hebun an
execution platform. Accepted is not the same claim as delivered — there is no delivery seam.

---

### WORKFORCE — *who can perform work*

**Released:** Overview · Agents · Teams & Roles · Capabilities.

Durable agent identity exists and is authoritative. The **Self-Improving Agents (SIA)** pre-
application loop — observe → evaluate → prepare → file → govern — is closed and product-reachable.

**Unavailable, and explicitly so:**
- **Applying an accepted improvement hypothesis.** No apply or rollback path exists anywhere. The
  decider writes only through Governance and never touches the `agents` table.
- **Windowed or comparable agent evidence.** Agent evidence is an unbounded total; it cannot express
  a before-and-after. This is the measured blocker on `ASA-2`.
- **Agent behavioral configuration** as a durable runtime mutation surface.

---

### GOVERNANCE — *guardrails, permissions, and the record*

**Released:** Overview · Policies & Rules · Compliance & Risk · Audit & Explainability · Security
Center. Decision authority, the decision record, recorded acts, and a tenant-scoped audit
observation seam are all live. The **Agent Mandate Authority** (Era III's first and only closed
program) records a ceiling on what an agent may propose and **enforces it on agent-originated
proposals** — production-accepted end to end.

**Unavailable — and this is the largest single gap in the running system:**

| Missing authority | Consequence |
|---|---|
| **Permission authority** | No runtime permission evaluation exists |
| **Security policy authority** | No enforceable security policy exists |
| **Security Event / Finding / Incident authority** | Security Center is one connected derived observation — **not security operations** |

Program V's architecture (Phases 30–36) is published and governs this space. None of it is built.

---

### PLATFORM — *providers, integrations, administration*

**Released:** Overview · Providers & Models · Provider Runtime · Integrations · Infrastructure &
Settings. Tenant provisioning, suspension, membership and role authority, identity and credential
enrollment, and a production migration authority all exist as ceremonies.

**Four connectable providers**, and no others: **Google Workspace · GitHub · Instagram · YouTube**.
LinkedIn, TikTok, Facebook and X have no provider module, catalog entry, capability, transport or
credential kind — they appear on no surface in any state.

---

### HEBY — *ambient, not a workspace*

Heby is the conversational intelligence interface. **It owns no organizational fact.** Everything it
says is grounded in a source class belonging to some other authority, and it says so.

Released grounding classes include organization identity, agents and their proposal outcomes, the
recorded-act history, windowed period counts over that ledger, knowledge coverage, governance
decisions, the decision queue, recorded work, department composition, people, the agent mandate, and
observed provider content.

**Heby's discipline:** availability is not the dispatch decision; a Director kill switch can refuse a
model request the surface believes is permitted, and Heby must say so. It does not consume the Live
Map.

---

## 5. Cross-cutting: Enterprise Security & Trust

This is a **constraint program**, not a workspace. It owns no surface of its own and reuses existing
authorities rather than creating rival ones.

Today it amounts to: a mock-surface gating authority that fails closed; an ingested-content trust
boundary (TB-1); a tenant-scoped audit observation seam; and a Security Center rendering **one
connected derived observation**.

**It is not security operations**, and the repository says so plainly. The three authorities that
would make it so — permission, policy, and security event/finding/incident — do not exist.

---

## 6. Social Intelligence — the current frontier

The newest released capability, and the only one observing live external platforms. It is the
clearest worked example of how Hebun builds: evidence first, arithmetic second, interpretation
never.

| Phase | Scope | State |
|---|---|---|
| `SOC-0` | Architecture + navigation decision | **APPROVED** `6c4e1ef` |
| `IG-AN1` | Instagram account measurement series | **RELEASED** `f735450` |
| `YT-SOC1` | YouTube channel measurement series | **RELEASED** `ad81811` |
| `YT-SOC2` | YouTube channel measurement **comparison** | **RELEASED** `a373639` |
| `SOC-UI1` | Dashboard: cards, evolution panels, content, coverage | **RELEASED + PRODUCTION-ACCEPTED** `ddf7803` |
| `IG-AN2` | Instagram account measurement **comparison** | **RELEASED + PRODUCTION-ACCEPTED** `fcd5f64` |

**What it can do:** observe an authorized provider scope **unattended**, on a Governance-bounded
cadence, with an operator stop, truthful machine provenance and no human session; store each
observation immutably; derive measurement series and compare the last two measurements.

**What it deliberately cannot do:** infer, recommend, rank, score, forecast, or compute any rate or
percentage. Instagram followers and YouTube subscribers are never unified into one metric. There is
no analytics table — every figure is recomputed on read and stored nowhere.

**The unattended observation chain** (TRH-21 → TRH-25) is the frontier capability of the whole
system: a Vercel cron calls an authorized endpoint hourly; a scan consults each standing
authorization's cadence; due scopes are observed and recorded with machine provenance and a null
human actor. **It is an observation capability and confers no authority to act on what it observes.**

---

## 7. The TRH delivery line

**Twenty-five phases run against a real customer** (Turkish Rug House), and never chartered as a
program. It is recorded after the fact in `MASTER-ROADMAP` §13.2.

TRH is where most of Hebun's *production* acceptance actually happened: the first durable agent
identity, the first operational work, the first knowledge ratification, the first artifact review,
the first machine-sourced observation, and the standing observation authorization. `TRH-25` is
production-accepted.

**It closed no era and opened no successor.** The next program remains a separate Director decision.

---

## 8. What is measurably unavailable today

Stated plainly, because a catalog that lists only what exists is a sales document.

| Capability | State | Why it matters |
|---|---|---|
| Internal organizational structure — departments, teams, reporting lines | **UNAVAILABLE** | The `organizations` and `departments` tables have existed since the foundation baseline with **zero writers and zero readers**. A table is not an authority. |
| Permission authority | **UNAVAILABLE** | No runtime permission evaluation |
| Security policy authority | **UNAVAILABLE** | No enforceable policy |
| Security event / finding / incident authority | **UNAVAILABLE** | Security Center is observation, not operations |
| Applying an accepted agent improvement | **DEFERRED / UNAVAILABLE** | The loop prepares and governs; it cannot act |
| Windowed / comparable agent evidence | **UNAVAILABLE** | Blocks `ASA-2` |
| Enterprise Security runtime (Program V) | **DESIGN ONLY** | Architecture published; nothing built |
| Heby ← Live Map connection | **NOT CONNECTED** | Deliberate, not an oversight |
| Observation → proposal / Knowledge / Work | **NOT CONNECTED** | Data-blocked, not capability-blocked |

---

## 9. Provenance

**Baseline:** `5c30a9380c96ba45feba6b23865b0addb39a6a8c` · **Generated:** 2026-09-11 · **Production
evidence:** read-only, same date.

### Authoritative sources consulted

| Domain | Authoritative source |
|---|---|
| Constitution | `docs/architecture/00-enterprise-constitution.md` |
| Architecture direction, Programs I–IX, Phases 1–51 | `docs/architecture/architecture-intelligence/50-enterprise-architecture-roadmap.md` |
| Delivery, eras, current position | `docs/MASTER-ROADMAP.md` |
| Per-phase release & production acceptance | `docs/product-vision/runtime/` — 141 closure records |
| Social Intelligence | `docs/product-vision/ui/hebun-social-intelligence-specification.md` |
| Product navigation model | `apps/dashboard/src/config/workspace-nav.ts` |
| Provider catalog | `apps/dashboard/src/features/provider-catalog/catalog.ts` |
| Future capabilities | `docs/architecture-backlog/`, `docs/product-vision/*.md` |

### One apparent contradiction, resolved

The Constitution names `50-enterprise-architecture-roadmap.md` as "the canonical implementation
roadmap", while `docs/MASTER-ROADMAP.md` calls itself "the canonical delivery and product-navigation
authority". **This is not a conflict** — the two have different scopes and `MASTER-ROADMAP` §1
already arbitrates: on a *technical* rule the architecture contract wins; on *what to build next*,
the delivery roadmap wins. Both were used accordingly.

### Where evidence was insufficient

- **Per-surface evidential depth inside Intelligence** (Signals, Candidates, Insights, Readiness,
  Recommendations) was not individually re-measured. Each surface's own closure record owns that
  claim; this catalog does not restate it.
- **Operations execution modules** were enumerated by name, not audited individually for what each
  can actually execute. The characterization above rests on `MASTER-ROADMAP` §9 and the external-send
  closure record.
- **Architecture Programs I–IX** were read at the roadmap level. The ~900 underlying architecture
  documents were not individually verified against their published status.

### What this document contains no trace of

No secrets, credentials, tokens, connection strings, database hostnames, deployment identifiers, or
tenant-specific personal data. Commit SHAs and public release identifiers only.
