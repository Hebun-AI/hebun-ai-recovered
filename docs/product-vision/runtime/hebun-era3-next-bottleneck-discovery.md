# Era III — Next Bottleneck Discovery

**Era III, fourth discovery.** Identifies the single strongest current bottleneck preventing Hebun
from becoming a more useful enterprise AI operating system, measured across the six durable product
lines rather than chosen from a desired feature.

**Baseline:** `main` at `fe10dd7`, equal to `origin/main`. Production migration ledger **40**.
**Status:** discovery only. No source, schema, migration, authority or activation change.
**Selected bottleneck:** **Organization Structure Authority does not exist.**
**Selected program:** **Organization Structure Authority (OSA)** — MEDIUM.
**Implementation at time of this discovery:** **NOT STARTED.**

Live Map is a product surface, not a truth owner. Security is cross-cutting, not a product line.

---

## 1 · Six product line health

| Line | Maturity | Governing measurement |
|---|---|---|
| **Heby** | **STRONG** | 12 of 17 source classes live-substituted in `heby-answer/model-answer.server.ts`. Unconnected: `memory`, `intelligence`, `workforce`, `platform`, `external-recipients`. |
| **Governance** | **STRONG** | full chain — proposal, decision, permit, revocation, execution binding, audit, ratification, mandate, membership, enrollment. Delegation product-reachable at `/governance/authority`. Not blocking anything measured. |
| **Knowledge** | **FUNCTIONAL** | three ingestion paths plus Drive admission, all production-accepted. Coverage **1 of 10** taxonomy categories. |
| **Agents** | **FUNCTIONAL** | one durable agent, mandate scope `["send"]`, **one** invoking product surface. Evaluation is coverage-only — five dimensions structurally unavailable. |
| **Integrations** | **FUNCTIONAL** | two connectable providers, both **write-empty by design**; one execution adapter, permit- and kill-switch-gated. |
| **Organization** | **BLOCKED** | see §2. |

**Route census.** Roughly 130 routes exist; **24** import any authoritative `.server` seam. The rest
are demo surfaces over compiled-in mocks.

---

## 2 · The strongest bottleneck — Organization

`OrganizationStructure` is not a query that returns empty. It is a type with **exactly one possible
value**:

```
status:  "unavailable"
reason:  "no-structural-authority"
detail:  "Hebun has no authority for internal organizational structure. The organizations and
          departments tables exist but have no writer and no reader, so departments, teams and
          reporting lines are unavailable — not absent."
```

| Fact | State |
|---|---|
| company identity | **AUTHORITATIVE** |
| memberships, invitations, enrollment | **AUTHORITATIVE** |
| roles | PARTIAL — written by the tenant role baseline, **not consulted for authority** |
| `departments`, `organizations` | **DEAD SCHEMA** — 0 rows, 0 writers, 0 importers outside `db/schema` |
| teams | **DOES NOT EXIST** — schema comment: *"No Team table (specified-but-not-implemented)"* |
| reporting relationships | **UNAVAILABLE** |
| human roster | **UNAVAILABLE** — `humanMemberCount` is *"a COUNT, never a roster"* by design |

**Enterprise questions Hebun cannot answer, none inferred from mocks or from absence of rows:**
*"Who leads Finance?"* — `departments.owner_actor_*` has no writer. *"Which team owns this?"* — no
team concept. *"Who should approve this?"* — Governance delegation carries **no scope**. *"Which
agents belong to which department?"* — `agents.department_id` is a live FK pointing at an empty
table.

**Five independent repository sites converge on the same hole:** the always-unavailable structure
type whose own comment pre-shapes the seam, the unwritable `agents.department_id` FK, the
"Organization" category in the Knowledge taxonomy, APF-0's rejection of domain agents for lack of
domain authority, and unscopeable Governance delegation.

It is the only measured case where Hebun cannot **represent** a fact, rather than cannot **reach**
one.

---

## 3 · Cross-line product flows

| | Director request | Verdict | Missing boundary |
|---|---|---|---|
| A | "What needs my decision?" | **WORKS END-TO-END** | — |
| B | "What changed in the company recently?" | **WORKS** (bounded) | honest bound: *RECORDED ACT != ALL ORGANIZATIONAL ACTIVITY* |
| C | "What do we know about this subject?" | **PARTIAL** | coverage 1/10 — adoption, not architecture |
| D | "What are our agents doing and how are they performing?" | **PARTIAL** | five evaluation dimensions structurally unavailable |
| E | "What changed in our GitHub repositories?" | **PARTIAL** | a **consumer** for `readRepositoryPullRequests` |
| F | "Who owns this area of the company?" | **UNAVAILABLE** | **structural Organization Authority — the fact does not exist** |
| G | "What should I pay attention to?" | **WORKS** | — |
| H | "Prepare an action based on what you found." | **PARTIAL** | one kind (`send`), one surface |

Prose fluency is counted nowhere. Each verdict is the state of the authoritative path.

---

## 4 · Strongest narrow rejected alternative — GitHub PR activity

`readRepositoryPullRequests` (GITHUB-4, released and production-verified against the real GitHub
API) has **ZERO consumers anywhere in the repository** — no page, no command, no Heby source, no
server action.

**The old conclusion is corrected rather than repeated.** It is not that GitHub has little Heby
consumption: repository *coverage* **is** consumed, by `/integrations/github`,
`heby-commands/provider-read-commands.server.ts` and `heby-commands/cross-source-commands.server.ts`
(INT-5B1 released it as an explicit sibling command kind rather than a widened `read`). It is
specifically **pull-request activity** that is stranded. `readDriveMetadata`, by contrast, **is**
consumed through `discoverDriveSources` → `/knowledge`.

**Rejected as the bottleneck, not as work.** Zero new authority, zero schema, zero provider scope
change, production-acceptable today — but it improves one flow and leaves every Organization-blocked
thing exactly as blocked. It belongs as a **narrow milestone**, not as the next program.

---

## 5 · `knowledge_authority = 'authoritative'` — re-measured, finding STANDS

- Written in exactly two places, both `"provisional"` (`durable-knowledge-writer.server.ts`).
- Read in three, including a filter `is distinct from 'authoritative'`.
- **No writer sets `authoritative`. Ratification does not promote it.**

The gap is real and **inert**: nothing in the product reads `authoritative` to decide anything, so
defining it today would change no behaviour. Not selected.

---

## 6 · Candidates and ranking

| | Candidate | New authority | Schema | Production-acceptable | Consume-before-create |
|---|---|---|---|---|---|
| C1 | **Organization Structure Authority absent** | **YES** | **YES** | thin but real | no — creates |
| C2 | GitHub activity stranded | no | no | **yes, today** | **yes** |
| C3 | `knowledge_authority` undefined | unresolved | maybe | unclear | partly |
| C4 | Human roster unavailable | no | no | thin | yes |
| C5 | Agent evaluation dimensions unavailable | **YES** | **YES** | no | **no — would invent records** |

C5 rejected outright: its dimensions are unavailable because the **facts** do not exist, and building
them means inventing a business-outcome record Hebun has no authority to hold. C3 rejected as inert.
C4 folds into C1. C2 wins the cheapness priorities; **C1 wins enterprise usefulness and
foundation**, and is the only candidate whose absence blocks four other lines.

---

## 7 · Selected program — Organization Structure Authority (OSA)

**Size: MEDIUM.** One authority, one writer, one read seam, inherited grounding, no provider surface.

**Reused:** `readOrganizationAuthority` and its pre-shaped `OrganizationStructure` field ·
`resolveGovernanceAuthority` · `writeGovernanceDecisionWithin` · the `governance-audit` `Within`
writers · `readMembershipAuthority` · `heby-organization-source.server.ts` (the `organization` class
is already live-substituted, so Heby grounding is **inherited**).

**Explicit non-goals:** no teams, no reporting hierarchy, no scoped Governance delegation, no domain
agents, no APF activation, no Governed Internal Action activation, no seeded-department promotion.

**Honest caveat recorded rather than smoothed over:** Tenant Zero holds one human member, so
production acceptance will be **real but small** — one department, one owner, one agent.

**The schema question is deliberately left open.** Whether to activate the existing `departments`
table or author a new one is an architecture gate (OSA-0) to be opened with evidence. Activating
dead schema has been a standing Era III prohibition and does not stop being one because the columns
look convenient.

---

## 8 · Continuity — unchanged by this discovery

```
APF (Agent Plurality Foundation):   VALID DIRECTION / DEFERRED (C)
Agent #2:                           NOT JUSTIFIED / NOT CREATED
Governed Internal Action:           VALID ARCHITECTURE / DEFERRED (C)
Knowledge retraction:               future class B narrow extension, NOT activated
GDR:                                REDESIGN / DEFERRED
ASA:                                BLOCKED / DEFERRED
```

None was reopened. No repository evidence contradicts any of them.

---

## 9 · Discovery verdict

```
Strongest bottleneck:                Organization Structure Authority does not exist
Primary affected product line:       Organization
Existing authority sufficient:       NO
New authority required:              YES — one structural authority, and only one
Schema required:                     YES — resolved at OSA-0
Provider scope expansion required:   NO
Agent #2 required:                   NO
Recommended next program:            Organization Structure Authority (OSA)
Program size:                        MEDIUM
Implementation started:              NO
```
