import { Info } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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
