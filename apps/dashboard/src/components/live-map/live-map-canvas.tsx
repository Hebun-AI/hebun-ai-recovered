import { Building2, Bot, CircleSlash, Layers, UsersRound } from "lucide-react";
import type {
  LiveMapDomain,
  LiveMapEdge,
  LiveMapIntelligenceCompleteness,
  LiveMapNode,
  LiveMapNodeIntelligence,
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
 *
 * ── THE DERIVED ATTACHMENT IS RENDERED APART FROM THE NODE (E2-3) ────────────
 *
 * An agent node's own lines come from the authority that owns the agent. Its outcome numbers are
 * composed from a different authority's records, so they are drawn in their own block, under their
 * own truth-class label, behind a disclosure a reader opens deliberately. Interleaving them with
 * the node's provenance lines would put two truth classes in one list where neither is marked.
 *
 * The disclosure is a `details` element and nothing else: it discloses, it does not act.
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
      {node.intelligence ? <NodeIntelligence intelligence={node.intelligence} /> : null}
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

/**
 * The derived observation attached to an authoritative node.
 *
 * ITS TRUTH CLASS IS PRINTED BESIDE THE NODE'S. The card already shows "authoritative · Durable
 * Agent Identity" for the node itself; this shows "derived · Agent Outcome Observation" for the
 * numbers. A reader never has to work out which of the two they are looking at.
 *
 * AN UNREAD OBSERVATION IS A SENTENCE, NOT AN ABSENCE, and never a row of zeros: a blank block
 * would read as an agent that has done nothing, which is the one thing an unread observation
 * cannot tell anybody.
 */
function NodeIntelligence({ intelligence }: { intelligence: LiveMapNodeIntelligence }) {
  if (intelligence.status === "unavailable") {
    return (
      <div className="mt-3 rounded-lg border border-border bg-surface-sunken p-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-fg-muted">
          {intelligence.truthClass} · {intelligence.sourceAuthority}
        </p>
        <p className="mt-1 text-xs leading-5 text-fg-secondary">{intelligence.detail}</p>
      </div>
    );
  }

  return (
    <details className="mt-3 rounded-lg border border-border bg-surface-sunken p-3">
      <summary className="cursor-pointer text-[0.62rem] font-semibold uppercase tracking-wider text-fg-muted">
        {intelligence.truthClass} · {intelligence.sourceAuthority}
      </summary>
      <p className="mt-2 text-xs leading-5 text-fg-secondary">{intelligence.basis}</p>
      {intelligence.groups.map((group) => (
        <div key={group.groupId} className="mt-3">
          <p className="text-xs font-semibold text-fg">{group.label}</p>
          <dl className="mt-1 space-y-1">
            {group.measures.map((measure) => (
              <div key={measure.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-fg-secondary">{measure.label}</dt>
                  <dd className="text-xs font-semibold tabular-nums text-fg">{measure.value}</dd>
                </div>
                {measure.note ? (
                  <p className="text-[0.68rem] leading-4 text-fg-muted">{measure.note}</p>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      ))}
      <ul className="mt-3 space-y-1">
        {intelligence.nonClaims.map((claim) => (
          <li key={claim} className="text-[0.68rem] leading-4 text-fg-muted">
            {claim}
          </li>
        ))}
      </ul>
    </details>
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

/**
 * How much of the derived evidence the join could place.
 *
 * Rendered even when the answer is "all of it". A completeness line that only appears when
 * something is wrong teaches a reader that its absence means nothing was checked.
 */
function CompletenessNote({ completeness }: { completeness: LiveMapIntelligenceCompleteness }) {
  return (
    <p className="text-xs leading-5 text-fg-secondary">
      <span className="font-medium text-fg">
        Unplaced agent proposals: {completeness.unresolvedAgentProposals}.
      </span>{" "}
      {completeness.detail}
    </p>
  );
}

export function LiveMapCanvas({ projection }: { projection: LiveMapProjection }) {
  return (
    <div className="space-y-6">
      {projection.domains.map((domain) => (
        <DomainSection key={domain.domainId} domain={domain} />
      ))}
      <EdgeList edges={projection.edges} projection={projection} />
      {projection.intelligenceCompleteness ? (
        <CompletenessNote completeness={projection.intelligenceCompleteness} />
      ) : null}
      <p className="text-xs leading-5 text-fg-secondary">{projection.freshness}</p>
    </div>
  );
}
