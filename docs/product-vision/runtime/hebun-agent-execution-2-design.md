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
  specialist's draft and the coordinator's were the same model request with a different author id.

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

## 4 · Specialist execution

`prepareWorkArtifact` computes `specialist` from the author's mandate read and the server-derived scope (the
assignment seam's work scope; Operations is organization work, so never). `preparationBriefFor` then adds
`SPECIALIST_PREPARATION_BRIEF` — minted Hebun sentences, no interpolation — to the instruction channel for
every artifact type. No agent name and no domain name reaches the model: those are tenant-authored labels
(EAI class `organization`) and `assistance` × `organization` is not an allowed platform cell. The declared
data classes are unchanged (`work-artifact`). A coordinator's preparation is byte-identical to before.

## 5 · Verification

- `tests/agent-execution-2/specialist-delegation-postgres.ts` S1–S10, real PostgreSQL, fake transport
  captured at the provider boundary: roles and recommendation; the specialist's one model call carries the
  brief and no tenant name; revision authored by the specialist; linked by the person; waiting for review;
  Governance accepts; coordinator and organization work unchanged; two specialists or a busy one → no
  recommendation; other-domain agent, member without authority, other tenant → refused before the model;
  provider failure → nothing filed; Operations never framed as specialist.
- `tests/agent-execution-2/specialist-contract.ts` R1–R4: the rule, the minted brief, server derivation, wording.

## 6 · Limits, stated

- **Specialty is framing, not domain knowledge.** The model is told a specialist writes, not which domain.
  Naming the domain needs a Director data-use decision (`assistance` × `organization`) — the one change that
  would make the specialty concrete.
- **Real provider execution UNVERIFIED locally** (fake transport; no credentials read). Production
  acceptance needs one Director-approved live assignment to a specialist.
- AE-1's deferred risks stand unchanged, notably AE1-DRAFT-ACTION-CLAIM-RULE-1 (plan text withheld by the
  shared validator) and AE1-UNLINKED-SECOND-DRAFT-1 (an unlinked draft does not count as open, so a busy
  specialist whose draft is not yet linked can still be recommended).
- No schema, migration, Governance, provider or authentication change.

**Weekly three.** *Learned:* an agent's specialty already lives in its mandate's responsibility; it needs no
role field, only a rule that reads it, and it reaches the model as minted text because tenant names are a
class `assistance` may not carry. *Turkish Rug House:* when it registers a domain-only agent (research,
marketing), Heby names it as the work's specialist and that agent writes framed as one. *Hebun AI:* every new
specialist works through the one delegation path the moment its mandate is recorded.
