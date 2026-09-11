# SOC-ACT1 — Implementation Readiness Review

> ### IMPLEMENTATION READINESS REVIEW
>
> **NOT ROADMAP AUTHORITY. NOT IMPLEMENTATION APPROVAL. NOT EXECUTION AUTHORITY.**
>
> No capability is granted, no provider scope requested, no authority created. SOC-ACT1 remains
> **PROVISIONAL and UNIMPLEMENTED**.
>
> **Baseline:** branch `main`, `HEAD == origin/main == ls-remote ==
> 13283d73fa487530dd82826e2065b74f48a5e2fa`, 0 ahead / 0 behind, staging empty, single worktree.
>
> Prior derived documents were treated as **references, not authority**. Every claim below was
> re-measured from released source at this baseline — and doing so **falsified two claims in the
> preceding design review** (see the correction notice).

---

## VERDICT: BLOCKED — AUTHORITY GAP

**Two independent gates block SOC-ACT1 as designed.** Neither is a missing table, a provider scope,
or a Governance shortfall. Both sit in released code that is working exactly as intended.

| # | Gate | Where | Effect |
|---|---|---|---|
| **1** | Social Intelligence evidence **cannot be cited** — the `intelligence` source class has **no connected reader** | `heby-runtime/source-resolver.ts:126` | Nothing from the observation history can legitimately become `HebyEvidenceReference` |
| **2** | **Workspace ownership is strict equality** — `intelligence ≠ command` | `heby-actions/capability-gate.ts:147` | A `record-work` request from `intelligence` yields lifecycle `RESTRICTED`; `recordActionRequest` then refuses `not-authorizable` |

Gate 2 is the serious one. Its own code calls the failure **"confused-deputy: not owned in this
context"**. It exists precisely to stop one workspace wielding another workspace's capability — which
is, stated plainly, what SOC-ACT1 was shaped to do.

---

## CORRECTION NOTICE — two claims in the preceding design review were wrong

`SOCIAL-INTELLIGENCE-GOVERNED-ACTION-LOOP-DESIGN.md` (committed `13283d7`) states:

> "**One thing blocks Social Intelligence from reaching it.** Not a table, not a capability, not a
> provider scope, not Governance: a provider observation cannot currently be *cited as evidence*,
> because `HebyEvidenceReference.sourceClass` is a closed union of 20 values and none of them covers
> provider observations."

and estimates the minimum delta as "one Heby source class … plus one pure preparer and one UI
affordance."

**Both halves are wrong, and the readiness work is what found it.**

1. **There are two blockers, not one.** That review never read
   `heby-actions/capability-gate.ts`. The workspace-ownership gate is a second, independent refusal,
   and it is a deliberate security control rather than a missing feature.
2. **The source-class framing was imprecise.** An `intelligence` source class **already exists** in
   `HEBY_SOURCE_CLASSES`. The gap is not a missing 21st class — it is a missing **connected reader**
   for a class that is already declared. That is different work, in a different module, with a
   different owner.

**This document does not modify that file.** It is committed, pushed, and derived; correcting it is
its own reviewed change, and the Director's instruction for this task was to report rather than edit.
Recorded here so the contradiction is auditable.

---

## 1. The authoritative action chain, re-measured

| Question | Answer | Proof |
|---|---|---|
| **Who may create the request?** | A human **or** a mandated agent | `recordActionRequest` inserts `{actorType:"human", actorId: tenant.userId}`; `recordAgentOriginatedActionRequest` is the agent path |
| **Who may decide?** | A human, only | `heby_action_requests_human_approver_chk` |
| **Who may mint a permit?** | A human, only — **enforced at the database** | `action_permits_human_authorizer_chk` (`authorized_by_actor_type = 'human'`) |
| **Who may execute?** | GIA-1, by spending a permit inside one transaction | `governed-internal-action/execute-record-work.server.ts` |
| **Who owns the created work?** | Organizational Work Authority | `recordWorkWithin`; inverse is `retireWork` |
| **Who owns audit?** | The owning authority, in the same transaction | work row + audit event |
| **Who owns tenant identity?** | `resolveTenantContext()` — server session | never caller-supplied |

**The released end-to-end path, as built:**

```
/director/work  (Command surface)
  → proposeRecordWorkForGovernanceAction
  → proposeRecordWorkAction            heby-action-inlet
  → prepareAction                      requestingWorkspace = RECORD_WORK_OWNER_WORKSPACE ("command")
  → recordActionRequest                requires lifecycleState === "REQUIRES_HUMAN_REVIEW"
  → /approvals                         a human decides
  → permit                             human-only, DB-enforced
  → GIA-1                              spends permit, Work Authority mutates
  → work_items + audit event
```

SOC-ACT1 must call this chain. It must not reproduce any part of it — and the measurement above shows
it currently **cannot call it from the Social Intelligence surface at all**.

---

## 2. Gate 1 — evidence cannot be cited

`CONSEQUENTIAL_MUTATION` requires **at least one** evidence reference (`requiredEvidenceCount` = 1),
and the released record-work proposal supplies it as the organization row it had just read:

```ts
evidence: [{ sourceClass: "organization", recordRef: organizationRef, lifecycle: "settled" }]
```

with the rule stated in its own comment: *"It is not constructed to satisfy the evidence rule; it IS
the read."*

Social Intelligence's evidence is a **provider observation**. `HebyEvidenceReference.sourceClass` is
`HebySourceClass` — 20 values. An `intelligence` class exists, but:

```ts
case "intelligence":
  return unavailable("intelligence", "No validated Intelligence candidates are connected.");
```

### The distinction that matters

Several classes report `unavailable` in the **pure** resolver and are substituted by a tenant-scoped
server read (`knowledge`, `integrations`, `agents`, and others follow this pattern explicitly).
Measured: **16 of the 20 classes are substituted server-side.** `intelligence`, `memory`, `workforce`
and `external-recipients` are **not** among them — and `intelligence`'s message is not the
"read tenant-scoped on the server" wording the substituted classes carry.

**So `intelligence` is declared and genuinely unconnected.** Citing it today would produce evidence
Heby's own resolver reports as unavailable.

**What would close it:** connect `intelligence` to the released provider observation history through
the same server-substitution pattern the other 16 use. That is **Heby source-resolution work**, owned
by Heby, not by Social Intelligence — and it is materially larger than "add a string to an array".

---

## 3. Gate 2 — workspace ownership (confused-deputy control)

```ts
const workspacePermitted = requestingWorkspace === tool.ownerWorkspace;
```

- `record-work`'s `ownerWorkspace` is **`"command"`**, with the registry comment: *"Command owns the
  Director's organization-wide routes, and `/director/work` is one of them. No eighth workspace is
  invented for one tool."*
- `intelligence` **is** a valid `HebyWorkspaceId` — so the request is expressible, and it is refused.

```ts
if (!cap.workspacePermitted) return "RESTRICTED"; // confused-deputy: not owned in this context
```

`recordActionRequest` then refuses anything whose lifecycle is not `REQUIRES_HUMAN_REVIEW`.

### The three ways out, and why two must be refused here

| Option | Assessment |
|---|---|
| **(a) Pass `"command"` from the Social Intelligence surface** | **Refuse.** This is precisely the confused deputy the gate names. `runtime.ts` records `"proposed from ${requestingWorkspace}"`, so it would also write a false provenance statement about where the request originated |
| **(b) Widen the gate to allow cross-workspace requests** | **Refuse at readiness.** It weakens a named security control across **every** tool, including `send-external-communication`. Not a Social Intelligence decision |
| **(c) The request originates from Command's own surface, carrying Social Intelligence evidence** | **Legitimate** — and it changes what SOC-ACT1 is. Social Intelligence would initiate a *user journey*, not a governed request |

Option (c) preserves every boundary. It also means the honest product sentence is **"take this
evidence to Work"**, not "record work from Social Intelligence" — and it still requires Gate 1 to be
closed before the evidence can travel.

---

## 4. Provenance contract (designed, not buildable yet)

The minimum payload that lets Hebun later answer *"why was this work initiated?"* **without** copying
observations into a second source of truth:

| Field | Value | Home |
|---|---|---|
| Evidence reference | `{ sourceClass, recordRef, lifecycle }` — a **reference**, never a copied fact | `heby_action_requests.evidence` (jsonb) |
| Capability scope | the capability the observation was read under | inside the ref |
| Observation instant | `observedAt` | inside the ref |
| Requested intent | the work title, in the human's words | `proposedArguments.title` |
| Scope declaration | `organization-level` or a department | `proposedArguments.departmentScope` |
| Proposer | human actor | `proposed_by_actor_type/_id` |
| Purpose | optional work item | `purpose_work_item_id` |

**The schema can already represent all of it.** `evidence` is `jsonb`; `source_class` is `text`, not a
pg enum. **NO MIGRATION.** The blocker is not persistence — it is that no legitimate `recordRef`
exists for an observation until Gate 1 closes.

Explicitly not done: no second observation store, no provider payload copied into Work metadata, no
promotion into Knowledge, no causal claim, no credential, no internal identifier on screen.

---

## 5. Human intent and authority

SOC-ACT1 can legitimately originate from a human click **without** model generation, Heby, an agent,
a mandate, or a system-actor substitution. `recordActionRequest` is the released human entry point and
bypasses the agent mandate ceiling (mandates govern agents).

Tenant identity comes from `resolveTenantContext()` — server session, never client input. The only
data that may cross the client boundary is **an evidence reference plus the requested intent**; never
client-supplied organizational truth, never a tenant, never an actor.

---

## 6. Governance ceremony — the transitions, and what stays separate

| # | Transition | Input | Owner | Write | Before → After | Authorization | Audit |
|---|---|---|---|---|---|---|---|
| 1 | Human initiates | evidence ref + title | *(seam)* | none | — | authenticated session | none |
| 2 | Prepare | typed request | Heby Actions | **none** (pure) | — | gates only | none |
| 3 | File request | prepared action | Action Authorization | `heby_action_requests` | ∅ → `pending` | human or mandated agent | request row |
| 4 | Decide | request | Governance | `decision_records` | `pending` → `approved` | **human, DB-enforced** | decision + audit |
| 5 | Mint permit | decision | Action Authorization | `action_permits` | ∅ → `active` | **human, DB-enforced** | permit issued |
| 6 | Execute | permit | GIA-1 → Work Authority | `work_items` | `active` → `consumed` | spent permit | work row + audit |

**Transitions 3 and 4 require separate human actions.** A human's intent to file a request is not that
human's authorization to execute it. No single button may span steps 3→6; the released architecture
routes the decision through `/approvals` on purpose, and this readiness review does not propose
changing that.

---

## 7. UI and server seams (specified, not built)

**UI seam — measurement comparison, not the platform card.** The comparison is where a *change* is
visible, and a change is what someone acts on. A platform card shows a level; a level is not a reason.

**UI truth vocabulary.** After a successful step 3 the surface may say only:

> **Work request filed — awaiting a decision.**

Never "Work created", never "Action completed", never "Done". Work exists only after step 6.

**Server seam.** A new narrow server composition function would be required:

| | |
|---|---|
| **Name** | `proposeWorkFromSocialEvidence` (provisional) |
| **Input** | evidence reference + title; **no tenant, no actor** |
| **Output** | typed filed/refused result — never a work item |
| **Calls** | `resolveTenantContext`, the released read seam, the record-work inlet |
| **Owns** | nothing. No table, no lifecycle, no decision, no permit |

Client code must never mint permits, decide requests, execute GIA-1, write Work, choose a tenant, or
construct an actor identity. All six are server-side and authority-owned today.

---

## 8. Specification compatibility

**Verdict: C — a real product-contract change requiring Director approval.**

| | |
|---|---|
| **Section** | `hebun-social-intelligence-specification.md` §1 and §3 |
| **Current claim** | "It is a **reading** surface over stored provider evidence. It connects nothing, authorizes nothing, and calls no provider." |
| **Under SOC-ACT1** | "connects nothing", "authorizes nothing" and "calls no provider" all remain **true**. "Reading surface" becomes **incomplete** |
| **Why it matters** | §3 lists what Social Intelligence "owns none of, ever". Initiating a governed workflow is not ownership — but the distinction must be *written*, not assumed |

**The file was not edited.** If the Director approves, §1 and §3 should be reconciled in their own
reviewed change, before implementation — not as a side effect of it.

---

## 9. Security review

| Threat | Protection | Status |
|---|---|---|
| Tenant spoofing | `resolveTenantContext()`; tenant never crosses the client boundary | **Existing** |
| Cross-tenant evidence | read seam's unconditional tenant predicate | **Existing**, but see below |
| Client-forged observation | evidence must be *the read*, re-resolved server-side | **Requires design** — the seam must re-read, never trust a client ref |
| Client-forged actor | actor is `tenant.userId`, server-side | **Existing** |
| Replay / duplicate | permit is the replay boundary (GIA-1); a duplicate **request** is not prevented | **Partial** — duplicate-request behaviour must be explicit |
| Stale evidence | `HebyEvidenceFreshness` / `EXPIRED` lifecycle | **Existing** |
| Permit bypass | DB CHECK, human-only | **Existing, structural** |
| Decision bypass | `recordActionRequest` requires `REQUIRES_HUMAN_REVIEW` | **Existing** |
| Direct Work write | Work Authority is only reachable through a spent permit on this path | **Existing** |
| Provider escalation | no write capability exists; GIA-1 firewall proves no external reach | **Existing, structural** |
| Secret leakage | no credential on this path | **Existing** |
| Audit loss | work row + audit event in one transaction | **Existing** |
| **Confused deputy** | **the workspace gate — currently blocking SOC-ACT1** | **Existing, and must not be weakened** |

**Fail-closed requirements:** unresolvable tenant, unprovable tenant-owned evidence, unauthenticated
actor, or unavailable Governance state must each refuse and write nothing.

---

## 10. Test contract

| # | Test | Class |
|---|---|---|
| 1 | Authenticated human can file the request | INTEGRATION |
| 2 | Tenant comes from trusted context | BOUNDARY |
| 3 | Client-supplied tenant ignored | BOUNDARY |
| 4 | Evidence must belong to the same tenant | BOUNDARY |
| 5 | Missing evidence fails closed | PURE |
| 6 | Cross-tenant evidence fails closed | BOUNDARY |
| 7 | No provider call occurs | FIREWALL |
| 8 | No provider write capability required | FIREWALL |
| 9 | No Knowledge write occurs | FIREWALL |
| 10 | No Work mutation before a spent permit | INTEGRATION |
| 11 | Request state is truthful (`pending`, not "created") | PURE |
| 12 | Authorization remains a separate human act | INTEGRATION |
| 13 | Permit remains human-authorized | INTEGRATION |
| 14 | Vocabulary matches canonical enums (`pending/accepted/refused/failed/unknown`; `pending/approved/rejected/withdrawn`) | PURE |
| 15 | Duplicate submission behaviour explicit | INTEGRATION |
| 16 | Provenance preserved end to end | INTEGRATION |
| 17 | Unrelated observations unchanged | INTEGRATION |
| 18 | Social Intelligence derivations remain pure | PURE |
| 19 | No universal recommendation authority introduced | FIREWALL |
| 20 | No goal authority introduced | FIREWALL |
| 21 | **Workspace gate still refuses a foreign-workspace request** | FIREWALL |
| 22 | UI never says "Work created" before step 6 | UI |

Bite-proofs per repository convention. **Never run mutation-based suites concurrently.**

---

## 11. File plan (only if both gates close)

| File | Class | Why |
|---|---|---|
| Heby source resolution for `intelligence` | **MODIFY** | Gate 1. Owned by Heby, not Social Intelligence |
| `social-intelligence/work-proposal-preparer.ts` | **CREATE** | Pure: view model → typed request. No authority |
| `social-intelligence/propose-work.server.ts` | **CREATE** | Narrow server seam; resolves tenant, re-reads evidence, calls the inlet |
| One UI affordance on the comparison panel | **MODIFY** | Smallest honest insertion point |
| `tests/soc-act1/*` | **CREATE** | The 22 gates above |
| `capability-gate.ts`, `action-registry.ts`, GIA-1, Work Authority, Governance | **READ ONLY** | Called, never reproduced |

Rejected: any new table, any second proposal path, any Social-Intelligence-owned lifecycle state.

---

## 12. Migration / capability matrix

| Question | Answer |
|---|---|
| NEW DB TABLE REQUIRED | **NO** |
| SCHEMA CHANGE REQUIRED | **NO** |
| MIGRATION REQUIRED | **NO** |
| NEW PROVIDER CAPABILITY REQUIRED | **NO** |
| NEW PROVIDER SCOPE REQUIRED | **NO** |
| NEW ACTION KIND REQUIRED | **NO** — `record-work` exists |
| NEW GOVERNANCE AUTHORITY REQUIRED | **NO** |
| NEW WORK AUTHORITY REQUIRED | **NO** |
| NEW RECOMMENDATION AUTHORITY REQUIRED | **NO** |
| NEW GOAL AUTHORITY REQUIRED | **NO** |
| HEBY REQUIRED | **YES — and this changed** |
| AGENT REQUIRED | **NO** |
| MANDATE REQUIRED | **NO** |

### Why "HEBY REQUIRED" flipped to YES

The preceding design review concluded Heby was *"not on the critical path"* because the loop is
human-driven. That remains true for **proposing** — no model, no agent, no mandate.

But the **evidence** must be a `HebyEvidenceReference` whose class has a connected reader, and source
resolution is Heby's. So SOC-ACT1 needs Heby's *source-resolution architecture* even though it needs
nothing from Heby's *conversational runtime*. The earlier review conflated the two.

Not solved here.

---

## 13. SOC-ACT1 — PROVISIONAL IMPLEMENTATION CONTRACT

**Held, not issued.** Recorded so that if the Director closes the gates, the contract is ready.

- **OBJECTIVE** — Let a human turn an observed social measurement into a governed organizational work item, with the observation cited as evidence.
- **USER ACTION** — One affordance on the measurement comparison. Provisional copy: **"File a work request from this evidence"**.
- **AUTHORITATIVE INPUT** — The released composed view model over capability-scoped stored observations. No new read, no provider call.
- **TRUSTED CONTEXT** — `resolveTenantContext()`. Tenant and actor never cross the client boundary.
- **SERVER SEAM** — `proposeWorkFromSocialEvidence` (provisional). Owns nothing.
- **ACTION AUTHORITY** — Action Authorization, via the released record-work inlet.
- **GOVERNANCE PATH** — Unchanged: `/approvals`, human decision, human-minted permit.
- **WORK AUTHORITY** — Organizational Work, through GIA-1 only.
- **PROVENANCE** — §4. References, never copies.
- **OUTPUT STATE** — A `pending` request. **Nothing else.**
- **UI TRUTH** — "Work request filed — awaiting a decision."
- **SECURITY** — §9, fail-closed on all four conditions.
- **NON-CLAIMS** — nothing published; no provider contacted; filing is not a judgement; a work item is not a goal or a plan; Hebun will not claim the work changed any measurement.
- **TEST GATES** — the 22 in §10.
- **PRODUCTION ACCEPTANCE** — One real work item via a real human decision, evidence attached, audit event present, and **zero provider requests**, proven by an unchanged observation history.
- **ROLLBACK** — `retireWork`, the declared deterministic inverse. Reversible is not erasable.
- **OUT OF SCOPE** — IG-AN3, YT-SOC3, cadence, publishing, recommendation records, goal authority, competitor intelligence, any second internal action kind.

**SOC-ACT1 DOES NOT AUTHORIZE ITSELF.**
**SOC-ACT1 DOES NOT EXECUTE PROVIDER ACTIONS.**
**SOC-ACT1 DOES NOT CREATE SOCIAL WRITE CAPABILITY.**
**SOC-ACT1 DOES NOT CREATE RECOMMENDATION AUTHORITY.**
**SOC-ACT1 DOES NOT CREATE GOAL AUTHORITY.**

---

## 14. DIRECTOR DECISION REQUIRED

> ### Where should a governed work request that rests on social evidence originate?
>
> **(a) From Command's existing `/director/work` surface**, with Social Intelligence handing evidence
> across. Preserves the confused-deputy control untouched. Social Intelligence initiates a *journey*,
> not a request. Smallest risk; weakest product story.
>
> **(b) From the Social Intelligence surface**, which requires deciding whether the workspace
> ownership gate should admit a cross-workspace request. That is a change to a released security
> control governing **every** tool — including external send — and is not a Social Intelligence
> decision.
>
> Either way, **Gate 1 must close first**: the `intelligence` source class needs a connected reader
> before any social evidence can be cited. That work is Heby's, and it is a prerequisite, not part of
> SOC-ACT1.

**Recommendation: (a).** It needs no security change, keeps every boundary intact, and still delivers
observation-backed work with full provenance. If it proves too weak in practice, (b) can be argued
later on evidence — the reverse order cannot be undone.
