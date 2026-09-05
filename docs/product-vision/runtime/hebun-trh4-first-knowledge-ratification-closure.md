# TRH-4 — Turkish Rug House First Knowledge Ratification — CLOSED / PRODUCTION-ACCEPTED

**One Knowledge version ratified through the released Governance path** · **ZERO schema** ·
**ZERO source change** · **Production migration ledger 47, unchanged** · **Production cluster**
`7675444875863894887` / `neondb` · **Predecessor** [TRH-3](hebun-trh3-organizational-knowledge-foundation-closure.md)
at `8f84385`

**Both halves are accepted, and they were accepted by different means.** The rendered half was
accepted by the **Director**, performing the ceremony on the real authenticated production
`/knowledge` surface inside the Turkish Rug House tenant. The machine half was measured read-only
afterwards — the released `platform:preflight` seam for counts, and a separately labelled
SELECT-only path for row content. **No browser automation ran, and this record claims none.**

What is new in this closure is that a second real tenant exercised **its own Governance over its own
Knowledge** for the first time — and that the thing everyone expects ratification to do, it did not
do.

---

## What Hebun can now do that it could not

    Before:  Turkish Rug House held five durable facts and had never made a decision about any of them
    After:   one of those five carries a Governance decision by this organization's own authority
             — and it is still draft, still provisional, and still not authoritative

**The second clause is the phase.** Ratification was already a released, tested capability, and the
Hebun AI tenant had exercised it once on 2026-08-31. What TRH-4 puts on the record is that a
*second* tenant's Governance authority decided about its own Knowledge, and that the decision
changed **exactly the five columns it is contracted to change and no others**.

---

## The candidate, and why it was the right first one

| | |
|---|---|
| `fact_key` | `trh-product-offering` |
| `domain_key` | `products` |
| `scope` | `company-wide` |
| version | `1` |
| label | *Turkish Rug House ürün yelpazesi* |
| statement | *Turkish Rug House el yapımı halılar, kilimler ve minderler satmaktadır.* |

Chosen at TRH-3's closure for three reasons that still hold: it is the fact most other TRH questions
depend on; it is the **least volatile** of the five, so the first exercise of ratification is not
immediately followed by an exercise of supersession; and it is the record TRH-3's Heby Test A had
already driven end to end, so ratifying it changed **exactly one variable against an otherwise
measured baseline**.

---

## Director-rendered evidence

The Director performed the ceremony at `/knowledge#review` — the **Governance review** section,
which is the fourth section on the page and a different card from the `#records` list. The rendered
surface reported:

> Version 1 is **ratified** — this organization's Governance authority approved this exact version.
> That is an organizational status, not a claim that the statement is true.

and displayed a Governance decision, a Governance session, the ratification time, the ratifying
actor, and *"Future versions will require their own decision."*

**That screenshot is Director-rendered evidence and is not by itself durable production acceptance.**
Everything below was measured independently, and every rendered claim above is corroborated by a
column.

---

## Machine-verified durable state

### The ratified version — what changed

    ratification_decision_id   859fa797-e53e-4149-b4c0-4757db7a82b3   (was NULL)
    governance_session_id      a3c2397c-5f3f-49ca-972f-bdba762ca290   (was NULL)
    ratified_by_actor_type     human                                  (was NULL)
    ratified_by_actor_id       the Director                           (was NULL)
    ratified_at                2026-09-05T10:36:51.165Z               (was NULL)
    updated_at                 2026-09-05T10:36:51.165Z               (was 07:41:54.971)
    updated_by / _type         the Director / human

`ratified_at` matches the Director-observed ceremony time **to the millisecond**, and equals
`decision.decided_at` exactly.

### The ratified version — what did NOT change

    knowledge_lifecycle_status     draft          UNCHANGED
    knowledge_authority            provisional    UNCHANGED
    knowledge_health               unknown        UNCHANGED
    statement                      byte-identical to the authored text
    label                          byte-identical
    knowledge_version              1              UNCHANGED
    fact_version                   1              UNCHANGED
    active_knowledge_node_id       still the ratified v1 node
    supersedes_knowledge_node_id   NULL
    previous_knowledge_node_id     NULL
    deleted_at                     NULL
    base lifecycle_status          active

**No second version was created. Nothing was superseded. The statement was not edited.**

### The Governance decision

| | |
|---|---|
| id | `859fa797-e53e-4149-b4c0-4757db7a82b3` |
| tenant | Turkish Rug House |
| `decision_type` / `outcome` | `ratify` / `ratified` |
| `subject_type` / `subject_id` | `knowledge_node` / the exact v1 node |
| `bootstrap` | **false** |
| actor | `human`, the Director |
| `authority_source_actor` | `human`, the Director |
| `evidence` | `{knowledgeFactId, knowledgeVersion: 1, authorityFromBootstrapDecisionId: 7303974e…}` |
| `decided_at` | `2026-09-05T10:36:51.165Z` |
| `supersedes_decision_id` | NULL |

**The authority chain closes in a column.** `authorityFromBootstrapDecisionId` names
`7303974e-6e67-4fe9-b0f9-a111b622bb5c` — which is **TRH-1's own bootstrap decision**, the one that
established this tenant's Governance authority in a named human. The decision does not merely assert
authority; it cites the row it flows from.

The Director's justification was durably stored, in full, in Turkish, and is substantive rather than
ceremonial — it states what is being confirmed and why. **No invented or synthetic actor appears
anywhere in the chain.**

### The Governance session

A **new** session `a3c2397c-5f3f-49ca-972f-bdba762ca290`, not a reuse: TRH now holds exactly two
sessions, TRH-1's bootstrap and this one. It carries `governance_domain = knowledge-ratification`,
`decision_type = ratify`, `subject_type = knowledge_node`, `subject_id` = the exact node,
`proposer` and `authority_source` both `human` / the Director, `risk_class = medium`,
`governance_lifecycle_status = recorded`.

### Audit — exactly two rows, one transaction

| Action | Entity | Source | Authority | Result | Simulation |
|---|---|---|---|---|---|
| `governance.decision.recorded` | `governance_decision` / the decision | `governance-authority` | `membership` | `committed` | false |
| `knowledge.ratify` | `knowledge_fact` / the fact | `knowledge-workspace` | `membership` | `committed` | false |

Both `human`, both the Director, both `occurred_at 10:36:51.165` and `recorded_at 10:36:51.170`,
both carrying a request id and a session context id. The `knowledge.ratify` metadata cross-links
fact → node → version → decision → session and records `previouslyRatified: false`.

**Two authorities, two rows, one transaction.** `authority_source` is `membership` on both — the
same band that authored the fact — while the *decision authority* is separately proven by the
decision row's own bootstrap linkage. The audit records who acted; the decision records under what
authority.

### Count deltas — measured, not assumed

| | TRH-3 close | TRH-4 now | Δ |
|---|---|---|---|
| `knowledge_facts` | 5 | **5** | 0 |
| `knowledge_nodes` | 5 | **5** | 0 |
| ratified nodes | 0 | **1** | +1 |
| `audit_log` | 7 | **9** | +2 |
| `decision_records` | 1 | **2** | +1 |
| `governance_sessions` | 1 | **2** | +1 |
| migration ledger | 47 | **47** | 0 |

`platform:preflight` reconciles the audit delta independently through the sanctioned seam:
platform-wide `audit_log` **57 → 59**, and Hebun AI's own count is still 50.

---

## RATIFIED != AUTHORITATIVE — proven twice

**From code.** `ratifyKnowledgeVersion` sets exactly seven columns, and `knowledge_authority` is not
among them. No code path anywhere promotes it. The module's own contract says it in words:
*"It does NOT mean the statement is true, verified, accurate, or safe to rely on. It is an
organizational status, not an epistemic one."*

**From production.** The ratified node reads `knowledge_authority = provisional` and
`knowledge_lifecycle_status = draft` **after** ratification, with `updated_at` equal to the
ratification timestamp to the millisecond — so the row was written, and those two fields were still
not touched.

    AUTHORED      YES   — one knowledge.create row, one human, committed (TRH-3)
    RETRIEVABLE   YES   — five evidence items in each of two answers, status matched (TRH-3)
    RATIFIED      YES   — decision 859fa797…, session a3c2397c…, bound to node v1
    AUTHORITATIVE NO    — knowledge_authority is still provisional

**Lifecycle verdict: ratification does not change lifecycle.** A ratified record stays `draft`. This
is now measured in two tenants independently — Hebun AI's node, ratified 2026-08-31, reads the same.

---

## Non-effects, measured by window rather than by delta

Every table in the production schema carrying a `created_at` was swept for rows created on or after
`2026-09-05T10:00:00Z`. **Exactly three tables moved:**

    decision_records         1     ← the ratify decision
    governance_sessions      1     ← its session
    user_session_contexts    2     ← the Director's sign-in, not an effect of the ceremony

`audit_log` has no `created_at` and was measured separately: **+2**. Nothing else in the deployment
moved.

Ratification did **not**: promote authority · change lifecycle · mark the statement true, verified or
accurate · create a Knowledge version · supersede v1 · edit the statement or authorship · create
provider capability · create execution authority · create a permit · enable Computer Use · create an
agent authority · alter another tenant.

**The other four facts are untouched.** TRH ratified-node count is **1 of 5**; `trh-sales-markets`,
`trh-sourcing-sales-model`, `trh-brand-positioning` and `trh-current-business-objectives` all read
`ratified = false` with `updated_at` still at their 07:42–07:44 authoring times. **No batch
ratification occurred, and no batch path exists** — the review card is per record.

**Execution and provider surfaces, TRH:** `integrations` 0 · `integration_credentials` 0 ·
`external_recipients` 0 · `agents` 0 · `agent_mandates` 0 · `work_items` 0 · `work_artifacts` 0 ·
`departments` 0 · `role_permissions` 0 · `invitations` 0 · `membership_authorizations` 0 ·
`permissions` 0 platform-wide. The `action_authorizations` and `action_executions` tables **do not
exist in this schema at all**. `provider_connectivity_controls` holds its two deployment-wide rows
unchanged at `version 1` with `updated_at == created_at` from August.

**Cross-tenant: zero effect.** Hebun AI reads `knowledge_facts` 2 · `knowledge_nodes` 2 · ratified 1 ·
`audit_log` 50 · `decision_records` 7 · `governance_sessions` 7, and its latest node `updated_at` is
still `2026-08-31T07:38:32` — **five days before this ceremony**. Hebun AI Knowledge was not merely
reported unchanged; it is provably untouched. No other tenant's Knowledge was read, altered or
leaked; the ratification path is tenant-predicated on every read and on the binding update.

---

## Heby impact — structurally expected, NOT newly executed

**No Heby test was run for this closure, deliberately.** Asking Heby a question writes a durable
conversation, message and evidence set, and manufacturing conversational state purely to decorate a
closure would be inventing evidence. TRH's Heby state is **unchanged**: 1 conversation, 4 messages,
2 evidence sets, 10 evidence items, 22 source-evidence rows — the latest recorded at
`2026-09-05T08:07:17`, which is TRH-3's Test B, two and a half hours *before* this ceremony.

From released code, ratification changes almost nothing for Heby, and that is correct:

| | Effect |
|---|---|
| retrieval eligibility | **unchanged** — `eligibility.ts` does not filter on ratified; only `archived`/`retired` and the effective window disqualify |
| ranking | **unchanged** — no retrieval weight reads ratified |
| evidence lifecycle | **unchanged** — `toEvidenceLifecycle` switches on `knowledge_lifecycle_status`, still `draft`, still maps to `unknown` rather than `settled` |
| resolution `authoritative` flag | **still false** — computed from `authorityClass === "authoritative"`, still `provisional` |
| per-item detail | **`ratified: no` → `ratified: yes`** — the only change |

**Ratifying does not make Heby trust it more.** A repeat of TRH-3's Test A would answer the same way
and still disclose `provisional` and `draft`. Classified as **structurally expected from released
code, not newly runtime-executed in this ceremony.**

---

## Security and authority

- **Who ratified:** the human established by TRH's own bootstrap decision. `resolveGovernanceAuthority`
  authorizes only the bootstrap actor or an active delegate; TRH holds **zero** delegations, so the
  bootstrap path was the only one available and the decision row cites it.
- **Authoring band grants nothing here.** K2's owner/director band authorizes writing Knowledge; it
  does not authorize deciding about it. The page resolves the two authorities separately and says so
  on the surface.
- **The client could not have supplied the outcome.** The action accepts only `factId`,
  `knowledgeNodeId`, `observedKnowledgeVersion` and `justification`. Tenant, actor, decision id,
  session id, ratification timestamp and ratifying actor are all server-resolved or server-generated
  — the type gives them no parameter to arrive in.
- **No execution authority was created.** Ratification authorizes nothing: no permit, no provider, no
  Computer Use, no agent.
- **It does not make the statement globally true.** Organizational status, not epistemic.

### Separation of duties — a stated limitation, exercised knowingly

The Director **authored** this statement and **holds** the Governance authority, so they ratified
their own authorship. The repository permits this and records it deliberately:
`RATIFICATION_SEPARATION_OF_DUTIES` declares `authorMayRatifyOwnVersion: true` and
`enforcedByRepository: false`, with the note that no separation-of-duties rule exists anywhere in
the repository and K4 did not invent one.

**This is disclosed rather than discovered.** It was surfaced to the Director at the TRH-4 discovery
gate before the ceremony, and the ceremony proceeded as a conscious choice. Enforcing separation
later requires an explicit policy/authority phase; nothing here creates one.

### Retry and idempotency

**Not idempotent-success — it refuses.** A retry now returns `already-ratified`, caught twice: a
pre-check, and a binding `UPDATE` predicated on `ratification_decision_id IS NULL` whose zero-row
result aborts the transaction and unwinds the decision with it. **No duplicate decision, no duplicate
session, no duplicate audit row is reachable.** Production confirms the shape: one decision, one
session, two audit rows.

Reversal has no runtime. There is no un-ratify path, and a future superseding version will be
unratified again and require its own decision — which is exactly what the surface told the Director.

---

## What this does NOT prove

**It does not prove the statement is true.** Turkish Rug House says it sells handmade rugs, kilims
and cushions; Hebun records that its Governance authority approved that sentence as a version, and
holds no capability to verify it. `textOriginUnverified` is still `true` on the node.

**It does not prove anything about the other four facts**, which remain unratified by choice.

**It does not open TRH-5**, and no successor is named by number here. TRH-2 still has no durable
record; that gap is recorded in [TRH-3](hebun-trh3-organizational-knowledge-foundation-closure.md)
and is unchanged and still non-blocking.

---

## Remaining limitations

1. **Ratification currently buys little functionally.** Retrieval, ranking, eligibility, evidence
   lifecycle and the `authoritative` flag all stay put; only `ratified: yes` changes. The value is
   constitutional, not operational, and this record does not dress it up as more.
2. **No separation of duties**, as above.
3. **Route-level ratification UI acceptance remains UNPROVEN by test.** The K4 suite asserts the page
   *source text* contains `KnowledgeReviewCard`; no test renders `/knowledge` and confirms an
   eligible user sees the ceremony. The Director's rendered observation is currently the only
   evidence that it paints. This is durable test debt.
4. **Production build SHA is UNAVAILABLE** as a committed artifact. Deployment parity is inferred
   from behaviour — the ceremony wrote `source = knowledge-workspace` rows — not from a build id.
5. **The full test suite was not run.** This phase changed no source file; the repository effect is
   this document alone.

---

## The truth ladder, exact

    AUTHORED  !=  RETRIEVABLE  !=  RATIFIED  !=  AUTHORITATIVE

    trh-product-offering v1:
      AUTHORED         YES   — knowledge.create, one human, committed          (TRH-3)
      RETRIEVABLE      YES   — matched in two evidence sets, five items each   (TRH-3)
      RATIFIED         YES   — decision 859fa797…, session a3c2397c…, bound
      AUTHORITATIVE    NO    — knowledge_authority = provisional, unchanged

    DIRECTOR-RENDERED   the ceremony screen, the confirmation sentence, the chips
    MACHINE-VERIFIED    every column, row, count and non-effect above
