# APF-5 — Egress Continuity

**Status: CLOSED / PRODUCTION-ACCEPTED (Director, 2026-10-06).**
Runtime commit `62dcce6366440535f914005a7175f8715abea1c0` (`dpl_An7uBib3YWEsM43mCBQLuMxrvYWW`).
Zero schema, zero migration (ledger 71 before and after). No new authority, no model registry.

APF-3 closed with two pre-Workforce egress debts: the runtime did not enforce
`configured model ∈ attestation.model_ids` (a point-in-time manual check stood in for it), and a
single call's disclosure decision left no record of its own. APF-5 closes both, and removes the one
live Anthropic path that ran outside the generator (the relevance experiment's model judge).

## Authority ownership — unchanged, and kept apart

| Fact | Owner |
|---|---|
| Which models are attested | processor attestation (`model_ids`) |
| Whether the platform allows a disclosure | platform policy |
| Whether the tenant authorized it | tenant External AI Data-Use authorization |
| Whether THIS call may disclose | the EAI gate / composer, per call |
| Evidence that the gate decided | `audit_log` — records the decision, owns no authorization; nothing reads it to authorize |
| What was sent, and what came back | `messages` / invocation rows, joined by `correlation_id` |

AUTHORIZED ≠ AUDITED. AUDITED ≠ SENT. SENT ≠ PROVIDER RESPONDED. PROVIDER RESPONDED ≠ ACTION EXECUTED.
An `external-ai.disclosure.authorized` row means the decision allowed the call. It never means the
call was sent or accepted.

## A. Model continuity

The generator resolves `config.modelId` once. That same value is handed to the gate, checked
against the active attestation's `model_ids`, and sent to the transport; nothing re-reads it. A model
the attestation does not record is refused `model-not-attested` before any client exists, so no
network request is possible. An attestation naming no model is unusable. The attestation reader now
exposes `model_ids` and the attestation revision; no copy of the model list was created anywhere.

Production read-only acceptance on the deployed SHA (gate evaluated, nothing written):
`claude-haiku-4-5-20251001` → `authorized` (attestation `ffb0c160` rev 1, authorization rev 2);
Sonnet / Opus → `model-not-attested`.

## B. Disclosure decision evidence

Order in the generator: DECISION → EVIDENCE → TRANSPORT. The gate stays pure (read-only gate checks
never write); the generator records the decision through `governance-audit/external-ai-disclosure-audit.server.ts`,
which only maps an already-computed closed-shape record and imports nothing of the deciding authority.

- Actions `external-ai.disclosure.authorized` | `external-ai.disclosure.refused`, entity type
  `external-ai-disclosure-decision`, source `external-ai-data-use`, `correlation_id` = the request's.
- Metadata: `serviceScope`, `accountRef`, `purpose`, `declaredDataClasses`, `authorizedDataClasses`,
  `modelId`, `disposition`, `processorAttestationId`, `processorAttestationRevision`,
  `tenantAuthorizationId`, `tenantAuthorizationRevision`, `components`.
- Never present: prompt, goal or user content, grounding or evidence content, system instructions,
  credentials, provider response body, or any claim that the request was sent or accepted.
- An authorized decision whose record cannot be written is **not sent** (fail-closed).
- A refusal stays a refusal whether or not its best-effort record lands.

## Relevance bypass retired

The relevance experiment runner's live model mode, which reached Anthropic outside the generator and
therefore outside the gate, was retired. Scripts are structurally prevented by tests / import
firewall from obtaining the known live Anthropic transport mechanisms. No relevance-selection
data-use authorization was added. The transport now imports its owning submodules instead of the
`heby-model` barrel (the barrel re-exported the generator, leaking the audit writer into read-only
import graphs and forming a cycle).

## Correlation

Agent origination now uses its `invocationId` as the request correlation instead of the constant
`"agent-origination"`, so an invocation joins its own decision record. No historical row was rewritten.

## Live production acceptance — one call

Director GO for exactly one assistance call, hebun, normal `/heby` UI session. No retry.

Prompt: `Reply with exactly: APF-5 acceptance.`

| Fact | Value |
|---|---|
| Correlation | `64e00fa1-4a11-4187-a049-f032a246c9e3` |
| Audit row | `3f1e3f77-5f41-453d-88fd-85f84f0b7148`, `external-ai.disclosure.authorized`, result `committed`, 06:53:15.615Z |
| Disposition / purpose | `authorized` / `assistance`, scope `anthropic/messages` |
| Declared = authorized classes | `[conversation]` |
| Attestation / authorization | `ffb0c160` rev 1 (model in `model_ids`) / `8427ad60` rev 2 |
| Components | tenant active, operator enabled, platform allowed, provider available, attestation active, change equivalent |
| Assistant message | `30dd4489`, conversation `bd6d6689`, transport live, 708 in / 101 out |
| Model / provider request | `claude-haiku-4-5-20251001` / `msg_011CfkYSXFmVzH34jNm6EdH2` |

Audit row written before the provider response (06:53:15.6Z vs message 06:53:17.6Z). Exactly one
audit row and one message carry the correlation. The audit metadata holds none of the prompt, the
provider request id, or response content.

The model did not reply with the requested wording; it declined. Output wording was not an
acceptance criterion.

| Truth | |
|---|---|
| MODEL CONFIGURED | YES |
| MODEL ATTESTED | YES |
| PLATFORM ALLOWED | YES |
| TENANT AUTHORIZED | YES |
| RUNTIME AUTHORIZED | YES |
| AUTHORIZATION AUDITED | YES |
| NETWORK REQUEST ATTEMPTED | YES |
| PROVIDER RESPONDED | YES |
| MODEL RESPONSE RECORDED | YES |
| ACTION PROPOSED | NO |
| ACTION AUTHORIZED | NO |
| PERMIT ISSUED | NO |
| EXECUTION OCCURRED | NO |

Production delta: `audit_log` +1 (208 → 209), `external-ai.disclosure.authorized` +1 (0 → 1),
`messages` +2 (user + assistant), conversations +1. Unchanged: action requests 15, permits 9,
execution attempts 4, work items 6, Governance decisions 59, standing mutation authorizations 4,
mandates, EAI authorizations, processor attestation, machine execution authorizations. APF-3 request
`99000f47-4479-4ac0-ba90-781d43c31c6d` remained PENDING (version 1, untouched). TRH / Mulify unchanged.

## Final disclosure consistency check — CONSISTENT

The answer displayed `Sources (56)` while the audit declared only `[conversation]`. Read-only trace
against production rows and the code at `62dcce63`:

- `Sources (N)` (`heby-turns.tsx`) counts `toResponseSourceEvidence(resolutions)`: resolved,
  non-Knowledge, human-facing items. It equals the 56 `heby_answer_source_evidence` rows linked to
  message `30dd4489`. No Knowledge evidence set / item rows are linked to it.
- The 56 items span operations 11, decision-records 6, organization 1, agents 1, agent-mandate 3,
  recorded-acts 21, recorded-act-windows 3, work 2, placement 1, people 1, content-media 6. None is a
  model-disclosable content class (`knowledge`, `knowledge-coverage`, `work-artifacts`).
- The model-facing projection (`modelGroundingLines`) is built from the same `resolutions` and turns
  every non-disclosable source into one fixed line `[<class>] withheld — not disclosed to the
  external model`. The declaration (`conversation` ∪ `modelDisclosedDataClasses(resolutions)`) uses
  the same array and the same class map, independent of source state.

So the external model received the system instructions, the prompt, and fixed class-name / withheld
marker text. It did **not** receive the underlying source contents. The declaration `[conversation]`
was complete. Supporting only (not proof): 708 input tokens fit instructions (2,165 chars) + prompt +
withheld markers; the 56 items' human-facing text alone is ~20.5k chars.

## Validation

Focused suites green; APF-5 PostgreSQL egress test passed; APF-5 bite-proofs 7/7 (model check
removed, wrong model checked, authorized sent without record, refusal escapes on failed record, audit
writer reaches the deciding authority, origination constant correlation, relevance runner regains a
live transport); APF-3 bite-proofs remain 6/6. The canonical run showed 5 new pin / census failures
(g1, g2, k2, hebycap1, APF-3 bite anchor); they were understood and corrected, and the remaining 67
match the established baseline. The transport dependency correction landed after that canonical
run and was verified by targeted reruns of the affected suites. No second clean canonical run occurred.

## Remaining limitations (not solved here)

1. EAI enforcement still relies on the transport's egress-marker contract: a wrapper that drops the
   mark would skip the gate.
2. Media provider egress is outside this Anthropic EAI closure — a separate architecture / security subject.
3. `Sources (N)` can be read as "sources the model saw". Product clarity debt, not a security blocker.
4. Secure Content Ingestion remains PLANNED / NOT IMPLEMENTED.
