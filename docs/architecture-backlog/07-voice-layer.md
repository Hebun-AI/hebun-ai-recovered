# 07 — Voice Layer

**Priority:** Medium
**Status:** Planned

## Purpose

A voice interface to the platform.

## Core rule

Voice is only a presentation layer. The Director remains unchanged.

Speech in, speech out. Everything between is the existing Director, untouched. Voice adds a channel; it does not add reasoning.

## Future channels

- Web
- Mobile
- Phone
- Teams
- Slack
- WhatsApp

## Architectural notes

The Voice Layer sits at the very edge — transcription and synthesis wrapping the same requests any other channel makes. If voice logic ever needs to know about Director internals, the boundary has been drawn wrong.

Channels are pluggable. Adding WhatsApp or Teams is adding an adapter at the presentation edge, not changing the core. Each channel normalizes to the same neutral request the Director already handles.

One direction: channels depend on the Director interface; the Director knows nothing about which channel it is serving.

## Dependencies

- Director command interface — the stable target it wraps
- [02 — AI Provider Manager](02-ai-provider-manager.md) — where speech models live
- Per-channel adapters (Web, Mobile, Phone, Teams, Slack, WhatsApp)

## Promotion criteria

- Director interface stable enough to treat as a fixed contract.
- Presentation-only boundary proven — no Director change required to add voice.
- Channel adapter pattern defined.
- Director approval.
