/*
 * heby-commands/performance-read.server.ts — HEBY-OBSERVED-PERFORMANCE-READ-1: `/performance`.
 *
 * What Hebun has RECORDED about this organization's accepted Instagram and YouTube publications,
 * shown to the person who asked and to nobody else. It is a composition of three released readers
 * and writes no SQL of its own:
 *
 *   listWorkArtifacts            which content drafts this tenant holds        (Work Artifacts)
 *   readWorkArtifactHistory      every revision of each, by its own number     (Work Artifacts)
 *   readPublicationMeasurements  which of those revisions the ledger records as published, and what
 *                                the stored observations say about each provider id
 *                                (Action Authorization's ledger + Provider Observation History)
 *
 * ── HISTORICAL REVISIONS COME FROM THE REVISION AUTHORITY ────────────────────
 *
 * A post is published from a revision, and the artifact may have moved on since. Asking only about
 * each draft's CURRENT revision would silently drop that post. So the revision numbers are read from
 * the artifact's own history, never inferred from its current pointer, and the LEDGER decides which
 * of them were published.
 *
 * ── BOUNDED, AND IT SAYS SO ──────────────────────────────────────────────────
 *
 * The measurement reader accepts at most `CONTENT_PUBLICATION_REVISIONS_LIMIT` revisions per call,
 * and this keeps that contract instead of looping around it. Revisions are taken newest artifact
 * first, newest revision first; when more exist, the answer says that older publications were not
 * checked. A history that could not be read is named too: the released history reader returns an
 * empty list on failure, and a listed artifact always has a first revision, so empty means unread.
 *
 * ── WHAT IT NEVER DOES ──────────────────────────────────────────────────────
 *
 * It writes nothing, calls no provider, builds no transport, imports no model client and produces no
 * `SourceResolution`. Its output is a local command result: never a durable message, never model
 * history. Counts are printed as reported, `null` as "not reported", with the instant they describe
 * and the existing non-claim sentences. No rate, rank, score, trend or judgement.
 *
 * ── HEBY-PERFORMANCE-COMPARISON-1: LEGIBLE, STILL NOT JUDGED ─────────────────
 *
 * The answer names the organization it read (the Organization authority, from the session's tenant
 * and nothing else), groups publications by provider, and prints two elapsed times per measured
 * publication: publication → latest stored observation, and that observation's age at this read.
 * Instagram change is printed only from `PublicationMeasurement.evolution`, which IG-AN3's released
 * derivation produced; nothing here subtracts a count. A negative or unparseable elapsed time is not
 * printed as one. No freshness threshold, no label, no ordering by any count.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { CONTENT_PUBLICATION_REVISIONS_LIMIT } from "@/features/action-authorization/content-publication-state.server";
import {
  INSTAGRAM_MEDIA_GAP_NOTES,
  type InstagramMediaMetricComparison,
} from "@/features/instagram-connection-surface/media-measurement-evolution";
import type { OrganizationAuthorityRead } from "@/features/organization-authority/contracts";
import {
  PUBLICATION_MEASUREMENT_NON_CLAIM,
  PUBLICATION_MEASUREMENT_WORDING,
  YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM,
  describeYouTubePublicationMeasurement,
  type PublicationMeasurement,
  type RevisionPublicationMeasurements,
  type YouTubePublicationMeasurement,
} from "@/features/content-publication-measurement/contracts";
import { readPublicationMeasurements } from "@/features/content-publication-measurement/read-publication-measurement.server";
import { formatWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { CONTENT_DRAFT_TYPE } from "@/features/work-artifacts/contracts";
import { listWorkArtifacts, readWorkArtifactHistory } from "@/features/work-artifacts/read-work-artifacts.server";

export const PERFORMANCE_PROVENANCE =
  "Recorded publications (Action Authorization's ledger) joined to Hebun's stored provider observations. " +
  "Read from Hebun's own records: no provider was contacted, nothing was written, and nothing here was sent to a model.";

export interface PerformanceReadDeps {
  readonly listArtifacts?: typeof listWorkArtifacts;
  readonly readHistory?: typeof readWorkArtifactHistory;
  readonly readMeasurements?: typeof readPublicationMeasurements;
  /*
   * The Organization authority's read, handed in by the caller that already consumes it
   * (`read-commands.server.ts`), so this module adds no consumer to that seam's census. Absent, the
   * name is honestly "unavailable" — never guessed.
   */
  readonly readOrganization?: (tenant: TenantContext) => Promise<OrganizationAuthorityRead>;
  /** The read's clock, injectable for proof. Observation ages are measured against it. */
  readonly now?: () => Date;
}

/** The organization this read is about, named by the Organization authority, or not named at all. */
export type PerformanceOrganization = { readonly status: "read"; readonly name: string } | { readonly status: "unavailable" };

/** One checked revision. */
export interface CheckedRevision {
  readonly ref: string;
  readonly artifactId: string;
  readonly title: string;
  readonly revisionNo: number;
  readonly current: boolean;
}

export type PerformanceRead =
  | { readonly status: "unavailable"; readonly reason: "drafts-unreadable"; readonly organization: PerformanceOrganization }
  | {
      readonly status: "read";
      readonly organization: PerformanceOrganization;
      /** The instant of this read; every observation age is measured to it. */
      readonly readAt: string;
      readonly checked: readonly CheckedRevision[];
      /** More revisions exist than the bound allowed to be checked. */
      readonly truncated: boolean;
      /** Titles of content drafts whose revision history could not be read. */
      readonly historyUnreadable: readonly string[];
      readonly measurements: ReadonlyMap<string, RevisionPublicationMeasurements>;
    };

export async function readPerformance(tenant: TenantContext, deps: PerformanceReadDeps = {}): Promise<PerformanceRead> {
  if (typeof window !== "undefined") throw new Error("Performance reads are server-only.");
  const readAt = (deps.now ?? (() => new Date()))().toISOString();
  /* The name comes from the Organization authority for the SESSION's tenant; nothing else names it. */
  const [listing, org] = await Promise.all([
    (deps.listArtifacts ?? listWorkArtifacts)(tenant),
    deps.readOrganization ? deps.readOrganization(tenant).catch(() => null) : Promise.resolve(null),
  ]);
  const organization: PerformanceOrganization =
    org?.status === "available" ? { status: "read", name: org.organization.name } : { status: "unavailable" };
  if (listing.status !== "read") return { status: "unavailable", reason: "drafts-unreadable", organization };

  /* Newest first, as the listing orders them; retired drafts included, a post outlives its draft. */
  const drafts = listing.artifacts.filter((a) => a.artifactType === CONTENT_DRAFT_TYPE);
  const checked: CheckedRevision[] = [];
  const historyUnreadable: string[] = [];
  let truncated = false;

  for (const draft of drafts) {
    if (checked.length >= CONTENT_PUBLICATION_REVISIONS_LIMIT) {
      truncated = true;
      break;
    }
    const history = await (deps.readHistory ?? readWorkArtifactHistory)(tenant, draft.id);
    if (history.length === 0) {
      historyUnreadable.push(draft.title);
      continue;
    }
    for (const revision of [...history].sort((a, b) => b.revisionNo - a.revisionNo)) {
      if (checked.length >= CONTENT_PUBLICATION_REVISIONS_LIMIT) {
        truncated = true;
        break;
      }
      checked.push({
        ref: formatWorkArtifactRef(draft.id, revision.revisionNo).toLowerCase(),
        artifactId: draft.id,
        title: draft.title,
        revisionNo: revision.revisionNo,
        current: revision.current,
      });
    }
  }

  const measurements =
    checked.length === 0
      ? new Map<string, RevisionPublicationMeasurements>()
      : await (deps.readMeasurements ?? readPublicationMeasurements)(
          tenant,
          checked.map((c) => ({ artifactId: c.artifactId, revisionNo: c.revisionNo })),
        );
  return { status: "read", organization, readAt, checked, truncated, historyUnreadable, measurements };
}

/* ── Rendering. Pure: every sentence below is a function of the read above. ── */

const instant = (iso: string): string => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const count = (value: number | null): string => (value === null ? "not reported" : String(value));

function revisionLabel(c: CheckedRevision): string {
  return `“${c.title}” revision ${c.revisionNo}${c.current ? " (current)" : " (superseded)"}`;
}

/*
 * HEBY-PERFORMANCE-COMPARISON-1 — elapsed time between two recorded instants. `null` when either
 * instant does not parse or the later one is not later: a negative span is not an elapsed time, and
 * printing it as one would invent an order the records do not have. Whole minutes, never rounded up.
 */
export function elapsed(fromIso: string, toIso: string): string | null {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${minutes} min`;
}

/** Publication → latest stored reading, and that reading's age at this read. Each is printed only if it is a real span. */
function timing(publishedAt: string, observedAt: string, readAt: string, noun: string): string {
  const sincePublication = elapsed(publishedAt, observedAt);
  const age = elapsed(observedAt, readAt);
  return (
    ` ${sincePublication === null ? `The ${noun} instant is not after the recorded publication instant, so no elapsed time is shown` : `${sincePublication} after publication`}` +
    ` · ${age === null ? `the ${noun} instant is later than this read's clock, so no age is shown` : `${noun} age ${age}`}.`
  );
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
function metricChange(name: string, c: InstagramMediaMetricComparison): string {
  return c.status === "comparable"
    ? `${name} ${c.previous} → ${c.latest} (${signed(c.change)})`
    : `${name}: ${INSTAGRAM_MEDIA_GAP_NOTES[c.gap]}`;
}

/** The change IG-AN3 already derived — printed, never recomputed. */
function evolutionSentence(m: Extract<PublicationMeasurement, { status: "observed" }>): string {
  if (m.evolution === null) {
    return " No change is shown: Hebun's two newest stored media observations do not both list this post.";
  }
  const { previousObservedAt, latestObservedAt, item } = m.evolution;
  /* A gap note is IG-AN3's own sentence and already ends with a full stop. */
  const changes = `${metricChange("likes", item.likeCount)} · ${metricChange("comments", item.commentCount)}`;
  return (
    ` Between the two newest stored media observations (${instant(previousObservedAt)} → ${instant(latestObservedAt)}): ` +
    `${changes}${changes.endsWith(".") ? "" : "."}`
  );
}

function instagramLine(c: CheckedRevision, m: PublicationMeasurement, readAt: string): string {
  const head = `Instagram media ${m.publication.providerResultId} · ${revisionLabel(c)} · published ${instant(m.publication.publishedAt)}`;
  switch (m.status) {
    case "observed":
      return (
        `${head} — likes ${count(m.latestLikeCount)} · comments ${count(m.latestCommentCount)} · ` +
        `as of ${instant(m.latestObservedAt)} (stored media observation; first listed ${instant(m.earliestObservedAt)}).` +
        timing(m.publication.publishedAt, m.latestObservedAt, readAt, "observation") +
        evolutionSentence(m)
      );
    case "no-observation-since-publication":
      return `${head} — ${PUBLICATION_MEASUREMENT_WORDING[m.status]}${m.latestObservedAt ? `; newest stored observation of the account ${instant(m.latestObservedAt)}` : ""}.`;
    case "absent-from-complete-window":
    case "outside-clipped-window":
      return `${head} — ${PUBLICATION_MEASUREMENT_WORDING[m.status]} (observation ${instant(m.latestObservedAt)}).`;
    case "history-unreadable":
      return `${head} — ${PUBLICATION_MEASUREMENT_WORDING[m.status]}.`;
  }
}

function youtubeLine(c: CheckedRevision, m: YouTubePublicationMeasurement, readAt: string): string {
  const line = `YouTube video measurement · ${revisionLabel(c)} · published ${instant(m.publication.publishedAt)} — ${describeYouTubePublicationMeasurement(m)}`;
  return m.status === "measured" ? line + timing(m.publication.publishedAt, m.latestObservedAt, readAt, "measurement") : line;
}

/*
 * What these counts cannot say. Printed once whenever a publication is listed. These are non-claims:
 * the only place "rate" may appear is a sentence saying there is none.
 */
export const PERFORMANCE_LIMITATIONS = Object.freeze([
  "Instagram reports likes and comments; YouTube reports views, likes and comments. They are different measures, and nothing here compares one platform with the other.",
  "Hebun holds no reach or impressions for these publications, so no rate can be shown. Counts accumulate while a publication is up: publications of different ages have had different time to collect them.",
  "Hebun draws no cause, success or judgement from these counts.",
] as const);

/** A sortable instant for one line; publications sort newest first, then by provider id. */
interface Line {
  readonly at: string;
  readonly id: string;
  readonly text: string;
  /** The instant the printed counts describe, when there are counts. */
  readonly observedAt: string | null;
}

const byNewest = (a: Line, b: Line): number => (a.at === b.at ? a.id.localeCompare(b.id) : b.at.localeCompare(a.at));

/** One provider's group: a heading, its publications newest first, and whether its counts share one instant. */
function group(heading: string, lines: Line[], extra: readonly string[]): string[] {
  if (lines.length === 0 && extra.length === 0) return [];
  const out = [heading, ...[...lines].sort(byNewest).map((l) => l.text), ...extra];
  const instants = new Set(lines.map((l) => l.observedAt).filter((x): x is string => x !== null));
  if (instants.size > 1) {
    out.push(`These ${heading} counts were read at ${instants.size} different instants; each describes its own moment.`);
  }
  return out;
}

export function renderPerformance(read: Extract<PerformanceRead, { status: "read" }>): {
  readonly lines: readonly string[];
  readonly hasPublications: boolean;
} {
  const igLines: Line[] = [];
  const ytLines: Line[] = [];
  const unknownLedger: string[] = [];
  const unmeasurableYouTube: string[] = [];
  let instagram = false;
  let youtube = false;

  for (const c of read.checked) {
    const m = read.measurements.get(c.ref);
    if (!m || m.status === "unknown") {
      unknownLedger.push(revisionLabel(c));
      continue;
    }
    for (const ig of m.instagram) {
      instagram = true;
      igLines.push({
        at: ig.publication.publishedAt,
        id: ig.publication.providerResultId,
        text: instagramLine(c, ig, read.readAt),
        observedAt: ig.status === "observed" ? ig.latestObservedAt : null,
      });
    }
    for (const yt of m.youtube) {
      youtube = true;
      ytLines.push({
        at: yt.publication.publishedAt,
        id: yt.publication.providerResultId,
        text: youtubeLine(c, yt, read.readAt),
        observedAt: yt.status === "measured" ? yt.latestObservedAt : null,
      });
    }
    if (m.youtubeAcceptedCount > m.youtube.length) {
      youtube = true;
      unmeasurableYouTube.push(`${revisionLabel(c)}: ${m.youtubeAcceptedCount - m.youtube.length}`);
    }
  }

  const out: string[] = [];
  if (read.organization.status === "unavailable") {
    out.push("Hebun could not read this organization's name. The records below are those of this session's active organization.");
  }
  const listed = igLines.length + ytLines.length;
  out.push(...group("Instagram", igLines, []));
  out.push(
    ...group(
      "YouTube",
      ytLines,
      unmeasurableYouTube.map((entry) => `Accepted YouTube publication(s) that name no video and channel Hebun can match, so no measurement is shown — ${entry}.`),
    ),
  );

  if (listed === 0 && unmeasurableYouTube.length === 0) {
    /*
     * An absence is stated only for what was actually inspected. A bound, an unread revision history
     * or an unread ledger leaves part of the scope unseen, and "none recorded" would then be a claim
     * about records Hebun did not read.
     */
    const complete = !read.truncated && unknownLedger.length === 0 && read.historyUnreadable.length === 0;
    const inspected = read.checked.length - unknownLedger.length;
    out.push(
      complete
        ? "No accepted Instagram or YouTube publication is recorded for this organization's content drafts."
        : inspected > 0
          ? `No accepted Instagram or YouTube publication was found among the ${inspected} content revision(s) Hebun could read and check. This is not a statement about the rest.`
          : "Hebun could not read and check any content revision, so nothing is said about publications.",
    );
  }
  if (unknownLedger.length > 0) {
    out.push(`The publication record could not be read for ${unknownLedger.length} revision(s), so nothing is said about them: ${unknownLedger.join("; ")}.`);
  }
  if (read.historyUnreadable.length > 0) {
    out.push(`The revision history could not be read for ${read.historyUnreadable.length} content draft(s), so their publications are not shown: ${read.historyUnreadable.map((t) => `“${t}”`).join("; ")}.`);
  }
  if (read.truncated) {
    out.push(
      `Only the newest ${read.checked.length} content revisions were checked (the measurement read's limit). ` +
        "Older revisions were not checked, so this may not list every publication.",
    );
  }
  if (instagram) out.push(PUBLICATION_MEASUREMENT_NON_CLAIM);
  if (youtube) out.push(YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM);
  if (instagram || youtube) out.push(...PERFORMANCE_LIMITATIONS);
  return { lines: out, hasPublications: instagram || youtube };
}
