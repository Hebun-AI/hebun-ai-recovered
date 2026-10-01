"use client";

import { useState, useTransition } from "react";
import { recordYouTubeMeasurementAction } from "@/app/(dashboard)/approvals/actions";
import type {
  RecordYouTubeMeasurementResult,
  YouTubeMeasurementNotRecordedReason,
} from "@/features/youtube-recorded-measurement/record-youtube-publication-measurement.server";

/**
 * YOUTUBE-RECORDED-MEASUREMENT-1 — one explicit act: read YouTube again, now, and STORE what it
 * reported as one observation.
 *
 * It is deliberately a separate control from "Read YouTube status", which stores nothing and still
 * says so. This one performs its own fresh read — it never stores a value shown on screen — and
 * sends only which authorization it is about. Each click that succeeds is a new stored observation,
 * even when the numbers are the same. No rate, score or judgement.
 */
const utc = (iso: string): string => `${iso.slice(0, 19).replace("T", " ")} UTC`;
const count = (value: number | null): string => (value === null ? "not reported" : String(value));

const NOT_RECORDED: Readonly<Record<YouTubeMeasurementNotRecordedReason, string>> = {
  unauthenticated: "No organization is resolved for this request.",
  "ledger-unreadable": "Hebun could not read its own publication record just now.",
  "no-such-upload": "No YouTube upload is recorded for this authorization.",
  "not-accepted": "No accepted YouTube upload is recorded for this authorization.",
  "identity-incomplete": "The recorded upload does not name a usable channel and connection.",
  "capability-not-available": "The YouTube measurement read is not available for this organization right now.",
  "connection-not-available": "The connection that uploaded this video cannot be read right now.",
  "youtube-unreadable": "YouTube could not be read.",
  "not-found-at-youtube": "YouTube does not return this video to this connection now.",
  "channel-not-reported": "YouTube did not report which channel this video is on.",
  "channel-mismatch": "YouTube reports this video on a different channel than the authorized one.",
  "write-failed": "YouTube was read, but Hebun could not store the observation.",
};

export function YouTubeMeasurementRecord({ permitId }: { readonly permitId: string }) {
  const [result, setResult] = useState<RecordYouTubeMeasurementResult | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = (r: RecordYouTubeMeasurementResult): string[] =>
    r.status === "recorded"
      ? [
          `Stored one measurement observation for YouTube video ${r.videoId}.`,
          `Published at (YouTube): ${r.publishedAt ?? "not reported"}`,
          `Views: ${count(r.viewCount)}`,
          `Likes: ${count(r.likeCount)}`,
          `Comments: ${count(r.commentCount)}`,
          `As of: ${utc(r.observedAt)} — what YouTube reported to this read. One observation, not a trend.`,
        ]
      : [`${NOT_RECORDED[r.reason]} Nothing was stored.`];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await recordYouTubeMeasurementAction({ permitId })))}
        className="self-start rounded-md border border-border px-2 py-1 text-xs text-fg-secondary hover:bg-surface disabled:opacity-60"
      >
        {pending ? "Reading and recording…" : "Record YouTube measurement"}
      </button>
      <p className="text-[0.65rem] text-fg-muted">
        Reads YouTube again now and stores one measurement observation. “Read YouTube status” stores nothing.
      </p>
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
