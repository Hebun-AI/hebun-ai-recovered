import {
  Bot,
  Building2,
  Cable,
  Camera,
  CircleDashed,
  Info,
  Network,
  Play,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { CardHeading, COMMAND_CARD, HIDE_REGION_HEADING } from "@/components/command-overview/command-surface";
import { CommandRegion, OperatingStatement, QuietLink } from "@/components/command-overview/region";
import { cn } from "@/lib/utils";
import {
  CONNECTED_PROVIDERS_SHOWN,
  providerDisplayName,
  type ConnectedCapabilityState,
  type ConnectedProviderView,
  type WaitingOnYouState,
  type WorkInMotionState,
} from "@/features/command-overview/workspace-model";
import type { LiveMapNode, LiveMapProjection } from "@/features/live-map/contracts";
import type { SecurityRecordedActObservation } from "@/features/security-center/contracts";

const NODE_ICON = {
  organization: Building2,
  agent: Bot,
  department: UsersRound,
  human: UserRound,
} as const;

function readStateOfProjection(projection: LiveMapProjection) {
  if (projection.domains.some((domain) => domain.state.status === "available")) return "available" as const;
  if (projection.domains.some((domain) => domain.state.status === "unavailable")) return "unavailable" as const;
  return "empty" as const;
}

function nodeRows(projection: LiveMapProjection): readonly LiveMapNode[] {
  const nodes = projection.domains.flatMap((domain) => domain.state.status === "available" ? domain.state.nodes : []);
  const organization = nodes.find((node) => node.kind === "organization");
  if (!organization) return nodes.slice(0, 5);
  const related = nodes.filter((node) => node.nodeId !== organization.nodeId && projection.edges.some((edge) =>
    (edge.fromNodeId === organization.nodeId && edge.toNodeId === node.nodeId) ||
    (edge.toNodeId === organization.nodeId && edge.fromNodeId === node.nodeId),
  ));
  return [organization, ...related.slice(0, 4)];
}

/** Compact topology using only admitted nodes and admitted edges from the released projection. */
export function CommandLiveMap({ projection }: { readonly projection: LiveMapProjection }) {
  const nodes = nodeRows(projection);
  const readState = readStateOfProjection(projection);
  const organization = nodes.find((node) => node.kind === "organization");
  const children = nodes.filter((node) => node.nodeId !== organization?.nodeId);

  return (
    <CommandRegion
      id="live-map"
      title="Live Map"
      question="Which organization nodes and relationships can Hebun prove right now?"
      provenance="authoritative"
      provenanceDetail="Nodes and relationships admitted by the released Live Map projection."
      readState={readState}
      provenanceBounds={`${nodes.length} shown from the bounded projection`}
      provenanceNonClaims="geography, reporting lines, inferred teams, or unrecorded relationships"
      weight="bare"
      className={cn(COMMAND_CARD, HIDE_REGION_HEADING, "cmd-live-map-card h-full [&_[data-provenance]_button]:text-(--cmd-map-muted)")}
    >
      <CardHeading
        icon={Network}
        tone="map"
        inverse
        title="Live Map"
        subtitle="your organization, as recorded"
        aside={<span className="text-label text-(--cmd-map-muted)">{projection.edges.length} {projection.edges.length === 1 ? "relationship" : "relationships"}</span>}
      />
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-(--cmd-map-line) p-3 text-meta text-(--cmd-map-fg)">
          <p className="font-semibold">{readState === "unavailable" ? "Live Map unavailable" : "No map nodes recorded"}</p>
          <p className="mt-1 text-label text-(--cmd-map-muted)">
            {readState === "unavailable" ? "Hebun could not read the organization projection; that is not an empty organization." : "The projection answered and admitted no node."}
          </p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-center py-1">
          {organization ? (
            <div className="cmd-map-root flex max-w-full items-center gap-2.5 rounded-xl border border-(--cmd-map-line-strong) bg-(--cmd-map-node) px-4 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary" aria-hidden="true"><Building2 className="size-3.5" /></span>
              <span className="min-w-0 truncate text-meta font-semibold text-white">{organization.label}</span>
            </div>
          ) : null}
          {children.length > 0 ? (
            <>
              {organization ? <span className="h-4 w-px bg-(--cmd-map-line-strong)" aria-hidden="true" /> : null}
              <div className="flex min-w-0 flex-wrap justify-center gap-2">
                {children.map((node) => {
                  const Icon = NODE_ICON[node.kind];
                  return (
                    <div key={node.nodeId} className="flex min-w-0 items-center gap-2 rounded-xl border border-(--cmd-map-line) bg-(--cmd-map-node) px-3 py-2">
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-on-primary", node.kind === "agent" ? "bg-highlight" : "bg-white/15")} aria-hidden="true"><Icon className="size-3.5" /></span>
                      <span className="min-w-0 truncate text-meta font-semibold text-white">{node.label}</span>
                      <span className="text-label capitalize text-(--cmd-map-muted)">{node.kind}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      )}
      <div className="mt-auto flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-label text-(--cmd-map-muted)">A server read at page load</span>
        <QuietLink href="/live-map">Open Live Map</QuietLink>
      </div>
    </CommandRegion>
  );
}

/*
 * A PROVIDER'S MARK IS PRESENTATION, KEYED ON THE ROW'S OWN providerKey.
 * It is never looked up in a catalog and never implies what the connection can do.
 */
const PROVIDER_MARK: Record<string, { readonly icon: typeof Play; readonly className: string }> = {
  youtube: { icon: Play, className: "bg-[#ff0033] text-white" },
  instagram: { icon: Camera, className: "bg-[linear-gradient(45deg,#f58529,#dd2a7b,#8134af)] text-white" },
};

function ProviderMark({ row }: { readonly row: ConnectedProviderView }) {
  const mark = row.providerKey ? PROVIDER_MARK[row.providerKey.toLowerCase()] : undefined;
  const Icon = mark?.icon ?? Cable;
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[0.625rem]", mark?.className ?? "bg-surface-sunken text-fg-secondary")} aria-hidden="true">
      <Icon className="size-4" fill={mark ? "currentColor" : "none"} strokeWidth={mark ? 1.4 : 1.8} />
    </span>
  );
}

export function ConnectedSystems({ state }: { readonly state: ConnectedCapabilityState }) {
  const shown = state.status === "recorded" ? state.connected.slice(0, CONNECTED_PROVIDERS_SHOWN) : [];
  const readState = state.status === "unavailable" ? "unavailable" : shown.length === 0 ? "empty" : "available";

  return (
    <CommandRegion
      id="connected-systems"
      title="Connected systems"
      question="Which providers has this organization actually connected?"
      provenance="authoritative"
      provenanceDetail="The Integration Authority connection register, scoped to this tenant."
      readState={readState}
      provenanceBounds={`The first ${CONNECTED_PROVIDERS_SHOWN} connected rows are shown`}
      provenanceNonClaims="catalog availability, credential presence, or capability readiness"
      weight="bare"
      className={cn(COMMAND_CARD, HIDE_REGION_HEADING, "h-full")}
    >
      <CardHeading
        icon={Cable}
        tone="attention"
        title="Connected systems"
        subtitle={state.status === "recorded" ? `${state.connected.length}${state.truncated ? "+" : ""} connected` : state.status === "none-recorded" ? "none connected" : "register unavailable"}
      />
      {state.status === "unavailable" ? (
        <OperatingStatement tone="unavailable" compact title="Connections unavailable" detail="Hebun could not read your connection register." reason={state.reason} />
      ) : shown.length === 0 ? (
        <OperatingStatement tone="empty" compact title="Nothing connected yet" detail="Connect a system in Integrations to widen what Hebun can see." />
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {shown.map((row) => (
            <li key={row.integrationId} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2">
              <ProviderMark row={row} />
              <span className="min-w-0 flex-1 truncate text-meta font-semibold text-fg">{providerDisplayName(row)}</span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-label font-semibold", row.health === "healthy" ? "bg-success-subtle text-success" : "bg-surface-sunken text-fg-secondary") }>
                {row.health === "healthy" ? "Connected" : `Connected · ${row.health}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {state.status === "recorded" && state.notConnected.length > 0 ? (
        <p className="flex min-w-0 items-center gap-1.5 text-label text-fg-muted">
          <CircleDashed className="size-3 shrink-0" aria-hidden="true" />
          {state.notConnected.map((row) => `${row.count} ${row.state}`).join(" · ")}
        </p>
      ) : null}
      <div className="mt-auto flex min-w-0 items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-label text-fg-muted">
          <Info className="size-3.5 shrink-0" aria-hidden="true" /> Connection is not capability
        </span>
        <QuietLink href="/integrations">Integrations</QuietLink>
      </div>
    </CommandRegion>
  );
}

function TrustLine({ label, tone, items }: { readonly label: string; readonly tone: "read" | "derived"; readonly items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="flex min-w-0 items-center gap-2 text-label text-fg-muted">
      <span className={cn("size-1.5 shrink-0 rounded-full", tone === "read" ? "bg-success" : "bg-primary")} aria-hidden="true" />
      <span className="min-w-0 truncate"><span className="font-semibold text-fg-secondary">{label}</span> · {items.join(", ")}</span>
    </p>
  );
}

/** GOVERNED ACTIVITY — the recorded-act ledger's count, DERIVED and labelled so. */
export function RecordedActivity({
  observation,
}: {
  readonly observation: SecurityRecordedActObservation;
}) {
  const readState = observation.state === "unavailable" ? "unavailable" : observation.state === "known-empty" ? "empty" : "available";
  return (
    <CommandRegion
      id="recorded-activity"
      title="Governed activity"
      question="How many governed acts has this organization recorded?"
      provenance="derived"
      provenanceDetail={observation.provenance}
      readState={readState}
      provenanceBounds={observation.truncated ? "The bounded read filled; more acts were recorded" : undefined}
      provenanceNonClaims="security posture, incidents, execution success, provider delivery, or outcomes"
      weight="bare"
      className={HIDE_REGION_HEADING}
    >
      <CardHeading icon={ShieldCheck} tone="primary" title="Governed activity" subtitle="your organization's record" aside={<QuietLink href="/director/governance/security">Security</QuietLink>} />
      {observation.state === "unavailable" ? (
        <OperatingStatement tone="unavailable" compact title="Activity unavailable" detail="Hebun could not read the recorded-act ledger." reason={observation.unavailableReason ?? undefined} />
      ) : observation.state === "known-empty" ? (
        <OperatingStatement tone="empty" compact title="No governed acts recorded" detail="The ledger answered and returned no recorded act." />
      ) : (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-display-lg font-bold leading-none tracking-tight tabular-nums text-fg">
            {observation.totalRecordedActs ?? `${observation.acts.length}+`}
          </span>
          <span className="text-meta text-fg-secondary">{observation.totalRecordedActs === null ? "acts in the bounded read" : "governed acts recorded"}</span>
          <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-label font-semibold text-primary">Derived</span>
        </p>
      )}
    </CommandRegion>
  );
}

/**
 * THE TRUTH BASIS — what this page was read from, computed from the states the route already holds.
 * A source that failed is never listed as read and never becomes zero; its own card says so.
 */
export function TruthBasis({
  observation,
  work,
  capability,
  waiting,
  liveMap,
}: {
  readonly observation: SecurityRecordedActObservation;
  readonly work: WorkInMotionState;
  readonly capability: ConnectedCapabilityState;
  readonly waiting: WaitingOnYouState;
  readonly liveMap: LiveMapProjection;
}) {
  /* A source that did not answer is simply not listed as read; its own card says "Unavailable". */
  const read = [
    waiting.status === "unavailable" ? null : "decisions",
    work.status === "unavailable" ? null : "work",
    readStateOfProjection(liveMap) === "unavailable" ? null : "organization",
    capability.status === "unavailable" ? null : "connections",
  ].filter((name): name is string => name !== null);
  return (
    <div data-truth-basis="" className="flex min-w-0 flex-col gap-1 border-t border-primary/10 pt-2.5">
      <TrustLine label="Read" tone="read" items={read} />
      <TrustLine label="Derived" tone="derived" items={observation.state === "unavailable" ? [] : ["governed activity"]} />
    </div>
  );
}
