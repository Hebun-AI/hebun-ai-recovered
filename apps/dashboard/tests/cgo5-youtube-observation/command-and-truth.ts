/*
 * CGO-5 — THE COMMAND, ITS PLAN, AND WHAT HEBY MAY SAY. No key, no network, no database.
 *
 * The executor is driven with an injected `observe`, so every refusal class, every failure class,
 * the timeout, and the truthful rendering of withheld counts are proved without a provider. The
 * projection and INT-5A grounding are driven with injected availability views.
 */
import assert from "node:assert/strict";
import { parseHebyInput } from "../../src/features/heby-commands/parser";
import { planHebyCommand } from "../../src/features/heby-commands/dispatch";
import type { HebyCommandContext } from "../../src/features/heby-commands/dispatch";
import {
  OBSERVATION_FAILURE_LINES,
  OBSERVATION_REFUSAL_LINES,
  runHebyProviderObservationCommand,
  YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE,
  type HebyProviderObservationCommandResult,
} from "../../src/features/heby-commands/provider-observation-commands.server";
import { readCommandCapabilityView } from "../../src/features/heby-commands/command-capability-projection.server";
import { readIntegrationGroundingSource } from "../../src/features/integration-authority/heby-integration-source.server";
import type { CapabilityAvailabilityView } from "../../src/features/integration-authority/contracts";
import { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, type YouTubeChannelObservation } from "../../src/features/provider-youtube/contracts";
import type { ReadChannelObservationOutcome } from "../../src/features/provider-youtube/read-channel-observation.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT: TenantContext = asHumanTenantContext({
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  authIdentityId: "33333333-3333-4333-8333-333333333333",
  membershipId: "44444444-4444-4444-8444-444444444444",
  membershipVersion: 1,
  roleId: "55555555-5555-4555-8555-555555555555",
  sessionContextId: "66666666-6666-4666-8666-666666666666",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "req-cgo5",
  authenticatedAt: "2026-09-03T00:00:00.000Z",
});

const OBSERVATION: YouTubeChannelObservation = Object.freeze({
  channel: {
    channelId: "UC123",
    title: "Can Damlaları",
    handle: "@candamlalari",
    publishedAt: "2015-01-02T00:00:00Z",
    viewCount: 8420,
    subscriberCount: null,
    hiddenSubscriberCount: true,
    videoCount: 57,
  },
  recentVideos: [
    { videoId: "v1", title: "Washing day", publishedAt: "2026-09-01T00:00:00Z", viewCount: 120, likeCount: null, commentCount: 3 },
    { videoId: "v2", title: "Loom", publishedAt: null, viewCount: null, likeCount: 4, commentCount: null },
  ],
  moreVideosExist: true,
  observedAt: "2026-09-03T18:00:00.000Z",
  quotaUnitsSpent: 3,
});

async function run(
  outcome: ReadChannelObservationOutcome | (() => Promise<ReadChannelObservationOutcome>),
  options: { readonly commandId?: string; readonly args?: readonly string[]; readonly tenant?: TenantContext | null; readonly totalTimeoutMs?: number } = {},
): Promise<HebyProviderObservationCommandResult> {
  let seenHandle: string | undefined;
  const result = await runHebyProviderObservationCommand(
    { commandId: options.commandId ?? "youtube-channel", args: options.args ?? ["@Candamlalari"] },
    {
      resolveTenant: async () => (options.tenant === undefined ? TENANT : options.tenant),
      observe: async (_tenant, handle) => {
        seenHandle = handle;
        return typeof outcome === "function" ? outcome() : outcome;
      },
      totalTimeoutMs: options.totalTimeoutMs,
    },
  );
  if (result.status === "ok" && result.result.tone === "info") assert.equal(seenHandle, options.args?.[0] ?? "@Candamlalari");
  return result;
}
function text(result: HebyProviderObservationCommandResult): string {
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return [result.result.title, ...result.result.lines, result.result.provenance].join("\n");
}
function tone(result: HebyProviderObservationCommandResult): string {
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return result.result.tone;
}

const CONTEXT: HebyCommandContext = {
  surface: "full-workspace",
  contextLabel: "Platform",
  contextDetail: ["Platform workspace."],
  evidenceLines: [],
  returnLabel: "Back",
};

const JUDGEMENT = /\bperformed\b|\bperforming\b|\bwent well\b|\bbetter\b|\bshould\b|\brecommend|\bviral\b|\bsuccess/i;
const OWNERSHIP = /\byour channel\b|\bowned by\b|\bconnected channel\b|\bauthori[sz]ed\b/i;

async function main(): Promise<void> {
  /* ── 1. THE COMMAND PARSES AND PLANS AS A PROVIDER OBSERVATION ── */
  {
    const parsed = parseHebyInput("/youtube-channel @Candamlalari");
    assert.equal(parsed.kind, "command");
    if (parsed.kind !== "command") return;
    assert.equal(parsed.command.id, "youtube-channel");
    assert.deepEqual(parsed.args, ["@Candamlalari"]);
    const plan = planHebyCommand(parsed.command, parsed.args, CONTEXT);
    assert.equal(plan.kind, "provider-observation", "it plans as its own kind, not as a provider-read");
    if (plan.kind === "provider-observation") {
      assert.equal(plan.commandId, "youtube-channel");
      assert.deepEqual(plan.args, ["@Candamlalari"]);
      assert.ok(!("prompt" in plan), "no observation plan may carry a prompt");
    }
    const missing = parseHebyInput("/youtube-channel");
    assert.equal(missing.kind, "invalid-arguments", "the handle is required");
  }

  /* ── 2. THE HAPPY PATH SAYS WHAT WAS OBSERVED, AND NOTHING IT WAS NOT ── */
  {
    const result = await run({ ok: true, value: OBSERVATION });
    assert.equal(tone(result), "info");
    const t = text(result);
    assert.ok(t.includes("Can Damlaları") && t.includes("UC123"), "channel identity");
    assert.ok(t.includes("8,420"), "the observed view count");
    assert.ok(t.includes("hidden by the channel"), "a hidden subscriber count is said to be hidden, never 0");
    assert.ok(t.includes("Washing day") && t.includes("youtube/video/v1"), "a recent upload with its record ref");
    assert.ok(t.includes("withheld or not reported"), "a withheld like count is said to be withheld");
    assert.ok(t.includes("date not reported"), "a missing date is said to be missing");
    assert.ok(t.includes("PARTIAL, NOT COMPLETE"), "more uploads exist and the reader is told");
    assert.ok(t.includes("3 quota units spent"), "the cost is stated");
    assert.ok(t.includes("Nothing was stored"), "and so is the non-persistence");
    /* Judged with the executor's own denial removed, so the sentence that refuses a judgement
     * cannot be mistaken for one — the released word-ban lesson. */
    const body = result.status === "ok" ? [result.result.title, ...result.result.lines].join("\n") : "";
    const affirmative = body.replace(/They are not a judgement of how anything performed, not a recommendation, and not a claim that this organization owns, runs or is connected to the channel\./, "");
    assert.ok(body !== affirmative, "the denial is present in the rendered lines");
    assert.ok(/nothing about whether anything performed well/.test(YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE), "and the provenance denies a judgement too");
    assert.ok(!JUDGEMENT.test(affirmative), `no performance judgement: ${affirmative.match(JUDGEMENT)?.[0]}`);
    assert.ok(!OWNERSHIP.test(affirmative), `no ownership claim: ${affirmative.match(OWNERSHIP)?.[0]}`);
    assert.equal(result.status === "ok" ? result.result.provenance : "", YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE);
    assert.ok(/authoritative: false/.test(YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE));
    assert.ok(/nothing about who owns/.test(YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE));
    assert.ok(!/\b0\b/.test(t.replace(/comments 3/, "")) || t.includes("comments 3"), "no fabricated zero");
  }

  /* ── 3. EVERY REFUSAL AND FAILURE IS UNAVAILABLE, NEVER AN EMPTY CHANNEL ── */
  for (const refusal of Object.keys(OBSERVATION_REFUSAL_LINES)) {
    const result = await run({ ok: false, refusal } as ReadChannelObservationOutcome);
    assert.equal(tone(result), "unavailable", `${refusal} renders unavailable`);
    assert.ok(text(result).includes(OBSERVATION_REFUSAL_LINES[refusal]![0]!), `${refusal} uses its own sentence`);
    assert.ok(!text(result).includes("UC123"));
  }
  for (const failure of Object.keys(OBSERVATION_FAILURE_LINES)) {
    const result = await run({ ok: false, failure, reason: "x" } as ReadChannelObservationOutcome);
    assert.equal(tone(result), "unavailable", `${failure} renders unavailable`);
    assert.ok(text(result).includes(OBSERVATION_FAILURE_LINES[failure]![0]!));
  }
  {
    const notFound = await run({ ok: false, failure: "not-found", reason: "channel-not-found" });
    assert.ok(text(notFound).includes("the key works"), "not-found says the key worked and YouTube answered");
    const transport = await run({ ok: false, failure: "transport", reason: "youtube-unreachable" });
    assert.ok(text(transport).includes("NOTHING IS KNOWN"));
  }

  /* ── 4. THE BUDGET IS ONE CLOCK ── */
  {
    const slow = await run(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: OBSERVATION }), 80)), { totalTimeoutMs: 10 });
    assert.equal(tone(slow), "unavailable");
    assert.ok(text(slow).includes("did not answer in time"));
  }

  /* ── 5. THE GATES BEFORE ANY OBSERVATION ── */
  {
    let observed = 0;
    const deny = async () => { observed += 1; return { ok: true, value: OBSERVATION } as const; };
    assert.deepEqual(await run(deny, { tenant: null }), { status: "unauthorized" });
    assert.deepEqual(await run(deny, { commandId: "nope" }), { status: "rejected", reason: "unknown-command" });
    assert.deepEqual(await run(deny, { commandId: "repositories" }), { status: "rejected", reason: "not-a-provider-observation-command" });
    assert.equal(observed, 0, "no gate failure reaches the observation");
  }

  /* ── 6. THE CAPABILITY PROJECTION BINDS THE COMMAND TO THE YOUTUBE CAPABILITY ── */
  {
    const view = (state: string): CapabilityAvailabilityView =>
      ({ readiness: "catalog-ready", capabilities: [{ capability: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, state, reason: state === "available" ? null : "not connected", sources: [] }] }) as unknown as CapabilityAvailabilityView;
    const ops = { availability: "AVAILABLE", dispatch: "AVAILABLE", credential: "present", directorEnabled: true } as never;
    const available = await readCommandCapabilityView(TENANT, { readCapabilityAvailability: async () => view("available"), readProviderOps: async () => ops });
    const entry = available.entries.find((e) => e.commandId === "youtube-channel");
    assert.ok(entry, "the command is in the view");
    assert.equal(entry.governedBy, "provider-capability");
    assert.notEqual(entry.state, "unknown", "bound, not a rotted map");
    const missing = await readCommandCapabilityView(TENANT, { readCapabilityAvailability: async () => view("not-connected"), readProviderOps: async () => ops });
    const gated = missing.entries.find((e) => e.commandId === "youtube-channel")!;
    assert.notEqual(gated.state, "available", "not connected is not available");
  }

  /* ── 7. INT-5A GROUNDING NAMES THE YOUTUBE CAPABILITY LIKE ANY OTHER ── */
  {
    const grounding = await readIntegrationGroundingSource(TENANT, {
      readAvailability: async () =>
        ({
          readiness: "catalog-ready",
          capabilities: [
            {
              capability: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
              state: "available",
              reason: null,
              sources: [{ integrationId: "77777777-7777-4777-8777-777777777777", providerKey: "youtube", accountLabel: "YouTube Data API v3 — public read (no account)", lastVerifiedAt: "2026-09-03T17:00:00.000Z", readAvailable: true, writeCapable: false }],
            },
          ],
        }) as unknown as CapabilityAvailabilityView,
    });
    assert.equal(grounding.state, "resolved");
    const item = grounding.items.find((i) => i.recordRef === `youtube/${YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY}`);
    assert.ok(item, "Heby can ground on the YouTube capability state");
    assert.ok(item.detail.includes("write capability absent"), "and is told there is no write half");
    assert.ok(item.detail.includes("no account"), "and that no account is behind it");
    assert.ok(/No provider was contacted/.test(grounding.provenance));
  }

  console.log("PASS cgo5 command and truth");
}

void main();
