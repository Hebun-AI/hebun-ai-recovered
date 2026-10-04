# EXTERNAL-AI-DATA-USE-B1B — Anthropic processor reviewed attestation record

**Status:** reviewed evidence record, Director-gated. **Not admitted.** This file records what
Hebun knows about one external processing boundary. It is the input the B1A ceremony
(`npm run platform:processor-attestation`) reads by `<path>@<sha>`; writing it changes no
database row, allows nothing, authorizes no organization, and changes no runtime path.

| | |
|---|---|
| Boundary | `anthropic/messages` (`POST https://api.anthropic.com/v1/messages`) |
| Account | Anthropic organization `14ea4a95-7d92-4844-8aca-5de14968a87d` |
| Evidence date | 2026-10-04 |
| Baseline | Release A `601db194`, B1A ceremony `33733cdd` |
| Platform policy | unchanged — `anthropic/messages` has no recorded cell (UNKNOWN). ALLOW is B1D. |

## Machine-readable record

The ceremony parses exactly this block and nothing else in this file.

```hebun-processor-attestation-record/v1
{
  "service_scope": "anthropic/messages",
  "account_ref": "14ea4a95-7d92-4844-8aca-5de14968a87d",
  "identity_status": "attested",
  "contract_surface": "anthropic-commercial-terms",
  "training": "none",
  "retention_class": "bounded-30-days",
  "zdr": "not-enabled",
  "model_treatment_class": "anthropic-non-covered-model",
  "model_ids": ["claude-haiku-4-5-20251001"],
  "region": "Workspace geo us (Director-observed); inference geo Global by default, any geo allowed (Director-observed); Claude Haiku 4.5 does not support inference_geo; per-request processing geography is not observable",
  "evidence_refs": [
    "director-observation 2026-10-04: Anthropic Console > Settings > Organization shows organization ID 14ea4a95-7d92-4844-8aca-5de14968a87d and offers 'Convert to team organization'",
    "director-observation 2026-10-04: Anthropic Console > Settings > Data retention shows the organization default 'On · 30 days'; the UI states that retention off applies Zero Data Retention",
    "director-observation 2026-10-04: Anthropic Console privacy controls show Development Partner Program 'Join' (not joined) and 'Allow user feedback' OFF",
    "director-observation 2026-10-04: workspace Dashboard (wrkspc_01UkHdAAjdjnLC7HSXjb2QXv) has 1 active API key and visible usage/cost; workspace Default has 0 API keys; Dashboard workspace geo US",
    "hebun-repository 601db194: apps/dashboard/src/features/heby-model-live/claude-http-transport.server.ts sends POST https://api.anthropic.com/v1/messages",
    "hebun-production read-only measurement 2026-10-04 (EXTERNAL-AI-DATA-USE-PROD-BASELINE): every live Claude origination invocation records provider claude, model claude-haiku-4-5-20251001",
    "https://www.anthropic.com/legal/commercial-terms (effective 2025-06-17, read 2026-10-04): governs use of Anthropic API keys; Anthropic may not train models on Customer Content from Services",
    "https://www.anthropic.com/legal/data-processing-addendum (effective 2025-02-24, read 2026-10-04): incorporated into the Commercial Terms; Anthropic is the customer's processor",
    "https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training (updated 2026-08-18, read 2026-10-04): commercial inputs and outputs are not used for training by default",
    "https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data (updated 2026-07-01, read 2026-10-04): deleted within 30 days; flagged content up to 2 years",
    "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention (no date shown, read 2026-10-04): ZDR is enabled per organization; Covered Models are Fable 5.1, Mythos 5.1, Fable 5, Mythos 5",
    "https://support.claude.com/en/articles/15425695-covered-models (updated 2026-09-01, read 2026-10-04): Claude Haiku 4.5 is not listed as a Covered Model",
    "https://platform.claude.com/docs/en/manage-claude/data-residency (no date shown, read 2026-10-04): us is the only workspace geo; inference_geo on Claude Haiku 4.5 returns 400",
    "https://support.claude.com/en/articles/11174108-about-the-development-partner-program (updated 2026-05-22, read 2026-10-04): the program shares only Claude Code tokens, not unrelated API calls"
  ],
  "attested_at": "2026-10-04"
}
```

## Provenance of every material claim

### A. Director-observed account evidence (Anthropic Console, 2026-10-04)

The Director inspected the Anthropic Console of the account behind Hebun's existing Claude API use.
Screenshots are **not** repository artifacts; they are represented here as dated Director
observations, with no invented path or hash.

| Observation | Field it supports |
|---|---|
| Settings > Organization shows organization ID `14ea4a95-7d92-4844-8aca-5de14968a87d`. The organization name was displayed as "Şenol's Individual Org" and the UI offered "Convert to team organization". Nothing further about the account type is inferred from those labels. | `account_ref`, `identity_status = attested` |
| Settings > Data retention: organization default "On · 30 days". The UI explains that with retention on, inputs, outputs and other data are kept 30 days by default, and that retention off applies Zero Data Retention. | `retention_class = bounded-30-days`, `zdr = not-enabled` |
| Development Partner Program shows "Join" (the organization has not joined). "Allow user feedback" is OFF. | `training = none` (with C) |
| Claude Code metrics logging ON. **Not used for any field** — it concerns Claude Code, not `/v1/messages` content. | — |
| Workspace Dashboard `wrkspc_01UkHdAAjdjnLC7HSXjb2QXv`: 1 active API key, visible usage/cost, geo US, inference geo Global by default / any geo allowed. Workspace Default: 0 API keys. | `region` (metadata); evidence that Dashboard is the account surface in use |

No API key value or fragment, billing, payment, tax, address or unrelated personal data is recorded.

### B. Repository and production evidence (Hebun)

| Fact | Source |
|---|---|
| Hebun's Claude transport calls `POST https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01`. | `apps/dashboard/src/features/heby-model-live/claude-http-transport.server.ts` at `601db194` |
| Production uses model `claude-haiku-4-5-20251001`. | Read-only production measurement (EXTERNAL-AI-DATA-USE-PROD-BASELINE, 2026-10-04): all live origination invocations record provider `claude` and that model |
| Production has an Anthropic credential configured (`ANTHROPIC_API_KEY` present by name in the production environment). Its value was never read. | Vercel environment variable listing, names only, 2026-10-04 |

### C. Official Anthropic public evidence (first-party sources, read 2026-10-04)

| Claim | Source (date shown) |
|---|---|
| The Commercial Terms govern use of Anthropic API keys; Anthropic may not train models on Customer Content from Services. | anthropic.com/legal/commercial-terms (effective 2025-06-17) |
| The DPA is incorporated into the Commercial Terms; the customer is controller and Anthropic is processor. | anthropic.com/legal/data-processing-addendum (effective 2025-02-24) |
| By default, commercial (API) inputs and outputs are not used for training. | privacy.claude.com article 7996868 (updated 2026-08-18) |
| Commercial inputs and outputs are deleted within 30 days; content flagged for usage-policy violations may be kept up to 2 years (trust-and-safety scores up to 7 years). | privacy.claude.com article 7996866 (updated 2026-07-01) |
| ZDR is enabled per organization through Anthropic; flagged content may be kept up to 2 years even under ZDR. | platform.claude.com/docs/en/manage-claude/api-and-data-retention (no date shown) |
| Covered Models are Claude Fable 5.1, Mythos 5.1, Fable 5 and Mythos 5. Claude Haiku 4.5 is not among them. | support.claude.com article 15425695 (updated 2026-09-01); api-and-data-retention |
| `us` is the only workspace geo; `inference_geo` on Claude Haiku 4.5 returns a 400 error. | platform.claude.com/docs/en/manage-claude/data-residency (no date shown) |
| The Development Partner Program shares only Claude Code tokens, not unrelated API calls. | support.claude.com article 11174108 (updated 2026-05-22) |

Public documentation describes Anthropic's terms for every API account. It is **not** used here as
proof of anything specific to this account; account-specific facts come only from section A.

### How each machine-readable field is derived

| Field | Value | Derivation |
|---|---|---|
| `service_scope` | `anthropic/messages` | B (transport) |
| `account_ref` | `14ea4a95-…a87d` | A (Settings > Organization) |
| `identity_status` | `attested` | A — a Director-observed statement reviewed here. Not `verified`: no runtime observation of the organization has been admitted. |
| `contract_surface` | `anthropic-commercial-terms` | C — the terms that govern use of Anthropic API keys. Whether a negotiated agreement supplements them is **not established** (see Unresolved). |
| `training` | `none` | C (no training on Customer Content; no training by default) together with A (Development Partner Program not joined; user feedback off). The program covers only Claude Code traffic in any case. |
| `retention_class` | `bounded-30-days` | A (organization default "On · 30 days") consistent with C (deleted within 30 days). Trust-and-safety retention of flagged content is part of this class's reviewed meaning. |
| `zdr` | `not-enabled` | A — the organization default is retention on, which the UI distinguishes from Zero Data Retention. This is an observation, not an inference from missing evidence. |
| `model_treatment_class` | `anthropic-non-covered-model` | C — Claude Haiku 4.5 is not a Covered Model. |
| `model_ids` | `["claude-haiku-4-5-20251001"]` | B (production measurement) |
| `region` | metadata text | A (workspace geo, inference geo) and C (Haiku 4.5 has no `inference_geo`). Compliance metadata only; never an authorization input. |
| `attested_at` | `2026-10-04` | Date of the Director observations and the public-source reads. |

## Unresolved — recorded, not converted into facts

- **Credential ↔ workspace.** Hebun production uses an Anthropic credential (B), and the Dashboard
  workspace has one active key with actual usage (A). The relationship is strongly consistent. It is
  **not verified** that Hebun's production credential is the Dashboard key: no response header or
  other runtime observation of the organization has been made or admitted.
- **Negotiated agreement or BAA.** Neither the existence nor the absence of a custom or negotiated
  Anthropic agreement, BAA or other special data-processing agreement is established. The Console
  is not documented to show it.
- **Per-request processing geography.** Inference may be routed globally; the region actually used
  for a request is not observable.
- **Flagged-content retention.** Whether any request from this organization has been flagged by
  trust and safety (up to 2-year retention) is not observable.
- **Any other account treatment** not listed in section A is not evidenced and is not claimed.

These uncertainties do not prevent recording what is known. Whether they are acceptable is a
separate decision: the platform disclosure policy (B1D), which this record does not change.

## What admitting this record will and will not do

When the Director runs the B1A ceremony with this record's `path@sha` in a separate gate, it will
append revision 1 of the `anthropic/messages · 14ea4a95-…a87d` lineage in `processor_attestations`.
That is all. The platform policy still has no ALLOWED cell, so every disclosure decision for
`anthropic/messages` remains `platform-unknown`; no organization is authorized; the Claude runtime,
transport and R2E are unchanged.
