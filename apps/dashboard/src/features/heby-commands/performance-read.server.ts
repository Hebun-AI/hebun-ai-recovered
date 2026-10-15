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
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { CONTENT_PUBLICATION_REVISIONS_LIMIT } from "@/features/action-authorization/content-publication-state.server";
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
}

/** One checked revision. */
export interface CheckedRevision {
  readonly ref: string;
  readonly artifactId: string;
  readonly title: string;
  readonly revisionNo: number;
  readonly current: boolean;
}

export type PerformanceRead =
  | { readonly status: "unavailable"; readonly reason: "drafts-unreadable" }
  | {
      readonly status: "read";
      readonly checked: readonly CheckedRevision[];
      /** More revisions exist than the bound allowed to be checked. */
      readonly truncated: boolean;
      /** Titles of content drafts whose revision history could not be read. */
      readonly historyUnreadable: readonly string[];
      readonly measurements: ReadonlyMap<string, RevisionPublicationMeasurements>;
    };

export async function readPerformance(tenant: TenantContext, deps: PerformanceReadDeps = {}): Promise<PerformanceRead> {
  if (typeof window !== "undefined") throw new Error("Performance reads are server-only.");
  const listing = await (deps.listArtifacts ?? listWorkArtifacts)(tenant);
  if (listing.status !== "read") return { status: "unavailable", reason: "drafts-unreadable" };

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
  return { status: "read", checked, truncated, historyUnreadable, measurements };
}

/* ── Rendering. Pure: every sentence below is a function of the read above. ── */

const instant = (iso: string): string => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const count = (value: number | null): string => (value === null ? "not reported" : String(value));

function revisionLabel(c: CheckedRevision): string {
  return `“${c.title}” revision ${c.revisionNo}${c.current ? " (current)" : " (superseded)"}`;
}

function instagramLine(c: CheckedRevision, m: PublicationMeasurement): string {
  const head = `Instagram media ${m.publication.providerResultId} · ${revisionLabel(c)} · published ${instant(m.publication.publishedAt)}`;
  switch (m.status) {
    case "observed":
      return (
        `${head} — likes ${count(m.latestLikeCount)} · comments ${count(m.latestCommentCount)} · ` +
        `as of ${instant(m.latestObservedAt)} (stored media observation; first listed ${instant(m.earliestObservedAt)}).`
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

function youtubeLine(c: CheckedRevision, m: YouTubePublicationMeasurement): string {
  return `YouTube video measurement · ${revisionLabel(c)} · published ${instant(m.publication.publishedAt)} — ${describeYouTubePublicationMeasurement(m)}`;
}

/** A sortable instant for one line; publications sort newest first, then by provider id. */
interface Line {
  readonly at: string;
  readonly id: string;
  readonly text: string;
}

export function renderPerformance(read: Extract<PerformanceRead, { status: "read" }>): {
  readonly lines: readonly string[];
  readonly hasPublications: boolean;
} {
  const lines: Line[] = [];
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
      lines.push({ at: ig.publication.publishedAt, id: ig.publication.providerResultId, text: instagramLine(c, ig) });
    }
    for (const yt of m.youtube) {
      youtube = true;
      lines.push({ at: yt.publication.publishedAt, id: yt.publication.providerResultId, text: youtubeLine(c, yt) });
    }
    if (m.youtubeAcceptedCount > m.youtube.length) {
      youtube = true;
      unmeasurableYouTube.push(`${revisionLabel(c)}: ${m.youtubeAcceptedCount - m.youtube.length}`);
    }
  }

  lines.sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : b.at.localeCompare(a.at)));
  const out = lines.map((l) => l.text);

  if (out.length === 0 && unmeasurableYouTube.length === 0) {
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
  for (const entry of unmeasurableYouTube) {
    out.push(`Accepted YouTube publication(s) that name no video and channel Hebun can match, so no measurement is shown — ${entry}.`);
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
  return { lines: out, hasPublications: instagram || youtube };
}
