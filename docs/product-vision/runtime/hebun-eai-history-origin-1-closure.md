# EAI-HISTORY-ORIGIN-1 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope of the acceptance, stated first.** This record is accepted against production *deployment
reality* only: the deployed commit, the production deployment and its aliases, and the Director's
signed-in view of two surfaces. The security behaviour itself is proven by local tests run against the
deployed commit, through the real Anthropic HTTP transport with an intercepted fetch. **The payload
production actually sends to Anthropic was not observed** (no L3), **no real provider call was made**
(no L4), and **historical exposure was not assessed**. §16.1 keeps the state one of six and puts the
qualifier in the evidence text; nothing below widens it.

## 1 · Security issue and root cause

A Heby deterministic answer is assembled from every resolved source, including data classes that
EXTERNAL-AI-DATA-USE withholds from the external model, as untagged lines no reader can separate
afterwards. Replaying it as conversation history sent it to the model under the `conversation` class:
withheld grounding relabelled by the route it took. That was a potential external-AI disclosure path
for organizational information. **No historical disclosure is claimed or ruled out**; it was not
measured (EHO-1-HISTORICAL-MODEL-ORIGIN-1).

Root cause: the bounded history pipeline dropped each assistant message's persisted provenance
(`messages.origin`). `modelFacingHistory` saw only `role`, so it minimized every assistant turn alike
and could not tell a model answer from a deterministic one.

## 2 · What was released

| Commit | Content |
|---|---|
| `1f8f9a47` | `fix(security): prevent deterministic Heby history disclosure`. 7 files, +475 / −18, all under `apps/dashboard`: `src/features/heby-answer/bounded-history.ts` (carries `origin` unchanged; `HistoryTurn`), `model-answer.server.ts` (`loadBoundedHistory` names `origin` per message, `null` when absent), `model-facing-projection.ts` (`MODEL_WITHHELD_HISTORY_ANSWER`; origin allowlist), two fixtures in `tests/model-identity-minimization/` given `origin: "model"`, and two new files in `tests/eai-history-origin-1/`. No schema, migration, EAI policy, Governance, provider or transport change. |

On `main`: fast-forward `69ece029 → 1f8f9a47`, pushed by the Director (GitHub `69ece029..1f8f9a47 -> main`).

**The correction, inside the existing projection authority.** An assistant turn's text reaches the
model only when its persisted origin is exactly `"model"`, and then minimized as before. Every other
assistant turn (`deterministic`, `NULL`, absent, or any origin this code does not name) is replaced
whole by `[Earlier Heby system-generated answer withheld]`. An allowlist, so a new origin is withheld
until named. User turns travel as typed. Only `role` and `content` leave; `origin` never reaches the
transport. EAI disclosure authorization stays the deciding gate; no authority was added.

**Reused seams, none changed.** Durable conversation repository (tenant + owner filter,
`persistExchange` writing `origin`), the generator's three-authority EAI gate, the Claude HTTP transport.

## 3 · Verification (V3)

V3: the change sits on the external-model egress boundary of an EAI-governed path. The full suite was
justified before it ran by that boundary, and its baseline comparison is reused below.

| Item | Measured |
|---|---|
| Targeted security tests, re-run at the deployed commit | 2026-10-17 06:50:51Z–06:50:54Z, worktree `.claude/worktrees/eai-history-origin-1` at `1f8f9a47` (clean before and after): `node --import tsx tests/eai-history-origin-1/history-projection.ts` exit 0 `PASS`; `node --import tsx tests/eai-history-origin-1/egress-postgres.ts` exit 0 `PASS` |
| What the egress test asserts on the JSON body handed to fetch | deterministic, mixed-source, NULL-origin and unknown-origin canaries absent; withheld line present in order; user canary present as typed; model answer present and identity-minimized; no `"origin"` key; marker not in `system`; declaration unchanged (`conversation` first, no class added); another tenant's conversation id yields only the current prompt; an unauthorized tenant reaches no fetch; the answer-level switch off reaches no fetch |
| Projection test | allowlist exactness (case and whitespace variants withheld), bounds unchanged, only `role`/`content` out; in-memory bite-proof: the pre-phase role-only projection and an origin-denylist projection both fail the checks |
| Earlier implementation-session evidence | 24/24 targeted test files PASS; `tsc` and relevant `eslint` PASS (reported, not re-run here) |
| Full suite (implementation session) | 996 PASS / 47 FAIL / 1043. Not green. The 47 failing files fail on the unchanged baseline `69ece029` with prefix-identical first messages (46) and one environmental PostgreSQL disconnect outside the history seam. 13 of them read the changed files; their assertions after the first failure were not executed and were reviewed statically (import graph unchanged, no banned token added, null repository on the answer path) |

**Not covered by execution.** The generator's own operator check was stubbed `true` in the egress test,
so its `false` branch is proven only by earlier phases; the bite-proof does not mutate source; no real
network, no real provider.

## 4 · Production release and acceptance

| Gate | Time (UTC) | Measured |
|---|---|---|
| Release | 2026-10-17 | `origin/main` = `1f8f9a47165a42ba8d0444c7b12fc6fc010386e5`, parent `69ece029` (`git ls-remote`, re-read 07:06Z) |
| Deploy | 06:32:52Z → Ready 06:34:08Z | `dpl_3WiFeB1jLebse3vTuBKdp1at21Ri`, target production, `githubCommitSha` `1f8f9a47…`, ref `main`, git integration (no manual deployment). `targets.production` re-read 07:06:56Z: same deployment, READY |
| Aliases | 06:34:08Z | `/v4/aliases` read-back: `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` → `dpl_3WiF…`; all five project production aliases on it |
| Smoke | 06:34–06:35Z | `/` 200, `/login` 200, apex 308 → www; signed-out `/dashboard`, `/heby`, `/director/provider-matrix`, `/performance` 307 → `/login`; `/api/observation/scan` without its secret 401. Production logs from 06:32Z: 30 requests, all on `dpl_3WiF`, no 5xx, no error-level entry |
| Director signed-in check | 2026-10-17 | The Director, signed in, confirmed visually that the Heby interface and the Command Dashboard load. No message was submitted. **Provenance:** Director, in chat |
| Director scoped acceptance | 2026-10-17 | Authorized a narrowly scoped production acceptance on exactly the evidence above plus the local re-run at the deployed commit |

**Evidence provenance, kept apart.**

| Evidence | Source | Measured by this session |
|---|---|---|
| Deployed SHA, deployment, aliases, smoke, logs | Vercel API / CLI and HTTP, read-only | Yes |
| Signed-in Heby and Command Dashboard | Director, in chat | No — a Director act |
| Two security tests at `1f8f9a47` | Local, disposable PostgreSQL 18 | Yes |
| 24/24 targeted, `tsc`, `eslint`, full-suite comparison | Implementation session | No (log recovered and analysed; not re-run) |

**Old deployment.** `dpl_VGDwgEAShryVkAAJ4sHNgUmRjqJe` (`69ece029`, vulnerable) holds no alias. It was
66,903 s old at the push gate against `skewProtectionMaxAge` 43,200 s, so Vercel's documented behaviour
is to answer a request pinned to it with 404; no such request was observed, so the 404 itself is not
runtime-observed. Its deployment URL stays reachable behind Vercel SSO (`all_except_custom_domains`).

## 5 · Not verified

- **L3 — production payload.** What production sends to Anthropic was not observed; the architecture
  has no observation point for it, and no test seam was added (EHO-1-PROD-PAYLOAD-UNOBSERVED-1).
- **L4 — real provider.** No real Claude request was made (EHO-1-REAL-PROVIDER-ACCEPTANCE-1).
- **Claude connectivity switch.** The production value of `provider_connectivity_controls`
  (`provider_key = "claude"`) was not read; the only runtime read is the Director's signed-in
  `/director/provider-matrix`, and the CLI has no read verb (EHO-1-CLAUDE-SWITCH-STATE-1).
- **Historical exposure.** Not assessed; production conversation data was not opened.
- **Subsystem health.** Two signed-in surfaces loading is not operational acceptance of Heby answers,
  continuity, Governance, Knowledge, Integrations, Agents, Work Artifacts or Media; none was exercised.

## Closure Contract (v1)

- Phase: EAI-HISTORY-ORIGIN-1
- Owner: apps/dashboard/src/features/heby-answer/model-facing-projection.ts (`modelFacingHistory`, the model-facing history projection) with bounded-history.ts and model-answer.server.ts carrying `messages.origin`; Heby conversation persistence, EAI disclosure authorization, provider connectivity, transport, Governance, Knowledge and tenant authority unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 1f8f9a47165a42ba8d0444c7b12fc6fc010386e5 — released on `main` (fast-forward from 69ece029)
- Verification level: V3 — external-model egress boundary of an EAI-governed path; full-suite baseline comparison reused (996/47, every failing file red on 69ece029), targeted security tests re-run at the deployed commit
- Verification evidence: at 1f8f9a47 on 2026-10-17, tests/eai-history-origin-1/history-projection.ts exit 0 PASS and tests/eai-history-origin-1/egress-postgres.ts exit 0 PASS (assertions on the intercepted transport body, section 3); implementation session: 24/24 targeted files PASS, tsc and eslint PASS; full suite 996 PASS / 47 FAIL / 1043, the 47 also failing on 69ece029 (not green)
- Test environment: worktree `.claude/worktrees/eai-history-origin-1` at 1f8f9a47, clean; macOS (Darwin 25.2.0); Node with tsx; PostgreSQL 18 at 127.0.0.1:55433 via HEBUN_TEST_ADMIN_DATABASE_URL (disposable `hebun_test_*` database, dropped in `finally`); model credential `sk-fake` with an injected fetch; no production database, no provider, no real network
- Deployment evidence: dpl_3WiFeB1jLebse3vTuBKdp1at21Ri READY production at 1f8f9a47 (githubCommitSha), created 2026-10-17T06:32:52Z by the git integration, aliases www.hebuntech.com, hebuntech.com and hebun-ai-recovered.vercel.app read back on it
- Production acceptance evidence: SCOPED to deployment reality — (a) measured read-only: production target and alias read-back on dpl_3WiF at 1f8f9a47, smoke `/` 200, `/login` 200, signed-out routes 307 to `/login`, 30 logged requests with no 5xx; (b) Director signed-in visual check of Heby and the Command Dashboard, no message submitted; (c) Director-authorized scoped acceptance 2026-10-17. L3 production payload UNVERIFIED, L4 real provider UNVERIFIED, historical exposure not assessed (section 5)
- Deferred risks: EHO-1-HISTORICAL-MODEL-ORIGIN-1 (DEFERRED); EHO-1-PROD-PAYLOAD-UNOBSERVED-1 (DEFERRED); EHO-1-REAL-PROVIDER-ACCEPTANCE-1 (DEFERRED); EHO-1-CLAUDE-SWITCH-STATE-1 (DEFERRED); EHO-1-ROLLBACK-RESTORES-1 (DEFERRED); EHO-1-RED-SUITE-BASELINE-1 (DEFERRED)
- Director approvals: one exact fast-forward push of 1f8f9a47 to main with its automatic production deployment, strategy C (Claude connectivity unchanged), 2026-10-17 — the push executed by the Director; read-only L1/L2 acceptance 2026-10-17; local execution of the two eai-history-origin-1 tests 2026-10-17; scoped production acceptance and preparation of this closure documentation 2026-10-17; commit and push of this documentation NOT yet approved

### Deferred risk detail

- **EHO-1-HISTORICAL-MODEL-ORIGIN-1 (DEFERRED).** Assistant rows persisted with `origin = "model"`
  before the external-AI data-use boundary was enforced may hold content whose disclosure class is
  uncertain; they still travel, minimized. No exposure is established either way. Acceptance
  dependency: a Director-authorized read-only production count (no content read) of model-origin rows
  by creation time, and a decision on them.
- **EHO-1-PROD-PAYLOAD-UNOBSERVED-1 (DEFERRED).** The production model-facing payload was not observed;
  Hebun has no observation point for it. Acceptance dependency: a Director decision on a bounded
  production observation or a design decision on an observation seam.
- **EHO-1-REAL-PROVIDER-ACCEPTANCE-1 (DEFERRED).** No real Anthropic request was made for this phase.
  Acceptance dependency: a separately authorized, bounded real-provider test (it writes conversation
  rows and incurs provider cost).
- **EHO-1-CLAUDE-SWITCH-STATE-1 (DEFERRED).** The production Claude connectivity state was not read
  through its authoritative seam. Acceptance dependency: the Director's signed-in read of
  `/director/provider-matrix`.
- **EHO-1-ROLLBACK-RESTORES-1 (DEFERRED).** Every production deployment older than `dpl_3WiF…`
  (`1f8f9a47`) carries the vulnerable projection; an instant rollback restores it, and their deployment
  URLs stay reachable behind Vercel SSO. Acceptance dependency: any rollback below 1f8f9a47 is a Director
  decision, preceded by `npm run provider:connectivity -- claude disable` under production possession.
- **EHO-1-RED-SUITE-BASELINE-1 (DEFERRED).** 47 of 1043 test files fail on the unchanged baseline; this
  phase neither caused nor fixes them, and their assertions after the first failure are not executed.
  Acceptance dependency: a Director-selected suite-recovery phase.

**Behaviour change, intended.** Heby's model no longer sees the text of its earlier deterministic or
legacy answers, so continuity in deterministic-heavy conversations carries less context. The character
budget still counts a withheld turn at its original length. Neither was observed in production.

**Weekly three.** *Learned:* a projection that decides by role cannot protect provenance it was never
given; carry the persisted origin to the decision and make the rule an allowlist, so an unknown origin
is withheld by construction. *Turkish Rug House:* TRH answers built from data the model may not see no
longer reach Claude as "conversation" in a later turn. *Hebun AI:* the external-AI data-use boundary
now holds across turns, not only within one request.
