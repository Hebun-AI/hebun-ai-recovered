# P5 · Heby & AI Agent Platform — commercial scope · DESIGN GATE — DECIDED, NOT IMPLEMENTED

Master Plan V2 P5 ("Heby & AI Agent Platform") is PARTIAL. Its original done-criterion — a customer
connects their own provider key, no operator path can read it, and a specialist agent's work runs end to
end under mandate and Governance in production — is close to met, but it produces no revenue. This gate
records the measured state, the Director's decisions of 2026-11-20 that widen P5 to a commercial scope,
the slices, their order and their acceptance criteria. Nothing below is built. Nothing here authorizes
code, a migration, a provider call, a credential, a deployment, a payment or a production read.

Every slice still needs its own Director gate before implementation; every migration, production step,
merge and deploy remains a separate gate (`CLAUDE.md`, `hebun-loop.md`).

## Measured at `4669a88b` (remote `main`, 2026-11-20)

1. **Released agent work is preparation only.** The one agent work capability is `prepare-work-draft`
   (`features/agent-work/capabilities.ts`, side effect `PREPARATION_ONLY`). AGENT-EXECUTION-1/2 and
   HEBY-WORKFLOW-1 are PRODUCTION-ACCEPTED (scoped); AP-5 (two agents, one tenant) is PRODUCTION-ACCEPTED.
2. **Specialist is a label.** AGENT-EXECUTION-2 records that no agent or domain identity reaches the
   model; a specialist's draft is shaped by the artifact type's preparation contract only.
3. **Orchestration is fiction.** `features/orchestration/agent-selector.ts` picks from
   `features/agents/mock.ts` by keyword. Mock data is still rendered by `/director/agents`,
   `/director/registries/workflows`, `/hr`, `/finance`, `/legal` and `components/orchestration/*`.
4. **Agents are created in product.** `app/(dashboard)/agents/actions.ts` holds create, suspend,
   reactivate, retire, mandate and placement actions. No per-agent role instruction exists.
5. **Recurring work exists only for research.** P6-2 (standing authorization, `research-schedule` kill
   switch) and P6-4 (08:00 run under a machine principal) are released; P6 is PRODUCTION-ACCEPTED.
6. **BYOK slices 1–2 are on `main`** (PR #7: key entry and verification, Heby calls on the tenant key,
   attribution and own-account attestation migration, stop-using-own-key). The P6 acceptance run used the
   tenant's own key in production. **No BYOK closure record and no §21 row exist.**
7. **Plan ceilings.** `features/tenant-entitlements/plans.ts`: Free model 15 / media 1, Pro model 100 /
   media 10 per UTC day. `ceilingForPlan` uses the plan limit unless an operator set the deployment env
   cap, then the minimum of both. The AP-3 cap (`features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts`)
   resolves this ceiling **without regard to credential source**: BYOK calls count against the plan quota.
   The credential source is known at the call (`heby-answer/model-answer.server.ts`, `credentialSource`).
8. **P1 billing** is on `main` (migration 91). Production billing is off; live mode is deferred; the
   COMMERCIAL-ACTIVATION-1 closure is on branch `docs/p1-commercial-closure`, not merged.
9. **GATE-D-PROVIDER-RECONCILIATION-1 is BLOCKED** (§22): production readiness of the platform Anthropic
   key waits for provider-side evidence.

## Director decisions (2026-11-20)

- **D1 · Done-criterion — WIDENED.** P5 is done when a Pro tenant sets up two agents from templates
  (Content and Research), each works under its own role brief, one produces a scheduled weekly draft, the
  tenant reads what each agent did on `/agents` and which credential spent what on `/account/plan`, and a
  Free tenant is refused at its entitlement limit — all observed in production on the TRH tenant.
- **D2 · GATE-D — RESOLVE NOW.** Closed in P5-0 from provider-side evidence read by the Director's
  account. No code. Pro is not sold on the platform key while it stays BLOCKED.
- **D3 · BYOK quota — MODEL CALLS UNMETERED.** A model call carried by an active, verified tenant key does
  not count against the plan's model quota. The media quota is unchanged. The operator-set deployment cap
  and every kill switch still apply to BYOK calls.
- **D4 · P1 live billing — SAME WINDOW AS P5 ACCEPTANCE.** Live Stripe, legal approval and the tax
  decision are planned with P5-9; the P1 closure branch is merged before that window.
- **D5 · Role brief data use — REUSE FIRST.** The role brief travels under the existing `organization`
  data-use class if its definition covers tenant-authored agent instructions; P5-2's gate measures that.
  A new class is opened only if it does not, through its own migration and cell decision.
- **D6 · First scheduled templates.** Weekly content plan draft; weekly operations summary.
- **D7 · Mock surfaces — DELETE.** Not hidden; removed with their imports.

## Principles every slice is held to

- An agent prepares; Governance decides; a permit authorizes; an executor executes. No slice adds
  autonomous external action.
- A scheduled run is inert until a standing authorization exists and its kill switch is on; it files a
  draft for review and performs no external act.
- An entitlement is enforced at the seam that spends, not at the button.
- An area with no runtime says so; no number is shown that no record holds.
- No new authority where a released one owns the act (no policy engine; AP-6b stays DEFERRED).

## Slices, order and acceptance

Estimates are session-days, calibrated on P6 (four slices plus acceptance ≈ 10 days).

| # | Slice | Est. | Acceptance |
|---|---|---|---|
| P5-0 | BYOK closure record + GATE-D resolution | 0.5 | §21 row for BYOK; production read-back of own-key carriage and refusal without fallback recorded; GATE-D CLOSED in §22 with the provider evidence named |
| P5-1 | Mock removal (D7) | 1 | No route or component imports `features/agents/mock`, `features/workflows/mock` or `features/orchestration`; removed areas render nothing or "not available"; UI suites pass |
| P5-2 | Agent role brief (D5) | 2 | The same work given to two agents produces two different role sections in the model request (test); a brief without data-use authorization for its purpose refuses the call; only Governance authority edits a brief |
| P5-3 | Agent templates | 2–3 | One form creates identity, mandate, placement and brief for Content, Research or Operations through the released actions; a person without Governance authority is refused; a template creates nothing an existing action could not |
| P5-4 | Plan entitlements + BYOK quota (D3) | 2 | Free refuses a second agent and any schedule; Pro admits its limits; a plan change takes effect on the next request; a verified tenant-key model call is not counted against the plan model quota (test); the operator-set cap and kill switches still refuse BYOK calls (test); media quota unchanged |
| P5-5 | Scheduled agent task (D6) | 5 | Generalizes the P6-2/P6-4 pattern from research to an agent task; kill switch off → nothing runs; one run per tenant per template per period; output is a draft awaiting review; no external act; one run observed on TRH. Migration is its own gate |
| P5-6 | Agent activity + credential usage | 2 | `/agents` shows per-agent tasks, drafts and review state from records; empty state when none; `/account/plan` splits usage by credential source and the totals match the R2F.1 reader |
| P5-7 | Research for a work item | 2–3 | An agent with a web-search grant attaches a sourced research draft to a work item through the P6 seam; a sourceless reply is refused; an agent without the grant is refused |
| P5-8 | Research → content handoff | 3 | A content draft names an accepted research artifact as its evidence; an unaccepted artifact cannot be used as input |
| P5-9 | Production acceptance (TRH) + P1 live window (D4) | 1–2 | D1 observed in production and recorded in a §16.1 closure |

Core is P5-0 … P5-6 (≈ 15–17 days). The decided scope adds P5-7 and P5-8 (≈ 21–23 days in all). P5-1
and P5-2 can run in parallel. P5-4 uses P1's code on `main` and does not wait for live activation.

## Later, not in this scope

Coordinator orchestration (plan → many assignments → dependencies); event triggers (e.g. automatic
revision on a change request); a read-only agent permission panel; Knowledge grounding for every agent
task; other BYOK providers (OpenAI, media); per-agent budgets; usage-based billing; separate key set or
external KMS for BYOK (B3 hardening).

## Dependencies — what stays in other packages

| Package | Relationship | Not moved into P5 |
|---|---|---|
| P1 | P5-4 reads `companies.plan`; D4 aligns live billing with P5-9 | Billing, Stripe live mode, legal texts, tax |
| P6 | P5-5 reuses the standing-authorization and machine-principal pattern; P5-7 reuses the sourced research seam | P6 is closed and is not reopened |
| P7 | The Content Agent is configuration on P7 seams; P5-8 feeds P7 content drafts | Auto-publication, new channels |
| P8 | Agent results land in released approvals and notifications | External notification delivery, general calendar |
| P10 | Needs P5's mandate and templates later | Device identity, browser/computer runtime |
| P11 | An advertising agent becomes a template once its provider and spend permit exist | Spend permit, ad providers |
| P12 | An SEO agent becomes a template once a search provider exists | Search Console provider, site writes |
| P13 | A marketing agent becomes a template once recipient authority exists | Segments, bulk email, CRM |

## Gates still open after this record

Each slice's own gate; the P5-2 data-use measurement (D5); the P5-5 migration; every production
migration, merge and deploy; the GATE-D evidence read (Director's account); P1 live activation.
