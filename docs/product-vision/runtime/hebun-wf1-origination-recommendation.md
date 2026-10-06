# WF-1 — Heby → Governed Origination Recommendation

**Status: CLOSED / PRODUCTION-ACCEPTED (Director, 2026-10-06).**
Accepted release `a254038cee026c40ef8638ffe5c414cfafa76d8e` (`dpl_3dsfHchDghi928a47kdBaDZrXzEM`):
feature `95b46e36` + copy fix `a254038c`. Zero schema, zero migration (ledger 71 before and after). No
new authority, no EAI widening, no provider change. Agent #2 remains STOPPED.

Agent Workforce direction (Phase 0, accepted): NOW capability routing without agent plurality; a
narrow hybrid only when a separate durable agent boundary is measured. WF-1 is the first increment:
the existing governed Agent #1 origination capability made reachable from Heby without giving Heby
any new authority.

## What was released

- **Affordance.** Under each settled human message on `/heby`, a quiet "Propose as organizational
  work…" control. Not an intent classifier; it claims none. The human decides.
- **Availability projection** (`features/origination-availability/`). A derived, point-in-time READ
  that asks the authorities which already decide — `resolveAgentProposer`, the shared mandate
  ceiling over the effective mandate, `readProviderOpsView`, and the External AI Data-Use gate for
  `agent-origination × {conversation, organization}` — and returns AVAILABLE (agent name, mandate
  revision / purpose / scope, originable `record-work`) or UNAVAILABLE with one of nine bounded
  reasons. It writes nothing, records no audit and reaches no writer, generator or transport send;
  its import graph is pinned. Its read action takes no input.
- **Confirmation.** "Ask Heby to propose" calls the released `originateHebyActionProposalAction`
  exactly once, with the human's message as written. The origination seam re-checks every
  authority and wins; AVAILABLE is advisory only.

RECOMMENDED ≠ AVAILABLE ≠ REQUESTED ≠ PROPOSED ≠ AUTHORIZED ≠ EXECUTED ≠ SUCCESSFUL.

## Production acceptance — PASS (second controlled run, authoritative)

2026-10-06, hebun, Director-performed in the observed browser pane. Goal: "Create a proposal to
record an internal follow-up task for the Engineering department to review the WF-1 second
production acceptance results."

| Step | Evidence |
|---|---|
| Availability | card AVAILABLE: agent Heby, mandate revision 3, only record-work, "pending proposal for human review"; opening it created no invocation (12 → 12) |
| Confirmation | exactly one observed `click` on the enabled, unobstructed button |
| Browser request | exactly one `fetch` 3 ms after the click: POST `/heby`, Next-Action `401cc89f…`, 200; Vercel log 08:35:55.779Z |
| DOM | "Heby is considering this. Nothing has been filed yet." at +6 ms; proposal result at +1.4 s; same element, no remount; no console errors |
| Invocation | exactly one new: `dec5e0da`, agent `4ffeeb83`, live, `selection-valid`, filing `proposed` |
| EAI decision / audit | `ca1b6b0e` `external-ai.disclosure.authorized`, purpose `agent-origination`, declared = authorized `[conversation, organization]`, correlation = invocation id, attestation `ffb0c160` r1, authorization `8427ad60` r2; recorded 08:35:56.028Z, before the provider result (finalized 08:35:57.116Z); no goal text in metadata |
| Provider | one call, executed and successful: `msg_011CfkgGd4fiiqMKTy2tMREy`, haiku-4.5, 881 in / 65 out tokens |
| Model continuity | `claude-haiku-4-5-20251001` ∈ active attestation `model_ids` |
| Parser / membership | passed (`selection-valid`) |
| Mandate | passed; result `record-work` within revision 3 |
| Proposal | exactly one new PENDING `e162daaa`: `record-work` → `department/e40866a8` (Engineering), proposer agent `4ffeeb83`, `origination_invocation_id` = `dec5e0da` |
| Consequential state | no approval, permit, work item, execution attempt or other audit; mandate, EAI, attestation, controls and standing envelopes unchanged |
| APF-3 request `99000f47` | unchanged (pending, version 1) |
| Tenant isolation | every new row in hebun; TRH and Mulify unchanged |

The normal assistance call caused by sending the message is a separate measurement: audit
`c63264b7` (`assistance`, `[conversation]`), `msg_011CfkgACD2aUggCgHBymMUt`; its answer failed
Heby's own validation and was withheld. It is unrelated to origination.

Production delta: origination invocation +1, action request +1 (PENDING), `audit_log` +2 and
`external-ai.disclosure.authorized` +2 (one assistance, one origination), messages +2 and
conversations +1 (assistance), session contexts +2 (Director sign-ins). Everything else 0.

## First acceptance attempt — FAILED, cause UNKNOWN (not resolved)

At 08:06Z on the same release a confirmation reported by the human produced no origination: no
invocation, no request, no origination audit. Vercel logs show the automatic conversation load, the
assistance call, the automatic reload and one availability read — and no further request. A local
reproduction of `a254038c` (webpack dev, then `next build` + `next start` with Turbopack, disposable
database, fake transport) dispatched the action and registered an invocation on one click each time,
and the observed second production run passed. No client-side evidence was captured for the first
attempt, so its cause is **UNKNOWN**. It is not recorded as user error, as reproduced, or as fixed.

## Validation

L1 focused WF-1 suites (availability against real authorities incl. stale-state refusal by the
released seam, firewall/surface, bite-proofs 9/9); typecheck, lint, diff-check. L2 over 253 affected
files: 41 failing, 38 first-error-identical at `0160b547`, 3 named census pins widened by name (EAI-1A
importers, AMA-1, AMA-2 readers, AGENT-PROPOSAL-2 askers). No L3: no shared authorization or
execution runtime changed.

## Remaining debt (recorded, not fixed here)

1. **UI copy.** The post-proposal result still says "It is waiting for review in Approvals"; the
   availability card was changed to "a pending proposal for human review" (`a254038c`), this line
   was not.
2. **Client-side failure visibility.** The affordance does not catch a rejected action; a transport
   or action error would show no explicit sentence.
3. **Test layer.** No permanent real-browser → Server Action test exists; the boundary was proven by
   a manual local production-build reproduction and the observed production run.
4. EAI refusal surfaces after confirmation as "model unavailable" (origination result shape);
   availability does not pre-check candidate proposability; no durable per-tenant spend cap;
   `/agents` reads the derived overview, not the durable identity; no affordance in the Quick Panel.
