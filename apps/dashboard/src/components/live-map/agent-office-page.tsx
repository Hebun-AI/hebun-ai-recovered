import Link from "next/link";
import type { ReactNode } from "react";
import {
  LIVE_MAP_AGENT_PLACEMENT_BASIS,
  LIVE_MAP_OFFICE_HERO_CAPTION,
  LIVE_MAP_TEAM_RELATION_ABSENT,
  type LiveMapAgentOfficePlacement,
  type LiveMapAgentOfficeRead,
  type LiveMapNode,
} from "@/features/live-map/contracts";
import { officeThemeFor, type OfficeTheme } from "@/features/live-map/office-theme";
import { AgentOfficeScene, AgentOfficeSprite, type OfficeTone } from "./agent-office-scene";
import {
  AgentIdentityRecord,
  AttentionAnnotation,
  OutcomeIntelligence,
  headlineCounts,
} from "./agent-record";

/*
 * LIVE MAP — ONE AGENT'S OFFICE (PHASE 4B).
 *
 * One template for every real agent. It reads nothing: the route hands it what the seam answered, so
 * a name, a lifecycle word and a count can only be the ones the map shows.
 *
 * It can still only navigate. Live Map holds no authority over anything it draws, so there is no
 * control here, and the two links are the way back and the registry.
 *
 * THE HERO IS A SEAM. `OfficeHero` receives a theme and a tone, and the placeholder inside it is the
 * only thing a real picture has to replace. `data-office-theme` is what that picture will key on.
 *
 *     VISUAL INTERACTION != WRITE AUTHORITY        IN SERVICE != ACTIVE NOW
 */

function BackToLiveMap() {
  return (
    <Link className="lm-office-back" href="/live-map">
      <span aria-hidden="true">←</span> Live Map
    </Link>
  );
}

/** The page's root: the Live Map's dark scope, with the way back always first. */
export function AgentOfficeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="lm-root lm-office" data-live-map>
      <BackToLiveMap />
      {children}
    </div>
  );
}

function OfficeHero({ theme, nodeId, tone }: { theme: OfficeTheme; nodeId: string; tone?: OfficeTone }) {
  return (
    <figure className="lm-office-hero" data-office-hero data-office-theme={theme}>
      <AgentOfficeSprite />
      <AgentOfficeScene nodeId={nodeId} tone={tone} />
      <figcaption className="lm-office-caption">{LIVE_MAP_OFFICE_HERO_CAPTION}</figcaption>
    </figure>
  );
}

const PLACEMENT_STATE_NOTE: Readonly<Record<string, string>> = {
  "placed-in-retired-department": "This department has been retired from service.",
  historical: "This agent is not in service, so this is not a current placement.",
};

function DepartmentPlacement({ placement }: { placement: LiveMapAgentOfficePlacement }) {
  if (placement.status === "unavailable") {
    return (
      <p className="lm-intel-detail">
        Hebun could not read this agent&apos;s department placement. That says nothing about where it sits.
      </p>
    );
  }
  if (!placement.department) {
    return <p className="lm-intel-detail">This agent has no recorded department.</p>;
  }
  const note = PLACEMENT_STATE_NOTE[placement.state];
  return (
    <>
      <p className="lm-office-department">{placement.department.name}</p>
      {note ? <p className="lm-intel-detail">{note}</p> : null}
      <p className="lm-measure-note">{LIVE_MAP_AGENT_PLACEMENT_BASIS}</p>
    </>
  );
}

function TeamPanel({ placement }: { placement: LiveMapAgentOfficePlacement }) {
  return (
    <section className="lm-office-panel" aria-labelledby="lm-office-team">
      <h2 id="lm-office-team" className="lm-office-heading">
        Team &amp; Subagents
      </h2>
      <p className="lm-notice">{LIVE_MAP_TEAM_RELATION_ABSENT}</p>
      <h3 className="lm-group-title">Department placement</h3>
      <DepartmentPlacement placement={placement} />
    </section>
  );
}

/** Three counts, each its own number. An unread observation is the authority's sentence, never 0. */
function HeadlineCounts({ node }: { node: LiveMapNode }) {
  const counts = node.intelligence ? headlineCounts(node.intelligence) : null;
  return (
    <section className="lm-office-panel" aria-labelledby="lm-office-counts">
      <h2 id="lm-office-counts" className="lm-office-heading">
        Filed, approved, never executed
      </h2>
      {counts ? (
        <dl className="lm-office-counts">
          <div>
            <dd>{counts.filed}</dd>
            <dt>Filed</dt>
          </div>
          <div>
            <dd>{counts.approved}</dd>
            <dt>Approved</dt>
          </div>
          <div>
            <dd>{counts.neverExecuted}</dd>
            <dt>Never executed</dt>
          </div>
        </dl>
      ) : (
        <p className="lm-intel-detail">
          {node.intelligence?.status === "unavailable"
            ? node.intelligence.detail
            : "The outcome observation was not read for this agent."}
        </p>
      )}
    </section>
  );
}

export function AgentOfficePage({ office }: { office: LiveMapAgentOfficeRead }) {
  if (office.status !== "found") {
    return (
      <AgentOfficeFrame>
        <h1 className="lm-office-name">Agent office</h1>
        <p className="lm-notice">
          {office.status === "unavailable" ? office.detail : "Hebun could not read this agent."}
        </p>
      </AgentOfficeFrame>
    );
  }

  const { node, placement, freshness } = office;
  return (
    <AgentOfficeFrame>
      <header className="lm-office-header">
        <h1 className="lm-office-name">{node.label}</h1>
        {node.status ? (
          <span className="lm-status" data-tone={node.status.tone}>
            {node.status.label}
          </span>
        ) : null}
      </header>

      <div className="lm-office-stage">
        <OfficeHero theme={officeThemeFor(placement)} nodeId={node.nodeId} tone={node.status?.tone} />
        <TeamPanel placement={placement} />
      </div>

      <HeadlineCounts node={node} />

      <section className="lm-office-panel" aria-labelledby="lm-office-details">
        <h2 id="lm-office-details" className="lm-office-heading">
          Details
        </h2>
        <div className="lm-inspector">
          <AgentIdentityRecord node={node} />
          {node.intelligence ? <OutcomeIntelligence intelligence={node.intelligence} /> : null}
          {node.attention ? <AttentionAnnotation attention={node.attention} /> : null}
        </div>
      </section>

      <p className="lm-freshness">{freshness}</p>
    </AgentOfficeFrame>
  );
}
