# AGENT-EXECUTION-2 · closure record · PRODUCTION-ACCEPTED (scoped)

**Scope, stated first.** Heby recognises the specialist agent responsible for a work item, recommends it with
a stated reason, leaves the choice to the person, and the chosen agent's draft is written by a real model
call, filed with the agent as its author, linked to the work by the person and left for Governance review.
This milestone verifies **specialist selection, delegation and authorship**. It does **not** show that the
model has domain expertise: no agent or domain identity reaches the model, and the draft is shaped by the
artifact type's preparation contract, not by the specialty. No multi-agent orchestration, autonomous
execution or Governance approval is part of it. Design and root cause: `hebun-agent-execution-2-design.md`.

## 1 · Problem

- **Specialist delegation was a label.** AE-1 let a person assign any responsible agent a draft, but Heby
  could not say which agent was the work's specialist, and a specialist's draft was the same model request
  as the coordinator's with a different author id.
- **Internal drafts were not draftable (found during acceptance).** `operational-plan` and `message-draft`
  had no preparation brief and were prepared under the strict answer rule alone ("answer using only the
  GROUNDING CONTEXT", "say so plainly" when insufficient). A plan of general professional steps was declined.

## 2 · What was released

- **`63bab3de` — specialist selection.** `agentWorkRole` (pure, in `agent-work/capabilities.ts`) reads the
  mandate the shared ceiling already admitted: for domain work, an agent responsible for that domain and not
  organization-wide is the specialist; an organization-wide agent is the coordinator. `readWorkDraftChoices`
  returns each agent's role and `recommendedAgentId` (the work's only specialist with no draft waiting);
  the result carries `agentRole`. Heby states the reason and never preselects. The same commit added a
  domain-less `SPECIALIST_PREPARATION_BRIEF` — withdrawn by `ae610f86` (section 5).
- **`ae610f86` — withdrawal.** `preparation-brief.ts` and `prepare-work-artifact.server.ts` returned to
  their AE-1 bytes; specialist and coordinator receive the same instructions.
- **`74a13247` — internal draft contract.** `INTERNAL_DRAFT_PREPARATION_BRIEF` (minted, instruction only,
  no material) for plans and messages: the reply is the draft; statements about the organization need the
  grounding; general professional practice may be used as guidance, never as a record or evidence; a missing
  fact is a bracketed placeholder, not an invention or a refusal; no act is described as having happened;
  earlier drafts are data, not precedent. The content-draft brief (CGO-4, GS-2, KT-5) is unchanged.
- No schema, migration, data-use class, mandate, Governance, provider, tenant or authentication change.

## 3 · Verification (V2)

V2: a shared seam (the preparation brief every preparation path uses) and Heby's agent-choice read changed;
no authority, tenant or lifecycle boundary moved, so bite-proofs of the touched seams and the affected
suites were run, not the full suite.

| Check | Result |
|---|---|
| `tests/agent-execution-2/specialist-delegation-postgres.ts` S1–S10, real PostgreSQL, fake transport captured at the provider boundary | PASS at `74a13247` — roles and recommendation; the instruction channel carries the strict rules and the internal-draft brief, identical for specialist and coordinator, with no specialist claim and no agent or domain name; specialist authorship; link by the person; awaiting review; Governance accepts; two specialists or a busy one → no recommendation; other domain, member without authority, other tenant → refused before the model; provider failure → nothing filed |
| `tests/agent-execution-2/specialist-contract.ts` R1–R5 | PASS — the role rule; no role claim to the model; no role from the client; Heby's wording; every sentence of the internal-draft brief and a strict content draft |
| Affected suites (108 files: preparation seam, brief, agent-work, Heby affordance, answer flow) | 108/108 at `63bab3de`, and 108/108 at `74a13247` after three pins changed with stated reasons (cgo4: plans/messages now briefed; cgo7, cgo9: assert the observation and revision text never attach to plans/messages) |
| Bite-proofs | AE-1 5/5, cgo9 7/7 at `74a13247` |
| `tsc --noEmit`, `eslint` on changed files, `git diff --check`, `npm run build` | PASS at `63bab3de`, `ae610f86` and `74a13247` |
| Full suite | Not run (V2); last full-suite baseline is AE-1's 1090/1091 at `106e54bd` |
| Process defect | An affected-suite loop was first run in the edited tree; killing it left int5c's in-place mutation in `knowledge/external-reference-read.server.ts` (a removed `withdrawnAt` filter). It was restored from HEAD before anything was committed, own diff re-checked line by line, and every later run used a disposable detached worktree |

## 4 · Production release

| Commit | Push | Deployment | GitHub deployment |
|---|---|---|---|
| `63bab3de` | `87bfd4f6..63bab3de` fast-forward | `dpl_C5HpjtegicqACSeBZ1Z5YAAws4FR` READY, automatic | `7317136817` success |
| `ae610f86` | `63bab3de..ae610f86` fast-forward | `dpl_7TAEE5PJHoAU3gjjDboSFmX2RxyM` READY, automatic | `7317312365` success |
| `74a13247` | `ae610f86..74a13247` fast-forward (first attempt reported "failed to push some refs", cause not captured; the second succeeded) | none created by the Git integration; created from the project's Git connection with the SHA pinned (Vercel API `gitSource`, repoId 1300480452, ref `main`): `dpl_23ECL9a6FhhbMAhxx51REpwVmo44` READY, metadata `githubCommitSha` = `74a132473f5990cb101a2d2b4b510c96c0cfc314` | `7317823879` success |

Aliases on `dpl_23ECL9a6FhhbMAhxx51REpwVmo44`: `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app`,
`hebun-ai-recovered-hebuntechs-projects.vercel.app`, `hebun-ai-recovered-git-main-hebuntechs-projects.vercel.app`.
Signed out: `/`, `/login` 200; `/heby` 307 → `/login`. Runtime logs read only to attribute one request to its
deployment (section 5, acceptance 3).

## 5 · Production acceptance (2026-10-25)

Built-in browser, a session the Director signed in themselves, tenant hebun (agents Engineering Agent
`670a6889…`, Heby `4ffeeb83…`). Each model call was approved individually by the Director.

| # | Deployment | Work item | Observed | Verdict |
|---|---|---|---|---|
| 1 | `63bab3de` | AP-4B Production Acceptance Test `92e70b3e` | Recommendation and roles shown, choice empty; one call → artifact `98904a8e-e1c7-422f-bfee-354f88bac798@1` by Engineering Agent, linked, awaiting review — but the text declines the task ("You've asked me to write as a specialist agent … please provide the specialist agent's name") | FAIL — the domain-less specialist brief |
| 2 | `ae610f86` | `92e70b3e` | "Every agent responsible for this work already has a draft on it waiting for review": AE-1's open-draft rule, held by artifact 1; no call | BLOCKED (rule working) |
| 3 | `ae610f86` | AP-5 two-agent origination acceptance check `5ba33201` | One call, served by `dpl_7TAEE5PJ…` (runtime log) → artifact `ea1433b4-913a-49a0-80d4-38413839d3b9@1`, a decline ("I cannot prepare that checklist as a specialist work item … general engineering guidance"); not linked | FAIL — no internal-draft contract; artifact 1 in the grounding |
| 4 | `74a13247` | `5ba33201` | Recommendation with reason, choice empty, Engineering Agent chosen by the person; one call → `prepared`; artifact `d71f8383-da78-4637-8e09-e4b820f5ded2@1`, `operational-plan`, "written by Engineering Agent" on Heby; content read before linking: three steps (technical completeness, accuracy and consistency, clarity and usability), each with "What to check" and "Evidence to record", no claim that a review happened, no organizational claim; linked by the person ("Declared evidence for: AP-5 two-agent origination acceptance check"); "Governance review of revision 1: Awaiting review"; work still declared planned; Prepared work 10 → 11 | **PASS** |

The two declines (`98904a8e@1` linked to `92e70b3e`, `ea1433b4@1` unlinked) are **not task outputs**. Both
await Governance review and were not retired, deleted or reviewed. Operations names the author only as "this
organization's durable agent"; the agent's name is shown on Heby's draft list.

## 6 · Not verified in production

- That the specialty changes the draft: by design it cannot; no agent or domain identity reaches the model.
- The internal-draft brief on a message draft and on the Operations path; concurrency and mid-call mandate
  withdrawal (AE-1 E14–E16, local only).
- Why the Git integration did not deploy `74a13247` (AE2-VERCEL-GIT-TRIGGER-1).

### Deferred risk detail

- **AE2-RECOMMENDATION-WORDING-1 (DEFERRED).** Heby's recommendation ("… so it writes as this work's
  specialist") and the result message ("Engineering Agent, as this work's specialist, wrote the draft")
  overstate the model's behaviour: the role is selection and attribution only. Dependency: a Director-selected
  wording change.
- **AE2-DECLINED-DRAFT-FILED-1 (DEFERRED).** A model reply that declines the task is filed as prepared work.
  The observed declines were ordinary prose; only a phrase filter could catch them, and none is added. The
  provider's `stop_reason: "refusal"` is carried on `ModelGenerationResult` but read nowhere on the answer
  path, and would not have caught these. Dependency: a Director decision.
- **AE2-DECLINE-GROUNDING-1 (DEFERRED).** Every live draft's current revision enters later preparations'
  grounding (400-character excerpt, labelled "authored by: agent"), declines included; the first decline was
  present when the second was written. The internal-draft brief says earlier drafts are data, not precedent;
  nothing excludes them. Dependency: a Director decision — retiring the two declines (a lifecycle act) or a
  grounding rule.
- **AE2-VERCEL-GIT-TRIGGER-1 (DEFERRED).** The `74a13247` push created no Vercel deployment and no GitHub
  status or check, unlike the two pushes before it; the first push attempt reported an error whose cause was
  not captured. GitHub App deliveries were not readable with the available credentials. Dependency: a
  read of the Vercel GitHub App deliveries, and checking the deployment record on the next push.
- **AE2-DOMAIN-SPECIALTY-1 (DEFERRED).** The model is not told the agent's domain: agent and domain names are
  `organization`-class data, which `assistance` may not carry; a domain-less claim failed (acceptance 1).
  Dependency: a Director data-use decision (`assistance` × `organization`) before any specialty reaches the model.

**Carried from AE-1, unchanged and still DEFERRED** (rows in §22 under AGENT-EXECUTION-1):
AE1-WITHHELD-DIAGNOSABILITY-1, AE1-DRAFT-ACTION-CLAIM-RULE-1 (the accepted checklist names "approval
decision" as evidence to record; it was not withheld), AE1-ASSIGN-UI-WORDING-1 (the button now reads "Assign
to the agent" before a choice), AE1-MEDIA-AUTHORSHIP-MANDATE-1, AE1-UNLINKED-SECOND-DRAFT-1 (an unlinked draft
is not "open", so artifact 3 did not block acceptance 4), AE1-NONMEMBER-TENANT-COMPAT-1.

**Weekly three.** *Learned:* an agent's specialty is already in its mandate; a role the model cannot ground
makes it decline, and every draftable type needs its own preparation contract separating organizational
claims from general practice. *Turkish Rug House:* a domain-only agent it registers is recommended as that
work's specialist and its internal plans are drafted from general practice with placeholders for missing
facts, never invented ones. *Hebun AI:* delegation to any specialist runs through the one AE-1 path, and
internal plans and messages are now useful drafts rather than declines.

## Closure Contract (v1)

- Phase: AGENT-EXECUTION-2
- Owner: Agent work capability (`agent-work/capabilities.ts` role rule, `assign-work-draft.server.ts` choices and result), Work Artifacts preparation brief (`preparation-brief.ts`), Heby work-draft affordance; composing AE-1's assignment seam, the shared mandate ceiling, Organizational Work (WEV-1) and Governance review
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 63bab3de06348166457a7bd891cc978b0b122401, ae610f86b3d93570d78667b29703ff98c5f25b8f, 74a132473f5990cb101a2d2b4b510c96c0cfc314
- Verification level: V2 — a shared seam (the preparation brief of every preparation path) and Heby's agent-choice read; no authority, tenant or lifecycle boundary changed
- Verification evidence: specialist-delegation-postgres S1–S10 PASS; specialist-contract R1–R5 PASS; 108 affected files PASS at 63bab3de and at 74a13247 (three pins changed with stated reasons); AE-1 bite-proofs 5/5 and cgo9 bite-proofs 7/7; tsc, eslint, diff --check and npm run build PASS at each commit; full suite not run (V2)
- Test environment: worktree `.claude/worktrees/agent-execution-2` (base 87bfd4f6); disposable detached worktrees `ae2-candidate`, `ae2-fix-candidate`, `ae2-brief-candidate` (removed after use); macOS Darwin 25.2.0; Node 24.16.0 with tsx; PostgreSQL 18 at 127.0.0.1:55433 via HEBUN_TEST_ADMIN_DATABASE_URL with harness-created databases; fake model transport; no production database or provider
- Deployment evidence: dpl_23ECL9a6FhhbMAhxx51REpwVmo44 — READY, production, githubCommitSha 74a132473f5990cb101a2d2b4b510c96c0cfc314, created from the project Git connection with the SHA pinned after the Git integration created none; GitHub deployment 7317823879 success; aliased to www.hebuntech.com and hebuntech.com; earlier dpl_C5HpjtegicqACSeBZ1Z5YAAws4FR (63bab3de) and dpl_7TAEE5PJHoAU3gjjDboSFmX2RxyM (ae610f86)
- Production acceptance evidence: SCOPED — Director-opened session, tenant hebun, on dpl_23ECL9a6FhhbMAhxx51REpwVmo44 (section 5, acceptance 4): Heby recommended Engineering Agent with its reason, the person chose it, one real model call returned prepared, artifact d71f8383-da78-4637-8e09-e4b820f5ded2 revision 1 (operational-plan) authored by Engineering Agent holds a three-step checklist with what to check and evidence to record per step and no claim of a completed review, linked by the person to work item 5ba33201 and shown Awaiting review, work state unchanged; acceptances 1 and 3 FAIL (declines 98904a8e and ea1433b4, untouched) and 2 BLOCKED by AE-1's open-draft rule; specialty does not reach the model
- Deferred risks: AE2-RECOMMENDATION-WORDING-1 (DEFERRED); AE2-DECLINED-DRAFT-FILED-1 (DEFERRED); AE2-DECLINE-GROUNDING-1 (DEFERRED); AE2-VERCEL-GIT-TRIGGER-1 (DEFERRED); AE2-DOMAIN-SPECIALTY-1 (DEFERRED)
- Director approvals: AGENT-EXECUTION-2 mandate and local commit 63bab3de 2026-10-25; push and production deployment of 63bab3de and removal of ae2-candidate 2026-10-25; live acceptance on 92e70b3e with one model call 2026-10-25; acceptance fix and local commit ae610f86 2026-10-25; push and deployment of ae610f86 and removal of ae2-fix-candidate 2026-10-25; acceptance on 92e70b3e (blocked) and on 5ba33201 with one model call each 2026-10-25; read-only root-cause analysis 2026-10-25; internal draft preparation fix and local commit 74a13247 2026-10-25; push and deployment of 74a13247, removal of ae2-brief-candidate, and deployment through the project Git connection with the SHA pinned 2026-10-25; final acceptance on 5ba33201 with one model call 2026-10-25; PRODUCTION-ACCEPTED (scoped), closure documentation and one local documentation commit with the five follow-ups left open 2026-10-25
