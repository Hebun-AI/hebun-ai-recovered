# A1a — Proposer Attribution Truth Correction: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `ba1025fc31591a1af8a57cfc13e0627eefb591fb`, authored 2026-08-26 23:20:21 +0300.
**Parent:** `32dbab591668f357f375b79eba1681dbaf8dbca0`.
**Tag:** none — convention **measured**, not assumed. See §9.
**Production deployment:** `dpl_7bNi2M7xJDdWXaR7Age6LUJxf39q` — target **production**, state
**READY**, `meta.githubCommitSha` = `ba1025fc31591a1af8a57cfc13e0627eefb591fb`, ref `main`, repo
`Hebun-AI/hebun-ai-recovered`.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessors:** R3A (action authorization); R3A.1 (proposal inlet).
**Acceptance unblocked by:** `hebun-ops-p1-operations-preparation-surface-closure.md` — A1a could not
be accepted in production until a human could obtain the two references `/send` requires.

> **Record provenance, stated so it cannot drift.**
> · The released diff, the sole-writer topology, the caller census, the applied DDL constraints, the
>   enum vocabulary, validation and ledger state — **independently verified** by this process against
>   the released tree.
> · Deployment identity, state and deployed SHA — **independently verified** via the Vercel API.
> · Everything under §5 — **Director-observed** in the production UI.
> · **The production row `b52ef028-28be-495d-a78f-55d0106e1a17` was NOT read.** No authoritative
>   production row-read seam exists (§6). The actor attribution below is **structurally verified
>   against the exact released sole writer**, corroborated by the Director-observed successful
>   request creation. It is **not** a direct production row measurement, and is not recorded as one.

---

## 1. What this closes

A `/send` proposal row asserted that a **machine** proposed it, and then named a **human** as that
machine. `proposed_by_actor_type` read `agent` while `proposed_by_actor_id` carried
`tenant.userId` — a human user id — and the row contradicted itself two lines later, where
`created_by_type` says `human` about the very same id.

A1a makes the attribution what the path actually is.

## 2. What shipped

Three files, `+428/−4`. The functional change is **one token**:

```
-        proposedByActorType: "agent",
+        proposedByActorType: "human",
```

The rest is the doctrine comment that explains why, plus two new test files —
`tests/a1a-flow/attribution-firewall.ts` and `tests/a1a-flow/bite-proofs.ts`.

No schema. No migration. No new column, no new value, no new authority.

## 3. Why `human` is the truthful value

`proposeSendAction` reads `input.args`. The human typed `/send`, typed the recipient reference and
typed the draft reference. The inlet states its own doctrine — *"THE MODEL DECIDES NOTHING HERE"* —
the action kind is a constant chosen because of what was typed, and nothing on the path originates
content. The firewall pins this by reading the real dispatch path rather than asserting it from
memory: both references are destructured from the arguments the human supplied, and the inlet is
forbidden to reach a classifier, an intent inference or a model-output parser.

A command parser that resolves two references a person supplied is not an actor. The person is.

## 4. `agent` is reserved, not removed

The schema deliberately leaves the door open, and A1a does not close it. Verified from the applied
migration SQL: the `actor_type` enum still admits `'human', 'agent', 'system', 'service'`, and
`proposed_by_actor_type` carries **no** `human` CHECK — unlike the approver and the authorizer
columns — precisely so a real agent may propose one day.

That day needs an agent that originates something a human did not dictate, and an authoritative id
to name it by. Neither exists. Writing `agent` before then does not prepare for that future, it
spends its meaning: the first time this column truthfully reads `agent`, it should mean something.

## 5. Production acceptance — Director-observed

Using the references OPS-P1 made obtainable, the Director submitted through Heby:

```
/send external-recipient/487c64be-e498-4a23-9efd-7664b53c0705 work-artifact/a45229f8-9776-4e7e-bbb7-9e92a7fe3a2f@1
```

Observed:

- `/send` returned a real durable request prepared for Director approval.
- **Request:** `b52ef028-28be-495d-a78f-55d0106e1a17`
- **Action:** `send-external-communication`
- The correct recipient (**Test Recipient**) and the **exact artifact revision** were resolved.
- **Status:** pending review.
- Heby stated: *"Nothing was sent. A human decides in /approvals."*
- `/approvals` displayed **one** pending consequential action, marked IRREVERSIBLE, with target
  **Test Recipient** and `draftRef` `work-artifact/a45229f8-9776-4e7e-bbb7-9e92a7fe3a2f@1`.
- **ISSUED PERMITS: none.**
- The UI states: *"Always requires human review; Heby never authorizes or executes it."*

**The Director did not click "Authorize this action".** Nothing was authorized, refused, revoked,
executed or sent — by the Director or by this process.

**A1A_PRODUCTION_ACCEPTED = YES.**

## 6. What is structurally verified, and what was not measured

**Structurally verified** from the released sole writer,
`src/features/action-authorization/record-action-request.server.ts`:

```
proposedByActorType: "human",
proposedByActorId: tenant.userId,
status: "pending",
createdBy: tenant.userId,
createdByType: "human",
```

These are **hard-coded literals with no branch, no parameter and no caller influence**. The firewall
asserts the proposer type is written in exactly one place and is not derived from any inferred
source. `recordActionRequest` has exactly one caller — the `/send` inlet — proved by walking every
file under `src/` for call sites rather than by grepping mentions. `tenant` comes from
`resolveTenantContext()`, the R1 session resolved server-side; the client never supplies identity or
tenant. `proposedByActorId` is therefore the authenticated human, and cannot be an agent identity:
no agent path reaches this writer.

**Not measured.** The row `b52ef028-28be-495d-a78f-55d0106e1a17` was never read. No script in the
repository reads `heby_action_requests`; `platform:preflight` is read-only but reports reachability,
ledger currency and vocabulary — not rows. The only remaining route would be extracting the
production database credential and connecting directly, which is neither narrow nor read-only in
character, and was not performed.

So the attribution claim rests on: **the exact released sole writer** + **the Director-observed fact
that a request was created through it**. That is strong, and it is not the same thing as reading the
row. Recording it as a direct measurement would repeat, in this document, precisely the kind of
false claim A1a exists to correct.

## 7. What preparation provably did not do

- **No permit from preparation.** `actionPermits` is inserted in exactly one place in the codebase —
  `decide-action-request.server.ts`, the decision path. The entire `/send` path performs **one**
  insert, into `hebyActionRequests`. The Director-observed "none issued" matches what the code makes
  structurally impossible.
- **No execution.** The `/send` path imports nothing from `action-execution`.
- **No provider send.** No provider module is imported on the path, and it contains no `fetch(`.
- **Human-only approval CHECK unchanged**, proved from the applied DDL, not only the schema module:
  `heby_action_requests_human_approver_chk` constrains `approved_by_actor_type` to `'human'`.
- **Human-only authorization CHECK unchanged:** `action_permits_human_authorizer_chk` constrains
  `authorized_by_actor_type` to `'human'`.
- **No agent identity, runtime or authorization created.** The writer is forbidden to reach
  `agent-runtime`, `agent-crud`, the agents schema, `principals`, `serviceAccount`,
  `GOVERNANCE_SUBJECT_TYPES` or `action-execution`, and may not become an agents-table writer.

Those CHECKs constrain the **approver** and the **authorizer**, never the proposer. Human supremacy
never depended on the field A1a changed, and was not touched by changing it.

## 8. Deferred product debt — the `/approvals` presentation problem

Recorded here because acceptance surfaced it. **It is a defect of neither A1a nor OPS-P1**, and
nothing was implemented in response.

The live `/approvals` page mixes the real consequential-action authorization queue with a much
larger structural Decisions surface. Observed sections: Actions Awaiting Authorization, Pending
Human Decisions, Decision Inspector, Human Authority Chain, Evidence & Provenance, Recommendation &
Advisory Context, Consequences, Governance & Authority Requirement, Decision History, Execution
Handoff, and workspace boundary explanations. Many display states such as `NOT CONNECTED`,
`NONE CONNECTED` and `NO TRIGGER HERE`.

The content is mostly **truthful** — it correctly reports unbuilt substrate, which is why it exists
in that form. But truthful and legible are different properties. At one pending item, the
explanatory scaffolding outweighs the decision surface, and the human's actual task — read the
target, read the draft, decide — competes with it.

**Recommendation: a separate discovery phase**, after closure, to evaluate simplifying `/approvals`
around the actual human authorization task. The constraint that phase must carry: reducing the
scaffolding must not become deleting the honesty. A surface that hides unbuilt substrate is worse
than one that over-explains it.

## 9. Release mechanics and tag decision

One commit, three paths, `+428/−4`. **Tag: none** — measured, not assumed: no commit in the
surrounding twenty carries one, and no closure commit in the current convention carries one.

## 10. Validation evidence

- **506/506** full suite green at the OPS-P1 tree that contains this change, rerun fresh; A1a's two
  suites re-run again at closure time and green.
- **12/12 A1a bite-proofs bit**, including M9 *a generic principal authority is introduced*, M10
  *Governance subject types are widened from this path*, M11 *execution becomes reachable from the
  proposal writer* and M12 *a migration is added*.
- Typecheck clean; lint 0 errors.
- Ledger **36**, asserted inside the A1a firewall itself.

## 11. Final truth ledger

| | |
|---|---|
| DESIGNED | **YES** |
| IMPLEMENTED | **YES** |
| VERIFIED | **YES** — 506/506, 12/12 bit, typecheck + lint clean |
| RELEASED | **YES** — `ba1025f…`, pushed, remote converged |
| DEPLOYED | **YES** — production READY, deployed SHA independently verified |
| PRODUCTION_ACCEPTED | **YES** — request `b52ef028…` created and pending; attribution **structurally verified**, not row-measured |

AUTHORIZED = **NO** · EXECUTED = **NO** · SENT = **NO** · PERMIT_ISSUED = **NO** ·
NEW_AUTHORITY = **NO** · NEW_PROPOSAL_PATH = **NO** · AGENT_IDENTITY_CREATED = **NO** ·
AGENT_RUNTIME_CREATED = **NO** · AGENT_AUTHORIZATION_CREATED = **NO** ·
EXECUTION_ACTIVATED = **NO** · GOVERNANCE_EXPANDED = **NO** · SCHEMA_CHANGED = **NO** ·
MIGRATION_ADDED = **NO** · LEDGER = **36**

## 12. Remaining limitations

- **The production row was not read** (§6). Structural verification plus a Director-observed
  creation is the ceiling available without a row-read seam. **A read-only production row-read seam
  does not exist and would be the honest way to close this gap.**
- **`agent` has never been written truthfully.** The reserved value is untested in production
  because no agent can propose. Reserving is not proving.
- **One tenant, one request.** Production holds a single organization and a single pending action;
  dedup, concurrency and cross-tenant isolation are proved by suite, never in production.
- **Prepared ≠ authorized ≠ executed ≠ successful.** A1a proves truthful proposal attribution only.
  Nothing here establishes that an authorized send would execute, or that an executed send would
  succeed — no execution runtime and no provider send path has ever run.

## 13. Closure boundary

A1a changed one token and no behaviour. It issued no permit, activated no execution, created no
agent identity and widened no authority; the human-supremacy constraints it is easiest to assume it
touched are exactly the ones it provably did not.

The lesson worth keeping is narrow and sharp: a column that names an actor is a **claim**, and a
claim that contradicts the column beside it is false whether or not anything downstream reads it.
The fix was not to add a mechanism. It was to stop the record from lying about who acted.
