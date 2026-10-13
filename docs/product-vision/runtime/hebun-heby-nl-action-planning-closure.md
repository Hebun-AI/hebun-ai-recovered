# HEBY NATURAL-LANGUAGE ACTION PLANNING · closure record · PRODUCTION-ACCEPTED

An ordinary Heby message that plainly asks for an organizational action plan now runs the released,
rule-based `/plan` read (877514de) instead of the model. The slash command is no longer required.
This phase adds routing only. Planning stays deterministic and no model writes the plan. That is
stated on the surface ("No model wrote this plan") and stays true here.

## 1 · What changed

| Part | Where | What |
|---|---|---|
| Recognition | `apps/dashboard/src/features/heby-commands/plan-intent.ts` (`recognizePlanIntent`) | Pure, deterministic, client-side, before the one model dispatch. A planning phrase plus a work word (`departman`, `işler`, `work`) → `plan`. An explicit planning phrase alone → `plan-if-department`. A department name alone, open questions without a work word, and ordinary conversation → `none`. A work-domain mention → refused locally (`/plan` filters by department only). |
| Department resolution | `resolvePlanDepartment`, called inside the `/plan` read | Server-side, against Organization Authority's one read seam (`readOrganizationAuthority`). A whole in-service department name or slug must appear as consecutive words. Two named → ask which. None → ask, listing the departments in service. Unreadable → say so. Work is read only after resolution. |
| Fallback | `use-heby-conversation.ts` | `plan-if-department` naming no department → the read answers `no-department-named` and the message goes to the conversation as the user's own text, as before. |
| Plan | unchanged | Same handler, same reads (`readWorkRegister`, `readOriginationAvailability`), same `composeActionPlan`. One preface line names the resolved department. `/plan` typed directly is byte-for-byte the old path. |

No schema, migration, dependency, provider scope, Governance authority or EAI-B2 change. Two firewall
censuses were extended with a stated reason: the L3 consumer list gains the `/plan` read, and the
voice-v1 gate check accepts `let parsed`.

## 2 · Verification

- `tests/heby-org-action-planning/natural-language.ts` and `action-plan.ts`: PASS. They cover Turkish
  and English intent, a department named without a department word, ordinary conversation,
  unknown/ambiguous/retired/partial department, an unreadable structure, department vs work domain,
  the fallback contract, `/plan` unchanged, a read plan carrying no prompt, recognition before the
  model dispatch, a recognizer with no runtime import, and session-tenant-only reads.
- 120 suites that import or scan the touched seams were run one by one. 29 failures remain, and each
  fails with the same first assertion on a clean worktree at 877514de: migration-ledger counts,
  `drizzle-kit migrate` without a database, censuses already red at baseline. No new failure.
- `tsc --noEmit` exit 0; `eslint` on every touched file exit 0; `git diff --check` exit 0.

## 3 · Release and production acceptance (2026-10-13)

- Preflight: `origin/main` at the expected 877514de; candidate was a fast-forward; diff limited to the
  8 phase files. Push `877514de..64ffae70`, no force. `git ls-remote origin refs/heads/main` →
  `64ffae700d95975aacbea73ad07c5570285ba52c`.
- Vercel `dpl_J6wo4XGH32cpf22UNr9qfskimcPi`, project `hebun-ai-recovered`, target production, READY.
  Deployment meta commit `64ffae700d95975aacbea73ad07c5570285ba52c`. Aliases `www.hebuntech.com` and
  `hebuntech.com` (`vercel inspect`).
- Authenticated browser on `https://www.hebuntech.com/heby`, read-only:
  - "Engineering için aksiyon planı hazırla." → "Action plan · Engineering" over this tenant's
    records: 3 items in service, 2 with no accountable human, 2 not updated in 30+ days, delay status
    Unavailable, every priority "Recommendation only", nothing proposed.
  - "Engineering departmanı için aksiyon planı hazırla." → the same plan.
  - Each message produced exactly one server-action POST, whose response body is the `/plan` read
    result (`status: ok`). No model-answer request, no new conversation message, no Governance write.
  - The deployed client chunk contains the recognizer, the `natural-language-if-department` fallback
    and the work-domain check. The conversation fallback was proved by test, not by a live model call.
  - 375×812: document width 375, no horizontal overflow, the plan card scrolls inside itself. Console
    errors: none.

## 4 · Limits (not defects)

- A Turkish suffix without an apostrophe ("Pazarlamanın") does not match a department name. A
  department recorded under one language is not found by its translation.
- Nested names ("Customer Success" and "Success") are reported as ambiguous and Heby asks.
- The plan is a command result, not a persisted conversation message.
- An explicit planning phrase costs one Organization Authority read even when it turns out to name
  no department.
- This is not multi-step AI reasoning. Work and organization records are not disclosed to the external
  model for assistance under the recorded platform policy.

## Closure Contract (v1)

- Phase: HEBY-NL-ACTION-PLANNING
- Owner: apps/dashboard/src/features/heby-commands (plan-intent.ts, read-commands.server.ts `/plan` handler) + the Heby submission gate use-heby-conversation.ts
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: a6b5cfa0f5640dbbf84e915e51e21fc3ae351006, 64ffae700d95975aacbea73ad07c5570285ba52c
- Verification level: V2 — a shared seam: the single Heby submission gate and the `/plan` read gain a routing path and an Organization Authority read. All suites importing or scanning those seams were run; tenant and model-disclosure effects are reviewed in §1–§3. Not V3: no authority, schema, provider, execution or EAI-B2 boundary changed, so the full suite was not run.
- Verification evidence: `node --import tsx tests/heby-org-action-planning/natural-language.ts` and `action-plan.ts` exit 0; 120 related suites run individually, 29 failures, each with the same first assertion on a clean 877514de worktree, 0 new; `tsc --noEmit` exit 0; `eslint` on touched files exit 0; `git diff --check` exit 0
- Test environment: worktree `.claude/worktrees/nl-plan` (877514de + phase changes) and a detached baseline worktree at 877514de; macOS (Darwin 25.2.0); tsx from the shared `apps/dashboard/node_modules`; no database for the focused tests
- Deployment evidence: Vercel `dpl_J6wo4XGH32cpf22UNr9qfskimcPi` (hebun-ai-recovered, production, READY, meta commit 64ffae70), aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: 2026-10-13, authenticated browser at https://www.hebuntech.com/heby; both Turkish phrasings returned the Engineering `/plan` result from tenant records via one read POST each, with no model request, no conversation write and no Governance mutation; 375px without overflow; no console errors
- Deferred risks: none
- Director approvals: implementation and a focused local commit (HEBY NATURAL LANGUAGE ACTION PLANNING brief, 2026-10-13); the narrow intent fix, fast-forward push to main and production deployment (FINAL UX FIX + PRODUCTION RELEASE brief, 2026-10-13); read-only production acceptance (Director, 2026-10-13); this closure record as scoped documentation (HEBY MULTI-STEP AGENT PLANNING brief, 2026-10-13) — committed locally, push NOT approved
