import { Building2, Bot, CircleSlash, Layers, UsersRound } from "lucide-react";
import type {
  LiveMapDomain,
  LiveMapEdge,
  LiveMapNode,
  LiveMapProjection,
} from "@/features/live-map/contracts";

/*
 * L4 — the Live Map surface.
 *
 * It renders a projection and nothing else. It performs no read, holds no database handle, and
 * offers no control that could change anything it draws: the only affordance on a node is a link to
 * the subsystem that OWNS it, because a map that edits an organization has become a second place
 * the organization is decided.
 *
 * THE FOUR DOMAIN STATES ARE RENDERED DIFFERENTLY ON PURPOSE. "Nothing here", "the authority said
 * zero", "the authority could not answer" and "nobody owns this yet" are four different sentences,
 * and collapsing them into an empty area is how a map claims an organization has no departments.
 */

const DOMAIN_ICON: Record<string, typeof Building2> = {
  organization: Building2,
  agents: Bot,
  structure: Layers,
  people: UsersRound,
};

function NodeCard({ node }: { node: LiveMapNode }) {
  const Icon = node.kind === "organization" ? Building2 : Bot;
  return (
    <article className="min-w-[14rem] flex-1 basis-[16rem] rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{node.label}</p>
          {/*
           * The truth classification is shown, not implied. Core can only construct
           * `authoritative` nodes, so this label is never a reassurance a reader has to trust.
           */}
          <p className="mt-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-fg-muted">
            {node.truth} · {node.sourceAuthority}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {node.detail.map((line) => (
          <li key={line} className="text-xs leading-5 text-fg-secondary">
            {line}
          </li>
        ))}
      </ul>
      {node.openRoute ? (
        <a
          href={node.openRoute}
          className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Open {node.kind === "organization" ? "Organization" : "Agents"}
        </a>
      ) : null}
    </article>
  );
}

function StateNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-border bg-surface p-4 text-sm leading-6 text-fg-secondary">
      <CircleSlash className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function DomainSection({ domain }: { domain: LiveMapDomain }) {
  const Icon = DOMAIN_ICON[domain.domainId] ?? Layers;
  return (
    <section aria-labelledby={`live-map-${domain.domainId}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-fg-muted" aria-hidden="true" />
        <h2 id={`live-map-${domain.domainId}`} className="text-sm font-semibold text-fg">
          {domain.label}
        </h2>
      </div>

      {domain.state.status === "available" ? (
        <div className="flex flex-wrap gap-3">
          {domain.state.nodes.map((node) => (
            <NodeCard key={node.nodeId} node={node} />
          ))}
        </div>
      ) : (
        <StateNotice>{domain.state.detail}</StateNotice>
      )}
    </section>
  );
}

/**
 * The edges, written out as sentences rather than drawn as lines.
 *
 * A line between two boxes says "related" and leaves the reader to guess how. Core proves exactly
 * one relationship and can state precisely what proves it, so it says so — and a reader who
 * disagrees can check the column named.
 */
function EdgeList({ edges, projection }: { edges: readonly LiveMapEdge[]; projection: LiveMapProjection }) {
  if (edges.length === 0) return null;
  const labelOf = (nodeId: string): string => {
    for (const domain of projection.domains) {
      if (domain.state.status !== "available") continue;
      const found = domain.state.nodes.find((n) => n.nodeId === nodeId);
      if (found) return found.label;
    }
    return nodeId;
  };

  return (
    <section aria-labelledby="live-map-relationships">
      <h2 id="live-map-relationships" className="mb-2 text-sm font-semibold text-fg">
        Proven relationships
      </h2>
      <ul className="space-y-2">
        {edges.map((edge) => (
          <li
            key={`${edge.fromNodeId}->${edge.toNodeId}`}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <p className="text-sm text-fg">
              <span className="font-medium">{labelOf(edge.fromNodeId)}</span>{" "}
              <span className="text-fg-muted">{edge.relation}</span>{" "}
              <span className="font-medium">{labelOf(edge.toNodeId)}</span>
            </p>
            <p className="mt-1 text-xs leading-5 text-fg-secondary">{edge.basis}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LiveMapCanvas({ projection }: { projection: LiveMapProjection }) {
  return (
    <div className="space-y-6">
      {projection.domains.map((domain) => (
        <DomainSection key={domain.domainId} domain={domain} />
      ))}
      <EdgeList edges={projection.edges} projection={projection} />
      <p className="text-xs leading-5 text-fg-secondary">{projection.freshness}</p>
    </div>
  );
}
