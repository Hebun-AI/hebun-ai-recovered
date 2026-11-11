# Hebun AI — Master Plan V2 (14 packages)

**Status: RECORDED PLAN.** Recorded by Director instruction on 2026-11-10. This document records the
14-package development plan the Director decided. It starts no work, selects no phase beyond the one
named below, and authorizes no code, schema, migration, provider connection, credential change,
deployment or payment. Every package still needs its own design gate and Director decision before
implementation, as `CLAUDE.md` and `hebun-loop.md` require.

**Relationship to `MASTER-ROADMAP.md`.** This plan does not replace, rewrite or amend
[`MASTER-ROADMAP.md`](MASTER-ROADMAP.md). The roadmap stays the authority for closed phases (§21), open
deferred risks (§22), era structure and every recorded decision. Where this plan and a roadmap
record disagree about the state of something already built, the roadmap's closure record wins. This
plan only orders future product work into 14 packages.

**Evidence basis.** Implementation states below were read from remote `main` at `6feb8d7f` and from
the named branches on 2026-11-10. No production system was contacted for this document. A goal decided
in conversation is recorded as a goal, never as a production state.

### State vocabulary

| State | Meaning here |
|---|---|
| IMPLEMENTED | Code exists on `main`; its closure record states its production state |
| PARTIAL | Some of the package's scope exists on `main`; the rest does not |
| PLANNED | Decided as a direction by the Director; not built |
| PROPOSED | Written down in a repository or archive document; not decided |
| DEFERRED | Consciously postponed by a recorded decision |
| BLOCKED | Cannot proceed because of a concrete, recorded blocker |
| UNKNOWN | Not enough evidence to classify |

```
PLAN RECORDED  != WORK AUTHORIZED
GOAL           != PRODUCTION STATE
MOCK / SEEDED  != WORKING FEATURE
SIMULATION     != RUNTIME
```

---

## Order and current position

| # | Package | Package state | Note |
|---|---|---|---|
| P1 | Commercial Activation | PARTIAL — verified on a branch, not on `main` | Waits for its own activation approval |
| P2 | Design System | COMPLETE (current scope) — on branch `feat/p2-visual-polish`, not on `main` | Closed 2026-11-10 at `069fb90e`; Customer Shell not enabled by default. See P2 §3 |
| P3 | Customer Dashboard | PLANNED | |
| P4 | Platform Admin Dashboard | PLANNED | |
| P5 | Heby & AI Agent Platform | PARTIAL | |
| P6 | Research & Opportunity Intelligence | PARTIAL | |
| P7 | Content Studio & Integrations | PARTIAL | Largest delivered package |
| P8 | Business Management | PARTIAL | |
| P9 | Hebun Security | PARTIAL | P9.7 Hebun Shield is an independent product |
| P10 | Heby Computer & Browser Automation | PROPOSED | No runtime exists |
| P11 | Advertising Management | PROPOSED | |
| P12 | SEO Management | PROPOSED | |
| P13 | Marketing Management | PROPOSED | |
| P14 | Final Integration & Customer Acceptance | PLANNED | |

The order is kept. Finishing one package completely is **not** an automatic prerequisite for starting
the next. P1's code stays on its branch; commercial activation needs its own approval. P2 starts with a
design decision, and development follows that decision.

## Dependencies

| From | To | Meaning |
|---|---|---|
| P2 | P3, P4 | Both dashboards are built on the design system |
| P5 | P6, P10, P11, P12, P13 | Specialist work runs through the agent platform: identity, mandate, Governance |
| P7 | P11, P13 | Advertising and marketing reuse content, media and channel connections |
| P8 | P10, P11, P13 | Tasks, approvals and notifications carry consequential work |
| P9 | every package | Existing security controls are kept in every package; none is switched off |
| P1 | every package | The commercial plan defines usage rights and limits |

These are relationships, not gates. A dependency only blocks work where the dependent part actually
calls for it.

---

## P1 — Commercial Activation

1. **Purpose.** Let organizations use Hebun on Free or Pro, with founding organizations kept on their
   released behaviour, and let an Owner pay through Stripe.
2. **Features.** Free / Pro / Founding · Stripe Checkout · Customer Portal · subscription management ·
   usage limits · pricing page · legal pages · billing · production activation.
3. **Current state — PARTIAL (branch only).**
   - Branch `feat/commercial-activation` (head `428ff242` at the time of writing) holds the
     implementation (`c7e8022d` and follow-ups) and its closure record,
     `hebun-commercial-activation-1-closure.md`. The closure states **VERIFIED**: synthetic data and a
     scripted Stripe only.
   - The branch has: Free (15 requests, 1 image per UTC day, no video, 1 member) and Pro ($49/month:
     100 requests, 10 media including video, 5 members); founding tenants (migration 86) keep 50/5;
     Checkout; a signed webhook as the only writer of `companies.plan`; `/pricing`, `/refund`, and
     draft Terms and Privacy sections.
   - `main` has only the read-only `/account/plan` page (V1-STAGE-6, DEPLOYED). No payment path is on
     `main`.
4. **Missing.** CA1-STRIPE-TEST-E2E-1, CA1-LEGAL-APPROVAL-1, CA1-TAX-1 and CA1-PROD-MIGRATION-86-1
   (all DEFERRED in that closure); merge; deployment; live mode.
5. **Dependencies.** Stripe test and live configuration; Director approval of the legal texts; a tax
   decision.
6. **Security and authority limits.** The Stripe webhook is the only writer of the plan. Live mode is
   refused outside production. Real payments, the production migration, environment variables, merge
   and deploy are each a separate Director gate.
7. **Done when.** A real Free → Pro → cancel walk passes in Stripe test mode on a preview deployment;
   the legal texts are approved; migration 86 is applied by its ceremony; a release is deployed and
   accepted in production by its own closure.

## P2 — Design System

1. **Purpose.** One visual and interaction language for the customer and admin experiences, with Heby
   at the centre.
2. **Features.** Visual identity · Light mode as default · Dark mode as an option · typography ·
   colours · components · responsive layout · navigation · Heby-centred UX.
3. **Current state — COMPLETE (current scope), 2026-11-10.** Release candidate `069fb90e` on branch
   `feat/p2-visual-polish` (2A `c08530d1` → 2B `0dac9de4` → 2C `069fb90e`). Not merged, not pushed, not
   deployed: **production is unchanged**.
   - 2A: Light (customer default) / Dark (admin default) theme with a persisted preference, mono font,
     shared components (Input, Select, Checkbox, Switch, Tabs, Modal/Drawer, Toast, Tooltip, Dropdown).
   - 2B: grouped Customer navigation (`config/customer-nav.ts`), responsive sidebar; areas without a
     runtime are not rendered. The Director shell is unchanged and remains the default.
   - 2C: control edges ≥3:1 in Light and Dark (`--color-border-control`), focus/hover states, mobile
     sizes, keyboard tooltip on the collapsed rail.
   - **The Customer Shell is not active by default.** It renders only when the server setting
     `HEBUN_SHELL_EXPERIENCE=customer` is set; P2 closing does not mean it is live in production.
   - Verification at `069fb90e`: full suite once, sequential, disposable detached worktree with a
     session-owned PostgreSQL 18 on 127.0.0.1:55432 (system identifier 7706516258370629795):
     1161 PASS / 3 FAIL / 1164. `br1-restore-drill` and `br2-backup-vault` were environment-blocked
     (`pg_dump` 14 on PATH against server 18) and PASS when re-run with PostgreSQL 18 tools;
     `r3w-flow/ambient-database-safety` BLOCKED (canonical `hebun_r1` absent;
     OR2-R3W-AMBIENT-DB-BLOCKED-1, not a pass). 0 REGRESSION; P2 changes no backup, database or auth
     file. `tsc --noEmit` PASS · ESLint 0 errors (25 pre-existing warnings, none in P2 files) ·
     `npm run build` PASS.
   - **DEFERRED** (Director decision, not complete): Heby chat / composer / quick-panel visual renewal;
     Live Map visual renewal and theme work.
   - **BLOCKED → P4:** Platform Admin access. Its navigation config and compact styles exist but are
     mounted nowhere; no platform operator principal exists to gate it on.
4. **Missing.** Nothing in the current scope. Open beyond it: the deferred and blocked items above, and
   enabling the Customer Shell by default (a separate Director decision).
5. **Dependencies.** None blocking. P3 and P4 depend on P2.
6. **Security and authority limits.** Visual work changes no authority. A redesign must keep every
   truth qualifier (empty states, MOCK labels, "not connected") that existing surfaces show.
7. **Done when.** The Director approves the design decision; Light (default) and Dark both pass the
   readability contract; the existing UI suites still pass.

## P3 — Customer Dashboard

1. **Purpose.** The customer's home: Heby in the centre, every product area one step away. Not a task
   list only.
2. **Features.** Heby-centred home · customer sidebar · AI Agents · Research · Content Studio ·
   Computer & Browser · Marketing · Advertising · SEO · Business Management · Security · Integrations ·
   Account Settings.
3. **Current state — PLANNED.** One sidebar exists (`config/sidebar.config.ts`); it is Director- and
   operator-oriented and mixes real routes with mock centres (Finance, HR, Legal). Real customer pages
   that exist today: Heby, `/operations`, `/approvals`, `/notifications`, `/account`, `/account/plan`,
   `/tickets`, `/agents`, Knowledge, integrations.
4. **Missing.** A customer sidebar distinct from the admin one; the Heby-centred home. Entries for
   Computer & Browser, Advertising and SEO, which have no runtime (P10–P12).
5. **Dependencies.** P2.
6. **Security and authority limits.** A sidebar entry never implies a capability. An area without a
   runtime is shown as not available, never with seeded data.
7. **Done when.** A signed-in member and a Governance authority each see only their own organization's
   real surfaces, and every unavailable area says so.

## P4 — Platform Admin Dashboard

1. **Purpose.** A separate operator interface for running the platform, distinct from any customer
   view.
2. **Features.** Customer management · subscription management · revenue · AI usage · platform costs ·
   security · operations · platform configuration.
3. **Current state — PLANNED.** No in-product platform operator identity exists. Tenant provisioning,
   lifecycle and Genesis nomination run as operator CLI ceremonies. `/platform` and `/director/*` are
   tenant-side surfaces, not a cross-tenant admin.
4. **Missing.** A platform operator principal and its authorization; the admin interface; cross-tenant
   read seams that expose only what each view needs.
5. **Dependencies.** P2; P1 for subscriptions and revenue.
6. **Security and authority limits.** Earlier Director instructions (2026-08) said not to build a
   *generic* admin dashboard or invent a platform admin identity without architecture support. This
   package is the Director's later decision to build a separate one. It must still: create a real
   operator principal through a design gate; never give operators access to customer credentials
   (BYOK, P5); expose no tenant content beyond what a view needs; audit every operator action.
7. **Done when.** An operator principal exists by design gate; every admin read is authorized and
   audited; a cross-tenant leak test passes; no customer credential is readable.

## P5 — Heby & AI Agent Platform

1. **Purpose.** Heby as the assistant, with specialist agents working under mandate and Governance.
2. **Features.** Heby assistant · specialist AI agents · agent orchestration · automation engine ·
   BYOK · agent permissions · Governance · task execution · agent results.
3. **Current state — PARTIAL.**
   - Heby: grounded conversation, continuity, `/performance`, planning (§21; many PRODUCTION-ACCEPTED).
   - Agents: AP-1…AP-5, AP-6a, AGENT-EXECUTION-1/2, Content Agent and Security Planning Agent
     registered in production; Rung 2 automatic delivery accepted (§20.5, §21).
   - Lifecycle: AP-3, L-1b, L-2b and CONTENT-AGENT-2 are DEPLOYED with acceptance open; AP-6b DEFERRED.
   - BYOK: decided as a goal (the customer connects their own provider; platform operators can never
     read customer credentials). Technical architecture **not decided**. Nothing in code.
   - **Seeded and mock agents** (`features/agents/mock.ts`, 36 definitions such as "SEO Agent", "Sales
     Agent") are fiction and are not working features.
4. **Missing.** BYOK design and implementation; agent orchestration beyond today's selection and
   delegation; permission and policy authorities (the backlog's Permission and Policy Engines).
5. **Dependencies.** GATE-D-PROVIDER-RECONCILIATION-1 (**BLOCKED**) for production Anthropic readiness;
   External-AI Data Use cells for every new purpose.
6. **Security and authority limits.** An agent proposes; Governance decides; a permit authorizes; an
   executor executes. BYOK credentials are tenant-owned and never readable by operators.
7. **Done when.** A customer connects their own provider key, no operator path can read it, and a
   specialist agent's work runs end to end under mandate and Governance in production.

## P6 — Research & Opportunity Intelligence

1. **Purpose.** Research the market, competitors and opportunities, and deliver verifiable reports.
2. **Features.** Business research · market research · competitor intelligence · opportunity
   discovery · customer opportunities · research reports · daily autonomous research.
3. **Current state — PARTIAL.** RA-AUTH-1 and RA-EAI-1 are PRODUCTION-ACCEPTED; RA-PREP-1 is DEPLOYED.
   Per its closure, no route, server action or component calls the research seam, no tenant holds a
   research authorization, and no web search exists. The only crons in `vercel.json` are three hourly
   scans (observation, machine delivery, standing issuance); none is research.
4. **Missing.** A reachable research entry point; an external research source; tenant research
   authorization; the daily schedule.
5. **Dependencies.** P5; GATE-D; a data-use decision for any new source.
6. **Security and authority limits.** Research prepares; it does not act. A scheduled run spends money
   and needs its own authorization and cost bound.
7. **Done when.** Research runs **every morning at 08:00** for an authorized tenant and files a
   sourced report.

   **Schedule decision.** The current target is **08:00**. The earlier record — the Director's
   2026-10-28 instruction "her sabah 09.00'da otomatik çalışması" (session `bba106d8`, COMMERCIAL
   OPERATIONS, Bölüm 1) — is kept as history and is superseded by 08:00 in this plan.

## P7 — Content Studio & Integrations

1. **Purpose.** Prepare, review, publish and measure content across connected channels.
2. **Features.** Text generation · image generation · video generation · media library · Instagram ·
   YouTube · Google Drive · content calendar · publishing · content analytics.
3. **Current state — PARTIAL, largely IMPLEMENTED.**
   - Content preparation CGO-1…9 and media MEDIA-1…5; video chain MV-4/5/7 accepted.
   - Instagram: publish and measurement accepted. YouTube: WRITE-2 private upload and recorded
     measurement accepted. Google Drive: Picker / `drive.file` PRODUCTION-ACCEPTED (§12B).
   - Content calendar: V1-STAGE-2 DEPLOYED. It schedules human-triggered publication proposals; a
     schedule publishes nothing by itself.
   - Limits per their closures: image generation allowed only for OpenAI reference-edit (data-use
     guard); MV-6 (Higgsfield) not closed.
4. **Missing.** Automatic publication at the scheduled minute; public YouTube publishing; additional
   social providers.
5. **Dependencies.** External-AI Data Use cells; provider connections per tenant.
6. **Security and authority limits.** Publishing is a governed external action under permit; READY
   package checks stay mandatory.
7. **Done when.** A tenant prepares, approves, schedules and publishes to a connected channel, and the
   measurement comes back, all in production.

## P8 — Business Management

1. **Purpose.** Run the organization's work: tasks, people, approvals and operations.
2. **Features.** Tasks · teams · roles · approvals · notifications · calendar · business operations ·
   business analytics.
3. **Current state — PARTIAL.**
   - Work authority, WORK-UPDATE V1 and plan delegation are accepted.
   - `/approvals` dashboard released.
   - V1 stages 3 (notifications), 4 (`/account` profile and team) and 5 (`/tickets`) are DEPLOYED
     under the 2026-11-09 scope freeze.
   - Roles exist; `permissions` and `role_permissions` have no runtime readers.
   - **Mock:** the Finance, HR and Legal centres in the sidebar are seeded data, not features.
4. **Missing.** A general calendar (beyond the content calendar); business analytics; external
   notification delivery; live checks of the member role and cross-tenant access
   (V1-MEMBER-ROLE-LIVE-1, V1-CROSS-TENANT-LIVE-1, DEFERRED).
5. **Dependencies.** P5 for agent work; P9 for authorization.
6. **Security and authority limits.** Governance authority stays the decision owner; no parallel
   permission system.
7. **Done when.** A member and a Governance authority each complete their flows in production, and
   cross-tenant access is proven refused live.

## P9 — Hebun Security

**Purpose.** Protect Hebun's own platform and, later, offer security to customers — without creating a
Security Sentinel or any new central security authority (§7, §20.4). Existing security controls are
recorded as completed. Unbuilt features are not shown as active. SECURITY-AGENT-D1's limits stand: the
Security Planning Agent prepares internal drafts only, scans nothing and changes nothing.

Sources: roadmap §7, §12.1, §13.1, §13.1.1, §13.4, §14;
`product-vision/security/hebun-security-product-strategy.md`;
`product-vision/runtime/hebun-security-agent-d1-decision.md`.

### P9.1 Internal Security

- **Features.** Authentication · tenant isolation · API security · credential security · database
  security · application security · supply-chain security.
- **State — PARTIAL.**
  - IMPLEMENTED: scrypt password hashing, 15-minute credential lockout, session idle and absolute TTLs,
    email-proof rate limits (AUTH-EMAIL-OWNERSHIP-1, PRODUCTION-ACCEPTED, scoped).
  - IMPLEMENTED: app-level tenant isolation with cross-tenant tests. No database row-level security.
  - IMPLEMENTED: integration credential encryption and key rotation.
  - Next.js security release (SECURITY-HARDENING-1, PRODUCTION-ACCEPTED); ceremony TLS verify-full
    (SH1-PG-CEREMONY-TLS-1, VERIFIED).
  - PLANNED: API, database, application and supply-chain analysis (strategy §6).
- **Missing.** Deferred SH1 risks (SH1-APP-SHARP-1, SH1-BUILD-TOOL-ADVISORIES-1, SH1-PG-SSLMODE-1,
  others in §22); MFA and password reset (absent; no plan record); a live cross-tenant proof.
- **Done when.** SEC-FOUNDATION-1's acceptance holds: an authorized, verifiable assessment of Hebun's own
  repository is recorded in Hebun's tenant.

### P9.2 Security Dashboard

- **Features.** Security overview · findings · audit logs · monitoring sources · security reports.
- **State — PARTIAL.** The Security Center is a released, read-only surface that renders empty
  collections honestly (§14). E2-2 connected security observation to the existing audit sink (CLOSED).
  No findings record and no monitoring source exist.
- **Done when.** Every number the dashboard shows comes from an authoritative record; with no data it
  shows an empty state, never zero or a fabricated score.

### P9.3 AI & Agent Security

- **Features.** Prompt-injection protection · agent permissions · AI data security · Security Planning
  Agent · AI security assessment.
- **State — PARTIAL.**
  - IMPLEMENTED: External-AI Data Use gate; B2-REFUSAL-GUARD-1 and OUTPUT-INTEGRITY-1 (DEPLOYED);
    EAI-HISTORY-ORIGIN-1 (PRODUCTION-ACCEPTED); mandate ceilings and agent lifecycle.
  - Security Planning Agent: registered in production 2026-10-27 per the D1 amendment on branch
    `docs/security-agent-d1-provenance` (`de792599`, not on `main`).
  - PLANNED · NOT IMPLEMENTED: Secure Content Ingestion / Ingestion Guard (§13.1.1).
  - PLANNED: AI security assessment (strategy §6).
- **Done when.** Ingestion Guard is released by its own gate, and agent permissions are enforced by an
  authority rather than by convention.

### P9.4 Threat Detection

- **Features.** Threat analysis · IP intelligence · security alerts · threat intelligence.
- **State — PROPOSED.** Nothing in code. Threat detection must not become a Sentinel: it has to extend
  an existing owner (§7.3). Alerts have no owner and no delivery path. The V1 notification centre
  carries no security events.
- **Done when.** A Director decision names the owner; alerts are derived from authoritative evidence
  only; no automatic blocking without a separate approval.

### P9.5 Security Operations

- **Features.** Audit management · findings management · incident management · security reporting ·
  Governance.
- **State — PARTIAL.** The `audit_log` append-only sink is IMPLEMENTED. A findings record has no owner
  (strategy §7: a Director design decision). An incident authority is created only if a product
  requirement justifies one (§12.1). Per-tenant containment and security-exception handling are future
  constraints (§13.1).
- **Done when.** Findings and incidents have an owner by design gate, each tenant-scoped with provenance,
  and remediation passes through Work and Governance.

### P9.6 Hebun Security Cloud

- **Features.** Repository security · dependency analysis · secret scanning · SAST · cloud security ·
  continuous security · AI Security Engineer · enterprise security.
- **State — PLANNED · NOT IMPLEMENTED** (§13.4, Director 2026-10-29). Phases: SEC-FOUNDATION-1 →
  SEC-CLOUD-MVP-1 → SEC-CONTINUOUS-1 → SEC-AI-ENGINEER-1 → SEC-ENTERPRISE-1. The strategy recommends
  building FOUNDATION and CLOUD-MVP as one tenant-scoped capability.
- **Dependencies.** The GitHub App deliberately lacks `contents:read`; no source-code data class; no
  findings owner; GATE-D BLOCKED. The commercial validation gates are in strategy §14.
- **Done when.** A pilot customer analyses its own repository and reads only its own reports (SEC-CLOUD-
  MVP-1 acceptance).

### P9.7 Hebun Shield — independent product, planning reference only

**Director decision (2026-11-10): Hebun Shield stays independent of Hebun AI.** It has:

- its own repository;
- its own database;
- its own infrastructure;
- its own credential management;
- its own production authorization;
- its own commercial activation.

P9.7 is only a planning reference to a related product. **Shield's development is not a completion
requirement for P9.** No Shield code, data or credential enters this repository. Shield's plan lives in
its own archive: `Company 01 - Digital Systems/03 - Product Lab/Hebun Shield/` (11 documents, 2026-10-08,
Company Product Backlog #11, PLANNED; SHIELD-1…SHIELD-10; modules include website monitoring, file
integrity and Cloudflare integration).

## P10 — Heby Computer & Browser Automation

1. **Purpose.** Let Heby operate computers, browsers and files on the user's behalf, with approval.
2. **Features.** Computer use · browser automation · file operations · Google Drive files · Excel / CSV
   · PDF catalogues · e-commerce product management · bulk product upload · Shopify · WooCommerce ·
   WordPress · SEO metadata · pricing · inventory · approvals · retry / recovery · execution logs.
3. **Current state — PROPOSED. No runtime exists.** Program VII (Computer Use, Phases 40–43) is
   published architecture with no runtime. The backlog's "Device Runtime & Computer Use" initiative is at
   Future Investigation. `/director/providers/browser` and `/director/providers/computer-use` render a
   **simulation** (`browser-simulation.tsx`), not a capability. No Shopify, WooCommerce or WordPress
   provider exists. Bulk product entry and inventory overlap with FC-A and FC-D (§13.3, FUTURE /
   DEFERRED).
4. **Missing.** All of it: device identity, observe and act grants, an executor, audit, kill switch.
5. **Dependencies.** P5 (permission authority); P8 (approvals).
6. **Security and authority limits.** Observe and act are separate grants; an observe grant confers no
   action. Every consequential step needs approval. This is the highest blast-radius capability in the
   catalogue.
7. **Done when.** An approved multi-step task runs on an authorized device or site, every step is logged
   and reversible where possible, and the kill switch stops it.

## P11 — Advertising Management

1. **Purpose.** Plan, run and measure paid campaigns.
2. **Features.** Google Ads · Meta Ads · campaign management · budget management · audience targeting ·
   advertising analytics · ROAS · AI Advertising Agent.
3. **Current state — PROPOSED.** No advertising provider or code. The backlog's Growth & Commerce
   Engine is at Future Investigation. §20.4 classifies Performance Marketing as TOO EARLY / DEFER, and a
   budget-holding agent as ARCHITECTURALLY CONFLICTING.
4. **Missing.** Provider connections, a bounded spend-permit authority, attribution.
5. **Dependencies.** P5, P7, P8, P1.
6. **Security and authority limits.** **Advertising spend never starts without the user's approval.**
   Connecting a provider grants no ability to spend; every spend runs inside a bounded permit, which
   ends when exhausted and does not renew itself.
7. **Done when.** A user-approved bounded campaign runs and is measured, and no spend happens outside a
   permit.

## P12 — SEO Management

1. **Purpose.** Improve search visibility for the customer's sites and products.
2. **Features.** Technical SEO · keyword research · competitor SEO · Google Search Console · e-commerce
   SEO · product SEO · content optimization · SEO reporting · SEO Agent.
3. **Current state — PROPOSED.** §20.4 records SEO as NEW EXTENSION (capability) · DEFER: "no provider;
   seeded entry is fiction". The seeded "SEO Agent" in `features/agents/mock.ts` is not a feature.
   Hebun's own public site SEO metadata is not this product.
4. **Missing.** A Search Console (or other) provider read capability; site access; reporting.
5. **Dependencies.** P5; P10 for applying changes to e-commerce sites.
6. **Security and authority limits.** Reading is not writing; any change to a customer site is a
   governed action.
7. **Done when.** A tenant connects a real search provider and receives a sourced SEO report; approved
   changes are applied and logged.

## P13 — Marketing Management

1. **Purpose.** Strategy, campaigns and customer communication.
2. **Features.** Marketing strategy · campaign planning · email marketing · customer segmentation ·
   marketing funnels · customer journey · marketing analytics · Marketing Agent.
3. **Current state — PROPOSED / PARTIAL.**
   - Marketing Intelligence domain architecture is published (`architecture/enterprise-domain-
     intelligence/07-marketing-intelligence.md`); it is explicitly not campaign management.
   - One governed email send exists (TENANT-ARM-1).
   - §20.4: Email / CRM is partially covered; CRM is TOO EARLY / DEFER; bulk sending CONFLICTING until
     recipient-class authority and delivery truth exist.
   - Social analytics exist through P7.
4. **Missing.** Segmentation, campaigns, bulk email with consent, a CRM or contact authority.
5. **Dependencies.** P5, P7, P8.
6. **Security and authority limits.** Consent and personal-data limits; an audience segment is never a
   person; no bulk send without recipient authority.
7. **Done when.** A consented campaign is planned, approved, sent and measured in production.

## P14 — Final Integration & Customer Acceptance

1. **Purpose.** Prove the whole product works for a real customer.
2. **Features.** Integration acceptance · customer onboarding · product experience · reliability ·
   commercial acceptance · release verification · production deployment · customer acceptance.
3. **Current state — PLANNED.** Pieces exist: self-service signup and tenant activation
   (PRODUCTION-ACCEPTED, scoped); CI quality gates (DEPLOYED); BR-1 restore drill; V1.0 scope freeze
   (DEPLOYED, not PRODUCTION-ACCEPTED). Off-site backup is DEFERRED by the Director (V1-OFFSITE-BACKUP-1,
   BR-2 activation gates).
4. **Missing.** A real second customer organization; live cross-tenant proof; commercial acceptance.
5. **Dependencies.** All packages that are in the release scope.
6. **Security and authority limits.** Push to `main` is a production deploy and a Director gate;
   production state is read from deployment records, never assumed.
7. **Done when.** An external customer signs up, pays, uses the released packages, and its acceptance is
   recorded in a closure under §16.1.
