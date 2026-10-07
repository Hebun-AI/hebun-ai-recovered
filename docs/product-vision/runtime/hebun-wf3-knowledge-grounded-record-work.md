# WF-3 — Knowledge-Grounded Record-Work Proposals

**Status: CLOSED / PRODUCTION-ACCEPTED (Director, 2026-10-07).**
Final release `5abab3ecb240f0358ba0eaae956ddfaa5020241a` (`dpl_CS9tMubkAXitw6vvcq4je4fhckp3`,
`www.hebuntech.com` + `hebuntech.com`). Zero schema, zero migration (ledger 73 before and after).
Agent #2 remains STOPPED. WF-4 remains CLOSED / PRODUCTION-ACCEPTED.

Agent #1 may now be asked, in an explicit human-selected Knowledge mode, to propose `record-work`
grounded in this organization's ratified Knowledge. The outcome is still exactly one PENDING proposal
for human review. Knowledge changes what the agent reasons over, not what it may do.

SUPPLIED ≠ REFERENCED ≠ PROPOSED ≠ AUTHORIZED ≠ EXECUTED ≠ TRUE.

## Policy (Director, WF-3 design gate)

Knowledge participates in B-level record-work grounding only when all of these hold:

1. eligible under Knowledge retrieval/lifecycle rules (incl. Governance rejection);
2. the exact active version is ratified, verified against Governance's own `ratify` decisions;
3. the exact version is SCI-2B ELIGIBLE for `agent-record-work-grounding`;
4. the tenant's EAI authorization permits `agent-origination × {conversation, organization, knowledge}`;
5. the platform disclosure policy allows those exact cells;
6. the version is in the supplied candidate set; 7. every model reference is a member of that set;
8. the supplied set is the COMPLETE eligible universe (≤ 20, ≤ 2,000 code points per statement) —
   over either bound refuses; no truncation, no lexical, semantic or model selection;
9. referenced versions are re-judged immediately before filing;
10. Knowledge mode is explicit; zero eligible Knowledge in that mode fails closed, and a proposal
    citing no Knowledge is not filed. Only cited versions are persisted as evidence.

## Phases — commits, deploys, production evidence

| Phase | Commit | Deploy | Production |
|---|---|---|---|
| WF-3A candidate contract | `46adfce6` (parent `b6e0894d`) | `dpl_5XBeiLLXGbZXyreSnQsXjF7eWj1S` | inert; read-only statement-length aggregate (max 200 cp, hebun 97) |
| WF-3B EAI policy | `a3381542` (parent `46adfce6`) | `dpl_9s5Dcgh6xtuzh3tHzxdazCT5PeYS` | Director TTY ceremony: hebun authorization rev 3 `b2de774d` (supersedes `8427ad60`), decision `13745f16`, session `790a0f84` |
| WF-3C origination wiring | `5abab3ec` (parent `a3381542`) | `dpl_CS9tMubkAXitw6vvcq4je4fhckp3` | inert acceptance: Knowledge mode refused `no-eligible-knowledge` before any provider path; counts unchanged |
| WF-3D reissue + acceptance | — (no code) | — | supersede, ratify, one live origination (below) |

Every push was a fast-forward after a compare-and-swap read of remote `main`; every deployment was
verified READY with `gitSource.sha` equal to the commit and both aliases bound, with the previous
SHA returning a different deployment as control.

### WF-3A — the grounding universe (`features/knowledge-grounding/`)

Read composition, owning no truth: `listKnowledgeSources` (cap 50; `truncated` → unavailable) →
`partitionByEligibility` with Governance's rejection set → non-empty statement →
`readKnowledgeAdmissibilityFacts` + `evaluateAdmissibility` per version (any unavailable read refuses
the whole universe) → count bound (20, `RETRIEVAL_MAX_LIMIT`) → statement bound (2,000 Unicode code
points, a Director Release 1 disclosure budget — not a token, context-window, ingestion or storage
limit) → order `(domainKey, factKey, scope, nodeId)` (the listing's ORDER BY is not total) → aliases
`K1..Kn`. Model projection is `{alias, statement}` only. `parseKnowledgeReferences` resolves aliases
by exact membership in the in-memory set and refuses malformed, duplicate, unknown and empty lists.

### WF-3B — platform and tenant authority

`RecordedAllowedCell` gained `agent-origination × knowledge` (shared Anthropic bounds, attestation
`ffb0c160` r1, model_ids `claude-haiku-4-5-20251001`). The tenant ceremony now expects the three
origination classes and its consent names Knowledge; it writes the union of scopes in force. Read-only
gate check on production state: hebun Knowledge mode authorized (rev 3), plain origination authorized,
`+work-artifact` platform-unknown, Sonnet model-not-attested, TRH and Mulify tenant-not-authorized.

### WF-3C — the Knowledge mode (`agent-origination/`, `heby-action-inlet/`)

- A separate server action (`heby/knowledge-origination-actions.ts`) sets `knowledgeMode`; the client
  still sends only `{ goal }`. The `/heby` affordance offers "Ask, grounded in Knowledge" beside the
  released "Ask Heby to propose".
- The universe is read before any invocation; its refusals (`knowledge-unavailable`,
  `no-eligible-knowledge`, `knowledge-universe-exceeds-bound`, `knowledge-candidate-too-large`) spend
  nothing.
- Candidate lines are `- knowledgeRef=K1 statement="…"` (JSON-quoted: a newline cannot forge a line),
  classed `knowledge`, so the derived declaration is `conversation + organization + knowledge`.
- Knowledge-mode instructions add `knowledgeRefs` to every record-work envelope; the plain
  instructions are byte-identical.
- The parser requires ≥ 1 offered alias (`no-knowledge-reference`, `duplicate-knowledge-reference`,
  `reference-not-offered`, `malformed-reference`).
- `revalidateKnowledgeReferences` re-reads Governance rejection + SCI-2B for the cited versions just
  before filing (`knowledge-reference-stale` / `knowledge-unavailable`; nothing filed).
- The inlet appends `{sourceClass: "knowledge", recordRef: "knowledge-version/<id>"}` for cited
  versions only, in `heby_action_requests.evidence`, outside the payload digest.

### WF-3D — legacy reissue (Director, `/knowledge` UI)

| Step | Evidence |
|---|---|
| Target | fact `7689a8f4-c5f8-4d5a-9779-c751dd685324` (policies, `ingest:hebun-knowledge-test:9c400b0af84b:0`); legacy active `65f7f57f` kv 1, ratified (`98cbef21`), integrity NULL |
| Supersede (2026-10-06T21:09:40Z) | N2 `2ce5847e-6204-4449-832a-750006e11cdc`: kv 2, supersedes `65f7f57f`, title and statement byte-equal (sha16 `9c400b0af84b48b7`, 38 cp), **integrity_protected_at_insert TRUE** (database stamp), draft/provisional; fact active → N2, previous `65f7f57f`, fact_version 2; `65f7f57f` unchanged; audit `e72fc09b` `knowledge.supersede`; delta nodes +1, audit +1 |
| Ratify (2026-10-06T21:16:30Z) | decision `54877736` (ratify, `knowledge_node` N2), session `3551a9b9` (`knowledge-ratification`); N2 bound to it; Governance reader returns exactly it; SCI-2B ELIGIBLE; audits `90c7eebf` `knowledge.ratify` + `e7e38b8b` `governance.decision.recorded`; delta decisions +1, sessions +1, audit +2 |
| Universe | `readKnowledgeGroundingUniverse(hebun)` = available, exactly K1 = N2 |

The other hebun fact (`dc8d3795`, unratified) and all TRH Knowledge were not touched.

## Production acceptance — PASS (2026-10-06T21:27Z)

Director, `/heby`, new message (path A): "Hebun test kodunu temel alan bir organizasyonel çalışma
önerisi oluştur." then one click on "Ask, grounded in Knowledge". Full 77-table census against a
read-only baseline taken at 21:22:59Z.

| Check | Evidence |
|---|---|
| Invocation | `f8723eef`: live, haiku-4.5, `msg_011Cfmh5RNGSD6yhT8xXzAcL`, 1101 in / 129 out, `selection-valid`, filing `proposed`, agent `4ffeeb83` |
| Proposal | `fa3c36f7`: **pending**, `record-work`, organization-level, proposer agent, `origination_invocation_id` = `f8723eef`; rationale cites K1 |
| Evidence | exactly `organization/f625b683…` + `knowledge-version/2ce5847e-6204-4449-832a-750006e11cdc`; legacy `65f7f57f` absent |
| Disclosure | audit `31c43894` `external-ai.disclosure.authorized`, `agent-origination`, declared = authorized = `[conversation, organization, knowledge]`, correlation = invocation, authorization `b2de774d` r3, attestation `ffb0c160` r1 |
| Assistance (separate, accepted) | audit `9935cf59` (`assistance`, `[conversation]`), messages +2, conversations +1, `heby_answer_source_evidence` +3 (governance class, on the assistant message) |
| Census | changed: invocations +1, requests +1, audit +2, messages +2, conversations +1, answer source evidence +3. Unchanged: permits, decisions, sessions, Knowledge, EAI, work and execution tables |

The `heby_answer_source_evidence` rows were omitted from the pre-stated expectation; they are the
assistance answer's standard authoritative evidence write, not an origination deviation (Director).
The proposal title and rationale quote the test statement; the statement is a test ingestion, so this
acceptance proves the production path, not grounding quality. `fa3c36f7` remains PENDING (version 1)
for the Director; no decision was taken by this work.

## Final authority invariants (verified)

- Knowledge eligibility, ratification, SCI admissibility, EAI disclosure and agent mandate remain five
  separate authorities; WF-3A composes their answers and decides nothing of its own.
- The model never sees a Knowledge, fact, tenant, decision or actor id; it cites an invocation-local
  alias resolved only in memory.
- Only the explicit Knowledge action declares `knowledge`; plain origination and WF-1 availability
  still declare `{conversation, organization}`.
- Agent #1's originable kinds, narrow arms and mandate ceiling are unchanged; WF-4's spend check is
  unchanged. No approval, permit, execution, send, work item, Knowledge or Governance write is
  reachable from origination.
- Only hebun is authorized for `agent-origination × knowledge`; TRH and Mulify are not.

## Validation

- WF-3A: 25 pure cases, 15/15 pure bite-proofs, real-PG composition (5 tenants) with 2/2 server
  bite-proofs, firewall; L2 309 files, 45 failing identically at `b6e0894d` (first errors identical);
  SCI-2B consumer census widened by name.
- WF-3B: focused policy-and-gate test; EAI-related 149 files 130/19 identical to `46adfce6`; 5 policy
  pins widened by name.
- WF-3C: pure contract + real-PG end-to-end (6 cases); 7/7 ad-hoc bites; L2 356 files, 50 failing
  identically to `a3381542`; pins: TRH-18 refusal checklist, WF-3A bite anchor and consumer firewall,
  SCI-1 mint shape, WF-1 explicit calls. `tsc --noEmit` 0 at every commit. No L3: no shared
  authorization or execution runtime changed.

## Lessons (recorded here; the primary tree's `learnings.md` is concurrently modified)

1. **Never run source-mutating bite-proof suites in parallel.** Two suites snapshot and restore the
   same file; one restored the other's mutation into source (TRH-20's M2 in `originate-action`).
   Caught by a diff review before commit; run bite-proofs sequentially and diff the tree after.
2. **An acceptance plan through `/heby` must list the assistance answer's writes**, including
   `heby_answer_source_evidence`, not only messages and conversations.
3. **Same-text reissue needs a normalization precheck**: the K2 writer trims statements, so prove
   `normalize(stored) === stored` before claiming a byte-identical successor.
4. **The Knowledge listing's ORDER BY `(domain_key, fact_key)` is not total**; deterministic aliasing
   must complete it with scope and version id.

## Remaining debt (recorded, not fixed here)

1. No EAI availability pre-check for Knowledge mode: a tenant authorized for plain origination but not
   Knowledge would see "model unavailable" after confirmation (none exists today).
2. The ceremony's `--agent-origination` now authorizes Knowledge for any future tenant; a tenant that
   wants origination without Knowledge would need a separate switch.
3. Revalidation-to-insert window under READ COMMITTED (same class as WF-4); output stays PENDING.
4. SCI facts are read per version (≤ 50 by the listing cap); a batch reader if the cap grows.
5. TRH legacy Knowledge is not reissued; hebun's only eligible statement is a test ingestion.
6. WF-1 debt persists (post-proposal "Approvals" copy, no catch on a rejected action, no real-browser
   test); the Knowledge button was exercised in production by the Director, not by an automated test.
