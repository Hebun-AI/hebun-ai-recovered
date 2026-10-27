# CONTENT-AGENT-SPECIALIST-1 · closure record · PRODUCTION-ACCEPTED (scoped) — first Content Agent draft accepted in Hebun

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

## 6 · Release and activation readiness (2026-10-27)

Authorized by the Director ("CONTENT AGENT — CONTROLLED RELEASE & PRODUCTION ACTIVATION READINESS"): release
the test and record, then check the Hebun tenant read-only. Activation itself was not authorized.

**Release.** Remote `main` read as `105755dd` before push; `3f387547` and `d87fb505` its descendants, 4 files,
no `src/`. Re-verified before push: A1–A11 PASS, continuity PASS, `git diff --check`, `tsc --noEmit`, `eslint`
on the test exit 0, worktree clean. Fast-forward push `105755dd..d87fb505` (no force). Vercel Git deployment
`dpl_DXfMjijQfYAdj8yAHAE5ZecTpoVu` (commit `d87fb505`, target production, Ready, created 14:42:53 +03);
`alias ls` binds `www.hebuntech.com`, `hebuntech.com`, `hebun-ai-recovered.vercel.app` to it. Smoke: `/` 200,
`/login` 200, apex 308 → www, `/agents` 307 → `/login`; no 5xx in the runtime log sample. Test environment:
PostgreSQL 18.6 initialised UTF8 (`initdb --no-locale -E UTF8`) on 127.0.0.1:55499, `system_identifier`
7701311585024195437; a `--no-locale` cluster without `-E UTF8` is SQL_ASCII and the migrations fail on
`pg_c_utf8`.

**Readiness — classification.**

| Prerequisite | State | Evidence |
|---|---|---|
| Tenant identity (Hebun) | BLOCKED | The only session available to this run (the built-in browser) is signed out; `/agents` redirects to `/login`. Signing in or reading production credentials was not authorized |
| External-AI Data Use `assistance` × conversation, knowledge, work-artifact | UNVERIFIED | Not readable without a tenant session; earlier records are history, not current state |
| Provider capability (Anthropic) available | UNVERIFIED | Same |
| Ratified Knowledge cleared for public use (KT-5) | UNVERIFIED | Same |
| `content` work domain | UNVERIFIED | The operator ceremony dry run needs production database access; not run |
| Content Agent identity / mandate | UNVERIFIED | `/agents` not readable |
| Heby selection, content-draft preparation, revision, Governance review, publication state | VERIFIED (code) | Released seams, exercised by A1–A11 on `d87fb505`; production behaviour of a real model is not claimed |

**Decision: ACTIVATION BLOCKED** — tenant identity, Governance, Knowledge, domain, identity and mandate are
unmeasured in production. Nothing was created, decided, called or published.

## 7 · Production activation and acceptance — Hebun (2026-10-27)

Every step below was a separate, explicit Director authorization, performed through the released product
surfaces in a session the Director signed in to (no credential entered by this session), except the domain
ceremony's `--confirm`, which the Director ran in their own terminal. Each result was read back from
production after the write. No code was changed and nothing was deployed for this section.

| Step | Authoritative surface | Result read back |
|---|---|---|
| Public Knowledge | `/knowledge` create → ratify v1 → allow public factual use v1 | `identity/hebun-public-product-overview`, `policies/hebun-public-human-governance`, `systems/hebun-public-agent-architecture`, each v1 ratified (decisions `8db923eb`, `59bdb33b`, `9a85ba93`) and "Allowed as public factual grounding"; statements byte-identical to the reviewed draft (SHA-256 checked); the internal test record left without a public-use decision |
| Work domain | `platform:work-domain` (list + dry run here; `--confirm` by the Director) | `content` · in service · "Content", `5dab5ad5-7511-4ede-bbbb-ef54311ca36a`; `engineering` unchanged; 2 domains |
| Department | `/director/organization` (Organization Structure Authority) | Content · `content` · in service, `0bcc14e8-61c2-4873-ba0e-20f7ca6633cc` — needed because a work proposal requires a department |
| Identity | `/agents` registration | Content Agent `017002fb-fcc9-43ea-894f-db98e2f79121`, in service, owned by the Director |
| Mandate | `/agents` mandate | revision 1, ceiling `set-work-declared-state`, responsible for Content only; decision `69768a6e-8400-41e9-a792-f6bdaf425bcc`; Engineering Agent (rev 1) and Heby (rev 5) unchanged |
| Content work | `/director/work` propose → `/approvals` authorize (1 h) → execute | request `c7aa9d55-62b5-4408-a29a-a750e5fda90b`, permit `d3a31839-242f-44e2-8a16-ffd0fb5ba9f1` consumed 13:14:58Z; work `135c3773-5d7a-49f6-a143-c525e7d6f9f2`, declared planned, department and scope Content |
| Draft rev 1 | Heby → Prepare a draft (Content Agent offered as this work's specialist, Engineering Agent and Heby not eligible) | content-draft for Instagram, artifact `94569529-4a73-4f1b-8dd9-a767e4b5ee81`, authored by Content Agent; all 3 public-eligible Knowledge records supplied whole (bounded universe) |
| Review rev 1 | `/operations` request changes | three statements exceeded the Knowledge (an aim stated as a fact, "every act is recorded permanently", "transparent") |
| Link | `/director/work` → Concerns → Document | the draft declared as the work's evidence by the Director |
| Rev 2 | Heby → change request → Content Agent | authored by Content Agent; changes requested again (two narrower claims) |
| Rev 3 | Heby → change request → Content Agent | authored by Content Agent, 479 characters, 2 hashtags, every sentence traceable to the three records; **accepted for next internal step** |
| Outcome | `/director/work`, `/approvals` | work register: "revision 3 · current revision accepted for the next internal step · no publication of this revision accepted by the provider yet"; no publication request, no new permit, pending requests unchanged (5) |

Three real model calls (rev 1, 2, 3), each one click. One attempt to revise the **unlinked** draft from
`/operations` was refused before the model ("A draft prepared here is organization work, so it needs an agent
responsible for the organization") — the mandate boundary held; nothing was written.

**What this proves.** The Content Agent is configuration on released authorities: Heby recommended it for
Content work, refused other agents, wrote grounded content only from ratified public Knowledge, revised it
from Governance change requests, and acceptance stayed separate from publication. **What it does not.** It
says nothing about caption quality beyond one Director review; publication was not attempted (the tenant is
not armed); the automated grounding check could not judge any Turkish sentence, so every review was manual.

## Closure Contract (v1)

- Phase: CONTENT-AGENT-SPECIALIST-1
- Owner: apps/dashboard/tests/content-agent-specialist-1 (proof only); Agent Identity, Agent Mandate, Work Domain, Organizational Work, Work Artifacts, Governance review, External-AI Data Use and publication state unchanged
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 3f38754769599f6fbb1ca94635f33e480e85e97a — on main via fast-forward 105755dd..d87fb505
- Verification level: V1 — no behaviour changed; one new integration test is the direct evidence
- Verification evidence: 2026-10-27, tests/content-agent-specialist-1/workflow-postgres.ts A1–A11 PASS; tsc and eslint exit 0
- Test environment: worktree .claude/worktrees/next-specialist-1 (npm ci, published lockfile); macOS Darwin 25.2.0; PostgreSQL 18.6 on 127.0.0.1:55499, system_identifier 7701071965303287020, via HEBUN_TEST_ADMIN_DATABASE_URL; model faked at the transport; no production database, no provider
- Deployment evidence: 2026-10-27, dpl_DXfMjijQfYAdj8yAHAE5ZecTpoVu, commit d87fb505, production Ready, www/apex/vercel.app aliased, smoke / 200, /login 200, apex 308, no 5xx
- Production acceptance evidence: 2026-10-27, Hebun (§7): Content Agent 017002fb mandate rev 1 (Content only) on work 135c3773; content draft 94569529 revisions 1–3 authored by Content Agent from 3 real model calls, grounded on the 3 ratified public-use Knowledge records; rev 1 and 2 changes requested, rev 3 accepted by the Director; no publication request or permit
- Deferred risks: CAS1-ACTIVATION-PENDING-1 (CLOSED); CAS1-DOMAIN-OPERATOR-ONLY-1 (DEFERRED); CAS1-PUBLISH-COPY-STALE-1 (CLOSED)
- Director approvals: local proof of a Content Agent on released authorities and a scoped cleanup of three completed worktrees, 2026-10-27; release (push of 3f387547 and d87fb505, this record) and read-only activation readiness, 2026-10-27; production activation in Hebun, 2026-10-27, step by step: three public Knowledge records (create, ratify, public use), the content work domain (Director ran --confirm), the Content department, the Content Agent identity and mandate rev 1, one content work (propose, authorize 1 h, execute), the first preparation, the link, two change requests with revisions 2 and 3, and acceptance of revision 3; docs push 1a239d60 + 0b4764b9 and the copy fix e6e02a56 (push and deploy), 2026-10-27; closing CAS1-PUBLISH-COPY-STALE-1, 2026-10-27; publication and publication arming NOT approved

### Deferred risk detail

- **CAS1-ACTIVATION-PENDING-1 (DEFERRED).** No Content Agent exists in any production tenant and no real
  model has written a content draft as one. Acceptance dependency: the §5 steps, each a Director decision.
- **CAS1-ACTIVATION-PENDING-1 (CLOSED).** Closed by §7: activated in Hebun and accepted on one draft.
- **CAS1-PUBLISH-COPY-STALE-1 (CLOSED — production verified).** The review and asset notices said "Hebun holds
  no provider capability that can publish", false since PUBLISH-0. Fixed in `e6e02a56` (cherry-pick of
  `b2471ec8` onto `0b4764b9`; three copy constants and two pinning tests, no behaviour change): publishing is
  stated as possible only where the organization's provider is connected and its publishing is armed, through
  its own request, Governance decision and permit. Verified 2026-10-27: cgo1, cgo8, trh10,
  content-publication-state-1, media5 and continuity PASS, `tsc --noEmit` and eslint exit 0; fast-forward
  `0b4764b9..e6e02a56`; `dpl_8JH97G5K9MzuoyZsZ5NL5vBw1vnN` production Ready, www/apex/vercel.app aliased,
  smoke `/` 200, `/login` 200, apex 308, no 5xx; signed-in Hebun `/operations` shows the new notice and
  destination sentence and the old text 0 times. Hebun's publishing remains unarmed.
- **CAS1-DOMAIN-OPERATOR-ONLY-1 (DEFERRED).** A tenant cannot record a work domain from the product (AP-4A
  Release A); every specialist needs one. Acceptance dependency: a Director decision to keep the operator
  ceremony or to give the released writer a product surface.

**Weekly three.** *Learned:* in this architecture an agent is data — identity, mandate, domain — and its
specialty is its responsibility, so the next specialist is a configuration to prove, not code to write.
*Turkish Rug House:* TRH can have a Content Agent accountable for its captions, recommended by Heby for
content work, without any new code. *Hebun AI:* the first specialist outside Engineering, proven on the
same seams, with publication as the outcome rather than acceptance.
