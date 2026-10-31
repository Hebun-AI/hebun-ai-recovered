import Link from "next/link";
import { Building2, Bot, ChevronRight, CircleSlash, Layers, UsersRound } from "lucide-react";
import type {
  LiveMapDomain,
  LiveMapEdge,
  LiveMapIntelligenceCompleteness,
  LiveMapNode,
  LiveMapNodeIntelligence,
  LiveMapProjection,
} from "@/features/live-map/contracts";
import { AgentOfficeScene, AgentOfficeSprite } from "./agent-office-scene";
import { headlineCounts } from "./agent-record";

/*
 * LIVE MAP — THE VISUAL ORGANIZATIONAL MAP (LMX-1).
 *
 * ── WHAT CHANGED, AND WHY IT IS NOT DECORATION ───────────────────────────────
 *
 * Core v1 rendered four stacked regions of cards. Every sentence in it was true and none of it was
 * a map: a Director read an inventory and assembled the shape of their own organization in their
 * head. This renders the shape — organization at the centre, the agents that belong to it hanging
 * from a drawn spine, and the one proven relationship expressed as GEOMETRY rather than as a
 * sentence in a list at the bottom of the page.
 *
 * NOTHING NEW IS DRAWN. The nodes, the single edge, the four domain states and every word still
 * come from the released projection. A map is a stronger claim than a list — a picture is believed
 * faster than a paragraph — so the rule this file lives under is that the drawing may only express
 * relationships the projection already proved, and must express absence just as visibly.
 *
 *     TRUTH BEFORE GRAPH COMPLETENESS        NO NODE FOR VISUAL COMPLETENESS
 *
 * ── NAVIGATION WITHOUT A CONTROL ─────────────────────────────────────────────
 *
 * Choosing an agent opens its office, at its own address (PHASE 4B). That is a link, so keyboard
 * operation, focus, the browser's history and screen-reader semantics come from the platform rather
 * than being reimplemented, and what the inspector printed now lives on that page.
 *
 * It is also the only interaction this surface CAN have. Live Map holds no authority over anything
 * it draws, and a link cannot create, move, rename, retire, approve or execute. The released firewall
 * forbids `onClick`, `useState`, `<button>` and `<form>` in this directory, and that ban is unweakened
 * here.
 *
 *     VISUAL INTERACTION != WRITE AUTHORITY
 *
 * ── THE FOUR DOMAIN STATES STILL RENDER DIFFERENTLY ──────────────────────────
 *
 * "Nothing here", "the authority said zero", "the authority could not answer" and "nobody owns this
 * yet" are four different sentences. On a map the temptation to render all four as empty canvas is
 * stronger, not weaker, so each keeps its own visible statement.
 *
 * ── AND THE ATTACHMENT KEEPS ITS OWN TRUTH CLASS ─────────────────────────────
 *
 * A node's identity is authoritative; the numbers beside it are derived. Both classes are printed,
 * in different places, in the reader's own language — never merged into one confident block.
 *
 *     AUTHORITATIVE IDENTITY != DERIVED INTELLIGENCE        COUNT != SCORE
 */

const DOMAIN_ICON: Record<string, typeof Building2> = {
  organization: Building2,
  agents: Bot,
  structure: Layers,
  people: UsersRound,
};

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CENTRE
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The organization node — the centre of the map, and the only node that is one.
 *
 * The NAME leads. The record behind it — identifier, lifecycle, tenant status, member count and the
 * provenance sentence — sits in a disclosure, because a map whose centre is a paragraph of
 * technical provenance is a document with a border round it. The facts are not hidden: they are one
 * keystroke away, in the same document, behind no fetch.
 */
function OrganizationNode({ node }: { node: LiveMapNode }) {
  return (
    <article className="lm-org-node" aria-label={`Organization: ${node.label}`}>
      <span className="lm-org-mark" aria-hidden="true">
        <Building2 className="size-5" />
      </span>
      <h3 className="lm-org-name">{node.label}</h3>
      <p className="lm-truth">
        <span className="lm-truth-class">{node.truth}</span>
        <span aria-hidden="true"> · </span>
        <span>{node.sourceAuthority}</span>
      </p>
      <details className="lm-disclosure">
        <summary className="lm-disclosure-summary">Organization record</summary>
        <ul className="lm-record">
          {node.detail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {node.openRoute ? (
          <a className="lm-open" href={node.openRoute}>
            Open Organization
          </a>
        ) : null}
      </details>
    </article>
  );
}

/** Number first in the document, so it reads "11 filed"; the stylesheet alone lifts the label above it. */
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <span className="lm-metric">
      <span className="lm-metric-value">{value}</span> <span className="lm-metric-label">{label}</span>
    </span>
  );
}

/**
 * The glance line on an agent card.
 *
 * THREE COUNTS, NEVER A SUMMARY OF THEM. Filed, approved and approved-but-never-executed are three
 * different authorities' facts; a single figure combining them would be the score this milestone is
 * forbidden to invent. When the observation could not be read the line says so instead of showing
 * zeros.
 */
function GlanceSignal({ intelligence }: { intelligence?: LiveMapNodeIntelligence }) {
  if (!intelligence) return null;
  if (intelligence.status === "unavailable") {
    return <span className="lm-glance lm-glance-unread">Outcome observation unread</span>;
  }
  const counts = headlineCounts(intelligence);
  if (!counts) return null;
  return (
    <span className="lm-glance">
      <Metric value={counts.filed} label="filed" />{" "}
      <Metric value={counts.approved} label="approved" />{" "}
      <Metric value={counts.neverExecuted} label="never executed" />
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE AGENTS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * One agent on the map: a single link to its office.
 *
 * THE LINK IS THE WHOLE CARD, and nothing inside it is interactive. It has no `aria-label`, so its
 * text is its name, and the lifecycle, the authority, all three counts and an unread observation
 * reach a screen reader in the order they are read on screen. It holds spans only. The `{" "}` between
 * them keep the words apart in that name, because these spans are flex items and no whitespace of
 * theirs is ever drawn.
 *
 * NOTHING PREFETCHES. An office costs a full authority read, and a map of N agents must not spend N
 * of them on a page somebody is only looking at.
 *
 * THE OFFICE IS DECORATION. It sees the node's id and lifecycle tone and nothing else, so it cannot
 * say what an agent did. The words come first: a name of any length is printed whole, in the area the
 * office leaves free, and the card grows rather than cut it.
 */
function AgentNode({ node }: { node: LiveMapNode }) {
  return (
    <article className="lm-agent">
      <Link className="lm-node" href={node.officeRoute ?? "/agents"} prefetch={false}>
        <span className="lm-field">
          <AgentOfficeScene nodeId={node.nodeId} tone={node.status?.tone} />
          <span className="lm-node-mark" aria-hidden="true">
            <Bot className="size-4" />
          </span>
          <span className="lm-node-body">
            <span className="lm-node-name">{node.label}</span>{" "}
            {node.status ? (
              <span className="lm-status" data-tone={node.status.tone}>
                {node.status.label}
              </span>
            ) : null}{" "}
            <span className="lm-node-source">{node.sourceAuthority}</span>
          </span>
        </span>{" "}
        <span className="lm-foot">
          <GlanceSignal intelligence={node.intelligence} />
          <ChevronRight className="lm-node-chevron size-4" aria-hidden="true" />
        </span>
      </Link>
    </article>
  );
}

function StateNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="lm-notice">
      <CircleSlash className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE MAP
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The drawn relationship, and the sentence that proves it.
 *
 * The spine is CSS; the BASIS is text, because a line between two boxes says "related" and leaves
 * the reader to guess how. The edge's own words are printed under the map so a reader who doubts
 * the geometry can check the column it restates.
 */
function Relationship({ edges }: { edges: readonly LiveMapEdge[] }) {
  if (edges.length === 0) return null;
  /*
   * ONE LINE PER RELATION KIND, not per edge and no longer just the first.
   *
   * The map proved exactly one relationship until LM-1 added `works-in`, and printing only
   * `edges[0]` then would have shown a reader the basis for a relationship while silently omitting
   * the basis for another they can see drawn. Each kind states its own column once; the count says
   * how many edges rest on it.
   */
  const byRelation = new Map<string, { basis: string; count: number }>();
  for (const edge of edges) {
    const seen = byRelation.get(edge.relation);
    if (seen) seen.count += 1;
    else byRelation.set(edge.relation, { basis: edge.basis, count: 1 });
  }
  return (
    <>
      {[...byRelation.entries()].map(([relation, { basis, count }]) => (
        <p className="lm-basis" key={relation}>
          <span className="lm-basis-relation">{relation}</span>
          {count > 1 ? ` (${count}) ` : " "}
          {basis}
        </p>
      ))}
    </>
  );
}

function CompletenessNote({ completeness }: { completeness: LiveMapIntelligenceCompleteness }) {
  return (
    <p className="lm-completeness">
      <strong>Unplaced agent proposals: {completeness.unresolvedAgentProposals}.</strong>{" "}
      {completeness.detail}
    </p>
  );
}

/** A domain Hebun does not own, or could not read — stated, never left as empty canvas. */
/**
 * A domain that HAS nodes and is not the organization or the agents (LM-1).
 *
 * Departments and people are drawn here rather than on the spine, deliberately: the spine carries
 * the one relationship this map has always proved (`agent belongs-to organization`), and hanging a
 * second geometry off it would assert a shape nobody owns. These are listed, each node carrying its
 * own authority and its own basis, and the `works-in` relationship is stated as text under the map
 * exactly as `belongs-to` is.
 */
function PresentDomain({ domain }: { domain: LiveMapDomain }) {
  const Icon = DOMAIN_ICON[domain.domainId] ?? Layers;
  if (domain.state.status !== "available") return null;
  const nodes = domain.state.nodes;
  return (
    <section className="lm-absent" aria-labelledby={`live-map-${domain.domainId}`}>
      <h3 id={`live-map-${domain.domainId}`} className="lm-absent-title">
        <Icon className="size-4 text-fg-muted" aria-hidden="true" />
        {domain.label}
        <span className="lm-group-count">
          {nodes.length} {nodes.length === 1 ? "record" : "records"}
        </span>
      </h3>
      <ul className="lm-record">
        {nodes.map((node) => (
          <li key={node.nodeId}>
            <strong>{node.label}</strong>
            {node.status ? (
              <>
                {" "}
                <span className="lm-status" data-tone={node.status.tone}>
                  {node.status.label}
                </span>
              </>
            ) : null}
            <ul className="lm-record">
              {node.detail.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AbsentDomain({ domain }: { domain: LiveMapDomain }) {
  const Icon = DOMAIN_ICON[domain.domainId] ?? Layers;
  if (domain.state.status === "available") return null;
  return (
    <section className="lm-absent" aria-labelledby={`live-map-${domain.domainId}`}>
      <h3 id={`live-map-${domain.domainId}`} className="lm-absent-title">
        <Icon className="size-4 text-fg-muted" aria-hidden="true" />
        {domain.label}
      </h3>
      <StateNotice>{domain.state.detail}</StateNotice>
    </section>
  );
}

export function LiveMapCanvas({ projection }: { projection: LiveMapProjection }) {
  const organization = projection.domains.find((d) => d.domainId === "organization");
  const agents = projection.domains.find((d) => d.domainId === "agents");
  const others = projection.domains.filter(
    (d) => d.domainId !== "organization" && d.domainId !== "agents",
  );

  const organizationNode =
    organization?.state.status === "available" ? organization.state.nodes[0] : undefined;
  const agentNodes = agents?.state.status === "available" ? agents.state.nodes : [];
  /* The spine is drawn only when both ends are on the map — the same rule the edge itself follows. */
  const connected = Boolean(organizationNode) && agentNodes.length > 0;

  return (
    <div className="lm-root" data-live-map data-connected={connected ? "yes" : "no"}>
      <section className="lm-canvas" aria-label="Organizational map">
        <div className="lm-centre">
          {organizationNode ? (
            <OrganizationNode node={organizationNode} />
          ) : organization ? (
            <div className="lm-org-absent">
              <h3 className="lm-absent-title">
                <Building2 className="size-4 text-fg-muted" aria-hidden="true" />
                {organization.label}
              </h3>
              {organization.state.status !== "available" ? (
                <StateNotice>{organization.state.detail}</StateNotice>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="lm-branch" aria-hidden={connected ? undefined : "true"} />

        <div className="lm-agents-group">
          <h3 className="lm-group-label">
            {agents?.label ?? "Agents"}
            {agentNodes.length > 0 ? (
              <span className="lm-group-count">
                {agentNodes.length} {agentNodes.length === 1 ? "agent" : "agents"}
              </span>
            ) : null}
          </h3>
          {agentNodes.length > 0 ? (
            <div className="lm-agents">
              <AgentOfficeSprite />
              {agentNodes.map((node) => (
                <AgentNode key={node.nodeId} node={node} />
              ))}
            </div>
          ) : agents && agents.state.status !== "available" ? (
            <StateNotice>{agents.state.detail}</StateNotice>
          ) : null}
          <Relationship edges={projection.edges} />
        </div>
      </section>

      <div className="lm-absences">
        {others.map((domain) => (
          <div key={domain.domainId}>
            <PresentDomain domain={domain} />
            <AbsentDomain domain={domain} />
          </div>
        ))}
      </div>

      {projection.intelligenceCompleteness ? (
        <CompletenessNote completeness={projection.intelligenceCompleteness} />
      ) : null}
      <p className="lm-freshness">{projection.freshness}</p>
    </div>
  );
}
