"use client";

/*
 * YOUTUBE-WRITE-1 — show which YouTube channel(s) this Google grant stands for, on an explicit click.
 *
 * One read, one button. Nothing happens on render, on mount or on a timer, and nothing here selects,
 * saves or binds a channel: zero, one and several channels are shown exactly as YouTube returned
 * them. No upload or publish control exists.
 */
import { useState, useTransition } from "react";
import { readYouTubeChannelIdentityAction } from "./actions";

type Result = Awaited<ReturnType<typeof readYouTubeChannelIdentityAction>>;

function Channel({ channelId, title }: { channelId: string; title: string }) {
  return (
    <li className="text-xs">
      <span className="font-medium">{title || "(untitled)"}</span> <span className="font-mono">{channelId}</span>
    </li>
  );
}

export function YouTubeChannelIdentity() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await readYouTubeChannelIdentityAction()))}
        className="underline underline-offset-4 disabled:opacity-50"
      >
        {pending ? "Reading…" : "Read YouTube channel identity"}
      </button>
      {result?.status === "no-channel" ? <p className="text-xs">YouTube returned no channel for this Google grant.</p> : null}
      {result?.status === "one-channel" ? (
        <div className="text-xs">
          <p>YouTube returned exactly one channel:</p>
          <ul>
            <Channel channelId={result.channel.channelId} title={result.channel.title} />
          </ul>
        </div>
      ) : null}
      {result?.status === "multiple-channels" ? (
        <div className="text-xs">
          <p>
            YouTube returned {result.channels.length} channels{result.truncated ? " (more exist beyond this page)" : ""}. None is
            chosen.
          </p>
          <ul>
            {result.channels.map((c) => (
              <Channel key={c.channelId} channelId={c.channelId} title={c.title} />
            ))}
          </ul>
        </div>
      ) : null}
      {result?.status === "refused" ? <p className="text-xs">Not read: {result.detail}</p> : null}
      {result?.status === "provider-failed" ? <p className="text-xs">YouTube could not be read ({result.reason}).</p> : null}
    </div>
  );
}
