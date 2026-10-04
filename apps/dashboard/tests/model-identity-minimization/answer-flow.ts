/*
 * MODEL-FACING IDENTITY MINIMIZATION — the real answer flow.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Driving the REAL `answerHebyModelRequest`, the model request it composes carries no provider
 *    account e-mail, login or username and no raw human or record UUID in its grounding or in
 *    Hebun's earlier answers — while the names, departments, states and capability facts the model
 *    needs still reach it, and the HUMAN-facing answer still shows exactly what it showed before."
 *
 * The integration source is the real builder over an injected seam; the people, placement, work
 * and organization items use those builders' own detail shapes. No database, no network, no key.
 */
import assert from "node:assert/strict";
import { readIntegrationGroundingSource } from "../../src/features/integration-authority/heby-integration-source.server";
import type { CapabilityAvailabilityView } from "../../src/features/integration-authority/contracts";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { ModelGenerationRequest, SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
const PERSON = "55555555-5555-4555-8555-555555555555";
const MEMBERSHIP = "66666666-6666-4666-8666-666666666666";
const PLACEMENT = "77777777-7777-4777-8777-777777777777";
const DEPARTMENT = "88888888-8888-4888-8888-888888888888";
const WORK_ITEM = "99999999-9999-4999-8999-999999999999";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "synthetic-test-model",
  HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
  HEBUN_MODEL_TRANSPORT: "fake",
};
const UNAVAILABLE = async () => ({
  status: "unavailable" as const,
  state: "TRANSPORT_UNAVAILABLE" as const,
  modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
});

function resolved(sourceClass: string, item: { recordRef: string; label: string; detail: string }): SourceResolution {
  return { sourceClass, state: "resolved", provenance: `${sourceClass} authority`, items: [{ ...item, lifecycle: "settled" }] } as unknown as SourceResolution;
}

async function main(): Promise<void> {
  /* ═══ 1. INTEGRATIONS (real builder): the account label never reaches the model ══════════════ */
  for (const [providerKey, accountLabel] of [
    ["google-workspace", "ops.lead@acme.example"],
    ["github", "acme-octocat"],
    ["instagram", "acme.rugs.official"],
  ] as const) {
    const view: CapabilityAvailabilityView = {
      readiness: "catalog-ready",
      capabilities: [
        {
          capability: "drive.metadata",
          state: "available",
          reason: null,
          sources: [
            {
              integrationId: "33333333-3333-4333-8333-333333333333",
              providerKey,
              accountLabel,
              lastVerifiedAt: "2026-08-20T10:00:00.000Z",
              readAvailable: true,
              writeCapable: false,
            },
          ],
        },
      ],
    } as unknown as CapabilityAvailabilityView;
    const source = await readIntegrationGroundingSource(TENANT, { readAvailability: async () => view });
    assert.equal(source.state, "resolved");
    const item = source.state === "resolved" ? source.items[0]! : undefined;
    assert.match(item!.detail, new RegExp(`account ${accountLabel.replace(/\./g, "\\.")}`), "the HUMAN-facing detail is unchanged");
    assert.ok(item!.modelDetail !== undefined && !item!.modelDetail.includes(accountLabel), "the model-facing detail omits the account");

    let captured: ModelGenerationRequest | undefined;
    const response = await answerHebyModelRequest(
      { prompt: "Which organizational systems are connected?", route: "/platform" },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        getConversationRepo: () => null,
        resolveDirectorEnabled: async () => true,
        env: ENV,
        resolveIntegrations: async () => source,
        generate: async (request) => {
          captured = request;
          return UNAVAILABLE();
        },
      },
    );
    assert.ok(captured, "the flow composed a model request");
    const grounding = captured!.evidence.join("\n");
    assert.ok(!grounding.includes(accountLabel), `${providerKey}: the account label does not reach the model`);
    /* EXTERNAL-AI-DATA-USE-B2: integrations are withheld from the model whole, not just their account. */
    assert.match(grounding, /^\[integrations\] withheld — not disclosed to the external model$/m, "the capability class is withheld");
    assert.ok(JSON.stringify(response).includes(accountLabel), `${providerKey}: the human-facing answer still shows the account`);
  }

  /* ═══ 2. PEOPLE · PLACEMENT · WORK · ORGANIZATION: names stay, identifiers do not ═══════════ */
  let captured: ModelGenerationRequest | undefined;
  const response = await answerHebyModelRequest(
    { prompt: "Who works where, and who is accountable for what?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: ENV,
      resolvePeople: async () =>
        resolved("people", {
          recordRef: `member/${MEMBERSHIP}`,
          label: "Ayşe Yılmaz",
          detail: `Ayşe Yılmaz (${PERSON}) is recorded as a member of this organization.`,
        }),
      resolvePlacements: async () =>
        resolved("placement", {
          recordRef: `placement/${PLACEMENT}`,
          label: "Finance",
          detail: `Ayşe Yılmaz (${PERSON}) is recorded as working in Finance [finance] (${DEPARTMENT}).`,
        }),
      resolveWork: async () =>
        resolved("work", {
          recordRef: `work-item/${WORK_ITEM}`,
          label: "Close the quarter",
          detail: `accountable human: Ayşe Yılmaz (${PERSON}). Department: Finance (${DEPARTMENT}).`,
        }),
      resolveOrganization: async () =>
        resolved("organization", {
          recordRef: "organization/acme",
          label: "Acme Rugs",
          detail: `Departments: Finance [finance] in service, owner ${PERSON}.`,
        }),
      generate: async (request) => {
        captured = request;
        return UNAVAILABLE();
      },
    },
  );
  assert.ok(captured);
  const grounding = captured!.evidence.join("\n");
  assert.ok(!UUID_RE.test(grounding), `no raw identifier reaches the model:\n${grounding}`);
  /* EXTERNAL-AI-DATA-USE-B2: none of these classes is disclosed now; each is one withheld line. */
  for (const withheld of ["people", "placement", "work", "organization"]) {
    assert.match(grounding, new RegExp(`^\\[${withheld}\\] withheld — not disclosed to the external model$`, "m"), `${withheld} is withheld`);
  }
  assert.ok(!/Ayşe Yılmaz|Acme Rugs|Close the quarter/.test(grounding), "no name, title or organization reaches the model");
  const human = JSON.stringify(response);
  assert.ok(human.includes(PERSON), "the human-facing answer is unchanged — it still shows what it showed before");

  /* ═══ 3. HISTORY: Heby's own earlier answer is minimized; the human's words are not ══════════ */
  {
    const CONVERSATION = "abababab-abab-4bab-8bab-abababababab";
    let historyRequest: ModelGenerationRequest | undefined;
    const stored = [
      { role: "user", content: `Who is ${PERSON}? Write to me at me@acme.example` },
      { role: "assistant", content: `Ayşe Yılmaz (${PERSON}) is a member; the connected account is ops.lead@acme.example.` },
    ];
    await answerHebyModelRequest(
      { prompt: "And where does she work?", route: "/heby", conversationId: CONVERSATION },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        /* Only the history read is exercised; every write is allowed to fail closed. */
        getConversationRepo: () => ({ listConversationMessages: async () => stored }) as never,
        resolveDirectorEnabled: async () => true,
        env: ENV,
        generate: async (request) => {
          historyRequest = request;
          return UNAVAILABLE();
        },
      },
    );
    assert.ok(historyRequest, "the flow composed a model request");
    assert.deepEqual(historyRequest!.history, [
      { role: "user", content: stored[0]!.content },
      { role: "assistant", content: "Ayşe Yılmaz is a member; the connected account is [address withheld]." },
    ]);
  }

  console.log("PASS model-identity-minimization answer-flow");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
