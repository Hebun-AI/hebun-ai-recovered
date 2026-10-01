"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Play } from "lucide-react";
import { readMediaAssetAction, readMediaVideoAction } from "@/app/(dashboard)/operations/actions";
import type { SelectedMediaView } from "@/features/content-composition/contracts";
import type { DashboardContent } from "@/features/approvals-dashboard/read-dashboard.server";
import { PUBLICATION_STAGE_WORDING } from "@/features/action-authorization/content-publication-state";
import { describeYouTubePublicationMeasurement, PUBLICATION_MEASUREMENT_WORDING } from "@/features/content-publication-measurement/contracts";

export function AssetPreview({ asset }: { asset: SelectedMediaView }) {
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return <div className="space-y-2 rounded-lg border border-border bg-surface-sunken p-3">
    {url ? asset.mediaKind === "video" ? <video controls preload="metadata" src={url} className="max-h-64 w-full rounded-lg" onError={() => { setUrl(null); setNote("Preview expired or unavailable. Open again to verify access."); }} /> :
      // eslint-disable-next-line @next/next/no-img-element -- verified short-lived private grant; never proxy or cache.
      <img src={url} alt="Selected content asset" className="max-h-64 w-full rounded-lg object-contain" onError={() => { setUrl(null); setNote("Preview expired or unavailable. Open again to verify access."); }} /> :
      <div className="flex min-h-24 items-center justify-center text-fg-muted">{asset.mediaKind === "video" ? <Play aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}</div>}
    <button type="button" disabled={pending} className="rounded-md border border-border bg-surface px-3 py-2 text-xs disabled:opacity-50" onClick={() => start(async () => {
      setNote(null);
      try {
        const result = await (asset.mediaKind === "video" ? readMediaVideoAction : readMediaAssetAction)({ assetId: asset.mediaAssetId });
        if (result.status === "read") { setUrl(result.access.url); setNote("Verified private preview · expires shortly."); }
        else { setUrl(null); setNote(`Preview unavailable (${result.status}).`); }
      } catch { setNote("Preview could not be opened. Try again."); }
    })}>{pending ? "Verifying…" : "Open verified preview"}</button>
    <p className="text-xs text-fg-muted">{asset.mediaKind} · {asset.width} × {asset.height} · {asset.origin} · {asset.lifecycle}</p>
    {note && <p role="status" className="text-xs text-fg-muted">{note}</p>}
  </div>;
}
export function StoredMeasurements({ content }: { content: DashboardContent }) {
  const measurement = content.measurement;
  if (!measurement || measurement.status !== "read") return <p className="text-sm text-fg-muted">Stored measurements unavailable.</p>;
  return <div className="space-y-3">
    <p className="text-xs text-fg-muted">Latest stored observations, as of the time shown. These are not live or continuous measurements.</p>
    {measurement.youtube.map((m) => <div key={m.publication.attemptId} className="rounded-lg border border-border p-3">
      <p className="text-sm">{describeYouTubePublicationMeasurement(m)}</p>
      {m.status === "measured" && <dl className="mt-3 grid grid-cols-3 gap-2">{[["Views", m.viewCount], ["Likes", m.likeCount], ["Comments", m.commentCount]].map(([label, value]) => <div key={label}><dt className="text-xs text-fg-muted">{label}</dt><dd className="text-lg font-semibold">{value ?? "Not reported"}</dd></div>)}</dl>}
    </div>)}
    {measurement.instagram.map((m) => <div key={m.publication.attemptId} className="rounded-lg border border-border p-3 text-sm">
      <p>Instagram · {m.publication.providerResultId}</p>
      <p>{m.status === "observed" ? `Likes ${m.latestLikeCount ?? "not reported"} · comments ${m.latestCommentCount ?? "not reported"} · as of ${m.latestObservedAt}` : PUBLICATION_MEASUREMENT_WORDING[m.status]}</p>
    </div>)}
    {!measurement.youtube.length && !measurement.instagram.length && <p className="text-sm text-fg-muted">No accepted publication with a stored measurement to show for this revision.</p>}
    <p className="text-xs text-fg-muted">No stored editorial analysis is connected to this item.</p>
  </div>;
}
export function ContentDetails({ content, tab }: { content: DashboardContent; tab: string }) {
  const pkg = content.package.status === "read" ? content.package.package : null;
  const publication = content.publication;
  if (tab === "Analysis") return <StoredMeasurements content={content} />;
  if (tab === "Channel Preview") return <div className="space-y-3">
    <p className="text-xs text-fg-muted">Prepared content for {content.artifact.intendedDestination ?? "an unspecified channel"}. This is not a live provider page.</p>
    {pkg?.selected.length ? pkg.selected.map((asset) => <AssetPreview key={asset.mediaAssetId} asset={asset} />) : <p className="text-sm text-fg-muted">{content.package.status === "unavailable" ? "Media selection unavailable." : "No selected preview asset."}</p>}
    <p className="whitespace-pre-wrap break-words text-sm">{content.revision?.content ?? "Revision content unavailable."}</p>
  </div>;
  if (tab === "History") return <div className="space-y-3 text-sm">
    <p>Created {content.artifact.createdAt}</p>
    <p>Current revision {content.artifact.currentRevision} · {content.revision?.createdAt ?? "date unavailable"}</p>
    {content.review ? <p>{content.review.decisionCount} recorded review decisions · latest: {content.review.decision ?? "unreviewed"}{content.review.decidedAt ? ` · ${content.review.decidedAt}` : ""}</p> : <p>Review history unavailable.</p>}
    <p className="text-xs text-fg-muted">Only the latest review is projected here; this is not a complete decision timeline.</p>
    {publication?.status === "recorded" ? <><ol className="space-y-3">{publication.entries.map((entry) => <li key={entry.requestId} className="rounded-lg border border-border p-3">
      <p>{PUBLICATION_STAGE_WORDING[entry.stage]}</p><p className="text-xs text-fg-muted">{entry.proposedAt} · {entry.destination}</p>
      <p className="mt-1 break-all text-xs">Request {entry.requestId}</p>
      {entry.destinationAccountId && <p className="break-all text-xs">Account / channel {entry.destinationAccountId}</p>}
      {entry.attempt?.providerResultId && <p className="break-all text-xs">Provider identity {entry.attempt.providerResultId}</p>}
      {entry.attempt?.completedAt && <p className="text-xs">Attempt completed {entry.attempt.completedAt}</p>}
      {entry.permit && <p className="text-xs">Permit {entry.permit.state} · expires {entry.permit.expiresAt}</p>}
    </li>)}</ol>{publication.truncated && <p>Older publication requests are outside this history window.</p>}</> : <p>{publication?.status === "no-request-recorded" ? "No publication request recorded for this revision." : "Publication history unavailable."}</p>}
  </div>;
  return <div className="space-y-4 text-sm">
    <dl className="grid grid-cols-2 gap-4">
      <div><dt className="text-xs text-fg-muted">Content</dt><dd>{content.artifact.artifactType} · revision {content.artifact.currentRevision}</dd></div>
      <div><dt className="text-xs text-fg-muted">Visibility</dt><dd>Not recorded on the content artifact</dd></div>
      <div><dt className="text-xs text-fg-muted">Governance review</dt><dd>{content.review ? content.review.decision ?? "Unreviewed" : "Unavailable"}</dd></div>
      <div><dt className="text-xs text-fg-muted">Content package</dt><dd>{pkg ? pkg.ready ? "Ready" : "Not ready" : content.package.status === "unavailable" ? "Unavailable" : "Not applicable"}</dd></div>
    </dl>
    {pkg && pkg.blockers.length > 0 && <p className="text-xs text-warning">{pkg.blockers.join(" · ")}</p>}
    <div><h3 className="mb-2 font-medium">Revision content</h3><p className="whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-3">{content.revision?.content ?? "Revision content unavailable."}</p></div>
    <p className="text-xs text-fg-muted">A content review accepts only these revision bytes for the next internal step. Publishing requires a separate request, Governance decision and permit.</p>
    <ContentDetails content={content} tab="History" />
  </div>;
}
