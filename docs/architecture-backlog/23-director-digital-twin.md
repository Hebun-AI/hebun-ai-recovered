# 23 — Director Digital Twin

**Priority:** Future
**Status:** Planned — prerequisite-gated (see *Deferment*)

## Purpose

A **governed, evidence-based representation of the Director's decision model**.

Not a persona prompt. Not an avatar. Not a voice. The Twin exists to represent *how the Director tends to evaluate*, derived from the organization's real record of Director decisions — so that the enterprise can tell the Director what deserves their attention, and why, before their time is spent.

## Not to be confused with — the naming collision that matters most

**[21 — Enterprise System Map (Digital Twin)](21-enterprise-system-map.md) is a digital twin of the ORGANIZATION. This is a digital twin of the DIRECTOR.** Both legitimately carry the phrase "digital twin" and they model different subjects:

| | 21 — Enterprise System Map | 23 — Director Digital Twin |
|---|---|---|
| Models | how the company runs | how the Director evaluates |
| Reads | capability, agent, task, event, data signals | the historical record of Director decisions |
| Produces | a live visual map | a derived Director-perspective evaluation |
| Never | intervenes | decides |

Keeping them apart is not bookkeeping — it is the product principle in §*Product principle* below. There is also a **Capability Digital Twin** recorded in [business-capabilities/49 — Future Extension Points](../architecture/business-capabilities/49-future-extension-points.md), whose own constraint reads *"Twin is a representation, not the Capability."* The same sentence governs here: **a Twin is a representation, not the Director.**

Also distinct:

- **[09 — Director Memory](09-director-memory.md)** — *stores* what was decided, learned and preferred. Memory never acts and never reasons. The Twin is a derived evaluator that **reads** that substrate; it does not replace it, and it must not become a second place where preferences are recorded.
- **[19 — Learning Engine](19-learning-engine.md)** — distils organizational patterns from history to improve recommendations generally. The Twin is narrower and personal: it models one accountable human's evaluation, not the organization's.

## Responsibilities

The Twin **may eventually**:

- evaluate proposals from the Director's strategic perspective;
- compare a new proposal with historical Director decisions;
- identify likely alignment or conflict;
- prioritize what deserves Director attention;
- explain *why* a proposal appears aligned or misaligned;
- generate recommendations;
- estimate what the Director might prefer;
- calibrate from real Director decisions **through a governed process**.

It may eventually model: strategic priorities · company vision · product preferences · quality thresholds · risk tolerance · capital allocation preferences · time allocation preferences · the reasons behind previous approvals and rejections · evidence thresholds · delegation preferences · escalation preferences · decisions that must remain Director-only.

## Authority firewall

The Twin **MUST NOT**:

- impersonate the Director as organizational truth;
- silently approve consequential actions;
- silently reject consequential actions;
- acquire Director authority;
- overwrite Governance;
- fabricate Director preferences;
- treat inferred preferences as confirmed preferences;
- turn model output into authoritative Director decisions;
- silently modify its own governing principles;
- make its predictions indistinguishable from actual Director decisions.

Every Twin-produced evaluation must remain **clearly derived**.

> **ACTUAL DIRECTOR DECISION ≠ DIRECTOR TWIN PREDICTION.**
>
> The two must be separately recorded and separately readable. A prediction that becomes accurate does not become a decision, and accuracy is never a route to authority.

### Three subsystems that must never collapse

| | Owns |
|---|---|
| **Heby** | conversation, explanation, interaction surface |
| **Director Digital Twin** | representation of the Director's decision patterns and strategic preferences |
| **Governance** | actual authority and decision legitimacy |

Guided Learning does not own the Twin. The Twin does not own Heby. Heby does not own Governance.

A fourth subsystem is now recorded beneath them: [26 — Personal Context Authority](26-personal-context-authority.md) owns **one human's personal context** — admission, identity-bound read authorization, revocation and lifecycle. It is not a twin and models no subject. This Twin derives from *organizational* history and must never write to it, nor read it as though the organization's record of a decision were the person's own statement about themselves. **The Twin does not own personal context. The Personal Context Authority does not evaluate.**

### The decision-centre ceiling

The firewall above says what the Twin must not do. Stated as a ceiling, so the permitted half is equally explicit:

| | |
|---|---|
| **READ** · **ADVISE** · **PROPOSE** | permitted |
| **AUTHORIZE** · impersonate the Director · become Governance · mint permits · **EXECUTE** | forbidden |

**Any Twin-originated proposal must enter the existing governed chain at its beginning** — filed as a proposal, decided by a human, permitted, and only then executed, with the kill switch checked before any transport is selected. The Twin's reach ends at `proposal`. **Accuracy is never a route to authority:** a prediction that becomes reliable is still a prediction, and being right more often is an argument for consulting it, never for obeying it.

### Active Elicitation — a designed future capability

The Twin may eventually notice that context is **missing, stale or uncertain** and ask the person a question. Recorded here rather than discovered later, because the dangerous version is the one nobody wrote down:

```
QUESTION  != ADMISSION
ANSWER    != AUTOMATIC KNOWLEDGE WRITE
INFERENCE != CONFIRMED PREFERENCE
```

An answer may become a person's **stated** context only through [26](26-personal-context-authority.md)'s explicit admission boundary — no shortcut for material that arrived in a conversation. **Heby and the Twin must not become independent personal-context writers**, and a declined question leaves the gap open and honestly reported rather than filled by inference.

## Future information flow

Conceptual architecture only — no contract, no interface, no schema is implied.

```
Organizational signals
  → Hebun subsystems
    → Knowledge / Operations / Workforce / Governance
      → Director Digital Twin
        → derived Director-perspective evaluation
          → Heby
            → Director
              → REAL Director decision
                → Governance / authoritative record
                  → future Twin calibration candidate
```

The Twin sits **before** the Director and **after** the organization. It never becomes the authoritative writer merely because its predictions become accurate — the arrow from the real decision back to calibration is one-way, and it passes through Governance.

## Example future use case

The Research Workforce discovers 30 product opportunities. Hebun performs evidence-based analysis. The Twin may evaluate:

> *"This opportunity resembles previous proposals rejected because of low margins and high operational burden. Distribution advantage is stronger here, therefore Director review is recommended rather than automatic rejection."*

Heby presents that to the Director. **The Director decides.** The actual decision is recorded separately from the Twin's prediction. That separation is the capability's whole integrity.

Note what the example does *not* do: it does not reject the opportunity, and it does not approve it. It routes attention and states its reasoning.

## Product principle

Hebun should eventually model both:

1. **THE ORGANIZATION** — how the company works, knows, decides and operates.
2. **THE DIRECTOR** — how the Director tends to evaluate strategy and make decisions.

These models must remain distinguishable:

- Organizational truth must not become Director preference.
- Director preference must not become organizational truth.
- Twin inference must not become Director authority.

## Deferment

**Intentionally deferred until the necessary Hebun foundations are mature.** The capability should be implemented only when the prerequisite architecture can support an **evidence-based** Twin rather than a **prompt-based imitation**. A Twin built early would be a persona wearing the Director's name, and that is the failure mode this record exists to prevent.

No target phase is assigned. **No phase number is invented here**: the repository's own promotion rules require a roadmap slot at promotion time, and scheduling this now merely to make a roadmap look complete would be the opposite of a deferral.

Expected prerequisite areas — stated as areas, not as dates:

- Knowledge
- Knowledge Retrieval
- Memory / Learning
- Governance
- decision provenance
- Organizational Intelligence
- Agent Workforce
- trustworthy historical Director decision evidence

That last one is the real gate. A decision model derived from a thin or unattributed decision record would be confident and wrong.

## Dependencies

- [09 — Director Memory](09-director-memory.md) — the historical record it reasons over
- [19 — Learning Engine](19-learning-engine.md) — adjacent; organizational patterns, not personal ones
- [26 — Personal Context Authority](26-personal-context-authority.md) — where a *stated* personal preference would live, and the only admission boundary an elicited answer may pass through. This Twin reads it and never writes it
- Governance — decision legitimacy, and the authority the Twin must never acquire
- Organizational Intelligence — the entities evaluations are keyed to
- Heby — the presentation surface a Twin evaluation reaches the Director through

## Promotion criteria

- Prerequisite areas above are mature, in particular a trustworthy, attributed record of historical Director decisions.
- Twin output defined as **clearly derived** and structurally distinguishable from an actual Director decision.
- Calibration defined as a **governed** process — never silent, never self-modifying.
- Authority firewall enforceable, not merely documented.
- Separation from [21 — Enterprise System Map](21-enterprise-system-map.md) and [09 — Director Memory](09-director-memory.md) explicit in the design.
- Director approval.
