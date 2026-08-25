/*
 * INT-5A — CONNECTION GROUNDING SEMANTICS.
 *
 * What this proves: Heby can ground an answer in the tenant's INTEGRATION CAPABILITY STATE, and
 * cannot, through this class, learn anything that is inside a connected system.
 *
 * The distinction is the whole phase. "Drive metadata can currently be read" is a capability state
 * and is what this source says. "Here is a Drive file" is a provider record, requires a live
 * provider read, and is INT-5B. Several assertions below exist only to keep the second sentence
 * unrepresentable.
 *
 * No database, no network, no key, no provider. The seam is injected.
 */
import assert from "node:assert/strict";
import {
  readIntegrationGroundingSource,
  INTEGRATIONS_PROVENANCE,
  INTEGRATIONS_UNAVAILABLE,
} from "../../src/features/integration-authority/heby-integration-source.server";
import type {
  CapabilityAvailabilityView,
  CapabilitySource,
} from "../../src/features/integration-authority/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { resolveHebyWorkspaceContext } from "../../src/features/heby-integration/workspace-registry";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;

function source(over: Partial<CapabilitySource> = {}): CapabilitySource {
  return {
    integrationId: "33333333-3333-4333-8333-333333333333",
    providerKey: "google-workspace",
    accountLabel: "acme.example",
    lastVerifiedAt: "2026-08-20T10:00:00.000Z",
    readAvailable: true,
    writeCapable: false,
    ...over,
  };
}

function view(over: Partial<CapabilityAvailabilityView> = {}): CapabilityAvailabilityView {
  return {
    readiness: "catalog-ready",
    capabilities: [
      { capability: "drive.metadata", state: "available", reason: null, sources: [source()] },
    ],
    ...over,
  };
}

const read = (v: CapabilityAvailabilityView) =>
  readIntegrationGroundingSource(TENANT, { readAvailability: async () => v });

async function main(): Promise<void> {
  /* ── 1. THE CLASS EXISTS AND PLATFORM DECLARES IT ────────────────────────── */
  {
    assert.ok(
      HEBY_SOURCE_CLASSES.includes("integrations"),
      "the integrations source class must be part of the closed vocabulary",
    );

    const platform = resolveHebyWorkspaceContext({ workspace: "platform" });
    assert.ok(
      platform.sources.some((s) => s.sourceClass === "integrations"),
      "the Platform workspace must declare the integrations source class",
    );

    /*
     * AND ONLY PLATFORM. A class that quietly appeared everywhere would put connection state into
     * answers about Knowledge, Governance and Decisions, where it is not the referent.
     */
    for (const workspace of ["knowledge", "governance", "decisions", "operations", "command", "intelligence", "workforce"] as const) {
      const context = resolveHebyWorkspaceContext({ workspace });
      assert.ok(
        !context.sources.some((s) => s.sourceClass === "integrations"),
        `${workspace} must not declare the integrations source class`,
      );
    }
  }

  /* ── 2. THE PURE RESOLVER STAYS PURE ─────────────────────────────────────── */
  {
    /*
     * `resolveSource` holds no tenant and can open no connection, exactly as it does for Knowledge
     * and Governance. It must report the honest unavailable rather than a seeded capability.
     */
    const pure = resolveSource("integrations");
    assert.equal(pure.state, "unavailable");
    assert.equal(pure.items.length, 0);
    assert.equal(pure.authoritative, false);
    assert.match(String(pure.unavailableReason), /tenant-scoped on the server/i);
  }

  /* ── 3. A RESOLVED CAPABILITY BECOMES ONE GROUNDED ITEM ──────────────────── */
  {
    const resolution = await read(view());
    assert.equal(resolution.sourceClass, "integrations");
    assert.equal(resolution.state, "resolved");
    assert.equal(resolution.items.length, 1);

    const [item] = resolution.items;
    assert.equal(item!.recordRef, "google-workspace/drive.metadata", "the reference is provider/capability, both already owned elsewhere");
    assert.equal(item!.lifecycle, "settled", "an available capability is settled");
    assert.match(item!.detail, /state available/);
    assert.match(item!.detail, /read available/);
    assert.match(item!.detail, /account acme\.example/);
    assert.match(item!.detail, /last verified 2026-08-20/);
  }

  /* ── 4. NON-AUTHORITATIVE, ALWAYS ────────────────────────────────────────── */
  {
    /*
     * G6C's Governance source is authoritative because `decision_records` IS the record. This one
     * is the opposite: capability state is derived on every read from lifecycle + health + scopes.
     * Every arm must say so — a single `true` would let derived usability be cited as organizational
     * truth and, downstream, be promoted into Knowledge.
     */
    const arms = [
      await read(view()),
      await read(view({ readiness: "no-connectable-provider", capabilities: [] })),
      await read(view({ capabilities: [] })),
      await readIntegrationGroundingSource(null),
    ];
    for (const arm of arms) {
      assert.equal(arm.authoritative, false, "integration grounding is never authoritative");
      assert.equal(arm.provenance, INTEGRATIONS_PROVENANCE);
    }
  }

  /* ── 5. FAIL-CLOSED: EVERY ABSENCE IS A NAMED STATE, NEVER AN EMPTY SUCCESS ─ */
  {
    const noTenant = await readIntegrationGroundingSource(null);
    assert.equal(noTenant.state, "unavailable", "an unauthenticated caller must resolve noTenant, never a capability");
    assert.equal(noTenant.unavailableReason, INTEGRATIONS_UNAVAILABLE.noTenant, "the noTenant reason must be stated");
    assert.equal(noTenant.items.length, 0, "noTenant must produce no grounded item");

    const noProvider = await read(view({ readiness: "no-connectable-provider", capabilities: [] }));
    assert.equal(noProvider.state, "unavailable", "a build with no connectable provider must resolve noConnectableProvider");
    assert.equal(noProvider.unavailableReason, INTEGRATIONS_UNAVAILABLE.noConnectableProvider, "the noConnectableProvider reason must be stated");

    const noCapability = await read(view({ capabilities: [] }));
    assert.equal(noCapability.state, "unavailable", "a catalog with no declared capability must resolve noCapability");
    assert.equal(noCapability.unavailableReason, INTEGRATIONS_UNAVAILABLE.noCapability, "the noCapability reason must be stated");

    /*
     * NONE of them is `resolved` with zero items. A resolved-but-empty source reads to a model as
     * "we looked and everything is fine", which is the one thing an absence must never say.
     */
    for (const arm of [noTenant, noProvider, noCapability]) {
      assert.notEqual(arm.state, "resolved");
      assert.ok(arm.unavailableReason, "an unavailable source must always carry its reason");
    }
  }

  /* ── 6. DEGRADED IS NEVER AVAILABLE, AND THE REASON SURVIVES ─────────────── */
  {
    for (const [state, lifecycle] of [
      ["degraded", "unknown"],
      ["unverified", "unknown"],
      ["not-connected", "unknown"],
      ["revoked", "retired"],
    ] as const) {
      const resolution = await read(
        view({
          capabilities: [
            {
              capability: "drive.metadata",
              state,
              reason: `because ${state}`,
              sources: [source({ readAvailable: false })],
            },
          ],
        }),
      );
      const [item] = resolution.items;
      assert.equal(item!.lifecycle, lifecycle, `${state} must map to lifecycle ${lifecycle}`);
      assert.match(item!.detail, new RegExp(`state ${state}`), "the seam's state is carried verbatim");
      assert.match(item!.detail, /read not available/, "a non-available capability never reads as available");
      assert.match(item!.detail, new RegExp(`because ${state}`), "the seam's reason must survive into the grounding line");
      assert.ok(
        !/read available(?! )/.test(item!.detail.replace("read not available", "")),
        `${state} must never render as read available`,
      );
    }
  }

  /* ── 7. WRITE CAPABILITY IS STATED, AND NEVER IMPLIED ────────────────────── */
  {
    /*
     * INT-5A adds no write and may not imply one. Absence is stated explicitly rather than omitted:
     * a silent omission is what a model reads as "unknown, therefore maybe".
     */
    const absent = await read(view());
    assert.match(absent.items[0]!.detail, /write capability absent/);

    /*
     * Even when the seam reports a covered write grant, the wording stays CAPABILITY. There is no
     * permit here, no token and no handle, and nothing in this class may read as permission.
     */
    const present = await read(
      view({
        capabilities: [
          { capability: "drive.metadata", state: "available", reason: null, sources: [source({ writeCapable: true })] },
        ],
      }),
    );
    assert.match(present.items[0]!.detail, /write capability present/);
    for (const forbidden of [/may write/i, /authorized/i, /permitted/i, /permission/i]) {
      assert.ok(!forbidden.test(present.items[0]!.detail), `the detail must not imply authorization (${forbidden})`);
    }
  }

  /* ── 8. NO PROVIDER RECORD, NO SECRET, EVER ──────────────────────────────── */
  {
    /*
     * The serialized resolution is scanned as a whole. This is the assertion that keeps INT-5A from
     * drifting into INT-5B by accident: if a provider record or a credential-shaped value ever
     * reaches an item, it fails here regardless of which field carried it.
     */
    const resolution = await read(
      view({
        capabilities: [
          { capability: "drive.metadata", state: "available", reason: null, sources: [source()] },
          {
            capability: "repository-activity",
            state: "degraded",
            reason: "the provider is not currently responding",
            sources: [source({ providerKey: "github", accountLabel: "acme-org", readAvailable: false })],
          },
        ],
      }),
    );
    const serialized = JSON.stringify(resolution);
    for (const forbidden of [
      "access_token", "refresh_token", "apiKey", "api_key", "Bearer", "client_secret",
      "fileId", "driveId", "mimeType", "webViewLink", "pull_request", "pullRequest",
      "repositoryId", "installationId", "sha", "commit", "ciphertext",
    ]) {
      assert.ok(
        !serialized.includes(forbidden),
        `an integration grounding item must never carry "${forbidden}" — that is a provider record or a secret, not a capability state`,
      );
    }

    /* Two providers, two identities, and neither borrows the other's. */
    const refs = resolution.items.map((i) => i.recordRef).sort();
    assert.deepEqual(refs, ["github/repository-activity", "google-workspace/drive.metadata"]);
  }

  /* ── 9. THE INTEGRATION ROW UUID IS NOT THE PUBLIC IDENTITY ──────────────── */
  {
    /*
     * A capability is the thing being reported; one capability may be offered by several
     * connections; and a database id is not a stable public identity for a fact about what can be
     * read. The id must not appear anywhere in the item.
     */
    const resolution = await read(view());
    const serialized = JSON.stringify(resolution.items);
    assert.ok(
      !serialized.includes("33333333-3333-4333-8333-333333333333"),
      "the integrations row id must not become the grounded identity",
    );
  }

  /* ── 10. THE MODEL CANNOT INTRODUCE AN INTEGRATION IDENTITY ─────────────── */
  {
    /*
     * The whole grounding chain in one assertion. A capability the resolver produced is citable; a
     * capability the MODEL invented is not — and the existing validator, unweakened, is what says
     * so. If a model could mint `github/repository-activity` out of its own prose, Heby could tell
     * a Director a system is connected that never was.
     */
    const resolution = await read(view());
    const assembled = assembleEvidence([resolution]);
    assert.deepEqual(
      assembled.map((e) => `${e.sourceClass}/${e.recordRef}`),
      ["integrations/google-workspace/drive.metadata"],
      "a resolved capability becomes exactly one citable evidence identity",
    );

    const base = {
      kind: "EXPLANATION" as const,
      origin: "model" as const,
      title: "Platform — model-assisted answer",
      body: ["Drive metadata can currently be read."],
      provenance: [INTEGRATIONS_PROVENANCE],
      provenanceCovered: ["what-was-found", "where-it-came-from", "how-authoritative", "what-remains-uncertain"] as const,
      uncertainty: "supported" as const,
      limitations: [],
      authority: "restricted" as const,
      modelUsed: true,
    };

    const grounded = validateResponse(
      { ...base, evidence: assembled },
      assembled,
      "restricted",
    );
    assert.equal(grounded.valid, true, "a citation the resolver produced must validate");

    /* A provider the tenant never connected. */
    const invented = validateResponse(
      {
        ...base,
        evidence: [
          ...assembled,
          { sourceClass: "integrations", recordRef: "slack/messages.read", lifecycle: "settled" },
        ],
      },
      assembled,
      "restricted",
    );
    assert.equal(invented.valid, false, "a model-introduced integration identity must be rejected");
    assert.ok(
      invented.issues.some((i) => i.includes("slack/messages.read")),
      "the rejection must name the unsupported reference",
    );

    /* And a REAL provider whose capability was never resolved for this tenant. */
    const unresolved = validateResponse(
      {
        ...base,
        evidence: [
          { sourceClass: "integrations", recordRef: "github/repository-activity", lifecycle: "settled" },
        ],
      },
      assembled,
      "restricted",
    );
    assert.equal(unresolved.valid, false, "a real provider that this tenant did not resolve is still unsupported");
  }

  /* ── 11. THE SEAM IS ACTUALLY INVOKED BY THE ANSWER FLOW ────────────────── */
  {
    /*
     * An import-graph firewall proves REACHABILITY, not INVOCATION — INT-5A's own bite-proof M11
     * demonstrated exactly that by deleting the `withIntegrations` call while leaving its import in
     * place, and the firewall passed. So the wiring is proved here instead, behaviourally: the real
     * `answerHebyModelRequest` is driven on the Platform route with a fake transport, and the
     * SERVER-BUILT grounding context is captured from the model request it composes.
     *
     * No database, no network, no key: the tenant resolver, the transport and the integration read
     * are all injected.
     */
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      { prompt: "Which organizational systems are connected?", route: "/platform" },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        getConversationRepo: () => null,
        resolveDirectorEnabled: async () => true,
        env: {
          HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
          HEBUN_MODEL_PROVIDER: "claude",
          HEBUN_MODEL_ID: "synthetic-test-model",
          HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
          HEBUN_MODEL_TRANSPORT: "fake",
        },
        resolveIntegrations: async () => read(view()),
        generate: async (request) => {
          captured = request;
          return {
            status: "unavailable" as const,
            state: "TRANSPORT_UNAVAILABLE" as const,
            modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
          };
        },
      },
    );

    assert.ok(captured, "the answer flow must have composed a model request");
    const grounding = captured!.evidence.join("\n");
    assert.match(
      grounding,
      /\[integrations\/google-workspace\/drive\.metadata\]/,
      "the integration capability must reach the model's grounding context — if this fails, withIntegrations is not wired",
    );
    assert.match(grounding, /state available/, "the capability state travels with it");
    assert.match(grounding, /No provider was contacted/, "the provenance disclaims any provider contact");
  }

  console.log("int5a-flow/connection-grounding: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
