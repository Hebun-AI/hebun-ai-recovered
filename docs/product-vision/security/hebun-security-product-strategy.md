# Hebun Security — Product Strategy

**DOCUMENT TYPE: PRODUCT STRATEGY · STATUS: PROPOSED / PLANNED — NOTHING IN THIS DOCUMENT IS IMPLEMENTED,
CONNECTED, VERIFIED, AVAILABLE OR COMMERCIALLY OFFERED.**

Recorded by Director instruction, 2026-10-29 ("SECURITY PRODUCT STRATEGY & ROADMAP INTEGRATION"), read
against repository reality at remote `main` `03817c82`. Roadmap entry: `docs/MASTER-ROADMAP.md` §13.4.

This document records a product direction. It opens no phase, selects no milestone, creates no product
line, no authority, no table and no provider connection, and authorizes no code, migration, deployment,
tenant authorization, subscription or payment. Every phase below needs its own discovery, design gate and
Director decision before any work starts. Where this document and the roadmap disagree, the roadmap and
repository truth win (`MASTER-ROADMAP.md` §18 rule 5).

### Status vocabulary — used literally throughout

| Status | Meaning here |
|---|---|
| Proposed | Named in this document; not accepted into any plan |
| Planned | Accepted as a direction by the Director; no work started |
| Implemented | Code exists on `main` |
| Connected | A real provider connection with real permissions exists |
| Verified | Tests and acceptance evidence exist for the claim |
| Available | Reachable by a real user in production |
| Authorized | A tenant / Governance decision permits it for a specific tenant |
| Executed | It actually ran for that tenant |
| Successful | Its outcome was measured and met its criteria |

```
PLANNED        != IMPLEMENTED != CONNECTED != VERIFIED != AVAILABLE
AVAILABLE      != AUTHORIZED  != EXECUTED  != SUCCESSFUL
PRICE HYPOTHESIS != PRICE
SECURITY FINDING != SECURITY AUTHORITY
AI ANALYSIS      != VERIFIED VULNERABILITY
```

---

## 1. Executive Summary

Hebun Security is two product areas built on **one** set of security capabilities:

1. **Hebun Internal Security** — security expertise inside Hebun's own software organization, protecting
   Hebun's platform and development. It runs in Hebun's own tenant.
2. **Hebun Security Cloud** — the same capabilities offered to customers as a monthly subscription. Each
   customer runs in its own tenant.

Neither area is a seventh product line (§5) and neither creates a Security authority (§7, §20.4). Both
reuse Hebun's existing owners: authentication and tenant context, Governance, Agent Identity and Mandate,
Work, Work Artifacts and review, the model gateway with External-AI Data Use, Integrations (GitHub), audit
and provenance. A security capability **prepares findings and proposals**; a person and Governance
decide; an authorized runtime executes.

The first paid product is proposed as **Security Cloud — Continuous Application Security**: read-only
analysis of a customer-authorized repository (dependencies, exposed secrets, findings, risk class,
remediation recommendations, report). **None of it exists today.** The shortest real path to a first
paying customer is in §12 and §14.

## 2. Product Vision

Software teams get continuous, explainable security findings for code they authorize, with every finding
traceable to its source, every recommendation reviewable, and every change going through the customer's
own approval — never an autonomous change to their systems. Hebun uses the same product on itself first.

Defensive only. The boundary in `docs/product-vision/security-evolution-intelligence.md` applies unchanged: no offensive
operation, no exploitation of external systems, no scanning of anything the customer has not authorized.

## 3. Hebun Internal Security

**Placement.** A capability set inside a planned **Software Engineering** department. Under the reconciled
workforce model (§20.4: Hebun OS → OSA departments → a few mandate-bounded agents → reusable capabilities),
"Software Engineer" is a department and capability set, not one agent. Its parts:

```
SOFTWARE ENGINEERING (planned department)
  Frontend · Backend · Platform · QA & Testing · Internal Security
```

Today: the Organization Structure Authority can record departments (released); **no Software Engineering
department, Internal Security capability or security agent exists**. SECURITY-AGENT-D1
(`docs/product-vision/runtime/hebun-security-agent-d1-decision.md`) decided — and did not activate — a security **planning**
specialist: an identity, a mandate and a work domain that prepares internal `operational-plan` drafts only.
Internal Security extends that shape; it does not replace it.

**Planned capabilities (all Planned, none Implemented):** application security · backend and API
security · database security · cloud security · AI and agent security · identity and access security ·
secrets security · software supply-chain security · DevSecOps · security monitoring.

**Operating flow — mapped onto existing owners:**

| Step | Owner (existing unless marked) |
|---|---|
| Security finding | **New**: a findings record (no owner exists; see §7, a Director design decision) |
| Risk analysis | A security capability (deterministic rules first; model-assisted under its own data-use cell) |
| Remediation proposal | Work Artifacts — a prepared draft authored by a mandate-bounded agent |
| Software Engineer | Work: a work item and an agent's draft (AGENT-EXECUTION-1/2) |
| QA & Testing | The engineering test and verification practice (CLAUDE.md V0–V3) |
| Governance / human approval | Governance artifact review; human-only CHECKs |
| Authorized release | The existing release gates (push = production deploy is a Director gate) |
| Verification | Re-run of the finding's check; production measurement by its own seam |

The security engineer — agent or capability — **never** gains Governance authority, never deploys and never
performs a consequential security action. Authorization comes only from the existing authorities.

## 4. Hebun Security Cloud

A subscription product for customers' own software. **Planned capabilities (none Implemented):**
application security · API security · cloud security · AI security · identity and access security ·
DevSecOps · security monitoring · compliance and audit evidence.

**Target customers:** SaaS startups · software development companies · growing technology businesses ·
enterprise organizations (later; see §15).

**First paid product (Proposed MVP): Continuous Application Security** on a customer-authorized repository:

| MVP capability | Status | What it needs that does not exist |
|---|---|---|
| Read-only repository analysis | Planned | Source read: the GitHub App deliberately lacks `contents:read` (`apps/dashboard/src/features/provider-github/contracts.ts`) |
| Dependency vulnerability analysis | Planned | Manifest read + a vulnerability data source (none connected) |
| Secrets exposure detection | Planned | Source read + a deterministic detector (none) |
| Security findings | Planned | A findings record and owner (none) |
| Risk classification | Planned | A rule set; model use needs its own data-use cell (none) |
| Remediation recommendations | Planned | Work Artifacts exists; a security brief and data-use cell do not |
| Security reporting | Planned | A report artifact or surface (none) |

## 5. Shared Architecture Principles

**One capability set, two tenant contexts — never two engines.** Internal Security is Security Cloud
running in Hebun's own tenant. Building it twice would duplicate exactly what §7.3 forbids.

1. **Reuse before build.** Tenant context, Governance, Agent Identity/Mandate, Work and Work Artifacts,
   review, the model gateway and External-AI Data Use, Integrations, audit — all existing.
2. **Shared capability ≠ shared data.** Each tenant has its own findings, reports, provider connection,
   authorization scope and audit provenance. Hebun's internal findings are Hebun-tenant records like any
   customer's.
3. **Trusted tenant identity only from authentication** (`TenantContext`), never from a request, a repo
   name, a webhook payload or model output.
4. **A security capability gains no execution authority.** It reads what the tenant authorized and
   prepares. No write to a customer repository, cloud account or identity provider without a separate
   Governance-authorized, permit-bound action — none exists for security today.
5. **No new Governance, orchestration, agent runtime or security authority** (§7, §20.4).
6. **Model output is data.** A model's security judgment is never the only control; deterministic checks
   decide what can be stated as a finding (§13.1.1 principle 4).

## 6. Security Capability Catalog

Shared catalog. "Internal" / "Cloud" mark which area plans it; status is Planned for every row.

| Capability | Internal | Cloud | First dependency to resolve |
|---|---|---|---|
| Dependency vulnerability analysis | ✓ | ✓ (MVP) | manifest read; vulnerability source |
| Secrets exposure detection | ✓ | ✓ (MVP) | source read; detector; handling of a found secret (never stored or sent to a model in clear) |
| Static application security analysis | ✓ | ✓ | source read; ruleset |
| API security analysis | ✓ | ✓ (Growth) | API definitions read |
| Database security | ✓ | — | Hebun-internal configuration read |
| Cloud security posture | ✓ | ✓ (Business) | cloud provider connection (none) |
| Identity and access posture | ✓ | ✓ (Enterprise) | IdP connection (none) |
| AI and agent security | ✓ | ✓ (Growth+) | SCI program (§13.1.1); prompt-injection boundary exists for Hebun only |
| Software supply chain | ✓ | ✓ | dependency graph; provenance data |
| DevSecOps (CI checks) | ✓ | ✓ | CI provider connection (none) |
| Security monitoring | ✓ | ✓ | continuous source (none) |
| Compliance and audit evidence | — | ✓ (Business) | evidence model; **never a certification claim** |
| Remediation proposal | ✓ | ✓ | Work Artifacts (exists) + security brief |

## 7. Tenant Isolation & Governance

| Requirement | How (existing owner) | Gap |
|---|---|---|
| Tenant identity | Authenticated `TenantContext` | — |
| Repository access | Customer-installed GitHub App, per tenant (Integrations) | `contents:read` absent; adding it is a provider-permission decision |
| Code to an AI model | External-AI Data Use: platform cell + tenant Governance authorization | No source-code data class and no security purpose exist; adding them is a Director decision like RA-EAI-1 |
| Findings | **None** | A findings record needs an owner — a Director design decision (§7.3: extend an owner, no central Security authority) |
| Remediation | Work + Work Artifacts + Governance review | — |
| Any write to customer systems | Governance decision → permit → authorized executor | No security action kind exists; not planned for the MVP |
| Spend and abuse limits | AP-3 dispatch cap, process budget | Per-plan entitlements (none) |
| Audit | Shared append-only audit sink | Findings provenance contract (none) |
| Hebun vs customer | Separate tenants | Internal Security must not read customer tenants; support access, if ever, is its own authorization |

Operations needing explicit authorization: installing / widening repository access; sending any source
code or finding to an external model; enabling scheduled scanning (it spends); notifications to outside
recipients (external send); any change to customer code (PR, commit) — Governance + permit, not planned
for the MVP.

## 8. Security Operations Workflow

```
Authorized source (repo the tenant connected)
→ deterministic analysis (dependencies, secrets, rules)          read-only
→ finding (tenant-scoped, provenance: source, commit, rule)       record
→ risk classification (rule; model-assisted only where authorized)
→ remediation proposal (agent-authored draft, Work Artifacts)    preparation
→ human review (Governance artifact review)                       decision
→ fix by the customer's / Hebun's own engineers and release gates execution, outside Security
→ verification (re-run of the same check)                         evidence
```

Prepared ≠ Authorized ≠ Executed ≠ Successful. Security Cloud never executes the fix in the MVP.

## 9. Subscription Packages

**Price hypotheses, not prices.** No billing, entitlement or subscription system exists in Hebun today.
Nothing below is offered for sale.

| Package | Price hypothesis | Target | Planned scope |
|---|---|---|---|
| Startup | $99 / month | Early-stage teams | 1 repository · weekly scans · dependency analysis · secrets detection · basic findings · security report |
| Growth | $299 / month | Growing SaaS | up to 5 repositories · daily scans · API security analysis · basic AI security · remediation recommendations · risk tracking |
| Business | $799 / month | Established software companies | up to 20 repositories · continuous controls · cloud security · advanced AI security · remediation workflows · compliance evidence reports · advanced integrations |
| Enterprise | Custom | Large / regulated | custom limits · advanced governance · SSO · custom policies · dedicated integrations · enterprise audit · contract support |

**Packaging dimensions, each a future entitlement:** repository limit · scan frequency · AI analysis
limit (model calls, tokens) · data retention · integration limit · support level · report types · provider
cost pass-through.

**Never presented as included:** 24/7 SOC · incident response · compliance certification · guaranteed
detection · unlimited scans or AI usage. "Compliance evidence" means exportable evidence, not a
certification or an auditor's opinion.

## 10. Pricing Hypotheses

The four prices are starting hypotheses to test, not commitments. Before any is published:

1. **Unit cost per scan**, measured on real repositories: compute, storage, vulnerability-data cost, and
   model cost per finding analysed (the gateway's dispatch records make this measurable).
2. **Cost per plan-month** at the plan's limits (e.g. Growth: 5 repos × daily ≈ 150 scans/month).
3. **Gross margin target** set by the Director; a plan below it changes its limits, not just its price.
4. **AI usage capped per plan**; overage priced or refused, never unlimited.
5. **Willingness to pay** from pilot customers against free alternatives (GitHub Dependabot and secret
   scanning, open-source scanners) — §15.

## 11. Target Customers

| Segment | Why | When |
|---|---|---|
| SaaS startups | Few repos, no security staff, price-sensitive | Pilot / Startup |
| Software development companies (agencies) | Many client repos, need evidence for clients | Growth |
| Growing technology businesses | Compliance pressure, first security hire | Business |
| Enterprise / regulated | SSO, policy, audit, procurement | Later — needs requirements from real customers |

## 12. MVP Scope

**Proposed reduction.** The MVP as stated (workspace, repo connection, scanning, findings, reports,
entitlements, usage limits) bundles a billing system with the product. Smallest version that can earn a
first payment:

- **In:** one tenant-scoped GitHub connection with source read on selected repositories · deterministic
  dependency and secrets analysis (no model) · tenant-scoped findings with provenance · one report ·
  human review of findings · a usage cap reusing AP-3 / per-tenant limits.
- **Out until a pilot pays:** self-serve billing and entitlements (invoice the pilot manually) · AI
  analysis (needs its data-use decision) · daily / continuous scanning · API, cloud, IAM, compliance ·
  remediation workflows beyond a prepared recommendation.

## 13. Development Roadmap

Every phase starts **Planned · Not implemented · Not connected · Not verified · Not commercially
available**. None is selected; each needs discovery, a design gate and a Director decision.

| Phase | Goal | Acceptance | Hard prerequisites (Director decisions) |
|---|---|---|---|
| **SEC-FOUNDATION-1** — Internal Security Foundation | Architecture inventory; findings contract; read-only analysis of Hebun's own repository; risk classification; audit provenance; internal report | An authorized, verifiable security assessment of Hebun's own repository, recorded in Hebun's tenant | Findings owner design; GitHub source-read permission for Hebun's repo |
| **SEC-CLOUD-MVP-1** — Security Cloud MVP | Tenant-isolated workspace; authorized repo connection; read-only scanning; findings and reports; entitlements; usage limits | A pilot customer runs analysis on its own repository and reads only its own reports | SEC-FOUNDATION-1; tenant isolation proof; pilot agreement; billing approach |
| **SEC-CONTINUOUS-1** — Continuous Security | Scheduled scans; change-based findings; dependency and secrets monitoring; risk history; notifications | New risks found by repeated checks and reported to the right tenant only | Scheduling cost model; notification send authorization |
| **SEC-AI-ENGINEER-1** — AI Security Engineer | AI-assisted finding analysis; remediation proposals; Software Engineer handoff; QA verification; human approval | A finding becomes a safe fix draft through existing Work and Governance | New data-use purpose/class for source code; agent mandate (SECURITY-AGENT-D1 shape) |
| **SEC-ENTERPRISE-1** — Enterprise Expansion | Cloud, advanced API, AI agent security; IAM posture; compliance evidence; enterprise integrations | Verified enterprise workflows from real customer requirements | Real enterprise demand; provider connections |

**Recommended order change (for the Director):** SEC-FOUNDATION-1 and SEC-CLOUD-MVP-1 should share one
build — the capability built tenant-scoped from day one, with Hebun's tenant as the first "customer".
Building an internal-only version first and generalizing it later is the duplicate this strategy forbids.

**Naming.** `SEC-4` (Security Center boundary, released) already exists; these `SEC-*` names are new and
distinct.

## 14. Commercial Validation

Gates before money changes hands — each a Director decision:

1. **Demand:** at least a few named prospects confirm the MVP problem and price band.
2. **Unit cost:** measured cost per scan and per plan-month (§10).
3. **Isolation proof:** tenant-isolation tests for findings, reports and connections (the standard every
   Hebun tenant authority already meets).
4. **Data-use decision:** whether customer source code may reach an external model, under which cell.
5. **Legal:** terms, data-processing agreement, liability limits, vulnerability-disclosure handling.
6. **Pilot:** one authorized pilot customer, manually invoiced, end to end.
7. **Billing:** only after the pilot — provider choice and entitlements are their own decision.

**Strongest differentiator (to test):** governed, explainable remediation — findings that become
reviewable fix drafts through the customer's own approval flow with full provenance — rather than raw
scanning, which free tools already commoditize.

**Shortest path to a first paying customer:** pilot repository → GitHub App with source read on that repo
→ deterministic dependency + secrets analysis → findings with provenance → one report → pilot reviews it
→ manual invoice.

## 15. Risks & Dependencies

| Risk / dependency | Note |
|---|---|
| Source-code access | New GitHub permission (`contents:read`); today deliberately absent |
| Source code to external AI | No data class or purpose; customer consent and DPA needed |
| Secrets handling | A found secret must never be stored or sent in clear |
| Findings authority | None exists; must extend an owner, not create a Security authority |
| Commodity competition | Dependabot / secret scanning are free on GitHub; price against differentiation |
| False positives / negatives | Liability; findings must state confidence and source |
| Production provider readiness | GATE-D-PROVIDER-RECONCILIATION-1 is BLOCKED for Anthropic |
| Priority | §13.3: Hebun Enterprise AI → Heby → AI Agents stays first; RA-PREP-1 and other active work are unchanged |
| Billing | No billing system; building one early delays the pilot |
| Enterprise asks | SSO, SOC 2 evidence and support SLAs are large; defer until demanded |

## 16. Success Metrics

- Pilot: a customer reads a report on its own repository, with zero cross-tenant reads (measured).
- Finding quality: confirmed-true-positive rate on pilot repositories.
- Time from finding to reviewed remediation draft.
- Cost per scan vs plan price (gross margin).
- Conversion: pilot → paid; paid retention month over month.
- Internal: open high-risk findings on Hebun's own repository, trending down.

## 17. Future Expansion

After paid demand is measured: continuous monitoring, API and cloud posture, IAM posture, AI agent
security (building on SCI, §13.1.1), compliance evidence packs, CI integration, SSO and enterprise audit,
remediation PRs through a Governance-authorized write action. Each is its own decision. None is promised.
