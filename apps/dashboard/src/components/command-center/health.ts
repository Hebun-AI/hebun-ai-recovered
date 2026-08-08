import type { ExecutiveHealthState } from "@/features/director-dashboard-executive-overview";

/*
 * Command Center health presentation map.
 *
 * Translates the canonical, non-authoritative executive health states into a
 * color-INDEPENDENT visual grammar: every state carries a label + a dot tone,
 * and unavailable additionally carries a lock affordance. Colour is never the
 * only channel (design foundation §12 / §18).
 *
 * These states describe SYSTEM / OPERATIONAL health only — never business
 * health. `empty` widget output maps to `unknown` upstream, so "no evidence"
 * never reads as "healthy".
 */

export interface HealthPresentation {
  readonly label: string;
  readonly dot: string;
  readonly text: string;
  readonly locked: boolean;
}

const HEALTH_PRESENTATION: Readonly<Record<ExecutiveHealthState, HealthPresentation>> = {
  healthy: { label: "Healthy", dot: "bg-success", text: "text-success", locked: false },
  warning: { label: "Warning", dot: "bg-warning", text: "text-warning", locked: false },
  critical: { label: "Critical", dot: "bg-error", text: "text-error", locked: false },
  unavailable: { label: "Unavailable", dot: "bg-fg-muted", text: "text-fg-muted", locked: true },
  unknown: { label: "Unknown", dot: "bg-fg-muted", text: "text-fg-muted", locked: false },
};

export function healthPresentation(state: ExecutiveHealthState): HealthPresentation {
  return HEALTH_PRESENTATION[state];
}

/** Attention priority tier derived from a health state (spec §4). */
export function attentionTier(state: ExecutiveHealthState): "P0" | "P2" | null {
  if (state === "critical" || state === "unavailable") return "P0";
  if (state === "warning") return "P2";
  return null; // healthy / unknown are not Director attention
}
