# CONTENT-AGENT-SPECIALIST-1 · closure record · VERIFIED (local) — ACTIVATION APPROVAL REQUIRED

**Scope, stated first.** Authorized by the Director on 2026-10-27 ("NEXT SPECIALIST AGENT", then "SAFE DISK
RECOVERY & CONTENT AGENT CONTINUATION"). The next specialist agent is a **Content Agent**. It needs **no new
product code**: it is a configuration of released authorities, and this phase proves the configuration end to
end on real PostgreSQL. Nothing was pushed, deployed or configured in production; no agent, mandate or domain
was created there; no real model or provider was called.

## 1 · Architecture decision

| | |
|---|---|
| Agent | Content Agent — a specialist for one organization's content work |
| Customer problem | Content is prepared, revised and published by a person with Heby as a general assistant; there is no specialist the organization can hold accountable for its content work, and no specialist recommendation for it |
| First real capability | The released `prepare-work-draft` for a `content-draft` with a declared destination, grounded on the organization's cleared public Knowledge (KT-5), and its revision from a Governance change request (HEBY-WORKFLOW-1) |
| Authoritative systems | Agent Identity; Agent Mandate (responsibility over a work scope); Work Domain Authority; Organizational Work (work scope, evidence references); Work Artifacts; Governance review; External-AI Data Use; Action Authorization publication state (CONTENT-WORK-OUTCOME-1) |
| Mandate | Proposal scope `set-work-declared-state` (the capability's condition admits it), responsibility `{ kind: "domain", workDomainId: <Content> }` only — never organization-wide |
| Human boundaries | A person chooses the agent; a person links the draft as evidence; Governance accepts or requests changes; publishing is a separate request, decision and permit; completion is a person's declaration |
| First workflow | Content work → Heby recommends the Content Agent → the person chooses it → Instagram caption draft → linked → changes requested → the agent revises → accepted → the outcome waits for publication |

Candidates weighed: **Customer Communication** needs deployment-armed external send and recipients per tenant
(TRH external send withdrawn); **Business Analysis** has no agent capability that reads organizational
evidence and would need new data-use classes; **Operations** is covered by Heby and the Engineering Agent.
Content is the only one whose whole chain is released and production-proven in parts (TRH publications,
CONTENT-WORK-OUTCOME-1).

## 2 · Gate

Every condition holds with released code: identity owner (`createDurableAgentIdentity`, `/agents`); mandate
and eligibility (`establishAgentMandateWithResponsibility`, the shared ceiling, AE-2 specialist rule); Heby
selection (`readWorkDraftChoices`); the capability (`assignWorkDraft` → `prepareWorkArtifact`, route
`/operations`, so a content draft takes KT-5 public Knowledge); work/artifact relation (WEV-1, person-linked);
Governance (review, change request, revision staleness keys); tenant from the session; outcome from the
ledger. **GO — no product code required.** One real constraint: the Work Domain writer has no product surface
by design (AP-4A Release A) — a domain is recorded by the operator ceremony.

## 3 · What changed (`3f387547`)

`tests/content-agent-specialist-1/workflow-postgres.ts` (new). No file under `src/` changed. Agent-authored
**content** drafts through `assignWorkDraft` were not exercised by any suite before (AE-1 and AE-2 prove plans).

## 4 · Verification (V1)

V1: no behaviour changed; the new test is the direct evidence. tsc covers the test (the Vercel build
type-checks `tests/`); no `src/` change, so build and an affected-suite regression were not run.

| Check | Result (2026-10-27) |
|---|---|
| `tests/content-agent-specialist-1/workflow-postgres.ts` | PASS — A1 another tenant: no choices, refused `work-unresolved`, nothing written; A2 registered without a mandate: not offered, refused `agent-not-eligible` before the model; A3 Heby offers only the Content Agent, as specialist, and recommends it (Engineering Agent and organization-only Heby not offered); A4 no agent → `agent-required`; A5 organization work and Engineering work refused before the model; A6 one model call with the content-draft brief, the Instagram destination sentence and the cleared public Knowledge fact, no agent name in the instruction channel, stored verbatim as `content-draft`/`instagram`, authored by the Content Agent, no request, permit or work change, nothing linked; A7 person-linked, awaiting review, in the outcome read; A8 change request → revision 2 by the Content Agent, awaiting review; A9 accepted → `publication-pending` on the register's rule and Heby's, no request filed; A10 provider failure → `not-prepared` / `provider-failed`, nothing written; A11 the Engineering Agent is still recommended for Engineering work and prepares a plan |
| `tsc --noEmit`, `eslint` on the test | exit 0 |

**The model is faked at the transport.** A6 and A8 prove what reaches the provider and what is stored; they
say nothing about the quality of a real model's caption. **Test environment.** macOS Darwin 25.2.0;
PostgreSQL 18.6 initialised by this session on 127.0.0.1:55499 (`system_identifier` 7701071965303287020) via
`HEBUN_TEST_ADMIN_DATABASE_URL`; `DATABASE_URL` unset; disposable database; no network.

**Disk.** The phase stopped once on ENOSPC (an `npm ci` failed). With Director approval three completed
worktrees were removed with plain `git worktree remove` after checks (registered, clean, HEAD in
`origin/main`, ignored files only `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`, no open files):
`eai-system-copy-1`, `content-work-outcome-1`, `heby-exec-coord-1`. Free space 555 MiB → 3.3 GiB.

## 5 · Production activation — Director-authorized steps, in order (not performed)

1. Preconditions in the target tenant: External-AI Data Use authorizes `assistance` for conversation,
   knowledge and work-artifact; at least one ratified Knowledge fact cleared for public use (KT-5).
2. Record the work domain: `npm run platform:work-domain -- --tenant=<slug> --create --slug=content --name="Content"`,
   dry run first, then `--confirm` (operator ceremony, Governance holder re-checked by the writer).
3. Register the identity: `/agents` → Agent name "Content Agent" with its reason (a Governance decision).
4. Record its mandate: `/agents` → proposal scope `set-work-declared-state`, responsibility the Content domain only.
5. Record content work with work scope = Content (a `record-work` request, approved and performed).
6. Acceptance: one Director-approved preparation from Heby on that work (a real model call), read back as a
   content draft authored by the Content Agent; publication remains its own request, decision and permit.

## Closure Contract (v1)

- Phase: CONTENT-AGENT-SPECIALIST-1
- Owner: apps/dashboard/tests/content-agent-specialist-1 (proof only); Agent Identity, Agent Mandate, Work Domain, Organizational Work, Work Artifacts, Governance review, External-AI Data Use and publication state unchanged
- Reached state: VERIFIED
- Implementation commit: 3f38754769599f6fbb1ca94635f33e480e85e97a — local branch feat/next-specialist-1 on 105755dd, not pushed
- Verification level: V1 — no behaviour changed; one new integration test is the direct evidence
- Verification evidence: 2026-10-27, tests/content-agent-specialist-1/workflow-postgres.ts A1–A11 PASS; tsc and eslint exit 0
- Test environment: worktree .claude/worktrees/next-specialist-1 (npm ci, published lockfile); macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701071965303287020, via HEBUN_TEST_ADMIN_DATABASE_URL; model faked at the transport; no production database, no provider
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not activated
- Deferred risks: CAS1-ACTIVATION-PENDING-1 (DEFERRED); CAS1-DOMAIN-OPERATOR-ONLY-1 (DEFERRED)
- Director approvals: local proof of a Content Agent on released authorities and a scoped cleanup of three completed worktrees, 2026-10-27; push, deployment, production agent, mandate or domain creation, model and provider calls NOT approved

### Deferred risk detail

- **CAS1-ACTIVATION-PENDING-1 (DEFERRED).** No Content Agent exists in any production tenant and no real
  model has written a content draft as one. Acceptance dependency: the §5 steps, each a Director decision.
- **CAS1-DOMAIN-OPERATOR-ONLY-1 (DEFERRED).** A tenant cannot record a work domain from the product (AP-4A
  Release A); every specialist needs one. Acceptance dependency: a Director decision to keep the operator
  ceremony or to give the released writer a product surface.

**Weekly three.** *Learned:* in this architecture an agent is data — identity, mandate, domain — and its
specialty is its responsibility, so the next specialist is a configuration to prove, not code to write.
*Turkish Rug House:* TRH can have a Content Agent accountable for its captions, recommended by Heby for
content work, without any new code. *Hebun AI:* the first specialist outside Engineering, proven on the
same seams, with publication as the outcome rather than acceptance.
