# PUBLIC-KNOWLEDGE-FOUNDATION-1 · evidence notes · INTERNAL — NOT FOR KNOWLEDGE

**Scope.** Authorized by the Director on 2026-10-27 ("PUBLIC KNOWLEDGE FOUNDATION — Content Agent Activation —
Phase 1"). Preparation only: no production Knowledge written, ratified or cleared; no identity, mandate,
domain, work, model call, provider call, push or deployment. Repository reality: `origin/main` read as
`50486917` (equal to this branch's base). Production facts below come from the 2026-10-27 signed-in,
read-only Hebun session (Director-opened) and from closure records; memory was not used as evidence.

The public text is `hebun-public-knowledge-foundation-1-draft.md`. Nothing in this file may be copied
into Knowledge.

## 1 · Evidence matrix

Levels: IMPLEMENTED · DEPLOYED · VERIFIED (real behaviour proven; production where stated) · CONFIGURED ·
PLANNED · UNVERIFIED. "Public" = may appear in the public draft.

| # | Claim (as used in the draft) | Evidence | Level | Public |
|---|---|---|---|---|
| 1 | AI proposes, people decide; proposal ≠ approval ≠ permit ≠ execution ≠ outcome | ENTERPRISE-OPERATIONS-1 (PRODUCTION-ACCEPTED, walked read-only on Hebun); `/agents` "every proposal needs its own human decision and a single-use permit"; EXECUTION-RECONCILIATION-V1 | VERIFIED (prod) | Yes (S3) |
| 2 | Agents cannot approve own proposals, issue permits, execute, widen own authority | `/agents` "The agent itself does not" list; AMA-1/AMA-2 mandate enforcement; AE-1 shared mandate ceiling | VERIFIED (prod render + tests) | Yes (S3, S4) |
| 3 | Governance decisions keep their reason permanently | `/governance/authority` (genesis reason, decision ids); mandate revisions "never edited, kept exactly as authorized" | VERIFIED (prod) | Yes (S3) |
| 4 | AI data use is a per-class Governance decision, withdrawable | `/governance/authority` "AI assistance data use · Authorized (revision 4)", Withdraw control; EXTERNAL-AI-DATA-USE Release A/B | VERIFIED (prod) | Yes (S3) |
| 5 | Knowledge: author, ingest txt/md/pdf, versions, source, ratification, separate public-use decision | `/knowledge` render; K2/K3/R4C2/KT-3..5 | VERIFIED (prod render) | Yes (S2) |
| 6 | Heby answers from ratified Knowledge and shows what it rests on | HEBY-GROUNDED-CONVERSATION-1 (PRODUCTION-ACCEPTED) | VERIFIED (prod) | Yes (S2) |
| 7 | Work records and work domains; Heby proposes record-work / state change; a person approves and performs | ENTERPRISE-OPERATIONS-1, WORK-UPDATE-V1, HEBY-EXECUTE-AUTHORIZED-1 (DEPLOYED; interactive act acceptance pending) | VERIFIED (prod) for propose/approve; performing from Heby DEPLOYED only | Yes (S2), worded without "from Heby" |
| 8 | Heby recognises the responsible specialist, recommends with a reason, person chooses; agent writes draft; Governance review; revision on change request | AGENT-EXECUTION-1, AGENT-EXECUTION-2, HEBY-WORKFLOW-1 (all PRODUCTION-ACCEPTED, scoped) | VERIFIED (prod, scoped) | Yes (S2, S4) |
| 9 | Agent = identity owned by a human, registered by Governance decision; mandate = proposal ceiling + responsible work domain | `/agents` render; AP-4A, AP-5, AP-6a | VERIFIED (prod) | Yes (S4) |
| 10 | Agents hold no session or credential | `/agents` "These identities hold no credential and no session" | VERIFIED (prod render) | Yes (S4) |
| 11 | A specialist's difference is its responsibility, not domain expertise | AGENT-EXECUTION-2 closure: "no agent or domain identity reaches the model" | VERIFIED (design + tests) | Yes, as a limitation (S4, S7) |
| 12 | Engineering Agent works in production | Hebun `/agents`: in service, mandate rev 1, 1 proposal authorized; AGENT-EXECUTION-2 | VERIFIED (prod) | Not named in public text (tenant-specific configuration) |
| 13 | Content Agent | CONTENT-AGENT-SPECIALIST-1: A1–A11 on disposable PostgreSQL, model faked; no production identity/mandate/domain | IMPLEMENTED via configuration, VERIFIED (local test) only | **No** — not mentioned |
| 14 | Organizations can be created self-service; a human holds Governance authority | Self-service signup production acceptance; TENANT-ACTIVATION-1 (PRODUCTION-ACCEPTED, scoped) | VERIFIED (prod) | Yes (S2) |
| 15 | Instagram publication through an approved act | PUBLISH-0: real provider publish accepted, read back, seen on profile; afterwards tenant arming withdrawn | VERIFIED (prod, once, one tenant) | Yes, only as "when enabled for the organization" (S2, S5) |
| 16 | YouTube upload through an approved act | YOUTUBE-WRITE-2: one real PRIVATE upload, 2026-09-28 | VERIFIED (prod, once, private) | Yes, as "upload", never "publish" (S2, S5) |
| 17 | Outbound publishing is off by default per organization | `/governance/authority`: "Executing approved sends and posts · Not ready · Not armed… a platform operator ceremony; not available in the app" | VERIFIED (prod) | Yes (S5, S7) |
| 18 | Connectors: GitHub, Google Drive (chosen files only), YouTube, Instagram | Hebun readiness: available capabilities list incl. `google.drive.file.content.read`; GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1; GitHub INT reads | CONFIGURED/VERIFIED per tenant | Yes, generically (S5) |
| 19 | Provider acceptance ≠ delivery/read; no business-outcome record | `/agents` evaluation: "accepted is not delivered", "Business outcome · NO-AUTHORITATIVE-RECORD" | VERIFIED (design, prod render) | Yes (S5, S7) |
| 20 | Single-factor sign-in; no MFA/SSO; no password reset | Public `/login` page text | VERIFIED (prod, public) | Yes (S7) |
| 21 | Tenant isolation | Tenant resolved from the session; cross-tenant refusal tests (e.g. CAS-1 A1, many bite-proofs); no external audit | IMPLEMENTED + VERIFIED by tests | **Not as a claim** — see §2 |
| 22 | AI processor: no training, ≤30-day retention | `/governance/authority`: "attested by the platform operator, not independently verified" | CONFIGURED (attested) | **No** |
| 23 | Email sending to customers | TENANT-ARM-1 containment; TRH external send withdrawn; email not armed | IMPLEMENTED, not armed | **No** |
| 24 | Agent outcome/evaluation surface | `/agents` Outcome Observation and Evaluation (read-only) | VERIFIED (prod render) | Yes (S2) |
| 25 | Security patches (Next.js advisories) | SECURITY-HARDENING-1 (PRODUCTION-ACCEPTED) | VERIFIED (prod) | No — internal maintenance |

## 2 · Why some true things stay out of the public text

- **Tenant isolation, least privilege, provenance** are implemented and tested, but no external audit or
  certification exists. The draft states the observable behaviour (each organization's records are its own,
  agents hold no credential, every draft keeps its author and revisions) and never a guarantee. Content must
  not say "secure", "isolated" or "compliant" as an absolute.
- **Processor terms** are operator-attested; repeating them publicly would turn an attestation into Hebun's
  claim.
- **Provider names for the model** are left out: the bound processor is a Governance configuration that can
  change; the draft says "bir yapay zekâ sağlayıcısı" only.
- **Specific agents** (Engineering Agent, Heby's mandate, the Content Agent) are tenant configuration. Heby is
  named because it is the product's assistant in every organization.
- **Customer names, counts, numbers, tenant/deployment/commit ids** never appear in the draft (scanned:
  no hex ids, no `dpl_`, no tenant names).

## 3 · Communication boundaries

| Avoid | Why | Say instead |
|---|---|---|
| "Hebun tüm işlerinizi otomatik yönetir." | Every act needs a human approval, a permit and a human step | "Hebun işleri hazırlar ve önerir; kararı ve uygulamayı insanlar verir." |
| "Tüm agent'lar bağımsız karar verebilir." | Agents only propose inside a mandate ceiling | "Her agent, kuruluşun belirlediği sınırlar içinde öneri hazırlar." |
| "Her entegrasyon her müşteri için hazırdır." | Connections are per organization; publishing is off by default | "Bağlantılar her kuruluşun kendi hesabıyla ve izinleriyle kurulur." |
| "İnsan onayı olmadan güvenle yayın yapar." | The opposite is the design | "Hiçbir içerik insan onayı ve ayrı bir yayın izni olmadan yayımlanmaz." |
| "Tüm işlemler hatasız gerçekleşir." | Failed/unknown outcomes are first-class states | "Her işlemin sonucu — başarısız ya da belirsiz olanlar dahil — kayıt altına alınır." |
| "Tamamen otonom bir şirket işletir." | No autonomous execution exists | "Hebun, yapay zekâyı insan yönetişimi altında çalıştırır." |
| "Kurumsal düzeyde güvenlik / %100 güvenli / uyumlu" | No audit, MFA or SSO | "Yetkiler, onaylar ve kararlar kayıt altındadır." |
| "Uzman agent'lar alan uzmanıdır." | Specialty = responsibility, not model expertise | "Her uzman agent belirli bir iş alanından sorumludur." |
| "İçeriğiniz hedef kitleye ulaşır / etkileşimi artırır." | Hebun records no delivery or outcome | — (do not claim) |
| Any number (customers, hours saved, accuracy) | No such measurement exists | — (do not claim) |

## 4 · Content Agent compatibility (KT-5)

Read from source at `50486917`:

- A content draft is prepared with purpose `public-content` (`prepare-work-artifact.server.ts`). Its Knowledge
  is the **public-eligible universe**: an active version that is ratified **and** has public use `allowed`
  for that exact version (`isPublicPurposeEligible`).
- With **zero** eligible records the model is **not asked at all** (`no-public-eligible-knowledge`). Hebun is
  in that state today: the only ratified record (an internal test fact) has no public-use decision.
- With ≤ 20 eligible records the whole universe is supplied (`bounded-universe`). The draft adds 7, so all 7
  reach the model on every content draft.
- Statements: 738–1,071 code points each, under the 2,000 grounding bound and the 20,000 authoring bound.
- The content brief requires every organizational fact to come from that context and forbids claims of
  verification/certification and of publication — consistent with sections 3, 6 and 7.
- **Keep the internal test record out**: never allow it for public use, or it is handed to every content
  draft.
- **Sufficient for one Instagram caption: yes**, for captions about human-governed AI, Heby, and
  approval-before-publication. Not sufficient for prices, plans, customers, availability dates or results.

**First controlled acceptance brief (Instagram, content-draft):**

> Hebun AI'ın temel ilkesini anlatan tek bir Instagram gönderi metni hazırla: yapay zekâ önerir ve hazırlar,
> kararı insan verir; hiçbir içerik insan onayı olmadan yayımlanmaz. Yalnızca kuruluşun Knowledge kayıtlarındaki
> bilgileri kullan. Rakam, müşteri adı, entegrasyon vaadi, güvenlik garantisi veya gelecek tarihli bir özellik
> ekleme. Türkçe, en fazla 600 karakter, en fazla 3 hashtag.

Acceptance read: every sentence traceable to S1, S3 or S6; no claim from §3's "Avoid" column.

## 5 · Director actions (existing authoritative surfaces, in order)

1. Review and approve or edit the 7 statements in the draft file (text is immutable once a version exists).
2. `/knowledge` → *Create organizational Knowledge*, once per section: fact key, domain, scope `company-wide`,
   title, statement exactly as approved.
3. `/knowledge` → *Governance review* → *Review to ratify* for each new v1 (Governance authority).
4. `/knowledge` → *Public factual use* → *Allow public factual use…* for each same v1 (a separate decision).
5. Leave the internal test record without a public-use decision (or *Deny*).
6. Then continue the activation order already recorded in CONTENT-AGENT-SPECIALIST-1 §5: domain ceremony,
   identity, mandate, content work, one approved preparation with the brief above.

## 6 · Verification

V0: documentation only. `git diff --check` clean; no closure record touched, so no continuity change; no `.ts`
touched. Statement lengths measured with Python `len` (code points). Leak scan for hex ids, `dpl_`, tenant ids
and tenant names on the draft: none.
