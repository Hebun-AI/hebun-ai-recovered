# EVIDENCE-DECISION-BRIEF-1 — `/brief`: a decision brief from the organization's Knowledge — Closure

Base `879d0771` (`origin/main`, production `dpl_EXtJHuKXKMD9mj8xJRdK7EXkJzB6`). Worktree
`.claude/worktrees/evidence-decision-brief-1`, branch `feat/evidence-decision-brief-1`. Local commit
only; not pushed, not deployed.

Paths are relative to `apps/dashboard/src/`.

## What a person gets

`/brief <question>` in Heby returns six fixed sections:

- **A. Question** — restated.
- **B. Verified evidence** — only records whose ratification Governance holds for this version, with
  Knowledge status, authority, freshness, any limits, an excerpt and `Source: /source <key>`.
- **C. Unverified or limited evidence** — every other matched record, with Governance's standing
  (a claim Governance does not hold reads NOT confirmed). Never presented as an approved fact.
- **D. Missing or unavailable information** — relative to this question and the records Hebun can
  read: no match, no confirmed record, more matched than shown, records not in force (counted by
  reason, never named), a missing retrieval capability.
- **E. Decision considerations** — each one a fixed rule over the facts above (no confirmed record;
  unconfirmed claims; records with no Governance decision; provisional confirmed records; overdue or
  undated records; several sources in one area; records not in force; more than shown). Labelled
  "Not AI interpretation, not a recommendation, and not an organizational decision".
- **F. Limitations** — lexical evidence only; conflicts not evaluated; missing evidence does not
  establish absence; no AI interpretation was used; the brief changes nothing.

## Why deterministic, and the decision left open

The brief uses the reads `/search` already makes (KR3 `searchKnowledge`, Governance standing via
`readKnowledgeGovernanceStandings`) and arranges them in `heby-commands/decision-brief.ts`. No model is
asked, so no organizational evidence leaves Hebun and no external AI data-use authorization is needed.

A model-written brief through the existing advisory-command path was rejected for V1 on repository
facts: (1) the advisory prompt becomes the retrieval query (`validation.prompt` → `withKnowledge`), so a
brief template would search on its own instruction words; separating them needs a new client payload
field or a new server-side intent, and intents carry system instructions; (2) in `/heby` the model sees
ratified Knowledge only (HGC-1), so sections C and D could not be written there without changing that
policy. Both are product/authority decisions, recorded as `EDB1-AI-INTERPRETATION-DECISION-1`.

## What changed

| Piece | Change |
|---|---|
| `features/heby-commands/decision-brief.ts` (new) | pure brief rendering; `excerptOf` and `exclusionLines` moved here from `read-commands.server.ts` so `/search` and `/brief` share them |
| `features/heby-commands/read-commands.server.ts` | `case "brief"`: the `/search` reads, the same five outcomes, fail-closed on the Governance reading |
| `features/heby-commands/registry.ts` | `/brief` — `read`, Knowledge category, available, model-free |
| `features/heby-answer/knowledge-evidence.server.ts` | `isGovernanceConfirmed` — a neutral name for heby-commands (g2/k4 forbid the ratification word there) |

No table, migration, write, model call, provider, permission, prompt, intent or EAI change; `/heby`'s
ratified-only policy is untouched. `/search`'s output is unchanged (its helpers moved, not changed).

## Guarantees

- Verified = Governance holds the claimed decision; a forged `ratification_decision_id` lands in C as
  NOT confirmed (Postgres-tested). Lifecycle stays a separate field.
- Governance rejection read or standing read unreadable or throwing → no brief and no record.
- Tenant from `TenantContext`; two-tenant Postgres test; every listed key opens the same record via
  `/source`; rejected versions leave no text or key.
- Read command output is not persisted, so historical evidence is unaffected.

## Verification (V2)

V2: a new consumer of the shared KR3 seam and Governance reading, plus a shared helper move inside the
Heby command family; no write, schema, grant, provider or EAI boundary moves.

| Item | Result |
|---|---|
| `evidence-decision-brief-1/brief-postgres` (A–H), `render-and-firewall` (A–C) | PASS |
| Baseline at `879d0771` / candidate, 49 suites referencing `heby-commands` plus the two prior Knowledge phases | 140 PASS + 1 PRE-EXISTING flake (`k2-flow` race) / 142 PASS + continuity (unfilled record, then PASS); 0 REGRESSION |
| `tsc --noEmit -p .`, `eslint` on changed files, `npm run build` | exit 0 each |

One pin moved: `k1-flow/commands-and-grounding` §20 — the Knowledge command family now includes
`/brief`, with the same read/model-free/execution-free assertions as the others.

## Three questions

1. **What did we learn?** A brief's trustworthiness comes from where each line comes from: the facts
   from authorities, the considerations from fixed rules, and nothing from a model that the reader
   cannot trace — and the advisory path searches on its own wording, so a template there is not free.
2. **How does this improve Turkish Rug House?** Management can ask about a policy and see in one view
   what Governance has confirmed, what is only recorded, what is not in force and what to clarify.
3. **How does this become part of Hebun AI?** As the evidence layer any AI interpretation must sit on:
   when a model is added, it writes section E beside these sections, never instead of them.

## Closure Contract (v1)

- Phase: EVIDENCE-DECISION-BRIEF-1
- Owner: Heby read commands (`features/heby-commands/`) over the KR3 retrieval seam and Governance's ratification projection
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — new consumer of the shared KR3 seam and Governance reading; no write, schema, grant, provider or EAI boundary changes
- Verification evidence: baseline at 879d0771, 141 files in 49 suites referencing heby-commands plus knowledge-search-v1, knowledge-evidence-standing-1 and development-continuity: 140 PASS / 1 FAIL — k2-flow/create-and-read-postgres `exactly one creation won` (['created','unavailable']), the known Promise.all race recorded in learnings, PRE-EXISTING flake on unchanged source; candidate (this change applied in a disposable detached worktree), same files + the 2 new: 142 PASS / 1 FAIL, the FAIL being development-continuity on this record's then-unfilled evidence field, re-run PASS after filling; k2-flow passed in the candidate run; 0 REGRESSION, 1 PRE-EXISTING (flaky), 0 BLOCKED; mutation bite-proof (`/brief` treating the record's own decision id as confirmation) makes brief-postgres FAIL; `tsc --noEmit -p .` exit 0; `eslint` on changed files exit 0; `npm run build` exit 0
- Test environment: worktree `.claude/worktrees/evidence-decision-brief-1` (tsc, eslint, build, focused tests); disposable detached worktree `.claude/worktrees/intel-discovery-008aa7f6` at `879d0771` for baseline and, with this change applied as a patch, for the candidate; `node --import tsx` per file; PostgreSQL 18.6 on 127.0.0.1:55433 via `HEBUN_TEST_ADMIN_DATABASE_URL`, harness-created databases; no `DATABASE_URL`, no model key
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released or deployed
- Deferred risks: EDB1-BROWSER-UNVERIFIED-1 (DEFERRED); EDB1-AI-INTERPRETATION-DECISION-1 (DEFERRED)
- Director approvals: EVIDENCE-DECISION-BRIEF-1 implementation through existing authorities, tests, V2 validation and one local commit, no push, no deployment (Director, 2026-10-19)

## Deferred risks

- **EDB1-BROWSER-UNVERIFIED-1 (DEFERRED)** — `/brief` was proven at the server boundary against a real
  database, not rendered in a signed-in browser. Closes with a signed-in render of `/brief`, read only.
- **EDB1-AI-INTERPRETATION-DECISION-1 (DEFERRED)** — a model-written interpretation section needs a
  Director decision: how the brief instruction reaches the model without becoming the retrieval query
  (a server-side intent or a separate query field), and whether `/heby`'s ratified-only grounding may
  carry labelled unverified records for it. Closes with that decision.
