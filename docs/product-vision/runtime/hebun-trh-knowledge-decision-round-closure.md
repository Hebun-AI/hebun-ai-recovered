# TRH · Pending Decision Round (2026-10-02) · Closure

The Director worked through what Turkish Rug House's decision horizon held as awaiting a human. Two
acceptance-era action requests were refused, two Knowledge versions were ratified, one Knowledge
version was superseded and its successor left undecided, and one was deliberately left untouched.
Every change went through the owning authority's existing lifecycle on its own surface. No code, no
schema, no migration, no new authority.

A follow-up round on 2026-10-03 (Knowledge Trust Phase 4) resolved the two versions left open here
and took the first public-use decisions, including one operator error. It is recorded in section 7.

```
REFUSED   != DELETED          RATIFIED != TRUE          SUPERSEDED != RATIFIED
REJECTED (Knowledge) != REMOVED FROM RETRIEVAL          RATIFIED != CLEARED FOR PUBLIC USE
```

| Item | Value |
|---|---|
| Tenant | Turkish Rug House `9947c78e-2080-4331-81c6-456cb4be7a96` |
| Deployment at the time | `61b130e7` (APPROVALS-DASHBOARD; Vercel `hebun-ai-recovered-y8t2ba0q6` as noted during the round) |
| Schema | none; ledger 69 unchanged |
| Actor | the Director (`d5b496df…`), tenant Governance authority, own production session |
| Verification | read-only SQL under `default_transaction_read_only=on`, plus the live `/approvals` and `/knowledge` surfaces during the round; every record claim re-read by read-only SQL in a final review (see "Evidence boundary" in section 4) |

How the controls were operated: the Browser pane was hidden for most of the round, so the existing
Refuse / Ratify This Version / Create New Version controls were triggered through the page's DOM
after the focused record was verified, not by pointer. The server actions called are the released
ones, under the Director's session. Each mutation had the Director's explicit approval first.

## 1 · Horizon before

| Source | Awaiting | Records |
|---|---|---|
| Action Authorization | 2 | `6720cacf…`, `c35bb211…` |
| Agent Improvement Hypothesis | 0 | table empty |
| Knowledge without a Governance decision | 4 | `f3e12fe6`, `25e3f8e3`, `acccc91e`, `1bd16815` |

## 2 · What happened

### 2.1 Two action requests refused (Action Authorization)

Both were `record-work` requests the Director filed during SOC-ACT1 production acceptance
(`hebun-social-intelligence-specification.md`, "SOC-ACT1 — production acceptance"). Neither had a
permit, an execution attempt or a work item.

| Request | Filed | Payload title | Governance decision | Refused at (UTC) |
|---|---|---|---|---|
| `6720cacf-8106-463f-b3a9-a0b280dd4666` | 2026-09-11 | "SOC-ACT1 production acceptance — 2026-09-11" | `e3c110c1-1aca-48a8-873a-7029b1f43204` | 2026-10-02 08:38:04 |
| `c35bb211-6bc1-4034-aa03-5e58a1833368` | 2026-09-16 | "Instagram etkileşim analizi" | `93839445-dfd4-4447-a17d-5677969a2ca5` | 2026-10-02 08:38:22 |

Path: `/approvals` → the request card's Refuse → `rejectActionRequestAction` → `rejectActionRequest`.
Decision type `reject`, outcome `action-refused`. Rejection reason (free text; the repository holds
no closed reason vocabulary): "Created during production acceptance; execution not wanted."

These are the first action-request rejections recorded in production. The request status enum
(`heby_action_request_status`) is `pending | approved | rejected | withdrawn`. In the repository at
`61b130e7`, the only writes of that status are `pending` (filing), `approved` (decision, or issuance
under a standing authorization) and `rejected` (decision); no code path was found that moves a
request to `withdrawn`. The enum has no cancel or expire value and no such transition exists. So
refusal is the only reachable closure for an unwanted request.

After: TRH requests 9, permits 7, execution attempts 3, work items 4 — all unchanged.

### 2.2 Two Knowledge versions ratified

| Fact | Node · version | Governance decision | Ratified at (UTC) |
|---|---|---|---|
| `trh-sales-markets` | `f3e12fe6…` · v1 | `3635b270-05bc-4b78-8ef3-d98bed0f3630` | 2026-10-02 10:13:17 |
| `trh-current-business-objectives` | `1bd16815…` · v1 | `fbf30e97-f7d7-4bed-9bb7-5655439cf709` | 2026-10-02 10:13:38 |

Path: `/knowledge` → Governance review → Ratify This Version → `ratifyKnowledgeVersionAction`.
Justifications are the Director's own words, stored on the decisions. The statements, version
numbers and `draft · provisional` labels are unchanged; ratification binds a decision to the exact
version and changes nothing else. Neither version carries a source, reference or external evidence:
both rest on the Director's authorship (`human-authored`, `textOriginUnverified: true`).

### 2.3 `trh-brand-positioning` superseded, successor undecided

| | v1 | v2 |
|---|---|---|
| Node | `acccc91e-19ae-4107-b879-544007a90ba3` | `e8c0006d-aba1-470f-a08a-24e6feb7077a` |
| Written | 2026-09-05 07:44:08 UTC | 2026-10-02 11:10:44 UTC |
| Standing | draft · provisional · unratified · no longer current | draft · provisional · unratified · current |
| Statement | "…el yapımı, koleksiyonluk ve uygun fiyatlı ürünler sunan bir marka olarak konumlandırılmaktadır." | "Turkish Rug House kendini el yapımı, koleksiyonluk ve uygun fiyatlı ürünler sunan bir marka olarak konumlandırmayı hedefler. Bu bir konumlandırma tercihidir." |

Path: `/knowledge` → Create New Version → `supersedeKnowledgeAction`. Fact `08b747d6…` moved to
fact version 2, active node v2, previous node v1; v2 records `supersedes = acccc91e…`; audit event
`knowledge.supersede`, committed. v1 was not edited, deleted or retired. No Governance decision was
written — supersession is an authoring act — and **v2 was deliberately not ratified**.

v2 states a positioning intent rather than a product fact. A usage rule ("do not assert per-product
handmade/collectible claims unless verified") was considered and left out of the statement on
purpose: see debt 2.

One consequence, recorded rather than smoothed over: the work-evidence declaration made on
2026-09-05 for "Turkish Rug House ilk sosyal medya içerik taslağını hazırla" references the *fact*,
so it now resolves to v2, although it was declared against v1's wording.

### 2.4 `trh-sourcing-sales-model` deliberately left unresolved

`25e3f8e3…` v1 is unchanged: not ratified, not rejected, not superseded. The Director accepts its
content as organizational truth. It is internal commercial information (wholesaler sourcing and
margin), and the current model cannot say "true, and not for public content" (debt 2). Ratifying
would leave the only standing signal reading "approved"; rejecting would not remove it from
retrieval (debt 1) and would record a disapproval nobody holds. It stays on the horizon as an open
decision, by choice.

## 3 · Horizon after

| Source | Before | After | Records still awaiting |
|---|---|---|---|
| Action Authorization | 2 | 0 | — |
| Agent Improvement Hypothesis | 0 | 0 | — |
| Knowledge without a Governance decision | 4 | 2 | `e8c0006d…` (brand v2), `25e3f8e3…` (sourcing v1) |

`/approvals` counters, as displayed on the surface during the round: Pending Review 4 → 2; the two
that remain are content reviews ("Turkish Rug House Instagram içerik taslağı" awaiting content
review; "Turkish Rug House — ilk Instagram içerik taslağı" changes requested). Approved 9,
Published 3, Drafts 4, Failed 0 unchanged. The records under the two remaining reviews are verified
(revision 3 of the first has no review decision; revision 2 of the second carries
`artifact-revision-changes-requested`); the displayed counters themselves were not re-read.

TRH Knowledge: 6 nodes, 5 facts; ratified versions 1 → 3 (`trh-product-offering`,
`trh-sales-markets`, `trh-current-business-objectives`). Governance decisions 37 → 41 across the
round (two `reject` on action requests, two `ratify` on Knowledge).

## 4 · What this does not prove or claim

- Ratification is an organizational status. It does not verify the statements; no evidence beyond
  the Director's authorship is recorded for any TRH fact.
- Nothing was decided in the Hebun AI tenant. Its three pending `send-external-communication`
  requests (`6531ec43…`, `499eb5d0…`, `368d793d…`, all to the test recipient) and its undecided
  `hebun-repository` fact are untouched.
- `trh-product-offering` was read, not changed.
- No enforcement, visibility field, retrieval rule or validation was added. Section 5 records gaps;
  it does not close them.

**Evidence boundary.** A final review re-read production with read-only SQL and the repository at
`61b130e7`.

- *Verified in production records:* every request, decision, node and fact id in sections 1–3 with
  its timestamp, status and outcome; the rejection reason; the supersession (fact version, active and
  previous node, `supersedes`, audit event); sourcing v1 and `trh-product-offering` unchanged; the
  record counts (requests 9, permits 7, attempts 3, work items 4, decisions 41, nodes 6, facts 5,
  ratified 3, hypotheses 0, ledger 69); the Hebun AI tenant's three pending requests and undecided
  fact; and, for debt 3, the revisions and their digests, the generating messages, the instructions,
  the evidence sets, the two publication requests with their attempts, the 2026-09-06 review, and the
  eight captions in observation `42fa186d…`.
- *Verified in the repository:* the code and document references in section 5.
- *Inferred:* the horizon "before" figures (reconstructed from the decision timestamps); that voice
  or context material shaped Instagram revision 3 and YouTube revision 1 (text match and timing —
  prompt composition is not persisted).
- *Not verified:* the Vercel deployment id, the `/approvals` counters and the way the controls were
  operated are as noted during the round, not re-read; whether any of the published claims is true.

## 5 · Remaining debt (found in this round, not fixed here)

### Debt 1 — A rejected Knowledge version stays in Heby's retrieval

- `rejectKnowledgeVersion` (`knowledge-ratification/ratify-version.server.ts`) writes only a
  Governance decision; its own header says "THIS WRITES NOTHING TO KNOWLEDGE". There is no rejected
  state on `knowledge_nodes`.
- Retrieval eligibility (`knowledge-retrieval/eligibility.ts`) excludes a record only for lifecycle
  `archived` / `retired`, or an effective window that has not opened or has closed. Neither it nor
  the Knowledge repository reads `decision_records`.
- So a version Governance declined keeps reaching the model exactly as an undecided one does
  (`ratified: no`); the two are indistinguishable in grounding. Rejection removes a version from the
  decision horizon only.
- State today: no rejected Knowledge version exists in production. The gap is latent and appears on
  the first rejection. It is also why rejecting a version "to clear the horizon" was refused in this
  round.

### Debt 2 — Organizational truth and confidentiality / public-use eligibility cannot be expressed separately

- `knowledge_nodes` has no audience, visibility, confidentiality or use-policy field.
  `knowledge_scope` is `company-wide | department | domain`; `knowledge_authority` is
  `authoritative | provisional`.
- The standing the model is shown per record is `authority · lifecycle · ratified · freshness ·
  scope` (`heby-answer/knowledge-evidence.server.ts`). Content preparation reads the same Knowledge
  source class (CGO-6).
- `ratified` is therefore the only standing signal. Ratifying an internal fact marks it approved and
  cannot mark it "not for public content"; leaving it unratified to keep it out of content makes a
  true fact look unverified.
- The TRH-8 closure describes a two-tier rule (a ratified fact may be a direct public claim;
  provisional facts are tone/context only). No code implementing that rule was found by search; if
  it is applied, it is at prompt level. Not verified further.
- Direct effect in this round: `trh-sourcing-sales-model` is left undecided (2.4), and the usage
  sentence was kept out of brand v2 (2.3) rather than encoding policy as unenforced statement text.

### Debt 3 — Content claim grounding gap

Three published phrases were traced end to end. Their provenance differs and is kept apart.

| Phrase | Where | Origin |
|---|---|---|
| "one-of-a-kind hand-knotted rug" | Instagram draft `57b57106…` rev 3 (2026-09-23), published 2026-09-25, provider id `18091512017663172` | model output; phrasing matches the organization's own previously published Instagram captions |
| "woven by master artisans" | same revision | same |
| "handwoven kilim" | YouTube draft `e6c38ea3…` rev 2 and its title (2026-09-28), provider id `Rlp-bPNHXkw` | **human-supplied**: the artifact title and both instructions say "handwoven". Not a model hallucination |

**Revision 3 (Instagram).** Generated by Heby (`claude-haiku-4-5`, live, `msg_011CfKiUpagBKVJnD5Kbbwnd`)
from the instruction "Bu taslağı bizim kendi sesimize yaklaştır". The Knowledge evidence set for
that message is recorded as `no-match` with 0 items — no Knowledge item was selected for it. TRH's stored Instagram
observation of 2026-09-22 (`42fa186d…`) holds eight of the account's own captions: five say
"one-of-a-kind hand-knotted" verbatim, a sixth pairs "hand-knotted" with "one-of-a-kind", one says
"generations of master artisans", and two say "quiet elegance". CONTENT-GROUND-1
(`8a0bd395`, released 2026-09-22) supplies such captions as a voice supplement with the instruction
"Match the voice. Do not copy a caption, do not reuse its specifics, and do not claim anything it
claims."

- The use of that supplement in a given preparation is **not persisted** ("instruction, never
  storage"). The link between revision 3 and the captions is inferred from the instruction, the
  timing and the text match; it is not a recorded fact.
- Revisions 1 and 2 of the same draft already carried craftsmanship claims ("master weavers",
  "Handcrafted by artisans"); the first human instruction itself asked to emphasize handmade rugs
  and craftsmanship.

**YouTube revision 1 → 2.** Revision 1 repeated "hand-knotted … master artisans" in wording nearly
identical to Instagram revision 3; that revision 3 was in its context is inferred from the text
match, not recorded. Its evidence set is `matched` with five Knowledge items, none of which carries
those phrases. The Director corrected it by instruction ("never call it hand-knotted. Do not claim
anything about origin, artisans, generations…"); revision 2 complied and was reviewed and accepted.
The publication request's title and description equal the artifact title and revision 2, and the
accepted attempt carries revision 2's digest.

**Root cause, from the evidence:** generation grounding (claims carried from voice/context material
into the draft) plus a historical review gap. Retrieval `no-match` contributed by leaving the model
without Knowledge. `trh-product-offering` is **not** the root cause: none of these phrases is in any
Knowledge record, and that fact says only "el yapımı".

**What controls exist:**

- *Generation.* One prompt line (`work-artifacts/preparation-brief.ts`: "Ground every organizational
  fact in the GROUNDING CONTEXT"). A prompt-level "do not claim" is an instruction, not enforcement.
  There is no post-generation claim-grounding validation; `validateRevisionContent` checks length
  only.
- *Review.* Human judgement. It has worked: on 2026-09-06 a revision was returned because two claims
  were "not supported by any ratified fact".
- *Publication, then.* On 2026-09-25 Instagram revision 3 was proposed, approved (PUBLISH-0
  acceptance) and published with **no content review decision recorded**. The payload binds
  `draftRevisionDigest = d4e133fe…`, equal to revision 3, and the accepted attempt carries the same
  digest.
- *Publication, now.* Since INSTAGRAM-PACKAGE-READINESS-1 (`d40f6c59`, 2026-09-30) an Instagram
  proposal requires a READY Content Package, which requires an approved copy review; YouTube
  proposals require the same. The historical path is closed. Publication still checks readiness,
  digests, account and media — **not** whether the copy's factual claims are grounded.
- *Tests.* `tests/content-ground1` pins the supplement's wording and firewall. No test measures
  whether generated copy obeys it.

Whether the claims are true is outside the record: they already stand in the organization's own
published captions, and nothing in Hebun confirms or refutes them.

## 6 · Verdict

**Decision round CLOSED for the records decided; two Knowledge versions remain open by decision.**

- Refused: 2 action requests. Ratified: 2 Knowledge versions. Superseded: 1 (successor undecided).
  Untouched by choice: 1.
- Three debts recorded with evidence; none repaired. The next architectural decision is the
  Director's.

## 7 · Follow-up round (2026-10-03) · Knowledge Trust Phase 4

The Director resolved the two Knowledge versions section 2 left open and took the first public-use
decisions in production. Same tenant, same actor (`d5b496df…`, own production session, `/knowledge`),
every write through a released server action. No code, no schema, no migration and no new authority
in this round.

| Item | Value |
|---|---|
| Deployment | `c95a7e22` (KT-3), Vercel `dpl_4QKxt2kdEwTaNyRGmEppeq2RFCpN`, READY, serving `www.hebuntech.com` and `hebuntech.com` |
| Schema | ledger 70, prefix `converged`, digest `c34da5fcfd0ad8b5a890ab0a9ae0b645`; `governance_domain` holds `knowledge-public-use` (migration 70, applied by the Director before this round) |
| Verification | read-only SQL and the released read seams under `default_transaction_read_only=on`; snapshot before at 2026-10-03 10:28:15 UTC, after at 11:04:36 UTC |

Before the round the Director confirmed, in answer to the exact current statements, that both open
versions describe Turkish Rug House today. That is why both were ratified rather than superseded or
rejected; ratifying neither cleared nor denied public use.

### 7.1 Truth: two versions ratified

| Fact | Node · version | Governance decision | Ratified at (UTC) |
|---|---|---|---|
| `trh-brand-positioning` | `e8c0006d…` · v2 | `25beb247-001f-4ad3-8e59-3179aae645a9` | 2026-10-03 10:49:12 |
| `trh-sourcing-sales-model` | `25e3f8e3…` · v1 | `658319a7-cc98-4d17-aac6-753dcb95d052` | 2026-10-03 10:53:56 |

Domain `knowledge-ratification`, outcome `ratified`. Brand v2's justification records that it is
confirmed as a positioning intent and claims nothing about individual products. Statements and
version numbers unchanged (TRH statement digest identical before and after). All five current TRH
versions are now ratified, and still display `draft · provisional`: ratification does not move
`knowledge_lifecycle_status`.

### 7.2 Public use: decisions as intended

Path: `/knowledge` → the version's "Public factual use" control → `decideKnowledgePublicUseAction`.
Domain `knowledge-public-use`, subject type `knowledge_public_use`, subject = the exact node.

| Intended | Fact | Node | Final state | Decision(s) |
|---|---|---|---|---|
| P1 allow | `trh-brand-positioning` v2 | `e8c0006d…` | ALLOWED | `f9b19e38-8103-4c0c-9051-9687145166ec` 10:55:52 |
| P2 allow | `trh-sales-markets` v1 | `f3e12fe6…` | ALLOWED | `563f6ed1-0f71-4219-be38-591401abbf95` 11:00:20 |
| P3 deny | `trh-sourcing-sales-model` v1 | `25e3f8e3…` | DENIED | `6a03aa03…` allow (error, 7.3), then `0093c4b6…` revoke |
| P4 keep unknown | `trh-product-offering` v1 | `a1105902…` | UNKNOWN | none, by decision |
| P5 deny | `trh-current-business-objectives` v1 | `1bd16815…` | DENIED | `f8a8c79a-7852-4215-8054-5611359d089f` 11:03:10 |

P4 was kept UNKNOWN deliberately: the version is ratified, but its "el yapımı" claim rests on the
Director's assertion alone, with no product-level evidence recorded.

### 7.3 Operator error: an ALLOW recorded on the wrong subject

The intended P2 decision was first recorded against the wrong version.

| | Decision | At (UTC) | Subject | Transition | Justification stored |
|---|---|---|---|---|---|
| Error | `6a03aa03-49c9-40d3-962e-7dc3f8ec8054` · `approve` · `public-use-allowed` | 10:57:16 | `25e3f8e3…` **sourcing v1** (intended: `f3e12fe6…` sales-markets v1) | unknown → allowed | P2's text ("Ağırlıklı olarak Amerika'ya, ayrıca Avrupa ve Asya'ya satış yaptığımız…") |
| Correction | `0093c4b6-8ea5-465f-bca0-4eb157947aca` · `revoke` · `public-use-revoked` | 10:58:57 | `25e3f8e3…` sourcing v1 | allowed → denied | P3's text (internal commercial information) |
| P2, correctly | `563f6ed1…` · `approve` · `public-use-allowed` | 11:00:20 | `f3e12fe6…` sales-markets v1 | unknown → allowed | P2's text |

- Sourcing v1 was ALLOWED for **1 minute 41 seconds** (10:57:16.155 → 10:58:57.173). Its final state
  is **DENIED**, reached by `revoke` rather than by a direct `deny`, so its ledger outcome reads
  `public-use-revoked`, not `public-use-denied`.
- The wrong ALLOW and its REVOKE **remain in the append-only Governance ledger as recorded**, by
  Director decision. No corrective Governance decision was written and no record was edited. The
  ledger therefore carries a sales-markets justification on a sourcing subject; read this section
  with it.
- Nothing consumed the wrong state. No public-use enforcement existed at the time: Phase 5
  (retrieval / content grounding requiring RATIFIED + ALLOWED) is not built. In the released code
  public-use state is read only by the Knowledge workspace, the decision horizon and the decision
  seam itself (to validate the next transition); no retrieval, content or publication path reads it.
- Unchanged across the round (row count and full-content hash equal before and after):
  `heby_action_requests` 14, `action_permits` 9, `action_execution_attempts` 4, `work_artifacts` 11,
  `work_artifact_revisions` 18, `knowledge_facts`, `knowledge_edges`, `knowledge_external_references`.
  `knowledge_nodes` changed only by the two ratifications' fields (`ratification_decision_id`,
  `ratified_at`, `updated_at`); public-use decisions write nothing to Knowledge.
- How the wrong record was selected was not recorded and is not inferred here.

**UX / operational lesson.** The public-use control names the decision it records but not its
subject. Inside the control the heading reads "Public factual use — a separate decision from
truth", the state line reads "Version N: …", and the confirm button reads "Record: allow public
factual use". The fact key, title and node id appear only on the surrounding record card, and every
TRH version is v1 except brand v2, so "Version 1" does not tell one card from another. A decision is
irreversible in the ledger even when its state can be reversed. Until the surface names the subject
at the point of confirmation, the operating rule is: before pressing Record, confirm the fact key on
the enclosing card against the intended record, and re-read the state line afterwards. This is
recorded as a lesson; no authority, schema or Governance change follows from it.

### 7.4 Horizon and counts after

| Source | Awaiting after |
|---|---|
| Action Authorization | 0 |
| Agent Improvement Hypothesis | 0 |
| Knowledge without a Governance decision (truth) | 0 |
| Knowledge without a public-use decision | 1: `a1105902…` (`trh-product-offering`) |

Completeness `complete`. Governance decisions 49 → 56 and sessions 49 → 56: two ratifications and
five public-use decisions, one session each; six intended writes plus the erroneous allow. No other
tenant holds a public-use decision.

### 7.5 Debt status after this round

- Debt 1 (rejection vs retrieval) and debt 2 (truth vs public use) were addressed in code by the
  Knowledge Trust phases: `a455fe2d` "enforce terminal knowledge truth and rejection retrieval" and
  `c95a7e22` "add governance-owned public-use decisions for knowledge versions". Public use is
  recorded but **not yet enforced** anywhere.
- Debt 3 (content claim grounding) remains open; it is the subject of Phase 5.

**Round verdict:** truth review for TRH closed (5/5 ratified); public use decided for 4 of 5
versions, 1 kept UNKNOWN by decision; one wrong-subject ALLOW recorded, reversed within 1 minute 41
seconds, left in the ledger, and consumed by nothing.
