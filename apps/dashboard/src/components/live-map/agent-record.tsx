import type {
  LiveMapNode,
  LiveMapNodeAttention,
  LiveMapNodeIntelligence,
} from "@/features/live-map/contracts";

/*
 * LIVE MAP — ONE AGENT'S RECORD (PHASE 4B).
 *
 * The inspector's three truth statements, moved off the map card and onto the office page's Details
 * section with their wording intact. They stay three blocks under three labels: a node's identity is
 * authoritative, the numbers beside it are derived, and neither is merged into the other.
 *
 *     AUTHORITATIVE IDENTITY != DERIVED INTELLIGENCE        COUNT != SCORE
 */

/** The authoritative half: the owning authority's own lines, and where that authority lives. */
export function AgentIdentityRecord({ node }: { node: LiveMapNode }) {
  return (
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
  );
}

/**
 * The derived half.
 *
 * Rendered under its own truth-class label, never interleaved with the identity facts. An unread
 * observation is a sentence and never a row of zeros: a zero here would tell a Director that a
 * working agent has proposed nothing.
 */
export function OutcomeIntelligence({ intelligence }: { intelligence: LiveMapNodeIntelligence }) {
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
          <h3 className="lm-group-title">{group.label}</h3>
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
 * E2-4 — THE ELAPSED ANNOTATION, IN ITS OWN BLOCK UNDER ITS OWN AUTHORITY.
 *
 * It sits beside the outcome observation rather than inside it, because the two are composed by
 * different authorities and a duration printed under "Agent Outcome Observation" would be
 * misattributed. Same neutral treatment as every other derived block: no colour, no badge, no
 * ordering by size. A duration rendered as a warning would be a classification, and no policy
 * owner for one exists.
 *
 *     AGE != IMPORTANCE     WAITING != LATE     ANNOTATION != CLASSIFICATION
 */
export function AttentionAnnotation({ attention }: { attention: LiveMapNodeAttention }) {
  return (
    <section className="lm-intel" aria-label="Organizational attention observation">
      <p className="lm-truth">
        <span className="lm-truth-class">{attention.truthClass}</span>
        <span aria-hidden="true"> · </span>
        <span>{attention.sourceAuthority}</span>
      </p>
      <p className="lm-intel-basis">{attention.basis}</p>
      <dl className="lm-measures">
        {attention.measures.map((measure) => (
          <div key={measure.label} className="lm-measure">
            <dt>{measure.label}</dt>
            <dd>{measure.value}</dd>
            <p className="lm-measure-note">{measure.basis}</p>
          </div>
        ))}
      </dl>
      <ul className="lm-nonclaims">
        {attention.nonClaims.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The three counts a card and an office both lead with, or null.
 *
 * THREE COUNTS, NEVER A SUMMARY OF THEM. Filed, approved and approved-but-never-executed are three
 * different authorities' facts; a single figure combining them would be a score nobody owns.
 */
export function headlineCounts(
  intelligence: LiveMapNodeIntelligence,
): { readonly filed: number; readonly approved: number; readonly neverExecuted: number } | null {
  if (intelligence.status === "unavailable") return null;
  const at = (groupId: string, label: string): number | null => {
    const group = intelligence.groups.find((g) => g.groupId === groupId);
    const measure = group?.measures.find((m) => m.label === label);
    return measure ? measure.value : null;
  };
  const filed = at("proposals", "Filed");
  const approved = at("governance", "Approved");
  const neverExecuted = at("governance", "Approved, never executed");
  if (filed === null || approved === null || neverExecuted === null) return null;
  return { filed, approved, neverExecuted };
}
