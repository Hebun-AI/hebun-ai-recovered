/*
 * heby-commands/provider-observation-commands.server.ts — the server execution of
 * PROVIDER-OBSERVATION slash commands (CGO-5).
 *
 * ── A THIRD ROOT, FOR A THIRD KIND OF REACH ─────────────────────────────────
 *
 * `read-commands.server.ts` reaches no provider. `provider-read-commands.server.ts` reaches GitHub
 * with a token Hebun mints from its own App and is PROVED never to touch a stored secret. This
 * module reaches YouTube with a key the tenant stored — so it is the one root from which a
 * credential accessor may be reachable, and its firewall says exactly that: `withDecryptedSecret`
 * and `listCredentialMetadata` yes, every writer no.
 *
 * ── WHAT IT MAY DO, EXACTLY ──────────────────────────────────────────────────
 *
 * Observe ONE public channel, three list calls, one page, after the capability authority has said
 * this organization's YouTube connection is available. That is the whole of it.
 *
 * ── WHAT IT STRUCTURALLY CANNOT DO ───────────────────────────────────────────
 *
 * No model client, no Knowledge module, no connection lifecycle writer, no credential writer, no
 * action authorization, no execution surface, no persistence of its own. A firewall walks the
 * real import graph and proves each.
 *
 * ── EVERY LINE IS AN OBSERVATION ────────────────────────────────────────────
 *
 * A count is what YouTube reported at that moment. The lines never say "performed", "well",
 * "better", "should" or "sells" — those are judgements this module has no evidence for and no
 * field to carry. Stored nowhere; asking again re-reads it.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  MAX_RECENT_VIDEOS,
  OBSERVATION_QUOTA_UNITS,
  YOUTUBE_PROVIDER_LABEL,
  type YouTubeChannelObservation,
  type YouTubeChannelView,
  type YouTubeVideoView,
} from "@/features/provider-youtube/contracts";
import {
  readPublicChannelObservation,
  type ReadChannelObservationDeps,
  type ReadChannelObservationOutcome,
} from "@/features/provider-youtube/read-channel-observation.server";
import { findHebyCommandById } from "./registry";
import type { HebyCommandResult } from "./contracts";

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider-observation commands are server-only.");
  }
}

export const YOUTUBE_OBSERVATION_BUDGET = Object.freeze({
  maxProviders: 1,
  maxProviderCalls: OBSERVATION_QUOTA_UNITS,
  maxPages: 1,
  maxRecords: MAX_RECENT_VIDEOS,
  providerTimeoutMs: 10_000,
  totalTimeoutMs: 30_000,
} as const);

export interface HebyProviderObservationCommandInput {
  readonly commandId: string;
  readonly args: readonly string[];
}

export interface HebyProviderObservationCommandDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  /** Injectable so the executor is provable with no key, no network and no database. */
  readonly observe?: (
    tenant: TenantContext | null,
    handle: string,
    deps: ReadChannelObservationDeps,
  ) => Promise<ReadChannelObservationOutcome>;
  readonly totalTimeoutMs?: number;
}

export type HebyProviderObservationCommandResult =
  | { readonly status: "unauthorized" }
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "ok"; readonly result: HebyCommandResult };

export const YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE =
  "Observed live from YouTube just now, through the API key your organization holds, scoped to your " +
  "tenant (authoritative: false). Provider-derived observation, not organizational truth: nothing " +
  "was stored, indexed or admitted anywhere, and asking again re-observes it. Every count is what " +
  "YouTube reported at that moment about a PUBLIC channel — it says nothing about who owns the " +
  "channel, nothing about whether anything performed well, and nothing about what to make next.";

export function youtubeChannelRecordRef(channelId: string): string {
  return `youtube/channel/${channelId}`;
}

export function youtubeVideoRecordRef(videoId: string): string {
  return `youtube/video/${videoId}`;
}

/* ── Vocabulary: one sentence per fact YouTube can refuse to give ── */

export const OBSERVATION_REFUSAL_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "invalid-handle": [
    "That is not a YouTube handle Hebun will send. A handle is 3–30 letters, digits, dots, underscores or dashes, with or without the leading @.",
  ],
  "no-authorized-tenant-context": [
    "No organization is resolved for this request, so no connection could be consulted.",
  ],
  "connection-authority-unavailable": [
    "Hebun could not read your organization's connections, so it did not go on to contact YouTube.",
    "This says nothing about the state of your YouTube connection.",
  ],
  "capability-not-available": [
    "Observing YouTube is not available for your organization right now.",
    "That is one of three situations: no YouTube API key is connected, the connection has not been verified, or its last verification found it unusable.",
    "The Integrations workspace shows which applies. No key was used and nothing was read.",
  ],
  "no-youtube-connection": [
    "No YouTube connection was found for your organization, so there was nothing to observe with.",
  ],
});

export const OBSERVATION_FAILURE_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  auth: [
    "YouTube rejected the API key your organization holds, so nothing was observed.",
    "The key may have been revoked, restricted away from the YouTube Data API, or replaced. The Integrations workspace is where a key is replaced; this command changed nothing.",
  ],
  disabled: [
    "YouTube accepted the key but reports the YouTube Data API v3 is not enabled on the Google Cloud project that owns it.",
    "That is an operator configuration gap on the project, not a problem with the key. Nothing was observed.",
  ],
  quota: [
    "YouTube reports the daily quota for this key's project is exhausted or rate-limited, so nothing was observed.",
    "The key and the API are fine. Quota resets on YouTube's schedule; nothing was retried.",
  ],
  "not-found": [
    "YouTube answered and reports no public channel with that handle.",
    "That is YouTube's answer, not a failed read: the key works and the request reached YouTube.",
  ],
  transport: [
    "YouTube did not answer: a server error, a timeout, or a network fault.",
    "NOTHING IS KNOWN about the channel or the key from this. Nothing was retried, nothing was stored, and your connection was left untouched.",
  ],
  malformed: [
    "YouTube answered in a shape Hebun does not understand, so nothing was reported from it.",
    "Hebun would rather show you nothing than guess what a response meant.",
  ],
});

function ok(command: string, title: string, lines: readonly string[]): HebyProviderObservationCommandResult {
  return {
    status: "ok",
    result: { command, title, lines, tone: "info", provenance: YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE },
  };
}

function unavailable(
  command: string,
  title: string,
  lines: readonly string[],
): HebyProviderObservationCommandResult {
  return {
    status: "ok",
    result: {
      command,
      title,
      lines,
      tone: "unavailable",
      provenance: "No observation was produced. Nothing was stored and your connection was left untouched.",
    },
  };
}

function n(value: number | null, withheld = "not reported by YouTube"): string {
  return value === null ? withheld : value.toLocaleString("en-US");
}

function channelLines(channel: YouTubeChannelView): readonly string[] {
  return [
    `Channel: ${channel.title}${channel.handle ? ` (${channel.handle})` : ""} — id ${channel.channelId}`,
    `Created: ${channel.publishedAt ?? "not reported by YouTube"}`,
    `Public views: ${n(channel.viewCount)} · videos: ${n(channel.videoCount)} · subscribers: ${
      channel.hiddenSubscriberCount ? "hidden by the channel" : n(channel.subscriberCount)
    }`,
  ];
}

function videoLine(video: YouTubeVideoView): string {
  return (
    `• ${video.title} — published ${video.publishedAt ?? "date not reported"} · views ${n(video.viewCount)}` +
    ` · likes ${n(video.likeCount, "withheld or not reported")} · comments ${n(video.commentCount, "withheld or not reported")}` +
    ` [${youtubeVideoRecordRef(video.videoId)}]`
  );
}

function observationLines(observation: YouTubeChannelObservation): readonly string[] {
  const lines = [...channelLines(observation.channel), ""];
  if (observation.recentVideos.length === 0) {
    lines.push("Recent uploads: YouTube reported no public uploads for this channel.");
  } else {
    lines.push(`Recent uploads (newest first, at most ${MAX_RECENT_VIDEOS}):`);
    lines.push(...observation.recentVideos.map(videoLine));
    if (observation.moreVideosExist) {
      lines.push(
        `PARTIAL, NOT COMPLETE: the channel has more uploads than shown here. This command reads one page and never asks for a second.`,
      );
    }
  }
  lines.push("");
  lines.push(
    `Observed at ${observation.observedAt} · ${observation.quotaUnitsSpent} quota unit${observation.quotaUnitsSpent === 1 ? "" : "s"} spent.`,
    "These are public numbers as YouTube reported them at that moment. They are not a judgement of " +
      "how anything performed, not a recommendation, and not a claim that this organization owns, " +
      "runs or is connected to the channel. Nothing was stored.",
  );
  return lines;
}

interface Timed<T> {
  readonly timedOut: boolean;
  readonly value: T | undefined;
}

async function withinTotalBudget<T>(work: Promise<T>, ms: number): Promise<Timed<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Timed<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true, value: undefined }), ms);
  });
  try {
    return await Promise.race([work.then((value) => ({ timedOut: false, value })), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runHebyProviderObservationCommand(
  input: HebyProviderObservationCommandInput,
  deps: HebyProviderObservationCommandDeps,
): Promise<HebyProviderObservationCommandResult> {
  assertServerRuntime();
  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "unauthorized" };

  const command = findHebyCommandById(input.commandId);
  if (!command) return { status: "rejected", reason: "unknown-command" };
  if (command.kind !== "provider-observation") {
    return { status: "rejected", reason: "not-a-provider-observation-command" };
  }
  if (command.availability !== "available") return { status: "rejected", reason: "not-available" };
  if (command.handler !== "youtube-channel") {
    return { status: "rejected", reason: "no-provider-observation-handler" };
  }

  const slash = command.slash;
  const handle = input.args[0] ?? "";
  const observe = deps.observe ?? readPublicChannelObservation;
  const totalTimeoutMs = deps.totalTimeoutMs ?? YOUTUBE_OBSERVATION_BUDGET.totalTimeoutMs;

  const timed = await withinTotalBudget(
    observe(tenant, handle, { timeoutMs: YOUTUBE_OBSERVATION_BUDGET.providerTimeoutMs }),
    totalTimeoutMs,
  );
  if (timed.timedOut || timed.value === undefined) {
    return unavailable(slash, `${YOUTUBE_PROVIDER_LABEL} did not answer in time`, [
      `The whole command is bounded at ${totalTimeoutMs} ms and YouTube had not answered, so Hebun stopped waiting.`,
      "NOTHING IS KNOWN about the channel from this.",
    ]);
  }

  const outcome = timed.value;
  if (!outcome.ok) {
    if ("refusal" in outcome) {
      return unavailable(
        slash,
        "The channel was not observed",
        OBSERVATION_REFUSAL_LINES[outcome.refusal] ?? [
          "This organization cannot currently observe YouTube, and no read was attempted.",
        ],
      );
    }
    return unavailable(
      slash,
      `${YOUTUBE_PROVIDER_LABEL} did not produce an observation`,
      OBSERVATION_FAILURE_LINES[outcome.failure] ?? [
        "YouTube did not return a channel, and Hebun will not present that as an empty channel.",
      ],
    );
  }

  return ok(
    slash,
    `${YOUTUBE_PROVIDER_LABEL} — public observation of ${outcome.value.channel.handle ?? outcome.value.channel.title}`,
    observationLines(outcome.value),
  );
}
