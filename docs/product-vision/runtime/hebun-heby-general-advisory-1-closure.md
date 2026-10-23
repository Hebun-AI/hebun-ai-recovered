# HEBY-GENERAL-ADVISORY-1 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope of the acceptance, stated first.** Accepted against production deployment reality and one
Director-authorized real Heby question asked by Mulify's owner, read back read-only through the
product. The instruction split, the unchanged egress and the disclosure derivation are proven by local
tests at the released commit. **Only a general question was asked in production**: an
organization-specific question without evidence, a mixed question and a withheld-class request were
not exercised against the real provider. The production model-facing payload was not observed.

## 1 · Problem

Mulify's first real Heby interaction (conversation `810794a3`, 2026-10-23) was a live model answer
that declined three general small-business AI recommendations because no organizational grounding was
available. The cause was the standing instruction "Answer the USER REQUEST using only the GROUNDING
CONTEXT", which made every general question unanswerable for an organization with few records. The
validator and grounding construction were not the cause.

## 2 · What was released

| Commit | Content |
|---|---|
| `d9e4beab` | `feat(heby): support grounded general advisory responses`. 9 files, +173 / −11: `src/features/heby-answer/model-answer.server.ts` (shared rule list; `HEBY_GENERAL_ADVISORY_SYSTEM_INSTRUCTIONS`; `systemInstructionsFor` routing), `src/features/heby-runtime/model-disclosure.ts` (`generalKnowledgeLines`), `src/components/layout/heby/heby-turns.tsx` (renders it), new `tests/heby-general-advisory-1/advisory.ts`, four tests now expecting the advisory instruction on ordinary answers, one `learnings.md` line |

On `main`: fast-forward `c01ad6e4 → d9e4beab`, remote HEAD re-read and proven an ancestor immediately
before the push.

**Behaviour.** A non-preparing Heby question without a brief carries the advisory instruction:
organizational claims only from the turn's grounding context and never estimated; general advice from
general knowledge, labelled as such and never worded as the organization; mixed questions separated
and conditioned; withheld sources never reconstructed; general knowledge never presented as a source.
Every preparation intent and every brief keep `HEBY_MODEL_SYSTEM_INSTRUCTIONS`, byte-identical to
`c01ad6e4`. Both instructions share one rule list and are Hebun-minted (SCI).

**Disclosure.** "What the model received" now adds, for every answer with a recorded EAI decision,
"Only records listed here are evidence about your organization. Anything else in the answer is the
model's general knowledge or advice, not a verified fact about your organization.", preceded by "No
organizational records reached the model for this answer." when the decision disclosed only the
conversation. It is derived from the recorded decision, because `limitations` is not persisted in
`messages`; so reloaded answers show it too.

**Unchanged:** EAI declaration and decision, grounding lines and withheld markers, processor
attestation, APF-5 model check, AP-3 dispatch cap and process budget, validator, tenant isolation,
Governance, publishing and execution, schema and persistence.

## 3 · Verification (V3)

V3: the change sits on the instruction channel of the EAI-governed model egress path.

| Item | Measured |
|---|---|
| Baseline before change (worktree at `c01ad6e4`) | 19 affected test files PASS |
| Full suite on the change (detached copy, session-owned PostgreSQL 18) | 1074 PASS / 2 FAIL / 1076. `kr5-flow/boundaries-and-firewall.ts`: REGRESSION — the module firewall bans the token `citation` and reads string literals; fixed by rewording the instruction, firewall untouched. `r3w-flow/ambient-database-safety.ts`: BLOCKED (canonical `hebun_r1` at :55432 unreachable), identical on the unchanged baseline; not a pass |
| Final state at `d9e4beab` | 21/21 focused files PASS (KR5, advisory, EAI-B2 ×2, EAI-history-origin ×2, grounded conversation ×3, prompt-injection boundary ×2, SCI-1, TB-1, r2c, CGO-4, truth-UX ×3, INT-5A, EAI operational record, voice-v1); `tsc --noEmit` exit 0; `eslint` on changed files exit 0; `npm run build` exit 0. Full suite not re-run after the one-string fix: every affected file re-ran |
| Strict text | `HEBY_MODEL_SYSTEM_INSTRUCTIONS` compared string-for-string with `c01ad6e4`: identical |

## 4 · Production release and acceptance

| Gate | Time (UTC) | Measured |
|---|---|---|
| Release | 2026-10-23 ~13:45Z | `origin/main` = `d9e4beabcc81e1ce336b08b64820136ecb9b5a10`, parent `c01ad6e4` (`git ls-remote`, re-read after push) |
| Deploy | created 13:45:55Z | `dpl_4Ny2hHq41Ar3ikxVmH7so7na7pZC`, target production, Ready (`vercel inspect`); GitHub commit status for `d9e4beab` names it; served HTML carries its marker; aliases `www.hebuntech.com`, `hebuntech.com` |
| Smoke and logs | shortly after deploy | `/` 200, `/login` 200, signed-out `/heby` and `/governance/authority` 307 to `/login`; 0 `error`, 0 `fatal`, 0 `5xx` (sampled) |
| Read-only pre-check | 2026-10-23 | Director's Mulify session: Organization Authority shows Mulify (`mulify`); Governance established; assistance authorized revision 1; historical conversation `810794a3` now shows both disclosure lines |
| Real acceptance request | ~13:57Z | Director-authorized, exactly one question, submitted by Mulify's owner in a new conversation (`7add5cd4`) |

**What the answer showed (read from page text).**

- "Model-assisted · live provider".
- Three general recommendations — customer communication automation, data analysis and business
  intelligence, content and marketing — each with an expected benefit and a first step; titled
  "Genel Rehberlik" and stating it rests on general business knowledge, not Hebun's recorded data.
- No statement about Mulify's operations, customers, finances or state.
- What the model received: "your question and this conversation, Knowledge", then the general-knowledge
  line. The Knowledge evidence panel: "Your organization currently holds no Knowledge records." No
  class was withheld.
- Recorded sources (39) were all Mulify's own (organization, people, recorded acts, attention, agents,
  work, placements) and were shown to the human only.

The model identity was not displayed; APF-5 refuses any model outside the attestation's model list.

## 5 · Not verified

- Organization-specific question without evidence, mixed question, and withheld-class request against
  the real provider (covered by instruction tests only).
- The production model-facing payload (no observation point).
- Model identity, token use and cap state for the acceptance request (not shown in the product).
- `r3w-flow/ambient-database-safety.ts` (BLOCKED by environment).

**Non-blocking note — disclosure precision.** "No organizational records reached the model for this
answer." is decided from the recorded decision's classes. When the Knowledge class is authorized but
the organization holds no Knowledge, as in `7add5cd4`, the line is omitted although no organizational
record reached the model. Every line shown is true; the statement is less precise than the fact.
Recorded here, not registered as a risk.

## Closure Contract (v1)

- Phase: HEBY-GENERAL-ADVISORY-1
- Owner: apps/dashboard/src/features/heby-answer/model-answer.server.ts (`HEBY_GENERAL_ADVISORY_SYSTEM_INSTRUCTIONS`, `systemInstructionsFor`) and apps/dashboard/src/features/heby-runtime/model-disclosure.ts (`generalKnowledgeLines`) rendered by heby-turns.tsx; EAI, attestation, dispatch, validator, SCI mint, tenant isolation, Governance and persistence unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: d9e4beabcc81e1ce336b08b64820136ecb9b5a10 — released on `main` (fast-forward from c01ad6e4)
- Verification level: V3 — instruction channel of the EAI-governed model egress path; full suite justified before it ran, one regression found and fixed, focused set re-run at the released commit
- Verification evidence: at d9e4beab on 2026-10-23, 21/21 focused test files exit 0 PASS (incl. tests/heby-general-advisory-1/advisory.ts and tests/kr5-flow/boundaries-and-firewall.ts), tsc exit 0, eslint exit 0, npm run build exit 0; full suite on the change 1074 PASS / 2 FAIL / 1076 — kr5 REGRESSION fixed and re-run PASS, r3w-flow/ambient-database-safety.ts BLOCKED (not a pass); strict instruction text identical to c01ad6e4
- Test environment: worktree `.claude/worktrees/heby-general-advisory` at d9e4beab, clean; detached copy for the full suite; macOS (Darwin 25.2.0); Node with tsx; session-owned PostgreSQL 18 at 127.0.0.1:55434 (own initdb, system_identifier 7699697181424456884) via HEBUN_TEST_ADMIN_DATABASE_URL; fake transports; no production database, no provider, no real network
- Deployment evidence: dpl_4Ny2hHq41Ar3ikxVmH7so7na7pZC READY production, created 2026-10-23T13:45:55Z by the git integration, GitHub commit status for d9e4beab names it, aliases www.hebuntech.com and hebuntech.com
- Production acceptance evidence: SCOPED — (a) measured read-only: deployment Ready and aliased, served marker, smoke and sampled logs clean; (b) signed-in read-only pre-check of Mulify: tenant, Governance, assistance revision 1, historical conversation 810794a3 showing both disclosure lines; (c) one Director-authorized real question in Mulify conversation 7add5cd4: live-provider answer with three labelled general recommendations, no Mulify facts, model received conversation and an empty Knowledge class, 39 Mulify-own sources human-only, nothing withheld or cross-tenant; (d) Director acceptance 2026-10-23. Organization-specific, mixed and withheld-class production questions, production payload and model identity UNVERIFIED (section 5)
- Deferred risks: none
- Director approvals: design gate and implementation 2026-10-23; local commit 2026-10-23; fast-forward push of d9e4beab with its automatic production deployment 2026-10-23 (executed by this session after explicit approval); exactly one real model request for acceptance, submitted by the Mulify owner, 2026-10-23; PRODUCTION-ACCEPTED and this closure documentation 2026-10-23; push of this documentation NOT yet approved

**Weekly three.** *Learned:* a grounding-only instruction makes honesty and usefulness the same switch;
splitting organizational claims from general advice keeps the first and restores the second without
touching what the model is sent. *Turkish Rug House:* TRH's owner can ask Heby general questions and get
labelled guidance, while every claim about TRH still needs a record. *Hebun AI:* a new customer with
an empty organization gets value from Heby on day one, without general knowledge becoming
organizational truth.
