/*
 * tests/heby-truth-ux-repair-1/command-content-grounding.ts — HEBY-TRUTH-UX-REPAIR-1, live follow-up.
 *
 * Production turn a442fce2 (TRH, /heby → Command) asked whether "Black Rose Floral Kilim Rug" was
 * ready for YouTube. Its persisted evidence held ten classes and NO content draft, so Heby truthfully
 * answered that it had no record. The same question on /operations (turn 35f366e6) was grounded.
 * First divergence: the Command profile did not declare `content-media`.
 *
 * This proves, through the released answer flow and the released shaper (fixtures only at the
 * reader seams): the draft reaches a /heby answer; only the asking tenant's drafts do; a shared
 * title is marked, never picked; no draft is never invented; a READY YouTube package carries its
 * readiness and governed capability without any authority; earlier conversation does not displace it.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest, type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import {
  readContentMediaGroundingSource,
  type ContentMediaSourceDeps,
} from "../../src/features/content-composition/heby-content-media-source.server";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { resolveHebyWorkspace } from "../../src/features/heby-integration/panel-model";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";
import { createInMemoryConversationRepo } from "../helpers/in-memory-conversation-repo";
import type { DurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TRH = { tenantId: "9947c78e-2080-4331-81c6-456cb4be7a96", userId: "u-trh" } as unknown as TenantContext;
const OTHER = { tenantId: "f625b683-0000-4000-8000-000000000000", userId: "u-other" } as unknown as TenantContext;
const BLACK_ROSE = "bd3ab228-61c2-4b42-a2a9-82bd23e8eae1";
const OTHER_ROSE = "77777777-7777-4777-8777-777777777777";
const VID = "0e32a72d-e85e-4e97-9c9c-ed29a8058f25";
const QUESTION =
  "Black Rose Floral Kilim Rug taslağı şu an YouTube'a yüklenmeye hazır mı? Medya/paket hazırlığını, YouTube yetkisini, gereken onayları, şu anki gönderim durumunu ve senin neyi yapıp yapamayacağını ayrı ayrı söyle.";

type Draft = { id: string; title: string; destination: string };

/* Reader fixtures keyed by the tenant each reader is GIVEN — the shaper never chooses a tenant. */
function readers(byTenant: Record<string, Draft[]>, seen: string[]): ContentMediaSourceDeps {
  const drafts = (t: unknown) => {
    const id = (t as TenantContext).tenantId;
    seen.push(id);
    return byTenant[id] ?? [];
  };
  return {
    listArtifacts: (async (t: unknown) => ({
      status: "read",
      artifacts: drafts(t).map((d) => ({ id: d.id, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 2, title: d.title, intendedDestination: d.destination })),
    })) as never,
    listImages: (async (t: unknown) => (drafts(t), { status: "read", assets: [] })) as never,
    listVideos: (async (t: unknown) => ({
      status: "read",
      videos: drafts(t).map((d) => ({ assetId: d.id === BLACK_ROSE ? VID : `v-${d.id}`, origin: "supplied", mimeType: "video/mp4", width: 1280, height: 720, durationMs: 15083, videoCodec: "h264", audioCodec: "aac", frameRate: "30/1", lifecycle: "admitted", sourceArtifactId: d.id, sourceRevisionNo: 2, invocationId: null })),
    })) as never,
    listGenerations: (async (t: unknown) => (drafts(t), { status: "read", generations: [] })) as never,
    readReviewStates: (async (t: unknown, ids: readonly string[]) => (drafts(t), new Map(ids.map((id) => [id, { status: "read", decision: "accepted" }])))) as never,
    readPackage: (async (t: unknown, input: { artifactId: string }) => {
      drafts(t);
      const vid = input.artifactId === BLACK_ROSE ? VID : `v-${input.artifactId}`;
      return { status: "read", package: { selected: [{ mediaAssetId: vid, mediaKind: "video", origin: "supplied" }], blockers: [], ready: true, copyReviewState: "approved", destination: "youtube" } };
    }) as never,
    readProviderSwitch: async () => false,
    readCapabilityAvailability: (async (t: unknown) => {
      drafts(t);
      return {
        readiness: "catalog-ready",
        capabilities: [{ capability: "google.youtube.video.upload", state: "available", reason: null, sources: [{ integrationId: "c5e8637d", providerKey: "google-youtube", accountLabel: null, lastVerifiedAt: null, readAvailable: true, writeCapable: true }] }],
      };
    }) as never,
  };
}

const ENV = { HEBUN_MODEL_CONNECTIVITY_ENABLED: "true", HEBUN_MODEL_PROVIDER: "claude", HEBUN_MODEL_ID: "claude-test", HEBUN_MODEL_CREDENTIAL: "present" };

function answerDeps(
  tenant: TenantContext,
  byTenant: Record<string, Draft[]>,
  seen: string[],
  generated: ModelGenerationRequest[],
  repo: DurableConversationRepository | null = null,
): HebyModelAnswerDeps {
  return {
    resolveTenant: async () => tenant,
    readOverview: () => undefined,
    env: ENV,
    resolveDirectorEnabled: async () => true,
    selectTransport: () => ({ transport: createFakeClaudeTransport("success"), transportProvenance: "fake" }),
    generate: async (request, deps) => {
      generated.push(request);
      return generateHebyModelAnswer(request, deps);
    },
    getConversationRepo: () => repo,
    newCorrelationId: () => "corr",
    resolveContentMedia: (t) => readContentMediaGroundingSource(t, readers(byTenant, seen)),
  };
}

const grounding = (r: ModelGenerationRequest) => r.evidence.join("\n");

async function main(): Promise<void> {
  /* The route the Director used resolves to Command, and Command now declares the class. */
  assert.equal(resolveHebyWorkspace("/heby"), "command");
  assert.ok(getHebyWorkspaceProfile("command").sourceClasses.includes("content-media"));
  assert.equal(getHebyWorkspaceProfile("command").authority, "advisory-only", "H · seeing drafts gives Command no authority");

  const both: Record<string, Draft[]> = {
    [TRH.tenantId]: [{ id: BLACK_ROSE, title: "Black Rose Floral Kilim Rug", destination: "youtube" }],
    [OTHER.tenantId]: [{ id: OTHER_ROSE, title: "Black Rose Floral Kilim Rug", destination: "youtube" }],
  };

  /* ── A + E · the named draft reaches a /heby answer, with its readiness and its limits ── */
  {
    const seen: string[] = [];
    const generated: ModelGenerationRequest[] = [];
    const answered = await answerHebyModelRequest({ prompt: QUESTION, route: "/heby" }, answerDeps(TRH, both, seen, generated));
    assert.equal(answered.status, "answered");
    if (answered.status !== "answered") return;
    const refs = answered.outcome.response.evidence.map((e) => `${e.sourceClass}/${e.recordRef}`);
    assert.ok(refs.includes(`content-media/work-artifact/${BLACK_ROSE}@2`), "A · the draft is evidence of the /heby answer");
    /*
     * EXTERNAL-AI-DATA-USE-B2 changed what A/E/H pinned, on purpose. A content-media line mixes a
     * draft with its media and publish readiness — work-artifact, media and capability facts at once —
     * so it is not a class the platform can ALLOW for assistance, and the model-facing projection
     * WITHHOLDS it. The draft is still evidence of the HUMAN answer (above); the model learns only that
     * the class exists.
     */
    const g = grounding(generated[0]!);
    assert.match(g, /^\[content-media\] withheld — not disclosed to the external model$/m, "A · the class is wired, and withheld from the model");
    assert.doesNotMatch(g, /Black Rose Floral Kilim Rug|package ready|publish-path-governed/, "A/E · nothing about the draft reaches the model");

    /* ── B · only the asking tenant, even when the other tenant's draft has the same title ── */
    assert.ok(seen.length > 0 && seen.every((t) => t === TRH.tenantId), "B · every reader got exactly the asking tenant");
    assert.doesNotMatch(g, new RegExp(OTHER_ROSE), "B · the other tenant's same-titled draft never appears");
    assert.doesNotMatch(g, /title shared/, "B · a title shared across tenants is not ambiguity inside one");
  }

  /* ── C · a title two open drafts share is marked on both, never silently picked ── */
  {
    const r = await readContentMediaGroundingSource(TRH, readers({
      [TRH.tenantId]: [
        { id: BLACK_ROSE, title: "Black Rose Floral Kilim Rug", destination: "youtube" },
        { id: OTHER_ROSE, title: "  black rose  floral kilim rug ", destination: "instagram" },
        { id: "88888888-8888-4888-8888-888888888888", title: "Handwoven Kilim", destination: "youtube" },
      ],
    }, []));
    const detail = (id: string) => r.items.find((i) => i.recordRef.startsWith(`work-artifact/${id}`))!.detail;
    assert.match(detail(BLACK_ROSE), new RegExp(`title shared with another open draft: work-artifact/${OTHER_ROSE}@2`));
    assert.match(detail(OTHER_ROSE), new RegExp(`title shared with another open draft: work-artifact/${BLACK_ROSE}@2`));
    assert.doesNotMatch(detail("88888888-8888-4888-8888-888888888888"), /title shared/);
  }

  /* ── D · no draft: nothing is invented ── */
  {
    const generated: ModelGenerationRequest[] = [];
    const answered = await answerHebyModelRequest({ prompt: QUESTION, route: "/heby" }, answerDeps(TRH, {}, [], generated));
    assert.equal(answered.status, "answered");
    const g = grounding(generated[0]!);
    assert.match(g, /^\[content-media\] withheld — not disclosed to the external model$/m, "D · withheld whether or not a draft exists — the model cannot tell which");
    assert.doesNotMatch(g, /package ready: yes|publish-path-governed|work-artifact\//, "D · no readiness or capability claim for a draft that does not exist");
  }

  /* ── F · an earlier Instagram turn does not displace the current draft's facts ── */
  {
    const repo = createInMemoryConversationRepo();
    const generated: ModelGenerationRequest[] = [];
    const deps = answerDeps(TRH, both, [], generated, repo);
    const first = await answerHebyModelRequest({ prompt: "Instagram gözlemimiz ne diyor? Son gönderinin beğenileri?", route: "/heby" }, deps);
    assert.equal(first.status, "answered");
    const conversationId = first.status === "answered" && first.persistence.durable ? first.persistence.conversationId : undefined;
    assert.ok(conversationId, "turn 1 persisted");
    const second = await answerHebyModelRequest({ prompt: QUESTION, route: "/heby", conversationId }, deps);
    assert.equal(second.status, "answered");
    const req = generated[1]!;
    assert.ok((req.history ?? []).length > 0, "F · the earlier turn is carried as history");
    assert.match(grounding(req), /^\[content-media\] withheld — not disclosed to the external model$/m, "F · the current turn's draft class is still withheld (B2)");
  }

  /* ── G · a workspace that does not declare the class still never consults it ── */
  {
    let consulted = 0;
    await answerHebyModelRequest({ prompt: QUESTION, route: "/governance" }, {
      ...answerDeps(TRH, both, [], []),
      resolveContentMedia: async (t) => {
        consulted += 1;
        return readContentMediaGroundingSource(t, readers(both, []));
      },
    });
    assert.equal(consulted, 0, "G · scope is two profiles, not every workspace");
  }

  console.log("heby-truth-ux-repair-1/command-content-grounding: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
