# SOC-ACT1 Gate 1 — `intelligence` Connected Reader Discovery

> ### ARCHITECTURE DISCOVERY
>
> **NOT ROADMAP AUTHORITY. NOT IMPLEMENTATION APPROVAL. NOT EXECUTION AUTHORITY.**
>
> Nothing here is built, scheduled or approved. No source class is added, no reader written, no
> capability granted. The workspace-ownership / confused-deputy control (Gate 2) was **not touched**
> and is out of scope for this task.
>
> **Baseline:** branch `main`, `HEAD == origin/main == ls-remote ==
> 20eddf10975e0d76cfc434e5bebea3a0ee9175f4`, 0 ahead / 0 behind, staging empty, single worktree.
>
> Prior derived documents were treated as **references, not authority**. Every measurement below was
> re-taken from released source — and doing so **falsified the premise of this task** (§0).

---

## 0. VERDICT: BLOCKED — SOURCE SEMANTICS GAP

**The `intelligence` source class should not gain a reader for Social Intelligence evidence.**

The task asked *how* the existing `intelligence` class should be connected. Measuring it answers a
different question: **it should not be**, because the class is already chartered for something else.

| Evidence | Finding |
|---|---|
| `workspace-registry.ts:208-220` | The `intelligence` workspace declares `authority: "advisory-only"` and capabilities `intelligence-analysis` + `evidence-tracing`, **both `contract-only`** |
| Its `mayExplain` lines | *"Explain this candidate or assessment." · "Compare these hypotheses." · "Trace the evidence and summarize the uncertainty."* |
| `heby-work-source.server.ts` | The rule every class since `work-artifacts` has used: **a different authority owner earns a different class** — and `SourceResolution.authoritative` is ONE boolean per class, so *"a class cannot assert one standing and cite under another"* |

A provider observation is a **recorded fact about what a provider said**, owned by Provider
Observation History. It is not a candidate, an assessment, or a hypothesis, and it is not advisory.
Routing it through `intelligence` would redefine a broad, chartered-but-unbuilt class to mean one
specific new thing, and would force an advisory-only class to carry non-advisory recorded facts.

**This is a semantics gap, not a wiring gap.** It cannot be closed by writing a reader.

---

## A correction I owe, having now made it twice

This point has moved twice across three documents. The measured position is the third one.

| Document | Claim | Status |
|---|---|---|
| `…FUTURE-PRODUCT-DESIGN.md` | a social class would be "the 21st" | **Closest to right, for the wrong reason** — it argued no class *covers* observations |
| `…GOVERNED-ACTION-LOOP-DESIGN.md` | one blocker: no class covers provider observations | Incomplete — missed Gate 2 entirely |
| `SOC-ACT1-IMPLEMENTATION-READINESS.md` | *"The gap is not a missing 21st class — it is a missing **connected reader** for a class that is already declared."* | **Wrong.** It read the class's *name* and not its *charter* |

The readiness document's correction was itself an error: `intelligence` exists as a **string in a
union**, but its charter, its authority standing (`advisory-only`) and its declared capabilities
(`contract-only`) all belong to a different product. Sharing a word is not sharing a meaning.

**None of those documents is edited here.** All three are committed and pushed; correcting them is
its own reviewed change. Recorded so the drift is auditable rather than quietly repaired.

---

## 1. Heby source architecture, re-measured

**Counts re-taken at this baseline, not carried forward:**

- `HEBY_SOURCE_CLASSES` — **20** entries.
- `resolveSource` — **20** case branches, one per class. Pure, deterministic, holds no tenant.
- Server-substituted readers — **15** (`resolveDirectorEnabled` is a 16th dep but is
  `() => Promise<boolean>`, not a source class).

**A refinement to the earlier "16 of 20 substituted" phrasing:** 15 classes are *server-substituted*;
`platform` and `operations` resolve from the Executive Overview inside the pure resolver, with
`operations` additionally substitutable. Four classes have **no data path at all**: `memory`,
**`intelligence`**, `workforce`, `external-recipients`.

### The mental model, as released code expresses it

```
SOURCE CLASS   a NAME in a closed union + a charter. Declares nothing about data
READER         (tenant: TenantContext) => Promise<SourceResolution>, owned by the AUTHORITY
AUTHORITY      owns the facts, the writers, and the standing
DATA STORE     the table the authority owns
```

**"Connected reader" has one exact meaning here:** an optional dep on `HebyModelAnswerDeps` of shape
`(tenant: TenantContext) => Promise<SourceResolution>`, defaulted to a real implementation, and
substituted into the pure resolver's answer for that one class. The pattern is uniform across all 15:

```ts
if (!resolutions.some((r) => r.sourceClass === "integrations")) return resolutions;
try {
  const resolver = deps.resolveIntegrations ?? readIntegrationGroundingSource;
  const integrations = await resolver(tenant);
  return resolutions.map((r) => (r.sourceClass === "integrations" ? integrations : r));
} catch {
  return resolutions;          // a read failure degrades to the pure resolution
}
```

### The reader lives with the authority, never with Heby

Verified for every one:

| Reader | Owning module |
|---|---|
| `readIntegrationGroundingSource` | `integration-authority/heby-integration-source.server.ts` |
| `readOrganizationGroundingSource` | `organization-authority/heby-organization-source.server.ts` |
| `readWorkGroundingSource` | `organizational-work/heby-work-source.server.ts` |
| `readPeopleGroundingSource` | `auth-runtime/heby-people-source.server.ts` |
| `readAgentGroundingSource` | `agent-outcome-observation/heby-agent-source.server.ts` |
| `readAgentMandateGroundingSource` | `agent-mandate/heby-mandate-source.server.ts` |
| `readRecordedActGroundingSource` | `governance-activity/heby-recorded-act-source.server.ts` |
| `readActWindowGroundingSource` | `governance-activity/heby-act-window-source.server.ts` |
| `readKnowledgeCoverageGroundingSource` | `knowledge/heby-knowledge-coverage-source.server.ts` |
| `readPlacementGroundingSource` | `organization-authority/heby-placement-source.server.ts` |
| `readDecisionHorizonGroundingSource` | `decision-horizon/heby-decision-horizon-source.server.ts` |
| `resolveWorkArtifactSource` | `work-artifacts/work-artifact-evidence.server.ts` |

The convention is stated in the work reader's own header: *"a projection belongs to the authority
that owns the facts, and the consumer imports the projection."* Heby therefore holds no table handle
and — the part the header emphasises — **no writer** for any of these.

---

## 2. Who owns Social Intelligence evidence

**Answer: A — the provider observation.** Not the comparison, not the view model.

| Layer | Durable? | Authority | Suitable anchor? |
|---|---|---|---|
| `provider_observations` row | **Yes** | Provider Observation History | **Yes — narrowest authoritative anchor** |
| Measurement series (IG-AN1 / YT-SOC1) | No — pure derivation | Social Intelligence | No |
| Comparison (IG-AN2 / YT-SOC2) | No — pure derivation | Social Intelligence | No |
| Dashboard view model | No | Social Intelligence | **Never** — a derived UI model must not become authority |

`StoredProviderObservation` carries `observationId`, `providerKey`, `capabilityKey`, `subjectKind`,
`subjectRef`, `observedAt`, `recordedAt` and `provenance`. That is a complete, durable identity.

**`integrations` cannot host this either.** Its reader states plainly: *"IT READS NO PROVIDER RECORD.
There is no Drive file here, no repository, no pull request."* Connection state and provider records
are deliberately different classes.

---

## 3. The record reference — expressible, but not yet resolvable

**Format** — the repository's convention is `prefix/uuid` with a validating parser
(`formatOrganizationRef` throws on a non-uuid; a matching parser returns `null` for anything not
exactly one canonical reference). A provider observation reference follows it directly:

```
provider-observation/<observationId uuid>
```

One observation id is sufficient as the **anchor**. A comparison needs two, and they are recoverable
without storing them (see §5).

### The gap this discovery found

`ProviderObservationQuery` accepts exactly `providerKey`, `capabilityKey`, `subjectRef`, `limit`.
**There is no `observationId` predicate.** So the released seam cannot look up the very row a
reference names.

Two honest options, neither requiring schema:

| Option | Assessment |
|---|---|
| **(a) Bounded-window match** — read `provider+capability+limit`, match `observationId` in memory | No seam change. But an observation older than the window becomes unresolvable, which must then be an honest "cannot resolve", not a silent miss |
| **(b) Add `observationId?` to the query** — one additive predicate on a released read seam | Exact lookup, no schema, no migration, tenant predicate untouched. Wider blast radius: it changes a released authority's contract |

**This is not decided here.** It is recorded as the concrete shape of the work.

---

## 4. Reader ownership

**Option C, with a correction to how the task framed it.**

| Option | Verdict |
|---|---|
| A · Heby reads `provider_observations` directly | **Refuse.** Heby would become the observation authority |
| B · Heby calls a Social Intelligence read seam | **Refuse.** Social Intelligence owns no facts — it is a consumer (spec §3). It cannot project an authority it does not hold |
| **C · The owning authority exposes a narrow grounding projection** | **Correct** — and the owner is **Provider Observation History**, not Social Intelligence |
| D · Another reader already solves it | No |

**The task's phrasing said "Social Intelligence exposes a new narrow evidence-resolution seam".
Measured, that is the wrong owner.** Every one of the 12 released readers lives with the authority
that owns the facts. Social Intelligence owns none — its own specification says it "can create no
evidence of its own". Placing the projection there would make a consumer speak for an authority.

| | |
|---|---|
| **Owner** | Provider Observation History |
| **Caller** | Heby, via a `HebyModelAnswerDeps` substitution |
| **Input** | `TenantContext` (server), optional reference |
| **Output** | `SourceResolution` — `authoritative: true` (a stored observation *is* a recorded fact) |
| **Tenant source** | `TenantContext` only; unconditional predicate at the seam |
| **Fail-closed** | unresolvable tenant · unreadable persistence · unresolvable reference · malformed ref |

---

## 5. Derived evidence semantics

**Option 2: raw observations, plus deterministic recalculation. No new persistence.**

Given `followers 56 → 56`, the three truth classes stay separate by construction:

| Class | Value | Where it lives |
|---|---|---|
| **PROVIDER REPORTED** | `56` and `56` | the two `provider_observations` rows |
| **HEBUN OBSERVED** | the two `observedAt` instants | the same rows |
| **HEBUN CALCULATED** | change `0` | recomputed by the released pure derivation |

The evidence anchors the **observations**. The comparison is re-derived by IG-AN2 / YT-SOC2, which are
pure — so the calculated value is reproducible from the anchors and never has to be stored, copied,
or trusted from a client.

**Zero stays a real number.** `0` is the answer, not an absence — the released comparison already
enforces this, and nothing here weakens it.

Explicitly not done: no durable comparison artifact, no UI-calculated value made authoritative, no
inference or recommendation semantics, no observation copied into another store.

---

## 6. Tenant and security contract

The strongest existing control is already in place, and it is structural:

> *"THE TENANT PREDICATE IS NOT OPTIONAL AND IS NOT A FILTER A CALLER SUPPLIES. It comes from the
> authorized context, and there is no argument that could widen it — which is what makes a
> cross-tenant read unrepresentable at this seam rather than merely unlikely."*

| Threat | Protection | Status |
|---|---|---|
| Cross-tenant recordRef | unconditional tenant predicate — a foreign row is simply not returned | **Existing, structural** |
| Forged observation id | resolution is a server read; a ref that resolves to nothing fails closed | **Existing**, given the reader is written to fail closed |
| Client-supplied tenant | `TenantContext` only; no argument can widen it | **Existing, structural** |
| Client-supplied metric values | evidence anchors ids, never values | **By design — must be preserved** |
| Stale observation | `observedAt` travels with the evidence; freshness is Heby's existing concern | **Existing** |
| Deleted / unavailable observation | fails closed as unresolvable | **Requires the reader to say so honestly** |
| Wrong capabilityKey | capability is part of the read; vocabularies differ per capability | **Existing** — this exact ambiguity caused a live production defect and the predicate exists because of it |
| Provider mismatch | `providerKey` predicate | **Existing** |
| Source-class mismatch | substitution replaces exactly one class | **Existing** |
| Replay | a read is idempotent and writes nothing | **Not applicable** |
| Information disclosure | no credential on this path; internal ids must not reach the screen (spec §13) | **Existing + a UI obligation** |
| Unauthorized historical access | bounded by the tenant predicate; window bound per §3 | **Existing** |

**No new security gap was found.** The one thing a reader must add is honest failure: an
unresolvable reference must be reported as unresolvable, never skipped silently.

---

## 7. Substitution-pattern compatibility

The extension point is real, uniform, and additive. Adding a class means: one entry in the union, one
`case` in the pure resolver, one optional dep, one substitution block, one reader in the owning
authority. **No existing class is touched, and no source boundary is bypassed.**

Compared against three existing classes:

| Class | Why it is a separate class | Parallel to a provider-observation class |
|---|---|---|
| `work` | different authority owner (Organizational Work); a recorded commitment, `authoritative: true` | **Same shape** — different owner, recorded fact, authoritative |
| `integrations` | Integration Authority; connection state, explicitly **no provider records** | **Adjacent and deliberately disjoint** |
| `work-artifacts` | R3W; prepared content, `authoritative: false` because a draft is not organizational truth | **Contrasts** — an observation is not a draft |

**Was `intelligence` deliberately excluded?** The repository says so in passing, in
`workspace-registry.ts`: *"And `intelligence` has no connected reader."* — written while explaining
which classes could carry work. It is a recorded fact about the class, not an oversight.

---

## 8. Scope of `intelligence` — semantic verdict

**Chartered, unbuilt, and for a different product.** Not a placeholder to be claimed.

Making it mean "Social Intelligence provider observations" would:

1. narrow a broad class to one concrete meaning, pre-empting the Intelligence workspace it was
   chartered for;
2. force an `advisory-only` workspace's class to carry non-advisory recorded facts;
3. collapse two authority owners into one class, against the rule every class since `work-artifacts`
   has followed;
4. make `authoritative` — one boolean for the whole class — unanswerable, since analysis candidates
   and provider observations do not share a standing.

**A new source class is the honest answer.** It is not proposed or approved here.

---

## 9. Command handoff compatibility

**Conceptually sufficient, and Gate 2 remains untouched.**

```
Social Intelligence   renders the comparison; owns nothing
   ↓                  the human carries an evidence reference
Command /director/work the request ORIGINATES here — requestingWorkspace = "command", honestly
   ↓
prepareAction → recordActionRequest → /approvals → human permit → GIA-1 → Work Authority
```

Because the request originates in Command, `requestingWorkspace === tool.ownerWorkspace` holds and
the confused-deputy gate is satisfied **without being modified**. No permit is minted outside
Governance, no work is created directly, and Social Intelligence wields no Command tool.

**The next blocker after Gate 1** — not solved here: the released record-work proposal builds its own
evidence internally (the organization row it just read) and accepts **no caller-supplied evidence**.
Carrying a social observation reference into that proposal is therefore a further, separate change to
Command's path.

---

## 10. Persistence / capability matrix

| Question | Answer |
|---|---|
| NEW TABLE REQUIRED | **NO** |
| SCHEMA CHANGE REQUIRED | **NO** |
| MIGRATION REQUIRED | **NO** |
| NEW OBSERVATION FIELD REQUIRED | **NO** — `observationId` already exists |
| NEW EVIDENCE FIELD REQUIRED | **NO** — `{sourceClass, recordRef, lifecycle}` suffices |
| **NEW SOURCE CLASS REQUIRED** | **YES** — see §8 |
| NEW SOURCE READER REQUIRED | **YES** — one, in the owning authority |
| NEW SOURCE RESOLUTION BRANCH REQUIRED | **YES** — one `case` + one substitution block |
| NEW PROVIDER CAPABILITY REQUIRED | **NO** |
| NEW PROVIDER SCOPE REQUIRED | **NO** |
| NEW GOVERNANCE AUTHORITY REQUIRED | **NO** |
| NEW WORK AUTHORITY REQUIRED | **NO** |
| WORKSPACE-GATE CHANGE REQUIRED | **NO** — and must not happen |
| *(additional)* READ-SEAM PREDICATE | **UNDECIDED** — §3 option (a) or (b) |

### Why NEW SOURCE CLASS flipped to YES

The readiness review answered NO on the belief that `intelligence` could be connected. §8 shows the
class is chartered for an advisory analysis product with a different authority owner. The flip is a
correction of that belief, not a change in the architecture.

---

## 11. Test contract

| # | Test | Class |
|---|---|---|
| 1 | Valid same-tenant evidence resolves | INTEGRATION |
| 2 | Tenant comes from trusted server context | BOUNDARY |
| 3 | Client tenant spoof ignored | SECURITY |
| 4 | Cross-tenant reference fails closed | SECURITY |
| 5 | Missing observation fails closed | BOUNDARY |
| 6 | Malformed recordRef fails closed | PURE |
| 7 | Wrong capability fails closed | BOUNDARY |
| 8 | Wrong provider fails closed | BOUNDARY |
| 9 | Source class is the new class, never `intelligence` | FIREWALL |
| 10 | No provider network call occurs | FIREWALL |
| 11 | No Knowledge write occurs | FIREWALL |
| 12 | No observation write occurs | FIREWALL |
| 13 | No Work write occurs | FIREWALL |
| 14 | No action request created | FIREWALL |
| 15 | No Governance transition occurs | FIREWALL |
| 16 | Workspace gate unchanged | FIREWALL |
| 17 | Comparison deterministically reconstructable from anchors | PURE |
| 18 | Provider-reported values stay distinct from Hebun-calculated | PURE |
| 19 | Historical observation resolvable within the stated bound; outside it, honestly unresolvable | INTEGRATION |
| 20 | No secret, credential or internal identifier in evidence output | SECURITY |
| 21 | A read failure degrades to the pure resolution, never fabricates | BOUNDARY |

Bite-proofs per repository convention. **Never run mutation-based suites concurrently.**

---

## 12. Minimum file plan (only if the Director mints the class)

| File | Class | Why |
|---|---|---|
| `heby-integration/contracts.ts` | **MODIFY** | One union entry + one registry entry. No migration (`source_class` is `text`) |
| `heby-runtime/source-resolver.ts` | **MODIFY** | One `case` returning the honest pure default |
| `heby-answer/model-answer.server.ts` | **MODIFY** | One optional dep + one substitution block, matching the other 15 |
| `provider-observation-history/heby-observation-source.server.ts` | **CREATE** | The reader, in the authority that owns the facts |
| `provider-observation-history/observation-ref.ts` | **CREATE** | Format + parse, mirroring `organization-ref.ts` |
| `read-provider-observations.server.ts` | **MODIFY (conditional)** | Only if §3 option (b) is chosen |
| `tests/soc-act1-gate1/*` | **CREATE** | The 21 gates above |
| `capability-gate.ts`, `action-preparer.ts`, Governance, Work, provider transports | **READ ONLY** | Untouched |

Rejected: any new table; a reader inside Heby; a reader inside Social Intelligence; any UI change;
any Command, Governance or Work change.

---

## 13. SOC-ACT1 GATE 1 — PROVISIONAL CONNECTED READER CONTRACT

**Held, not issued.** Conditional on the Director minting a source class.

- **PURPOSE** — Let Heby cite a stored provider observation as evidence, so social evidence can travel to Command's governed proposal path.
- **SOURCE CLASS** — a **new** class for provider observations. **Not `intelligence`.**
- **AUTHORITATIVE EVIDENCE OWNER** — Provider Observation History.
- **READER OWNER** — Provider Observation History (`heby-observation-source.server.ts`).
- **CALLER** — Heby, via one `HebyModelAnswerDeps` substitution.
- **TRUSTED TENANT CONTEXT** — `TenantContext`; the seam's predicate is unwidenable.
- **RECORD REF FORMAT** — `provider-observation/<uuid>`, validated on format and parse.
- **READ PATH** — the released `readProviderObservations`, capability-scoped. No provider I/O.
- **DERIVATION RULE** — anchors are observations; comparisons are re-derived by the released pure modules. Nothing derived is stored.
- **OUTPUT CONTRACT** — one `SourceResolution`, `authoritative: true`, items carrying `recordRef`, label, `observedAt` detail, lifecycle.
- **FAIL-CLOSED** — unresolvable tenant · unreadable persistence · unresolvable or malformed reference · capability mismatch. A read failure degrades to the pure resolution.
- **SECURITY BOUNDARIES** — §6. No credential, no internal identifier on screen, no client-supplied values.
- **NON-CLAIMS** — resolving evidence is not a judgement; an observation is not Knowledge; a stored number is not still true; zero is a real value.
- **TEST GATES** — the 21 in §11.
- **FILE PLAN** — §12.
- **OUT OF SCOPE** — Gate 2, SOC-ACT1 itself, Command's proposal path, IG-AN3, YT-SOC3, cadence, recommendation authority, goal authority.

**THE READER DOES NOT WRITE OBSERVATIONS.**
**THE READER DOES NOT WRITE KNOWLEDGE.**
**THE READER DOES NOT CREATE ACTION REQUESTS.**
**THE READER DOES NOT AUTHORIZE ACTIONS.**
**THE READER DOES NOT CREATE WORK.**
**THE READER DOES NOT CONTACT SOCIAL PROVIDERS.**
**THE READER DOES NOT BYPASS WORKSPACE OWNERSHIP.**

---

## 14. DIRECTOR DECISION REQUIRED

> ### Should Hebun mint a new Heby source class for stored provider observations?
>
> The `intelligence` class cannot honestly carry them: it is chartered `advisory-only` for candidates
> and hypotheses, its capabilities are `contract-only`, and its authority owner is not Provider
> Observation History. Connecting it would redefine a class chartered for another product.
>
> **Yes** → Gate 1 becomes a narrow, additive extension: one union entry, one resolver case, one
> substitution block, one reader in the owning authority, one ref module, no schema, no migration,
> and the workspace gate untouched.
>
> **No** → Gate 1 stays closed and SOC-ACT1 remains blocked. Social Intelligence keeps its evidence
> on its own surface, and no social evidence reaches Heby or Command.
>
> A secondary question rides along if the answer is yes: whether `readProviderObservations` gains an
> `observationId` predicate (exact lookup, wider contract change) or the reader matches within a
> bounded window (no seam change, older observations honestly unresolvable).

**No recommendation is offered on minting the class.** It widens Heby's vocabulary of organizational
truth, and that is a product-architecture judgement rather than a technical one. The evidence needed
to make it is above.

---
---

# PART TWO — DIRECT EVIDENCE HANDOFF DISCOVERY

> **Added after the Director deferred the new Heby source class.** Part One above is preserved
> unchanged as historical evidence, including its two recorded corrections. Nothing in it is
> rewritten.
>
> **Baseline for Part Two:** `HEAD == origin/main == ls-remote == 20eddf10975e0d76cfc434e5bebea3a0ee9175f4`.
> The task brief named `13283d7` as the expected baseline; that is **one commit stale** — `20eddf1`
> is the readiness commit pushed under explicit Director authorization in the preceding task. The
> history is linear and `13283d7` is an ancestor, so this is a reconciled expectation, not an
> unexpected change.
>
> **Question:** can stored provider observation evidence enter the
> `Command → Governance → GIA-1 → Work` path **without Heby**?

---

## P2.0 VERDICT: DIRECT HANDOFF VALID WITH NARROW SEAM EXTENSION

**A HEBY CONNECTED READER IS NOT REQUIRED FOR THIS ACTION CHAIN.**

> Scope, stated precisely: this is **not** a finding that Heby is irrelevant to Social Intelligence.
> A connected reader remains exactly what Heby would need in order to *answer questions* about social
> evidence (the SOC-HEBY brief). The finding is narrower: **filing a governed action request does not
> go through Heby's source resolution**, so SOC-ACT1 does not depend on that work.

Heby's source resolver is **never imported and never called anywhere in the action path**. Evidence
is a *carried handle*, not a resolved lookup. Part One's premise — that social evidence must first
become citable through Heby's source resolution — is **false for the action chain**. It is true only
for Heby *answering questions*, which SOC-ACT1 does not need.

**This shrinks the delta substantially:** no reader, no substitution block, no `HebyModelAnswerDeps`
change, no connected class. What remains is a one-value vocabulary addition and a forced resolver
case — because the action authority's own API takes a `HebyPreparedAction`, whose evidence type is
defined in Heby's contracts module.

---

## P2.1 The authoritative chain, and where evidence enters

| # | Transition | Module · function | Owner | Write authority | Tenant source |
|---|---|---|---|---|---|
| 1 | Human initiates | `app/(dashboard)/director/work/actions.ts` · `proposeRecordWorkForGovernanceAction` | Command surface | none | server session |
| 2 | Compose proposal | `heby-action-inlet/record-work-proposal.server.ts` · `proposeRecordWorkAction` | inlet (composition) | none | passed `TenantContext` |
| 3 | **Prepare — EVIDENCE ENTERS HERE** | `heby-actions/action-preparer.ts` · `prepareAction` | Heby Actions (**pure helper**) | **none** | **none — holds no tenant** |
| 4 | File request | `action-authorization/record-action-request.server.ts` · `recordActionRequest` | Action Authorization | `heby_action_requests` | `TenantContext` |
| 5 | Decide | Governance | Governance | `decision_records` | human, DB CHECK |
| 6 | Permit | Action Authorization | Action Authorization | `action_permits` | human, DB CHECK |
| 7 | Execute | `governed-internal-action/execute-record-work.server.ts` | GIA-1 (wiring seam) | none — delegates | permit's transaction |
| 8 | Mutate | `organizational-work` · `recordWorkWithin` | Work Authority | `work_items` + audit | inherited |

**Evidence enters at step 3, inside a pure function that holds no tenant, opens no connection and
writes nothing.** It is supplied *by the caller*, as an argument.

---

## P2.2 The canonical evidence contract, measured

| # | Question | Answer |
|---|---|---|
| 1 | Canonical type | `HebyEvidenceReference` — `{ sourceClass, recordRef, lifecycle }` |
| 2 | Embedded or referenced | **Referenced.** A handle, never a copied fact |
| 3 | Supports `recordRef` | Yes — it is the identity |
| 4 | Grammar | Convention is `prefix/uuid` with a validating formatter and parser (`organization-ref.ts`) |
| 5 | Mandatory | **Yes for `CONSEQUENTIAL_MUTATION`** — `requiredEvidenceCount` returns 1 |
| 6 | Who owns references | The **source authority** that produced them |
| 7 | Who constructs evidence today | The proposal originator, from a read it just performed |
| 8 | **Can callers supply evidence** | **YES** — `prepareAction({ …, evidence: [...] })` takes it as an argument |
| 9 | Is the caller restriction A or B | **B — the shape of the released helper.** Not an architectural prohibition (see P2.3) |
| 10 | Any path using non-Heby evidence | **Yes — every one of them.** The released record-work and send proposals both build evidence from their own server reads, not from Heby resolution |
| 11 | Does Command require Heby resolution | **No** |
| 12 | Is Heby an authority here | **No — it is one evidence-resolution path, for answering questions** |

---

## P2.3 The decisive measurement: `sourceClass` is never read

Four independent findings, each from source:

1. **The resolver is never imported by the action path.** Searching `action-authorization/`,
   `heby-action-inlet/` and `heby-actions/` for `source-resolver` or `resolveSource` returns
   **nothing**.
2. **No gate reads `sourceClass`.** `isTargetValid` matches `evidence.some(e => e.recordRef === target.ref)`.
   `unbackedRecordRefArguments` matches `evidence.some(e => e.recordRef === value)`. Both compare
   **recordRef strings only**.
3. **The action authority never reads it.** `sourceClass` appears nowhere in
   `action-authorization/` except in its own decision-queue *producer* and the decision projection.
4. **The decision surface reads it as a plain `string`.** `EvidenceReferenceView.sourceClass: string`
   — not the closed union — and the projection states: *"Nothing is dereferenced, resolved or
   enriched — an entry is carried exactly as the proposal recorded it"* and *"the reference is the
   source's own handle, and this surface never dereferences it."*

5. **Released code already cites evidence under a class that has no connected reader.** The send
   proposal attaches `{ sourceClass: "external-recipients", … }`, and `external-recipients` has
   **no `resolveExternalRecipients` dep** and a pure-resolver branch that returns `unavailable`.
   That path is released and production-accepted. **This is empirical proof, not inference: a source
   class serves as action evidence without any connected reader.**

**So the closed `HebySourceClass` union constrains exactly one thing: the TypeScript shape of
`HebyEvidenceReference` in the preparer helper.** The database column is `jsonb`, the decision
surface accepts any string, and no runtime gate inspects the value.

**Helper limitation, not authority boundary.** That was the decisive distinction, and it falls on the
helper side.

---

## P2.4 Provider observation reference contract

| Property | Measured |
|---|---|
| Identity | `StoredProviderObservation.observationId` — uuid primary key |
| Uniqueness | PK, plus a unique index on `(tenant_id, provider_key, subject_ref, observed_at)` |
| Tenant ownership | `tenant_id` NOT NULL, FK to `companies` |
| Scoping facts | `providerKey`, `capabilityKey`, `subjectKind`, `subjectRef`, `observedAt`, `recordedAt`, `provenance` |
| Read contract | `readProviderObservations(tenant, { providerKey?, capabilityKey?, subjectRef?, limit? })` |
| Tenant predicate | *"NOT OPTIONAL and NOT a filter a caller supplies… a cross-tenant read is unrepresentable at this seam"* |

**Can Provider Observation History authoritatively answer "does observation X exist and belong to
this tenant?"** — **Not directly today.** There is no `observationId` predicate. It can answer it
*within a bounded window* by reading `provider+capability+limit` and matching in memory.

**Would adding `observationId?` be authority-preserving?** **Yes.** It narrows a read that is already
tenant-predicated; it cannot widen the tenant scope, because no argument can. It is additive and
touches no other caller.

- **SCHEMA CHANGE REQUIRED = NO**
- **MIGRATION REQUIRED = NO**
- **NEW PERSISTENCE REQUIRED = NO**

---

## P2.5 Why the record-work proposal builds its own evidence

Its own words: *"ONE entry, because ONE row was read a moment ago… **It is not constructed to satisfy
the evidence rule; it IS the read.**"*

**Classification: provenance enforcement, with a security consequence.** The rule is that evidence
must *be* a read the server actually performed — never a claim a caller asserts. The registry's
sibling comment names the failure it prevents: a proposal naming *"a fabricated, foreign-tenant or
retired reference put in front of the Director"*, because *"asking a human to decide about records
that do not exist is worse than refusing outright: the decision is real, durable, and about nothing."*

It is **not** convenience and **not** Heby-specific. It is the discipline any future caller must
inherit.

**Narrowest legitimate option: B — a narrowly named proposal originator** that performs the
observation read itself and constructs the evidence from that read. It preserves the rule exactly:
the server still reads, and the client still asserts nothing.

- **A** (extend the existing helper with evidence input) — rejected: it would let *any* caller pass
  unverified evidence, dissolving the rule for the released path too.
- **C** (extend the generic writer) — rejected: validation would drift away from the authority.
- **D** — none found. **E** — not prohibited; P2.3 proves it.

---

## P2.6 Human initiation

`TenantContext` comes from `resolveTenantContext()` (server session). The actor is `tenant.userId`.
Neither crosses the client boundary.

**Minimum client payload:** an observation reference **+** the requested intent (a work title).
Nothing else. The browser supplies no tenant, no actor, no authorization, no permit, no provider
fact and no Work state.

**Exactly what exists after the human's first action:** one row in `heby_action_requests` with status
`pending`.

> Not Work. Not authorized. Not executed. Not successful.

---

## P2.7 Authority firewall

| Subsystem | Stays | Proven by |
|---|---|---|
| Provider Observation History | the observation authority | the reader is a read seam; no writer is imported |
| Social Intelligence | read/composition surface | it composes a request; the **server seam** performs the read and the **authority** writes |
| Command | request/proposal authority | the request still originates in Command; `requestingWorkspace === ownerWorkspace` holds |
| Governance | consequential authorization | unchanged; human-only DB CHECK |
| GIA-1 | governed internal execution composition | unchanged; owns nothing |
| Work Authority | Work lifecycle | unchanged; only `recordWorkWithin` mutates |
| **Heby** | **not required** | its resolver is never imported by the action path |

Specifically:

- **Social Intelligence does not become an action writer** — it holds no write seam; the proposal is written by Action Authorization.
- **Command does not become an observation authority** — it cites a handle it never dereferences.
- **Governance does not become a provider-data authority** — the decision surface explicitly never dereferences evidence.
- **GIA-1 does not become an evidence authority** — it sees a permit, not evidence.
- **Work does not become an observation store** — the work row carries a title, not provider facts.

---

## P2.8 Security

| Threat | Classification |
|---|---|
| Forged `observationId` | **NEEDS NARROW EXTENSION** — the originator must re-read and refuse when the read returns nothing |
| Cross-tenant observation reference | **PROTECTED BY EXISTING AUTHORITY** — the tenant predicate is unwidenable |
| Nonexistent observation | **NEEDS NARROW EXTENSION** — same re-read |
| Wrong provider | **PROTECTED** — `providerKey` predicate |
| Wrong `capabilityKey` | **PROTECTED** — the predicate exists because its absence caused a live production defect |
| Stale evidence | **PROTECTED** — `observedAt` travels; freshness/`EXPIRED` already modelled |
| Client-forged tenant | **PROTECTED** — `TenantContext` only |
| Client-forged actor | **PROTECTED** — `tenant.userId` |
| Client-forged provider fact | **PROTECTED BY DESIGN** — evidence carries ids, never values |
| Evidence substitution after proposal | **PROTECTED** — `payload_digest` + immutable stored evidence |
| Duplicate / replayed initiation | **NEEDS NARROW EXTENSION** — the permit bounds execution replay, but duplicate *requests* are not prevented; behaviour must be explicit |
| Direct decision bypass | **PROTECTED** — human-only CHECK |
| Permit bypass | **PROTECTED** — human-only CHECK |
| Direct GIA-1 invocation | **PROTECTED** — it consumes a permit or does nothing |
| Direct Work mutation | **PROTECTED** — Work writers are not in this import graph |

**No BLOCKER.** Three items need narrow extension, and all three are satisfied by the same rule
P2.5 identified: **the server re-reads, and refuses when the read returns nothing.**

---

## P2.9 HEBY NECESSITY TEST

### HEBY NOT REQUIRED

Source proves legitimate action evidence does **not** pass through Heby's source resolver: the
resolver is never imported by the action path, no gate reads `sourceClass`, and the decision surface
carries the handle as an opaque string without dereferencing it.

**Therefore: NEW CONNECTED HEBY SOURCE CLASS REQUIRED FOR SOC-ACT1 = NO.**

**One honest residue.** `recordActionRequest` takes a `HebyPreparedAction`, whose `evidence` is typed
`HebyEvidenceReference[]`, whose `sourceClass` is the closed `HebySourceClass` union — and
`resolveSource` carries an **exhaustiveness guard** (`const never: never = sourceClass;` with the
comment *"a new source class must be handled explicitly"*). So adding a union value forces one
resolver `case`.

That is a **vocabulary addition plus a compiler-forced branch**, not a connected class: no reader, no
substitution, no `HebyModelAnswerDeps` change, no claim that Heby can answer questions about
observations.

---

## P2.10 Minimum implementation delta

| Item | Class | Note |
|---|---|---|
| Provider Observation History exact-by-id read | **EXTEND** | one optional `observationId?` predicate; no schema |
| Observation recordRef formatter/parser | **CREATE** | mirrors `organization-ref.ts` |
| Action-request evidence input | **REUSE** | `prepareAction` already accepts evidence |
| Record-work proposal originator | **CREATE** | narrowly named; performs the read itself (P2.5 option B) |
| Social Intelligence server composition | **CREATE** | resolves tenant, calls the originator |
| UI affordance | **CREATE** | one control on the comparison panel |
| Evidence source-class vocabulary | **EXTEND** | one union value + one forced resolver `case` |
| Heby reader / substitution / `model-answer` | **NOT NEEDED** | the Part One design is not required |
| Governance changes | **NOT NEEDED** | |
| Work Authority changes | **NOT NEEDED** | |
| Schema / migration | **NOT NEEDED** | |
| Tests | **CREATE** | Part One §11 plus P2.8's three extension cases |

---

## P2.11 Corrected YES / NO matrix

| Question | Answer |
|---|---|
| NEW HEBY SOURCE CLASS REQUIRED | **YES — a union VALUE only** (see below) |
| NEW HEBY READER REQUIRED | **NO** |
| HEBY RESOLVER CHANGE REQUIRED | **YES — one `case`, compiler-forced** |
| PROVIDER OBSERVATION READ-SEAM EXTENSION REQUIRED | **YES — one optional predicate** |
| OBSERVATION RECORD-REF SUPPORT REQUIRED | **YES — one small module** |
| ACTION REQUEST CONTRACT EXTENSION REQUIRED | **NO** |
| NEW ACTION REQUEST AUTHORITY REQUIRED | **NO** |
| NEW GOVERNANCE AUTHORITY REQUIRED | **NO** |
| NEW ACTION KIND REQUIRED | **NO** |
| NEW WORK AUTHORITY REQUIRED | **NO** |
| NEW DB TABLE REQUIRED | **NO** |
| SCHEMA CHANGE REQUIRED | **NO** |
| MIGRATION REQUIRED | **NO** |
| NEW PROVIDER CAPABILITY REQUIRED | **NO** |
| NEW PROVIDER SCOPE REQUIRED | **NO** |
| SOCIAL WRITE CAPABILITY REQUIRED | **NO** |
| HEBY REQUIRED | **NO** |
| AGENT REQUIRED | **NO** |
| MANDATE REQUIRED | **NO** |

### Explaining every YES

**NEW HEBY SOURCE CLASS REQUIRED — YES, but narrower than Part One's.** Only a union *value* is
needed so an evidence reference can name its source honestly. No reader, no connected path, no claim
that Heby can read observations. Precedent exists: `memory`, `intelligence`, `workforce` and
`external-recipients` are all declared **without** readers.

**HEBY RESOLVER CHANGE REQUIRED — YES, compiler-forced.** The exhaustiveness guard turns any new
union member into a required `case`. The honest branch returns `unavailable` — Heby genuinely cannot
answer questions about observations, and should say so.

**PROVIDER OBSERVATION READ-SEAM EXTENSION — YES, one optional predicate.** Without it the
originator can only match within a bounded window, leaving older observations unresolvable. Additive;
tenant scope unchanged.

**OBSERVATION RECORD-REF SUPPORT — YES.** A reference needs a canonical, validated, round-trippable
format. The repository already has the pattern.

---

## P2.12 FINAL ARCHITECTURAL VERDICT

### DIRECT HANDOFF VALID WITH NARROW SEAM EXTENSION

The canonical chain, proven from source:

```
Provider Observation History     owns the observation; server re-reads it by id
        ↓ authoritative reference, constructed from that read — never client-asserted
Social Intelligence              composes the request; owns nothing, writes nothing
        ↓ human intent + evidence reference
Command · record-work originator requestingWorkspace = "command", honestly
        ↓ prepareAction (pure) → recordActionRequest
Action Authorization             heby_action_requests, status `pending`
        ↓
Governance                       a human decides — DB-enforced
        ↓
Action Authorization             action_permits, human-authorized — DB-enforced
        ↓
GIA-1                            spends the permit inside one transaction
        ↓
Work Authority                   work_items + audit event
```

**Heby is absent from this chain**, exactly as the measurements show it already is.

**Would SOC-ACT1 be implementation-ready after these extensions?** **Yes — subject to Gate 2 and one
Director decision.** Gate 2 (workspace ownership) is satisfied *without modification* because the
request originates in Command. The remaining decision is the source-class **value**, which is a much
smaller ask than the connected class deferred in Part One.

**SOC-ACT1 is not implemented and is not approved for implementation by this document.**
