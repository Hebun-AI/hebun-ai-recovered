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
 * ── SELECTION WITHOUT A CONTROL ──────────────────────────────────────────────
 *
 * Selecting an agent opens its inspector. That is a native `<details name="live-map-agent">` group:
 * the browser closes the previously open one, so exactly one agent is ever selected, with keyboard
 * operation, focus and screen-reader semantics supplied by the platform rather than reimplemented.
 *
 * It is also the only interaction this surface CAN have. Live Map holds no authority over anything
 * it draws, and a `<details>` discloses text that is already in the projection — it cannot create,
 * move, rename, retire, approve or execute. The released firewall forbids `onClick`, `useState`,
 * `<button>` and `<form>` in this directory, and that ban is unweakened here.
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

/* ═══════════════════════════════════════════════════════════════════════════
 * THE DERIVED ATTACHMENT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The inspector's derived half.
 *
 * Rendered under its own heading and its own truth-class label, never interleaved with the identity
 * facts above it. An unread observation is a sentence and never a row of zeros — a zero here would
 * tell a Director that a working agent has proposed nothing.
 */
function OutcomeIntelligence({ intelligence }: { intelligence: LiveMapNodeIntelligence }) {
  if (intelligence.status === "unavailable") {
    return (
      <section className="lm-intel" aria-label="Agent outcome observation">
        <p className="lm-truth">
          <span className="lm-truth-class">{intelligence.truthClass}</span>
          <span aria-hidden="true"> · </span>
          <span>{intelligence.sourceAuthority}</span>
        </p>
        <p className="lm-intel-detail">{intelligence.detail}</p>
      </section>
    );
  }

  return (
    <section className="lm-intel" aria-label="Agent outcome observation">
      <p className="lm-truth">
        <span className="lm-truth-class">{intelligence.truthClass}</span>
        <span aria-hidden="true"> · </span>
        <span>{intelligence.sourceAuthority}</span>
      </p>
      <p className="lm-intel-basis">{intelligence.basis}</p>
      {intelligence.groups.map((group) => (
        <div key={group.groupId} className="lm-group">
          <h5 className="lm-group-title">{group.label}</h5>
          <dl className="lm-measures">
            {group.measures.map((measure) => (
              <div key={measure.label} className="lm-measure">
                <dt>{measure.label}</dt>
                <dd>{measure.value}</dd>
                {measure.note ? <p className="lm-measure-note">{measure.note}</p> : null}
              </div>
            ))}
          </dl>
        </div>
      ))}
      <ul className="lm-nonclaims">
        {intelligence.nonClaims.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The glance line on a closed agent node.
 *
 * THREE COUNTS, NEVER A SUMMARY OF THEM. Filed, approved and approved-but-never-executed are three
 * different authorities' facts; a single figure combining them would be the score this milestone is
 * forbidden to invent. When the observation could not be read the line says so instead of showing
 * zeros.
 */
function GlanceSignal({ intelligence }: { intelligence?: LiveMapNodeIntelligence }) {
  if (!intelligence) return null;
  if (intelligence.status === "unavailable") {
    return <p className="lm-glance lm-glance-unread">Outcome observation unread</p>;
  }
  const at = (groupId: string, label: string): number | null => {
    const group = intelligence.groups.find((g) => g.groupId === groupId);
    const measure = group?.measures.find((m) => m.label === label);
    return measure ? measure.value : null;
  };
  const filed = at("proposals", "Filed");
  const approved = at("governance", "Approved");
  const unexecuted = at("governance", "Approved, never executed");
  if (filed === null || approved === null || unexecuted === null) return null;
  return (
    <p className="lm-glance">
      <span>{filed} filed</span>
      <span aria-hidden="true"> · </span>
      <span>{approved} approved</span>
      <span aria-hidden="true"> · </span>
      <span>{unexecuted} never executed</span>
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE AGENTS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * One agent on the map, closed as a node and open as an inspector.
 *
 * `name="live-map-agent"` makes the group mutually exclusive in the browser, so "exactly one agent
 * is selected" is a platform guarantee rather than state this surface keeps. The open node spans
 * the full width (see the stylesheet), which is what makes the inspector readable without a second
 * column that would have to disappear on a laptop.
 */
function AgentNode({ node }: { node: LiveMapNode }) {
  return (
    <details className="lm-agent" name="live-map-agent">
      <summary className="lm-node" aria-label={`${node.label} — ${node.status?.label ?? "agent"}`}>
        <span className="lm-node-mark" aria-hidden="true">
          <Bot className="size-4" />
        </span>
        <span className="lm-node-body">
          <span className="lm-node-name">{node.label}</span>
          {node.status ? (
            <span className="lm-status" data-tone={node.status.tone}>
              {node.status.label}
            </span>
          ) : null}
          <GlanceSignal intelligence={node.intelligence} />
        </span>
      </summary>

      <div className="lm-inspector">
        <section className="lm-identity" aria-label="Agent identity">
          <p className="lm-truth">
            <span className="lm-truth-class">{node.truth}</span>
            <span aria-hidden="true"> · </span>
            <span>{node.sourceAuthority}</span>
          </p>
          <ul className="lm-record">
            {node.detail.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {node.openRoute ? (
            <a className="lm-open" href={node.openRoute}>
              Open Agents
            </a>
          ) : null}
        </section>
        {node.intelligence ? <OutcomeIntelligence intelligence={node.intelligence} /> : null}
      </div>
    </details>
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
  const first = edges[0];
  if (!first) return null;
  return (
    <p className="lm-basis">
      <span className="lm-basis-relation">{first.relation}</span> {first.basis}
    </p>
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
          <AbsentDomain key={domain.domainId} domain={domain} />
        ))}
      </div>

      {projection.intelligenceCompleteness ? (
        <CompletenessNote completeness={projection.intelligenceCompleteness} />
      ) : null}
      <p className="lm-freshness">{projection.freshness}</p>
    </div>
  );
}
