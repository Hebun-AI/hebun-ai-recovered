"use client";

import { useState, useTransition } from "react";
import { readYouTubeUploadAction } from "@/app/(dashboard)/approvals/actions";
import type { YouTubeUploadReadResult } from "@/features/youtube-publishing/read-youtube-upload.server";

/**
 * YOUTUBE-WRITE-2 — one explicit read of what YouTube now says about an accepted upload.
 *
 * The attempt line above says a video RESOURCE exists. This says what YouTube reports about it right
 * now — processing, the privacy it applied, and whether it sits on the authorized channel — and says
 * it as YouTube's answer at a moment, not as a stored state. Nothing is written by asking.
 */
export function YouTubeUploadStatus({ permitId }: { readonly permitId: string }) {
  const [result, setResult] = useState<YouTubeUploadReadResult | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = (r: YouTubeUploadReadResult): string[] => {
    switch (r.status) {
      case "read":
        return [
          `YouTube video ${r.videoId}`,
          `Upload status: ${r.uploadStatus ?? "not reported"}`,
          `Processing: ${r.processingStatus ?? "not reported"}`,
          `Privacy YouTube applied: ${r.privacyStatus ?? "not reported"} (authorized: ${r.authorizedPrivacy})`,
          `On the authorized channel: ${r.onAuthorizedChannel === null ? "not reported" : r.onAuthorizedChannel ? "yes" : "NO"}`,
          ...(r.failureReason ? [`Failure reason: ${r.failureReason}`] : []),
          ...(r.rejectionReason ? [`Rejection reason: ${r.rejectionReason}`] : []),
        ];
      case "not-found-at-youtube":
        return [`YouTube does not return video ${r.videoId} to this connection now.`];
      case "no-video":
        return ["No accepted YouTube upload is recorded for this authorization."];
      default:
        return [`YouTube could not be read (${r.reason}). Nothing was changed.`];
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await readYouTubeUploadAction({ permitId })))}
        className="self-start rounded-md border border-border px-2 py-1 text-xs text-fg-secondary hover:bg-surface disabled:opacity-60"
      >
        {pending ? "Reading YouTube…" : "Read YouTube status"}
      </button>
      {result ? (
        <ul className="text-[0.65rem] leading-5 text-fg-muted">
          {lines(result).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
