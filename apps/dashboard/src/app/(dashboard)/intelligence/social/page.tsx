/*
 * /intelligence/social — the Social Intelligence workspace (SOC-UI1).
 *
 * ── WHAT THIS SURFACE IS ────────────────────────────────────────────────────
 *
 * What connected social platforms REPORTED, at the instants Hebun OBSERVED them, plus the one
 * arithmetic Hebun is authorized to perform on that evidence. It is an operational intelligence
 * surface, not a marketing dashboard: there is no engagement score, no reach, no impressions, no
 * demographics, no best-posting-time and no ranking, because this organization has no provider
 * capability that reports any of them and Hebun does not have an analytics authority that could
 * invent one.
 *
 * ── WHAT IS ABSENT, AND WHY THE ABSENCE IS THE DESIGN ───────────────────────
 *
 * The composition reference this was built against carries a demographics ring, a posting heatmap
 * and an engagement gauge. All three are missing here, and none was replaced with a placeholder or
 * a "coming soon" tile. A dashboard that fills its grid with panels it cannot source teaches its
 * reader that the panels which ARE sourced might be decoration too. **Fewer real panels beat a full
 * grid of implied ones.**
 *
 * ── THE PROVIDERS SHOWN ARE THIS TENANT'S, NOT HEBUN'S ──────────────────────
 *
 * The platform cards come from the connection authority per organization. A platform Hebun has built
 * a reader for does not appear here until this organization has connected it, and the navigation
 * entry that leads here names no provider at all — it is compiled in and tenant-shared, and a
 * provider named in it would tell every organization that Hebun is watching something theirs may not
 * have connected.
 *
 * ── IT CONTACTS NO PROVIDER ─────────────────────────────────────────────────
 *
 * Every number below comes from rows Hebun already holds, read through the released observation
 * authority. Rendering this page asks Instagram and YouTube nothing, spends no quota, and decrypts
 * no credential.
 */
import { PageHeader } from "@/components/layout/page-header";
import { StateBlock } from "@/components/ui/state-block";
import { WorkspaceSection } from "@/components/ui/workspace-section";
import { InstagramMediaCards } from "@/components/platform-integrations/instagram-media-cards";
import { EvolutionPanel } from "@/components/social-intelligence/evolution-panel";
import { WorkRequestForm } from "@/components/social-intelligence/work-request-form";
import { ObservationCoverage } from "@/components/social-intelligence/observation-coverage";
import { PlatformSummaryCard } from "@/components/social-intelligence/platform-summary-card";
import { readSocialDashboard } from "@/features/social-intelligence/dashboard-read.server";
import { INSTAGRAM_PLATFORM, YOUTUBE_PLATFORM } from "@/features/social-intelligence/contracts";
import {
  INSTAGRAM_MEDIA_ABSENCE,
  INSTAGRAM_MEDIA_MEANING,
  INSTAGRAM_MEDIA_WINDOW,
  windowStateOf,
} from "@/features/instagram-connection-surface/latest-media-observation";

export const metadata = { title: "Social Intelligence — Intelligence — Hebun AI" };
export const dynamic = "force-dynamic";

const OBSERVED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function instant(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : `${OBSERVED_FORMAT.format(parsed)} UTC`;
}

export default async function SocialIntelligencePage() {
  const model = await readSocialDashboard();

  /*
   * THE STATUS STRIP IS COUNTED, NEVER ASSERTED. Both figures are derived from what this render
   * actually read: how many platforms hold a grant, and how many observations back the page. When
   * the connection authority could not be read, the platform figure is withheld rather than shown
   * as zero.
   */
  /*
   * THE SAME DEFECT THE PANELS HAD, IN THE STRIP. Summing only the rows that were READ gives zero
   * when NONE of them could be read, and "Stored observations: 0" then asserts that Hebun holds
   * nothing — beside a page whose every section says the opposite is unknown. A total is only
   * reportable when at least one capability was actually read, and it is marked partial when some
   * were not.
   */
  const knownCoverage = model.coverage.filter((row) => row.known);
  const observationTotal =
    knownCoverage.length === 0
      ? null
      : knownCoverage.reduce((total, row) => total + row.observations, 0);
  const coveragePartial = knownCoverage.length > 0 && knownCoverage.length < model.coverage.length;
  const latestObservedAt = model.coverage
    .map((row) => row.latestObservedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader
        title="Social Intelligence"
        context="What this organization's connected social platforms reported, and when Hebun observed it."
      />

      {/*
        THE EVIDENCE STRIP. Three counted facts, on one line, above everything they describe — this
        is the density the composition reference gets from a status bar, sourced instead of styled.
      */}
      <dl className="mb-8 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-b border-border pb-5">
        <div className="flex items-baseline gap-2">
          <dt className="text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">Platforms</dt>
          <dd className="text-meta font-medium text-fg tabular-nums">
            {model.presenceKnown ? model.platforms.length : "Unknown"}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
            Stored observations
          </dt>
          <dd className="text-meta font-medium text-fg tabular-nums">
            {observationTotal === null ? "Unknown" : observationTotal}
            {coveragePartial ? (
              <span className="font-normal text-fg-muted"> (partial — some capabilities unreadable)</span>
            ) : null}
          </dd>
        </div>
        {latestObservedAt ? (
          <div className="flex items-baseline gap-2">
            <dt className="text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Latest observation
            </dt>
            <dd className="text-meta font-medium text-fg">{instant(latestObservedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex min-w-0 flex-col gap-10">
        {/* ── B. Platform summary cards ─────────────────────────────────── */}
        <WorkspaceSection
          title="Connected platforms"
          question="Which social platforms is this organization connected to, and what did each provider last report?"
          provenance="authoritative"
          provenanceDetail="Integration authority"
        >
          {!model.presenceKnown ? (
            <StateBlock
              tone="unavailable"
              title="Connection records could not be read"
              description="Hebun could not read its own connection records just now, so which social platforms this organization has connected is unknown. This is not a statement that there are none."
            />
          ) : model.platforms.length === 0 ? (
            <StateBlock
              tone="empty"
              title="No social platform is connected"
              description="This organization has no usable Instagram or YouTube connection. Hebun supports both; neither is bound to this organization, so there is nothing to report."
            />
          ) : (
            /*
              TWO COLUMNS FROM `sm`, AND NEVER MORE. A metric card holds three numbers and a provider
              account string; at three across the account label wraps to three lines on a laptop and
              the cards stop ending level. Two connected platforms is also today's real count — a
              grid that reflows to four would be designed for evidence that does not exist.
            */
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {model.platforms.map((card) => (
                <li key={card.key} className="min-w-0">
                  <PlatformSummaryCard card={card} />
                </li>
              ))}
            </ul>
          )}
        </WorkspaceSection>

        {/* ── C/D. Audience & account evolution, and the calculated change ── */}
        <WorkspaceSection
          title="Measurements over time"
          question="How have the counts each provider reports moved across the instants Hebun observed them?"
          provenance="authoritative"
          provenanceDetail="Stored provider observations"
        >
          {/*
            ── FOLLOWERS AND SUBSCRIBERS SHARE THIS ROW AND NOTHING ELSE ──────
            Two panels, side by side, each naming its own platform and its own metric in its own
            heading. They are NEVER drawn on one pair of axes: an Instagram follower and a YouTube
            subscriber are different objects under different provider rules — one can be hidden by
            its owner and the other cannot — and a single line through both would be a number no
            provider reports.
          */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <EvolutionPanel
              platformLabel={INSTAGRAM_PLATFORM.label}
              subjectNoun={INSTAGRAM_PLATFORM.subjectNoun}
              metric={INSTAGRAM_PLATFORM.metrics[0]!.shortLabel}
              metricLabel={INSTAGRAM_PLATFORM.metrics[0]!.label}
              points={model.instagram.points}
              measurementCountLabel={model.instagram.measurementCountLabel}
              evolutionSentence={model.instagram.evolutionSentence}
              seriesProvenance={model.instagram.seriesProvenance}
              /*
                IG-AN2 IS NOW RELEASED, and this is its answer — not this page's. The composition
                carries the released comparison; the panel renders it with `Hebun calculated`
                provenance, exactly as it already does for YouTube. When there is still only one
                measurement the same panel prints the released "a second observation is needed"
                sentence instead. Nothing on this page computes a follower delta of its own.
              */
              changes={model.instagram.changes}
              changesSentence={model.instagram.changesSentence}
              changeProvenance="derived"
            >
              {/*
                SOC-ACT1. The one affordance, and it sits HERE rather than on the platform card
                because a card shows a LEVEL and a level is not a reason. What a person acts on is a
                CHANGE, and this is the panel that renders one.

                It is rendered only when there is an observation to cite. No reference, no form —
                not a disabled one, because a disabled control still says the action exists and is
                merely unavailable, and with nothing stored there is nothing to file a request
                ABOUT.

                Pressing it files a PENDING request. It records no work, authorizes nothing, mints
                no permit, executes nothing and asks Instagram nothing.
              */}
              {model.instagram.latestObservationRef !== null ? (
                <WorkRequestForm
                  observationRef={model.instagram.latestObservationRef}
                  platformLabel={INSTAGRAM_PLATFORM.label}
                />
              ) : null}
            </EvolutionPanel>
            <EvolutionPanel
              platformLabel={YOUTUBE_PLATFORM.label}
              subjectNoun={YOUTUBE_PLATFORM.subjectNoun}
              metric={YOUTUBE_PLATFORM.metrics[0]!.shortLabel}
              metricLabel={YOUTUBE_PLATFORM.metrics[0]!.label}
              points={model.youtube.points}
              measurementCountLabel={model.youtube.measurementCountLabel}
              evolutionSentence={model.youtube.evolutionSentence}
              seriesProvenance={model.youtube.seriesProvenance}
              changes={model.youtube.changes}
              changesSentence={model.youtube.changesSentence}
              changeProvenance={model.youtube.changeProvenance}
            />
          </div>

          {/*
            WHY ONLY ONE METRIC IS PLOTTED PER PLATFORM. Three lines on one pair of axes would put a
            view count in the tens of thousands and a subscriber count in the tens onto one vertical
            scale, and the smaller line would sit flat on the floor looking like an absence. The plot
            carries the platform's headline count; the CHANGE block inside each panel carries all
            three metrics, in one stated window, as numbers — where a shared scale cannot distort
            them and a zero cannot be mistaken for a baseline.
          */}
        </WorkspaceSection>

        {/* ── E. Recent content ─────────────────────────────────────────── */}
        <WorkspaceSection
          title="Recent content"
          question="Which posts did Instagram report in the latest stored observation?"
          provenance="authoritative"
          provenanceDetail="Instagram reported"
        >
          {model.instagram.content.status === "observed" ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-meta text-fg-secondary text-pretty" title={INSTAGRAM_MEDIA_MEANING}>
                  What Instagram reported at that instant — not a live view of the account.
                </p>
                {/*
                  "Observed by Hebun" here, "Published" on each card. Two instants, two different
                  facts; a bare date beside an observation timestamp invites a reader to conflate
                  them, and the word is the whole guard.
                */}
                <p className="text-meta text-fg-muted">
                  Observed by Hebun{" "}
                  <span className="font-medium text-fg-secondary">
                    {instant(model.instagram.content.observation.observedAt)}
                  </span>
                </p>
              </div>

              <InstagramMediaCards items={model.instagram.content.observation.items} />

              <p className="text-meta leading-5 text-fg-muted text-pretty">
                {model.instagram.content.observation.recentMediaCount ??
                  model.instagram.content.observation.items.length}{" "}
                media in this observation.{" "}
                {INSTAGRAM_MEDIA_WINDOW[windowStateOf(model.instagram.content.observation)]}
              </p>

              {/*
                WHY THERE IS NO YOUTUBE ROW HERE, said once rather than drawn as an empty panel.
                The channel genuinely reports zero videos, and no released YouTube content read model
                exists to render if it had any. A matching card grid built for symmetry would be a
                panel with nothing behind it.
              */}
              <p className="text-meta leading-5 text-fg-muted text-pretty">
                No YouTube content is shown: this channel reported 0 videos, and Hebun has no
                released reader for YouTube content to draw from if it had any.
              </p>
            </div>
          ) : (
            <StateBlock
              tone={model.instagram.content.status === "none" ? "empty" : "unavailable"}
              title="No stored media observation"
              description={
                model.instagram.content.status === "none"
                  ? INSTAGRAM_MEDIA_ABSENCE.none
                  : INSTAGRAM_MEDIA_ABSENCE[model.instagram.content.reason]
              }
            />
          )}
        </WorkspaceSection>

        {/* ── Evidence coverage ─────────────────────────────────────────── */}
        <WorkspaceSection
          title="Observation coverage"
          question="How often has Hebun actually looked, and when did it last?"
          provenance="authoritative"
          provenanceDetail="Provider observation history"
        >
          <ObservationCoverage rows={model.coverage} />
        </WorkspaceSection>
      </div>
    </>
  );
}
