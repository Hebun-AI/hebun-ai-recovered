# WORK-UPDATE-AGENT-SELECTION-1 — Agent Choice in the Heby Work-State Affordance — Closure

Base `cd3ddbfe` (AP-5 entry reconciliation, local) on `f9ae3b4c` (`origin/main`). Worktree
`.claude/worktrees/work-update-agent-selection-1`, branch `feat/work-update-agent-selection-1`. Local
commit only: not pushed, not deployed. Fixes the code half of the deferred risk
`WORK-UPDATE-AGENT-SELECTION-1` (owner `hebun-work-update-v1-closure.md`), the first code prerequisite
named by `hebun-ap5-two-agent-acceptance-contract.md` §6.

Paths are relative to `apps/dashboard/src/`.

## What changed

| Piece | Change |
|---|---|
| `features/origination-availability/read-origination-availability.server.ts` | `composeWorkStateAgentChoices` (pure) and `readWorkStateAgentChoices`: the item through `readWorkStateTarget` (tenant-scoped), responsibility through `listEligibleAgents(…, set-work-declared-state)` for the item's domain, identity through `readDurableAgentIdentityState`. In-service agents only; fails closed to `unavailable`. Writes nothing, decides nothing |
| `features/origination-availability/contracts.ts` | client-safe `WorkStateAgentChoice` / `WorkStateAgentChoices` |
| `app/(dashboard)/heby/work-state-origination-actions.ts` | `readWorkStateAgentChoicesAction` — the list for the session's tenant. The released proposal action is unchanged |
| `components/agents/agent-choice-select.tsx` | optional `unavailableNote` on an option: listed but disabled. Unused by every earlier caller |
| `components/layout/heby/heby-work-state-affordance.tsx` | reads the list; with more than one in-service agent renders the AP-5A chooser (no default, non-responsible agents disabled) and sends only a listed, responsible choice; says when no serving agent is responsible; names the chosen agent in the result. With one agent, none, or an unreadable list, nothing is sent and the copy is unchanged |

Not changed: the origination (`originate-work-state.server.ts`), the proposer resolver, the
preflight, the writer, the spend, any schema, migration, Governance path, provider, EAI cell, prompt
or execution authority. The model is shown no agent id or name. No second resolver
(AP-5A F1 census unchanged).

## Validation

- `tsc --noEmit` 0; `eslint` clean on every changed file; `git diff --check` clean.
- New `tests/work-update-agent-selection-1/choice-and-surface.ts` (no database) exit 0 — composition,
  zero / one / two agents, missing / explicit / invalid / non-responsible selection, chooser render,
  wiring, no writer / resolver / model-facing id. Two mutations (suspended agent listed; non-responsible
  agent choosable) were each caught, then restored byte-identically.
- New `tests/work-update-agent-selection-1/selection-postgres.ts` exit 0 on a disposable PostgreSQL 18
  database created and dropped by the harness (`HEBUN_TEST_ADMIN_DATABASE_URL` → `127.0.0.1:55433`;
  no database left behind) — one agent unchanged; two agents without a choice refuse
  `ambiguous-durable-agent-identity`; invalid, unknown and foreign selections refuse
  `selected-agent-unresolvable`, a suspended one `selected-agent-retired`, a non-responsible one
  `action-outside-agent-mandate` at the preflight — none registers an invocation, calls the model or
  files a request; an explicit choice is the invocation's agent and the request's proposer; another
  organization's item lists nobody.
- Seam suites exit 0: `work-update-v1` (work-state-postgres, firewall, selection-render,
  register-reach, bite-proofs 13), `ap5a-plurality-readiness` (readiness-postgres, surface-and-firewall,
  bite-proofs 11), `wf1-origination-recommendation` (availability-postgres, firewall-and-surface,
  bite-proofs 9/9), `ap4b-strict-work-eligibility` (eligibility-postgres, firewall, bite-proofs 13),
  `ap1-plurality-foundation/bite-proofs` (9), `l2b-agent-suspension/suspension-postgres`, and the
  structural firewalls of ama1, ama2, ap4a, eai-1a, heby-nav-0, agent-id-0-1, cgo9, l1a, l2a,
  heby-conversation-continuity-1, work2, heby-operational-planning-projection, rev3.
- One regression found and fixed in this phase: re-wrapping an import line in the availability
  projection removed the text anchor of WF-1 bite-proofs W5/W6 (they then "missed"); the original
  line was restored and the new type imported on its own line.
- Known baseline failures, identical at `cd3ddbfe`: `osa-owner-eligibility/eligibility-firewall`
  and `cmdb1-command-overview/canonical-overview` (stale migration-count pins). Not this phase's.
- Full suite not run: V2 covers the touched seam; see `EHO-1-RED-SUITE-BASELINE-1`.
- Browser not exercised: no signed-in local session or two-agent fixture was set up; the chooser is
  verified by server render only.

## Closure Contract (v1)

- Phase: WORK-UPDATE-AGENT-SELECTION-1
- Owner: Heby work-state affordance (`components/layout/heby/heby-work-state-affordance.tsx`) and the WF-1 availability projection (`features/origination-availability/`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT — local only, not pushed
- Verification level: V2 — shared selection seam (AP-5A chooser, availability projection, work-state boundary); server authorities unchanged, so no V3 boundary moves
- Verification evidence: tsc 0; eslint clean; `tests/work-update-agent-selection-1/choice-and-surface.ts` and `selection-postgres.ts` exit 0 (two mutations caught); seam suites and bite-proofs listed above exit 0; `osa-owner-eligibility/eligibility-firewall` and `cmdb1-command-overview/canonical-overview` fail identically at base cd3ddbfe
- Test environment: worktree `.claude/worktrees/work-update-agent-selection-1`, `node --import tsx`, disposable PostgreSQL 18 on 127.0.0.1:55433 created and dropped per suite
- Deployment evidence: N/A — not deployed; push not authorized
- Production acceptance evidence: N/A — not deployed; no second production agent exists
- Deferred risks: WORK-UPDATE-AGENT-SELECTION-1 (DEFERRED); EHO-1-RED-SUITE-BASELINE-1 (DEFERRED); WUAS-1-BROWSER-UNVERIFIED-1 (DEFERRED)
- Director approvals: implementation, focused tests and one scoped local commit (Director, 2026-10-17); push, deploy, agent registration and mandate changes NOT approved

## Deferred risks

- `WORK-UPDATE-AGENT-SELECTION-1` stays **DEFERRED** under its owner until this code is released: the
  production affordance still has no chooser. The release's documentation change lists it `(CLOSED)`
  and moves the §22 pointer here.
- **WUAS-1-BROWSER-UNVERIFIED-1 (DEFERRED)** — the chooser has not been rendered in a signed-in
  browser with two in-service agents. Closes with a local disposable two-agent UI check before release,
  or with AP-5 acceptance A5.

## Three questions

1. **What did we learn?** The server already had every answer — one resolver, one preflight, one
   eligibility projection; the gap was a surface that never asked. And bite-proof anchors are exact
   text: reformatting a line they target turns a guard into a silent miss.
2. **How does this improve Turkish Rug House?** Not directly; TRH keeps one agent and the unchanged
   single-agent path.
3. **How does this become part of Hebun AI?** Every human surface that originates for an agent now
   asks which agent when more than one serves — the precondition for registering Agent #2 (AP-5).
