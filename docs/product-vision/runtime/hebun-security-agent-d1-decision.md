# SECURITY-AGENT-D1 — Security planning specialist — Decision Record

Roadmap position: §20.4 *Security* ("Do not create a Security Agent or Security Sentinel authority") and
§7 (Security owns no truth). The next specialist after CONTENT-AGENT-SPECIALIST-1
(`hebun-content-agent-specialist-1-closure.md`), assessed on 2026-10-27 ("NEXT SPECIALIST AGENT").

**Status: DECIDED (Director, 2026-10-27, "SECURITY AGENT D1 DECISION"). NOT ACTIVATED.** This is a
decision record, not a closure. No work domain, department, identity, mandate, work item or Knowledge
was created; no code changed; nothing was pushed or deployed.

Evidence was read at `e428ff35` (remote `main`, unchanged across the session) from git objects, and from
production read-only through the Director's signed-in session on 2026-10-27 (GET requests only).

## Decision

1. **The §20.4 prohibition stands.** No Security Agent authority and no Security Sentinel is created.
2. **A security planning specialist is configuration, not authority.** It is a durable agent identity, a
   mandate and a work domain on released authorities — the Content Agent's shape — and it holds no
   security truth, no finding, signal or incident, no policy and no enforcement point.
3. **It prepares internal drafts only:** `prepare-work-draft` producing an `operational-plan`, from the
   person's instruction (`conversation`) and ratified Knowledge (`knowledge`) under the released
   `anthropic/messages` × `assistance` cells. It reads no audit log (`governance-record` has no allowed
   platform cell), no members, integrations or devices, and no unconnected security source.
4. **It scans nothing and changes nothing.** No scanning, system access, intervention, send or publish.
5. **Every draft is subject to human review and Governance:** a person chooses the agent, links the draft
   as evidence, and Governance accepts it or requests changes. Acceptance is not execution.
6. **No new security infrastructure** is built for it. Opening any further data class or source to the
   model, or any finding/incident authority, is its own Director decision (§12.1).

## Reuse — confirmed in code at `e428ff35`

| Need | Released seam |
|---|---|
| Identity | `createDurableAgentIdentity`, `/agents` registration (a Governance decision) |
| Mandate and responsibility | `establishAgentMandateWithResponsibility`; ceiling and responsibility in `action-authorization/agent-mandate-ceiling.ts` |
| Domain | Work Domain Authority, operator ceremony `platform:work-domain` (CAS1-DOMAIN-OPERATOR-ONLY-1) |
| Department | Organization Structure Authority, `/director/organization` |
| Choice and recommendation | `readWorkDraftChoices` / `assignWorkDraft` (AE-1, AE-2) |
| Draft | `prepareWorkArtifact`, `operational-plan` internal-draft brief (AGENT-EXECUTION-2), limits title 200 / content 100 000 |
| Output guards | AOR-1b internal-draft action-claim withholding; HEBY-PROMPT-INJECTION-BOUNDARY-1 fencing; AP-3 dispatch cap |
| Evidence, review, revision | WEV-1 person-linked evidence; Governance review and change request (HEBY-WORKFLOW-1) |
| Data use | External-AI Data Use gate, existing cells only |
| Lifecycle | suspend, reactivate, retire (L-1b, L-2b) |

## Mandate — narrowest admissible scope

`prepare-work-draft` admits an agent whose mandate holds **any one** of `record-work` or
`set-work-declared-state` together with responsibility for the work's scope
(`refuseOutsideAgentWorkCapability`, `agent-work/capabilities.ts`). An empty mandate is not eligible.

| Kind | What it adds beyond drafting |
|---|---|
| `record-work` | The general origination contract lets the model **choose** to propose new work, composed from a goal, the organization's structure and Knowledge |
| `set-work-declared-state` | Only a change the **human already chose** (item and target state); the model sees nothing about the item and may propose or decline; it is not selectable through general origination (`originate-work-state.server.ts`) |

**Selected: `set-work-declared-state`, responsibility the Security work domain only, never
organization-level.** It is the narrower of the two and matches the Content Agent. Known effect: `/agents`
shows "Proposal capability not confirmed — the mandate in effect does not include work proposals", which is
true. Follow-up work for a plan is recorded by a person (`record-work` with its own Governance decision).

## First Security work — `operational-plan` scope

- **Work:** one Security-domain work item, e.g. "Quarterly access and integration review", recorded by a
  person through `record-work` (request → Governance approval → permit → human execution), department
  Security, work scope Security.
- **Draft:** type `operational-plan`, one per request, authored by the security planning agent: a review
  checklist with owners left as placeholders. Facts about the organization come only from the person's
  instruction or ratified Knowledge; missing facts are placeholders, never inventions.
- **Out of scope:** any statement that an act happened ("access revoked", "rotated", "patched"); any
  finding, incident, score or threat; any `message-draft` or `content-draft`; any link, send or state
  change by the agent.
- **Done:** a Governance holder accepts the current revision; the work's completion stays a person's
  declaration.

## Mock actor check — production, 2026-10-27

Source fixtures name an invented "Security Agent": `features/governance/{approvals,audit,compliance,permissions,policies,risk}.ts`
and `features/legal/mock.ts`. Rendered production HTML, Director session, 24 routes:

| Route | "Security Agent" | Framing on the page |
|---|---|---|
| `/director/governance/policies` (also `/director/governance/permissions` → redirect) | 2 rows, column **Owner** | "derived from seeded input — not live organizational policy" |
| `/legal/policies` | 1 row, column **Owner** ("Incident Response Policy · Active") | "Legal is a legacy domain surface · mock · not authoritative … illustrative mock data" |
| 21 other routes incl. `/director/governance/audit`, `/director/governance/compliance`, `/director/governance/security`, `/governance`, `/approvals`, `/agents`, `/command`, `/director`, `/workforce`, `/legal/*` | 0 | — |

The fixture rows that show the invented agent **acting** (audit timeline revoking access, permission changes)
are not rendered on any route checked. The two hits name it as a policy owner on pages labeled seeded or
mock. **It is not presented as a real actor**, but a real identity named "Security Agent" would share its
name with a fictional policy owner. **Rule for activation:** the identity is registered under a distinct
name, **"Security Planning Agent"**. Replacing the fixture owner strings is a separate code change, not
authorized here.

## Activation — remaining steps, each a separate Director authorization (not performed)

1. Preconditions in Hebun: `assistance` × conversation, knowledge, work-artifact authorized; at least one
   ratified internal Knowledge record relevant to security planning (optional — without it, organizational
   facts come only from the instruction).
2. Work domain: `npm run platform:work-domain -- --tenant=<slug> --create --slug=security --name="Security"`,
   dry run, then `--confirm` by the Director.
3. Department: `/director/organization` → Security.
4. Identity: `/agents` → "Security Planning Agent", with its reason.
5. Mandate: `/agents` → proposal scope `set-work-declared-state`, responsibility Security only.
6. Security work: `/director/work` propose → `/approvals` authorize → execute.
7. Acceptance: one Heby preparation of an `operational-plan` on that work (a real model call), authored by the
   security planning agent, linked, reviewed; recorded in a closure record under §16.1.

## Deferred risks

None created. Relevant existing risks: CAS1-DOMAIN-OPERATOR-ONLY-1, AE2-DOMAIN-SPECIALTY-1 (the model is not
told the agent's specialty), AOR1B-NON-ENGLISH-CLAIMS-1 (Turkish action claims are not judged), and
HPIB1-SINGLE-SYSTEM-STRING-1 (pasted logs in an instruction are data in one channel).
