# Heby Durable Grounding — Closure (G6D)

**Status:** RELEASED. **One additive migration. Zero production row written.**
**Suite:** see *Test results, stated exactly* below — **not deterministically green**, and the reason is a pre-existing defect, not this phase's.
**Canonical `hebun_r1`:** ledger 31→32, 57→58 tables, new table **0 rows**.
**Production `neondb`:** ledger 31→32, 57→58 tables, new table **0 rows**, every watched business count **unchanged**.
**Provider:** DISARMED. **Model synthesis:** UNAVAILABLE.

**Classification: B — GROUNDING DURABLE / MODEL SYNTHESIS UNAVAILABLE.**

G6C let Heby read the Governance record. G6D makes what it read survive a reload — and repairs the sentence G6C left behind.

---

## The distinction this phase exists to hold

Six things, and the whole design is the refusal to let any two of them merge.

| | Owner | What it is |
|---|---|---|
| **Authoritative Governance source truth** | Governance | `decision_records`, `governance_sessions`, `roles`. The organization's constitutional record. The only thing that decides what is true. |
| **Heby historical evidence snapshot** | Heby (`heby_answer_source_evidence`) | "Answer X cited record Y, and Y was authoritative when it did." Read only to reproduce one answer. Nothing consults it to decide anything. |
| **Referenced record identity** | Governance supplies, Heby references | `record_ref` — a `decision_records.id`, a `governance_sessions.id`, a `roles.id`. **Deliberately no foreign key:** a FK would let Governance's lifecycle constrain answer history, and history must survive whatever Governance does next. |
| **Snapshot label / detail / standing** | Heby copies, at answer time | `label`, `detail`, `authoritative`. Copied because the record they describe is mutable; re-reading later would substitute today's state for the answer's. |
| **Knowledge evidence** | **KR5, unchanged** | `heby_answer_evidence_set` / `_item` keep every column and constraint they had. A CHECK refuses `source_class = 'knowledge'` in the new table, so one citation can never become two records. |
| **Provider / model authority** | **not introduced** | No writer, no credential, no configuration, no arming path. |

**No Governance authority is duplicated into Heby.** The new table holds no decision, no outcome, no actor, no authority grant — a label, a detail line, a reference and a boolean. Heby gained no ability to establish, delegate, revoke, ratify or decide anything.

## Why a new table, measured rather than assumed

KR5's tables were tested against the live database before anything was designed, and they cannot carry a Governance citation truthfully:

- `heby_answer_evidence_set_message_uidx` is **UNIQUE on `message_id`** — one set per answer, and that set means *one retrieval*. A Governance read is not a second retrieval.
- `heby_answer_evidence_item` carries **nine NOT NULL columns only Knowledge can fill**: `fact_id`, `domain_key`, `fact_key`, `scope`, `title`, `ratified`, `freshness`, `knowledge_version`, `fact_version`. A decision id in `fact_id` makes the column name a lie; relaxing them weakens Knowledge's own guarantees.

So the new table is a **sibling under the same authority**, not a second one: one writer and one reader, both inside the existing `DurableConversationRepository`, sharing its tenant requirement and its conversation-ownership gate. There is still no standalone evidence endpoint.

## The schema, and what was deliberately left out

Ten columns: `id`, `tenant_id`, `message_id`, `source_class`, `record_ref`, `label`, `detail`, `authoritative`, `ordinal`, `recorded_at`. Four constraints: PK; FK `tenant_id→companies`; composite FK `(message_id, tenant_id) → messages(id, tenant_id) ON DELETE CASCADE`; `UNIQUE (message_id, source_class, record_ref)`; and a CHECK excluding `knowledge`.

**No speculative index.** KR5 carries a `(set, ordinal)` lookup index; this table does not, because the unique index already leads with `message_id` and serves the only read that exists.

Cut on purpose: `provenance` (a property of the resolution, not the item — no replay path consumes it), `lifecycle` (every value reachable today is the constant `settled`), `content` (reaches only the model grounding context, and the model is not connected — copying an authority's statements here would start the second store this table exists to avoid), and a set row (the "cited nothing" case is already stated in the message body, which stores each unavailable source's own reason).

## Historical, not live — proved by mechanism

The test reads Governance at **one** authority holder, persists the answer, then **delegates a second authority** and re-reads: the projection now says *2 active holders*, so the sources genuinely differ. Replay is then asserted to still show *1 active holder*, and to `doesNotMatch(/2 active holders/)`.

Replay never queries current Governance. A delegation granted after an answer cannot appear inside it.

## A mixed answer stays mixed

An answer citing an authoritative Governance record beside a derived work artifact replays as two groups carrying two different standings — asserted as `new Set(...).size === 2`. Knowledge continues entirely through KR5, whose per-item `authority_class` already makes its standing derivable. Neither half is rounded to the other.

## The source-truth repair

Two sentences G6C left describing the world before it:

- `governance` said *"Governance structural vocabulary only; no live policy instances connected."* False after G6C — and this is also the resolution `withGovernance` falls back to when the real read **throws**, so a transient failure was reported as a permanent absence of connection.
- `decision-records` said *"No persisted decision records are connected."* Locally true — that class has no reader — but on `/approvals`, which declares **both** classes, it printed beside an authoritative item this organization's `decision_records` had just supplied.

The repair follows a **released precedent, not an invention**: K1 rewrote the pure resolver's Knowledge sentence when Knowledge gained a server seam, and R3W and R3R did the same. Governance is the fourth member of that family. `decision-records` now names what it actually is — decision-*preparation* material, declared only by the two workspaces that also declare the `decision-preparation` capability — and disowns the collision explicitly. It gained no reader.

Both sentences are printed **into the answer body**, and `persistExchange` stores that body as the assistant message, so the false claim was reaching production prose and durable rows. Its absence is asserted the same way.

## Migration ceremony

`20260819133901_g6d_answer_source_evidence.sql`, renamed from drizzle's generated `brown_zemo` to repository convention with **content sha256 unchanged** by the rename.

**sha256 `73d355e7c3d08e6370effe6d6d1c8658e258afab8b35d72c95466b325608068a`** — recorded identically in the disposable rehearsal, in canonical and in production.

Four statements: one `CREATE TABLE`, two `ALTER TABLE ADD CONSTRAINT` (both on the new table), one `CREATE UNIQUE INDEX`. **Zero DROP. Zero statement touching KR5.** No existing `.sql` modified; the journal diff is 7 insertions and 0 deletions. The composite FK's target, `messages_id_tenant_uidx`, was verified present in canonical and production *before* applying.

Rehearsed twice on disposable databases from empty (`applied=32`, never the `applied=0` signature of a rolled-back ledger), then canonical, then production. After both applications the canonical and production **full public column-signature md5 is identical: `cae1aabd3ffdaa68697690b518a8aa7a`**.

The release ledger digest moved `212559d177d44b3f15aeaa0df78e6799` → `ca91a1fbc555e92c94e38e105b34a2a8` on **both** deployments — re-proving G4's measurement at a new release: the ledger identifies a RELEASE, never a deployment.

## Production, exactly

One mutation: the additive table. **Zero rows.** No seed, no fixture, **no backfill.** The three answers this production already holds were produced before the writer existed; inventing citations for them would be fabricated history, so they were left untouched.

Every watched count identical before and after: `governance_sessions` 2 · `decision_records` 2 · `audit_log` 3 · `roles` 2 · `memberships` 1 · `users` 1 · `companies` 1 · `conversations` 3 · `messages` 6 · `heby_answer_evidence_set` 2 · `heby_answer_evidence_item` 0 · `permissions` 0 · `role_permissions` 0 · `providers` 0 · `provider_connectivity_controls` 0 · `executions` 0 · `action_permits` 0 · `action_execution_attempts` 0 · `knowledge_nodes` 0 · `knowledge_facts` 0 · `knowledge_edges` 0.

## Firewalls

Governance writer reachability from Heby's entry points: **0 → 0**, measured independently of the suite by walking the real import graph (592 and 601 modules) against 14 writer symbols. Provider-control writers in `src/`: **0 → 0**; `setDirectorEnabled` still does not exist anywhere. Production carries **zero** `HEBUN_MODEL_*` and `ANTHROPIC_*` variables. Execution and Computer Use boundaries untouched and unconnected.

## Bite-proofs — twelve attacks, twelve verdicts

`A` evidence-write tenant predicate · `B` evidence-read tenant predicate · `C` cross-conversation replay · `D` client tenant id · `E` client authoritative flag · `F` drop Governance from replay · `G` flatten authoritative to derived · `H` Governance writer into the evidence path · `I` provider-control writer · `J` restore the false source-class wording · `K` fabricated `record_ref` · `L` foreign message id honoured by the writer — **all BIT.**

Every mutation was verified to apply and to change behaviour, and every file restored **sha256-identical**.

**Three attempts produced NO VERDICT and were corrected rather than counted:** a first `C` that appended the same id set (a no-op), a first `L` whose anchor was not unique, and a deliberate comment-only control that correctly did not bite.

**`C` is the finding worth keeping.** Removing the repository's message predicate *alone* leaks nothing — the loader's per-message grouping independently re-scopes. Two sufficient layers; the verdict required breaking both at once, and that is defence in depth rather than a redundant check.

## Test results, stated exactly

Four full-suite runs on the release tree:

**418/418 · 417/418 · 418/418 · 417/418**

The sole failure in both non-clean runs is `tests/k2-flow/create-and-read-postgres.ts`. **The repository suite is not deterministically green, and this record will not claim otherwise.**

## Known pre-existing limitation — the K2 concurrency flake

Not repaired here, and not G6D's.

- Two concurrent `createKnowledgeFact` calls race for one fact identity. The loser is expected to report `duplicate`; intermittently it reports `unavailable`.
- Mechanism: `isUniqueViolation` recognises **only SQLSTATE `23505`**. A loser that surfaces a deadlock or serialization-failure SQLSTATE instead falls through to `status: "failed"`, which the caller maps to `unavailable`.
- **Reproduced 7/12 at pre-G6D `df15661`**, in a detached worktree at that exact commit.
- **Reproduced 4/12 on the G6D tree** — the same protocol, less frequent, not more.

It is therefore a **pre-existing released defect, not a G6D regression**. It was left alone deliberately: repairing a released concurrency classifier inside an approved authority-and-evidence phase would expand G6D beyond the scope it was granted. It deserves its own gate.

## Also still open

A non-Governance tenant member can still read the authority roster and the genesis decision — the released G2/G3 read contract, inherited and untouched. `created_by_type` is NULL beside a populated `created_by` on all six production message rows (the R5.2 both-or-neither gap). No cross-request bound on live model calls.

## What still does not exist

No provider. No credential. No model configuration in production. No live model call, and no path to arm one — the only arming writer refuses `NODE_ENV=production` and any non-local database. No execution, no Computer Use. **Model synthesis remains unavailable, by construction rather than by omission.**

Heby can now show which records an answer stood on, months later, exactly as they stood then. It still cannot change one of them.
