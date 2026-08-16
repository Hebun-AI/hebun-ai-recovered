# Hebun R3W — Durable Work Artifacts

**Status:** released to `origin/main` and tagged. **Canonical migration NOT applied — that remains a separate Director-authorized ceremony.**
**Baseline at start:** HEAD `b924928` = real `origin/main`, 0 ahead / 0 behind, 218/218 tags, 26 repo migrations = 26 applied to `hebun_r1`, `heby_action_requests` 0, `action_permits` 0, `plpgsql` only, 371 tests.

---

## 1. What this phase is

Gate A found that Hebun already declares `prepare-information` — two of the eight product intents
carry `prepares: true`, and the action registry ships a `PREPARATION_ONLY` tool whose own source
calls the prepared package its deliverable — while that package was **a value in memory that
evaporated**. R3A had closed the identical defect one layer up: *"the prepared action was a value,
not a row. R3A makes it a row."* The prepared **deliverable** was still a value.

R3W makes it a row, with immutable revisions, so a future approval can bind to bytes nobody can
change afterwards.

---

## 2. The authority boundary — locked

```
KNOWLEDGE            organizational truth                  knowledge_nodes / knowledge_facts
GOVERNANCE           legitimacy and decisions              decision_records / governance_sessions
HEBY CONVERSATION    what was said                         conversations / messages
R3A                  authorization to act                  heby_action_requests / action_permits
R3W                  prepared operational work             work_artifacts / work_artifact_revisions
```

`ARTIFACT ≠ KNOWLEDGE ≠ MESSAGE ≠ DECISION ≠ ACTION ≠ PERMIT ≠ EXECUTION.`

Artifact creation is **preparatory, not authoritative**. Heby may create one without Governance
approval, exactly as `recordActionRequest` lets anyone propose: proposing is free, and the whole
cost is paid at the approval boundary where a human and a Governance decision are both mandatory.
**Authorship is not authority.**

Enforced structurally, not by discipline —
`tests/r3w-flow/boundaries-and-firewall.ts` asserts that no R3W file contains
`knowledgeNodes`, `knowledgeFacts`, `decisionRecords`, `governanceSessions`, `actionPermits`,
`hebyActionRequests`, `auditLog`, `resolveGovernanceAuthority`, `recordActionRequest`,
`consumeActionPermit`, or any Knowledge/Governance schema import.

The one deliberate exception is documented and asserted: `resolveGovernanceDbOrNull` **is**
imported — it is the repository's shared "control-plane database, or an honest null" helper, named
for the phase that introduced it. It resolves a *connection* and answers no authority question, and
the test proves the writer never names `resolveGovernanceAuthority`.

---

## 3. `documents` stays dead — Gate A verdict re-proved

`documents(id, tenant_id, title, category, storage_path, …)` has **no content column at all**;
its own header says the binary lives in Supabase Storage. It is upload/file metadata for an
ingestion pipeline that does not exist, with zero consumers anywhere in the repository.

R3W did not reuse it, rename it, add content to it, or turn `storage_path` into artifact content.
A firewall test asserts no R3W file mentions it, that it still has zero consumers, and that R3W
introduced no blob pointer of its own. It remains R4's to claim.

The seven orchestration modules (`workflow`, `task`, `plan`, `goal`, `mission`, `execution`,
`command`) are likewise asserted to still have **zero consumers**.

---

## 4. The model

**`work_artifacts`** — mutable identity (`tenantColumns`)

| column | note |
|---|---|
| `artifact_type` | closed enum: `operational-plan`, `message-draft` |
| `title` | non-empty, CHECK-enforced |
| `artifact_lifecycle_status` | `draft` \| `retired` |
| `owner_workspace` | mirrors `heby_action_requests.owner_workspace`; **no eighth workspace** |
| `current_revision` | a POINTER, never content |
| unique `(tenant_id, id)` | required so the revision's composite FK can target it |

**`work_artifact_revisions`** — immutable, **deliberately not `tenantColumns`**

`tenantColumns` models a mutable row: version counter, `updatedAt`/`updatedBy`, soft delete. A
revision has none of those. The established precedent is `audit_log`, and `heby_answer_evidence_item`
follows it for the same reason.

| column | note |
|---|---|
| `revision_no` | 1-based, `>= 1` CHECK, unique per `(tenant_id, artifact_id)` |
| `content` | stored VERBATIM |
| `content_digest` | `char(64)`, CHECK `^[0-9a-f]{64}$` |
| `authored_by_actor_type` / `_id` | canonical S2 polymorphic pair |
| `source_message_id` | nullable; composite FK to `messages(id, tenant_id)` |

Tenant isolation is **structural**: `(tenant_id, artifact_id) → work_artifacts(tenant_id, id)` and
`(source_message_id, tenant_id) → messages(id, tenant_id)` make cross-tenant attachment impossible
even with a hand-crafted insert.

### What was dropped from Gate A's proposal, and why

- **`superseded` as an artifact state.** Supersession is a relationship *between revisions* of one
  artifact, derivable from `current_revision`. An artifact-level `superseded` would need a forked
  identity and a `supersedes_artifact_id` pointer, and no consumer needs either. Two states, not three.
- **`source_conversation_id` on the artifact.** Derivable by joining revision 1's
  `source_message_id → messages.conversation_id`. Adding it would also have required a new unique
  index on `conversations`, i.e. touching a table this phase has no business touching.
- **`source_message_id` on the artifact.** Same reason. Provenance lives on the revision, where the
  content lives.

### Deliberately forbidden, and asserted absent in the live schema

`approved`, `approved_at`, `approval_decision_id`, `ratified`, `verified`, `trusted`, `confidence`,
`trust_score`, `authoritative`, `permit_id`, `execution_state`, `published_at`, `provider`,
`credential`, `secret`, `token`, `api_key`, `model_reasoning`, `storage_path`.

---

## 5. Immutable revisions

There is **no update path for revision content**. Every "edit" is an append; revision N's bytes stay
byte-identical forever. `tests/r3w-flow/boundaries-and-firewall.ts` proves:

- exactly one module writes work artifacts at all;
- no `.update(workArtifactRevisions)` anywhere;
- no `.delete(...)` of any R3W table anywhere;
- the only UPDATE target in the whole feature is `workArtifacts` — the pointer row.

`tests/r3w-flow/artifacts-postgres.ts` proves it at runtime: after revision 2 exists, revision 1 is
re-read from Postgres and is byte-identical, and its digest still matches.

**Concurrency.** `select … for update` on the artifact row serialises revisers; the unique index
`(tenant_id, artifact_id, revision_no)` remains the structural authority. Six concurrent revisions
are exercised: no two took the same number, every success wrote exactly one row, and the pointer
ends equal to the highest revision that exists.

---

## 6. Content digest

SHA-256 over the exact stored bytes, lowercase hex. Not an HMAC (the content is shown to a human in
full; keying it would imply a confidentiality it does not have). Not `digestCanonicalAction` (that
hashes an *action identity*; one function answering two questions means every historical digest
changes meaning the first time the action format does). **Not** Heby's `actionId`, which is FNV-1a —
32-bit and non-cryptographic by its own source.

A digest is **evidence of bytes**. It is not a confidence score, not a quality measure, and says
nothing about whether the content is true.

---

## 7. Write paths

| entry point | author | note |
|---|---|---|
| `createWorkArtifact` | `human` | artifact + revision 1 in ONE transaction |
| `createWorkArtifactFromHebyPreparation` | `agent` | the preparation seam's writer |
| `reviseWorkArtifact` | `human` | append N+1 under a row lock |
| `reviseWorkArtifactFromHebyPreparation` | `agent` | same |
| `retireWorkArtifact` | — | closes revision; deletes nothing |

The author type is a **server-supplied positional argument**, never a field on the caller's input: a
caller that could name its own actor type could also claim to be a human.

The input carries content and classification only — no tenant, no actor, no authority, no lifecycle,
no revision number, no digest — and the types make those unrepresentable, exactly as
`CreateKnowledgeInput` does for Knowledge.

**Retirement is not a Governance act.** It implies no approval, no rejection, and no judgement. It
deletes nothing, and R3W decides **no retention policy** — inventing one would be deciding something
nobody has decided.

---

## 8. Provenance

A revision may name the assistant message whose text became it. Model attribution
(provider / model / transport / tokens) is **not duplicated** — R2D already annotates `messages`, and
the test proves it is reachable by join. One provenance authority, not two. A human-authored
revision simply has `source_message_id` NULL; a foreign message id is refused
(`source-message-not-found`) rather than silently dropped.

---

## 9. The Heby preparation seam

One seam, `prepareWorkArtifact`, reached through `prepareWorkArtifactAction` in the **Operations**
workspace (both artifact-referencing action tools declare `ownerWorkspace: "operations"`).

- The intent is **DECLARED** — `PREPARE_RECOMMENDATION`, one of exactly two with `prepares: true` —
  not inferred. **R3W adds no classifier anywhere**; that remains R3A.1's work, and a firewall test
  asserts no `classifyIntent` / `detectIntent` / `inferIntent` exists.
- `answerHebyModelRequest` gained a **server-only third parameter** for intent. It is not on
  `HebyModelAnswerInput`, because that is the one shape a client can supply. `askHebyAction` passes
  nothing and stays `INVESTIGATE`.
- **No parser.** The assistant's whole reply becomes the revision content, verbatim. A parser would
  be a second, silent author.
- Only **model-origin** text is stored. When the Director's kill-switch is off, or the transport
  fails, or validation withholds, the flow returns the honest deterministic answer — which for
  `PREPARE_RECOMMENDATION` is an explicit UNAVAILABLE — and preparation is **refused**
  (`no-model-answer`) rather than filing "no model runtime is connected" as prepared work.

**Normal answers stay messages, structurally.** `model-answer.server.ts` imports the artifact
**reader** and no writer at all; `heby/actions.ts` mentions work artifacts nowhere. Both asserted.
And it is exercised at runtime: an ordinary answer over the same flow, same transport, same database
leaves `work_artifacts` at zero and `messages` at two.

---

## 10. Model-output boundary

```
MODEL TEXT → work artifact content        ✔  (untrusted, advisory, verbatim)
MODEL TEXT → Knowledge                    ✘  no writer exists
MODEL TEXT → execution instruction        ✘  nothing executes content
MODEL TEXT → authority                    ✘  authorship is not authority
```

Content is stored **verbatim** under the K2 expression doctrine: a draft containing
"Ignore all previous instructions", `<script>`, `' OR 1=1 --`, `../../etc/passwd` or
`/terminal restart production` is legitimate prepared work and is not rewritten. Safety comes from
nothing executing artifact content, not from mangling it. The validation module is asserted to
contain no `replace(`, `sanitiz`, `escape(`, `encodeURI` or `stripTags`.

Rejected only when structurally broken: empty, over-length (code points, so Turkish characters cost
what they look like), or carrying control characters — C0 + DEL, with tab/newline/CR allowed in
multi-line content and banned in a single-line title.

---

## 11. Read seam and source resolution

Three reads: list the tenant's artifacts, read one exact revision, read the full history. Plus one
reference resolver. No standalone public API, no new workspace, no new navigation.

A new source class `work-artifacts` was added to `HebySourceClass` — the union is
exhaustiveness-guarded, so adding a value forces every resolver to handle it. It follows the **K1
pattern exactly**: the pure resolver holds no tenant and reports an honest `unavailable`; the server
answer flow substitutes the real tenant-scoped read. Only the **Operations** profile declares it.

Evidence identity comes only from a real read, so the response validator's existing rule —
"reject any reference the assembler did not build" — means a model can never invent
`work-artifact/<uuid>@3` and have it accepted as a citation.

Only **current revisions of non-retired artifacts** are offered as evidence, computed in SQL so a
superseded revision never enters the candidate set. `authoritative` is always `false`. An empty
tenant resolves to `unavailable`, not to an empty `resolved` — the same distinction
`toKnowledgeResolution` draws.

**Reference syntax:** `work-artifact/<uuid>@<revision-no>`, lowercase, no leading zero, no sign, no
whitespace. Exactly one spelling per revision — `…@01`, `…@+1`, `…@1 `, `WORK-ARTIFACT/…` and an
upper-case uuid all fail to parse, because four spellings of one revision would hash as four
different actions carrying four different approvals.

---

## 12. Record-ref argument validation — the Gate A hole, closed

`arguments.ts` validated a `record-ref` as a non-empty string and said in its own header that
resolution "is a capability/target concern checked in capability-gate". **Capability-gate checked
the target and never the arguments.** So `{ recipientRef: "r-1", draftRef: "d-1" }` reached
`REQUIRES_HUMAN_REVIEW` with neither value naming anything — and `recordActionRequest` accepts
exactly that state.

Two changes:

1. `evaluateCapability` now requires every **supplied** `record-ref` argument to appear in the
   assembled evidence. The rule is keyed off the declared argument **kind**, so it covers
   `draftRef`, `recipientRef`, `workflowRef`, `subjectRef`, `policyRef` and every future record-ref
   with no per-tool special case and no allow-list to forget. An absent optional ref is fine; a
   supplied one is a claim that must hold.
2. `deriveLifecycle` now checks `evidenceSufficient` **above** the human-review branch. An action
   that cannot say what it would act upon is `FAILED` — it does not get a human's attention.
   Because `recordActionRequest` accepts only `REQUIRES_HUMAN_REVIEW`, the repair reaches the
   durable authorization chain **with no change to R3A**.

Four pre-existing tests were passing arguments that named nothing (`r-1`, `d-1`, `s-1`) while
testing governance, authority and staleness. Their **fixtures** were widened so the refs are
actually backed; every assertion is unchanged. They were leaning on the hole, and now they do not.
The unbacked case is proved deliberately in `tests/r3w-flow/record-ref-and-binding.ts`.

---

## 13. Exact revision binding

An action payload carries two ordinary scalars: `draftRef` (`…@<n>`) and `draftRevisionDigest`.
R3A's `serializeCanonicalAction` hashes them without knowing what an artifact is, so
`payload_digest` — and therefore `action_permits.bound_payload_digest` — already covers both.

Proved: `bind(rev1, digest1)` differs from `bind(rev2, digest2)`, from `bind(rev1, digest2)`, and
from `bind(rev2, digest1)`; key order does not change the binding; and after revision N is appended,
revision 1 re-read from Postgres still reproduces `digest1`. The two halves are independent on
purpose — the ref alone would not notice a content swap under one revision number, the digest alone
would not notice the same bytes re-pointed at a different revision.

**R3A permit semantics were not touched.** A test asserts `canonical-payload.ts` mentions no
artifact concept and that no file in `features/action-authorization` depends on R3W.

---

## 14. Stale / superseded reference rule

| standing | readable | proposable |
|---|---|---|
| `current` | ✔ | ✔ |
| `superseded` | ✔ | ✘ |
| `retired` | ✔ | ✘ |
| `unknown-revision` | ✘ | ✘ |
| `unknown-artifact` (incl. every foreign tenant's) | ✘ | ✘ |
| `malformed-ref` | ✘ | ✘ |

**Readable ≠ proposable**, and collapsing them is how a stale approval becomes a live one.
Resolving "revision 1" always returns revision 1's bytes; it is **never** silently upgraded to the
current revision. History does not rot: supersession and retirement end proposals, not memory.

A foreign artifact resolves to `unknown-artifact`, identical to one that never existed — the refusal
must not confirm another tenant's row exists.

---

## 15. Security boundaries proved absent

No `fetch`, no HTTP client, no `child_process`, no `execFile`/`spawn`, no `fs`, no browser driver,
no mailer, no `getUserMedia`, no Computer Use — asserted across every R3W file.

**Secret boundary.** No `process.env`, no `ANTHROPIC_API_KEY`, no `apiKey`, no `bearer`, no
`createHmac`, no `encrypt`/`decrypt` anywhere in R3W. The claim is deliberately the honest half:
content is arbitrary authored text, so R3W does **not** promise it can never contain something
sensitive — only that R3W introduces no secret store, reads no credential, and never treats content
as one. A test asserts the declared non-effects make no such claim.

---

## 16. Migration

`20260816085245_r3w_durable_work_artifacts.sql` — additive only. Two enums, two tables, four foreign
keys, four indexes, four CHECK constraints. No destructive DDL, no extension, no vector/search, no
mutation of `documents`, Knowledge, Governance, R3A permit schema, or execution.

**drizzle-kit emitted the statement order wrong. Again — third time (KR5, R3A, now R3W), identical
shape.** The composite FK targeting `work_artifacts(tenant_id, id)` was emitted before the unique
index it depends on, and PostgreSQL refused it:

```
ERROR:  there is no unique constraint matching given keys for referenced table "work_artifacts"
```

**Proven on a disposable database against all 26 prior migrations before the file was touched.** The
index was hoisted above the constraint; nothing else changed. All 27 then applied clean, and the
probe database was dropped.

**NOT applied to canonical at release.** `hebun_r1` stood at 26 applied migrations with no
`work_artifact*` table when this phase closed. That was a separate Director-gated ceremony —
since performed. See §23.

---

## 17. Tests

Five new files, 376 total (371 + 5).

| file | proves |
|---|---|
| `tests/r3w-flow/artifacts-postgres.ts` | atomic creation, verbatim storage, revision immutability, reconnect durability, concurrent allocation, exact-revision resolution, fabricated/malformed/foreign refs, tenant isolation, provenance, retirement, evidence resolution, exact binding, and that nothing was approved/permitted/ratified/executed |
| `tests/r3w-flow/preparation-seam-postgres.ts` | an ordinary answer creates no artifact; explicit preparation does; revision append; deterministic fallback is never filed as work; prepared work becomes citable evidence |
| `tests/r3w-flow/boundaries-and-firewall.ts` | execution / Knowledge / Governance / immutability / secret firewalls, `documents` and orchestration still dead, minimal vocabulary, digest honesty, canonical reference, non-sanitizing validation, pure resolver honesty, R3A untouched, registry not loosened |
| `tests/r3w-flow/record-ref-and-binding.ts` | the record-ref repair (generic, fails closed, optional refs not forced, injection-shaped refs grant nothing) and exact revision binding through R3A's unchanged payload |
| `tests/r3w-flow/ambient-database-safety.ts` | that an un-injected mutating write lands in the disposable database and cannot reach canonical, proved against a hostile ambient `DATABASE_URL` (see §18.1) |

All against **disposable PostgreSQL**. No live LLM: the seam runs through the real
`generateHebyModelAnswer` and the real validator with only the network replaced.

**Nine pre-existing tests were updated**, all for the same two mechanisms working as designed:
seven migration-allowlists / counts that must name a new migration (`authentication-schema`, `g3`,
`invitation-revocation`, `knowledge-ingestion`, `kr3`, `kr4`, `kr5`, `stranded-enrollment`), one
source-class count (`heby-integration/contracts.ts`, now naming all nine classes rather than
counting them), and `heby-actions/actions.ts` fixtures as described in §12.

---

## 18. Canonical firewall

Read before and after **this phase's work**. `hebun_r1` at that time: **26 applied migrations, zero
`work_artifact*` tables**, conversations 34 / messages 124, `heby_action_requests` 0,
`action_permits` 0, `plpgsql` only. The migration ceremony that later advanced this to 27 is §23;
the business counts above were unchanged by it.

No synthetic artifact exists in canonical. No disposable database was leaked.

### 18.1 The ambient-database incident, and its structural remediation

An early run of the preparation-seam test **omitted its write-dependency injection**. The writer
fell through to `resolveGovernanceDbOrNull()` → `getControlPlaneDb()` → `process.env.DATABASE_URL`.

**The first account of this was imprecise and is corrected here.** It did not fail because the
table was missing. It failed because `DATABASE_URL` is **unset in a bare test process** —
`scripts/run-tests.mjs` forwards `process.env` and nothing loads `.env.local` — so the resolver
returned `null` and the write refused with `persistence-unavailable`. Measured, not assumed:

```
DATABASE_URL in bare test process: null          → resolveGovernanceDbOrNull() => null
DATABASE_URL=…/hebun_r1 exported                 → resolveGovernanceDbOrNull() => CANONICAL HANDLE
```

So the protection was **the variable happening to be unset**. Any shell that has sourced
`.env.local` — every `npm run dev` session — turns the same omission into a write against canonical.
That is not a safety property, and `isProtectedDatabaseName()` (which already exists) had **zero
runtime consumers**: it guarded drops only.

**Remediation, in the existing harness, with no second ownership system.** After `create database`
succeeds, `createDisposablePostgresHarness` claims `process.env.DATABASE_URL` for its own disposable
database and restores the prior value exactly in `dropDatabase()`. An omitted injection therefore
lands in the disposable database and is dropped with it. The claim is installed only behind the same
ownership proof (`created === true`) the drop gate uses.

Two second-order defects were found and fixed while doing it:

1. **The harness's own claim made its database look protected.** `isProtectedDatabaseName` read the
   live `process.env.DATABASE_URL`, which was now the disposable URL, so the drop backstop would
   have refused to clean up. It now excludes the database a live harness currently owns, and checks
   **both** the value the process started with and the live value — so neither a mis-set environment
   nor an in-flight claim can un-protect something live. The D1.1 assertion that "whatever
   `DATABASE_URL` points at is protected" still holds, unchanged.
2. **An un-injected write leaves the process singleton pool behind**, pointed wherever the ambient
   URL pointed. `dropDatabase()` terminates backends, so a surviving pool surfaces as an unhandled
   `terminating connection due to administrator command` — a teardown crash unrelated to the test.
   This was not hypothetical: the first full run after the fix failed
   `tests/k2-flow/create-and-read-postgres.ts` for exactly this reason, having passed its own
   assertions. The harness now disposes the singleton itself, scoped to a handle that actually
   claimed the URL — it created the condition, so it cleans it up.

**Regression test:** `tests/r3w-flow/ambient-database-safety.ts` runs with a **hostile ambient
value** — it points `DATABASE_URL` at canonical *before* creating the harness, because proving the
guard against an unset variable would prove nothing. It then calls `createWorkArtifact` with **no
deps argument at all** and proves the row landed in the disposable database, that canonical is
exactly as the test found it, and that the prior ambient value is restored exactly on drop.

The canonical half of that proof was originally written as absolutes — *zero `work_artifact*` tables
and 26 applied migrations* — and §23 explains why that was wrong and how it now reads.

**Invariant now structural, not disciplinary:** a mutating test cannot fall back to canonical when
its test-database dependency is omitted.

---

## 19. What Hebun may now truthfully say

- Durable work artifacts are available, tenant-scoped, and survive a restart.
- Artifacts have immutable revisions; a superseded revision stays byte-identical and readable.
- An exact revision is retrievable by a reference that names it.
- Heby can explicitly create and revise the two supported artifact types when a human asks it to.
- Artifacts are not Knowledge, are not Governance decisions, and are not executed.

## What it may NOT say

`/send` works · contacts exist · a recipient exists · publishing works · execution works · secret
storage works · R3A.1 is complete · R3B is unblocked.

---

## 20. Limitations

1. **No recipient authority.** `send-external-communication` needs `recipientRef` too, and no
   contact/person/customer substrate exists anywhere in Hebun. `users` is disproved for the role:
   it uses `rootColumns` (not tenant-scoped) with a **globally unique** email, and a row there is an
   authenticatable principal.
2. **No UI.** R3W ships server actions and read seams, not a page. There is no browser/e2e harness
   in this repository; the surface is proven at source and integration level.
3. **No retention or deletion.** Artifacts and revisions accumulate. Deciding otherwise is not this
   phase's to decide.
4. **The action payload is not yet written by production.** `recordActionRequest` still has no
   production caller — R3A said so and it is still true. The binding is proved deterministically,
   not by a live permit.
5. **Two artifact types only.** A third arrives with the consumer that needs it, through its own
   migration.
6. ~~**Canonical migration unapplied.** Separate Director-gated ceremony.~~ **Closed by §23** —
   applied to `hebun_r1` on 2026-08-16, 26 → 27. Schema only; both tables remain at 0 rows.

---

## 21. Dependency chain after R3W

```
R3A   Durable Action Authorization      ✅ released, applied to canonical
  ↓
R3W   Durable Work Artifacts            ✅ released + applied to canonical (see §23)
  ↓   draftRef now has a real, versioned, digest-bound referent
  ↓   record-ref arguments now resolve or fail
  ↓
[?]   Recipient authority               ❌ absent — the second /send prerequisite
  ↓
R3A.1 Heby Proposal Inlet               ❌ blocked until both referents exist
  ↓
R3B   First Executed Action             ❌ + secret store + adapter + receipt FK
```

## 22. Next gate

**Commit gate.** No commit, tag or push had been made when this section was written, and the
migration had not been applied to canonical. Both gates have since been passed — see §23.

---

## 23. Post-release addendum — canonical migration and regression repair

Written after the fact. Nothing above is rewritten; this section records what changed and why two
statements above had to be corrected rather than merely restated.

### 23.1 What happened, in order

1. **R3W software released.** `2259316` (runtime) and `ee338a9` (record), tagged
   `hebun-durable-work-artifacts-complete`. That tag still peels to `ee338a9` and has not moved.
2. **Canonical migration ceremony, 2026-08-16.** `20260816085245_r3w_durable_work_artifacts.sql`
   applied byte-exact from the release tag to `hebun_r1`: **26 → 27**. Non-R3W schema proven
   byte-identical before and after; every business row count unchanged; both R3W tables at **0 rows**.
3. **The release's own regression turned red.** `tests/r3w-flow/ambient-database-safety.ts` asserted
   that canonical had *zero* `work_artifact*` tables and was *still at 26 applied*. Applying the
   migration — the authorized, intended destination of that very release — made both false.

### 23.2 The doctrine this established

> A canonical-safety regression proves that **the test did not mutate canonical**. It does not
> freeze canonical forever at the state that existed when the test was authored.

The R3W release was green *because* the schema it shipped had not been used yet. That is an
environment snapshot masquerading as a safety property, and the invariant it was guarding —
*a mutating test cannot fall back to canonical when its test-database dependency is omitted* — never
needed the snapshot. When the regression failed, that invariant had in fact **passed**: the
un-injected write landed in the disposable database and canonical was untouched.

### 23.3 The repair

`captureCanonicalState()` now records migration **identity** (the ordered hash sequence — a count of
27 is satisfied by 27 of the *wrong* migrations), the `work_artifact%` table names, and artifact and
revision row counts as `number | null`, where `null` means the table is absent — a legitimate state
on **either** side of the migration. One `assert.deepEqual(after, before)` replaces both absolutes,
guarded by a non-vacuity check so an unreachable canonical cannot pass trivially.

Proven against both legitimate states on a disposable clone: **pre-R3W** (26 entries, no tables,
`null` counts) and **post-R3W** (27 entries, both tables, 0 rows). The file contains no migration
version in any assertion.

### 23.4 A second, unrelated defect surfaced by the same run

`tests/r3a-flow/authorization-postgres.ts` and `tests/r3a-flow/single-spend-concurrency.ts` pinned
`NOW` to a calendar literal and injected it as the issuance clock, while `consumeActionPermit`
adjudicates `expires_at > now()` against the **database** clock — deliberately, because a caller
that could pass its own `now` could also pass a convenient one. Two clock domains, and a literal in
one of them: a permit issued at a hard-coded 09:00Z with the default 3600s TTL stopped being
spendable at 10:00Z real time, permanently.

Repaired in the fixtures only, by reading the adjudicating clock (`select now()`) and injecting
**that**. The database-clock predicate was not relaxed, no assertion was changed, and production
source was not touched. The removed lines are exactly the two `const NOW = new Date(...)`
declarations.
