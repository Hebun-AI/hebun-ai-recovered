# AGENT-EXECUTION-2 · real specialist delegation · design record

Baseline `87bfd4f6` (origin/main, AGENT-EXECUTION-1 PRODUCTION-ACCEPTED). Not a closure record; release
evidence is written in the closure after a Director-authorized release.

## 1 · What AE-1 already delivered, and the gap

AE-1 shipped the whole vertical path: `/heby?workItem=` → choose a responsible agent → `assignWorkDraft`
(tenant, work, Governance authority, shared mandate ceiling, advisory lock, all before the model) →
`prepareWorkArtifact` (one model call under the EAI gate, revision authored by the agent) → the person links
it (WEV-1) → Governance review. No second execution path is needed and none is added.

Two gaps made "specialist" delegation a label only:

- **Heby did not know who the specialist was.** Every responsible agent was listed alike; nothing said which
  one the work's kind of work belongs to.
- **The model never knew a specialist was writing.** The agent identity supplied authorship only: a
  specialist's draft and the coordinator's were the same model request with a different author id. This gap stays
  open after the acceptance fix (section 4).

## 2 · Agent chosen, and why

The roadmap names a Research Agent first. The durable registry has no role field and no Research Agent
exists in any measured tenant (hebun: Heby, Engineering Agent; TRH: Heby; Mulify: none); registering one is a
Governance decision this phase does not make. An agent's specialty is what its mandate already records: its
**responsibility**. So the specialist is defined by that, not by a name, and the same code serves an
Engineering Agent today and a Research Agent the day one is registered. Production acceptance can use the
hebun Engineering Agent on an Engineering-scoped work item.

## 3 · The rule (server-side, explainable)

`agentWorkRole(mandate, workScope)` in `agent-work/capabilities.ts`, pure, asked of the same mandate read the
ceiling admitted:

- **specialist** — the work has a domain scope and the agent's responsibility has no organization-wide grant;
- **coordinator** — everything else (organization work; an organization-wide agent even when it also holds the
  domain; an unread mandate).

`readWorkDraftChoices` returns each eligible agent's role and `recommendedAgentId`: the work's only specialist
when it has no draft waiting; otherwise `null` and the person chooses. Heby says why in one sentence and
never preselects (AP-5A: the agent control has no default). The recommendation grants nothing; the
assignment re-checks whichever agent is sent.

## 4 · Specialist execution — what reaches the model

`63bab3de` added a minted `SPECIALIST_PREPARATION_BRIEF` ("write as the specialist …") without naming the
domain, because agent and domain names are EAI class `organization`, which `assistance` may not carry.
Production acceptance (2026-10-25, work `92e70b3e`, one model call) showed that a domain-less specialist
claim breaks the task: the model declined ("You've asked me to write as a specialist agent … please provide
the specialist agent's name or role identifier"), and that text was filed as artifact
`98904a8e-e1c7-422f-bfee-354f88bac798@1`. It is **not a task output**; it is linked to the work and awaits
Governance review, and is left untouched (no retire, delete or review).

The acceptance fix removes the brief. `preparation-brief.ts` and `prepare-work-artifact.server.ts` are
byte-identical to AE-1 (`87bfd4f6`): a specialist's preparation and the coordinator's send the provider the
same system instructions. The role stays Heby's and the person's — the recommendation, the role in the
choices and in the result, attribution on the revision — and never becomes a claim to the model.

### 4.1 · Internal draft preparation (root cause of both declines)

Root cause (request construction VERIFIED in code and by a local reproduction; the model's reasoning is
UNVERIFIED — production does not store prompts): `operational-plan` and `message-draft` had no preparation
brief, so they were prepared under the strict rule alone — "Answer the USER REQUEST using only the GROUNDING
CONTEXT", "If the context is insufficient, say so plainly", "you produce advisory text only" — and nothing
said the reply is the draft. A plan of ordinary professional steps needs no organizational fact, so the model
called its context insufficient. Both declines say exactly that ("general engineering guidance"). The second
call's grounding also carried the first decline (every live draft's current revision, 400-character excerpt),
the likely source of its "specialist" wording. History was empty; no agent, domain or UI wording reached the
provider.

Fix: `INTERNAL_DRAFT_PREPARATION_BRIEF` (minted, instruction only, no material) for plans and messages. The
reply is the draft; statements about the organization still need the grounding; general professional
practice may be used as guidance, never as a record or evidence; a missing fact becomes a bracketed
placeholder instead of an invention or a refusal; no act is described as having happened; earlier drafts in
the grounding are data, not precedent. Content drafts keep their own brief; data classes, mandate, Governance
and tenant boundaries are unchanged. The two decline artifacts (`98904a8e@1` linked, `ea1433b4@1` unlinked)
are not task outputs, await review, and are untouched.

## 5 · Verification

- `tests/agent-execution-2/specialist-delegation-postgres.ts` S1–S10, real PostgreSQL, fake transport
  captured at the provider boundary: roles and recommendation; the specialist's one model call carries the
  same system instructions as the coordinator, no specialist claim and no tenant name; revision authored by the specialist; linked by the person; waiting for review;
  Governance accepts; coordinator and organization work unchanged; two specialists or a busy one → no
  recommendation; other-domain agent, member without authority, other tenant → refused before the model;
  provider failure → nothing filed; Operations prepared as AE-1.
- `tests/agent-execution-2/specialist-contract.ts` R1–R4: the rule, no specialist claim in the brief or seam,
  no role from the client, wording.

## 6 · Limits, stated

- **Specialty is selection and attribution, not model behaviour.** The model is told nothing about the role.
  Making the specialty shape the draft needs a Director data-use decision (`assistance` × `organization`)
  so the domain can be named — a domain-less claim was tried and failed in production.
- **AE2-DECLINED-DRAFT-FILED-1 (DEFERRED).** A model reply that declines the task is filed as prepared work.
  No reliable signal exists for the observed case (ordinary prose; only a phrase filter could catch it, and
  none is added). The one reliable existing signal, the provider's `stop_reason: "refusal"`, is carried on
  `ModelGenerationResult` but read nowhere on the answer path; wiring it changes the shared Heby answer seam
  for every intent and would not have caught this case. Dependency: a Director decision.
- **Real provider execution UNVERIFIED locally** (fake transport; no credentials read). Production
  acceptance needs one Director-approved live assignment to a specialist.
- AE-1's deferred risks stand unchanged, notably AE1-DRAFT-ACTION-CLAIM-RULE-1 (plan text withheld by the
  shared validator) and AE1-UNLINKED-SECOND-DRAFT-1 (an unlinked draft does not count as open, so a busy
  specialist whose draft is not yet linked can still be recommended).
- No schema, migration, Governance, provider or authentication change.

**Weekly three.** *Learned:* an agent's specialty already lives in its mandate's responsibility; it needs no
role field, only a rule that reads it; a role claim the model cannot ground (no domain name) makes it
decline the task, so the role stays in selection and attribution. *Turkish Rug House:* when it registers a domain-only agent (research,
marketing), Heby names it as the work's specialist and the draft is attributed to it. *Hebun AI:* every new
specialist works through the one delegation path the moment its mandate is recorded.
