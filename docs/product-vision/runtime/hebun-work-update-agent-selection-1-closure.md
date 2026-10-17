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
- Browser: at the commit itself the chooser was verified by server render only. The signed-in browser
  acceptance that followed is recorded below (*Local browser acceptance*, 2026-10-17).

## Local browser acceptance (2026-10-17, after the implementation commit, code unchanged)

Run against `b5784119` exactly (worktree clean before and after). Not a production acceptance.

**Environment, and how it was isolated.**

- Database: a PostgreSQL 18.6 database on `127.0.0.1:55433`, named `hebun_test_hebun_wuas_ui_<random>`,
  created, migrated and finally dropped by `tests/helpers/disposable-postgres.ts` in the fixture's own
  process (0 such databases left afterwards). Contents: two test tenants (`acme-wuas-ui`,
  `globex-wuas-ui`), two test users, no integration and no provider-control row.
- Fixture (session scratchpad, not in the repository): staged A zero agents → B Heby → C Heby + Bolt
  (responsible) + Atlas (`record-work` only, so not responsible for `set-work-declared-state`) +
  Sleepy (suspended); Globex holds Gamma. Agents, mandates, the suspension and work items were written
  through the released writers inside the disposable database only.
- Application: `next dev --webpack` started from this worktree with an EMPTY inherited environment
  (`env -i`, PATH and HOME only) and a gitignored `.env.local` of five keys — the disposable
  `DATABASE_URL`, `HEBUN_AUTH_ENABLED=true`, `HEBUN_AUTH_PROVIDER=local` and a freshly generated session
  digest key. No provider, model or API key existed, so no production write service was reachable.
  The file and the generated test password were deleted afterwards; `next-env.d.ts`, regenerated by
  the dev server, was restored to the committed version.
- Sign-in: the released local login (`/login`, password verified by the D1 credential path) as the
  test user of `acme-wuas-ui`. No session was minted by hand.

**Observed in the browser** (`/heby?workItem=<id>`, the Work register's entry):

| # | Check | Result |
|---|---|---|
| 1 | Zero agents | no chooser; asking returned `no-durable-agent-identity` |
| 2 | One agent | no chooser, copy unchanged; asking resolved Heby, passed the preflight and stopped at `model-unavailable` (no Director control, no transport) — nothing registered, nothing sent |
| 3 | Several agents | chooser shown: "Agent — more than one is in service…", options Atlas, Bolt, Heby |
| 4 | No default | starting value "Choose an agent" (empty) |
| 5 | Missing selection | with a state chosen and no agent, "Ask" stays disabled |
| 6 | Ineligible agent | Atlas listed as "Atlas — not responsible for this work domain", `disabled`; forcing it programmatically still left "Ask" disabled |
| 7 | Explicit selection | choosing Bolt enabled "Ask"; the server answered `model-unavailable`, not `ambiguous-durable-agent-identity` — so the chosen id reached and resolved at the server (inferred from the outcome; the request body was not read) |
| 8 | Suspended agent | Sleepy never listed. Bolt, suspended in the disposable database while the page stayed open, was asked from the stale page: `selected-agent-retired`; after reload Bolt was gone from the list |
| 9 | Tenant isolation | Gamma (Globex) appeared nowhere; Globex's work item opened from Acme read "could not be found in your organization" |
| 10 | Mobile | 375 px viewport: no horizontal overflow, chooser inside its section |
| — | Errors | browser console: none; dev server log: no error |
| — | Side effects | disposable database at the end: 0 origination invocations, 0 `set-work-declared-state` requests — no proposal was filed and no provider was called |

**Not verified in the browser:** a successful, model-generated proposal — and therefore the result
line naming the chosen agent ("Bolt proposed …") — because no model was connected by design. That line
is covered only by `choice-and-surface.ts` (C2 `agentName`) and the proposer identity by
`selection-postgres.ts` P4 (stub model). Recorded as `WUAS-1-PROPOSAL-TEXT-UNVERIFIED-1`.

**Observations, not defects of this phase:** a suspended selection is refused with the AP-1 code
`selected-agent-retired` (the code's wording predates L-2a's suspended/retired distinction); the
refusal line shows the raw reason code, as released in WORK-UPDATE-V1.

**Re-run after the browser session at `b5784119`:** `choice-and-surface`, `selection-postgres`,
work-update-v1 `work-state-postgres`, ap5a `readiness-postgres` + `surface-and-firewall`, ap4b
`eligibility-postgres`, wf1 `availability-postgres`, l2b `suspension-postgres`, agent-id-0-1
`read-seam-and-truth`, ap1 `bite-proofs`, development-continuity — all exit 0.

## Closure Contract (v1)

- Phase: WORK-UPDATE-AGENT-SELECTION-1
- Owner: Heby work-state affordance (`components/layout/heby/heby-work-state-affordance.tsx`) and the WF-1 availability projection (`features/origination-availability/`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT — local only, not pushed
- Verification level: V2 — shared selection seam (AP-5A chooser, availability projection, work-state boundary); server authorities unchanged, so no V3 boundary moves
- Verification evidence: local signed-in browser acceptance on a disposable PG18 database (zero / one / several agents, no default, missing and ineligible selection blocked, explicit selection resolved, suspended and foreign agents refused or absent, 375 px; 0 invocations, 0 requests; see *Local browser acceptance*); tsc 0; eslint clean; `tests/work-update-agent-selection-1/choice-and-surface.ts` and `selection-postgres.ts` exit 0 (two mutations caught); seam suites and bite-proofs listed above exit 0; `osa-owner-eligibility/eligibility-firewall` and `cmdb1-command-overview/canonical-overview` fail identically at base cd3ddbfe
- Test environment: worktree `.claude/worktrees/work-update-agent-selection-1`, `node --import tsx`, disposable PostgreSQL 18 on 127.0.0.1:55433 created and dropped per suite; browser: `next dev --webpack` from the worktree with an empty inherited environment and five local keys, built-in browser pane, local `/login`
- Deployment evidence: N/A — not deployed; push not authorized
- Production acceptance evidence: N/A — not deployed; no second production agent exists
- Deferred risks: WORK-UPDATE-AGENT-SELECTION-1 (DEFERRED); EHO-1-RED-SUITE-BASELINE-1 (DEFERRED); WUAS-1-BROWSER-UNVERIFIED-1 (CLOSED); WUAS-1-PROPOSAL-TEXT-UNVERIFIED-1 (DEFERRED)
- Director approvals: implementation, focused tests and one scoped local commit (Director, 2026-10-17); local two-agent browser acceptance on a disposable database (Director, 2026-10-17); this acceptance record as one local documentation commit (Director, 2026-10-17); push, deploy, agent registration and mandate changes NOT approved

## Deferred risks

- `WORK-UPDATE-AGENT-SELECTION-1` stays **DEFERRED** under its owner until this code is released: the
  production affordance still has no chooser. The release's documentation change lists it `(CLOSED)`
  and moves the §22 pointer here.
- **WUAS-1-BROWSER-UNVERIFIED-1 (CLOSED)** — was: the chooser had not been rendered in a signed-in
  browser with two in-service agents. Closed by the local browser acceptance above (2026-10-17). Local
  only: it says nothing about production.
- **WUAS-1-PROPOSAL-TEXT-UNVERIFIED-1 (DEFERRED)** — a successful model-generated proposal, and the
  result line naming the chosen agent, were not seen in a browser (no model connected). Closes with the
  first live origination per agent in AP-5 acceptance (A5), or a Director-approved local run with a
  model.

## Three questions

1. **What did we learn?** The server already had every answer — one resolver, one preflight, one
   eligibility projection; the gap was a surface that never asked. And bite-proof anchors are exact
   text: reformatting a line they target turns a guard into a silent miss.
2. **How does this improve Turkish Rug House?** Not directly; TRH keeps one agent and the unchanged
   single-agent path.
3. **How does this become part of Hebun AI?** Every human surface that originates for an agent now
   asks which agent when more than one serves — the precondition for registering Agent #2 (AP-5).
