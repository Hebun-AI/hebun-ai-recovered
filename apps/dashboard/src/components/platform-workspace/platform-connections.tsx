import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PlatformRegion, PlatformEmptyState, TechnicalMarker } from "./platform-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Connections & Integrations (Phase 13 §23) — the primary Platform surface.
 *
 * When a real connection record exists, each would carry its identity, connection
 * state, capability, organization scope, and health — never a credential. No
 * Director-safe connection read model is connected (the integrations feature is a
 * mock and is excluded), so the region is honestly empty. No fake connected Slack /
 * Gmail / Drive / provider is surfaced, and no API key or secret is ever rendered.
 */

export function PlatformConnections() {
  return (
    <PlatformRegion
      eyebrow="What is connected"
      title="Connections & Integrations"
      accent
      className="h-full"
      action={<TechnicalMarker label="None connected" />}
    >
      <div className="flex flex-col gap-3">
        <PlatformEmptyState
          title="No platform integrations connected"
          detail="An integration is a governed technical connection to an external system, carrying its capability and health — never its credentials. No connection read model is connected, and none is fabricated. Once connected, each integration appears here with its state, capability, and health."
        />
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          Secrets, API keys, and connection strings are never shown here. A connection exposes its capability
          and health only.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/integrations"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Integrations surface
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="text-[0.7rem] text-fg-muted">Why is nothing connected?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </PlatformRegion>
  );
}
