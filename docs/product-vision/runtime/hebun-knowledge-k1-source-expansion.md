# Hebun — Knowledge: K1 Read · K2 Create · K2.1 Acceptance · G1 Audit · K3 Versioning

**Phase:** K1 — Knowledge Source Expansion (real, read-only Knowledge grounding for Heby)
**Date:** 2026-08-11
**Status:** IMPLEMENTED · CONNECTED (listing + named-source read only) · local, unpublished
**Verdict:** K1 CLOSED WITH DOCUMENTED LIMITATION (browser acceptance unproven; no knowledge corpus exists)
**K2 (2026-08-11):** human-authored canonical Knowledge creation — IMPLEMENTED · CONNECTED · AVAILABLE. See §15.
**K2.1 (2026-08-11):** browser acceptance **PROVEN** + governance hardening — **K2.1 CLOSED**. See §16.
**G1 (2026-08-11):** Knowledge mutation history on the existing `audit_log` sink — **G1 CLOSED WITH DOCUMENTED LIMITATION**, 0 migrations. See §17.
**K3 (2026-08-11):** versioning & supersession, concurrency-safe, browser-proven — **K3 CLOSED**, 0 migrations. See §18.
**K4 (2026-08-11):** ratification — **BLOCKED AT DIRECTOR GATE**: Governance owns ratification and has no runtime. Nothing implemented. See §19.
**G2 (2026-08-11):** governance decision authority — **BLOCKED AT DIRECTOR GATE**: no connected authority can say who may decide, and the genesis invariant is underivable. Nothing implemented. See §20.
**Baseline:** `main` at `bc6797e` = `origin/main`, ahead/behind `0/0`, nothing staged.

> **R2F is untouched.** R2F remains *Provider Operations Depth* (persisted last-validation,
> Validate Connection, usage aggregation, budget enforcement, provider-control permission
> refinement) and remains **DEFERRED**, recorded in `hebun-runtime-r2-connectivity-audit.md` §
> "R2F — Provider Operations Depth". K1 is a separate phase and renames nothing.

---

## 1. What was asked, and what the repository actually allowed

K1 asked for Heby's first REAL Knowledge grounding path by extending the Knowledge authority
Hebun already owns — explicitly *not* by building a second Knowledge system, and explicitly not
by fabricating RAG if reality did not support it.

The discovery answer is narrower than "Knowledge works" and wider than "nothing exists":

> **The canonical Knowledge authority exists and is now readable. Ingestion does not exist,
> no knowledge is persisted, and no search or semantic retrieval runtime exists.**

K1 connected exactly the part that was real, and left the rest honestly unavailable.

---

## 2. Knowledge authority — discovered, classified

| Subsystem | Files | Classification |
|---|---|---|
| Canonical Knowledge model | `src/db/schema/knowledge.ts` (`knowledge_nodes`, `knowledge_edges`), `src/db/schema/knowledge-fact.ts` (`knowledge_facts`) | **AUTHORITATIVE** data model. Migrated (`20260711203301_knowledge_reconciliation_foundation.sql`). **0 rows.** Before K1: zero application read or write code. |
| `documents` table | `src/db/schema/document.ts` | **DESIGNED** only. Zero consumers anywhere: no upload, parser, storage binding, or reader. A schema, not a corpus. |
| `canonical-read` | `src/features/canonical-read/knowledge-facts.ts` | **IMPLEMENTED, NOT CONFIGURED.** Real SQL, but on its own isolated connection string (`HEBUN_CANONICAL_READ_DATABASE_URL`, unset) and it reads **by explicit identity only** (tenant + factKey + domainKey + scope). It cannot enumerate. Used only by diagnostics + tests. |
| `knowledge-crud`, `knowledge-graph`, `knowledge-domain` | `src/features/knowledge-crud/node-adapter.ts` et al. | **SEEDED / SIMULATED.** In-memory, seeded from a mock registry; derives a `confidence` figure from mock health. Never organizational truth. |
| `knowledge-read-facade`, `knowledge-canonical-repository` | `src/features/knowledge-read-facade/*` | **MIGRATION SCAFFOLDING.** Consumed only by `canonical-read/diagnostics.ts` and tests — no product surface. See §11 for the conflict this carries. |
| `knowledge-graph-surface` | `src/features/knowledge-graph-surface/*` | **IMPLEMENTED, FAILS CLOSED.** `resolveKnowledgeGraphTenant()` returns `null`; contract enumerates nothing by design. |
| `knowledge-runtime` | `src/features/knowledge-runtime/*` | **DERIVED** projection (overview/timeline). Not knowledge content. |
| Architecture Intelligence / Architecture Ingestion / Knowledge Processing Pipeline | `docs/architecture/architecture-intelligence/**`, `architecture-ingestion/**`, `knowledge-processing-pipeline/**` (≈130 documents) | **DESIGNED — DOCUMENTATION ONLY.** Zero code bindings anywhere in `src/` or `tests/`. It owns *architecture-specific* intelligence design, not organization-wide knowledge retrieval, and K1 did **not** promote it into a Knowledge authority. |
| Enterprise Memory | `src/features/enterprise-memory-*` | A **separate authority** (Memory ≠ Knowledge). Real query engine, real persistence, **0 rows**. Untouched by K1. |

**Verdict:** one canonical Knowledge authority (`knowledge_facts` → `knowledge_nodes`). No competing
product authority. K1 added no second one.

---

## 3. The read seam chosen, and why

K1 reads `knowledge_facts` joined to its active `knowledge_nodes` row over the **R1 control-plane
database** (`DATABASE_URL`) with Drizzle — the same schema, driver, and authored migrations R1 and
R2D already use.

Rejected: `canonical-read`. It is an optional diagnostics/shadow layer on an isolated, unset
connection string, and it can only resolve one fact by full identity — it cannot list, so it cannot
answer "what knowledge does this organization have".

Rejected: the seeded `knowledge-crud` store. Presenting mock registry nodes with a mock-derived
`confidence` as organizational knowledge is the exact fabrication K1 exists to prevent. A test bans
K1 modules from importing it.

---

## 4. Files

**Added**

- `src/features/knowledge/contracts.ts` — narrowest provider-neutral Knowledge read contract. No
  confidence, relevance, score, or trust field exists on it (structurally, not by discipline).
  Freshness is derived only from the record's own timestamps.
- `src/features/knowledge/capability-map.ts` — the six Knowledge capabilities stated separately,
  each naming its authority and what it cannot prove. Mirrors `security-center/source-map.ts`.
- `src/features/knowledge/durable-knowledge-repository.server.ts` — tenant-scoped, read-only
  repository. No insert/update/delete, no table, no cache, no index.
- `src/features/knowledge/knowledge-read.server.ts` — the ONE read orchestration; fail-closed on
  tenant, then on persistence.
- `src/features/heby-answer/knowledge-evidence.server.ts` — maps a Knowledge listing into the
  EXISTING `SourceResolution` evidence shape.
- `tests/k1-flow/{knowledge-authority,knowledge-boundaries,commands-and-grounding,tenant-isolation-postgres}.ts`
- *(closure mission)* `tests/k1-flow/authority-reconciliation.ts` — see §14.

**Modified**

- `src/features/heby-commands/registry.ts` — `/knowledge` and `/source` → `available`; `/search`
  reason sharpened to name the missing search authority.
- `src/features/heby-commands/read-commands.server.ts` — `knowledge` and `source` read handlers.
- `src/features/heby-answer/model-answer.server.ts` — substitutes the real tenant-scoped Knowledge
  resolution for the pure placeholder, only for workspaces that already declare the source class.
- `src/features/heby-runtime/source-resolver.ts` — knowledge unavailable reason made accurate.
- `tests/s1-flow/dispatch-and-availability.ts` — updated to the new truth (not weakened).
- *(closure mission, comments only — no behaviour change)*
  `src/features/canonical-repository/types.ts` and
  `src/features/knowledge-canonical-repository/index.ts` — see §14.

**Not added:** zero dependencies, zero migrations, zero schema changes, zero env variables.

---

## 5. Truthful availability (never collapsed)

| Capability | State |
|---|---|
| Knowledge source listing | **available** (connected; returns the tenant's real state — empty today) |
| Named source read | **available** (connected; by canonical fact key, within the tenant) |
| Search | **unavailable** — no index, no ranking model, no relevance authority |
| Semantic retrieval | **unavailable** — no vector store, no similarity index, no retrieval service |
| Ingestion | **unconnected** — no upload, parser, normalizer, chunker, storage binding, or writer |
| Embeddings | **unavailable** — no provider configured, none stored |

The phrase "Knowledge connected" is never emitted, and a test asserts it.

---

## 6. Commands

- `/knowledge` — **available.** Lists the tenant's real knowledge records with authority class,
  lifecycle, ratification, scope, version and derived freshness, then states each capability
  separately. Facts whose active node is missing are listed apart, never merged in.
- `/source <fact key>` — **available.** Reads one fact by canonical key inside the tenant. A key
  matching several domains/scopes returns **all** candidates as an honest ambiguity. A key belonging
  to another tenant is indistinguishable from one that does not exist.
- `/search <query>` — **requires-source.** Unchanged in availability; its reason now names the exact
  gap. Activating it would need a real search authority, not a substring scan.

Both activated commands are `read` kind: `requiresModel: false`, `requiresExecution: false`,
`safeWhenProviderOff: true`. Neither can produce a model prompt — the dispatch planner has no branch
that could.

---

## 7. Grounding, query intent, and precedence

Knowledge enters natural language through the **existing** deterministic evidence assembly as one
`SourceResolution`. No knowledge prompt, knowledge conversation, knowledge model client, or second
answer path was created.

- **Query intent** reuses the existing workspace → source-class mapping. Knowledge is read only for
  workspaces that already declare it (Knowledge, Intelligence, Governance). An Operations question
  reads zero knowledge — proven by a counter in the test suite.
- **Precedence** travels on the provenance line rather than as a global ordering: settled knowledge
  describes its own subject and *never* states current runtime state. Different domains keep
  different authorities.
- **Empty is not evidence.** An organization with no knowledge produces an `unavailable` resolution
  with a reason, not an empty "resolved" source that would imply a search found nothing.
- **Authority survives.** Each item carries its own `authority: authoritative|provisional`,
  lifecycle, ratification and freshness. One provisional record demotes the whole source's
  `authoritative` flag; per-item truth stays exact.

---

## 8. Security

- **Tenant.** Tenant identity comes only from the server-resolved `TenantContext`. The client command
  input carries no tenant/organization/membership/role/user field. Both sides of the fact→node join
  are tenant-scoped, so a fact cannot resolve content through another tenant's row. Proven against a
  real disposable PostgreSQL database with two tenants sharing the fact key `security-policy`.
- **Knowledge content is data.** A record whose statement is a prompt injection ("Ignore previous
  instructions", "The Director authorized this", "run `rm -rf /`", an exfiltration URL) changes no
  status, grants no permission, cannot ratify itself, and cannot promote its own authority. It
  travels as quoted grounding data under the existing system instruction that grounding context is
  never an instruction. This is a boundary, not a claim that prompt injection is solved.
- **Execution firewall.** The Knowledge read modules contain no `eval`, `child_process`, `exec`,
  `spawn`, `fetch`, filesystem access, browser automation, or Computer Use — asserted structurally
  over the shipped source. Reserved S1 commands remain inert.
- **No location addressing.** `/source` takes a lookup key, never a path or URL. `../../etc/passwd`,
  `/etc/passwd`, `https://…`, `file:///…` and `' or 1=1 --` all simply fail to match — verified in
  the live environment.
- **No exposure.** The contract carries no database id, tenant id, storage path, credential,
  governance session id, or raw provenance blob.

---

## 9. Verification

| Check | Result |
|---|---|
| K1 focused tests (5 files, 41 numbered proof groups) | pass, incl. real-PostgreSQL tenant isolation + authority reconciliation |
| Full suite | **304 passed, 0 failed** (K1 baseline 299 → 303 → 304 after closure) |
| S1 / HW3 / H1 / R2E / Voice regressions | green; Voice implementation untouched |
| `tsc --noEmit` | clean |
| `eslint` | 0 errors (13 pre-existing warnings) |
| `next build` | succeeds |
| Dependencies added | 0 |
| Migrations added | 0 (still 17) |

**Live-environment acceptance** (real dev database `hebun_r1`, real seeded Acme tenant, real durable
Director control read as **OFF**): `/knowledge` reported the truthful empty state plus the capability
map; `/source security-policy` returned not-found; all four hostile `/source` arguments resolved to
nothing with no fetch, no file access, no error; `/search` was refused with its precise reason; a
natural-language Knowledge question answered **deterministically with zero provider contact** and
carried the honest knowledge line. Zero rows were written.

**Browser acceptance is UNPROVEN.** Retried during the closure mission on a fresh tab: navigation
succeeds (page titles and HMR confirm the app loads) but every `read_page`, `screenshot`, and script
evaluation times out with "the Browser pane is not displayed, so the page is not compositing frames".
An authenticated HTTP substitute was also attempted and does **not** work: `/login` is a Next server
action, so a plain form POST establishes no session and `/heby` correctly redirects back to `/login`.

The live-environment runs below exercise the same server seams with real persistence and a real
tenant, but they bypass the auth cookie and render no UI. **They are not browser acceptance.** A Heby
Full Workspace and Quick Panel UI pass remains outstanding.

**Closure-mission live run** (same real dev database, Director control read as **OFF**, two real
seeded tenants):

- `/knowledge` for Acme **and** Globex — both truthfully empty, neither leaking the other.
- `/source security-policy` — not-found.
- `/source` with `../../etc/passwd`, `file:///etc/passwd`, `https://example.com`, `' OR 1=1 --` —
  all four resolved to nothing. No file access, no fetch, no error.
- `/terminal`, `/computer-use`, `/deploy`, `/execute`, `/delete` — every one planned `unavailable`
  with `carriesModelPrompt=false`, and every one was additionally **rejected at the server read
  boundary** (`not-a-read-command`). `/search secret` rejected `not-available`.
- Natural language on `/knowledge` — answered **deterministically**, `modelUsed=false`, transport
  `none`, zero provider contact, with the honest knowledge line.
- Zero rows written to the dev database.

---

## 10. What is authoritative, derived, connected, unavailable

- **Authoritative:** `knowledge_facts` + `knowledge_nodes` as the canonical Knowledge model, and each
  record's own `knowledge_authority` classification.
- **Derived:** nothing new. K1 introduced no derived Knowledge projection.
- **Connected:** Knowledge source listing and named-source read, tenant-scoped, read-only.
- **Unavailable:** search, semantic retrieval, ingestion, embeddings — and therefore, in practice,
  any actual knowledge content, because nothing can create it.

---

## 11. Limitations, and one pre-existing conflict to record

1. **No knowledge exists.** Every K1 read is real and every result today is empty, because there is
   no ingestion path. K1 built the read side of a two-sided system.
2. **The `authoritative` flag conflict — RESOLVED as a naming defect, not an inversion.** The K1
   closure mission traced it (see §14). `knowledge-canonical-repository` marks the seeded in-memory
   store `authoritative: true` and the canonical Postgres read `authoritative: false`. Read as a
   claim about organizational truth that is alarming; it is not one. In
   `CanonicalRepositoryDescriptor` the flag is the **dual-read router role** — which participant's
   result is returned versus which is compared and discarded — and the values are *correct* for that
   meaning (`routeKnowledgeRead` hardcodes `authoritativeProvider: "memory"` to match). The earlier
   description of it as "an inversion" was imprecise. Nothing in `src/` branches on the flag.
3. **`canonical-read` and the K1 repository now both read the same tables** from different connection
   strings for different purposes (diagnostics/shadow vs. product read). This is not a second
   authority — same tables, same model — but it is a duplication worth resolving.
4. Listing is bounded at 50 facts and reports truncation; there is no paging UI.
5. Browser/UI acceptance outstanding (§9).

---

## 14. Closure mission — authority reconciliation (2026-08-11)

**Root cause.** The word `authoritative` is overloaded. In `CanonicalRepositoryDescriptor` it means
*primary participant of this read router* (dual-read migration vocabulary). It does **not** mean
*source of organizational truth*. Evidence:

- `knowledge-read-facade/router.ts` hardcodes `authoritativeProvider: "memory"` — the memory store is
  the participant whose result is returned; Postgres is the shadow, compared and discarded.
- `canonical-repository/factory.ts` only copies the flag. **No module in `src/` ever reads
  `descriptor.authoritative`** — it is set-only metadata, surfaced through
  `CanonicalRepositoryDiagnosticsView`.
- The only consumers of the whole pair are `canonical-read/diagnostics.ts` and the
  `/_internal/canonical-read` page, gated behind **both** `NODE_ENV !== "production"` **and**
  `HEBUN_ENABLE_CANONICAL_READ_DIAGNOSTICS=true` (unset in `.env.local`). It is not reachable from
  any product surface and is not in Heby's answer path.

**Reconciliation performed — no authority moved.** The booleans were **not** flipped: flipping them
would misstate the routing role, which is what they actually describe. Renaming the field would be a
broad refactor of a shared abstraction for naming alone. Instead:

- `canonical-repository/types.ts` — the field now documents its routing meaning at its own
  definition and explicitly disclaims the organizational-truth reading, including "a seeded fixture
  can legitimately carry `true` here while owning no truth at all".
- `knowledge-canonical-repository/index.ts` — a header stating it is dual-read migration
  scaffolding, that the seeded store owns no organizational Knowledge, and that the real authority is
  `knowledge_facts` → `knowledge_nodes`; plus one comment at each descriptor site.
- `tests/k1-flow/authority-reconciliation.ts` — pins the invariant that actually matters (6 proof
  groups): the flag's documented meaning; the values unchanged; **no source module reads
  `descriptor.authoritative`**; the seeded store and the scaffolding cannot be imported by any
  product Knowledge path; the scaffolding has no consumer outside diagnostics and its own modules;
  the diagnostics page stays double-gated; and Enterprise Memory is never borrowed as Knowledge.

No persistence ownership, schema ownership, production read path, abstraction, or governance
semantics changed. No Director gate was required or crossed.

---

## 12. Recommended next phase

**K2 — Knowledge Ingestion (narrow).** The read side is proven and empty; the missing half is a real,
governed, tenant-scoped write path that puts knowledge into `knowledge_nodes` / `knowledge_facts`
under explicit authority. The narrowest useful K2 is **Director-authored knowledge** — one governed
create/ratify path, no document parsing, no chunking, no embeddings — which would make `/knowledge`
and `/source` return real content and would give a later search phase something to search.

Search, semantic retrieval, and any vector infrastructure remain out of scope and would each be a
separate Director decision.

---

## 13. Roadmap continuity

- **K1 — Knowledge Source Expansion:** IMPLEMENTED · CONNECTED (listing + named-source read).
- **R2F — Provider Operations Depth:** **DEFERRED**, definition unchanged.
- Nothing committed, tagged, or pushed. `main` at `bc6797e` = `origin/main`, `0/0`. Awaiting Director
  review.

---

## 15. K2 — Director-Authored Knowledge Ingestion (2026-08-11)

**Verdict: K2 CLOSED WITH DOCUMENTED LIMITATION** (browser acceptance unproven).

K1 built the read side and found it empty because nothing could write. K2 adds the narrowest
legitimate write into the SAME canonical authority — and gives that authority to humans only.

### 15.1 Authority audit

| Authority | Reality |
|---|---|
| Authentication | R1 session cookie + digest → durable `user_session_contexts`. **CONNECTED.** |
| Tenant | `TenantContext.tenantId`, server-resolved. **CONNECTED.** |
| Membership | `memberships` table; `membershipId`/`membershipVersion` on TenantContext. **CONNECTED.** |
| Role | `roles.type` (`roleTypeEnum` authority band), tenant-scoped lookup. **CONNECTED** — already gates R2E. |
| Fine-grained permissions | `permissions` + `role_permissions`: real allow-only grant model, **SCHEMA ONLY** — zero code consumers, zero rows. |
| Knowledge write | **Did not exist.** No permission key, no grant, no governance check. |

**Gate A — evaluated, NOT triggered.** Gating on `role_permissions` would mean building a
permission-resolution runtime and seeding a permission catalogue: inventing a new authorization
model, which K2 forbids. The role band is the repository's only CONNECTED authorization primitive
and already gates Hebun's highest-authority mutation. K2 reuses it through its own module
(`knowledge-write-authority.server.ts`) so tightening Knowledge never silently moves provider
control. No new role, no changed role semantics, no second auth system.

**Gate B — evaluated, NOT triggered.** "Who established this Knowledge?" is durably answerable with
**zero migration**: `knowledge_nodes.created_by` + `created_by_type`, and
`knowledge_facts.selected_by_actor_id` + `selected_by_actor_type` + `selected_at`, all pre-existing
from `rootColumns`.

### 15.2 What K2 writes

One transaction: insert `knowledge_nodes`, then insert `knowledge_facts` selecting it as active.
Both rows carry the same server-resolved tenant, so the active-node selection cannot cross a tenant
boundary. A failed fact insert rolls the node back — a fact without a node, or an orphan node, is
not a state this code can produce.

Written unconditionally: `draft` · `provisional` · health `unknown`, with `ratified_at`,
`ratification_decision_id` and `governance_session_id` **NULL**. A person typing a sentence has not
ratified it, and there is no form field that can say otherwise. Provenance records
`origin: "human-authored"` and `textOriginUnverified: true` — Hebun genuinely cannot tell whether the
human drafted the text or pasted something a model produced, and does not pretend to.

### 15.3 Boundaries

- **CREATE ONLY.** No update, no upsert, no delete, no soft-delete. A duplicate identity
  (`tenant, domain, scope, fact_key`) is refused, never overwritten.
- **Heby remains a reader.** No Heby module imports the write; the write imports no model client, no
  conversation repository, and no voice module. No slash command creates Knowledge. A test asserts
  that exactly ONE module in `src/` inserts into the canonical Knowledge tables.
- **Content is data, stored verbatim.** `<script>`, `' OR 1=1 --`, `../../etc/passwd`,
  `/terminal`, "Ignore previous instructions" — all storable, all inert. Validation rejects only
  structurally broken input (empty, over-length, control characters); it never rewrites meaning.
- **R2E is independent.** Knowledge authority never consults provider connectivity, and vice versa.
  Creation works with the Director OFF; the Director being ON grants no Knowledge permission.
- **No search, no ingestion pipeline, no embeddings.** Creating Knowledge created no search
  authority: `/search` remains `requires-source`.

### 15.4 A defect K2 exposed, and fixed

Heby's response validator refuses any response whose text claims an action ("approved",
"authorized", "deployed", "deleted"). Correct — Heby must never claim to have acted. But once real
Knowledge existed, the organization's own words reached Heby, and a security policy containing the
word "authorized" is entirely ordinary. K1 had put the statement into the evidence item's `detail`,
which flows into Heby's own prose, so such a record **withheld the entire answer**.

Fixed by splitting the field: `ResolvedSourceItem.detail` now carries machine-derived STANDING only
(authority class, lifecycle, ratification, freshness, scope) and a new optional
`ResolvedSourceItem.content` carries the human's verbatim words into the model's grounding context
only, where the system instruction already frames grounding as data that must never be obeyed. Heby's
own sentences never quote source text. Pinned by a regression test.

### 15.5 Surface

`/knowledge` (the Knowledge workspace) owns the mutation — authority ownership decides UI ownership;
Heby consumes Knowledge, the workspace governs it. The card requires an explicit two-step
confirmation: step one reveals exactly what will be stored, where, and that it will be recorded
`draft`/`provisional` with no ratification. The final button reads **Create Knowledge**. Nothing
autosaves, nothing saves on blur, and editing invalidates a pending confirmation. No verification
badge, no confidence figure, no score. An unauthenticated visitor, an unconfigured database, and an
insufficient role each get their own truthful refusal instead of a form that will fail.

### 15.6 Verification

| Check | Result |
|---|---|
| K2 focused tests (2 files, 29 numbered proof groups) | pass, incl. real-PostgreSQL create → K1 read → Heby evidence |
| Real authority resolver against real `roles` rows | owner creates; member, another tenant's role, and an unknown role all refuse and write nothing |
| Full suite | **306 passed, 0 failed** (K1 closure was 304) |
| `tsc --noEmit` | clean |
| `eslint` | 0 errors, 13 pre-existing warnings |
| `next build` | compiles (172 pages) |
| Migrations added | **0** (still 17) |
| Dependencies added | **0** |

**BROWSER ACCEPTANCE — superseded by K2.1 §16, which PROVED it in a real Chrome.** At K2 closure: the in-app Browser pane would not composite in that environment —
navigation succeeds, every read and screenshot times out — and `/login` is a Next server action, so
no authenticated HTTP substitute is available either. The creation UX has not been exercised in a
real browser by a real signed-in operator. No test knowledge was written to the development
database; every fixture used a disposable database that was dropped.

### 15.7 Availability after K2

| Capability | State |
|---|---|
| Human-authored canonical Knowledge creation | **IMPLEMENTED · CONNECTED · AVAILABLE** (owner/director bands) |
| Knowledge source listing / named-source read | available (K1) |
| Knowledge editing, versioning, deletion | **UNAVAILABLE** |
| Document ingestion (upload, parsing, chunking, crawling, connectors) | **UNAVAILABLE** |
| Search | **UNAVAILABLE** |
| Semantic retrieval / embeddings | **UNAVAILABLE** |

### 15.8 Limitations

1. **Browser acceptance unproven** (§15.6).
2. **Coarse authority.** The gate is a role BAND, not a `knowledge.create` grant. It says "this actor
   governs the platform", not "this actor may author Knowledge". Connecting `role_permissions` should
   replace it.
3. **No separate audit trail.** Per-record attribution is durable, but `audit_log`, `event_log` and
   `command_audit` have zero code consumers, so there is no immutable append-only record of the
   mutation. A phase that adds update or delete will need one before it can ship.
4. **Create only.** A record with a typo cannot be corrected — it can only be superseded by a future
   versioning phase.
5. **Model-derived text is indistinguishable.** Hebun records that a human submitted the text and
   explicitly marks its origin unverified; it cannot detect that a human pasted model output.

### 15.9 Roadmap continuity

- **K1 — Knowledge Source Expansion:** CLOSED WITH DOCUMENTED LIMITATION.
- **K2 — Director-Authored Knowledge Ingestion:** CLOSED WITH DOCUMENTED LIMITATION.
- **R2F — Provider Operations Depth:** **DEFERRED**, definition unchanged.
- Nothing committed, tagged, or pushed. `main` at `bc6797e` = `origin/main`, `0/0`.

---

## 16. K2.1 — Browser Acceptance + Governance Hardening (2026-08-11)

**Verdict: K2.1 CLOSED.** Browser acceptance: **PROVEN**.

### 16.1 Browser environment

The in-app Browser pane still will not composite. K2.1 used the **Chrome DevTools MCP** — a real
Chrome — instead. One environmental cause of the earlier failures was also found and fixed without
weakening anything: Next dev **blocks cross-origin dev resources**, so loading the app on
`127.0.0.1` left client chunks unhydrated and every button inert. Using the canonical `localhost`
origin resolved it. No `allowedDevOrigins` change, no auth bypass, no fake session.

Acceptance ran against a **disposable database** (`hebun_k21_acceptance`) with its own dev server on
port 3210, seeded with two real local identities — `owner@k21.test` (owner band) and
`member@k21.test` (member band) — that signed in through the normal auth flow. The whole database
was dropped afterwards, which is how the fixture was removed without K2 gaining a delete capability.
The main development database was never touched and still holds 0 facts / 0 nodes.

### 16.2 What was proven in a real browser

| Step | Result |
|---|---|
| Owner signs in, sees the authoring form | ✅ |
| Consequence step before writing | ✅ states persistence, identity, `draft`, `provisional`, **no ratification**, Heby-evidence use, **grants no execution authority**, and no edit/delete |
| Final action reads **Create Knowledge** | ✅ |
| Creation succeeds; identity shown | ✅ `acceptance / k21-browser-acceptance (company-wide)` |
| Record appears in the Knowledge list | ✅ with its real standing, not a badge |
| Duplicate attempt | ✅ explicit refusal, original unchanged, still 1 fact / 1 node |
| `/knowledge` in Heby | ✅ lists the created source |
| `/source k21-browser-acceptance` | ✅ retrieves the content |
| `/search acceptance` | ✅ still refused — creating Knowledge created no search authority |
| Natural-language Heby question (Quick Panel on `/knowledge`) | ✅ 1 evidence reference, **Provider disabled by Director — answered deterministically** |
| Member sees no form | ✅ replaced by the truthful coarse-authority refusal |
| **Member calls the server action directly** | ✅ `{"status":"forbidden","roleType":"member"}` — every forged `tenantId`, `roleId`, `actorId`, `createdBy`, `approvedBy`, `lifecycleStatus`, `knowledgeAuthority`, `ratifiedAt`, `ratificationDecisionId`, `governanceSessionId` ignored |
| Unauthenticated direct call | ✅ refused, nothing written |
| Content inertness | ✅ statement renders as a single `#text` node, `innerHTML` shows `&lt;script&gt;`, zero `<script>` elements inside it, `window.__K21_XSS__` never set — through the form, the list, `/knowledge`, `/source`, and Heby grounding |
| Responsive | ✅ 500 / 768 / 1440 px — zero horizontal overflow, action reachable, record readable |
| Accessibility | ✅ every field labelled, `aria-invalid` + `aria-describedby` to real error text (not colour-only), confirmation is a labelled `role="group"`, success `role="status"`, refusal `role="alert"` |

Attribution was verified in the canonical rows: `created_by` = the authenticated owner,
`created_by_type` = `human`, `selected_by_actor_*` set, `ratified_at` / `ratification_decision_id` /
`governance_session_id` all **NULL**, provenance `origin: human-authored` with
`textOriginUnverified: true`.

### 16.3 Governance hardening

The K2 limitation — a coarse role band rather than a `knowledge.create` grant — was **not** papered
over. It was made a declared value: `KNOWLEDGE_WRITE_AUTHORITY_MODEL` in
`features/knowledge/create-contracts.ts` states `kind: "role-band"`,
`fineGrainedPermissionRuntimeConnected: false`, the bands, and one operator-facing sentence. The
resolver's enforced set is derived from it, and the UI refusal renders it verbatim, so a stale
sentence cannot survive in a component. A test asserts the declaration **and** that no code in
`src/` reads the permission tables — if a real permission runtime ever lands, that test fails and
the declaration must change with it.

Auditability was re-audited and remains unchanged: `audit_log`, `event_log` and `command_audit` still
have zero consumers. K2.1 invented no second audit table. The distinction is now pinned by test:

- **CAN answer:** who established this current record (durable, on the canonical rows).
- **CANNOT yet answer:** the complete sequence of all attempted and successful Knowledge mutations.

Record attribution is not an append-only audit log, and this document does not call it one.

### 16.4 Verification

| Check | Result |
|---|---|
| K2.1 focused test (`governance-hardening.ts`, 7 proof groups) | pass |
| Full suite | **307 passed, 0 failed** (K2 was 306) |
| `tsc --noEmit` | clean |
| `eslint` | 0 errors, 13 pre-existing warnings |
| `next build` | compiles (172 pages) |
| Migrations added | **0** (still 17) |
| Dependencies added | **0** |
| Acceptance fixtures left behind | **none** — disposable database dropped |

### 16.5 Capability truth after a real populated record

| Capability | State |
|---|---|
| Human-authored canonical Knowledge creation | AVAILABLE (owner/director band) |
| Knowledge source listing | AVAILABLE |
| Named source read | AVAILABLE |
| Search | **UNAVAILABLE** |
| Semantic retrieval | **UNAVAILABLE** |
| Document ingestion | **UNAVAILABLE** |
| Embeddings | **UNAVAILABLE** |
| Knowledge editing / versioning / deletion / ratification | **UNAVAILABLE** — K3 |
| Fine-grained `knowledge.create` permission | **NOT IMPLEMENTED** |
| Append-only Knowledge audit | **NOT CONNECTED** |

### 16.6 Remaining limitations

1. **Coarse authority.** Still a role band, now explicitly declared and tested as such.
2. **No append-only audit.** Per-record attribution only. A phase adding update or delete needs a
   real audit authority first.
3. **Create only.** A typo cannot be corrected — K3 owns supersession.
4. **Model-derived text is indistinguishable.** Provenance marks the origin unverified.
5. Narrow-viewport check bottomed out at 500 px (browser window minimum), not 375 px.

### 16.7 Roadmap continuity

- **K1 — Knowledge Source Expansion:** CLOSED WITH DOCUMENTED LIMITATION.
- **K2 — Director-Authored Knowledge Ingestion:** CLOSED WITH DOCUMENTED LIMITATION.
- **K2.1 — Browser Acceptance + Governance Hardening:** **CLOSED.**
- **K3 — Knowledge Versioning / Supersession:** **NOT STARTED.**
- **R2F — Provider Operations Depth:** DEFERRED, definition unchanged.
- Nothing committed, tagged, or pushed. `main` at `bc6797e` = `origin/main`, `0/0`.

---

## 17. G1 — Knowledge Mutation Audit Authority (2026-08-11)

**Verdict: G1 CLOSED WITH DOCUMENTED LIMITATION.** Zero migrations, zero dependencies.
**Director Gate A: evaluated, NOT triggered** — a legitimate append-only authority already existed.

### 17.1 The question, and the one answer

> **Where is the immutable product-level history of governed Knowledge mutations?**
> **`public.audit_log`**, owned by `features/governance-audit`.

Current state and mutation history are now explicitly different authorities:

| Question | Authority |
|---|---|
| What does the organization hold now? | `knowledge_facts` / `knowledge_nodes` |
| Who established the record that exists? | `created_by` / `selected_by_actor_*` on those rows |
| **What was attempted, by whom, and how did it end?** | **`audit_log`** |

Current-state columns structurally cannot answer the third question: a refusal leaves no row behind.

### 17.2 Candidate audit authorities — audited

| Candidate | Classification | Verdict |
|---|---|---|
| `audit_log` | **DESIGNED · IMPLEMENTED · APPEND_ONLY · AUTHORITATIVE**, migrated in the audit-event-backbone migration, **0 consumers** | **SELECTED.** Its own header calls it "the shared, cross-domain, immutable audit sink", built deliberately WITHOUT `tenantColumns` (no soft-delete, no `updatedBy`, no version-update) and states immutability "is enforced at the write layer (later)". G1 is that write layer. |
| `event_log` | DESIGNED · APPEND_ONLY, 0 consumers | Rejected. It answers "what happened that others may react to" — a notification concern. Publishing and subscriptions are explicitly deferred. It is not a governance trail of who attempted what. |
| `command_audit` | IMPLEMENTED, FK-bound to `commands`, uses `tenantColumns` (**MUTABLE**: `updatedBy`, `deletedAt`, `version`) | Rejected. Command-domain scoped and structurally mutable. |
| `telemetry_events` | DESIGNED, 0 consumers | Rejected. Observability, not governance. |
| `enterprise-domain-events` + `enterprise-event-bus` | IMPLEMENTED, **in-process/in-memory only**, no persistence | Rejected. Not durable. |
| `governance-audit-explainability` | IMPLEMENTED, read-only UI model; its own header says "there is no durable authoritative audit persistence" | Rejected as a sink; it describes pipeline shape. |
| `features/events/mock.ts` | MOCK | Rejected. |

**No second audit system was created.** G1 built the first writer over an authority that already existed — the same pattern K1 used for the canonical Knowledge tables.

### 17.3 Contract and semantics

- **Mutation classes:** `knowledge.create` only. `knowledge.update` / `.delete` / `.supersede` /
  `.ratify` are deliberately **absent** — declaring one would advertise a capability that does not
  exist. A test asserts their absence.
- **Outcomes:** reuse the existing `audit_result` enum — `committed` · `rejected` · `rolled-back`.
  `authorized` is **not** an outcome: authorization is the precondition for being recorded at all, so
  every event is already an authorized attempt. Collapsing "was allowed to try" into "succeeded" is
  precisely what this vocabulary prevents.
- **Recording boundary** (`KNOWLEDGE_AUDIT_BOUNDARY`, a declared value, enforced and tested):
  recorded once an attempt has **passed the authority gate and names a well-formed governed
  identity**. Unauthenticated attempts, forbidden attempts, and malformed input are **not** recorded
  — they are events about a principal, not changes to Knowledge, and recording them here would both
  duplicate an authority and let an unauthorized user append to a tenant's governance ledger at will.
- **Content minimization:** `previous_state` and `next_state` stay **NULL**. Metadata carries
  identity and version counters only — fact key, domain, scope, node ids, `factVersion`,
  `knowledgeVersion`, reason code. No statement, no title. A test greps the whole sink for the
  content and asserts its absence: the ledger is not a shadow Knowledge database.

### 17.4 Transaction relationship

`audit_log` is in the SAME control-plane database as the canonical Knowledge tables, so a
**committed** mutation writes its audit row **inside the same transaction**. "Knowledge committed but
no audit" and "audit claims a change that rolled back" are excluded by the transaction, not by
discipline. No distributed-transaction machinery was invented.

`rejected` and `rolled-back` have no transaction to join and are appended separately. If that append
fails, the caller receives `audited: false` — the gap is reported, never swallowed into a false
success.

### 17.5 Append-only enforcement

The module exports exactly five functions — project an actor, append (two forms), read, resolve the
database. There is no update, delete, upsert, or "correct an event" path, and a test asserts both the
absent SQL and that no exported name offers one. G1 makes the honest claim: the *application
authority* is append-only. A database superuser can of course still edit a row; that is not what is
being asserted.

### 17.6 Actor, tenant, and forgery

Actor and tenant come from `auditActorFrom(TenantContext)` — the only supported construction, reading
only server-owned fields. `actorType`, `entityType`, `simulation`, and `authoritySource` are fixed in
code; the clock is a parameter. The client-facing server action accepts content only. History reads
are tenant-scoped by predicate, per fact — there is no unscoped or whole-ledger query in the module,
and holding another tenant's real fact id returns nothing.

### 17.7 Read seam and UI

`readKnowledgeMutationHistory(tenant, factId)` — narrow, tenant-scoped, newest-first, bounded. It
exists because K3 will need it and because tenant isolation of history cannot be proven at the product
layer without a reader. **No UI was added in G1**, so browser acceptance is not applicable
(Step 29). The history seam is IMPLEMENTED and CONNECTED but **not yet product-consumed** — stated
plainly rather than counted as a shipped feature.

### 17.8 Verification

| Check | Result |
|---|---|
| G1 focused tests (2 files, 19 numbered proof groups) | pass, incl. real-PostgreSQL commit/refusal/rollback/tenant-isolation |
| Full suite | **309 passed, 0 failed** (K2.1 was 307) |
| `tsc --noEmit` | clean |
| `eslint` | 0 errors, 13 pre-existing warnings |
| `next build` | compiles (172 pages) |
| Migrations added | **0** (still 17) |
| Dependencies added | **0** |
| Test fixtures left | none — disposable database dropped; dev DB still 0 facts / 0 audit rows |

### 17.9 K3 readiness

`priorKnowledgeNodeId`, `newKnowledgeNodeId`, `factVersion` and `knowledgeVersion` are already in the
metadata contract and `action` is a string on `audit_log`, so a K3 supersession is an **added action**
rather than a new audit authority. A test constructs a future supersession event with today's types
to prove the shape holds. This is future-compatibility, **not** an active capability.

### 17.10 Limitations

1. **Authorization failures are not in Knowledge history.** By design (§17.3). Hebun still has no
   connected security-telemetry authority, so a forbidden attempt is currently recorded nowhere.
   That is a real gap and belongs to a security-telemetry phase, not to Knowledge.
2. **History has no product consumer yet.** The read seam is connected but unused by any UI.
3. **Append-only is a product-layer guarantee**, not a database-level one.
4. Only `knowledge.create` exists, because only creation exists.
5. The coarse role-band authority from K2/K2.1 is unchanged.

### 17.11 Roadmap continuity

- **K1** read · **K2** human create · **K2.1** browser + governance acceptance · **G1** append-only
  mutation history — all local, unpublished.
- **K3 — Knowledge Versioning / Supersession: NOT STARTED.** Its audit prerequisite now exists.
- **R2F — Provider Operations Depth:** DEFERRED, unchanged.
- Governance as a whole is **not** "connected": only Knowledge mutation history is. Policy
  evaluation, approvals, decision records, and security telemetry remain unconnected.

---

## 18. K3 — Knowledge Versioning & Supersession (2026-08-11)

**Verdict: K3 CLOSED.** Zero migrations, zero dependencies. Browser acceptance **PROVEN**.

### 18.1 The invariant

A correction creates a NEW version and leaves the old one untouched:

```
Fact F  active → N1 (knowledge_version 1)
        ↓ correction
Fact F  active → N2 (knowledge_version 2, supersedes = N1)
        previous → N1,  fact_version 2
```

`N1` is never rewritten. A test asserts over the whole of `src/` that no module updates a knowledge
node — the only update anywhere moves a fact's active SELECTION.

### 18.2 Authority map — nothing new was created

| Concern | Owner | K3's change |
|---|---|---|
| Current state | `knowledge_facts` / `knowledge_nodes` | unchanged |
| Write authority | K2's `durable-knowledge-writer` | one method added |
| Human authorization | connected role band (`roles.type`) | reused, own call site |
| Mutation history | G1's `audit_log` | one ACTION added |
| Version chain | reconstructed from `supersedes_knowledge_node_id` | new read, no new table |
| Heby | READ-ONLY | unchanged |

**Migration gate: not triggered.** Every field already existed —
`knowledge_nodes.supersedes_knowledge_node_id` (uuid, FK to itself), `knowledge_nodes.knowledge_version`,
`knowledge_facts.{active,previous}_knowledge_node_id`, `knowledge_facts.fact_version`. G1's prediction
held exactly: `knowledge.supersede` was an added action, not a new authority.

### 18.3 Concurrency — and a defect the browser found

Two protections, refusing two different things:

1. **Compare-and-swap**, server-owned. The fact's `fact_version` and active node are read INSIDE the
   transaction and used as the `WHERE` of the selection update. Zero matched rows ⇒ abort ⇒ the whole
   transaction rolls back, including the node it had already inserted. Proved with a deterministic
   overlap: a third connection holds `SELECT … FOR UPDATE` so both corrections complete their reads
   and then race for real. Exactly one wins; the other returns `stale-version`.
2. **Observed-version precondition.** Browser acceptance exposed a gap the swap cannot see: a form
   opened against v2 and submitted after someone else committed v3 was **accepted as v4**, quietly
   burying a version it never read. Fixed by carrying the version the operator was SHOWN. It is a
   precondition, never authority — it can only cause a refusal, the swap still uses the server-read
   version, and a forged or missing value can only make the request fail. Re-proved in the browser:
   the stale form is now refused, and nothing was written.

*A plain `Promise.all` proves nothing here — two calls can simply serialize, each legitimately reading
what the other wrote. The overlap has to be forced.*

### 18.4 Audit integration

A committed supersession appends `knowledge.supersede` / `committed` **inside the canonical
transaction**, carrying prior and new node ids and both version counters on each side — and no
content. A refusal appends `rejected` with `stale-version` or `fact-unresolvable`; a failed
transaction appends `rolled-back`. G1's outcome vocabulary was reused, not extended.

### 18.5 Version history read

Reconstructed from the canonical relationships — no second history authority. Newest first,
tenant-scoped at EVERY step, hard-bounded at 50, and **cycle-safe**: a seen-set stops the walk the
moment it revisits a node and reports `cycle-detected`, `broken-link`, or `truncated` rather than
looping or silently repairing. Proved by deliberately corrupting a chain into a cycle.

### 18.6 UX

In the Knowledge workspace, never in Heby. The action reads **Create New Version**; there is no
"Edit", "Save changes", or "Update" anywhere in the component, and a test bans those words. The
confirmation shows current and new versions side by side and states that the old version remains in
history, that the new one is draft/provisional, that a correction does not ratify, and that it grants
no execution authority. Version history labels active vs historical **by word**, not colour.

### 18.7 Browser acceptance — PROVEN

Disposable database, real `localhost` origin, real sign-in, dropped afterwards.

Owner created v1 → corrected to v2 (hostile content included) → v2 active, **v1 preserved verbatim**
→ persisted across reload → history shows both with the active one labelled → Heby grounded on **v2
only**, `ORIGINAL v1` never entering evidence, Director OFF so deterministic. Stale-form correction
**refused** with the honest message. Member: no correction button, can still read history, and the
**direct action replay with `tenantId`, `actorId`, `roleId`, `roleType`, `createdBy`, `approvedBy`,
`knowledgeVersion`, `factVersion`, `supersedesKnowledgeNodeId`, `ratified`, `lifecycleStatus`,
`knowledgeAuthority` all forged → `{"status":"forbidden","roleType":"member"}`**. XSS never executed
through the form, the list, history, or Heby. Responsive at 500/768/1440 with zero overflow;
labels, `aria-invalid`, `aria-describedby` errors, and a labelled confirmation group all present.

### 18.8 Verification

| Check | Result |
|---|---|
| K3 focused tests (2 files, 10 numbered groups incl. forced-overlap concurrency) | pass |
| Full suite | **311 passed, 0 failed** (G1 was 309) |
| `tsc --noEmit` | clean |
| `eslint` | 0 errors, 13 pre-existing warnings |
| `next build` | compiles (172 pages) |
| Migrations / dependencies added | **0 / 0** |
| Fixtures left | none — disposable DB dropped; dev DB 0 facts / 0 nodes / 0 audit |

### 18.9 A hazard recorded, not hidden

`persistence/supabase-postgres-adapter.ts` (legacy, pre-K1) contains
`update knowledge_nodes … set statement = …` — an in-place content edit. It cannot reach canonical
Knowledge for **two independent reasons**, and a test pins both: (1) `storage-manager.ts` routes every
collection to the in-memory adapter — the postgres branch is commented out; (2) its predicate is
`(tenant_id, ref_id)` and canonical K1/K2/K3 nodes carry no `ref_id`. **Enabling that branch would
expose an in-place edit path over `knowledge_nodes` and must not be done without addressing this.**

### 18.10 Rollback — an architectural rule, deliberately unimplemented

Restoring older wording must produce a NEW version whose content restores it (v1→v2→v3 ⇒ v4), never a
reactivation of a historical node. K3 ships **no rollback UI, command, or action**, and the audit
vocabulary deliberately omits `knowledge.rollback`. `/rollback` and `/delete` remain S1 reserved and
inert, and a test asserts they acquire no Knowledge meaning.

### 18.11 Limitations

1. **No human-authored correction reason.** No such field exists in the canonical model, so none is
   invented — history shows what changed, not why.
2. Coarse role-band authority, unchanged from K2.1.
3. No delete, no ratification, no restore.
4. Narrow-viewport check bottomed out at 500 px (browser window minimum).
5. The legacy adapter hazard above.

### 18.12 Roadmap continuity

- **K1** read · **K2** create · **K2.1** acceptance · **G1** mutation history · **K3** versioning —
  all local, unpublished.
- **R2F — Provider Operations Depth:** DEFERRED, unchanged.
- Governance as a whole is still NOT connected: only Knowledge mutation history is. Policy
  evaluation, approvals, decision records, and security telemetry remain unconnected.

---

## 19. K4 — Ratification & Governance (2026-08-11)

**Verdict: K4 BLOCKED — DIRECTOR DECISION REQUIRED.** Nothing was implemented. No code, schema,
migration, or dependency changed.

### 19.1 Why

The canonical Knowledge model does not let a Knowledge feature ratify anything. Its ratification
fields are **foreign keys into the Governance authority**:

- `knowledge_nodes.ratification_decision_id` → `decision_records.id`
- `knowledge_nodes.governance_session_id` → `governance_sessions.id`
- plus `ratified_by_actor_type` / `ratified_by_actor_id` / `ratified_at`
- and the same pair again on `knowledge_facts`

`db/schema/governance.ts` states the ownership rule in its own header, unambiguously:

> "Governance is the ONLY authority that may approve / **ratify** / promote / certify / suspend /
> revoke / delegate / escalate authority. This file is SCHEMA ONLY — NO authorization engine, NO
> approval workflow, NO policy evaluation, NO runtime."

and

> "This invariant is DOCUMENTED here and enforced at the write layer **later**."

That write layer does not exist. Ratifying therefore means building Hebun's **first decision
authority** — which is exactly what the K4 Director Gate says to stop for.

### 19.2 Candidate authorities — audited, all insufficient

| Candidate | Classification | Why it cannot ratify |
|---|---|---|
| `governance_sessions` / `decision_records` | **DESIGNED · SCHEMA ONLY · 0 rows · 0 application consumers** (only two test fixtures insert) | The declared owner of ratification, with no runtime. Writing the first row *is* the new authority. |
| `human-approval/*` | IMPLEMENTED, **pure in-memory** | Computes approval over execution/planning **simulations**. Touches no database, and is about executing commands, not ratifying Knowledge. |
| `decision-runtime` | DERIVED read projection | A dashboard model. Decides nothing. |
| `approvals` (`mock.ts`), `governance/approvals.ts` | **MOCK** — hardcoded arrays | Display fixtures. |
| `governance-policies`, `governance-audit-explainability` | Read-only models | `governance-audit-explainability` states in its own header that no durable authoritative audit persistence exists. |
| `permissions` / `role_permissions` | SCHEMA ONLY (unchanged since K2.1) | No permission runtime; the coarse `roles.type` band is not a governance authority. |

The schema even anticipated this exact phase and reserved it for Governance:
`governance_domain` includes **`knowledge-ratification`**, and `governance_decision_type` includes
**`ratify`**. Those values exist for the Governance runtime to use — not for Knowledge to bypass it.

### 19.3 The shortcut, named and refused

`ratified_at` and `ratified_by_actor_*` are plain nullable columns. Setting them while leaving
`ratification_decision_id` NULL would need **zero migration**, and K1's read
(`ratified: Boolean(ratificationDecisionId ?? ratifiedAt)`) would immediately report the record as
ratified.

It was refused. That would produce Knowledge marked **ratified with no decision record, no
justification, and no accountable deciding actor**, and it would silently promote the coarse
owner/director role band into a ratification authority that `governance.ts` explicitly says it is
not. It is the "invented role semantics" the Gate names, wearing a smaller patch.

### 19.4 The missing seam, precisely

To ratify one Knowledge version honestly, Hebun needs a **Governance decision authority** that can:

1. open a `governance_sessions` row — `governance_domain: "knowledge-ratification"`,
   `decision_type: "ratify"`, `subject_type`/`subject_id` naming the **knowledge node** (the version,
   not the fact), a proposer actor, and a risk class;
2. record a `decision_records` row — accountable `actor_type`/`actor_id`, `outcome`, a **mandatory
   `justification`**, and the session link;
3. enforce the declared **bootstrap-authority invariant**: the genesis decision in a tenant carries
   `bootstrap: true` and its `actor_type` MUST be `"human"`; agents may never self-elevate;
4. decide who may sit in that authority — which is a governance question, not a role-band question,
   and is where a real `role_permissions` runtime probably belongs;
5. only then write `ratified_at`, `ratified_by_actor_*`, `ratification_decision_id` and
   `governance_session_id` onto the node, inside one transaction, with a G1
   `knowledge.ratify` audit entry.

**Schema requirement: none.** Every column and enum value already exists. What is missing is an
authority, not a table.

### 19.5 Proposed next phase — G2: Governance Decision Authority

Narrowest useful scope, for separate Director authorization:

- one governed decision path: open session → record decision → link subject, tenant-scoped and
  server-resolved throughout;
- decision types limited to what will actually be used (`ratify`, `reject`);
- the bootstrap-authority invariant enforced at the write layer, as `governance.ts` says it should be;
- append-only history through **G1's existing `audit_log`** — no second sink;
- **no** approval chains, voting, quorum, gates, escalation, appeals, or policy evaluation. Those are
  columns on the schema; they are not this phase.

K4 then becomes thin: a Knowledge surface that *requests* a ratification decision from G2 and binds
its outcome to a specific version.

### 19.6 Semantics settled in advance (for whoever runs G2 → K4)

- **Ratification binds to a VERSION, not a fact.** If v2 is ratified and v3 supersedes it, v3 is
  **not** ratified — new content requires new governance truth. K3 already writes every new version
  `draft`/`provisional` with all ratification fields NULL, and a test asserts it.
- **Stale review must refuse.** The operator ratifies the version they actually read; K3's
  observed-version precondition is the pattern to reuse.
- **Ratification never mutates content.** It may set governance fields only. Supersession remains
  the sole correction path.
- **Heby may report `ratified` and must never equate it with "true".** It already reads the standing
  from canonical fields only and can never invoke the mutation. No slash ratification command.

### 19.7 State

Nothing implemented. `main` at `bc6797e` = `origin/main`, `0/0`, nothing staged. Working tree
unchanged by K4 — the 120 entries are the pre-existing unpublished K1/K2/K2.1/G1/K3 and Voice work.
Suite remains **311 passed, 0 failed** from K3 closure; no code was touched, so nothing was re-run
beyond the verification reads cited above.

---

## 20. G2 — Minimal Governance Decision Authority (2026-08-11)

**Verdict: G2 BLOCKED — DIRECTOR DECISION REQUIRED.** Nothing was implemented. No source, schema,
migration, or dependency changed.

K4 blocked because the governance decision **runtime** was missing. G2 blocks one level deeper: the
**entitlement to be that authority** is not determined by anything in the repository. Building G2
without settling it would mean Hebun's first governance decision — the one that can establish all
future governance authority — was granted by an inference invented here.

### 20.1 Governance repository reality

| Subsystem | Classification | Rows / consumers |
|---|---|---|
| `governance_sessions`, `decision_records` | **DESIGNED · SCHEMA ONLY** | 0 rows · 0 application consumers (2 test fixtures) |
| `permissions`, `role_permissions` | **DESIGNED · SCHEMA ONLY** | 0 rows · 0 consumers |
| `roles.system_role` / `authority_rank` / `policy_refs` | DESIGNED | **0 set · 0 runtime readers** |
| `memberships.authority_scope`, `delegated_by_*` | DESIGNED | **0 set · 0 runtime readers** |
| `governance_sessions.authority_source_actor_*` | DESIGNED | 0 rows |
| `human-approval/*` | IMPLEMENTED · **in-memory**, execution-scoped | no DB |
| `decision-runtime` | DERIVED read projection | dashboard only |
| `approvals/mock.ts`, `governance/{approvals,permissions}.ts` | **MOCK** — hardcoded arrays | display fixtures |
| `governance-policies`, `governance-audit-explainability` | Read-only models | no durable authority |
| `roles.type` band (owner/director) | **CONNECTED** | the only live authorization primitive |
| `audit_log` (G1) | **CONNECTED, APPEND-ONLY** | usable for governance history |

### 20.2 Gate A — Governance authorization model (TRIGGERED)

Nothing connected can answer *"who may create a Governance decision?"*. Every field that could
express it — the permission grants, the role authority markers, the membership authority scope, the
session's own authority source — is schema-only, unset, and unread.

**The role band cannot be borrowed, and the schema itself is why.** `governance.ts` models the
bootstrap decision as *"the first authority in a tenant"* — authority is something a governance
decision **establishes**. If `owner`/`director` already conferred governance authority, the bootstrap
concept would be redundant. The band is a coarse membership attribute, and K2.1 already declared it as
exactly that (`KNOWLEDGE_WRITE_AUTHORITY_MODEL.kind = "role-band"`,
`fineGrainedPermissionRuntimeConnected: false`). Promoting it into the genesis of governance is the
"invented role semantics" both K4 and G2 forbid.

Heby's identity boundary does say "The Director is the accountable human in whom decision authority
resides" — but that is a constitutional statement about **Heby's** limits (Heby terminates at the
Director). It is not a mapping from `roleTypeEnum` to governance entitlement, and it does not say
which human in a tenant may open the first governance session.

### 20.3 Gate B — Bootstrap / genesis invariant (TRIGGERED)

`governance.ts` states the genesis rule and, in the same breath, forecloses deriving it:

> "The system must NEVER create its own authority. The genesis of all authority is a HUMAN… a
> bootstrap decision is the first authority in a tenant and its `actorType` MUST be 'human'… This
> invariant is DOCUMENTED here and enforced at the write layer later — **NOT by a fabricated default
> user and NOT by runtime logic in this phase. No default users are created.**"

G2's own Step 3 rules out every remaining signal: not an empty table alone, not the owner role alone,
not Director provider permission, not environment variables, not seeded mocks. **Those are the only
signals present.** Nothing is left from which legitimacy could be derived.

This is the security-sensitive case the gate exists for: the genesis decision can establish who holds
governance authority afterwards. Guessing it once would be permanent.

### 20.4 Migration gate — not the blocker

**No schema change is required.** Every table, column, and enum G2 needs already exists
(`governance_domain: knowledge-ratification`, `governance_decision_type: ratify | reject`,
`bootstrap`, `authority_source_actor_*`, mandatory `justification`). What is missing is a **decision
about entitlement**, not a table.

### 20.5 The narrowest legitimate bootstrap models — for Director choice

Each is implementable with zero migration once chosen. They differ in who is entitled, not in shape.

**Option 1 — Explicit Director-nominated genesis (recommended).**
The Director names one human identity per tenant as the genesis governance actor, recorded
deliberately (config or a one-time governed action). The first decision is written `bootstrap: true`,
`actor_type: human`, `authority_source` = that identity. Subsequent authority flows from governance
decisions, not from role bands. *Most faithful to "the genesis of all authority is a HUMAN"; requires
one Director act.*

**Option 2 — Connect `role_permissions` first.**
Build the permission runtime, seed a `governance.decide` grant, and gate G2 on it. Honest and
general, and it also retires K2.1's documented coarse-authority limitation — but it is a larger phase
than G2, and the genesis question returns as "who may grant that permission?".

**Option 3 — Declare the role band a governance authority.**
Fast, and **not recommended**. It contradicts `governance.ts`, makes the bootstrap concept redundant,
and silently turns a coarse membership attribute into constitutional authority. Recorded only so the
option is visibly rejected rather than quietly available.

### 20.6 Settled in advance (so the eventual phase does not re-litigate)

- Governance owns the **decision**; Knowledge may later **reference** it. A decision never mutates
  Knowledge — K4 stays a separate consumer.
- Decisions are **append-only**: no update of justification, outcome, actor, or subject; a reversal is
  another decision, not a mutation.
- Justification is **mandatory, human-authored, untrusted text**, stored inertly.
- Subject binding names a **specific Knowledge node/version**, tenant-validated, never a URL or
  executable reference.
- History goes through **G1's existing `audit_log`** — no second sink. The decision record stays the
  authority for decision *content*; audit records the *event*.
- Decision types activated at first: **`ratify`, `reject` only**. Enum presence is not runtime
  availability.
- Heby may later **read** decisions; it can never create one. No `/ratify`, `/approve`, `/reject`,
  `/decide` command.
- Concurrency: bind to the reviewed version using K3's observed-version precondition pattern.

### 20.7 State

Nothing implemented. `main` at `bc6797e` = `origin/main`, `0/0`, nothing staged. `apps/dashboard/src`
is untouched by G2 — its 72 entries are the pre-existing unpublished K1/K2/K2.1/G1/K3 and Voice work.
Baseline re-run for this report: **311 passed, 0 failed**; typecheck clean.
