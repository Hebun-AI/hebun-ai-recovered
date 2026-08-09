/*
 * command-attention/workspace-model.ts — the read model for the Command Inbox, the
 * unified Director attention surface (Hebun UI Phase 20B).
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   The Inbox answers one question: "What requires my attention?" It is the SURFACE;
 *   an alert is only one TYPE of attention that can appear on it. Alert ≠ incident,
 *   Alert ≠ decision, Alert ≠ finding.
 *
 *   No unified attention read model is connected in this repository: there is no
 *   persisted alert feed, no decision queue (the Phase 14 Decisions surface reports
 *   `decisionRecordingConnected: false`), no briefing instance (the Organizational
 *   Intelligence Runtime is contract-only, with no bound artifacts), no execution
 *   failure stream, and no request inbox. So the item list is ALWAYS empty and every
 *   attention source is honestly reported as not connected. This model fabricates no
 *   item, count, priority, actor, timestamp, or urgency, and calls no model. It surfaces
 *   only the structural attention-kind vocabulary plus honest connection state.
 */

/** A kind of attention that could surface on the Inbox. Structural vocabulary only. */
export type AttentionKind =
  | "alert"
  | "decision"
  | "briefing"
  | "failure"
  | "governance"
  | "intelligence"
  | "request";

export interface AttentionKindView {
  readonly kind: AttentionKind;
  readonly label: string;
  /** The workspace/authority that would originate this attention. */
  readonly origin: string;
  readonly describes: string;
  /** Honest: no attention source is wired to the Inbox in this phase. */
  readonly connected: false;
}

const ATTENTION_KINDS: readonly AttentionKindView[] = [
  { kind: "alert", label: "Alert", origin: "Operations / Platform / Security", describes: "A system-generated attention signal. Not an incident, not a decision.", connected: false },
  { kind: "decision", label: "Decision pressure", origin: "Decisions", describes: "That a human decision is waiting. The decision itself lives on the Decisions surface.", connected: false },
  { kind: "briefing", label: "Briefing available", origin: "Command · Briefings", describes: "That an executive briefing has been assembled for review.", connected: false },
  { kind: "failure", label: "Failure", origin: "Operations", describes: "An execution that failed and needs a human to look.", connected: false },
  { kind: "governance", label: "Governance attention", origin: "Governance", describes: "A policy, permission, or compliance concern raised for the Director.", connected: false },
  { kind: "intelligence", label: "Intelligence attention", origin: "Intelligence", describes: "An emerging candidate or assessment escalated for a human look.", connected: false },
  { kind: "request", label: "Request", origin: "Workforce / Operations", describes: "A request routed to the Director for a response.", connected: false },
];

export interface CommandInboxModel {
  /** The structural attention-kind vocabulary. Real terms; zero instances. */
  readonly kinds: readonly AttentionKindView[];
  /** Live attention items. Always empty — no unified attention source is connected. */
  readonly items: readonly never[];
  /** Whether any attention source is wired to the Inbox. Always false in this phase. */
  readonly sourcesConnected: false;
}

/** Build the Command Inbox model. Pure; fabricates nothing. */
export function getCommandInboxModel(): CommandInboxModel {
  return {
    kinds: ATTENTION_KINDS,
    items: [],
    sourcesConnected: false,
  };
}
