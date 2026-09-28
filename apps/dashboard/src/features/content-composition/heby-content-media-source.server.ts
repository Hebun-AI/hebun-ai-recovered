/*
 * content-composition/heby-content-media-source.server.ts — HEBY-MEDIA-1: what Heby may SEE of a
 * content draft's media, derived from the authorities that already own it.
 *
 * ── A SHAPER, NOT AN AUTHORITY ───────────────────────────────────────────────
 *
 * Every fact here is read through a released reader, and nothing is recomputed:
 *
 *   drafts            listWorkArtifacts                    (Work Artifacts)
 *   images            listArtifactMediaAssets              (Media, MEDIA-1 / MEDIA-SUPPLIED)
 *   videos            listArtifactMediaVideos              (Media, MV-3 / MV-7)
 *   video attempts    listArtifactVideoGenerations         (MV-4; carries MEDIA-5 source lineage)
 *   review            readMediaAssetReviewStates           (MEDIA-3, the Governance ledger)
 *   package           readContentPackage                   (CONTENT-COMPOSE-1, derived at read time)
 *   provider switch   resolveDirectorEnabled               (provider connectivity, fail-closed)
 *
 * It holds no database handle, writes nothing, resolves no transport, opens no stored object and
 * mints no read grant. It does not decide what a draft should use — that is HEBY-MEDIA-2, and a
 * recommendation is not something this read may carry. A firewall test pins the import list.
 *
 * ── WHAT IS DELIBERATELY LEFT OUT ────────────────────────────────────────────
 *
 * Storage keys, signed or public URLs, provider output references, provider job ids, byte
 * digests, Drive file ids, prompts, and every actor id. None of them helps Heby reason about which
 * medium a post has, and several of them are capabilities rather than facts.
 *
 *     SEEING MEDIA != OWNING MEDIA        PACKAGE READ != PACKAGE READY
 *     SWITCH OFF   != PROVIDER ABSENT     REVIEW ACCEPTED != PUBLISH AUTHORIZED
 *
 * Tenant comes only from the authenticated context passed in, and every reader below applies its
 * own tenant predicate. Server-only. Reads only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { SourceResolution } from "@/features/heby-runtime";
import { resolveDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { listArtifactVideoGenerations } from "@/features/media-assets/async-generation-lifecycle.server";
import { listArtifactMediaAssets } from "@/features/media-assets/read-media-assets.server";
import { listArtifactMediaVideos } from "@/features/media-assets/read-media-videos.server";
import {
  HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY,
  HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY,
} from "@/features/media-generation-live/higgsfield-video-control";
import { readMediaAssetReviewStates } from "@/features/media-asset-review/review-media-asset.server";
import { listWorkArtifacts } from "@/features/work-artifacts/read-work-artifacts.server";
import { formatWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { CONTENT_DRAFT_TYPE } from "@/features/work-artifacts/contracts";
import {
  evaluateMediaChoice,
  formatMediaChoice,
  type DraftMediaFacts,
  type MediaChoice,
  type MediaFact,
  type MediaFactReview,
} from "./media-choice";
import { evaluateMediaNextStep, formatMediaNextStep, type MediaNextStep } from "./media-next-step";
import { prefillFromChoice, type MediaPrefill } from "./media-prefill";
import { readContentPackage } from "./read-content-package.server";

export const CONTENT_MEDIA_PROVENANCE =
  "Content media — each open content draft's current revision: its admitted images and videos, their MEDIA-3 review records, its video generation attempts with source-image lineage, and its derived Content Package, read through the Media, Governance and Content authorities; plus the two Higgsfield connectivity switches. Heby owns none of these records and this source changes none of them (authoritative: false).";

/** Drafts are newest first; a bounded number keeps grounding from becoming a media inventory. */
export const CONTENT_MEDIA_DRAFT_LIMIT = 10;

export const CONTENT_MEDIA_PROVIDER_KEYS = [
  HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY,
  HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY,
] as const;

export interface ContentMediaSourceDeps {
  readonly listArtifacts?: typeof listWorkArtifacts;
  readonly listImages?: typeof listArtifactMediaAssets;
  readonly listVideos?: typeof listArtifactMediaVideos;
  readonly listGenerations?: typeof listArtifactVideoGenerations;
  readonly readReviewStates?: typeof readMediaAssetReviewStates;
  readonly readPackage?: typeof readContentPackage;
  readonly readProviderSwitch?: (providerKey: string) => Promise<boolean>;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "content-media",
    state: "unavailable",
    provenance: CONTENT_MEDIA_PROVENANCE,
    authoritative: false,
    items: [],
    unavailableReason: reason,
  };
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/*
 * MEDIA-3's own ledger words. Never "approved": the response guard reads that verb as a claim, and
 * a media review is a creative judgement recorded by Governance, not an authorization Heby holds.
 */
function reviewWord(decision: string | null | undefined): string {
  if (decision === "accepted") return "review accepted";
  if (decision === "declined") return "review declined";
  return "no review recorded";
}

type ResolvedItem = SourceResolution["items"][number];

type Collected =
  | { readonly status: "unavailable"; readonly reason: string }
  | {
      readonly status: "read";
      readonly switches: readonly ResolvedItem[];
      readonly entries: readonly {
        readonly item: ResolvedItem;
        readonly facts: DraftMediaFacts;
        readonly choice: MediaChoice;
        readonly prefill: MediaPrefill;
        readonly nextStep: MediaNextStep;
      }[];
    };

/*
 * ONE read, two renderings: the Heby grounding resolution and (HEBY-MEDIA-3) the typed prefill a
 * human sees on /operations. Both come from the same facts, so they cannot disagree.
 */
async function collectContentMedia(tenant: TenantContext | null, deps: ContentMediaSourceDeps): Promise<Collected> {
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable", reason: "No authorized tenant context was supplied." };

  const listing = await (deps.listArtifacts ?? listWorkArtifacts)(tenant);
  const switchState: Record<string, boolean> = {};
  if (listing.status !== "read") {
    return { status: "unavailable", reason: "Content drafts could not be read, so nothing is reported about their media." };
  }
  const drafts = listing.artifacts
    .filter((a) => a.artifactType === CONTENT_DRAFT_TYPE && a.lifecycleStatus === "draft")
    .slice(0, CONTENT_MEDIA_DRAFT_LIMIT);

  const switches = await Promise.all(
    CONTENT_MEDIA_PROVIDER_KEYS.map(async (key) => {
      let enabled = false;
      try {
        enabled = await (deps.readProviderSwitch ?? ((k: string) => resolveDirectorEnabled(k)))(key);
      } catch {
        enabled = false;
      }
      switchState[key] = enabled;
      return {
        recordRef: `provider-connectivity/${key}`,
        label: `Connectivity switch ${key}`,
        detail: [
          `switch: ${enabled ? "on" : "off"}`,
          "read fail-closed — no row, off, or an unreadable control all read as off",
          "a switch is not a credential, a price or a data-use permission",
        ].join(" · "),
        lifecycle: "settled" as const,
      };
    }),
  );

  if (drafts.length === 0) return { status: "read", switches, entries: [] };

  const artifactIds = drafts.map((d) => d.id);
  const [images, videos, generations] = await Promise.all([
    (deps.listImages ?? listArtifactMediaAssets)(tenant, { artifactIds }),
    (deps.listVideos ?? listArtifactMediaVideos)(tenant, { artifactIds }),
    (deps.listGenerations ?? listArtifactVideoGenerations)(tenant, { artifactIds }),
  ]);
  if (images.status !== "read" || videos.status !== "read") {
    return { status: "unavailable", reason: "Media records could not be read, so nothing is reported about draft media." };
  }
  const assetIds = [...images.assets.map((a) => a.assetId), ...videos.videos.map((v) => v.assetId)];
  const reviews = await (deps.readReviewStates ?? readMediaAssetReviewStates)(tenant, assetIds);
  const generationRows = generations.status === "read" ? generations.generations : null;

  const entries = [];
  for (const draft of drafts) {
    const pkg = await (deps.readPackage ?? readContentPackage)(tenant, {
      artifactId: draft.id,
      revisionNo: draft.currentRevision,
    });
    const selected = new Set(pkg.status === "read" ? pkg.package.selected.map((s) => s.mediaAssetId) : []);
    const review = (id: string) => {
      const s = reviews.get(id);
      return s?.status === "read" ? reviewWord(s.decision) : "review unreadable";
    };
    /* HEBY-MEDIA-2 — the same facts, typed, for the pure evaluator. Nothing is read twice. */
    const reviewFact = (id: string): MediaFactReview => {
      const s = reviews.get(id);
      if (s?.status !== "read") return "unreadable";
      return s.decision === "accepted" ? "accepted" : s.decision === "declined" ? "declined" : "none";
    };
    const facts: MediaFact[] = [
      ...images.assets
        .filter((x) => x.sourceArtifactId === draft.id)
        .map((a) => ({
          assetId: a.assetId,
          kind: "image" as const,
          origin: a.origin,
          lifecycle: a.lifecycle,
          review: reviewFact(a.assetId),
          selectedInCurrentRevision: selected.has(a.assetId),
        })),
      ...videos.videos
        .filter((x) => x.sourceArtifactId === draft.id)
        .map((v) => ({
          assetId: v.assetId,
          kind: "video" as const,
          origin: v.origin,
          lifecycle: v.lifecycle,
          review: reviewFact(v.assetId),
          selectedInCurrentRevision: selected.has(v.assetId),
        })),
    ];
    const draftFacts: DraftMediaFacts = {
      artifactId: draft.id,
      currentRevision: draft.currentRevision,
      destination: draft.intendedDestination,
      packageReadable: pkg.status === "read",
      media: facts,
      attempts: generationRows
        ? generationRows
            .filter((g) => g.sourceArtifactId === draft.id)
            .map((g) => ({ invocationId: g.invocationId, state: g.state, admissionOutcome: g.admissionOutcome, sourceMediaAssetId: g.sourceMediaAssetId }))
        : null,
    };
    const choice = evaluateMediaChoice(
      draftFacts,
      {
        textToVideo: switchState[HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY] === true,
        imageToVideo: switchState[HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY] === true,
        image: "not-read",
      },
    );

    const lines: string[] = [];
    for (const a of images.assets.filter((x) => x.sourceArtifactId === draft.id)) {
      lines.push(
        [
          `image ${a.assetId}`,
          `origin ${a.origin}`,
          a.mimeType,
          `${a.width}x${a.height}`,
          `from revision ${a.sourceRevisionNo}`,
          a.lifecycle,
          review(a.assetId),
          selected.has(a.assetId) ? `selected in revision ${draft.currentRevision}` : "not selected in the current revision",
        ].join(" · "),
      );
    }
    for (const v of videos.videos.filter((x) => x.sourceArtifactId === draft.id)) {
      const lineage = generationRows?.find((g) => g.invocationId === v.invocationId)?.sourceMediaAssetId ?? null;
      lines.push(
        [
          `video ${v.assetId}`,
          `origin ${v.origin}`,
          v.mimeType,
          `${v.width}x${v.height}`,
          seconds(v.durationMs),
          v.videoCodec,
          v.audioCodec ? `audio ${v.audioCodec}` : "no audio",
          `${v.frameRate} fps`,
          `from revision ${v.sourceRevisionNo}`,
          v.lifecycle,
          ...(v.origin === "generated" ? [lineage ? `generated from image ${lineage}` : "generated from text"] : []),
          review(v.assetId),
          selected.has(v.assetId) ? `selected in revision ${draft.currentRevision}` : "not selected in the current revision",
        ].join(" · "),
      );
    }
    if (generationRows) {
      for (const g of generationRows.filter((x) => x.sourceArtifactId === draft.id)) {
        lines.push(
          [
            `video attempt ${g.invocationId}`,
            `${g.provider} ${g.model}`,
            g.simulated ? "simulated" : "live",
            `state ${g.state}`,
            `admission ${g.admissionOutcome}`,
            `from revision ${g.sourceRevisionNo}`,
            g.sourceMediaAssetId ? `source image ${g.sourceMediaAssetId}` : "text only",
          ].join(" · "),
        );
      }
    } else {
      lines.push("video attempts could not be read");
    }

    let packageSegments: string[];
    if (pkg.status === "read") {
      const p = pkg.package;
      const imageCount = p.selected.filter((s) => s.mediaKind === "image").length;
      const videoCount = p.selected.filter((s) => s.mediaKind === "video").length;
      packageSegments = [
        `package revision ${p.revisionNo}: ${imageCount} image${imageCount === 1 ? "" : "s"} · ${videoCount} video${videoCount === 1 ? "" : "s"} selected`,
        `package ready: ${p.ready ? "yes" : "no"}`,
        `blockers: ${p.blockers.length > 0 ? p.blockers.join(", ") : "none"}`,
        "a ready package is not a publish authorization",
      ];
    } else {
      packageSegments = [`package: ${pkg.status === "not-found" ? "not found" : "could not be read"}`];
    }

    /* HEBY-MEDIA-3 / -4 — the prefill and the observed next step, from the same facts. */
    const prefill = prefillFromChoice(draftFacts, choice);
    const nextStep = evaluateMediaNextStep(
      draftFacts,
      choice,
      prefill,
      pkg.status === "read" ? { status: "read", ready: pkg.package.ready, blockers: pkg.package.blockers } : { status: "unavailable" },
    );

    const item: ResolvedItem = {
      recordRef: formatWorkArtifactRef(draft.id, draft.currentRevision),
      label: draft.title,
      detail: [
        `content draft · current revision ${draft.currentRevision}`,
        ...(draft.intendedDestination ? [`destination (declared): ${draft.intendedDestination}`] : []),
        ...packageSegments,
        `${lines.length === 0 ? "no admitted media and no video attempts" : `${lines.length} media line${lines.length === 1 ? "" : "s"}`}`,
        `media recommendation (deterministic): ${choice.kind}`,
        `media next step (observed): ${nextStep.state}`,
        `media complete: ${nextStep.mediaComplete ? "yes" : "no"}`,
      ].join(" · "),
      lifecycle: "settled" as const,
      /* Media lines are data for the model's grounding, kept out of Heby's own prose. */
      content: [...lines, ...formatMediaChoice(choice), ...formatMediaNextStep(nextStep)].join("\n"),
    };
    entries.push({ item, facts: draftFacts, choice, prefill, nextStep });
  }

  return { status: "read", switches, entries };
}

/** Resolve this tenant's open content drafts into one media-context resolution. */
export async function readContentMediaGroundingSource(
  tenant: TenantContext | null,
  deps: ContentMediaSourceDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") throw new Error("Content media grounding is server-only.");
  const collected = await collectContentMedia(tenant, deps);
  if (collected.status === "unavailable") return unavailable(collected.reason);
  const noDrafts: ResolvedItem = {
    recordRef: "content-media/no-open-content-drafts",
    label: "No open content drafts",
    detail: "your organization holds no open content draft, so no draft media is reported",
    lifecycle: "settled",
  };
  return {
    sourceClass: "content-media",
    state: "resolved",
    provenance: CONTENT_MEDIA_PROVENANCE,
    authoritative: false,
    items: [...(collected.entries.length === 0 ? [noDrafts] : collected.entries.map((e) => e.item)), ...collected.switches],
    unavailableReason: undefined,
  };
}

export type ContentMediaPrefillListing =
  | { readonly status: "unavailable" }
  | { readonly status: "read"; readonly prefills: readonly MediaPrefill[]; readonly nextSteps: readonly MediaNextStep[] };

/**
 * HEBY-MEDIA-3 — the typed, ephemeral prefill for each open content draft, derived from the same
 * read and the same recommendation Heby is grounded on. DATA ONLY: nothing is persisted, nothing is
 * selected, generated or reviewed here. A human acting on it goes through the existing action,
 * whose writer revalidates everything against current state.
 */
export async function readContentMediaPrefills(
  tenant: TenantContext | null,
  deps: ContentMediaSourceDeps = {},
): Promise<ContentMediaPrefillListing> {
  if (typeof window !== "undefined") throw new Error("Content media prefill is server-only.");
  const collected = await collectContentMedia(tenant, deps);
  if (collected.status === "unavailable") return { status: "unavailable" };
  return { status: "read", prefills: collected.entries.map((e) => e.prefill), nextSteps: collected.entries.map((e) => e.nextStep) };
}
