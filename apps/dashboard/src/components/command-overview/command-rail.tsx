import {
  Bot,
  Building2,
  CheckCircle2,
  CircleDashed,
  Network,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { CommandRegion, OperatingStatement, QuietLink, ordinaryDate } from "@/components/command-overview/region";
import { cn } from "@/lib/utils";
import {
  CONNECTED_PROVIDERS_SHOWN,
  providerDisplayName,
  type ConnectedCapabilityState,
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
      weight="card"
      eyebrow={`${projection.edges.length} ${projection.edges.length === 1 ? "relationship" : "relationships"}`}
      className="cmd-support-card h-full p-4"
    >
      {nodes.length === 0 ? (
        <OperatingStatement
          tone={readState === "unavailable" ? "unavailable" : "empty"}
          compact
          title={readState === "unavailable" ? "Live Map unavailable" : "No map nodes recorded"}
          detail="No organization topology can be drawn from this reading."
        />
      ) : (
        <div className="cmd-map-canvas min-w-0 overflow-hidden rounded-xl border border-(--cmd-map-line) p-3 text-(--cmd-map-fg)">
          {organization ? (
            <div className="cmd-map-root mx-auto flex w-fit max-w-full items-center gap-2 rounded-lg border border-(--cmd-map-line-strong) bg-(--cmd-map-node) px-3 py-2">
              <Network className="size-4 shrink-0 text-(--cmd-map-accent)" aria-hidden="true" />
              <span className="min-w-0 truncate text-meta font-semibold">{organization.label}</span>
            </div>
          ) : null}
          {children.length > 0 ? (
            <div className={cn("relative mt-4 grid min-w-0 grid-cols-2 gap-2 before:absolute before:left-1/2 before:top-[-1rem] before:h-4 before:w-px before:bg-(--cmd-map-line-strong) sm:grid-cols-4", children.length === 1 && "mx-auto w-full max-w-40 grid-cols-1 sm:grid-cols-1") }>
              {children.map((node) => {
                const Icon = NODE_ICON[node.kind];
                const connected = organization ? projection.edges.some((edge) =>
                  (edge.fromNodeId === organization.nodeId && edge.toNodeId === node.nodeId) ||
                  (edge.toNodeId === organization.nodeId && edge.fromNodeId === node.nodeId),
                ) : false;
                return (
                  <div key={node.nodeId} className={cn("cmd-map-node relative min-w-0 rounded-lg border border-(--cmd-map-line) bg-(--cmd-map-node) px-2.5 py-2", connected && "before:absolute before:left-1/2 before:top-[-0.55rem] before:h-2 before:w-px before:bg-(--cmd-map-line-strong)") }>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Icon className="size-3.5 shrink-0 text-(--cmd-map-accent)" aria-hidden="true" />
                      <span className="min-w-0 truncate text-label font-medium">{node.label}</span>
                    </div>
                    <p className="mt-1 text-label capitalize leading-4 text-(--cmd-map-muted)">{node.kind}</p>
                  </div>
                );
              })}
            </div>
          ) : null}
          <p className="mt-2 text-label leading-4 text-(--cmd-map-muted)">{projection.freshness}</p>
        </div>
      )}
      <QuietLink href="/live-map">Open Live Map</QuietLink>
    </CommandRegion>
  );
}

export function ConnectedSystems({ state }: { readonly state: ConnectedCapabilityState }) {
  const shown = state.status === "recorded" ? state.connected.slice(0, CONNECTED_PROVIDERS_SHOWN) : [];
  const readState = state.status === "unavailable" ? "unavailable" : shown.length === 0 ? "empty" : "available";

  return (
    <CommandRegion
      id="connected-systems"
      title="Connected Systems"
      question="Which providers has this organization actually connected?"
      provenance="authoritative"
      provenanceDetail="The Integration Authority connection register, scoped to this tenant."
      readState={readState}
      provenanceBounds={`The first ${CONNECTED_PROVIDERS_SHOWN} connected rows are shown`}
      provenanceNonClaims="catalog availability, credential presence, or capability readiness"
      weight="card"
      className="cmd-support-card h-full p-4"
      eyebrow={state.status === "recorded" && state.connected.length > 0 ? `${state.connected.length} connected` : undefined}
    >
      {state.status === "unavailable" ? (
        <OperatingStatement tone="unavailable" compact title="Connections unavailable" detail="Hebun could not read your connection register." reason={state.reason} />
      ) : shown.length === 0 ? (
        <OperatingStatement tone="empty" compact title="Nothing connected yet" detail="Connect a system in Integrations to widen what Hebun can see." />
      ) : (
        <ul className="flex min-w-0 flex-col divide-y divide-border">
          {shown.map((row) => (
            <li key={row.integrationId} className="flex min-w-0 items-center justify-between gap-3 py-2.5 first:pt-0">
              <span className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0 truncate text-meta font-semibold text-fg">{providerDisplayName(row)}</span>
              </span>
              <span className={cn("shrink-0 text-label font-medium", row.health === "healthy" ? "text-success" : "text-fg-muted") }>
                {row.health === "healthy" ? "Connected" : row.health}
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
      <QuietLink href="/integrations">Open Integrations</QuietLink>
    </CommandRegion>
  );
}

export function RecordedActivity({ observation }: { readonly observation: SecurityRecordedActObservation }) {
  const shown = observation.acts.slice(0, 3);
  const readState = observation.state === "unavailable" ? "unavailable" : observation.state === "known-empty" ? "empty" : "available";
  return (
    <CommandRegion
      id="recorded-activity"
      title="Recorded Activity"
      question="Which governed acts are in the bounded activity reading?"
      provenance="derived"
      provenanceDetail={observation.provenance}
      readState={readState}
      provenanceBounds={`Latest ${shown.length} shown from the existing bounded read${observation.truncated ? "; more were recorded" : ""}`}
      provenanceNonClaims="security posture, incidents, threats, severity, or risk"
      weight="card"
      className="cmd-support-card p-4"
      eyebrow={observation.totalRecordedActs === null ? undefined : `${observation.totalRecordedActs} recorded`}
    >
      {observation.state === "unavailable" ? (
        <OperatingStatement tone="unavailable" compact title="Activity unavailable" detail="Hebun could not read the recorded-act ledger." reason={observation.unavailableReason ?? undefined} />
      ) : observation.state === "known-empty" ? (
        <OperatingStatement tone="empty" compact title="No governed acts recorded" detail="The ledger answered and returned no recorded act." />
      ) : (
        <ul className="flex min-w-0 flex-col divide-y divide-border">
          {shown.map((act, index) => (
            <li key={`${act.occurredAt}-${act.action}-${index}`} className="flex min-w-0 gap-2.5 py-2 first:pt-0">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block min-w-0 truncate text-label font-semibold text-fg">{act.action}</span>
                <span className="mt-0.5 block text-label leading-4 text-fg-muted">{act.entityType} · {act.result} · {ordinaryDate(act.occurredAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <QuietLink href="/director/governance/security">View activity</QuietLink>
    </CommandRegion>
  );
}
