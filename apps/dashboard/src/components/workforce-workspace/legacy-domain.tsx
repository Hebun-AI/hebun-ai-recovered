import { Info, Bot } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Agent } from "@/types";

/*
 * Legacy domain honesty primitives (UI Phase 25C).
 *
 * Finance / HR / Legal / Customer Ops are NOT authoritative Workforce domains — they are legacy
 * domain applications / future Enterprise Domain candidates. Phase 25C does not redesign them; it
 * makes their status unmistakable with a slim, product-quality notice and replaces the pulsing,
 * fake-activity AgentCard on those surfaces with an honest, local definition card. Route
 * disposition (redirect / relocation / retirement) is owned by Phase 25D.
 */

export function LegacyDomainNotice({
  domain,
  backing = "mock",
}: {
  domain: string;
  /** How this surface is backed — shapes the one-word provenance chip. */
  backing?: "mock" | "seeded";
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-subtle px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
          {domain} is a legacy domain surface
          <Badge variant="warning">{backing}</Badge>
          <Badge variant="neutral">not authoritative</Badge>
        </p>
        <p className="text-xs leading-5 text-fg-muted">
          Not part of the authoritative Workforce IA (Overview · Agents · Teams &amp; Roles ·
          Capabilities), and not connected to any live enterprise system. Values shown are
          illustrative {backing} data. Human decisions belong to{" "}
          <Link href="/approvals" className="font-medium text-primary hover:text-primary-hover">
            Decisions
          </Link>
          . Final disposition is pending.
        </p>
      </div>
    </div>
  );
}

/*
 * Honest, local replacement for the pulsing AgentCard on legacy domain pages. It shows the seeded
 * DEFINITION (identity, role, department, version) with an explicit provenance chip — no pulsing
 * status, no tasksToday / costToday / lastActive, no implied live activity. The shared AgentCard is
 * left untouched for its other (non-authoritative) consumers.
 */
export function LegacyAgentDefinitionCard({ agent }: { agent: Agent }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-surface-sunken text-fg-secondary">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-fg">{agent.name}</h3>
              <p className="truncate text-xs text-fg-secondary">{agent.role}</p>
            </div>
          </div>
          <Badge variant="neutral">seeded definition</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Badge variant="neutral">{agent.department}</Badge>
          <Badge variant="neutral">{agent.version}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
