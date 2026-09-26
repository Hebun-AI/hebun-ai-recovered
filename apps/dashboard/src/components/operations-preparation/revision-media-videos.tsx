"use client";

import { useEffect, useState, useTransition } from "react";
import { listRevisionMediaVideosAction, readMediaVideoAction } from "@/app/(dashboard)/operations/actions";
import { Button } from "@/components/ui/button";
import type { MediaVideoRecord } from "@/features/media-assets/read-media-videos.server";

/*
 * MV-3 — the admitted SUPPLIED videos of one draft revision, and nothing more. Kind comes from the
 * row (`media_kind`), never from a MIME type or file name. Playing one asks the server for a verified,
 * short-lived signed read; the browser's `<video>` element then fetches it with single Range requests.
 * Not a gallery, not an editor: no poster, no thumbnail, no review, no selection.
 */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function VideoRow({ video }: { readonly video: MediaVideoRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const retired = video.lifecycle !== "admitted";
  return (
    <li className="min-w-0 space-y-2 rounded-lg border border-border-subtle p-3">
      <p className="text-xs text-fg-secondary">
        Supplied video · {video.width}×{video.height} · {seconds(video.durationMs)} · {video.videoCodec}
        {video.audioCodec ? ` + ${video.audioCodec}` : " · no audio"} · {video.frameRate} fps ·{" "}
        {(video.byteSize / (1024 * 1024)).toFixed(1)} MiB{retired ? " · retired" : ""}
      </p>
      {url ? (
        <video className="w-full max-w-md rounded" controls preload="metadata" src={url} />
      ) : (
        <Button
          size="sm"
          disabled={pending || retired}
          onClick={() =>
            start(async () => {
              setNote(null);
              const r = await readMediaVideoAction({ assetId: video.assetId });
              if (r.status === "read") setUrl(r.access.url);
              else setNote("This video could not be opened: its stored bytes were not verified.");
            })
          }
        >
          {pending ? "Verifying…" : "Play"}
        </Button>
      )}
      {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
    </li>
  );
}

export function RevisionMediaVideos({ artifactId, revisionNo }: { readonly artifactId: string; readonly revisionNo: number }) {
  const [videos, setVideos] = useState<readonly MediaVideoRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    listRevisionMediaVideosAction({ artifactId, revisionNo }).then((r) => {
      if (!live) return;
      if (r.status === "read") setVideos(r.videos);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [artifactId, revisionNo]);
  if (failed) return <p className="text-xs text-fg-muted">Supplied videos could not be read.</p>;
  if (!videos || videos.length === 0) return null;
  return (
    <ul className="min-w-0 space-y-2" aria-label="Supplied videos">
      {videos.map((v) => (
        <VideoRow key={v.assetId} video={v} />
      ))}
    </ul>
  );
}
