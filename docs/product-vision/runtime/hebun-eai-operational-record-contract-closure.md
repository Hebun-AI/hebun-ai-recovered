# EAI-OPERATIONAL-RECORD-1 · the `operational-record` data contract · closure record · VERIFIED

Controlled Agent Reasoning, phase 1. This phase gives the EXTERNAL-AI-DATA-USE class
`operational-record` a written, tested meaning. It also defines the most of it a model could ever be
shown for planning, and proves the boundary that sits in front of it. It enables nothing. No
platform cell, purpose, tenant authorization, arming, schema, migration or provider call changed.
No model has reasoned over Work data, and none can.

It follows the design-only record `hebun-heby-ai-planning-phase1-closure.md` (4543af9a). Under the
Director's EAI-B2 OPERATIONAL DATA CONTRACT brief it changes two points of that design:

- **Work titles are DENY by default.** Earlier they were an option under D3.
- **`evidenceDeclared` is added** as a presence flag.

## 1 · Repository reality (re-measured 2026-10-13)

- **`origin/main`:** `64ffae70`, unchanged since the previous phase.
- **`ebe6df78`** (NL planning closure) and **`4543af9a`** (phase-1 design): both are intact, both are
  fast-forwards of `origin/main`, and neither is pushed.
- **Instructions:** `CLAUDE.md` and `hebun-loop.md` are identical to `origin/main`.
- **Source:** no `src` difference between `64ffae70` and this branch's base.
- **Previous investigation:** reused, not repeated.

## 2 · The semantic contract

**The authority.** EAI owns data classification for external models. Classes are named by the
authority that owns the records (`contracts.ts`). This phase adds one module inside that authority:
`apps/dashboard/src/features/external-ai-data-use/operational-record-contract.ts`. It imports only
the `DataClass` type. Nothing at runtime reads it, and a test proves that.

| Distinction | Contract |
|---|---|
| Authoritative operational records | `work_items`, owned by the Organizational Work Authority (`OPERATIONAL_RECORD_OWNER`). |
| Derived operational facts | Any count, flag, age or presence computed from those records. It travels as `operational-record`, under the same authorization, or not at all. Derived is not anonymous. |
| Personal and identifying information | Actor ids, names and membership status belong to Identity. They are **not disclosable** under this class. |
| Sensitive organizational information | Titles, descriptions and comments are human free text and are not claimed free of personal or sensitive data. **Denied.** |
| Provider disclosure eligibility | Naming the class decides nothing. Disclosure is decided by platform cell × attestation × tenant × operator, composed fail-closed. **Today no purpose has a cell for this class**, so every declaration is refused `platform-unknown`. |
| Purpose limitation | It may be disclosed only for a purpose with a recorded platform cell and the tenant's explicit scope for that same purpose. Assistance holds none, and this phase adds none. |
| Tenant isolation | The projection carries no tenant. The declaration's tenant comes only from the authenticated context. A tenant mismatch is refused before the authority is asked. |
| Provenance | Each field records its source authority and whether it is authoritative, derived or invocation-local. |
| Retention and logging | The projection is never persisted. The audit evidence for a decision records the purpose, the classes, the model and the revisions. It never records content; its field set is pinned by test. Provider-side retention is the attestation's (bounded 30 days, no ZDR). |

## 3 · Minimum planning projection

`{ items: [{ alias, state, accountable, stale, evidenceDeclared }] }`, at most 40 items. Every field
is required and every value is closed. Any other key, at the top level or on an item, is refused.
Nothing is repaired or truncated.

| Field | Source authority | Purpose | Class | Sensitivity | Required authorization | Model visibility | Validation |
|---|---|---|---|---|---|---|---|
| `alias` | none (invocation-local) | Reference a record without its id | operational-record | operational state | as below | candidate | `W1..Wn`, contiguous |
| `state` | Organizational Work | Plan over declared state | operational-record | operational state | platform cell + tenant scope for the planning purpose | candidate | one of planned / active / blocked / complete (pinned to Work's enum) |
| `accountable` | Organizational Work (derived) | Recognise ownership gaps | operational-record | indirectly identifying | same | candidate | boolean; never who |
| `stale` | Organizational Work (derived) | Recognise neglect | operational-record | indirectly identifying | same | candidate | boolean, 30-day rule; never the time |
| `evidenceDeclared` | Organizational Work (WEV-1, derived) | Know a record has declared evidence | operational-record | operational state | same | candidate | boolean; never the referent, its id or its title |
| `title` | Organizational Work | — | operational-record | organizational free text | a separate Director decision | **denied** | refused by name |
| `description`, `comments` | none exist | — | not disclosable | free text | — | denied | refused by name |
| `workItemId`, `departmentId`, `tenantId`, `evidenceReferences`, `providerMetadata` | Work / Organization / platform | — | not disclosable | internal identifier | — | denied | refused by name |
| `accountableActorId`, `accountableName`, `accountableCurrentlyActiveMember` | Identity | — | not disclosable | personal | — | denied | refused by name |
| `department` | Organization Authority | — | organization | organizational free text | — | denied | refused by name; the server resolves and filters the scope |
| `recordedAt`, `updatedAt`, `lifecycleStatus` | Organizational Work | — | not disclosable | indirectly identifying | — | denied | refused by name; replaced by `stale` and by excluding retired items |
| `dependsOn`, `dueAt` | **none** | — | not disclosable | — | — | denied | refused by name; no authority records dependencies or deadlines |
| `credential` | platform | — | not disclosable | secret | — | denied | refused by name |

**What a model can do with this, stated plainly.** With titles denied, the model sees only states,
three flags and aliases. It can propose an order or a grouping of those aliases. It cannot say what a
piece of work is about. Whether that is worth a disclosure at all is a product decision; it is not
assumed here.

## 4 · Integration with EAI-B2 (no second authority)

| Concern | Existing mechanism | Status for operational-record |
|---|---|---|
| Capability-specific authorization | EAI has **purposes**, not capabilities. The capability boundary is the purpose plus the tenant's per-purpose scope. | No planning purpose exists. The narrowest change is a new purpose `work-planning`, which needs one CHECK migration. The alternative, `assistance × operational-record`, would widen assistance; the bite-proof below shows that the test refuses it. |
| Tenant-scoped consent | Human-only ceremony; append-only revisions; per-(purpose, class) scopes | Unchanged. No tenant holds the pair. |
| Processor attestation | `ffb0c160`, attested and not verified, model ids Haiku 4.5 only | Unchanged. Missing, withdrawn, other-account or unattested-model are all refused by test. |
| Revocation | Withdrawn revision → `tenant-withdrawn` on the next request | Proved by test |
| Fail-closed | Any unread input → `unavailable`; UNKNOWN refuses like DENIED | Proved by test |
| Auditability | One `audit_log` row per decision; an unrecorded authorization is not sent | Proved: the refusal is evidenced and the evidence carries no content |
| Model invocation boundary | `generateHebyModelAnswer` gates every live Anthropic egress before the client exists | Proved with the real live transport: 0 fetches under the recorded policy; 1 fetch only under a test-only hypothetical cell (control) |
| Output evidence validation | Not part of this phase. The design (closed output contract, alias and fact membership) stays in the phase-1 design record. | Designed, not implemented |

## 5 · Implemented vs designed

- **Implemented and verified:** the contract module (field table, owner, states, item bound) and
  the closed-world validator `validateOperationalPlanningProjection`.
- **Implemented and verified:** the boundary suite `tests/eai-operational-record/contract-and-boundary.ts`.
- **Designed only:**
  - the `work-planning` purpose;
  - the platform cell;
  - the tenant scope;
  - the projection builder from `WorkItemView`;
  - the model output contract and its evidence validation;
  - the surface.
- **Not enabled:** model reasoning over Work data. It will not be claimed until a real, authorized
  invocation is measured.

## 6 · Security tests

`tests/eai-operational-record/contract-and-boundary.ts` runs every case below, with no database, no
provider and no credential.

| Boundary | How it is proved | Result |
|---|---|---|
| No authorization → DENY | Tenant absent, under a hypothetical cell, for every purpose | `tenant-not-authorized` |
| Wrong tenant → DENY | Scopes that name another purpose or another class → `tenant-not-authorized`. A declaration for another tenant → the authority is never asked, 0 fetches. | PASS |
| Missing attestation → DENY | Absent, withdrawn, another account → `platform-unknown`; unattested model → `model-not-attested` | PASS |
| Revoked → DENY | Withdrawn authorization | `tenant-withdrawn` |
| Unauthorized field → DENY | Every denied field by name, any unlisted key, any top-level key | `field-not-disclosable` |
| Derived data protected | Every visible derived field is `operational-record`. A flags-only projection still declares the class. The recorded policy refuses it for every purpose even when the tenant "granted" it. | PASS |
| Title excluded by default | `title` is a denied rule and is refused by name | PASS |
| No model call before authorization | Real live transport, recorded policy | 0 fetches; refusal evidenced |
| No secret leakage | Secrets, emails, UUIDs and free text in any value are refused. The credential is absent from the request body. The evidence contains no content. | PASS |
| No Governance bypass | A tenant scope cannot open a missing platform cell. The contract imports only the vocabulary type and names no writer. | PASS |
| No execution authority | The contract names no db, permit, action, governance or machine-execution module. Runtime files do not import it. | PASS |
| Assistance not widened | `assistance × operational-record` is `unknown`. Heby's grounding declares no class for the `work` source and keeps its titles off the wire. | PASS |

Bite-proofs. Each mutation was applied to a copy and restored from that copy (`cmp` equal), and each
made the suite exit 1:

1. Making `title` visible.
2. Adding `assistance × operational-record` to the recorded policy.
3. Making the validator accept unlisted keys.

## 7 · Required Director approvals

| ID | Decision | Recommendation |
|---|---|---|
| D2 | Adopt this meaning of `operational-record` (written in code by this phase, read by nothing) | Adopt |
| D1 | Purpose `work-planning` (one CHECK migration on `tenant_ai_data_use_scopes`) instead of widening assistance | `work-planning` |
| D4 | Platform cell `anthropic/messages × work-planning × operational-record`, bounded by `ANTHROPIC_ASSISTANCE_BOUNDS`, attestation `ffb0c160` (attested, not verified) | Only once the value case below is accepted |
| D7 | Whether planning over states and flags alone, without titles, is worth a disclosure | The Director's product call |
| D3 | Admitting titles, separately and later, with AI-PLAN-TITLE-PII-1 accepted in writing | Keep DENY |
| D5, D6 | Tenant ceremony (`hebun` first); one real billable call at acceptance | Separate gates |

## 8 · Next implementation step

`projectOperationalPlanning(register, scope, now)` in `features/heby-commands/`. It is a pure
function from `WorkItemView[]` to the validated projection plus a server-only alias map. It returns
the validator's refusal unchanged, and it is wired to no model. Its tests: retired items excluded;
department filtered on the server; staleness at the 30-day edge; more than 40 items refused;
whole-output absence of ids, names, titles and timestamps. It is the first `heby-commands` importer
of the EAI authority, so the importer census in `external-ai-data-use-1a/firewall-and-inertness.ts`
gains it with a stated reason. Nothing that discloses comes before D1, D2 and D4.

No new risk is deferred here. AI-PLAN-TITLE-PII-1 and AI-PLAN-INDIRECT-PROFILING-1 stay open in the
phase-1 design record; this phase keeps titles denied and does not change either disposition.

## Closure Contract (v1)

- Phase: EAI-OPERATIONAL-RECORD-1
- Owner: EXTERNAL-AI-DATA-USE authority (`apps/dashboard/src/features/external-ai-data-use/operational-record-contract.ts`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — a new module inside a security authority's seam. Every suite that scans that feature was run, plus the boundary suite for the lifecycle, failure and tenant cases in §6. Not V3: no policy cell, purpose, authorization, schema, runtime path or provider boundary changed; the importer census and §4 of the suite prove nothing reads the module. V3 applies to the first phase that declares the class.
- Verification evidence: `node --import tsx tests/eai-operational-record/contract-and-boundary.ts` exit 0; three bite-proofs each exit 1 and restored (`cmp` equal); exit 0 for external-ai-data-use-1a firewall-and-inertness, vocabulary-and-policy and attestation-change-and-resolver, b1a record-and-binding, b1d platform-allow, b2 boundary, tenant-ceremony ceremony-boundary, heby-org-action-planning action-plan and natural-language; `tsc --noEmit` no errors; `eslint` on both new files exit 0; `git diff --check` exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-ai-planning-phase1` at 4543af9a plus this phase's changes; macOS (Darwin 25.2.0); tsx from the shared `apps/dashboard/node_modules`; no database, no provider, no credential
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released; nothing at runtime reads the contract
- Deferred risks: none
- Director approvals: the operational-record contract, its documentation, pure validation and targeted tests, and a focused local commit (EAI-B2 OPERATIONAL DATA CONTRACT brief, 2026-10-13); disclosure activation, tenant ceremony, arming, schema/migration, push and deploy NOT approved
